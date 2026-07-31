/**
 * Asistencia diaria auditable.
 * Colección: asistencia_diaria/{userId_YYYY-MM-DD}
 *
 * - primeraEntrada: primer inicio de sesión del día
 * - ultimaEntrada: último inicio de sesión del día (si hay varias)
 * - ultimaActividad: último heartbeat / actividad
 * - ultimaSalida: cierre de sesión más reciente
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const ASISTENCIA_COLLECTION = 'asistencia_diaria';

const toYmd = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseSafe = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clean = (v) => String(v ?? '').trim();

export const asistenciaDocId = (userId, fecha = toYmd()) => `${userId}_${fecha}`;

const profileSnapshot = (user = {}) => ({
  userId: user.uid || user.id || '',
  nombre: clean(user.nombre) || clean(user.displayName) || clean(user.email) || 'Sin nombre',
  email: clean(user.email),
  rol: clean(user.rol),
  sucursal: clean(
    user.sessionSucursalNombre
    || user.sucursalActual
    || user.sucursal
    || user.asignacionRecurrente
  ),
  consultorio: clean(
    user.sessionConsultorioNombre
    || user.consultorioActual
    || user.consultorio
  ),
});

/**
 * Primer o nuevo inicio de sesión del día.
 * Llamar una vez al abrir sesión (junto con lastLogin).
 * Evita contar de más por HMR / remount: una entrada por pestaña/día.
 */
