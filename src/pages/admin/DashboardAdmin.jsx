import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock3,
  DollarSign,
  Settings,
  ShieldAlert,
  Users,
  Warehouse
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import useIsMobile from '../../hooks/useIsMobile';

const toDateInput = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateSafe = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value) => String(value || '').toLowerCase().trim();
const formatMoney = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));

const isOnline = (u = {}) => {
  if (u.isOnline === true) return true;
  const lastSeen = parseDateSafe(u.lastSeen);
  if (!lastSeen) return false;
  return (Date.now() - lastSeen.getTime()) / 60000 <= 10;
};

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [users, setUsers] = useState([]);
  const [citas, setCitas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [bitacoras, setBitacoras] = useState([]);
  const [loading, setLoading] = useState(true);

  const [duracionMin, setDuracionMin] = useState(10);
  const [duracionInput, setDuracionInput] = useState('10');
  const [savingTimer, setSavingTimer] = useState(false);

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracion', 'general'));
        if (snap.exists()) {
          const min = snap.data().duracionConsultaMin;
          if (Number.isFinite(min)) {
            setDuracionMin(min);
            setDuracionInput(String(min));
          }
        }
      } catch (e) {
        console.error('Error cargando configuración general:', e);
      }
    };
    cargarConfig();
  }, []);

  useEffect(() => {
    setLoading(true);

    let isMounted = true;
    const loadDashboardData = async () => {
      try {
        const qCitas = query(collection(db, 'citas'), where('fecha', '==', selectedDate));
        const qBitacoras = query(collection(db, 'bitacorasLimpieza'), orderBy('fecha', 'desc'));
        const [usersSnap, citasSnap, inventarioSnap, bitacorasSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(qCitas),
          getDocs(collection(db, 'inventario')),
          getDocs(qBitacoras)
        ]);

        if (!isMounted) return;
        setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCitas(citasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setInventario(inventarioSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setBitacoras(bitacorasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error cargando dashboard admin:', e);
      }

      if (isMounted) setLoading(false);
    };

    loadDashboardData();
    const intervalId = setInterval(loadDashboardData, 180000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedDate]);

  const guardarDuracion = async () => {
    const val = parseInt(duracionInput, 10);
    if (!Number.isFinite(val) || val < 1 || val > 120) return;
    setSavingTimer(true);
    try {
      await setDoc(doc(db, 'configuracion', 'general'), { duracionConsultaMin: val }, { merge: true });
      setDuracionMin(val);
    } catch (e) {
      console.error('Error guardando duración:', e);
    }
    setSavingTimer(false);
  };

  const resumen = useMemo(() => {
    const totalCitas = citas.length;
    const realizadas = citas.filter((c) => ['completada', 'finalizada', 'atendida'].includes(normalizeText(c.estado))).length;
    const pendientes = Math.max(totalCitas - realizadas, 0);
    const ingresos = citas.reduce((acc, c) => acc + Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0), 0);
    const tasaCierre = totalCitas > 0 ? Math.round((realizadas * 100) / totalCitas) : 0;

    const personalTotal = users.length;
    const personalOnline = users.filter((u) => isOnline(u)).length;

    const criticasInventario = inventario.filter((item) => {
      const stock = Number(item.stock || 0);
      const min = Number(item.stockMinimo || item.minimo || 10);
      return stock <= min;
    }).length;

    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + 30);
    const porCaducar = inventario.filter((item) => {
      if (!item.caducidad) return false;
      const cad = new Date(item.caducidad);
      return !Number.isNaN(cad.getTime()) && cad <= limite;
    }).length;

    const bitacorasDia = bitacoras.filter((b) => {
      const d = parseDateSafe(b.fecha);
      return d ? toDateInput(d) === selectedDate : false;
    });

    const limpiezasSinEvidencia = bitacorasDia.filter((b) => !b.fotoUrl).length;

    return {
      totalCitas,
      realizadas,
      pendientes,
      ingresos,
      tasaCierre,
      personalTotal,
      personalOnline,
      criticasInventario,
      porCaducar,
      bitacorasDia: bitacorasDia.length,
      limpiezasSinEvidencia
    };
  }, [citas, users, inventario, bitacoras, selectedDate]);

  const riesgos = useMemo(() => {
    const out = [];
    if (resumen.criticasInventario > 0) out.push({ id: 'r1', texto: `${resumen.criticasInventario} en stock crítico`, severidad: 'alta', actionId: 'go_inventory' });
    if (resumen.porCaducar > 0) out.push({ id: 'r2', texto: `${resumen.porCaducar} por caducar`, severidad: 'media', actionId: 'go_inventory' });
    if (resumen.limpiezasSinEvidencia > 0) out.push({ id: 'r3', texto: `${resumen.limpiezasSinEvidencia} bitácoras sin evidencia`, severidad: 'alta', actionId: 'go_supervision' });
    if (resumen.tasaCierre < 60 && resumen.totalCitas >= 8) out.push({ id: 'r4', texto: `tasa de cierre baja (${resumen.tasaCierre}%)`, severidad: 'media', actionId: 'go_monitor' });
    return out;
  }, [resumen]);

  const sucursalesRows = useMemo(() => {
    const map = new Map();
    citas.forEach((c) => {
      const key = c.sucursal || 'Sin sucursal';
      if (!map.has(key)) map.set(key, { sucursal: key, citas: 0, realizadas: 0, ingresos: 0 });
      const row = map.get(key);
      row.citas += 1;
      if (['completada', 'finalizada', 'atendida'].includes(normalizeText(c.estado))) row.realizadas += 1;
      row.ingresos += Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0);
    });
    return Array.from(map.values()).sort((a, b) => b.ingresos - a.ingresos);
  }, [citas]);

  const rolesRows = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      const rol = u.rol || 'sin_rol';
      if (!map.has(rol)) map.set(rol, { rol, total: 0, online: 0, sucursales: new Set() });
      const row = map.get(rol);
      row.total += 1;
      if (isOnline(u)) row.online += 1;
      if (u.sucursal) row.sucursales.add(u.sucursal);
    });

    return Array.from(map.values())
      .map((r) => ({
        rol: String(r.rol).replaceAll('_', ' '),
        total: r.total,
        online: r.online,
        cobertura: r.sucursales.size
      }))
      .sort((a, b) => b.total - a.total);
  }, [users]);

  const moduloRows = useMemo(() => {
    return [
      {
        modulo: 'Agenda / Citas',
        estado: resumen.pendientes > resumen.realizadas ? 'Atención' : 'Estable',
        dato1: `Total: ${resumen.totalCitas}`,
        dato2: `Cierre: ${resumen.tasaCierre}%`,
        actionId: 'go_monitor'
      },
      {
        modulo: 'Personal',
        estado: resumen.personalOnline < Math.ceil(resumen.personalTotal * 0.5) ? 'Atención' : 'Estable',
        dato1: `Online: ${resumen.personalOnline}/${resumen.personalTotal}`,
        dato2: `Roles: ${rolesRows.length}`,
        actionId: 'go_users'
      },
      {
        modulo: 'Farmacia / Inventario',
        estado: resumen.criticasInventario > 0 ? 'Crítico' : 'Estable',
        dato1: `Crítico: ${resumen.criticasInventario}`,
        dato2: `Caducar: ${resumen.porCaducar}`,
        actionId: 'go_inventory'
      },
      {
        modulo: 'Limpieza / Cumplimiento',
        estado: resumen.limpiezasSinEvidencia > 0 ? 'Atención' : 'Estable',
        dato1: `Bitácoras: ${resumen.bitacorasDia}`,
        dato2: `Sin evidencia: ${resumen.limpiezasSinEvidencia}`,
        actionId: 'go_supervision'
      },
      {
        modulo: 'Reportes BI',
        estado: resumen.ingresos > 0 ? 'Activo' : 'Sin datos',
        dato1: `Ingreso: ${formatMoney(resumen.ingresos)}`,
        dato2: `Realizadas: ${resumen.realizadas}`,
        actionId: 'go_reports'
      }
    ];
  }, [resumen, rolesRows.length]);

  const runAssistantAction = (actionId) => {
    if (actionId === 'go_supervision') navigate('/admin/supervision');
    if (actionId === 'go_monitor') navigate('/admin/monitor');
    if (actionId === 'go_inventory') navigate('/admin/inventario');
    if (actionId === 'go_reports') navigate('/admin/reportes');
    if (actionId === 'go_users') navigate('/admin/usuarios');
    if (actionId === 'go_catalogs') navigate('/admin/catalogos');
    if (actionId === 'go_agenda') navigate('/agenda');
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '32px 28px 48px' }}>
      {/* ── CABECERA ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
            Centro Ejecutivo
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Resumen integral de operacion, cumplimiento y riesgos en una sola vista.
          </p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 12px', background: '#fff' }}>
          <Calendar size={14} style={{ color: '#6b7280' }} />
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, color: '#111', background: 'transparent' }} />
        </div>
      </div>

      {/* ── RESUMEN ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr',
        gap: 1,
        background: '#e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        {/* Citas e Ingreso */}
        <div style={{ background: '#fff', padding: '14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Operacion
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111', lineHeight: 1 }}>{resumen.totalCitas}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>citas</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#4b5563' }}>{resumen.realizadas} <span style={{ color: '#9ca3af' }}>realizadas</span></span>
                <span style={{ fontSize: 11, color: '#4b5563' }}>{resumen.pendientes} <span style={{ color: '#9ca3af' }}>pendientes</span></span>
              </div>
            </div>
            <div style={{ width: 1, background: '#e5e7eb', alignSelf: 'stretch' }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111', lineHeight: 1 }}>{formatMoney(resumen.ingresos)}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>ingreso</div>
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                cierre <strong style={{ color: '#111' }}>{resumen.tasaCierre}%</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Personal */}
        <div style={{ background: '#fff', padding: '14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Personal
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111', lineHeight: 1 }}>{resumen.personalOnline}<span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 500 }}>/{resumen.personalTotal}</span></div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>en linea</div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
            {rolesRows.length} <span style={{ color: '#9ca3af' }}>roles</span>
          </div>
        </div>

        {/* Inventario */}
        <div style={{ background: '#fff', padding: '14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Inventario
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111', lineHeight: 1 }}>{resumen.criticasInventario}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>stock critico</div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
            {resumen.porCaducar} <span style={{ color: '#9ca3af' }}>por caducar</span>
          </div>
        </div>

        {/* Riesgos */}
        <div style={{ background: '#fff', padding: '14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Riesgos
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111', lineHeight: 1 }}>{riesgos.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>alertas</div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
            {resumen.bitacorasDia} <span style={{ color: '#9ca3af' }}>bitacoras</span>
          </div>
        </div>
      </div>

      {/* ── TABLA: ESTADO GLOBAL ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 13, fontWeight: 700, color: '#111' }}>
          Estado Global del Software
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['Modulo', 'Estado', 'Indicador 1', 'Indicador 2', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {moduloRows.map((row) => (
              <tr key={row.modulo} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#111' }}>{row.modulo}</td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: '#4b5563' }}>{row.estado}</td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: '#4b5563' }}>{row.dato1}</td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: '#4b5563' }}>{row.dato2}</td>
                <td style={{ padding: '12px 20px' }}>
                  <button
                    onClick={() => runAssistantAction(row.actionId)}
                    style={{
                      background: 'none',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#111',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Abrir <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── GRILLA INFERIOR ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Personal */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 13, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={14} style={{ color: '#9ca3af' }} /> Integrantes por Rol
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['Rol', 'Total', 'Online', 'Sucursales'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rolesRows.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '32px 20px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>Sin integrantes registrados.</td></tr>
              )}
              {rolesRows.map((r) => (
                <tr key={r.rol} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#111' }}>{r.rol}</td>
                  <td style={{ padding: '10px 20px', fontSize: 13, color: '#4b5563' }}>{r.total}</td>
                  <td style={{ padding: '10px 20px', fontSize: 13, color: '#4b5563' }}>{r.online}</td>
                  <td style={{ padding: '10px 20px', fontSize: 13, color: '#4b5563' }}>{r.cobertura}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sucursales */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 13, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} style={{ color: '#9ca3af' }} /> Sucursales del Dia
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['Sucursal', 'Citas', 'Cierre', 'Ingreso'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} style={{ padding: '32px 20px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>Cargando...</td></tr>}
              {!loading && sucursalesRows.length === 0 && <tr><td colSpan={4} style={{ padding: '32px 20px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>Sin actividad hoy.</td></tr>}
              {sucursalesRows.slice(0, 8).map((s) => {
                const tasa = s.citas > 0 ? Math.round((s.realizadas * 100) / s.citas) : 0;
                return (
                  <tr key={s.sucursal} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#111' }}>{s.sucursal}</td>
                    <td style={{ padding: '10px 20px', fontSize: 13, color: '#4b5563' }}>{s.citas}</td>
                    <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#111' }}>{tasa}%</td>
                    <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#111' }}>{formatMoney(s.ingresos)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CONFIGURACION ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 13, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={14} style={{ color: '#9ca3af' }} /> Configuracion rapida
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock3 size={14} style={{ color: '#9ca3af' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Duracion consulta:</span>
            </div>
            <input
              type="number"
              min="1"
              max="120"
              value={duracionInput}
              onChange={(e) => setDuracionInput(e.target.value)}
              style={{
                width: 72,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 13,
                color: '#111',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: '#6b7280' }}>min</span>
            <button
              onClick={guardarDuracion}
              disabled={savingTimer}
              style={{
                border: '1px solid #111',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                background: '#111',
                cursor: savingTimer ? 'not-allowed' : 'pointer',
                opacity: savingTimer ? 0.5 : 1,
              }}
            >
              {savingTimer ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            Valor actual: <span style={{ fontWeight: 600, color: '#4b5563' }}>{duracionMin} min</span>
          </div>
        </div>
      </div>

      {/* ── ACCESOS RAPIDOS ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '14px 20px',
        alignItems: 'center',
      }}>
        {[
          { label: 'Reportes', icon: DollarSign, path: '/admin/reportes' },
          { label: 'Monitor', icon: Activity, path: '/admin/monitor' },
          { label: 'Supervision', icon: ShieldAlert, path: '/admin/supervision' },
          { label: 'Inventario', icon: Warehouse, path: '/admin/inventario' },
          { label: 'Usuarios', icon: Users, path: '/admin/usuarios' },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={() => navigate(btn.path)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              color: '#111',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <btn.icon size={13} style={{ color: '#6b7280' }} />
            {btn.label}
          </button>
        ))}
        <span style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fafafa',
          color: '#4b5563',
          fontSize: 11,
          fontWeight: 600,
        }}>
          <AlertTriangle size={12} style={{ color: '#6b7280' }} />
          Riesgos: {riesgos.length}
        </span>
      </div>
    </div>
  );
};

export default DashboardAdmin;
