import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

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

export const STUDY_CATEGORY_ORDER = ['ecografia', 'rayos_x', 'estudio_imagen', 'paquete', 'laboratorio'];

export const STUDY_CATEGORY_LABELS = {
  ecografia: 'Ecografia',
  rayos_x: 'Rayos X',
  estudio_imagen: 'Estudios de imagen',
  paquete: 'Paquetes',
  laboratorio: 'Laboratorios individuales'
};

export const STUDY_CATEGORY_OPTIONS = STUDY_CATEGORY_ORDER.map((id) => ({
  id,
  label: STUDY_CATEGORY_LABELS[id]
}));

const STUDY_CATEGORY_ALIASES = {
  ecografia: ['ecografia', 'ultrasonido', 'ultrasonografia'],
  rayos_x: ['rayos_x', 'rayosx', 'rx', 'radiografia', 'radiografias'],
  estudio_imagen: ['estudio_imagen', 'estudios_de_imagen', 'imagen', 'imagenes', 'imagenologia'],
  paquete: ['paquete', 'paquetes'],
  laboratorio: ['laboratorio', 'laboratorios', 'estudio', 'estudios', 'individual', 'individuales', 'lab']
};

export const normalizeStudyCategory = (value = '') => {
  const token = normalizeCategoryToken(value || 'laboratorio');
  if (!token) return 'laboratorio';

  for (const [category, aliases] of Object.entries(STUDY_CATEGORY_ALIASES)) {
    if (aliases.includes(token)) return category;
  }

  return 'laboratorio';
};

export const getStudyCategoryLabel = (category = 'laboratorio') => {
  const normalized = normalizeStudyCategory(category);
  return STUDY_CATEGORY_LABELS[normalized] || STUDY_CATEGORY_LABELS.laboratorio;
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeComponent = (raw = {}, index = 0) => {
  const clave = clean(raw.clave || raw.Clave || raw.codigo || raw.code);
  const descripcion = clean(raw.descripcion || raw.Descripcion || raw.Descripción || raw.nombre || raw.name);
  if (!descripcion) return null;

  return {
    id: clean(raw.id || `${clave || 'componente'}-${descripcion}-${index}`),
    clave,
    descripcion
  };
};

const normalizeComponents = (raw = {}) => {
  const source = Array.isArray(raw.componentes)
    ? raw.componentes
    : Array.isArray(raw.estudios)
      ? raw.estudios
      : Array.isArray(raw.items)
        ? raw.items
        : [];

  return source
    .map((item, index) => normalizeComponent(item, index))
    .filter(Boolean);
};

export const normalizeStudyRecord = (raw = {}, idFallback = '') => {
  const clave = clean(raw.clave || raw.Clave || raw.codigo || raw.code);
  const descripcion = clean(
    raw.descripcion || raw.Descripción || raw.descripcionEstudio || raw.nombre || raw.name
  );
  const categoria = normalizeStudyCategory(raw.categoria || raw.tipo || raw.modo || 'laboratorio');

  return {
    id: clean(raw.id || idFallback || `${clave || 'estudio'}-${descripcion}`),
    clave,
    descripcion,
    precio: toNumber(raw.precio ?? raw.precioPublico ?? raw['Precio U.']),
    categoria,
    componentes: normalizeComponents(raw),
    activo: raw.activo !== false,
    source: raw.source || 'catalogo'
  };
};

export const parseStudiesCatalogText = (text = '') => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  const attempts = [
    trimmed,
    `[${trimmed}]`,
    `[${trimmed.replace(/,\s*$/, '')}]`
  ];

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch {
      // Keep trying with other wrappers.
    }
  }

  return [];
};

export const loadStudiesFromPublicData = async () => {
  try {
    const res = await fetch('/data/estudios.json');
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = parseStudiesCatalogText(text);
    return parsed
      .map((row, index) => normalizeStudyRecord({ ...row, source: 'public-json' }, `legacy-${index}`))
      .filter((row) => row.descripcion)
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
  } catch (error) {
    console.error('Error cargando estudios desde /data/estudios.json', error);
    return [];
  }
};

export const getStudiesCatalog = async ({ includeInactive = false } = {}) => {
  try {
    const snap = await getDocs(collection(db, 'catalogo_estudios'));
    const firestoreRows = snap.docs
      .map((d) => normalizeStudyRecord({ id: d.id, ...d.data() }, d.id))
      .filter((row) => row.descripcion);

    if (firestoreRows.length > 0) {
      const sorted = firestoreRows.sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
      return includeInactive ? sorted : sorted.filter((row) => row.activo !== false);
    }
  } catch (error) {
    console.error('Error cargando catalogo_estudios de Firestore', error);
  }

  const fallback = await loadStudiesFromPublicData();
  return includeInactive ? fallback : fallback.filter((row) => row.activo !== false);
};

export const resolveStudyPackages = (studies = []) => {
  return studies
    .filter((item) => normalizeStudyCategory(item.categoria) === 'paquete' && item.activo !== false)
    .map((item) => item.descripcion);
};

export const getPackageDefinitions = (studies = []) => {
  return studies
    .filter((item) => normalizeStudyCategory(item.categoria) === 'paquete' && item.activo !== false)
    .map((item) => ({
      id: item.id,
      nombre: item.descripcion,
      clave: item.clave || '',
      precio: item.precio || 0,
      componentes: Array.isArray(item.componentes) ? item.componentes : []
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
};