export async function registrarEntrada(user) {
  const snap = profileSnapshot(user);
  if (!snap.userId) return null;

  const fecha = toYmd();
  const guardKey = `srs_asist_entrada_${snap.userId}_${fecha}`;
  try {
    if (sessionStorage.getItem(guardKey) === '1') {
      // Misma pestaña ya registró entrada hoy → solo tocar actividad
      return touchActividad(user);
    }
  } catch {
    // sessionStorage no disponible
  }

  const ref = doc(db, ASISTENCIA_COLLECTION, asistenciaDocId(snap.userId, fecha));
  const existing = await getDoc(ref);

  if (!existing.exists()) {
    await setDoc(ref, {
      ...snap,
      fecha,
      primeraEntrada: serverTimestamp(),
      ultimaEntrada: serverTimestamp(),
      ultimaActividad: serverTimestamp(),
      ultimaSalida: null,
      sesiones: 1,
      activo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      ...snap,
      fecha,
      ultimaEntrada: serverTimestamp(),
      ultimaActividad: serverTimestamp(),
      ultimaSalida: null,
      sesiones: increment(1),
      activo: true,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    sessionStorage.setItem(guardKey, '1');
  } catch {
    // ignore
  }
  return ref.id;
}

/**
 * Heartbeat de presencia (no cuenta como nuevo login).
 */
export async function touchActividad(user) {
  const snap = profileSnapshot(user);
  if (!snap.userId) return null;

  const fecha = toYmd();
  const ref = doc(db, ASISTENCIA_COLLECTION, asistenciaDocId(snap.userId, fecha));
  const existing = await getDoc(ref);

  if (!existing.exists()) {
    // Sesión viva sin registro previo (migración en caliente)
    await setDoc(ref, {
      ...snap,
      fecha,
      primeraEntrada: serverTimestamp(),
      ultimaEntrada: serverTimestamp(),
      ultimaActividad: serverTimestamp(),
      ultimaSalida: null,
      sesiones: 1,
      activo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  await updateDoc(ref, {
    nombre: snap.nombre,
    email: snap.email,
    rol: snap.rol,
    sucursal: snap.sucursal || existing.data()?.sucursal || '',
    consultorio: snap.consultorio || existing.data()?.consultorio || '',
    ultimaActividad: serverTimestamp(),
    activo: true,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Cierre de sesión (logout o idle).
 */
export async function registrarSalida(user, motivo = 'logout') {
  const snap = profileSnapshot(user);
  if (!snap.userId) return null;

  const fecha = toYmd();
  try {
    sessionStorage.removeItem(`srs_asist_entrada_${snap.userId}_${fecha}`);
  } catch {
    // ignore
  }

  const ref = doc(db, ASISTENCIA_COLLECTION, asistenciaDocId(snap.userId, fecha));
  const existing = await getDoc(ref);

  if (!existing.exists()) {
    await setDoc(ref, {
      ...snap,
      fecha,
      primeraEntrada: serverTimestamp(),
      ultimaEntrada: serverTimestamp(),
      ultimaActividad: serverTimestamp(),
      ultimaSalida: serverTimestamp(),
      sesiones: 1,
      activo: false,
      motivoSalida: motivo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  await updateDoc(ref, {
    ultimaActividad: serverTimestamp(),
    ultimaSalida: serverTimestamp(),
    activo: false,
    motivoSalida: motivo,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Consulta por rango inclusivo de fechas YYYY-MM-DD.
 */
export async function fetchAsistenciaRango(fechaDesde, fechaHasta) {
  const q = query(
    collection(db, ASISTENCIA_COLLECTION),
    where('fecha', '>=', fechaDesde),
    where('fecha', '<=', fechaHasta),
    orderBy('fecha', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const primera = parseSafe(data.primeraEntrada);
    const ultimaEnt = parseSafe(data.ultimaEntrada);
    const ultimaAct = parseSafe(data.ultimaActividad);
    const salida = parseSafe(data.ultimaSalida);
    const fin = salida || ultimaAct;
    let minutos = null;
    if (primera && fin) {
      minutos = Math.max(0, Math.floor((fin.getTime() - primera.getTime()) / 60000));
    }
    return {
      id: d.id,
      ...data,
      primeraEntrada: primera,
      ultimaEntrada: ultimaEnt,
      ultimaActividad: ultimaAct,
      ultimaSalida: salida,
      minutosEstimados: minutos,
    };
  });
}

export function rangoParaPeriodo(periodo, fechaAnclaYmd) {
  const base = new Date(`${fechaAnclaYmd}T12:00:00`);
  if (Number.isNaN(base.getTime())) {
    const hoy = toYmd();
    return { desde: hoy, hasta: hoy, label: 'Hoy' };
  }

  if (periodo === 'dia') {
    return { desde: fechaAnclaYmd, hasta: fechaAnclaYmd, label: `Día ${fechaAnclaYmd}` };
  }

  if (periodo === 'semana') {
    const day = base.getDay(); // 0 domingo
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      desde: toYmd(monday),
      hasta: toYmd(sunday),
      label: `Semana ${toYmd(monday)} → ${toYmd(sunday)}`,
    };
  }

  if (periodo === 'quincena') {
    const d = base.getDate();
    const y = base.getFullYear();
    const m = base.getMonth();
    if (d <= 15) {
      return {
        desde: toYmd(new Date(y, m, 1)),
        hasta: toYmd(new Date(y, m, 15)),
        label: `1–15 ${fechaAnclaYmd.slice(0, 7)}`,
      };
    }
    const last = new Date(y, m + 1, 0);
    return {
      desde: toYmd(new Date(y, m, 16)),
      hasta: toYmd(last),
      label: `16–${last.getDate()} ${fechaAnclaYmd.slice(0, 7)}`,
    };
  }

  // mes
  const y = base.getFullYear();
  const m = base.getMonth();
  const desde = toYmd(new Date(y, m, 1));
  const hasta = toYmd(new Date(y, m + 1, 0));
  return { desde, hasta, label: `Mes ${fechaAnclaYmd.slice(0, 7)}` };
}

const fmtCsvTime = (d) => {
  if (!d) return '';
  return d.toLocaleString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
};

const fmtCsvDuration = (min) => {
  if (min == null || min < 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export function buildAsistenciaCsv(rows, { desde, hasta, label } = {}) {
  const header = [
    'Fecha',
    'Nombre',
    'Rol',
    'Sucursal',
    'Consultorio',
    'Primera entrada',
    'Ultima entrada',
    'Ultima actividad',
    'Ultima salida',
    'Sesiones',
    'Minutos estimados',
    'Activo',
    'Email',
    'UserId',
  ];

  const lines = [header.join(',')];
  const esc = (v) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  rows.forEach((r) => {
    lines.push([
      r.fecha,
      r.nombre,
      r.rol,
      r.sucursal,
      r.consultorio,
      fmtCsvTime(r.primeraEntrada),
      fmtCsvTime(r.ultimaEntrada),
      fmtCsvTime(r.ultimaActividad),
      fmtCsvTime(r.ultimaSalida),
      r.sesiones ?? 1,
      fmtCsvDuration(r.minutosEstimados),
      r.activo ? 'si' : 'no',
      r.email,
      r.userId,
    ].map(esc).join(','));
  });

  const meta = `# Reporte asistencia SRS-Medic | ${label || ''} | ${desde || ''} a ${hasta || ''} | generado ${fmtCsvTime(new Date())}\n`;
  return meta + lines.join('\n');
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob(['\ufeff' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
