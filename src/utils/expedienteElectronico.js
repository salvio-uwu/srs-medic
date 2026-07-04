// Utilidades para reconstruir y normalizar el Expediente Clínico Electrónico
// a partir de la colección `historial_clinico` (una entrada por consulta) y
// del documento demográfico en `pacientes`.

const MIEMBROS_FAMILIA = ['mama', 'papa', 'hermanos', 'tios', 'primos', 'abuelos'];

const ETIQUETAS_FAMILIA = {
  mama: 'Mamá',
  papa: 'Papá',
  hermanos: 'Hermanos',
  tios: 'Tíos',
  primos: 'Primos',
  abuelos: 'Abuelos'
};

const ETIQUETAS_HEREDO = {
  diabetes: 'Diabetes',
  hipertension: 'Hipertensión',
  cardiopatia: 'Cardiopatía',
  hepatopatia: 'Hepatopatía',
  nefropatia: 'Nefropatía',
  mentales: 'Enf. mentales',
  alergicas: 'Alérgicas',
  endocrinas: 'Endocrinas',
  asma: 'Asma',
  cancer: 'Cáncer',
  obesidad: 'Obesidad'
};

export const limpiar = (v, fallback = '') => {
  if (v === null || v === undefined) return fallback;
  // Convierte Timestamps de Firestore a string ISO segura
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    try { return v.toDate().toISOString(); } catch (_) { /* fallback */ }
  }
  if (typeof v === 'object' && typeof v.toMillis === 'function') {
    try { return new Date(v.toMillis()).toISOString(); } catch (_) { /* fallback */ }
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString();
  }
  // Protégenos de números gigantes que pdfkit no puede manejar (> 1e21)
  if (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v) || Math.abs(v) > 1e21)) {
    return '0';
  }
  const s = String(v).trim();
  return s || fallback;
};

export const toSafeDate = (input) => {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  // Timestamp de Firestore
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    try { return input.toDate(); } catch (_) { /* fallback */ }
  }
  if (typeof input === 'object' && typeof input.toMillis === 'function') {
    try { return new Date(input.toMillis()); } catch (_) { /* fallback */ }
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const safeDateStr = (input, options = {}) => {
  const d = toSafeDate(input);
  if (!d) return options.fallback || '';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', ...options });
};

export const calcularEdad = (fechaNacimiento) => {
  const fecha = toSafeDate(fechaNacimiento);
  if (!fecha) return '';
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mesDiff = hoy.getMonth() - fecha.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
  return edad >= 0 ? String(edad) : '';
};

/**
 * Recorre profundamente un valor y convierte todo lo que no sea string, número
 * seguro, booleano, null/undefined, array u objeto plano a una representación
 * segura para evitar que @react-pdf/renderer reciba Timestamps, Dates, NaN, etc.
 *
 * Usa WeakSet para detectar referencias circulares, Object.getOwnPropertyNames
 * para atrapar propiedades no enumerables, y límite de profundidad para evitar
 * stack overflow con estructuras muy anidadas.
 */
const DEEP_SANITIZE_MAX_DEPTH = 50;

const toSafeScalar = (value) => {
  if (value === null || value === undefined) return { kind: 'keep', value };
  if (typeof value === 'string') return { kind: 'keep', value };
  if (typeof value === 'boolean') return { kind: 'keep', value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { kind: 'replace', value: 0 };
    // Números fuera del rango seguro de JS (más allá de ±9e15) rompen el PDF
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) return { kind: 'replace', value: 0 };
    return { kind: 'keep', value };
  }
  // Timestamp / Date → ISO string
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { kind: 'replace', value: value.toISOString() };
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try { return { kind: 'replace', value: value.toDate().toISOString() }; } catch (_) { /* fallthrough */ }
  }
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    try { return { kind: 'replace', value: new Date(value.toMillis()).toISOString() }; } catch (_) { /* fallthrough */ }
  }
  return null; // necesita recorrido recursivo
};

