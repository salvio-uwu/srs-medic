const clean = (value) => String(value ?? '').trim();

const normalizeCategoryToken = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[\s-]+/g, '_')
  .replace(/[^a-z0-9_]/g, '')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '');

export const PROCEDURE_CATEGORY_ORDER = [
  'curacion',
  'inyectable',
  'sutura',
  'terapeutico',
  'diagnostico',
  'otro'
];

export const PROCEDURE_CATEGORY_LABELS = {
  curacion: 'Curaciones',
  inyectable: 'Inyectables',
  sutura: 'Suturas',
  terapeutico: 'Terapeuticos',
  diagnostico: 'Diagnosticos',
  otro: 'Otros'
};

export const PROCEDURE_CATEGORY_OPTIONS = PROCEDURE_CATEGORY_ORDER.map((id) => ({
  id,
  label: PROCEDURE_CATEGORY_LABELS[id]
}));

const PROCEDURE_CATEGORY_ALIASES = {
  curacion: ['curacion', 'curaciones', 'vendaje', 'vendajes'],
  inyectable: ['inyectable', 'inyectables', 'inyeccion', 'inyecciones', 'aplicacion', 'aplicaciones'],
  sutura: ['sutura', 'suturas', 'puntos'],
  terapeutico: ['terapeutico', 'terapeuticos', 'terapia', 'manejo'],
  diagnostico: ['diagnostico', 'diagnosticos', 'valoracion', 'evaluacion'],
  otro: ['otro', 'otros', 'general']
};

export const normalizeProcedureCategory = (value = '') => {
  const token = normalizeCategoryToken(value || 'otro');
  if (!token) return 'otro';

  for (const [category, aliases] of Object.entries(PROCEDURE_CATEGORY_ALIASES)) {
    if (aliases.includes(token)) return category;
  }

  return 'otro';
};

export const getProcedureCategoryLabel = (category = 'otro') => {
  const normalized = normalizeProcedureCategory(category);
  return PROCEDURE_CATEGORY_LABELS[normalized] || PROCEDURE_CATEGORY_LABELS.otro;
};

const toPositiveInt = (value, fallback = 20) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, parsed);
};

export const normalizeProcedureRecord = (raw = {}, idFallback = '') => {
  const nombre = clean(raw.nombre || raw.descripcion || raw.procedimiento || raw.name);
  const categoria = normalizeProcedureCategory(raw.categoria || raw.tipo || raw.grupo || 'otro');

  return {
    id: clean(raw.id || idFallback || `${categoria}-${nombre}`),
    clave: clean(raw.clave || raw.codigo || raw.code),
    nombre,
    categoria,
    descripcion: clean(raw.descripcion || raw.detalle),
    preparacion: clean(raw.preparacion || raw.preparacionPaciente),
    contraindicaciones: clean(raw.contraindicaciones || raw.riesgos),
    duracionMin: toPositiveInt(raw.duracionMin ?? raw.duracion ?? 20, 20),
    requiereConsentimiento: raw.requiereConsentimiento === true || raw.consentimiento === true,
    activo: raw.activo !== false,
    source: raw.source || 'catalogo'
  };
};
