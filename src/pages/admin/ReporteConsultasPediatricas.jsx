// src/pages/admin/ReporteConsultasPediatricas.jsx
// Consultas pediátricas — menores de 18 · export Excel

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, Timestamp, documentId, limit, startAfter,
} from 'firebase/firestore';
import {
  CalendarRange, CheckCircle2, ChevronLeft, Download, FileSpreadsheet,
  Loader2, Baby, UserRound, AlertTriangle, Eye, X, Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../config/firebase';

const FETCH_CONCURRENCY = 8;
const HISTORIAL_PAGE = 150;

const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const parseFechaDoc = (v) => {
  if (!v) return null;
  if (v?.toDate) {
    const d = v.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatearEdad = (fechaNacimiento, fechaConsulta) => {
  if (!fechaNacimiento) return '';
  const nac = new Date(fechaNacimiento);
  const ref = fechaConsulta instanceof Date ? fechaConsulta : new Date();
  if (Number.isNaN(nac.getTime()) || Number.isNaN(ref.getTime()) || nac > ref) return '';

  let años = ref.getFullYear() - nac.getFullYear();
  let meses = ref.getMonth() - nac.getMonth();
  let días = ref.getDate() - nac.getDate();
  if (días < 0) {
    meses -= 1;
    const prev = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
    días += prev;
  }
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }

  if (años <= 0 && meses <= 0) {
    const totalDias = Math.max(0, Math.floor((ref - nac) / 86400000));
    if (totalDias === 1) return '1 día';
    return `${totalDias} días`;
  }
  if (años <= 0) {
    const mLabel = meses === 1 ? '1 mes' : `${meses} meses`;
    if (días <= 0) return mLabel;
    const dLabel = días === 1 ? '1 día' : `${días} días`;
    return `${mLabel} ${dLabel}`;
  }
  const aLabel = años === 1 ? '1 año' : `${años} años`;
  if (meses <= 0) return aLabel;
  const mLabel = meses === 1 ? '1 mes' : `${meses} meses`;
  return `${aLabel} ${mLabel}`;
};

/** Años cumplidos a la fecha de consulta (para filtro < 18). */
const edadEnAnios = (fechaNacimiento, fechaConsulta) => {
  if (!fechaNacimiento) return -1;
  const nac = new Date(fechaNacimiento);
  const ref = fechaConsulta instanceof Date ? fechaConsulta : new Date();
  if (Number.isNaN(nac.getTime()) || Number.isNaN(ref.getTime()) || nac > ref) return -1;
  let años = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) años -= 1;
  return Math.max(0, años);
};

const formatFechaNac = (v) => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const formatFechaCsv = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

const normalizeSexoHM = (sexo) => {
  const s = String(sexo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (s === 'masculino' || s === 'hombre' || s === 'h' || s === 'male' || s.startsWith('masc') || s.startsWith('hom')) return 'H';
  if (s === 'femenino' || s === 'mujer' || s === 'f' || s === 'm' || s === 'female' || s.startsWith('fem') || s.startsWith('muj')) return 'M';
  return '';
};

const normalizeTipoConsulta = (raw) => {
  const s = String(raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!s) return '';
  if (s.includes('primera')) return 'Primera vez';
  if (s.includes('subsec')) return 'Subsecuente';
  if (s.includes('urgenc')) return 'Urgencia';
  if (s.includes('control')) return 'Control';
  return String(raw).trim();
};

const chunkArray = (arr, size = 30) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function mapPool(items, limitN, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limitN, items.length) || 0 }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const slimHistorial = (id, data) => {
  const diag = data.consulta?.diagnostico || {};
  const px = data.px_info || {};
  return {
    id,
    fecha: data.fecha,
    pacienteId: data.pacienteId || null,
    pacienteNombre: data.pacienteNombre || '',
    medicoId: data.medicoId || null,
    citaId: data.citaId || null,
    consultorioId: data.consultorioId || null,
    consultorioNombre: data.consultorioNombre || '',
    tipoNota: data.tipoNota || '',
    px_info: {
      edad: px.edad || '',
      fecha_nacimiento: px.fecha_nacimiento || '',
      telefono: px.telefono || '',
    },
    consulta: {
      padecimiento: data.consulta?.padecimiento || '',
      diagnostico: {
        enfermedad_actual: diag.enfermedad_actual || '',
        cie10: Array.isArray(diag.cie10) ? diag.cie10 : [],
        tratamiento_lista: Array.isArray(diag.tratamiento_lista) ? diag.tratamiento_lista : [],
      },
    },
  };
};

const esConsultaClinica = (h) => {
  const tipo = String(h.tipoNota || '').toLowerCase();
  if (tipo.includes('receta') && !h.consulta?.diagnostico?.enfermedad_actual) return false;
  if (tipo.includes('documento') && !h.consulta?.diagnostico?.enfermedad_actual) return false;
  const diag = h.consulta?.diagnostico || {};
  const tieneDiag = Boolean(String(diag.enfermedad_actual || '').trim())
    || (Array.isArray(diag.cie10) && diag.cie10.length > 0);
  const tieneTx = Array.isArray(diag.tratamiento_lista) && diag.tratamiento_lista.length > 0;
  const tienePadecimiento = Boolean(String(h.consulta?.padecimiento || '').trim());
  return tieneDiag || tieneTx || tienePadecimiento;
};

/** Diagnóstico CIE-10. */
const formatCie10 = (h) => {
  const cie = Array.isArray(h.consulta?.diagnostico?.cie10) ? h.consulta.diagnostico.cie10 : [];
  if (cie.length > 0) {
    return cie.map((item) => {
      const codigo = String(item.codigo || item.code || '').trim().toUpperCase();
      const desc = String(item.descripcion || item.description || '').trim();
      if (codigo && desc) return `${codigo} - ${desc}`;
      if (codigo) return codigo;
      return desc || null;
    }).filter(Boolean).join('; ');
  }
  const texto = String(h.consulta?.diagnostico?.enfermedad_actual || '').trim();
  if (!texto) return '';
  const matches = texto.match(/([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*[-–—]?\s*([^•,;\n]*)/gi);
  if (!matches) return '';
  return matches.map((m) => {
    const parts = m.match(/^([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*[-–—]?\s*(.*)/i);
    if (!parts) return null;
    const codigo = parts[1].toUpperCase();
    const desc = (parts[2] || '').trim();
    return desc ? `${codigo} - ${desc}` : codigo;
  }).filter(Boolean).join('; ');
};

/**
 * Diagnóstico escrito: texto libre real (no basura ni solo códigos CIE).
 */
const formatDiagEscrito = (h) => {
  const raw = String(h.consulta?.diagnostico?.enfermedad_actual || '').trim();
  if (!raw) return '';
  const sinCie = raw
    .replace(/[•]\s*/g, ' ')
    .replace(/[A-Z]\d{2,3}(?:\.\d{1,2})?\s*[-–—]?\s*[^•,;\n]*/gi, ' ')
    .replace(/[-–—,;|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (sinCie.length < 3) return '';
  // Evitar restos tipo "RIN" de 1-2 letras sueltas sin sentido clínico
  if (sinCie.length <= 3 && !/\s/.test(sinCie)) return '';
  return sinCie;
};

/** Separa receta SRS en Medicamentos / Grupo / Tratamiento. */
const formatRecetaCols = (h) => {
  const lista = h.consulta?.diagnostico?.tratamiento_lista;
  if (!Array.isArray(lista) || lista.length === 0) {
    return { medicamentos: '', grupo: '', tratamiento: '' };
  }

  const meds = [];
  const grupos = [];
  const txs = [];

  lista.forEach((m, idx) => {
    const nombre = String(m?.nombre || '').trim();
    if (!nombre) return;
    const sustancias = String(m?.sustanciasActivas || '').trim();
    const presentacion = String(m?.presentacion || '').trim();
    const dosis = String(m?.dosis || '').trim();
    const grupo = String(m?.grupo || m?.marca || '').trim();

    let medLabel = nombre;
    if (sustancias) {
      const nomL = nombre.toLowerCase();
      const ya = sustancias.split(/[,;/]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 2)
        .some((s) => nomL.includes(s));
      if (!ya) medLabel = `${nombre} / ${sustancias}`;
    }

    const n = idx + 1;
    meds.push(`${n}.- ${medLabel}`);
    if (grupo) grupos.push(`${n}.- ${grupo}`);
    const tx = [presentacion, dosis].filter(Boolean).join(' — ');
    if (tx) txs.push(`${n}.- ${tx}`);
  });

  return {
    medicamentos: meds.join('   '),
    grupo: grupos.join('   '),
    tratamiento: txs.join('   '),
  };
};

const EXPORT_COLS = [
  { key: 'num', label: '#' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'identificador', label: 'Identificador' },
  { key: 'nombrePaciente', label: 'Nombre del paciente' },
  { key: 'fechaNacimiento', label: 'Fecha de nacimiento' },
  { key: 'edad', label: 'Edad' },
  { key: 'sexo', label: 'Sexo' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'correo', label: 'Correo electrónico' },
  { key: 'codigoPostal', label: 'Código postal' },
  { key: 'tipoConsulta', label: 'Tipo de consulta' },
  { key: 'consultorio', label: 'Consultorio' },
  { key: 'diagEscrito', label: 'Diagnóstico escrito' },
  { key: 'diagCie10', label: 'Diagnóstico CIE-10' },
  { key: 'medicamentos', label: 'Medicamentos' },
  { key: 'grupo', label: 'Grupo' },
  { key: 'tratamiento', label: 'Tratamiento' },
];

const downloadXLSX = (rows, filename, rangoLabel) => {
  const title = ['Consultas pediátricas', '', '', rangoLabel];
  const blank = [];
  const aoa = [
    title,
    blank,
    EXPORT_COLS.map((c) => c.label),
    ...rows.map((r) => EXPORT_COLS.map((c) => (r[c.key] == null ? '' : String(r[c.key])))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 5 }, { wch: 18 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 16 },
    { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 24 },
    { wch: 24 }, { wch: 40 }, { wch: 36 }, { wch: 18 }, { wch: 36 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consultas pediátricas');
  XLSX.writeFile(wb, filename);
};

const STYLES = `
  .rcp { font-family: 'DM Sans', system-ui, sans-serif; }
  .rcp-steps { display: flex; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .rcp-step { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
  .rcp-step:last-child { border-bottom: 0; }
  .rcp-step.dim { opacity: .45; pointer-events: none; }
  .rcp-step-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .rcp-badge { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .rcp-badge.done, .rcp-badge.active { background: #0077B6; color: #fff; }
  .rcp-badge.todo { background: #e2e8f0; color: #64748b; }
  .rcp-step-title { font-size: .82rem; font-weight: 650; color: #0f172a; margin: 0; }
  .rcp-step-sub { font-size: .68rem; color: #64748b; margin: 2px 0 0; }
  .rcp-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; max-width: 640px; }
  .rcp-label { display: flex; flex-direction: column; gap: 4px; font-size: .68rem; font-weight: 600; color: #64748b; }
  .rcp-input, .rcp-select { height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: .8rem; color: #0f172a; background: #f8fafc; font-family: inherit; outline: none; }
  .rcp-input:focus, .rcp-select:focus { border-color: #0077B6; background: #fff; box-shadow: 0 0 0 3px rgba(0,119,182,.12); }
  .rcp-radios { display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
  .rcp-radio { display: flex; align-items: flex-start; gap: 8px; font-size: .78rem; color: #334155; cursor: pointer; }
  .rcp-radio input { accent-color: #0077B6; margin-top: 3px; }
  .rcp-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .rcp-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0; font-size: .74rem; font-weight: 650; cursor: pointer; font-family: inherit; }
  .rcp-btn-primary { background: #0077B6; color: #fff; }
  .rcp-btn-primary:hover { background: #023e8a; }
  .rcp-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
  .rcp-btn-ghost { background: transparent; color: #64748b; }
  .rcp-btn-ghost:hover { color: #0f172a; background: #f1f5f9; }
  .rcp-btn-ok { background: #0f766e; color: #fff; }
  .rcp-btn-ok:hover { background: #0d9488; }
  .rcp-btn-ok:disabled { opacity: .55; cursor: not-allowed; }
  .rcp-error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: .72rem; margin-top: 12px; }
  .rcp-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .rcp-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .rcp-kpi b { display: block; font-size: 1.05rem; color: #0f172a; font-family: 'Sora', sans-serif; }
  .rcp-kpi span { font-size: .65rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
  .rcp-success-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; }
  .rcp-success-bar strong { font-size: .82rem; color: #14532d; }
  .rcp-success-bar p { margin: 2px 0 0; font-size: .7rem; color: #166534; }
  .rcp-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .rcp-modal { width: min(960px, 100%); max-height: min(88vh, 900px); background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(15,23,42,.25); display: flex; flex-direction: column; overflow: hidden; }
  .rcp-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
  .rcp-modal-hd h2 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1rem; color: #0f172a; }
  .rcp-modal-hd p { margin: 3px 0 0; font-size: .7rem; color: #64748b; }
  .rcp-modal-x { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #f1f5f9; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .rcp-modal-body { padding: 16px 18px; overflow: auto; flex: 1; }
  .rcp-modal-ft { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
  .rcp-section { margin-bottom: 14px; }
  .rcp-section-label { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin: 0 0 8px; }
  .rcp-notes { display: flex; flex-direction: column; gap: 6px; }
  .rcp-note { display: flex; gap: 8px; align-items: flex-start; padding: 9px 11px; border-radius: 8px; font-size: .72rem; line-height: 1.35; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .rcp-table-wrap { overflow: auto; max-height: 320px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .rcp-table { width: 100%; border-collapse: collapse; font-size: .68rem; }
  .rcp-table th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: 7px 8px; color: #475569; font-weight: 700; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
  .rcp-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; max-width: 180px; }
  .rcp-muted { color: #94a3b8; }
  .rcp-spin { animation: rcpSpin .8s linear infinite; }
  @keyframes rcpSpin { to { transform: rotate(360deg); } }
`;

const FILTRO_CONSULTAS = [
  { id: 'todas', label: 'Todas las consultas' },
  { id: 'primera', label: 'Primera vez' },
  { id: 'subsecuente', label: 'Subsecuente' },
];

const VISTA_INFO = [
  { id: 'grupo', label: 'Grupo', desc: 'Todas las unidades / médicos del periodo' },
  { id: 'unidad', label: 'Unidad médica', desc: 'Filtrar por consultorio' },
  { id: 'medico', label: 'Médico', desc: 'Filtrar por médico' },
];

const ReporteConsultasPediatricas = () => {
  const hoy = useMemo(() => new Date(), []);
  const primerDiaMes = useMemo(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1), [hoy]);

  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [filtroConsultas, setFiltroConsultas] = useState('todas');
  const [vista, setVista] = useState('grupo');
  const [consultorioId, setConsultorioId] = useState('all');
  const [medicoId, setMedicoId] = useState('all');

  const [medicos, setMedicos] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [advertencias, setAdvertencias] = useState([]);
  const [filas, setFilas] = useState([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [genMeta, setGenMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      try {
        const [snapUsers, snapCon] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('rol', 'in', ['medico', 'doctor']))).catch(() => getDocs(collection(db, 'users'))),
          getDocs(query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc'))).catch(() => getDocs(collection(db, 'catalogo_consultorios'))),
        ]);
        if (cancelled) return;
        const meds = snapUsers.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => {
            const rol = String(u.rol || '').toLowerCase();
            return rol === 'medico' || rol === 'doctor' || rol.includes('medico');
          })
          .map((u) => ({ id: u.id, nombre: u.nombre || u.displayName || u.email || u.id }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        const cons = snapCon.docs
          .map((d) => ({ id: d.id, nombre: d.data().nombre || d.id, ...d.data() }))
          .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
        setMedicos(meds);
        setConsultorios(cons);
      } catch (err) {
        console.warn('[ReportePed]', err);
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const vistaLabel = useMemo(() => {
    if (vista === 'grupo') return 'Grupo';
    if (vista === 'unidad') {
      if (consultorioId === 'all') return 'Unidad médica (todas)';
      return consultorios.find((c) => c.id === consultorioId)?.nombre || consultorioId;
    }
    if (medicoId === 'all') return 'Médico (todos)';
    return medicos.find((m) => m.id === medicoId)?.nombre || medicoId;
  }, [vista, consultorioId, medicoId, consultorios, medicos]);

  const generar = useCallback(async () => {
    setLoading(true);
    setError('');
    setAdvertencias([]);
    setFilas([]);
    setGenMeta(null);
    setShowResultModal(false);
    setProgress('Preparando…');
    const t0 = performance.now();

    try {
      const inicio = new Date(`${fechaInicio}T00:00:00`);
      const fin = new Date(`${fechaFin}T23:59:59`);
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || inicio > fin) {
        setError('Rango de fechas inválido.');
        return;
      }

      const tsInicio = Timestamp.fromDate(inicio);
      const tsFin = Timestamp.fromDate(fin);
      const warns = [];
      const baseConstraints = [
        where('fecha', '>=', tsInicio),
        where('fecha', '<=', tsFin),
        orderBy('fecha', 'asc'),
      ];

      const serverMedico = vista === 'medico' && medicoId !== 'all';
      let usedMedicoServer = serverMedico;

      const buildPageQuery = (cursor, withMedico) => {
        const parts = [];
        if (withMedico) parts.push(where('medicoId', '==', medicoId));
        parts.push(...baseConstraints);
        if (cursor) parts.push(startAfter(cursor));
        parts.push(limit(HISTORIAL_PAGE));
        return query(collection(db, 'historial_clinico'), ...parts);
      };

      const fetchAllPages = async (withMedico) => {
        const acc = [];
        let cur = null;
        let p = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          p += 1;
          setProgress(`Historial… lote ${p} (${acc.length})`);
          const snap = await getDocs(buildPageQuery(cur, withMedico));
          if (snap.empty) break;
          for (const d of snap.docs) acc.push(slimHistorial(d.id, d.data()));
          cur = snap.docs[snap.docs.length - 1];
          if (snap.size < HISTORIAL_PAGE) break;
        }
        return acc;
      };

      let historiales;
      try {
        historiales = await fetchAllPages(usedMedicoServer);
      } catch (idxErr) {
        if (usedMedicoServer) {
          usedMedicoServer = false;
          historiales = await fetchAllPages(false);
        } else throw idxErr;
      }

      if (serverMedico && !usedMedicoServer) {
        historiales = historiales.filter((h) => h.medicoId === medicoId);
      }

      const totalBruto = historiales.length;
      historiales = historiales.filter(esConsultaClinica);

      // Pacientes + citas
      const pacienteIds = [...new Set(historiales.map((h) => h.pacienteId).filter(Boolean))];
      const citaIds = [...new Set(historiales.map((h) => h.citaId).filter(Boolean))];
      const pacientesMap = new Map();
      const citasMap = new Map();
      setProgress(`Enriqueciendo ${pacienteIds.length} pacientes…`);

      await Promise.all([
        mapPool(chunkArray(pacienteIds, 30), FETCH_CONCURRENCY, async (chunk) => {
          const snap = await getDocs(query(collection(db, 'pacientes'), where(documentId(), 'in', chunk)));
          snap.forEach((d) => {
            const data = d.data() || {};
            pacientesMap.set(d.id, {
              idPaciente: data.idPaciente || data.idPacienteMigrado || data.legacyPatientId || '',
              nombreCompleto: data.nombreCompleto || [data.nombre, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' '),
              sexo: data.sexo || '',
              fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || '',
              telefono: data.telefonoMovil || data.telefono || data.telefonoFijo || '',
              email: data.email || data.correo || '',
              cp: data.cp || data.codigoPostal || data.codigo_postal || '',
            });
          });
        }),
        mapPool(chunkArray(citaIds, 30), FETCH_CONCURRENCY, async (chunk) => {
          const snap = await getDocs(query(collection(db, 'citas'), where(documentId(), 'in', chunk)));
          snap.forEach((d) => {
            const data = d.data() || {};
            citasMap.set(d.id, {
              tipoConsulta: data.tipoConsulta || data.tipo_consulta || '',
              consultorioId: data.consultorioId || null,
              consultorioNombre: data.consultorioNombre || data.consultorio || '',
            });
          });
        }),
      ]);

      setProgress('Filtrando menores de edad…');
      const rows = [];
      let sinFn = 0;
      let excluidosAdultos = 0;

      for (const h of historiales) {
        const fechaConsulta = parseFechaDoc(h.fecha) || new Date();
        const px = pacientesMap.get(h.pacienteId) || {};
        const cita = h.citaId ? (citasMap.get(h.citaId) || {}) : {};

        const fechaNac = px.fechaNacimiento || h.px_info?.fecha_nacimiento || '';
        const anios = edadEnAnios(fechaNac, fechaConsulta);
        if (!fechaNac || anios < 0) {
          sinFn += 1;
          continue;
        }
        if (anios >= 18) {
          excluidosAdultos += 1;
          continue;
        }

        // Unidad médica
        if (vista === 'unidad' && consultorioId !== 'all') {
          const cId = h.consultorioId || cita.consultorioId;
          const cNom = (h.consultorioNombre || cita.consultorioNombre || '').toLowerCase();
          const sel = consultorios.find((c) => c.id === consultorioId);
          const matchId = cId === consultorioId;
          const matchNom = sel && cNom && cNom === String(sel.nombre || '').toLowerCase();
          if (!matchId && !matchNom) continue;
        }

        let tipoConsulta = normalizeTipoConsulta(cita.tipoConsulta);
        if (!tipoConsulta) {
          const fromNota = normalizeTipoConsulta(h.tipoNota);
          if (['Primera vez', 'Subsecuente', 'Urgencia', 'Control'].includes(fromNota)) {
            tipoConsulta = fromNota;
          }
        }

        if (filtroConsultas === 'primera' && !tipoConsulta.toLowerCase().includes('primera')) continue;
        if (filtroConsultas === 'subsecuente' && !tipoConsulta.toLowerCase().includes('subsecuente')) continue;

        const receta = formatRecetaCols(h);
        rows.push({
          num: 0,
          fecha: formatFechaCsv(fechaConsulta),
          identificador: String(px.idPaciente || '').trim(),
          nombrePaciente: h.pacienteNombre || px.nombreCompleto || '',
          fechaNacimiento: formatFechaNac(fechaNac),
          edad: formatearEdad(fechaNac, fechaConsulta),
          sexo: normalizeSexoHM(px.sexo),
          telefono: String(px.telefono || h.px_info?.telefono || '').trim(),
          correo: String(px.email || '').trim(),
          codigoPostal: String(px.cp || '').trim(),
          tipoConsulta,
          consultorio: h.consultorioNombre || cita.consultorioNombre || '',
          diagEscrito: formatDiagEscrito(h),
          diagCie10: formatCie10(h),
          medicamentos: receta.medicamentos,
          grupo: receta.grupo,
          tratamiento: receta.tratamiento,
          _sort: fechaConsulta.getTime(),
        });
      }

      rows.sort((a, b) => a._sort - b._sort);
      rows.forEach((r, i) => { r.num = i + 1; });

      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (excluidosAdultos > 0) {
        warns.push(`${excluidosAdultos} consultas de adultos omitidas (solo menores de 18).`);
      }
      if (sinFn > 0) {
        warns.push(`${sinFn} consultas sin fecha de nacimiento omitidas (no se puede validar edad).`);
      }
      if (totalBruto > 0 && rows.length === 0) {
        warns.push('No hubo consultas pediátricas con los filtros actuales.');
      }

      setFilas(rows);
      setAdvertencias(warns);
      setGenMeta({ secs, pacientes: pacienteIds.length, totalBruto });
      setStep(4);
      setShowResultModal(true);
      setProgress('');
    } catch (err) {
      console.error('[ReportePed]', err);
      setError(`Error al generar el reporte: ${err.message || err}`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, filtroConsultas, vista, consultorioId, medicoId, consultorios]);

  const exportar = () => {
    if (!filas.length) return;
    downloadXLSX(
      filas,
      `Consultas-pediatricas_${fechaInicio}-${fechaFin}.xlsx`,
      `${fechaInicio} - ${fechaFin}`,
    );
  };

  const kpis = useMemo(() => ({
    total: filas.length,
    conCie: filas.filter((r) => r.diagCie10).length,
    conMed: filas.filter((r) => r.medicamentos).length,
    conTel: filas.filter((r) => r.telefono).length,
  }), [filas]);

  const preview = filas.slice(0, 50);
  const previewCols = EXPORT_COLS.filter((c) => !['correo', 'codigoPostal'].includes(c.key));

  return (
    <div className="rcp">
      <style>{STYLES}</style>

      <div className="rcp-steps">
        {/* 1 fechas */}
        <div className={`rcp-step ${step < 1 ? 'dim' : ''}`}>
          <div className="rcp-step-hd">
            <div className={`rcp-badge ${step > 1 ? 'done' : 'active'}`}>{step > 1 ? <CheckCircle2 size={14} /> : '1'}</div>
            <div>
              <p className="rcp-step-title">Elige un rango de fechas</p>
              <p className="rcp-step-sub">Únicamente menores de edad</p>
            </div>
          </div>
          {step === 1 && (
            <>
              <div className="rcp-fields">
                <label className="rcp-label">Desde
                  <input type="date" className="rcp-input" value={fechaInicio} onChange={(e) => e.target.value && setFechaInicio(e.target.value)} />
                </label>
                <label className="rcp-label">Hasta
                  <input type="date" className="rcp-input" value={fechaFin} max={toDateInput(hoy)} onChange={(e) => e.target.value && setFechaFin(e.target.value)} />
                </label>
              </div>
              <div className="rcp-actions">
                <button type="button" className="rcp-btn rcp-btn-primary" onClick={() => setStep(2)}>
                  Continuar <CalendarRange size={14} />
                </button>
              </div>
            </>
          )}
          {step > 1 && <p className="rcp-step-sub">{fechaInicio} → {fechaFin}</p>}
        </div>

        {/* 2 qué consultas */}
        <div className={`rcp-step ${step < 2 ? 'dim' : ''}`}>
          <div className="rcp-step-hd">
            <div className={`rcp-badge ${step > 2 ? 'done' : step === 2 ? 'active' : 'todo'}`}>{step > 2 ? <CheckCircle2 size={14} /> : '2'}</div>
            <div>
              <p className="rcp-step-title">¿Qué consultas deseas ver?</p>
              <p className="rcp-step-sub">*Únicamente menores de edad</p>
            </div>
          </div>
          {step === 2 && (
            <>
              <label className="rcp-label" style={{ maxWidth: 320 }}>
                Consultas
                <select className="rcp-select" value={filtroConsultas} onChange={(e) => setFiltroConsultas(e.target.value)}>
                  {FILTRO_CONSULTAS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </label>
              <div className="rcp-actions">
                <button type="button" className="rcp-btn rcp-btn-ghost" onClick={() => setStep(1)}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="rcp-btn rcp-btn-primary" onClick={() => setStep(3)}>Continuar</button>
              </div>
            </>
          )}
          {step > 2 && (
            <p className="rcp-step-sub">{FILTRO_CONSULTAS.find((f) => f.id === filtroConsultas)?.label}</p>
          )}
        </div>

        {/* 3 cómo consultar */}
        <div className={`rcp-step ${step < 3 ? 'dim' : ''}`}>
          <div className="rcp-step-hd">
            <div className={`rcp-badge ${step > 3 ? 'done' : step === 3 ? 'active' : 'todo'}`}>{step > 3 ? <CheckCircle2 size={14} /> : '3'}</div>
            <div>
              <p className="rcp-step-title">¿Cómo quieres consultar la información?</p>
              <p className="rcp-step-sub">Grupo · Unidad médica · Médico</p>
            </div>
          </div>
          {step === 3 && (
            <>
              <div className="rcp-radios">
                {VISTA_INFO.map((v) => (
                  <label key={v.id} className="rcp-radio">
                    <input type="radio" name="vistaPed" checked={vista === v.id} onChange={() => setVista(v.id)} />
                    <span>
                      <strong>{v.label}</strong>
                      <span className="rcp-step-sub" style={{ display: 'block' }}>{v.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              {vista === 'unidad' && (
                <label className="rcp-label" style={{ maxWidth: 360, marginTop: 10 }}>
                  Consultorio
                  <select className="rcp-select" value={consultorioId} onChange={(e) => setConsultorioId(e.target.value)} disabled={loadingCats}>
                    <option value="all">Todos</option>
                    {consultorios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
              )}
              {vista === 'medico' && (
                <label className="rcp-label" style={{ maxWidth: 360, marginTop: 10 }}>
                  Médico
                  <select className="rcp-select" value={medicoId} onChange={(e) => setMedicoId(e.target.value)} disabled={loadingCats}>
                    <option value="all">Todos</option>
                    {medicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </label>
              )}
              <div className="rcp-actions">
                <button type="button" className="rcp-btn rcp-btn-ghost" onClick={() => setStep(2)}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="rcp-btn rcp-btn-primary" onClick={() => setStep(4)}>
                  Continuar {vista === 'unidad' ? <Building2 size={14} /> : <UserRound size={14} />}
                </button>
              </div>
            </>
          )}
          {step > 3 && <p className="rcp-step-sub">{vistaLabel}</p>}
        </div>

        {/* 4 generar / resultado */}
        <div className={`rcp-step ${step < 4 ? 'dim' : ''}`}>
          <div className="rcp-step-hd">
            <div className={`rcp-badge ${genMeta ? 'done' : step === 4 ? 'active' : 'todo'}`}>
              {genMeta ? <CheckCircle2 size={14} /> : '4'}
            </div>
            <div>
              <p className="rcp-step-title">Generar y exportar</p>
              <p className="rcp-step-sub">Genera el listado y descarga el Excel</p>
            </div>
          </div>
          {step === 4 && !genMeta && (
            <>
              <div className="rcp-fields">
                <div className="rcp-kpi"><span>Periodo</span><b style={{ fontSize: '.85rem' }}>{fechaInicio} → {fechaFin}</b></div>
                <div className="rcp-kpi"><span>Vista</span><b style={{ fontSize: '.85rem' }}>{vistaLabel}</b></div>
                <div className="rcp-kpi"><span>Consultas</span><b style={{ fontSize: '.85rem' }}>{FILTRO_CONSULTAS.find((f) => f.id === filtroConsultas)?.label}</b></div>
              </div>
              <div className="rcp-actions">
                <button type="button" className="rcp-btn rcp-btn-ghost" onClick={() => setStep(3)} disabled={loading}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="rcp-btn rcp-btn-primary" onClick={generar} disabled={loading}>
                  {loading ? <><Loader2 size={14} className="rcp-spin" /> Generando…</> : <><Baby size={14} /> Generar reporte</>}
                </button>
              </div>
              {loading && progress && <p className="rcp-step-sub" style={{ marginTop: 10 }}>{progress}</p>}
              {error && <div className="rcp-error"><AlertTriangle size={14} /> {error}</div>}
            </>
          )}
          {step === 4 && genMeta && (
            <div className="rcp-success-bar">
              <div>
                <strong>{kpis.total.toLocaleString('es-MX')} consultas pediátricas</strong>
                <p>{fechaInicio} → {fechaFin} · {genMeta.secs}s</p>
              </div>
              <div className="rcp-actions" style={{ marginTop: 0 }}>
                <button type="button" className="rcp-btn rcp-btn-ghost" onClick={() => { setFilas([]); setAdvertencias([]); setGenMeta(null); setShowResultModal(false); }}>
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="rcp-btn rcp-btn-primary" onClick={() => setShowResultModal(true)}>
                  <Eye size={14} /> Ver resultados
                </button>
                <button type="button" className="rcp-btn rcp-btn-ok" onClick={exportar} disabled={!filas.length}>
                  <Download size={14} /> Exportar Excel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="rcp-step-sub" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <FileSpreadsheet size={13} /> Exportación en Excel (.xlsx)
      </p>

      {showResultModal && (
        <div className="rcp-modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowResultModal(false); }}>
          <div className="rcp-modal" role="dialog" aria-modal="true">
            <div className="rcp-modal-hd">
              <div>
                <h2>Consultas pediátricas</h2>
                <p>
                  {fechaInicio} → {fechaFin} · {vistaLabel}
                  {genMeta ? ` · ${genMeta.secs}s` : ''}
                </p>
              </div>
              <button type="button" className="rcp-modal-x" onClick={() => setShowResultModal(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className="rcp-modal-body">
              <div className="rcp-section">
                <p className="rcp-section-label">Resumen</p>
                <div className="rcp-kpis">
                  <div className="rcp-kpi"><span>Consultas</span><b>{kpis.total.toLocaleString('es-MX')}</b></div>
                  <div className="rcp-kpi"><span>Con CIE-10</span><b>{kpis.conCie.toLocaleString('es-MX')}</b></div>
                  <div className="rcp-kpi"><span>Con tratamiento</span><b>{kpis.conMed.toLocaleString('es-MX')}</b></div>
                  <div className="rcp-kpi"><span>Con teléfono</span><b>{kpis.conTel.toLocaleString('es-MX')}</b></div>
                </div>
              </div>
              {advertencias.length > 0 && (
                <div className="rcp-section">
                  <p className="rcp-section-label">Avisos</p>
                  <div className="rcp-notes">
                    {advertencias.map((w) => (
                      <div key={w} className="rcp-note"><AlertTriangle size={14} /><span>{w}</span></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rcp-section" style={{ marginBottom: 0 }}>
                <p className="rcp-section-label">Vista previa</p>
                <div className="rcp-table-wrap">
                  <table className="rcp-table">
                    <thead>
                      <tr>{previewCols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((r) => (
                        <tr key={r.num}>
                          {previewCols.map((c) => (
                            <td key={c.key}>{r[c.key] || <span className="rcp-muted">—</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="rcp-modal-ft">
              <button type="button" className="rcp-btn rcp-btn-ghost" onClick={() => setShowResultModal(false)}>Cerrar</button>
              <button type="button" className="rcp-btn rcp-btn-ghost" onClick={generar} disabled={loading}>
                {loading ? <Loader2 size={14} className="rcp-spin" /> : <Eye size={14} />} Regenerar
              </button>
              <button type="button" className="rcp-btn rcp-btn-ok" onClick={exportar}>
                <Download size={14} /> Exportar Excel ({kpis.total.toLocaleString('es-MX')})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReporteConsultasPediatricas;
