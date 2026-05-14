// src/hooks/useMonitorData.js
// Hook centralizado de datos para el Monitor de Actividad.
// Suscribe a Firestore en tiempo real y calcula métricas por persona.

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const ROLES_MEDICOS    = new Set(['medico']);
export const ROLES_ENFERMERIA = new Set(['enfermeria', 'jefa_enfermeria']);
export const ROLES_ADMIN_STAFF = new Set([
  'admin', 'admin_maestro', 'administrador', 'recepcion', 'rh', 'operativo', 'intendencia',
]);
export const ROLES_AUDITABLES = new Set([
  ...ROLES_MEDICOS, ...ROLES_ENFERMERIA, ...ROLES_ADMIN_STAFF,
]);

const ESTADOS_REALIZADAS  = new Set(['completada', 'finalizada', 'atendida']);
const ESTADOS_CANCELADAS  = new Set(['cancelada', 'no_asistio']);

// ─── Helpers puros (exportados para uso en la UI) ────────────────────────────

const parseSafe = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export function isUserOnline(user) {
  // isOnline puede estar atascado en true si el usuario cerró el navegador sin logout.
  // Siempre verificamos contra lastSeen para tener una ventana de 10 minutos realista.
  const ls = parseSafe(user.lastSeen);
  if (!ls) return false;
  return user.isOnline === true && Date.now() - ls.getTime() < 10 * 60 * 1000;
}

export function getConnectedMinutes(user) {
  if (!isUserOnline(user)) return 0;
  // Usamos lastLogin como inicio de sesión (más preciso que lastSeen)
  const ref = parseSafe(user.lastLogin) || parseSafe(user.lastSeen);
  if (!ref) return 0;
  return Math.max(0, Math.floor((Date.now() - ref.getTime()) / 60000));
}