export const deepSanitize = (value, visited = new WeakSet(), depth = 0) => {
  if (depth > DEEP_SANITIZE_MAX_DEPTH) return '[profundo]';

  const scalar = toSafeScalar(value);
  if (scalar) {
    return scalar.kind === 'keep' ? scalar.value : scalar.value;
  }

  if (typeof value !== 'object') return '';

  // Detección de referencia circular
  if (visited.has(value)) return '[circular]';

  try {
    visited.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => {
        try { return deepSanitize(item, visited, depth + 1); } catch (_) { return ''; }
      });
    }

    // getOwnPropertyNames en vez de Object.keys: atrapa también propiedades
    // no enumerables que podrían estar ocultando Timestamps o números inseguros
    const sanitized = {};
    const keys = Object.getOwnPropertyNames(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        sanitized[key] = deepSanitize(value[key], visited, depth + 1);
      } catch (_) {
        sanitized[key] = '';
      }
    }
    return sanitized;
  } catch (_) {
    return {};
  }
};

/**
 * Sanitización de máxima seguridad: primero deepSanitize, luego JSON round-trip
 * con replacer que maneja cualquier Timestamp/Date/NaN residual. Esto garantiza
 * que absolutamente nada peligroso llegue al motor PDF.
 */
export const bulletproofSanitize = (value) => {
  try {
    const pass1 = deepSanitize(value);
    const json = JSON.stringify(pass1, (_, val) => {
      if (val === null || val === undefined) return val;
      if (val instanceof Date && !Number.isNaN(val.getTime())) return val.toISOString();
      if (typeof val === 'object' && typeof val.toDate === 'function') {
        try { return val.toDate().toISOString(); } catch (_) { return null; }
      }
      if (typeof val === 'object' && typeof val.toMillis === 'function') {
        try { return new Date(val.toMillis()).toISOString(); } catch (_) { return null; }
      }
      if (typeof val === 'number') {
        if (!Number.isFinite(val) || Math.abs(val) > Number.MAX_SAFE_INTEGER) return 0;
      }
      return val;
    });
    return JSON.parse(json);
  } catch (_) {
    console.warn('bulletproofSanitize: fallback a sanitización plana', _);
    // Último recurso: devolver un objeto plano vacío para no romper el PDF
    if (Array.isArray(value)) return [];
    if (typeof value === 'object' && value !== null) return {};
    return '';
  }
};

export const formatFecha = (input) => {
  if (!input) return '';
  if (typeof input?.toDate === 'function') {
    return input.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  return String(input);
};

// Determina si una sección clínica tiene datos significativos (no vacía).
const tieneDatos = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some((item) => tieneDatos(item));
  if (typeof value === 'object') return Object.values(value).some((item) => tieneDatos(item));
  return false;
};

// De una lista de consultas (ordenadas de más reciente a más antigua),
// toma la sección clínica más reciente que contenga datos reales.
export const pickSeccionReciente = (rows = [], key = '') => {
  if (!Array.isArray(rows) || !key) return null;
  for (const row of rows) {
    const candidate = row?.[key];
    if (tieneDatos(candidate)) return candidate;
  }
  return null;
};

