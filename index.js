const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const PSD = require('psd');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const chokidar = require('chokidar');
const { google } = require('googleapis');
const TOKEN_PATH = 'google-calendar-token.json';
const CREDENTIALS_PATH = './google-calendar-credentials.json';
const USER_PROFILE_PATH = path.join(process.cwd(), 'user-profile.json');
const AGENCY_PROFILE_PATH = path.join(process.cwd(), 'agency-profile.json');
const LOCAL_ACCOUNTS_PATH = path.join(process.cwd(), 'local-accounts.json');

let mainWindow = null;
let tray = null;

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    mainWindow = win;

    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, 'app', 'build', 'index.html'));
    }
}

// ─── Local bridge server (web app connects to this) ──────────────────────────
// Listens on localhost:7777 so the web app can detect the client and open files
const http = require('http');

function startBridgeServer() {
    const server = http.createServer(async (req, res) => {
        // Allow requests from the web app (CORS)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

        const url = new URL(req.url, 'http://localhost:7777');

        // GET /ping — health check so the web app knows the client is running
        if (req.method === 'GET' && url.pathname === '/ping') {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, version: '1.0', platform: process.platform }));
            return;
        }

        // POST /open — download a cloud file and open it in the correct design app
        if (req.method === 'POST' && url.pathname === '/open') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const { fileUrl, fileName } = JSON.parse(body);
                    if (!fileUrl || !fileName) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: 'fileUrl and fileName required' }));
                        return;
                    }

                    // Download the file to a temp directory
                    const os = require('os');
                    const zlib = require('zlib');
                    const tmpDir = path.join(os.tmpdir(), 'designer-collab');
                    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
                    const localPath = path.join(tmpDir, fileName);

                    // Fetch from Supabase Storage into a buffer
                    const http2 = fileUrl.startsWith('https') ? require('https') : require('http');
                    const rawBuffer = await new Promise((resolve, reject) => {
                        http2.get(fileUrl, response => {
                            const chunks = [];
                            response.on('data', chunk => chunks.push(chunk));
                            response.on('end', () => resolve(Buffer.concat(chunks)));
                            response.on('error', reject);
                        }).on('error', reject);
                    });

                    // Decompress if gzip (magic bytes 0x1F 0x8B) — safe for old uncompressed files too
                    let fileBuffer = rawBuffer;
                    if (rawBuffer[0] === 0x1F && rawBuffer[1] === 0x8B) {
                        fileBuffer = await new Promise((resolve, reject) => {
                            zlib.gunzip(rawBuffer, (err, result) => err ? reject(err) : resolve(result));
                        });
                    }
                    fs.writeFileSync(localPath, fileBuffer);

                    // Open with the correct design app
                    const ext = path.extname(fileName).toLowerCase();
                    const { execSync } = require('child_process');
                    const platform = process.platform;
                    let opened = false;

                    if (platform === 'darwin') {
                        const appNames = (ext === '.psd' || ext === '.psb')
                            ? ['Adobe Photoshop 2025', 'Adobe Photoshop 2024', 'Adobe Photoshop 2023', 'Adobe Photoshop 2022', 'Adobe Photoshop']
                            : (ext === '.ai' || ext === '.eps')
                            ? ['Adobe Illustrator 2025', 'Adobe Illustrator 2024', 'Adobe Illustrator 2023', 'Adobe Illustrator 2022', 'Adobe Illustrator']
                            : [];
                        for (const name of appNames) {
                            try { execSync(`open -a "${name}" "${localPath}"`, { stdio: 'pipe' }); opened = true; break; } catch (_) {}
                        }
                        if (!opened) { const err = await shell.openPath(localPath); opened = !err; }
                    } else {
                        const err = await shell.openPath(localPath);
                        opened = !err;
                    }

                    res.writeHead(200);
                    res.end(JSON.stringify({ ok: true, opened, localPath }));
                } catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // GET /mtime?path=<encoded> — returns file modification time
        if (req.method === 'GET' && url.pathname === '/mtime') {
            const filePath = decodeURIComponent(url.searchParams.get('path') || '');
            if (!filePath) { res.writeHead(400); res.end(JSON.stringify({ error: 'path required' })); return; }
            try {
                const stat = fs.statSync(filePath);
                res.writeHead(200);
                res.end(JSON.stringify({ mtime: stat.mtimeMs }));
            } catch (e) {
                res.writeHead(200);
                res.end(JSON.stringify({ mtime: 0 }));
            }
            return;
        }

        // GET /read-file?path=<encoded> — returns raw file bytes (for web → Supabase upload)
        if (req.method === 'GET' && url.pathname === '/read-file') {
            const filePath = decodeURIComponent(url.searchParams.get('path') || '');
            if (!filePath) { res.writeHead(400); res.end(JSON.stringify({ error: 'path required' })); return; }
            try {
                const data = fs.readFileSync(filePath);
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.writeHead(200);
                res.end(data);
            } catch (e) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(7777, '127.0.0.1', () => {
        console.log('[bridge] Local server running on http://127.0.0.1:7777');
    });

    server.on('error', (e) => {
        if (e.code !== 'EADDRINUSE') console.error('[bridge] Server error:', e.message);
    });
}

