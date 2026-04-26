const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function getFileHashSync(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function saveFileMetadata(filePath, owner) {
    const hash = getFileHashSync(filePath);
    const stat = fs.statSync(filePath);
    const meta = {
        hash,
        size: stat.size,
        created: stat.birthtime.toISOString(),
        modified: stat.mtime.toISOString(),
        owner
    };
    const metaPath = filePath + '.meta.json';
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    return meta;
}

// Uso: node generate-metadata.js <archivo> <owner>
const [, , filePath, owner] = process.argv;
if (!filePath || !owner) {
    console.error('Uso: node generate-metadata.js <archivo> <owner>');
    process.exit(1);
}
if (!fs.existsSync(filePath)) {
    console.error('El archivo no existe:', filePath);
    process.exit(1);
}
const meta = saveFileMetadata(filePath, owner);
console.log('Metadatos generados:', meta);














