const normalizeSpaces = (value = '') => String(value ?? '').replace(/\s+/g, ' ').trim();

const fold = (value = '') =>
  normalizeSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const toTokens = (value = '') => normalizeSpaces(value).split(' ').filter(Boolean);

const endsWithTokens = (sourceTokens = [], suffixTokens = []) => {
  if (!sourceTokens.length || !suffixTokens.length || suffixTokens.length > sourceTokens.length) return false;

  const sourceFolded = sourceTokens.map((token) => fold(token));
  const suffixFolded = suffixTokens.map((token) => fold(token));
  const offset = sourceFolded.length - suffixFolded.length;

  for (let i = 0; i < suffixFolded.length; i += 1) {
    if (sourceFolded[offset + i] !== suffixFolded[i]) return false;
  }

  return true;
};

const stripTrailingSequence = (source = '', trailing = '') => {
  const sourceTokens = toTokens(source);
  const trailingTokens = toTokens(trailing);

  if (!sourceTokens.length || !trailingTokens.length || trailingTokens.length > sourceTokens.length) {
    return normalizeSpaces(source);
  }

  let nextTokens = [...sourceTokens];
  while (endsWithTokens(nextTokens, trailingTokens)) {
    nextTokens = nextTokens.slice(0, nextTokens.length - trailingTokens.length);
    if (!nextTokens.length) break;
  }

  return normalizeSpaces(nextTokens.join(' '));
};

const removeKnownSurnamesFromNombre = (nombre = '', apellidoPaterno = '', apellidoMaterno = '') => {
  const original = normalizeSpaces(nombre);
  if (!original) return '';

  let cleaned = original;
  const surnamePair = normalizeSpaces(`${apellidoPaterno} ${apellidoMaterno}`);

  if (surnamePair) cleaned = stripTrailingSequence(cleaned, surnamePair);
  if (apellidoPaterno) cleaned = stripTrailingSequence(cleaned, apellidoPaterno);
  if (apellidoMaterno) cleaned = stripTrailingSequence(cleaned, apellidoMaterno);

  return cleaned || original;
};

const buildFromParts = (nombre = '', apellidoPaterno = '', apellidoMaterno = '') =>
  normalizeSpaces([nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' '));

export const sanitizePatientNameFields = (patient = {}) => {
  const apellidoPaterno = normalizeSpaces(patient.apellidoPaterno);
  const apellidoMaterno = normalizeSpaces(patient.apellidoMaterno);
  const rawNombre = normalizeSpaces(patient.nombre);
  const rawNombreCompleto = normalizeSpaces(patient.nombreCompleto);

  let nombre = rawNombre;

  if (!nombre && rawNombreCompleto) {
    nombre = removeKnownSurnamesFromNombre(rawNombreCompleto, apellidoPaterno, apellidoMaterno);
  }

  nombre = removeKnownSurnamesFromNombre(nombre, apellidoPaterno, apellidoMaterno);

  let nombreCompleto = buildFromParts(nombre, apellidoPaterno, apellidoMaterno);
  if (!nombreCompleto) nombreCompleto = rawNombreCompleto;

  if (!nombre && !apellidoPaterno && !apellidoMaterno && rawNombreCompleto) {
    nombre = rawNombreCompleto;
    nombreCompleto = rawNombreCompleto;
  }

  return {
    nombre: normalizeSpaces(nombre),
    apellidoPaterno,
    apellidoMaterno,
    nombreCompleto: normalizeSpaces(nombreCompleto)
  };
};

export const getPatientDisplayName = (patient = {}) => {
  const cleaned = sanitizePatientNameFields(patient);
  if (cleaned.nombreCompleto) return cleaned.nombreCompleto;

  const fallback = normalizeSpaces(
    patient.nombreCompleto || `${patient.nombre || ''} ${patient.apellidoPaterno || ''} ${patient.apellidoMaterno || ''}`
  );

  return fallback;
};

export const getPatientNameForId = (patient = {}) => {
  const cleaned = sanitizePatientNameFields(patient);
  return cleaned.nombreCompleto || getPatientDisplayName(patient);
};