function createTray() {
    // Minimal 16x16 monochrome template icon (works on macOS light/dark menu bar)
    const iconBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAiklEQVQ4y2NgGAWkAkYGBob/DMT' +
        'QwMDwn1w9jAwMDP+p0czIwMDwH6+BpGoGaQMDw3+yDSBXMygbGBj+k20AuZpB2cDA8J9sA8jVDMoGBob/ZBtArmZQNjAw/Cfb' +
        'AHI1g7KBgeE/2QaQqxmUDQwM/8k2gFzNoGxgYPhPtgHkagZlAwPDf7INAAAA//8DADhrBSv9EQAAAABJRU5ErkJggg==';

    const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
    icon.setTemplateImage(true); // adapts to macOS menu bar theme

    tray = new Tray(icon);
    tray.setToolTip('My Agency — cliente de escritorio activo');

    const menu = Menu.buildFromTemplate([
        { label: 'My Agency está activo', enabled: false },
        { type: 'separator' },
        { label: 'Salir', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
}

app.whenReady().then(() => {
    // Run as background agent — no window, no dock icon
    if (process.platform === 'darwin') {
        app.dock.hide();
    }
    app.setActivationPolicy && app.setActivationPolicy('accessory');

    createTray();
    startBridgeServer();
});

// Don't quit when all windows are closed — we're a background agent
app.on('window-all-closed', () => { /* stay alive */ });

function convertToPngWithQlmanage(filePath, pngPath) {
    const { execFileSync } = require('child_process');
    const outDir = path.dirname(pngPath);
    const baseName = path.basename(filePath);
    const before = new Set(fs.readdirSync(outDir));
    execFileSync('qlmanage', ['-t', '-s', '1024', '-o', outDir, filePath], { stdio: 'pipe' });
    const after = fs.readdirSync(outDir);
    const newPng = after.find(f => f.endsWith('.png') && !before.has(f));
    if (newPng) {
        const src = path.join(outDir, newPng);
        if (path.resolve(src) !== path.resolve(pngPath)) {
            fs.renameSync(src, pngPath);
        }
    } else {
        throw new Error('qlmanage no generó archivo');
    }
}

function convertToPngWithImageMagick(filePath, pngPath) {
    const { execFileSync } = require('child_process');
    execFileSync('convert', [`${filePath}[0]`, 'png:' + pngPath], { stdio: 'pipe' });
}

ipcMain.handle('convert-to-png', async (event, filePath) => {
    const pngPath = filePath + '.preview.png';
    try {
        if (filePath.toLowerCase().endsWith('.psd')) {
            try {
                const psd = await PSD.open(filePath);
                if (psd.image) {
                    await psd.image.saveAsPng(pngPath);
                } else {
                    throw new Error('PSD sin imagen compuesta');
                }
            } catch (psdErr) {
                try {
                    convertToPngWithQlmanage(filePath, pngPath);
                } catch (qlErr) {
                    try {
                        convertToPngWithImageMagick(filePath, pngPath);
                    } catch (imErr) {
                        return { error: 'No se pudo previsualizar este PSD. Probá con ImageMagick: brew install imagemagick. Error: ' + psdErr.message };
                    }
                }
            }
            const pngBuffer = fs.readFileSync(pngPath);
            return { base64: pngBuffer.toString('base64') };
        } else if (filePath.toLowerCase().endsWith('.ai')) {
            try {
                convertToPngWithQlmanage(filePath, pngPath);
            } catch (qlErr) {
                try {
                    execFileSync('inkscape', [filePath, '--export-type=png', '--export-filename', pngPath], { stdio: 'pipe' });
                } catch (inkscapeErr) {
                    try {
                        convertToPngWithImageMagick(filePath, pngPath);
                    } catch (imErr) {
                        return { error: 'No se pudo previsualizar este AI. Instalá ImageMagick: brew install imagemagick. Error: ' + qlErr.message };
                    }
                }
            }
            const pngBuffer = fs.readFileSync(pngPath);
            return { base64: pngBuffer.toString('base64') };
        } else {
            return { error: 'Formato no soportado para previsualización.' };
        }
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('list-psd-files', async (event, projectName) => {
    const folder = path.join(process.cwd(), 'test-psd', projectName);
    try {
        const files = fs.readdirSync(folder)
            .filter(f => f.toLowerCase().endsWith('.psd') || f.toLowerCase().endsWith('.ai'))
            .map(f => ({
                name: f,
                path: path.join(folder, f)
            }));
        return files;
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('open-file-dialog', async (event, projectName) => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Diseño', extensions: ['psd', 'ai'] },
            { name: 'Todos los archivos', extensions: ['*'] }
        ]
    });
    if (result.canceled) return { canceled: true };
    const folder = path.join(process.cwd(), 'test-psd', projectName);
    try {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        let filesInfo = [];
        for (const filePath of result.filePaths) {
            const fileName = path.basename(filePath);
            const destPath = path.join(folder, fileName);
            fs.copyFileSync(filePath, destPath);
            // Generar hash criptográfico
            const hash = getFileHash(destPath);
            // Guardar metadatos
            const stat = fs.statSync(destPath);
            const meta = {
                hash,
                size: stat.size,
                created: stat.birthtime.toISOString(),
                modified: stat.mtime.toISOString(),
                owner: 'Agustín Ruiz' // TODO: obtener del usuario logueado
            };
            const metaPath = destPath + '.meta.json';
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            filesInfo.push({ name: fileName, path: destPath, hash });
        }
        return { success: true, files: filesInfo };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('open-in-photoshop', async (event, filePath) => {
    const err = await shell.openPath(filePath);
    return err ? { error: err } : { success: true };
});

ipcMain.handle('open-in-design-app', async (event, filePath, ext) => {
    const { execSync, spawn } = require('child_process');
    const platform = process.platform;

    // Fallback universal: deja que el OS abra con la app por defecto
    const openDefault = async () => {
        const err = await shell.openPath(filePath);
        return err ? { error: err } : { success: true, fallback: true };
    };

    try {
        if (platform === 'darwin') {
            // macOS — prueba versiones de Adobe en orden, cae al default
            const appNames = (ext === '.psd' || ext === '.psb')
                ? ['Adobe Photoshop 2025', 'Adobe Photoshop 2024', 'Adobe Photoshop 2023', 'Adobe Photoshop 2022', 'Adobe Photoshop']
                : (ext === '.ai' || ext === '.eps' || ext === '.svg')
                ? ['Adobe Illustrator 2025', 'Adobe Illustrator 2024', 'Adobe Illustrator 2023', 'Adobe Illustrator 2022', 'Adobe Illustrator']
                : [];

            for (const name of appNames) {
                try {
                    execSync(`open -a "${name}" "${filePath}"`, { stdio: 'pipe' });
                    return { success: true };
                } catch (_) { /* probar siguiente */ }
            }
            return openDefault();

        } else if (platform === 'win32') {
            // Windows — busca en Program Files y Program Files (x86)
            const roots = [
                process.env['ProgramFiles'],
                process.env['ProgramFiles(x86)'],
                process.env['ProgramW6432'],
            ].filter(Boolean);

            const exeRelPaths = (ext === '.psd' || ext === '.psb')
                ? [
                    'Adobe\\Adobe Photoshop 2025\\Photoshop.exe',
                    'Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
                    'Adobe\\Adobe Photoshop 2023\\Photoshop.exe',
                    'Adobe\\Adobe Photoshop 2022\\Photoshop.exe',
                  ]
                : (ext === '.ai' || ext === '.eps')
                ? [
                    'Adobe\\Adobe Illustrator 2025\\Support Files\\Contents\\Windows\\Illustrator.exe',
                    'Adobe\\Adobe Illustrator 2024\\Support Files\\Contents\\Windows\\Illustrator.exe',
                    'Adobe\\Adobe Illustrator 2023\\Support Files\\Contents\\Windows\\Illustrator.exe',
                    'Adobe\\Adobe Illustrator 2022\\Support Files\\Contents\\Windows\\Illustrator.exe',
                  ]
                : [];

            for (const root of roots) {
                for (const rel of exeRelPaths) {
                    const full = path.join(root, rel);
                    if (fs.existsSync(full)) {
                        spawn(full, [filePath], { detached: true, stdio: 'ignore' }).unref();
                        return { success: true };
                    }
                }
            }
            return openDefault();

        } else {
            // Linux y cualquier otro — usa el handler del sistema
            return openDefault();
        }
    } catch (err) {
        return openDefault();
    }
});

ipcMain.handle('analyze-design-file', async (event, filePath) => {
    try {
        console.log('[ANALYZE] Analizando archivo:', filePath);
        if (filePath.toLowerCase().endsWith('.psd')) {
            const psd = await PSD.open(filePath);
            const layers = psd.tree().descendants().map(layer => {
                let text = '';
                try {
                    text = layer.get('typeTool') && layer.get('typeTool').textValue ? String(layer.get('typeTool').textValue) : '';
                } catch (e) {
                    text = '';
                }
                return {
                    name: typeof layer.name === 'string' ? layer.name : '',
                    type: typeof layer.type === 'string' ? layer.type : '',
                    text,
                    visible: !!layer.visible
                };
            });
            console.log('[ANALYZE][PSD] Capas encontradas:', layers.map(l => l.name));
            return { type: 'psd', layers: layers.map(l => ({ ...l })) };
        } else if (filePath.toLowerCase().endsWith('.ai')) {
            const { execFileSync } = require('child_process');
            const svgPath = filePath + '.temp.svg';
            execFileSync('inkscape', [filePath, '--export-type=svg', '--export-filename', svgPath]);
            const svgContent = fs.readFileSync(svgPath, 'utf8');
            const numPaths = (svgContent.match(/<path /g) || []).length;
            const numTexts = (svgContent.match(/<text /g) || []).length;
            const numImages = (svgContent.match(/<image /g) || []).length;
            console.log('[ANALYZE][AI] paths:', numPaths, 'texts:', numTexts, 'images:', numImages);
            return { type: 'ai', numPaths, numTexts, numImages };
        } else {
            console.log('[ANALYZE] Formato no soportado:', filePath);
            return { error: 'Formato no soportado para análisis.' };
        }
    } catch (err) {
        console.error('[ANALYZE][ERROR]', err);
        return { error: err.message };
    }
});

function getOAuth2Client() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed;
    return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

ipcMain.handle('google-calendar-auth', async () => {
    try {
        const oAuth2Client = getOAuth2Client();
        if (fs.existsSync(TOKEN_PATH)) {
            try {
                const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
                oAuth2Client.setCredentials(token);
                // Validate the token with a quick API call
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                await calendar.calendars.get({ calendarId: 'primary' });
                return { success: true };
            } catch (e) {
                // Token expired or invalid — delete it and proceed to auth flow
                if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
            }
        }
        const oAuth2Client2 = getOAuth2Client();
        const authUrl = oAuth2Client2.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
        });
        require('electron').shell.openExternal(authUrl);
        return { url: authUrl };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('google-calendar-save-token', async (event, code) => {
    const oAuth2Client = getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    return { success: true };
});

ipcMain.handle('google-calendar-events', async () => {
    try {
        const oAuth2Client = getOAuth2Client();
        if (!fs.existsSync(TOKEN_PATH)) return { error: 'No autenticado' };
        oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items;
    } catch (e) {
        if (e.message && e.message.includes('invalid_grant')) {
            if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
            return { error: 'invalid_grant' };
        }
        return { error: e.message };
    }
});

ipcMain.handle('create-calendar-event', async (event, eventData) => {
    try {
        const oAuth2Client = getOAuth2Client();
        if (!fs.existsSync(TOKEN_PATH)) return { error: 'No autenticado' };
        oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const attendees = (eventData.participants || '').split(',').map(e => e.trim()).filter(e => e).map(email => ({ email }));
        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: eventData.title || 'Evento',
                start: { dateTime: eventData.start },
                end: { dateTime: eventData.end },
                location: eventData.place || undefined,
                attendees: attendees.length > 0 ? attendees : undefined
            },
            sendUpdates: attendees.length > 0 ? 'all' : 'none'
        });
        return { success: true, event: res.data };
    } catch (e) {
        return { error: e.message };
    }
});

// Monitorear cambios en la carpeta test-psd
const watchFolder = path.join(process.cwd(), 'test-psd');
chokidar.watch(watchFolder, { ignoreInitial: true }).on('all', (event, filePath) => {
    if (mainWindow) {
        mainWindow.webContents.send('file-changed', { event, filePath });
    }
});

// Guardar watchers activos por archivo
const fileWatchers = {};

ipcMain.handle('watch-file', async (event, filePath) => {
    console.log('[WATCHER] Iniciando watcher para:', filePath);
    if (!filePath) return { error: 'Ruta de archivo no especificada' };
    // Solo permitir .psd y .ai
    if (!filePath.toLowerCase().endsWith('.psd') && !filePath.toLowerCase().endsWith('.ai')) {
        return { error: 'Solo se pueden vigilar archivos PSD y AI' };
    }
    // Si ya hay watcher, no crear otro
    if (fileWatchers[filePath]) return { success: true };
    let lastMtime = null;
    try {
        lastMtime = fs.statSync(filePath).mtimeMs;
    } catch (e) {
        return { error: 'No se pudo acceder al archivo' };
    }
    fileWatchers[filePath] = {
        watcher: fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
            if (curr.mtimeMs !== prev.mtimeMs) {
                console.log('[WATCHER] Archivo modificado:', filePath, 'Nuevo mtime:', curr.mtimeMs);
                if (mainWindow) {
                    console.log('[WATCHER] Enviando evento file-modified al frontend:', filePath);
                    mainWindow.webContents.send('file-modified', { filePath, mtime: curr.mtimeMs });
                }
            }
        }),
        lastMtime
    };
    return { success: true, mtime: lastMtime };
});

ipcMain.handle('get-file-mtime', async (event, filePath) => {
    try {
        const stat = fs.statSync(filePath);
        return { mtime: stat.mtimeMs };
    } catch (e) {
        return { error: 'No se pudo acceder al archivo' };
    }
});

ipcMain.handle('save-file-version', async (event, filePath, user) => {
    try {
        const folder = path.join(process.cwd(), 'test-psd', 'historial');
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        const now = new Date();
        const fecha = now.toISOString().replace(/[:.]/g, '-').slice(0, 16); // yyyy-mm-ddThh-mm
        const newName = `${base}-${fecha}${ext}`;
        const destPath = path.join(folder, newName);
        fs.copyFileSync(filePath, destPath);

        // Generar hash criptográfico para la versión
        const hash = getFileHash(destPath);
        const stat = fs.statSync(destPath);
        const meta = {
            hash,
            size: stat.size,
            created: now.toISOString(),
            modified: stat.mtime.toISOString(),
            owner: user || 'Agustín Ruiz',
            versionOf: path.basename(filePath)
        };
        const metaPath = destPath + '.meta.json';
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        return { success: true, path: destPath, name: newName, date: now.toLocaleString(), user, hash };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('list-file-versions', async (event, baseName) => {
    try {
        const folder = path.join(process.cwd(), 'test-psd', 'historial');
        if (!fs.existsSync(folder)) return [];
        const files = fs.readdirSync(folder)
            .filter(f => f.startsWith(baseName + '-'))
            .map(f => {
                const ext = path.extname(f);
                const name = path.basename(f, ext);
                // Extraer fecha del nombre
                const fecha = name.replace(baseName + '-', '').replace('T', ' ').replace(/-/g, ':').slice(0, 16);
                return {
                    file: f,
                    path: path.join(folder, f),
                    date: fecha,
                    user: 'Agustín Ruiz' // mock usuario
                };
            });
        return files;
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('get-file-base64', async (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        const base64 = data.toString('base64');
        const name = path.basename(filePath);
        return { success: true, base64, name };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('list-projects', async () => {
    const folder = path.join(process.cwd(), 'test-psd');
    try {
        const dirs = fs.readdirSync(folder, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name !== 'historial')
            .map(dirent => dirent.name);
        return dirs;
    } catch (err) {
        return [];
    }
});

ipcMain.handle('create-project', async (event, projectName) => {
    const folder = path.join(process.cwd(), 'test-psd', projectName);
    try {
        // Verificar si ya existe
        if (fs.existsSync(folder)) {
            return { error: 'Ya existe un proyecto con ese nombre' };
        }
        // Crear la carpeta
        fs.mkdirSync(folder, { recursive: true });
        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('get-file-hash', async (event, filePath) => {
    try {
        const hash = getFileHash(filePath);
        return { hash };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
        // Obtener hash
        const hash = getFileHash(filePath);

        // Obtener estadísticas del archivo
        const stat = fs.statSync(filePath);

        // Intentar cargar metadatos guardados
        let meta = null;
        const metaPath = filePath + '.meta.json';
        if (fs.existsSync(metaPath)) {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }

        // Información completa
        const fileInfo = {
            name: path.basename(filePath),
            path: filePath,
            hash,
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
            created: stat.birthtime.toISOString(),
            modified: stat.mtime.toISOString(),
            createdFormatted: stat.birthtime.toLocaleString('es-ES'),
            modifiedFormatted: stat.mtime.toLocaleString('es-ES'),
            meta: meta || {
                hash,
                size: stat.size,
                created: stat.birthtime.toISOString(),
                modified: stat.mtime.toISOString(),
                owner: 'Agustín Ruiz'
            }
        };

        return fileInfo;
    } catch (e) {
        return { error: e.message };
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ─── Google Sign-In ────────────────────────────────────────────────────────────

function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = require('net').createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

ipcMain.handle('google-sign-in', async () => {
    const http = require('http');
    try {
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        const { client_id, client_secret } = credentials.installed;

        const port = await getFreePort();
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'openid',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
            prompt: 'select_account',
        });

        const authWin = new BrowserWindow({
            width: 500,
            height: 700,
            webPreferences: { nodeIntegration: false, contextIsolation: true },
            title: 'Iniciar sesión con Google',
            parent: mainWindow,
            modal: false,
        });
        authWin.loadURL(authUrl);

        const code = await new Promise((resolve, reject) => {
            const server = http.createServer((req, res) => {
                const urlObj = new URL(req.url, `http://127.0.0.1:${port}`);
                const code = urlObj.searchParams.get('code');
                const error = urlObj.searchParams.get('error');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:3rem;background:#111;color:#fff">
                    <h2 style="color:#4ade80">✓ Autenticación completada</h2>
                    <p style="color:#aaa">Podés cerrar esta ventana y volver a la app.</p>
                    <script>setTimeout(()=>window.close(),1500)</script>
                </body></html>`);
                server.close();
                try { authWin.close(); } catch (_) {}
                if (code) resolve(code);
                else reject(new Error(error || 'No se recibió el código de autorización'));
            });
            server.listen(port, '127.0.0.1');
            server.on('error', reject);
            authWin.on('closed', () => {
                server.close();
                reject(new Error('Inicio de sesión cancelado'));
            });
            setTimeout(() => {
                server.close();
                try { authWin.close(); } catch (_) {}
                reject(new Error('Tiempo de espera agotado'));
            }, 300000);
        });

        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
        const { data } = await oauth2.userinfo.get();

        const profile = {
            name: data.name || '',
            email: data.email || '',
            picture: data.picture || '',
            id: data.id || '',
        };

        fs.writeFileSync(USER_PROFILE_PATH, JSON.stringify(profile, null, 2));
        return { success: true, profile };

    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('get-saved-profile', async () => {
    try {
        if (fs.existsSync(USER_PROFILE_PATH)) {
            return JSON.parse(fs.readFileSync(USER_PROFILE_PATH, 'utf8'));
        }
        return null;
    } catch (e) {
        return null;
    }
});

ipcMain.handle('sign-out', async () => {
    try {
        if (fs.existsSync(USER_PROFILE_PATH)) fs.unlinkSync(USER_PROFILE_PATH);
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
});

// ─── Agency ────────────────────────────────────────────────────────────────────

ipcMain.handle('get-agency-profile', async () => {
    try {
        if (fs.existsSync(AGENCY_PROFILE_PATH)) {
            return JSON.parse(fs.readFileSync(AGENCY_PROFILE_PATH, 'utf8'));
        }
        return null;
    } catch (e) {
        return null;
    }
});

ipcMain.handle('save-agency-profile', async (event, agencyData) => {
    try {
        fs.writeFileSync(AGENCY_PROFILE_PATH, JSON.stringify(agencyData, null, 2));
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
});

// ─── Local accounts (email/password) ──────────────────────────────────────────

function hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, key) => {
            if (err) reject(err);
            else resolve(key.toString('hex'));
        });
    });
}

function generateRecoveryCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const groups = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    );
    return groups.join('-');
}

ipcMain.handle('create-local-account', async (event, { email, password, name }) => {
    try {
        let accounts = [];
        if (fs.existsSync(LOCAL_ACCOUNTS_PATH)) {
            accounts = JSON.parse(fs.readFileSync(LOCAL_ACCOUNTS_PATH, 'utf8'));
        }
        if (accounts.find(a => a.email === email)) {
            return { error: 'Ya existe una cuenta con ese email' };
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await hashPassword(password, salt);
        const displayName = name || email.split('@')[0];
        // Generate recovery code
        const recoveryCode = generateRecoveryCode();
        const recSalt = crypto.randomBytes(16).toString('hex');
        const recHash = await hashPassword(recoveryCode, recSalt);
        accounts.push({ email, passwordHash: `${salt}:${hash}`, recoveryHash: `${recSalt}:${recHash}`, name: displayName });
        fs.writeFileSync(LOCAL_ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
        const profile = { name: displayName, email, picture: '', id: email, loginMethod: 'local' };
        fs.writeFileSync(USER_PROFILE_PATH, JSON.stringify(profile, null, 2));
        return { success: true, profile, recoveryCode };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('get-or-create-invite-code', async () => {
    try {
        if (!fs.existsSync(AGENCY_PROFILE_PATH)) return { error: 'No hay agencia configurada' };
        const agency = JSON.parse(fs.readFileSync(AGENCY_PROFILE_PATH, 'utf8'));
        if (!agency.inviteCode) {
            agency.inviteCode = crypto.randomBytes(6).toString('hex').toUpperCase();
            fs.writeFileSync(AGENCY_PROFILE_PATH, JSON.stringify(agency, null, 2));
        }
        return { code: agency.inviteCode };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('regenerate-invite-code', async () => {
    try {
        const agency = JSON.parse(fs.readFileSync(AGENCY_PROFILE_PATH, 'utf8'));
        agency.inviteCode = crypto.randomBytes(6).toString('hex').toUpperCase();
        fs.writeFileSync(AGENCY_PROFILE_PATH, JSON.stringify(agency, null, 2));
        return { code: agency.inviteCode };
    } catch (e) {
        return { error: e.message };
    }
});

// ─── Pending members ──────────────────────────────────────────────────────────

const PENDING_MEMBERS_PATH = path.join(process.cwd(), 'pending-members.json');

ipcMain.handle('request-to-join', async (event, { inviteCode, userProfile }) => {
    try {
        if (!fs.existsSync(AGENCY_PROFILE_PATH)) return { error: 'Agencia no encontrada' };
        const agency = JSON.parse(fs.readFileSync(AGENCY_PROFILE_PATH, 'utf8'));
        // Accept full URL or just the code
        const cleanCode = String(inviteCode).includes('/')
            ? String(inviteCode).split('/').pop().toUpperCase()
            : String(inviteCode).toUpperCase();
        if (agency.inviteCode !== cleanCode) return { error: 'Código de invitación inválido' };
        let pending = [];
        if (fs.existsSync(PENDING_MEMBERS_PATH)) {
            pending = JSON.parse(fs.readFileSync(PENDING_MEMBERS_PATH, 'utf8'));
        }
        if (pending.find(m => m.id === userProfile.id)) {
            return { success: true, alreadyPending: true, agencyName: agency.name };
        }
        pending.push({ ...userProfile, requestedAt: new Date().toISOString() });
        fs.writeFileSync(PENDING_MEMBERS_PATH, JSON.stringify(pending, null, 2));
        const profile = { ...userProfile, status: 'pending', agencyName: agency.name };
        fs.writeFileSync(USER_PROFILE_PATH, JSON.stringify(profile, null, 2));
        return { success: true, agencyName: agency.name };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('get-pending-members', async () => {
    try {
        if (!fs.existsSync(PENDING_MEMBERS_PATH)) return [];
        return JSON.parse(fs.readFileSync(PENDING_MEMBERS_PATH, 'utf8'));
    } catch (e) {
        return [];
    }
});

ipcMain.handle('approve-member', async (event, { memberId, role }) => {
    try {
        if (!fs.existsSync(PENDING_MEMBERS_PATH)) return { error: 'No hay pendientes' };
        let pending = JSON.parse(fs.readFileSync(PENDING_MEMBERS_PATH, 'utf8'));
        const member = pending.find(m => m.id === memberId);
        if (!member) return { error: 'Miembro no encontrado' };
        pending = pending.filter(m => m.id !== memberId);
        fs.writeFileSync(PENDING_MEMBERS_PATH, JSON.stringify(pending, null, 2));
        return { success: true, member: { ...member, role } };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('reject-member', async (event, memberId) => {
    try {
        if (!fs.existsSync(PENDING_MEMBERS_PATH)) return { success: true };
        let pending = JSON.parse(fs.readFileSync(PENDING_MEMBERS_PATH, 'utf8'));
        pending = pending.filter(m => m.id !== memberId);
        fs.writeFileSync(PENDING_MEMBERS_PATH, JSON.stringify(pending, null, 2));
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('check-my-status', async (event, userId) => {
    try {
        const inPending = fs.existsSync(PENDING_MEMBERS_PATH)
            && JSON.parse(fs.readFileSync(PENDING_MEMBERS_PATH, 'utf8')).find(m => m.id === userId);
        if (inPending) return { status: 'pending' };
        // Not in pending → approved: update their profile
        if (fs.existsSync(USER_PROFILE_PATH)) {
            const profile = JSON.parse(fs.readFileSync(USER_PROFILE_PATH, 'utf8'));
            if (profile.status === 'pending') {
                profile.status = 'active';
                fs.writeFileSync(USER_PROFILE_PATH, JSON.stringify(profile, null, 2));
            }
        }
        return { status: 'approved' };
    } catch (e) {
        return { status: 'pending' };
    }
});

ipcMain.handle('reset-password-with-code', async (event, { email, recoveryCode, newPassword }) => {
    try {
        if (!fs.existsSync(LOCAL_ACCOUNTS_PATH)) return { error: 'No existe una cuenta con ese email' };
        let accounts = JSON.parse(fs.readFileSync(LOCAL_ACCOUNTS_PATH, 'utf8'));
        const idx = accounts.findIndex(a => a.email === email);
        if (idx === -1) return { error: 'No existe una cuenta con ese email' };
        const account = accounts[idx];
        if (!account.recoveryHash) return { error: 'Esta cuenta no tiene código de recuperación configurado' };
        const [recSalt, storedRecHash] = account.recoveryHash.split(':');
        const inputHash = await hashPassword(recoveryCode.toUpperCase().replace(/\s/g, ''), recSalt);
        if (inputHash !== storedRecHash) return { error: 'Código de recuperación incorrecto' };
        // Valid — set new password
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await hashPassword(newPassword, salt);
        accounts[idx].passwordHash = `${salt}:${hash}`;
        fs.writeFileSync(LOCAL_ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('reset-password', async (event, { email, newPassword }) => {
    try {
        if (!fs.existsSync(LOCAL_ACCOUNTS_PATH)) return { error: 'No existe una cuenta con ese email' };
        let accounts = JSON.parse(fs.readFileSync(LOCAL_ACCOUNTS_PATH, 'utf8'));
        const idx = accounts.findIndex(a => a.email === email);
        if (idx === -1) return { error: 'No existe una cuenta con ese email' };
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await hashPassword(newPassword, salt);
        accounts[idx].passwordHash = `${salt}:${hash}`;
        fs.writeFileSync(LOCAL_ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('login-local-account', async (event, { email, password }) => {
    try {
        if (!fs.existsSync(LOCAL_ACCOUNTS_PATH)) {
            return { error: 'Email o contraseña incorrectos' };
        }
        const accounts = JSON.parse(fs.readFileSync(LOCAL_ACCOUNTS_PATH, 'utf8'));
        const account = accounts.find(a => a.email === email);
        if (!account) return { error: 'Email o contraseña incorrectos' };
        const [salt, storedHash] = account.passwordHash.split(':');
        const hash = await hashPassword(password, salt);
        if (hash !== storedHash) return { error: 'Email o contraseña incorrectos' };
        const profile = { name: account.name, email: account.email, picture: '', id: account.email, loginMethod: 'local' };
        fs.writeFileSync(USER_PROFILE_PATH, JSON.stringify(profile, null, 2));
        return { success: true, profile };
    } catch (e) {
        return { error: e.message };
    }
});