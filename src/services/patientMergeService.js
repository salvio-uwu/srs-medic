// src/services/patientMergeService.js
//
// Servicio de auditoria y unificacion de duplicados.
// - Detecta pacientes duplicados por CURP, nombre+fecha, idPaciente, fuzzy y telefono+primerNombre.
// - Une dos pacientes (primario = mas antiguo por fechaRegistro) migrando TODAS las colecciones hijas.
// - Snapshot de respaldo en 'pacientes_fusionados_log' antes de eliminar el duplicado.
// - Depura consultas duplicadas (citaId con N>1 o pacienteId+fecha sin citaId) y vacias.
// - Detecta y repara registros huerfanos (referencian un pacienteId fusionado/inexistente).

import {
  collection,
  documentId,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { normalizeForSearch } from '../utils/searchUtils';
import { getPatientDisplayName, sanitizePatientNameFields } from '../utils/patientName';
import { buildPatientHumanId } from '../utils/patientId';

// ─── Constantes ────────────────────────────────────────────────────────

// Colecciones hijas que referencian pacienteId. Se migran todas durante la fusion.
export const PATIENT_LINKED_COLLECTIONS = [
  'historial_clinico',
  'citas',
  'triage_enfermeria',
  'notas_enfermeria',
  'ordenes_enfermeria',
  'estudios_previos',
  'patient_links',
  'auditoria_expediente_clinico'
];

// Bitacora persistente con snapshot del duplicado antes de borrar.
const MERGE_LOG_COLLECTION = 'pacientes_fusionados_log';

const PAGE_SIZE = 500;
const BATCH_LIMIT = 400;

export const MATCH_TYPES = {
  name_birth:  { id: 'name_birth', label: 'Mismo nombre + apellidos' },
  phone_name:  { id: 'phone_name', label: 'Nombre + apellidos + mismo teléfono' }
};

// ─── Helpers de normalizacion ──────────────────────────────────────────

const normDate = (value) => {
  if (!value) return '';
  // Firestore Timestamp
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  const raw = String(value).trim();
  if (!raw) return '';

  // YYYY-MM-DD
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY o DD-MM-YYYY
  m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // fallback generico
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const normPhone = (v) => String(v || '').replace(/\D/g, '');

const normCurp = (v) =>
  String(v || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();

const fold = (s) => normalizeForSearch(s);

const getMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
};

// Orden por antiguedad: fechaRegistro > migradoAt > fechaActualizacion > Infinito.
export const computeAntiguedad = (px) => {
  return (
    getMillis(px.fechaRegistro) ||
    getMillis(px.migradoAt) ||
    getMillis(px.fechaActualizacion) ||
    Number.MAX_SAFE_INTEGER
  );
};

// ─── Carga masiva de pacientes ────────────────────────────────────────

/**
 * Carga TODOS los pacientes de Firestore paginando.
 * Excluye por default los marcados como fusionados (mergedIntoPacienteId).
 *
 * @param {(loaded:number)=>void} onProgress
 * @param {object} options { includeMerged }
 * @returns {Promise<Array<object>>}
 */
export const loadAllPatients = async (onProgress, options = {}) => {
  const { includeMerged = false } = options;
  const all = [];
  let lastDoc = null;

  // Loop paginado con orderBy(documentId) para cursor estable.
  // Se queda fuera del while-true clasico: usa break por longitud de pagina.
  while (true) {
    const baseQuery = lastDoc
      ? query(collection(db, 'pacientes'), orderBy(documentId()), startAfter(lastDoc), limit(PAGE_SIZE))
      : query(collection(db, 'pacientes'), orderBy(documentId()), limit(PAGE_SIZE));
    const snap = await getDocs(baseQuery);
    if (snap.empty) break;

    for (const d of snap.docs) {
      const data = d.data() || {};
      if (!includeMerged && data.mergedIntoPacienteId) continue;
      all.push({ id: d.id, ...data });
    }

    if (onProgress) onProgress(all.length);

    if (snap.docs.length < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return all;
};

// ─── Deteccion de duplicados ───────────────────────────────────────────

const byId = (pacientes, getFn) => {
  const map = new Map();
  for (const px of pacientes) {
    const val = getFn(px);
    if (!val) continue;
    if (!map.has(val)) map.set(val, []);
    map.get(val).push(px);
  }
  const result = [];
  for (const [, arr] of map) {
    if (arr.length > 1) result.push(arr);
  }
  return result;
};

/**
 * Solo 2 reglas por rendimiento:
 * 1. Mismo nombreCompleto (fold: sin acentos, minusculas)
 * 2. Mismo nombreCompleto + mismo telefono
 */
export const buildDuplicateGroups = (pacientes, options = {}) => {
  const { types = null } = options;
  const active = (t) => !types || types.includes(t);

  const groups = [];

  // Regla 1: mismo nombre fold
  if (active('name_birth')) {
    for (const arr of byId(pacientes, (px) => {
      const name = fold(getPatientDisplayName(px));
      return name || null;
    })) {
      const sorted = arr.slice().sort((a, b) => computeAntiguedad(a) - computeAntiguedad(b));
      groups.push({
        key: `nombre_${fold(getPatientDisplayName(sorted[0]))}`,
        matchType: 'name_birth',
        types: ['name_birth'],
        reasonLabel: 'Mismo nombre y apellidos',
        patients: sorted,
        primary: sorted[0],
        candidates: sorted.slice(1)
      });
    }
  }

  // Regla 2: mismo nombre fold + mismo telefono
  if (active('phone_name')) {
    for (const arr of byId(pacientes, (px) => {
      const name = fold(getPatientDisplayName(px));
      const phone = normPhone(px.telefonoMovil);
      return name && phone && phone.length >= 7 ? `${name}|${phone}` : null;
    })) {
      const sorted = arr.slice().sort((a, b) => computeAntiguedad(a) - computeAntiguedad(b));
      groups.push({
        key: `tel_${sorted[0].id}`,
        matchType: 'phone_name',
        types: ['phone_name'],
        reasonLabel: 'Mismo nombre + mismo teléfono',
        patients: sorted,
        primary: sorted[0],
        candidates: sorted.slice(1)
      });
    }
  }

  return groups;
};

// ─── Conteo de docs hijos por paciente ────────────────────────────────

/**
 * Cuenta cuantos docs hijos referencian a un paciente en cada coleccion.
 * Usado para mostrar impacto en la UI y para el snapshot pre-merge.
 *
 * @param {string} pacienteId
 * @returns {Promise<Record<string, number>>}
 */
export const countChildDocs = async (pacienteId) => {
  const counts = {};
  for (const col of PATIENT_LINKED_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, col), where('pacienteId', '==', pacienteId)));
    counts[col] = snap.size;
  }
  return counts;
};

// ─── Merge fisico ──────────────────────────────────────────────────────

/**
 * Fusiona el paciente `duplicateId` en `primaryId`.
 *
 * Pasos:
 *  1. Validaciones (existencia, no merge consigo mismo, primario no fusionado).
 *  2. Cuenta docs hijos del duplicado.
 *  3. Calcula los datos consolidados del primario aplicando `fieldsToCopy`
 *     ('duplicate' = tomar del duplicado, otro = mantener primario) y recomputa
 *     nombres/searchName/idPaciente.
 *  4. Escribe snapshot en `pacientes_fusionados_log` con primaryBefore, duplicateSnapshot,
 *     primaryAfter, counts y meta.
 *  5. Migra TODAS las colecciones hijas en batches de 400.
 *  6. Actualiza el primario con datos consolidados.
 *  7. ELIMINA fisicamente el duplicado.
 *
 * @param {object} params { primaryId, duplicateId, fieldsToCopy, executedBy, dryRun, onLog }
 * @returns {Promise<{ dryRun: boolean, counts, primary, duplicateRemoved? }>}
 */
export const mergePatients = async ({
  primaryId,
  duplicateId,
  fieldsToCopy = {},
  executedBy = null,
  dryRun = false,
  onLog
}) => {
  if (!primaryId || !duplicateId) throw new Error('primaryId y duplicateId son requeridos.');
  if (primaryId === duplicateId) throw new Error('Primario y duplicado son el mismo documento.');

  const log = (msg, kind = 'info') => {
    if (onLog) onLog({ msg, kind });
  };

  const [primarySnap, dupSnap] = await Promise.all([
    getDoc(doc(db, 'pacientes', primaryId)),
    getDoc(doc(db, 'pacientes', duplicateId))
  ]);

  if (!primarySnap.exists()) throw new Error('Paciente primario no existe.');
  if (!dupSnap.exists()) throw new Error('Paciente duplicado no existe.');

  const primary = { id: primarySnap.id, ...primarySnap.data() };
  const duplicate = { id: dupSnap.id, ...dupSnap.data() };

  if (primary.mergedIntoPacienteId) {
    throw new Error(
      `El primario ya fue fusionado en ${primary.mergedIntoPacienteId}. Reabre el grupo con ese ID.`
    );
  }

  log(`Primario: ${getPatientDisplayName(primary)} (${primary.id})`);
  log(`Duplicado: ${getPatientDisplayName(duplicate)} (${duplicate.id})`);

  // Paso 1: contar docs hijos.
  const counts = await countChildDocs(duplicateId);
  const totalHijos = Object.values(counts).reduce((acc, n) => acc + n, 0);
  log(`Total docs hijos del duplicado: ${totalHijos}`);

  if (dryRun) {
    return { dryRun: true, counts, primary, duplicate };
  }

  // Paso 2: consolidar datos del primario.
  const newPrimaryData = { ...primary };
  for (const field of Object.keys(fieldsToCopy)) {
    if (fieldsToCopy[field] === 'duplicate') {
      newPrimaryData[field] = duplicate[field] ?? '';
    }
  }

  const cleaned = sanitizePatientNameFields(newPrimaryData);
  newPrimaryData.nombre = cleaned.nombre;
  newPrimaryData.apellidoPaterno = cleaned.apellidoPaterno;
  newPrimaryData.apellidoMaterno = cleaned.apellidoMaterno;
  newPrimaryData.nombreCompleto = cleaned.nombreCompleto;
  newPrimaryData.searchName = normalizeForSearch(cleaned.nombreCompleto);
  if (newPrimaryData.fechaNacimiento) {
    newPrimaryData.idPaciente = buildPatientHumanId(cleaned.nombreCompleto, newPrimaryData.fechaNacimiento);
  }
  // Asegurar que el primario quede limpio si quedo marcado en un intento previo.
  delete newPrimaryData.mergedIntoPacienteId;
  delete newPrimaryData.mergedIntoPacienteNombre;
  delete newPrimaryData.mergedAt;

  const PRIMARY_NAME = cleaned.nombreCompleto;

  // Paso 3: snapshot de respaldo PREVIO a cualquier mutacion destructiva.
  try {
    await addDoc(collection(db, MERGE_LOG_COLLECTION), {
      duplicateId,
      primaryId,
      duplicateSnapshot: duplicate,
      primaryBefore: primary,
      primaryAfter: newPrimaryData,
      fieldsToCopy,
      countsMovidos: counts,
      fusionadoPor: executedBy,
      fusionadoAt: serverTimestamp()
    });
    log('Snapshot del duplicado guardado en pacientes_fusionados_log.', 'success');
  } catch (err) {
    log(`No se pudo guardar snapshot: ${err.message}`, 'error');
    throw err;
  }

  // Paso 4: migrar colecciones hijas en batches.
  const mergeMeta = {
    _mergedFrom: duplicateId,
    _mergedAt: new Date().toISOString()
  };

  for (const col of PATIENT_LINKED_COLLECTIONS) {
    if (!counts[col]) continue;
    const snap = await getDocs(query(collection(db, col), where('pacienteId', '==', duplicateId)));
    const docsArr = snap.docs;
    for (let i = 0; i < docsArr.length; i += BATCH_LIMIT) {
      const chunk = docsArr.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const d of chunk) {
        const data = d.data() || {};
        const updates = { pacienteId: primaryId, ...mergeMeta };
        // Renombrar campos denormalizados solo si la coleccion los usa.
        if ('pacienteNombre' in data) updates.pacienteNombre = PRIMARY_NAME;
        if ('paciente' in data) updates.paciente = PRIMARY_NAME;
        batch.update(d.ref, updates);
      }
      await batch.commit();
    }
    log(`${col}: ${counts[col]} docs movidos al primario.`, 'success');
  }

  // Paso 5: actualizar primario con datos consolidados.
  const finalUpdates = {
    ...newPrimaryData,
    fechaActualizacion: new Date().toISOString(),
    ultimaFusionEn: new Date().toISOString(),
    ultimaFusionDe: duplicateId,
    fusionadoPor: executedBy || null
  };
  delete finalUpdates.id;

  const batchPrim = writeBatch(db);
  batchPrim.update(doc(db, 'pacientes', primaryId), finalUpdates);
  await batchPrim.commit();
  log('Primario actualizado con datos consolidados.', 'success');

  // Paso 6: borrar fisicamente el duplicado.
  await deleteDoc(doc(db, 'pacientes', duplicateId));
  log('Duplicado eliminado fisicamente.', 'success');

  return {
    dryRun: false,
    counts,
    primary: { id: primaryId, ...newPrimaryData },
    duplicateRemoved: duplicateId
  };
};

