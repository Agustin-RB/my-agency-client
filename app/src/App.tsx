import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styles from './App.module.css';
import Login from './Login';
import SetupAgency from './SetupAgency';
import WaitingApproval from './WaitingApproval';
import Chat from './Chat';
import Tasks from './Tasks';
import CalendarView from './CalendarView';
import FinanzasView from './FinanzasView';
import TicketsView from './TicketsView';

const DEMO_PROJECTS = ['Agencia de marketing','Brand Identity','E-commerce App','Packaging Cerveza Artesanal','Campaña Redes Sociales','Revista Diseño Interior','App Fitness Tracker','Ilustraciones Libro Infantil','Identidad Visual Restaurante','Catálogo Muebles 2024'];

type UserRole = 'CEO' | 'Administrador' | 'Empleado' | 'Cliente';

const ROLE_PERMISSIONS: Record<UserRole, {
  label: string;
  description: string;
  color: string;
  finanzas: boolean;
  allSections: boolean;
  canChangeRoles: boolean;
}> = {
  CEO:           { label: 'CEO',           description: 'Acceso total a todas las secciones y configuraciones.',                           color: '#F5C842', finanzas: true,  allSections: true,  canChangeRoles: true  },
  Administrador: { label: 'Administrador', description: 'Acceso completo excepto la sección de Finanzas.',                                 color: '#9580FF', finanzas: false, allSections: true,  canChangeRoles: true  },
  Empleado:      { label: 'Empleado',      description: 'Igual que Administrador, pero no puede modificar roles de otros miembros.',       color: '#22D3EE', finanzas: false, allSections: true,  canChangeRoles: false },
  Cliente:       { label: 'Cliente',       description: 'Acceso exclusivo a la sección de Entregables para ver y descargar archivos.',     color: '#34D399', finanzas: false, allSections: false, canChangeRoles: false },
};

interface CustomRole {
  id: string;
  name: string;
  color: string;
  perms: {
    proyectos: boolean;
    tareas: boolean;
    equipo: boolean;
    metricas: boolean;
    chat: boolean;
    entregables: boolean;
    calendario: boolean;
    finanzas: boolean;
    cambiarRoles: boolean;
  };
}

const ROLE_COLOR_PRESETS = ['#9580FF','#22D3EE','#34D399','#F5C842','#F472B6','#6366F1','#FB923C','#E11D48','#0EA5E9','#A3E635'];

const PERM_LABELS: { key: keyof CustomRole['perms']; label: string; icon: string }[] = [
  { key: 'proyectos',   label: 'Proyectos',    icon: 'ri-folder-3-line' },
  { key: 'tareas',      label: 'Tareas',       icon: 'ri-checkbox-multiple-line' },
  { key: 'equipo',      label: 'Equipo',       icon: 'ri-team-line' },
  { key: 'metricas',    label: 'Métricas',     icon: 'ri-bar-chart-2-line' },
  { key: 'chat',        label: 'Chat',         icon: 'ri-message-3-line' },
  { key: 'entregables', label: 'Entregables',  icon: 'ri-archive-line' },
  { key: 'calendario',  label: 'Calendario',   icon: 'ri-calendar-line' },
  { key: 'finanzas',    label: 'Finanzas',     icon: 'ri-money-dollar-circle-line' },
  { key: 'cambiarRoles',label: 'Cambiar roles',icon: 'ri-shield-user-line' },
];

const EMPTY_PERMS: CustomRole['perms'] = {
  proyectos: true, tareas: true, equipo: true, metricas: true,
  chat: true, entregables: true, calendario: true, finanzas: false, cambiarRoles: false,
};

const electronStub = {
  invoke: (ch: string, ...args: any[]) => {
    if (ch === 'list-projects') return Promise.resolve(DEMO_PROJECTS);
    if (ch === 'list-psd-files' || ch === 'list-file-versions') return Promise.resolve([]);
    if (ch === 'get-file-mtime') return Promise.resolve({ mtime: 0 });
    if (ch === 'watch-file') return Promise.resolve({ success: true });
    if (ch === 'open-file-dialog' || ch === 'convert-to-png' || ch === 'open-in-design-app') return Promise.resolve({ error: 'Ejecutá con Electron' });
    if (ch === 'get-file-base64') return Promise.resolve({ error: 'No disponible' });
    if (ch === 'get-file-info') return Promise.resolve(null);
    if (ch === 'save-file-version') return Promise.resolve({ error: 'No disponible' });
    if (ch === 'create-project') return Promise.resolve({ error: 'No disponible' });
    return Promise.resolve(null);
  },
  on: () => {}
};

const electron = (typeof window !== 'undefined' && (window as any).electron?.invoke) ? (window as any).electron : electronStub;

interface PsdFile {
  name: string;
  path: string;
}

interface FileComment {
  id: number;
  author: string;
  initials: string;
  color: string;
  text: string;
  timestamp: string;
}