// Convierte un documento crudo de historial_clinico en una estructura plana
// y predecible para renderizar tanto en pantalla como en PDF.
export const normalizeConsulta = (item = {}) => {
  const fechaObj = item?.fecha?.toDate ? item.fecha.toDate() : (item?.fechaOrden ? new Date(item.fechaOrden) : null);
  const consulta = item.consulta || {};
  const exploracion = consulta.exploracion || {};
  const diagnostico = consulta.diagnostico || {};
  const estudios = consulta.estudios || {};
  const procedimientos = consulta.procedimientos || {};

  // Normalizar recetas y documentos generados durante la consulta
  const normalizarEventoArchivo = (evt) => ({
    tipo: evt?.tipo || '',
    nombre: evt?.nombre || '',
    formato: evt?.formato || '',
    origen: evt?.origen || '',
    plantillaId: evt?.plantillaId || '',
    plantillaNombre: evt?.plantillaNombre || '',
    totalMedicamentos: Number.isFinite(evt?.totalMedicamentos) ? evt.totalMedicamentos : 0,
    generadoAt: evt?.generadoAt || '',
    archivoUrl: evt?.archivoUrl || '',
    archivoPath: evt?.archivoPath || ''
  });

  return {
    id: item.id || '',
    fechaOrden: fechaObj ? fechaObj.getTime() : 0,
    fechaFormato: fechaObj
      ? fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'Sin fecha',
    horaFormato: fechaObj ? fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
    tipoNota: item.tipoNota || 'Consulta general',
    medicoNombre: item.medicoNombre || '',
    padecimiento: limpiar(consulta.padecimiento),
    signos: exploracion.signos || {},
    antropometria: exploracion.antropometria || {},
    colesterol: exploracion.colesterol || {},
    glucosa: exploracion.glucosa || {},
    fisica: exploracion.fisica || {},
    diagnostico: limpiar(diagnostico.enfermedad_actual),
    cie10: Array.isArray(diagnostico.cie10) ? diagnostico.cie10 : [],
    tratamiento: Array.isArray(diagnostico.tratamiento_lista) ? diagnostico.tratamiento_lista : [],
    indicaciones: limpiar(diagnostico.indicaciones),
    pronostico: limpiar(diagnostico.pronostico),
    estudios: {
      paquetes: Array.isArray(estudios.paquetes_seleccionados) ? estudios.paquetes_seleccionados : [],
      seleccionados: Array.isArray(estudios.estudios_seleccionados) ? estudios.estudios_seleccionados : [],
      notas: limpiar(estudios.notas_generales)
    },
    procedimientos: {
      seleccionados: Array.isArray(procedimientos.seleccionados) ? procedimientos.seleccionados : [],
      notas: limpiar(procedimientos.notas_generales)
    },
    referencias: Array.isArray(consulta.referencias_medicas?.seleccionadas) ? consulta.referencias_medicas.seleccionadas : [],
    recetasGeneradas: Array.isArray(item.recetasGeneradas) ? item.recetasGeneradas.map(normalizarEventoArchivo) : [],
    documentosGenerados: Array.isArray(item.documentosGenerados) ? item.documentosGenerados.map(normalizarEventoArchivo) : [],
    pxInfo: item.px_info || {},
    // Datos de la receta como folio, médico y sucursal
    folioReceta: item.px_info?.folio_receta || '',
    medicoPerfil: item.medicoPerfil || {},
    consultorioNombre: item.consultorioNombre || '',
    consultorioDireccion: item.consultorioUbicacion || item.consultorioDireccion || item.consultorioDomicilio || '',
    sucursalDireccion: item.sucursalDireccion || item.sucursalUbicacion || item.sucursalDomicilio || ''
  };
};

/** Documento con PDF archivado al expedir (canvas/plantilla dinámica). */
export const docUsaArchivoOriginal = (entry = {}) =>
  Boolean(String(entry?.archivoUrl || '').trim());

export const tieneConsultaContenido = (c) => Boolean(
  c.padecimiento ||
  c.diagnostico ||
  c.indicaciones ||
  c.pronostico ||
  c.tratamiento.length ||
  c.cie10.length ||
  Object.values(c.signos).some(Boolean) ||
  Object.values(c.antropometria).some(Boolean) ||
  Object.values(c.fisica).some(Boolean) ||
  c.estudios.seleccionados.length ||
  c.procedimientos.seleccionados.length ||
  (c.recetasGeneradas || []).some(docUsaArchivoOriginal) ||
  (c.documentosGenerados || []).some(docUsaArchivoOriginal)
);

