import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styles from './CalendarView.module.css';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  location?: string;
  type?: string;
}

const EVENT_TYPES = ['Reunión', 'Revisión', 'Presentación', 'Entrega', 'Social', 'Deep work'];

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Reunión':      { bg: 'rgba(34,211,238,0.12)',  border: '#22D3EE', text: '#22D3EE' },
  'Revisión':     { bg: 'rgba(149,128,255,0.14)', border: '#9580FF', text: '#B8A8FF' },
  'Presentación': { bg: 'rgba(245,200,66,0.12)',  border: '#F5C842', text: '#DAAF2A' },
  'Entrega':      { bg: 'rgba(52,211,153,0.12)',  border: '#34D399', text: '#34D399' },
  'Social':       { bg: 'rgba(244,114,182,0.12)', border: '#F472B6', text: '#F472B6' },
  'Deep work':    { bg: 'rgba(99,102,241,0.14)',  border: '#6366F1', text: '#A5B4FC' },
};
const DEFAULT_COLOR = { bg: 'rgba(149,128,255,0.12)', border: '#9580FF', text: '#B8A8FF' };

function getEventColor(type?: string) {
  return type && EVENT_COLORS[type] ? EVENT_COLORS[type] : DEFAULT_COLOR;
}

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const HOUR_HEIGHT = 64; // px per hour

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getCurrentTimeTop(): number {
  const now = new Date();
  return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
}

function makeEvent(id: string, summary: string, dayOffset: number, startH: number, startM: number, endH: number, endM: number, location?: string): CalendarEvent {
  const base = getWeekStart(new Date());
  const s = new Date(base); s.setDate(s.getDate() + dayOffset); s.setHours(startH, startM, 0, 0);
  const e = new Date(base); e.setDate(e.getDate() + dayOffset); e.setHours(endH,   endM,   0, 0);
  return { id, summary, start: { dateTime: s.toISOString() }, end: { dateTime: e.toISOString() }, location };
}

const DEMO_EVENTS: CalendarEvent[] = [
  { ...makeEvent('1', 'Kickoff rediseño app', 1, 9,  0, 10, 0,  'Sala principal'), type: 'Reunión' },
  { ...makeEvent('2', 'Revisión wireframes',  1, 14, 0, 15, 30),                   type: 'Revisión' },
  { ...makeEvent('3', 'Sync con desarrollo',  2, 10, 30, 11, 0),                   type: 'Reunión' },
  { ...makeEvent('4', 'Presentación cliente', 2, 16, 0, 17, 0,  'Google Meet'),    type: 'Presentación' },
  { ...makeEvent('5', 'Design critique',      3, 11, 0, 12, 30),                   type: 'Revisión' },
  { ...makeEvent('6', 'Almuerzo equipo',      3, 13, 0, 14, 0,  'Restaurante La Mia'), type: 'Social' },
  { ...makeEvent('7', 'Entrega assets v2',    4, 9,  0,  9, 30),                   type: 'Entrega' },
  { ...makeEvent('8', 'Retro del sprint',     4, 17, 0, 18, 0),                    type: 'Reunión' },
  { ...makeEvent('9', 'Bloque deep work',     5, 10, 0, 12, 0),                    type: 'Deep work' },
];