declare global {
  interface Window { _fileModListenerAdded?: boolean }
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{ name: string; email: string; picture: string; id: string; status?: string; agencyName?: string } | null>(null);
  const [agencyProfile, setAgencyProfile] = useState<{ name: string; description: string; owner: string; ownerId: string; createdAt: string } | null>(null);
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [editingAgencyName, setEditingAgencyName] = useState(false);
  const [agencyNameDraft, setAgencyNameDraft] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteRegenerating, setInviteRegenerating] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [approvingMemberId, setApprovingMemberId] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<string>('Empleado');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [psdFiles, setPsdFiles] = useState<PsdFile[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<PsdFile | null>(null);
  const [historyVersions, setHistoryVersions] = useState<any[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  // Estado para saber si el archivo está modificado
  const [fileModStates, setFileModStates] = useState<{ [filePath: string]: { initialMtime: number, modified: boolean } }>({});
  // Estado para el modal de información del archivo
  const [showFileInfoModal, setShowFileInfoModal] = useState(false);
  const [fileInfo, setFileInfo] = useState<any>(null);
  // Estado para controlar la vista de equipo
  const [showTeam, setShowTeam] = useState(false);
  // Estado para controlar la vista de chat
  const [showChat, setShowChat] = useState(false);
  // Estado para controlar la vista de tareas
  const [showTasks, setShowTasks] = useState(false);
  // Estado para controlar la vista de métricas
  const [showMetrics, setShowMetrics] = useState(false);
  // Estado para controlar la vista de entregables
  const [showEntregables, setShowEntregables] = useState(false);
  // Estado para controlar la vista de calendario
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [showFinanzas, setShowFinanzas] = useState(false);
  // Proyecto seleccionado en Entregables (null = lista de proyectos)
  const [fileComments, setFileComments] = useState<{ [filePath: string]: string }>({});
  const [filePopup, setFilePopup] = useState<PsdFile | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [fileCommentsThread, setFileCommentsThread] = useState<{ [fileKey: string]: FileComment[] }>({});
  const [selectedEntregableProject, setSelectedEntregableProject] = useState<string | null>(null);
  const [openProjectMenu, setOpenProjectMenu]   = useState<string | null>(null);
  const [menuPosition, setMenuPosition]         = useState<{ top: number; right: number } | null>(null);
  const [renamingProject, setRenamingProject]   = useState<string | null>(null);
  const [renameValue, setRenameValue]           = useState('');
  const [changingTypeProject, setChangingTypeProject] = useState<string | null>(null);
  const [changeTypeValue, setChangeTypeValue]   = useState('');
  const [sharingProject, setSharingProject]     = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied]   = useState(false);
  const [addingMemberProject, setAddingMemberProject] = useState<string | null>(null);
  const [membersTooltip, setMembersTooltip]     = useState<{ project: string; top: number; left: number } | null>(null);
  // Carpeta seleccionada dentro del proyecto (null = lista de carpetas, number = índice de carpeta)
  const [selectedEntregableFolder, setSelectedEntregableFolder] = useState<number | null>(null);
  const [entregableSearch, setEntregableSearch] = useState('');
  const [entregableTypeFilter, setEntregableTypeFilter] = useState('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const entregablesFileInputRef = React.useRef<HTMLInputElement>(null);
  // Modal de previsualización en emulador de red social
  const [socialPreview, setSocialPreview] = useState<{ imageDataUrl: string | null; platform: string; fileName: string } | null>(null);
  // Carpetas que son redes sociales (muestran botón Previsualizar)
  const SOCIAL_FOLDERS = ['Instagram', 'Facebook', 'LinkedIn', 'Twitter / X', 'TikTok', 'YouTube'];
  // Entregables: { proyecto: { carpetas: { nombre, archivos: { nombre, path?, url? }[] }[] } }
  const [entregablesData, setEntregablesData] = useState<{ [project: string]: { folders: { name: string; files: { name: string; path?: string; url?: string }[] }[] } }>({
    'Ilustraciones Libro Infantil': {
      folders: [
        { name: 'Archivos editables', files: [{ name: 'Portada.ai' }, { name: 'Interiores-v1.psd' }] },
        { name: 'Instagram', files: [{ name: 'post-instagram.png' }] },
        { name: 'Facebook', files: [{ name: 'post-facebook.png' }] },
        { name: 'Esquemas y documentos', files: [{ name: 'Brief-proyecto.pdf' }, { name: 'Paleta-colores.pdf' }] },
      ],
    },
    'Brand Identity': {
      folders: [
        { name: 'Archivos editables', files: [{ name: 'Logo.ai' }, { name: 'Manual-marca.pdf' }] },
        { name: 'Instagram', files: [{ name: 'stories-instagram.png' }, { name: 'pexels-rdne-7502601.jpg', url: '/entregables/pexels-rdne-7502601.jpg' }] },
        { name: 'Facebook', files: [{ name: 'post-facebook.png' }] },
        { name: 'Esquemas y documentos', files: [{ name: 'Propuesta.pdf' }] },
      ],
    },
    'Agencia de marketing': {
      folders: [
        { name: 'Archivos editables', files: [{ name: 'Campana-2024.psd' }] },
        { name: 'LinkedIn', files: [{ name: 'banner-linkedin.png' }] },
        { name: 'Twitter / X', files: [{ name: 'post-twitter.png' }] },
        { name: 'Esquemas y documentos', files: [{ name: 'Cronograma.xlsx' }] },
      ],
    },
  });
  // Datos de ejemplo del equipo (en el futuro vendrán de una API)
  const [teamMembers, setTeamMembers] = useState([
    { id: 1, name: 'María García', email: 'maria@example.com', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', sharedProjects: ['Agencia de marketing', 'Brand Identity', 'Ilustraciones Libro Infantil'], skills: ['Ilustradora', 'UI Designer'] },
    { id: 2, name: 'Carlos López', email: 'carlos@example.com', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', sharedProjects: ['Agencia de marketing', 'Campaña Redes Sociales'], skills: ['Editor de video', 'Motion Graphics'] },
    { id: 3, name: 'Ana Martínez', email: 'ana@example.com', avatar: 'https://randomuser.me/api/portraits/women/68.jpg', sharedProjects: ['Brand Identity', 'Identidad Visual Restaurante'], skills: ['UX Designer', 'Brand Strategist'] },
    { id: 4, name: 'Lucas Fernández', email: 'lucas@example.com', avatar: 'https://randomuser.me/api/portraits/men/75.jpg', sharedProjects: ['Agencia de marketing', 'E-commerce App', 'Catálogo Muebles 2024'], skills: ['Fotógrafo', 'Retocador'] },
    { id: 5, name: 'Valentina Ruiz', email: 'vale@example.com', avatar: 'https://randomuser.me/api/portraits/women/33.jpg', sharedProjects: ['E-commerce App', 'App Fitness Tracker'], skills: ['UI Designer', 'Ilustradora'] },
    { id: 6, name: 'Diego Morales', email: 'diego@example.com', avatar: 'https://randomuser.me/api/portraits/men/45.jpg', sharedProjects: ['Brand Identity', 'Packaging Cerveza Artesanal'], skills: ['Motion Graphics', '3D Artist'] },
    { id: 7, name: 'Sofía Castro', email: 'sofia@example.com', avatar: 'https://randomuser.me/api/portraits/women/90.jpg', sharedProjects: ['Agencia de marketing', 'Revista Diseño Interior'], skills: ['Copywriter', 'Brand Strategist'] },
    { id: 8, name: 'Martín Gómez', email: 'martin@example.com', avatar: 'https://randomuser.me/api/portraits/men/22.jpg', sharedProjects: ['E-commerce App', 'App Fitness Tracker', 'Campaña Redes Sociales'], skills: ['UX Designer', 'Fotógrafo'] },
  ]);
  // Estado para el modal de perfil del equipo
  const [selectedTeamMember, setSelectedTeamMember] = useState<{ id: number; name: string; email: string; avatar: string; sharedProjects: string[]; skills: string[] } | null>(null);
  // Estado para el modal de crear proyecto
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showCreateEntregableModal, setShowCreateEntregableModal] = useState(false);
  const [newEntregableProject, setNewEntregableProject] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ nombre: 'Agustín Ruiz Bobatto', email: 'agustin@designercollab.io', rol: 'Lead Designer' });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountSkills, setAccountSkills] = useState<string[]>(['UI Design', 'Branding', 'Motion', 'Figma', 'Illustrator']);
  const [skillInput, setSkillInput] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('CEO');
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [newRoleForm, setNewRoleForm] = useState<{ name: string; color: string; perms: CustomRole['perms'] }>({ name: '', color: '#9580FF', perms: { ...EMPTY_PERMS } });
  const [teamMemberRoles, setTeamMemberRoles] = useState<Record<number, UserRole>>({
    1: 'Empleado', 2: 'Empleado', 3: 'Administrador',
    4: 'Empleado', 5: 'Empleado', 6: 'Empleado', 7: 'Empleado', 8: 'Empleado',
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configSettings, setConfigSettings] = useState({
    idioma: 'es',
    zona: 'America/Buenos_Aires',
    notifComentarios: true,
    notifMenciones: true,
    notifEntregas: true,
    notifEquipo: false,
    privEstado: true,
    privActividad: false,
  });
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState('');

  // Tipos de proyecto disponibles
  const projectTypes = ['Branding', 'Packaging', 'Publicidad', 'Editorial', 'Web/App', 'Redes Sociales', 'Ilustración', 'Otro'];

  /* Paleta limpia por tipo — badges flat sin gradientes */
  const projectTypeColors: { [key: string]: { bg: string, text: string } } = {
    'Branding':      { bg: '#EDE9FE', text: '#7C3AED' },
    'Packaging':     { bg: '#FEF3C7', text: '#D97706' },
    'Publicidad':    { bg: '#DBEAFE', text: '#2563EB' },
    'Editorial':     { bg: '#D1FAE5', text: '#059669' },
    'Web/App':       { bg: '#FEF9C3', text: '#92400E' },
    'Redes Sociales':{ bg: '#FCE7F3', text: '#BE185D' },
    'Ilustración':   { bg: '#F3E8FF', text: '#7C3AED' },
    'Otro':          { bg: '#E0F2FE', text: '#0369A1' },
    'Sin categoría': { bg: '#F3F4F6', text: '#6B7280' },
  };

  // Filtro de tipo de proyecto
  const [filterProjectType, setFilterProjectType] = useState<string>('');
  const [projectSearch, setProjectSearch] = useState<string>('');

  // Metadatos de proyectos (tipo, etc.) - en el futuro vendrán de una API o archivo
  const [projectMetadata, setProjectMetadata] = useState<{ [key: string]: { type: string, icon: string } }>({
    'Agencia de marketing': { type: 'Publicidad', icon: 'ri-megaphone-line' },
    'Brand Identity': { type: 'Branding', icon: 'ri-magic-line' },
    'E-commerce App': { type: 'Web/App', icon: 'ri-shopping-cart-line' },
    'Packaging Cerveza Artesanal': { type: 'Packaging', icon: 'ri-box-3-line' },
    'Campaña Redes Sociales': { type: 'Redes Sociales', icon: 'ri-smartphone-line' },
    'Revista Diseño Interior': { type: 'Editorial', icon: 'ri-book-open-line' },
    'App Fitness Tracker': { type: 'Web/App', icon: 'ri-global-line' },
    'Ilustraciones Libro Infantil': { type: 'Ilustración', icon: 'ri-palette-line' },
    'Identidad Visual Restaurante': { type: 'Branding', icon: 'ri-magic-line' },
    'Catálogo Muebles 2024': { type: 'Editorial', icon: 'ri-book-open-line' },
  });

  // Proyectos filtrados por tipo
  const rolePerms = ROLE_PERMISSIONS[currentUserRole];
  const canSeeAll      = rolePerms.allSections;
  const canSeeFinanzas = rolePerms.finanzas;
  const canChangeRoles = rolePerms.canChangeRoles;

  const filteredProjects = projects.filter(project => {
    if (filterProjectType) {
      const meta = projectMetadata[project];
      if (!meta || meta.type !== filterProjectType) return false;
    }
    if (projectSearch.trim()) {
      return project.toLowerCase().includes(projectSearch.trim().toLowerCase());
    }
    return true;
  });
  // Estados para filtros de equipo
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterSkill, setFilterSkill] = useState<string>('');

  // Obtener listas únicas de proyectos y habilidades para los filtros
  const allProjects = Array.from(new Set(teamMembers.flatMap(m => m.sharedProjects)));
  const allSkills = Array.from(new Set(teamMembers.flatMap(m => m.skills)));

  // Filtrar miembros del equipo
  const filteredTeamMembers = teamMembers.filter(member => {
    const matchesProject = !filterProject || member.sharedProjects.includes(filterProject);
    const matchesSkill = !filterSkill || member.skills.includes(filterSkill);
    return matchesProject && matchesSkill;
  });

  // Listar proyectos (carpetas en test-psd + demos)
  useEffect(() => {
    document.body.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }, [theme]);

  useEffect(() => {
    if (!openProjectMenu) return;
    const close = () => { setOpenProjectMenu(null); setMenuPosition(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openProjectMenu]);

  useEffect(() => {
    electron.invoke('list-projects').then((result: any) => {
      if (Array.isArray(result) && result.length > 0) {
        const combined = Array.from(new Set([...result, ...DEMO_PROJECTS]));
        setProjects(combined);
      } else {
        setProjects(DEMO_PROJECTS);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedProject) {
      electron.invoke('list-psd-files', selectedProject).then((result: any) => {
        if (result && !result.error) {
          setPsdFiles(result);
        } else {
          setPsdFiles([]);
        }
      });
    } else {
      setPsdFiles([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedFile) {
      const baseName = selectedFile.name.slice(0, selectedFile.name.lastIndexOf('.'));
      electron.invoke('list-file-versions', baseName).then((versions: any) => {
        setHistoryVersions(Array.isArray(versions) ? versions : []);
      });
    } else {
      setHistoryVersions([]);
    }
  }, [selectedFile]);

  // Inicializar mtimes y pollear cambios cada 1.5s
  useEffect(() => {
    if (psdFiles.length === 0) {
      setFileModStates({});
      return;
    }
    const baseMtimes: { [path: string]: number } = {};
    const init = async () => {
      const newStates: { [path: string]: { initialMtime: number; modified: boolean } } = {};
      for (const file of psdFiles) {
        const res = await electron.invoke('get-file-mtime', file.path);
        const mtime = res?.mtime || 0;
        baseMtimes[file.path] = mtime;
        newStates[file.path] = { initialMtime: mtime, modified: false };
      }
      setFileModStates(newStates);
    };
    init();

    const interval = setInterval(async () => {
      for (const file of psdFiles) {
        const res = await electron.invoke('get-file-mtime', file.path);
        const mtime = res?.mtime || 0;
        if (mtime && baseMtimes[file.path] && mtime > baseMtimes[file.path]) {
          setFileModStates(prev => ({
            ...prev,
            [file.path]: { initialMtime: mtime, modified: true },
          }));
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [psdFiles]);

  const DEMO_COMMENTS: { [key: string]: FileComment[] } = {
    default: [
      { id: 1, author: 'María García',    initials: 'MG', color: '#9580FF', text: 'Los colores están muy bien. Revisé la paleta y coincide con el brief.', timestamp: 'Hace 2 días' },
      { id: 2, author: 'Carlos López',    initials: 'CL', color: '#34D399', text: 'Hay que ajustar el kerning en el título principal, se ve muy apretado en pantallas pequeñas.', timestamp: 'Ayer 15:30' },
      { id: 3, author: 'Ana Martínez',    initials: 'AM', color: '#F5C842', text: '¿Podemos exportar una versión sin el fondo para la web?', timestamp: 'Hoy 09:15' },
    ],
    v2: [
      { id: 1, author: 'Carlos López',    initials: 'CL', color: '#34D399', text: 'Esta versión ya tiene el logo corregido, mucho mejor.', timestamp: 'Hace 3 días' },
      { id: 2, author: 'Lucía Fernández', initials: 'LF', color: '#F87171', text: 'Aprobado por el cliente. Podemos pasar a producción.', timestamp: 'Hace 1 día' },
    ],
  };

  const openFilePopup = (file: PsdFile) => {
    setFilePopup(file);
    setCommentDraft('');
    setFileCommentsThread(prev => {
      if (prev[file.name]) return prev;
      const key = file.name.toLowerCase().includes('v2') || file.name.toLowerCase().includes('-2') ? 'v2' : 'default';
      return { ...prev, [file.name]: DEMO_COMMENTS[key] };
    });
  };

  const submitComment = () => {
    if (!filePopup || !commentDraft.trim()) return;
    const newComment: FileComment = {
      id: Date.now(),
      author: 'Tú',
      initials: 'TÚ',
      color: '#9580FF',
      text: commentDraft.trim(),
      timestamp: 'Ahora',
    };
    setFileCommentsThread(prev => ({
      ...prev,
      [filePopup.name]: [...(prev[filePopup.name] || []), newComment],
    }));
    setCommentDraft('');
  };

  const handleUpload = async () => {
    if (!selectedProject) return;
    const result = await electron.invoke('open-file-dialog', selectedProject);
    if (result && result.success) {
      electron.invoke('list-psd-files', selectedProject).then((result: any) => {
        if (!result.error) setPsdFiles(result);
      });
    } else if (result && result.error) {
      setPreviewError(result.error);
    }
  };

  const handlePreview = async (filePath: string) => {
    setPreviewError(null);
    setPreviewImg(null);
    try {
      // @ts-ignore
      const res = await electron.invoke('convert-to-png', filePath);
      if (res && res.base64) {
        setPreviewImg('data:image/png;base64,' + res.base64);
      } else {
        setPreviewError(res && res.error ? res.error : 'Error al previsualizar el archivo.');
      }
    } catch (e) {
      setPreviewError('Error al previsualizar el archivo.');
    }
  };

  const handleOpen = async (filePath: string, ext: string) => {
    try {
      // @ts-ignore
      const res = await electron.invoke('open-in-design-app', filePath, ext);
      if (res && res.error) {
        setPreviewError(res.error);
      }
    } catch (e) {
      setPreviewError('Error al intentar abrir el archivo.');
    }
  };

  const handleDownloadVersion = async (item: any) => {
    // @ts-ignore
    const res = await electron.invoke('get-file-base64', item.path);
    if (res && res.success) {
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
  };

  const handleFileClick = async (file: PsdFile) => {
    try {
      // @ts-ignore
      const info = await electron.invoke('get-file-info', file.path);
      if (info && !info.error) {
        setFileInfo(info);
      }
    } catch (e) {
      // info not available in demo mode
    }
  };

  const handleUploadModification = async () => {
    if (!selectedFile) return;
    // @ts-ignore
    const res = await electron.invoke('save-file-version', selectedFile.path, 'Agustín Ruiz');
    if (res && res.success) {
      const baseName = selectedFile.name.slice(0, selectedFile.name.lastIndexOf('.'));
      // @ts-ignore
      const versions = await electron.invoke('list-file-versions', baseName);
      setHistoryVersions(Array.isArray(versions) ? versions : []);
      setFileModStates(prev => ({ ...prev, [selectedFile.path]: { ...prev[selectedFile.path], modified: false } }));
    }
  };

  const handleRenameProject = () => {
    if (!renameValue.trim() || !renamingProject) return;
    const oldName = renamingProject;
    const newName = renameValue.trim();
    setProjects(prev => prev.map(p => p === oldName ? newName : p));
    setProjectMetadata(prev => {
      const meta = prev[oldName];
      const next = { ...prev };
      if (meta) { next[newName] = meta; delete next[oldName]; }
      return next;
    });
    if (selectedProject === oldName) setSelectedProject(newName);
    setRenamingProject(null);
    setRenameValue('');
  };

  const handleDeleteProject = (project: string) => {
    setProjects(prev => prev.filter(p => p !== project));
    setProjectMetadata(prev => { const next = { ...prev }; delete next[project]; return next; });
    if (selectedProject === project) setSelectedProject(null);
    setOpenProjectMenu(null);
  };

  const handleSaveChangeType = () => {
    if (!changingTypeProject || !changeTypeValue) return;
    const typeIcons: { [key: string]: string } = {
      'Branding': 'ri-magic-line', 'Packaging': 'ri-box-3-line',
      'Publicidad': 'ri-megaphone-line', 'Editorial': 'ri-book-open-line',
      'Web/App': 'ri-global-line', 'Redes Sociales': 'ri-smartphone-line',
      'Ilustración': 'ri-palette-line', 'Otro': 'ri-folder-line',
    };
    setProjectMetadata(prev => ({
      ...prev,
      [changingTypeProject]: { ...prev[changingTypeProject], type: changeTypeValue, icon: typeIcons[changeTypeValue] || 'ri-folder-line' }
    }));
    setChangingTypeProject(null);
    setChangeTypeValue('');
  };

  const handleToggleMember = (memberId: number, project: string) => {
    setTeamMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const has = m.sharedProjects.includes(project);
      return { ...m, sharedProjects: has ? m.sharedProjects.filter(p => p !== project) : [...m.sharedProjects, project] };
    }));
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Por favor ingresa un nombre para el proyecto');
      return;
    }
    // @ts-ignore
    const res = await electron.invoke('create-project', newProjectName.trim());
    if (res && res.success) {
      // Guardar metadatos del proyecto (tipo)
      const typeIcons: { [key: string]: string } = {
        'Branding': 'ri-magic-line',
        'Packaging': 'ri-box-3-line',
        'Publicidad': 'ri-megaphone-line',
        'Editorial': 'ri-book-open-line',
        'Web/App': 'ri-global-line',
        'Redes Sociales': 'ri-smartphone-line',
        'Ilustración': 'ri-palette-line',
        'Otro': 'ri-folder-line',
      };
      const projectType = newProjectType || 'Otro';
      setProjectMetadata(prev => ({
        ...prev,
        [newProjectName.trim()]: {
          type: projectType,
          icon: typeIcons[projectType] || '📁'
        }
      }));
      // Refrescar la lista de proyectos
      // @ts-ignore
      const result = await electron.invoke('list-projects');
      if (Array.isArray(result)) setProjects(result);
      setShowCreateProjectModal(false);
      setNewProjectName('');
      setNewProjectType('');
    } else {
      alert(res?.error || 'Error al crear el proyecto');
    }
  };

  const handleCreateEntregable = () => {
    const name = newEntregableProject.trim();
    if (!name) return;
    if (entregablesData[name]) { setShowCreateEntregableModal(false); setNewEntregableProject(''); setSelectedEntregableProject(name); return; }
    setEntregablesData(prev => ({ ...prev, [name]: { folders: [] } }));
    setShowCreateEntregableModal(false);
    setNewEntregableProject('');
    setSelectedEntregableProject(name);
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name || !selectedEntregableProject) return;
    setEntregablesData(prev => ({
      ...prev,
      [selectedEntregableProject]: {
        folders: [...(prev[selectedEntregableProject]?.folders || []), { name, files: [] }],
      },
    }));
    setNewFolderName('');
    setShowCreateFolderModal(false);
  };

  const handleEntregablesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedEntregableProject || selectedEntregableFolder === null) return;
    const newFiles = Array.from(files).map(f => ({ name: f.name }));
    setEntregablesData(prev => {
      const folders = [...(prev[selectedEntregableProject]?.folders || [])];
      folders[selectedEntregableFolder] = {
        ...folders[selectedEntregableFolder],
        files: [...folders[selectedEntregableFolder].files, ...newFiles],
      };
      return { ...prev, [selectedEntregableProject]: { folders } };
    });
    e.target.value = '';
  };

  const handleSocialPreview = async (file: { name: string; path?: string; url?: string }, folderName: string) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
    const isDesign = ['.psd', '.ai'].includes(ext);
    let imageDataUrl: string | null = null;

    if (file.url) {
      imageDataUrl = file.url.startsWith('http') ? file.url : `${window.location.origin}${file.url}`;
    } else if (file.path && electron.invoke) {
      try {
        if (isImage) {
          const res = await electron.invoke('get-file-base64', file.path) as { success?: boolean; base64?: string };
          if (res?.success && res?.base64) {
            const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            imageDataUrl = `data:${mime};base64,${res.base64}`;
          }
        } else if (isDesign) {
          const res = await electron.invoke('convert-to-png', file.path) as { base64?: string; error?: string };
          if (res?.base64) {
            imageDataUrl = `data:image/png;base64,${res.base64}`;
          } else if (res?.error) {
            setPreviewError(res.error);
            setTimeout(() => setPreviewError(null), 4000);
          }
        }
      } catch (e) {
        setPreviewError('Error al cargar la previsualización.');
        setTimeout(() => setPreviewError(null), 3000);
      }
    }
    setSocialPreview({ imageDataUrl, platform: folderName, fileName: file.name });
  };

  // Auto-login con perfil guardado al iniciar la app
  React.useEffect(() => {
    (window as any).electron?.invoke('get-saved-profile').then(async (profile: any) => {
      if (profile?.name) {
        setGoogleProfile(profile);
        setAccountForm({ nombre: profile.name, email: profile.email, rol: 'Lead Designer' });
        const agency = await (window as any).electron.invoke('get-agency-profile');
        if (agency?.name) setAgencyProfile(agency);
        const pending = await (window as any).electron.invoke('get-pending-members');
        if (Array.isArray(pending)) setPendingMembers(pending);
        setIsLoggedIn(true);
      }
    }).catch(() => {});
  }, []);

  const handleLogin = async (email: string, password: string, profile?: { name: string; email: string; picture: string; id: string }) => {
    const applyProfile = async (p: { name: string; email: string; picture: string; id: string }) => {
      setGoogleProfile(p);
      setAccountForm({ nombre: p.name, email: p.email, rol: 'Lead Designer' });
      setIsLoading(true);
      const agency = await (window as any).electron.invoke('get-agency-profile');
      if (agency?.name) setAgencyProfile(agency);
      setTimeout(() => { setIsLoading(false); setIsLoggedIn(true); }, 1200);
    };
    if (profile) {
      applyProfile(profile);
    } else if (email && password) {
      setIsLoading(true);
      setTimeout(() => { setIsLoading(false); setIsLoggedIn(true); }, 2200);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingGrid}>
          {Array.from({ length: 9 }).map((_, i) => {
            const diag = Math.floor(i / 3) + (i % 3);
            return (
              <span
                key={i}
                className={styles.loadingCell}
                style={{ '--d': diag } as React.CSSProperties}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const handlePending = (profile: any) => {
    setGoogleProfile(profile);
    setIsLoggedIn(true);
  };

  const handleApprovedFromWaiting = async () => {
    setGoogleProfile(prev => prev ? { ...prev, status: 'active' } : prev);
    const agency = await (window as any).electron.invoke('get-agency-profile');
    if (agency?.name) setAgencyProfile(agency);
  };

  const handleApproveMember = async (memberId: string) => {
    const res = await (window as any).electron.invoke('approve-member', { memberId, role: approveRole });
    if (res?.success) {
      setTeamMembers(prev => [...prev, {
        id: Date.now(),
        name: res.member.name,
        email: res.member.email,
        avatar: res.member.picture || '',
        sharedProjects: [],
        skills: [],
      }]);
      setPendingMembers(prev => prev.filter(m => m.id !== memberId));
      setApprovingMemberId(null);
    }
  };

  const handleRejectMember = async (memberId: string) => {
    await (window as any).electron.invoke('reject-member', memberId);
    setPendingMembers(prev => prev.filter(m => m.id !== memberId));
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} onPending={handlePending} />;
  }

  if (googleProfile?.status === 'pending') {
    return (
      <WaitingApproval
        profile={googleProfile}
        onApproved={handleApprovedFromWaiting}
        onLogout={() => {
          (window as any).electron?.invoke('sign-out').catch(() => {});
          setGoogleProfile(null);
          setIsLoggedIn(false);
        }}
      />
    );
  }

  if (isLoggedIn && !agencyProfile && googleProfile) {
    return (
      <SetupAgency
        userProfile={googleProfile}
        onComplete={(agency) => setAgencyProfile(agency)}
      />
    );
  }

  return (
    <>
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <button className={styles.agencyBtn} onClick={async () => {
          setShowAgencyModal(true);
          const [codeRes, pendingRes] = await Promise.all([
            (window as any).electron.invoke('get-or-create-invite-code'),
            (window as any).electron.invoke('get-pending-members'),
          ]);
          if (codeRes?.code) setInviteCode(codeRes.code);
          if (Array.isArray(pendingRes)) setPendingMembers(pendingRes);
        }}>
          <span className={styles.agencyBtnIcon} />
          <span className={styles.agencyBtnName}>{agencyProfile?.name || 'Mi Agencia'}</span>
          {pendingMembers.length > 0 && (
            <span className={styles.pendingBadge}>{pendingMembers.length}</span>
          )}
          <i className="ri-information-line" style={{ marginLeft: pendingMembers.length > 0 ? 0 : 'auto', fontSize: '0.85rem', opacity: 0.4 }} />
        </button>
        <nav className={styles.nav}>
          {canSeeAll && (
            <button
              className={styles.navItem + (!showTeam && !showChat && !showTasks && !showMetrics && !showEntregables && !showCalendar && !showFinanzas && !showTickets ? ' ' + styles.activeNav : '')}
              onClick={() => { setShowTeam(false); setShowChat(false); setShowTasks(false); setShowMetrics(false); setShowEntregables(false); setShowCalendar(false); setShowFinanzas(false); setShowTickets(false); setSelectedProject(null); setSelectedFile(null); }}
            >
              <i className="ri-folder-3-line" style={{ fontSize: '1.05rem' }} />
              Proyectos
            </button>
          )}
          {canSeeAll && (
            <button
              className={styles.navItem + (showTasks ? ' ' + styles.activeNav : '')}
              onClick={() => { setShowTasks(true); setShowTeam(false); setShowChat(false); setShowMetrics(false); setShowEntregables(false); setShowCalendar(false); setShowFinanzas(false); setShowTickets(false); setSelectedProject(null); setSelectedFile(null); }}
            >
              <i className="ri-checkbox-multiple-line" style={{ fontSize: '1.05rem' }} />
              Tareas
            </button>
          )}
          {canSeeAll && (
            <button
              className={styles.navItem + (showTeam ? ' ' + styles.activeNav : '')}
              onClick={() => { setShowTeam(true); setShowChat(false); setShowTasks(false); setShowMetrics(false); setShowEntregables(false); setShowCalendar(false); setShowFinanzas(false); setShowTickets(false); setSelectedProject(null); setSelectedFile(null); }}
            >
              <i className="ri-team-line" style={{ fontSize: '1.05rem' }} />
              Equipo
            </button>
          )}
          {canSeeAll && (
            <button
              className={styles.navItem + (showMetrics ? ' ' + styles.activeNav : '')}
              onClick={() => { setShowMetrics(true); setShowTeam(false); setShowChat(false); setShowTasks(false); setShowEntregables(false); setShowCalendar(false); setShowFinanzas(false); setShowTickets(false); setSelectedProject(null); setSelectedFile(null); }}
            >
              <i className="ri-bar-chart-2-line" style={{ fontSize: '1.05rem' }} />
              Métricas
            </button>
          )}
          {canSeeAll && (
            <button
              className={styles.navItem + (showChat ? ' ' + styles.activeNav : '')}
              onClick={() => { setShowChat(true); setShowTeam(false); setShowTasks(false); setShowMetrics(false); setShowEntregables(false); setShowCalendar(false); setShowFinanzas(false); setShowTickets(false); setSelectedProject(null); setSelectedFile(null); }}
            >
              <i className="ri-message-3-line" style={{ fontSize: '1.05rem' }} />
              Chat
            </button>
          )}
          <button
            className={styles.navItem + (showEntregables ? ' ' + styles.activeNav : '')}
            onClick={() => { setShowEntregables(true); setShowChat(false); setShowTeam(false); setShowTasks(false); setShowMetrics(false); setShowCalendar(false); setShowFinanzas(false); setShowTickets(false); setSelectedProject(null); setSelectedFile(null); setSelectedEntregableProject(null); setSelectedEntregableFolder(null); }}
          >
            <i className="ri-archive-line" style={{ fontSize: '1.05rem' }} />
            Entregables
          </button>
          {canSeeAll && (
            <button
              className={styles.navItem + (showCalendar ? ' ' + styles.activeNav : '')}
              onClick={() => { setShowCalendar(true); setShowFinanzas(false); setShowEntregables(false); setShowChat(false); setShowTeam(false); setShowTasks(false); setShowMetrics(false); setShowTickets(false); setSelectedProject(null); setSelectedFile(null); }}
            >
              <i className="ri-calendar-line" style={{ fontSize: '1.05rem' }} />
              Calendario
            </button>
          )}
          {canSeeFinanzas && (
            <button
              className={styles.navItem + (showFinanzas ? ' ' + styles.activeNav : '')}
              onClick={() => { setShowFinanzas(true); setShowTickets(false); setShowCalendar(false); setShowEntregables(false); setShowChat(false); setShowTeam(false); setShowTasks(false); setShowMetrics(false); setSelectedProject(null); setSelectedFile(null); }}
            >
              <i className="ri-money-dollar-circle-line" style={{ fontSize: '1.05rem' }} />
              Finanzas
            </button>
          )}
          <button
            className={styles.navItem + (showTickets ? ' ' + styles.activeNav : '')}
            onClick={() => { setShowTickets(true); setShowFinanzas(false); setShowCalendar(false); setShowEntregables(false); setShowChat(false); setShowTeam(false); setShowTasks(false); setShowMetrics(false); setSelectedProject(null); setSelectedFile(null); }}
          >
            <i className="ri-ticket-line" style={{ fontSize: '1.05rem' }} />
            Tickets
          </button>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.themeToggleRow}>
            <span className={styles.themeToggleLabel}>
              <i className={theme === 'light' ? 'ri-sun-line' : 'ri-moon-line'} />
              {theme === 'light' ? 'Modo claro' : 'Modo oscuro'}
            </span>
            <label className={styles.themeSwitch}>
              <input
                type="checkbox"
                checked={theme === 'light'}
                onChange={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              />
              <span className={styles.themeSwitchTrack} />
            </label>
          </div>
          <button className={styles.configBtn} onClick={() => setShowAccountModal(true)}>
            <i className="ri-user-line" style={{ fontSize: '1.05rem' }} />
            Mi cuenta
          </button>
          <button className={styles.configBtn} onClick={() => setShowConfigModal(true)}>
            <i className="ri-settings-4-line" style={{ fontSize: '1.05rem' }} />
            Configuración
          </button>
          <button className={styles.logoutBtn} onClick={() => {
            (window as any).electron?.invoke('sign-out').catch(() => {});
            setGoogleProfile(null);
            setIsLoggedIn(false);
          }}>
            <i className="ri-logout-box-r-line" style={{ fontSize: '1.05rem' }} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className={styles.mainContent} style={showChat ? { padding: 0, marginLeft: 220 } : showEntregables ? { padding: 0, marginLeft: 220 } : showCalendar ? { padding: 0, marginLeft: 220 } : {}}>
        {showChat ? (
          <Chat />
        ) : showTasks ? (
          <Tasks />
        ) : showCalendar ? (
          <CalendarView />
        ) : showFinanzas ? (
          <FinanzasView />
        ) : showTickets ? (
          <TicketsView projects={projects} canChangeStatus={currentUserRole !== 'Cliente'} />
        ) : showEntregables ? (
          <div className={styles.entregablesContainer}>
            <header className={styles.entregablesHeader}>
              <div className={styles.entregablesHeaderTop}>
                <div>
                  <h2>Entregables</h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: '4px 0 0 0' }}>Archivos finalizados para que los clientes puedan ver y descargar</p>
                </div>
                {!selectedEntregableProject && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={styles.projectSearchWrap}>
                      <i className="ri-search-line" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.9rem', pointerEvents: 'none' }} />
                      <input
                        className={styles.projectSearchInput}
                        type="text"
                        placeholder="Buscar proyecto..."
                        value={entregableSearch}
                        onChange={e => setEntregableSearch(e.target.value)}
                      />
                      {entregableSearch && (
                        <button className={styles.projectSearchClear} onClick={() => setEntregableSearch('')}>
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </div>
                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Tipo:</label>
                      <select
                        className={styles.filterSelect}
                        value={entregableTypeFilter}
                        onChange={e => setEntregableTypeFilter(e.target.value)}
                        style={{ minWidth: 160 }}
                      >
                        <option value="">Todos los tipos</option>
                        {Array.from(new Set(Object.keys(entregablesData).map(p => projectMetadata[p]?.type || 'Sin categoría'))).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    {entregableTypeFilter && (
                      <button
                        className={styles.clearFiltersBtn}
                        onClick={() => setEntregableTypeFilter('')}
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                      >
                        Limpiar
                      </button>
                    )}
                    <button className={styles.uploadBtn} onClick={() => setShowCreateEntregableModal(true)}>
                      Crear entregable
                    </button>
                  </div>
                )}
              </div>
            </header>
            <div className={styles.entregablesContent}>
              {Object.keys(entregablesData).length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 14, padding: 40, textAlign: 'center' }}>Aún no hay entregables configurados.</div>
              ) : !selectedEntregableProject ? (
                (() => {
                  const filtered = Object.keys(entregablesData).filter(p => {
                    const matchType = !entregableTypeFilter || (projectMetadata[p]?.type || 'Sin categoría') === entregableTypeFilter;
                    const matchSearch = !entregableSearch || p.toLowerCase().includes(entregableSearch.toLowerCase());
                    return matchType && matchSearch;
                  });
                  return (
                  <>
                  {filtered.length === 0 ? (
                    <div className={styles.entregablesEmpty}>
                      <i className="ri-folder-search-line" />
                      <span>No hay proyectos que coincidan con los filtros</span>
                    </div>
                  ) : (
                  <div className={styles.projectsRow}>
                    {filtered.map((projectName) => {
                      const meta = projectMetadata[projectName] || { type: 'Entregable', icon: 'ri-folder-line' };
                      const typeColor = projectTypeColors[meta.type] || projectTypeColors['Sin categoría'];
                      const totalFiles = entregablesData[projectName]?.folders?.reduce((acc: number, f: { files: unknown[] }) => acc + f.files.length, 0) || 0;
                      return (
                        <div
                          key={projectName}
                          className={styles.fileCard}
                          style={{ minWidth: 260, maxWidth: 260, minHeight: 170, maxHeight: 170, padding: '20px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', position: 'relative' }}
                          onClick={() => { setSelectedEntregableProject(projectName); setSelectedEntregableFolder(null); }}
                        >
                          <div className={styles.projectCardHeader}>
                            <span className={styles.projectTypeBadge} style={{ background: typeColor.bg, color: typeColor.text }}>{meta.type}</span>
                          </div>
                          <i className={meta.icon || 'ri-folder-line'} style={{ fontSize: 32, color: 'var(--color-primary)', marginBottom: 10 }} />
                          <span style={{ textAlign: 'center', color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 14 }}>{projectName}</span>
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 6 }}>{totalFiles} archivo{totalFiles !== 1 ? 's' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                  )}
                  </>
                  );
                })()
              ) : (
                <>
                  <button
                    className={styles.entregablesBackBtn}
                    onClick={() => {
                      if (selectedEntregableFolder !== null) {
                        setSelectedEntregableFolder(null);
                      } else {
                        setSelectedEntregableProject(null);
                        setSelectedEntregableFolder(null);
                      }
                    }}
                  >
                    <i className="ri-arrow-left-s-line" style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1 }} />
                  </button>
                  <div className={styles.entregablesProject}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 className={styles.entregablesProjectTitle}>
                        <i className={projectMetadata[selectedEntregableProject]?.icon || 'ri-folder-line'} style={{ marginRight: 8, color: 'var(--color-primary)' }} />{selectedEntregableProject}
                        {selectedEntregableFolder !== null && (
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '0.9em' }}>
                            {' / '}{entregablesData[selectedEntregableProject!]?.folders?.[selectedEntregableFolder]?.name}
                          </span>
                        )}
                      </h3>
                      {selectedEntregableFolder === null ? (
                        <button className={styles.uploadBtn} onClick={() => { setNewFolderName(''); setShowCreateFolderModal(true); }}>
                          Crear carpeta
                        </button>
                      ) : (
                        <>
                          <input ref={entregablesFileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleEntregablesUpload} />
                          <button className={styles.uploadBtn} onClick={() => entregablesFileInputRef.current?.click()}>
                            Subir archivo
                          </button>
                        </>
                      )}
                    </div>
                    {selectedEntregableFolder === null ? (
                      <div className={styles.projectsRow} style={{ marginTop: 24 }}>
                        {entregablesData[selectedEntregableProject!]?.folders?.map((folder: { name: string; files: { name: string; path?: string }[] }, folderIdx: number) => (
                          <div
                            key={folderIdx}
                            className={styles.fileCard}
                            style={{ minWidth: 200, maxWidth: 240, minHeight: 140, padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                            onClick={() => setSelectedEntregableFolder(folderIdx)}
                          >
                            <i className="ri-folder-open-line" style={{ fontSize: 32, color: 'var(--color-primary)', marginBottom: 12 }} />
                            <span style={{ textAlign: 'center', color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 14 }}>{folder.name}</span>
                            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 8 }}>{folder.files.length} archivo{folder.files.length !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.entregablesFolders} style={{ marginTop: 24 }}>
                        <div className={styles.entregablesFolder}>
                          <ul className={styles.entregablesFileList}>
                            {entregablesData[selectedEntregableProject!]?.folders?.[selectedEntregableFolder]?.files.map((file: { name: string; path?: string; url?: string }, fileIdx: number) => {
                              const currentFolderName = entregablesData[selectedEntregableProject!]?.folders?.[selectedEntregableFolder!]?.name || '';
                              const showPreviewBtn = SOCIAL_FOLDERS.includes(currentFolderName);
                              const isImageOrDesign = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.psd', '.ai'].some(e => file.name.toLowerCase().endsWith(e));
                              return (
                              <li key={fileIdx} className={styles.entregablesFileItem}>
                                <span className={styles.entregablesFileName}><i className="ri-file-line" style={{ marginRight: 6, color: 'var(--color-text-muted)' }} />{file.name}</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  {showPreviewBtn && isImageOrDesign && (
                                    <button
                                      className={styles.entregablesPreviewBtn}
                                      onClick={(e) => { e.stopPropagation(); handleSocialPreview(file, currentFolderName); }}
                                    >
                                      Previsualizar
                                    </button>
                                  )}
                                  <button
                                    className={styles.entregablesDownloadBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (file.path && electron.invoke) {
                                        electron.invoke('get-file-base64', file.path).then((res: any) => {
                                          if (res?.success) {
                                            const a = document.createElement('a');
                                            a.href = 'data:application/octet-stream;base64,' + res.base64;
                                            a.download = res.name;
                                            a.click();
                                          }
                                        });
                                      } else {
                                        setPreviewError('Descarga disponible con archivos vinculados. Por ahora es vista demo.');
                                        setTimeout(() => setPreviewError(null), 2000);
                                      }
                                    }}
                                  >
                                    Descargar
                                  </button>
                                </div>
                              </li>
                            );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {showCreateFolderModal && (
              <div className={styles.modalOverlay} onClick={() => { setShowCreateFolderModal(false); setNewFolderName(''); }}>
                <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Crear carpeta</h2>
                    <button onClick={() => { setShowCreateFolderModal(false); setNewFolderName(''); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, borderRadius: 6, padding: '2px 6px' }}>×</button>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Nombre de la carpeta</label>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Ej: Archivos editables"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: '0.9rem', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setShowCreateFolderModal(false); setNewFolderName(''); }} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 18px', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleCreateFolder} style={{ background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 22px', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Crear</button>
                  </div>
                </div>
              </div>
            )}

            {showCreateEntregableModal && (
              <div className={styles.modalOverlay} onClick={() => { setShowCreateEntregableModal(false); setNewEntregableProject(''); }}>
                <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Crear entregable</h2>
                    <button onClick={() => { setShowCreateEntregableModal(false); setNewEntregableProject(''); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, borderRadius: 6, padding: '2px 6px' }}>×</button>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proyecto</label>
                    <select
                      value={newEntregableProject}
                      onChange={e => setNewEntregableProject(e.target.value)}
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(149,128,255,0.15)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                      autoFocus
                    >
                      <option value="">Seleccionar proyecto...</option>
                      {projects.filter(p => !entregablesData[p]).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setShowCreateEntregableModal(false); setNewEntregableProject(''); }} style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleCreateEntregable} disabled={!newEntregableProject} style={{ background: newEntregableProject ? 'var(--color-primary)' : 'var(--color-border)', color: newEntregableProject ? '#fff' : 'var(--color-text-muted)', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: newEntregableProject ? 'pointer' : 'not-allowed', boxShadow: newEntregableProject ? '0 4px 16px rgba(149,128,255,0.4)' : 'none', transition: 'all 0.2s' }}>Crear entregable</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : showMetrics ? (
          <>
          <div className={styles.metricsContainer}>
            <header className={styles.header}>
              <h2>Métricas y Análisis</h2>
            </header>
            <div className={styles.metricsGrid}>
              {/* Resumen general */}
              <div className={styles.metricCard + ' ' + styles.metricCardWide}>
                <h3 className={styles.metricTitle}>Resumen General</h3>
                <div className={styles.metricStats}>
                  <div className={styles.metricStat}>
                    <span className={styles.metricValue}>{projects.length}</span>
                    <span className={styles.metricLabel}>Proyectos</span>
                  </div>
                  <div className={styles.metricStat}>
                    <span className={styles.metricValue}>{teamMembers.length}</span>
                    <span className={styles.metricLabel}>Miembros</span>
                  </div>
                  <div className={styles.metricStat}>
                    <span className={styles.metricValue}>{allSkills.length}</span>
                    <span className={styles.metricLabel}>Habilidades</span>
                  </div>
                  <div className={styles.metricStat}>
                    <span className={styles.metricValue}>{projectTypes.length}</span>
                    <span className={styles.metricLabel}>Tipos de proyecto</span>
                  </div>
                </div>
              </div>

              {/* Habilidades más comunes - Gráfico de Torta */}
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Habilidades del equipo</h3>
                {(() => {
                  const skillCount: { [key: string]: number } = {};
                  teamMembers.forEach(m => m.skills.forEach(s => { skillCount[s] = (skillCount[s] || 0) + 1; }));
                  const entries = Object.entries(skillCount).sort((a, b) => b[1] - a[1]);
                  const total = entries.reduce((sum, [, count]) => sum + count, 0);
                  const pieColors = ['#9580FF', '#7C5CFC', '#B8A8FF', '#F5C842', '#22D3EE', '#34D399', '#C4B9FF', '#A690FF'];
                  let cumulativePercent = 0;
                  return (
                    <div className={styles.pieChartContainer}>
                      <svg viewBox="0 0 100 100" className={styles.pieChart}>
                        {entries.map(([skill, count], idx) => {
                          const percent = (count / total) * 100;
                          const offset = cumulativePercent;
                          cumulativePercent += percent;
                          const largeArcFlag = percent > 50 ? 1 : 0;
                          const startAngle = (offset / 100) * 360 - 90;
                          const endAngle = ((offset + percent) / 100) * 360 - 90;
                          const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                          const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                          return (
                            <path
                              key={skill}
                              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                              fill={pieColors[idx % pieColors.length]}
                              className={styles.pieSlice}
                            />
                          );
                        })}
                        <circle cx="50" cy="50" r="15" style={{ fill: 'var(--color-bg-card)' }} />
                        <text x="50" y="50" textAnchor="middle" dy="0.3em" className={styles.pieCenter}>
                          {entries.length}
                        </text>
                      </svg>
                      <div className={styles.pieLegend}>
                        {entries.slice(0, 6).map(([skill, count], idx) => (
                          <div key={skill} className={styles.pieLegendItem}>
                            <span className={styles.pieLegendColor} style={{ background: pieColors[idx % pieColors.length] }} />
                            <span className={styles.pieLegendLabel}>{skill}</span>
                            <span className={styles.pieLegendValue}>{count}</span>
                          </div>
                        ))}
                        {entries.length > 6 && (
                          <div className={styles.pieLegendItem}>
                            <span className={styles.pieLegendLabel}>+{entries.length - 6} más</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Proyectos por tipo - Gráfico de Torta */}
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Proyectos por tipo</h3>
                {(() => {
                  const typeCount: { [key: string]: number } = {};
                  projects.forEach(p => {
                    const meta = projectMetadata[p];
                    const type = meta ? meta.type : 'Sin categoría';
                    typeCount[type] = (typeCount[type] || 0) + 1;
                  });
                  const entries = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
                  const total = entries.reduce((sum, [, count]) => sum + count, 0);
                  const pieColors = ['#9580FF', '#7C5CFC', '#B8A8FF', '#F5C842', '#22D3EE', '#34D399', '#C4B9FF', '#A690FF'];
                  let cumulativePercent = 0;
                  return (
                    <div className={styles.pieChartContainer}>
                      <svg viewBox="0 0 100 100" className={styles.pieChart}>
                        {entries.map(([type, count], idx) => {
                          const percent = (count / total) * 100;
                          const offset = cumulativePercent;
                          cumulativePercent += percent;
                          const largeArcFlag = percent > 50 ? 1 : 0;
                          const startAngle = (offset / 100) * 360 - 90;
                          const endAngle = ((offset + percent) / 100) * 360 - 90;
                          const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                          const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                          return (
                            <path
                              key={type}
                              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                              fill={pieColors[idx % pieColors.length]}
                              className={styles.pieSlice}
                            />
                          );
                        })}
                        <circle cx="50" cy="50" r="15" style={{ fill: 'var(--color-bg-card)' }} />
                        <text x="50" y="50" textAnchor="middle" dy="0.3em" className={styles.pieCenter}>
                          {total}
                        </text>
                      </svg>
                      <div className={styles.pieLegend}>
                        {entries.map(([type, count], idx) => (
                          <div key={type} className={styles.pieLegendItem}>
                            <span className={styles.pieLegendColor} style={{ background: pieColors[idx % pieColors.length] }} />
                            <span className={styles.pieLegendLabel}>{type}</span>
                            <span className={styles.pieLegendValue}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Distribución de carga de trabajo */}
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Carga de trabajo</h3>
                <div className={styles.metricList}>
                  {teamMembers
                    .map(m => ({ ...m, projectCount: m.sharedProjects.length }))
                    .sort((a, b) => b.projectCount - a.projectCount)
                    .map((member) => (
                      <div key={member.id} className={styles.metricListItem}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <img src={member.avatar} alt={member.name} className={styles.metricAvatarSmall} />
                          <span className={styles.metricListNameSmall}>{member.name.split(' ')[0]}</span>
                        </div>
                        <div className={styles.metricBarContainer} style={{ flex: 2 }}>
                          <div
                            className={styles.metricBar}
                            style={{ width: `${(member.projectCount / Math.max(...teamMembers.map(m => m.sharedProjects.length))) * 100}%` }}
                          />
                        </div>
                        <span className={styles.metricListValue}>{member.projectCount}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Colaboradores por proyecto */}
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>Colaboradores por proyecto</h3>
                <div className={styles.metricList}>
                  {projects
                    .map(p => ({
                      name: p,
                      memberCount: teamMembers.filter(m => m.sharedProjects.includes(p)).length
                    }))
                    .sort((a, b) => b.memberCount - a.memberCount)
                    .slice(0, 6)
                    .map((project) => (
                      <div key={project.name} className={styles.metricListItem}>
                        <span className={styles.metricListName}>{project.name}</span>
                        <span className={styles.metricListValue}>{project.memberCount}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {showTeam ? (
                <>
                  <header className={styles.header}>
                    <h2>Mi Equipo</h2>
                    <div className={styles.filtersContainer}>
                      <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Proyecto:</label>
                        <select
                          className={styles.filterSelect}
                          value={filterProject}
                          onChange={(e) => setFilterProject(e.target.value)}
                        >
                          <option value="">Todos los proyectos</option>
                          {allProjects.map((project) => (
                            <option key={project} value={project}>{project}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Habilidad:</label>
                        <select
                          className={styles.filterSelect}
                          value={filterSkill}
                          onChange={(e) => setFilterSkill(e.target.value)}
                        >
                          <option value="">Todas las habilidades</option>
                          {allSkills.map((skill) => (
                            <option key={skill} value={skill}>{skill}</option>
                          ))}
                        </select>
                      </div>
                      {(filterProject || filterSkill) && (
                        <button
                          className={styles.clearFiltersBtn}
                          onClick={() => { setFilterProject(''); setFilterSkill(''); }}
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </header>
                  <div className={styles.filesRow}>
                    {filteredTeamMembers.length === 0 ? (
                      <div style={{ color: '#888', fontSize: 18, marginTop: 32 }}>
                        {teamMembers.length === 0 ? 'No hay miembros en tu equipo.' : 'No hay miembros que coincidan con los filtros.'}
                      </div>
                    ) : (
                      filteredTeamMembers.map((member) => (
                        <div
                          key={member.id}
                          className={styles.teamCard}
                        >
                          <div
                            className={styles.teamAvatar}
                            style={{
                              backgroundImage: `url(${member.avatar})`,
                            }}
                          ></div>
                          <div className={styles.teamName}>{member.name}</div>
                          <div className={styles.teamEmail}>{member.email}</div>
                          <div className={styles.teamSkills}>
                            {member.skills.length === 0 ? (
                              <span style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>Sin habilidades definidas</span>
                            ) : (
                              <>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: '#666' }}>Habilidades:</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                  {member.skills.map((skill, idx) => (
                                    <span
                                      key={idx}
                                      className={styles.skillTag}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <div className={styles.teamProjects}>
                            {member.sharedProjects.length === 0 ? (
                              <span style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>Sin proyectos compartidos</span>
                            ) : (
                              <>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>Proyectos compartidos:</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                  {member.sharedProjects.map((project, idx) => (
                                    <span
                                      key={idx}
                                      className={styles.projectTag}
                                      onClick={(e) => { e.stopPropagation(); setShowTeam(false); setSelectedProject(project); }}
                                    >
                                      {project}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <button
                            className={styles.teamProfileBtn}
                            onClick={(e) => { e.stopPropagation(); setSelectedTeamMember(member); }}
                          >
                            Ver perfil
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedTeamMember && (
                    <div className={styles.modalOverlay} onClick={() => setSelectedTeamMember(null)}>
                      <div className={styles.modalContent} style={{ minWidth: 760, maxWidth: 1000, minHeight: 500, padding: 56 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div
                              style={{
                                width: 130,
                                height: 130,
                                borderRadius: '50%',
                                backgroundImage: `url(${selectedTeamMember.avatar})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: '5px solid rgba(102, 126, 234, 0.3)',
                              }}
                            />
                            <div>
                              <h2 style={{ margin: 0, color: '#5a67d8', fontSize: '2.1rem' }}>{selectedTeamMember.name}</h2>
                              <a href={`mailto:${selectedTeamMember.email}`} style={{ fontSize: 19, color: '#667eea', textDecoration: 'none' }}>{selectedTeamMember.email}</a>
                            </div>
                          </div>
                          <button onClick={() => setSelectedTeamMember(null)} style={{ background: 'none', border: 'none', fontSize: 32, cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', gap: 40, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, paddingRight: 28, borderRight: '1px solid rgba(102, 126, 234, 0.2)' }}>
                            <label style={{ fontSize: 17, color: '#888', fontWeight: 600, display: 'block', marginBottom: 16 }}>Habilidades</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                              {selectedTeamMember.skills.map((skill, idx) => (
                                <span key={idx} className={styles.skillTag} style={{ fontSize: '0.8rem', padding: '5px 12px' }}>{skill}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 17, color: '#888', fontWeight: 600, display: 'block', marginBottom: 16 }}>Proyectos compartidos</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                              {selectedTeamMember.sharedProjects.map((project, idx) => (
                                <span
                                  key={idx}
                                  className={styles.projectTag}
                                  onClick={() => { setSelectedTeamMember(null); setShowTeam(false); setSelectedProject(project); }}
                                  style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '5px 12px' }}
                                >
                                  {project}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : !selectedProject ? (
                <div style={{ padding: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                    <h2 style={{ margin: 0 }}>Proyectos</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className={styles.projectSearchWrap}>
                        <i className="ri-search-line" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.9rem', pointerEvents: 'none' }} />
                        <input
                          className={styles.projectSearchInput}
                          type="text"
                          placeholder="Buscar proyecto..."
                          value={projectSearch}
                          onChange={e => setProjectSearch(e.target.value)}
                        />
                        {projectSearch && (
                          <button className={styles.projectSearchClear} onClick={() => setProjectSearch('')}>
                            <i className="ri-close-line" />
                          </button>
                        )}
                      </div>
                      <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Tipo:</label>
                        <select
                          className={styles.filterSelect}
                          value={filterProjectType}
                          onChange={(e) => setFilterProjectType(e.target.value)}
                          style={{ minWidth: 160 }}
                        >
                          <option value="">Todos los tipos</option>
                          {projectTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      {filterProjectType && (
                        <button
                          className={styles.clearFiltersBtn}
                          onClick={() => setFilterProjectType('')}
                          style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        >
                          Limpiar
                        </button>
                      )}
                      <button className={styles.uploadBtn} onClick={() => setShowCreateProjectModal(true)}>
                        Crear proyecto
                      </button>
                    </div>
                  </div>
                  <div className={styles.projectsRow}>
                    {filteredProjects.length === 0 ? (
                      <div style={{ color: '#888', fontSize: 18, marginTop: 32 }}>
                        {projects.length === 0 ? 'No hay proyectos.' : 'No hay proyectos de este tipo.'}
                      </div>
                    ) : (
                      filteredProjects.map((project) => {
                        const meta = projectMetadata[project] || { type: 'Sin categoría', icon: 'ri-folder-line' };
                        const typeColor = projectTypeColors[meta.type] || projectTypeColors['Sin categoría'];
                        // Obtener miembros que tienen acceso a este proyecto
                        const projectMembers = teamMembers.filter(m => m.sharedProjects.includes(project));
                        return (
                          <div
                            key={project}
                            className={styles.fileCard}
                            style={{ minWidth: 260, maxWidth: 260, minHeight: 170, maxHeight: 170, padding: '20px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}
                            onClick={() => { setSelectedProject(project); setOpenProjectMenu(null); }}
                          >
                            <div className={styles.projectCardHeader}>
                              <span className={styles.projectTypeBadge} style={{ background: typeColor.bg, color: typeColor.text }}>
                                {meta.type}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                                {projectMembers.length > 0 && (
                                  <div
                                    className={styles.projectMembers}
                                    onMouseEnter={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMembersTooltip({ project, top: r.bottom + 6, left: r.left }); }}
                                    onMouseLeave={() => setMembersTooltip(null)}
                                  >
                                    {projectMembers.slice(0, 3).map(m => (
                                      <img key={m.id} src={m.avatar} alt={m.name} className={styles.projectMemberAvatar} />
                                    ))}
                                    {projectMembers.length > 3 && (
                                      <div className={styles.projectMemberMore}>+{projectMembers.length - 3}</div>
                                    )}
                                  </div>
                                )}
                                <div className={styles.projectMenuWrapper}>
                                  <button
                                    className={styles.projectMenuBtn}
                                    onClick={e => { e.stopPropagation(); if (openProjectMenu === project) { setOpenProjectMenu(null); setMenuPosition(null); } else { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right }); setOpenProjectMenu(project); } }}
                                  >
                                    •••
                                  </button>
                                </div>
                              </div>
                            </div>
                            <i className={meta.icon || 'ri-folder-line'} style={{ fontSize: 30, color: 'var(--color-primary)', marginBottom: 10 }} />
                            <span style={{ textAlign: 'center', color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{project}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {showCreateProjectModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowCreateProjectModal(false)}>
                      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Crear nuevo proyecto</h2>
                          <button onClick={() => setShowCreateProjectModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, borderRadius: 6, padding: '2px 6px' }}>×</button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre del proyecto</label>
                          <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Ej: Mi nuevo proyecto"
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, outline: 'none', transition: 'border 0.2s, box-shadow 0.2s', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
                            onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(149, 128, 255, 0.15)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                            autoFocus
                          />
                        </div>
                        <div style={{ marginBottom: 24 }}>
                          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de proyecto</label>
                          <select
                            value={newProjectType}
                            onChange={(e) => setNewProjectType(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', cursor: 'pointer' }}
                            onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(149, 128, 255, 0.15)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                          >
                            <option value="">Seleccionar tipo...</option>
                            {projectTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setShowCreateProjectModal(false); setNewProjectName(''); setNewProjectType(''); }} style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
                          <button onClick={handleCreateProject} style={{ background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(149, 128, 255, 0.4)' }}>Crear proyecto</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <header className={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        onClick={() => setSelectedProject(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 'var(--radius-md)', transition: 'background 0.15s, color 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
                        title="Volver a proyectos"
                      >
                        <i className="ri-arrow-left-s-line" style={{ fontSize: '1.8rem', fontWeight: 700 }} />
                      </button>
                      <h2 style={{ margin: 0 }}>{selectedProject}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginRight: 32 }}>
                      <button className={styles.uploadBtn} onClick={handleUpload}>Subir archivo</button>
                      {selectedFile && fileModStates[selectedFile.path]?.modified && (
                        <button className={styles.uploadBtn} style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.3)' }} onClick={handleUploadModification}>
                          Subir modificación
                        </button>
                      )}
                    </div>
                  </header>
                  <div className={styles.filesRow}>
                    {psdFiles.length === 0 ? (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 32 }}>No hay archivos en este proyecto.</div>
                    ) : (
                      psdFiles.map((file, idx) => (
                        <div
                          className={styles.fileCard + (selectedIdx === idx ? ' ' + styles.selected : '')}
                          key={file.path}
                          onClick={() => { setSelectedIdx(idx); setSelectedFile(file); handleFileClick(file); openFilePopup(file); }}
                        >
                          <div className={styles.fileCardLeft}>
                            <div className={styles.fileTitle}>{file.name}</div>
                            <div className={styles.fileMeta}>{file.name.toLowerCase().endsWith('.ai') ? '.AI' : '.PSD'}</div>
                          </div>
                          <div className={styles.fileCardRight}>
                            <div className={styles.fileCardButtons}>
                              <button className={styles.previewBtn} onClick={e => { e.stopPropagation(); handlePreview(file.path); }}>Previsualizar</button>
                              <button className={styles.previewBtn} onClick={e => { e.stopPropagation(); const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase(); handleOpen(file.path, ext); }}>Abrir</button>
                            </div>
                            <div className={styles.fileCommentInput} onClick={e => e.stopPropagation()}>
                              <textarea
                                placeholder="Agregar comentario..."
                                value={fileComments[file.path] || ''}
                                onChange={e => setFileComments(prev => ({ ...prev, [file.path]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && e.ctrlKey && fileComments[file.path]?.trim()) {
                                    const text = fileComments[file.path].trim();
                                    const newComment: FileComment = { id: Date.now(), author: 'Tú', initials: 'TÚ', color: '#9580FF', text, timestamp: 'Ahora' };
                                    setFileCommentsThread(prev => ({ ...prev, [file.name]: [...(prev[file.name] || []), newComment] }));
                                    setFileComments(prev => ({ ...prev, [file.path]: '' }));
                                  }
                                }}
                              />
                              <button
                                className={`${styles.fileCommentSendBtn}${fileComments[file.path]?.trim() ? ' ' + styles.visible : ''}`}
                                onClick={() => {
                                  const text = fileComments[file.path]?.trim();
                                  if (!text) return;
                                  const newComment: FileComment = { id: Date.now(), author: 'Tú', initials: 'TÚ', color: '#9580FF', text, timestamp: 'Ahora' };
                                  setFileCommentsThread(prev => ({ ...prev, [file.name]: [...(prev[file.name] || []), newComment] }));
                                  setFileComments(prev => ({ ...prev, [file.path]: '' }));
                                }}
                              >
                                Enviar comentario
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {previewImg && (
                    <div className={styles.previewModal} onClick={() => setPreviewImg(null)}>
                      <img src={previewImg} alt="Previsualización PSD" className={styles.previewImg} />
                    </div>
                  )}
                  {previewError && (
                    <div className={styles.previewError}>{previewError}</div>
                  )}
                  {filePopup && ReactDOM.createPortal(
                    <div className={styles.filePopupOverlay} onClick={() => setFilePopup(null)}>
                      <div className={styles.filePopupModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.filePopupHeader}>
                          <div className={styles.filePopupHeaderLeft}>
                            <div className={styles.filePopupIcon}>
                              <i className={filePopup.name.toLowerCase().endsWith('.ai') ? 'ri-pen-nib-line' : 'ri-image-edit-line'} />
                            </div>
                            <div>
                              <div className={styles.filePopupName}>{filePopup.name}</div>
                              <div className={styles.filePopupMeta}>{selectedProject} · {filePopup.name.toLowerCase().endsWith('.ai') ? 'Adobe Illustrator' : 'Adobe Photoshop'}</div>
                            </div>
                          </div>
                          <div className={styles.filePopupHeaderRight}>
                            <button className={styles.filePopupBtn} onClick={e => { e.stopPropagation(); handlePreview(filePopup.path); }}>
                              <i className="ri-eye-line" /> Previsualizar
                            </button>
                            <button className={styles.filePopupBtn} onClick={e => { e.stopPropagation(); const ext = filePopup.name.slice(filePopup.name.lastIndexOf('.')).toLowerCase(); handleOpen(filePopup.path, ext); }}>
                              <i className="ri-external-link-line" /> Abrir
                            </button>
                            <button className={styles.filePopupClose} onClick={() => setFilePopup(null)}>
                              <i className="ri-close-line" />
                            </button>
                          </div>
                        </div>
                        <div className={styles.filePopupBody}>
                          <div className={styles.filePopupInfo}>
                            <div className={styles.filePopupPreviewPlaceholder}>
                              <i className={filePopup.name.toLowerCase().endsWith('.ai') ? 'ri-pen-nib-line' : 'ri-image-edit-line'} />
                              <span>{filePopup.name.slice(filePopup.name.lastIndexOf('.')).toUpperCase()}</span>
                            </div>
                            <div className={styles.filePopupDetails}>
                              <div className={styles.filePopupDetailRow}>
                                <span className={styles.filePopupDetailLabel}>Proyecto</span>
                                <span className={styles.filePopupDetailValue}>{selectedProject}</span>
                              </div>
                              <div className={styles.filePopupDetailRow}>
                                <span className={styles.filePopupDetailLabel}>Tipo</span>
                                <span className={styles.filePopupDetailValue}>{filePopup.name.toLowerCase().endsWith('.ai') ? 'Adobe Illustrator (.ai)' : 'Adobe Photoshop (.psd)'}</span>
                              </div>
                              <div className={styles.filePopupDetailRow}>
                                <span className={styles.filePopupDetailLabel}>Estado</span>
                                <span className={styles.filePopupDetailBadge}>{fileModStates[filePopup.path]?.modified ? 'Modificado' : 'Sin cambios'}</span>
                              </div>
                              <div className={styles.filePopupDetailRow}>
                                <span className={styles.filePopupDetailLabel}>Versiones</span>
                                <span className={styles.filePopupDetailValue}>{historyVersions.length} guardadas</span>
                              </div>
                              {fileInfo && (<>
                                {fileInfo.sizeFormatted && (
                                  <div className={styles.filePopupDetailRow}>
                                    <span className={styles.filePopupDetailLabel}>Tamaño</span>
                                    <span className={styles.filePopupDetailValue}>{fileInfo.sizeFormatted}</span>
                                  </div>
                                )}
                                {fileInfo.createdFormatted && (
                                  <div className={styles.filePopupDetailRow}>
                                    <span className={styles.filePopupDetailLabel}>Creado</span>
                                    <span className={styles.filePopupDetailValue}>{fileInfo.createdFormatted}</span>
                                  </div>
                                )}
                                {fileInfo.modifiedFormatted && (
                                  <div className={styles.filePopupDetailRow}>
                                    <span className={styles.filePopupDetailLabel}>Modificado</span>
                                    <span className={styles.filePopupDetailValue}>{fileInfo.modifiedFormatted}</span>
                                  </div>
                                )}
                                {fileInfo.meta?.owner && (
                                  <div className={styles.filePopupDetailRow}>
                                    <span className={styles.filePopupDetailLabel}>Propietario</span>
                                    <span className={styles.filePopupDetailValue}>{fileInfo.meta.owner}</span>
                                  </div>
                                )}
                                {fileInfo.hash && (
                                  <div className={styles.filePopupHashRow}>
                                    <span className={styles.filePopupDetailLabel}>SHA-256</span>
                                    <span className={styles.filePopupHash}>{fileInfo.hash}</span>
                                  </div>
                                )}
                              </>)}
                            </div>
                          </div>
                          <div className={styles.filePopupComments}>
                            <div className={styles.filePopupCommentsHeader}>
                              <i className="ri-chat-3-line" />
                              <span>Comentarios</span>
                              <span className={styles.filePopupCommentsCount}>{(fileCommentsThread[filePopup.name] || []).length}</span>
                            </div>
                            <div className={styles.filePopupCommentsList}>
                              {(fileCommentsThread[filePopup.name] || []).length === 0 ? (
                                <div className={styles.filePopupNoComments}>
                                  <i className="ri-chat-3-line" />
                                  <span>Aún no hay comentarios</span>
                                </div>
                              ) : (
                                (fileCommentsThread[filePopup.name] || []).map(c => (
                                  <div key={c.id} className={styles.filePopupComment}>
                                    <div className={styles.filePopupCommentAvatar} style={{ background: c.color }}>{c.initials}</div>
                                    <div className={styles.filePopupCommentBody}>
                                      <div className={styles.filePopupCommentTop}>
                                        <span className={styles.filePopupCommentAuthor}>{c.author}</span>
                                        <span className={styles.filePopupCommentTime}>{c.timestamp}</span>
                                      </div>
                                      <div className={styles.filePopupCommentText}>{c.text}</div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className={styles.filePopupCommentInput}>
                              <textarea
                                placeholder="Escribir un comentario..."
                                value={commentDraft}
                                onChange={e => setCommentDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                                rows={2}
                              />
                              <button className={styles.filePopupCommentSend} onClick={submitComment} disabled={!commentDraft.trim()}>
                                <i className="ri-send-plane-fill" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              )}
            </div>
            {!showTeam && !showChat && !showTasks && !showEntregables && selectedProject && (
              <aside className={styles.historyPanel} style={{ minWidth: 300, maxWidth: 340, borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg-card)', padding: 24, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
                <h3>Historial de cambios</h3>
                {selectedFile ? (
                  historyVersions.length === 0 ? (
                    <div className={styles.noHistory}>Aún no hay versiones previas de este archivo.</div>
                  ) : (
                    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                      {historyVersions.map((item, i) => (
                        <div key={i} style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, border: '1px solid var(--color-border)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-primary)' }}>{item.file}</span>
                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Modificado por <b style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{item.user}</b></span>
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{item.date}</span>
                          </div>
                          <button onClick={() => handleDownloadVersion(item)} style={{ background: 'var(--color-primary)', color: '#ffffff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 10px rgba(149, 128, 255, 0.4)', transition: 'all 0.2s', flexShrink: 0 }}>
                            Descargar
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className={styles.noHistory}>Selecciona un archivo para ver su historial.</div>
                )}
              </aside>
            )}
          </div>
        )}
      </main>
      {/* Modal de previsualización en emulador iPhone (redes sociales) */}
      {socialPreview && (
        <div className={styles.socialPreviewOverlay} onClick={() => setSocialPreview(null)}>
          <div className={styles.socialPreviewModal} onClick={e => e.stopPropagation()}>
            <div className={styles.socialPreviewHeader}>
              <span className={styles.socialPreviewTitle}>{socialPreview.platform}</span>
              <span className={styles.socialPreviewDot}>·</span>
              <span className={styles.socialPreviewFile}>{socialPreview.fileName}</span>
              <button className={styles.socialPreviewClose} onClick={() => setSocialPreview(null)}>
                <i className="ri-close-line" />
              </button>
            </div>
            <div className={styles.iphoneMockup}>
              <div className={styles.iphoneBevel}>
                <div className={styles.iphoneFrame}>
                  <div className={styles.iphoneScreen}>
                    <div className={styles.iphoneDynamicIsland} />
                  <div className={styles.igApp}>
                    {/* Top bar - Instagram */}
                    <header className={styles.igTopBar}>
                      <span className={styles.igLogoText}>Instagram</span>
                      <div className={styles.igTopIcons}>
                        <i className="ri-add-box-line" />
                        <i className="ri-heart-line" />
                        <i className="ri-messenger-line" />
                      </div>
                    </header>
                    {/* Stories */}
                    <section className={styles.igStories}>
                      <div className={styles.igStoriesScroll}>
                        <div className={styles.igStoryItem}>
                          <div className={styles.igStoryRing + ' ' + styles.igStoryOwn}>
                            <div className={styles.igStoryAvatar} style={{ backgroundImage: 'url(https://randomuser.me/api/portraits/men/50.jpg)' }}>
                              <span className={styles.igStoryAddBadge}>+</span>
                            </div>
                          </div>
                          <span className={styles.igStoryName}>Tu historia</span>
                        </div>
                        {['maria.g', 'carlos.l', 'ana_m', 'lucas.f'].map((name, i) => (
                          <div key={i} className={styles.igStoryItem}>
                            <div className={styles.igStoryRing}>
                              <div
                                className={styles.igStoryAvatar}
                                style={{ backgroundImage: `url(https://randomuser.me/api/portraits/${i % 2 === 0 ? 'women' : 'men'}/${40 + i * 10}.jpg)` }}
                              />
                            </div>
                            <span className={styles.igStoryName}>{name}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    {/* Feed post */}
                    <div className={styles.igPost}>
                      <div className={styles.igPostHeader}>
                        <div className={styles.igPostAvatar} />
                        <div className={styles.igPostMeta}>
                          <span className={styles.igPostUser}>tu_cuenta</span>
                          <span className={styles.igPostLoc}>Ubicación</span>
                        </div>
                        <i className="ri-more-fill" />
                      </div>
                      <div className={styles.igPostImg}>
                        {socialPreview.imageDataUrl ? (
                          <img src={socialPreview.imageDataUrl} alt={socialPreview.fileName} />
                        ) : (
                          <div className={styles.igPlaceholder}>
                            <span>Conectá el archivo para previsualizar</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.igPostActions}>
                        <div className={styles.igPostActionsLeft}>
                          <i className="ri-heart-line" />
                          <i className="ri-chat-3-line" />
                          <i className="ri-send-plane-line" />
                        </div>
                        <i className="ri-bookmark-line" />
                      </div>
                      <div className={styles.igPostLikes}>
                        Le gusta a <strong>usuario1</strong> y <strong>24 personas más</strong>
                      </div>
                      <div className={styles.igPostCaption}>
                        <strong>tu_cuenta</strong> Publicación de ejemplo
                      </div>
                      <div className={styles.igPostComments}>Ver los 3 comentarios</div>
                      <div className={styles.igPostTime}>Hace 2 horas</div>
                    </div>
                    {/* Bottom nav */}
                    <nav className={styles.igBottomNav}>
                      <i className="ri-home-5-fill" />
                      <i className="ri-search-line" />
                      <i className="ri-add-box-line" />
                      <i className="ri-video-line" />
                      <div className={styles.igBottomProfile} />
                    </nav>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    {/* Modales de proyecto — fuera de cualquier condicional de vista */}
    {renamingProject && (
      <div className={styles.modalOverlay} onClick={() => setRenamingProject(null)}>
        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <h2 style={{ margin: '0 0 20px 0', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Renombrar proyecto</h2>
          <div className={styles.formGroup}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 7 }}>Nuevo nombre</label>
            <input
              className={styles.search}
              style={{ width: '100%', borderRadius: 8, padding: '10px 14px' }}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameProject(); if (e.key === 'Escape') setRenamingProject(null); }}
              autoFocus
            />
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnCancel} onClick={() => setRenamingProject(null)}>Cancelar</button>
            <button className={styles.btnSubmit} onClick={handleRenameProject}>Guardar</button>
          </div>
        </div>
      </div>
    )}
    {changingTypeProject && (
      <div className={styles.modalOverlay} onClick={() => setChangingTypeProject(null)}>
        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <h2 style={{ margin: '0 0 20px 0', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Cambiar tipo de proyecto</h2>
          <div className={styles.formGroup}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 7 }}>Tipo</label>
            <select className={styles.filterSelect} style={{ width: '100%' }} value={changeTypeValue} onChange={e => setChangeTypeValue(e.target.value)}>
              {['Branding','Packaging','Publicidad','Editorial','Web/App','Redes Sociales','Ilustración','Otro'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnCancel} onClick={() => setChangingTypeProject(null)}>Cancelar</button>
            <button className={styles.btnSubmit} onClick={handleSaveChangeType}>Guardar</button>
          </div>
        </div>
      </div>
    )}
    {sharingProject && (
      <div className={styles.modalOverlay} onClick={() => setSharingProject(null)}>
        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Compartir "{sharingProject}"</h2>
            <button onClick={() => setSharingProject(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}>×</button>
          </div>
          <div className={styles.formGroup}>
            <label>Enlace del proyecto</label>
            <div className={styles.shareInput}>
              <input readOnly value={`https://designercollab.app/project/${sharingProject.toLowerCase().replace(/\s+/g, '-')}`} />
              <button className={styles.shareCopyBtn} onClick={() => { navigator.clipboard.writeText(`https://designercollab.app/project/${sharingProject.toLowerCase().replace(/\s+/g, '-')}`); setShareLinkCopied(true); }}>
                {shareLinkCopied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label>Miembros con acceso</label>
            <div className={styles.memberList}>
              {teamMembers.filter(m => m.sharedProjects.includes(sharingProject)).length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '8px 0' }}>Nadie tiene acceso todavía.</p>
              ) : teamMembers.filter(m => m.sharedProjects.includes(sharingProject)).map(m => (
                <div key={m.id} className={styles.memberListItem} style={{ cursor: 'default' }}>
                  <img src={m.avatar} alt={m.name} className={styles.memberListAvatar} />
                  <div>
                    <div className={styles.memberListName}>{m.name}</div>
                    <div className={styles.memberListSkills}>{m.skills.join(' · ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnCancel} onClick={() => setSharingProject(null)}>Cerrar</button>
          </div>
        </div>
      </div>
    )}
    {addingMemberProject && (
      <div className={styles.modalOverlay} onClick={() => setAddingMemberProject(null)}>
        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Miembros — "{addingMemberProject}"</h2>
            <button onClick={() => setAddingMemberProject(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}>×</button>
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>Hacé click en un miembro para darle o quitarle acceso al proyecto.</p>
          <div className={styles.memberList}>
            {teamMembers.map(m => {
              const hasAccess = m.sharedProjects.includes(addingMemberProject);
              return (
                <div
                  key={m.id}
                  className={`${styles.memberListItem} ${hasAccess ? styles.memberActive : ''}`}
                  onClick={() => handleToggleMember(m.id, addingMemberProject)}
                >
                  <img src={m.avatar} alt={m.name} className={styles.memberListAvatar} />
                  <div style={{ flex: 1 }}>
                    <div className={styles.memberListName}>{m.name}</div>
                    <div className={styles.memberListSkills}>{m.skills.join(' · ')}</div>
                  </div>
                  <div className={styles.memberListCheck}>{hasAccess ? '✓' : ''}</div>
                </div>
              );
            })}
          </div>
          <div className={styles.modalActions}>
            <button className={styles.btnCancel} onClick={() => setAddingMemberProject(null)}>Listo</button>
          </div>
        </div>
      </div>
    )}
    {openProjectMenu && menuPosition && ReactDOM.createPortal(
      <div
        className={styles.projectMenu}
        style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right, zIndex: 9999 }}
        onClick={e => e.stopPropagation()}
      >
        <button className={styles.projectMenuItem} onClick={() => { setRenamingProject(openProjectMenu); setRenameValue(openProjectMenu); setOpenProjectMenu(null); setMenuPosition(null); }}>
          <i className="ri-pencil-line" /> Renombrar
        </button>
        <button className={styles.projectMenuItem} onClick={() => { const m = projectMetadata[openProjectMenu] || { type: 'Sin categoría', icon: 'ri-folder-line' }; setChangingTypeProject(openProjectMenu); setChangeTypeValue(m.type || ''); setOpenProjectMenu(null); setMenuPosition(null); }}>
          <i className="ri-price-tag-3-line" /> Cambiar tipo
        </button>
        <button className={styles.projectMenuItem} onClick={() => { setSharingProject(openProjectMenu); setShareLinkCopied(false); setOpenProjectMenu(null); setMenuPosition(null); }}>
          <i className="ri-share-line" /> Compartir
        </button>
        <button className={styles.projectMenuItem} onClick={() => { setAddingMemberProject(openProjectMenu); setOpenProjectMenu(null); setMenuPosition(null); }}>
          <i className="ri-user-add-line" /> Agregar miembro
        </button>
        <div className={styles.projectMenuDivider} />
        <button className={`${styles.projectMenuItem} ${styles.projectMenuItemDanger}`} onClick={() => { if (window.confirm(`¿Eliminar "${openProjectMenu}"?`)) handleDeleteProject(openProjectMenu); }}>
          <i className="ri-delete-bin-line" /> Eliminar
        </button>
      </div>,
      document.body
    )}
    {membersTooltip && ReactDOM.createPortal(
      (() => {
        const members = teamMembers.filter(m => m.sharedProjects.includes(membersTooltip.project));
        return (
          <div
            style={{ position: 'fixed', top: membersTooltip.top, left: membersTooltip.left, zIndex: 9999, pointerEvents: 'none', opacity: 1, visibility: 'visible', transform: 'translateY(0)' }}
            className={styles.projectMembersTooltip}
          >
            <div className={styles.tooltipTitle}>Acceso</div>
            {members.map(m => (
              <div key={m.id} className={styles.tooltipMember}>
                <img src={m.avatar} alt={m.name} className={styles.tooltipAvatar} />
                <span className={styles.tooltipName}>{m.name}</span>
              </div>
            ))}
          </div>
        );
      })(),
      document.body
    )}
    {showConfigModal && ReactDOM.createPortal(
      <div className={styles.modalOverlay} onClick={() => setShowConfigModal(false)}>
        <div className={styles.accountModal} style={{ width: 520 }} onClick={e => e.stopPropagation()}>
          <div className={styles.accountModalHeader}>
            <h2 className={styles.accountModalTitle}>Configuración</h2>
            <button className={styles.accountModalClose} onClick={() => setShowConfigModal(false)}><i className="ri-close-line" /></button>
          </div>

          {/* General */}
          <div className={styles.accountSection}>
            <div className={styles.accountSectionTitle}>General</div>
            <div className={styles.accountFieldRow}>
              <div className={styles.accountField}>
                <label className={styles.accountLabel}>Idioma</label>
                <select className={styles.accountInput} value={configSettings.idioma} onChange={e => setConfigSettings(s => ({ ...s, idioma: e.target.value }))}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>
              <div className={styles.accountField}>
                <label className={styles.accountLabel}>Zona horaria</label>
                <select className={styles.accountInput} value={configSettings.zona} onChange={e => setConfigSettings(s => ({ ...s, zona: e.target.value }))}>
                  <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
                  <option value="America/New_York">New York (GMT-5)</option>
                  <option value="Europe/Madrid">Madrid (GMT+1)</option>
                  <option value="America/Mexico_City">México (GMT-6)</option>
                  <option value="America/Bogota">Bogotá (GMT-5)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notificaciones */}
          <div className={styles.accountSection}>
            <div className={styles.accountSectionTitle}>Notificaciones</div>
            <div className={styles.configToggles}>
              {([
                { key: 'notifComentarios', label: 'Comentarios en archivos', icon: 'ri-chat-3-line' },
                { key: 'notifMenciones',   label: 'Menciones en el chat',    icon: 'ri-at-line' },
                { key: 'notifEntregas',    label: 'Actualizaciones de entregas', icon: 'ri-folder-check-line' },
                { key: 'notifEquipo',      label: 'Actividad del equipo',    icon: 'ri-team-line' },
              ] as { key: keyof typeof configSettings; label: string; icon: string }[]).map(({ key, label, icon }) => (
                <div key={key} className={styles.configToggleRow}>
                  <div className={styles.configToggleLabel}>
                    <i className={icon} />
                    <span>{label}</span>
                  </div>
                  <label className={styles.themeSwitch}>
                    <input type="checkbox" checked={configSettings[key] as boolean} onChange={() => setConfigSettings(s => ({ ...s, [key]: !s[key] }))} />
                    <span className={styles.themeSwitchTrack} />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Privacidad */}
          <div className={styles.accountSection}>
            <div className={styles.accountSectionTitle}>Privacidad</div>
            <div className={styles.configToggles}>
              {([
                { key: 'privEstado',    label: 'Mostrar estado en línea',  icon: 'ri-radio-button-line' },
                { key: 'privActividad', label: 'Compartir actividad reciente', icon: 'ri-eye-line' },
              ] as { key: keyof typeof configSettings; label: string; icon: string }[]).map(({ key, label, icon }) => (
                <div key={key} className={styles.configToggleRow}>
                  <div className={styles.configToggleLabel}>
                    <i className={icon} />
                    <span>{label}</span>
                  </div>
                  <label className={styles.themeSwitch}>
                    <input type="checkbox" checked={configSettings[key] as boolean} onChange={() => setConfigSettings(s => ({ ...s, [key]: !s[key] }))} />
                    <span className={styles.themeSwitchTrack} />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Roles predeterminados */}
          <div className={styles.accountSection}>
            <div className={styles.accountSectionTitle}>Roles predeterminados</div>
            <div className={styles.roleCards}>
              {(Object.keys(ROLE_PERMISSIONS) as UserRole[]).map(role => {
                const r = ROLE_PERMISSIONS[role];
                return (
                  <div key={role} className={styles.roleCard} style={{ borderLeftColor: r.color }}>
                    <div className={styles.roleCardHeader}>
                      <span className={styles.roleBadge} style={{ background: r.color + '22', color: r.color, borderColor: r.color + '44' }}>{role}</span>
                    </div>
                    <p className={styles.roleCardDesc}>{r.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Roles personalizados */}
          <div className={styles.accountSection}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--color-border-light)' }}>
              <span className={styles.accountSectionTitle} style={{ border: 'none', padding: 0 }}>Roles personalizados</span>
              {!showNewRoleForm && (
                <button className={styles.accountBtnSave} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                  onClick={() => { setShowNewRoleForm(true); setEditingRoleId(null); setNewRoleForm({ name: '', color: '#9580FF', perms: { ...EMPTY_PERMS } }); }}>
                  <i className="ri-add-line" /> Nuevo rol
                </button>
              )}
            </div>

            {/* Lista de roles creados */}
            {customRoles.length > 0 && (
              <div className={styles.customRoleList}>
                {customRoles.map(cr => (
                  <div key={cr.id} className={styles.customRoleItem} style={{ borderLeftColor: cr.color }}>
                    <span className={styles.roleBadge} style={{ background: cr.color + '22', color: cr.color, borderColor: cr.color + '44' }}>{cr.name}</span>
                    <div className={styles.customRolePerms}>
                      {PERM_LABELS.filter(p => cr.perms[p.key]).map(p => (
                        <span key={p.key} className={styles.customRolePerm}><i className={p.icon} /> {p.label}</span>
                      ))}
                    </div>
                    <div className={styles.customRoleActions}>
                      <button className={styles.customRoleBtn} onClick={() => { setEditingRoleId(cr.id); setNewRoleForm({ name: cr.name, color: cr.color, perms: { ...cr.perms } }); setShowNewRoleForm(true); }}>
                        <i className="ri-pencil-line" />
                      </button>
                      <button className={styles.customRoleBtn} style={{ color: '#E11D48' }} onClick={() => setCustomRoles(prev => prev.filter(r => r.id !== cr.id))}>
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario de creación / edición */}
            {showNewRoleForm && (
              <div className={styles.newRoleForm}>
                {/* Nombre */}
                <div className={styles.accountField}>
                  <label className={styles.accountLabel}>Nombre del rol</label>
                  <input className={styles.accountInput} placeholder="Ej: Freelancer, Pasante..." value={newRoleForm.name}
                    onChange={e => setNewRoleForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                </div>

                {/* Color */}
                <div className={styles.accountField}>
                  <label className={styles.accountLabel}>Color</label>
                  <div className={styles.colorSwatches}>
                    {ROLE_COLOR_PRESETS.map(c => (
                      <button key={c} className={styles.colorSwatch} style={{ background: c, outline: newRoleForm.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                        onClick={() => setNewRoleForm(f => ({ ...f, color: c }))} />
                    ))}
                  </div>
                </div>

                {/* Permisos */}
                <div className={styles.accountField}>
                  <label className={styles.accountLabel}>Permisos</label>
                  <div className={styles.permGrid}>
                    {PERM_LABELS.map(({ key, label, icon }) => (
                      <label key={key} className={styles.permRow}>
                        <input type="checkbox" checked={newRoleForm.perms[key]}
                          onChange={e => setNewRoleForm(f => ({ ...f, perms: { ...f.perms, [key]: e.target.checked } }))} />
                        <i className={icon} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className={styles.accountBtnCancel} onClick={() => { setShowNewRoleForm(false); setEditingRoleId(null); }}>Cancelar</button>
                  <button className={styles.accountBtnSave}
                    onClick={() => {
                      if (!newRoleForm.name.trim()) return;
                      if (editingRoleId) {
                        setCustomRoles(prev => prev.map(r => r.id === editingRoleId ? { ...r, name: newRoleForm.name.trim(), color: newRoleForm.color, perms: newRoleForm.perms } : r));
                      } else {
                        setCustomRoles(prev => [...prev, { id: Date.now().toString(), name: newRoleForm.name.trim(), color: newRoleForm.color, perms: { ...newRoleForm.perms } }]);
                      }
                      setShowNewRoleForm(false); setEditingRoleId(null);
                    }}>
                    {editingRoleId ? 'Guardar cambios' : 'Crear rol'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Asignación de roles — solo CEO y Admin */}
          {canChangeRoles && (
            <div className={styles.accountSection}>
              <div className={styles.accountSectionTitle}>Asignar roles</div>
              <div className={styles.roleMemberList}>
                {teamMembers.map(m => (
                  <div key={m.id} className={styles.roleMemberRow}>
                    <img src={m.avatar} alt={m.name} className={styles.roleMemberAvatar} />
                    <span className={styles.roleMemberName}>{m.name}</span>
                    <select
                      className={styles.roleMemberSelect}
                      value={teamMemberRoles[m.id] || 'Empleado'}
                      onChange={e => setTeamMemberRoles(prev => ({ ...prev, [m.id]: e.target.value as UserRole }))}
                    >
                      <optgroup label="Predeterminados">
                        {(Object.keys(ROLE_PERMISSIONS) as UserRole[]).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </optgroup>
                      {customRoles.length > 0 && (
                        <optgroup label="Personalizados">
                          {customRoles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.accountActions}>
            <button className={styles.accountBtnCancel} onClick={() => setShowConfigModal(false)}>Cerrar</button>
            <button className={styles.accountBtnSave} onClick={() => setShowConfigModal(false)}>Guardar cambios</button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {showAccountModal && ReactDOM.createPortal(
      <div className={styles.modalOverlay} onClick={() => { setShowAccountModal(false); setAccountSaved(false); setPasswordForm({ current: '', next: '', confirm: '' }); }}>
        <div className={styles.accountModal} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.accountModalHeader}>
            <h2 className={styles.accountModalTitle}>Mi cuenta</h2>
            <button className={styles.accountModalClose} onClick={() => { setShowAccountModal(false); setAccountSaved(false); setPasswordForm({ current: '', next: '', confirm: '' }); }}>
              <i className="ri-close-line" />
            </button>
          </div>

          {/* Avatar + info */}
          <div className={styles.accountProfile}>
            {googleProfile?.picture ? (
              <img
                src={googleProfile.picture}
                alt={googleProfile.name}
                className={styles.accountAvatar}
                style={{ objectFit: 'cover', padding: 0 }}
              />
            ) : (
              <div className={styles.accountAvatar}>
                {accountForm.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </div>
            )}
            <div>
              <div className={styles.accountName}>{accountForm.nombre}</div>
              <div className={styles.accountRole}>{accountForm.rol}</div>
              <span className={styles.roleBadge} style={{ background: ROLE_PERMISSIONS[currentUserRole].color + '22', color: ROLE_PERMISSIONS[currentUserRole].color, borderColor: ROLE_PERMISSIONS[currentUserRole].color + '44' }}>
                {currentUserRole}
              </span>
            </div>
          </div>

          {/* Sección: Perfil */}
          <div className={styles.accountSection}>
            <div className={styles.accountSectionTitle}>Perfil</div>
            <div className={styles.accountFields}>
              <div className={styles.accountField}>
                <label className={styles.accountLabel}>Nombre completo</label>
                <input className={styles.accountInput} value={accountForm.nombre} onChange={e => setAccountForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className={styles.accountField}>
                <label className={styles.accountLabel}>Email</label>
                <input className={styles.accountInput} type="email" value={accountForm.email} onChange={e => setAccountForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className={styles.accountField}>
                <label className={styles.accountLabel}>Rol</label>
                <input className={styles.accountInput} value={accountForm.rol} onChange={e => setAccountForm(f => ({ ...f, rol: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Sección: Seguridad */}
          <div className={styles.accountSection}>
            <div className={styles.accountSectionTitle}>Seguridad</div>
            <div className={styles.accountFields}>
              <div className={styles.accountField}>
                <label className={styles.accountLabel}>Contraseña actual</label>
                <input className={styles.accountInput} type="password" placeholder="••••••••" value={passwordForm.current} onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))} />
              </div>
              <div className={styles.accountFieldRow}>
                <div className={styles.accountField}>
                  <label className={styles.accountLabel}>Nueva contraseña</label>
                  <input className={styles.accountInput} type="password" placeholder="••••••••" value={passwordForm.next} onChange={e => setPasswordForm(f => ({ ...f, next: e.target.value }))} />
                </div>
                <div className={styles.accountField}>
                  <label className={styles.accountLabel}>Confirmar contraseña</label>
                  <input className={styles.accountInput} type="password" placeholder="••••••••" value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* Sección: Habilidades */}
          <div className={styles.accountSection}>
            <div className={styles.accountSectionTitle}>Habilidades</div>
            <div className={styles.accountSkillsTags}>
              {accountSkills.map((skill, i) => (
                <span key={i} className={styles.accountSkillTag}>
                  {skill}
                  <button className={styles.accountSkillRemove} onClick={() => setAccountSkills(prev => prev.filter((_, idx) => idx !== i))}>
                    <i className="ri-close-line" />
                  </button>
                </span>
              ))}
            </div>
            <div className={styles.accountSkillAdd}>
              <input
                className={styles.accountInput}
                placeholder="Nueva habilidad..."
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && skillInput.trim()) {
                    setAccountSkills(prev => [...prev, skillInput.trim()]);
                    setSkillInput('');
                  }
                }}
              />
              <button
                className={styles.accountBtnSave}
                style={{ padding: '9px 16px', whiteSpace: 'nowrap' }}
                onClick={() => { if (skillInput.trim()) { setAccountSkills(prev => [...prev, skillInput.trim()]); setSkillInput(''); } }}
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.accountActions}>
            {accountSaved && <span className={styles.accountSavedMsg}><i className="ri-check-line" /> Cambios guardados</span>}
            <button className={styles.accountBtnCancel} onClick={() => { setShowAccountModal(false); setAccountSaved(false); setPasswordForm({ current: '', next: '', confirm: '' }); }}>Cancelar</button>
            <button className={styles.accountBtnSave} onClick={() => { setAccountSaved(true); setPasswordForm({ current: '', next: '', confirm: '' }); }}>Guardar cambios</button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {showAgencyModal && ReactDOM.createPortal(
      <div className={styles.modalOverlay} onClick={() => { setShowAgencyModal(false); setEditingAgencyName(false); }}>
        <div className={styles.agencyModal} onClick={e => e.stopPropagation()}>
          <div className={styles.accountModalHeader}>
            <h2 className={styles.accountModalTitle}>Tu agencia</h2>
            <button className={styles.accountModalClose} onClick={() => { setShowAgencyModal(false); setEditingAgencyName(false); }}>
              <i className="ri-close-line" />
            </button>
          </div>

          <div className={styles.agencyModalHero}>
            <div className={styles.agencyModalIcon}><i className="ri-building-2-line" /></div>
            <div>
              {editingAgencyName ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className={styles.accountInput}
                    value={agencyNameDraft}
                    onChange={e => setAgencyNameDraft(e.target.value)}
                    autoFocus
                    style={{ fontSize: '1.1rem', fontWeight: 700 }}
                  />
                  <button className={styles.accountBtnSave} style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} onClick={async () => {
                    if (!agencyNameDraft.trim()) return;
                    const updated = { ...agencyProfile!, name: agencyNameDraft.trim() };
                    await (window as any).electron.invoke('save-agency-profile', updated);
                    setAgencyProfile(updated);
                    setEditingAgencyName(false);
                  }}>Guardar</button>
                  <button className={styles.accountBtnCancel} style={{ padding: '8px 14px' }} onClick={() => setEditingAgencyName(false)}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={styles.agencyModalName}>{agencyProfile?.name}</span>
                  <button className={styles.agencyEditBtn} onClick={() => { setAgencyNameDraft(agencyProfile?.name || ''); setEditingAgencyName(true); }}>
                    <i className="ri-pencil-line" />
                  </button>
                </div>
              )}
              {agencyProfile?.description && (
                <p className={styles.agencyModalDesc}>{agencyProfile.description}</p>
              )}
            </div>
          </div>

          <div className={styles.agencyModalStats}>
            <div className={styles.agencyModalStat}>
              <span className={styles.agencyModalStatLabel}>Propietario</span>
              <span className={styles.agencyModalStatValue}>{agencyProfile?.owner}</span>
            </div>
            <div className={styles.agencyModalStat}>
              <span className={styles.agencyModalStatLabel}>Creada</span>
              <span className={styles.agencyModalStatValue}>
                {agencyProfile?.createdAt ? new Date(agencyProfile.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>
            <div className={styles.agencyModalStat}>
              <span className={styles.agencyModalStatLabel}>Proyectos</span>
              <span className={styles.agencyModalStatValue}>{projects.length}</span>
            </div>
            <div className={styles.agencyModalStat}>
              <span className={styles.agencyModalStatLabel}>Miembros</span>
              <span className={styles.agencyModalStatValue}>{teamMembers.length + 1}</span>
            </div>
          </div>

          {/* Solicitudes pendientes */}
          {pendingMembers.length > 0 && (
            <div className={styles.pendingSection}>
              <div className={styles.pendingSectionTitle}>
                <i className="ri-time-line" />
                Solicitudes pendientes
                <span className={styles.pendingCount}>{pendingMembers.length}</span>
              </div>
              {pendingMembers.map(member => (
                <div key={member.id} className={styles.pendingMemberRow}>
                  {member.picture ? (
                    <img src={member.picture} alt={member.name} className={styles.pendingAvatar} />
                  ) : (
                    <div className={styles.pendingInitials}>
                      {member.name.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase()}
                    </div>
                  )}
                  <div className={styles.pendingMemberInfo}>
                    <span className={styles.pendingMemberName}>{member.name}</span>
                    <span className={styles.pendingMemberEmail}>{member.email}</span>
                  </div>
                  {approvingMemberId === member.id ? (
                    <div className={styles.pendingApproveInline}>
                      <select
                        className={styles.pendingRoleSelect}
                        value={approveRole}
                        onChange={e => setApproveRole(e.target.value)}
                      >
                        <option value="Empleado">Empleado</option>
                        <option value="Administrador">Administrador</option>
                        <option value="Cliente">Cliente</option>
                        <option value="CEO">CEO</option>
                      </select>
                      <button className={styles.pendingConfirmBtn} onClick={() => handleApproveMember(member.id)}>
                        Confirmar
                      </button>
                      <button className={styles.pendingCancelBtn} onClick={() => setApprovingMemberId(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className={styles.pendingActions}>
                      <button className={styles.pendingApproveBtn} onClick={() => { setApprovingMemberId(member.id); setApproveRole('Empleado'); }}>
                        <i className="ri-check-line" /> Aprobar
                      </button>
                      <button className={styles.pendingRejectBtn} onClick={() => handleRejectMember(member.id)}>
                        <i className="ri-close-line" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Invitar miembros */}
          <div className={styles.agencyInviteSection}>
            <div className={styles.agencyInviteHeader}>
              <i className="ri-user-add-line" />
              <span>Invitar miembros</span>
            </div>
            <p className={styles.agencyInviteDesc}>
              Compartí este enlace con tu equipo. Los nuevos miembros quedarán pendientes hasta que vos les asignes un rol desde esta pantalla.
            </p>
            <div className={styles.agencyInviteRow}>
              <div className={styles.agencyInviteLink}>
                {inviteCode
                  ? `designer-collab.app/join/${inviteCode}`
                  : 'Generando enlace...'}
              </div>
              <button
                className={styles.agencyInviteCopyBtn + (inviteCopied ? ' ' + styles.agencyInviteCopied : '')}
                disabled={!inviteCode}
                onClick={() => {
                  if (!inviteCode) return;
                  navigator.clipboard.writeText(`designer-collab.app/join/${inviteCode}`);
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                }}
              >
                {inviteCopied
                  ? <><i className="ri-check-line" /> Copiado</>
                  : <><i className="ri-clipboard-line" /> Copiar</>}
              </button>
            </div>
            <button
              className={styles.agencyRegenerateBtn}
              disabled={inviteRegenerating}
              onClick={async () => {
                setInviteRegenerating(true);
                const res = await (window as any).electron.invoke('regenerate-invite-code');
                if (res?.code) setInviteCode(res.code);
                setInviteRegenerating(false);
                setInviteCopied(false);
              }}
            >
              <i className="ri-refresh-line" />
              {inviteRegenerating ? 'Generando...' : 'Generar nuevo enlace'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

export default App;

