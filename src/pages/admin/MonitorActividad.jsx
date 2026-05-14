// src/pages/admin/MonitorActividad.jsx

import React, { useState, useMemo, useCallback } from 'react';
import {
  Download, ChevronLeft, ChevronRight, Search, X,
  Clock, AlertCircle, ChevronDown, ChevronUp,
  Stethoscope, Heart, ShieldCheck, ArrowRightLeft, BarChart2,
  FileDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { pdf } from '@react-pdf/renderer';
import { useMonitorData, fmtMinutes, timeAgo } from '../../hooks/useMonitorData';
import InformeMonitorPDF from '../../components/pdf/InformeMonitorPDF';

// ─── Constantes de color ──────────────────────────────────────────────────────

const C = {
  emerald:  '#10b981',
  blue:     '#3b82f6',
  amber:    '#f59e0b',
  rose:     '#f43f5e',
  slate:    '#cbd5e1',
  indigo:   '#6366f1',
  violet:   '#7c3aed',
  orange:   '#f97316',
  teal:     '#14b8a6',
  sky:      '#0ea5e9',
};

const ESTADO_COLOR = {
  completada: C.emerald, finalizada: C.emerald, atendida: C.emerald,
  en_consulta: C.blue,
  en_espera: C.amber, en_triage: C.amber,
  cancelada: C.rose, no_asistio: C.rose,
  programada: C.slate,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmt$ = (n) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(Number(n || 0));

const normalizeEstado = (value = '') => String(value || '').toLowerCase().trim();

const ESTADOS_REALIZADAS = new Set(['completada', 'finalizada', 'atendida']);
const ESTADOS_CANCELADAS = new Set(['cancelada', 'no_asistio']);

const isRealizadaEstado = (estado) => ESTADOS_REALIZADAS.has(normalizeEstado(estado));
const isCanceladaEstado = (estado) => ESTADOS_CANCELADAS.has(normalizeEstado(estado));

const toNumberSafe = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getIngreso = (cita) =>
  toNumberSafe(cita?.ingreso ?? cita?.motivoPrecioSnapshot ?? cita?.motivoPrecio ?? 0);

const fmtHora = (v) => {
  if (!v) return '—';
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? '—' : d.toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });
};

const INITIALS = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const shortName = (name = '', words = 2) =>
  name.split(' ').slice(0, words).join(' ');

const ROL_LABELS = {
  medico: 'Médico', enfermeria: 'Enfermería', jefa_enfermeria: 'Jefa Enf.',
  admin: 'Admin', admin_maestro: 'Admin Maestro', administrador: 'Administrador',
  recepcion: 'Recepción', rh: 'RH', operativo: 'Operativo', intendencia: 'Intendencia',
};
const getRolLabel = (rol) => ROL_LABELS[rol] || String(rol || '').replace(/_/g, ' ');

// ─── Navegación de fecha ──────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function downloadCSV(rows, cols, filename) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body = rows.map(r =>
    cols.map(c => {
      const v = c.get(r);
      if (v == null) return '';
      if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
      return v;
    }).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

const sortData = (arr, key, dir) => {
  if (!key) return arr;
  return [...arr].sort((a, b) => {
    const va = a[key] ?? (typeof a[key] === 'string' ? '' : -Infinity);
    const vb = b[key] ?? (typeof b[key] === 'string' ? '' : -Infinity);
    if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es');
    return dir === 'asc' ? va - vb : vb - va;
  });
};

// ─── Status ───────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  en_consulta: { label: 'En consulta', dot: 'bg-blue-500',    txt: 'text-blue-700'   },
  ocupado:     { label: 'Ocupado',     dot: 'bg-amber-500',   txt: 'text-amber-700'  },
  comida:      { label: 'Comida',      dot: 'bg-orange-400',  txt: 'text-orange-700' },
  activo:      { label: 'Activo',      dot: 'bg-emerald-500', txt: 'text-emerald-700'},
  offline:     { label: 'Offline',     dot: 'bg-slate-300',   txt: 'text-slate-400'  },
};
const getStatus = (s, online) => !online ? STATUS_MAP.offline : (STATUS_MAP[s] || STATUS_MAP.activo);

// ─── Shared table atoms ───────────────────────────────────────────────────────

function SortTH({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap border-b border-slate-100 transition-colors ${className} ${
        active ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/70'
      }`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active ? sort.dir === 'asc' ? <ChevronUp size={9}/> : <ChevronDown size={9}/> : null}
      </span>
    </th>
  );
}

function MiniBar({ value }) {
  if (value == null) return <span className="text-slate-300 text-xs tabular-nums">—</span>;
  const pct = Math.min(100, value);
  const bar = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  const txt = pct >= 75 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-rose-600';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums ${txt}`}>{value}%</span>
    </div>
  );
}

function ScoreCell({ score }) {
  const cls = score >= 80
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : score >= 40 ? 'text-blue-700 bg-blue-50 border-blue-200'
    : score >= 15 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-rose-700 bg-rose-50 border-rose-200';
  return <span className={`inline-flex px-1.5 py-0.5 rounded border text-xs font-bold tabular-nums ${cls}`}>{score}</span>;
}

function EmptyRow({ cols, msg = 'Sin datos.' }) {
  return (
    <tr><td colSpan={cols} className="py-12 text-center">
      <AlertCircle size={18} className="mx-auto mb-1.5 text-slate-200" />
      <p className="text-xs text-slate-400">{msg}</p>
    </td></tr>
  );
}

function StatusCell({ statusOperativo, online }) {
  const { label, dot, txt } = getStatus(statusOperativo, online);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${txt}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot} ${online ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

function AvatarCell({ name, sub, color = 'bg-blue-50 text-blue-700' }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${color}`}>
        {INITIALS(name)}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-slate-800 leading-tight">{name}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function N({ v, color = 'text-slate-700' }) {
  if (!v) return <span className="text-slate-200 text-xs">—</span>;
  return <span className={`text-sm font-bold tabular-nums ${color}`}>{v}</span>;
}

function FilterBar({ search, onSearch, placeholder, sucursal, onSucursal, sucursales, extra, count, label, onExport }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder}
          className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white w-48 focus:outline-none focus:ring-1 focus:ring-blue-300" />
      </div>
      <select value={sucursal} onChange={e => onSucursal(e.target.value)}
        className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none">
        <option value="todas">Todas las sucursales</option>
        {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {extra}
      <span className="text-[11px] text-slate-400">{count} {label}</span>
      <button onClick={onExport}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors">
        <Download size={11} /> Exportar CSV
      </button>
    </div>
  );
}

// ─── Dashboard: shared chart primitives ──────────────────────────────────────

function ChartCard({ title, sub, children, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 ${className}`}>
      <p className="text-[13px] font-semibold text-slate-800 leading-tight">{title}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 mb-3">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  );
}

