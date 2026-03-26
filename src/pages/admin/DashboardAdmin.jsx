import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Calendar,
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
    <div className="max-w-7xl mx-auto p-4 md:p-5 pb-8 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>Centro Ejecutivo</h2>
          <p className="text-sm text-slate-500">Resumen integral de operacion, cumplimiento y riesgos en una sola vista.</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-600">
          <Calendar size={14} />
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent outline-none" />
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-700">Estado Global del Software</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Módulo', 'Estado', 'Indicador 1', 'Indicador 2', 'Acción'].map((h) => (
                  <th key={h} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moduloRows.map((row) => (
                <tr key={row.modulo} className="border-b border-slate-50 hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-sm font-semibold text-slate-700">{row.modulo}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${row.estado === 'Crítico' ? 'bg-rose-50 text-rose-700 border-rose-200' : row.estado === 'Atención' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {row.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-600">{row.dato1}</td>
                  <td className="px-3 py-2 text-sm text-slate-600">{row.dato2}</td>
                  <td className="px-3 py-2 text-sm">
                    <button onClick={() => runAssistantAction(row.actionId)} className="text-blue-600 font-semibold hover:underline">Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
            <Users size={14} /> Integrantes por Rol
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-slate-50">
                <tr>
                  {['Rol', 'Total', 'Online', 'Cobertura sucursales'].map((h) => (
                    <th key={h} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rolesRows.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-sm text-slate-500 text-center">Sin integrantes registrados.</td></tr>
                )}
                {rolesRows.map((r) => (
                  <tr key={r.rol} className="border-b border-slate-50 hover:bg-slate-50/70">
                    <td className="px-3 py-2 text-sm font-semibold text-slate-700">{r.rol}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{r.total}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{r.online}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{r.cobertura}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
              <Activity size={14} /> Sucursales del Día
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    {['Sucursal', 'Citas', 'Cierre', 'Ingreso'].map((h) => (
                      <th key={h} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={4} className="px-3 py-8 text-sm text-slate-500 text-center">Cargando...</td></tr>}
                  {!loading && sucursalesRows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-sm text-slate-500 text-center">Sin actividad hoy.</td></tr>}
                  {sucursalesRows.slice(0, 6).map((s) => {
                    const tasa = s.citas > 0 ? Math.round((s.realizadas * 100) / s.citas) : 0;
                    return (
                      <tr key={s.sucursal} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="px-3 py-2 text-sm font-semibold text-slate-700">{s.sucursal}</td>
                        <td className="px-3 py-2 text-sm text-slate-600">{s.citas}</td>
                        <td className="px-3 py-2 text-sm"><span className={`font-semibold ${tasa >= 70 ? 'text-emerald-700' : tasa >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>{tasa}%</span></td>
                        <td className="px-3 py-2 text-sm font-semibold text-emerald-700">{formatMoney(s.ingresos)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
              <Settings size={14} /> Configuración rápida
            </div>
            <div className="p-3 space-y-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase inline-flex items-center gap-1"><Clock3 size={12} /> Duración consulta</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={duracionInput}
                  onChange={(e) => setDuracionInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={guardarDuracion} disabled={savingTimer} className="px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white">
                  {savingTimer ? '...' : 'Guardar'}
                </button>
              </div>
              <p className="text-xs text-slate-500">Actual: <span className="font-semibold text-slate-700">{duracionMin} min</span></p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/admin/reportes')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"><DollarSign size={13} /> Reportes</button>
          <button onClick={() => navigate('/admin/monitor')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Activity size={13} /> Monitor</button>
          <button onClick={() => navigate('/admin/supervision')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ShieldAlert size={13} /> Supervisión</button>
          <button onClick={() => navigate('/admin/inventario')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Warehouse size={13} /> Inventario</button>
          <button onClick={() => navigate('/admin/usuarios')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Users size={13} /> Usuarios</button>
          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
            <AlertTriangle size={12} /> Riesgos: {riesgos.length}
          </span>
        </div>
      </section>
    </div>
  );
};

export default DashboardAdmin;