// Convierte el objeto de antecedentes heredofamiliares en una lista legible.
export const formatHeredofamiliares = (hereditarios = {}) => {
  const resultado = [];
  Object.entries(ETIQUETAS_HEREDO).forEach(([key, label]) => {
    const grupo = hereditarios[key];
    if (grupo && typeof grupo === 'object') {
      const familiares = Object.keys(ETIQUETAS_FAMILIA)
        .filter((m) => grupo[m])
        .map((m) => ETIQUETAS_FAMILIA[m]);
      if (familiares.length) resultado.push({ label, valor: familiares.join(', ') });
    }
  });
  if (hereditarios.otros && String(hereditarios.otros).trim()) {
    resultado.push({ label: 'Otros', valor: String(hereditarios.otros).trim() });
  }
  return resultado;
};

// Etiquetas legibles para los antecedentes patológicos específicos.
const ETIQUETAS_ESPECIFICOS = {
  glaucoma: 'Glaucoma',
  calculo: 'Cálculo biliar',
  reflujo: 'Reflujo',
  incontinencia: 'Incontinencia',
  dislipidemias: 'Dislipidemias'
};

// Convierte el objeto `especificos` (que mezcla valores y banderas `{clave}_negado`)
// en un texto legible. Los positivos se listan con su valor y los negados se
// agrupan en una sola frase para evitar volcar las claves crudas.
export const formatEspecificos = (especificos = {}) => {
  const positivos = [];
  const negados = [];
  Object.entries(ETIQUETAS_ESPECIFICOS).forEach(([key, label]) => {
    const valorRaw = String(especificos[key] ?? '').trim();
    const esNegado = Boolean(especificos[`${key}_negado`]) || valorRaw.toUpperCase().startsWith('NEGAD');
    if (esNegado) {
      negados.push(label);
    } else if (valorRaw) {
      positivos.push(`${label}: ${valorRaw}`);
    }
  });
  const partes = [...positivos];
  if (negados.length) partes.push(`Negados: ${negados.join(', ')}`);
  return partes.join(' · ');
};

export const formatAdicciones = (adicciones = {}) => {
  const partes = [];
  if (adicciones.tabaquismo) partes.push('Tabaquismo');
  if (adicciones.alcohol) partes.push('Alcoholismo');
  if (adicciones.drogas) partes.push('Drogas');
  let texto = partes.join(', ');
  if (adicciones.detalle && String(adicciones.detalle).trim()) {
    texto = texto ? `${texto} (${String(adicciones.detalle).trim()})` : String(adicciones.detalle).trim();
  }
  return texto;
};

export const formatAlergias = (alergias = {}) => {
  if (alergias.preguntados_y_negados) return 'Preguntadas y negadas';
  const lista = Array.isArray(alergias.lista)
    ? alergias.lista.map((a) => (typeof a === 'string' ? a : (a?.sustancia || a?.nombre || ''))).filter(Boolean)
    : [];
  const otros = String(alergias.otros || alergias.otras || '').trim();
  const todo = [...lista, otros].filter(Boolean);
  return todo.length ? todo.join(', ') : 'Niega antecedentes alérgicos';
};

export const nombrePaciente = (paciente = {}) => {
  const completo = String(paciente.nombreCompleto || '').trim();
  if (completo) return completo;
  return [paciente.nombre, paciente.apellidoPaterno, paciente.apellidoMaterno]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Paciente';
};

export const direccionPaciente = (paciente = {}) => {
  // Campos nuevos (NOM-004) con fallback a legacy
  const calle = paciente.calle || (paciente.calleNumero || '').replace(/\s+\d+.*$/, '').trim();
  const num = paciente.numeroExterior || '';
  const numInt = paciente.numeroInterior ? `Int. ${paciente.numeroInterior}` : '';
  const lineaCalle = [calle, num, numInt].filter(Boolean).join(' ');
  const colonia = paciente.colonia || '';
  const cp = paciente.cp || '';
  const municipio = paciente.municipio || (paciente.municipioEstado || '').replace(/,.*$/, '').trim();
  const estado = paciente.estado || ((paciente.municipioEstado || '').match(/,\s*(.+)/) || ['', ''])[1];
  const pais = paciente.pais || '';

  return [lineaCalle, colonia, cp, municipio, estado, pais]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
};

