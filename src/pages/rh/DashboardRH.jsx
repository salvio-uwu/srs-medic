import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart2, Briefcase, Calendar,
  DollarSign, HeartPulse, MapPin, Package, Percent,
  Sparkles, TrendingUp, Users
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTip
} from 'recharts';
import { db } from '../../config/firebase';
import { isUserOnline, getConnectedMinutes, fmtMinutes } from '../../hooks/useMonitorData';
import useIsMobile from '../../hooks/useIsMobile';

/* ─── CSS ─────────────────────────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

  .rh-fade-up { animation: rhFadeUp .55s cubic-bezier(.16,1,.3,1) both; }
  .rh-fade-up:nth-child(1) { animation-delay: 0s; }
  .rh-fade-up:nth-child(2) { animation-delay: .06s; }
  .rh-fade-up:nth-child(3) { animation-delay: .12s; }
  .rh-fade-up:nth-child(4) { animation-delay: .18s; }
  .rh-fade-up:nth-child(5) { animation-delay: .24s; }
  .rh-fade-up:nth-child(6) { animation-delay: .30s; }

  @keyframes rhFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes rhPulseGreen  { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,.35); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } }
  @keyframes rhPulseRed    { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.35); }  50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }
  @keyframes rhPulseBlue   { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,.35); } 50% { box-shadow: 0 0 0 6px rgba(59,130,246,0); } }
  @keyframes rhPulseAmber  { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.35); } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); } }

  .rh-dot-green  { animation: rhPulseGreen 2s infinite; background: #10b981; }
  .rh-dot-red    { animation: rhPulseRed   2s infinite; background: #ef4444; }
  .rh-dot-blue   { animation: rhPulseBlue  2s infinite; background: #3b82f6; }
  .rh-dot-amber  { animation: rhPulseAmber 2s infinite; background: #f59e0b; }
  .rh-dot-slate  { background: #cbd5e1; }

  .rh-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .rh-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }

  @keyframes rhSpin { to { transform: rotate(360deg); } }
`;

/* ─── Constantes ───────────────────────────────────────────────────────────── */

const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const hoyDateDefault = toDateInput(new Date());

const normalizeText = (t = '') => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const EST_REALIZADAS = new Set(['completada', 'realizada', 'atendida', 'finalizada']);
const EST_CANCELADAS = new Set(['cancelada', 'no_asistio']);

const parseDateSafe = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmtMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n || 0);