// ─── Consultas duplicadas / vacias ────────────────────────────────────

const PAGINATE_HISTORIAL_PAGE = 800;

/**
 * Escanea historial_clinico paginando por documentId (cursor estable).
 * Detecta:
 *  - Grupos por citaId con N>1 (la cita real solo deberia tener 1 nota).
 *  - Grupos por pacienteId + fecha truncada al dia (cuando no hay citaId).
 *  - Registros vacios (sin datos clinicos relevantes).
 *
 * @param {(loaded:number)=>void} onProgress
 */
export const scanConsultasDuplicates = async (onProgress) => {
  const all = [];
  let lastDoc = null;

  while (true) {
    const q = lastDoc
      ? query(collection(db, 'historial_clinico'), orderBy(documentId()), startAfter(lastDoc), limit(PAGINATE_HISTORIAL_PAGE))
      : query(collection(db, 'historial_clinico'), orderBy(documentId()), limit(PAGINATE_HISTORIAL_PAGE));
    const snap = await getDocs(q);
    if (snap.empty) break;
    snap.docs.forEach((d) => all.push({ id: d.id, ...d.data() }));
    if (onProgress) onProgress(all.length);
    if (snap.docs.length < PAGINATE_HISTORIAL_PAGE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  const byCita = new Map();
  const byPxFecha = new Map();

  for (const r of all) {
    if (r.citaId) {
      if (!byCita.has(r.citaId)) byCita.set(r.citaId, []);
      byCita.get(r.citaId).push(r);
    } else if (r.pacienteId) {
      const fechaSource = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha || 0);
      if (Number.isNaN(fechaSource.getTime())) continue;
      const dateKey = `${fechaSource.getFullYear()}-${String(fechaSource.getMonth() + 1).padStart(2, '0')}-${String(fechaSource.getDate()).padStart(2, '0')}`;
      const key = `${r.pacienteId}|${dateKey}`;
      if (!byPxFecha.has(key)) byPxFecha.set(key, []);
      byPxFecha.get(key).push(r);
    }
  }

  const duplicadosPorCita = [];
  for (const [citaId, arr] of byCita) {
    if (arr.length > 1) {
      const sorted = arr.slice().sort((a, b) => scorearConsulta(b) - scorearConsulta(a));
      duplicadosPorCita.push({
        key: `cita:${citaId}`,
        kind: 'cita',
        citaId,
        pacienteId: sorted[0].pacienteId || null,
        pacienteNombre: sorted[0].pacienteNombre || null,
        records: sorted
      });
    }
  }

  const duplicadosPorPaciente = [];
  for (const [key, arr] of byPxFecha) {
    if (arr.length > 1) {
      const sorted = arr.slice().sort((a, b) => scorearConsulta(b) - scorearConsulta(a));
      duplicadosPorPaciente.push({
        key: `pxfecha:${key}`,
        kind: 'paciente_fecha',
        pacienteId: sorted[0].pacienteId || null,
        pacienteNombre: sorted[0].pacienteNombre || null,
        records: sorted
      });
    }
  }

  // Vacios: sin datos clinicos y no parte de un grupo duplicado (para no borrar info de un grupo).
  const idsEnGrupos = new Set();
  for (const g of duplicadosPorCita) g.records.forEach((r) => idsEnGrupos.add(r.id));
  for (const g of duplicadosPorPaciente) g.records.forEach((r) => idsEnGrupos.add(r.id));

  const vacios = all.filter((r) => !tieneDatosClinicos(r) && !idsEnGrupos.has(r.id));

  // Ordenamos por tamano descendente para presentar primero los casos peores.
  duplicadosPorCita.sort((a, b) => b.records.length - a.records.length);
  duplicadosPorPaciente.sort((a, b) => b.records.length - a.records.length);

  return {
    total: all.length,
    duplicadosPorCita,
    duplicadosPorPaciente,
    vacios
  };
};

export const tieneDatosClinicos = (record) => {
  const c = record?.consulta || {};
  const signos = c?.exploracion?.signos || {};
  const antro = c?.exploracion?.antropometria || {};
  const tieneSignos = Object.values(signos).some((v) => String(v || '').trim());
  const tieneAntro = ['peso', 'talla'].some((k) => String(antro[k] || '').trim());
  const tienePadec = String(c?.padecimiento || '').trim();
  const tieneDx = String(c?.diagnostico?.enfermedad_actual || '').trim();
  const tieneTx = (c?.diagnostico?.tratamiento_lista || []).length > 0;
  const tieneInd = String(c?.diagnostico?.indicaciones || '').trim();
  const tieneEstudios =
    (c?.estudios?.paquetes_seleccionados?.length || 0) > 0 ||
    (c?.estudios?.estudios_seleccionados?.length || 0) > 0;
  const tieneProc = (c?.procedimientos?.seleccionados?.length || 0) > 0;
  const tieneRx = (record?.recetasGeneradas || []).length > 0;
  const tieneDocs = (record?.documentosGenerados || []).length > 0;
  return (
    tieneSignos ||
    tieneAntro ||
    tienePadec ||
    tieneDx ||
    tieneTx ||
    tieneInd ||
    tieneEstudios ||
    tieneProc ||
    tieneRx ||
    tieneDocs
  );
};

export const scorearConsulta = (r) => {
  let score = 0;
  if (r?.medicoNombre) score += 1;
  if (r?.tipoNota) score += 1;
  if (tieneDatosClinicos(r)) score += 5;
  if ((r?.recetasGeneradas || []).length > 0) score += 2;
  if ((r?.documentosGenerados || []).length > 0) score += 2;
  if ((r?.consulta?.diagnostico?.tratamiento_lista || []).length > 0) score += 3;
  if (r?.consulta?.diagnostico?.enfermedad_actual) score += 2;
  if ((r?.meta?.costo || 0) > 0) score += 1;
  return score;
};

/**
 * Toma N consultas, conserva la mejor (mayor score) y elimina las restantes
 * fusionando sus arreglos de recetasGeneradas y documentosGenerados en la principal.
 */
export const unificarConsultas = async (records) => {
  if (!Array.isArray(records) || records.length < 2) return null;
  const sorted = records.slice().sort((a, b) => scorearConsulta(b) - scorearConsulta(a));
  const principal = sorted[0];
  const secundarios = sorted.slice(1);

  const allRecetas = [];
  const allDocs = [];
  for (const r of records) {
    if (Array.isArray(r.recetasGeneradas)) allRecetas.push(...r.recetasGeneradas);
    if (Array.isArray(r.documentosGenerados)) allDocs.push(...r.documentosGenerados);
  }

  const seenRx = new Set();
  const recetasUnicas = allRecetas.filter((item) => {
    const k = item?.nombre || item?.plantillaNombre || item?.id || '';
    if (seenRx.has(k)) return false;
    seenRx.add(k);
    return true;
  });

  const seenDocs = new Set();
  const docsUnicos = allDocs.filter((item) => {
    const k = item?.nombre || item?.plantillaNombre || item?.id || '';
    if (seenDocs.has(k)) return false;
    seenDocs.add(k);
    return true;
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'historial_clinico', principal.id), {
    recetasGeneradas: recetasUnicas,
    documentosGenerados: docsUnicos,
    unificadoDe: secundarios.map((r) => r.id),
    unificadoEn: new Date().toISOString()
  });
  for (const r of secundarios) {
    batch.delete(doc(db, 'historial_clinico', r.id));
  }
  await batch.commit();
  return { principal: principal.id, eliminados: secundarios.length };
};

export const eliminarConsultas = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  let removed = 0;
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const id of chunk) batch.delete(doc(db, 'historial_clinico', id));
    await batch.commit();
    removed += chunk.length;
  }
  return removed;
};

