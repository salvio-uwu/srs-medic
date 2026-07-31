import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, BarChart2, Calendar, CheckCircle2,
  ChevronDown, ChevronRight, Download, MapPin, Package, Search, Stethoscope
} from 'lucide-react';
import {
  collection, onSnapshot, orderBy, query, where
} from 'firebase/firestore';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTip, AreaChart, Area
} from 'recharts';
import { db } from '../../config/firebase';
import useIsMobile from '../../hooks/useIsMobile';
import {
  buildAsistenciaCsv,
  downloadCsv,
  fetchAsistenciaRango,
  rangoParaPeriodo,
} from '../../services/asistenciaService';

/* ─── CSS ─────────────────────────────────────────────────────────────────── */

const STYLES = `
  .sv-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .sv-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }
  @keyframes svSpin { to { transform: rotate(360deg); } }
  .sv-dot { width: 7px; height: 7px; border-radius: 99px; flex-shrink: 0; }
  .sv-dot-green { background: #10b981; }
  .sv-dot-red { background: #ef4444; }
  .sv-dot-blue { background: #3b82f6; }
  .sv-dot-amber { background: #f59e0b; }
  .sv-dot-slate { background: #cbd5e1; }
  .sv-tl-track {
    position: relative;
    height: 22px;
    background: #f8fafc;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #eef2f7;
  }
  .sv-tl-grid {
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      90deg, transparent 0, transparent calc(100% / 16 - 1px),
      #e5e7eb calc(100% / 16 - 1px), #e5e7eb calc(100% / 16)
    );
    pointer-events: none;
  }
  .sv-tl-bar {
    position: absolute;
    top: 3px;
    height: 16px;
    border-radius: 3px;
    min-width: 3px;
  }
  .sv-tl-now {
    position: absolute;
    top: 0; bottom: 0;
    width: 1.5px;
    background: #ef4444;
    z-index: 3;
    pointer-events: none;
  }
  .sv-seg {
    display: inline-flex;
    background: #f3f4f6;
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .sv-seg button {
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 4px;
    color: #6b7280;
    background: transparent;
  }
  .sv-seg button.on {
    background: #fff;
    color: #111;
    box-shadow: 0 0 0 1px #e5e7eb;
  }
`

/* ─── Constantes ───────────────────────────────────────────────────────────── */

const DAY_START_H = 6;
const DAY_END_H = 22;
const DAY_SPAN_MIN = (DAY_END_H - DAY_START_H) * 60;
const HOUR_TICKS = Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i);

const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDateSafe = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeText = (v) => String(v || '').toLowerCase().trim();

const fmtMXN = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(v || 0));

