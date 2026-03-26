import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, Filter, Search, Users } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

const ESTADOS_REALIZADA = new Set(['completada', 'finalizada', 'atendida']);
const ESTADOS_CANCELADA = new Set(['cancelada', 'no_asistio']);
const ROLES_AUDITABLES = new Set(['medico', 'admin', 'admin_maestro', 'enfermeria', 'jefa_enfermeria', 'rh', 'intendencia', 'recepcion', 'operativo']);

const toDateInput = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateSafe = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMoney = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));

const formatDateTime = (value) => {
  const date = parseDateSafe(value);
  if (!date) return '--';
  return date.toLocaleString('es-MX', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const toRoleLabel = (role) => String(role || 'sin_rol').replaceAll('_', ' ');

const isUserOnline = (user, now = new Date()) => {
  if (user?.isOnline === true) return true;
  const lastSeenDate = parseDateSafe(user?.lastSeen);
  if (!lastSeenDate) return false;
  const minutes = (now.getTime() - lastSeenDate.getTime()) / 60000;
  return minutes <= 10;
};

const calcConnectedMinutes = (user, now = new Date()) => {
  const start = parseDateSafe(user?.lastLogin);
  if (!start || !isUserOnline(user, now)) return 0;
  const diff = Math.floor((now.getTime() - start.getTime()) / 60000);
  return Math.max(0, diff);
};

const formatMinutes = (mins = 0) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const normalizeCita = (id, raw = {}) => {
  const fecha = raw.fecha || (raw.fechaHora ? String(raw.fechaHora).split('T')[0] : '');
  return {
    id,
    fecha,
    estado: normalizeText(raw.estado),
    doctorUid: raw.doctorUid || '',
    doctorNombre: raw.doctorNombre || '',
    creadoPor: raw.creadoPor || '',
    motivoPrecio: Number(raw.motivoPrecioSnapshot ?? raw.motivoPrecio ?? 0),
    sucursal: raw.sucursal || 'Sin sucursal'
  };
};

const getSortableValue = (row, key) => {
  const value = row[key];
  if (typeof value === 'number') return value;
  return normalizeText(value);
};

const MonitorActividad = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [selectedSucursal, setSelectedSucursal] = useState('todas');
  const [selectedRol, setSelectedRol] = useState('todos');
  const [selectedEstatus, setSelectedEstatus] = useState('todos');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [users, setUsers] = useState([]);
  const [citas, setCitas] = useState([]);
  const [movimientosConsultorio, setMovimientosConsultorio] = useState([]);

  useEffect(() => {
    setLoading(true);
    setError('');

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(rows);
        setIsLive(true);
      },
      (e) => {
        console.error(e);
        setError('No se pudo sincronizar personal en tiempo real.');
      }
    );

    const qCitas = query(collection(db, 'citas'), where('fecha', '==', selectedDate));
    const unsubCitas = onSnapshot(
      qCitas,
      (snap) => {
        setCitas(snap.docs.map((d) => normalizeCita(d.id, d.data())));
        setIsLive(true);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError('No se pudo sincronizar actividad de citas para la fecha seleccionada.');
        setCitas([]);
        setLoading(false);
      }
    );

    const qMovimientos = query(collection(db, 'auditoria_movimientos_consultorio'), where('fechaString', '==', selectedDate));
    const unsubMovimientos = onSnapshot(
      qMovimientos,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const da = parseDateSafe(a.fecha);
          const dbDate = parseDateSafe(b.fecha);
          return (dbDate?.getTime() || 0) - (da?.getTime() || 0);
        });
        setMovimientosConsultorio(rows);
      },
      (e) => {
        console.error(e);
      }
    );

    return () => {
      unsubUsers();
      unsubCitas();
      unsubMovimientos();
    };
  }, [selectedDate]);

  const personalAuditable = useMemo(() => {
    return users.filter((u) => ROLES_AUDITABLES.has(normalizeText(u.rol)));
  }, [users]);

  const sucursales = useMemo(() => {
    return Array.from(new Set(personalAuditable.map((u) => u.sucursal || u.asignacionRecurrente).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [personalAuditable]);

  const roles = useMemo(() => {
    return Array.from(new Set(personalAuditable.map((u) => normalizeText(u.rol)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [personalAuditable]);

  const rows = useMemo(() => {
    const now = new Date();

    const base = personalAuditable.map((u) => {
      const online = isUserOnline(u, now);
      const connectedMinutes = calcConnectedMinutes(u, now);
      const normalizedName = normalizeText(u.nombre);

      const citasAsignadas = citas.filter(
        (c) => c.doctorUid === u.id || (!c.doctorUid && normalizeText(c.doctorNombre) === normalizedName)
      );
      const citasCreadas = citas.filter((c) => c.creadoPor === u.id);
      const realizadas = citasAsignadas.filter((c) => ESTADOS_REALIZADA.has(c.estado));
      const canceladas = citasAsignadas.filter((c) => ESTADOS_CANCELADA.has(c.estado));

      const ingresos = realizadas.reduce((acc, c) => acc + Number(c.motivoPrecio || 0), 0);
      const cambiosConsultorio = movimientosConsultorio.filter((m) => m.doctorUid === u.id).length;
      const eficienciaPct = connectedMinutes > 0
        ? Math.min(100, Math.round((realizadas.length * 25 * 100) / connectedMinutes))
        : 0;
      const atencionesPorHora = connectedMinutes > 0
        ? Number((realizadas.length / (connectedMinutes / 60)).toFixed(2))
        : 0;

      const score = Number((
        (realizadas.length * 4) +
        (citasCreadas.length * 2) +
        Math.min(eficienciaPct, 100) -
        (canceladas.length * 1.5)
      ).toFixed(2));

      return {
        id: u.id,
        nombre: u.nombre || 'Sin nombre',
        rol: toRoleLabel(u.rol),
        sucursal: u.sucursal || u.asignacionRecurrente || 'Sin sucursal',
        estatus: online ? 'en_turno' : 'offline',
        conectado: formatMinutes(connectedMinutes),
        conectadoMin: connectedMinutes,
        citasAsignadas: citasAsignadas.length,
        citasRealizadas: realizadas.length,
        citasCanceladas: canceladas.length,
        citasCreadas: citasCreadas.length,
        cambiosConsultorio,
        ingresos,
        eficiencia: eficienciaPct,
        atencionesPorHora,
        score,
        lastLogin: formatDateTime(u.lastLogin),
        lastSeen: formatDateTime(u.lastSeen)
      };
    });

    const term = normalizeText(search);
    let filtered = base;

    if (selectedSucursal !== 'todas') {
      filtered = filtered.filter((r) => r.sucursal === selectedSucursal);
    }

    if (selectedRol !== 'todos') {
      filtered = filtered.filter((r) => normalizeText(r.rol) === selectedRol);
    }

    if (selectedEstatus !== 'todos') {
      filtered = filtered.filter((r) => r.estatus === selectedEstatus);
    }

    if (term) {
      filtered = filtered.filter((r) => normalizeText(`${r.nombre} ${r.rol} ${r.sucursal}`).includes(term));
    }

    return [...filtered].sort((a, b) => {
      const va = getSortableValue(a, sortBy);
      const vb = getSortableValue(b, sortBy);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
  }, [personalAuditable, citas, movimientosConsultorio, selectedSucursal, selectedRol, selectedEstatus, search, sortBy, sortDir]);

  const metricas = useMemo(() => {
    const personal = rows.length;
    const enTurno = rows.filter((r) => r.estatus === 'en_turno').length;
    const atenciones = rows.reduce((acc, r) => acc + r.citasRealizadas, 0);
    const ingresos = rows.reduce((acc, r) => acc + r.ingresos, 0);
    const cambiosConsultorio = movimientosConsultorio.length;
    const eficienciaPromedio = personal > 0
      ? Math.round(rows.reduce((acc, r) => acc + r.eficiencia, 0) / personal)
      : 0;

    return { personal, enTurno, atenciones, ingresos, cambiosConsultorio, eficienciaPromedio };
  }, [rows, movimientosConsultorio]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir('desc');
  };

  const columns = [
    { key: 'nombre', label: 'Personal' },
    { key: 'rol', label: 'Rol' },
    { key: 'sucursal', label: 'Sucursal' },
    { key: 'estatus', label: 'Estatus' },
    { key: 'conectadoMin', label: 'Conectado' },
    { key: 'citasAsignadas', label: 'Asignadas' },
    { key: 'citasRealizadas', label: 'Realizadas' },
    { key: 'citasCanceladas', label: 'Canceladas' },
    { key: 'citasCreadas', label: 'Creadas' },
    { key: 'cambiosConsultorio', label: 'Cambios consultorio' },
    { key: 'atencionesPorHora', label: 'Atenc./h' },
    { key: 'eficiencia', label: 'Eficiencia' },
    { key: 'ingresos', label: 'Ingreso' },
    { key: 'score', label: 'Score' },
    { key: 'lastSeen', label: 'Ult. movimiento' }
  ];

  return (
    <div className="p-6 max-w-[1800px] mx-auto pb-16 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
            Monitor de Rendimiento del Personal
          </h1>
          <p className="text-sm text-slate-500">Vista auditable por persona con productividad, actividad operativa e impacto diario.</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${isLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
          <Activity size={14} />
          {isLive ? 'Informacion en tiempo real' : 'Conectando...'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Personal auditado</p>
          <p className="text-xl font-bold text-slate-800">{metricas.personal}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">En turno</p>
          <p className="text-xl font-bold text-emerald-700">{metricas.enTurno}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Atenciones</p>
          <p className="text-xl font-bold text-slate-800">{metricas.atenciones}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Cambios consultorio</p>
          <p className="text-xl font-bold text-indigo-700">{metricas.cambiosConsultorio}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Ingreso</p>
          <p className="text-xl font-bold text-emerald-700">{formatMoney(metricas.ingresos)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Eficiencia promedio</p>
          <p className="text-xl font-bold text-blue-700">{metricas.eficienciaPromedio}%</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 min-w-[170px]">
            Fecha
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 min-w-[165px]">
            Sucursal
            <select
              value={selectedSucursal}
              onChange={(e) => setSelectedSucursal(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="todas">Todas</option>
              {sucursales.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 min-w-[145px]">
            Rol
            <select
              value={selectedRol}
              onChange={(e) => setSelectedRol(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="todos">Todos</option>
              {roles.map((r) => (
                <option key={r} value={r}>{toRoleLabel(r)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 min-w-[145px]">
            Estatus
            <select
              value={selectedEstatus}
              onChange={(e) => setSelectedEstatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="todos">Todos</option>
              <option value="en_turno">En turno</option>
              <option value="offline">Offline</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 flex-1 min-w-[220px]">
            Buscar personal
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, rol o sucursal"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </label>

          <div className="inline-flex items-center gap-2 text-xs text-slate-500 self-end pb-1">
            <Filter size={13} />
            {rows.length} registro(s) auditables
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Tabla dinámica de rendimiento</h2>
            <p className="text-xs text-slate-500">Ordena por cualquier columna para detectar saturación, tiempos muertos y resultados por personal.</p>
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <Users size={13} />
            Personal operativo
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-sm text-slate-500 text-center">Cargando monitor de actividad...</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[1700px] text-left">
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="px-3 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 cursor-pointer select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortBy === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-sm text-slate-500 text-center">No hay personal para los filtros seleccionados.</td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-700">{row.nombre}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{row.rol}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{row.sucursal}</td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${row.estatus === 'en_turno' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {row.estatus === 'en_turno' ? 'En turno' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{row.conectado}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{row.citasAsignadas}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-700">{row.citasRealizadas}</td>
                    <td className="px-3 py-2.5 text-sm text-rose-700">{row.citasCanceladas}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{row.citasCreadas}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{row.atencionesPorHora}</td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className={`font-semibold ${row.eficiencia >= 70 ? 'text-emerald-700' : row.eficiencia >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>
                        {row.eficiencia}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-emerald-700">{formatMoney(row.ingresos)}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-blue-700">{row.score}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{row.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Auditoria de rotaciones de consultorio</h2>
            <p className="text-xs text-slate-500">Movimientos registrados por médicos en la fecha seleccionada.</p>
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <Users size={13} />
            {movimientosConsultorio.length} movimiento(s)
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Hora', 'Medico', 'Sucursal anterior', 'Consultorio anterior', 'Sucursal nueva', 'Consultorio nuevo'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientosConsultorio.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-sm text-slate-500 text-center">Sin movimientos de consultorio registrados para esta fecha.</td>
                </tr>
              )}
              {movimientosConsultorio.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 text-sm text-slate-600">{formatDateTime(m.fecha)}</td>
                  <td className="px-3 py-2.5 text-sm font-semibold text-slate-700">{m.doctorNombre || '--'}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{m.sucursalAnterior || '--'}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{m.consultorioAnterior || '--'}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{m.sucursalNueva || '--'}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{m.consultorioNuevo || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MonitorActividad;
