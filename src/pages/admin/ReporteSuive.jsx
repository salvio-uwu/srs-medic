import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Calendar, Download, FileSpreadsheet, Loader2, Search, Trash2, Upload, Users,
  BarChart3, MapPin, ChevronDown, ChevronUp, Stethoscope,
  AlertCircle, AlertTriangle,
} from 'lucide-react';
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

const limpiarDescripcion = (desc, codigo) => {
  let limpia = (desc || '').trim();
  limpia = limpia.replace(/^\.?\d{1,2}\s*[-–—]\s*/, '').trim();
  if (codigo && limpia.toUpperCase().startsWith(codigo.toUpperCase())) {
    limpia = limpia.slice(codigo.length).replace(/^\s*[-–—]\s*/, '').trim();
  }
  return limpia || 'Sin descripción';
};

const reconstruirCodigo = (codigo, desc) => {
  const match = (desc || '').match(/^\.?(\d{1,2})\s*[-–—]/);
  if (match && codigo && !codigo.includes('.')) {
    return `${codigo}.${match[1]}`;
  }
  return codigo;
};

const parseCIE10 = (texto) => {
  if (!texto) return [];
  const matches = texto.match(/([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*[-–—]?\s*([^,;\n]*)/gi);
  if (!matches) return [];
  return matches.map((m) => {
    const parts = m.match(/^([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*[-–—]?\s*(.*)/i);
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

  let dxCol = grupoCol + 1;
  for (let c = grupoCol + 1; c <= Math.min(range.e.c, 10); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    const val = String(cell?.v || '').toLowerCase();
    if (val.includes('diagnos') || val.includes('diagn')) {
      dxCol = c;
      break;
    }
  }

  let epiCol = -1;
  for (let c = dxCol + 1; c <= Math.min(range.e.c, dxCol + 3); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    const val = String(cell?.v || '').toLowerCase();
    if (val.includes('epi') || val.includes('clave')) {
      epiCol = c;
      break;
    }
  }

  const subHeaderRow = headerRow + 1;
  const dataStartRow = subHeaderRow + 1;
  const firstDataCol = epiCol >= 0 ? epiCol + 1 : dxCol + 1;

  const ageGroupPairs = [];
  let c = firstDataCol;
  while (c + 1 <= range.e.c) {
    const cellA = ws[XLSX.utils.encode_cell({ r: subHeaderRow, c })];
    const cellB = ws[XLSX.utils.encode_cell({ r: subHeaderRow, c: c + 1 })];
    const vA = String(cellA?.v || '').toUpperCase().trim();
    const vB = String(cellB?.v || '').toUpperCase().trim();
    if ((vA === 'M' || vA === 'H') && (vB === 'F' || vB === 'M')) {
      ageGroupPairs.push({ mCol: c, fCol: c + 1 });
      c += 2;
    } else {
      break;
    }
  }

  let totalGeneralCol = c <= range.e.c ? c : -1;

  if (ageGroupPairs.length < 13) return null;

  return {
    headerRow,
    subHeaderRow,
    dataStartRow,
    grupoCol,
    dxCol,
    epiCol,
    ageGroupPairs: ageGroupPairs.slice(0, 11),
    ignPair: ageGroupPairs[11],
    totalPair: ageGroupPairs[12],
    totalGeneralCol: ageGroupPairs.length > 13 ? ageGroupPairs[13]?.mCol || totalGeneralCol : totalGeneralCol,
  };
};

const writeCell = (ws, r, c, value) => {
  const ref = XLSX.utils.encode_cell({ r, c });
  const existing = ws[ref] || {};
  if (value === 0 || value === '') {
    ws[ref] = { ...existing, v: value, t: typeof value === 'number' ? 'n' : 's' };
  } else {
    ws[ref] = { ...existing, v: value, t: typeof value === 'number' ? 'n' : 's' };
  }
};

/* ═══ ESTILOS ═══ */
const S = `
.rs { font-family: 'DM Sans', system-ui, sans-serif; }

/* ── Section header ── */
.rs-section { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; }
.rs-section-l h2 { font-family: 'Sora', sans-serif; font-size: 1.05rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; display: flex; align-items: center; gap: 9px; }
.rs-section-l p { font-size: .76rem; color: #64748b; margin: 0; }
.rs-section-r { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.rs-tag { display: inline-flex; align-items: center; gap: 5px; font-size: .68rem; font-weight: 600; padding: 5px 10px; border-radius: 999px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.rs-tag svg { color: #94a3b8; }

/* ── Panels (cards) ── */
.rs-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 14px; transition: box-shadow .2s; }
.rs-panel:hover { box-shadow: 0 2px 8px rgba(15,23,42,.04); }
.rs-panel-head { padding: 12px 18px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: #fafbfc; }
.rs-panel-head h3 { font-size: .82rem; font-weight: 600; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px; }
.rs-panel-head h3 svg { color: #0077B6; }
.rs-panel-body { padding: 18px; }

/* ── Form fields ── */
.rs-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.rs-field { display: flex; flex-direction: column; gap: 5px; }
.rs-field label { font-size: .65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; }
.rs-input-wrap { position: relative; }
.rs-input-wrap > svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
.rs-input { width: 100%; padding: 9px 12px 9px 32px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: .8rem; color: #334155; outline: none; font-family: inherit; transition: border .15s, box-shadow .15s; }
.rs-input:hover { border-color: #cbd5e1; }
.rs-input:focus { border-color: #0077B6; box-shadow: 0 0 0 3px rgba(0,119,182,.08); }
.rs-select { width: 100%; padding: 9px 32px 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 3l3 4 3-4'/%3E%3C/svg%3E") no-repeat right 11px center; font-size: .8rem; color: #334155; outline: none; font-family: inherit; cursor: pointer; appearance: none; -webkit-appearance: none; transition: border .15s, box-shadow .15s; }
.rs-select:hover { border-color: #cbd5e1; }
.rs-select:focus { border-color: #0077B6; box-shadow: 0 0 0 3px rgba(0,119,182,.08); }

/* ── Actions row ── */
.rs-actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
.rs-check { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-size: .76rem; font-weight: 500; color: #334155; cursor: pointer; user-select: none; transition: background .15s, border-color .15s; }
.rs-check:hover { background: #f1f5f9; border-color: #cbd5e1; }
.rs-check input { accent-color: #0077B6; cursor: pointer; }
.rs-check svg { color: #64748b; }

/* ── Buttons ── */
.rs-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 8px; font-size: .78rem; font-weight: 600; cursor: pointer; transition: background .15s, transform .12s, box-shadow .15s; border: 0; font-family: inherit; white-space: nowrap; }
.rs-btn-primary { background: #0077B6; color: #fff; box-shadow: 0 1px 2px rgba(0,119,182,.2); }
.rs-btn-primary:hover { background: #005B8E; box-shadow: 0 3px 8px rgba(0,119,182,.25); }
.rs-btn-primary:active { transform: translateY(1px); }
.rs-btn-primary:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
.rs-btn-success { background: #059669; color: #fff; box-shadow: 0 1px 2px rgba(5,150,105,.2); }
.rs-btn-success:hover { background: #047857; box-shadow: 0 3px 8px rgba(5,150,105,.25); }
.rs-btn-ghost { background: #fff; color: #334155; border: 1px solid #e2e8f0; }
.rs-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
.rs-ml-auto { margin-left: auto; }

/* ── Template area ── */
.rs-tpl { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rs-tpl-l { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rs-tpl-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px 6px 12px; border-radius: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; }
.rs-tpl-chip svg.rs-tpl-icon { color: #059669; flex-shrink: 0; }
.rs-tpl-chip span { font-size: .78rem; color: #065f46; font-weight: 500; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-tpl-chip button { padding: 2px; background: transparent; border: 0; cursor: pointer; color: #fb923c; transition: color .15s; display: flex; align-items: center; }
.rs-tpl-chip button:hover { color: #dc2626; }
.rs-tpl-empty { font-size: .76rem; color: #94a3b8; font-style: italic; }
.rs-tpl-hint { font-size: .7rem; color: #94a3b8; }
.rs-tpl-badge { font-size: .62rem; font-weight: 700; color: #059669; background: #ecfdf5; padding: 4px 10px; border-radius: 999px; border: 1px solid #a7f3d0; text-transform: uppercase; letter-spacing: .5px; }

/* ── Error ── */
.rs-error { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: 10px; border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; font-size: .78rem; margin-bottom: 14px; }
.rs-error svg { flex-shrink: 0; margin-top: 1px; color: #ef4444; }

/* ── KPIs ── */
.rs-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.rs-kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; transition: box-shadow .2s, border-color .2s; }
.rs-kpi:hover { box-shadow: 0 4px 12px rgba(15,23,42,.05); border-color: #cbd5e1; }
.rs-kpi-r { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
.rs-kpi-l { font-size: .66rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; }
.rs-kpi-i { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rs-kpi-v { font-size: 1.55rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.05; font-feature-settings: 'tnum'; }
.rs-kpi-s { font-size: .68rem; color: #94a3b8; margin-top: 3px; }
.rs-kpi-r-text { font-size: .72rem; color: #334155; font-weight: 600; margin: 0; line-height: 1.25; }
.rs-kpi-r-sub { font-size: .65rem; color: #94a3b8; margin-top: 2px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Table wrap (SUIVE matrix) ── */
.rs-tw { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 14px; }
.rs-tw-head { padding: 12px 18px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: #fafbfc; }
.rs-tw-title { font-size: .82rem; font-weight: 600; color: #0f172a; display: flex; align-items: center; gap: 8px; }
.rs-tw-title svg { color: #0077B6; }
.rs-tw-count { font-size: .65rem; color: #475569; background: #fff; padding: 3px 10px; border-radius: 999px; font-weight: 700; border: 1px solid #e2e8f0; }
.rs-legend { display: flex; align-items: center; gap: 14px; font-size: .68rem; color: #64748b; }
.rs-legend-i { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
.rs-legend-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

.rs-tw-foot { padding: 12px 18px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: #fafbfc; }
.rs-tw-foot-text { font-size: .73rem; color: #64748b; }
.rs-tw-foot-text b { color: #0f172a; font-weight: 700; }

/* ── SUIVE table ── */
.rs-suive-scroll { overflow: auto; max-height: 72vh; position: relative; }
.rs-suive-scroll::-webkit-scrollbar { height: 11px; width: 11px; }
.rs-suive-scroll::-webkit-scrollbar-track { background: #f8fafc; }
.rs-suive-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; border: 2px solid #f8fafc; }
.rs-suive-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

table.rs-suive { width: 100%; border-collapse: separate; border-spacing: 0; font-size: .68rem; line-height: 1.3; font-feature-settings: 'tnum'; }

/* SUIVE: thead */
.rs-suive thead { position: sticky; top: 0; z-index: 20; }
.rs-suive thead tr.rs-th-row-1 th { background: #f1f5f9; padding: 9px 6px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #e2e8f0; font-size: .65rem; }
.rs-suive thead tr.rs-th-row-2 th { background: #f8fafc; padding: 6px 4px; font-weight: 600; font-size: .58rem; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; text-align: center; text-transform: uppercase; letter-spacing: .3px; }
.rs-suive thead tr.rs-th-row-1 th.rs-th-grupo,
.rs-suive thead tr.rs-th-row-1 th.rs-th-dx { text-align: left; padding: 9px 12px; }
.rs-suive thead tr.rs-th-row-1 th.rs-th-ign-h,
.rs-suive thead tr.rs-th-row-2 th.rs-th-ign-c { background: #f5f3ff; color: #6b21a8; }
.rs-suive thead tr.rs-th-row-1 th.rs-th-tot-h,
.rs-suive thead tr.rs-th-row-2 th.rs-th-tot-c { background: #eff6ff; color: #1d4ed8; }
.rs-suive thead tr.rs-th-row-1 th.rs-th-final { background: #0077B6; color: #fff; min-width: 48px; }

.rs-th-grupo { min-width: 180px; position: sticky; left: 0; z-index: 25; }
.rs-th-dx { min-width: 240px; position: sticky; left: 180px; z-index: 25; box-shadow: 1px 0 0 0 #e2e8f0; }
.rs-th-h { color: #2563eb !important; }
.rs-th-m { color: #db2777 !important; }
.rs-th-i { color: #64748b !important; }

/* SUIVE: tbody */
.rs-suive tbody td { padding: 6px 5px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f8fafc; text-align: center; color: #475569; }
.rs-suive tbody tr:hover td { background: #fffbeb !important; }

.rs-td-grupo { font-size: .62rem; font-weight: 700; color: #1e293b; text-align: left !important; padding: 8px 12px !important; vertical-align: top; position: sticky; left: 0; z-index: 5; border-right: 1px solid #e2e8f0 !important; line-height: 1.35; }
.rs-td-dx { text-align: left !important; padding: 7px 12px !important; color: #334155; position: sticky; left: 180px; z-index: 5; border-right: 1px solid #e2e8f0 !important; box-shadow: 1px 0 0 0 #e2e8f0; }
.rs-td-dx-desc { font-weight: 500; font-size: .72rem; }
.rs-td-dx-code { font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace; font-size: .62rem; color: #64748b; margin-left: 6px; padding: 1px 5px; background: #f1f5f9; border-radius: 4px; }
.rs-td-zero { color: #cbd5e1; }
.rs-td-num { color: #334155; }
.rs-td-ign { background: #faf5ff; color: #7c3aed; font-size: .62rem; }
.rs-td-tot { background: #eff6ff; color: #1d4ed8; font-weight: 700; }
.rs-td-final { background: #dbeafe; color: #1e3a8a; font-weight: 800; font-size: .74rem; }

/* Group background alternation */
.rs-bg-a, .rs-bg-a > td.rs-td-grupo, .rs-bg-a > td.rs-td-dx { background: #fff; }
.rs-bg-b, .rs-bg-b > td.rs-td-grupo, .rs-bg-b > td.rs-td-dx { background: #fafbfc; }

/* Totals row */
.rs-suive tbody tr.rs-tot-row td { background: #1e293b !important; color: #f1f5f9 !important; font-weight: 700; padding: 9px 5px; position: sticky; bottom: 0; z-index: 6; border-top: 2px solid #0f172a !important; border-bottom: 0 !important; }
.rs-suive tbody tr.rs-tot-row td.rs-tot-label { font-size: .68rem; text-align: right !important; padding: 9px 14px !important; letter-spacing: .3px; text-transform: uppercase; color: #cbd5e1 !important; }
.rs-suive tbody tr.rs-tot-row td.rs-td-ign { background: #312e81 !important; color: #ddd6fe !important; }
.rs-suive tbody tr.rs-tot-row td.rs-td-tot { background: #1e40af !important; color: #dbeafe !important; }
.rs-suive tbody tr.rs-tot-row td.rs-td-final { background: #0077B6 !important; color: #fff !important; font-size: .8rem; }

/* ── Pacientes (collapsible) ── */
.rs-coll-head { width: 100%; padding: 13px 18px; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #fff; border: 0; cursor: pointer; transition: background .15s; font-family: inherit; }
.rs-coll-head:hover { background: #f8fafc; }
.rs-coll-l { display: flex; align-items: center; gap: 9px; }
.rs-coll-l span.rs-coll-title { font-size: .82rem; font-weight: 600; color: #0f172a; }
.rs-coll-l svg { color: #0077B6; }
.rs-coll-body { border-top: 1px solid #e2e8f0; overflow-x: auto; }

table.rs-px { width: 100%; border-collapse: collapse; font-size: .76rem; }
.rs-px th { font-size: .62rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; text-align: left; padding: 11px 14px; border-bottom: 1px solid #e2e8f0; background: #fafbfc; white-space: nowrap; }
.rs-px td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.rs-px tbody tr:hover td { background: #fffbeb; }
.rs-px-name { font-weight: 500; color: #0f172a; }
.rs-px-dx { max-width: 320px; }
.rs-px-fecha { font-size: .7rem; color: #64748b; white-space: nowrap; }
.rs-px-num { color: #94a3b8; font-size: .68rem; font-feature-settings: 'tnum'; }

.rs-sx { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 5px; font-size: .62rem; font-weight: 700; letter-spacing: .3px; }
.rs-sx-h { background: #eff6ff; color: #2563eb; }
.rs-sx-m { background: #fdf2f8; color: #db2777; }
.rs-sx-i { background: #f1f5f9; color: #64748b; }

/* ── Empty state ── */
.rs-empty { text-align: center; padding: 60px 24px; }
.rs-empty-icon { width: 60px; height: 60px; margin: 0 auto 14px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
.rs-empty-icon.blue { background: #eff6ff; }
.rs-empty-icon.slate { background: #f1f5f9; }
.rs-empty-title { font-size: .9rem; font-weight: 600; color: #334155; margin: 0 0 4px; font-family: 'Sora', sans-serif; }
.rs-empty-text { font-size: .75rem; color: #94a3b8; max-width: 380px; margin: 0 auto; line-height: 1.5; }

/* ── Responsive ── */
@media (max-width: 980px) {
  .rs-fields { grid-template-columns: repeat(2, 1fr); }
  .rs-kpis { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .rs-fields { grid-template-columns: 1fr; }
  .rs-kpis { grid-template-columns: 1fr; }
  .rs-actions { flex-direction: column; align-items: stretch; }
  .rs-actions .rs-btn { width: 100%; justify-content: center; }
  .rs-ml-auto { margin-left: 0; }
}
`;

/* ─── Componente principal ─── */
const ReporteSuive = () => {
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [consultorios, setConsultorios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursales, setSelectedSucursales] = useState([]);
  const [selectedConsultorios, setSelectedConsultorios] = useState([]);
  const [incluirRelacion, setIncluirRelacion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState(null);
  const [detallePacientes, setDetallePacientes] = useState([]);
  const [templateName, setTemplateName] = useState(getTemplateName);
  const [showPacientes, setShowPacientes] = useState(false);
  const fileInputRef = useRef(null);
  const [advertencias, setAdvertencias] = useState([]);
  const [showSucursales, setShowSucursales] = useState(false);
  const [showConsultorios, setShowConsultorios] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!showSucursales && !showConsultorios) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSucursales(false);
        setShowConsultorios(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSucursales, showConsultorios]);

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

  /* Cargar catálogos de sucursales y consultorios */
  const consultoriosInicializados = useRef(false);
  useEffect(() => {
    const qSuc = query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc'));
    const unsubSuc = onSnapshot(qSuc, (snap) => {
      setSucursales(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.activo !== false));
    });

    const qCon = query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc'));
    const unsubCon = onSnapshot(qCon, (snap) => {
      setConsultorios(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.activo !== false));
    });

    return () => { unsubSuc(); unsubCon(); };
  }, []);

  useEffect(() => {
    if (consultorios.length > 0 && !consultoriosInicializados.current) {
      setSelectedConsultorios(consultorios.map((c) => c.id));
      setSelectedSucursales([]);
      consultoriosInicializados.current = true;
    }
  }, [consultorios]);

  /* Al cambiar sucursales seleccionadas, filtrar consultorios visibles */
  const consultoriosFiltradosPorSucursal = useMemo(() => {
    if (selectedSucursales.length === 0) return consultorios;
    const sucSet = new Set(selectedSucursales);
    return consultorios.filter((c) => sucSet.has(c.sucursalId));
  }, [consultorios, selectedSucursales]);

  /* Sincronizar selectedConsultorios cuando cambia el filtro de sucursal */
  useEffect(() => {
    if (consultoriosFiltradosPorSucursal.length === 0) return;
    const visibles = new Set(consultoriosFiltradosPorSucursal.map((c) => c.id));
    setSelectedConsultorios((prev) => {
      if (prev.length === 0) return consultoriosFiltradosPorSucursal.map((c) => c.id);
      return prev.filter((id) => visibles.has(id));
    });
  }, [consultoriosFiltradosPorSucursal]);

  const toggleSucursal = (id, all) => {
    if (all) {
      setSelectedSucursales([]);
      return;
    }
    setSelectedSucursales((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next;
      }
      return [...prev, id];
    });
  };

  const toggleConsultorio = (id, all) => {
    if (all) {
      setSelectedConsultorios(consultoriosFiltradosPorSucursal.map((c) => c.id));
      return;
    }
    setSelectedConsultorios((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next.length === 0 ? prev : next;
      }
      return [...prev, id];
    });
  };

  /* ─── Generar reporte ─── */
  const generarReporte = async () => {
    setLoading(true);
    setError('');
    setResultados(null);
    setDetallePacientes([]);
    setAdvertencias([]);

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
      let historiales = histSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      /* 1b) Consultar consultas (consultorio rápido) — sin índice, filtramos client-side */
      let consultasRapidas = [];
      try {
        const qConsultas = query(collection(db, 'consultas'), orderBy('fecha', 'asc'));
        const consultasSnap = await getDocs(qConsultas);
        const fechaInicioStr = `${fechaInicio}T00:00:00.000Z`;
        const fechaFinStr = `${fechaFin}T23:59:59.999Z`;
        consultasRapidas = consultasSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((c) => {
            const f = String(c.fecha || '');
            return f >= fechaInicioStr && f <= fechaFinStr && String(c.diagnostico || '').trim();
          });
      } catch (e) {
        console.warn('No se pudieron consultar las consultas rápidas:', e);
      }

      if (historiales.length === 0 && consultasRapidas.length === 0) {
        setError('No se encontraron consultas en el rango de fechas seleccionado.');
        setLoading(false);
        return;
      }

      /* 2) Obtener IDs únicos de pacientes (solo de historial_clinico) */
      const pacienteIds = [...new Set(historiales.map((h) => h.pacienteId).filter(Boolean))];

      /* 3) Batch fetch de pacientes (sexo, nombre, fecha nacimiento) */
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

      /* 4) Filtrar por consultorios seleccionados */
      const advertenciasLista = [];
      let historialesFiltrados = historiales;
      let consultasExcluidasConsultorio = 0;
      const todosConsultoriosSeleccionados = selectedConsultorios.length >= consultorios.length;

      if (!todosConsultoriosSeleccionados && selectedConsultorios.length > 0) {
        const selectedSet = new Set(selectedConsultorios);
        const nombresConsultorios = new Set(
          consultorios.filter((c) => selectedSet.has(c.id)).map((c) => c.nombre).filter(Boolean)
        );

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

        const antes = historiales.length;
        historialesFiltrados = historiales.filter((h) => {
          if (h.consultorioId) return selectedSet.has(h.consultorioId);
          if (h.consultorioNombre) return nombresConsultorios.has(h.consultorioNombre);
          if (h.citaId) {
            const cita = citasMap.get(h.citaId);
            if (!cita) return false;
            return selectedSet.has(cita.consultorioId) || nombresConsultorios.has(cita.consultorioNombre);
          }
          return false;
        });
        consultasExcluidasConsultorio = antes - historialesFiltrados.length;
        if (consultasExcluidasConsultorio > 0) {
          advertenciasLista.push(`${consultasExcluidasConsultorio} consultas excluidas por no pertenecer a los consultorios seleccionados.`);
        }

        if (historialesFiltrados.length === 0 && consultasRapidas.length === 0) {
          setError('No se encontraron consultas para los consultorios seleccionados en el rango de fechas.');
          setLoading(false);
          return;
        }
      }

      /* 5) Procesar datos: extraer diagnósticos y agrupar */
      const agrupado = {};
      const listaPacientes = [];
      let consultasSinCIE10 = 0;

      const procesarRegistro = (h, pxData, consultaFecha, origen) => {
        let diagnosticos = [];

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

        if (diagnosticos.length === 0) {
          const textoEnf = h.consulta?.diagnostico?.enfermedad_actual || '';
          diagnosticos = parseCIE10(textoEnf);
        }

        if (diagnosticos.length === 0) {
          consultasSinCIE10++;
          return;
        }

        const sexoNorm = pxData.sexo || 'I';
        const grupoEdadIdx = pxData.grupoEdadIdx;

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
              paciente: pxData.nombre || h.pacienteNombre || 'Sin nombre',
              sexo: sexoNorm,
              edad: pxData.edad >= 0 ? pxData.edad : '?',
              diagnostico: `${dx.codigo} - ${dx.descripcion}`,
              fecha: consultaFecha.toLocaleDateString('es-MX'),
              medico: h.medicoNombre || '',
              origen,
            });
          }
        }
      };

      /* Procesar historial_clinico */
      for (const h of historialesFiltrados) {
        const fechaConsulta = h.fecha?.toDate ? h.fecha.toDate() : new Date();
        const px = pacientesMap.get(h.pacienteId) || {};
        const fechaNac = h.px_info?.fecha_nacimiento || px.fechaNacimiento || '';
        const edad = calcularEdad(fechaNac, fechaConsulta);
        const pxData = {
          sexo: normalizeSexo(px.sexo),
          nombre: px.nombre || h.pacienteNombre || '',
          grupoEdadIdx: getGrupoEdadIdx(edad),
          edad,
        };
        procesarRegistro(h, pxData, fechaConsulta, 'expediente');
      }

      /* Procesar consultas (consultorio rápido) */
      for (const c of consultasRapidas) {
        let diagnosticos = parseCIE10(c.diagnostico || '');
        if (diagnosticos.length === 0) {
          consultasSinCIE10++;
          continue;
        }

        const fechaConsulta = new Date(c.fecha || Date.now());
        const edadRaw = parseInt(c.paciente?.edad, 10);
        const edad = Number.isNaN(edadRaw) ? -1 : edadRaw;
        const sexoNorm = 'I';
        const pxData = {
          sexo: sexoNorm,
          nombre: c.paciente?.nombre || '',
          grupoEdadIdx: getGrupoEdadIdx(edad),
          edad,
        };

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
          if (pxData.grupoEdadIdx >= 0) {
            entry.conteo[pxData.grupoEdadIdx][sexoNorm]++;
          } else {
            entry.ignorados[sexoNorm]++;
          }
          entry.total[sexoNorm]++;
        }

        if (incluirRelacion) {
          for (const dx of diagnosticos) {
            listaPacientes.push({
              paciente: pxData.nombre || c.paciente?.nombre || 'Sin nombre',
              sexo: sexoNorm,
              edad: edad >= 0 ? edad : '?',
              diagnostico: `${dx.codigo} - ${dx.descripcion}`,
              fecha: fechaConsulta.toLocaleDateString('es-MX'),
              medico: c.doctorNombre || '',
              origen: 'consultorio',
            });
          }
        }
      }

      if (consultasSinCIE10 > 0) {
        advertenciasLista.push(`${consultasSinCIE10} consultas no contienen un código CIE-10 válido y fueron omitidas del reporte.`);
      }
      if (consultasRapidas.length > 0) {
        advertenciasLista.push(`${consultasRapidas.length} consultas del módulo rápido fueron incluidas. El sexo no se registra en este módulo (figura como Indeterminado).`);
      }

      /* 6) Convertir a array ordenado */
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
      setAdvertencias(advertenciasLista);
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

        let currentRow = dataStartRow;
        for (const row of resultados) {
          writeCell(ws, currentRow, grupoCol, row.grupo);
          writeCell(ws, currentRow, dxCol, `${row.descripcion} ${row.codigo}`);
          if (epiCol >= 0) {
            writeCell(ws, currentRow, epiCol, row.codigo);
          }

          for (let i = 0; i < Math.min(ageGroupPairs.length, GRUPOS_EDAD.length); i++) {
            const pair = ageGroupPairs[i];
            const mVal = row.conteo[i].H;
            const fVal = row.conteo[i].M;
            writeCell(ws, currentRow, pair.mCol, mVal);
            writeCell(ws, currentRow, pair.fCol, fVal);
          }

          if (ignPair) {
            writeCell(ws, currentRow, ignPair.mCol, row.ignorados.H);
            writeCell(ws, currentRow, ignPair.fCol, row.ignorados.M);
          }

          if (totalPair) {
            writeCell(ws, currentRow, totalPair.mCol, row.total.H);
            writeCell(ws, currentRow, totalPair.fCol, row.total.M);
          }

          if (totalGeneralCol >= 0) {
            writeCell(ws, currentRow, totalGeneralCol, row.total.H + row.total.M + row.total.I);
          }

          currentRow++;
        }

        const oldRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        if (currentRow - 1 > oldRange.e.r) {
          oldRange.e.r = currentRow - 1;
          ws['!ref'] = XLSX.utils.encode_range(oldRange);
        }

        if (detallePacientes.length > 0) {
          const encPx = ['Paciente', 'Sexo', 'Edad', 'Diagnóstico', 'Fecha', 'Médico', 'Origen'];
          const filasPx = [encPx, ...detallePacientes.map((p) => [p.paciente, p.sexo, p.edad, p.diagnostico, p.fecha, p.medico, p.origen === 'consultorio' ? 'Consultorio rápido' : 'Expediente'])];
          const wsPx = XLSX.utils.aoa_to_sheet(filasPx);
          wsPx['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 50 }, { wch: 14 }, { wch: 30 }, { wch: 18 }];
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

    const encabezadoFila1 = ['Grupo', 'Diagnóstico y código CIE10'];
    const encabezadoFila2 = ['', ''];

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

    const merges = [];
    let col = 2;
    for (let i = 0; i < GRUPOS_EDAD.length; i++) {
      merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } });
      col += 3;
    }
    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } });
    col += 3;
    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } });
    col += 3;

    ws['!merges'] = merges;

    const colWidths = [{ wch: 40 }, { wch: 40 }];
    for (let i = 0; i < (GRUPOS_EDAD.length + 1) * 3 + 4; i++) {
      colWidths.push({ wch: 5 });
    }
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'SUIVE');

    if (detallePacientes.length > 0) {
      const encPx = ['Paciente', 'Sexo', 'Edad', 'Diagnóstico', 'Fecha', 'Médico', 'Origen'];
      const filasPx = [encPx, ...detallePacientes.map((p) => [p.paciente, p.sexo, p.edad, p.diagnostico, p.fecha, p.medico, p.origen === 'consultorio' ? 'Consultorio rápido' : 'Expediente'])];
      const wsPx = XLSX.utils.aoa_to_sheet(filasPx);
      wsPx['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 50 }, { wch: 14 }, { wch: 30 }, { wch: 18 }];
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

  /* ─── Nombre del consultorio seleccionado ─── */
  const consultorioNombre = useMemo(() => {
    if (selectedConsultorios.length === 0) return 'Todos los consultorios';
    if (selectedConsultorios.length >= consultorios.length && selectedSucursales.length === 0) return 'Todos los consultorios';
    if (selectedConsultorios.length === 1) {
      const c = consultorios.find((c) => c.id === selectedConsultorios[0]);
      return c ? `${c.nombre}${c.sucursal ? ` (${c.sucursal})` : ''}` : 'Seleccionado';
    }
    return `${selectedConsultorios.length} consultorios`;
  }, [selectedConsultorios, consultorios, selectedSucursales]);

  const sucursalNombre = useMemo(() => {
    if (selectedSucursales.length === 0) return 'Todas las sucursales';
    if (selectedSucursales.length === 1) {
      const s = sucursales.find((s) => s.id === selectedSucursales[0]);
      return s?.nombre || 'Seleccionada';
    }
    return `${selectedSucursales.length} sucursales`;
  }, [selectedSucursales, sucursales]);

  /* ─── Formatear rango de fechas ─── */
  const rangoTexto = useMemo(() => {
    const fi = new Date(`${fechaInicio}T00:00:00`);
    const ff = new Date(`${fechaFin}T23:59:59`);
    if (Number.isNaN(fi.getTime()) || Number.isNaN(ff.getTime())) return '';
    const opciones = { year: 'numeric', month: 'short', day: 'numeric' };
    return `${fi.toLocaleDateString('es-MX', opciones)} — ${ff.toLocaleDateString('es-MX', opciones)}`;
  }, [fechaInicio, fechaFin]);

  /* Mapeo cíclico de grupos a clase de fondo (a/b alternados) */
  const grupoBgMap = useMemo(() => {
    if (!resultados) return {};
    const grupos = [...new Set(resultados.map((r) => r.grupo))];
    const map = {};
    grupos.forEach((g, i) => { map[g] = i % 2 === 0 ? 'rs-bg-a' : 'rs-bg-b'; });
    return map;
  }, [resultados]);

  /* ─── Render ─── */
  const ckInputStyle = { accentColor: '#0077B6', cursor: 'pointer', width: 13, height: 13, flexShrink: 0 };
  const inputStyle = { padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '.74rem', color: '#334155', outline: 'none', fontFamily: 'inherit', width: 142 };
  const toggleBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fafbfc', fontSize: '.7rem', fontWeight: 600, color: '#334155', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 1 };
  const ckDropdownItem = { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: '.72rem', color: '#334155', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <div className="rs">
      <style>{S}</style>

      {/* ═══ Section header (compacto) ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: '.9rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Stethoscope size={16} color="#0077B6" /> SUIVE
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="rs-tag"><Calendar size={10} /> {rangoTexto}</span>
          <span className="rs-tag"><MapPin size={10} /> {sucursalNombre}</span>
          <span className="rs-tag"><MapPin size={10} /> {consultorioNombre}</span>
        </div>
      </div>

      {/* ═══ Filtros ═══ */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: '.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px' }}>Inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: '.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px' }}>Fin</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ height: 1, width: 1, background: '#e2e8f0', alignSelf: 'stretch', margin: '4px 2px' }} />

            <div ref={dropdownRef} style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowSucursales(!showSucursales); setShowConsultorios(false); }} style={toggleBtnStyle}>
                Sucursales {showSucursales ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '.62rem' }}>{selectedSucursales.length === 0 ? 'Todas' : selectedSucursales.length}</span>
              </button>
              {showSucursales && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,.12)', zIndex: 50, minWidth: 220, padding: '4px 0', animation: 'rpFadeIn .15s ease' }}>
                  <div style={{ maxHeight: 170, overflowY: 'auto', paddingRight: 2 }} className="rs-suive-scroll">
                    <label style={{ ...ckDropdownItem, fontWeight: 600, color: '#0f172a' }}>
                      <input type="checkbox" checked={selectedSucursales.length === 0} onChange={() => setSelectedSucursales([])} style={ckInputStyle} />
                      Todas las sucursales
                    </label>
                    {sucursales.map((s) => (
                      <label key={s.id} style={ckDropdownItem}>
                        <input type="checkbox" checked={selectedSucursales.includes(s.id)} onChange={() => toggleSucursal(s.id, false)} style={ckInputStyle} />
                        {s.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowConsultorios(!showConsultorios); setShowSucursales(false); }} style={toggleBtnStyle}>
                Consultorios {showConsultorios ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '.62rem' }}>{selectedConsultorios.length >= consultorios.length ? 'Todos' : selectedConsultorios.length}</span>
              </button>
              {showConsultorios && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,.12)', zIndex: 50, minWidth: 220, padding: '4px 0', animation: 'rpFadeIn .15s ease' }}>
                  <div style={{ maxHeight: 170, overflowY: 'auto', paddingRight: 2 }} className="rs-suive-scroll">
                    <label style={{ ...ckDropdownItem, fontWeight: 600, color: '#0f172a' }}>
                      <input type="checkbox" checked={selectedConsultorios.length >= consultoriosFiltradosPorSucursal.length} onChange={(e) => { if (e.target.checked) toggleConsultorio(null, true); }} style={ckInputStyle} />
                      Todos los consultorios
                    </label>
                    {consultoriosFiltradosPorSucursal.map((c) => (
                      <label key={c.id} style={ckDropdownItem}>
                        <input type="checkbox" checked={selectedConsultorios.includes(c.id)} onChange={() => toggleConsultorio(c.id, false)} style={ckInputStyle} />
                        {c.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>

            <div style={{ height: 1, width: 1, background: '#e2e8f0', alignSelf: 'stretch', margin: '4px 2px' }} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.7rem', color: '#64748b', cursor: 'pointer', userSelect: 'none', paddingBottom: 5 }}>
              <input type="checkbox" checked={incluirRelacion} onChange={(e) => setIncluirRelacion(e.target.checked)} style={{ accentColor: '#0077B6' }} />
              <Users size={11} />
              Relación
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.68rem', color: '#94a3b8', paddingBottom: 4 }}>
              {templateName ? (
                <>
                  <FileSpreadsheet size={11} color="#059669" />
                  <span style={{ color: '#065f46', fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{templateName}</span>
                  <button onClick={handleRemoveTemplate} title="Quitar" style={{ padding: '0 2px', background: 'transparent', border: 0, cursor: 'pointer', color: '#94a3b8', fontSize: '.6rem' }}><Trash2 size={9} /></button>
                </>
              ) : (
                <span style={{ cursor: 'pointer', paddingBottom: 1 }} onClick={() => fileInputRef.current?.click()}><Upload size={10} /> Plantilla</span>
              )}
            </div>
          </div>
          <button onClick={generarReporte} disabled={loading} className="rs-btn rs-btn-primary" style={{ padding: '6px 16px', fontSize: '.72rem' }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            {loading ? 'Generando...' : 'Generar'}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleTemplateUpload} style={{ display: 'none' }} />
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <div className="rs-error">
          <AlertCircle size={15} />
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* ═══ Advertencias ═══ */}
      {advertencias.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
          padding: '14px 16px', marginBottom: '14px'
        }}>
          {advertencias.map((adv, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '.76rem', color: '#92400e' }}>
              {i === 0 ? <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: '#d97706' }} /> : <span style={{ width: 15, flexShrink: 0 }} />}
              <span>{adv}</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Resultados ═══ */}
      {resultados && resultados.length > 0 && (
        <>
          {/* ── Tabla SUIVE ── */}
          <div className="rs-tw">
            <div className="rs-tw-head">
              <div className="rs-tw-title">
                <BarChart3 size={14} />
                Matriz de morbilidad SUIVE
                <span className="rs-tw-count">{resultados.length} dx</span>
              </div>
              <div className="rs-legend">
                <span className="rs-legend-i"><span className="rs-legend-dot" style={{ background: '#3b82f6' }} /> Hombre</span>
                <span className="rs-legend-i"><span className="rs-legend-dot" style={{ background: '#ec4899' }} /> Mujer</span>
                <span className="rs-legend-i"><span className="rs-legend-dot" style={{ background: '#94a3b8' }} /> Indeterm.</span>
              </div>
            </div>

            <div className="rs-suive-scroll">
              <table className="rs-suive">
                <thead>
                  <tr className="rs-th-row-1">
                    <th rowSpan={2} className="rs-th-grupo">Grupo SUIVE</th>
                    <th rowSpan={2} className="rs-th-dx">Diagnóstico · CIE-10</th>
                    {GRUPOS_EDAD.map((ge) => (
                      <th key={ge.label} colSpan={3}>{ge.label}</th>
                    ))}
                    <th colSpan={3} className="rs-th-ign-h">Ignorados</th>
                    <th colSpan={3} className="rs-th-tot-h">Total</th>
                    <th rowSpan={2} className="rs-th-final">T</th>
                  </tr>
                  <tr className="rs-th-row-2">
                    {[...GRUPOS_EDAD, { label: 'Ignorados' }, { label: 'Total' }].map((ge, gi) =>
                      SEXOS.map((s) => {
                        const isIgn = gi === GRUPOS_EDAD.length;
                        const isTot = gi === GRUPOS_EDAD.length + 1;
                        const cls = `${s === 'H' ? 'rs-th-h' : s === 'M' ? 'rs-th-m' : 'rs-th-i'}${isIgn ? ' rs-th-ign-c' : ''}${isTot ? ' rs-th-tot-c' : ''}`;
                        return <th key={`${ge.label}-${s}`} className={cls}>{s}</th>;
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((row, idx) => {
                    const totalGeneral = row.total.H + row.total.M + row.total.I;
                    const showGrupo = idx === 0 || resultados[idx - 1].grupo !== row.grupo;
                    const grupoRowSpan = showGrupo
                      ? resultados.filter((r) => r.grupo === row.grupo).length
                      : 0;
                    const bgClass = grupoBgMap[row.grupo] || 'rs-bg-a';

                    return (
                      <tr key={`${row.codigo}-${idx}`} className={bgClass}>
                        {showGrupo && (
                          <td rowSpan={grupoRowSpan} className="rs-td-grupo">{row.grupo}</td>
                        )}
                        <td className="rs-td-dx">
                          <span className="rs-td-dx-desc">{row.descripcion}</span>
                          <span className="rs-td-dx-code">{row.codigo}</span>
                        </td>
                        {row.conteo.map((c, ci) =>
                          SEXOS.map((s) => (
                            <td key={`${ci}-${s}`} className={c[s] ? 'rs-td-num' : 'rs-td-zero'}>
                              {c[s] || '·'}
                            </td>
                          ))
                        )}
                        {SEXOS.map((s) => (
                          <td key={`ign-${s}`} className={`rs-td-ign ${row.ignorados[s] ? '' : 'rs-td-zero'}`}>
                            {row.ignorados[s] || '·'}
                          </td>
                        ))}
                        {SEXOS.map((s) => (
                          <td key={`tot-${s}`} className="rs-td-tot">
                            {row.total[s] || 0}
                          </td>
                        ))}
                        <td className="rs-td-final">{totalGeneral}</td>
                      </tr>
                    );
                  })}

                  {/* Fila de totales */}
                  {totalesGenerales && (
                    <tr className="rs-tot-row">
                      <td colSpan={2} className="rs-tot-label">TOTAL GENERAL</td>
                      {totalesGenerales.conteo.map((c, ci) =>
                        SEXOS.map((s) => (
                          <td key={`gt-${ci}-${s}`}>{c[s]}</td>
                        ))
                      )}
                      {SEXOS.map((s) => (
                        <td key={`gign-${s}`} className="rs-td-ign">{totalesGenerales.ignorados[s]}</td>
                      ))}
                      {SEXOS.map((s) => (
                        <td key={`gtot-${s}`} className="rs-td-tot">{totalesGenerales.total[s]}</td>
                      ))}
                      <td className="rs-td-final">
                        {totalesGenerales.total.H + totalesGenerales.total.M + totalesGenerales.total.I}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rs-tw-foot">
              <p className="rs-tw-foot-text">
                <b>{resultados.length}</b> diagnósticos
                {detallePacientes.length > 0 && (
                  <> · <b>{detallePacientes.length}</b> registros de pacientes</>
                )}
              </p>
              <button onClick={exportarXLSX} className="rs-btn rs-btn-success">
                <Download size={13} />
                {templateName ? 'Descargar con plantilla oficial' : 'Descargar XLSX'}
              </button>
            </div>
          </div>

          {/* ── Relación de pacientes (colapsable) ── */}
          {detallePacientes.length > 0 && (
            <div className="rs-panel">
              <button
                onClick={() => setShowPacientes(!showPacientes)}
                className="rs-coll-head"
              >
                <div className="rs-coll-l">
                  <Users size={15} />
                  <span className="rs-coll-title">Relación de pacientes</span>
                  <span className="rs-tw-count">{detallePacientes.length}</span>
                </div>
                {showPacientes ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
              </button>

              {showPacientes && (
                <div className="rs-coll-body">
                  <table className="rs-px">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Paciente</th>
                        <th>Sexo</th>
                        <th>Edad</th>
                        <th>Diagnóstico</th>
                        <th>Fecha</th>
                        <th>Médico</th>
                        <th>Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detallePacientes.map((p, i) => (
                        <tr key={i}>
                          <td className="rs-px-num">{i + 1}</td>
                          <td className="rs-px-name">{p.paciente}</td>
                          <td>
                            <span className={`rs-sx rs-sx-${p.sexo.toLowerCase()}`}>{p.sexo}</span>
                          </td>
                          <td>{p.edad}</td>
                          <td className="rs-px-dx" title={p.diagnostico}>{p.diagnostico}</td>
                          <td className="rs-px-fecha">{p.fecha}</td>
                          <td>{p.medico || '—'}</td>
                          <td className="rs-px-fecha">{p.origen === 'consultorio' ? 'Rápido' : 'Expediente'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ Sin resultados ═══ */}
      {resultados && resultados.length === 0 && (
        <div className="rs-panel">
          <div className="rs-empty">
            <div className="rs-empty-icon slate">
              <FileSpreadsheet size={28} color="#94a3b8" />
            </div>
            <p className="rs-empty-title">Sin diagnósticos CIE-10</p>
            <p className="rs-empty-text">
              No se encontraron diagnósticos CIE-10 en las consultas del periodo seleccionado.
            </p>
          </div>
        </div>
      )}

      {/* ═══ Estado inicial ═══ */}
      {!resultados && !loading && !error && (
        <div className="rs-panel">
          <div className="rs-empty">
            <div className="rs-empty-icon blue">
              <BarChart3 size={28} color="#0077B6" />
            </div>
            <p className="rs-empty-title">Genera tu reporte SUIVE</p>
            <p className="rs-empty-text">
              Configura las fechas, selecciona un consultorio y haz clic en "Generar reporte" para visualizar la matriz de morbilidad.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReporteSuive;