export function fmtMinutes(min) {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function timeAgo(iso) {
  if (!iso) return null;
  const d = parseSafe(iso);
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'hace un momento';
  const m = Math.floor(s / 60);
  if (m < 60)  return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ─── Cálculo de métricas por persona ─────────────────────────────────────────

function computeMetrics(user, citas, movimientos, triajes, notas, ordenes) {
  const uid       = user.id || user.uid;
  const esMedico  = ROLES_MEDICOS.has(user.rol);
  const esEnf     = ROLES_ENFERMERIA.has(user.rol);
  const online    = isUserOnline(user);
  const minutos   = getConnectedMinutes(user);

  // ── Citas del médico o enfermera ──
  const misCitas = esMedico
    ? citas.filter(c => c.doctorUid === uid)
    : esEnf
      ? citas.filter(c => c.esCitaEnfermeria && c.enfermeroAsignadoId === uid)
      : [];

  const realizadas  = misCitas.filter(c => ESTADOS_REALIZADAS.has(c.estado));
  const canceladas  = misCitas.filter(c => ESTADOS_CANCELADAS.has(c.estado));
  const enConsulta  = misCitas.filter(c => c.estado === 'en_consulta');
  const enEspera    = misCitas.filter(c => c.estado === 'en_espera' || c.estado === 'en_triage');

  // Citas creadas por este usuario (cualquier rol)
  const citasCreadas = citas.filter(c => c.creadoPor === uid).length;

  // ── Métricas financieras ──
  const ingresos   = realizadas.reduce((s, c) => s + (c.ingreso || 0), 0);
  const ingresoProm = realizadas.length > 0 ? Math.round(ingresos / realizadas.length) : 0;

  // ── Tasa de cumplimiento ──
  const tasaCumplimiento = misCitas.length > 0
    ? Math.round((realizadas.length / misCitas.length) * 100)
    : null; // null → sin citas asignadas (evita mostrar 0% incorrecto)

  // ── Atenciones por hora (solo si lleva ≥ 30 min en turno) ──
  const atencionesPorHora = minutos >= 30
    ? parseFloat((realizadas.length / (minutos / 60)).toFixed(1))
    : null;

  // ── Tipos de consulta ──
  const primeraVez  = misCitas.filter(c => c.tipoConsulta === 'primera_vez').length;
  const subsecuente = misCitas.filter(c => c.tipoConsulta === 'subsecuente').length;
  const urgencia    = misCitas.filter(c => c.tipoConsulta === 'urgencia').length;
  const teleconsultas = misCitas.filter(c => c.esTeleconsulta).length;

  // ── Cambios de consultorio (solo médicos) ──
  const cambiosConsultorio = esMedico
    ? movimientos.filter(m => m.doctorUid === uid).length
    : 0;

  // ── Métricas exclusivas de enfermería ──
  const triagesCount = esEnf
    ? triajes.filter(t =>
        t.enfermeraUid === uid || t.enfermeraId === uid ||
        t.creadoPor === uid   || t.realizadoPor === uid
      ).length
    : 0;

  const notasCount = esEnf
    ? notas.filter(n => n.enfermeraId === uid || n.creadoPor === uid || n.enfermeraUid === uid).length
    : 0;

  const ordenesCount = esEnf
    ? ordenes.filter(o => o.registradoPorId === uid || o.enfermeroAsignadoId === uid).length
    : 0;

  // ── Score compuesto (diferente según rol) ──
  let score;
  if (esMedico) {
    score = Math.max(0, Math.round(
      (realizadas.length * 4) +
      (citasCreadas * 2) +
      Math.min(tasaCumplimiento ?? 0, 100) -
      (canceladas.length * 1.5) -
      (cambiosConsultorio * 0.5)
    ));
  } else if (esEnf) {
    score = Math.max(0, Math.round(
      (triagesCount * 3) +
      (realizadas.length * 4) +
      (notasCount * 2) +
      (ordenesCount * 2) -
      (canceladas.length * 1.5)
    ));
  } else {
    // Admin / recepción / etc.
    score = Math.max(0, Math.round(citasCreadas * 2));
  }

  return {
    uid,
    nombre:          user.nombre || 'Sin nombre',
    rol:             user.rol || '',
    grupo:           esMedico ? 'medico' : esEnf ? 'enfermeria' : 'admin',
    // Ubicación: priorizar campos de sesión activa (nuevos) sobre campos legacy
    sucursal:        user.sessionSucursalNombre  || user.sucursalActual  || user.sucursal  || '—',
    consultorio:     user.sessionConsultorioNombre || user.consultorioActual || user.consultorio || '—',
    statusOperativo: user.statusOperativo || (online ? 'activo' : 'offline'),
    online,
    minutos,
    tiempoConectado: fmtMinutes(minutos),

    // Citas
    asignadas:    misCitas.length,
    realizadas:   realizadas.length,
    canceladas:   canceladas.length,
    enConsulta:   enConsulta.length,
    enEspera:     enEspera.length,
    citasCreadas,

    // Métricas
    tasaCumplimiento,
    ingresos,
    ingresoProm,
    atencionesPorHora,
    score,

    // Tipos de consulta
    primeraVez,
    subsecuente,
    urgencia,
    teleconsultas,

    // Por rol
    cambiosConsultorio,
    triagesCount,
    notasCount,
    ordenesCount,

    // Meta
    lastSeen:  user.lastSeen,
    lastLogin: user.lastLogin,
  };
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useMonitorData(selectedDate) {
  const [rawUsers,      setRawUsers]      = useState([]);
  const [rawCitas,      setRawCitas]      = useState([]);
  const [rawMovimientos,setRawMovimientos]= useState([]);
  const [rawTriajes,    setRawTriajes]    = useState([]);
  const [rawNotas,      setRawNotas]      = useState([]);
  const [rawOrdenes,    setRawOrdenes]    = useState([]);

  const [loadingUsers,  setLoadingUsers]  = useState(true);
  const [loadingCitas,  setLoadingCitas]  = useState(true);
  const [isLive,        setIsLive]        = useState(false);
  // everLoaded: true después de la primera carga completa.
  // Permite mostrar spinner completo solo al inicio, y un indicador
  // sutil en cambios de fecha (sin borrar el contenido visible).
  const [everLoaded,    setEverLoaded]    = useState(false);

  // ── Listener de usuarios (permanente, sin filtro de fecha) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      snap => {
        setRawUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingUsers(false);
        setIsLive(true);
      },
      err => { console.error('[Monitor] users:', err); setLoadingUsers(false); }
    );
    return unsub;
  }, []);

  // ── Listeners dependientes de fecha ──
  useEffect(() => {
    if (!selectedDate) return;

    // Señalamos recarga sin borrar datos para evitar parpadeo.
    // Los nuevos listeners sobreescriben los datos cuando llegan.
    setLoadingCitas(true);

    const noop = () => {}; // silencia errores de colecciones sin índice/permiso
    const subs = [];

    // Citas del día
    subs.push(onSnapshot(
      query(collection(db, 'citas'), where('fecha', '==', selectedDate)),
      snap => {
        setRawCitas(snap.docs.map(d => {
          const r = d.data();
          return {
            id: d.id, ...r,
            fecha:   r.fecha || r.fechaHora?.slice(0, 10),
            ingreso: parseFloat(r.motivoPrecioSnapshot ?? r.motivoPrecio ?? 0) || 0,
          };
        }));
        setLoadingCitas(false);
        setEverLoaded(true);
      },
      err => { console.error('[Monitor] citas:', err); setLoadingCitas(false); }
    ));

    // Movimientos de consultorio
    subs.push(onSnapshot(
      query(collection(db, 'auditoria_movimientos_consultorio'), where('fechaString', '==', selectedDate)),
      snap => setRawMovimientos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da = a.fecha?.toDate?.() || new Date(a.fecha || 0);
            const db2 = b.fecha?.toDate?.() || new Date(b.fecha || 0);
            return db2 - da; // más reciente primero
          })
      ),
      noop
    ));

    // Triajes de enfermería — fecha es serverTimestamp() → Timestamp; usar rango de día
    const tsStart = Timestamp.fromDate(new Date(selectedDate + 'T00:00:00'));
    const tsEnd   = Timestamp.fromDate(new Date(selectedDate + 'T23:59:59.999'));

    subs.push(onSnapshot(
      query(
        collection(db, 'triage_enfermeria'),
        where('fecha', '>=', tsStart),
        where('fecha', '<=', tsEnd),
      ),
      snap => setRawTriajes(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      noop
    ));

    // Notas de enfermería — fecha es serverTimestamp() → Timestamp; misma estrategia
    subs.push(onSnapshot(
      query(
        collection(db, 'notas_enfermeria'),
        where('fecha', '>=', tsStart),
        where('fecha', '<=', tsEnd),
      ),
      snap => setRawNotas(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      noop
    ));

    // Órdenes de enfermería
    subs.push(onSnapshot(
      query(collection(db, 'ordenes_enfermeria'), where('fecha', '==', selectedDate)),
      snap => setRawOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      noop
    ));

    return () => subs.forEach(u => u());
  }, [selectedDate]);

  // ── Métricas por persona ──
  const personal = useMemo(() =>
    rawUsers
      .filter(u => ROLES_AUDITABLES.has(u.rol))
      .map(u => computeMetrics(u, rawCitas, rawMovimientos, rawTriajes, rawNotas, rawOrdenes))
      .sort((a, b) => b.score - a.score),
    [rawUsers, rawCitas, rawMovimientos, rawTriajes, rawNotas, rawOrdenes]
  );

  const medicos    = useMemo(() => personal.filter(p => p.grupo === 'medico'),     [personal]);
  const enfermeria = useMemo(() => personal.filter(p => p.grupo === 'enfermeria'), [personal]);
  const adminStaff = useMemo(() => personal.filter(p => p.grupo === 'admin'),      [personal]);
  const enTurno    = useMemo(() => personal.filter(p => p.online),                 [personal]);

  // Sucursales únicas para filtros
  const sucursales = useMemo(() => {
    const set = new Set(personal.map(p => p.sucursal).filter(s => s && s !== '—'));
    return Array.from(set).sort();
  }, [personal]);

  // ── KPIs globales ──
  const kpis = useMemo(() => {
    const realizadas    = rawCitas.filter(c => ESTADOS_REALIZADAS.has(c.estado));
    const canceladas    = rawCitas.filter(c => ESTADOS_CANCELADAS.has(c.estado));
    const ingresoTotal  = realizadas.reduce((s, c) => s + (c.ingreso || 0), 0);

    const medicosConCitas = medicos.filter(m => m.asignadas > 0);
    const eficienciaPromedio = medicosConCitas.length > 0
      ? Math.round(medicosConCitas.reduce((s, m) => s + (m.tasaCumplimiento ?? 0), 0) / medicosConCitas.length)
      : 0;

    return {
      totalPersonal:    personal.length,
      enTurno:          enTurno.length,
      totalCitas:       rawCitas.length,
      citasRealizadas:  realizadas.length,
      citasCanceladas:  canceladas.length,
      citasEnCurso:     rawCitas.filter(c => c.estado === 'en_consulta').length,
      ingresoTotal,
      eficienciaPromedio,
      totalRotaciones:  rawMovimientos.length,
      totalTriajes:     rawTriajes.length,
    };
  }, [personal, medicos, rawCitas, rawMovimientos, rawTriajes, enTurno]);

  return {
    personal, medicos, enfermeria, adminStaff, enTurno,
    citas:       rawCitas,
    movimientos: rawMovimientos,
    triajes:     rawTriajes,
    notas:       rawNotas,
    ordenes:     rawOrdenes,
    kpis,
    sucursales,
    isLive,
    loading:    !everLoaded && (loadingUsers || loadingCitas),
    refreshing: everLoaded && loadingCitas,
  };
}
