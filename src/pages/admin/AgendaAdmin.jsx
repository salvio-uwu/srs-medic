import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Buildings, CalendarBlank, Clock, Stethoscope, User, CheckCircle, XCircle,
  Timer, MagnifyingGlass, Plus, ClipboardText, CaretLeft, CaretRight,
  Rows, List, Hourglass, Warning, Video,
  MapPin, CurrencyDollar, PencilSimple, WifiHigh, WifiSlash, Bell, Eye,
  Trash, ArrowRight, X, DotsThreeVertical, Chat, ArrowClockwise, Funnel,
  CircleHalf, PhoneCall, SealCheck
} from '@phosphor-icons/react';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, addDoc, getDocs, deleteDoc, serverTimestamp, deleteField
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getEstadoDetallado } from '../../utils/citaStatus';

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDateSafe = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const p = new Date(v);
  return isNaN(p.getTime()) ? null : p;
};

const diffMin = (from, to = new Date()) => {
  const d = parseDateSafe(from);
  if (!d) return 0;
  return Math.max(0, Math.round((to.getTime() - d.getTime()) / 60000));
};

const fmtMin = (m) => {
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
};

const formatMoney = (v) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v || 0));

const normalizeEstado = (e = '') => String(e).toLowerCase().trim();

const isOnline = (u = {}) => {
  if (u.isOnline === true) return true;
  const ls = parseDateSafe(u.lastSeen);
  return ls ? (Date.now() - ls.getTime()) / 60000 <= 10 : false;
};

const initials = (nombre = '') =>
  nombre.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DE ESTADO
// ═══════════════════════════════════════════════════════════════════════════

