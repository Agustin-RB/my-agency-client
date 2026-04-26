import React, { useState, useRef } from 'react';
import styles from './TicketsView.module.css';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: 'Pendiente' | 'En proceso' | 'Esperando aprobación' | 'Resuelto' | 'Rechazado' | 'Cancelado';
  project?: string;
  createdAt: string;
  author: string;
  rejectionNote?: string;
  attachments?: { name: string; size: number }[];
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'ri-image-line';
  if (['pdf'].includes(ext)) return 'ri-file-pdf-line';
  if (['zip','rar','7z'].includes(ext)) return 'ri-file-zip-line';
  if (['ai','psd','sketch','fig'].includes(ext)) return 'ri-pencil-ruler-2-line';
  return 'ri-file-line';
}

const CATEGORIES = ['Diseño', 'Revisión', 'Nuevo proyecto', 'Consulta', 'Corrección', 'Otro'];

// Statuses the agency can set manually
const AGENCY_STATUSES: Ticket['status'][] = ['Pendiente', 'En proceso', 'Esperando aprobación', 'Cancelado'];

const PRIORITY_COLOR: Record<Ticket['priority'], string> = {
  Alta:  '#E11D48',
  Media: '#F5C842',
  Baja:  '#34D399',
};

const STATUS_COLOR: Record<Ticket['status'], { bg: string; text: string }> = {
  Pendiente:              { bg: 'rgba(245,200,66,0.12)',  text: '#DAAF2A' },
  'En proceso':           { bg: 'rgba(34,211,238,0.12)',  text: '#22D3EE' },
  'Esperando aprobación': { bg: 'rgba(251,146,60,0.14)',  text: '#FB923C' },
  Resuelto:               { bg: 'rgba(52,211,153,0.12)',  text: '#34D399' },
  Rechazado:              { bg: 'rgba(225,29,72,0.12)',   text: '#E11D48' },
  Cancelado:              { bg: 'rgba(150,150,150,0.1)',  text: '#7B7890' },
};

const DEMO_TICKETS: Ticket[] = [
  { id: '1', title: 'Revisión de logo propuesta 3',     description: 'Necesito que revisen los ajustes de tipografía en la tercera propuesta del logo.',  category: 'Revisión',        priority: 'Alta',  status: 'Pendiente',              project: 'Brand Identity',             createdAt: '2026-04-01', author: 'Cliente' },
  { id: '2', title: 'Nuevas piezas para Instagram',     description: 'Se necesitan 5 piezas para la campaña de lanzamiento del mes de mayo.',              category: 'Diseño',          priority: 'Media', status: 'Esperando aprobación',   project: 'Campaña Redes Sociales',     createdAt: '2026-04-02', author: 'Cliente' },
  { id: '3', title: 'Corrección de colores en mockup',  description: 'El mockup de la bolsa tiene los colores incorrectos, necesitan ser CMYK.',            category: 'Corrección',      priority: 'Alta',  status: 'Resuelto',               project: 'Packaging Cerveza Artesanal',createdAt: '2026-03-28', author: 'Cliente' },
  { id: '4', title: 'Consulta sobre plazos del catálogo',description: '¿Cuándo podemos tener una primera versión del catálogo para revisar?',              category: 'Consulta',        priority: 'Baja',  status: 'Pendiente',              project: 'Catálogo Muebles 2024',      createdAt: '2026-04-03', author: 'Cliente' },
  { id: '5', title: 'Ajustes tipografía home',          description: 'La tipografía del hero no coincide con el manual de marca aprobado.',                 category: 'Corrección',      priority: 'Alta',  status: 'Rechazado',              project: 'E-commerce App',             createdAt: '2026-03-30', author: 'Cliente', rejectionNote: 'El cambio no refleja los ajustes solicitados en la última reunión.' },
];

interface Props {
  projects: string[];
  canChangeStatus: boolean;
}

const EMPTY_FORM = { title: '', description: '', category: 'Diseño', priority: 'Media' as Ticket['priority'], project: '' };

