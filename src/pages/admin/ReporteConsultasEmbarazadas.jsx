// src/pages/admin/ReporteConsultasEmbarazadas.jsx
// Consultas a embarazadas — NOM-007 (control prenatal) · export Excel

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, Timestamp, documentId, limit, startAfter,
} from 'firebase/firestore';
import {
  CheckCircle2, ChevronLeft, Download, FileSpreadsheet,
  Loader2, Baby, AlertTriangle, Eye, X, UserRound,
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

const formatFechaCsv = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

const formatFechaCorta = (v) => {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = parseFechaDoc(v);
  if (!d) return s;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const formatearEdad = (fechaNacimiento, fechaConsulta) => {
  if (!fechaNacimiento) return '';
  const nac = new Date(fechaNacimiento);
  const ref = fechaConsulta instanceof Date ? fechaConsulta : new Date();
  if (Number.isNaN(nac.getTime()) || Number.isNaN(ref.getTime()) || nac > ref) return '';
  let años = ref.getFullYear() - nac.getFullYear();
  let meses = ref.getMonth() - nac.getMonth();
  if (ref.getDate() < nac.getDate()) meses -= 1;
  if (meses < 0) { años -= 1; meses += 12; }
  if (años <= 0) return meses <= 0 ? '' : `${meses} meses`;
  return meses > 0 ? `${años} años ${meses} meses` : `${años} años`;
};

const chunkArray = (arr, size = 30) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function mapPool(items, conc, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(conc, items.length) || 0 }, async () => {
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
  const estudios = data.consulta?.estudios;
  const px = data.px_info || {};
  const exp = data.consulta?.exploracion || {};
  const ce = data.control_embarazo || {};
  return {
    id,
    fecha: data.fecha,
    pacienteId: data.pacienteId || null,
    pacienteNombre: data.pacienteNombre || '',
    medicoId: data.medicoId || null,
    medicoNombre: data.medicoNombre || data.medicoPerfil?.nombre || '',
    citaId: data.citaId || null,
    consultorioNombre: data.consultorioNombre || '',
    px_info: {
      edad: px.edad || '',
      fecha_nacimiento: px.fecha_nacimiento || '',
      telefono: px.telefono || '',
      fum: px.fum || '',
      fpp: px.fpp || '',
      sdg: px.sdg || '',
      es_embarazada: !!px.es_embarazada,
      id_receta: px.id_receta || '',
    },
    control_embarazo: {
      num_embarazo: ce.num_embarazo || '',
      num_bebes: ce.num_bebes || '',
      riesgo: ce.riesgo || '',
      acido_folico: ce.acido_folico || '',
      fondo_uterino: ce.fondo_uterino || '',
      fcf: ce.fcf || '',
      num_consulta_prenatal: ce.num_consulta_prenatal || '',
      complicaciones: ce.complicaciones || {},
    },
    consulta: {
      diagnostico: {
        enfermedad_actual: diag.enfermedad_actual || '',
        cie10: Array.isArray(diag.cie10) ? diag.cie10 : [],
        tratamiento_lista: Array.isArray(diag.tratamiento_lista) ? diag.tratamiento_lista : [],
        indicaciones: diag.indicaciones || '',
      },
      exploracion: {
        signos: exp.signos || {},
        antropometria: exp.antropometria || {},
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

const tieneCieObstetrico = (h) => {
  const cie = h.consulta?.diagnostico?.cie10;
  if (!Array.isArray(cie)) return false;
  return cie.some((item) => {
    const c = String(item.codigo || item.code || '').trim().toUpperCase();
    return /^O\d{2}/.test(c);
  });
};

const esConsultaEmbarazo = (h) => {
  const px = h.px_info || {};
  if (px.es_embarazada) return true;
  if (String(px.fum || '').trim() || String(px.fpp || '').trim() || String(px.sdg || '').trim()) return true;
  const ce = h.control_embarazo || {};
  if (ce.num_embarazo || ce.fondo_uterino || ce.fcf || ce.num_consulta_prenatal) return true;
  return tieneCieObstetrico(h);
};

const embarazoEnCurso = (h, hoy = new Date()) => {
  const px = h.px_info || {};
  if (px.es_embarazada) return true;
  const fpp = parseFechaDoc(px.fpp);
  if (fpp) {
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return fpp >= inicioHoy;
  }
  if (String(px.sdg || '').trim() || String(px.fum || '').trim()) return true;
  return false;
};

const formatDiagnostico = (h) => {
  const diag = h.consulta?.diagnostico || {};
  const cie = Array.isArray(diag.cie10) ? diag.cie10 : [];
  if (cie.length > 0) {
    return cie.map((item) => {
      const codigo = String(item.codigo || item.code || '').trim().toUpperCase();
      const desc = String(item.descripcion || item.description || '').trim();
      if (codigo && desc) return `${codigo} - ${desc}`;
      return codigo || desc || null;
    }).filter(Boolean).join('; ');
  }
  return String(diag.enfermedad_actual || '').trim().replace(/[•]\s*/g, '').replace(/\s+/g, ' ');
};

const formatEstudios = (h) => {
  const estudios = h.consulta?.estudios;
  if (!estudios) return '';
  if (typeof estudios === 'string') {
    const t = estudios.trim();
    if (!t) return '';
    return t.includes('•')
      ? t.split('•').map((x) => x.trim()).filter(Boolean).join('; ')
      : t.split(/[,;]+/).map((x) => x.trim()).filter(Boolean).join('; ');
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
  return lista.join('; ');
};

const formatMeds = (h) => {
  const lista = h.consulta?.diagnostico?.tratamiento_lista;
  if (!Array.isArray(lista)) return '';
  return lista.map((m, i) => {
    const n = String(m?.nombre || '').trim();
    return n ? `${i + 1}.- ${n}` : null;
  }).filter(Boolean).join('   ');
};

const compLabel = (comps, key) => {
  const v = comps?.[key];
  if (!v || v === 'No aplica') return '';
  return v;
};

const EXPORT_COLS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'identificador', label: 'Identificador' },
  { key: 'nombrePaciente', label: 'Nombre del paciente' },
  { key: 'edad', label: 'Edad' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'nombreMedico', label: 'Nombre del médico' },
  { key: 'consultorio', label: 'Consultorio' },
  { key: 'fum', label: 'FUM' },
  { key: 'fpp', label: 'FPP' },
  { key: 'sdg', label: 'SDG' },
  { key: 'enCurso', label: 'Embarazo en curso' },
  { key: 'numEmbarazo', label: 'Núm. embarazo' },
  { key: 'numBebes', label: 'Núm. bebés' },
  { key: 'numConsultaPrenatal', label: 'Consulta prenatal #' },
  { key: 'fondoUterino', label: 'Fondo uterino (cm)' },
  { key: 'fcf', label: 'FCF (lpm)' },
  { key: 'peso', label: 'Peso' },
  { key: 'ta', label: 'TA' },
  { key: 'fc', label: 'FC' },
  { key: 'riesgo', label: 'Alto riesgo' },
  { key: 'acidoFolico', label: 'Ácido fólico' },
  { key: 'diabetes', label: 'Diabetes gestacional' },
  { key: 'ivu', label: 'Infección urinaria' },
  { key: 'preeclampsia', label: 'Preeclampsia' },
  { key: 'hemorragia', label: 'Hemorragia' },
  { key: 'hipertension', label: 'Hipertensión' },
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'estudios', label: 'Estudios' },
  { key: 'medicamentos', label: 'Medicamentos' },
  { key: 'indicaciones', label: 'Indicaciones' },
];

const VISTAS = [
  { id: 'todas', label: 'Todas las consultas' },
  { id: 'fum_fpp', label: 'Agrupadas por FUM y FPP' },
  { id: 'primera_ultima', label: 'Primera y última consulta de cada paciente' },
  { id: 'ultima_mes', label: 'Última consulta por mes de cada paciente' },
];

const downloadXLSX = (rows, filename) => {
  const aoa = [
    EXPORT_COLS.map((c) => c.label),
    ...rows.map((r) => EXPORT_COLS.map((c) => (r[c.key] == null ? '' : String(r[c.key])))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = EXPORT_COLS.map((c) => {
    if (['nombrePaciente', 'diagnostico', 'estudios', 'medicamentos', 'indicaciones'].includes(c.key)) return { wch: 32 };
    if (['nombreMedico', 'consultorio'].includes(c.key)) return { wch: 24 };
    return { wch: 14 };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Embarazadas');
  XLSX.writeFile(wb, filename);
};

const aplicarVista = (rows, vista) => {
  if (vista === 'todas' || !rows.length) return rows;

  if (vista === 'fum_fpp') {
    return [...rows].sort((a, b) => {
      const ka = `${a.fum}|${a.fpp}|${a.nombrePaciente}`;
      const kb = `${b.fum}|${b.fpp}|${b.nombrePaciente}`;
      if (ka !== kb) return ka.localeCompare(kb, 'es');
      return a._sort - b._sort;
    });
  }

  if (vista === 'primera_ultima') {
    const byPx = new Map();
    for (const r of rows) {
      const key = r._pacienteId || r.identificador || r.nombrePaciente;
      if (!byPx.has(key)) byPx.set(key, []);
      byPx.get(key).push(r);
    }
    const out = [];
    for (const list of byPx.values()) {
      list.sort((a, b) => a._sort - b._sort);
      out.push(list[0]);
      if (list.length > 1) out.push(list[list.length - 1]);
    }
    return out.sort((a, b) => a._sort - b._sort);
  }

  if (vista === 'ultima_mes') {
    const byKey = new Map();
    for (const r of rows) {
      const d = new Date(r._sort);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const key = `${r._pacienteId || r.identificador || r.nombrePaciente}|${mes}`;
      const prev = byKey.get(key);
      if (!prev || r._sort > prev._sort) byKey.set(key, r);
    }
    return [...byKey.values()].sort((a, b) => a._sort - b._sort);
  }

  return rows;
};

const STYLES = `
  .re { font-family: 'DM Sans', system-ui, sans-serif; }
  .re-steps { display: flex; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .re-step { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
  .re-step:last-child { border-bottom: 0; }
  .re-step.dim { opacity: .45; pointer-events: none; }
  .re-step-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .re-badge { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .re-badge.done, .re-badge.active { background: #0077B6; color: #fff; }
  .re-badge.todo { background: #e2e8f0; color: #64748b; }
  .re-step-title { font-size: .82rem; font-weight: 650; color: #0f172a; margin: 0; }
  .re-step-sub { font-size: .68rem; color: #64748b; margin: 2px 0 0; }
  .re-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; max-width: 520px; }
  .re-label { display: flex; flex-direction: column; gap: 4px; font-size: .68rem; font-weight: 600; color: #64748b; }
  .re-input, .re-select { height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: .8rem; color: #0f172a; background: #f8fafc; font-family: inherit; outline: none; }
  .re-input:focus, .re-select:focus { border-color: #0077B6; background: #fff; box-shadow: 0 0 0 3px rgba(0,119,182,.12); }
  .re-radios { display: flex; flex-direction: column; gap: 8px; max-width: 560px; }
  .re-radio { display: flex; align-items: flex-start; gap: 8px; font-size: .78rem; color: #334155; cursor: pointer; }
  .re-radio input { accent-color: #0077B6; margin-top: 3px; }
  .re-toggle { display: flex; align-items: center; gap: 10px; font-size: .8rem; color: #334155; }
  .re-toggle input { width: 40px; height: 22px; accent-color: #0077B6; }
  .re-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .re-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0; font-size: .74rem; font-weight: 650; cursor: pointer; font-family: inherit; }
  .re-btn-primary { background: #0077B6; color: #fff; }
  .re-btn-primary:hover { background: #023e8a; }
  .re-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
  .re-btn-ghost { background: transparent; color: #64748b; }
  .re-btn-ghost:hover { color: #0f172a; background: #f1f5f9; }
  .re-btn-ok { background: #0f766e; color: #fff; }
  .re-btn-ok:hover { background: #0d9488; }
  .re-btn-ok:disabled { opacity: .55; cursor: not-allowed; }
  .re-error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: .72rem; margin-top: 12px; }
  .re-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .re-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .re-kpi b { display: block; font-size: 1.05rem; color: #0f172a; font-family: 'Sora', sans-serif; }
  .re-kpi span { font-size: .65rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
  .re-success-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; }
  .re-success-bar strong { font-size: .82rem; color: #14532d; }
  .re-success-bar p { margin: 2px 0 0; font-size: .7rem; color: #166534; }
  .re-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .re-modal { width: min(1100px, 100%); max-height: min(90vh, 920px); background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(15,23,42,.25); display: flex; flex-direction: column; overflow: hidden; }
  .re-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
  .re-modal-hd h2 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1rem; color: #0f172a; }
  .re-modal-hd p { margin: 3px 0 0; font-size: .7rem; color: #64748b; }
  .re-modal-x { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #f1f5f9; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .re-modal-body { padding: 16px 18px; overflow: auto; flex: 1; }
  .re-modal-ft { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
  .re-table-wrap { overflow: auto; max-height: 420px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .re-table { width: 100%; border-collapse: collapse; font-size: .65rem; }
  .re-table th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: 7px 8px; color: #475569; font-weight: 700; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
  .re-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; max-width: 180px; }
  .re-spin { animation: reSpin .8s linear infinite; }
  @keyframes reSpin { to { transform: rotate(360deg); } }
`;

const PREVIEW_COLS = [
  'fecha', 'nombrePaciente', 'sdg', 'fum', 'fpp', 'fondoUterino', 'fcf', 'ta', 'peso', 'diagnostico', 'nombreMedico',
];

const ReporteConsultasEmbarazadas = () => {
  const hoy = useMemo(() => new Date(), []);
  const primerDiaMes = useMemo(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1), [hoy]);

  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [vista, setVista] = useState('todas');
  const [soloEnCurso, setSoloEnCurso] = useState(true);
  const [medicoId, setMedicoId] = useState('all');
  const [medicos, setMedicos] = useState([]);
  const [loadingMedicos, setLoadingMedicos] = useState(true);

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
      setLoadingMedicos(true);
      try {
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
            .map((u) => ({ id: u.id, nombre: u.nombre || u.displayName || u.email || u.id }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        );
      } catch (err) {
        console.warn('[ReporteEmbarazadas]', err);
      } finally {
        if (!cancelled) setLoadingMedicos(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const vistaLabel = VISTAS.find((v) => v.id === vista)?.label || vista;
  const medicoLabel = medicoId === 'all'
    ? 'Todos los médicos'
    : (medicos.find((m) => m.id === medicoId)?.nombre || medicoId);

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
      let usedMedicoServerFilter = medicoId !== 'all';

      const buildPageQuery = (cursor, withMedico) => {
        const parts = [
          where('fecha', '>=', tsInicio),
          where('fecha', '<=', tsFin),
        ];
        if (withMedico) parts.push(where('medicoId', '==', medicoId));
        parts.push(orderBy('fecha', 'asc'));
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
        historiales = await fetchAllPages(usedMedicoServerFilter);
      } catch (idxErr) {
        if (usedMedicoServerFilter) {
          warns.push('Filtro por médico en cliente (falta índice compuesto).');
          usedMedicoServerFilter = false;
          historiales = await fetchAllPages(false);
        } else throw idxErr;
      }

      if (medicoId !== 'all' && !usedMedicoServerFilter) {
        historiales = historiales.filter((h) => h.medicoId === medicoId);
      }

      const totalBruto = historiales.length;
      historiales = historiales.filter(esConsultaEmbarazo);
      if (soloEnCurso) {
        historiales = historiales.filter((h) => embarazoEnCurso(h, hoy));
      }

      setProgress(`Embarazo: ${historiales.length} de ${totalBruto}. Enriqueciendo…`);

      const pacienteIds = [...new Set(historiales.map((h) => h.pacienteId).filter(Boolean))];
      const pacientesMap = new Map();
      await mapPool(chunkArray(pacienteIds, 30), FETCH_CONCURRENCY, async (chunk) => {
        const pxSnap = await getDocs(query(collection(db, 'pacientes'), where(documentId(), 'in', chunk)));
        pxSnap.forEach((d) => {
          const data = d.data() || {};
          pacientesMap.set(d.id, {
            idPaciente: data.idPaciente || data.idPacienteMigrado || data.legacyPatientId || '',
            nombreCompleto: data.nombreCompleto || [data.nombre, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' '),
            fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || '',
            telefono: data.telefono || data.celular || '',
            obstetricia: data.obstetriciaClinica || {},
          });
        });
      });

      let rows = [];
      for (const h of historiales) {
        const fechaConsulta = parseFechaDoc(h.fecha) || new Date();
        const px = pacientesMap.get(h.pacienteId) || {};
        const obst = px.obstetricia || {};
        const info = h.px_info || {};
        const ce = h.control_embarazo || {};
        const comps = ce.complicaciones || {};
        const signos = h.consulta?.exploracion?.signos || {};
        const antro = h.consulta?.exploracion?.antropometria || {};

        const fum = info.fum || obst.fum || '';
        const fpp = info.fpp || obst.fpp || '';
        const sdg = info.sdg || obst.sdg || '';
        const enCurso = embarazoEnCurso({ px_info: { ...info, fum, fpp, sdg, es_embarazada: info.es_embarazada || obst.es_embarazada } }, hoy);

        rows.push({
          fecha: formatFechaCsv(fechaConsulta),
          identificador: String(px.idPaciente || info.id_receta || '').trim(),
          nombrePaciente: h.pacienteNombre || px.nombreCompleto || '',
          edad: formatearEdad(px.fechaNacimiento || info.fecha_nacimiento, fechaConsulta) || String(info.edad || ''),
          telefono: info.telefono || px.telefono || '',
          nombreMedico: h.medicoNombre || '',
          consultorio: h.consultorioNombre || '',
          fum: formatFechaCorta(fum),
          fpp: formatFechaCorta(fpp),
          sdg,
          enCurso: enCurso ? 'Sí' : 'No',
          numEmbarazo: ce.num_embarazo || '',
          numBebes: ce.num_bebes || '',
          numConsultaPrenatal: ce.num_consulta_prenatal || '',
          fondoUterino: ce.fondo_uterino || '',
          fcf: ce.fcf || '',
          peso: antro.peso || '',
          ta: signos.ta || '',
          fc: signos.fc || '',
          riesgo: ce.riesgo && ce.riesgo !== 'No aplica' ? ce.riesgo : '',
          acidoFolico: ce.acido_folico && ce.acido_folico !== 'No aplica' ? ce.acido_folico : '',
          diabetes: compLabel(comps, 'diabetes'),
          ivu: compLabel(comps, 'infeccion_urinaria'),
          preeclampsia: compLabel(comps, 'preeclampsia'),
          hemorragia: compLabel(comps, 'hemorragia'),
          hipertension: compLabel(comps, 'hipertension'),
          diagnostico: formatDiagnostico(h),
          estudios: formatEstudios(h),
          medicamentos: formatMeds(h),
          indicaciones: String(h.consulta?.diagnostico?.indicaciones || '').trim(),
          _sort: fechaConsulta.getTime(),
          _pacienteId: h.pacienteId || '',
        });
      }

      rows = aplicarVista(rows, vista);

      if (historiales.length === 0) {
        warns.push('No se encontraron consultas de embarazo en el periodo con los filtros elegidos.');
      }

      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      setFilas(rows);
      setAdvertencias(warns);
      setGenMeta({ secs, bruto: totalBruto, filas: rows.length, pacientes: pacienteIds.length });
      setStep(5);
      setShowResultModal(true);
      setProgress('');
    } catch (err) {
      console.error('[ReporteEmbarazadas]', err);
      setError(`Error al generar el reporte: ${err.message || err}`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, vista, soloEnCurso, medicoId, hoy]);

  const exportar = () => {
    if (!filas.length) return;
    downloadXLSX(filas, `Consultas_embarazadas_${fechaInicio}-${fechaFin}.xlsx`);
  };

  const preview = filas.slice(0, 40);

  return (
    <div className="re">
      <style>{STYLES}</style>
      <div className="re-steps">
        {/* 1 fechas */}
        <div className={`re-step ${step < 1 ? 'dim' : ''}`}>
          <div className="re-step-hd">
            <div className={`re-badge ${step > 1 ? 'done' : 'active'}`}>{step > 1 ? <CheckCircle2 size={14} /> : '1'}</div>
            <div>
              <p className="re-step-title">Elige un rango de fechas</p>
              <p className="re-step-sub">Consultas con datos de embarazo</p>
            </div>
          </div>
          {step === 1 && (
            <>
              <div className="re-fields">
                <label className="re-label">Desde
                  <input type="date" className="re-input" value={fechaInicio} onChange={(e) => e.target.value && setFechaInicio(e.target.value)} />
                </label>
                <label className="re-label">Hasta
                  <input type="date" className="re-input" value={fechaFin} max={toDateInput(hoy)} onChange={(e) => e.target.value && setFechaFin(e.target.value)} />
                </label>
              </div>
              <div className="re-actions">
                <button type="button" className="re-btn re-btn-primary" onClick={() => setStep(2)}>Continuar</button>
              </div>
            </>
          )}
          {step > 1 && <p className="re-step-sub">{fechaInicio} → {fechaFin}</p>}
        </div>

        {/* 2 vista */}
        <div className={`re-step ${step < 2 ? 'dim' : ''}`}>
          <div className="re-step-hd">
            <div className={`re-badge ${step > 2 ? 'done' : step === 2 ? 'active' : 'todo'}`}>{step > 2 ? <CheckCircle2 size={14} /> : '2'}</div>
            <div>
              <p className="re-step-title">¿Qué consultas deseas ver?</p>
              <p className="re-step-sub">Forma de listar / agrupar</p>
            </div>
          </div>
          {step === 2 && (
            <>
              <div className="re-radios">
                {VISTAS.map((v) => (
                  <label key={v.id} className="re-radio">
                    <input type="radio" name="vistaEmb" checked={vista === v.id} onChange={() => setVista(v.id)} />
                    <span>{v.label}</span>
                  </label>
                ))}
              </div>
              <div className="re-actions">
                <button type="button" className="re-btn re-btn-ghost" onClick={() => setStep(1)}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="re-btn re-btn-primary" onClick={() => setStep(3)}>Continuar</button>
              </div>
            </>
          )}
          {step > 2 && <p className="re-step-sub">{vistaLabel}</p>}
        </div>

        {/* 3 en curso */}
        <div className={`re-step ${step < 3 ? 'dim' : ''}`}>
          <div className="re-step-hd">
            <div className={`re-badge ${step > 3 ? 'done' : step === 3 ? 'active' : 'todo'}`}>{step > 3 ? <CheckCircle2 size={14} /> : '3'}</div>
            <div>
              <p className="re-step-title">¿Sólo embarazos en curso?</p>
              <p className="re-step-sub">FPP vigente o marcada como embarazada</p>
            </div>
          </div>
          {step === 3 && (
            <>
              <label className="re-toggle">
                <input type="checkbox" checked={soloEnCurso} onChange={(e) => setSoloEnCurso(e.target.checked)} />
                <span>{soloEnCurso ? 'Sí — solo en curso' : 'No — incluir todos'}</span>
              </label>
              <div className="re-actions">
                <button type="button" className="re-btn re-btn-ghost" onClick={() => setStep(2)}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="re-btn re-btn-primary" onClick={() => setStep(4)}>Continuar</button>
              </div>
            </>
          )}
          {step > 3 && <p className="re-step-sub">{soloEnCurso ? 'Solo en curso' : 'Todos'}</p>}
        </div>

        {/* 4 médico */}
        <div className={`re-step ${step < 4 ? 'dim' : ''}`}>
          <div className="re-step-hd">
            <div className={`re-badge ${step > 4 ? 'done' : step === 4 ? 'active' : 'todo'}`}>{step > 4 ? <CheckCircle2 size={14} /> : '4'}</div>
            <div>
              <p className="re-step-title">¿Cómo quieres consultar la información?</p>
              <p className="re-step-sub">Médico (opcional)</p>
            </div>
          </div>
          {step === 4 && (
            <>
              <label className="re-label" style={{ maxWidth: 420 }}>
                Médico
                <select className="re-select" value={medicoId} onChange={(e) => setMedicoId(e.target.value)} disabled={loadingMedicos}>
                  <option value="all">Todos</option>
                  {medicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </label>
              <div className="re-actions">
                <button type="button" className="re-btn re-btn-ghost" onClick={() => setStep(3)}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="re-btn re-btn-primary" onClick={() => setStep(5)}>
                  Continuar <UserRound size={14} />
                </button>
              </div>
            </>
          )}
          {step > 4 && <p className="re-step-sub">{medicoLabel}</p>}
        </div>

        {/* 5 generar */}
        <div className={`re-step ${step < 5 ? 'dim' : ''}`}>
          <div className="re-step-hd">
            <div className={`re-badge ${genMeta ? 'done' : step === 5 ? 'active' : 'todo'}`}>
              {genMeta ? <CheckCircle2 size={14} /> : '5'}
            </div>
            <div>
              <p className="re-step-title">Generar y exportar</p>
              <p className="re-step-sub">Vista previa y Excel</p>
            </div>
          </div>
          {step === 5 && !genMeta && (
            <>
              <div className="re-kpis">
                <div className="re-kpi"><span>Periodo</span><b style={{ fontSize: '.8rem' }}>{fechaInicio} → {fechaFin}</b></div>
                <div className="re-kpi"><span>Vista</span><b style={{ fontSize: '.8rem' }}>{vistaLabel}</b></div>
                <div className="re-kpi"><span>En curso</span><b style={{ fontSize: '.8rem' }}>{soloEnCurso ? 'Sí' : 'No'}</b></div>
                <div className="re-kpi"><span>Médico</span><b style={{ fontSize: '.8rem' }}>{medicoLabel}</b></div>
              </div>
              <div className="re-actions">
                <button type="button" className="re-btn re-btn-ghost" onClick={() => setStep(4)} disabled={loading}>
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="re-btn re-btn-primary" onClick={generar} disabled={loading}>
                  {loading ? <Loader2 size={14} className="re-spin" /> : <Baby size={14} />}
                  {loading ? (progress || 'Generando…') : 'Generar reporte'}
                </button>
              </div>
            </>
          )}
          {genMeta && (
            <div className="re-success-bar" style={{ marginTop: 4 }}>
              <div>
                <strong>Reporte listo</strong>
                <p>{fechaInicio} → {fechaFin} · {genMeta.filas} filas · {genMeta.secs}s</p>
              </div>
              <div className="re-actions" style={{ marginTop: 0 }}>
                <button type="button" className="re-btn re-btn-ghost" onClick={() => setShowResultModal(true)}><Eye size={14} /> Ver</button>
                <button type="button" className="re-btn re-btn-ok" onClick={exportar} disabled={!filas.length}>
                  <Download size={14} /> Exportar Excel
                </button>
                <button
                  type="button"
                  className="re-btn re-btn-ghost"
                  onClick={() => { setGenMeta(null); setFilas([]); setAdvertencias([]); setStep(4); }}
                >
                  Nuevo
                </button>
              </div>
            </div>
          )}
          {error && <div className="re-error"><AlertTriangle size={14} /><span>{error}</span></div>}
        </div>
      </div>

      {showResultModal && (
        <div className="re-modal-backdrop" role="dialog" aria-modal="true">
          <div className="re-modal">
            <div className="re-modal-hd">
              <div>
                <h2>Consultas a embarazadas</h2>
                <p>{fechaInicio} → {fechaFin} · {vistaLabel} · {soloEnCurso ? 'En curso' : 'Todos'} · {medicoLabel}</p>
              </div>
              <button type="button" className="re-modal-x" onClick={() => setShowResultModal(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className="re-modal-body">
              {advertencias.length > 0 && (
                <div className="re-error" style={{ marginTop: 0, marginBottom: 12, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                  <AlertTriangle size={14} />
                  <span>{advertencias.join(' ')}</span>
                </div>
              )}
              <div className="re-kpis" style={{ marginBottom: 12 }}>
                <div className="re-kpi"><span>Filas</span><b>{(genMeta?.filas || 0).toLocaleString('es-MX')}</b></div>
                <div className="re-kpi"><span>Pacientes</span><b>{(genMeta?.pacientes || 0).toLocaleString('es-MX')}</b></div>
                <div className="re-kpi"><span>Historial bruto</span><b>{(genMeta?.bruto || 0).toLocaleString('es-MX')}</b></div>
              </div>
              {preview.length > 0 ? (
                <div className="re-table-wrap">
                  <table className="re-table">
                    <thead>
                      <tr>
                        {PREVIEW_COLS.map((k) => (
                          <th key={k}>{EXPORT_COLS.find((c) => c.key === k)?.label || k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={`${r._pacienteId}-${r._sort}-${i}`}>
                          {PREVIEW_COLS.map((k) => <td key={k}>{r[k] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '.8rem', padding: 24 }}>Sin filas para mostrar.</p>
              )}
            </div>
            <div className="re-modal-ft">
              <button type="button" className="re-btn re-btn-ghost" onClick={() => setShowResultModal(false)}>Cerrar</button>
              <button type="button" className="re-btn re-btn-ok" onClick={exportar} disabled={!filas.length}>
                <FileSpreadsheet size={14} /> Descargar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReporteConsultasEmbarazadas;
