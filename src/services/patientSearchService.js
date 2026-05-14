import { collection, getDocs, limit, orderBy, query, startAt, endAt } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getPatientDisplayName, sanitizePatientNameFields } from '../utils/patientName';
import { normalizeForSearch, rankResults } from '../utils/searchUtils';

const PACIENTES_REF = collection(db, 'pacientes');
const DEFAULT_LIMIT = 10;

const addSnapshotsToMap = (snapshots, resultsMap) => {
  for (const snap of snapshots) {
    for (const docRef of snap.docs) {
      if (resultsMap.has(docRef.id)) continue;
      const data = docRef.data() || {};
      const normalizedNames = sanitizePatientNameFields({
        nombre: data.nombre || '',
        apellidoPaterno: data.apellidoPaterno || '',
        apellidoMaterno: data.apellidoMaterno || '',
        nombreCompleto: data.nombreCompleto || ''
      });
      resultsMap.set(docRef.id, {
        id: docRef.id,
        nombre: normalizedNames.nombre,
        nombreCompleto: normalizedNames.nombreCompleto,
        apellidoPaterno: normalizedNames.apellidoPaterno,
        apellidoMaterno: normalizedNames.apellidoMaterno,
        telefono: data.telefonoMovil || data.telefono || '',
        telefonoMovil: data.telefonoMovil || '',
        idPaciente: data.idPaciente || data.idPacienteMigrado || '',
        sexo: data.sexo || '',
        fechaNacimiento: data.fechaNacimiento || '',
        municipioEstado: data.municipioEstado || '',
        grupoSanguineo: data.grupoSanguineo || '',
        email: data.email || '',
        fechaRegistro: data.fechaRegistro || '',
        fechaActualizacion: data.fechaActualizacion || '',
        idPacienteMigrado: data.idPacienteMigrado || '',
        padecimientoHipertension: data.padecimientoHipertension || false,
        padecimientoDiabetes: data.padecimientoDiabetes || false,
        padecimientoObesidad: data.padecimientoObesidad || false,
        padecimientoArtritis: data.padecimientoArtritis || false,
      });
    }
  }
};

const runPrefixQuery = (field, prefix, max) =>
  getDocs(query(PACIENTES_REF, orderBy(field), startAt(prefix), endAt(prefix + '\uf8ff'), limit(max)))
    .catch(() => ({ docs: [] }));

const titleCase = (str = '') =>
  String(str || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\S)/g, (_, space, char) => `${space}${char.toLocaleUpperCase('es-MX')}`);

export const searchPatients = async (searchTerm, maxResults = DEFAULT_LIMIT) => {
  const term = normalizeForSearch(searchTerm);
  if (term.length < 2) return [];

  // Término original conservando ñ/tildes (solo lowercase + trim), para cubrir
  // pacientes guardados con caracteres especiales (ej. "PEÑALOZA", "Ñuñez")
  const termOriginal = searchTerm.trim().toLocaleLowerCase('es-MX').replace(/\s+/g, ' ');
  const hasAccents = termOriginal !== term;

  const results = new Map();

  const fetch = async (queries) => {
    const snapshots = await Promise.all(queries);
    addSnapshotsToMap(snapshots, results);
  };

  const nameTitle = titleCase(term);
  const nameUpper = term.toLocaleUpperCase('es-MX');

  // Estrategia 1: prefijo exacto (TitleCase + mayúsculas para pacientes migrados/capturados en caps)
  const exactQueries = [
    runPrefixQuery('searchName', term, 80),
    runPrefixQuery('nombreCompleto', nameTitle, 50),
    runPrefixQuery('apellidoPaterno', nameTitle, 50),
  ];

  if (nameTitle !== term) {
    exactQueries.push(runPrefixQuery('nombreCompleto', term, 50));
  }

  // Búsqueda en mayúsculas: cubre nombres guardados en CAPS (ej. "GARCIA LOPEZ")
  if (nameUpper !== nameTitle) {
    exactQueries.push(runPrefixQuery('nombreCompleto', nameUpper, 50));
    exactQueries.push(runPrefixQuery('apellidoPaterno', nameUpper, 50));
  }

  // Búsqueda con tildes/ñ originales: cubre pacientes guardados con "PEÑALOZA", "Ñuñez", etc.
  // normalizeForSearch elimina tildes, lo que rompe el prefijo en Firestore para esos registros
  if (hasAccents) {
    const nameTitleOriginal = titleCase(termOriginal);
    const nameUpperOriginal = termOriginal.toLocaleUpperCase('es-MX');
    exactQueries.push(runPrefixQuery('nombreCompleto', nameTitleOriginal, 50));
    exactQueries.push(runPrefixQuery('apellidoPaterno', nameTitleOriginal, 50));
    if (nameUpperOriginal !== nameTitleOriginal) {
      exactQueries.push(runPrefixQuery('nombreCompleto', nameUpperOriginal, 50));
      exactQueries.push(runPrefixQuery('apellidoPaterno', nameUpperOriginal, 50));
    }
  }

  if (/^\d{3,}$/.test(term)) {
    exactQueries.push(runPrefixQuery('telefonoMovil', term, 20));
  }

  await fetch(exactQueries);

  // Estrategia 2: solo si NO hubo resultados, relajar a 2 caracteres
  if (results.size === 0 && term.length > 2) {
    const short = term.substring(0, 2);
    const shortTitle = titleCase(short);

    await fetch([
      runPrefixQuery('nombreCompleto', shortTitle, 100),
      runPrefixQuery('apellidoPaterno', shortTitle, 100),
    ]);

    if (shortTitle !== short) {
      await fetch([runPrefixQuery('nombreCompleto', short, 100)]);
    }
  }

  // Estrategia 3: último recurso, 1 carácter
  if (results.size === 0 && term.length > 1) {
    const first = term.charAt(0).toLocaleUpperCase('es-MX');
    await fetch([runPrefixQuery('nombreCompleto', first, 100)]);
  }

  const ranked = rankResults(searchTerm, Array.from(results.values()), getPatientDisplayName);

  // Filtrar ruido: solo resultados con score > 0.15, o todo si hay pocos
  const MIN_SCORE = 0.15;
  const filtered = ranked.length <= 5
    ? ranked
    : ranked.filter((r) => r._score > MIN_SCORE);

  return filtered.slice(0, maxResults);
};

export const searchPatientsForAutocomplete = async (searchTerm, maxResults = 10) => {
  const results = await searchPatients(searchTerm, maxResults);
  return results.map((p) => ({
    id: p.id,
    nombre: getPatientDisplayName(p),
    telefono: p.telefono,
    idPaciente: p.idPaciente
  }));
};
