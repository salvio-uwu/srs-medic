import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Calendar, Download, FileSpreadsheet, Loader2, Search, Trash2, Upload, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

/* ─── Grupos de edad estándar SUIVE ─── */
const GRUPOS_EDAD = [
  { label: '<1 año', min: 0, max: 0 },
  { label: '1-4 años', min: 1, max: 4 },
  { label: '5-9 años', min: 5, max: 9 },
  { label: '10-14 años', min: 10, max: 14 },
  { label: '15-19 años', min: 15, max: 19 },
  { label: '20-24 años', min: 20, max: 24 },
  { label: '25-44 años', min: 25, max: 44 },
  { label: '45-49 años', min: 45, max: 49 },
  { label: '50-59 años', min: 50, max: 59 },
  { label: '60-64 años', min: 60, max: 64 },
  { label: '65 y >', min: 65, max: 999 },
];
const SEXOS = ['H', 'M', 'I'];

/* ─── Capítulos CIE-10 → Grupo SUIVE ─── */
const CIE10_GRUPOS = [
  { prefijos: ['A','B'], grupo: 'ENFERMEDADES INFECCIOSAS Y PARASITARIAS' },
  { prefijos: ['C','D0','D1','D2','D3','D4'], grupo: 'NEOPLASIAS (TUMORES)' },
  { prefijos: ['D5','D6','D7','D8'], grupo: 'ENFERMEDADES DE LA SANGRE Y ÓRGANOS HEMATOPOYÉTICOS' },
  { prefijos: ['E'], grupo: 'ENFERMEDADES ENDOCRINAS, NUTRICIONALES Y METABÓLICAS' },
  { prefijos: ['F'], grupo: 'TRASTORNOS MENTALES Y DEL COMPORTAMIENTO' },
  { prefijos: ['G'], grupo: 'ENFERMEDADES DEL SISTEMA NERVIOSO' },
  { prefijos: ['H0','H1','H2','H3','H4','H5'], grupo: 'ENFERMEDADES DEL OJO Y SUS ANEXOS' },
  { prefijos: ['H6','H7','H8','H9'], grupo: 'ENFERMEDADES DEL OÍDO Y DE LA APÓFISIS MASTOIDES' },
  { prefijos: ['I'], grupo: 'ENFERMEDADES DEL SISTEMA CIRCULATORIO' },
  { prefijos: ['J'], grupo: 'ENFERMEDADES DEL SISTEMA RESPIRATORIO' },
  { prefijos: ['K'], grupo: 'ENFERMEDADES DEL APARATO DIGESTIVO' },
  { prefijos: ['L'], grupo: 'ENFERMEDADES DE LA PIEL Y TEJIDO SUBCUTÁNEO' },
  { prefijos: ['M'], grupo: 'ENFERMEDADES DEL SISTEMA OSTEOMUSCULAR' },
  { prefijos: ['N'], grupo: 'ENFERMEDADES DEL APARATO GENITOURINARIO' },
  { prefijos: ['O'], grupo: 'EMBARAZO, PARTO Y PUERPERIO' },
  { prefijos: ['P'], grupo: 'AFECCIONES ORIGINADAS EN EL PERIODO PERINATAL' },
  { prefijos: ['Q'], grupo: 'MALFORMACIONES CONGÉNITAS' },
  { prefijos: ['R'], grupo: 'SÍNTOMAS Y SIGNOS NO CLASIFICADOS' },
  { prefijos: ['S','T'], grupo: 'TRAUMATISMOS Y ENVENENAMIENTOS' },
  { prefijos: ['V','W','X','Y'], grupo: 'CAUSAS EXTERNAS DE MORBILIDAD' },
  { prefijos: ['Z'], grupo: 'FACTORES QUE INFLUYEN EN EL ESTADO DE SALUD' },
  { prefijos: ['U'], grupo: 'CÓDIGOS PARA PROPÓSITOS ESPECIALES' },
];

/* ─── Helpers ─── */
const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/* Limpia descripción: quita prefijos numéricos residuales como ".2 –", "0 –", etc. */
const limpiarDescripcion = (desc, codigo) => {
  let limpia = (desc || '').trim();
  // Quitar prefijos tipo ".2 –", "2 –", ".0 -", "9 -" que son residuos del subcode
  limpia = limpia.replace(/^\.?\d{1,2}\s*[-–—]\s*/, '').trim();
  // Si la descripción empieza con el código, quitarlo
  if (codigo && limpia.toUpperCase().startsWith(codigo.toUpperCase())) {
    limpia = limpia.slice(codigo.length).replace(/^\s*[-–—]\s*/, '').trim();
  }
  return limpia || 'Sin descripción';
};

