import { collection, getDocs, limit, orderBy, query, startAt, endAt } from 'firebase/firestore';
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

const runPrefixQuery = (field, prefix, max) =>
  getDocs(query(PACIENTES_REF, orderBy(field), startAt(prefix), endAt(prefix + '\uf8ff'), limit(max)))
    .catch((err) => {
      console.error(`[patientSearch] Query fallida en campo "${field}" con prefijo "${prefix}":`, err);
      return { docs: [] };
    });

const titleCase = (str = '') =>
  String(str || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\S)/g, (_, space, char) => `${space}${char.toLocaleUpperCase('es-MX')}`);

// ─── Búsqueda principal ────────────────────────────────────────────────────

/**
 * Busca pacientes por nombre, apellido o teléfono.
 *
 * Para búsquedas de una sola palabra: prefijo sobre searchName, nombreCompleto y
 * apellidoPaterno, con ranking difuso.
 *
 * Para búsquedas de múltiples palabras (ej. "araujo cireno"): cada token se busca
 * como prefijo contra searchName y los campos de apellido. Los resultados se
 * intersectan: solo quedan pacientes que contienen TODOS los tokens en su nombre.
 */
export const searchPatients = async (searchTerm, maxResults = DEFAULT_LIMIT) => {
  const rawTerm = searchTerm.trim();
  const term = normalizeForSearch(rawTerm);
  if (term.length < 2) return [];

  const results = new Map();
  const tokens = term.split(/\s+/).filter(t => t.length >= 2);
  const isMultiToken = tokens.length > 1;

  const nameTitle = titleCase(term);
  const termWithAccents = rawTerm.toLocaleLowerCase('es-MX').replace(/\s+/g, ' ');

  // ── Queries base: prefijo del término completo ──
  const queries = [
    runPrefixQuery('searchName', term, 150),
    runPrefixQuery('nombreCompleto', nameTitle, 150),
    runPrefixQuery('apellidoPaterno', nameTitle, 150),
  ];

  if (nameTitle !== term) {
    queries.push(runPrefixQuery('nombreCompleto', term, 150));
  }

  // Mayúsculas
  const nameUpper = term.toLocaleUpperCase('es-MX');
  if (nameUpper !== nameTitle) {
    queries.push(runPrefixQuery('nombreCompleto', nameUpper, 150));
    queries.push(runPrefixQuery('apellidoPaterno', nameUpper, 150));
  }

  // Tildes/ñ originales
  if (termWithAccents !== term) {
    const taTitle = titleCase(termWithAccents);
    queries.push(runPrefixQuery('nombreCompleto', taTitle, 150));
    queries.push(runPrefixQuery('apellidoPaterno', taTitle, 150));
  }

  // ── Multi-token: buscar cada token por separado ──
  if (isMultiToken) {
    for (const token of tokens) {
      const tTitle = titleCase(token);
      const tUpper = token.toLocaleUpperCase('es-MX');

      // Prefijo completo en searchName y ambos apellidos
      queries.push(
        runPrefixQuery('searchName', token, 150),
        runPrefixQuery('apellidoPaterno', tTitle, 150),
        runPrefixQuery('apellidoMaterno', tTitle, 150),
      );

      if (tUpper !== tTitle) {
        queries.push(
          runPrefixQuery('apellidoPaterno', tUpper, 150),
          runPrefixQuery('apellidoMaterno', tUpper, 150),
        );
      }

      // Prefijo corto de 2 caracteres: cubre "cireno" vs "CIRENO" y otros
      // desfases de casing donde el prefijo completo no encaja lexicográficamente
      if (token.length >= 3) {
        const short = token.substring(0, 2);
        const shortTitle = titleCase(short);
        queries.push(
          runPrefixQuery('apellidoPaterno', shortTitle, 200),
          runPrefixQuery('apellidoMaterno', shortTitle, 200),
        );
      }
    }
  }

  // Búsqueda por teléfono
  if (/^\d{3,}$/.test(term)) {
    queries.push(runPrefixQuery('telefonoMovil', term, 20));
  }

  // ── Ejecutar y deduplicar ──
  const snapshots = await Promise.all(queries);
  const seen = new Set();
  for (const snap of snapshots) {
    for (const docRef of snap.docs) {
      if (seen.has(docRef.id)) continue;
      seen.add(docRef.id);
      results.set(docRef.id, extractPatientData(docRef));
    }
  }

  // ── Fallback: si no hubo nada, relajar a 2 caracteres ──
  if (results.size === 0 && term.length > 2) {
    const short = term.substring(0, 2);
    const shortTitle = titleCase(short);
    const fb = await Promise.all([
      runPrefixQuery('nombreCompleto', shortTitle, 200),
      runPrefixQuery('apellidoPaterno', shortTitle, 200),
      runPrefixQuery('searchName', short, 200),
    ]);
    for (const snap of fb) {
      for (const docRef of snap.docs) {
        if (seen.has(docRef.id)) continue;
        seen.add(docRef.id);
        results.set(docRef.id, extractPatientData(docRef));
      }
    }
  }

  // ── Último recurso: 1 carácter ──
  if (results.size === 0 && term.length > 1) {
    const first = term.charAt(0).toLocaleUpperCase('es-MX');
    const fb = await Promise.all([
      runPrefixQuery('nombreCompleto', first, 200),
    ]);
    for (const snap of fb) {
      for (const docRef of snap.docs) {
        if (seen.has(docRef.id)) continue;
        seen.add(docRef.id);
        results.set(docRef.id, extractPatientData(docRef));
      }
    }
  }

  const allResults = Array.from(results.values());

  // ── Filtrado y ranking ──
  let filtered;

  if (isMultiToken) {
    // Cada token debe aparecer (exacto o fuzzy > 0.3) en al menos un campo del paciente
    filtered = allResults.filter((r) => {
      const fields = [
        normalizeForSearch(r.nombreCompleto || ''),
        normalizeForSearch(r.nombre || ''),
        normalizeForSearch(r.apellidoPaterno || ''),
        normalizeForSearch(r.apellidoMaterno || ''),
      ];

      return tokens.every(token =>
        fields.some(field => {
          if (!field) return false;
          if (field.includes(token)) return true;
          return fuzzyScore(token, field) > 0.3;
        })
      );
    });
  } else {
    // Monotoken: ordenar por fuzzy score y filtrar ruido
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

  // ── Orden final alfabético ──
  filtered.sort((a, b) => {
    const na = getPatientDisplayName(a);
    const nb = getPatientDisplayName(b);
    return na.localeCompare(nb, 'es', { sensitivity: 'base' });
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