function CustomTip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-xs min-w-[110px]">
      {label && <p className="font-semibold text-slate-600 mb-1.5 border-b border-slate-100 pb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill || p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums text-slate-800">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// Donut con label centrado usando overlay absoluto
function DonutChart({ data, total, centerLabel, height = 190 }) {
  if (!data.length) return (
    <div style={{ height }} className="flex items-center justify-center text-slate-300 text-sm">
      Sin datos
    </div>
  );
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%"
            innerRadius="55%" outerRadius="78%"
            dataKey="value" paddingAngle={2} strokeWidth={0}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <RechartsTip content={<CustomTip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-[24px] font-bold text-slate-800 tabular-nums leading-none">{total}</p>
          <p className="text-[10px] text-slate-400 mt-1">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
      {items.map(d => (
        <span key={d.name} className="flex items-center gap-1 text-[11px] text-slate-600">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
          {d.name}
          {d.value != null && <span className="font-bold tabular-nums ml-0.5">{d.value}</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Badge helpers (used in DoctorDetailPanel) ───────────────────────────────

function TypeBadge({ tipo, esTeleconsulta }) {
  if (esTeleconsulta)         return <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-semibold">Teleconsulta</span>;
  if (tipo === 'primera_vez') return <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">1ª vez</span>;
  if (tipo === 'subsecuente') return <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">Subsec.</span>;
  if (tipo === 'urgencia')    return <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-semibold">Urgencia</span>;
  return <span className="text-[10px] text-slate-300">—</span>;
}

function EstadoBadge({ estado }) {
  const MAP = {
    completada:  { label: 'Realizada',   cls: 'bg-emerald-50 text-emerald-700' },
    finalizada:  { label: 'Realizada',   cls: 'bg-emerald-50 text-emerald-700' },
    atendida:    { label: 'Realizada',   cls: 'bg-emerald-50 text-emerald-700' },
    en_consulta: { label: 'En consulta', cls: 'bg-blue-50 text-blue-700'       },
    en_espera:   { label: 'En espera',   cls: 'bg-amber-50 text-amber-700'     },
    en_triage:   { label: 'En triage',   cls: 'bg-amber-50 text-amber-700'     },
    cancelada:   { label: 'Cancelada',   cls: 'bg-rose-50 text-rose-700'       },
    no_asistio:  { label: 'No asistió',  cls: 'bg-rose-50 text-rose-700'       },
    programada:  { label: 'Programada',  cls: 'bg-slate-100 text-slate-600'    },
  };
  const { label, cls } = MAP[estado] || { label: String(estado || '—'), cls: 'bg-slate-100 text-slate-500' };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${cls}`}>{label}</span>;
}

function FormaPagoBadge({ pago }) {
  if (pago === 'efectivo') return <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Efectivo</span>;
  if (pago === 'tarjeta')  return <span className="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded font-semibold">Tarjeta</span>;
  return <span className="text-slate-300 text-xs">—</span>;
}

// ─── Doctor detail panel ──────────────────────────────────────────────────────

function DoctorDetailPanel({ doctor, citas, onClose }) {
  const sorted = useMemo(() =>
    [...citas].sort((a, b) =>
      (a.hora || a.horaInicio || '').localeCompare(b.hora || b.horaInicio || '')
    ),
  [citas]);

  const metricItems = [
    { label: 'Asignadas',    v: doctor.asignadas,    color: 'text-slate-700'   },
    { label: 'Realizadas',   v: doctor.realizadas,   color: 'text-emerald-700' },
    { label: 'En consulta',  v: doctor.enConsulta,   color: 'text-blue-700'    },
    { label: 'Canceladas',   v: doctor.canceladas,   color: 'text-rose-600'    },
    {
      label: 'Cumplimiento',
      v: doctor.tasaCumplimiento != null ? `${doctor.tasaCumplimiento}%` : '—',
      color: doctor.tasaCumplimiento >= 75 ? 'text-emerald-700'
           : doctor.tasaCumplimiento >= 50 ? 'text-amber-600'
           : 'text-rose-600',
    },
    { label: 'Ingresos',  v: fmt$(doctor.ingresos),          color: 'text-violet-700' },
    { label: 'At./hora',  v: doctor.atencionesPorHora ?? '—', color: 'text-slate-600'  },
    { label: 'Score',     v: doctor.score,                    color: 'text-blue-700'   },
  ];

  return (
    <div className="bg-white border-2 border-blue-100 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50/40 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0">
            {INITIALS(doctor.nombre)}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-[15px] leading-tight">{doctor.nombre}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <StatusCell statusOperativo={doctor.statusOperativo} online={doctor.online} />
              {doctor.consultorio !== '—' && <span className="text-[11px] text-slate-400">· {doctor.consultorio}</span>}
              {doctor.sucursal    !== '—' && <span className="text-[11px] text-slate-400">· {doctor.sucursal}</span>}
              {doctor.tiempoConectado !== '—' && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock size={9} className="text-slate-300" />{doctor.tiempoConectado}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose}
          className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700">
          <X size={14} />
        </button>
      </div>

      {/* Metric strip */}
      <div className="flex overflow-x-auto divide-x divide-slate-100 border-b border-slate-100">
        {metricItems.map((m, i) => (
          <div key={i} className="px-3 py-2.5 flex flex-col gap-0.5 shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{m.label}</span>
            <span className={`text-[14px] font-bold tabular-nums leading-tight ${m.color}`}>{m.v ?? '—'}</span>
          </div>
        ))}
      </div>

      {/* Citas table */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {['Hora','Paciente','Tipo','Estado','Consultorio','Ingreso','Pago','Motivo cancelación'].map((h, i) => (
                <th key={i} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.length === 0 && <EmptyRow cols={8} msg="Sin citas para este médico en este día." />}
            {sorted.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2 text-[12px] text-slate-600 tabular-nums font-medium whitespace-nowrap">
                  {c.hora || c.horaInicio || (c.fechaHora ? String(c.fechaHora).slice(11, 16) : '—')}
                </td>
                <td className="px-3 py-2 text-[12px] text-slate-800 font-medium max-w-[160px] truncate">
                  {c.pacienteNombre || c.nombrePaciente || c.paciente || c.nombre || '—'}
                </td>
                <td className="px-3 py-2">
                  <TypeBadge tipo={c.tipoConsulta} esTeleconsulta={c.esTeleconsulta} />
                </td>
                <td className="px-3 py-2">
                  <EstadoBadge estado={c.estado} />
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                  {c.consultorioNombre || c.consultorio || '—'}
                </td>
                <td className="px-3 py-2 text-[12px] font-semibold text-violet-700 tabular-nums whitespace-nowrap">
                  {c.ingreso > 0 ? fmt$(c.ingreso) : <span className="text-slate-200 font-normal text-xs">—</span>}
                </td>
                <td className="px-3 py-2">
                  <FormaPagoBadge pago={c.formaPago} />
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-400 max-w-[180px] truncate">
                  {c.canceladaMotivo || <span className="text-slate-200">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard({ medicos, enfermeria, adminStaff, citas, movimientos, triajes, notas, ordenes, kpis, isToday, fSucursal, onFSucursal, selectedDate }) {
  // ── Filtros ──
  const [fMedico, setFMedico] = useState('all');
  const [fConsultorio, setFConsultorio] = useState('all');
  const [exportando, setExportando] = useState(false);
  const [detailUid, setDetailUid] = useState(null);

  // Opciones de filtro derivadas de citas
  const sucursalesOpts = useMemo(() => {
    const s = new Set();
    citas.forEach(c => { const v = c.sucursal; if (v) s.add(v); });
    return [...s].sort();
  }, [citas]);

  const consultoriosOpts = useMemo(() => {
    const s = new Set();
    citas.forEach(c => { const v = c.consultorioNombre || c.consultorio; if (v && v !== '—') s.add(v); });
    return [...s].sort();
  }, [citas]);

  const hasFilter = fMedico !== 'all' || fSucursal !== 'all' || fConsultorio !== 'all';

  // Datos filtrados
  const citasFilt = useMemo(() => {
    let d = citas;
    if (fSucursal !== 'all')     d = d.filter(c => c.sucursal === fSucursal);
    if (fConsultorio !== 'all')  d = d.filter(c => (c.consultorioNombre || c.consultorio) === fConsultorio);
    if (fMedico !== 'all')       d = d.filter(c => c.doctorUid === fMedico);
    return d;
  }, [citas, fMedico, fSucursal, fConsultorio]);

  const medicosFilt = useMemo(() => {
    const uids = new Set(citasFilt.map(c => c.doctorUid).filter(Boolean));
    return uids.size ? medicos.filter(m => uids.has(m.uid)) : medicos;
  }, [medicos, citasFilt]);

  // Recalcular métricas de médicos usando SOLO citasFilt (corrige Bug #3)
  const medicosFiltMetrics = useMemo(() =>
    medicosFilt.map(m => {
      const misCitas = citasFilt.filter(c => c.doctorUid === m.uid);
      const r = misCitas.filter(c => isRealizadaEstado(c.estado));
      const canc = misCitas.filter(c => isCanceladaEstado(c.estado));
      const ing = r.reduce((s, c) => s + getIngreso(c), 0);
      const tasa = misCitas.length > 0 ? Math.round((r.length / misCitas.length) * 100) : null;
      return { ...m, realF: r.length, asigF: misCitas.length, cancF: canc.length, ingrF: ing, tasaF: tasa };
    }),
  [medicosFilt, citasFilt]);

  const enfFilt = useMemo(() => {
    // Enfermería se filtra por sucursal/consultorio, no por citas (evita omitir actividad real).
    let d = enfermeria;
    if (fSucursal !== 'all') d = d.filter(e => e.sucursal === fSucursal);
    if (fConsultorio !== 'all') d = d.filter(e => (e.consultorioNombre || e.consultorio) === fConsultorio);
    return d;
  }, [enfermeria, fSucursal, fConsultorio]);

  const kpisExport = useMemo(() => {
    const realizadas = citasFilt.filter(c => isRealizadaEstado(c.estado));
    const canceladas = citasFilt.filter(c => isCanceladaEstado(c.estado));
    const ingresoTotal = realizadas.reduce((s, c) => s + getIngreso(c), 0);
    const docs = medicosFiltMetrics.filter(m => (m.asigF ?? 0) > 0);
    const eficienciaPromedio = docs.length > 0
      ? Math.round(docs.reduce((s, m) => s + (m.tasaF ?? 0), 0) / docs.length)
      : 0;
    return {
      totalCitas: citasFilt.length,
      citasRealizadas: realizadas.length,
      citasCanceladas: canceladas.length,
      citasEnCurso: citasFilt.filter(c => normalizeEstado(c.estado) === 'en_consulta').length,
      ingresoTotal,
      eficienciaPromedio,
      totalTriajes: kpis.totalTriajes ?? 0,
      totalRotaciones: kpis.totalRotaciones ?? 0,
    };
  }, [citasFilt, medicosFiltMetrics, kpis]);

  // Doctor para el detail panel
  const detailDoctor = useMemo(() =>
    detailUid ? medicos.find(m => m.uid === detailUid) : null,
  [detailUid, medicos]);
  const detailCitas = useMemo(() =>
    detailDoctor ? citas.filter(c => c.doctorUid === detailDoctor.uid) : [],
  [detailDoctor, citas]);

  // ── Charts (usando datos filtrados) ──

  // 1. Estado de citas
  const estadoData = useMemo(() => {
    const g = {
      Realizadas:  { color: C.emerald, count: 0 },
      'En consulta': { color: C.blue,   count: 0 },
      'En espera':   { color: C.amber,  count: 0 },
      Programadas: { color: C.slate,   count: 0 },
      Canceladas:  { color: C.rose,    count: 0 },
    };
    citasFilt.forEach(c => {
      const estado = normalizeEstado(c.estado);
      if (isRealizadaEstado(estado)) g['Realizadas'].count++;
      else if (estado === 'en_consulta') g['En consulta'].count++;
      else if (estado === 'en_espera' || estado === 'en_triage') g['En espera'].count++;
      else if (isCanceladaEstado(estado)) g['Canceladas'].count++;
      else g['Programadas'].count++;
    });
    return Object.entries(g).filter(([,v]) => v.count > 0).map(([name, v]) => ({ name, value: v.count, color: v.color }));
  }, [citasFilt]);

  // 2. Tipos de consulta
  const tiposData = useMemo(() => {
    const g = { 'Primera vez': 0, Subsecuente: 0, Urgencia: 0, Teleconsulta: 0 };
    citasFilt.forEach(c => {
      if (c.esTeleconsulta)                     g['Teleconsulta']++;
      else if (c.tipoConsulta === 'primera_vez') g['Primera vez']++;
      else if (c.tipoConsulta === 'subsecuente') g['Subsecuente']++;
      else if (c.tipoConsulta === 'urgencia')    g['Urgencia']++;
    });
    const colors = { 'Primera vez': C.blue, Subsecuente: C.indigo, Urgencia: C.rose, Teleconsulta: C.violet };
    return Object.entries(g).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value, color: colors[name] }));
  }, [citasFilt]);

  // 3. Flujo por hora
  const flujoPorHora = useMemo(() => {
    const horas = {};
    for (let h = 7; h <= 21; h++) horas[h] = { hora: `${String(h).padStart(2,'0')}h`, realizadas: 0, canceladas: 0, otras: 0 };
    citasFilt.forEach(c => {
      const raw = c.hora || (c.fechaHora ? String(c.fechaHora).slice(11, 13) : null);
      if (!raw) return;
      const h = parseInt(String(raw).slice(0, 2), 10);
      if (h < 7 || h > 21) return;
      if (isRealizadaEstado(c.estado)) horas[h].realizadas++;
      else if (isCanceladaEstado(c.estado)) horas[h].canceladas++;
      else horas[h].otras++;
    });
    return Object.values(horas);
  }, [citasFilt]);

  // 4. Ingresos acumulados
  const ingresosAcumulados = useMemo(() => {
    const horas = {};
    for (let h = 7; h <= 21; h++) horas[h] = { hora: `${String(h).padStart(2,'0')}h`, ingresos: 0 };
    citasFilt.filter(c => isRealizadaEstado(c.estado) && getIngreso(c) > 0)
      .forEach(c => {
        const raw = c.hora || (c.fechaHora ? String(c.fechaHora).slice(11, 13) : null);
        if (!raw) return;
        const h = parseInt(String(raw).slice(0, 2), 10);
        if (h >= 7 && h <= 21) horas[h].ingresos += getIngreso(c);
      });
    let acc = 0;
    return Object.values(horas).map(r => { acc += r.ingresos; return { hora: r.hora, ingresos: acc }; });
  }, [citasFilt]);

  // 5. Realizadas por médico (usa métricas recalculadas con citasFilt)
  const topMedicosReal = useMemo(() =>
    medicosFiltMetrics.filter(m => m.realF > 0).sort((a,b) => b.realF - a.realF).slice(0, 10)
      .map(m => ({ name: shortName(m.nombre), realizadas: m.realF, asignadas: m.asigF, uid: m.uid })),
  [medicosFiltMetrics]);

  // 6. Ingresos por médico (usa métricas recalculadas con citasFilt)
  const topMedicosIngr = useMemo(() =>
    medicosFiltMetrics.filter(m => m.ingrF > 0).sort((a,b) => b.ingrF - a.ingrF).slice(0, 10)
      .map(m => ({ name: shortName(m.nombre), ingresos: m.ingrF, uid: m.uid })),
  [medicosFiltMetrics]);

  // 7. % Cumplimiento (usa métricas recalculadas con citasFilt)
  const cumplimientoData = useMemo(() =>
    medicosFiltMetrics.filter(m => m.tasaF != null && m.asigF > 0)
      .sort((a,b) => b.tasaF - a.tasaF).slice(0, 10)
      .map(m => ({ name: shortName(m.nombre), pct: m.tasaF, uid: m.uid })),
  [medicosFiltMetrics]);

  // 8. Score ranking (el score usa fórmula compuesta compleja; se mantiene del pre-cálculo
  // pero solo muestra médicos presentes en citasFilt, lo cual es una buena aproximación)
  const scoreRanking = useMemo(() =>
    medicosFilt.filter(m => m.score > 0).sort((a,b) => b.score - a.score).slice(0, 10)
      .map(m => ({
        name: shortName(m.nombre), score: m.score, uid: m.uid,
        fill: m.score >= 80 ? C.emerald : m.score >= 40 ? C.blue : m.score >= 15 ? C.amber : C.rose,
      })),
  [medicosFilt]);

  // 9. Actividad enfermería
  const enfActividad = useMemo(() =>
    enfFilt.filter(e => e.triagesCount + e.notasCount + e.ordenesCount > 0)
      .sort((a,b) => (b.triagesCount + b.notasCount + b.ordenesCount) - (a.triagesCount + a.notasCount + a.ordenesCount))
      .slice(0, 10).map(e => ({
        name: shortName(e.nombre), triajes: e.triagesCount, notas: e.notasCount, ordenes: e.ordenesCount,
      })),
  [enfFilt]);

  // 10. Citas por sucursal
  const citasPorSucursal = useMemo(() => {
    const g = {};
    citasFilt.forEach(c => {
      const s = c.sucursal || 'Sin sucursal';
      if (!g[s]) g[s] = { name: s, total: 0, realizadas: 0, canceladas: 0, ingresos: 0 };
      g[s].total++;
      if (isRealizadaEstado(c.estado)) {
        g[s].realizadas++;
        g[s].ingresos += getIngreso(c);
      }
      if (isCanceladaEstado(c.estado)) g[s].canceladas++;
    });
    return Object.values(g).sort((a, b) => b.total - a.total);
  }, [citasFilt]);

  // 11. Radar (usa métricas recalculadas para los 3 ejes principales)
  const radarData = useMemo(() => {
    if (medicosFiltMetrics.length === 0) return [];
    const top5 = medicosFiltMetrics.filter(m => m.asigF > 0).sort((a,b) => b.score - a.score).slice(0, 5);
    const maxVal = (key) => Math.max(...top5.map(m => m[key] || 0), 1);
    const normalize = (v, max) => Math.round((v / max) * 100);
    const names = top5.map(m => shortName(m.nombre));
    return [
      { metric: 'Realizadas',   ...Object.fromEntries(names.map((n,i) => [n, normalize(top5[i].realF, maxVal('realF'))])) },
      { metric: 'Ingresos',     ...Object.fromEntries(names.map((n,i) => [n, normalize(top5[i].ingrF, maxVal('ingrF'))])) },
      { metric: 'Cumplimiento', ...Object.fromEntries(names.map((n,i) => [n, top5[i].tasaF ?? 0])) },
      { metric: 'Atención/h',   ...Object.fromEntries(names.map((n,i) => [n, normalize(top5[i].atencionesPorHora || 0, maxVal('atencionesPorHora'))])) },
      { metric: 'Score',        ...Object.fromEntries(names.map((n,i) => [n, normalize(top5[i].score, maxVal('score'))])) },
    ];
  }, [medicosFiltMetrics]);

  const radarKeys = useMemo(() =>
    medicosFiltMetrics.filter(m => m.asigF > 0).sort((a,b) => b.score - a.score).slice(0, 5).map(m => shortName(m.nombre)),
  [medicosFiltMetrics]);

  const radarColors = [C.blue, C.emerald, C.violet, C.amber, C.rose];

  // 12. Métodos de pago
  const formaPagoData = useMemo(() => {
    const g = { Efectivo: 0, Tarjeta: 0 };
    citasFilt.filter(c => isRealizadaEstado(c.estado)).forEach(c => {
      if (c.formaPago === 'efectivo') g['Efectivo']++; else if (c.formaPago === 'tarjeta') g['Tarjeta']++;
    });
    const colors = { Efectivo: C.emerald, Tarjeta: C.sky };
    return Object.entries(g).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value, color: colors[name] }));
  }, [citasFilt]);

  // 13. Motivos cancelación
  const motivosCancelacion = useMemo(() => {
    const g = {};
    citasFilt.filter(c => isCanceladaEstado(c.estado) && c.canceladaMotivo)
      .forEach(c => { g[c.canceladaMotivo] = (g[c.canceladaMotivo] || 0) + 1; });
    return Object.entries(g).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
  }, [citasFilt]);

  // 14. Rotaciones por médico
  const rotacionesPorMedico = useMemo(() => {
    const g = {};
    movimientos.filter(m => fMedico === 'all' || m.doctorUid === fMedico).forEach(m => {
      const n = m.doctorNombre || 'Desconocido';
      g[n] = (g[n] || 0) + 1;
    });
    return Object.entries(g).sort((a,b) => b[1] - a[1]).map(([name, count]) => ({ name: shortName(name), count }));
  }, [movimientos, fMedico]);

  // 15. Personal por rol
  const personalPorRol = useMemo(() => {
    const todos = [...medicos, ...enfermeria, ...adminStaff];
    const g = {};
    todos.forEach(p => {
      const rol = getRolLabel(p.rol);
      if (!g[rol]) g[rol] = { name: rol, online: 0, offline: 0 };
      if (p.online) g[rol].online++; else g[rol].offline++;
    });
    return Object.values(g).sort((a,b) => (b.online + b.offline) - (a.online + a.offline));
  }, [medicos, enfermeria, adminStaff]);

  const hasEnf = enfActividad.length > 0;
  const hasMovs = rotacionesPorMedico.length > 0;
  const hasTipos = tiposData.length > 0;
  const hasIngr = topMedicosIngr.length > 0;
  const hasSuc = citasPorSucursal.length > 0;
  const hasRadar = radarData.length > 0 && radarKeys.length > 1;
  const hasIngrAcum = ingresosAcumulados.some(r => r.ingresos > 0);
  const hasFormaPago = formaPagoData.length > 0;
  const hasCancelMotivos = motivosCancelacion.length > 0;

  const handleBarClick = useCallback((data) => {
    if (data?.uid) setDetailUid(prev => prev === data.uid ? null : data.uid);
  }, []);

  // ── Exportar informe PDF ──
  const handleExportarInforme = useCallback(async () => {
    setExportando(true);
    try {
      const medicoNombre = fMedico !== 'all'
        ? (medicos.find(m => m.uid === fMedico)?.nombre || fMedico)
        : 'all';
      const blob = await pdf(
        <InformeMonitorPDF
          fecha={selectedDate}
          filtros={{ sucursal: fSucursal, medico: medicoNombre, consultorio: fConsultorio }}
          kpis={kpisExport}
          medicos={medicosFiltMetrics}
          enfermeria={enfFilt}
          citasPorSucursal={citasPorSucursal}
          flujoPorHora={flujoPorHora}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_Monitor_${selectedDate}${fSucursal !== 'all' ? `_${fSucursal.replace(/\s+/g, '_')}` : ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Monitor] Error generando informe PDF:', err);
    } finally {
      setExportando(false);
    }
  }, [selectedDate, fSucursal, fMedico, fConsultorio, medicos, kpisExport, medicosFiltMetrics, enfFilt, citasPorSucursal, flujoPorHora]);

  return (
    <div className="space-y-3">

      {/* Filtro compacto */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <Search size={12} className="text-slate-400 shrink-0" />
        <select value={fMedico} onChange={e => setFMedico(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="all">Todos los médicos</option>
          {medicos.map(m => <option key={m.uid} value={m.uid}>{m.nombre}</option>)}
        </select>
        <select value={fSucursal} onChange={e => onFSucursal(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="all">Todas las sucursales</option>
          {sucursalesOpts.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fConsultorio} onChange={e => setFConsultorio(e.target.value)}
          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
          <option value="all">Todos los consultorios</option>
          {consultoriosOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasFilter && (
          <button onClick={() => { setFMedico('all'); onFSucursal('all'); setFConsultorio('all'); setDetailUid(null); }}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors">
            <X size={10} /> Limpiar filtros
          </button>
        )}
        {hasFilter && (
          <span className="text-[10px] text-blue-500 font-medium">
            Vista filtrada · {citasFilt.length} citas
          </span>
        )}
        <button
          onClick={handleExportarInforme}
          disabled={exportando}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
        >
          {exportando
            ? <><div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Generando...</>
            : <><FileDown size={12} /> Exportar informe</>}
        </button>
      </div>

      {/* Detail panel */}
      {detailDoctor && (
        <DoctorDetailPanel doctor={detailDoctor} citas={detailCitas} onClose={() => setDetailUid(null)} />
      )}

      {/* Fila 1: Estado · Tipos · Personal por rol */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        <ChartCard title="Estado de citas" sub={`${citasFilt.length} citas registradas`}>
          <DonutChart data={estadoData} total={citasFilt.length} centerLabel="citas" />
          <Legend items={estadoData} />
        </ChartCard>

        {hasTipos ? (
          <ChartCard title="Tipos de consulta" sub="distribución por tipo">
            <DonutChart data={tiposData} total={tiposData.reduce((s,d) => s + d.value, 0)} centerLabel="clasificadas" />
            <Legend items={tiposData} />
          </ChartCard>
        ) : (
          <ChartCard title="Tipos de consulta" sub="distribución por tipo">
            <div className="h-[190px] flex items-center justify-center text-slate-300 text-sm">Sin datos</div>
          </ChartCard>
        )}

        <ChartCard title="Personal por rol" sub="en turno vs offline">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={personalPorRol} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <RechartsTip content={<CustomTip />} />
              <Bar dataKey="online" name="En turno" fill={C.emerald} stackId="r" radius={[0,0,0,0]} maxBarSize={12} />
              <Bar dataKey="offline" name="Offline"  fill={C.slate}   stackId="r" radius={[0,3,3,0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
          <Legend items={[{ name: 'En turno', color: C.emerald }, { name: 'Offline', color: C.slate }]} />
        </ChartCard>
      </div>

      {/* Fila 2: Flujo por hora */}
      <ChartCard title="Flujo de citas por hora" sub="realizadas · canceladas · pendientes/en progreso">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={flujoPorHora} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <RechartsTip content={<CustomTip />} />
            <Bar dataKey="realizadas" name="Realizadas" fill={C.emerald} stackId="h" maxBarSize={28} radius={[0,0,0,0]} />
            <Bar dataKey="otras"      name="En progreso" fill={C.slate}  stackId="h" maxBarSize={28} radius={[0,0,0,0]} />
            <Bar dataKey="canceladas" name="Canceladas" fill={C.rose}   stackId="h" maxBarSize={28} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <Legend items={[
          { name: 'Realizadas', color: C.emerald }, { name: 'En progreso', color: C.slate }, { name: 'Canceladas', color: C.rose },
        ]} />
      </ChartCard>

      {/* Fila 3: Ingresos acumulados */}
      {hasIngrAcum && (
        <ChartCard title="Ingresos acumulados" sub="suma corrida de ingresos por hora">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ingresosAcumulados} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.violet} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.violet} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={54}
                tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <RechartsTip content={<CustomTip formatter={v => [fmt$(v), 'Ingresos']} />} />
              <Area type="monotone" dataKey="ingresos" name="Acumulado" stroke={C.violet} strokeWidth={2} fill="url(#ingGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Fila 4: Realizadas por médico + Ingresos por médico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Realizadas */}
        <ChartCard title="Realizadas por médico" sub="asignadas (gris) vs completadas (verde) — clic para detalle">
          {topMedicosReal.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-300 text-sm">Sin datos</div>
          ) : (
            <div style={{ cursor: 'pointer' }}>
              <ResponsiveContainer width="100%" height={Math.max(220, topMedicosReal.length * 34)}>
                <BarChart data={topMedicosReal} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}
                  onClick={e => e?.activePayload?.[0]?.payload?.uid && handleBarClick(e.activePayload[0].payload)}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTip content={<CustomTip />} />
                  <Bar dataKey="asignadas" name="Asignadas" fill={C.slate} radius={[0,3,3,0]} maxBarSize={14} />
                  <Bar dataKey="realizadas" name="Realizadas" fill={C.emerald} radius={[0,3,3,0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Ingresos */}
        {hasIngr ? (
          <ChartCard title="Ingresos por médico" sub="citas completadas del día — clic para detalle">
            {hasIngr ? (
              <div style={{ cursor: 'pointer' }}>
                <ResponsiveContainer width="100%" height={Math.max(220, topMedicosIngr.length * 34)}>
                  <BarChart data={topMedicosIngr} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}
                    onClick={e => e?.activePayload?.[0]?.payload?.uid && handleBarClick(e.activePayload[0].payload)}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <RechartsTip content={<CustomTip formatter={v => [fmt$(v), 'Ingresos']} />} />
                    <Bar dataKey="ingresos" name="Ingresos" fill={C.violet} radius={[0,3,3,0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-300 text-sm">Sin ingresos registrados</div>
            )}
          </ChartCard>
        ) : (
          <ChartCard title="Ingresos por médico" sub="citas completadas del día">
            <div className="h-[220px] flex items-center justify-center text-slate-300 text-sm">Sin ingresos registrados</div>
          </ChartCard>
        )}
      </div>

      {/* Fila 5: % Cumplimiento + Score ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ChartCard title="% Cumplimiento por médico" sub="citas completadas vs asignadas — clic para detalle">
          {cumplimientoData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">Sin datos</div>
          ) : (
            <div style={{ cursor: 'pointer' }}>
              <ResponsiveContainer width="100%" height={Math.max(200, cumplimientoData.length * 34)}>
                <BarChart data={cumplimientoData} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}
                  onClick={e => e?.activePayload?.[0]?.payload?.uid && handleBarClick(e.activePayload[0].payload)}>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTip content={<CustomTip formatter={v => [`${v}%`, 'Cumplimiento']} />} />
                  <Bar dataKey="pct" name="Cumplimiento" radius={[0,3,3,0]} maxBarSize={14}>
                    {cumplimientoData.map((d, i) => (
                      <Cell key={i} fill={d.pct >= 75 ? C.emerald : d.pct >= 50 ? C.amber : C.rose} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Ranking por score" sub="médicos ordenados por rendimiento compuesto">
          {scoreRanking.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-slate-300 text-sm">Sin datos</div>
          ) : (
            <div style={{ cursor: 'pointer' }}>
              <ResponsiveContainer width="100%" height={Math.max(200, scoreRanking.length * 34)}>
                <BarChart data={scoreRanking} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}
                  onClick={e => e?.activePayload?.[0]?.payload?.uid && handleBarClick(e.activePayload[0].payload)}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTip content={<CustomTip formatter={v => [v, 'Score']} />} />
                  <Bar dataKey="score" name="Score" radius={[0,3,3,0]} maxBarSize={14}>
                    {scoreRanking.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Fila 6: Radar + Citas por sucursal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hasRadar ? (
          <ChartCard title="Radar de rendimiento" sub="top 5 médicos normalizados (0–100)">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#475569' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickCount={4} />
                {radarKeys.map((key, i) => (
                  <Radar key={key} name={key} dataKey={key}
                    stroke={radarColors[i]} fill={radarColors[i]} fillOpacity={0.08} strokeWidth={1.5} />
                ))}
                <RechartsTip content={<CustomTip />} />
              </RadarChart>
            </ResponsiveContainer>
            <Legend items={radarKeys.map((k, i) => ({ name: k, color: radarColors[i] }))} />
          </ChartCard>
        ) : (
          <ChartCard title="Radar de rendimiento" sub="top 5 médicos normalizados">
            <div className="h-[240px] flex items-center justify-center text-slate-300 text-sm">
              Necesita al menos 2 médicos con citas
            </div>
          </ChartCard>
        )}

        {hasSuc ? (
          <ChartCard title="Citas por sucursal" sub="total vs realizadas">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={citasPorSucursal} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                <RechartsTip content={<CustomTip />} />
                <Bar dataKey="total" name="Total" fill={C.slate} radius={[2,2,0,0]} maxBarSize={28} />
                <Bar dataKey="realizadas" name="Realizadas" fill={C.emerald} radius={[2,2,0,0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          <ChartCard title="Citas por sucursal" sub="total vs realizadas">
            <div className="h-[240px] flex items-center justify-center text-slate-300 text-sm">Sin datos de sucursal</div>
          </ChartCard>
        )}
      </div>

      {/* Fila 7: Métodos de pago + Motivos cancelación */}
      {(hasFormaPago || hasCancelMotivos) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hasFormaPago ? (
            <ChartCard title="Métodos de pago" sub="realizadas con pago registrado">
              <DonutChart data={formaPagoData} total={formaPagoData.reduce((s,d) => s + d.value, 0)} centerLabel="pagos" height={180} />
              <Legend items={formaPagoData} />
            </ChartCard>
          ) : (
            <ChartCard title="Métodos de pago" sub="realizadas con pago registrado">
              <div className="h-[180px] flex items-center justify-center text-slate-300 text-sm">Sin pagos registrados</div>
            </ChartCard>
          )}

          {hasCancelMotivos ? (
            <ChartCard title="Motivos de cancelación" sub="razones más frecuentes del día">
              <ResponsiveContainer width="100%" height={Math.max(180, motivosCancelacion.length * 34)}>
                <BarChart data={motivosCancelacion} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v.length > 24 ? v.slice(0, 22) + '…' : v} />
                  <RechartsTip content={<CustomTip formatter={v => [v, 'cancelaciones']} />} />
                  <Bar dataKey="count" name="Cancelaciones" fill={C.rose} radius={[0,3,3,0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <ChartCard title="Motivos de cancelación" sub="razones más frecuentes del día">
              <div className="h-[180px] flex items-center justify-center text-slate-300 text-sm">Sin cancelaciones</div>
            </ChartCard>
          )}
        </div>
      )}

      {/* Fila 8: Actividad enfermería */}
      {hasEnf && (
        <ChartCard title="Actividad de enfermería" sub="triajes · notas · órdenes por persona">
          <ResponsiveContainer width="100%" height={Math.max(160, enfActividad.length * 38)}>
            <BarChart data={enfActividad} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <RechartsTip content={<CustomTip />} />
              <Bar dataKey="triajes" name="Triajes" fill={C.blue} stackId="e" maxBarSize={14} radius={[0,0,0,0]} />
              <Bar dataKey="notas"   name="Notas"   fill={C.indigo} stackId="e" maxBarSize={14} radius={[0,0,0,0]} />
              <Bar dataKey="ordenes" name="Órdenes" fill={C.violet} stackId="e" maxBarSize={14} radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
          <Legend items={[
            { name: 'Triajes', color: C.blue }, { name: 'Notas', color: C.indigo }, { name: 'Órdenes', color: C.violet },
          ]} />
        </ChartCard>
      )}

      {/* Fila 9: Rotaciones */}
      {hasMovs && (
        <ChartCard title="Rotaciones de consultorio" sub="cambios de sala por médico en el día">
          <ResponsiveContainer width="100%" height={Math.max(120, rotacionesPorMedico.length * 34)}>
            <BarChart data={rotacionesPorMedico} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <RechartsTip content={<CustomTip formatter={v => [v, 'rotaciones']} />} />
              <Bar dataKey="count" name="Rotaciones" fill={C.amber} radius={[0,3,3,0]} maxBarSize={14}>
                {rotacionesPorMedico.map((d, i) => (
                  <Cell key={i} fill={d.count > 3 ? C.rose : d.count > 1 ? C.amber : C.slate} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// ─── Tab: Médicos ─────────────────────────────────────────────────────────────

const COLS_MEDICOS = [
  { label: 'Nombre',           get: r => r.nombre },
  { label: 'Sucursal',         get: r => r.sucursal },
  { label: 'Consultorio',      get: r => r.consultorio },
  { label: 'Estado',           get: r => r.online ? (r.statusOperativo || 'activo') : 'offline' },
  { label: 'Minutos en turno', get: r => r.minutos },
  { label: 'Citas asignadas',  get: r => r.asignadas },
  { label: 'Realizadas',       get: r => r.realizadas },
  { label: 'En consulta',      get: r => r.enConsulta },
  { label: 'Canceladas',       get: r => r.canceladas },
  { label: '% Cumplimiento',   get: r => r.tasaCumplimiento ?? '' },
  { label: 'Ingresos MXN',     get: r => r.ingresos },
  { label: 'Ingreso promedio', get: r => r.ingresoProm },
  { label: 'Atenciones/hora',  get: r => r.atencionesPorHora ?? '' },
  { label: 'Primera vez',      get: r => r.primeraVez },
  { label: 'Subsecuente',      get: r => r.subsecuente },
  { label: 'Urgencia',         get: r => r.urgencia },
  { label: 'Teleconsultas',    get: r => r.teleconsultas },
  { label: 'Rotaciones',       get: r => r.cambiosConsultorio },
  { label: 'Score',            get: r => r.score },
];

function TabMedicos({ medicos, sucursales, selectedDate }) {
  const [search, setSearch] = useState('');
  const [suc, setSuc] = useState('todas');
  const [est, setEst] = useState('todos');
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' });
  const onSort = useCallback(k =>
    setSort(p => p.key === k ? { key: k, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' }), []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    let d = medicos;
    if (suc !== 'todas')    d = d.filter(r => r.sucursal === suc);
    if (est === 'activos')  d = d.filter(r => r.online);
    if (est === 'offline')  d = d.filter(r => !r.online);
    if (term) d = d.filter(r => `${r.nombre} ${r.sucursal} ${r.consultorio}`.toLowerCase().includes(term));
    return sortData(d, sort.key, sort.dir);
  }, [medicos, search, suc, est, sort]);

  return (
    <div>
      <FilterBar
        search={search} onSearch={setSearch} placeholder="Buscar médico..."
        sucursal={suc} onSucursal={setSuc} sucursales={sucursales}
        extra={
          <select value={est} onChange={e => setEst(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none">
            <option value="todos">Todos</option>
            <option value="activos">En turno</option>
            <option value="offline">Offline</option>
          </select>
        }
        count={filtered.length} label={`médico${filtered.length !== 1 ? 's' : ''}`}
        onExport={() => downloadCSV(filtered, COLS_MEDICOS, `medicos_${selectedDate}.csv`)}
      />
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-300 uppercase border-b border-slate-100 w-7">#</th>
                <SortTH label="Médico"      sortKey="nombre"             sort={sort} onSort={onSort} className="min-w-[180px]" />
                <SortTH label="Estado"      sortKey="statusOperativo"    sort={sort} onSort={onSort} className="min-w-[110px]" />
                <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 min-w-[140px]">Ubicación</th>
                <SortTH label="Turno"       sortKey="minutos"            sort={sort} onSort={onSort} className="min-w-[75px]" />
                <SortTH label="Asig."       sortKey="asignadas"          sort={sort} onSort={onSort} />
                <SortTH label="Real."       sortKey="realizadas"         sort={sort} onSort={onSort} />
                <SortTH label="Curso"       sortKey="enConsulta"         sort={sort} onSort={onSort} />
                <SortTH label="Cancel."     sortKey="canceladas"         sort={sort} onSort={onSort} />
                <SortTH label="% Cumpl."    sortKey="tasaCumplimiento"   sort={sort} onSort={onSort} className="min-w-[100px]" />
                <SortTH label="Ingresos"    sortKey="ingresos"           sort={sort} onSort={onSort} className="min-w-[105px]" />
                <SortTH label="At./h"       sortKey="atencionesPorHora"  sort={sort} onSort={onSort} />
                <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 min-w-[110px]">Tipos</th>
                <SortTH label="Tel."        sortKey="teleconsultas"      sort={sort} onSort={onSort} />
                <SortTH label="Rotas."      sortKey="cambiosConsultorio" sort={sort} onSort={onSort} />
                <SortTH label="Score"       sortKey="score"              sort={sort} onSort={onSort} className="min-w-[65px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && <EmptyRow cols={16} />}
              {filtered.map((r, i) => (
                <tr key={r.uid} className={`hover:bg-slate-50/40 transition-colors ${!r.online ? 'opacity-55' : ''}`}>
                  <td className="px-3 py-2.5 text-[11px] text-slate-300 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5"><AvatarCell name={r.nombre} sub="Médico" color="bg-blue-50 text-blue-700" /></td>
                  <td className="px-3 py-2.5"><StatusCell statusOperativo={r.statusOperativo} online={r.online} /></td>
                  <td className="px-3 py-2.5">
                    <p className="text-[12px] font-medium text-slate-700 truncate max-w-[135px]">
                      {r.consultorio !== '—' ? r.consultorio : <span className="text-slate-300">—</span>}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[135px]">{r.sucursal !== '—' ? r.sucursal : ''}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 tabular-nums">
                      <Clock size={10} className="text-slate-300" />{r.tiempoConectado}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center"><N v={r.asignadas} color="text-slate-600" /></td>
                  <td className="px-3 py-2.5 text-center"><N v={r.realizadas} color="text-emerald-700" /></td>
                  <td className="px-3 py-2.5 text-center">
                    {r.enConsulta > 0
                      ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">{r.enConsulta}</span>
                      : <span className="text-slate-200 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center"><N v={r.canceladas} color="text-rose-600" /></td>
                  <td className="px-3 py-2.5"><MiniBar value={r.tasaCumplimiento} /></td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold text-violet-700 tabular-nums whitespace-nowrap">
                    {r.ingresos > 0 ? fmt$(r.ingresos) : <span className="text-slate-200 font-normal text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center text-[11px] text-slate-500 tabular-nums">
                    {r.atencionesPorHora != null ? r.atencionesPorHora : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.primeraVez  > 0 && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">1ª·{r.primeraVez}</span>}
                      {r.subsecuente > 0 && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">Sub·{r.subsecuente}</span>}
                      {r.urgencia    > 0 && <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-semibold">Urg·{r.urgencia}</span>}
                      {!r.primeraVez && !r.subsecuente && !r.urgencia && <span className="text-slate-200 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center"><N v={r.teleconsultas} color="text-blue-700" /></td>
                  <td className="px-3 py-2.5 text-center"><N v={r.cambiosConsultorio} color="text-amber-700" /></td>
                  <td className="px-3 py-2.5"><ScoreCell score={r.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Enfermería ──────────────────────────────────────────────────────────

const COLS_ENFERMERIA = [
  { label: 'Nombre',           get: r => r.nombre },
  { label: 'Rol',              get: r => getRolLabel(r.rol) },
  { label: 'Sucursal',         get: r => r.sucursal },
  { label: 'Estado',           get: r => r.online ? (r.statusOperativo || 'activo') : 'offline' },
  { label: 'Minutos en turno', get: r => r.minutos },
  { label: 'Triajes',          get: r => r.triagesCount },
  { label: 'Notas enfermería', get: r => r.notasCount },
  { label: 'Órdenes',          get: r => r.ordenesCount },
  { label: 'Citas asignadas',  get: r => r.asignadas },
  { label: 'Realizadas',       get: r => r.realizadas },
  { label: '% Cumplimiento',   get: r => r.tasaCumplimiento ?? '' },
  { label: 'Score',            get: r => r.score },
];

function TabEnfermeria({ enfermeria, sucursales, selectedDate }) {
  const [search, setSearch] = useState('');
  const [suc, setSuc] = useState('todas');
  const [est, setEst] = useState('todos');
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' });
  const onSort = useCallback(k =>
    setSort(p => p.key === k ? { key: k, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' }), []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    let d = enfermeria;
    if (suc !== 'todas')    d = d.filter(r => r.sucursal === suc);
    if (est === 'activos')  d = d.filter(r => r.online);
    if (est === 'offline')  d = d.filter(r => !r.online);
    if (term) d = d.filter(r => `${r.nombre} ${r.sucursal}`.toLowerCase().includes(term));
    return sortData(d, sort.key, sort.dir);
  }, [enfermeria, search, suc, est, sort]);

  return (
    <div>
      <FilterBar
        search={search} onSearch={setSearch} placeholder="Buscar enfermera/o..."
        sucursal={suc} onSucursal={setSuc} sucursales={sucursales}
        extra={
          <select value={est} onChange={e => setEst(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none">
            <option value="todos">Todos</option>
            <option value="activos">En turno</option>
            <option value="offline">Offline</option>
          </select>
        }
        count={filtered.length} label={`persona${filtered.length !== 1 ? 's' : ''}`}
        onExport={() => downloadCSV(filtered, COLS_ENFERMERIA, `enfermeria_${selectedDate}.csv`)}
      />
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-300 uppercase border-b border-slate-100 w-7">#</th>
                <SortTH label="Enfermera/o"  sortKey="nombre"           sort={sort} onSort={onSort} className="min-w-[180px]" />
                <SortTH label="Estado"       sortKey="statusOperativo"  sort={sort} onSort={onSort} className="min-w-[110px]" />
                <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 min-w-[130px]">Ubicación</th>
                <SortTH label="Turno"        sortKey="minutos"          sort={sort} onSort={onSort} className="min-w-[75px]" />
                <SortTH label="Triajes"      sortKey="triagesCount"     sort={sort} onSort={onSort} />
                <SortTH label="Notas"        sortKey="notasCount"       sort={sort} onSort={onSort} />
                <SortTH label="Órdenes"      sortKey="ordenesCount"     sort={sort} onSort={onSort} />
                <SortTH label="Citas asig."  sortKey="asignadas"        sort={sort} onSort={onSort} />
                <SortTH label="Realizadas"   sortKey="realizadas"       sort={sort} onSort={onSort} />
                <SortTH label="% Cumpl."     sortKey="tasaCumplimiento" sort={sort} onSort={onSort} className="min-w-[100px]" />
                <SortTH label="Score"        sortKey="score"            sort={sort} onSort={onSort} className="min-w-[65px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && <EmptyRow cols={12} />}
              {filtered.map((r, i) => (
                <tr key={r.uid} className={`hover:bg-slate-50/40 transition-colors ${!r.online ? 'opacity-55' : ''}`}>
                  <td className="px-3 py-2.5 text-[11px] text-slate-300 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5"><AvatarCell name={r.nombre} sub={getRolLabel(r.rol)} color="bg-rose-50 text-rose-700" /></td>
                  <td className="px-3 py-2.5"><StatusCell statusOperativo={r.statusOperativo} online={r.online} /></td>
                  <td className="px-3 py-2.5">
                    <p className="text-[12px] font-medium text-slate-700 truncate max-w-[125px]">
                      {r.consultorio !== '—' ? r.consultorio : <span className="text-slate-300">—</span>}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[125px]">{r.sucursal !== '—' ? r.sucursal : ''}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 tabular-nums">
                      <Clock size={10} className="text-slate-300" />{r.tiempoConectado}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center"><N v={r.triagesCount} color="text-blue-700" /></td>
                  <td className="px-3 py-2.5 text-center"><N v={r.notasCount}   color="text-slate-700" /></td>
                  <td className="px-3 py-2.5 text-center"><N v={r.ordenesCount} color="text-slate-700" /></td>
                  <td className="px-3 py-2.5 text-center"><N v={r.asignadas}    color="text-slate-600" /></td>
                  <td className="px-3 py-2.5 text-center"><N v={r.realizadas}   color="text-emerald-700" /></td>
                  <td className="px-3 py-2.5"><MiniBar value={r.tasaCumplimiento} /></td>
                  <td className="px-3 py-2.5"><ScoreCell score={r.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Operaciones ─────────────────────────────────────────────────────────

const COLS_ADMIN = [
  { label: 'Nombre',           get: r => r.nombre },
  { label: 'Rol',              get: r => getRolLabel(r.rol) },
  { label: 'Sucursal',         get: r => r.sucursal },
  { label: 'Estado',           get: r => r.online ? (r.statusOperativo || 'activo') : 'offline' },
  { label: 'Minutos en turno', get: r => r.minutos },
  { label: 'Citas creadas',    get: r => r.citasCreadas },
];

function TabAdmin({ adminStaff, sucursales, selectedDate }) {
  const [search, setSearch] = useState('');
  const [suc, setSuc] = useState('todas');
  const [sort, setSort] = useState({ key: 'minutos', dir: 'desc' });
  const onSort = useCallback(k =>
    setSort(p => p.key === k ? { key: k, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' }), []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    let d = adminStaff;
    if (suc !== 'todas') d = d.filter(r => r.sucursal === suc);
    if (term) d = d.filter(r => `${r.nombre} ${r.rol} ${r.sucursal}`.toLowerCase().includes(term));
    return sortData(d, sort.key, sort.dir);
  }, [adminStaff, search, suc, sort]);

  return (
    <div>
      <FilterBar
        search={search} onSearch={setSearch} placeholder="Buscar personal..."
        sucursal={suc} onSucursal={setSuc} sucursales={sucursales}
        count={filtered.length} label={`persona${filtered.length !== 1 ? 's' : ''}`}
        onExport={() => downloadCSV(filtered, COLS_ADMIN, `operaciones_${selectedDate}.csv`)}
      />
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-300 uppercase border-b border-slate-100 w-7">#</th>
                <SortTH label="Personal"      sortKey="nombre"          sort={sort} onSort={onSort} className="min-w-[180px]" />
                <SortTH label="Rol"           sortKey="rol"             sort={sort} onSort={onSort} />
                <SortTH label="Estado"        sortKey="statusOperativo" sort={sort} onSort={onSort} className="min-w-[110px]" />
                <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">Sucursal</th>
                <SortTH label="Turno"         sortKey="minutos"         sort={sort} onSort={onSort} className="min-w-[75px]" />
                <SortTH label="Citas creadas" sortKey="citasCreadas"    sort={sort} onSort={onSort} />
                <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 min-w-[130px]">Última actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && <EmptyRow cols={8} />}
              {filtered.map((r, i) => (
                <tr key={r.uid} className={`hover:bg-slate-50/40 transition-colors ${!r.online ? 'opacity-55' : ''}`}>
                  <td className="px-3 py-2.5 text-[11px] text-slate-300 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5"><AvatarCell name={r.nombre} color="bg-slate-100 text-slate-600" /></td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">{getRolLabel(r.rol)}</td>
                  <td className="px-3 py-2.5"><StatusCell statusOperativo={r.statusOperativo} online={r.online} /></td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">{r.sucursal !== '—' ? r.sucursal : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 tabular-nums">
                      <Clock size={10} className="text-slate-300" />{r.tiempoConectado}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center"><N v={r.citasCreadas} color="text-slate-700" /></td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-400">{timeAgo(r.lastSeen) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Rotaciones ──────────────────────────────────────────────────────────

const COLS_ROTACIONES = [
  { label: 'Hora',              get: r => fmtHora(r.fecha) },
  { label: 'Médico',            get: r => r.doctorNombre || '' },
  { label: 'Sucursal anterior', get: r => r.sucursalAnterior || '' },
  { label: 'Consultorio antes', get: r => r.consultorioAnterior || '' },
  { label: 'Sucursal nueva',    get: r => r.sucursalNueva || '' },
  { label: 'Consultorio nuevo', get: r => r.consultorioNuevo || '' },
  { label: 'Realizado por',     get: r => r.actorNombre || '' },
  { label: 'Rol actor',         get: r => getRolLabel(r.actorRol) || '' },
  { label: 'Es admin',          get: r => r.esMovimientoAdmin ? 'Sí' : 'No' },
];

function TabRotaciones({ movimientos, selectedDate }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return movimientos.filter(m =>
      !term ||
      `${m.doctorNombre} ${m.sucursalAnterior} ${m.sucursalNueva} ${m.consultorioAnterior} ${m.consultorioNuevo}`
        .toLowerCase().includes(term)
    );
  }, [movimientos, search]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar médico o consultorio..."
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white w-56 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
        <span className="text-[11px] text-slate-400">{filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}</span>
        <button onClick={() => downloadCSV(filtered, COLS_ROTACIONES, `rotaciones_${selectedDate}.csv`)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors">
          <Download size={11} /> Exportar CSV
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left">
            <thead className="bg-slate-50/80">
              <tr>
                {['Hora','Médico','Sucursal anterior','Consultorio antes','','Sucursal nueva','Consultorio nuevo','Realizado por',''].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && <EmptyRow cols={9} msg="Sin rotaciones de consultorio para esta fecha." />}
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-amber-50/20 transition-colors">
                  <td className="px-3 py-2.5 text-[12px] text-slate-500 tabular-nums whitespace-nowrap font-medium">{fmtHora(m.fecha)}</td>
                  <td className="px-3 py-2.5"><AvatarCell name={m.doctorNombre || '—'} color="bg-blue-50 text-blue-700" /></td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">{m.sucursalAnterior || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">{m.consultorioAnterior || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 text-sm">→</td>
                  <td className="px-3 py-2.5 text-[12px] font-medium text-slate-700">{m.sucursalNueva || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-semibold">{m.consultorioNuevo || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {m.actorNombre ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-slate-700">{m.actorNombre}</span>
                        {m.esMovimientoAdmin && (
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wide">Admin</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-400">{getRolLabel(m.actorRol) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const MonitorActividad = () => {
  const [selectedDate, setSelectedDate] = useState(TODAY());
  const [activeTab,    setActiveTab]    = useState('dashboard');
  const [fSucursal,    setFSucursal]    = useState('all');

  const {
    medicos, enfermeria, adminStaff,
    citas, movimientos, triajes, notas, ordenes,
    kpis, sucursales,
    isLive, loading, refreshing,
  } = useMonitorData(selectedDate);

  const isToday = selectedDate === TODAY();

  // KPIs filtrados por sucursal para que el strip superior respete el filtro del Dashboard
  const kpisFiltered = useMemo(() => {
    if (fSucursal === 'all') return kpis;
    const c = citas.filter(x => x.sucursal === fSucursal);
    const realizadas = c.filter(x => isRealizadaEstado(x.estado));
    const canceladas = c.filter(x => isCanceladaEstado(x.estado));
    const ingresoTotal = realizadas.reduce((s, x) => s + getIngreso(x), 0);
    const byDoc = {};
    c.forEach(x => {
      if (!x.doctorUid) return;
      if (!byDoc[x.doctorUid]) byDoc[x.doctorUid] = { total: 0, real: 0 };
      byDoc[x.doctorUid].total++;
      if (isRealizadaEstado(x.estado)) byDoc[x.doctorUid].real++;
    });
    const docs = Object.values(byDoc).filter(d => d.total > 0);
    const eficienciaPromedio = docs.length > 0
      ? Math.round(docs.reduce((s, d) => s + (d.real / d.total) * 100, 0) / docs.length)
      : 0;
    return {
      ...kpis,
      totalCitas:      c.length,
      citasRealizadas: realizadas.length,
      citasCanceladas: canceladas.length,
      citasEnCurso:    c.filter(x => normalizeEstado(x.estado) === 'en_consulta').length,
      ingresoTotal,
      eficienciaPromedio,
    };
  }, [fSucursal, citas, kpis]);

  const pctRealizadas = kpisFiltered.totalCitas > 0
    ? Math.round((kpisFiltered.citasRealizadas / kpisFiltered.totalCitas) * 100)
    : 0;

  const stats = [
    isToday && { label: 'Personal activo', value: `${kpis.enTurno} / ${kpis.totalPersonal}`, color: kpis.enTurno > 0 ? 'text-emerald-600' : 'text-slate-400' },
    { label: 'Citas del día',  value: kpisFiltered.totalCitas,          color: 'text-slate-800' },
    { label: 'Realizadas',     value: kpisFiltered.citasRealizadas,     color: 'text-emerald-700', sub: kpisFiltered.totalCitas > 0 ? `${pctRealizadas}% del total` : undefined },
    isToday && { label: 'En consulta', value: kpisFiltered.citasEnCurso, color: kpisFiltered.citasEnCurso > 0 ? 'text-blue-700' : 'text-slate-300' },
    { label: 'Canceladas',    value: kpisFiltered.citasCanceladas,      color: kpisFiltered.citasCanceladas > 0 ? 'text-rose-600' : 'text-slate-300' },
    { label: 'Cumplimiento',  value: `${kpisFiltered.eficienciaPromedio}%`, color: kpisFiltered.eficienciaPromedio >= 75 ? 'text-emerald-700' : kpisFiltered.eficienciaPromedio >= 50 ? 'text-amber-600' : 'text-rose-600' },
    { label: 'Ingresos',      value: fmt$(kpisFiltered.ingresoTotal),   color: 'text-violet-700' },
    { label: 'Triajes',       value: kpis.totalTriajes,         color: kpis.totalTriajes > 0 ? 'text-slate-700' : 'text-slate-300' },
    { label: 'Rotaciones',    value: kpis.totalRotaciones,      color: kpis.totalRotaciones > 3 ? 'text-amber-700' : 'text-slate-500' },
  ].filter(Boolean);

  const tabs = [
    { key: 'dashboard',  label: 'Dashboard',    count: null,               icon: BarChart2      },
    { key: 'medicos',    label: 'Médicos',       count: medicos.length,     icon: Stethoscope    },
    { key: 'enfermeria', label: 'Enfermería',    count: enfermeria.length,  icon: Heart          },
    { key: 'admin',      label: 'Operaciones',   count: adminStaff.length,  icon: ShieldCheck    },
    { key: 'rotaciones', label: 'Rotaciones',    count: movimientos.length, icon: ArrowRightLeft },
  ];

  return (
    <div className="p-4 md:p-6 pb-16 max-w-[1800px] mx-auto space-y-3">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-[21px] font-bold text-slate-900 leading-tight tracking-tight" style={{ fontFamily: 'Sora, sans-serif' }}>
            Monitor de Actividad
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{fmtDateLabel(selectedDate)}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
            <button onClick={() => setSelectedDate(d => addDays(d, -1))}
              className="px-2.5 py-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border-r border-slate-100">
              <ChevronLeft size={14} />
            </button>
            <input type="date" value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="px-2 py-2 text-sm bg-transparent focus:outline-none text-slate-700 font-medium w-36 cursor-pointer" />
            <button onClick={() => setSelectedDate(d => addDays(d, 1))} disabled={isToday}
              className="px-2.5 py-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border-l border-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={14} />
            </button>
          </div>

          {!isToday && (
            <button onClick={() => setSelectedDate(TODAY())}
              className="px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 shadow-sm transition-colors">
              Hoy
            </button>
          )}

          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold shadow-sm ${
            isToday
              ? isLive ? 'bg-white text-emerald-600 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive && isToday ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {isToday ? (isLive ? 'En vivo' : 'Conectando...') : 'Histórico'}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="flex flex-wrap border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden divide-x divide-slate-100">
        {stats.map((s, i) => (
          <div key={i} className="px-4 py-3 flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{s.label}</span>
            <span className={`text-[15px] font-bold tabular-nums leading-tight ${s.color}`}>{s.value}</span>
            {s.sub && <span className="text-[10px] text-slate-400 whitespace-nowrap">{s.sub}</span>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-slate-100 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                  active
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/60'
                }`}
              >
                <Icon size={13} />
                {tab.label}
                {tab.count != null && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-2.5 text-slate-400">
              <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
              <p className="text-xs">Cargando datos...</p>
            </div>
          ) : (
            <>
              {refreshing && (
                <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-700 font-medium">
                  <div className="w-3 h-3 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />
                  Actualizando datos...
                </div>
              )}
              {activeTab === 'dashboard'  && (
                <TabDashboard
                  medicos={medicos} enfermeria={enfermeria} adminStaff={adminStaff}
                  citas={citas} movimientos={movimientos} triajes={triajes} notas={notas} ordenes={ordenes}
                  kpis={kpis} isToday={isToday}
                  fSucursal={fSucursal} onFSucursal={setFSucursal}
                  selectedDate={selectedDate}
                />
              )}
              {activeTab === 'medicos'    && <TabMedicos    medicos={medicos}       sucursales={sucursales} selectedDate={selectedDate} />}
              {activeTab === 'enfermeria' && <TabEnfermeria enfermeria={enfermeria} sucursales={sucursales} selectedDate={selectedDate} />}
              {activeTab === 'admin'      && <TabAdmin      adminStaff={adminStaff} sucursales={sucursales} selectedDate={selectedDate} />}
              {activeTab === 'rotaciones' && <TabRotaciones movimientos={movimientos}               selectedDate={selectedDate} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitorActividad;