/* Reconstruye código completo: si codigo="K52" y desc empieza con ".2" → "K52.2" */
const reconstruirCodigo = (codigo, desc) => {
  const match = (desc || '').match(/^\.?(\d{1,2})\s*[-–—]/);
  if (match && codigo && !codigo.includes('.')) {
    return `${codigo}.${match[1]}`;
  }
  return codigo;
};

const parseCIE10 = (texto) => {
  if (!texto) return [];
  const matches = texto.match(/([A-Z]\d{2}(?:\.\d{1,2})?)\s*[-–—]?\s*([^,;\n]*)/gi);
  if (!matches) return [];
  return matches.map((m) => {
    const parts = m.match(/^([A-Z]\d{2}(?:\.\d{1,2})?)\s*[-–—]?\s*(.*)/i);
    if (!parts) return null;
    const codigo = parts[1].toUpperCase();
    const descripcion = limpiarDescripcion(parts[2], codigo);
    return { codigo, descripcion };
  }).filter(Boolean);
};

const getGrupoSuive = (codigo) => {
  if (!codigo) return 'SIN CLASIFICAR';
  const upper = codigo.toUpperCase();
  for (const g of CIE10_GRUPOS) {
    for (const p of g.prefijos) {
      if (upper.startsWith(p)) return g.grupo;
    }
  }
  return 'SIN CLASIFICAR';
};

const calcularEdad = (fechaNacimiento, fechaConsulta) => {
  if (!fechaNacimiento) return -1;
  const nac = new Date(fechaNacimiento);
  const ref = fechaConsulta instanceof Date ? fechaConsulta : new Date();
  if (Number.isNaN(nac.getTime())) return -1;
  let edad = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad--;
  return Math.max(0, edad);
};

