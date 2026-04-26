import React, { useState, useRef } from 'react';
import styles from './Tasks.module.css';

interface Task {
  id: number;
  title: string;
  description: string;
  assignees: { name: string; avatar: string }[];
  priority: 'high' | 'medium' | 'low';
  type: string;
  rubro: string;
  date: string;
}

interface Column {
  id: string;
  title: string;
  className: string;
  color: string;
  tasks: Task[];
}

const COLUMN_COLORS = [
  '', '#9580FF', '#22D3EE', '#34D399', '#F5C842', '#F87171', '#F9A8D4', '#60A5FA'
];

const TEAM_MEMBERS = [
  { name: 'María García',   avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { name: 'Ana Martínez',   avatar: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { name: 'Carlos López',   avatar: 'https://randomuser.me/api/portraits/men/32.jpg'  },
  { name: 'Luis Rodríguez', avatar: 'https://randomuser.me/api/portraits/men/45.jpg'  },
  { name: 'Sofia Chen',     avatar: 'https://randomuser.me/api/portraits/women/26.jpg' },
];

const RUBROS = ['Editorial', 'Marketing', 'Branding', 'Web', 'Packaging', 'Redes Sociales'];
const TIPOS  = ['Diseño', 'Ilustración', 'Logo', 'Brand', 'Print', 'Motion', 'UX/UI'];

const MONTH_ORDER: Record<string,number> = {
  'Ene':0,'Feb':1,'Mar':2,'Abr':3,'May':4,'Jun':5,
  'Jul':6,'Ago':7,'Sep':8,'Oct':9,'Nov':10,'Dic':11,
};

function Tasks() {
  const [view, setView] = useState<'tablero'|'backlog'>('tablero');
  const [showModal, setShowModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    type: TIPOS[0],
    rubro: RUBROS[0],
    assigneeNames: [] as string[],
  });

  // Filtros
  const [filterRubro,    setFilterRubro]    = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  // Drag & drop tareas
  const [draggedTask, setDraggedTask] = useState<{ task: Task; sourceColumnId: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Drag & drop columnas
  const [draggedColumnId, setDraggedColumnId]   = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const dragMode = useRef<'task' | 'column' | null>(null);

  // Edición de columna
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColumnName,  setEditColumnName]  = useState('');
  const [editColumnColor, setEditColumnColor] = useState('');

  // Modal de detalle de tarea
  const [selectedTask, setSelectedTask] = useState<{ task: Task; columnId: string } | null>(null);

  // Dropdown de asignados
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  const [columns, setColumns] = useState<Column[]>([
    {
      id: 'todo',
      title: 'Por hacer',
      className: 'todo',
      color: '#9580FF',
      tasks: [
        {
          id: 1,
          title: 'Diseñar mockups de landing page',
          description: 'Crear 3 variantes de diseño para la página principal',
          assignees: [{ name: 'María García', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' }],
          priority: 'high',
          type: 'Diseño',
          rubro: 'Web',
          date: '15 Nov'
        },
        {
          id: 2,
          title: 'Revisar paleta de colores',
          description: 'Actualizar guía de marca con nueva paleta',
          assignees: [{ name: 'Ana Martínez', avatar: 'https://randomuser.me/api/portraits/women/68.jpg' }],
          priority: 'medium',
          type: 'Brand',
          rubro: 'Branding',
          date: '18 Nov'
        }
      ]
    },
    {
      id: 'inProgress',
      title: 'En progreso',
      className: 'inProgress',
      color: '#22D3EE',
      tasks: [
        {
          id: 3,
          title: 'Ilustraciones para blog',
          description: 'Crear 5 ilustraciones personalizadas',
          assignees: [{ name: 'Carlos López', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' }],
          priority: 'medium',
          type: 'Ilustración',
          rubro: 'Editorial',
          date: '12 Nov'
        }
      ]
    },
    {
      id: 'review',
      title: 'En revisión',
      className: 'review',
      color: '#F5C842',
      tasks: [
        {
          id: 4,
          title: 'Logo para cliente nuevo',
          description: 'Presentar 3 propuestas de logo',
          assignees: [{ name: 'María García', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' }],
          priority: 'high',
          type: 'Logo',
          rubro: 'Branding',
          date: '10 Nov'
        }
      ]
    },
    {
      id: 'done',
      title: 'Hecho',
      className: 'done',
      color: '#34D399',
      tasks: [
        {
          id: 5,
          title: 'Diseño de tarjetas de presentación',
          description: 'Tarjetas para equipo ejecutivo',
          assignees: [{ name: 'Ana Martínez', avatar: 'https://randomuser.me/api/portraits/women/68.jpg' }],
          priority: 'low',
          type: 'Print',
          rubro: 'Marketing',
          date: '8 Nov'
        }
      ]
    }
  ]);

  const handleAddTask = (columnId: string) => {
    setSelectedColumn(columnId);
    setShowModal(true);
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim() || !selectedColumn) return;

    const assignees = newTask.assigneeNames.length > 0
      ? TEAM_MEMBERS.filter(m => newTask.assigneeNames.includes(m.name))
      : [];
    const task: Task = {
      id: Date.now(),
      title: newTask.title,
      description: newTask.description,
      assignees,
      priority: newTask.priority,
      type: newTask.type,
      rubro: newTask.rubro,
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    };

    setColumns(columns.map(col => {
      if (col.id === selectedColumn) {
        return { ...col, tasks: [...col.tasks, task] };
      }
      return col;
    }));

    setShowModal(false);
    setShowAssigneeDropdown(false);
    setNewTask({ title: '', description: '', priority: 'medium', type: TIPOS[0], rubro: RUBROS[0], assigneeNames: [] });
    setSelectedColumn(null);
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      high: 'Alta',
      medium: 'Media',
      low: 'Baja'
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  const getColumnName = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    return column ? column.title : '';
  };

  const handleTaskClick = (task: Task, columnId: string, e: React.MouseEvent) => {
    // No abrir el modal si se está arrastrando
    if (draggedTask) return;
    e.stopPropagation();
    setSelectedTask({ task, columnId });
  };

  // Funciones de drag and drop
  const handleDragStart = (task: Task, columnId: string) => {
    dragMode.current = 'task';
    setDraggedTask({ task, sourceColumnId: columnId });
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
    dragMode.current = null;
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (dragMode.current !== 'task') return;
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedTask) return;
    
    const { task, sourceColumnId } = draggedTask;
    
    // Si se suelta en la misma columna, no hacer nada
    if (sourceColumnId === targetColumnId) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    // Mover la tarea de una columna a otra
    setColumns(prevColumns => {
      return prevColumns.map(column => {
        if (column.id === sourceColumnId) {
          // Quitar la tarea de la columna origen
          return {
            ...column,
            tasks: column.tasks.filter(t => t.id !== task.id)
          };
        }
        if (column.id === targetColumnId) {
          // Agregar la tarea a la columna destino
          return {
            ...column,
            tasks: [...column.tasks, task]
          };
        }
        return column;
      });
    });

    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // ── Handlers columnas ──────────────────────────────────────────

  const handleAddColumn = () => {
    const id = `col-${Date.now()}`;
    setColumns(prev => [...prev, { id, title: 'Nueva columna', className: '', color: '', tasks: [] }]);
    setEditingColumnId(id);
    setEditColumnName('Nueva columna');
    setEditColumnColor('');
  };

  const handleOpenColumnEdit = (col: Column, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColumnId(col.id);
    setEditColumnName(col.title);
    setEditColumnColor(col.color);
  };

  const handleSaveColumnEdit = () => {
    setColumns(prev => prev.map(c =>
      c.id === editingColumnId ? { ...c, title: editColumnName || c.title, color: editColumnColor } : c
    ));
    setEditingColumnId(null);
  };

  const handleColumnDragStart = (e: React.DragEvent, columnId: string) => {
    dragMode.current = 'column';
    setDraggedColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (dragMode.current !== 'column') return;
    if (columnId !== draggedColumnId) setDragOverColumnId(columnId);
  };

  const handleColumnDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (dragMode.current !== 'column' || !draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null);
      setDragOverColumnId(null);
      dragMode.current = null;
      return;
    }
    setColumns(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(c => c.id === draggedColumnId);
      const toIdx   = next.findIndex(c => c.id === targetColumnId);
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDraggedColumnId(null);
    setDragOverColumnId(null);
    dragMode.current = null;
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnId(null);
    setDragOverColumnId(null);
    dragMode.current = null;
  };

  const hasActiveFilters = filterRubro || filterPriority || filterType || filterAssignee;

  const filterTasks = (tasks: Task[]) => tasks.filter(t =>
    (!filterRubro    || t.rubro          === filterRubro)    &&
    (!filterPriority || t.priority       === filterPriority) &&
    (!filterType     || t.type           === filterType)     &&
    (!filterAssignee || t.assignees.some(a => a.name === filterAssignee))
  );

  // ── Backlog: tareas completadas agrupadas por mes ──
  const doneTasks = columns.flatMap(col =>
    col.id === 'done' ? col.tasks.map(t => ({ ...t, columnTitle: col.title, columnColor: col.color })) : []
  );

  const backlogByMonth: Record<string, typeof doneTasks> = {};
  doneTasks.forEach(t => {
    const parts = t.date.split(' '); // e.g. ["8", "Nov"]
    const month = parts[1] || 'Sin fecha';
    if (!backlogByMonth[month]) backlogByMonth[month] = [];
    backlogByMonth[month].push(t);
  });

  const backlogMonths = Object.keys(backlogByMonth).sort(
    (a, b) => (MONTH_ORDER[b] ?? 99) - (MONTH_ORDER[a] ?? 99)
  );

  return (
    <div className={styles.tasksContainer}>
      <div className={styles.header}>
        <h2>Tareas</h2>
        <p className={styles.headerSubtitle}>Gestiona y organiza las tareas de tu equipo</p>
        <div className={styles.viewTabs}>
          <button className={[styles.viewTab, view==='tablero'?styles.viewTabActive:''].join(' ')} onClick={()=>setView('tablero')}>
            <i className="ri-layout-column-line"/> Tablero
          </button>
          <button className={[styles.viewTab, view==='backlog'?styles.viewTabActive:''].join(' ')} onClick={()=>setView('backlog')}>
            <i className="ri-archive-line"/> Backlog
          </button>
        </div>
      </div>

      {view === 'backlog' ? (
        <div className={styles.backlogContainer}>
          {doneTasks.length === 0 ? (
            <div className={styles.backlogEmpty}>
              <i className="ri-checkbox-circle-line" style={{ fontSize: '2rem', marginBottom: 10 }}/>
              <p>No hay tareas completadas todavía.</p>
            </div>
          ) : backlogMonths.map(month => (
            <div key={month} className={styles.backlogGroup}>
              <div className={styles.backlogMonthHeader}>
                <span className={styles.backlogMonthLabel}>{month}</span>
                <span className={styles.backlogMonthCount}>{backlogByMonth[month].length} tarea{backlogByMonth[month].length !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.backlogList}>
                {backlogByMonth[month].map(task => (
                  <div key={task.id} className={styles.backlogItem} onClick={e => { e.stopPropagation(); setSelectedTask({ task, columnId: 'done' }); }}>
                    <i className={`ri-checkbox-circle-fill ${styles.backlogCheck}`}/>
                    <span className={styles.backlogTitle}>{task.title}</span>
                    <div className={styles.backlogMeta}>
                      <span className={`${styles.taskLabel} ${styles[`priority-${task.priority}`]}`}>{getPriorityLabel(task.priority)}</span>
                      <span className={`${styles.taskLabel} ${styles.type}`}>{task.type}</span>
                      <span className={`${styles.taskLabel} ${styles.type}`}>{task.rubro}</span>
                    </div>
                    <div className={styles.backlogAssignees}>
                      {task.assignees.slice(0,3).map((a,i) => (
                        <img key={i} src={a.avatar} alt={a.name} className={styles.taskAvatar} title={a.name}/>
                      ))}
                    </div>
                    <span className={styles.backlogDate}>{task.date}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {view === 'tablero' && <>
      <div className={styles.filtersBar}>
        <select
          className={`${styles.filterSelect}${filterRubro ? ' ' + styles.active : ''}`}
          value={filterRubro}
          onChange={e => setFilterRubro(e.target.value)}
        >
          <option value="">Rubro</option>
          {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          className={`${styles.filterSelect}${filterPriority ? ' ' + styles.active : ''}`}
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="">Importancia</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>

        <select
          className={`${styles.filterSelect}${filterType ? ' ' + styles.active : ''}`}
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">Tipo</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          className={`${styles.filterSelect}${filterAssignee ? ' ' + styles.active : ''}`}
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
        >
          <option value="">Asignado a</option>
          {TEAM_MEMBERS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            className={styles.filterClearBtn}
            onClick={() => { setFilterRubro(''); setFilterPriority(''); setFilterType(''); setFilterAssignee(''); }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className={styles.board}>
        {columns.map((column) => {
          const visibleTasks = filterTasks(column.tasks);
          const isEditing = editingColumnId === column.id;
          const accentColor = column.color || 'var(--color-text-secondary)';
          return (
          <div
            key={column.id}
            className={`${styles.column} ${styles[column.className]} ${dragOverColumn === column.id ? styles.columnDragOver : ''} ${draggedColumnId === column.id ? styles.columnDraggingActive : ''} ${dragOverColumnId === column.id ? styles.columnDragTarget : ''}`}
            onDragOver={(e) => { handleDragOver(e, column.id); handleColumnDragOver(e, column.id); }}
            onDragLeave={handleDragLeave}
            onDrop={(e) => { dragMode.current === 'column' ? handleColumnDrop(e, column.id) : handleDrop(e, column.id); }}
            style={{ borderTop: `3px solid ${accentColor}` }}
          >
            <div className={styles.columnHeader}>
              <div
                className={styles.columnDragHandle}
                draggable
                onDragStart={(e) => handleColumnDragStart(e, column.id)}
                onDragEnd={handleColumnDragEnd}
                title="Mover columna"
              >⠿</div>
              <div className={styles.columnTitle}>
                <h3 style={{ color: accentColor }}>{column.title}</h3>
                <span className={styles.columnBadge}>{visibleTasks.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button className={styles.columnEditBtn} onClick={(e) => handleOpenColumnEdit(column, e)} title="Editar columna">✎</button>
                <button className={styles.addButton} onClick={() => handleAddTask(column.id)}>+</button>
              </div>
            </div>

            {isEditing && (
              <div className={styles.columnEditPanel} onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editColumnName}
                  onChange={e => setEditColumnName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveColumnEdit(); if (e.key === 'Escape') setEditingColumnId(null); }}
                  placeholder="Nombre de columna"
                />
                <div className={styles.colorSwatches}>
                  {COLUMN_COLORS.map(c => (
                    <div
                      key={c}
                      className={`${styles.colorSwatch}${editColumnColor === c ? ' ' + styles.selected : ''}`}
                      style={{ background: c || 'var(--color-border)', border: c ? undefined : '1px dashed var(--color-text-muted)' }}
                      onClick={() => setEditColumnColor(c)}
                      title={c || 'Sin color'}
                    />
                  ))}
                </div>
                <div className={styles.columnEditActions}>
                  <button className={styles.columnEditCancelBtn} onClick={() => setEditingColumnId(null)}>Cancelar</button>
                  <button className={styles.columnEditSaveBtn} onClick={handleSaveColumnEdit}>Guardar</button>
                </div>
              </div>
            )}

            <div className={styles.columnContent}>
              {visibleTasks.map((task) => (
                <div 
                  key={task.id} 
                  className={`${styles.task} ${draggedTask?.task.id === task.id ? styles.taskDragging : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(task, column.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => handleTaskClick(task, column.id, e)}
                >
                  <div className={styles.taskDragHandle}>⋮⋮</div>
                  <div className={styles.taskHeader}>
                    <h4 className={styles.taskTitle}>{task.title}</h4>
                  </div>
                  <p className={styles.taskDescription}>{task.description}</p>
                  <div className={styles.taskLabels}>
                    <span className={`${styles.taskLabel} ${styles[`priority-${task.priority}`]}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                    <span className={`${styles.taskLabel} ${styles.type}`}>
                      {task.type}
                    </span>
                  </div>
                  <div className={styles.taskFooter}>
                    <div className={styles.taskAssignee}>
                      <div className={styles.taskAvatarStack}>
                        {task.assignees.slice(0, 3).map((a, i) => (
                          <img key={i} src={a.avatar} alt={a.name} className={styles.taskAvatar} title={a.name} />
                        ))}
                        {task.assignees.length > 3 && (
                          <div className={styles.taskAvatarMore}>+{task.assignees.length - 3}</div>
                        )}
                      </div>
                      <span className={styles.taskDate}>{task.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}

        <button className={styles.addColumnBtn} onClick={handleAddColumn} title="Agregar columna">+</button>
      </div>
      </>}

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 24px 0', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Nueva Tarea</h2>

            <div className={styles.formGroup}>
              <label>Título</label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Ej: Diseñar header de la web"
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <label>Descripción</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Describe la tarea..."
              />
            </div>

            <div className={styles.formGroup}>
              <label>Asignar a</label>
              <div className={styles.assigneeDropdownWrapper}>
                <button
                  type="button"
                  className={styles.assigneeTrigger}
                  onClick={() => setShowAssigneeDropdown(v => !v)}
                >
                  {newTask.assigneeNames.length === 0 ? (
                    <span style={{ color: 'var(--color-text-muted)' }}>Seleccionar personas...</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {newTask.assigneeNames.slice(0, 3).map(name => {
                        const m = TEAM_MEMBERS.find(m => m.name === name)!;
                        return <img key={name} src={m.avatar} alt={name} className={styles.assigneeTriggerAvatar} title={name} />;
                      })}
                      {newTask.assigneeNames.length > 3 && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>+{newTask.assigneeNames.length - 3}</span>}
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginLeft: 4 }}>{newTask.assigneeNames.length} seleccionado{newTask.assigneeNames.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{showAssigneeDropdown ? '▲' : '▼'}</span>
                </button>
                {showAssigneeDropdown && (
                  <div className={styles.assigneeList}>
                    {TEAM_MEMBERS.map(member => {
                      const selected = newTask.assigneeNames.includes(member.name);
                      return (
                        <div
                          key={member.name}
                          className={`${styles.assigneeItem} ${selected ? styles.assigneeItemSelected : ''}`}
                          onClick={() => {
                            const names = selected
                              ? newTask.assigneeNames.filter(n => n !== member.name)
                              : [...newTask.assigneeNames, member.name];
                            setNewTask({ ...newTask, assigneeNames: names });
                          }}
                        >
                          <img src={member.avatar} alt={member.name} className={styles.assigneeAvatar} />
                          <span className={styles.assigneeName}>{member.name}</span>
                          <div className={styles.assigneeCheck}>{selected ? '✓' : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Prioridad</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'high' | 'medium' | 'low' })}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Rubro</label>
              <select
                value={newTask.rubro}
                onChange={(e) => setNewTask({ ...newTask, rubro: e.target.value })}
              >
                {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Tipo</label>
              <select
                value={newTask.type}
                onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
              >
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className={styles.btnSubmit} onClick={handleCreateTask}>
                Crear tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle de tarea - Estilo Jira */}
      {selectedTask && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
          <div className={styles.jiraModal} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.jiraHeader}>
              <div className={styles.jiraHeaderLeft}>
                <span className={styles.jiraTaskId}>TASK-{selectedTask.task.id}</span>
                <span className={styles.jiraHeaderSeparator}>/</span>
                <span className={styles.jiraParentTask}>{selectedTask.task.type}</span>
              </div>
              <div className={styles.jiraHeaderRight}>
                <button className={styles.jiraHeaderBtn} title="Compartir">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                  </svg>
                </button>
                <button className={styles.jiraHeaderBtn} title="Más opciones">⋯</button>
                <button className={styles.jiraCloseBtn} onClick={() => setSelectedTask(null)}>×</button>
              </div>
            </div>

            {/* Content */}
            <div className={styles.jiraContent}>
              {/* Main Content - Left */}
              <div className={styles.jiraMain}>
                <h1 className={styles.jiraTitle}>{selectedTask.task.title}</h1>
                
                {/* Descripción */}
                <div className={styles.jiraSection}>
                  <div className={styles.jiraSectionHeader}>
                    <span className={styles.jiraSectionIcon}>▼</span>
                    <h3>Descripción</h3>
                  </div>
                  <div className={styles.jiraDescription}>
                    {selectedTask.task.description || 'Agregar descripción...'}
                  </div>
                </div>

                {/* Archivos adjuntos */}
                <div className={styles.jiraSection}>
                  <div className={styles.jiraSectionHeader}>
                    <span className={styles.jiraSectionIcon}>▼</span>
                    <h3>Archivos adjuntos</h3>
                    <span className={styles.jiraBadge}>0</span>
                    <button className={styles.jiraAddBtn}>+</button>
                  </div>
                  <div className={styles.jiraAttachments}>
                    <div className={styles.jiraAttachmentEmpty}>
                      Sin archivos adjuntos
                    </div>
                  </div>
                </div>

                {/* Subtareas */}
                <div className={styles.jiraSection}>
                  <div className={styles.jiraSectionHeader}>
                    <h3>Subtareas</h3>
                  </div>
                  <button className={styles.jiraAddSubtask}>+ Añadir subtarea</button>
                </div>
              </div>

              {/* Sidebar - Right */}
              <div className={styles.jiraSidebar}>
                <div className={styles.jiraSidebarHeader}>
                  <span className={styles.jiraStatusBadge} style={{
                    background: selectedTask.columnId === 'done' ? '#0d9488' :
                               selectedTask.columnId === 'review' ? '#14b8a6' :
                               selectedTask.columnId === 'inProgress' ? '#0277bd' : '#616161'
                  }}>
                    {getColumnName(selectedTask.columnId).toUpperCase()}
                  </span>
                </div>

                <div className={styles.jiraSidebarSection}>
                  <div className={styles.jiraSidebarTitle}>▼ Detalles</div>
                  
                  <div className={styles.jiraDetailRow}>
                    <span className={styles.jiraDetailLabel}>Asignado a</span>
                    <div className={styles.jiraDetailValue} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                      {selectedTask.task.assignees.length === 0 ? (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>Sin asignar</span>
                      ) : selectedTask.task.assignees.map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img src={a.avatar} alt={a.name} className={styles.jiraAvatar} />
                          <span>{a.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.jiraDetailRow}>
                    <span className={styles.jiraDetailLabel}>Etiquetas</span>
                    <div className={styles.jiraDetailValue}>
                      <span className={`${styles.jiraTag} ${styles[`priority-${selectedTask.task.priority}`]}`}>
                        {getPriorityLabel(selectedTask.task.priority)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.jiraDetailRow}>
                    <span className={styles.jiraDetailLabel}>Tipo</span>
                    <div className={styles.jiraDetailValue}>
                      <span className={styles.jiraTypeTag}>{selectedTask.task.type}</span>
                    </div>
                  </div>

                  <div className={styles.jiraDetailRow}>
                    <span className={styles.jiraDetailLabel}>Fecha</span>
                    <div className={styles.jiraDetailValue}>
                      <span>{selectedTask.task.date}</span>
                    </div>
                  </div>

                  <div className={styles.jiraDetailRow}>
                    <span className={styles.jiraDetailLabel}>Prioridad</span>
                    <div className={styles.jiraDetailValue}>
                      <span style={{ 
                        color: selectedTask.task.priority === 'high' ? '#5a67d8' : 
                               selectedTask.task.priority === 'medium' ? '#0d9488' : '#667eea'
                      }}>
                        {selectedTask.task.priority === 'high' ? '⬆️' : 
                         selectedTask.task.priority === 'medium' ? '➡️' : '⬇️'} {getPriorityLabel(selectedTask.task.priority)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.jiraDetailRow}>
                    <span className={styles.jiraDetailLabel}>ID de tarea</span>
                    <div className={styles.jiraDetailValue}>
                      <span className={styles.jiraIdLink}>TASK-{selectedTask.task.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;





