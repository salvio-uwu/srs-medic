// src/pages/admin/ReporteConsultas.jsx
// Reporte de Consultas — wizard + Excel

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, Timestamp, documentId, limit, startAfter,
} from 'firebase/firestore';
import {
  CalendarRange, CheckCircle2, ChevronLeft, Download, FileSpreadsheet,
  Loader2, Stethoscope, UserRound, AlertTriangle, Eye, X, Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../config/firebase';

/** Concurrencia de lecturas Firestore (evita saturar la red / cuotas). */
const FETCH_CONCURRENCY = 8;
/** Tamaño de página al leer historial (docs muy pesados: expediente completo). */
const HISTORIAL_PAGE = 150;

/* ─── Helpers ─── */

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

/** Edad legible: "76 años 1 mes" / "22 días" / "11 meses 6 días" */
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

/** Ejecuta promesas en lotes paralelos (máx. `limit` a la vez). */
async function mapPool(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) || 0 }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Solo campos necesarios del historial (el doc completo es enorme). */
const slimHistorial = (id, data) => {
  const diag = data.consulta?.diagnostico || {};
  const estudios = data.consulta?.estudios;
  const px = data.px_info || {};
  return {
    id,
    fecha: data.fecha,
    pacienteId: data.pacienteId || null,
    pacienteNombre: data.pacienteNombre || '',
    medicoId: data.medicoId || null,
    medicoNombre: data.medicoNombre || data.medicoPerfil?.nombre || '',
    citaId: data.citaId || null,
    consultorioNombre: data.consultorioNombre || '',
    tipoNota: data.tipoNota || '',
    meta: data.meta ? { segunda_opinion: data.meta.segunda_opinion } : {},
    segundaOpinion: data.segundaOpinion,
    px_info: {
      edad: px.edad || '',
      fecha_nacimiento: px.fecha_nacimiento || '',
      id_receta: px.id_receta || '',
    },
    consulta: {
      padecimiento: data.consulta?.padecimiento || '',
      diagnostico: {
        enfermedad_actual: diag.enfermedad_actual || '',
        cie10: Array.isArray(diag.cie10) ? diag.cie10 : [],
        tratamiento_lista: Array.isArray(diag.tratamiento_lista) ? diag.tratamiento_lista : [],
      },
      estudios: typeof estudios === 'string'
        ? estudios
        : estudios
          ? {
            estudios_seleccionados: estudios.estudios_seleccionados || [],
            paquetes_seleccionados: estudios.paquetes_seleccionados || [],
            notas_generales: estudios.notas_generales || '',
          }
          : null,
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
  const estudios = h.consulta?.estudios;
  const tieneEstudios = typeof estudios === 'string'
    ? Boolean(estudios.trim())
    : (Array.isArray(estudios?.estudios_seleccionados) && estudios.estudios_seleccionados.length > 0)
      || (Array.isArray(estudios?.paquetes_seleccionados) && estudios.paquetes_seleccionados.length > 0);
  const tienePadecimiento = Boolean(String(h.consulta?.padecimiento || '').trim());

  return tieneDiag || tieneTx || tieneEstudios || tienePadecimiento;
};

const formatDiagnostico = (h) => {
  const diag = h.consulta?.diagnostico || {};
  const cie = Array.isArray(diag.cie10) ? diag.cie10 : [];
  if (cie.length > 0) {
    return cie.map((item) => {
      const codigo = String(item.codigo || item.code || '').trim().toUpperCase();
      const desc = String(item.descripcion || item.description || '').trim();
      if (codigo && desc) return `${codigo} - ${desc}`;
      if (codigo) return codigo;
      if (desc) return desc;
      return null;
    }).filter(Boolean).join('; ');
  }
  const texto = String(diag.enfermedad_actual || '').trim();
  if (!texto) return '';
  return texto.replace(/[•]\s*/g, '').replace(/\s+/g, ' ').trim();
};

const formatEstudios = (h) => {
  const estudios = h.consulta?.estudios;
  if (!estudios) return '';
  if (typeof estudios === 'string') {
    const t = estudios.trim();
    if (!t) return '';
    if (t.includes('•')) {
      return t.split('•').map((x) => x.trim()).filter(Boolean).join('; ');
    }
    return t.split(/[,;]+/).map((x) => x.trim()).filter(Boolean).join('; ');
  }
  const lista = [];
  for (const e of estudios.estudios_seleccionados || []) {
    if (typeof e === 'string') lista.push(e);
    else if (e?.nombre) lista.push(e.nombre);
  }
  for (const p of estudios.paquetes_seleccionados || []) {
    if (typeof p === 'string') lista.push(p);
    else if (p?.nombre) lista.push(p.nombre);
  }
  if (lista.length === 0 && estudios.notas_generales) {
    return String(estudios.notas_generales).trim().replace(/[•]\s*/g, '').replace(/\s+/g, ' ');
  }
  return lista.join('; ');
};

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

const formatFechaCsv = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

const EXPORT_COLS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'identificador', label: 'Identificador' },
  { key: 'nombrePaciente', label: 'Nombre del paciente' },
  { key: 'nombreMedico', label: 'Nombre del médico' },
  { key: 'edad', label: 'Edad' },
  { key: 'sexo', label: 'Sexo' },
  { key: 'tipoConsulta', label: 'Tipo de consulta' },
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'estudios', label: 'Estudios' },
  { key: 'medicamentos', label: 'Medicamentos' },
  { key: 'grupo', label: 'Grupo' },
  { key: 'tratamiento', label: 'Tratamiento' },
  { key: 'consultorio', label: 'Consultorio' },
  { key: 'segundaOpinion', label: 'Segunda opinión' },
];