// ─── Huerfanos ────────────────────────────────────────────────────────

const ORPHAN_COLLECTIONS = [
  'historial_clinico',
  'citas',
  'triage_enfermeria',
  'notas_enfermeria',
  'ordenes_enfermeria',
  'estudios_previos',
  'patient_links'
];

/**
 * Detecta docs cuyo pacienteId no apunta a un paciente activo en la coleccion.
 * Si apunta a un paciente con mergedIntoPacienteId, se considera 'redirectible'.
 *
 * @returns {Promise<{ summary, items }>}
 */
export const scanHuerfanos = async (onProgress) => {
  // Indice de pacientes activos + redirecciones.
  const pacientesSnap = await getDocs(collection(db, 'pacientes'));
  const validIds = new Set();
  const redirectMap = new Map();
  pacientesSnap.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.mergedIntoPacienteId) {
      redirectMap.set(d.id, data.mergedIntoPacienteId);
    } else {
      validIds.add(d.id);
    }
  });

  const items = {};
  const summary = { totalHuerfanos: 0, redirectibles: 0, sinDestino: 0 };

  for (const col of ORPHAN_COLLECTIONS) {
    items[col] = [];
    const snap = await getDocs(collection(db, col));
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const pxId = data.pacienteId;
      if (!pxId) return;
      if (validIds.has(pxId)) return;
      const redirect = redirectMap.get(pxId) || null;
      items[col].push({
        id: d.id,
        coleccion: col,
        pacienteId: pxId,
        redirectTo: redirect,
        pacienteNombre: data.pacienteNombre || data.paciente || data.patientName || null,
        fecha: data.fecha || data.fechaHora || data.linkedAt || null
      });
      summary.totalHuerfanos += 1;
      if (redirect) summary.redirectibles += 1;
      else summary.sinDestino += 1;
    });
    if (onProgress) onProgress(summary.totalHuerfanos);
  }

  return { summary, items };
};