export { MIEMBROS_FAMILIA };

/**
 * Resuelve una plantilla HTML reemplazando {{ variables }} con el contexto dado
 * y devuelve texto plano legible (eliminando tags HTML).
 */
export const resolveTemplateToPlainText = (html = '', contexto = {}) => {
  if (!html || !String(html).trim()) return '';

  const normalizeKey = (raw = '') =>
    String(raw || '').replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();

  const getDeep = (obj, path) =>
    path.split('.').reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) return acc[key];
      return '';
    }, obj);

  let resolved = String(html).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
    const fieldPath = normalizeKey(key).toLowerCase();
    const aliasPath =
      fieldPath === 'consultorio.ubicacion' || fieldPath === 'consultorio.ubicacionconsultorio'
        ? 'consultorio.direccion'
        : fieldPath === 'sucursal.ubicacion'
          ? 'sucursal.direccion'
          : fieldPath;
    const valor = getDeep(contexto, aliasPath);
    if (valor === null || valor === undefined) return '';
    return String(valor);
  });

  resolved = resolved
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n').replace(/<\/div>/gi, '')
    .replace(/<li[^>]*>/gi, '\n').replace(/<\/li>/gi, '')
    .replace(/<\/?[ou]l[^>]*>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  resolved = resolved
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    // Colapsar 3+ line breaks en exactamente 2 (un párrafo de espacio)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return resolved;
};

/**
 * Resuelve una plantilla HTML reemplazando {{ variables }} con el contexto dado
 * PERO conservando las etiquetas HTML (negritas, tablas, listas, alineación).
 * Se usa para reconstruir el documento con formato dentro del PDF del expediente.
 */
export const resolveTemplateToHtml = (html = '', contexto = {}) => {
  if (!html || !String(html).trim()) return '';

  const normalizeKey = (raw = '') =>
    String(raw || '').replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim().toLowerCase();

  const getDeep = (obj, path) =>
    path.split('.').reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) return acc[key];
      return '';
    }, obj);

  return String(html).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
    const fieldPath = normalizeKey(key);
    if (fieldPath === 'firma.linea') return '____________________________';
    if (fieldPath === 'firma.medico') return '[Firma digital del médico]';
    const aliasPath =
      fieldPath === 'consultorio.ubicacion' || fieldPath === 'consultorio.ubicacionconsultorio'
        ? 'consultorio.direccion'
        : fieldPath === 'sucursal.ubicacion'
          ? 'sucursal.direccion'
          : fieldPath;
    const valor = getDeep(contexto, aliasPath);
    if (valor === null || valor === undefined) return '';
    return String(valor);
  });
};

// ── Conversión de HTML de plantilla a bloques serializables ──────────────────
// Convierte el HTML ya resuelto de un documento en una estructura plana de
// bloques (encabezados, párrafos, listas, tablas, reglas) compuesta solo por
// objetos/arrays/strings, de modo que sobreviva la sanitización y pueda
// renderizarse con primitivas de @react-pdf/renderer conservando el formato.

const decodeHtmlEntities = (text = '') =>
  String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

// Recorre nodos en línea de un elemento DOM y devuelve "runs": fragmentos de
// texto con marcas de negrita/itálica. <br> se traduce a salto de línea.
const walkInlineRuns = (node, flags = { bold: false, italic: false }) => {
  const runs = [];
  if (!node || !node.childNodes) return runs;

  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const raw = String(child.textContent || '').replace(/\s+/g, ' ');
      if (raw) runs.push({ text: raw, bold: flags.bold, italic: flags.italic });
      return;
    }
    if (child.nodeType !== 1) return;

    const tag = child.tagName ? child.tagName.toLowerCase() : '';
    if (tag === 'br') { runs.push({ text: '\n', bold: flags.bold, italic: flags.italic }); return; }
    if (tag === 'style' || tag === 'script' || tag === 'img') return;

    const styleAttr = (child.getAttribute && child.getAttribute('style')) || '';
    const weight = /font-weight\s*:\s*(bold|[6-9]00)/i.test(styleAttr);
    const italicStyle = /font-style\s*:\s*italic/i.test(styleAttr);
    const nextFlags = {
      bold: flags.bold || tag === 'strong' || tag === 'b' || weight,
      italic: flags.italic || tag === 'em' || tag === 'i' || italicStyle
    };
    runs.push(...walkInlineRuns(child, nextFlags));
  });

  return runs;
};