// STATUS_MAP conservado solo para compatibilidad interna; la lógica de
// presentación usa getEstadoDetallado() de citaStatus.js.
const STATUS_MAP = {
  pendiente:   { label: 'Esperando triage',    color: '#475569', bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8' },
  en_espera:   { label: 'Esperando consulta',  color: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  en_consulta: { label: 'En consulta',         color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  completada:  { label: 'Finalizada',          color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981' },
  cancelada:   { label: 'Cancelada',           color: '#9f1239', bg: '#fff1f2', border: '#fecdd3', dot: '#f43f5e' },
};

const DOC_STATUS = {
  disponible: { label: 'Disponible',   color: '#059669', dot: '#10b981' },
  ocupado:    { label: 'Ocupado',      color: '#1d4ed8', dot: '#3b82f6' },
  comida:     { label: 'En receso',    color: '#d97706', dot: '#f59e0b' },
  offline:    { label: 'Desconectado', color: '#94a3b8', dot: '#cbd5e1' },
};

const getStatus = (e) => STATUS_MAP[normalizeEstado(e)] || STATUS_MAP.pendiente;

const getDoctorStatus = (d) => {
  if (!d) return null;
  if (!isOnline(d)) return DOC_STATUS.offline;
  return DOC_STATUS[d.statusOperativo] || DOC_STATUS.disponible;
};

// Traduce un identificador (posible UID de Firebase) a un nombre legible
// usando el mapa de usuarios; si no lo encuentra, devuelve el valor original.
const nombreUsuario = (raw, usuariosMap = {}) => {
  if (!raw) return '';
  return usuariosMap[raw] || raw;
};

// Deduce el estado al que debe volver una cita cancelada, según sus marcas
// de tiempo (como si la cancelación nunca hubiera ocurrido).
const estadoPrevioACancelacion = (cita = {}) => {
  if (cita.completadaAt) return 'completada';
  if (cita.inicioConsultaAt) return 'en_consulta';
  if (cita.llegadaAt) return 'en_espera';
  return 'pendiente';
};

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS GLOBALES
// ═══════════════════════════════════════════════════════════════════════════

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

  :root {
    --blue-50:  #F2F8FB;
    --blue-100: #DFF0F7;
    --blue-200: #BCE0EF;
    --blue-300: #8CCAE4;
    --blue-400: #5CB4D8;
    --blue-500: #2998C6;
    --blue-600: #0077B6;
    --blue-700: #005B8E;
    --slate-50:  #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --slate-900: #0f172a;
    --emerald-500: #059669;
    --rose-500: #e11d48;
    --amber-500: #d97706;
    --surface: #ffffff;
    --bg: #f4f7f9;
    --radius: 12px;
    --radius-lg: 16px;
    --shadow-sm: 0 1px 2px rgba(15,23,42,.05);
    --shadow-md: 0 4px 6px rgba(15,23,42,.06);
    --shadow-lg: 0 10px 15px rgba(15,23,42,.08);
  }

  .aa-root, .aa-root * { box-sizing: border-box; }
  .aa-root { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); }
  .aa-sora { font-family: 'Sora', system-ui, sans-serif !important; }

  @keyframes aa-spin   { to { transform: rotate(360deg); } }
  @keyframes aa-pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes aa-slide-r { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes aa-slide-u { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes aa-fade   { from{opacity:0} to{opacity:1} }
  @keyframes aa-pop    { 0%{transform:scale(.96);opacity:0} 100%{transform:scale(1);opacity:1} }

  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(5,150,105,.5); }
    70%  { box-shadow: 0 0 0 5px rgba(5,150,105,0); }
    100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
  }

  .aa-spinner { animation: aa-spin 0.75s linear infinite; border-radius:50%; border:3px solid #e2e8f0; border-top-color:#0077B6; }
  .aa-live-dot { animation: aa-pulse 1.7s ease-in-out infinite; }
  .aa-pulse-ring { animation: pulse-ring 1.8s ease infinite; }
  .aa-slide-r { animation: aa-slide-r 0.22s ease-out; }
  .aa-pop     { animation: aa-pop    0.20s ease-out; }
  .aa-toast   { animation: aa-slide-u 0.20s ease-out; }
  .aa-fade    { animation: aa-fade   0.18s ease-out; }

  .aa-card { background:#fff; border-radius:var(--radius-lg); border:1px solid var(--slate-200); box-shadow:var(--shadow-md); transition: box-shadow 0.18s, transform 0.18s; }
  .aa-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }

  .aa-row:hover { background: #f8fafc !important; }
  .aa-ghost:hover  { background: #f1f5f9 !important; }
  .aa-primary:hover { background: var(--blue-700) !important; }
  .aa-danger:hover  { background: #be123c !important; }

  .aa-scroll::-webkit-scrollbar       { width:5px; height:5px; }
  .aa-scroll::-webkit-scrollbar-track { background:transparent; }
  .aa-scroll::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:99px; }

  .aa-view-btn { transition: all 0.15s; cursor: pointer; }
  .aa-view-btn.active { background:var(--surface) !important; color:var(--blue-600) !important; box-shadow: var(--shadow-sm) !important; }

  .aa-status-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:20px; font-size:11px; font-weight:700; border:1px solid; white-space:nowrap; }

  .aa-filter-pill { cursor:pointer; transition:all 0.12s; border-radius:20px; }
  .aa-filter-pill:hover { border-color:#93c5fd !important; }

  .aa-tl-slot { min-height: 40px; position:relative; border-bottom:1px solid #f1f5f9; display:flex; }
  .aa-tl-slot:hover { background:#fafbfc; }
  .aa-tl-slot.cur { background:#eff6ff; border-bottom:1px solid #bfdbfe; }

  .aa-cita-blk { border-radius:6px; padding:4px 8px; cursor:pointer; border-left:3px solid; font-size:11px; margin:2px; line-height:1.3; }
  .aa-cita-blk:hover { filter:brightness(.96); }

  .aa-input  { width:100%; height:36px; padding:0 12px; border:1px solid var(--slate-200); border-radius:8px; background:var(--slate-50); font-size:13px; color:var(--slate-700); outline:none; transition:border-color 0.15s, box-shadow 0.15s; }
  .aa-input:focus { border-color:var(--blue-600); box-shadow:0 0 0 3px rgba(0,119,182,.08); background:var(--surface); }
  .aa-select { height:36px; padding:0 10px; border:1px solid var(--slate-200); border-radius:8px; background:var(--slate-50); font-size:13px; color:var(--slate-700); outline:none; cursor:pointer; }
  .aa-select:focus { border-color:var(--blue-600); box-shadow:0 0 0 3px rgba(0,119,182,.08); }

  .aa-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:800; display:flex; align-items:center; justify-content:center; }
  .aa-modal   { background:var(--surface); border-radius:var(--radius-lg); box-shadow:0 24px 60px rgba(15,23,42,.18); overflow:hidden; }
`;

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — VISTA LISTA
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — VISTA LISTA
// ═══════════════════════════════════════════════════════════════════════════

const VistaLista = ({ citas, onSelect, onCancelOpen, actionLoading }) => {
  const [sortField, setSortField] = useState('hora');
  const [sortDir, setSortDir] = useState('asc');

  const sorted = useMemo(() => [...citas].sort((a, b) => {
    const va = String(a[sortField] || '');
    const vb = String(b[sortField] || '');
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  }), [citas, sortField, sortDir]);

  const toggleSort = (f) => {
    if (sortField === f) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f); setSortDir('asc'); }
  };

  const TH = ({ field, children }) => (
    <th
      onClick={() => toggleSort(field)}
      style={{
        padding: '10px 14px', fontSize: 10, fontWeight: 800, color: sortField === field ? 'var(--blue-600)' : 'var(--slate-400)',
        textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--slate-50)',
        border: 'none', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--slate-200)', userSelect: 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{children}</div>
    </th>
  );

  if (citas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '70px 24px', color: 'var(--slate-400)' }}>
        <List size={44} weight="thin" style={{ marginBottom: 14, opacity: 0.35 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 6 }}>Sin resultados</div>
        <div style={{ fontSize: 13 }}>Ajusta los filtros para ver citas</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--slate-200)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <TH field="hora"><Clock size={11} /> Hora</TH>
            <TH field="paciente"><User size={11} /> Paciente</TH>
            <TH field="doctorAsignado"><Stethoscope size={11} /> Médico</TH>
            <TH field="motivo">Motivo</TH>
            <TH field="consultorio"><Buildings size={11} /> Consultorio</TH>
            <TH field="estado">Estado</TH>
            <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--slate-50)', border: 'none', textAlign: 'right', borderBottom: '1px solid var(--slate-200)' }}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cita, idx) => {
            const st = getEstadoDetallado(cita);
            const estado = normalizeEstado(cita.estado);
            const canCancel = estado !== 'cancelada' && estado !== 'completada';
            return (
              <tr key={cita.id} className="aa-row" style={{ background: idx % 2 === 0 ? 'var(--surface)' : '#fafbfc', borderBottom: idx < sorted.length - 1 ? '1px solid var(--slate-100)' : 'none' }}>
                <td style={{ padding: '10px 14px' }}>
                  <div className="aa-sora" style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-700)' }}>{cita.hora || '--'}</div>
                  {cita.horaFin && <div style={{ fontSize: 10, color: 'var(--slate-400)' }}>{cita.horaFin}</div>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-800)', cursor: 'pointer' }} onClick={() => onSelect(cita)}>
                    {cita.paciente || '--'}
                  </div>
                  {cita.tipoConsulta && <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 1 }}>{cita.tipoConsulta}</div>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--slate-600)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cita.doctorAsignado || <span style={{ color: 'var(--slate-300)', fontStyle: 'italic' }}>Sin asignar</span>}
                </td>
                <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                  <div style={{ fontSize: 12, color: 'var(--slate-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cita.motivo || '--'}</div>
                  {cita.esTeleconsulta && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2, fontSize: 10, color: '#6366f1', background: '#eef2ff', padding: '1px 5px', borderRadius: 4 }}>
                      <Video size={9} weight="fill" /> Teleconsulta
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--slate-500)' }}>{cita.consultorio || '--'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span className="aa-status-badge" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0, animation: st.pulse ? 'aa-pulse 1.5s ease infinite' : 'none' }} />
                    {st.label}
                  </span>
                </td>
                <td style={{ padding: '8px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => onSelect(cita)} title="Ver detalle"
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--slate-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-600)' }}>
                      <Eye size={13} />
                    </button>
                    {canCancel && (
                      <button onClick={() => onCancelOpen(cita)} title="Cancelar"
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecdd3', background: '#fff1f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                        <XCircle size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — VISTA TIMELINE
// ═══════════════════════════════════════════════════════════════════════════

const VistaTimeline = ({ citas, consultorios, currentTime, onSelect }) => {
  const scrollRef = useRef(null);
  const todayRef = useRef(false);

  const timeSlots = useMemo(() => {
    const slots = [];
    const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const totalMin = h * 60 + m;
        slots.push({ label, totalMin, isCurrent: nowMin >= totalMin && nowMin < totalMin + 30 });
      }
    }
    return slots;
  }, [currentTime]);

  const activeConsultorios = useMemo(() => {
    const usedIds = new Set();
    const usedNames = new Set();
    citas.forEach((c) => {
      if (c.consultorioId) usedIds.add(c.consultorioId);
      if (c.consultorio) usedNames.add(c.consultorio);
    });
    const fromCatalog = consultorios.filter((c) => usedIds.has(c.id) || usedNames.has(c.nombre));
    const hasSinAsignar = citas.some((c) => !c.consultorioId && !c.consultorio);
    const result = [...fromCatalog];
    if (hasSinAsignar) result.push({ id: '__sin__', nombre: 'Sin consultorio', especialidad: '' });
    return result;
  }, [citas, consultorios]);

  const citasByConsultorio = useMemo(() => {
    const map = new Map();
    activeConsultorios.forEach((c) => map.set(c.id, []));
    citas.forEach((cita) => {
      const key = cita.consultorioId || (activeConsultorios.find((c) => c.nombre === cita.consultorio)?.id) || '__sin__';
      if (map.has(key)) map.get(key).push(cita);
    });
    return map;
  }, [citas, activeConsultorios]);

  const getCitasInSlot = (consultorioId, slotTotalMin) =>
    (citasByConsultorio.get(consultorioId) || []).filter((cita) => {
      const [h, m] = (cita.hora || '00:00').split(':').map(Number);
      const citaMin = h * 60 + m;
      return citaMin >= slotTotalMin && citaMin < slotTotalMin + 30;
    });

  const currentSlotMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentSlotLabel = `${String(Math.floor(currentSlotMin / 30) * 30).padStart(2, '0')}:${String(Math.floor(currentSlotMin / 30) * 30 % 60).padStart(2, '0')}`;

  // Auto-scroll to current time slot
  useEffect(() => {
    if (!todayRef.current && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-slot="${currentSlotLabel}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        todayRef.current = true;
      }
    }
  }, [currentSlotLabel]);

  if (activeConsultorios.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '70px 24px', color: 'var(--slate-400)' }}>
        <Rows size={44} weight="thin" style={{ marginBottom: 14, opacity: 0.35 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-500)' }}>Sin citas para mostrar en timeline</div>
      </div>
    );
  }

  const colW = Math.max(150, Math.min(260, Math.floor(900 / activeConsultorios.length)));

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--slate-200)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      {/* Cabecera fija con current time */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--slate-200)', background: 'var(--slate-50)', position: 'sticky', top: 0, zIndex: 5 }}>
        <div style={{ width: 68, flexShrink: 0, padding: '10px 8px', fontSize: 9, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={10} />
          Hora
        </div>
        {activeConsultorios.map((cons) => (
          <div key={cons.id} style={{ width: colW, flexShrink: 0, padding: '10px 12px', borderLeft: '1px solid var(--slate-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--slate-900)' }}>
              <Buildings size={11} weight="duotone" style={{ color: 'var(--blue-600)' }} />
              {cons.nombre}
            </div>
            {cons.especialidad && <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 1 }}>{cons.especialidad}</div>}
          </div>
        ))}
      </div>

      {/* Línea de tiempo actual */}
      <div ref={scrollRef} className="aa-scroll" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', position: 'relative' }}>
        {timeSlots.map((slot) => {
          const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
          const past = slot.totalMin + 30 <= nowMin;
          return (
            <div
              key={slot.label}
              data-slot={slot.label}
              className={`aa-tl-slot${slot.isCurrent ? ' cur' : ''}`}
              style={{
                display: 'flex',
                minHeight: 44,
                opacity: past ? 0.35 : 1,
                background: slot.isCurrent ? 'var(--blue-50)' : 'transparent',
              }}>
              <div style={{
                width: 68, flexShrink: 0, padding: '6px 8px',
                fontSize: 11, fontWeight: slot.isCurrent ? 800 : 500,
                color: slot.isCurrent ? 'var(--blue-600)' : 'var(--slate-400)',
                position: 'relative',
              }}>
                {slot.label}
                {slot.isCurrent && (
                  <div style={{
                    position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--blue-600)',
                  }} />
                )}
              </div>
              {activeConsultorios.map((cons) => {
                const slotCitas = getCitasInSlot(cons.id, slot.totalMin);
                return (
                  <div key={cons.id} style={{
                    width: colW, flexShrink: 0,
                    borderLeft: '1px solid var(--slate-100)',
                    padding: 2,
                    background: slot.isCurrent ? 'var(--blue-50)' : 'transparent',
                  }}>
                    {slotCitas.map((cita) => {
                      const st = getEstadoDetallado(cita);
                      const estado = normalizeEstado(cita.estado);
                      const isCancelled = estado === 'cancelada';
                      return (
                        <div
                          key={cita.id}
                          onClick={() => onSelect?.(cita)}
                          className="aa-cita-blk"
                          style={{
                            borderRadius: 6,
                            padding: '5px 8px',
                            cursor: 'pointer',
                            fontSize: 11,
                            lineHeight: 1.4,
                            background: isCancelled ? '#fef2f2' : 'var(--surface)',
                            border: `1px solid ${isCancelled ? '#fecaca' : 'var(--slate-200)'}`,
                            borderLeft: 'none',
                            opacity: isCancelled ? 0.5 : 1,
                            marginBottom: 2,
                          }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                             <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-500)', flexShrink: 0 }}>
                               {cita.hora}
                             </span>
                            <span style={{
                              fontWeight: 700, color: isCancelled ? 'var(--slate-400)' : 'var(--slate-800)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {cita.paciente}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                              background: st.bg, color: st.color, whiteSpace: 'nowrap',
                            }}>
                              {st.label}
                            </span>
                            {cita.doctorAsignado && (
                              <span style={{ fontSize: 9, color: 'var(--slate-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cita.doctorAsignado}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — PANEL DE AUDITORÍA
// ═══════════════════════════════════════════════════════════════════════════

const EVT_STYLES = {
  created:   { color: 'var(--blue-600)', bg: '#eff6ff', dot: '#0077B6', label: 'Cita creada' },
  arrived:   { color: '#059669', bg: '#ecfdf5', dot: '#10b981', label: 'Llegada registrada' },
  started:   { color: '#1d4ed8', bg: '#eff6ff', dot: '#3b82f6', label: 'Consulta iniciada' },
  completed: { color: '#065f46', bg: '#ecfdf5', dot: '#10b981', label: 'Consulta completada' },
  cancelled: { color: '#9f1239', bg: '#fff1f2', dot: '#f43f5e', label: 'Cita cancelada' },
  modified:  { color: '#92400e', bg: '#fffbeb', dot: '#f59e0b', label: 'Modificada' },
};

const AuditPanel = ({ citas, stats, usuariosMap, onClose }) => {
  const events = useMemo(() => {
    const evts = [];
    citas.forEach((cita) => {
      if (cita.createdAt) evts.push({ time: parseDateSafe(cita.createdAt), type: 'created', paciente: cita.paciente, by: cita.creadoPorNombre || nombreUsuario(cita.creadoPor, usuariosMap), extra: `${cita.motivo || ''} · ${cita.hora || ''} · ${cita.consultorio || ''}` });
      if (cita.llegadaAt) evts.push({ time: parseDateSafe(cita.llegadaAt), type: 'arrived', paciente: cita.paciente, by: '', extra: `${cita.hora || ''} · ${cita.consultorio || ''}` });
      if (cita.inicioConsultaAt) evts.push({ time: parseDateSafe(cita.inicioConsultaAt), type: 'started', paciente: cita.paciente, by: cita.doctorAsignado, extra: cita.consultorio || '' });
      if (cita.completadaAt) evts.push({ time: parseDateSafe(cita.completadaAt), type: 'completed', paciente: cita.paciente, by: cita.adminModificadoPor || cita.doctorAsignado, extra: cita.consultorio || '' });
      if (cita.canceladaAt) evts.push({ time: parseDateSafe(cita.canceladaAt), type: 'cancelled', paciente: cita.paciente, by: cita.canceladaPorNombre || nombreUsuario(cita.canceladaPor, usuariosMap), extra: cita.canceladaMotivo || 'Sin motivo' });
      if (cita.adminModificadoAt && !cita.canceladaAt && !cita.completadaAt)
        evts.push({ time: parseDateSafe(cita.adminModificadoAt), type: 'modified', paciente: cita.paciente, by: cita.adminModificadoPor, extra: `Estado: ${getStatus(cita.estado).label}` });
    });
    return evts.filter((e) => e.time).sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 60);
  }, [citas, usuariosMap]);

  const auditStats = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total',       value: stats.total,                                                        color: '#0f172a', bg: '#f8fafc' },
      { label: 'Pendientes',  value: stats.pendientes,  dotColor: '#94a3b8', color: '#475569', bg: '#f1f5f9' },
      { label: 'En espera',   value: stats.enEspera,    dotColor: '#f59e0b', color: '#92400e', bg: '#fffbeb' },
      { label: 'En consulta', value: stats.enConsulta,  dotColor: '#3b82f6', color: '#1e40af', bg: '#eff6ff' },
      { label: 'Completadas', value: stats.completadas, dotColor: '#10b981', color: '#065f46', bg: '#ecfdf5' },
      { label: 'Canceladas',  value: stats.canceladas,  dotColor: '#f43f5e', color: '#9f1239', bg: '#fff1f2' },
      { label: 'Ingresos',    value: formatMoney(stats.ingresos),                                         color: '#065f46', bg: '#ecfdf5' },
      { label: 'Cierre',      value: `${stats.tasaCierre}%`,                                            color: '#0077B6', bg: '#eff6ff' },
    ];
  }, [stats]);

  return (
    <div className="aa-slide-r" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClipboardText size={14} weight="duotone" style={{ color: 'var(--blue-600)' }} />
            Auditoría en tiempo real
          </div>
          <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>{events.length} eventos · {stats?.total || 0} citas totales</div>
        </div>
        <button onClick={onClose} className="aa-ghost" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--slate-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)' }}>
          <X size={13} />
        </button>
      </div>

      {/* KPIs compactos en auditoría */}
      {auditStats && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--slate-100)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {auditStats.map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid var(--slate-100)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{s.label}</div>
              <div className="aa-sora" style={{ fontSize: 16, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="aa-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--slate-400)', fontSize: 12 }}>Sin eventos registrados</div>
        ) : events.map((evt, idx) => {
          const es = EVT_STYLES[evt.type] || EVT_STYLES.modified;
          return (
            <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: es.dot, flexShrink: 0 }} />
                {idx < events.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--slate-200)', marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, background: es.bg, borderRadius: 8, padding: '8px 10px', border: `1px solid ${es.dot}22`, marginBottom: idx < events.length - 1 ? 0 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: es.color }}>{es.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--slate-400)', flexShrink: 0 }}>
                    {evt.time?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-800)', marginBottom: 2 }}>{evt.paciente || '--'}</div>
                {evt.extra && <div style={{ fontSize: 10, color: 'var(--slate-500)', marginBottom: 1 }}>{evt.extra}</div>}
                {evt.by && <div style={{ fontSize: 10, color: 'var(--slate-400)' }}>Por: {evt.by}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — DETALLE DE CITA (DRAWER)
// ═══════════════════════════════════════════════════════════════════════════

const DetalleCitaDrawer = ({ cita, onClose, onUpdateEstado, onCancelOpen, onRevert, canRevert, usuariosMap, actionLoading, currentTime }) => {
  const st = getEstadoDetallado(cita);
  const estado = normalizeEstado(cita.estado);
  const tiempoEspera = estado === 'en_espera' ? diffMin(cita.llegadaAt, currentTime) : 0;
  const tiempoConsulta = estado === 'en_consulta' ? diffMin(cita.inicioConsultaAt || cita.llegadaAt, currentTime) : 0;

  const nextStates = useMemo(() => {
    if (estado === 'pendiente') return ['en_espera'];
    if (estado === 'en_espera') return ['en_consulta'];
    if (estado === 'en_consulta') return ['completada'];
    return [];
  }, [estado]);

  const NEXT_LABELS = { en_espera: 'Registrar llegada', en_consulta: 'Iniciar consulta', completada: 'Completar consulta' };

  const auditItems = [
    cita.createdAt && { label: 'Cita creada', time: cita.createdAt, by: cita.creadoPorNombre || nombreUsuario(cita.creadoPor, usuariosMap) },
    cita.llegadaAt && { label: 'Llegada registrada', time: cita.llegadaAt },
    cita.inicioConsultaAt && { label: 'Consulta iniciada', time: cita.inicioConsultaAt, by: cita.doctorAsignado },
    cita.completadaAt && { label: 'Consulta completada', time: cita.completadaAt, by: cita.adminModificadoPor },
    cita.canceladaAt && { label: `Cancelada: ${cita.canceladaMotivo || 'sin motivo'}`, time: cita.canceladaAt, by: cita.canceladaPorNombre || nombreUsuario(cita.canceladaPor, usuariosMap) },
  ].filter(Boolean);

  const infoItems = [
    { icon: <Clock size={13} weight="duotone" />, label: 'Horario', value: `${cita.hora || '--'}${cita.horaFin ? ` – ${cita.horaFin}` : ''}` },
    { icon: <Stethoscope size={13} weight="duotone" />, label: 'Médico', value: cita.doctorAsignado || 'Sin asignar' },
    { icon: <Buildings size={13} weight="duotone" />, label: 'Consultorio', value: cita.consultorio || '--' },
    { icon: <ClipboardText size={13} weight="duotone" />, label: 'Motivo', value: cita.motivo || '--' },
    { icon: <CurrencyDollar size={13} weight="duotone" />, label: 'Tarifa', value: cita.motivoPrecio > 0 ? formatMoney(cita.motivoPrecio) : 'N/A' },
    { icon: <User size={13} weight="duotone" />, label: 'Tipo', value: cita.tipoConsulta || '--' },
  ];

  return (
    <>
      <div className="aa-overlay aa-fade" style={{ zIndex: 850 }} onClick={onClose} />
      <div className="aa-slide-r" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--surface)', boxShadow: '-4px 0 32px rgba(15,23,42,.15)',
        zIndex: 900, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--slate-200)', background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="aa-sora" style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cita.paciente}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="aa-status-badge" style={{ background: st.bg, color: st.color, borderColor: st.border, borderLeftWidth: 3, borderLeftColor: st.dot }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: st.dot, flexShrink: 0, animation: st.pulse ? 'aa-pulse 1.5s ease infinite' : 'none' }} />
                    {st.label}
                  </span>
                  {st.sublabel && (
                    <span style={{ fontSize: 10, color: 'var(--slate-500)', fontWeight: 500, marginLeft: 2 }}>
                      {st.sublabel}
                    </span>
                  )}
                </div>
                {cita.esTeleconsulta && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', padding: '3px 8px', borderRadius: 20 }}>
                    <Video size={10} weight="fill" /> Teleconsulta
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="aa-ghost"
              style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="aa-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {infoItems.map(({ icon, label, value }) => (
              <div key={label} style={{ background: 'var(--slate-50)', borderRadius: 9, padding: '10px 12px', border: '1px solid var(--slate-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--slate-400)', marginBottom: 4 }}>
                  {icon}
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-800)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tiempos activos */}
          {(tiempoEspera > 0 || tiempoConsulta > 0) && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '10px 14px', marginBottom: 14 }}>
              {tiempoEspera > 0 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tiempo en espera</div>
                  <div className="aa-sora" style={{ fontSize: 22, fontWeight: 800, color: tiempoEspera > 30 ? '#b91c1c' : '#92400e' }}>{fmtMin(tiempoEspera)}</div>
                </div>
              )}
              {tiempoConsulta > 0 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tiempo en consulta</div>
                  <div className="aa-sora" style={{ fontSize: 22, fontWeight: 800, color: tiempoConsulta > 45 ? '#b91c1c' : '#1e40af' }}>{fmtMin(tiempoConsulta)}</div>
                </div>
              )}
            </div>
          )}

          {/* Historial */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Historial de la cita
            </div>
            {auditItems.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--slate-400)', fontStyle: 'italic' }}>Sin historial disponible</div>
            ) : auditItems.map((item, idx) => {
              const d = parseDateSafe(item.time);
              return (
                <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue-600)', flexShrink: 0, marginTop: 3 }} />
                    {idx < auditItems.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--slate-200)', marginTop: 3 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: idx < auditItems.length - 1 ? 4 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>{item.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--slate-400)', flexShrink: 0, marginLeft: 8 }}>
                        {d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--'}
                      </span>
                    </div>
                    {item.by && <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 1 }}>Por: {item.by}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trazabilidad admin */}
          <div style={{ background: 'var(--slate-50)', borderRadius: 9, padding: '10px 12px', border: '1px solid var(--slate-100)', fontSize: 11, color: 'var(--slate-500)' }}>
            <div style={{ fontWeight: 700, color: 'var(--slate-600)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <SealCheck size={12} weight="duotone" style={{ color: 'var(--blue-600)' }} />
              Trazabilidad
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {cita.creadoPorNombre && <div><span style={{ color: 'var(--slate-400)' }}>Creó: </span>{cita.creadoPorNombre}</div>}
              {cita.creadoPorRol && <div><span style={{ color: 'var(--slate-400)' }}>Rol: </span>{cita.creadoPorRol}</div>}
              {cita.adminModificadoPor && <div><span style={{ color: 'var(--slate-400)' }}>Mod.: </span>{cita.adminModificadoPor}</div>}
              <div><span style={{ color: 'var(--slate-400)' }}>ID: </span><span style={{ fontFamily: 'monospace', fontSize: 10 }}>{cita.id?.slice(0, 10)}…</span></div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--slate-200)', display: 'flex', gap: 8, flexShrink: 0 }}>
          {nextStates.map((next) => {
            const color = next === 'completada' ? '#059669' : next === 'en_consulta' ? 'var(--blue-600)' : '#d97706';
            const isLoading = actionLoading === cita.id;
            return (
              <button key={next} onClick={() => onUpdateEstado(cita.id, next)} disabled={isLoading}
                style={{ flex: 1, height: 36, borderRadius: 9, border: 'none', background: color, color: '#fff', fontSize: 12, fontWeight: 700, cursor: isLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: isLoading ? 0.7 : 1, transition: 'background 0.15s' }}>
                {next === 'completada' ? <CheckCircle size={14} weight="fill" /> : next === 'en_consulta' ? <Stethoscope size={14} weight="fill" /> : <ArrowRight size={14} weight="bold" />}
                {NEXT_LABELS[next]}
              </button>
            );
          })}
          {estado === 'cancelada' && canRevert && (
            <button onClick={() => onRevert(cita)} disabled={actionLoading === cita.id}
              style={{ flex: 1, height: 36, borderRadius: 9, border: 'none', background: actionLoading === cita.id ? 'var(--slate-200)' : '#059669', color: actionLoading === cita.id ? 'var(--slate-400)' : '#fff', fontSize: 12, fontWeight: 700, cursor: actionLoading === cita.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}>
              <ArrowClockwise size={14} weight="bold" />
              Revertir cancelación
            </button>
          )}
          {estado !== 'cancelada' && estado !== 'completada' && (
            <button onClick={() => onCancelOpen(cita)}
              style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid #fecdd3', background: '#fff1f2', color: '#f43f5e', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <XCircle size={14} weight="fill" />
              Cancelar
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — MODAL CANCELAR
// ═══════════════════════════════════════════════════════════════════════════

const ModalCancelar = ({ cita, motivo, onMotivoChange, onConfirm, onClose, loading }) => (
  <div className="aa-overlay aa-fade" style={{ zIndex: 950 }}>
    <div className="aa-modal aa-pop" style={{ width: 420, padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Warning size={20} weight="fill" style={{ color: '#f43f5e' }} />
        </div>
        <div>
          <div className="aa-sora" style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate-900)' }}>Cancelar cita</div>
          <div style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 3 }}>{cita?.paciente}</div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
          Motivo de cancelación *
        </label>
        <textarea
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          placeholder="Describe el motivo de cancelación..."
          rows={3}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--slate-200)', borderRadius: 9, fontSize: 13, color: 'var(--slate-700)', outline: 'none', resize: 'vertical', fontFamily: "'DM Sans', system-ui, sans-serif" }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} className="aa-ghost"
          style={{ flex: 1, height: 38, borderRadius: 9, border: '1px solid var(--slate-200)', background: 'var(--surface)', color: 'var(--slate-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Mantener cita
        </button>
        <button onClick={onConfirm} disabled={!motivo.trim() || loading}
          style={{ flex: 1, height: 38, borderRadius: 9, border: 'none', background: !motivo.trim() || loading ? 'var(--slate-200)' : '#f43f5e', color: !motivo.trim() || loading ? 'var(--slate-400)' : '#fff', fontSize: 13, fontWeight: 700, cursor: !motivo.trim() || loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
          {loading ? 'Cancelando...' : 'Confirmar cancelación'}
        </button>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — MODAL REVERTIR CANCELACIÓN
// ═══════════════════════════════════════════════════════════════════════════

const ModalRevertir = ({ cita, onConfirm, onClose, loading }) => {
  const estadoPrevio = estadoPrevioACancelacion(cita || {});
  const destino = getStatus(estadoPrevio);
  return createPortal(
    <div className="aa-overlay aa-fade" style={{ zIndex: 100000 }} onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="aa-modal aa-pop" style={{ width: 420, padding: '24px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowClockwise size={20} weight="bold" style={{ color: '#059669' }} />
          </div>
          <div>
            <div className="aa-sora" style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate-900)' }}>Revertir cancelación</div>
            <div style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 3 }}>{cita?.paciente}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.5, marginBottom: 18 }}>
          La cita volverá al estado{' '}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: destino.bg, color: destino.color, border: `1px solid ${destino.border}` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: destino.dot }} />
            {destino.label}
          </span>{' '}
          y se borrarán el motivo y los datos de la cancelación, como si nunca hubiera ocurrido.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="aa-ghost"
            style={{ flex: 1, height: 38, borderRadius: 9, border: '1px solid var(--slate-200)', background: 'var(--surface)', color: 'var(--slate-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ flex: 1, height: 38, borderRadius: 9, border: 'none', background: loading ? 'var(--slate-200)' : '#059669', color: loading ? 'var(--slate-400)' : '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
            {loading ? 'Revirtiendo...' : 'Sí, revertir'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — MODAL DUPLICADOS
// ═══════════════════════════════════════════════════════════════════════════

const ModalDuplicados = ({ onClose, showToast }) => {
  const hoy = toDateStr(new Date());
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [buscando, setBuscando] = useState(false);
  const [grupos, setGrupos] = useState(null); // null = sin buscar, [] = sin dups
  const [seleccionados, setSeleccionados] = useState(new Set()); // ids a eliminar
  const [eliminando, setEliminando] = useState(false);

  const buscar = async () => {
    if (!desde || !hasta) return;
    setBuscando(true);
    setGrupos(null);
    setSeleccionados(new Set());
    try {
      const q = query(
        collection(db, 'citas'),
        where('fechaHora', '>=', `${desde}T00:00`),
        where('fechaHora', '<=', `${hasta}T23:59`),
        orderBy('fechaHora', 'asc')
      );
      const snap = await getDocs(q);
      const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Agrupar por pacienteId+fecha+hora (o nombre+fecha+hora si no hay id)
      const mapa = new Map();
      for (const cita of todas) {
        const key = `${cita.pacienteId || cita.paciente?.toLowerCase().trim()}__${cita.fecha || (cita.fechaHora || '').slice(0, 10)}__${cita.hora || (cita.fechaHora || '').slice(11, 16)}`;
        if (!mapa.has(key)) mapa.set(key, []);
        mapa.get(key).push(cita);
      }

      const dupGroups = [];
      for (const [, citasGrupo] of mapa) {
        if (citasGrupo.length > 1) {
          // Ordenar por createdAt para que la más antigua quede primero (la conservamos)
          citasGrupo.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return ta - tb;
          });
          dupGroups.push(citasGrupo);
        }
      }

      setGrupos(dupGroups);

      // Pre-seleccionar todas las duplicadas excepto la primera de cada grupo
      const presel = new Set();
      for (const g of dupGroups) {
        g.slice(1).forEach((c) => presel.add(c.id));
      }
      setSeleccionados(presel);
    } catch (err) {
      console.error(err);
      showToast('Error al buscar duplicados', 'error');
    } finally {
      setBuscando(false);
    }
  };

  const toggleCita = (id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const eliminar = async () => {
    if (seleccionados.size === 0) return;
    setEliminando(true);
    let ok = 0, fail = 0;
    for (const id of seleccionados) {
      try {
        await deleteDoc(doc(db, 'citas', id));
        ok++;
      } catch {
        fail++;
      }
    }
    setEliminando(false);
    if (fail === 0) {
      showToast(`${ok} cita${ok !== 1 ? 's' : ''} eliminada${ok !== 1 ? 's' : ''} correctamente`);
    } else {
      showToast(`${ok} eliminadas, ${fail} con error`, 'error');
    }
    // Re-buscar para reflejar cambios
    await buscar();
  };

  const LABEL = { fontSize: 11, fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 };

  return (
    <div className="aa-overlay aa-fade" style={{ zIndex: 950 }}>
      <div className="aa-modal aa-pop" style={{ width: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Warning size={17} weight="fill" style={{ color: '#f97316' }} />
            </div>
            <div>
              <div className="aa-sora" style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate-900)' }}>Detectar citas duplicadas</div>
              <div style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 1 }}>Busca por rango de fechas y elimina las copias</div>
            </div>
          </div>
          <button onClick={onClose} className="aa-ghost"
            style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--slate-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)' }}>
            <X size={13} />
          </button>
        </div>

        {/* Filtro de fechas */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--slate-200)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL}>Desde</label>
            <input type="date" className="aa-input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL}>Hasta</label>
            <input type="date" className="aa-input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <button
            onClick={buscar}
            disabled={buscando || !desde || !hasta}
            style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: 'var(--blue-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: buscando ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: buscando ? 0.7 : 1, flexShrink: 0 }}>
            <MagnifyingGlass size={14} weight="bold" />
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* Resultados */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {grupos === null && !buscando && (
            <div style={{ textAlign: 'center', color: 'var(--slate-400)', fontSize: 13, padding: '32px 0' }}>
              Selecciona un rango de fechas y presiona Buscar
            </div>
          )}
          {grupos !== null && grupos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <CheckCircle size={32} weight="duotone" style={{ color: '#10b981', marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-600)' }}>Sin duplicados en ese rango</div>
            </div>
          )}
          {grupos !== null && grupos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 4 }}>
                Se encontraron <strong style={{ color: 'var(--slate-800)' }}>{grupos.length} grupo{grupos.length !== 1 ? 's' : ''}</strong> con duplicados.
                Las marcadas con <span style={{ color: '#f97316', fontWeight: 700 }}>×</span> se eliminarán. Desmarca las que quieras conservar.
              </div>
              {grupos.map((grupo, gi) => (
                <div key={gi} style={{ border: '1px solid var(--slate-200)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Cabecera del grupo */}
                  <div style={{ padding: '8px 12px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Warning size={13} weight="fill" style={{ color: '#f97316', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#9a3412' }}>
                      {grupo[0].paciente} — {grupo[0].fecha} {grupo[0].hora}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#ea580c', background: '#ffedd5', padding: '2px 8px', borderRadius: 20 }}>
                      {grupo.length} copias
                    </span>
                  </div>
                  {/* Filas */}
                  {grupo.map((cita, ci) => {
                    const esEliminar = seleccionados.has(cita.id);
                    const esOriginal = ci === 0;
                    const tsMs = cita.createdAt?.toMillis?.();
                    const tsStr = tsMs ? new Date(tsMs).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
                    return (
                      <label key={cita.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: esOriginal ? 'default' : 'pointer', background: esEliminar ? '#fff1f2' : '#fff', borderBottom: ci < grupo.length - 1 ? '1px solid var(--slate-100)' : 'none', opacity: esOriginal ? 0.7 : 1 }}>
                        <input
                          type="checkbox"
                          checked={esEliminar}
                          disabled={esOriginal}
                          onChange={() => !esOriginal && toggleCita(cita.id)}
                          style={{ accentColor: '#f43f5e', width: 15, height: 15, flexShrink: 0, cursor: esOriginal ? 'default' : 'pointer' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {esOriginal && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 7px', borderRadius: 20, border: '1px solid #a7f3d0' }}>CONSERVAR</span>}
                            {esEliminar && <span style={{ fontSize: 10, fontWeight: 700, color: '#f43f5e', background: '#fff1f2', padding: '1px 7px', borderRadius: 20, border: '1px solid #fecdd3' }}>ELIMINAR</span>}
                            <span style={{ fontSize: 12, color: 'var(--slate-600)' }}>{cita.consultorio || '—'} · Dr. {cita.doctorAsignado || '—'} · {cita.motivo || '—'}</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>
                            Creada: {tsStr} · ID: <span style={{ fontFamily: 'monospace' }}>{cita.id.slice(0, 10)}…</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {grupos !== null && grupos.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--slate-500)', flex: 1 }}>
              {seleccionados.size} cita{seleccionados.size !== 1 ? 's' : ''} seleccionada{seleccionados.size !== 1 ? 's' : ''} para eliminar
            </span>
            <button onClick={onClose} className="aa-ghost"
              style={{ height: 36, padding: '0 16px', borderRadius: 9, border: '1px solid var(--slate-200)', background: 'var(--surface)', color: 'var(--slate-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cerrar
            </button>
            <button
              onClick={eliminar}
              disabled={seleccionados.size === 0 || eliminando}
              style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: seleccionados.size === 0 || eliminando ? 'var(--slate-200)' : '#f43f5e', color: seleccionados.size === 0 || eliminando ? 'var(--slate-400)' : '#fff', fontSize: 13, fontWeight: 700, cursor: seleccionados.size === 0 || eliminando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash size={14} weight="bold" />
              {eliminando ? 'Eliminando...' : `Eliminar ${seleccionados.size > 0 ? seleccionados.size : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES — MODAL CREAR CITA
// ═══════════════════════════════════════════════════════════════════════════

const ModalCrearCita = ({ nuevaCita, setNuevaCita, doctores, consultorios, catalogoMotivos, pacienteSugerencias, showSugerencias, onPacienteSearch, onSelectPaciente, onSave, onClose, saving }) => {
  const fld = (field, value) => setNuevaCita((prev) => ({ ...prev, [field]: value }));

  const LABEL = { fontSize: 11, fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 };

  return (
    <div className="aa-overlay aa-fade" style={{ zIndex: 950 }}>
      <div className="aa-modal aa-pop" style={{ width: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div className="aa-sora" style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={15} weight="bold" style={{ color: 'var(--blue-600)' }} />
            Nueva cita
          </div>
          <button onClick={onClose} className="aa-ghost"
            style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--slate-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)' }}>
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="aa-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'grid', gap: 14 }}>

            {/* Paciente */}
            <div style={{ position: 'relative' }}>
              <label style={LABEL}>Paciente *</label>
              <div style={{ position: 'relative' }}>
                <MagnifyingGlass size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
                <input className="aa-input" style={{ paddingLeft: 32 }}
                  value={nuevaCita.paciente}
                  onChange={(e) => onPacienteSearch(e.target.value)}
                  placeholder="Buscar paciente por nombre..."
                />
              </div>
              {showSugerencias && pacienteSugerencias.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--slate-200)', borderRadius: 9, boxShadow: '0 8px 24px rgba(15,23,42,.12)', overflow: 'hidden', marginTop: 2 }}>
                  {pacienteSugerencias.map((p) => (
                    <div key={p.id} onClick={() => onSelectPaciente(p)} className="aa-row"
                      style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--slate-100)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-800)' }}>{p.nombreCompleto}</div>
                      {p.telefonoMovil && <div style={{ fontSize: 11, color: 'var(--slate-400)' }}>{p.telefonoMovil}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fecha + Hora */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Fecha *</label>
                <input type="date" className="aa-input" value={nuevaCita.fecha} onChange={(e) => fld('fecha', e.target.value)} />
              </div>
              <div>
                <label style={LABEL}>Hora inicio *</label>
                <input type="time" className="aa-input" value={nuevaCita.hora} onChange={(e) => fld('hora', e.target.value)} />
              </div>
            </div>

            {/* Médico */}
            <div>
              <label style={LABEL}>Médico *</label>
              <select className="aa-select" style={{ width: '100%' }} value={nuevaCita.doctorUid}
                onChange={(e) => {
                  const d = doctores.find((x) => x.id === e.target.value);
                  fld('doctorUid', e.target.value);
                  fld('doctorAsignado', d?.nombre || '');
                }}>
                <option value="">Seleccionar médico...</option>
                {doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>

            {/* Consultorio */}
            <div>
              <label style={LABEL}>Consultorio *</label>
              <select className="aa-select" style={{ width: '100%' }} value={nuevaCita.consultorioId}
                onChange={(e) => {
                  const c = consultorios.find((x) => x.id === e.target.value);
                  fld('consultorioId', e.target.value);
                  fld('consultorio', c?.nombre || '');
                  fld('sucursalId', c?.sucursalId || '');
                  // Usar c.sucursal si existe; si no, buscar en el catálogo por sucursalId
                  const sucNombre = c?.sucursal || catalogoSucursales.find((s) => s.id === c?.sucursalId)?.nombre || '';
                  fld('sucursal', sucNombre);
                }}>
                <option value="">Seleccionar consultorio...</option>
                {consultorios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Motivo */}
            <div>
              <label style={LABEL}>Motivo de consulta</label>
              <select className="aa-select" style={{ width: '100%' }} value={nuevaCita.motivoId}
                onChange={(e) => {
                  const m = catalogoMotivos.find((x) => x.id === e.target.value);
                  fld('motivoId', e.target.value);
                  fld('motivo', m?.nombre || '');
                  fld('motivoPrecio', m?.precio || 0);
                }}>
                <option value="">Seleccionar motivo...</option>
                {catalogoMotivos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}{m.precio > 0 ? ` · $${m.precio.toLocaleString('es-MX')}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo + Pago */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Tipo de consulta</label>
                <select className="aa-select" style={{ width: '100%' }} value={nuevaCita.tipoConsulta} onChange={(e) => fld('tipoConsulta', e.target.value)}>
                  <option value="Primera vez">Primera vez</option>
                  <option value="Seguimiento">Seguimiento</option>
                  <option value="Urgencia">Urgencia</option>
                </select>
              </div>
              <div>
                <label style={LABEL}>Forma de pago</label>
                <select className="aa-select" style={{ width: '100%' }} value={nuevaCita.formaPago} onChange={(e) => fld('formaPago', e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="na">N/A</option>
                </select>
              </div>
            </div>

            {/* Teleconsulta */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--slate-50)', borderRadius: 8, border: '1px solid var(--slate-200)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={nuevaCita.esTeleconsulta}
                onChange={(e) => fld('esTeleconsulta', e.target.checked)}
                style={{ width: 15, height: 15, cursor: 'pointer' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--slate-700)' }}>
                <Video size={14} weight="duotone" style={{ color: '#6366f1' }} />
                Es teleconsulta
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--slate-200)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} className="aa-ghost"
            style={{ flex: 1, height: 38, borderRadius: 9, border: '1px solid var(--slate-200)', background: 'var(--surface)', color: 'var(--slate-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            style={{ flex: 1, height: 38, borderRadius: 9, border: 'none', background: saving ? 'var(--slate-200)' : 'var(--blue-600)', color: saving ? 'var(--slate-400)' : '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', transition: 'background 0.15s' }}>
            {saving ? 'Guardando...' : 'Crear cita'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — AGENDA ADMIN
// ═══════════════════════════════════════════════════════════════════════════

const AgendaAdmin = () => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'admin' || user?.rol === 'admin_maestro';

  // ── Data ──────────────────────────────────────────────────────────────
  const [citas, setCitas] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [catalogoMotivos, setCatalogoMotivos] = useState([]);
  const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [todosLosPacientes, setTodosLosPacientes] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});

  // ── UI ────────────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // Filtros
  const [filterConsultorio, setFilterConsultorio] = useState('todos');
  const [filterDoctor, setFilterDoctor] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Panels/Drawers
  const [selectedCita, setSelectedCita] = useState(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  // Modales
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [showDuplicadosModal, setShowDuplicadosModal] = useState(false);
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertTarget, setRevertTarget] = useState(null);

  // Formulario nueva cita
  const emptyForm = {
    paciente: '', pacienteId: '', pacienteTelefono: '',
    fecha: toDateStr(new Date()), hora: '', horaFin: '',
    motivo: '', motivoId: '', motivoPrecio: 0,
    doctorAsignado: '', doctorUid: '',
    consultorio: '', consultorioId: '',
    sucursal: '', sucursalId: '',
    tipoConsulta: 'Primera vez', formaPago: 'efectivo',
    esTeleconsulta: false,
  };
  const [nuevaCita, setNuevaCita] = useState(emptyForm);
  const [pacienteSugerencias, setPacienteSugerencias] = useState([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [savingCita, setSavingCita] = useState(false);

  const dateStr = useMemo(() => toDateStr(currentDate), [currentDate]);

  // ── Toast ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  }, []);

  // ── Clock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Suscripción citas ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'citas'),
      where('fechaHora', '>=', `${dateStr}T00:00`),
      where('fechaHora', '<=', `${dateStr}T23:59`),
      orderBy('fechaHora', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCitas(data);
      setSelectedCita((prev) => prev ? (data.find((c) => c.id === prev.id) || prev) : null);
      setLastUpdate(new Date());
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [dateStr]);

  // ── Suscripción doctores ──────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'users'), where('rol', 'in', ['medico', 'doctor']));
    const unsub = onSnapshot(q, (snap) => {
      setDoctores(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.activo !== false));
    }, () => {});
    return () => unsub();
  }, []);

  // ── Catálogos estáticos ───────────────────────────────────────────────
  useEffect(() => {
    getDocs(query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc')))
      .then((snap) => setConsultorios(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.activo !== false)))
      .catch(() => {});
    getDocs(query(collection(db, 'catalogo_motivos_consulta'), orderBy('nombre', 'asc')))
      .then((snap) => setCatalogoMotivos(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.activo !== false)))
      .catch(() => {});
    getDocs(query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc')))
      .then((snap) => setCatalogoSucursales(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.activo !== false)))
      .catch(() => {});
    getDocs(collection(db, 'pacientes'))
      .then((snap) => setTodosLosPacientes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const u = d.data();
          map[d.id] = u.nombre || u.nombreCompleto || u.displayName || u.email || '';
        });
        setUsuariosMap(map);
      })
      .catch(() => {});
  }, []);

  // ── KPIs (para panel de auditoría) ──────────────────────────────────
  const stats = useMemo(() => {
    const total = citas.length;
    const byEstado = (e) => citas.filter((c) => normalizeEstado(c.estado) === e).length;
    const pendientes  = byEstado('pendiente');
    const enEspera    = byEstado('en_espera');
    const enConsulta  = byEstado('en_consulta');
    const completadas = byEstado('completada');
    const canceladas  = byEstado('cancelada');
    const ingresos    = citas.filter((c) => normalizeEstado(c.estado) === 'completada')
      .reduce((acc, c) => acc + Number(c.motivoPrecio || c.motivoPrecioSnapshot || 0), 0);
    const tasaCierre  = total > 0 ? Math.round((completadas / total) * 100) : 0;
    return { total, pendientes, enEspera, enConsulta, completadas, canceladas, ingresos, tasaCierre };
  }, [citas]);

  // ── Filtrado ──────────────────────────────────────────────────────────
  const citasFiltradas = useMemo(() => {
    let r = [...citas];
    if (filterConsultorio !== 'todos') r = r.filter((c) => c.consultorioId === filterConsultorio || c.consultorio === filterConsultorio);
    if (filterDoctor !== 'todos') r = r.filter((c) => c.doctorUid === filterDoctor);
    if (filterEstado !== 'todos') r = r.filter((c) => normalizeEstado(c.estado) === filterEstado);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      r = r.filter((c) =>
        (c.paciente || '').toLowerCase().includes(q) ||
        (c.doctorAsignado || '').toLowerCase().includes(q) ||
        (c.motivo || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [citas, filterConsultorio, filterDoctor, filterEstado, searchQuery]);

  const statsFiltrados = useMemo(() => {
    const total = citasFiltradas.length;
    const byEstado = (e) => citasFiltradas.filter((c) => normalizeEstado(c.estado) === e).length;
    return {
      total,
      pendientes: byEstado('pendiente'),
      enEspera: byEstado('en_espera'),
      enConsulta: byEstado('en_consulta'),
      completadas: byEstado('completada'),
      canceladas: byEstado('cancelada'),
    };
  }, [citasFiltradas]);

  // ── Acciones ──────────────────────────────────────────────────────────
  const handleUpdateEstado = useCallback(async (citaId, nuevoEstado, extra = {}) => {
    setActionLoading(citaId);
    try {
      const updates = {
        estado: nuevoEstado,
        adminModificadoPor: user?.nombre || 'Admin',
        adminModificadoPorUid: user?.uid || '',
        adminModificadoAt: serverTimestamp(),
        ...extra,
      };
      if (nuevoEstado === 'en_espera')   updates.llegadaAt = serverTimestamp();
      if (nuevoEstado === 'en_consulta') updates.inicioConsultaAt = serverTimestamp();
      if (nuevoEstado === 'completada')  updates.completadaAt = serverTimestamp();
      await updateDoc(doc(db, 'citas', citaId), updates);
      showToast(`Estado actualizado: ${getStatus(nuevoEstado).label}`);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar estado', 'error');
    }
    setActionLoading('');
  }, [user, showToast]);

  const handleCancel = useCallback(async () => {
    if (!cancelTarget || !cancelMotivo.trim()) return;
    setActionLoading(cancelTarget.id);
    try {
      await updateDoc(doc(db, 'citas', cancelTarget.id), {
        estado: 'cancelada',
        canceladaMotivo: cancelMotivo.trim(),
        canceladaAt: serverTimestamp(),
        canceladaPor: user?.nombre || 'Admin',
        canceladaPorUid: user?.uid || '',
        adminModificadoPor: user?.nombre || 'Admin',
        adminModificadoPorUid: user?.uid || '',
        adminModificadoAt: serverTimestamp(),
      });
      showToast('Cita cancelada correctamente');
      setShowCancelarModal(false);
      setCancelTarget(null);
      setCancelMotivo('');
      if (selectedCita?.id === cancelTarget.id) setSelectedCita(null);
    } catch (err) {
      showToast('Error al cancelar', 'error');
    }
    setActionLoading('');
  }, [cancelTarget, cancelMotivo, user, showToast, selectedCita]);

  const handleRevertCancel = useCallback(async () => {
    if (!revertTarget) return;
    setActionLoading(revertTarget.id);
    try {
      const estadoPrevio = estadoPrevioACancelacion(revertTarget);
      await updateDoc(doc(db, 'citas', revertTarget.id), {
        estado: estadoPrevio,
        canceladaAt: deleteField(),
        canceladaMotivo: deleteField(),
        canceladaPor: deleteField(),
        canceladaPorNombre: deleteField(),
        canceladaPorUid: deleteField(),
        adminModificadoPor: user?.nombre || 'Admin',
        adminModificadoPorUid: user?.uid || '',
        adminModificadoAt: serverTimestamp(),
      });
      showToast(`Cancelación revertida · ${getStatus(estadoPrevio).label}`);
      setShowRevertModal(false);
      setRevertTarget(null);
    } catch (err) {
      console.error(err);
      showToast('Error al revertir la cancelación', 'error');
    }
    setActionLoading('');
  }, [revertTarget, user, showToast]);

  const openRevertModal = useCallback((cita) => {
    setRevertTarget(cita);
    setShowRevertModal(true);
  }, []);

  const handlePacienteSearch = useCallback((q) => {
    setNuevaCita((prev) => ({ ...prev, paciente: q, pacienteId: '', pacienteTelefono: '' }));
    if (!q.trim()) { setPacienteSugerencias([]); setShowSugerencias(false); return; }
    const lower = q.toLowerCase().trim();
    const results = todosLosPacientes.filter((p) => (p.nombreCompleto || '').toLowerCase().includes(lower)).slice(0, 6);
    setPacienteSugerencias(results);
    setShowSugerencias(results.length > 0);
  }, [todosLosPacientes]);

  const handleSelectPaciente = useCallback((p) => {
    setNuevaCita((prev) => ({ ...prev, paciente: p.nombreCompleto || '', pacienteId: p.id || '', pacienteTelefono: p.telefonoMovil || '' }));
    setPacienteSugerencias([]);
    setShowSugerencias(false);
  }, []);

  const handleSaveCita = useCallback(async () => {
    if (!nuevaCita.paciente || !nuevaCita.hora || !nuevaCita.doctorAsignado || !nuevaCita.consultorio) {
      showToast('Completa: paciente, hora, médico y consultorio', 'error');
      return;
    }
    setSavingCita(true);
    try {
      const mot = catalogoMotivos.find((m) => m.id === nuevaCita.motivoId);
      const cons = consultorios.find((c) => c.id === nuevaCita.consultorioId);
      const [h, m] = nuevaCita.hora.split(':').map(Number);
      const endMin = m + 30;
      const horaFin = nuevaCita.horaFin || `${String(h + Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      await addDoc(collection(db, 'citas'), {
        paciente: nuevaCita.paciente,
        pacienteId: nuevaCita.pacienteId,
        pacienteTelefono: nuevaCita.pacienteTelefono,
        fecha: nuevaCita.fecha,
        hora: nuevaCita.hora,
        horaFin,
        fechaHora: `${nuevaCita.fecha}T${nuevaCita.hora}`,
        fechaHoraFin: `${nuevaCita.fecha}T${horaFin}`,
        motivo: mot?.nombre || nuevaCita.motivo,
        motivoId: nuevaCita.motivoId,
        motivoPrecio: mot?.precio || 0,
        doctorAsignado: nuevaCita.doctorAsignado,
        doctorUid: nuevaCita.doctorUid,
        consultorio: cons?.nombre || nuevaCita.consultorio,
        consultorioId: nuevaCita.consultorioId,
        sucursal: cons?.sucursal || catalogoSucursales.find((s) => s.id === cons?.sucursalId)?.nombre || '',
        sucursalId: cons?.sucursalId || '',
        estado: 'pendiente',
        tipoConsulta: nuevaCita.tipoConsulta,
        formaPago: nuevaCita.formaPago,
        esTeleconsulta: nuevaCita.esTeleconsulta,
        areaConsulta: mot?.area || '',
        creadoPor: user?.uid || '',
        creadoPorRol: user?.rol || 'admin',
        creadoPorNombre: user?.nombre || 'Admin',
        createdAt: serverTimestamp(),
        llegadaRegistrada: false,
      });
      showToast('Cita creada correctamente');
      setShowCrearModal(false);
      setNuevaCita(emptyForm);
    } catch (err) {
      console.error(err);
      showToast('Error al crear cita', 'error');
    }
    setSavingCita(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevaCita, catalogoMotivos, consultorios, catalogoSucursales, user, showToast]);

  const openCancelModal = useCallback((cita) => {
    setCancelTarget(cita);
    setCancelMotivo('');
    setShowCancelarModal(true);
  }, []);

  // Navegación de fechas
  const prevDay = () => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  const nextDay = () => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
  const goToday = () => setCurrentDate(new Date());
  const isToday = dateStr === toDateStr(new Date());

  // ── RENDER ────────────────────────────────────────────────────────────
  const VIEWS = [
    { id: 'list',     label: 'Lista',    Icon: List },
    { id: 'timeline', label: 'Timeline', Icon: Rows },
  ];

  const ESTADOS_FILTRO = [
    { id: 'todos',       label: 'Todos' },
    { id: 'pendiente',   label: 'Pendiente' },
    { id: 'en_espera',   label: 'En espera' },
    { id: 'en_consulta', label: 'En consulta' },
    { id: 'completada',  label: 'Completada' },
    { id: 'cancelada',   label: 'Cancelada' },
  ];

  const SUMMARY_PILLS = [
    { label: 'Pendientes',  count: statsFiltrados.pendientes,  color: '#475569', bg: '#f1f5f9', dot: '#94a3b8' },
    { label: 'En espera',   count: statsFiltrados.enEspera,    color: '#92400e', bg: '#fffbeb', dot: '#f59e0b' },
    { label: 'En consulta', count: statsFiltrados.enConsulta,  color: '#1e40af', bg: '#eff6ff', dot: '#3b82f6' },
    { label: 'Completadas', count: statsFiltrados.completadas, color: '#065f46', bg: '#ecfdf5', dot: '#10b981' },
    { label: 'Canceladas',  count: statsFiltrados.canceladas,  color: '#9f1239', bg: '#fff1f2', dot: '#f43f5e' },
  ];

  return (
    <div className="aa-root" style={{ background: '#f4f7f9', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{STYLES}</style>

      {/* ── Toast ── */}
      {toast.show && (
        <div className="aa-toast" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
          border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`,
          color: toast.type === 'error' ? '#991b1b' : '#14532d',
          padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 16px rgba(15,23,42,.12)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--slate-200)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0 }}>

        {/* Navegación de fecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevDay} className="aa-ghost"
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-600)' }}>
            <CaretLeft size={14} weight="bold" />
          </button>
          <div style={{ textAlign: 'center', minWidth: 180 }}>
            <div className="aa-sora" style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate-900)', textTransform: 'capitalize' }}>
              {currentDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 500 }}>{isToday ? 'Hoy' : dateStr}</div>
          </div>
          <button onClick={nextDay} className="aa-ghost"
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--slate-200)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-600)' }}>
            <CaretRight size={14} weight="bold" />
          </button>
          {!isToday && (
            <button onClick={goToday} style={{ height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Hoy
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Indicador en tiempo real */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--slate-400)', fontSize: 11 }}>
          <span className="aa-pulse-ring" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          En tiempo real · {lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>

        {/* Selector de vista */}
        <div style={{ display: 'flex', background: 'var(--slate-100)', borderRadius: 10, padding: 3, gap: 2 }}>
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id}
              onClick={() => setView(id)}
              className={`aa-view-btn${view === id ? ' active' : ''}`}
              style={{
                height: 30, padding: '0 12px', borderRadius: 7, border: 'none',
                background: view === id ? 'var(--surface)' : 'transparent',
                color: view === id ? 'var(--blue-600)' : 'var(--slate-500)',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <Icon size={13} weight={view === id ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}
        </div>

        {/* Toggle auditoría */}
        <button onClick={() => setShowAuditPanel((p) => !p)} style={{
          height: 36, padding: '0 14px', borderRadius: 9,
          border: `1px solid ${showAuditPanel ? '#bfdbfe' : 'var(--slate-200)'}`,
          background: showAuditPanel ? '#eff6ff' : 'var(--surface)',
          color: showAuditPanel ? '#1d4ed8' : 'var(--slate-600)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s'
        }}>
          <ClipboardText size={14} weight={showAuditPanel ? 'fill' : 'regular'} />
          Auditoría
        </button>

        {/* Detectar duplicados */}
        <button onClick={() => setShowDuplicadosModal(true)} style={{
          height: 36, padding: '0 14px', borderRadius: 9,
          border: '1px solid #fed7aa', background: '#fff7ed',
          color: '#ea580c', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7
        }}>
          <Warning size={14} weight="fill" />
          Duplicados
        </button>

        {/* Nueva cita */}
        <button onClick={() => setShowCrearModal(true)} style={{
          height: 36, padding: '0 16px', borderRadius: 9,
          border: 'none', background: 'var(--blue-600)', color: '#fff',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7
        }}>
          <Plus size={14} weight="bold" />
          Nueva cita
        </button>
      </div>

      {/* ── BARRA DE CONTEXTO: resumen + filtros ─────────────────────── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--slate-200)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>

        {/* Mini resumen contextual */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {SUMMARY_PILLS.map((pill) => (
            <button
              key={pill.label}
              onClick={() => setFilterEstado(filterEstado === pill.label.toLowerCase().replace(' ', '_') ? 'todos' : pill.label.toLowerCase().replace(' ', '_').replace('pendientes', 'pendiente').replace('completadas', 'completada').replace('canceladas', 'cancelada'))}
              className="aa-filter-pill"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 26, padding: '0 10px', borderRadius: 20,
                border: `1px solid ${filterEstado === pill.label.toLowerCase().replace(' ', '_').replace('pendientes', 'pendiente').replace('completadas', 'completada').replace('canceladas', 'cancelada') ? pill.dot : 'var(--slate-200)'}`,
                background: filterEstado === pill.label.toLowerCase().replace(' ', '_').replace('pendientes', 'pendiente').replace('completadas', 'completada').replace('canceladas', 'cancelada') ? pill.bg : 'var(--surface)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                color: pill.count > 0 ? pill.color : 'var(--slate-400)',
              }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: pill.dot, flexShrink: 0 }} />
              {pill.label}
              <span style={{ fontWeight: 800, opacity: 0.75 }}>{pill.count}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Búsqueda */}
        <div style={{ position: 'relative', width: 200 }}>
          <MagnifyingGlass size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
          <input className="aa-input" style={{ paddingLeft: 30, height: 32, fontSize: 12 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar paciente o médico..."
          />
        </div>

        {/* Consultorio */}
        <select className="aa-select" style={{ height: 32, fontSize: 12 }} value={filterConsultorio} onChange={(e) => setFilterConsultorio(e.target.value)}>
          <option value="todos">Todos los consultorios</option>
          {consultorios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        {/* Doctor */}
        <select className="aa-select" style={{ height: 32, fontSize: 12 }} value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
          <option value="todos">Todos los médicos</option>
          {doctores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>

        {/* Reset filtros */}
        {(filterConsultorio !== 'todos' || filterDoctor !== 'todos' || filterEstado !== 'todos' || searchQuery) && (
          <button onClick={() => { setFilterConsultorio('todos'); setFilterDoctor('todos'); setFilterEstado('todos'); setSearchQuery(''); }}
            style={{ height: 28, padding: '0 10px', borderRadius: 20, border: '1px solid var(--slate-200)', background: 'var(--surface)', color: 'var(--slate-400)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={11} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* ── ÁREA DE CONTENIDO ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Vista principal */}
        <div className="aa-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
              <div className="aa-spinner" style={{ width: 36, height: 36 }} />
            </div>
          ) : (
            <>
              {view === 'timeline' && (
                <VistaTimeline
                  citas={citasFiltradas}
                  consultorios={consultorios}
                  currentTime={currentTime}
                  onSelect={setSelectedCita}
                />
              )}
              {view === 'list' && (
                <VistaLista
                  citas={citasFiltradas}
                  onSelect={setSelectedCita}
                  onCancelOpen={openCancelModal}
                  actionLoading={actionLoading}
                />
              )}
            </>
          )}
        </div>

        {/* Panel de auditoría */}
        {showAuditPanel && (
          <div style={{ width: 340, borderLeft: '1px solid var(--slate-200)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
            <AuditPanel citas={citas} stats={stats} usuariosMap={usuariosMap} onClose={() => setShowAuditPanel(false)} />
          </div>
        )}
      </div>

      {/* ── DETALLE DE CITA (DRAWER) ──────────────────────────────────── */}
      {selectedCita && (
        <DetalleCitaDrawer
          cita={selectedCita}
          onClose={() => setSelectedCita(null)}
          onUpdateEstado={handleUpdateEstado}
          onCancelOpen={openCancelModal}
          onRevert={openRevertModal}
          canRevert={isAdmin}
          usuariosMap={usuariosMap}
          actionLoading={actionLoading}
          currentTime={currentTime}
        />
      )}

      {/* ── MODAL DUPLICADOS ──────────────────────────────────────────── */}
      {showDuplicadosModal && (
        <ModalDuplicados
          onClose={() => setShowDuplicadosModal(false)}
          showToast={showToast}
        />
      )}

      {/* ── MODAL CANCELAR ────────────────────────────────────────────── */}
      {showCancelarModal && (
        <ModalCancelar
          cita={cancelTarget}
          motivo={cancelMotivo}
          onMotivoChange={setCancelMotivo}
          onConfirm={handleCancel}
          onClose={() => { setShowCancelarModal(false); setCancelTarget(null); setCancelMotivo(''); }}
          loading={actionLoading === cancelTarget?.id}
        />
      )}

      {/* ── MODAL REVERTIR CANCELACIÓN ────────────────────────────────── */}
      {showRevertModal && (
        <ModalRevertir
          cita={revertTarget}
          onConfirm={handleRevertCancel}
          onClose={() => { setShowRevertModal(false); setRevertTarget(null); }}
          loading={actionLoading === revertTarget?.id}
        />
      )}

      {/* ── MODAL CREAR CITA ──────────────────────────────────────────── */}
      {showCrearModal && (
        <ModalCrearCita
          nuevaCita={nuevaCita}
          setNuevaCita={setNuevaCita}
          doctores={doctores}
          consultorios={consultorios}
          catalogoMotivos={catalogoMotivos}
          pacienteSugerencias={pacienteSugerencias}
          showSugerencias={showSugerencias}
          onPacienteSearch={handlePacienteSearch}
          onSelectPaciente={handleSelectPaciente}
          onSave={handleSaveCita}
          onClose={() => { setShowCrearModal(false); setNuevaCita(emptyForm); }}
          saving={savingCita}
        />
      )}
    </div>
  );
};

export default AgendaAdmin;