export default function CalendarView() {
  const [today]     = useState(new Date());
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [events, setEvents]       = useState<CalendarEvent[]>(DEMO_EVENTS);
  const [currentTimeTop, setCurrentTimeTop] = useState(getCurrentTimeTop());

  const [popupEvent, setPopupEvent] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null);

  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', startTime: '09:00', endTime: '10:00', location: '', type: '' });
  const [saveError, setSaveError] = useState('');

  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll to 8am on mount
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = 8 * HOUR_HEIGHT - 32;
    }
  }, []);

  // Update current time indicator every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTimeTop(getCurrentTimeTop()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const weekDays = getWeekDays(weekStart);
  const weekEnd  = weekDays[6];
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const weekLabel = sameMonth
    ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    : `${MONTHS[weekStart.getMonth()]} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(getWeekStart(new Date()));

  const eventsForDay = (d: Date) =>
    events.filter(e => e.start.dateTime && isSameDay(new Date(e.start.dateTime), d));

  const getEventStyle = (event: CalendarEvent) => {
    if (!event.start.dateTime || !event.end.dateTime) return { top: 0, height: HOUR_HEIGHT };
    const start = new Date(event.start.dateTime);
    const end   = new Date(event.end.dateTime);
    const startMins = start.getHours() * 60 + start.getMinutes();
    const endMins   = end.getHours()   * 60 + end.getMinutes();
    return {
      top:    (startMins / 60) * HOUR_HEIGHT,
      height: Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 22),
    };
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (!event.start.dateTime) return '';
    const s = new Date(event.start.dateTime);
    return s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    const POPUP_W = 280;
    const POPUP_H = 160;
    let x = e.clientX + 12;
    let y = e.clientY - 8;
    if (x + POPUP_W > window.innerWidth  - 12) x = e.clientX - POPUP_W - 12;
    if (y + POPUP_H > window.innerHeight - 12) y = window.innerHeight - POPUP_H - 12;
    setPopupEvent({ event, x, y });
  };

  const handleCreateEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) { setSaveError('Título y fecha son obligatorios.'); return; }
    setSaveError('');
    setEvents(prev => [...prev, {
      id: Date.now().toString(),
      summary: newEvent.title,
      start: { dateTime: new Date(`${newEvent.date}T${newEvent.startTime}:00`).toISOString() },
      end:   { dateTime: new Date(`${newEvent.date}T${newEvent.endTime}:00`).toISOString() },
      location: newEvent.location || undefined,
      type: newEvent.type || undefined,
    }]);
    setShowEventModal(false);
    setNewEvent({ title: '', date: '', startTime: '09:00', endTime: '10:00', location: '', type: '' });
  };

  const isCurrentWeek = weekDays.some(d => isSameDay(d, today));

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.weekNav}>
          <button className={styles.monthNavBtn} onClick={prevWeek}><i className="ri-arrow-left-s-line" /></button>
          <span className={styles.monthLabel}>{weekLabel}</span>
          <button className={styles.monthNavBtn} onClick={nextWeek}><i className="ri-arrow-right-s-line" /></button>
          {!isCurrentWeek && (
            <button className={styles.todayBtn} onClick={goToday}>Hoy</button>
          )}
        </div>
        <button className={styles.newEventBtn} onClick={() => setShowEventModal(true)}>
          <i className="ri-add-line" /> Nuevo evento
        </button>
      </div>

      {/* Week grid */}
      <div className={styles.weekContainer}>
        {/* Day headers */}
        <div className={styles.weekDayHeaders}>
          <div className={styles.timeGutterHeader} />
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={[styles.dayHeaderCell, isSameDay(day, today) ? styles.dayHeaderToday : ''].join(' ')}
            >
              <span className={styles.dayName}>{DAYS_SHORT[day.getDay()]}</span>
              <span className={[styles.dayNum, isSameDay(day, today) ? styles.dayNumToday : ''].join(' ')}>
                {day.getDate()}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable time grid */}
        <div className={styles.gridScroll} ref={gridRef}>
          <div className={styles.gridInner} style={{ height: 24 * HOUR_HEIGHT }}>
            {/* Hour labels */}
            <div className={styles.timeGutter}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className={styles.hourLabel} style={{ height: HOUR_HEIGHT }}>
                  <span>{h.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, di) => (
              <div key={di} className={[styles.dayColumn, isSameDay(day, today) ? styles.dayColumnToday : ''].join(' ')}>
                {/* Hour cells */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className={styles.hourCell} style={{ height: HOUR_HEIGHT }} />
                ))}

                {/* Current time line */}
                {isCurrentWeek && isSameDay(day, today) && (
                  <div className={styles.currentTimeLine} style={{ top: currentTimeTop }}>
                    <div className={styles.currentTimeDot} />
                  </div>
                )}

                {/* Events */}
                {eventsForDay(day).map(event => {
                  const { top, height } = getEventStyle(event);
                  const color = getEventColor(event.type);
                  return (
                    <div
                      key={event.id}
                      className={styles.eventBlock}
                      style={{ top, height, background: color.bg, borderLeftColor: color.border }}
                      onClick={e => handleEventClick(e, event)}
                    >
                      <div className={styles.eventBlockTitle} style={{ color: color.text }}>{event.summary}</div>
                      <div className={styles.eventBlockTime}>{formatEventTime(event)}</div>
                      {event.location && height > 48 && (
                        <div className={styles.eventBlockMeta}>
                          <i className="ri-map-pin-line" /> {event.location}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event popup */}
      {popupEvent && ReactDOM.createPortal(
        <>
          <div className={styles.popupBackdrop} onClick={() => setPopupEvent(null)} />
          <div className={styles.eventPopup} style={{ left: popupEvent.x, top: popupEvent.y }}>
            <EventPopup event={popupEvent.event} color={getEventColor(popupEvent.event.type)} onClose={() => setPopupEvent(null)} />
          </div>
        </>,
        document.body
      )}

      {/* Create event modal */}
      {showEventModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEventModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Nuevo evento</h3>
              <button className={styles.modalClose} onClick={() => setShowEventModal(false)}>
                <i className="ri-close-line" />
              </button>
            </div>

            <div className={styles.formGroup}>
              <label>Título</label>
              <input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Ej: Revisión de diseños" autoFocus />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Fecha</label>
                <input type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Inicio</label>
                <input type="time" value={newEvent.startTime} onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} />
              </div>
              <div className={styles.formGroup}>
                <label>Fin</label>
                <input type="time" value={newEvent.endTime} onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Tipo</label>
                <select value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}>
                  <option value="">Sin tipo</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Lugar (opcional)</label>
                <input value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="Ej: Sala de reuniones" />
              </div>
            </div>

            {saveError && <p className={styles.saveError}>{saveError}</p>}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => setShowEventModal(false)}>Cancelar</button>
              <button className={styles.btnSubmit} onClick={handleCreateEvent}>Crear evento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRange(event: CalendarEvent): string {
  if (!event.start.dateTime) return 'Todo el día';
  const s = new Date(event.start.dateTime);
  const e = event.end.dateTime ? new Date(event.end.dateTime) : null;
  const fmt = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

function formatFullDate(event: CalendarEvent): string {
  const d = event.start.dateTime ? new Date(event.start.dateTime) : event.start.date ? new Date(event.start.date) : new Date();
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function EventPopup({ event, color, onClose }: { event: CalendarEvent; color: { bg: string; border: string; text: string }; onClose: () => void }) {
  return (
    <div className={styles.popupInner}>
      <div className={styles.popupHeader}>
        <span className={styles.popupAccent} style={{ background: color.border }} />
        <span className={styles.popupTitle}>{event.summary}</span>
        <button className={styles.popupClose} onClick={onClose}><i className="ri-close-line" /></button>
      </div>
      <div className={styles.popupBody}>
        {event.type && (
          <div className={styles.popupRow}>
            <i className="ri-bookmark-line" style={{ color: color.border }} />
            <span style={{ color: color.text, fontWeight: 600, fontSize: '0.78rem' }}>{event.type}</span>
          </div>
        )}
        <div className={styles.popupRow}>
          <i className="ri-calendar-line" />
          <span style={{ textTransform: 'capitalize' }}>{formatFullDate(event)}</span>
        </div>
        <div className={styles.popupRow}>
          <i className="ri-time-line" />
          <span>{formatRange(event)}</span>
        </div>
        {event.location && (
          <div className={styles.popupRow}>
            <i className="ri-map-pin-line" />
            <span>{event.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}