// Normaliza una lista de runs: une los contiguos con el mismo estilo y limpia
// espacios redundantes alrededor de saltos de línea.
const compactRuns = (runs = []) => {
  const out = [];
  runs.forEach((r) => {
    const prev = out[out.length - 1];
    if (prev && prev.bold === r.bold && prev.italic === r.italic) {
      prev.text += r.text;
    } else {
      out.push({ ...r });
    }
  });
  return out
    .map((r) => ({ ...r, text: r.text.replace(/[ \t]*\n[ \t]*/g, '\n') }))
    .filter((r) => r.text.length > 0);
};

const runsTienenTexto = (runs = []) => runs.some((r) => String(r.text || '').trim());

const getAlign = (el) => {
  if (!el || !el.getAttribute) return '';
  const style = el.getAttribute('style') || '';
  const m = style.match(/text-align\s*:\s*(left|center|right|justify)/i);
  if (m) return m[1].toLowerCase();
  const attr = (el.getAttribute('align') || '').toLowerCase();
  return ['left', 'center', 'right', 'justify'].includes(attr) ? attr : '';
};

const parseConDom = (html) => {
  const parser = new DOMParser();
  const docHtml = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = docHtml.body.firstChild;
  const blocks = [];

  const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'div', 'ul', 'ol', 'table', 'hr', 'blockquote', 'section', 'header', 'footer']);

  const pushParrafo = (runs, align) => {
    const compact = compactRuns(runs);
    if (runsTienenTexto(compact)) blocks.push({ type: 'paragraph', align: align || '', runs: compact });
  };

  const procesarNodo = (node) => {
    if (!node) return;
    if (node.nodeType === 3) {
      const txt = String(node.textContent || '').replace(/\s+/g, ' ');
      if (txt.trim()) pushParrafo([{ text: txt, bold: false, italic: false }], '');
      return;
    }
    if (node.nodeType !== 1) return;

    const tag = node.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    if (tag === 'hr') { blocks.push({ type: 'rule' }); return; }

    if (/^h[1-4]$/.test(tag)) {
      const runs = compactRuns(walkInlineRuns(node));
      if (runsTienenTexto(runs)) blocks.push({ type: 'heading', level: Number(tag[1]), align: getAlign(node), runs });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = [];
      node.childNodes.forEach((li) => {
        if (li.nodeType === 1 && li.tagName.toLowerCase() === 'li') {
          const runs = compactRuns(walkInlineRuns(li));
          if (runsTienenTexto(runs)) items.push(runs);
        }
      });
      if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
      return;
    }

    if (tag === 'table') {
      const rows = [];
      node.querySelectorAll('tr').forEach((tr) => {
        const cells = [];
        tr.childNodes.forEach((cell) => {
          if (cell.nodeType === 1 && /^t[dh]$/.test(cell.tagName.toLowerCase())) {
            cells.push({
              header: cell.tagName.toLowerCase() === 'th',
              align: getAlign(cell),
              runs: compactRuns(walkInlineRuns(cell))
            });
          }
        });
        if (cells.length) rows.push(cells);
      });
      if (rows.length) blocks.push({ type: 'table', rows });
      return;
    }

    // Contenedores: si tienen hijos de bloque, recursar; si no, tratar como párrafo.
    if (tag === 'div' || tag === 'section' || tag === 'header' || tag === 'footer' || tag === 'blockquote') {
      const tieneHijosBloque = Array.from(node.childNodes).some(
        (c) => c.nodeType === 1 && BLOCK_TAGS.has(c.tagName.toLowerCase())
      );
      if (tieneHijosBloque) {
        node.childNodes.forEach(procesarNodo);
      } else {
        pushParrafo(walkInlineRuns(node), getAlign(node));
      }
      return;
    }

    if (tag === 'p') { pushParrafo(walkInlineRuns(node), getAlign(node)); return; }

    // Cualquier otro elemento en línea suelto al nivel raíz.
    pushParrafo(walkInlineRuns(node), '');
  };

  root.childNodes.forEach(procesarNodo);
  return blocks;
};

