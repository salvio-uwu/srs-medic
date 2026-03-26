import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

const ROLES_OPERATIVOS = new Set(['medico', 'enfermeria', 'jefa_enfermeria', 'intendencia', 'recepcion', 'admin', 'admin_maestro', 'operativo']);
const TABS = [
  { id: 'hallazgos', label: 'Hallazgos', icon: ShieldAlert },
  { id: 'limpieza', label: 'Limpieza', icon: ClipboardCheck },
  { id: 'asistencia', label: 'Asistencia', icon: UserCheck }
];

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

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const formatDateTime = (value) => {
  const d = parseDateSafe(value);
  if (!d) return '--';
  return d.toLocaleString('es-MX', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const isSameDate = (value, ymd) => {
  const d = parseDateSafe(value);
  if (!d) return false;
  return toDateInput(d) === ymd;
};

const getSeverityStyle = (severity) => {
  if (severity === 'critica') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (severity === 'alta') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

const getHourFromCita = (cita = {}) => {
  if (cita.hora) return cita.hora;
  if (cita.fechaHora && String(cita.fechaHora).includes('T')) {
    return String(cita.fechaHora).split('T')[1]?.slice(0, 5) || '';
  }
  return '';
};

const isOutOfRange = (time, start, end) => {
  if (!time || !start || !end) return false;
  return time < start || time > end;
};

const Supervision = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('hallazgos');
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [selectedSucursal, setSelectedSucursal] = useState('todas');
  const [selectedSeverity, setSelectedSeverity] = useState('todas');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [citas, setCitas] = useState([]);
  const [bitacoras, setBitacoras] = useState([]);

  useEffect(() => {
    setError('');
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setError('No se pudo leer personal para supervisión.');
      }
    );

    const qBitacoras = query(collection(db, 'bitacorasLimpieza'), orderBy('fecha', 'desc'));
    const unsubBitacoras = onSnapshot(
      qBitacoras,
      (snap) => setBitacoras(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(e);
        setError('No se pudo leer bitácoras de limpieza.');
      }
    );

    return () => {
      unsubUsers();
      unsubBitacoras();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const qCitas = query(collection(db, 'citas'), where('fecha', '==', selectedDate));
    const unsub = onSnapshot(
      qCitas,
      (snap) => {
        setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError('No se pudo leer actividad de citas para la fecha seleccionada.');
        setCitas([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedDate]);

  const personalOperativo = useMemo(() => {
    return users.filter((u) => ROLES_OPERATIVOS.has(normalizeText(u.rol)));
  }, [users]);

  const sucursales = useMemo(() => {
    const fromUsers = personalOperativo.map((u) => u.sucursal || u.asignacionRecurrente).filter(Boolean);
    const fromCitas = citas.map((c) => c.sucursal).filter(Boolean);
    const fromBitacoras = bitacoras.map((b) => b.sucursal).filter(Boolean);
    return Array.from(new Set([...fromUsers, ...fromCitas, ...fromBitacoras])).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [personalOperativo, citas, bitacoras]);

  const bitacorasDelDia = useMemo(() => {
    return bitacoras.filter((b) => isSameDate(b.fecha, selectedDate));
  }, [bitacoras, selectedDate]);

  const hallazgos = useMemo(() => {
    const rows = [];
    const sucursalFilter = selectedSucursal;

    citas.forEach((cita) => {
      const sucursal = cita.sucursal || 'Sin sucursal';
      if (sucursalFilter !== 'todas' && sucursal !== sucursalFilter) return;

      const hora = getHourFromCita(cita);
      const precio = Number(cita.motivoPrecioSnapshot ?? cita.motivoPrecio ?? 0);
      const min = Number(cita.motivoPrecioMin ?? 0);
      const max = Number(cita.motivoPrecioMax ?? 0);

      if (cita.esTeleconsulta && cita.motivoTeleconsultaPermitida === false) {
        rows.push({
          id: `tele-${cita.id}`,
          tipo: 'Regla clínica',
          severidad: 'critica',
          sucursal,
          responsable: cita.creadoPorRol || 'operativo',
          referencia: cita.paciente || cita.id,
          detalle: 'Teleconsulta agendada en motivo no permitido.',
          accion: 'Corregir motivo o modalidad y auditar cita.'
        });
      }

      if (min > 0 && max > 0 && (precio < min || precio > max)) {
        rows.push({
          id: `precio-${cita.id}`,
          tipo: 'Finanzas',
          severidad: 'alta',
          sucursal,
          responsable: cita.doctorNombre || 'sin asignar',
          referencia: cita.motivo || 'Sin motivo',
          detalle: `Precio fuera de rango (${precio} vs ${min}-${max}).`,
          accion: 'Validar tarifario y versión de motivo aplicada.'
        });
      }

      if (isOutOfRange(hora, cita.sucursalHoraApertura, cita.sucursalHoraCierre)) {
        rows.push({
          id: `horario-suc-${cita.id}`,
          tipo: 'Operación',
          severidad: 'media',
          sucursal,
          responsable: cita.creadoPorRol || 'operativo',
          referencia: hora || '--:--',
          detalle: `Cita fuera del horario de sucursal (${cita.sucursalHoraApertura || '--'}-${cita.sucursalHoraCierre || '--'}).`,
          accion: 'Revisar reglas de agenda y horarios de sede.'
        });
      }

      if (isOutOfRange(hora, cita.consultorioHoraInicio, cita.consultorioHoraFin)) {
        rows.push({
          id: `horario-con-${cita.id}`,
          tipo: 'Operación',
          severidad: 'media',
          sucursal,
          responsable: cita.consultorioNombre || 'sin consultorio',
          referencia: hora || '--:--',
          detalle: `Cita fuera del horario de consultorio (${cita.consultorioHoraInicio || '--'}-${cita.consultorioHoraFin || '--'}).`,
          accion: 'Alinear configuración de consultorio y agenda.'
        });
      }
    });

    const bitacorasPorSucursal = new Map();
    bitacorasDelDia.forEach((b) => {
      const sucursal = b.sucursal || 'Sin sucursal';
      if (sucursalFilter !== 'todas' && sucursal !== sucursalFilter) return;
      bitacorasPorSucursal.set(sucursal, (bitacorasPorSucursal.get(sucursal) || 0) + 1);

      const areaEntries = Object.entries(b).filter(([k]) => !['id', 'fecha', 'sucursal', 'usuarioNombre', 'usuarioUid', 'fotoUrl', 'estado', 'observaciones'].includes(k));
      const pendientes = areaEntries.filter(([, v]) => normalizeText(v).includes('pendiente')).map(([k]) => k);

      if (!b.fotoUrl) {
        rows.push({
          id: `foto-${b.id}`,
          tipo: 'Limpieza',
          severidad: 'alta',
          sucursal,
          responsable: b.usuarioNombre || 'sin usuario',
          referencia: formatDateTime(b.fecha),
          detalle: 'Bitácora sin evidencia fotográfica.',
          accion: 'Solicitar evidencia o repetir registro.'
        });
      }

      if (pendientes.length > 0) {
        rows.push({
          id: `pend-${b.id}`,
          tipo: 'Limpieza',
          severidad: 'media',
          sucursal,
          responsable: b.usuarioNombre || 'sin usuario',
          referencia: formatDateTime(b.fecha),
          detalle: `Áreas pendientes: ${pendientes.join(', ')}.`,
          accion: 'Asignar corrección y validar cierre.'
        });
      }
    });

    const sucursalesConCitas = Array.from(new Set(
      citas.map((c) => c.sucursal || 'Sin sucursal').filter((s) => (sucursalFilter === 'todas' ? true : s === sucursalFilter))
    ));

    sucursalesConCitas.forEach((sucursal) => {
      if (!bitacorasPorSucursal.has(sucursal)) {
        rows.push({
          id: `sin-bitacora-${sucursal}`,
          tipo: 'Limpieza',
          severidad: 'alta',
          sucursal,
          responsable: 'intendencia',
          referencia: selectedDate,
          detalle: 'Sin bitácora de limpieza registrada para la sede con actividad.',
          accion: 'Levantar registro y validar cumplimiento.'
        });
      }
    });

    personalOperativo.forEach((u) => {
      const sucursal = u.sucursal || u.asignacionRecurrente || 'Sin sucursal';
      if (sucursalFilter !== 'todas' && sucursal !== sucursalFilter) return;
      const lastSeen = parseDateSafe(u.lastSeen);
      const minutesOff = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 60000) : null;

      if (!lastSeen) {
        rows.push({
          id: `sin-lastseen-${u.id}`,
          tipo: 'Asistencia',
          severidad: 'media',
          sucursal,
          responsable: u.nombre || 'sin nombre',
          referencia: toDateInput(new Date()),
          detalle: 'Usuario sin traza de última actividad.',
          accion: 'Validar flujo de login/heartbeat del usuario.'
        });
        return;
      }

      if (u.isOnline !== true && minutesOff !== null && minutesOff > 240) {
        rows.push({
          id: `offline-${u.id}`,
          tipo: 'Asistencia',
          severidad: 'media',
          sucursal,
          responsable: u.nombre || 'sin nombre',
          referencia: formatDateTime(u.lastSeen),
          detalle: `Sin actividad por ${minutesOff} min.`,
          accion: 'Confirmar asistencia y causa de inactividad.'
        });
      }
    });

    const term = normalizeText(search);
    let filtered = rows;
    if (selectedSeverity !== 'todas') {
      filtered = filtered.filter((r) => r.severidad === selectedSeverity);
    }
    if (term) {
      filtered = filtered.filter((r) => normalizeText(`${r.tipo} ${r.sucursal} ${r.responsable} ${r.detalle}`).includes(term));
    }

    return filtered;
  }, [citas, bitacorasDelDia, personalOperativo, selectedSucursal, selectedSeverity, search, selectedDate]);

  const limpiezaRows = useMemo(() => {
    let rows = bitacorasDelDia.map((b) => {
      const areaEntries = Object.entries(b).filter(([k]) => !['id', 'fecha', 'sucursal', 'usuarioNombre', 'usuarioUid', 'fotoUrl', 'estado', 'observaciones'].includes(k));
      const pendientes = areaEntries.filter(([, v]) => normalizeText(v).includes('pendiente')).map(([k]) => k);
      return {
        id: b.id,
        sucursal: b.sucursal || 'Sin sucursal',
        usuario: b.usuarioNombre || 'Sin usuario',
        fecha: formatDateTime(b.fecha),
        estado: pendientes.length === 0 ? 'completo' : 'pendiente',
        pendientes,
        fotoUrl: b.fotoUrl || '',
        observaciones: b.observaciones || ''
      };
    });

    if (selectedSucursal !== 'todas') rows = rows.filter((r) => r.sucursal === selectedSucursal);
    const term = normalizeText(search);
    if (term) rows = rows.filter((r) => normalizeText(`${r.sucursal} ${r.usuario} ${r.observaciones}`).includes(term));
    return rows;
  }, [bitacorasDelDia, selectedSucursal, search]);

  const asistenciaRows = useMemo(() => {
    const now = new Date();
    let rows = personalOperativo.map((u) => {
      const sucursal = u.sucursal || u.asignacionRecurrente || 'Sin sucursal';
      const lastSeen = parseDateSafe(u.lastSeen);
      const lastLogin = parseDateSafe(u.lastLogin);
      const online = u.isOnline === true || (lastSeen ? (now.getTime() - lastSeen.getTime()) / 60000 <= 10 : false);
      return {
        id: u.id,
        nombre: u.nombre || 'Sin nombre',
        rol: String(u.rol || 'sin_rol').replaceAll('_', ' '),
        sucursal,
        estatus: online ? 'en_turno' : 'offline',
        lastLogin: formatDateTime(lastLogin),
        lastSeen: formatDateTime(lastSeen),
        minutosInactivo: lastSeen ? Math.max(0, Math.floor((now.getTime() - lastSeen.getTime()) / 60000)) : null
      };
    });

    if (selectedSucursal !== 'todas') rows = rows.filter((r) => r.sucursal === selectedSucursal);
    const term = normalizeText(search);
    if (term) rows = rows.filter((r) => normalizeText(`${r.nombre} ${r.rol} ${r.sucursal}`).includes(term));
    return rows;
  }, [personalOperativo, selectedSucursal, search]);

  const metricas = useMemo(() => {
    const abiertas = hallazgos.length;
    const criticas = hallazgos.filter((h) => h.severidad === 'critica').length;
    const limpPendientes = limpiezaRows.filter((r) => r.estado === 'pendiente').length;
    const offline = asistenciaRows.filter((r) => r.estatus === 'offline').length;
    return { abiertas, criticas, limpPendientes, offline };
  }, [hallazgos, limpiezaRows, asistenciaRows]);

  return (
    <div className="p-6 max-w-7xl mx-auto pb-16 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5" style={{ fontFamily: 'Sora, sans-serif' }}>
          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ClipboardCheck size={19} />
          </span>
          Supervisión Operativa
        </h1>
        <p className="text-slate-500 text-sm mt-1 ml-11">Centro de auditoría y hallazgos: cumplimiento, evidencia y seguimiento operativo.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Hallazgos abiertos</p>
          <p className="text-2xl font-extrabold text-slate-800">{metricas.abiertas}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Críticas</p>
          <p className="text-2xl font-extrabold text-rose-700">{metricas.criticas}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Limpieza pendiente</p>
          <p className="text-2xl font-extrabold text-amber-700">{metricas.limpPendientes}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Personal offline</p>
          <p className="text-2xl font-extrabold text-slate-800">{metricas.offline}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[9px] text-sm font-semibold transition-all"
            style={activeTab === tab.id
              ? { background: '#fff', color: '#005B8E', fontWeight: 700, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }
              : { background: 'transparent', color: '#64748b' }
            }
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
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

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 min-w-[180px]">
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

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 min-w-[150px]">
            Severidad
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="todas">Todas</option>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 flex-1 min-w-[220px]">
            Buscar
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sucursal, responsable o detalle"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </label>

          <div className="inline-flex items-center gap-2 text-xs text-slate-500 self-end pb-1">
            <Filter size={13} />
            {activeTab === 'hallazgos' ? hallazgos.length : activeTab === 'limpieza' ? limpiezaRows.length : asistenciaRows.length} registro(s)
          </div>
        </div>
      </div>

      {error && <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>}

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Cargando auditoría...</div>
        ) : (
          <>
            {activeTab === 'hallazgos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[980px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Tipo', 'Severidad', 'Sucursal', 'Responsable', 'Referencia', 'Detalle', 'Acción sugerida'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hallazgos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-sm text-slate-500 text-center">Sin hallazgos para filtros actuales.</td>
                      </tr>
                    )}
                    {hallazgos.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{item.tipo}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${getSeverityStyle(item.severidad)}`}>
                            {item.severidad}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{item.sucursal}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{item.responsable}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{item.referencia}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{item.detalle}</td>
                        <td className="px-4 py-2.5 text-sm text-blue-700">{item.accion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'limpieza' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[900px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Sucursal', 'Usuario', 'Fecha/Hora', 'Estado', 'Áreas pendientes', 'Evidencia', 'Observaciones'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {limpiezaRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-sm text-slate-500 text-center">Sin bitácoras para la fecha seleccionada.</td>
                      </tr>
                    )}
                    {limpiezaRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{row.sucursal}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.usuario}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.fecha}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${row.estado === 'completo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {row.estado === 'completo' ? 'Completo' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.pendientes.length > 0 ? row.pendientes.join(', ') : 'Ninguna'}</td>
                        <td className="px-4 py-2.5 text-sm">
                          {row.fotoUrl ? (
                            <a href={row.fotoUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline">Ver evidencia</a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold"><AlertCircle size={13} />Sin foto</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.observaciones || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'asistencia' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[840px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Personal', 'Rol', 'Sucursal', 'Estatus', 'Último login', 'Última actividad', 'Inactividad'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {asistenciaRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-sm text-slate-500 text-center">Sin personal para filtros seleccionados.</td>
                      </tr>
                    )}
                    {asistenciaRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{row.nombre}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.rol}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.sucursal}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${row.estatus === 'en_turno' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {row.estatus === 'en_turno' ? 'En turno' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.lastLogin}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{row.lastSeen}</td>
                        <td className="px-4 py-2.5 text-sm">
                          {row.minutosInactivo === null ? (
                            <span className="text-slate-400">--</span>
                          ) : row.minutosInactivo > 240 ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><AlertCircle size={13} />{row.minutosInactivo} min</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 size={13} />{row.minutosInactivo} min</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <div className="text-xs text-slate-500 inline-flex items-center gap-1.5">
        <Sparkles size={13} />
        Supervisión enfocada en hallazgos y cumplimiento. El rendimiento en vivo queda en Monitor.
      </div>
    </div>
  );
};

export default Supervision;