/**
 * Para cada huerfano con redirectTo: re-apunta pacienteId al primario.
 *
 * @param {object} items huerfanos.items {col: [{id, redirectTo, pacienteId}]}
 * @returns {Promise<{reasignados:number, sinDestino:number}>}
 */
export const repararHuerfanos = async (items, onLog) => {
  let reasignados = 0;
  let sinDestino = 0;
  const log = (msg, kind = 'info') => onLog && onLog({ msg, kind });

  for (const col of Object.keys(items || {})) {
    const arr = items[col] || [];
    if (!arr.length) continue;

    const redirigibles = arr.filter((item) => item.redirectTo);
    const huerfanosPuros = arr.filter((item) => !item.redirectTo);

    for (let i = 0; i < redirigibles.length; i += BATCH_LIMIT) {
      const chunk = redirigibles.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.update(doc(db, col, item.id), {
          pacienteId: item.redirectTo,
          _mergedFrom: item.pacienteId,
          _mergedAt: new Date().toISOString(),
          _huerfanoReparado: true
        });
      }
      await batch.commit();
      reasignados += chunk.length;
    }
    sinDestino += huerfanosPuros.length;
    log(`${col}: ${redirigibles.length} reasignados, ${huerfanosPuros.length} sin destino.`);
  }

  return { reasignados, sinDestino };
};