const downloadXLSX = (rows, filename) => {
  const aoa = [
    EXPORT_COLS.map((c) => c.label),
    ...rows.map((r) => EXPORT_COLS.map((c) => {
      const v = r[c.key];
      return v == null ? '' : String(v);
    })),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 18 }, // Fecha
    { wch: 18 }, // Identificador
    { wch: 32 }, // Paciente
    { wch: 28 }, // Médico
    { wch: 18 }, // Edad
    { wch: 6 },  // Sexo
    { wch: 14 }, // Tipo
    { wch: 40 }, // Diagnóstico
    { wch: 36 }, // Estudios
    { wch: 36 }, // Medicamentos
    { wch: 18 }, // Grupo
    { wch: 36 }, // Tratamiento
    { wch: 24 }, // Consultorio
    { wch: 14 }, // Segunda opinión
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consultas');
  XLSX.writeFile(wb, filename);
};

const STYLES = `
  .rc { font-family: 'DM Sans', system-ui, sans-serif; }
  .rc-steps { display: flex; flex-direction: column; gap: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .rc-step { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
  .rc-step:last-child { border-bottom: 0; }
  .rc-step.dim { opacity: .45; pointer-events: none; }
  .rc-step-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .rc-badge { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .rc-badge.done { background: #0077B6; color: #fff; }
  .rc-badge.active { background: #0077B6; color: #fff; }
  .rc-badge.todo { background: #e2e8f0; color: #64748b; }
  .rc-step-title { font-size: .82rem; font-weight: 650; color: #0f172a; margin: 0; }
  .rc-step-sub { font-size: .68rem; color: #64748b; margin: 2px 0 0; }
  .rc-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; max-width: 640px; }
  .rc-label { display: flex; flex-direction: column; gap: 4px; font-size: .68rem; font-weight: 600; color: #64748b; }
  .rc-input, .rc-select { height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: .8rem; color: #0f172a; background: #f8fafc; font-family: inherit; outline: none; }
  .rc-input:focus, .rc-select:focus { border-color: #0077B6; background: #fff; box-shadow: 0 0 0 3px rgba(0,119,182,.12); }
  .rc-radios { display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
  .rc-radio { display: flex; align-items: center; gap: 8px; font-size: .78rem; color: #334155; cursor: pointer; }
  .rc-radio input { accent-color: #0077B6; }
  .rc-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .rc-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0; font-size: .74rem; font-weight: 650; cursor: pointer; font-family: inherit; }
  .rc-btn-primary { background: #0077B6; color: #fff; }
  .rc-btn-primary:hover { background: #023e8a; }
  .rc-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
  .rc-btn-ghost { background: transparent; color: #64748b; }
  .rc-btn-ghost:hover { color: #0f172a; background: #f1f5f9; }
  .rc-btn-ok { background: #0f766e; color: #fff; }
  .rc-btn-ok:hover { background: #0d9488; }
  .rc-btn-ok:disabled { opacity: .55; cursor: not-allowed; }
  .rc-error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: .72rem; margin-top: 12px; }
  .rc-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 14px 0; }
  .rc-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .rc-kpi b { display: block; font-size: 1.05rem; color: #0f172a; font-family: 'Sora', sans-serif; }
  .rc-kpi span { font-size: .65rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
  .rc-success-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; }
  .rc-success-bar strong { font-size: .82rem; color: #14532d; }
  .rc-success-bar p { margin: 2px 0 0; font-size: .7rem; color: #166534; }
  .rc-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .rc-modal { width: min(960px, 100%); max-height: min(88vh, 900px); background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(15,23,42,.25); display: flex; flex-direction: column; overflow: hidden; }
  .rc-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
  .rc-modal-hd h2 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1rem; color: #0f172a; }
  .rc-modal-hd p { margin: 3px 0 0; font-size: .7rem; color: #64748b; }
  .rc-modal-x { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #f1f5f9; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .rc-modal-x:hover { background: #e2e8f0; color: #0f172a; }
  .rc-modal-body { padding: 16px 18px; overflow: auto; flex: 1; }
  .rc-modal-ft { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
  .rc-section { margin-bottom: 14px; }
  .rc-section-label { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin: 0 0 8px; }
  .rc-notes { display: flex; flex-direction: column; gap: 6px; }
  .rc-note { display: flex; gap: 8px; align-items: flex-start; padding: 9px 11px; border-radius: 8px; font-size: .72rem; line-height: 1.35; }
  .rc-note.warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .rc-note.info { background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; }
  .rc-note svg { flex-shrink: 0; margin-top: 1px; }
  .rc-table-wrap { overflow: auto; max-height: 320px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .rc-table { width: 100%; border-collapse: collapse; font-size: .68rem; }
  .rc-table th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: 7px 8px; color: #475569; font-weight: 700; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
  .rc-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; max-width: 220px; }
  .rc-table tr:hover td { background: #f8fafc; }
  .rc-muted { color: #94a3b8; }
  @media (max-width: 640px) {
    .rc-step { padding: 12px; }
    .rc-table td { max-width: 140px; }
    .rc-modal { max-height: 92vh; }
    .rc-modal-ft { justify-content: stretch; }
    .rc-modal-ft .rc-btn { flex: 1; justify-content: center; }
  }
`;