// Fallback sin DOMParser: degrada el HTML a párrafos de texto plano.
const parseSinDom = (html) => {
  const texto = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-4])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\u2022 ')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(texto)
    .split(/\n{1,}/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => ({ type: 'paragraph', align: '', runs: [{ text: linea, bold: false, italic: false }] }));
};

export const parseDocumentHtmlToBlocks = (html = '') => {
  if (!html || !String(html).trim()) return [];
  try {
    if (typeof DOMParser !== 'undefined') return parseConDom(html);
  } catch (_) { /* fallback abajo */ }
  try {
    return parseSinDom(html);
  } catch (_) {
    return [];
  }
};

/**
 * Construye el contexto para resolver variables de plantilla desde
 * los datos disponibles en el modal de expediente electrónico.
 */
export const buildTemplateContext = (paciente = {}, pxInfo = {}, consulta = {}) => {
  const nombreCompleto = nombrePaciente(paciente);
  const edadTexto = calcularEdad(paciente.fechaNacimiento) || consulta.pxInfo?.edad || '';
  const telefono = String(paciente.telefonoMovil || paciente.telefonoFijo || consulta.pxInfo?.telefono || '').trim();
  const alergiasTexto = formatAlergias(paciente.alergias || {});
  const grupoSanguineo = String(consulta.pxInfo?.grupo_sanguineo || paciente.grupoSanguineo || '').trim();
  const signos = consulta.signos || {};
  const antro = consulta.antropometria || {};
  const cie10texto = (consulta.cie10 || [])
    .map((item) => (item?.codigo ? `${item.codigo} - ${item.descripcion || ''}` : item?.descripcion || ''))
    .filter(Boolean).join(', ');
  const tratamientoLista = consulta.tratamiento || [];

  const medicamentosTexto = tratamientoLista.length > 0
    ? tratamientoLista.map((med, idx) => {
      const lines = [`${idx + 1}. ${med.nombre || 'Medicamento'} ${med.presentacion || ''}`];
      const sub = [med.numeroAcomodo || '', med.sustanciasActivas || ''].filter(Boolean);
      if (sub.length) lines.push(`   ${sub.join(' ')}`);
      if (med.dosis) lines.push(`   ${String(med.dosis).trim()}`);
      return lines.join('\n');
    }).join('\n')
    : '';

  const tratamientoTexto = tratamientoLista.length > 0
    ? tratamientoLista.map((med, idx) => `${idx + 1}. ${med.nombre || 'Medicamento'}${med.dosis ? ` - ${med.dosis}` : ''}`).join('\n')
    : '';

  const estudiosLista = [
    ...(consulta.estudios?.paquetes || []),
    ...(consulta.estudios?.seleccionados || []).map((e) => (typeof e === 'string' ? e : e?.nombre || ''))
  ].filter(Boolean);
  const estudiosTexto = estudiosLista.length > 0 ? estudiosLista.join(', ') : '';

  const procLista = (consulta.procedimientos?.seleccionados || [])
    .map((p) => (typeof p === 'string' ? p : p?.nombre || p?.procedimiento || '')).filter(Boolean);
  const procedimientosTexto = procLista.length > 0 ? procLista.join(', ') : '';

  const fechaReceta = consulta.fechaOrden ? new Date(consulta.fechaOrden) : new Date();
  const formatDateLongEsMx = (d) =>
    d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return {
    paciente: {
      id: String(paciente.idPaciente || paciente.id || '').trim(),
      nombre: nombreCompleto,
      edad: edadTexto,
      fecha_nacimiento: safeDateStr(paciente.fechaNacimiento),
      id_receta: String(paciente.idPaciente || consulta.folioReceta || '').trim(),
      folio_receta: String(consulta.folioReceta || '').trim(),
      alergias_base: alergiasTexto,
      alergias: alergiasTexto,
      telefono,
      sexo: String(paciente.sexo || '').trim(),
      grupo_sanguineo: grupoSanguineo,
      tipo_sangre: grupoSanguineo
    },
    exploracion: {
      signos: {
        ta: String(signos.ta || '').trim(),
        temp: String(signos.temp || '').trim(),
        fc: String(signos.fc || '').trim(),
        fr: String(signos.fr || '').trim(),
        spo2: String(signos.spo2 || '').trim()
      },
      antropometria: {
        peso: String(antro.peso || '').trim(),
        talla: String(antro.talla || '').trim()
      }
    },
    medico: {
      nombre: String(consulta.medicoNombre || consulta.medicoPerfil?.nombre || '').trim(),
      cedula: String(consulta.medicoPerfil?.cedula || consulta.medicoPerfil?.cedulaProfesional || '').trim(),
      cedula_profesional: String(consulta.medicoPerfil?.cedula || consulta.medicoPerfil?.cedulaProfesional || '').trim(),
      especialidad: String(consulta.medicoPerfil?.especialidad || '').trim(),
      universidad_egreso: String(consulta.medicoPerfil?.universidadEgreso || '').trim(),
      centro_estudios: String(consulta.medicoPerfil?.universidadEgreso || '').trim(),
      sucursal: String(consulta.medicoPerfil?.sucursal || '').trim()
    },
    receta: {
      folio: String(consulta.folioReceta || '').trim(),
      fecha: fechaReceta.toLocaleDateString('es-MX')
    },
    sucursal: {
      nombre: '',
      horario: '',
      quejas_sugerencias: '',
      direccion: String(consulta.sucursalDireccion || '').trim(),
      ubicacion: String(consulta.sucursalDireccion || '').trim(),
      domicilio: String(consulta.sucursalDireccion || '').trim(),
      telefono: ''
    },
    consultorio: {
      nombre: String(consulta.consultorioNombre || '').trim(),
      direccion: String(consulta.consultorioDireccion || consulta.sucursalDireccion || '').trim(),
      ubicacion: String(consulta.consultorioDireccion || consulta.sucursalDireccion || '').trim(),
      domicilio: String(consulta.consultorioDireccion || consulta.sucursalDireccion || '').trim()
    },
    consulta: {
      padecimiento: consulta.padecimiento || '',
      diagnostico: consulta.diagnostico || '',
      cie10_texto: cie10texto,
      indicaciones: consulta.indicaciones || '',
      tratamiento_texto: tratamientoTexto,
      tratamiento_html: '',
      medicamentos_texto: medicamentosTexto,
      medicamentos_html: '',
      estudios_texto: estudiosTexto,
      estudios_html: '',
      estudios_conteo: String(estudiosLista.length),
      paquetes_texto: '',
      estudios_notas: String(consulta.estudios?.notas || '').trim(),
      procedimientos_texto: procedimientosTexto,
      procedimientos_html: '',
      procedimientos_conteo: String(procLista.length),
      procedimientos_notas: String(consulta.procedimientos?.notas || '').trim(),
      referencias_texto: '',
      referencias_html: '',
      referencias_conteo: '0',
      receta_contenido: ''
    },
    fecha: {
      hoy: fechaReceta.toLocaleDateString('es-MX'),
      hoy_larga: formatDateLongEsMx(fechaReceta),
      expedida: '',
      larga: formatDateLongEsMx(fechaReceta)
    },
    fechaexpedida: ''
  };
};
