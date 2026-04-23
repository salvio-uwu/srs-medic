const compareText = (left = '', right = '') => String(left || '').localeCompare(String(right || ''), 'es', {
  sensitivity: 'base'
});

export const SYMPTOM_CATEGORY_DEFAULTS = [
  { id: 'generales', label: 'Generales', color: 'bg-slate-500' },
  { id: 'respiratorios', label: 'Respiratorios', color: 'bg-sky-500' },
  { id: 'abdominales', label: 'Abdominales', color: 'bg-amber-500' },
  { id: 'urinarios', label: 'Urinarios', color: 'bg-violet-500' },
  { id: 'neurologicos', label: 'Neurológicos', color: 'bg-rose-500' }
];

export const SYMPTOM_CATEGORY_COLOR_OPTIONS = [
  { value: 'bg-slate-500', label: 'Pizarra' },
  { value: 'bg-sky-500', label: 'Cielo' },
  { value: 'bg-amber-500', label: 'Ámbar' },
  { value: 'bg-violet-500', label: 'Violeta' },
  { value: 'bg-rose-500', label: 'Rosa' },
  { value: 'bg-emerald-500', label: 'Esmeralda' },
  { value: 'bg-indigo-500', label: 'Índigo' },
  { value: 'bg-cyan-500', label: 'Cian' }
];

export const SYMPTOM_CATEGORY_COLOR_FALLBACK = 'bg-slate-500';

export const buildSymptomCategoryId = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[^\w\s-]/g, '')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export const getSymptomCategoryLabelFromId = (id = '') => String(id)
  .replace(/[-_]/g, ' ')
  .replace(/\b\w/g, (match) => match.toUpperCase());

export const getDefaultSymptomCategoryId = (categories = []) => {
  const activeCategories = categories.filter((category) => category?.activo !== false);
  return activeCategories[0]?.id || categories[0]?.id || SYMPTOM_CATEGORY_DEFAULTS[0].id;
};

export const sortSymptomCategories = (categories = []) => [...categories].sort((left, right) => {
  const leftOrder = Number(left?.orden ?? 9999);
  const rightOrder = Number(right?.orden ?? 9999);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return compareText(left?.label || left?.nombre, right?.label || right?.nombre);
});

export const sortSymptoms = (symptoms = []) => [...symptoms].sort((left, right) => {
  const leftOrder = Number(left?.orden ?? 9999);
  const rightOrder = Number(right?.orden ?? 9999);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return compareText(left?.nombre, right?.nombre);
});

export const buildSymptomCategorySections = ({
  categories = [],
  symptoms = [],
  defaultCategoryId = getDefaultSymptomCategoryId(categories),
  includeEmptyCategories = true,
  includeInactiveCategories = true
} = {}) => {
  const categoryMap = new Map(
    (categories || []).map((category) => [category.id, {
      ...category,
      label: String(category?.label || category?.nombre || '').trim() || getSymptomCategoryLabelFromId(category?.id)
    }])
  );

  (symptoms || []).forEach((symptom) => {
    const categoryId = String(symptom?.categoria || defaultCategoryId || '').trim();
    if (!categoryId || categoryMap.has(categoryId)) return;

    categoryMap.set(categoryId, {
      id: categoryId,
      label: getSymptomCategoryLabelFromId(categoryId),
      color: SYMPTOM_CATEGORY_COLOR_FALLBACK,
      activo: true,
      legacy: true,
      orden: 9999
    });
  });

  return sortSymptomCategories(Array.from(categoryMap.values()))
    .filter((category) => includeInactiveCategories || category.activo !== false)
    .map((category) => ({
      ...category,
      items: sortSymptoms(
        (symptoms || []).filter((symptom) => String(symptom?.categoria || defaultCategoryId || '').trim() === category.id)
      )
    }))
    .filter((category) => includeEmptyCategories || category.items.length > 0);
};