const FILTRO_CONTENIDO = [
  { id: 'clinicas', label: 'Consultas clínicas (con diagnóstico, tratamiento, estudios o padecimiento)' },
  { id: 'con_diagnostico', label: 'Solo con diagnóstico registrado' },
  { id: 'todas', label: 'Todas las notas del periodo (incluye notas ligeras)' },
];

const FILTRO_TIPO = [
  { id: 'all', label: 'Todos los tipos' },
  { id: 'primera', label: 'Primera vez' },
  { id: 'subsecuente', label: 'Subsecuente' },
  { id: 'urgencia', label: 'Urgencia' },
];

const ReporteConsultas = () => {
  const hoy = useMemo(() => new Date(), []);
  const primerDiaMes = useMemo(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1), [hoy]);

  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [medicoId, setMedicoId] = useState('all');
  const [filtroContenido, setFiltroContenido] = useState('clinicas');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [medicos, setMedicos] = useState([]);
  const [loadingMedicos, setLoadingMedicos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [advertencias, setAdvertencias] = useState([]);
  const [notas, setNotas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [genMeta, setGenMeta] = useState(null); // { secs, pacientes, citas }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMedicos(true);
      try {
        // Query acotada por rol (mucho más liviana que todo `users`)
        let list = [];
        try {
          const qMed = query(collection(db, 'users'), where('rol', 'in', ['medico', 'doctor']));
          const snap = await getDocs(qMed);
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch {
          const snap = await getDocs(collection(db, 'users'));
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        if (cancelled) return;
        setMedicos(
          list
            .filter((u) => {
              const rol = String(u.rol || '').toLowerCase();
              return rol === 'medico' || rol === 'doctor' || rol.includes('medico');
            })
            .map((u) => ({
              id: u.id,
              nombre: u.nombre || u.displayName || u.email || u.id,
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        );
      } catch (err) {
        console.warn('[ReporteConsultas] medicos:', err);
      } finally {
        if (!cancelled) setLoadingMedicos(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const medicoLabel = useMemo(() => {
    if (medicoId === 'all') return 'Todos los médicos';
    return medicos.find((m) => m.id === medicoId)?.nombre || medicoId;
  }, [medicoId, medicos]);

  const generar = useCallback(async () => {
    setLoading(true);
    setError('');
    setAdvertencias([]);
    setNotas([]);
    setFilas([]);
    setGenMeta(null);
    setShowResultModal(false);
    setProgress('Preparando consulta…');

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

      setProgress('Descargando historial clínico del periodo…');

      const baseConstraints = [
        where('fecha', '>=', tsInicio),
        where('fecha', '<=', tsFin),
        orderBy('fecha', 'asc'),
      ];

      let usedMedicoServerFilter = medicoId !== 'all';
      const buildPageQuery = (cursor, withMedico) => {
        const parts = [];
        if (withMedico) parts.push(where('medicoId', '==', medicoId));
        parts.push(...baseConstraints);
        if (cursor) parts.push(startAfter(cursor));
        parts.push(limit(HISTORIAL_PAGE));
        return query(collection(db, 'historial_clinico'), ...parts);
      };

      let historiales = [];
      let cursor = null;
      let page = 0;

      const fetchAllPages = async (withMedico) => {
        const acc = [];
        let cur = null;
        let p = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          p += 1;
          setProgress(`Descargando historial… lote ${p} (${acc.length} acumulados)`);
          const snap = await getDocs(buildPageQuery(cur, withMedico));
          if (snap.empty) break;
          for (const d of snap.docs) acc.push(slimHistorial(d.id, d.data()));
          cur = snap.docs[snap.docs.length - 1];
          if (snap.size < HISTORIAL_PAGE) break;
        }
        return acc;
      };

      try {
        historiales = await fetchAllPages(usedMedicoServerFilter);
      } catch (idxErr) {
        if (usedMedicoServerFilter) {
          console.warn('[ReporteConsultas] índice medicoId+fecha no disponible:', idxErr?.message || idxErr);
          warns.push('Filtro por médico en cliente (falta índice compuesto medicoId + fecha).');
          usedMedicoServerFilter = false;
          historiales = await fetchAllPages(false);
        } else {
          throw idxErr;
        }
      }

      if (medicoId !== 'all' && !usedMedicoServerFilter) {
        historiales = historiales.filter((h) => h.medicoId === medicoId);
      }

      const totalBruto = historiales.length;
      setProgress(`Historial: ${totalBruto} registros. Filtrando…`);

      if (filtroContenido === 'clinicas') {
        historiales = historiales.filter(esConsultaClinica);
      } else if (filtroContenido === 'con_diagnostico') {
        historiales = historiales.filter((h) => {
          const diag = h.consulta?.diagnostico || {};
          return Boolean(String(diag.enfermedad_actual || '').trim())
            || (Array.isArray(diag.cie10) && diag.cie10.length > 0);
        });
      }

      // Pacientes + citas en paralelo (antes era secuencial: eso alargaba mucho)
      const pacienteIds = [...new Set(historiales.map((h) => h.pacienteId).filter(Boolean))];
      const citaIds = [...new Set(historiales.map((h) => h.citaId).filter(Boolean))];
      const pacientesMap = new Map();
      const citasMap = new Map();
      const pxChunks = chunkArray(pacienteIds, 30);
      const citaChunks = chunkArray(citaIds, 30);

      setProgress(
        `Enriqueciendo datos: ${pacienteIds.length} pacientes · ${citaIds.length} citas…`,
      );

      await Promise.all([
        mapPool(pxChunks, FETCH_CONCURRENCY, async (chunk) => {
          const qPx = query(collection(db, 'pacientes'), where(documentId(), 'in', chunk));
          const pxSnap = await getDocs(qPx);
          pxSnap.forEach((d) => {
            const data = d.data() || {};
            pacientesMap.set(d.id, {
              idPaciente: data.idPaciente || data.idPacienteMigrado || data.legacyPatientId || '',
              nombreCompleto: data.nombreCompleto || [data.nombre, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' '),
              sexo: data.sexo || '',
              fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || '',
            });
          });
        }),
        mapPool(citaChunks, FETCH_CONCURRENCY, async (chunk) => {
          const qCitas = query(collection(db, 'citas'), where(documentId(), 'in', chunk));
          const cSnap = await getDocs(qCitas);
          cSnap.forEach((d) => {
            const data = d.data() || {};
            citasMap.set(d.id, {
              tipoConsulta: data.tipoConsulta || data.tipo_consulta || '',
              consultorioNombre: data.consultorioNombre || data.consultorio || '',
            });
          });
        }),
      ]);

      setProgress(`Armando ${historiales.length} filas…`);

      let sinTipo = 0;
      let sinSexo = 0;
      let sinId = 0;
      const rows = [];

      for (const h of historiales) {
        const fechaConsulta = parseFechaDoc(h.fecha) || new Date();
        const px = pacientesMap.get(h.pacienteId) || {};
        const cita = h.citaId ? (citasMap.get(h.citaId) || {}) : {};

        let tipoConsulta = normalizeTipoConsulta(cita.tipoConsulta);
        if (!tipoConsulta) {
          const fromNota = normalizeTipoConsulta(h.tipoNota);
          if (fromNota === 'Primera vez' || fromNota === 'Subsecuente' || fromNota === 'Urgencia' || fromNota === 'Control') {
            tipoConsulta = fromNota;
          } else {
            sinTipo += 1;
          }
        }

        if (filtroTipo !== 'all') {
          const t = tipoConsulta.toLowerCase();
          if (filtroTipo === 'primera' && !t.includes('primera')) continue;
          if (filtroTipo === 'subsecuente' && !t.includes('subsecuente')) continue;
          if (filtroTipo === 'urgencia' && !t.includes('urgencia')) continue;
        }

        const fechaNac = px.fechaNacimiento || h.px_info?.fecha_nacimiento || '';
        const edad = formatearEdad(fechaNac, fechaConsulta) || String(h.px_info?.edad || '').trim();
        const sexo = normalizeSexoHM(px.sexo);
        if (!sexo) sinSexo += 1;

        const identificador = String(px.idPaciente || h.px_info?.id_receta || '').trim();
        if (!identificador) sinId += 1;

        const segunda = h.meta?.segunda_opinion === true || h.meta?.segunda_opinion === 'true' || h.segundaOpinion === true;
        const consultorio = h.consultorioNombre || cita.consultorioNombre || '';
        const receta = formatRecetaCols(h);

        rows.push({
          fecha: formatFechaCsv(fechaConsulta),
          identificador,
          nombrePaciente: h.pacienteNombre || px.nombreCompleto || '',
          nombreMedico: h.medicoNombre || '',
          edad,
          sexo,
          tipoConsulta,
          diagnostico: formatDiagnostico(h),
          estudios: formatEstudios(h),
          medicamentos: receta.medicamentos,
          grupo: receta.grupo,
          tratamiento: receta.tratamiento,
          consultorio,
          segundaOpinion: segunda ? 'Sí' : '',
          _sort: fechaConsulta.getTime(),
        });
      }

      rows.sort((a, b) => a._sort - b._sort);

      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (totalBruto !== rows.length) {
        warns.push(`Exportables: ${rows.length} de ${totalBruto} registros del periodo (después de filtros).`);
      }
      if (sinTipo > 0) {
        warns.push(`${sinTipo} consultas no tienen tipo (1ª vez/subsecuente) en la cita vinculada; la columna puede quedar vacía.`);
      }
      if (sinSexo > 0) {
        warns.push(`${sinSexo} pacientes sin sexo en ficha; columna Sexo vacía.`);
      }
      if (sinId > 0) {
        warns.push(`${sinId} pacientes sin identificador humano (idPaciente).`);
      }

      setFilas(rows);
      setAdvertencias(warns);
      setNotas([]);
      setGenMeta({ secs, pacientes: pacienteIds.length, citas: citaIds.length });
      setStep(4);
      setShowResultModal(true);
      setProgress('');
    } catch (err) {
      console.error('[ReporteConsultas]', err);
      setError(`Error al generar el reporte: ${err.message || err}`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, medicoId, filtroContenido, filtroTipo]);

  const exportar = () => {
    if (!filas.length) return;
    downloadXLSX(filas, `Consultas_${fechaInicio}-${fechaFin}.xlsx`);
  };

  const cerrarResultados = () => setShowResultModal(false);

  const volverAFiltros = () => {
    setShowResultModal(false);
    setStep(3);
    setFilas([]);
    setAdvertencias([]);
    setNotas([]);
    setGenMeta(null);
  };

  const kpis = useMemo(() => ({
    total: filas.length,
    conDiag: filas.filter((r) => r.diagnostico).length,
    conEst: filas.filter((r) => r.estudios).length,
    conMed: filas.filter((r) => r.medicamentos).length,
  }), [filas]);

  const preview = filas.slice(0, 50);

  return (
    <div className="rc">
      <style>{STYLES}</style>

      <div className="rc-steps">
        {/* Paso 1 — fechas */}
        <div className={`rc-step ${step < 1 ? 'dim' : ''}`}>
          <div className="rc-step-hd">
            <div className={`rc-badge ${step > 1 ? 'done' : 'active'}`}>
              {step > 1 ? <CheckCircle2 size={14} /> : '1'}
            </div>
            <div>
              <p className="rc-step-title">Elige un rango de fechas</p>
              <p className="rc-step-sub">Incluye consultas guardadas en el expediente clínico.</p>
            </div>
          </div>
          {step === 1 && (
            <>
              <div className="rc-fields">
                <label className="rc-label">
                  Desde
                  <input type="date" className="rc-input" value={fechaInicio} onChange={(e) => e.target.value && setFechaInicio(e.target.value)} />
                </label>
                <label className="rc-label">
                  Hasta
                  <input type="date" className="rc-input" value={fechaFin} max={toDateInput(hoy)} onChange={(e) => e.target.value && setFechaFin(e.target.value)} />
                </label>
              </div>
              <div className="rc-actions">
                <button type="button" className="rc-btn rc-btn-primary" onClick={() => setStep(2)}>
                  Continuar <CalendarRange size={14} />
                </button>
              </div>
            </>
          )}
          {step > 1 && (
            <p className="rc-step-sub">{fechaInicio} → {fechaFin}</p>
          )}
        </div>

        {/* Paso 2 — médico + contenido */}
        <div className={`rc-step ${step < 2 ? 'dim' : ''}`}>
          <div className="rc-step-hd">
            <div className={`rc-badge ${step > 2 ? 'done' : step === 2 ? 'active' : 'todo'}`}>
              {step > 2 ? <CheckCircle2 size={14} /> : '2'}
            </div>
            <div>
              <p className="rc-step-title">Filtros de consulta</p>
              <p className="rc-step-sub">Médico opcional · qué registros incluir · tipo de consulta</p>
            </div>
          </div>
          {step === 2 && (
            <>
              <div className="rc-fields" style={{ marginBottom: 12 }}>
                <label className="rc-label">
                  Médico (opcional)
                  <select className="rc-select" value={medicoId} onChange={(e) => setMedicoId(e.target.value)} disabled={loadingMedicos}>
                    <option value="all">Todos los médicos</option>
                    {medicos.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="rc-label">
                  Tipo de consulta
                  <select className="rc-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                    {FILTRO_TIPO.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rc-radios">
                {FILTRO_CONTENIDO.map((f) => (
                  <label key={f.id} className="rc-radio">
                    <input
                      type="radio"
                      name="filtroContenido"
                      checked={filtroContenido === f.id}
                      onChange={() => setFiltroContenido(f.id)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <div className="rc-actions">
                <button type="button" className="rc-btn rc-btn-ghost" onClick={() => setStep(1)}>
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="rc-btn rc-btn-primary" onClick={() => setStep(3)}>
                  Continuar <UserRound size={14} />
                </button>
              </div>
            </>
          )}
          {step > 2 && (
            <p className="rc-step-sub">{medicoLabel} · {FILTRO_CONTENIDO.find((f) => f.id === filtroContenido)?.label}</p>
          )}
        </div>

        {/* Paso 3 — confirmar / generar */}
        <div className={`rc-step ${step < 3 ? 'dim' : ''}`}>
          <div className="rc-step-hd">
            <div className={`rc-badge ${step > 3 ? 'done' : step === 3 ? 'active' : 'todo'}`}>
              {step > 3 ? <CheckCircle2 size={14} /> : '3'}
            </div>
            <div>
              <p className="rc-step-title">Generar listado de consultas</p>
              <p className="rc-step-sub">Genera el listado y descarga el Excel</p>
            </div>
          </div>
          {step === 3 && (
            <>
              <div className="rc-fields">
                <div className="rc-kpi"><span>Periodo</span><b style={{ fontSize: '.85rem' }}>{fechaInicio} → {fechaFin}</b></div>
                <div className="rc-kpi"><span>Médico</span><b style={{ fontSize: '.85rem' }}>{medicoLabel}</b></div>
                <div className="rc-kpi"><span>Tipo</span><b style={{ fontSize: '.85rem' }}>{FILTRO_TIPO.find((t) => t.id === filtroTipo)?.label}</b></div>
              </div>
              <div className="rc-actions">
                <button type="button" className="rc-btn rc-btn-ghost" onClick={() => setStep(2)} disabled={loading}>
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="rc-btn rc-btn-primary" onClick={generar} disabled={loading}>
                  {loading ? <><Loader2 size={14} className="rc-spin" /> Generando…</> : <><Stethoscope size={14} /> Generar reporte</>}
                </button>
              </div>
              {loading && progress && (
                <p className="rc-step-sub" style={{ marginTop: 10 }}>{progress}</p>
              )}
              {error && (
                <div className="rc-error"><AlertTriangle size={14} /> {error}</div>
              )}
            </>
          )}
        </div>

        {/* Paso 4 — resumen compacto (detalle en modal) */}
        <div className={`rc-step ${step < 4 ? 'dim' : ''}`}>
          <div className="rc-step-hd">
            <div className={`rc-badge ${step === 4 ? 'done' : 'todo'}`}>
              {step === 4 ? <CheckCircle2 size={14} /> : '4'}
            </div>
            <div>
              <p className="rc-step-title">Resultados y exportación</p>
              <p className="rc-step-sub">Resumen, avisos y vista previa en ventana</p>
            </div>
          </div>
          {step === 4 && (
            <div className="rc-success-bar">
              <div>
                <strong>{kpis.total.toLocaleString('es-MX')} consultas listas</strong>
                <p>
                  {fechaInicio} → {fechaFin}
                  {genMeta ? ` · ${genMeta.secs}s` : ''}
                  {advertencias.length ? ` · ${advertencias.length} aviso${advertencias.length === 1 ? '' : 's'}` : ''}
                </p>
              </div>
              <div className="rc-actions" style={{ marginTop: 0 }}>
                <button type="button" className="rc-btn rc-btn-ghost" onClick={volverAFiltros}>
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="rc-btn rc-btn-primary" onClick={() => setShowResultModal(true)}>
                  <Eye size={14} /> Ver resultados
                </button>
                <button type="button" className="rc-btn rc-btn-ok" onClick={exportar} disabled={!filas.length}>
                  <Download size={14} /> Exportar Excel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="rc-step-sub" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <FileSpreadsheet size={13} /> Columnas: {EXPORT_COLS.map((c) => c.label).join(' · ')}
      </p>

      {showResultModal && (
        <div
          className="rc-modal-backdrop"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarResultados(); }}
        >
          <div className="rc-modal" role="dialog" aria-modal="true" aria-labelledby="rc-modal-title">
            <div className="rc-modal-hd">
              <div>
                <h2 id="rc-modal-title">Reporte de consultas</h2>
                <p>
                  {fechaInicio} → {fechaFin} · {medicoLabel}
                  {genMeta ? ` · Generado en ${genMeta.secs}s · ${genMeta.pacientes} pacientes · ${genMeta.citas} citas` : ''}
                </p>
              </div>
              <button type="button" className="rc-modal-x" onClick={cerrarResultados} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <div className="rc-modal-body">
              <div className="rc-section">
                <p className="rc-section-label">Resumen</p>
                <div className="rc-kpis" style={{ margin: 0 }}>
                  <div className="rc-kpi"><span>Consultas</span><b>{kpis.total.toLocaleString('es-MX')}</b></div>
                  <div className="rc-kpi"><span>Con diagnóstico</span><b>{kpis.conDiag.toLocaleString('es-MX')}</b></div>
                  <div className="rc-kpi"><span>Con estudios</span><b>{kpis.conEst.toLocaleString('es-MX')}</b></div>
                  <div className="rc-kpi"><span>Con medicamentos</span><b>{kpis.conMed.toLocaleString('es-MX')}</b></div>
                </div>
              </div>

              {(advertencias.length > 0 || notas.length > 0) && (
                <div className="rc-section">
                  <p className="rc-section-label">Avisos</p>
                  <div className="rc-notes">
                    {advertencias.map((w) => (
                      <div key={w} className="rc-note warn">
                        <AlertTriangle size={14} />
                        <span>{w}</span>
                      </div>
                    ))}
                    {notas.map((n) => (
                      <div key={n} className="rc-note info">
                        <Info size={14} />
                        <span>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rc-section" style={{ marginBottom: 0 }}>
                <p className="rc-section-label">
                  Vista previa {filas.length > preview.length ? `(${preview.length} de ${filas.length})` : ''}
                </p>
                {filas.length === 0 ? (
                  <p className="rc-muted">No hay consultas con los filtros seleccionados.</p>
                ) : (
                  <div className="rc-table-wrap">
                    <table className="rc-table">
                      <thead>
                        <tr>
                          {EXPORT_COLS.map((c) => <th key={c.key}>{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((r, idx) => (
                          <tr key={`${r.fecha}-${r.identificador}-${idx}`}>
                            {EXPORT_COLS.map((c) => (
                              <td key={c.key}>{r[c.key] || <span className="rc-muted">—</span>}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="rc-modal-ft">
              <button type="button" className="rc-btn rc-btn-ghost" onClick={cerrarResultados}>
                Cerrar
              </button>
              <button type="button" className="rc-btn rc-btn-ghost" onClick={generar} disabled={loading}>
                {loading ? <Loader2 size={14} className="rc-spin" /> : <Eye size={14} />} Regenerar
              </button>
              <button type="button" className="rc-btn rc-btn-ok" onClick={exportar} disabled={!filas.length}>
                <Download size={14} /> Exportar Excel ({kpis.total.toLocaleString('es-MX')})
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rc-spin { animation: rcSpin .8s linear infinite; }
        @keyframes rcSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ReporteConsultas;