const normalizeSexo = (sexo) => {
  const s = String(sexo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (s === 'masculino' || s === 'hombre' || s === 'h' || s === 'male') return 'H';
  if (s === 'femenino' || s === 'mujer' || s === 'f' || s === 'female') return 'M';
  if (s.startsWith('masc') || s.startsWith('hom')) return 'H';
  if (s.startsWith('fem') || s.startsWith('muj')) return 'M';
  return 'I';
};

const getGrupoEdadIdx = (edad) => {
  if (edad < 0) return -1;
  return GRUPOS_EDAD.findIndex((g) => edad >= g.min && edad <= g.max);
};

/* ─── Plantilla SUIVE: almacenamiento en localStorage ─── */
const TEMPLATE_KEY = 'suive_plantilla';
const TEMPLATE_NAME_KEY = 'suive_plantilla_nombre';

const saveTemplateToStorage = (arrayBuffer, fileName) => {
  const bytes = new Uint8Array(arrayBuffer);
  const binary = bytes.reduce((acc, b) => acc + String.fromCharCode(b), '');
  localStorage.setItem(TEMPLATE_KEY, btoa(binary));
  localStorage.setItem(TEMPLATE_NAME_KEY, fileName);
};

const loadTemplateFromStorage = () => {
  const b64 = localStorage.getItem(TEMPLATE_KEY);
  if (!b64) return null;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const getTemplateName = () => localStorage.getItem(TEMPLATE_NAME_KEY) || '';
const removeTemplateFromStorage = () => {
  localStorage.removeItem(TEMPLATE_KEY);
  localStorage.removeItem(TEMPLATE_NAME_KEY);
};

/* ─── Auto-detección del layout de la plantilla SUIVE ─── */
const detectSuiveLayout = (ws) => {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // 1) Buscar fila que contenga "Grupo" en las primeras 30 filas y 5 columnas
  let headerRow = -1;
  let grupoCol = -1;
  for (let r = 0; r <= Math.min(range.e.r, 30); r++) {
    for (let c = 0; c <= Math.min(range.e.c, 5); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const val = String(cell?.v || '').toLowerCase().trim();
      if (val.includes('grupo')) {
        headerRow = r;
        grupoCol = c;
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) return null;

  // 2) Buscar columna de "Diagnóstico" en la misma fila
  let dxCol = grupoCol + 1;
  for (let c = grupoCol + 1; c <= Math.min(range.e.c, 10); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    const val = String(cell?.v || '').toLowerCase();
    if (val.includes('diagnos') || val.includes('diagn')) {
      dxCol = c;
      break;
    }
  }

  // 3) Buscar columna de EPI Clave (puede no existir)
  let epiCol = -1;
  for (let c = dxCol + 1; c <= Math.min(range.e.c, dxCol + 3); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    const val = String(cell?.v || '').toLowerCase();
    if (val.includes('epi') || val.includes('clave')) {
      epiCol = c;
      break;
    }
  }

  // 4) Detectar columnas de datos: buscar la sub-fila con "M" y "F" consecutivos
  const subHeaderRow = headerRow + 1;
  const dataStartRow = subHeaderRow + 1;
  const firstDataCol = epiCol >= 0 ? epiCol + 1 : dxCol + 1;

  // 5) Contar pares M/F para mapear a grupos de edad
  //    El formato SUIVE tiene: [<1año M,F] [1-4 M,F] [5-9 M,F] ... [65+ M,F] [Ign M,F] [Total M,F] [TOTAL]
  //    = 11 age groups + Ign + Total = 13 pares M/F + 1 col TOTAL
  const ageGroupPairs = []; // [{mCol, fCol}]
  let c = firstDataCol;
  while (c + 1 <= range.e.c) {
    const cellA = ws[XLSX.utils.encode_cell({ r: subHeaderRow, c })];
    const cellB = ws[XLSX.utils.encode_cell({ r: subHeaderRow, c: c + 1 })];
    const vA = String(cellA?.v || '').toUpperCase().trim();
    const vB = String(cellB?.v || '').toUpperCase().trim();
    if ((vA === 'M' || vA === 'H') && (vB === 'F' || vB === 'M')) {
      // Pair found
      ageGroupPairs.push({ mCol: c, fCol: c + 1 });
      c += 2;
    } else {
      // Podría ser la columna TOTAL final (sin par)
      break;
    }
  }

  // La última columna solitaria es TOTAL general
  let totalGeneralCol = c <= range.e.c ? c : -1;

  // Si no encontramos suficientes pares, el layout no es reconocible
  if (ageGroupPairs.length < 13) return null;

  // Mapeo: primeros 11 pares = grupos de edad, par 12 = Ignorados, par 13 = Total M/F
  return {
    headerRow,
    subHeaderRow,
    dataStartRow,
    grupoCol,
    dxCol,
    epiCol,
    ageGroupPairs: ageGroupPairs.slice(0, 11),  // 11 grupos de edad
    ignPair: ageGroupPairs[11],                   // Ignorados M/F
    totalPair: ageGroupPairs[12],                 // Total M/F
    totalGeneralCol: ageGroupPairs.length > 13 ? ageGroupPairs[13]?.mCol || totalGeneralCol : totalGeneralCol,
  };
};

/* Escribe un valor en una celda preservando el estilo existente */
const writeCell = (ws, r, c, value) => {
  const ref = XLSX.utils.encode_cell({ r, c });
  const existing = ws[ref] || {};
  if (value === 0 || value === '') {
    ws[ref] = { ...existing, v: value, t: typeof value === 'number' ? 'n' : 's' };
  } else {
    ws[ref] = { ...existing, v: value, t: typeof value === 'number' ? 'n' : 's' };
  }
};

/* ─── Componente principal ─── */
const ReporteSuive = () => {
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [consultorios, setConsultorios] = useState([]);
  const [selectedConsultorio, setSelectedConsultorio] = useState('todos');
  const [incluirRelacion, setIncluirRelacion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState(null);
  const [detallePacientes, setDetallePacientes] = useState([]);
  const [templateName, setTemplateName] = useState(getTemplateName);
  const fileInputRef = useRef(null);

  /* Subir plantilla */
  const handleTemplateUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('La plantilla debe ser un archivo .xlsx');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const ab = ev.target.result;
        // Validar que sea un xlsx válido y que tenga layout SUIVE
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const layout = detectSuiveLayout(ws);
        if (!layout) {
          setError('No se detectó un formato SUIVE válido en la plantilla. Asegúrate de que contenga la fila con "Grupo", "Diagnóstico" y las columnas M/F por grupo de edad.');
          return;
        }
        saveTemplateToStorage(ab, file.name);
        setTemplateName(file.name);
        setError('');
      } catch (err) {
        setError(`Error al leer la plantilla: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleRemoveTemplate = () => {
    removeTemplateFromStorage();
    setTemplateName('');
  };

  /* Cargar catálogo de consultorios */
  useEffect(() => {
    const q = query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setConsultorios(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.activo !== false));
    });
    return () => unsub();
  }, []);

  /* ─── Generar reporte ─── */
  const generarReporte = async () => {
    setLoading(true);
    setError('');
    setResultados(null);
    setDetallePacientes([]);

    try {
      const inicio = new Date(`${fechaInicio}T00:00:00`);
      const fin = new Date(`${fechaFin}T23:59:59`);

      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
        setError('Fechas inválidas.');
        setLoading(false);
        return;
      }

      const tsInicio = Timestamp.fromDate(inicio);
      const tsFin = Timestamp.fromDate(fin);

      /* 1) Consultar historial_clinico */
      const qHistorial = query(
        collection(db, 'historial_clinico'),
        where('fecha', '>=', tsInicio),
        where('fecha', '<=', tsFin),
        orderBy('fecha', 'asc')
      );
      const histSnap = await getDocs(qHistorial);
      const historiales = histSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (historiales.length === 0) {
        setError('No se encontraron consultas en el rango de fechas seleccionado.');
        setLoading(false);
        return;
      }

      /* 2) Obtener IDs únicos de pacientes */
      const pacienteIds = [...new Set(historiales.map((h) => h.pacienteId).filter(Boolean))];

      /* 3) Batch fetch de pacientes (sexo) */
      const pacientesMap = new Map();
      const chunks = [];
      for (let i = 0; i < pacienteIds.length; i += 30) {
        chunks.push(pacienteIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const qPx = query(collection(db, 'pacientes'), where('__name__', 'in', chunk));
        const pxSnap = await getDocs(qPx);
        pxSnap.docs.forEach((d) => {
          const data = d.data();
          pacientesMap.set(d.id, {
            sexo: data.sexo || '',
            nombre: data.nombre || data.nombreCompleto || '',
            fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || '',
          });
        });
      }

      /* 4) Filtrar por consultorio si aplica */
      let historialesFiltrados = historiales;
      if (selectedConsultorio !== 'todos') {
        const consultorioSeleccionado = consultorios.find((c) => c.id === selectedConsultorio);
        const nombreConsultorio = consultorioSeleccionado?.nombre || '';

        // Historiales nuevos tienen consultorioId directo; para los viejos, fallback por citaId → citas
        const sinCampoDirecto = historiales.filter((h) => !h.consultorioId && h.citaId);
        const citasMap = new Map();
        if (sinCampoDirecto.length > 0) {
          const citaIdsFallback = [...new Set(sinCampoDirecto.map((h) => h.citaId))];
          for (let i = 0; i < citaIdsFallback.length; i += 30) {
            const chunk = citaIdsFallback.slice(i, i + 30);
            const qCitas = query(collection(db, 'citas'), where('__name__', 'in', chunk));
            const citasSnap = await getDocs(qCitas);
            citasSnap.docs.forEach((d) => {
              const data = d.data();
              citasMap.set(d.id, { consultorioId: data.consultorioId || '', consultorioNombre: data.consultorioNombre || '' });
            });
          }
        }

        historialesFiltrados = historiales.filter((h) => {
          // Campo directo (nuevos registros)
          if (h.consultorioId) {
            return h.consultorioId === selectedConsultorio;
          }
          // Fallback por nombre directo
          if (h.consultorioNombre) {
            return h.consultorioNombre === nombreConsultorio;
          }
          // Fallback por cita (registros viejos sin campo directo)
          if (h.citaId) {
            const cita = citasMap.get(h.citaId);
            if (!cita) return false;
            return cita.consultorioId === selectedConsultorio || cita.consultorioNombre === nombreConsultorio;
          }
          return false;
        });

        if (historialesFiltrados.length === 0) {
          setError('No se encontraron consultas para el consultorio seleccionado en el rango de fechas.');
          setLoading(false);
          return;
        }
      }

      /* 6) Procesar datos: extraer diagnósticos y agrupar */
      // Estructura: { [grupo]: { [codigoYDesc]: matrizConteo[grupoEdad][sexo] } }
      const agrupado = {};
      const listaPacientes = [];

      for (const h of historialesFiltrados) {
        const fechaConsulta = h.fecha?.toDate ? h.fecha.toDate() : new Date();
        const px = pacientesMap.get(h.pacienteId) || {};
        const fechaNac = h.px_info?.fecha_nacimiento || px.fechaNacimiento || '';
        const edad = calcularEdad(fechaNac, fechaConsulta);
        const sexoNorm = normalizeSexo(px.sexo);
        const grupoEdadIdx = getGrupoEdadIdx(edad);

        /* Extraer CIE-10 del diagnóstico */
        let diagnosticos = [];

        // Intentar primero el array estructurado consulta.diagnostico.cie10
        const cie10Array = h.consulta?.diagnostico?.cie10;
        if (Array.isArray(cie10Array) && cie10Array.length > 0) {
          diagnosticos = cie10Array
            .map((item) => {
              const rawCodigo = (item.codigo || item.code || '').toUpperCase().trim();
              const rawDesc = (item.descripcion || item.description || '').trim();
              const codigo = reconstruirCodigo(rawCodigo, rawDesc);
              const descripcion = limpiarDescripcion(rawDesc, rawCodigo);
              return { codigo, descripcion };
            })
            .filter((d) => d.codigo);
        }

        // Fallback: parsear del texto enfermedad_actual
        if (diagnosticos.length === 0) {
          const textoEnf = h.consulta?.diagnostico?.enfermedad_actual || '';
          diagnosticos = parseCIE10(textoEnf);
        }

        if (diagnosticos.length === 0) continue;

        for (const dx of diagnosticos) {
          const grupo = getGrupoSuive(dx.codigo);
          const key = `${dx.codigo} - ${dx.descripcion || 'Sin descripción'}`;

          if (!agrupado[grupo]) agrupado[grupo] = {};
          if (!agrupado[grupo][key]) {
            agrupado[grupo][key] = {
              codigo: dx.codigo,
              descripcion: dx.descripcion || 'Sin descripción',
              conteo: GRUPOS_EDAD.map(() => ({ H: 0, M: 0, I: 0 })),
              ignorados: { H: 0, M: 0, I: 0 },
              total: { H: 0, M: 0, I: 0 },
            };
          }

          const entry = agrupado[grupo][key];
          if (grupoEdadIdx >= 0) {
            entry.conteo[grupoEdadIdx][sexoNorm]++;
          } else {
            entry.ignorados[sexoNorm]++;
          }
          entry.total[sexoNorm]++;
        }

        if (incluirRelacion) {
          for (const dx of diagnosticos) {
            listaPacientes.push({
              paciente: px.nombre || h.pacienteNombre || 'Sin nombre',
              sexo: sexoNorm,
              edad: edad >= 0 ? edad : '?',
              diagnostico: `${dx.codigo} - ${dx.descripcion}`,
              fecha: fechaConsulta.toLocaleDateString('es-MX'),
              medico: h.medicoNombre || '',
            });
          }
        }
      }

      /* 7) Convertir a array ordenado */
      const tablaFinal = [];
      const gruposOrdenados = Object.keys(agrupado).sort();
      for (const grupo of gruposOrdenados) {
        const diagnosticosEnGrupo = Object.values(agrupado[grupo]).sort((a, b) =>
          a.codigo.localeCompare(b.codigo)
        );
        for (const dx of diagnosticosEnGrupo) {
          tablaFinal.push({ grupo, ...dx });
        }
      }

      setResultados(tablaFinal);
      setDetallePacientes(listaPacientes);
    } catch (err) {
      console.error('Error generando reporte SUIVE:', err);
      setError(`Error al generar el reporte: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Exportar a XLSX ─── */
  const exportarXLSX = () => {
    if (!resultados || resultados.length === 0) return;

    const rangoLabel = `${fechaInicio}_a_${fechaFin}`;
    const templateBuffer = loadTemplateFromStorage();

    /* ═══ EXPORTACIÓN CON PLANTILLA ═══ */
    if (templateBuffer) {
      try {
        const wb = XLSX.read(templateBuffer, { type: 'array', cellStyles: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const layout = detectSuiveLayout(ws);

        if (!layout) {
          setError('No se pudo detectar el formato de la plantilla al exportar.');
          return;
        }

        const { dataStartRow, grupoCol, dxCol, epiCol, ageGroupPairs, ignPair, totalPair, totalGeneralCol } = layout;

        // Llenar datos fila por fila
        let currentRow = dataStartRow;
        for (const row of resultados) {
          // Grupo
          writeCell(ws, currentRow, grupoCol, row.grupo);
          // Diagnóstico + código CIE10
          writeCell(ws, currentRow, dxCol, `${row.descripcion} ${row.codigo}`);
          // EPI Clave (si existe la columna)
          if (epiCol >= 0) {
            writeCell(ws, currentRow, epiCol, row.codigo);
          }

          // Grupos de edad: M (nuestro H) y F (nuestra M)
          // Los casos con sexo I se suman a Ignorados
          for (let i = 0; i < Math.min(ageGroupPairs.length, GRUPOS_EDAD.length); i++) {
            const pair = ageGroupPairs[i];
            const mVal = row.conteo[i].H;       // Masculino → col M del SUIVE
            const fVal = row.conteo[i].M;        // Femenino → col F del SUIVE
            writeCell(ws, currentRow, pair.mCol, mVal);
            writeCell(ws, currentRow, pair.fCol, fVal);
          }

          // Ignorados: edad desconocida + sexo indeterminado en cualquier edad
          if (ignPair) {
            // Sumar: ignorados por edad (H+I) y todos los I de cada grupo de edad
            let ignM = row.ignorados.H;
            let ignF = row.ignorados.M;
            // Los de sexo Indeterminado (I) en cualquier grupo de edad van a Ignorados
            for (let i = 0; i < GRUPOS_EDAD.length; i++) {
              ignM += row.conteo[i].I; // Se suman al conteo de ignorados masculino por convención
            }
            ignM += row.ignorados.I;
            writeCell(ws, currentRow, ignPair.mCol, ignM);
            writeCell(ws, currentRow, ignPair.fCol, ignF);
          }

          // Total M/F
          if (totalPair) {
            let totalM = row.total.H + row.total.I; // Todos los I van a M por convención en Ign
            let totalF = row.total.M;
            writeCell(ws, currentRow, totalPair.mCol, totalM);
            writeCell(ws, currentRow, totalPair.fCol, totalF);
          }

          // TOTAL general
          if (totalGeneralCol >= 0) {
            writeCell(ws, currentRow, totalGeneralCol, row.total.H + row.total.M + row.total.I);
          }

          currentRow++;
        }

        // Actualizar el rango de la hoja para incluir las nuevas filas
        const oldRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        if (currentRow - 1 > oldRange.e.r) {
          oldRange.e.r = currentRow - 1;
          ws['!ref'] = XLSX.utils.encode_range(oldRange);
        }

        // Hoja 2: Relación de pacientes (si aplica)
        if (detallePacientes.length > 0) {
          const encPx = ['Paciente', 'Sexo', 'Edad', 'Diagnóstico', 'Fecha', 'Médico'];
          const filasPx = [encPx, ...detallePacientes.map((p) => [p.paciente, p.sexo, p.edad, p.diagnostico, p.fecha, p.medico])];
          const wsPx = XLSX.utils.aoa_to_sheet(filasPx);
          wsPx['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 50 }, { wch: 14 }, { wch: 30 }];
          XLSX.utils.book_append_sheet(wb, wsPx, 'Relación Pacientes');
        }

        XLSX.writeFile(wb, `SUIVE_${rangoLabel}.xlsx`);
        return;
      } catch (err) {
        console.error('Error exportando con plantilla:', err);
        setError(`Error al usar la plantilla: ${err.message}. Se descargará sin plantilla.`);
      }
    }

    /* ═══ EXPORTACIÓN SIN PLANTILLA (fallback) ═══ */
    const wb = XLSX.utils.book_new();

    /* Hoja 1: Reporte SUIVE */
    const encabezadoFila1 = ['Grupo', 'Diagnóstico y código CIE10'];
    const encabezadoFila2 = ['', ''];
    const encabezadoFila3 = ['', ''];

    for (const ge of GRUPOS_EDAD) {
      encabezadoFila1.push(ge.label, '', '');
      encabezadoFila2.push('H', 'M', 'I');
    }
    encabezadoFila1.push('Ignorados', '', '');
    encabezadoFila2.push('H', 'M', 'I');
    encabezadoFila1.push('Total', '', '', 'Total');
    encabezadoFila2.push('H', 'M', 'I', '');

    const filas = [encabezadoFila1, encabezadoFila2];

    for (const row of resultados) {
      const fila = [row.grupo, `${row.descripcion} ${row.codigo}`];
      for (let i = 0; i < GRUPOS_EDAD.length; i++) {
        fila.push(row.conteo[i].H, row.conteo[i].M, row.conteo[i].I);
      }
      fila.push(row.ignorados.H, row.ignorados.M, row.ignorados.I);
      fila.push(row.total.H, row.total.M, row.total.I);
      const totalGeneral = row.total.H + row.total.M + row.total.I;
      fila.push(totalGeneral);
      filas.push(fila);
    }

    const ws = XLSX.utils.aoa_to_sheet(filas);

    /* Merges para encabezados de grupos de edad */
    const merges = [];
    let col = 2;
    for (let i = 0; i < GRUPOS_EDAD.length; i++) {
      merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } });
      col += 3;
    }
    // Ignorados
    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } });
    col += 3;
    // Total H/M/I
    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } });
    col += 3;

    ws['!merges'] = merges;

    /* Ancho de columnas */
    const colWidths = [{ wch: 40 }, { wch: 40 }];
    for (let i = 0; i < (GRUPOS_EDAD.length + 1) * 3 + 4; i++) {
      colWidths.push({ wch: 5 });
    }
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'SUIVE');

    /* Hoja 2: Relación de pacientes (si aplica) */
    if (detallePacientes.length > 0) {
      const encPx = ['Paciente', 'Sexo', 'Edad', 'Diagnóstico', 'Fecha', 'Médico'];
      const filasPx = [encPx, ...detallePacientes.map((p) => [p.paciente, p.sexo, p.edad, p.diagnostico, p.fecha, p.medico])];
      const wsPx = XLSX.utils.aoa_to_sheet(filasPx);
      wsPx['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 50 }, { wch: 14 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsPx, 'Relación Pacientes');
    }

    XLSX.writeFile(wb, `SUIVE_${rangoLabel}.xlsx`);
  };

  /* ─── Totales generales por columna ─── */
  const totalesGenerales = useMemo(() => {
    if (!resultados || resultados.length === 0) return null;
    const totConteo = GRUPOS_EDAD.map(() => ({ H: 0, M: 0, I: 0 }));
    const totIgnorados = { H: 0, M: 0, I: 0 };
    const totTotal = { H: 0, M: 0, I: 0 };
    for (const row of resultados) {
      for (let i = 0; i < GRUPOS_EDAD.length; i++) {
        totConteo[i].H += row.conteo[i].H;
        totConteo[i].M += row.conteo[i].M;
        totConteo[i].I += row.conteo[i].I;
      }
      totIgnorados.H += row.ignorados.H;
      totIgnorados.M += row.ignorados.M;
      totIgnorados.I += row.ignorados.I;
      totTotal.H += row.total.H;
      totTotal.M += row.total.M;
      totTotal.I += row.total.I;
    }
    return { conteo: totConteo, ignorados: totIgnorados, total: totTotal };
  }, [resultados]);

  /* ─── Render ─── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
          Reporte SUIVE
        </h2>
        <p className="text-sm text-slate-500">
          Sistema Único de Información para la Vigilancia Epidemiológica — Reporte de morbilidad por diagnóstico CIE-10.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold text-slate-600">
            Fecha inicio
            <div className="mt-1 relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-slate-600">
            Fecha fin
            <div className="mt-1 relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              />
            </div>
          </label>

          <label className="text-xs font-semibold text-slate-600">
            Consultorio
            <select
              value={selectedConsultorio}
              onChange={(e) => setSelectedConsultorio(e.target.value)}
              className="mt-1 block px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white min-w-[220px]"
            >
              <option value="todos">Todos los consultorios</option>
              {consultorios.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}{c.sucursal ? ` (${c.sucursal})` : ''}</option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={incluirRelacion}
              onChange={(e) => setIncluirRelacion(e.target.checked)}
            />
            <Users size={14} />
            Incluir relación de pacientes
          </label>

          <button
            onClick={generarReporte}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Consultando...' : 'Generar reporte'}
          </button>
        </div>
      </div>

      {/* Plantilla SUIVE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-600 mb-0.5">Plantilla SUIVE (.xlsx)</p>
            {templateName ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
                <FileSpreadsheet size={14} className="text-emerald-600 flex-shrink-0" />
                <span className="text-emerald-800 font-medium truncate max-w-[260px]">{templateName}</span>
                <button
                  onClick={handleRemoveTemplate}
                  className="text-red-400 hover:text-red-600 transition-colors ml-1"
                  title="Quitar plantilla"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Sin plantilla — se exportará en formato genérico.</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleTemplateUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Upload size={14} />
            {templateName ? 'Cambiar plantilla' : 'Subir plantilla'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Resultados */}
      {resultados && resultados.length > 0 && (
        <>
          {/* Botón exportar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{resultados.length}</span> diagnósticos encontrados
              {detallePacientes.length > 0 && (
                <> &middot; <span className="font-semibold">{detallePacientes.length}</span> registros de pacientes</>
              )}
            </p>
            <button
              onClick={exportarXLSX}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Download size={14} />
              {templateName ? 'Descargar con plantilla' : 'Descargar XLSX'}
            </button>
          </div>

          {/* Tabla SUIVE */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] leading-tight">
                <thead>
                  {/* Fila 1: nombres de grupos de edad */}
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th rowSpan={2} className="px-2 py-2 font-bold text-slate-700 border-r border-slate-200 min-w-[160px] sticky left-0 bg-slate-100 z-10">
                      Grupo
                    </th>
                    <th rowSpan={2} className="px-2 py-2 font-bold text-slate-700 border-r border-slate-200 min-w-[200px] sticky left-[160px] bg-slate-100 z-10">
                      Diagnóstico y código CIE10
                    </th>
                    {GRUPOS_EDAD.map((ge) => (
                      <th key={ge.label} colSpan={3} className="px-1 py-1.5 text-center font-bold text-slate-700 border-r border-slate-200">
                        {ge.label}
                      </th>
                    ))}
                    <th colSpan={3} className="px-1 py-1.5 text-center font-bold text-slate-700 border-r border-slate-200">
                      Ignorados
                    </th>
                    <th colSpan={3} className="px-1 py-1.5 text-center font-bold text-blue-700 border-r border-slate-200">
                      Total
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-center font-bold text-blue-800 bg-blue-50">
                      Total
                    </th>
                  </tr>
                  {/* Fila 2: H M I */}
                  <tr className="bg-slate-50 border-b border-slate-300">
                    {[...GRUPOS_EDAD, { label: 'Ignorados' }, { label: 'Total' }].map((ge, gi) => (
                      SEXOS.map((s) => (
                        <th
                          key={`${ge.label}-${s}`}
                          className={`px-1 py-1 text-center font-semibold border-r border-slate-200 ${
                            s === 'H' ? 'text-blue-600' : s === 'M' ? 'text-pink-600' : 'text-slate-500'
                          }`}
                        >
                          {s}
                        </th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((row, idx) => {
                    const totalGeneral = row.total.H + row.total.M + row.total.I;
                    const showGrupo = idx === 0 || resultados[idx - 1].grupo !== row.grupo;
                    const grupoRowSpan = showGrupo
                      ? resultados.filter((r) => r.grupo === row.grupo).length
                      : 0;

                    return (
                      <tr
                        key={`${row.codigo}-${idx}`}
                        className={`border-b border-slate-100 hover:bg-yellow-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      >
                        {showGrupo && (
                          <td
                            rowSpan={grupoRowSpan}
                            className="px-2 py-1.5 font-bold text-[10px] text-slate-800 border-r border-slate-200 align-top sticky left-0 bg-white z-10"
                          >
                            {row.grupo}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-slate-700 border-r border-slate-200 sticky left-[160px] bg-inherit z-10">
                          <span className="font-medium">{row.descripcion}</span>
                          <span className="ml-1 text-slate-400">{row.codigo}</span>
                        </td>
                        {row.conteo.map((c, ci) => (
                          SEXOS.map((s) => (
                            <td key={`${ci}-${s}`} className="px-1 py-1 text-center border-r border-slate-100 tabular-nums">
                              {c[s] || <span className="text-slate-300">0</span>}
                            </td>
                          ))
                        ))}
                        {SEXOS.map((s) => (
                          <td key={`ign-${s}`} className="px-1 py-1 text-center border-r border-slate-100 tabular-nums">
                            {row.ignorados[s] || <span className="text-slate-300">0</span>}
                          </td>
                        ))}
                        {SEXOS.map((s) => (
                          <td key={`tot-${s}`} className="px-1 py-1 text-center font-semibold border-r border-slate-200 tabular-nums text-blue-700">
                            {row.total[s] || 0}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center font-bold text-blue-800 bg-blue-50/60 tabular-nums">
                          {totalGeneral}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Fila de totales */}
                  {totalesGenerales && (
                    <tr className="bg-slate-200/60 border-t-2 border-slate-400 font-bold">
                      <td colSpan={2} className="px-2 py-2 text-right text-slate-800 border-r border-slate-300 sticky left-0 bg-slate-200/60 z-10">
                        TOTAL GENERAL
                      </td>
                      {totalesGenerales.conteo.map((c, ci) => (
                        SEXOS.map((s) => (
                          <td key={`gt-${ci}-${s}`} className="px-1 py-1.5 text-center border-r border-slate-300 tabular-nums">
                            {c[s]}
                          </td>
                        ))
                      ))}
                      {SEXOS.map((s) => (
                        <td key={`gign-${s}`} className="px-1 py-1.5 text-center border-r border-slate-300 tabular-nums">
                          {totalesGenerales.ignorados[s]}
                        </td>
                      ))}
                      {SEXOS.map((s) => (
                        <td key={`gtot-${s}`} className="px-1 py-1.5 text-center text-blue-700 border-r border-slate-300 tabular-nums">
                          {totalesGenerales.total[s]}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center text-blue-800 bg-blue-100/60 tabular-nums">
                        {totalesGenerales.total.H + totalesGenerales.total.M + totalesGenerales.total.I}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabla de relación de pacientes */}
          {detallePacientes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Relación de pacientes</h3>
                <p className="text-xs text-slate-500">Listado detallado de pacientes con diagnóstico en el periodo.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {['#', 'Paciente', 'Sexo', 'Edad', 'Diagnóstico', 'Fecha', 'Médico'].map((h) => (
                        <th key={h} className="px-3 py-2 font-bold text-slate-600 border-b border-slate-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detallePacientes.map((p, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium text-slate-700">{p.paciente}</td>
                        <td className="px-3 py-1.5 text-slate-600">{p.sexo}</td>
                        <td className="px-3 py-1.5 text-slate-600">{p.edad}</td>
                        <td className="px-3 py-1.5 text-slate-700">{p.diagnostico}</td>
                        <td className="px-3 py-1.5 text-slate-600">{p.fecha}</td>
                        <td className="px-3 py-1.5 text-slate-600">{p.medico}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sin resultados */}
      {resultados && resultados.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <FileSpreadsheet size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No se encontraron diagnósticos CIE-10 en las consultas del periodo seleccionado.</p>
        </div>
      )}
    </div>
  );
};

export default ReporteSuive;