const fmtDT = (v) => {
  const d = parseDateSafe(v);
  if (!d) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

const getHour = (cita) => {
  const d = cita?.fechaCita?.toDate ? cita.fechaCita.toDate() : parseDateSafe(cita?.fechaCita || cita?.fechaHora || cita?.fecha);
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const timeS = (mins) => {
  if (mins < 2) return 'Ahora';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const ROLES_MEDICOS = new Set(['medico', 'doctor']);
const PORCENTAJE_HONORARIOS = 0.30;

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#111' }}>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: p.color, flexShrink: 0 }} />
          <span>{p.name}: <strong style={{ color: '#111' }}>{typeof p.value === 'number' && p.dataKey === 'ingresos' ? fmtMXN(p.value) : p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const MiniBar = ({ pct, color, height = 4 }) => (
  <div style={{ flex: 1, height, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', borderRadius: 99, background: color, transition: 'width .6s ease' }} />
  </div>
);

const ScoreBadge = ({ score }) => {
  const color = score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626';
  const bg = score >= 70 ? '#ecfdf5' : score >= 40 ? '#fffbeb' : '#fef2f2';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: bg, color, border: `1px solid ${color}20` }}>
      {score}%
    </span>
  );
};

/* ─── Componente ───────────────────────────────────────────────────────────── */

const DashboardRH = () => {
  const isMobile = useIsMobile();

  const [users, setUsers] = useState([]);
  const [citas, setCitas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [bitacoras, setBitacoras] = useState([]);
  const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(hoyDateDefault);

  useEffect(() => {
    const uns = [
      onSnapshot(collection(db, 'users'), (s) => { setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false)),
      onSnapshot(collection(db, 'citas'), (s) => { setCitas(s.docs.map((d) => ({ id: d.id, ...d.data() }))); }, () => {}),
      onSnapshot(collection(db, 'inventario'), (s) => { setInventario(s.docs.map((d) => ({ id: d.id, ...d.data() }))); }, () => {}),
      onSnapshot(collection(db, 'bitacorasLimpieza'), (s) => { setBitacoras(s.docs.map((d) => ({ id: d.id, ...d.data() }))); }, () => {}),
      onSnapshot(collection(db, 'catalogo_sucursales'), (s) => { setCatalogoSucursales(s.docs.map((d) => ({ id: d.id, ...d.data() }))); }, () => {}),
    ];
    return () => uns.forEach((u) => u());
  }, []);

  /* ── Citas del día ── */
  const citasDia = useMemo(() => {
    return citas.filter((c) => {
      const d = c?.fechaCita?.toDate ? c.fechaCita.toDate() : parseDateSafe(c?.fechaCita || c?.fechaHora || c?.fecha);
      if (!d) return false;
      return toDateInput(d) === selectedDate;
    });
  }, [citas, selectedDate]);

  /* ── Personal ── */
  const personal = useMemo(() => users.filter((u) => {
    const r = normalizeText(u.rol || '');
    if (r === 'admin_maestro') return false;
    return true;
  }), [users]);

  const medicos = useMemo(() => personal.filter((u) => {
    const r = normalizeText(u.rol || '');
    return ROLES_MEDICOS.has(r);
  }), [personal]);

  const rolesBreakdown = useMemo(() => {
    const map = {};
    personal.forEach((u) => {
      const role = u.rol || 'sin rol';
      map[role] = (map[role] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [personal]);

  const onlineCount = useMemo(() => personal.filter((u) => isUserOnline(u)).length, [personal]);

  /* ── Productividad médica ── */
  const prodMedicos = useMemo(() => {
    const map = new Map();
    citasDia.forEach((c) => {
      const id = c.doctorId || 'sin-id';
      if (!map.has(id)) map.set(id, { id, nombre: c.doctorNombre || 'Sin asignar', citas: 0, realizadas: 0, ingresos: 0, sucursal: c.sucursal || '' });
      const r = map.get(id);
      r.citas++;
      if (EST_REALIZADAS.has(normalizeText(c.estado))) r.realizadas++;
      r.ingresos += Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0);
    });
    medicos.forEach((m) => {
      if (map.has(m.id)) {
        const r = map.get(m.id);
        r.online = isUserOnline(m);
        r.nombre = m.nombre || r.nombre;
      } else if (isUserOnline(m)) {
        map.set(m.id, { id: m.id, nombre: m.nombre || 'Sin nombre', citas: 0, realizadas: 0, ingresos: 0, sucursal: m.sucursal || '', online: true });
      }
    });
    return Array.from(map.values())
      .map((r) => {
        const tasa = r.citas > 0 ? Math.round((r.realizadas * 100) / r.citas) : null;
        const honorarios = Math.round(r.ingresos * PORCENTAJE_HONORARIOS);
        return { ...r, tasa, honorarios };
      })
      .sort((a, b) => b.ingresos - a.ingresos);
  }, [citasDia, medicos]);

  /* ── Ingresos por sucursal ── */
  const ingresosPorSuc = useMemo(() => {
    const map = {};
    citasDia.forEach((c) => {
      const s = c.sucursal || 'Sin sucursal';
      map[s] = (map[s] || 0) + Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0);
    });
    return Object.entries(map).map(([name, ingresos]) => ({ name, ingresos })).sort((a, b) => b.ingresos - a.ingresos);
  }, [citasDia]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalCitas = citasDia.length;
    const realizadas = citasDia.filter((c) => EST_REALIZADAS.has(normalizeText(c.estado))).length;
    const tasa = totalCitas > 0 ? Math.round((realizadas * 100) / totalCitas) : 0;
    const ingresos = citasDia.reduce((s, c) => s + Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0), 0);
    const prom = realizadas > 0 ? ingresos / realizadas : 0;
    const nomina = Math.round(ingresos * PORCENTAJE_HONORARIOS);
    const utilidad = ingresos - nomina;

    let valorInv = 0;
    const criticos = [];
    inventario.forEach((item) => {
      const stock = Number(item.stock) || 0;
      const costo = Number(item.costo || item.precio) || 0;
      const min = Number(item.stockMinimo || item.minimo) || 10;
      valorInv += stock * costo;
      if (stock <= min) criticos.push({ id: item.id, nombre: item.nombre || item.medicamento || 'Insumo', stock, minimo: min, costo, sucursal: item.sucursal || 'General' });
    });

    const bitacorasDia = bitacoras.filter((b) => {
      const d = parseDateSafe(b.fecha);
      return d ? toDateInput(d) === selectedDate : false;
    });

    return {
      totalCitas, realizadas, tasa, ingresos, prom, nomina, utilidad,
      valorInv, criticos: criticos.length, criticosItems: criticos,
      personalTotal: personal.length, online: onlineCount,
      medicosActivos: prodMedicos.filter((m) => m.online).length,
      bitacorasCount: bitacorasDia.length,
      sinEvidencia: bitacorasDia.filter((b) => !b.fotoUrl).length,
    };
  }, [citasDia, personal, onlineCount, inventario, bitacoras, selectedDate, prodMedicos]);

  /* ── Charts data ── */
  const COLORS = ['#111', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6'];

  const estadoCitasChart = useMemo(() => {
    const map = {};
    citasDia.forEach((c) => {
      const e = c.estado || 'pendiente';
      map[e] = (map[e] || 0) + 1;
    });
    return Object.entries(map).map(([name, value], i) => ({
      name, value,
      color: i === 0 ? '#111' : i === 1 ? '#6b7280' : i === 2 ? '#9ca3af' : '#d1d5db',
    }));
  }, [citasDia]);

  const ingresosAcum = useMemo(() => {
    const sorted = [...ingresosPorSuc].sort((a, b) => b.ingresos - a.ingresos);
    return sorted.map((s) => ({ name: s.name, ingresos: s.ingresos }));
  }, [ingresosPorSuc]);

  const labelDate = useMemo(() => {
    try { return new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return selectedDate; }
  }, [selectedDate]);

  /* ── Render ── */
  if (loading && users.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#9ca3af', animation: 'rhSpin .8s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Cargando panel de Recursos Humanos...</span>
      </div>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: isMobile ? '16px 12px 48px' : '28px 24px 48px', fontFamily: 'Inter, Sora, system-ui, sans-serif' }}>

        {/* ── HERO ── */}
        <div className="rh-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Briefcase size={22} style={{ color: '#dc2626', flexShrink: 0 }} />
              <div>
                <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.2 }}>Dashboard de Recursos Humanos</h1>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Auditoría integral de personal, finanzas y operación · {labelDate}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 6 }}>
            <Calendar size={14} style={{ color: '#6b7280' }} />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#111', background: 'transparent', fontFamily: 'Sora, sans-serif' }} />
          </div>
        </div>

        {/* ── KPI METRIC STRIP ── */}
        <div style={{ display: 'flex', gap: 1, background: '#e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 20, overflowX: 'auto' }} className="rh-scrollbar">
          {[
            { icon: DollarSign, label: 'Ingresos del día', value: fmtMXN(kpis.ingresos), sub: `${kpis.realizadas} consultas · ${fmtMXN(kpis.prom)} prom.`, accent: kpis.ingresos > 10000 ? '#059669' : kpis.ingresos > 0 ? '#d97706' : '#9ca3af' },
            { icon: Percent, label: 'Nómina estimada', value: fmtMXN(kpis.nomina), sub: `30% honorarios · ${kpis.medicosActivos} médicos`, accent: '#6d28d9' },
            { icon: TrendingUp, label: 'Utilidad bruta', value: fmtMXN(kpis.utilidad), sub: 'Ingresos − nómina', accent: kpis.utilidad > 0 ? '#059669' : '#dc2626' },
            { icon: Users, label: 'Personal', value: `${kpis.online}/${kpis.personalTotal}`, sub: `${rolesBreakdown.length} roles · ${kpis.medicosActivos} médicos`, accent: kpis.online === kpis.personalTotal ? '#059669' : kpis.online > kpis.personalTotal * 0.5 ? '#d97706' : '#dc2626' },
            { icon: Activity, label: 'Citas del día', value: kpis.totalCitas, sub: `${kpis.realizadas} realizadas · ${kpis.tasa}% cierre`, accent: kpis.tasa >= 70 ? '#059669' : kpis.tasa >= 40 ? '#d97706' : '#dc2626' },
            { icon: Package, label: 'Inventario crítico', value: kpis.criticos, sub: `${fmtMXN(kpis.valorInv)} total`, accent: kpis.criticos === 0 ? '#059669' : kpis.criticos <= 3 ? '#d97706' : '#dc2626' },
          ].map((m, i) => (
            <div key={i} className="rh-fade-up" style={{ flex: '1 1 0', minWidth: 140, background: '#fff', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <m.icon size={13} style={{ color: m.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{m.label}</span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#111', lineHeight: 1, fontFamily: 'Sora, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
              <span style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3 }}>{m.sub}</span>
            </div>
          ))}
        </div>

        {/* ── CHARTS ── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {/* Distribución de personal */}
            <div className="rh-fade-up" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={13} style={{ color: '#6b7280' }} /> Personal por rol
              </div>
              <div style={{ padding: '12px 16px' }}>
                {rolesBreakdown.length === 0 ? (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: 13 }}>Sin datos</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={rolesBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={1} strokeWidth={0}>
                          {rolesBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTip content={<CustomTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 4 }}>
                      {rolesBreakdown.map((d, i) => (
                        <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
                          <span style={{ width: 6, height: 6, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          {d.name} <span style={{ fontWeight: 700, color: '#111' }}>{d.value}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Ingresos por sucursal */}
            <div className="rh-fade-up" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart2 size={13} style={{ color: '#6b7280' }} /> Ingresos por sucursal
              </div>
              <div style={{ padding: '12px 16px' }}>
                {ingresosAcum.length === 0 ? (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: 13 }}>Sin ingresos</div>
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={ingresosAcum}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                      <RechartsTip content={<CustomTip />} />
                      <Bar dataKey="ingresos" radius={[4, 4, 0, 0]}>
                        {ingresosAcum.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Tasa de cierre */}
            <div className="rh-fade-up" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} style={{ color: '#6b7280' }} /> Estado de citas
              </div>
              <div style={{ padding: '12px 16px' }}>
                {estadoCitasChart.length === 0 ? (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: 13 }}>Sin citas</div>
                ) : (
                  <>
                    <div style={{ position: 'relative', width: '100%', height: 120, minWidth: 0, minHeight: 120 }}>
                      <ResponsiveContainer width="100%" height={120} minWidth={0} minHeight={120}>
                        <PieChart>
                          <Pie data={estadoCitasChart} cx="50%" cy="50%" innerRadius={38} outerRadius={52} dataKey="value" paddingAngle={1} strokeWidth={0}>
                            {estadoCitasChart.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{kpis.tasa}%</div>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>cierre</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                      {estadoCitasChart.map((d) => (
                        <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
                          <span style={{ width: 6, height: 6, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                          {d.name} <span style={{ fontWeight: 700, color: '#111' }}>{d.value}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TABLAS (2 columnas) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>

          {/* Productividad médica */}
          <div className="rh-fade-up" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HeartPulse size={13} style={{ color: '#6b7280' }} /> Productividad Médica</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{prodMedicos.length} médicos</span>
            </div>
            <div style={{ overflowX: 'auto' }} className="rh-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Médico', 'Citas', '% Cierre', 'Ingresos', 'Honorarios'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prodMedicos.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Sin datos de productividad hoy</td></tr>
                  )}
                  {prodMedicos.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#111', fontSize: 12 }}>{m.nombre}</div>
                        {m.sucursal && <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={9} /> {m.sucursal}</div>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#111' }}>
                        {m.citas > 0 ? `${m.realizadas}/${m.citas}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.tasa !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MiniBar pct={m.tasa} color={m.tasa >= 70 ? '#10b981' : m.tasa >= 40 ? '#f59e0b' : '#ef4444'} />
                            <ScoreBadge score={m.tasa} />
                          </div>
                        ) : <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{fmtMXN(m.ingresos)}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: m.honorarios > 0 ? '#6d28d9' : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{fmtMXN(m.honorarios)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Personal operativo completo */}
          <div className="rh-fade-up" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={13} style={{ color: '#6b7280' }} /> Personal Operativo</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{personal.length} registrados · {onlineCount} online</span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }} className="rh-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Nombre', 'Rol', 'Sucursal', 'Estado', 'Conectado'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {personal.sort((a, b) => (isUserOnline(b) ? 1 : 0) - (isUserOnline(a) ? 1 : 0)).map((u) => {
                    const online = isUserOnline(u);
                    const mins = getConnectedMinutes(u);
                    const status = u.statusOperativo || '';
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }} className={online ? 'rh-dot-green' : 'rh-dot-slate'} />
                            <span style={{ fontWeight: 600, color: '#111', fontSize: 12 }}>{u.nombre || 'Sin nombre'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: 11, fontWeight: 600, color: '#4b5563' }}>
                          {u.rol ? u.rol.charAt(0).toUpperCase() + u.rol.slice(1) : '—'}
                          {status && <span style={{ marginLeft: 4, fontSize: 9, color: '#9ca3af' }}>({status})</span>}
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: 11, color: '#6b7280' }}>
                          {u.sucursal || u.asignacionRecurrente || '—'}
                        </td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: online ? '#059669' : '#9ca3af' }}>
                            {online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: 11, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                          {online ? mins > 0 ? fmtMinutes(mins) : '—' : timeS(u.lastSeen ? Math.floor((Date.now() - new Date(u.lastSeen).getTime()) / 60000) : null) || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── INVENTARIO CRÍTICO ── */}
        {kpis.criticosItems.length > 0 && (
          <div className="rh-fade-up" style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #fecaca', background: '#fef2f2', fontSize: 12, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} /> Inventario Crítico ({kpis.criticosItems.length} items)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {kpis.criticosItems.map((item) => {
                const ratio = Math.min(100, Math.round((item.stock / item.minimo) * 100));
                const barColor = item.stock === 0 ? '#ef4444' : '#f59e0b';
                return (
                  <div key={item.id} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f3f4f6', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{item.nombre}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{item.sucursal}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 99, background: '#fee2e2', overflow: 'hidden' }}>
                          <div style={{ width: `${ratio}%`, height: '100%', borderRadius: 99, background: barColor, transition: 'width .6s' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>{ratio}% min</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: item.stock === 0 ? '#dc2626' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>{item.stock}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{fmtMXN(item.stock * item.costo)} · min {item.minimo}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#9ca3af', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={11} />
            Datos en tiempo real · Panel unificado de Recursos Humanos
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9ca3af' }}>
            <span>{personal.length} empleados</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db' }} />
            <span>{fmtMXN(kpis.valorInv)} inventario</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db' }} />
            <span>{ingresosPorSuc.length} sucursales</span>
          </div>
        </div>

      </div>
    </>
  );
};

export default DashboardRH;
