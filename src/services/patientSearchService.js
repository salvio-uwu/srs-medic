import { collection, getDocs, limit, orderBy, query, startAt, endAt, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getPatientDisplayName, sanitizePatientNameFields } from '../utils/patientName';
import { normalizeForSearch, fuzzyScore } from '../utils/searchUtils';

const PACIENTES_REF = collection(db, 'pacientes');
const DEFAULT_LIMIT = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

const extractPatientData = (docRef) => {
  const data = docRef.data() || {};
  const normalizedNames = sanitizePatientNameFields({
    nombre: data.nombre || '',
    apellidoPaterno: data.apellidoPaterno || '',
    apellidoMaterno: data.apellidoMaterno || '',
    nombreCompleto: data.nombreCompleto || ''
  });
  // Conservar el documento completo: el listado de búsqueda alimenta edición y
  // el visor de expediente; recortar campos hacía que datos del alta de px no
  // aparecieran aunque sí estuvieran guardados en Firestore.
  return {
    ...data,
    id: docRef.id,
    nombre: normalizedNames.nombre,
    nombreCompleto: normalizedNames.nombreCompleto,
    apellidoPaterno: normalizedNames.apellidoPaterno,
    apellidoMaterno: normalizedNames.apellidoMaterno,
    telefono: data.telefonoMovil || data.telefono || '',
    telefonoMovil: data.telefonoMovil || data.telefono || '',
    idPaciente: data.idPaciente || data.idPacienteMigrado || '',
  };
};

const emptySnap = { docs: [] };

const runPrefixQuery = (field, prefix, max) => {
  if (!prefix) return Promise.resolve(emptySnap);
  return getDocs(query(PACIENTES_REF, orderBy(field), startAt(prefix), endAt(prefix + '\uf8ff'), limit(max)))
    .catch((err) => {
      console.error(`[patientSearch] Query fallida en campo "${field}" con prefijo "${prefix}":`, err);
      return emptySnap;
    });
};

const runEqualityQuery = (field, value, max = 15) => {
  if (!value) return Promise.resolve(emptySnap);
  return getDocs(query(PACIENTES_REF, where(field, '==', value), limit(max)))
    .catch((err) => {
      console.error(`[patientSearch] Equality fallida en campo "${field}" con valor "${value}":`, err);
      return emptySnap;
    });
};

const titleCase = (str = '') =>
  String(str || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\S)/g, (_, space, char) => `${space}${char.toLocaleUpperCase('es-MX')}`);

const uniqueNonEmpty = (values = []) => {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const v = String(value || '').replace(/\s+/g, ' ').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

/** Tokens de nombre del paciente (sin acentos) para matching estricto. */
const patientNameTokens = (patient) => {
  const parts = [
    patient.nombreCompleto,
    patient.nombre,
    patient.apellidoPaterno,
    patient.apellidoMaterno,
    patient.searchName,
  ]
    .map((v) => normalizeForSearch(v || ''))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);
  return parts;
};

/**
 * Multi-token: cada token de la búsqueda debe coincidir con un token del nombre
 * (igual o prefijo). Evita falsos positivos tipo maria≈garza / luna≈ana del fuzzy laxo.
 */
const matchesAllTokens = (patient, tokens) => {
  const nameToks = patientNameTokens(patient);
  if (!nameToks.length) return false;

  return tokens.every((token) =>
    nameToks.some((ct) => ct === token || ct.startsWith(token) || (token.length >= 4 && token.startsWith(ct) && ct.length >= 3))
  );
};

const isMergedPatient = (patient) => Boolean(patient?.mergedIntoPacienteId);

// ─── Búsqueda principal ────────────────────────────────────────────────────

/**
 * Busca pacientes por nombre, apellido o teléfono.
 *
 * Estrategia:
 * 1. Igualdad exacta (mismo camino que la detección de duplicados al alta).
 * 2. Prefijos progresivos en searchName ("maria", "maria garza", "maria garza luna").
 * 3. Prefijos en nombreCompleto / nombre / apellidos con variantes de mayúsculas.
 * 4. Filtro multi-token estricto + ranking por relevancia (no solo alfabético).
 */