const fmtDT = (v) => {
  const d = parseDateSafe(v);
  if (!d) return '--';
  return d.toLocaleString('es-MX', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const fmtTime = (v) => {
  const d = parseDateSafe(v);
  if (!d) return '--:--';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const fmtDuration = (min) => {
  if (min == null || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

const isSameDate = (v, ymd) => {
  const d = parseDateSafe(v);
  return d ? toDateInput(d) === ymd : false;
};

const isOnline = (u = {}) => {
  if (u.isOnline === true) {
    const ls = parseDateSafe(u.lastSeen);
    return ls ? Date.now() - ls.getTime() <= 10 * 60 * 1000 : false;
  }
  const ls = parseDateSafe(u.lastSeen);
  return ls ? (Date.now() - ls.getTime()) / 60000 <= 10 : false;
};

const getHour = (c = {}) => {
  if (c.hora) return c.hora;
  if (c.fechaHora && String(c.fechaHora).includes('T')) return String(c.fechaHora).split('T')[1]?.slice(0, 5) || '';
  return '';
};

const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

const clampPct = (n) => Math.max(0, Math.min(100, n));

const timelinePct = (dateOrNull) => {
  if (!dateOrNull) return null;
  const m = minutesOfDay(dateOrNull) - DAY_START_H * 60;
  return clampPct((m / DAY_SPAN_MIN) * 100);
};

const EST_REALIZADAS = new Set(['completada', 'finalizada', 'atendida']);
const EST_CANCELADAS = new Set(['cancelada', 'no_asistio']);
const ROLES_OPS = new Set(['medico', 'enfermeria', 'jefa_enfermeria', 'intendencia', 'recepcion', 'admin', 'admin_maestro', 'operativo', 'rh']);

const ROL_LABEL = { medico: 'Medico', doctor: 'Medico', enfermeria: 'Enfermeria', enfermera: 'Enfermeria', enfermero: 'Enfermeria', jefa_enfermeria: 'Jefa Enf.', jefa: 'Jefa Enf.', admin: 'Admin', admin_maestro: 'Admin M.', administrador: 'Admin', rh: 'RH', recursos_humanos: 'RH', recepcion: 'Recepcion', intendencia: 'Intendencia', operativo: 'Operativo', limpieza: 'Intendencia' };
const rolLabel = (r) => ROL_LABEL[normalizeText(r)] || String(r || '').replace(/_/g, ' ');

const initials = (n = '') => n.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const shortName = (n = '', w = 2) => n.split(' ').slice(0, w).join(' ');

const ING_COLORS = { emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b', rose: '#ef4444', slate: '#cbd5e1', violet: '#7c3aed', sky: '#0ea5e9' };

const BAR_BY_STATUS = {
  'En consulta': { bg: 'linear-gradient(90deg, #f43f5e, #fb7185)', txt: '#fff' },
  Comida:        { bg: 'linear-gradient(90deg, #f59e0b, #fbbf24)', txt: '#78350f' },
  Admin:         { bg: 'linear-gradient(90deg, #3b82f6, #60a5fa)', txt: '#fff' },
  Disponible:    { bg: 'linear-gradient(90deg, #059669, #34d399)', txt: '#fff' },
  Offline:       { bg: 'linear-gradient(90deg, #64748b, #94a3b8)', txt: '#fff' },
};

/* ─── Helpers visuales ────────────────────────────────────────────────────── */

const getStatus = (u) => {
  if (!isOnline(u)) return { label: 'Offline', key: 'offline', dot: 'sv-dot-slate', color: '#94a3b8', bg: '#f1f5f9', txt: '#64748b' };
  const s = normalizeText(u.statusOperativo);
  if (s === 'ocupado')        return { label: 'En consulta', key: 'en_consulta', dot: 'sv-dot-red',   color: '#ef4444', bg: '#fef2f2', txt: '#dc2626' };
  if (s === 'comida')         return { label: 'Comida',      key: 'comida',      dot: 'sv-dot-amber', color: '#f59e0b', bg: '#fffbeb', txt: '#d97706' };
  if (s === 'administrativo')  return { label: 'Admin',       key: 'admin',       dot: 'sv-dot-blue',  color: '#3b82f6', bg: '#eff6ff', txt: '#2563eb' };
  return { label: 'Disponible', key: 'disponible', dot: 'sv-dot-green', color: '#10b981', bg: '#ecfdf5', txt: '#059669' };
};

const buildAsistenciaRow = (u, selectedDate, nowMs) => {
  const online = isOnline(u);
  const st = getStatus(u);
  const entrada = parseDateSafe(u.lastLogin);
  const lastSeen = parseDateSafe(u.lastSeen);
  const todayYmd = toDateInput(new Date(nowMs));
  const isToday = selectedDate === todayYmd;

  const entradaDelDia = entrada && isSameDate(entrada, selectedDate) ? entrada : null;
  const vistoDelDia = lastSeen && isSameDate(lastSeen, selectedDate) ? lastSeen : null;
  const tieneRegistro = Boolean(entradaDelDia || vistoDelDia || (online && isToday));

  // Salida solo si ya no está en línea y lastSeen cae en el día
  const salida = (!online && vistoDelDia) ? vistoDelDia : null;

  // Inicio de barra: lastLogin del día, o lastSeen si hay sesión viva sin login fechado hoy
  let inicioBarra = entradaDelDia;
  if (!inicioBarra && online && isToday) {
    inicioBarra = vistoDelDia || lastSeen || new Date(nowMs);
  } else if (!inicioBarra && vistoDelDia) {
    inicioBarra = vistoDelDia;
  }

  let finBarra = null;
  if (inicioBarra) {
    if (online && isToday) finBarra = new Date(nowMs);
    else if (salida) finBarra = salida;
    else if (vistoDelDia) finBarra = vistoDelDia;
    else finBarra = inicioBarra;
  }

  let duracionMin = null;
  if (inicioBarra && finBarra) {
    duracionMin = Math.max(0, Math.floor((finBarra.getTime() - inicioBarra.getTime()) / 60000));
  }

  let inactividadMin = null;
  if (lastSeen) {
    inactividadMin = Math.max(0, Math.floor((nowMs - lastSeen.getTime()) / 60000));
  }

  let comportamiento = 'Sin registro hoy';
  let compTone = { bg: '#f8fafc', txt: '#64748b', border: '#e2e8f0' };
  if (!tieneRegistro) {
    comportamiento = 'Sin asistencia registrada';
  } else if (online) {
    if (st.key === 'en_consulta') {
      comportamiento = 'Atendiendo consulta';
      compTone = { bg: '#fef2f2', txt: '#dc2626', border: '#fecaca' };
    } else if (st.key === 'comida') {
      comportamiento = 'En descanso / comida';
      compTone = { bg: '#fffbeb', txt: '#d97706', border: '#fde68a' };
    } else if (inactividadMin != null && inactividadMin >= 8) {
      comportamiento = `Inactivo ${inactividadMin} min (sin heartbeat)`;
      compTone = { bg: '#fff7ed', txt: '#ea580c', border: '#fed7aa' };
    } else {
      comportamiento = 'Activo en turno';
      compTone = { bg: '#ecfdf5', txt: '#059669', border: '#a7f3d0' };
    }
  } else if (salida) {
    comportamiento = `Salida registrada · offline ${fmtDuration(inactividadMin)}`;
    compTone = { bg: '#f1f5f9', txt: '#475569', border: '#e2e8f0' };
  } else if (vistoDelDia) {
    comportamiento = 'Actividad detectada (sesión cerrada)';
    compTone = { bg: '#eff6ff', txt: '#2563eb', border: '#bfdbfe' };
  }

  const leftPct = timelinePct(inicioBarra);
  const rightPct = timelinePct(finBarra);
  let barLeft = null;
  let barWidth = null;
  if (leftPct != null && rightPct != null) {
    barLeft = Math.min(leftPct, rightPct);
    barWidth = Math.max(0.4, Math.abs(rightPct - leftPct));
  } else if (leftPct != null) {
    barLeft = leftPct;
    barWidth = 0.6;
  }

  const barStyle = BAR_BY_STATUS[st.label] || BAR_BY_STATUS.Offline;
  const sucursal = u.sessionSucursalNombre || u.sucursalActual || u.sucursal || u.asignacionRecurrente || '—';
  const consultorio = u.sessionConsultorioNombre || u.consultorioActual || u.consultorio || '';
  const entradaMostrada = entradaDelDia || (online && isToday ? (entradaDelDia || inicioBarra) : null);

  return {
    id: u.id,
    nombre: u.nombre || 'Sin nombre',
    rol: u.rol || '',
    sucursal,
    consultorio,
    online,
    status: st,
    entrada: entradaMostrada,
    entradaRaw: entrada,
    salida,
    lastSeen,
    duracionMin,
    inactividadMin,
    tieneRegistro,
    comportamiento,
    compTone,
    barLeft,
    barWidth,
    barStyle,
    enTurno: online && isToday,
    filtroKey: !tieneRegistro ? 'sin_registro' : online ? st.key : 'offline',
  };
};

const MiniBar = ({ pct }) => {
  const c = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 44, height: 4, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: c, width: `${Math.min(100, pct)}%` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </div>
  );
};

const ScoreBadge = ({ score }) => {
  const s = score >= 80 ? { bg: '#ecfdf5', txt: '#059669', border: '#a7f3d0' }
    : score >= 40 ? { bg: '#eff6ff', txt: '#2563eb', border: '#bfdbfe' }
    : score >= 15 ? { bg: '#fffbeb', txt: '#d97706', border: '#fde68a' }
    : { bg: '#fef2f2', txt: '#dc2626', border: '#fecaca' };
  return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: s.bg, color: s.txt, border: `1px solid ${s.border}`, fontVariantNumeric: 'tabular-nums' }}>{score}</span>;
};

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.08)', fontSize: 11 }}>
      {label && <p style={{ fontWeight: 700, color: '#4b5563', margin: '0 0 6px', borderBottom: '1px solid #f3f4f6', paddingBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '2px 0', margin: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: p.fill || p.color, flexShrink: 0 }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 700, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

/* ─── Componente ───────────────────────────────────────────────────────────── */

const Supervision = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [selectedSucursal, setSelectedSucursal] = useState('todas');
  const [expandedSucursal, setExpandedSucursal] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const [asistSearch, setAsistSearch] = useState('');
  const [asistEstado, setAsistEstado] = useState('todas');
  const [asistRol, setAsistRol] = useState('todas');
  const [asistSort, setAsistSort] = useState('entrada');
  const [asistVista, setAsistVista] = useState('vivo'); // vivo | historial

  const [reportePeriodo, setReportePeriodo] = useState('dia');
  const [reporteRows, setReporteRows] = useState([]);
  const [reporteLoading, setReporteLoading] = useState(false);
  const [reporteError, setReporteError] = useState('');
  const [reporteMeta, setReporteMeta] = useState({ desde: '', hasta: '', label: '' });

  const [users, setUsers] = useState([]);
  const [citas, setCitas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [bitacoras, setBitacoras] = useState([]);
  const [sucursalesCat, setSucursalesCat] = useState([]);

  /* ── Reloj vivo (duración / inactividad) ── */
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ── Carga de historial (solo cuando se abre esa pestaña) ── */
  useEffect(() => {
    if (asistVista !== 'historial') return undefined;
    let cancelled = false;
    const meta = rangoParaPeriodo(reportePeriodo, selectedDate);
    setReporteMeta(meta);
    setReporteLoading(true);
    setReporteError('');
    fetchAsistenciaRango(meta.desde, meta.hasta)
      .then((rows) => {
        if (!cancelled) setReporteRows(rows);
      })
      .catch((err) => {
        console.error('Reporte asistencia:', err);
        if (!cancelled) {
          setReporteRows([]);
          setReporteError('No se pudo cargar el historial. Si es la primera vez, Firebase pedirá un índice compuesto.');
        }
      })
      .finally(() => {
        if (!cancelled) setReporteLoading(false);
      });
    return () => { cancelled = true; };
  }, [asistVista, reportePeriodo, selectedDate]);

  /* ── Suscripciones ── */

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, 'bitacorasLimpieza'), orderBy('fecha', 'desc')), (s) => setBitacoras(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, 'inventario'), (s) => setInventario(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc')), (s) => setSucursalesCat(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  useEffect(() => {
    setLoading(true);
    const u = onSnapshot(query(collection(db, 'citas'), where('fecha', '==', selectedDate)), (s) => {
      setCitas(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => u();
  }, [selectedDate]);

  /* ── Datos derivados ── */

  const personalOps = useMemo(() => users.filter(u => ROLES_OPS.has(normalizeText(u.rol))), [users]);
  const bitacorasDia = useMemo(() => bitacoras.filter(b => isSameDate(b.fecha, selectedDate)), [bitacoras, selectedDate]);

  const sucursalesOpts = useMemo(() => {
    const s = new Set();
    sucursalesCat.forEach(c => { if (c.nombre) s.add(c.nombre); });
    personalOps.forEach(u => { if (u.sucursal || u.asignacionRecurrente) s.add(u.sucursal || u.asignacionRecurrente); });
    citas.forEach(c => { if (c.sucursal) s.add(c.sucursal); });
    return [...s].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [sucursalesCat, personalOps, citas]);

  const fCitas = (arr) => selectedSucursal === 'todas' ? arr : arr.filter(c => (c.sucursal || 'Sin sucursal') === selectedSucursal);
  const fPersonal = (arr) => selectedSucursal === 'todas' ? arr : arr.filter(u => (u.sucursal || u.asignacionRecurrente || 'Sin sucursal') === selectedSucursal);

  /* ── KPIs ── */

  const kpis = useMemo(() => {
    const cf = fCitas(citas);
    const total = cf.length;
    const realizadas = cf.filter(c => EST_REALIZADAS.has(normalizeText(c.estado))).length;
    const canceladas = cf.filter(c => EST_CANCELADAS.has(normalizeText(c.estado))).length;
    const enCurso = cf.filter(c => normalizeText(c.estado) === 'en_consulta').length;
    const pendientes = Math.max(total - realizadas - canceladas - enCurso, 0);
    const ingresos = cf.reduce((a, c) => a + Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0), 0);
    const tasa = total > 0 ? Math.round((realizadas * 100) / total) : 0;
    const prom = realizadas > 0 ? ingresos / realizadas : 0;

    const pf = fPersonal(personalOps);
    const online = pf.filter(u => isOnline(u)).length;
    const totalP = users.length;
    const enConsulta = pf.filter(u => isOnline(u) && normalizeText(u.statusOperativo) === 'ocupado').length;
    const enComida = pf.filter(u => isOnline(u) && normalizeText(u.statusOperativo) === 'comida').length;

    const criticos = inventario.filter(item => {
      const stock = Number(item.stock || 0);
      const min = Number(item.stockMinimo || item.minimo || 10);
      return stock <= min;
    });
    const hoy = new Date();
    const lim = new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());
    const porCaducar = inventario.filter(item => {
      if (!item.caducidad) return false;
      const cad = parseDateSafe(item.caducidad);
      return cad && cad <= lim;
    });

    const bf = selectedSucursal === 'todas' ? bitacorasDia : bitacorasDia.filter(b => (b.sucursal || 'Sin sucursal') === selectedSucursal);
    const sinEv = bf.filter(b => !b.fotoUrl).length;

    return { total, realizadas, canceladas, enCurso, pendientes, ingresos, tasa, prom, online, totalP, enConsulta, enComida, criticos: criticos.length, itemsCriticos: criticos, porCaducar: porCaducar.length, itemsPorCaducar: porCaducar, bitacorasCount: bf.length, sinEv };
  }, [citas, users, personalOps, inventario, bitacorasDia, selectedSucursal]);

  /* ── Charts ── */

  const estadoData = useMemo(() => {
    const g = { Realizadas: { color: ING_COLORS.emerald, count: 0 }, 'En consulta': { color: ING_COLORS.blue, count: 0 }, 'En espera': { color: ING_COLORS.amber, count: 0 }, Programadas: { color: ING_COLORS.slate, count: 0 }, Canceladas: { color: ING_COLORS.rose, count: 0 } };
    fCitas(citas).forEach(c => {
      const e = normalizeText(c.estado);
      if (EST_REALIZADAS.has(e)) g['Realizadas'].count++;
      else if (e === 'en_consulta') g['En consulta'].count++;
      else if (e === 'en_espera' || e === 'en_triage') g['En espera'].count++;
      else if (EST_CANCELADAS.has(e)) g['Canceladas'].count++;
      else g['Programadas'].count++;
    });
    return Object.entries(g).filter(([, v]) => v.count > 0).map(([name, v]) => ({ name, value: v.count, color: v.color }));
  }, [citas, selectedSucursal]);

  const flujoPorHora = useMemo(() => {
    const horas = {};
    for (let h = 7; h <= 21; h++) horas[h] = { hora: `${String(h).padStart(2, '0')}h`, realizadas: 0, otras: 0 };
    fCitas(citas).forEach(c => {
      const raw = getHour(c);
      if (!raw) return;
      const h = parseInt(String(raw).slice(0, 2), 10);
      if (h < 7 || h > 21) return;
      if (EST_REALIZADAS.has(normalizeText(c.estado))) horas[h].realizadas++;
      else horas[h].otras++;
    });
    return Object.values(horas);
  }, [citas, selectedSucursal]);

  const ingresosPorHora = useMemo(() => {
    const horas = {};
    for (let h = 7; h <= 21; h++) horas[h] = { hora: `${String(h).padStart(2, '0')}h`, ingresos: 0 };
    fCitas(citas).filter(c => EST_REALIZADAS.has(normalizeText(c.estado))).forEach(c => {
      const raw = getHour(c);
      if (!raw) return;
      const h = parseInt(String(raw).slice(0, 2), 10);
      if (h >= 7 && h <= 21) horas[h].ingresos += Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0);
    });
    let acc = 0;
    return Object.values(horas).map(r => { acc += r.ingresos; return { hora: r.hora, ingresos: acc }; });
  }, [citas, selectedSucursal]);

  /* ── Sucursales ── */

  const sucursalesRows = useMemo(() => {
    const map = new Map();
    citas.forEach(c => {
      const k = c.sucursal || 'Sin sucursal';
      if (!map.has(k)) map.set(k, { sucursal: k, citas: 0, realizadas: 0, canceladas: 0, ingresos: 0, medicos: new Set() });
      const r = map.get(k);
      r.citas++;
      if (EST_REALIZADAS.has(normalizeText(c.estado))) r.realizadas++;
      if (EST_CANCELADAS.has(normalizeText(c.estado))) r.canceladas++;
      r.ingresos += Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0);
      if (c.doctorUid || c.doctorId) r.medicos.add(c.doctorUid || c.doctorId);
    });
    personalOps.forEach(u => {
      const k = u.sucursal || u.asignacionRecurrente || 'Sin sucursal';
      if (!map.has(k)) map.set(k, { sucursal: k, citas: 0, realizadas: 0, canceladas: 0, ingresos: 0, medicos: new Set() });
      const r = map.get(k);
      r._personal = (r._personal || 0) + 1;
      if (isOnline(u)) r._online = (r._online || 0) + 1;
    });
    inventario.forEach(item => {
      const k = item.sucursal || 'Sin sucursal';
      if (!map.has(k)) map.set(k, { sucursal: k, citas: 0, realizadas: 0, canceladas: 0, ingresos: 0, medicos: new Set() });
      const r = map.get(k);
      const stock = Number(item.stock || 0);
      const min = Number(item.stockMinimo || item.minimo || 10);
      r._invTot = (r._invTot || 0) + stock;
      if (stock <= min) r._invCrit = (r._invCrit || 0) + 1;
    });
    bitacorasDia.forEach(b => {
      const k = b.sucursal || 'Sin sucursal';
      if (!map.has(k)) map.set(k, { sucursal: k, citas: 0, realizadas: 0, canceladas: 0, ingresos: 0, medicos: new Set() });
      const r = map.get(k);
      r._bitacoras = (r._bitacoras || 0) + 1;
      if (!b.fotoUrl) r._sinEv = (r._sinEv || 0) + 1;
    });
    return Array.from(map.values()).map(r => ({ ...r, medicos: undefined, _medicosCount: r.medicos?.size || 0 })).sort((a, b) => b.ingresos - a.ingresos);
  }, [citas, personalOps, inventario, bitacorasDia]);

  /* ── Médicos ── */

  const medicosRows = useMemo(() => {
    const map = new Map();
    fCitas(citas).forEach(c => {
      const id = c.doctorUid || c.doctorId || 'sin-id';
      const nombreCita = c.doctorNombre || c.doctorAsignado || '';
      if (!map.has(id)) {
        map.set(id, {
          id,
          nombre: nombreCita || (id === 'sin-id' ? 'Sin asignar' : 'Médico'),
          citas: 0,
          realizadas: 0,
          ingresos: 0,
          sucursal: c.sucursal || '',
        });
      }
      const r = map.get(id);
      r.citas++;
      if (EST_REALIZADAS.has(normalizeText(c.estado))) r.realizadas++;
      r.ingresos += Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? c.ingreso ?? 0);
      if (nombreCita && (r.nombre === 'Médico' || r.nombre === 'Sin asignar')) r.nombre = nombreCita;
      if (c.sucursal && !r.sucursal) r.sucursal = c.sucursal;
    });
    users.forEach(u => {
      const rol = normalizeText(u.rol);
      if (!rol.includes('medico') && !rol.includes('doctor')) return;
      if (!map.has(u.id)) {
        // Médico operativo sin citas del día: no lo metemos en la tabla de productividad
        return;
      }
      const r = map.get(u.id);
      r.online = isOnline(u);
      if (u.nombre) r.nombre = u.nombre;
      r.sucursal = r.sucursal || u.sucursal || u.asignacionRecurrente || '';
    });
    return Array.from(map.values())
      .map(r => {
        const tasa = r.citas > 0 ? Math.round((r.realizadas * 100) / r.citas) : null;
        const prom = r.realizadas > 0 ? r.ingresos / r.realizadas : 0;
        const score = Math.min(100, Math.round(((r.realizadas * 15) + (tasa || 0) * 0.5 + Math.min(r.ingresos / 100, 30)) / 200 * 100));
        return { ...r, tasa, prom, score };
      })
      .sort((a, b) => {
        if (a.id === 'sin-id') return 1;
        if (b.id === 'sin-id') return -1;
        return b.ingresos - a.ingresos;
      });
  }, [citas, users, selectedSucursal]);

  const medicosChart = useMemo(() => (
    medicosRows
      .filter(m => m.id !== 'sin-id')
      .slice(0, 8)
      .map(m => ({
        nombre: shortName(m.nombre, 2),
        realizadas: m.realizadas,
        ingresos: Math.round(m.ingresos),
      }))
  ), [medicosRows]);

  /* ── Asistencia ── */

  const asistenciaRows = useMemo(() => {
    return fPersonal(personalOps).map(u => buildAsistenciaRow(u, selectedDate, nowMs));
  }, [personalOps, selectedSucursal, selectedDate, nowMs]);

  const asistKpis = useMemo(() => {
    const presentes = asistenciaRows.filter(r => r.tieneRegistro).length;
    const enLinea = asistenciaRows.filter(r => r.online).length;
    const enConsulta = asistenciaRows.filter(r => r.status.key === 'en_consulta').length;
    const enComida = asistenciaRows.filter(r => r.status.key === 'comida').length;
    const sinRegistro = asistenciaRows.filter(r => !r.tieneRegistro).length;
    const inactivos = asistenciaRows.filter(r => r.online && r.inactividadMin != null && r.inactividadMin >= 8).length;
    const avgDur = (() => {
      const withDur = asistenciaRows.filter(r => r.duracionMin != null);
      if (!withDur.length) return null;
      return Math.round(withDur.reduce((a, r) => a + r.duracionMin, 0) / withDur.length);
    })();
    return { presentes, enLinea, enConsulta, enComida, sinRegistro, inactivos, avgDur, total: asistenciaRows.length };
  }, [asistenciaRows]);

  const asistenciaChart = useMemo(() => ([
    { name: 'Con registro', value: asistKpis.presentes, color: ING_COLORS.emerald },
    { name: 'Sin registro', value: asistKpis.sinRegistro, color: ING_COLORS.amber },
  ].filter(d => d.value > 0)), [asistKpis.presentes, asistKpis.sinRegistro]);

  const personalChart = useMemo(() => ([
    { name: 'En línea', value: asistKpis.enLinea, color: ING_COLORS.emerald },
    { name: 'Offline', value: Math.max(0, asistKpis.total - asistKpis.enLinea), color: ING_COLORS.slate },
  ].filter(d => d.value > 0)), [asistKpis.enLinea, asistKpis.total]);

  const inventarioChart = useMemo(() => {
    const ok = Math.max(0, inventario.length - kpis.criticos);
    return [
      { name: 'Estable', value: ok, color: ING_COLORS.emerald },
      { name: 'Crítico', value: kpis.criticos, color: ING_COLORS.rose },
      { name: 'Por caducar', value: kpis.porCaducar, color: ING_COLORS.amber },
    ].filter(d => d.value > 0);
  }, [inventario.length, kpis.criticos, kpis.porCaducar]);

  const asistRoles = useMemo(() => {
    const set = new Set();
    asistenciaRows.forEach(r => { if (r.rol) set.add(normalizeText(r.rol)); });
    return [...set].sort();
  }, [asistenciaRows]);

  const asistenciaFilt = useMemo(() => {
    const term = normalizeText(asistSearch);
    let list = [...asistenciaRows];
    if (asistEstado === 'sin_registro') list = list.filter(r => !r.tieneRegistro);
    else if (asistEstado === 'en_linea') list = list.filter(r => r.online);
    else if (asistEstado === 'offline') list = list.filter(r => r.tieneRegistro && !r.online);
    else if (asistEstado !== 'todas') list = list.filter(r => r.filtroKey === asistEstado);

    if (asistRol !== 'todas') list = list.filter(r => normalizeText(r.rol) === asistRol);
    if (term) {
      list = list.filter(r => normalizeText(`${r.nombre} ${r.rol} ${r.sucursal} ${r.consultorio}`).includes(term));
    }

    list.sort((a, b) => {
      if (asistSort === 'nombre') return String(a.nombre).localeCompare(String(b.nombre), 'es');
      if (asistSort === 'duracion') return (b.duracionMin || 0) - (a.duracionMin || 0);
      if (asistSort === 'estado') {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return String(a.status.label).localeCompare(String(b.status.label), 'es');
      }
      // entrada: con registro primero, luego por hora de entrada
      if (a.tieneRegistro !== b.tieneRegistro) return a.tieneRegistro ? -1 : 1;
      const ae = a.entrada?.getTime?.() || a.entradaRaw?.getTime?.() || Infinity;
      const be = b.entrada?.getTime?.() || b.entradaRaw?.getTime?.() || Infinity;
      return ae - be;
    });
    return list;
  }, [asistenciaRows, asistSearch, asistEstado, asistRol, asistSort]);

  const nowLinePct = useMemo(() => {
    if (selectedDate !== toDateInput(new Date(nowMs))) return null;
    return timelinePct(new Date(nowMs));
  }, [selectedDate, nowMs]);

  const reporteFilt = useMemo(() => {
    const term = normalizeText(asistSearch);
    let list = [...reporteRows];

    // En vista "Día": mostrar TODO el personal operativo; sin bitácora = sin registro
    if (reportePeriodo === 'dia') {
      const byUid = new Map();
      list.forEach((r) => {
        if (r.userId) byUid.set(r.userId, r);
      });
      fPersonal(personalOps).forEach((u) => {
        if (byUid.has(u.id)) return;
        byUid.set(u.id, {
          id: `sin-${u.id}-${selectedDate}`,
          userId: u.id,
          fecha: selectedDate,
          nombre: u.nombre || 'Sin nombre',
          email: u.email || '',
          rol: u.rol || '',
          sucursal: u.sessionSucursalNombre || u.sucursalActual || u.sucursal || u.asignacionRecurrente || '',
          consultorio: u.sessionConsultorioNombre || u.consultorioActual || u.consultorio || '',
          primeraEntrada: null,
          ultimaEntrada: null,
          ultimaActividad: null,
          ultimaSalida: null,
          sesiones: 0,
          minutosEstimados: null,
          activo: false,
          sinRegistro: true,
        });
      });
      list = Array.from(byUid.values());
    }

    if (selectedSucursal !== 'todas') {
      list = list.filter(r => (r.sucursal || 'Sin sucursal') === selectedSucursal);
    }
    if (term) {
      list = list.filter(r => normalizeText(`${r.nombre} ${r.rol} ${r.sucursal} ${r.email}`).includes(term));
    }
    return list.sort((a, b) => {
      const aOk = !a.sinRegistro && a.primeraEntrada;
      const bOk = !b.sinRegistro && b.primeraEntrada;
      if (aOk !== bOk) return aOk ? -1 : 1;
      const fd = String(a.fecha || '').localeCompare(String(b.fecha || ''));
      if (fd !== 0) return fd;
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    });
  }, [reporteRows, asistSearch, selectedSucursal, reportePeriodo, selectedDate, personalOps]);

  const reporteStats = useMemo(() => {
    const personas = new Set(reporteFilt.map(r => r.userId)).size;
    const dias = new Set(reporteFilt.map(r => r.fecha)).size;
    const sesiones = reporteFilt.reduce((a, r) => a + Number(r.sesiones || 0), 0);
    const conEntrada = reporteFilt.filter(r => r.primeraEntrada && !r.sinRegistro).length;
    const sinRegistro = reporteFilt.filter(r => r.sinRegistro || !r.primeraEntrada).length;
    return { personas, dias, sesiones, registros: reporteFilt.length, conEntrada, sinRegistro };
  }, [reporteFilt]);

  const exportarReporte = () => {
    const csv = buildAsistenciaCsv(reporteFilt, reporteMeta);
    const name = `asistencia_${reportePeriodo}_${reporteMeta.desde}_${reporteMeta.hasta}.csv`;
    downloadCsv(name, csv);
  };

  const citasDiaLabel = useMemo(() => {
    try { return new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return selectedDate; }
  }, [selectedDate]);

  /* ── Render ── */

  const panel = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  };
  const panelHead = {
    padding: '12px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
    fontSize: 13,
    fontWeight: 700,
    color: '#111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  };
  const thStyle = {
    textAlign: 'left',
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  };
  const td = { padding: '10px 16px', fontSize: 13, color: '#4b5563' };
  const tdStrong = { ...td, fontWeight: 600, color: '#111' };
  const inputBox = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '6px 12px',
    background: '#fff',
  };
  const ghostBtn = {
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#111',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  };

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '32px 28px 48px' }}>

        {/* ── CABECERA ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
              Supervisión operativa
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Operación, productividad y asistencia · {citasDiaLabel}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={inputBox}>
              <Calendar size={14} style={{ color: '#6b7280' }} />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#111', background: 'transparent' }}
              />
            </div>
            <div style={inputBox}>
              <MapPin size={14} style={{ color: '#6b7280' }} />
              <select
                value={selectedSucursal}
                onChange={e => setSelectedSucursal(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: 13, color: '#111', background: 'transparent', cursor: 'pointer', maxWidth: 220 }}
              >
                <option value="todas">Todas las sucursales</option>
                {sucursalesOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── PANEL GRÁFICO (resumen conectado) ── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Estado de citas */}
            <div style={panel}>
              <div style={panelHead}>
                <span>Estado de citas</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{kpis.total} · cierre {kpis.tasa}% · {fmtMXN(kpis.ingresos)}</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '160px 1fr', gap: 8, alignItems: 'center' }}>
                {estadoData.length === 0 ? (
                  <div style={{ height: 140, gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Sin citas</div>
                ) : (
                  <>
                    <div style={{ position: 'relative', height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={estadoData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" paddingAngle={1} strokeWidth={0}>
                            {estadoData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <RechartsTip content={<CustomTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {estadoData.map(d => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4b5563' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                            {d.name}
                          </span>
                          <strong style={{ fontSize: 13, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{d.value}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Asistencia + Personal */}
            <div style={panel}>
              <div style={panelHead}>
                <span>Asistencia y presencia</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{asistKpis.enLinea}/{asistKpis.total} en línea</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Registro hoy</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={asistenciaChart.length ? asistenciaChart : [{ name: '—', value: 1, color: '#e5e7eb' }]} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" paddingAngle={1} strokeWidth={0}>
                        {(asistenciaChart.length ? asistenciaChart : [{ color: '#e5e7eb' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RechartsTip content={<CustomTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11, color: '#6b7280' }}>
                    <span><strong style={{ color: '#059669' }}>{asistKpis.presentes}</strong> con reg.</span>
                    <span><strong style={{ color: '#d97706' }}>{asistKpis.sinRegistro}</strong> sin</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>En línea</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={personalChart.length ? personalChart : [{ name: '—', value: 1, color: '#e5e7eb' }]} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" paddingAngle={1} strokeWidth={0}>
                        {(personalChart.length ? personalChart : [{ color: '#e5e7eb' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RechartsTip content={<CustomTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11, color: '#6b7280' }}>
                    <span><strong style={{ color: '#059669' }}>{asistKpis.enLinea}</strong> online</span>
                    <span><strong style={{ color: '#94a3b8' }}>{Math.max(0, asistKpis.total - asistKpis.enLinea)}</strong> off</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flujo */}
            <div style={panel}>
              <div style={panelHead}><span>Flujo de atención</span></div>
              <div style={{ padding: '12px 8px 8px 4px' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={flujoPorHora} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="hora" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                    <RechartsTip content={<CustomTip />} />
                    <Bar dataKey="realizadas" name="Realizadas" fill={ING_COLORS.emerald} radius={[2, 2, 0, 0]} stackId="a" />
                    <Bar dataKey="otras" name="Otras" fill={ING_COLORS.slate} radius={[2, 2, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ingresos + inventario mini */}
            <div style={panel}>
              <div style={panelHead}>
                <span>Ingresos del día</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{fmtMXN(kpis.ingresos)}</span>
              </div>
              <div style={{ padding: '12px 8px 8px 4px' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={ingresosPorHora} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="svIngGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#111" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#111" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="hora" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <RechartsTip content={<CustomTip />} formatter={v => fmtMXN(v)} />
                    <Area type="monotone" dataKey="ingresos" name="Acumulado" stroke="#111" strokeWidth={2} fill="url(#svIngGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
                {inventarioChart.length > 0 && (
                  <div style={{ display: 'flex', gap: 14, padding: '4px 12px 8px', borderTop: '1px solid #f3f4f6', marginTop: 4 }}>
                    {inventarioChart.map(d => (
                      <span key={d.name} style={{ fontSize: 11, color: '#6b7280' }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: d.color, marginRight: 5 }} />
                        {d.name} <strong style={{ color: '#111' }}>{d.value}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SUCURSALES + MÉDICOS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={panel}>
            <div style={panelHead}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={14} style={{ color: '#9ca3af' }} /> Sucursales
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>{sucursalesRows.length}</span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 380 }} className="sv-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ background: '#fafafa', position: 'sticky', top: 0, zIndex: 2 }}>
                    {['Sucursal', 'Citas', 'Realizadas', 'Cierre', 'Ingreso', 'Personal', 'Stock', 'Limpieza'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sucursalesRows.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>Sin datos</td></tr>
                  )}
                  {sucursalesRows.map(s => {
                    const tasa = s.citas > 0 ? Math.round((s.realizadas * 100) / s.citas) : 0;
                    return (
                      <tr key={s.sucursal} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => setExpandedSucursal(expandedSucursal === s.sucursal ? null : s.sucursal)}>
                        <td style={tdStrong}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {expandedSucursal === s.sucursal ? <ChevronDown size={12} style={{ color: '#9ca3af' }} /> : <ChevronRight size={12} style={{ color: '#9ca3af' }} />}
                            {s.sucursal}
                          </span>
                        </td>
                        <td style={td}>{s.citas}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#059669' }}>{s.realizadas}</td>
                        <td style={td}><MiniBar pct={tasa} /></td>
                        <td style={{ ...td, fontWeight: 600, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{fmtMXN(s.ingresos)}</td>
                        <td style={td}>{s._online || 0}/{s._personal || 0}</td>
                        <td style={{ ...td, fontWeight: 600, color: (s._invCrit || 0) > 0 ? '#dc2626' : '#059669' }}>{s._invCrit || 0}</td>
                        <td style={{ ...td, color: (s._sinEv || 0) > 0 ? '#dc2626' : '#059669' }}>{s._bitacoras || 0}{(s._sinEv || 0) > 0 ? ' · sin ev.' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={panel}>
            <div style={panelHead}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Stethoscope size={14} style={{ color: '#9ca3af' }} /> Productividad médica
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
                {medicosRows.filter(m => m.id !== 'sin-id').length} médicos
              </span>
            </div>
            {medicosChart.length > 0 && (
              <div style={{ padding: '8px 8px 0 0', borderBottom: '1px solid #f3f4f6' }}>
                <ResponsiveContainer width="100%" height={Math.max(120, medicosChart.length * 28)}>
                  <BarChart data={medicosChart} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nombre" width={90} tick={{ fontSize: 11, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                    <RechartsTip content={<CustomTip />} />
                    <Bar dataKey="realizadas" name="Realizadas" fill={ING_COLORS.emerald} radius={[0, 3, 3, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ overflowX: 'auto', maxHeight: 280 }} className="sv-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead>
                  <tr style={{ background: '#fafafa', position: 'sticky', top: 0, zIndex: 2 }}>
                    {['Médico', 'Estado', 'Citas', 'Realizadas', 'Cierre', 'Ingreso', 'Prom.', 'Score'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medicosRows.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>Sin médicos con actividad</td></tr>
                  )}
                  {medicosRows.map(m => {
                    const st = m.online !== undefined
                      ? (m.online ? { label: 'En línea', dot: 'sv-dot-green', txt: '#059669' } : { label: 'Offline', dot: 'sv-dot-slate', txt: '#94a3b8' })
                      : { label: '—', dot: 'sv-dot-slate', txt: '#cbd5e1' };
                    return (
                      <tr
                        key={m.id}
                        style={{ borderBottom: '1px solid #f3f4f6', cursor: m.id !== 'sin-id' ? 'pointer' : 'default', opacity: m.id === 'sin-id' ? 0.7 : 1 }}
                        onClick={() => {
                          if (m.id !== 'sin-id') navigate(`/admin/usuarios/${m.id}`, { state: { from: '/admin/supervision' } });
                        }}
                      >
                        <td style={tdStrong}>{shortName(m.nombre)}</td>
                        <td style={td}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: st.txt }}>
                            <span className={`sv-dot ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{m.citas}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{m.realizadas}</td>
                        <td style={td}>{m.citas > 0 ? <MiniBar pct={m.tasa || 0} /> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{fmtMXN(m.ingresos)}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{m.prom > 0 ? fmtMXN(m.prom) : '—'}</td>
                        <td style={td}>{m.citas > 0 ? <ScoreBadge score={m.score} /> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── INVENTARIO CRÍTICO ── */}
        <div style={{ ...panel, borderColor: kpis.criticos > 0 ? '#fecaca' : '#e5e7eb', marginBottom: 24 }}>
          <div style={{ ...panelHead, background: kpis.criticos > 0 ? '#fef2f2' : '#fafafa', borderBottomColor: kpis.criticos > 0 ? '#fecaca' : '#e5e7eb' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: kpis.criticos > 0 ? '#dc2626' : '#111' }}>
              <AlertTriangle size={14} style={{ color: kpis.criticos > 0 ? '#dc2626' : '#9ca3af' }} /> Inventario crítico
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: kpis.criticos > 0 ? '#dc2626' : '#9ca3af' }}>{kpis.criticos} items</span>
          </div>
          {kpis.itemsCriticos.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <CheckCircle2 size={15} /> Inventario estable
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', maxHeight: 220, overflowY: 'auto' }} className="sv-scrollbar">
              {kpis.itemsCriticos.slice(0, 20).map(item => {
                const stock = Number(item.stock || 0);
                const minimo = Number(item.stockMinimo || item.minimo || 10);
                const costo = Number(item.costo || item.precio || 0);
                const pct = Math.min(100, Math.round((stock / Math.max(minimo, 1)) * 100));
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid #f3f4f6', borderRight: isMobile ? 'none' : '1px solid #f3f4f6' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{item.nombre || item.medicamento || 'Insumo'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{item.sucursal || 'General'}</span>
                        <div style={{ width: 48, height: 3, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: pct <= 10 ? '#dc2626' : '#f59e0b', width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: stock === 0 ? '#dc2626' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>{stock}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>min {minimo} · {fmtMXN(stock * costo)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ASISTENCIA ── */}
        <div style={{ ...panel, marginBottom: 24 }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Asistencia</span>
                  <div className="sv-seg">
                    <button type="button" className={asistVista === 'vivo' ? 'on' : ''} onClick={() => setAsistVista('vivo')}>En vivo</button>
                    <button type="button" className={asistVista === 'historial' ? 'on' : ''} onClick={() => setAsistVista('historial')}>Historial / CSV</button>
                  </div>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  {asistVista === 'vivo'
                    ? 'Entrada, salida, turno e inactividad en tiempo real'
                    : `${reporteMeta.label || '—'} · primera y última entrada del día`}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ ...inputBox, padding: '5px 10px 5px 10px', position: 'relative' }}>
                  <Search size={13} style={{ color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={asistSearch}
                    onChange={e => setAsistSearch(e.target.value)}
                    placeholder="Buscar persona..."
                    style={{ border: 'none', outline: 'none', fontSize: 12, width: 140, background: 'transparent', color: '#111' }}
                  />
                </div>
                {asistVista === 'vivo' && (
                  <>
                    <select value={asistRol} onChange={e => setAsistRol(e.target.value)} style={{ ...ghostBtn, padding: '6px 10px' }}>
                      <option value="todas">Todos los roles</option>
                      {asistRoles.map(r => <option key={r} value={r}>{rolLabel(r)}</option>)}
                    </select>
                    <select value={asistSort} onChange={e => setAsistSort(e.target.value)} style={{ ...ghostBtn, padding: '6px 10px' }}>
                      <option value="entrada">Orden: entrada</option>
                      <option value="nombre">Orden: nombre</option>
                      <option value="duracion">Orden: duración</option>
                      <option value="estado">Orden: estado</option>
                    </select>
                  </>
                )}
                {asistVista === 'historial' && (
                  <>
                    <div className="sv-seg">
                      {[
                        { key: 'dia', label: 'Día' },
                        { key: 'semana', label: 'Semana' },
                        { key: 'quincena', label: 'Quincena' },
                        { key: 'mes', label: 'Mes' },
                      ].map(p => (
                        <button key={p.key} type="button" className={reportePeriodo === p.key ? 'on' : ''} onClick={() => setReportePeriodo(p.key)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={exportarReporte} disabled={reporteFilt.length === 0} style={{ ...ghostBtn, opacity: reporteFilt.length ? 1 : 0.45, cursor: reporteFilt.length ? 'pointer' : 'not-allowed' }}>
                      <Download size={13} /> CSV
                    </button>
                  </>
                )}
              </div>
            </div>

            {asistVista === 'vivo' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'todas', label: 'Todos', count: asistKpis.total },
                  { key: 'en_linea', label: 'En línea', count: asistKpis.enLinea },
                  { key: 'en_consulta', label: 'En consulta', count: asistKpis.enConsulta },
                  { key: 'comida', label: 'Comida', count: asistKpis.enComida },
                  { key: 'offline', label: 'Ya salieron', count: asistenciaRows.filter(r => r.tieneRegistro && !r.online).length },
                  { key: 'sin_registro', label: 'Sin registro', count: asistKpis.sinRegistro },
                ].map(chip => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setAsistEstado(chip.key)}
                    style={{
                      ...ghostBtn,
                      background: asistEstado === chip.key ? '#111' : '#fff',
                      color: asistEstado === chip.key ? '#fff' : '#4b5563',
                      borderColor: asistEstado === chip.key ? '#111' : '#d1d5db',
                    }}
                  >
                    {chip.label} <span style={{ opacity: 0.7 }}>{chip.count}</span>
                  </button>
                ))}
              </div>
            )}

            {asistVista === 'historial' && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Personas', value: reporteStats.personas },
                  { label: 'Con entrada', value: reporteStats.conEntrada },
                  { label: 'Sin registro', value: reporteStats.sinRegistro },
                  { label: 'Sesiones', value: reporteStats.sesiones },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {asistVista === 'vivo' && !isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 240px', gap: 12, padding: '8px 20px', borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Persona</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {HOUR_TICKS.filter((_, i) => i % 2 === 0).map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}h</span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                <span>Entrada</span><span>Salida</span><span>Duración</span>
              </div>
            </div>
          )}

          {asistVista === 'vivo' && (
            <div style={{ maxHeight: 520, overflowY: 'auto' }} className="sv-scrollbar">
              {asistenciaFilt.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>Sin personal con estos filtros</div>
              )}
              {asistenciaFilt.map(row => {
                const bar = row.barStyle;
                return (
                  <div
                    key={row.id}
                    onClick={() => navigate(`/admin/usuarios/${row.id}`, { state: { from: '/admin/supervision' } })}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '200px 1fr 240px',
                      gap: isMobile ? 8 : 12,
                      padding: '10px 20px',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      background: row.online && row.inactividadMin >= 8 ? '#fffbeb' : '#fff',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = row.online && row.inactividadMin >= 8 ? '#fffbeb' : '#fff'; }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shortName(row.nombre, 3)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {rolLabel(row.rol)} · {row.sucursal}
                      </div>
                      <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: row.status.txt }}>
                        <span className={`sv-dot ${row.status.dot}`} />
                        {row.comportamiento}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                      <div className="sv-tl-track">
                        <div className="sv-tl-grid" />
                        {nowLinePct != null && <div className="sv-tl-now" style={{ left: `${nowLinePct}%` }} />}
                        {row.barLeft != null && row.barWidth != null ? (
                          <div className="sv-tl-bar" style={{ left: `${row.barLeft}%`, width: `${row.barWidth}%`, background: bar.bg.includes('gradient') ? (row.enTurno ? '#059669' : '#64748b') : bar.bg }} />
                        ) : (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#cbd5e1', fontWeight: 600 }}>
                            Sin sesión
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                          <span>{fmtTime(row.entrada)}</span>
                          <span>{row.enTurno ? 'En curso' : fmtTime(row.salida)}</span>
                          <span>{fmtDuration(row.duracionMin)}</span>
                        </div>
                      )}
                    </div>

                    {!isMobile && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(row.entrada)}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>entrada</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: row.enTurno ? '#059669' : '#111', fontVariantNumeric: 'tabular-nums' }}>
                            {row.enTurno ? 'En curso' : fmtTime(row.salida)}
                          </div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>{row.enTurno ? 'activo' : 'salida'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(row.duracionMin)}</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>{row.online ? `ping ${fmtTime(row.lastSeen)}` : (row.lastSeen ? `visto ${fmtTime(row.lastSeen)}` : '—')}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {asistVista === 'historial' && (
            <div style={{ overflowX: 'auto', maxHeight: 520 }} className="sv-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                <thead>
                  <tr style={{ background: '#fafafa', position: 'sticky', top: 0, zIndex: 2 }}>
                    {['Fecha', 'Persona', 'Rol', 'Sucursal', '1ª entrada', 'Últ. entrada', 'Últ. salida', 'Sesiones', 'Tiempo', ''].map(h => (
                      <th key={h || 'perfil'} style={thStyle}>{h || 'Perfil'}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reporteLoading && (
                    <tr>
                      <td colSpan={10} style={{ padding: '36px 0', textAlign: 'center' }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#64748b', animation: 'svSpin .8s linear infinite', margin: '0 auto 8px' }} />
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>Cargando historial...</span>
                      </td>
                    </tr>
                  )}
                  {!reporteLoading && reporteError && (
                    <tr><td colSpan={10} style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: '#dc2626' }}>{reporteError}</td></tr>
                  )}
                  {!reporteLoading && !reporteError && reporteFilt.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>Sin registros en este periodo</td></tr>
                  )}
                  {!reporteLoading && reporteFilt.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: r.sinRegistro ? '#fafafa' : '#fff' }}>
                      <td style={{ ...td, fontWeight: 600, color: '#111', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.fecha}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: '#111' }}>{shortName(r.nombre, 3)}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.email || '—'}</div>
                      </td>
                      <td style={td}>{rolLabel(r.rol)}</td>
                      <td style={td}>{r.sucursal || '—'}</td>
                      {r.sinRegistro || !r.primeraEntrada ? (
                        <td colSpan={5} style={td}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#c2410c' }}>Sin registro de asistencia</span>
                        </td>
                      ) : (
                        <>
                          <td style={{ ...td, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.primeraEntrada)}</td>
                          <td style={{ ...td, fontWeight: 700, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.ultimaEntrada)}</td>
                          <td style={{ ...td, fontWeight: 700, color: r.activo ? '#059669' : '#111', fontVariantNumeric: 'tabular-nums' }}>
                            {r.activo ? 'En curso' : fmtTime(r.ultimaSalida)}
                          </td>
                          <td style={{ ...td, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.sesiones || 1}</td>
                          <td style={{ ...td, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(r.minutosEstimados)}</td>
                        </>
                      )}
                      <td style={td}>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/usuarios/${r.userId}`, { state: { from: '/admin/supervision' } })}
                          style={ghostBtn}
                        >
                          Perfil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PIE ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Actualización automática · datos en tiempo real</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'Dashboard', icon: Activity, path: '/admin/dashboard' },
              { label: 'Monitor', icon: BarChart2, path: '/admin/monitor' },
              { label: 'Inventario', icon: Package, path: '/admin/inventario' },
            ].map(btn => (
              <button key={btn.label} type="button" onClick={() => navigate(btn.path)} style={ghostBtn}>
                <btn.icon size={12} style={{ color: '#9ca3af' }} /> {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Supervision;
