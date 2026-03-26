const normalizeName = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, '')
    .trim();

const formatDateToken = (value) => {
  if (!value) return 'SINFECHA';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'SINFECHA';
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}${m}${y}`;
};

export const buildPatientHumanId = (nombreCompleto = '', fechaReferencia = null) => {
  const primerNombre = String(nombreCompleto).trim().split(/\s+/)[0] || '';
  const nameToken = normalizeName(primerNombre) || 'PACIENTE';
  const dateToken = formatDateToken(fechaReferencia);
  return `${nameToken}${dateToken}`;
};