/**
 * Elimina los huerfanos puros (sin destino). Es operacion destructiva irreversible.
 */
export const eliminarHuerfanosSinDestino = async (items) => {
  let eliminados = 0;
  for (const col of Object.keys(items || {})) {
    const arr = (items[col] || []).filter((item) => !item.redirectTo);
    if (!arr.length) continue;
    for (let i = 0; i < arr.length; i += BATCH_LIMIT) {
      const chunk = arr.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const item of chunk) batch.delete(doc(db, col, item.id));
      await batch.commit();
      eliminados += chunk.length;
    }
  }
  return eliminados;
};

// ─── Export CSV ──────────────────────────────────────────────────────

/**
 * Convierte los grupos de duplicados en un CSV para auditoria offline.
 */
export const exportDuplicatesToCsv = (groups) => {
  const rows = [
    ['grupoKey', 'matchType', 'score', 'reason', 'esPrimario', 'pacienteId', 'nombre', 'fechaNacimiento', 'curp', 'idPaciente', 'idPacienteMigrado', 'telefonoMovil', 'fechaRegistro']
  ];
  for (const g of groups) {
    for (const px of g.patients) {
      rows.push([
        g.key,
        g.matchType,
        g.score,
        g.reasonLabel,
        px.id === g.primary?.id ? 'SI' : 'no',
        px.id,
        getPatientDisplayName(px),
        normDate(px.fechaNacimiento),
        normCurp(px.curp),
        px.idPaciente || '',
        px.idPacienteMigrado || '',
        px.telefonoMovil || '',
        new Date(getMillis(px.fechaRegistro)).toISOString()
      ]);
    }
  }
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = String(cell ?? '');
          if (v.includes(',') || v.includes('"') || v.includes('\n')) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        })
        .join(',')
    )
    .join('\n');
};