export default function TicketsView({ projects, canChangeStatus }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>(DEMO_TICKETS);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'arrival' | 'priority'>('arrival');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setAttachedFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const toAdd = Array.from(files).filter(f => !existing.has(f.name + f.size));
      return [...prev, ...toAdd];
    });
  };

  const statuses: Ticket['status'][] = ['Pendiente', 'En proceso', 'Esperando aprobación', 'Resuelto', 'Rechazado', 'Cancelado'];

  const PRIORITY_WEIGHT: Record<Ticket['priority'], number> = { Alta: 3, Media: 2, Baja: 1 };

  const filtered = tickets
    .filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      return b.createdAt.localeCompare(a.createdAt); // más reciente primero
    });

  const handleCreate = () => {
    if (!form.title.trim()) { setFormError('El título es obligatorio.'); return; }
    setFormError('');
    const now = new Date().toISOString().slice(0, 10);
    setTickets(prev => [{
      id: Date.now().toString(),
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      status: 'Pendiente',
      project: form.project || undefined,
      createdAt: now,
      author: 'Tú',
      attachments: attachedFiles.length > 0 ? attachedFiles.map(f => ({ name: f.name, size: f.size })) : undefined,
    }, ...prev]);
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
    setAttachedFiles([]);
  };

  const updateStatus = (id: string, status: Ticket['status']) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    if (selectedTicket?.id === id) setSelectedTicket(t => t ? { ...t, status } : t);
  };

  const counts: Record<Ticket['status'], number> = {
    Pendiente:              tickets.filter(t => t.status === 'Pendiente').length,
    'En proceso':           tickets.filter(t => t.status === 'En proceso').length,
    'Esperando aprobación': tickets.filter(t => t.status === 'Esperando aprobación').length,
    Resuelto:               tickets.filter(t => t.status === 'Resuelto').length,
    Rechazado:              tickets.filter(t => t.status === 'Rechazado').length,
    Cancelado:              tickets.filter(t => t.status === 'Cancelado').length,
  };

  const handleAccept = (id: string) => {
    updateStatus(id, 'Resuelto');
    setRejectionNote('');
  };

  const handleReject = (id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Rechazado', rejectionNote: rejectionNote.trim() || undefined } : t));
    if (selectedTicket?.id === id) setSelectedTicket(t => t ? { ...t, status: 'Rechazado', rejectionNote: rejectionNote.trim() || undefined } : t);
    setRejectionNote('');
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Tickets</h2>
          <p className={styles.subtitle}>Pedidos y solicitudes de clientes a la agencia</p>
        </div>
        <div className={styles.headerActions}>
          {/* Search */}
          <div className={styles.searchWrap}>
            <i className="ri-search-line" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.9rem', pointerEvents: 'none' }} />
            <input className={styles.searchInput} placeholder="Buscar ticket..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className={styles.searchClear} onClick={() => setSearch('')}><i className="ri-close-line" /></button>}
          </div>
          {/* Category filter */}
          <select className={styles.filterSelect} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* Priority filter */}
          <select className={styles.filterSelect} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">Todas las prioridades</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            <option value="Baja">Baja</option>
          </select>
          {/* Sort toggle */}
          <button
            className={styles.sortBtn + (sortBy === 'priority' ? ' ' + styles.sortBtnActive : '')}
            onClick={() => setSortBy(s => s === 'arrival' ? 'priority' : 'arrival')}
            title={sortBy === 'arrival' ? 'Ordenado por llegada — click para ordenar por prioridad' : 'Ordenado por prioridad — click para ordenar por llegada'}
          >
            <i className={sortBy === 'priority' ? 'ri-sort-desc' : 'ri-sort-asc'} />
            {sortBy === 'priority' ? 'Por prioridad' : 'Por llegada'}
          </button>
          <button className={styles.newBtn} onClick={() => setShowModal(true)}>
            <i className="ri-add-line" /> Nuevo ticket
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className={styles.statusTabs}>
        <button className={styles.statusTab + (!statusFilter ? ' ' + styles.statusTabActive : '')} onClick={() => setStatusFilter('')}>
          Todos <span className={styles.tabCount}>{tickets.length}</span>
        </button>
        {statuses.map(s => (
          <button key={s} className={styles.statusTab + (statusFilter === s ? ' ' + styles.statusTabActive : '')} onClick={() => setStatusFilter(s)}>
            {s} <span className={styles.tabCount}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <i className="ri-ticket-line" />
            <span>No hay tickets que coincidan</span>
          </div>
        ) : (
          filtered.map(ticket => (
            <div key={ticket.id} className={styles.ticketCard + (ticket.status === 'Esperando aprobación' && !canChangeStatus ? ' ' + styles.ticketCardPending : '')} onClick={() => setSelectedTicket(ticket)}>
              <div className={styles.ticketTop}>
                <div className={styles.ticketMeta}>
                  <span className={styles.categoryBadge}>{ticket.category}</span>
                  <span className={styles.priorityDot} style={{ background: PRIORITY_COLOR[ticket.priority] }} title={ticket.priority} />
                  <span className={styles.priorityLabel} style={{ color: PRIORITY_COLOR[ticket.priority] }}>{ticket.priority}</span>
                </div>
                <span className={styles.statusBadge} style={{ background: STATUS_COLOR[ticket.status].bg, color: STATUS_COLOR[ticket.status].text }}>
                  {ticket.status}
                </span>
              </div>
              <div className={styles.ticketTitle}>{ticket.title}</div>
              <div className={styles.ticketDesc}>{ticket.description}</div>
              <div className={styles.ticketFooter}>
                {ticket.project && <span className={styles.ticketProject}><i className="ri-folder-3-line" /> {ticket.project}</span>}
                <span className={styles.ticketDate}><i className="ri-calendar-line" /> {ticket.createdAt}</span>
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <span className={styles.ticketAttachCount}><i className="ri-attachment-2" /> {ticket.attachments.length}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail panel */}
      {selectedTicket && (
        <div className={styles.detailOverlay} onClick={() => setSelectedTicket(null)}>
          <div className={styles.detailPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <div className={styles.detailMeta}>
                <span className={styles.categoryBadge}>{selectedTicket.category}</span>
                <span className={styles.priorityDot} style={{ background: PRIORITY_COLOR[selectedTicket.priority] }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: PRIORITY_COLOR[selectedTicket.priority] }}>{selectedTicket.priority}</span>
              </div>
              <button className={styles.detailClose} onClick={() => setSelectedTicket(null)}><i className="ri-close-line" /></button>
            </div>
            <h3 className={styles.detailTitle}>{selectedTicket.title}</h3>
            <p className={styles.detailDesc}>{selectedTicket.description}</p>
            <div className={styles.detailInfo}>
              {selectedTicket.project && (
                <div className={styles.detailRow}><i className="ri-folder-3-line" /><span>{selectedTicket.project}</span></div>
              )}
              <div className={styles.detailRow}><i className="ri-calendar-line" /><span>{selectedTicket.createdAt}</span></div>
              <div className={styles.detailRow}><i className="ri-user-line" /><span>{selectedTicket.author}</span></div>
            </div>
            {/* Attachments */}
            {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
              <div className={styles.detailAttachments}>
                <span className={styles.detailStatusLabel}>Adjuntos ({selectedTicket.attachments.length})</span>
                {selectedTicket.attachments.map((a, i) => (
                  <div key={i} className={styles.attachItem}>
                    <i className={fileIcon(a.name)} />
                    <span className={styles.attachName}>{a.name}</span>
                    <span className={styles.attachSize}>{fmtSize(a.size)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Status */}
            <div className={styles.detailStatus}>
              <span className={styles.detailStatusLabel}>Estado</span>

              {/* AGENCIA: botones para cambiar estado */}
              {canChangeStatus && (
                <div className={styles.statusOptions}>
                  {AGENCY_STATUSES.map(s => (
                    <button
                      key={s}
                      className={styles.statusOption + (selectedTicket.status === s ? ' ' + styles.statusOptionActive : '')}
                      style={selectedTicket.status === s ? { background: STATUS_COLOR[s].bg, color: STATUS_COLOR[s].text, borderColor: STATUS_COLOR[s].text + '44' } : {}}
                      onClick={() => updateStatus(selectedTicket.id, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {canChangeStatus && selectedTicket.status === 'Esperando aprobación' && (
                <p className={styles.detailHint}><i className="ri-time-line" /> Aguardando que el cliente apruebe o rechace.</p>
              )}

              {/* CLIENTE: esperando aprobación → mostrar acciones */}
              {!canChangeStatus && selectedTicket.status === 'Esperando aprobación' && (
                <div className={styles.approvalBox}>
                  <div className={styles.approvalAlert}>
                    <i className="ri-checkbox-circle-line" />
                    <span>La agencia completó este pedido. Revisá el trabajo y confirmá si estás de acuerdo.</span>
                  </div>
                  <div className={styles.field} style={{ marginTop: 8 }}>
                    <label className={styles.label}>Motivo de rechazo (opcional)</label>
                    <textarea
                      className={styles.textarea}
                      rows={2}
                      placeholder="Describí qué necesita corregirse..."
                      value={rejectionNote}
                      onChange={e => setRejectionNote(e.target.value)}
                    />
                  </div>
                  <div className={styles.approvalActions}>
                    <button className={styles.btnReject} onClick={() => handleReject(selectedTicket.id)}>
                      <i className="ri-close-circle-line" /> Rechazar
                    </button>
                    <button className={styles.btnAccept} onClick={() => handleAccept(selectedTicket.id)}>
                      <i className="ri-checkbox-circle-line" /> Aceptar
                    </button>
                  </div>
                </div>
              )}

              {/* CLIENTE: estado actual (no accionable) */}
              {!canChangeStatus && selectedTicket.status !== 'Esperando aprobación' && (
                <>
                  <span className={styles.statusBadge} style={{ background: STATUS_COLOR[selectedTicket.status].bg, color: STATUS_COLOR[selectedTicket.status].text, display: 'inline-flex', padding: '5px 14px', borderRadius: 999, fontWeight: 700, fontSize: '0.8rem' }}>
                    {selectedTicket.status}
                  </span>
                  {selectedTicket.status === 'Rechazado' && selectedTicket.rejectionNote && (
                    <div className={styles.rejectionNote}>
                      <i className="ri-feedback-line" />
                      <span>{selectedTicket.rejectionNote}</span>
                    </div>
                  )}
                  {selectedTicket.status === 'Resuelto' && (
                    <p className={styles.detailHint} style={{ color: '#34D399' }}><i className="ri-check-line" /> Aprobaste este ticket.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Nuevo ticket</h3>
              <button className={styles.detailClose} onClick={() => setShowModal(false)}><i className="ri-close-line" /></button>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Título <span style={{ color: '#E11D48' }}>*</span></label>
              <input className={styles.input} placeholder="Describe brevemente tu pedido..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Descripción</label>
              <textarea className={styles.textarea} placeholder="Más detalles sobre el pedido..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Categoría</label>
                <select className={styles.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Prioridad</label>
                <select className={styles.input} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Ticket['priority'] }))}>
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Proyecto relacionado (opcional)</label>
              <select className={styles.input} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
                <option value="">Sin proyecto</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* File attachments */}
            <div className={styles.field}>
              <label className={styles.label}>Adjuntos (opcional)</label>
              <div
                className={styles.dropZone + (dragOver ? ' ' + styles.dropZoneActive : '')}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              >
                <i className="ri-upload-cloud-2-line" />
                <span>Arrastrá archivos aquí o <strong>hacé click para seleccionar</strong></span>
                <span className={styles.dropZoneHint}>Cualquier formato · Máx. 20 MB por archivo</span>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
              </div>
              {attachedFiles.length > 0 && (
                <div className={styles.attachList}>
                  {attachedFiles.map((f, i) => (
                    <div key={i} className={styles.attachItem}>
                      <i className={fileIcon(f.name)} />
                      <span className={styles.attachName}>{f.name}</span>
                      <span className={styles.attachSize}>{fmtSize(f.size)}</span>
                      <button className={styles.attachRemove} onClick={e => { e.stopPropagation(); setAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); }}>
                        <i className="ri-close-line" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formError && <p className={styles.formError}>{formError}</p>}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); setFormError(''); setAttachedFiles([]); }}>Cancelar</button>
              <button className={styles.btnSubmit} onClick={handleCreate}>Crear ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