export const searchPatients = async (searchTerm, maxResults = DEFAULT_LIMIT) => {
  const rawTerm = searchTerm.trim();
  const term = normalizeForSearch(rawTerm);
  if (term.length < 2) return [];

  const results = new Map();
  const tokens = term.split(/\s+/).filter((t) => t.length >= 2);
  const isMultiToken = tokens.length > 1;

  const nameTitle = titleCase(term);
  const nameUpper = term.toLocaleUpperCase('es-MX');
  const rawTitle = titleCase(rawTerm.toLocaleLowerCase('es-MX'));
  const rawUpper = rawTerm.replace(/\s+/g, ' ').trim().toLocaleUpperCase('es-MX');
  const termWithAccents = rawTerm.toLocaleLowerCase('es-MX').replace(/\s+/g, ' ').trim();

  const nombreCompletoEquals = uniqueNonEmpty([nameTitle, nameUpper, rawTitle, rawUpper, titleCase(termWithAccents)]);

  // ── 1) Igualdad exacta (sobrevive a pacientes sin searchName / casing raro) ──
  const queries = [
    runEqualityQuery('searchName', term, 20),
    ...nombreCompletoEquals.map((value) => runEqualityQuery('nombreCompleto', value, 20)),
  ];

  // ── 2) Prefijos del término completo + progresivos ──
  queries.push(
    runPrefixQuery('searchName', term, 80),
    runPrefixQuery('nombreCompleto', nameTitle, 80),
    runPrefixQuery('nombreCompleto', nameUpper, 80),
  );

  if (isMultiToken) {
    // "maria garza" encuentra "maria garza luna" sin ahogarse en 150 "maria*"
    for (let i = 2; i < tokens.length; i += 1) {
      const partial = tokens.slice(0, i).join(' ');
      queries.push(runPrefixQuery('searchName', partial, 80));
      queries.push(runPrefixQuery('nombreCompleto', titleCase(partial), 80));
      queries.push(runPrefixQuery('nombreCompleto', partial.toLocaleUpperCase('es-MX'), 80));
    }
  }

  // Primer token como nombre de pila
  const firstToken = tokens[0];
  if (firstToken) {
    const firstTitle = titleCase(firstToken);
    const firstUpper = firstToken.toLocaleUpperCase('es-MX');
    queries.push(
      runPrefixQuery('nombre', firstTitle, 80),
      runPrefixQuery('nombre', firstUpper, 80),
      runPrefixQuery('searchName', firstToken, 80),
    );
  }

  // Apellidos: preferir tokens finales (paterno / materno)
  if (isMultiToken) {
    const surnameTokens = tokens.slice(1);
    for (const token of surnameTokens) {
      const tTitle = titleCase(token);
      const tUpper = token.toLocaleUpperCase('es-MX');
      queries.push(
        runPrefixQuery('apellidoPaterno', tTitle, 100),
        runPrefixQuery('apellidoMaterno', tTitle, 100),
        runPrefixQuery('apellidoPaterno', tUpper, 100),
        runPrefixQuery('apellidoMaterno', tUpper, 100),
      );
    }
  } else {
    queries.push(
      runPrefixQuery('apellidoPaterno', nameTitle, 100),
      runPrefixQuery('apellidoPaterno', nameUpper, 100),
    );
  }

  // Tildes originales (si el usuario las escribió)
  if (termWithAccents !== term) {
    const taTitle = titleCase(termWithAccents);
    queries.push(
      runEqualityQuery('nombreCompleto', taTitle, 15),
      runPrefixQuery('nombreCompleto', taTitle, 80),
    );
  }

  // Teléfono
  if (/^\d{3,}$/.test(term)) {
    queries.push(
      runEqualityQuery('telefonoMovil', term, 20),
      runPrefixQuery('telefonoMovil', term, 20),
    );
  }

  // idPaciente (MAR04091990, etc.)
  if (/^[a-z0-9]{4,}$/i.test(rawTerm.replace(/\s+/g, ''))) {
    const idUpper = rawTerm.replace(/\s+/g, '').toLocaleUpperCase('es-MX');
    queries.push(
      runEqualityQuery('idPaciente', idUpper, 10),
      runEqualityQuery('idPacienteMigrado', idUpper, 10),
    );
  }

  const ingest = (snap) => {
    for (const docRef of snap.docs) {
      if (results.has(docRef.id)) continue;
      const row = extractPatientData(docRef);
      if (isMergedPatient(row)) continue;
      results.set(docRef.id, row);
    }
  };

  const snapshots = await Promise.all(queries);
  for (const snap of snapshots) ingest(snap);

  // ── Fallback corto solo si no hubo candidatos ──
  if (results.size === 0 && term.length > 2) {
    const short = term.substring(0, 2);
    const shortTitle = titleCase(short);
    const fb = await Promise.all([
      runPrefixQuery('nombreCompleto', shortTitle, 200),
      runPrefixQuery('apellidoPaterno', shortTitle, 200),
      runPrefixQuery('searchName', short, 200),
      runPrefixQuery('nombre', shortTitle, 200),
    ]);
    for (const snap of fb) ingest(snap);
  }

  const allResults = Array.from(results.values());

  // ── Filtrado ──
  let filtered;

  if (isMultiToken) {
    filtered = allResults.filter((r) => matchesAllTokens(r, tokens));
  } else {
    const scored = allResults.map((r) => ({
      ...r,
      _score: fuzzyScore(searchTerm, getPatientDisplayName(r)),
    }));

    scored.sort((a, b) => b._score - a._score);

    const MIN_SCORE = 0.15;
    filtered = scored.length <= 5
      ? scored
      : scored.filter((r) => r._score > MIN_SCORE);
  }

  // Ranking: mejor match primero; empate alfabético
  filtered.sort((a, b) => {
    const scoreA = fuzzyScore(searchTerm, getPatientDisplayName(a));
    const scoreB = fuzzyScore(searchTerm, getPatientDisplayName(b));
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getPatientDisplayName(a).localeCompare(getPatientDisplayName(b), 'es', { sensitivity: 'base' });
  });

  return filtered.slice(0, maxResults);
};

// ─── Autocomplete ───────────────────────────────────────────────────────────

export const searchPatientsForAutocomplete = async (searchTerm, maxResults = 10) => {
  const results = await searchPatients(searchTerm, maxResults);
  return results.map((p) => ({
    id: p.id,
    nombre: getPatientDisplayName(p),
    telefono: p.telefono,
    idPaciente: p.idPaciente
  }));
};
