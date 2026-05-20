import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  ArrowLeft, ArrowRight,
  Bold, ChevronDown, ChevronRight,
  Copy, Eye,
  FileText, FilePlus2,
  Grip, Highlighter, ImagePlus, Italic,
  Layers, List, ListOrdered,
  Minus, MousePointer2, Plus, Save,
  SquareDashed, Trash2, Type,
  Underline, Upload, Variable, X,
  ZoomIn, ZoomOut, Grid3X3, Settings2, Search
} from 'lucide-react';
import {
  addDoc, collection, deleteDoc, doc, getDoc,
  onSnapshot, orderBy, query,
  serverTimestamp, updateDoc
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { goBackOr } from '../../utils/navigation';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import logoAzul from '../../assets/logo_azul.png';

const PAGE = { width: 816, height: 1056 };
const DOC_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };
const RECIPE_DOC_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };
const DOC_BASE_FONT_PT = 12;
const FONT_FAMILY_OPTIONS = [
  'Trebuchet MS',
  'Arial',
  'Verdana',
  'Tahoma',
  'Calibri',
  'Georgia',
  'Times New Roman'
];
const LINE_HEIGHT_OPTIONS = [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2];
const AUTOSAVE_STORAGE_KEY = 'plantillas_documentos_autosave_v1';
const AUTOSAVE_DEBOUNCE_MS = 700;

const formatDateLongEsMx = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = date.toLocaleDateString('es-MX', { month: 'long' });
  const anio = date.getFullYear();
  return `${dia} de ${mes} del ${anio}`;
};

const formatIssuedTimeEsMx = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const loadAutosaveDraft = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.editor || !Array.isArray(parsed.editor.elements)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistAutosaveDraft = (draft) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage quota errors to avoid interrupting editor flow.
  }
};

export const FIELD_LIBRARY = [
  { id: 'paciente.id', label: 'ID del paciente' },
  { id: 'paciente.nombre', label: 'Nombre del paciente' },
  { id: 'paciente.edad', label: 'Edad del paciente' },
  { id: 'paciente.fecha_nacimiento', label: 'Fecha de nacimiento' },
  { id: 'paciente.id_receta', label: 'ID del paciente (receta)' },
  { id: 'paciente.folio_receta', label: 'Folio único de receta' },
  { id: 'paciente.alergias_base', label: 'Alergias' },
  { id: 'paciente.alergias', label: 'Alergias (alias)' },
  { id: 'paciente.telefono', label: 'Teléfono del paciente' },
  { id: 'paciente.sexo', label: 'Sexo del paciente' },
  { id: 'paciente.grupo_sanguineo', label: 'Grupo sanguíneo' },
  { id: 'paciente.tipo_sangre', label: 'Tipo de sangre (alias)' },
  { id: 'receta.folio', label: 'Folio único de receta' },
  { id: 'receta.fecha', label: 'Fecha de receta' },
  { id: 'medico.nombre', label: 'Nombre del médico' },
  { id: 'medico.cedula', label: 'Cédula profesional' },
  { id: 'medico.cedula_profesional', label: 'Cédula profesional (alias)' },
  { id: 'medico.universidad_egreso', label: 'Universidad de egreso' },
  { id: 'medico.centro_estudios', label: 'Centro de estudios (alias)' },
  { id: 'medico.sucursal', label: 'Sucursal' },
  { id: 'medico.especialidad', label: 'Especialidad médica' },
  { id: 'sucursal.nombre', label: 'Sucursal (texto completo)' },
  { id: 'sucursal.horario', label: 'Horario de sucursal' },
  { id: 'sucursal.quejas_sugerencias', label: 'Teléfono quejas/sugerencias' },
  { id: 'sucursal.direccion', label: 'Dirección de sucursal' },
  { id: 'sucursal.domicilio', label: 'Domicilio de sucursal (alias)' },
  { id: 'sucursal.telefono', label: 'Teléfono de sucursal' },
  { id: 'consultorio.nombre', label: 'Nombre del consultorio' },
  { id: 'consultorio.direccion', label: 'Dirección del consultorio' },
  { id: 'consultorio.domicilio', label: 'Domicilio del consultorio (alias)' },
  { id: 'consulta.padecimiento', label: 'Motivo de consulta' },
  { id: 'consulta.diagnostico', label: 'Diagnóstico' },
  { id: 'consulta.cie10_texto', label: 'CIE10 (texto)' },
  { id: 'consulta.indicaciones', label: 'Indicaciones médicas' },
  { id: 'consulta.tratamiento_texto', label: 'Tratamiento (texto)' },
  { id: 'consulta.tratamiento_html', label: 'Tratamiento (lista HTML)' },
  { id: 'consulta.medicamentos_texto', label: 'Medicamentos detallados (texto)' },
  { id: 'consulta.medicamentos_html', label: 'Medicamentos detallados (HTML)' },
  { id: 'consulta.estudios_texto', label: 'Estudios solicitados (texto)' },
  { id: 'consulta.estudios_html', label: 'Estudios solicitados (HTML)' },
  { id: 'consulta.estudios_conteo', label: 'Cantidad de estudios' },
  { id: 'consulta.paquetes_texto', label: 'Paquetes de estudios (texto)' },
  { id: 'consulta.estudios_notas', label: 'Notas de estudios' },
  { id: 'consulta.procedimientos_texto', label: 'Procedimientos (texto)' },
  { id: 'consulta.procedimientos_html', label: 'Procedimientos (HTML)' },
  { id: 'consulta.procedimientos_conteo', label: 'Cantidad de procedimientos' },
  { id: 'consulta.procedimientos_notas', label: 'Notas de procedimientos' },
  { id: 'consulta.referencias_texto', label: 'Referencias médicas (texto)' },
  { id: 'consulta.referencias_html', label: 'Referencias médicas (HTML)' },
  { id: 'consulta.referencias_conteo', label: 'Cantidad de referencias' },
  { id: 'consulta.receta_contenido', label: 'Receta completa (meds+estudios+proc+refs)' },
  { id: 'exploracion.signos.ta', label: 'TA' },
  { id: 'exploracion.signos.temp', label: 'Temperatura' },
  { id: 'exploracion.signos.fc', label: 'FC' },
  { id: 'exploracion.signos.fr', label: 'FR' },
  { id: 'exploracion.signos.spo2', label: 'SpO2' },
  { id: 'exploracion.antropometria.peso', label: 'Peso' },
  { id: 'exploracion.antropometria.talla', label: 'Talla' },
  { id: 'firma.medico', label: 'Firma digital del médico' },
  { id: 'firma.linea', label: 'Línea de firma (sólida)' },
  { id: 'fecha.hoy', label: 'Fecha actual' },
  { id: 'fechaexpedida', label: 'Hora de expedición' },
  { id: 'fecha.larga', label: 'Fecha larga' }
];

export const FIELD_GROUPS = [
  { id: 'paciente', label: 'Paciente', color: '#7c3aed', fields: ['paciente.id','paciente.nombre','paciente.edad','paciente.fecha_nacimiento','paciente.id_receta','paciente.folio_receta','paciente.alergias_base','paciente.alergias','paciente.telefono','paciente.sexo','paciente.grupo_sanguineo','paciente.tipo_sangre'] },
  { id: 'receta', label: 'Receta', color: '#0f766e', fields: ['receta.folio','receta.fecha'] },
  { id: 'medico', label: 'Médico', color: '#0077B6', fields: ['medico.nombre','medico.cedula','medico.cedula_profesional','medico.universidad_egreso','medico.centro_estudios','medico.sucursal','medico.especialidad'] },
  { id: 'sucursal', label: 'Sucursal / Contacto', color: '#475569', fields: ['sucursal.nombre','sucursal.horario','sucursal.quejas_sugerencias','sucursal.direccion','sucursal.domicilio','sucursal.telefono'] },
  { id: 'consultorio', label: 'Consultorio', color: '#0369a1', fields: ['consultorio.nombre','consultorio.direccion','consultorio.domicilio'] },
  { id: 'consulta', label: 'Consulta', color: '#059669', fields: ['consulta.padecimiento','consulta.diagnostico','consulta.cie10_texto','consulta.indicaciones','consulta.tratamiento_texto','consulta.tratamiento_html','consulta.medicamentos_texto','consulta.medicamentos_html','consulta.estudios_texto','consulta.estudios_html','consulta.estudios_conteo','consulta.paquetes_texto','consulta.estudios_notas','consulta.procedimientos_texto','consulta.procedimientos_html','consulta.procedimientos_conteo','consulta.procedimientos_notas','consulta.referencias_texto','consulta.referencias_html','consulta.referencias_conteo','consulta.receta_contenido'] },
  { id: 'exploracion', label: 'Exploración', color: '#d97706', fields: ['exploracion.signos.ta','exploracion.signos.temp','exploracion.signos.fc','exploracion.signos.fr','exploracion.signos.spo2','exploracion.antropometria.peso','exploracion.antropometria.talla'] },
  { id: 'firma', label: 'Firma / Fecha', color: '#dc2626', fields: ['firma.medico','firma.linea','fecha.hoy','fechaexpedida','fecha.larga'] }
];

const PREVIEW_DATA = {
  paciente: { id: 'SALVIO20081993', nombre: 'SALVIO DE JESUS SANTIAGO ULLOA', edad: '32 años', fecha_nacimiento: '1993-08-20', id_receta: 'SALVIO20081993', folio_receta: 'RX-20260311-143022-0001', alergias_base: 'Interrogadas y negadas', alergias: 'Interrogadas y negadas', telefono: '999 222 3344', sexo: 'Femenino', grupo_sanguineo: 'A+', tipo_sangre: 'A+' },
  receta: { folio: '103417', fecha: new Date().toLocaleDateString('es-MX') },
  exploracion: { signos: { ta: '120/80', temp: '36.7', fc: '82', fr: '18', spo2: '98' }, antropometria: { peso: '68', talla: '1.64' } },
  medico: { nombre: 'DR. CARLOS HERNANDEZ', cedula: '15328151', cedula_profesional: '15328151', universidad_egreso: 'Centro de Estudios Universitarios Xochicalco', centro_estudios: 'Centro de Estudios Universitarios Xochicalco', sucursal: 'Huasteca', especialidad: 'Medicina General' },
  sucursal: { nombre: 'Suc. Huasteca', horario: 'Lunes a Sábado abierto 24 h. Domingo cierre a las 11:00 p.m.', quejas_sugerencias: '8182046067', direccion: 'Cuajuco 120 A Col. INFONAVIT la Huasteca, Santa Catarina, N.L.', domicilio: 'Cuajuco 120 A Col. INFONAVIT la Huasteca, Santa Catarina, N.L.', telefono: '8139025690' },
  consultorio: { nombre: 'Consultorio 3', direccion: 'C. Cuajuco 120 -A, Infonavit la Huasteca, 66354 Cdad. Santa Catarina, N.L.', domicilio: 'C. Cuajuco 120 -A, Infonavit la Huasteca, 66354 Cdad. Santa Catarina, N.L.' },
  consulta: { padecimiento: 'Cefalea y náusea de 48 horas de evolución.', diagnostico: 'Migraña sin aura', cie10_texto: 'G43 - Migraña', indicaciones: 'Reposo, hidratación y control en 24 horas.', tratamiento_texto: '1. Paracetamol 500 mg - Tomar 1 tableta cada 8 horas por 3 días.\n2. Omeprazol 20 mg - Tomar 1 cápsula cada 24 horas por 5 días.', tratamiento_html: '<ol><li><strong>Paracetamol 500 mg</strong> - Tomar 1 tableta cada 8 horas por 3 días.</li><li><strong>Omeprazol 20 mg</strong> - Tomar 1 cápsula cada 24 horas por 5 días.</li></ol>', medicamentos_texto: '1. AMAL / ZOFRAN / ONDANSETRON 3 INYECTABLE 8mg / 4ml INTRAMUSCULAR o INTRAVENOSO\n   192 ONDANSETRON\n   DOSIS UNICA.\n2. ADALAT / CORDILAT / NIFEDIPINO 20 CAPSULAS 10mg VIA ORAL.\n   186 NIFEDIPINO\n   DOSIS UNICA.', medicamentos_html: '<div style="margin-bottom:8px;"><div><strong>1. AMAL / ZOFRAN / ONDANSETRON</strong> 3 INYECTABLE 8mg / 4ml INTRAMUSCULAR o INTRAVENOSO</div><div style="margin-left:16px;">192 ONDANSETRON</div><div style="margin-left:16px;">DOSIS UNICA.</div></div><div style="margin-bottom:8px;"><div><strong>2. ADALAT / CORDILAT / NIFEDIPINO</strong> 20 CAPSULAS 10mg VIA ORAL.</div><div style="margin-left:16px;">186 NIFEDIPINO</div><div style="margin-left:16px;">DOSIS UNICA.</div></div>', estudios_texto: 'Paquetes: BHC, QS6\n1. Hemograma\n2. Glucosa\n3. Urea', estudios_html: '<div style="margin-bottom:6px;"><strong>Paquetes:</strong> BHC, QS6</div><ol><li>Hemograma</li><li>Glucosa</li><li>Urea</li></ol>', estudios_conteo: '3', paquetes_texto: 'BHC, QS6', estudios_notas: 'Ayuno de 8 horas.', procedimientos_texto: '1. Curación chica (Prioridad: Urgente | Estado: Indicado | Sitio: Antebrazo)\n2. Sutura simple (Prioridad: Electivo | Estado: Programado)', procedimientos_html: '<ol><li>Curación chica <em>(Prioridad: Urgente | Estado: Indicado | Sitio: Antebrazo)</em></li><li>Sutura simple <em>(Prioridad: Electivo | Estado: Programado)</em></li></ol>', procedimientos_conteo: '2', procedimientos_notas: 'Requiere material de curación.', referencias_texto: '1. DR. JUAN PEREZ (CARDIOLOGIA · PRIMERA VEZ) - URGENTE\n   Tel: 55-1234-5678 | Dir: Av. Reforma 123\n   Dx: Hipertension arterial\n   Datos adicionales: Consultorio planta baja\n   Notas: Entregar copia de estudios', referencias_html: '<ol><li><strong>DR. JUAN PEREZ</strong> <em>(CARDIOLOGIA · PRIMERA VEZ)</em> <strong style="color:#e11d48;">URGENTE</strong><br/>Tel: 55-1234-5678 · Dir: Av. Reforma 123<br/><strong>Dx:</strong> Hipertension arterial<br/>Datos adicionales: Consultorio planta baja<br/>Notas: Entregar copia de estudios</li></ol>', referencias_conteo: '1', receta_contenido: '1. Paracetamol 500mg\n   100 PARACETAMOL\n   1 tab c/8h\n2. Amoxicilina 500mg\n   200 AMOXICILINA\n   1 cap c/8h x7d\n\n1. Biometría hemática\n2. Química sanguínea\n3. Urea\n\n1. Curación chica (Prioridad: Urgente | Sitio: Antebrazo)' },
  fecha: {
    hoy: new Date().toLocaleDateString('es-MX'),
    hoy_larga: formatDateLongEsMx(new Date()),
    expedida: formatIssuedTimeEsMx(new Date()),
    larga: formatDateLongEsMx(new Date())
  },
  fechaexpedida: formatIssuedTimeEsMx(new Date()),
  firma: { medico: '[Firma digital del medico]', linea: '[Linea de firma]' }
};

const makeId = (prefix = 'el') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const htmlToPlain = (html = '') => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const plainToHtml = (text = '') => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
const resolveDeep = (obj, path) => path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), obj);
const normalizeTemplateFieldKey = (raw = '') => String(raw || '').replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();

const shouldHideFieldLabel = (fieldKey = '') => {
  const key = normalizeTemplateFieldKey(fieldKey);
  return key === 'fecha.hoy'
    || key === 'fecha.hoy_larga'
    || key === 'fecha.larga'
    || key === 'fechaexpedida'
    || key === 'fecha.expedida';
};

const buildFieldDisplayText = (fieldKey = '', label = '', value = '') => {
  const safeValue = String(value || '');
  if (shouldHideFieldLabel(fieldKey)) return safeValue;
  return `${label ? `${label}: ` : ''}${safeValue}`;
};

const buildCanvasFieldToken = (field = {}) => {
  const key = normalizeTemplateFieldKey(field?.bind || field?.id || '');
  if (key) return `{{${key}}}`;
  const fallback = String(field?.label || 'campo').trim();
  return `{{${fallback}}}`;
};

const buildSignatureLineHtml = (name = '') => {
  const label = String(name || 'Firma del medico').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<div style="margin:20px auto 0 auto;width:320px;max-width:100%;border-top:2px solid #334155;padding-top:8px;text-align:center;font-weight:700;">${label}</div>`;
};

const resolveTemplateText = (text = '', data = PREVIEW_DATA) => String(text).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, keyRaw) => {
  const key = normalizeTemplateFieldKey(keyRaw);
  if (key === 'firma.linea') return '____________________________';
  if (key === 'firma.medico') return '[Firma digital del medico]';
  return resolveDeep(data, key) || '';
});

const resolveTemplateHtml = (html = '', data = PREVIEW_DATA) => String(html).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, keyRaw) => {
  const key = normalizeTemplateFieldKey(keyRaw);
  if (key === 'firma.linea') return buildSignatureLineHtml(resolveDeep(data, 'medico.nombre') || 'Firma del medico');
  if (key === 'firma.medico') return '<span style="font-style:italic;color:#64748b;">[Firma digital del medico]</span>';
  if (key === 'consulta.tratamiento_html') return String(resolveDeep(data, key) || '');
  return String(resolveDeep(data, key) || '');
});

const normalizeLegacyDocHtml = (html = '') => String(html).replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi, (_, num) => `font-size:${num}pt`);

const defaultElementBase = { x: 40, y: 80, w: 515, h: 24, fontSize: 12, fontFamily: 'Trebuchet MS', lineHeight: 1.35, bold: false, align: 'left', zIndex: 1 };
const defaultImageElementBase = { x: 40, y: 80, w: 180, h: 120, src: '', objectFit: 'contain', opacity: 1, isWatermark: false, zIndex: 2 };
const defaultShapeElementBase = { x: 40, y: 120, w: 220, h: 2, shapeKind: 'line', stroke: '#0f172a', strokeWidth: 1, fill: 'transparent', radius: 0, opacity: 1, zIndex: 1 };
const GRID_SIZE = 16;
const SMART_GUIDE_TOLERANCE = 12;
const FORCED_SHAPE_STROKE = '#000000';

const normalizeShapeElement = (shape = {}) => ({
  ...shape,
  stroke: FORCED_SHAPE_STROKE,
  // Keep fills transparent so boxes/circles remain visible without hiding content.
  fill: 'transparent'
});

const buildSchemaFromElements = (elements = [], documentHtml = '', documentFontFamily = 'Trebuchet MS', documentLineHeight = 1.45, page = PAGE) => {
  const campos = [];
  const bloques = [];
  elements.forEach((el) => {
    if (el.type === 'field') {
      campos.push({ id: el.id, bind: el.bind, label: el.label, x: Number(el.x || 0), y: Number(el.y || 0), w: Number(el.w || 0), h: Number(el.h || 0), fontSize: Number(el.fontSize || 12), fontFamily: el.fontFamily || 'Trebuchet MS', lineHeight: Number(el.lineHeight || 1.35), negrita: !!el.bold, align: el.align || 'left', zIndex: Number(el.zIndex || 1), mostrar: true });
      return;
    }
    if (el.type === 'text') {
      const html = el.contentHtml || plainToHtml(el.content || '');
      bloques.push({ id: el.id, tipo: 'texto', contenido: el.content || htmlToPlain(html), contenidoHtml: html, x: Number(el.x || 0), y: Number(el.y || 0), w: Number(el.w || 0), h: Number(el.h || 0), fontSize: Number(el.fontSize || 12), fontFamily: el.fontFamily || 'Trebuchet MS', lineHeight: Number(el.lineHeight || 1.35), align: el.align || 'left', negrita: !!el.bold, zIndex: Number(el.zIndex || 1) });
    }
    if (el.type === 'image') {
      bloques.push({ id: el.id, tipo: 'imagen', src: el.src || '', x: Number(el.x || 0), y: Number(el.y || 0), w: Number(el.w || 180), h: Number(el.h || 120), objectFit: el.objectFit || 'contain', opacity: Number(el.opacity ?? 1), isWatermark: !!el.isWatermark, zIndex: Number(el.zIndex || 2) });
      return;
    }
    if (el.type === 'shape') {
      const normalized = normalizeShapeElement(el);
      bloques.push({ id: normalized.id, tipo: 'forma', shapeKind: normalized.shapeKind || 'line', x: Number(normalized.x || 0), y: Number(normalized.y || 0), w: Number(normalized.w || 220), h: Number(normalized.h || 2), stroke: normalized.stroke || FORCED_SHAPE_STROKE, strokeWidth: Number(normalized.strokeWidth || 1), fill: normalized.fill || 'transparent', radius: Number(normalized.radius || 0), opacity: Number(normalized.opacity ?? 1), zIndex: Number(normalized.zIndex || 1) });
    }
  });
  const safePage = {
    width: Number(page?.width || PAGE.width),
    height: Number(page?.height || PAGE.height)
  };
  return { version: 2, page: safePage, documentHtml, documentFontFamily: documentFontFamily || 'Trebuchet MS', documentLineHeight: Number(documentLineHeight || 1.45), elements, campos, bloques };
};

const editorFromTemplate = (tpl) => {
  const schema = tpl?.schema || {};
  const page = schema.page || PAGE;
  if (Array.isArray(schema.elements) && schema.elements.length > 0) {
    const normalizedElements = schema.elements.map((el) => {
      if (el.type === 'image') return { ...defaultImageElementBase, ...el, type: 'image' };
      if (el.type === 'shape') return { ...defaultShapeElementBase, ...normalizeShapeElement(el), type: 'shape' };
      if (el.type !== 'text') return el;
      const html = el.contentHtml || plainToHtml(el.content || '');
      return { ...el, contentHtml: html, content: el.content || htmlToPlain(html) };
    });
    return { id: tpl.id, nombre: tpl.nombre || '', categoria: tpl.categoria || 'General', tipoDocumento: tpl.tipoDocumento || 'general', orden: String(tpl.orden ?? 999), descripcionNatural: tpl.descripcionNatural || '', activo: tpl.activo !== false, publicada: tpl.publicada !== false, page, documentHtml: normalizeLegacyDocHtml(schema.documentHtml || ''), documentFontFamily: schema.documentFontFamily || 'Trebuchet MS', documentLineHeight: Number(schema.documentLineHeight || 1.45), elements: normalizedElements };
  }
  const fromCampos = Array.isArray(schema.campos) ? schema.campos.map((campo, index) => ({ id: campo.id || `field_${index}`, type: 'field', bind: campo.bind || campo.id, label: campo.label || 'Campo', ...defaultElementBase, x: Number(campo.x ?? 40), y: Number(campo.y ?? 80), w: Number(campo.w ?? 515), h: Number(campo.h ?? 24), fontSize: Number(campo.fontSize ?? 12), fontFamily: campo.fontFamily || 'Trebuchet MS', lineHeight: Number(campo.lineHeight || 1.35), bold: !!campo.negrita, align: campo.align || 'left' })) : [];
  const fromBloques = Array.isArray(schema.bloques) ? schema.bloques.map((bloque, index) => {
    if (bloque.tipo === 'imagen') return { id: bloque.id || `image_${index}`, type: 'image', ...defaultImageElementBase, src: bloque.src || '', x: Number(bloque.x ?? 40), y: Number(bloque.y ?? 80), w: Number(bloque.w ?? 180), h: Number(bloque.h ?? 120), objectFit: bloque.objectFit || 'contain', opacity: Number(bloque.opacity ?? 1), isWatermark: !!bloque.isWatermark };
    if (bloque.tipo === 'forma') return normalizeShapeElement({ id: bloque.id || `shape_${index}`, type: 'shape', ...defaultShapeElementBase, shapeKind: bloque.shapeKind || 'line', x: Number(bloque.x ?? 40), y: Number(bloque.y ?? 120), w: Number(bloque.w ?? 220), h: Number(bloque.h ?? 2), stroke: bloque.stroke || '#0f172a', strokeWidth: Number(bloque.strokeWidth ?? 1), fill: bloque.fill || 'transparent', radius: Number(bloque.radius ?? 0), opacity: Number(bloque.opacity ?? 1), zIndex: Number(bloque.zIndex ?? 1) });
    return { id: bloque.id || `text_${index}`, type: 'text', content: bloque.contenido || htmlToPlain(bloque.contenidoHtml || ''), contentHtml: bloque.contenidoHtml || plainToHtml(bloque.contenido || ''), ...defaultElementBase, x: Number(bloque.x ?? 40), y: Number(bloque.y ?? 80), w: Number(bloque.w ?? 515), h: Number(bloque.h ?? 60), fontSize: Number(bloque.fontSize ?? 12), fontFamily: bloque.fontFamily || 'Trebuchet MS', lineHeight: Number(bloque.lineHeight || 1.35), bold: !!bloque.negrita, align: bloque.align || 'left' };
  }) : [];
  return { id: tpl.id, nombre: tpl.nombre || '', categoria: tpl.categoria || 'General', tipoDocumento: tpl.tipoDocumento || 'general', orden: String(tpl.orden ?? 999), descripcionNatural: tpl.descripcionNatural || '', activo: tpl.activo !== false, publicada: tpl.publicada !== false, page, documentHtml: normalizeLegacyDocHtml(schema.documentHtml || ''), documentFontFamily: schema.documentFontFamily || 'Trebuchet MS', documentLineHeight: Number(schema.documentLineHeight || 1.45), elements: [...fromCampos, ...fromBloques] };
};

const createBlankEditor = () => ({
  id: null, nombre: '', categoria: 'General', tipoDocumento: 'general', orden: '999', descripcionNatural: '', activo: true, publicada: true, page: { ...PAGE },
  documentFontFamily: 'Trebuchet MS',
  documentLineHeight: 1.45,
  documentHtml: `<h2 style="text-align:center; margin:0 0 24px 0;">CENTRO MEDICO SANTA CRUZ</h2><p><strong>Nombre del medico:</strong> {{medico.nombre}}</p><p><strong>Cedula profesional:</strong> {{medico.cedula}}</p><br/><p><strong>A QUIEN CORRESPONDA:</strong></p><p>El que suscribe, medico legalmente autorizado para ejercer la profesion, hace constar que <strong>{{paciente.nombre}}</strong> fue valorado el dia <strong>{{fecha.hoy}}</strong>.</p>`,
  elements: [
    { id: makeId('field'), type: 'field', bind: 'paciente.nombre', label: 'Nombre del paciente', ...defaultElementBase, x: 40, y: 72, w: 515, h: 26, fontSize: 15, bold: true },
    { id: makeId('text'), type: 'text', content: 'Se hace constar que {{paciente.nombre}} fue valorado por {{medico.nombre}} en fecha {{fecha.hoy}}.', contentHtml: 'Se hace constar que <strong>{{paciente.nombre}}</strong> fue valorado por <strong>{{medico.nombre}}</strong> en fecha {{fecha.hoy}}.', ...defaultElementBase, x: 40, y: 130, w: 515, h: 120, fontSize: 12 }
  ]
});

const createRecipeEditor = () => ({
  ...createBlankEditor(),
  nombre: 'Receta Medica Base', categoria: 'Recetas', tipoDocumento: 'receta',
  descripcionNatural: 'Plantilla base tipo receta (doble en una carta).', page: { width: 816, height: 528 },
  documentHtml: `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #cbd5e1;padding-bottom:8px;margin-bottom:8px;"><div><h2 style="margin:0;font-size:15pt;letter-spacing:0.5px;">RECETA MEDICA</h2><p style="margin:2px 0 0 0;font-size:10pt;color:#475569;">Centro Medico Santa Cruz</p></div><div style="text-align:right;font-size:9pt;line-height:1.3;"><div><strong>Medico:</strong> {{medico.nombre}}</div><div><strong>Cedula:</strong> {{medico.cedula}}</div></div></div><table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:9pt;"><tr><td style="padding:3px 0;"><strong>Paciente:</strong> {{paciente.nombre}}</td><td style="padding:3px 0;"><strong>Edad:</strong> {{paciente.edad}}</td><td style="padding:3px 0;"><strong>Fecha:</strong> {{fecha.hoy}}</td></tr><tr><td style="padding:3px 0;"><strong>TA:</strong> {{exploracion.signos.ta}}</td><td style="padding:3px 0;"><strong>Temp:</strong> {{exploracion.signos.temp}}</td><td style="padding:3px 0;"><strong>SpO2:</strong> {{exploracion.signos.spo2}}</td></tr></table><div style="font-size:9.5pt;line-height:1.45;"><p style="margin:0 0 6px 0;"><strong>Diagnostico:</strong> {{consulta.diagnostico}}</p><p style="margin:0 0 6px 0;"><strong>Tratamiento:</strong></p>{{consulta.tratamiento_html}}<p style="margin:8px 0 0 0;"><strong>Indicaciones:</strong> {{consulta.indicaciones}}</p></div><p style="margin-top:24px;text-align:center;font-size:9pt;">{{firma.linea}}</p>`
});

const normalizeLegacyRecipePage = (mappedEditor) => {
  if (!mappedEditor || mappedEditor.tipoDocumento !== 'receta') return { editor: mappedEditor, migrated: false };
  const targetHeight = PAGE.height / 2;
  const currentHeight = Number(mappedEditor.page?.height || targetHeight);
  if (currentHeight <= targetHeight + 1) return { editor: mappedEditor, migrated: false };

  // Legacy bug wrote carta height (1056) for receta templates.
  // If content lives in the upper half, we can safely restore receta height.
  const allElementsInsideHalf = (mappedEditor.elements || []).every((el) => {
    const y = Number(el?.y || 0);
    const h = Number(el?.h || 0);
    return y + h <= targetHeight + 32;
  });

  if (!allElementsInsideHalf) return { editor: mappedEditor, migrated: false };

  return {
    editor: {
      ...mappedEditor,
      page: {
        width: Number(mappedEditor.page?.width || PAGE.width),
        height: targetHeight
      }
    },
    migrated: true
  };
};

// ── Render helpers ──────────────────────────────────────────────────────────

const ShapePreview = ({ kind, stroke = '#475569', fill = 'transparent', strokeWidth = 1.5 }) => {
  const s = stroke;
  if (kind === 'line') return <div style={{ width: 28, height: 2, background: s, borderRadius: 1 }} />;
  if (kind === 'line-vertical') return <div style={{ width: 2, height: 24, background: s, borderRadius: 1 }} />;
  if (kind === 'line-dashed') return <div style={{ width: 28, height: 2, borderTop: `2px dashed ${s}` }} />;
  if (kind === 'line-vertical-dashed') return <div style={{ width: 2, height: 24, borderLeft: `2px dashed ${s}` }} />;
  if (kind === 'arrow') return (
    <svg width="28" height="12" viewBox="0 0 28 12">
      <line x1="0" y1="6" x2="20" y2="6" stroke={s} strokeWidth={strokeWidth} />
      <polygon points="20,2 28,6 20,10" fill={s} />
    </svg>
  );
  if (kind === 'rect') return <div style={{ width: 24, height: 16, border: `${strokeWidth}px solid ${s}`, background: fill === 'transparent' ? 'transparent' : fill, borderRadius: 2 }} />;
  if (kind === 'circle') return <div style={{ width: 18, height: 18, border: `${strokeWidth}px solid ${s}`, background: fill === 'transparent' ? 'transparent' : fill, borderRadius: '50%' }} />;
  return null;
};

const renderShapeEl = (el) => {
  const sEl = normalizeShapeElement(el);
  if (sEl.shapeKind === 'arrow') {
    const h = Math.max(Number(sEl.h || 20), 20);
    const w = Number(sEl.w || 200);
    const sw = Number(sEl.strokeWidth || 2);
    return (
      <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <marker id={`ah_${sEl.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={sEl.stroke || FORCED_SHAPE_STROKE} opacity={sEl.opacity ?? 1} />
          </marker>
        </defs>
        <line x1={sw} y1={h / 2} x2={w - 8} y2={h / 2} stroke={sEl.stroke || FORCED_SHAPE_STROKE} strokeWidth={sw} markerEnd={`url(#ah_${sEl.id})`} opacity={sEl.opacity ?? 1} />
      </svg>
    );
  }
  if (sEl.shapeKind === 'line-vertical' || sEl.shapeKind === 'line-vertical-dashed') {
    return (
      <div className="w-full h-full flex justify-center">
        <div style={{ width: Number(sEl.strokeWidth || 1), height: '100%', borderLeft: `${Number(sEl.strokeWidth || 1)}px ${sEl.shapeKind === 'line-vertical-dashed' ? 'dashed' : 'solid'} ${sEl.stroke || FORCED_SHAPE_STROKE}`, opacity: Number(sEl.opacity ?? 1) }} />
      </div>
    );
  }
  return (
    <div className="w-full h-full" style={{
      borderTop: sEl.shapeKind === 'line' || sEl.shapeKind === 'line-dashed' ? `${Number(sEl.strokeWidth || 1)}px ${sEl.shapeKind === 'line-dashed' ? 'dashed' : 'solid'} ${sEl.stroke || FORCED_SHAPE_STROKE}` : 'none',
      border: sEl.shapeKind === 'rect' || sEl.shapeKind === 'circle' ? `${Number(sEl.strokeWidth || 1)}px solid ${sEl.stroke || FORCED_SHAPE_STROKE}` : undefined,
      backgroundColor: sEl.shapeKind === 'rect' || sEl.shapeKind === 'circle' ? (sEl.fill || 'transparent') : 'transparent',
      borderRadius: sEl.shapeKind === 'circle' ? '999px' : Number(sEl.radius || 0),
      opacity: Number(sEl.opacity ?? 1)
    }} />
  );
};

// ── Main component ──────────────────────────────────────────────────────────

const PlantillasDocumentos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialDraft = loadAutosaveDraft();

  const [templates, setTemplates] = useState([]);
  const [editor, setEditor] = useState(() => initialDraft?.editor || createBlankEditor());
  const [selectedElementId, setSelectedElementId] = useState(() => initialDraft?.selectedElementId || null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [urlDialog, setUrlDialog] = useState({ open: false, mode: 'document' });
  const [urlInput, setUrlInput] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [smartGuides, setSmartGuides] = useState({ vertical: [], horizontal: [] });

  // Layout state
  const [leftTab, setLeftTab] = useState('templates'); // templates | insert | layers
  const [showPreview, setShowPreview] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(0.85);
  const [showCanvasGrid, setShowCanvasGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({ paciente: true, medico: false, consulta: false, exploracion: false, firma: false });
  const [showMetadata, setShowMetadata] = useState(true);

  const canvasZoomRef = useRef(0.85);
  const canvasRef = useRef(null);
  const richTextEditorRef = useRef(null);
  const textElementRefs = useRef({});
  const textDraftHtmlRef = useRef({});
  const lastTextSelectionRef = useRef({ elementId: null, range: null });
  const lastDocumentSelectionRef = useRef(null);
  const documentEditorRef = useRef(null);
  const documentImageInputRef = useRef(null);
  const advancedImageInputRef = useRef(null);
  const watermarkImageInputRef = useRef(null);
  const workspaceRef = useRef(null);
  const editorRef = useRef(editor);
  const restoredDraftRef = useRef(!!initialDraft);

  const activeDocMargins = editor.tipoDocumento === 'receta' ? RECIPE_DOC_MARGINS : DOC_MARGINS;

  // Sync zoom ref
  useEffect(() => { canvasZoomRef.current = canvasZoom; }, [canvasZoom]);
  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => {
    if (!restoredDraftRef.current) return;
    setMessage('Se recupero tu ultimo borrador local.');
    const t = setTimeout(() => setMessage(''), 2600);
    restoredDraftRef.current = false;
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      persistAutosaveDraft({
        editor,
        selectedElementId,
        savedAt: Date.now()
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [editor, selectedElementId]);

  // Firebase
  useEffect(() => {
    const q = query(collection(db, 'catalogo_plantillas_documentos'), orderBy('orden', 'asc'));
    const unsub = onSnapshot(q, (snap) => setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  // Auto-fit zoom on mount / page size change
  useEffect(() => {
    const target = workspaceRef.current;
    if (!target) return;
    const available = Math.max(300, target.clientWidth - 64);
    const fit = Number(Math.min(1, available / Number(editor.page.width || PAGE.width)).toFixed(3));
    setCanvasZoom(fit);
    canvasZoomRef.current = fit;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.page.width]);

  // Drag effect (zoom-corrected)
  useEffect(() => {
    if (!dragState) return undefined;

    const getElementMetrics = (el) => {
      const w = Number(el.w || 80);
      const h = Number(el.h || (el.type === 'shape' || el.type === 'image' ? 20 : 24));
      return { w, h };
    };

    const resolveSmartSnap = (elements, movingId, rawX, rawY, page) => {
      const moving = elements.find((el) => el.id === movingId);
      if (!moving) return { x: rawX, y: rawY, guides: { vertical: [], horizontal: [] } };

      const { w, h } = getElementMetrics(moving);
      const pageW = Number(page.width || PAGE.width);
      const pageH = Number(page.height || PAGE.height);

      const vCandidates = [0, pageW / 2, pageW];
      const hCandidates = [0, pageH / 2, pageH];

      elements.forEach((el) => {
        if (el.id === movingId) return;
        const x = Number(el.x || 0);
        const y = Number(el.y || 0);
        const m = getElementMetrics(el);
        vCandidates.push(x, x + (m.w / 2), x + m.w);
        hCandidates.push(y, y + (m.h / 2), y + m.h);
      });

      const vAnchors = [
        { offset: 0, apply: (value) => value },
        { offset: w / 2, apply: (value) => value - (w / 2) },
        { offset: w, apply: (value) => value - w }
      ];
      const hAnchors = [
        { offset: 0, apply: (value) => value },
        { offset: h / 2, apply: (value) => value - (h / 2) },
        { offset: h, apply: (value) => value - h }
      ];

      let bestV = null;
      vAnchors.forEach((anchor) => {
        const current = rawX + anchor.offset;
        vCandidates.forEach((candidate) => {
          const delta = Math.abs(current - candidate);
          if (delta <= SMART_GUIDE_TOLERANCE && (!bestV || delta < bestV.delta)) {
            bestV = { delta, snapped: anchor.apply(candidate), guide: candidate };
          }
        });
      });

      let bestH = null;
      hAnchors.forEach((anchor) => {
        const current = rawY + anchor.offset;
        hCandidates.forEach((candidate) => {
          const delta = Math.abs(current - candidate);
          if (delta <= SMART_GUIDE_TOLERANCE && (!bestH || delta < bestH.delta)) {
            bestH = { delta, snapped: anchor.apply(candidate), guide: candidate };
          }
        });
      });

      const snappedX = bestV ? bestV.snapped : rawX;
      const snappedY = bestH ? bestH.snapped : rawY;
      return {
        x: snappedX,
        y: snappedY,
        guides: {
          vertical: bestV ? [bestV.guide] : [],
          horizontal: bestH ? [bestH.guide] : []
        }
      };
    };

    const onMouseMove = (event) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const z = canvasZoomRef.current;
      const rawX = Math.round((event.clientX - rect.left) / z - dragState.offsetX);
      const rawY = Math.round((event.clientY - rect.top) / z - dragState.offsetY);
      const currentEditor = editorRef.current;
      const snapped = resolveSmartSnap(currentEditor.elements || [], dragState.elementId, rawX, rawY, currentEditor.page || PAGE);
      const nextGuides = snapped.guides;
      const x = nextGuides.vertical.length > 0 ? snapped.x : normalizeToGrid(snapped.x);
      const y = nextGuides.horizontal.length > 0 ? snapped.y : normalizeToGrid(snapped.y);

      setSmartGuides(nextGuides);
      setEditor((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => {
          if (el.id !== dragState.elementId) return el;
          const maxX = Math.max(0, Number(prev.page.width || PAGE.width) - Number(el.w || 20));
          const maxY = Math.max(0, Number(prev.page.height || PAGE.height) - Number(el.h || 20));
          return { ...el, x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
        })
      }));
    };
    const onMouseUp = () => {
      setDragState(null);
      setSmartGuides({ vertical: [], horizontal: [] });
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [dragState]);

  // Resize effect (zoom-corrected)
  useEffect(() => {
    if (!resizeState) return undefined;
    const onMouseMove = (event) => {
      const z = canvasZoomRef.current;
      const dx = (event.clientX - resizeState.startX) / z;
      const dy = (event.clientY - resizeState.startY) / z;
      setEditor((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => {
          if (el.id !== resizeState.elementId) return el;
          const isHLine = el.type === 'shape' && (el.shapeKind === 'line' || el.shapeKind === 'line-dashed' || el.shapeKind === 'arrow');
          const isVLine = el.type === 'shape' && (el.shapeKind === 'line-vertical' || el.shapeKind === 'line-vertical-dashed');
          const minW = isHLine ? 40 : isVLine ? 1 : 30;
          const minH = isHLine ? 1 : isVLine ? 40 : 30;
          const maxW = Math.max(minW, Number(prev.page.width || PAGE.width) - Number(el.x || 0));
          const maxH = Math.max(minH, Number(prev.page.height || PAGE.height) - Number(el.y || 0));
          return { ...el, w: Math.round(Math.min(Math.max(minW, normalizeToGrid(resizeState.startW + dx)), maxW)), h: Math.round(Math.min(Math.max(minH, normalizeToGrid(resizeState.startH + dy)), maxH)) };
        })
      }));
    };
    const onMouseUp = () => setResizeState(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [resizeState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.contentEditable === 'true';
      if (isEditable) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape') setSelectedElementId(null);
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedElementId) { e.preventDefault(); duplicateSelected(); }
      if (e.key.startsWith('Arrow') && selectedElementId) {
        e.preventDefault();
        const delta = e.shiftKey ? 8 : 1;
        setEditor((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (el.id !== selectedElementId) return el;
            const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
            const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;
            return { ...el, x: Math.max(0, Number(el.x || 0) + dx), y: Math.max(0, Number(el.y || 0) + dy) };
          })
        }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedElementId]);

  // Sync rich text editor
  useEffect(() => {
    const sel = editor.elements.find((el) => el.id === selectedElementId);
    if (!sel || sel.type !== 'text' || !richTextEditorRef.current) return;
    const html = sel.contentHtml || plainToHtml(sel.content || '');
    if (richTextEditorRef.current.innerHTML !== html) richTextEditorRef.current.innerHTML = html;
  }, [selectedElementId]);

  // Focus selected text box directly in canvas so user can type without using inspector.
  useEffect(() => {
    if (showPreview) return;
    const sel = editor.elements.find((el) => el.id === selectedElementId);
    if (!sel || sel.type !== 'text') return;
    const node = textElementRefs.current[sel.id];
    if (!node || document.activeElement === node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }, [selectedElementId, showPreview, editor.elements]);

  // Sync document editor
  useEffect(() => {
    if (!documentEditorRef.current) return;
    const html = editor.documentHtml || '';
    if (documentEditorRef.current.innerHTML !== html) documentEditorRef.current.innerHTML = html;
  }, [editor.documentHtml, showPreview]);

  // Keep latest selection ranges so toolbar actions can preserve partial formatting.
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!range) return;

      const activeTextNode = selectedElementId ? textElementRefs.current[selectedElementId] : null;
      if (activeTextNode && activeTextNode.contains(range.commonAncestorContainer)) {
        lastTextSelectionRef.current = { elementId: selectedElementId, range: range.cloneRange() };
      }

      const docNode = documentEditorRef.current;
      if (docNode && docNode.contains(range.commonAncestorContainer)) {
        lastDocumentSelectionRef.current = range.cloneRange();
      }
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [selectedElementId]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setToast = (text) => { setMessage(text); setTimeout(() => setMessage(''), 2600); };
  const normalizeToGrid = (value) => snapToGrid ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;

  const filteredTemplates = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    return q ? templates.filter((t) => (t.nombre || '').toLowerCase().includes(q)) : templates;
  }, [templates, listFilter]);

  const selectedElement = useMemo(() => editor.elements.find((el) => el.id === selectedElementId) || null, [editor.elements, selectedElementId]);

  const sortedElements = useMemo(() => [...editor.elements].sort((a, b) => Number(b.zIndex || 1) - Number(a.zIndex || 1)), [editor.elements]);
  const recipePreviewScale = useMemo(() => {
    if (editor.tipoDocumento !== 'receta') return 1;
    const sourceW = Number(editor.page?.width || PAGE.width);
    const sourceH = Number(editor.page?.height || PAGE.height);
    const targetHalfH = PAGE.height / 2;
    return Math.min(1, PAGE.width / sourceW, targetHalfH / sourceH);
  }, [editor.tipoDocumento, editor.page?.width, editor.page?.height]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const onSelectTemplate = (tpl) => {
    const mapped = editorFromTemplate(tpl);
    const normalized = normalizeLegacyRecipePage(mapped);
    setEditor(normalized.editor);
    setSelectedElementId(normalized.editor.elements[0]?.id || null);
    if (normalized.migrated) setToast('Se corrigio automaticamente el tamano legado de receta. Guarda para conservar el ajuste.');
  };
  const onNewTemplate = () => { const blank = createBlankEditor(); setEditor(blank); setSelectedElementId(blank.elements[0]?.id || null); };
  const onNewRecipeTemplate = () => { const r = createRecipeEditor(); setEditor(r); setSelectedElementId(r.elements[0]?.id || null); };
  const getElementRenderZ = (el) => {
    if (el?.type === 'image' && el?.isWatermark) return 0;
    return Number(el?.zIndex || 1) + 10;
  };
  const appendDocumentBlock = (html) => setEditor((prev) => ({ ...prev, documentHtml: `${String(prev.documentHtml || '').trim()}\n${String(html || '').trim()}`.trim() }));
  const applyClassicRecipePreset = () => { const r = createRecipeEditor(); setEditor((prev) => ({ ...prev, tipoDocumento: 'receta', categoria: prev.categoria || 'Recetas', page: r.page, documentHtml: r.documentHtml })); setToast('Base clasica de receta aplicada.'); };
  const updateEditorField = (key, value) => setEditor((prev) => ({ ...prev, [key]: value }));
  const updateSelectedElement = (patch) => { if (!selectedElementId) return; setEditor((prev) => ({ ...prev, elements: prev.elements.map((el) => (el.id === selectedElementId ? { ...el, ...patch } : el)) })); };
  const updateTextElementContent = (elementId, html) => {
    if (!elementId) return;
    setEditor((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === elementId ? { ...el, contentHtml: html, content: htmlToPlain(html) } : el))
    }));
  };
  const commitInlineTextElement = (elementId) => {
    if (!elementId) return;
    const node = textElementRefs.current[elementId];
    const html = node?.innerHTML ?? textDraftHtmlRef.current[elementId] ?? '';
    updateTextElementContent(elementId, html);
    delete textDraftHtmlRef.current[elementId];
  };

  const addFieldElement = (fieldId, position = null) => {
    const meta = FIELD_LIBRARY.find((f) => f.id === fieldId);
    if (!meta) return;
    const newEl = { id: makeId('field'), type: 'field', bind: meta.id, label: meta.label, ...defaultElementBase, x: position?.x ?? 40, y: position?.y ?? 80, w: 515, h: 24, fontSize: 12 };
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
  };

  const addTextElement = (position = null) => {
    const newEl = { id: makeId('text'), type: 'text', content: 'Escribe aqui...', contentHtml: 'Escribe aqui...', ...defaultElementBase, x: position?.x ?? 40, y: position?.y ?? 160, w: 400, h: 80, fontSize: 12 };
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
  };

  const addSelectElement = (position = null) => {
    const newEl = { id: makeId('select'), type: 'select', options: ['Positivo', 'Negativo'], value: 'Negativo', ...defaultElementBase, x: position?.x ?? 40, y: position?.y ?? 80, w: 140, h: 24, fontSize: 12, align: 'center' };
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
  };

  const addImageElement = (src = '', position = null) => {
    const newEl = { id: makeId('image'), type: 'image', ...defaultImageElementBase, src, x: position?.x ?? 40, y: position?.y ?? 220 };
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
  };

  const addWatermarkElement = (src = '') => {
    const pageW = Number(editor.page?.width || PAGE.width);
    const pageH = Number(editor.page?.height || PAGE.height);
    const w = Math.round(pageW * 0.7);
    const h = Math.round(pageH * 0.34);
    const newEl = {
      id: makeId('image'),
      type: 'image',
      ...defaultImageElementBase,
      src,
      x: Math.round((pageW - w) / 2),
      y: Math.round((pageH - h) / 2),
      w,
      h,
      objectFit: 'contain',
      opacity: 0.24,
      isWatermark: true,
      zIndex: 0
    };
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
  };

  const addShapeElement = (shapeKind = 'line', position = null) => {
    const presets = {
      line: { w: 260, h: 2, strokeWidth: 2, fill: 'transparent', radius: 0 },
      'line-dashed': { w: 260, h: 2, strokeWidth: 2, fill: 'transparent', radius: 0 },
      'line-vertical': { w: 2, h: 200, strokeWidth: 2, fill: 'transparent', radius: 0 },
      'line-vertical-dashed': { w: 2, h: 200, strokeWidth: 2, fill: 'transparent', radius: 0 },
      arrow: { w: 200, h: 20, strokeWidth: 2, fill: 'transparent', radius: 0 },
      rect: { w: 220, h: 80, strokeWidth: 1, fill: 'transparent', radius: 8 },
      circle: { w: 120, h: 120, strokeWidth: 1, fill: 'transparent', radius: 999 }
    };
    const preset = presets[shapeKind] || presets.line;
    const newEl = normalizeShapeElement({ id: makeId('shape'), type: 'shape', ...defaultShapeElementBase, shapeKind, ...preset, x: position?.x ?? 40, y: position?.y ?? 120 });
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedElementId(newEl.id);
  };

  const bringSelectedToFront = () => { if (!selectedElementId) return; setEditor((prev) => { const maxZ = Math.max(...prev.elements.map((el) => Number(el.zIndex || 1)), 1); return { ...prev, elements: prev.elements.map((el) => (el.id === selectedElementId ? { ...el, zIndex: maxZ + 1 } : el)) }; }); };
  const sendSelectedToBack = () => { if (!selectedElementId) return; setEditor((prev) => { const minZ = Math.min(...prev.elements.map((el) => Number(el.zIndex || 1)), 1); return { ...prev, elements: prev.elements.map((el) => (el.id === selectedElementId ? { ...el, zIndex: minZ - 1 } : el)) }; }); };
  const moveSelectedLayer = (delta) => { if (!selectedElementId) return; setEditor((prev) => ({ ...prev, elements: prev.elements.map((el) => (el.id === selectedElementId ? { ...el, zIndex: Number(el.zIndex || 1) + delta } : el)) })); };

  const duplicateSelected = () => {
    if (!selectedElement) return;
    const copy = { ...selectedElement, id: makeId(selectedElement.type), x: Number(selectedElement.x || 0) + 16, y: Number(selectedElement.y || 0) + 16 };
    setEditor((prev) => ({ ...prev, elements: [...prev.elements, copy] }));
    setSelectedElementId(copy.id);
  };

  const deleteSelected = () => {
    if (!selectedElementId) return;
    setEditor((prev) => ({ ...prev, elements: prev.elements.filter((el) => el.id !== selectedElementId) }));
    setSelectedElementId(null);
  };

  // Canvas events (zoom-corrected)
  const onElementMouseDown = (event, elementId) => {
    if (!canvasRef.current) return;
    const target = editor.elements.find((el) => el.id === elementId);
    if (!target) return;
    if (target.type === 'text' && !event.target.closest('[data-drag-handle="true"]')) {
      setSelectedElementId(elementId);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const z = canvasZoomRef.current;
    const offsetX = (event.clientX - rect.left) / z - Number(target.x || 0);
    const offsetY = (event.clientY - rect.top) / z - Number(target.y || 0);
    setSelectedElementId(elementId);
    setDragState({ elementId, offsetX, offsetY });
  };

  const onElementResizeMouseDown = (event, elementId) => {
    event.preventDefault();
    event.stopPropagation();
    const target = editor.elements.find((el) => el.id === elementId);
    if (!target) return;
    setSelectedElementId(elementId);
    setResizeState({ elementId, startX: event.clientX, startY: event.clientY, startW: Number(target.w || 0), startH: Number(target.h || 0) });
  };

  const onCanvasDragOver = (event) => event.preventDefault();

  const onCanvasDrop = (event) => {
    event.preventDefault();
    if (!canvasRef.current) return;
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;
    let payload;
    try { payload = JSON.parse(raw); } catch { return; }
    const rect = canvasRef.current.getBoundingClientRect();
    const z = canvasZoomRef.current;
    const x = normalizeToGrid(Math.round((event.clientX - rect.left) / z));
    const y = normalizeToGrid(Math.round((event.clientY - rect.top) / z));
    if (payload.kind === 'field') { addFieldElement(payload.fieldId, { x, y }); return; }
    if (payload.kind === 'text') { addTextElement({ x, y }); return; }
    if (payload.kind === 'select') { addSelectElement({ x, y }); return; }
    if (payload.kind === 'image') { addImageElement(payload.src || '', { x, y }); return; }
    if (payload.kind === 'shape') { addShapeElement(payload.shapeKind || 'line', { x, y }); }
  };

  const onToolDragStart = (event, data) => { event.dataTransfer.setData('application/json', JSON.stringify(data)); event.dataTransfer.effectAllowed = 'copy'; };

  const restoreTextSelection = (elementId, node) => {
    const saved = lastTextSelectionRef.current;
    if (!saved?.range || saved.elementId !== elementId || !node) return false;
    try {
      const range = saved.range.cloneRange();
      if (!node.contains(range.commonAncestorContainer)) return false;
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const restoreDocumentSelection = () => {
    const saved = lastDocumentSelectionRef.current;
    const node = documentEditorRef.current;
    if (!saved || !node) return false;
    try {
      const range = saved.cloneRange();
      if (!node.contains(range.commonAncestorContainer)) return false;
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const hasSelectionInsideNode = (selection, node) => {
    if (!selection || selection.rangeCount === 0 || !node) return false;
    try {
      return node.contains(selection.getRangeAt(0).commonAncestorContainer);
    } catch {
      return false;
    }
  };

  const selectionCoversWholeNode = (selection, node) => {
    if (!hasSelectionInsideNode(selection, node)) return false;
    try {
      const range = selection.getRangeAt(0);
      if (range.collapsed) return false;
      const fullRange = document.createRange();
      fullRange.selectNodeContents(node);
      return range.compareBoundaryPoints(Range.START_TO_START, fullRange) <= 0
        && range.compareBoundaryPoints(Range.END_TO_END, fullRange) >= 0;
    } catch {
      return false;
    }
  };

  const applyUniformFontSizeToNode = (node, ptValue) => {
    const pt = Number(ptValue || DOC_BASE_FONT_PT);
    if (!node || !Number.isFinite(pt)) return;
    const size = `${pt}pt`;
    node.style.fontSize = size;
    node.querySelectorAll('*').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.tagName === 'FONT') el.removeAttribute('size');
      if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'PATH' || el.tagName === 'LINE') return;
      el.style.fontSize = size;
    });
  };

  // Rich text
  const applyRichCommand = (command, value = null) => {
    if (!selectedElement || selectedElement.type !== 'text' || !richTextEditorRef.current) return;
    const elementId = selectedElement.id;
    const canvasNode = textElementRefs.current[elementId];

    const sel = window.getSelection();
    const hasLiveCanvasSelection = !!(canvasNode && sel && sel.rangeCount > 0 && canvasNode.contains(sel.getRangeAt(0).commonAncestorContainer));

    // Prefer formatting the real canvas editor so partial selections are respected.
    let targetNode = richTextEditorRef.current;
    if (canvasNode) {
      targetNode = canvasNode;
      canvasNode.focus();
      if (!hasLiveCanvasSelection) restoreTextSelection(elementId, canvasNode);
    }

    const latestHtml = targetNode?.innerHTML ?? canvasNode?.innerHTML ?? textDraftHtmlRef.current[elementId] ?? selectedElement.contentHtml ?? plainToHtml(selectedElement.content || '');
    if (targetNode && targetNode.innerHTML !== latestHtml) targetNode.innerHTML = latestHtml;
    targetNode?.focus();
    document.execCommand(command, false, value);

    const html = targetNode?.innerHTML ?? latestHtml;
    textDraftHtmlRef.current[elementId] = html;
    if (canvasNode && canvasNode.innerHTML !== html) canvasNode.innerHTML = html;
    if (richTextEditorRef.current && richTextEditorRef.current.innerHTML !== html) richTextEditorRef.current.innerHTML = html;
    updateSelectedElement({ contentHtml: html, content: htmlToPlain(html) });
  };
  const onRichEditorInput = () => {
    if (!selectedElement || selectedElement.type !== 'text' || !richTextEditorRef.current) return;
    const html = richTextEditorRef.current.innerHTML;
    updateSelectedElement({ contentHtml: html, content: htmlToPlain(html) });
  };

  // Document editor
  const applyDocumentCommand = (command, value = null) => {
    if (!documentEditorRef.current) return;
    documentEditorRef.current.focus();
    restoreDocumentSelection();
    document.execCommand(command, false, value);
    updateEditorField('documentHtml', documentEditorRef.current.innerHTML);
  };
  const applyActiveTextOrDocumentCommand = (command, value = null) => {
    if (selectedElement?.type === 'text') {
      applyRichCommand(command, value);
      return;
    }
    applyDocumentCommand(command, value);
  };
  const applyDocumentFontSizePt = (ptValue) => {
    const pt = Number(ptValue || DOC_BASE_FONT_PT);
    if (!documentEditorRef.current || !Number.isFinite(pt)) return;
    documentEditorRef.current.focus();
    const selection = window.getSelection();
    if (!hasSelectionInsideNode(selection, documentEditorRef.current)) {
      restoreDocumentSelection();
    }
    const activeSelection = window.getSelection();
    const shouldNormalizeWholeNode = selectionCoversWholeNode(activeSelection, documentEditorRef.current);
    document.execCommand('fontSize', false, '7');
    documentEditorRef.current.querySelectorAll('font[size="7"]').forEach((n) => { n.removeAttribute('size'); n.style.fontSize = `${pt}pt`; });
    if (shouldNormalizeWholeNode) {
      applyUniformFontSizeToNode(documentEditorRef.current, pt);
    }
    updateEditorField('documentHtml', documentEditorRef.current.innerHTML);
  };

  const applyRichFontSizePt = (ptValue, options = {}) => {
    const { forceWholeElement = false } = options;
    const pt = Number(ptValue || DOC_BASE_FONT_PT);
    if (!Number.isFinite(pt) || !selectedElement || selectedElement.type !== 'text') return;

    const elementId = selectedElement.id;
    const canvasNode = textElementRefs.current[elementId];
    const targetNode = canvasNode || richTextEditorRef.current;
    if (!targetNode) return;

    targetNode.focus();

    const sel = window.getSelection();
    const hasLiveSelection = hasSelectionInsideNode(sel, targetNode);
    if (!hasLiveSelection && canvasNode) {
      restoreTextSelection(elementId, targetNode);
    }

    const activeSelection = window.getSelection();
    const shouldNormalizeWholeNode = forceWholeElement || selectionCoversWholeNode(activeSelection, targetNode);
    if (shouldNormalizeWholeNode) {
      applyUniformFontSizeToNode(targetNode, pt);
    } else {
      document.execCommand('fontSize', false, '7');
      targetNode.querySelectorAll('font[size="7"]').forEach((n) => {
        n.removeAttribute('size');
        n.style.fontSize = `${pt}pt`;
      });
    }

    const html = targetNode.innerHTML;
    textDraftHtmlRef.current[elementId] = html;
    if (canvasNode && canvasNode.innerHTML !== html) canvasNode.innerHTML = html;
    if (richTextEditorRef.current && richTextEditorRef.current.innerHTML !== html) richTextEditorRef.current.innerHTML = html;
    updateSelectedElement({ contentHtml: html, content: htmlToPlain(html), fontSize: pt });
  };

  const applyActiveFontSizePt = (ptValue) => {
    if (selectedElement?.type === 'text') {
      applyRichFontSizePt(ptValue);
      return;
    }
    applyDocumentFontSizePt(ptValue);
  };
  const applyDocumentLineHeightToSelection = (lineHeightValue) => {
    if (!documentEditorRef.current) return;
    documentEditorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setToast('Selecciona texto para aplicar interlineado.');
      return;
    }
    const range = selection.getRangeAt(0);
    if (!documentEditorRef.current.contains(range.commonAncestorContainer)) {
      setToast('Selecciona texto dentro del documento.');
      return;
    }
    if (range.collapsed) {
      setToast('Selecciona texto para aplicar interlineado.');
      return;
    }
    const wrapper = document.createElement('span');
    wrapper.style.display = 'inline-block';
    wrapper.style.lineHeight = String(Number(lineHeightValue || 1.45));
    const fragment = range.extractContents();
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    selection.addRange(newRange);
    updateEditorField('documentHtml', documentEditorRef.current.innerHTML);
  };
  const onDocumentInput = () => { if (documentEditorRef.current) updateEditorField('documentHtml', documentEditorRef.current.innerHTML); };
  const insertVariableInDocument = (fieldId) => {
    if (!documentEditorRef.current) return;
    documentEditorRef.current.focus();
    document.execCommand('insertText', false, `{{${fieldId}}}`);
    updateEditorField('documentHtml', documentEditorRef.current.innerHTML);
  };
  const insertStyledLineInDocument = (mode = 'solid') => {
    if (!documentEditorRef.current) return;
    const styles = { solid: 'border-top:1px solid #94a3b8;margin:10px 0;', dashed: 'border-top:1px dashed #94a3b8;margin:10px 0;', signature: 'border-top:2px solid #334155;width:320px;max-width:100%;margin:20px auto 0 auto;padding-top:6px;text-align:center;font-weight:700;' };
    const html = mode === 'signature' ? `<div style="${styles.signature}">{{medico.nombre}}</div>` : `<div style="${styles[mode]}"></div>`;
    documentEditorRef.current.focus();
    document.execCommand('insertHTML', false, html);
    updateEditorField('documentHtml', documentEditorRef.current.innerHTML);
  };

  // Image upload
  const openUrlDialog = (mode) => { setUrlInput(''); setUrlDialog({ open: true, mode }); };
  const confirmUrlDialog = () => {
    const url = urlInput.trim();
    if (!url) { setToast('Escribe una URL valida.'); return; }
    if (urlDialog.mode === 'document') insertImageByUrlInDocument(url);
    else addImageElement(url, { x: 40, y: 220 });
    setUrlDialog({ open: false, mode: 'document' }); setUrlInput('');
  };
  const insertImageByUrlInDocument = (url) => {
    if (!documentEditorRef.current || !url) return;
    documentEditorRef.current.focus();
    document.execCommand('insertImage', false, url);
    updateEditorField('documentHtml', documentEditorRef.current.innerHTML);
  };
  const onDocumentImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const b64 = String(reader.result || ''); if (!documentEditorRef.current || !b64) return; documentEditorRef.current.focus(); document.execCommand('insertImage', false, b64); updateEditorField('documentHtml', documentEditorRef.current.innerHTML); };
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  const onAdvancedImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const b64 = String(reader.result || ''); if (!b64) return; addImageElement(b64, { x: 40, y: 220 }); };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const onWatermarkImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || '');
      if (!b64) return;
      addWatermarkElement(b64);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const buildEditorSnapshotForSave = () => {
    const draftMap = textDraftHtmlRef.current || {};
    const nextElements = (editor.elements || []).map((el) => {
      if (el.type !== 'text') return el;
      if (!Object.prototype.hasOwnProperty.call(draftMap, el.id)) return el;
      const html = String(draftMap[el.id] ?? el.contentHtml ?? plainToHtml(el.content || ''));
      return {
        ...el,
        contentHtml: html,
        content: htmlToPlain(html)
      };
    });

    const nextDocumentHtml = documentEditorRef.current
      ? String(documentEditorRef.current.innerHTML || '')
      : String(editor.documentHtml || '');

    return {
      ...editor,
      elements: nextElements,
      documentHtml: nextDocumentHtml
    };
  };

  // Save
  const saveTemplate = async () => {
    if (!editor.nombre.trim()) { setToast('Escribe un nombre para la plantilla.'); return; }
    setSaving(true);
    try {
      const editorForSave = buildEditorSnapshotForSave();
      setEditor(editorForSave);

      const payload = { nombre: editorForSave.nombre.trim(), categoria: editorForSave.categoria.trim() || 'General', tipoDocumento: editorForSave.tipoDocumento || 'general', orden: Number(editorForSave.orden || 999), descripcionNatural: editorForSave.descripcionNatural.trim(), activo: editorForSave.activo !== false, publicada: editorForSave.publicada !== false, schema: buildSchemaFromElements(editorForSave.elements, editorForSave.documentHtml || '', editorForSave.documentFontFamily || 'Trebuchet MS', Number(editorForSave.documentLineHeight || 1.45), editorForSave.page || PAGE), actualizadoAt: serverTimestamp(), actualizadoPor: user?.uid || 'sistema' };
      if (editorForSave.id) { await updateDoc(doc(db, 'catalogo_plantillas_documentos', editorForSave.id), payload); setToast('Plantilla actualizada.'); }
      else { const ref = await addDoc(collection(db, 'catalogo_plantillas_documentos'), { ...payload, creadoAt: serverTimestamp(), creadoPor: user?.uid || 'sistema' }); setEditor((prev) => ({ ...prev, id: ref.id })); setToast('Plantilla creada.'); }
    } catch (error) { console.error(error); setToast('No se pudo guardar la plantilla.'); }
    setSaving(false);
  };

  const toggleTemplateFlag = async (tpl, key) => {
    try { await updateDoc(doc(db, 'catalogo_plantillas_documentos', tpl.id), { [key]: !(tpl[key] !== false), actualizadoAt: serverTimestamp(), actualizadoPor: user?.uid || 'sistema' }); }
    catch (error) { console.error(error); setToast('No se pudo actualizar.'); }
  };

  const removeTemplate = async (tpl) => {
    if (!tpl) return;
    try { await deleteDoc(doc(db, 'catalogo_plantillas_documentos', tpl.id)); if (editor.id === tpl.id) onNewTemplate(); setToast('Plantilla eliminada.'); }
    catch (error) { console.error(error); setToast('No se pudo eliminar.'); }
  };

  const openDuplicate = (tpl) => {
    setDuplicateCandidate(tpl);
    setDuplicateName(`${tpl.nombre || 'Plantilla'} (Copia)`);
  };

  const executeDuplicate = async () => {
    const tpl = duplicateCandidate;
    if (!tpl?.id || !duplicateName.trim()) return;
    try {
      const snap = await getDoc(doc(db, 'catalogo_plantillas_documentos', tpl.id));
      if (!snap.exists()) { setToast('No se encontró la plantilla original.'); setDuplicateCandidate(null); return; }
      const { creadoAt, creadoPor, actualizadoAt, actualizadoPor, ...rest } = snap.data();
      const ref = await addDoc(collection(db, 'catalogo_plantillas_documentos'), {
        ...rest,
        nombre: duplicateName.trim(),
        creadoAt: serverTimestamp(),
        creadoPor: user?.uid || 'sistema',
        actualizadoAt: serverTimestamp(),
        actualizadoPor: user?.uid || 'sistema',
      });
      setDuplicateCandidate(null);
      setToast('Plantilla duplicada.');
      setTimeout(() => {
        const newTpl = templates.find(t => t.id === ref.id);
        if (newTpl) onSelectTemplate(newTpl);
      }, 800);
    } catch (error) { console.error(error); setToast('No se pudo duplicar.'); setDuplicateCandidate(null); }
  };

  const handleFieldClick = (fieldId) => {
    if (selectedElement?.type === 'field' && selectedElementId) {
      const meta = FIELD_LIBRARY.find((f) => f.id === fieldId);
      updateSelectedElement({
        bind: fieldId,
        label: meta?.label || selectedElement.label
      });
      return;
    }

    const hasSelectionInDocumentEditor = () => {
      const node = documentEditorRef.current;
      const selection = window.getSelection();
      if (!node || !selection || selection.rangeCount === 0) return false;
      try {
        const range = selection.getRangeAt(0);
        return node.contains(range.commonAncestorContainer);
      } catch {
        return false;
      }
    };

    if (selectedElement?.type === 'text' && selectedElementId) {
      const node = textElementRefs.current[selectedElementId];
      if (node) {
        node.focus();
        document.execCommand('insertText', false, `{{${fieldId}}}`);
        updateTextElementContent(selectedElementId, node.innerHTML);
        return;
      }
      const current = selectedElement.contentHtml || plainToHtml(selectedElement.content || '');
      const next = `${current} {{${fieldId}}}`;
      updateTextElementContent(selectedElementId, next);
      return;
    }

    if (hasSelectionInDocumentEditor()) {
      insertVariableInDocument(fieldId);
      return;
    }

    addFieldElement(fieldId);
  };

  // Element type label/color
  const elTypeInfo = (el) => {
    if (el.type === 'field') return { label: 'Campo', color: '#7c3aed', bg: '#f5f3ff' };
    if (el.type === 'text') return { label: 'Texto', color: '#0077B6', bg: '#eff6ff' };
    if (el.type === 'image') return { label: 'Imagen', color: '#059669', bg: '#f0fdf4' };
    if (el.type === 'select') return { label: 'Selección', color: '#0891b2', bg: '#ecfeff' };
    return { label: el.shapeKind || 'Forma', color: '#d97706', bg: '#fffbeb' };
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden bg-slate-100" style={{ height: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .studio-tb-btn { display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid #e2e8f0;border-radius:5px;background:white;color:#475569;cursor:pointer;transition:all .12s; }
        .studio-tb-btn:hover { background:#f1f5f9;color:#0f172a; }
        .studio-tb-btn.active { background:#dbeafe;border-color:#93c5fd;color:#1d4ed8; }
        .studio-panel::-webkit-scrollbar { width:4px; }
        .studio-panel::-webkit-scrollbar-track { background:transparent; }
        .studio-panel::-webkit-scrollbar-thumb { background:#cbd5e1;border-radius:2px; }
        .canvas-element-ring { position:absolute;inset:-1px;border-radius:2px;pointer-events:none; }
        .insert-tool-btn { display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 6px;border-radius:8px;border:1px solid #e2e8f0;background:white;cursor:pointer;transition:all .15s;font-size:11px;font-weight:600;color:#475569;width:100%;text-align:center; }
        .insert-tool-btn:hover { background:#f8fafc;border-color:#94a3b8;color:#0f172a; }
        .insert-tool-btn:active { transform:scale(.96); }
        .layer-item { display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .12s; }
        .layer-item:hover { background:#f1f5f9; }
        .layer-item.selected { background:#eff6ff;border-left:2px solid #0077B6; }
      `}</style>

      {/* ── Toast ── */}
      {message && (
        <div className="fixed top-4 right-4 z-[200] bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          {message}
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-slate-200 shadow-sm z-10 flex-shrink-0">
        <button onClick={() => goBackOr(navigate, '/admin/dashboard')} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex-shrink-0" title="Volver">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-shrink-0">
          <span style={{ fontFamily: 'Sora, sans-serif' }} className="text-base font-bold text-slate-800">Studio de Plantillas</span>
          <span className="ml-2 text-xs text-slate-400 hidden sm:inline">Editor visual para recetas y documentos</span>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1 flex-shrink-0" />

        <input
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 w-48 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Nombre de plantilla..."
          value={editor.nombre}
          onChange={(e) => updateEditorField('nombre', e.target.value)}
        />

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button onClick={onNewTemplate} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 font-semibold">
            <FilePlus2 size={14} /> Nueva
          </button>
          <button onClick={onNewRecipeTemplate} className="px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1.5 font-semibold">
            <FileText size={14} /> Nueva receta
          </button>
          <button onClick={saveTemplate} disabled={saving} className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5 font-bold shadow-sm">
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </header>

      {/* ── TOOLBAR ── */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto">
        {/* Edit / Preview toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 mr-1">
          <button onClick={() => setShowPreview(false)} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${!showPreview ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Editar</button>
          <button onClick={() => setShowPreview(true)} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${showPreview ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Preview</button>
        </div>

        {!showPreview && (
          <>
            {/* Text formatting */}
            <TBtn icon={<Bold size={13} />} onClick={() => applyActiveTextOrDocumentCommand('bold')} title="Negrita" />
            <TBtn icon={<Italic size={13} />} onClick={() => applyActiveTextOrDocumentCommand('italic')} title="Cursiva" />
            <TBtn icon={<Underline size={13} />} onClick={() => applyActiveTextOrDocumentCommand('underline')} title="Subrayado" />
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            <TBtn icon={<AlignLeft size={13} />} onClick={() => applyActiveTextOrDocumentCommand('justifyLeft')} title="Izquierda" />
            <TBtn icon={<AlignCenter size={13} />} onClick={() => applyActiveTextOrDocumentCommand('justifyCenter')} title="Centro" />
            <TBtn icon={<AlignRight size={13} />} onClick={() => applyActiveTextOrDocumentCommand('justifyRight')} title="Derecha" />
            <TBtn icon={<AlignJustify size={13} />} onClick={() => applyActiveTextOrDocumentCommand('justifyFull')} title="Justificar" />
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            <TBtn icon={<List size={13} />} onClick={() => applyActiveTextOrDocumentCommand('insertUnorderedList')} title="Lista" />
            <TBtn icon={<ListOrdered size={13} />} onClick={() => applyActiveTextOrDocumentCommand('insertOrderedList')} title="Lista numerada" />
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            <label className="inline-flex items-center gap-1 border border-slate-200 rounded-md px-2 py-1 bg-white text-xs font-semibold text-slate-600 cursor-pointer flex-shrink-0">
              <Type size={12} />
              <select className="outline-none bg-transparent text-xs" defaultValue="12" onChange={(e) => applyActiveFontSizePt(e.target.value)}>
                {[8,9,10,11,12,13,14,16,18,20,24,28,32,36].map((s) => <option key={s} value={s}>{s}pt</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-1 border border-slate-200 rounded-md px-2 py-1 bg-white text-xs font-semibold text-slate-600 cursor-pointer flex-shrink-0">
              <span className="text-[10px] font-black">F</span>
              <select className="outline-none bg-transparent text-xs" value={editor.documentFontFamily || 'Trebuchet MS'} onChange={(e) => updateEditorField('documentFontFamily', e.target.value)}>
                {FONT_FAMILY_OPTIONS.map((family) => <option key={family} value={family}>{family}</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-1 border border-slate-200 rounded-md px-2 py-1 bg-white text-xs font-semibold text-slate-600 cursor-pointer flex-shrink-0" title="Interlineado de la selección">
              <span className="text-[10px] font-black">↕</span>
              <select className="outline-none bg-transparent text-xs" defaultValue="1.45" onChange={(e) => applyDocumentLineHeightToSelection(Number(e.target.value))}>
                {LINE_HEIGHT_OPTIONS.map((v) => <option key={`lh_doc_${v}`} value={v}>{v}x</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-1 border border-slate-200 rounded-md px-2 py-1 bg-white text-xs font-semibold text-slate-600 cursor-pointer flex-shrink-0" title="Color de texto">
              <span className="text-xs font-black">A</span>
              <input type="color" onChange={(e) => applyActiveTextOrDocumentCommand('foreColor', e.target.value)} className="w-4 h-4 border-0 bg-transparent p-0 cursor-pointer" />
            </label>
            <label className="inline-flex items-center gap-1 border border-slate-200 rounded-md px-2 py-1 bg-white text-xs font-semibold text-slate-600 cursor-pointer flex-shrink-0" title="Resaltado">
              <Highlighter size={12} />
              <input type="color" onChange={(e) => applyActiveTextOrDocumentCommand('hiliteColor', e.target.value)} className="w-4 h-4 border-0 bg-transparent p-0 cursor-pointer" />
            </label>
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            <button type="button" onClick={() => insertStyledLineInDocument('solid')} className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 flex-shrink-0">Linea</button>
            <button type="button" onClick={() => insertStyledLineInDocument('dashed')} className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 flex-shrink-0">Punteada</button>
            <button type="button" onClick={() => insertStyledLineInDocument('signature')} className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 flex-shrink-0">Firma</button>
            <TBtn icon={<ImagePlus size={13} />} onClick={() => openUrlDialog('document')} title="Insertar imagen por URL" />
            <button type="button" onClick={() => documentImageInputRef.current?.click()} className="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-md bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 flex-shrink-0">
              <Upload size={12} /> Subir
            </button>
            <input ref={documentImageInputRef} type="file" accept="image/*" className="hidden" onChange={onDocumentImageFileChange} />
            {editor.tipoDocumento === 'receta' && (
              <>
                <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
                <button type="button" onClick={applyClassicRecipePreset} className="px-2.5 py-1 border border-blue-200 rounded-md bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap flex-shrink-0">Base receta</button>
                <button type="button" onClick={() => appendDocumentBlock('<p style="margin:0 0 6px 0;"><strong>Diagnostico:</strong> {{consulta.diagnostico}}</p>')} className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 whitespace-nowrap flex-shrink-0">+ Dx</button>
                <button type="button" onClick={() => appendDocumentBlock('<p style="margin:0 0 6px 0;"><strong>Tratamiento:</strong></p>{{consulta.tratamiento_html}}')} className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 whitespace-nowrap flex-shrink-0">+ Rx</button>
              </>
            )}
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            {/* Canvas controls */}
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-semibold border border-slate-200 rounded-md px-2 py-1 bg-white cursor-pointer flex-shrink-0">
              <input type="checkbox" checked={showCanvasGrid} onChange={(e) => setShowCanvasGrid(e.target.checked)} className="rounded" />
              <Grid3X3 size={12} />
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-semibold border border-slate-200 rounded-md px-2 py-1 bg-white cursor-pointer flex-shrink-0" title="Ajustar a reticula">
              <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="rounded" />
              Snap
            </label>
            <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg overflow-hidden bg-white flex-shrink-0">
              <button onClick={() => setCanvasZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))} className="p-1.5 text-slate-500 hover:bg-slate-50"><ZoomOut size={13} /></button>
              <span className="px-1.5 text-xs font-bold text-slate-700 min-w-[36px] text-center">{Math.round(canvasZoom * 100)}%</span>
              <button onClick={() => setCanvasZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} className="p-1.5 text-slate-500 hover:bg-slate-50"><ZoomIn size={13} /></button>
            </div>
            {selectedElementId && (
              <>
                <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
                <button onClick={duplicateSelected} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 font-semibold flex-shrink-0">
                  <Copy size={12} /> Dup
                </button>
                <button onClick={deleteSelected} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-rose-200 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold flex-shrink-0">
                  <Trash2 size={12} /> Borrar
                </button>
              </>
            )}
          </>
        )}
        {showPreview && (
          <span className="text-xs text-slate-400 font-medium">Vista previa con datos de ejemplo.</span>
        )}
      </div>

      {/* ── MAIN 3-COLUMN BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <aside className="w-60 flex flex-col bg-white border-r border-slate-200 flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 flex-shrink-0">
            {[['templates', 'Plantillas'], ['insert', 'Insertar'], ['layers', 'Capas']].map(([t, l]) => (
              <button key={t} onClick={() => setLeftTab(t)} className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${leftTab === t ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto studio-panel">

            {/* TAB: Templates */}
            {leftTab === 'templates' && (
              <div className="p-3 space-y-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white" placeholder="Buscar plantilla..." value={listFilter} onChange={(e) => setListFilter(e.target.value)} />
                </div>
                {filteredTemplates.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No hay plantillas.</p>}
                {filteredTemplates.map((tpl) => {
                  const sel = editor.id === tpl.id;
                  return (
                    <div key={tpl.id} className={`rounded-xl border p-2.5 transition-all ${sel ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <button onClick={() => onSelectTemplate(tpl)} className="w-full text-left">
                        <p className="text-xs font-bold text-slate-800 truncate">{tpl.nombre}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{tpl.categoria || 'General'} • {tpl.tipoDocumento === 'receta' ? 'Receta' : 'General'}</p>
                      </button>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <button onClick={() => toggleTemplateFlag(tpl, 'activo')} className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tpl.activo === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                          {tpl.activo === false ? 'Inactiva' : 'Activa'}
                        </button>
                        <button onClick={() => toggleTemplateFlag(tpl, 'publicada')} className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tpl.publicada === false ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {tpl.publicada === false ? 'Oculta' : 'Visible'}
                        </button>
                        <button onClick={() => openDuplicate(tpl)} title="Duplicar" className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 transition-colors">
                          <Copy size={9} className="inline" />
                        </button>
                        <button onClick={() => setDeleteCandidate(tpl)} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700">
                          <Trash2 size={9} className="inline" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB: Insert */}
            {leftTab === 'insert' && (
              <div className="p-3 space-y-4">
                {/* Text */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Texto</p>
                  <button draggable onDragStart={(e) => onToolDragStart(e, { kind: 'text' })} onClick={() => addTextElement()} className="insert-tool-btn w-full">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center"><Type size={16} className="text-blue-600" /></div>
                    Bloque de texto
                  </button>
                  <button draggable onDragStart={(e) => onToolDragStart(e, { kind: 'select' })} onClick={() => addSelectElement()} className="insert-tool-btn w-full mt-1.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center"><ChevronDown size={16} className="text-cyan-600" /></div>
                    Selección (opciones)
                  </button>
                </div>

                {/* Shapes */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Formas</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { kind: 'line', label: 'Linea H' },
                      { kind: 'line-vertical', label: 'Linea V' },
                      { kind: 'line-dashed', label: 'Punteada H' },
                      { kind: 'line-vertical-dashed', label: 'Punteada V' },
                      { kind: 'arrow', label: 'Flecha' },
                      { kind: 'rect', label: 'Rectangulo' },
                      { kind: 'circle', label: 'Circulo' }
                    ].map(({ kind, label }) => (
                      <button key={kind} draggable onDragStart={(e) => onToolDragStart(e, { kind: 'shape', shapeKind: kind })} onClick={() => addShapeElement(kind)} className="insert-tool-btn">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                          <ShapePreview kind={kind} stroke="#d97706" strokeWidth={1.5} />
                        </div>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Imagen</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button draggable onDragStart={(e) => onToolDragStart(e, { kind: 'image', src: '' })} onClick={() => openUrlDialog('advanced')} className="insert-tool-btn">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center"><ImagePlus size={16} className="text-emerald-600" /></div>
                      Por URL
                    </button>
                    <button onClick={() => advancedImageInputRef.current?.click()} className="insert-tool-btn">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center"><Upload size={16} className="text-emerald-600" /></div>
                      Subir
                    </button>
                    <input ref={advancedImageInputRef} type="file" accept="image/*" className="hidden" onChange={onAdvancedImageFileChange} />
                    <button onClick={() => addWatermarkElement(logoAzul)} className="insert-tool-btn col-span-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center"><Eye size={16} className="text-cyan-600" /></div>
                      Marca de agua (logo)
                    </button>
                    <button onClick={() => watermarkImageInputRef.current?.click()} className="insert-tool-btn col-span-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center"><Upload size={16} className="text-cyan-600" /></div>
                      Subir marca de agua
                    </button>
                    <input ref={watermarkImageInputRef} type="file" accept="image/*" className="hidden" onChange={onWatermarkImageFileChange} />
                  </div>
                </div>

                {/* Fields quick-add */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Campos dinamicos</p>
                  <p className="text-[10px] text-slate-400 mb-2">Ve a la pestaña <span className="font-bold text-slate-500">Campos</span> para insertar variables.</p>
                </div>
              </div>
            )}

            {/* TAB: Layers / Fields */}
            {leftTab === 'layers' && (
              <div className="p-3 space-y-3">
                {/* Field groups */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Variables — click inserta en texto, arrastra para objeto flotante</p>
                  {FIELD_GROUPS.map((group) => (
                    <div key={group.id} className="mb-1">
                      <button onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))} className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <span className="text-xs font-bold" style={{ color: group.color }}>{group.label}</span>
                        {expandedGroups[group.id] ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
                      </button>
                      {expandedGroups[group.id] && (
                        <div className="pl-2 space-y-0.5">
                          {group.fields.map((fieldId) => {
                            const meta = FIELD_LIBRARY.find((f) => f.id === fieldId);
                            if (!meta) return null;
                            return (
                              <button key={fieldId} draggable onDragStart={(e) => onToolDragStart(e, { kind: 'field', fieldId })} onClick={() => handleFieldClick(fieldId)} className="w-full text-left text-[11px] text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors font-medium truncate flex items-center gap-1.5">
                                <Variable size={10} style={{ color: group.color, flexShrink: 0 }} />
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Layers list */}
                {editor.elements.length > 0 && (
                  <div>
                    <div className="h-px bg-slate-200 my-2" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Objetos en lienzo ({editor.elements.length})</p>
                    {[...editor.elements].sort((a, b) => Number(b.zIndex || 1) - Number(a.zIndex || 1)).map((el) => {
                      const info = elTypeInfo(el);
                      const isSel = selectedElementId === el.id;
                      return (
                        <div key={el.id} onClick={() => setSelectedElementId(el.id)} className={`layer-item ${isSel ? 'selected' : ''}`}>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: info.bg, color: info.color }}>{info.label}</span>
                          <span className="text-[11px] text-slate-600 truncate flex-1">
                            {el.type === 'field' ? el.label : el.type === 'select' ? `[${(el.options || []).join('/')}]` : el.type === 'text' ? (el.content || '').slice(0, 20) : el.type === 'shape' ? el.shapeKind : (el.isWatermark ? 'marca de agua' : 'imagen')}
                          </span>
                          <span className="text-[10px] text-slate-400">z{el.zIndex || 1}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── CENTER: WORKSPACE ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-200">
          <div ref={workspaceRef} className="flex-1 overflow-auto p-8 flex justify-center items-start">

            {/* ── UNIFIED EDIT MODE: documento + objetos flotantes en un solo lienzo ── */}
            {!showPreview && (
              <div style={{ width: editor.page.width * canvasZoom, minHeight: editor.page.height * canvasZoom, position: 'relative', flexShrink: 0 }}>
                <div
                  ref={canvasRef}
                  className="bg-white border border-slate-300 shadow-2xl absolute top-0 left-0"
                  style={{ width: editor.page.width, minHeight: editor.page.height, transform: `scale(${canvasZoom})`, transformOrigin: 'top left' }}
                  onClick={() => { setSelectedElementId(null); setSmartGuides({ vertical: [], horizontal: [] }); }}
                  onDragOver={onCanvasDragOver}
                  onDrop={onCanvasDrop}
                >
                  {/* Retícula */}
                  {showCanvasGrid && (
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#e2e8f030 1px,transparent 1px),linear-gradient(90deg,#e2e8f030 1px,transparent 1px)', backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`, zIndex: 0 }} />
                  )}

                  {/* Guias inteligentes de alineacion */}
                  {smartGuides.vertical.map((x, idx) => (
                    <div key={`sg_v_${idx}_${x}`} className="absolute pointer-events-none" style={{ left: Number(x), top: 0, width: 1, height: '100%', background: '#0ea5e9', zIndex: 500, opacity: 0.9 }} />
                  ))}
                  {smartGuides.horizontal.map((y, idx) => (
                    <div key={`sg_h_${idx}_${y}`} className="absolute pointer-events-none" style={{ top: Number(y), left: 0, height: 1, width: '100%', background: '#0ea5e9', zIndex: 500, opacity: 0.9 }} />
                  ))}

                  {/* Capa de texto del documento (contentEditable) — base del lienzo */}
                  <div
                    ref={documentEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="absolute inset-0 text-slate-800 leading-relaxed focus:outline-none"
                    style={{
                      paddingTop: activeDocMargins.top,
                      paddingRight: activeDocMargins.right,
                      paddingBottom: activeDocMargins.bottom,
                      paddingLeft: activeDocMargins.left,
                      minHeight: editor.page.height,
                      fontFamily: editor.documentFontFamily || 'Trebuchet MS',
                      fontSize: `${DOC_BASE_FONT_PT}pt`,
                      lineHeight: Number(editor.documentLineHeight || 1.45),
                      zIndex: 1
                    }}
                    onInput={onDocumentInput}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => e.preventDefault()}
                  />

                  {/* Objetos flotantes — encima del texto */}
                  {editor.elements.map((el) => {
                    const selected = selectedElementId === el.id;
                    const info = elTypeInfo(el);
                    const isLine = el.type === 'shape' && (el.shapeKind === 'line' || el.shapeKind === 'line-dashed' || el.shapeKind === 'line-vertical' || el.shapeKind === 'line-vertical-dashed' || el.shapeKind === 'arrow');
                    return (
                      <div
                        key={el.id}
                        className={`absolute select-none ${isLine ? '' : 'rounded-sm'}`}
                        style={{
                          left: Number(el.x || 0),
                          top: Number(el.y || 0),
                          width: Number(el.w || 80),
                          height: el.type === 'image' || el.type === 'shape' ? Number(el.h || 20) : undefined,
                          minHeight: el.type === 'image' || el.type === 'shape' ? undefined : Number(el.h || 20),
                          fontSize: Number(el.fontSize || 12),
                          fontFamily: el.fontFamily || 'Trebuchet MS',
                          fontWeight: el.bold ? 700 : 500,
                          textAlign: el.align || 'left',
                          whiteSpace: 'pre-wrap',
                          lineHeight: Number(el.lineHeight || 1.35),
                          zIndex: getElementRenderZ(el),
                          overflow: 'visible',
                          opacity: Number(el.opacity ?? 1),
                          cursor: el.type === 'text' ? 'text' : 'move',
                          padding: el.type === 'shape' ? 0 : '2px 4px',
                          boxShadow: selected ? `0 0 0 2px #0077B6, 0 2px 8px rgba(0,0,0,.12)` : 'none',
                          background: selected && el.type !== 'shape' ? 'rgba(0,119,182,0.04)' : 'transparent'
                        }}
                        onMouseDown={(event) => onElementMouseDown(event, el.id)}
                        onClick={(event) => { event.stopPropagation(); setSelectedElementId(el.id); }}
                      >
                        {selected && (
                          <div className="absolute -top-5 left-0 flex items-center gap-1 pointer-events-none">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap" style={{ background: info.color, color: 'white' }}>{info.label}</span>
                          </div>
                        )}
                        <div data-drag-handle="true" onMouseDown={(event) => onElementMouseDown(event, el.id)} className="absolute -top-1.5 -left-1.5 bg-white border border-slate-300 rounded shadow-sm p-0.5 cursor-move" style={{ opacity: selected ? 1 : 0, transition: 'opacity .15s' }}>
                          <Grip size={8} className="text-slate-500 pointer-events-none" />
                        </div>
                        {el.type === 'image' ? (
                          el.src ? <img src={el.src} alt="" className="w-full h-full block" style={{ objectFit: el.objectFit || 'contain', opacity: Number(el.opacity ?? 1) }} /> : <div className="w-full h-full border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400 italic">Sin imagen</div>
                        ) : el.type === 'shape' ? renderShapeEl(el)
                        : el.type === 'field' ? (
                          <span style={{ color: '#7c3aed', fontWeight: 600 }} title={el.label || el.bind || 'Campo'}>
                            {buildCanvasFieldToken(el)}
                            {!shouldHideFieldLabel(el.bind || el.id) && (
                              <span className="text-slate-400 font-normal text-xs"> → {resolveDeep(PREVIEW_DATA, el.bind) || ''}</span>
                            )}
                          </span>
                        ) : el.type === 'select' ? (
                          <span style={{ color: '#0891b2', fontWeight: 600 }} title={`Opciones: ${(el.options || []).join(', ')}`}>
                            {el.value || el.options?.[0] || ''}
                            <span className="text-slate-400 font-normal" style={{ fontSize: Math.max(9, Number(el.fontSize || 12) - 1) }}> ({(el.options || []).join(' / ')})</span>
                          </span>
                        ) : (
                          <div
                            ref={(node) => {
                              if (node) textElementRefs.current[el.id] = node;
                              else delete textElementRefs.current[el.id];
                            }}
                            contentEditable
                            suppressContentEditableWarning
                            data-text-editable="true"
                            className="w-full h-full outline-none"
                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onInput={(event) => { textDraftHtmlRef.current[el.id] = event.currentTarget.innerHTML; }}
                            onBlur={() => commitInlineTextElement(el.id)}
                            dangerouslySetInnerHTML={{ __html: (textDraftHtmlRef.current[el.id] ?? el.contentHtml ?? plainToHtml(el.content || '')) }}
                          />
                        )}
                        {selected && (
                          <button type="button" title="Redimensionar" onMouseDown={(event) => onElementResizeMouseDown(event, el.id)} className="absolute -right-2 -bottom-2 w-5 h-5 rounded bg-white border-2 border-blue-500 shadow-md cursor-nwse-resize flex items-center justify-center" style={{ zIndex: 999 }}>
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-sm" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PREVIEW MODE ── */}
            {showPreview && (
              editor.tipoDocumento === 'receta' ? (
                <div style={{ width: PAGE.width * 0.9, minHeight: PAGE.height * 0.9, position: 'relative', flexShrink: 0 }}>
                  <div className="bg-white shadow-2xl border border-slate-300" style={{ width: PAGE.width, minHeight: PAGE.height, transform: 'scale(0.9)', transformOrigin: 'top left', position: 'relative' }}>
                    {[0, 1].map((copyIndex) => (
                      <div key={`recipe_preview_copy_${copyIndex}`} className="absolute left-0 w-full overflow-hidden border-b border-dashed border-slate-300" style={{ top: copyIndex * (PAGE.height / 2), height: PAGE.height / 2, borderBottomWidth: copyIndex === 0 ? 1 : 0 }}>
                        <div className="absolute top-0 left-0" style={{ width: editor.page.width, minHeight: editor.page.height, transform: `scale(${recipePreviewScale})`, transformOrigin: 'top left' }}>
                          {editor.documentHtml ? (
                            <div className="absolute inset-0 text-slate-800 leading-relaxed" style={{ paddingTop: activeDocMargins.top, paddingRight: activeDocMargins.right, paddingBottom: activeDocMargins.bottom, paddingLeft: activeDocMargins.left, fontFamily: editor.documentFontFamily || 'Trebuchet MS', fontSize: `${DOC_BASE_FONT_PT}pt`, lineHeight: Number(editor.documentLineHeight || 1.45) }} dangerouslySetInnerHTML={{ __html: resolveTemplateHtml(editor.documentHtml, PREVIEW_DATA) }} />
                          ) : null}
                          {editor.elements.map((el) => {
                            const isShapeOrImg = el.type === 'image' || el.type === 'shape';
                            return (
                            <div key={`prev_recipe_${copyIndex}_${el.id}`} className="absolute whitespace-pre-wrap leading-relaxed text-slate-800"
                              style={{
                                left: Number(el.x || 0),
                                top: Number(el.y || 0),
                                width: Number(el.w || 80),
                                height: isShapeOrImg ? Number(el.h || 20) : undefined,
                                minHeight: isShapeOrImg ? undefined : Number(el.h || 20),
                                fontSize: Number(el.fontSize || 12),
                                fontFamily: el.fontFamily || 'Trebuchet MS',
                                fontWeight: el.bold ? 700 : 500,
                                textAlign: el.align || 'left',
                                lineHeight: Number(el.lineHeight || 1.35),
                                zIndex: getElementRenderZ(el),
                                overflow: el.type === 'shape' ? 'visible' : 'hidden',
                                opacity: Number(el.opacity ?? 1)
                              }}>
                              {el.type === 'image' ? (el.src ? <img src={el.src} alt="" className="w-full h-full" style={{ objectFit: el.objectFit || 'contain', opacity: Number(el.opacity ?? 1) }} /> : null)
                                : el.type === 'shape' ? renderShapeEl(el)
                                : el.type === 'field' ? buildFieldDisplayText(el.bind, el.label, resolveDeep(PREVIEW_DATA, el.bind) || '')
                                : el.type === 'select' ? (el.value || el.options?.[0] || '')
                                : <div dangerouslySetInnerHTML={{ __html: resolveTemplateHtml(el.contentHtml || plainToHtml(el.content || ''), PREVIEW_DATA) }} />}
                            </div>
                            );
                          })}
                        </div>
                        {copyIndex === 0 && <div className="absolute bottom-0 left-3 px-1 text-[10px] text-slate-300 bg-white"></div>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ width: editor.page.width * 0.9, minHeight: editor.page.height * 0.9, position: 'relative', flexShrink: 0 }}>
                  <div className="bg-white shadow-2xl border border-slate-300" style={{ width: editor.page.width, minHeight: editor.page.height, transform: 'scale(0.9)', transformOrigin: 'top left' }}>
                    {editor.documentHtml ? (
                      <div className="absolute inset-0 text-slate-800 leading-relaxed" style={{ paddingTop: activeDocMargins.top, paddingRight: activeDocMargins.right, paddingBottom: activeDocMargins.bottom, paddingLeft: activeDocMargins.left, fontFamily: editor.documentFontFamily || 'Trebuchet MS', fontSize: `${DOC_BASE_FONT_PT}pt`, lineHeight: Number(editor.documentLineHeight || 1.45) }} dangerouslySetInnerHTML={{ __html: resolveTemplateHtml(editor.documentHtml, PREVIEW_DATA) }} />
                    ) : null}
                    {editor.elements.map((el) => {
                      const isShapeOrImg = el.type === 'image' || el.type === 'shape';
                      return (
                      <div key={`prev_${el.id}`} className="absolute whitespace-pre-wrap leading-relaxed text-slate-800"
                        style={{
                          left: Number(el.x || 0),
                          top: Number(el.y || 0),
                          width: Number(el.w || 80),
                          height: isShapeOrImg ? Number(el.h || 20) : undefined,
                          minHeight: isShapeOrImg ? undefined : Number(el.h || 20),
                          fontSize: Number(el.fontSize || 12),
                          fontFamily: el.fontFamily || 'Trebuchet MS',
                          fontWeight: el.bold ? 700 : 500,
                          textAlign: el.align || 'left',
                          lineHeight: Number(el.lineHeight || 1.35),
                          zIndex: getElementRenderZ(el),
                          overflow: el.type === 'shape' ? 'visible' : 'hidden',
                          opacity: Number(el.opacity ?? 1)
                        }}>
                        {el.type === 'image' ? (el.src ? <img src={el.src} alt="" className="w-full h-full" style={{ objectFit: el.objectFit || 'contain', opacity: Number(el.opacity ?? 1) }} /> : null)
                          : el.type === 'shape' ? renderShapeEl(el)
                          : el.type === 'field' ? buildFieldDisplayText(el.bind, el.label, resolveDeep(PREVIEW_DATA, el.bind) || '')
                          : el.type === 'select' ? (el.value || el.options?.[0] || '')
                          : <div dangerouslySetInnerHTML={{ __html: resolveTemplateHtml(el.contentHtml || plainToHtml(el.content || ''), PREVIEW_DATA) }} />}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

          </div>
        </div>

        {/* ── RIGHT PANEL: INSPECTOR ── */}
        <aside className="w-72 flex flex-col bg-white border-l border-slate-200 flex-shrink-0 overflow-y-auto studio-panel">

          {/* Template metadata (collapsible) */}
          <div className="border-b border-slate-200">
            <button onClick={() => setShowMetadata((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-2"><Settings2 size={13} /> Metadatos de plantilla</span>
              {showMetadata ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </button>
            {showMetadata && (
              <div className="px-4 pb-4 space-y-2.5">
                <InspField label="Categoria">
                  <input className="insp-input" value={editor.categoria} onChange={(e) => updateEditorField('categoria', e.target.value)} placeholder="General" />
                </InspField>
                <InspField label="Tipo">
                  <select className="insp-input" value={editor.tipoDocumento || 'general'} onChange={(e) => updateEditorField('tipoDocumento', e.target.value)}>
                    <option value="general">Documento general</option>
                    <option value="receta">Receta medica</option>
                  </select>
                </InspField>
                <InspField label="Orden">
                  <input className="insp-input" type="number" value={editor.orden} onChange={(e) => updateEditorField('orden', e.target.value)} />
                </InspField>
                <InspField label="Descripcion">
                  <input className="insp-input" value={editor.descripcionNatural} onChange={(e) => updateEditorField('descripcionNatural', e.target.value)} placeholder="Descripcion corta..." />
                </InspField>
                <div className="flex gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={editor.activo !== false} onChange={(e) => updateEditorField('activo', e.target.checked)} className="rounded" />
                    Activa
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={editor.publicada !== false} onChange={(e) => updateEditorField('publicada', e.target.checked)} className="rounded" />
                    Visible
                  </label>
                </div>
                {editor.tipoDocumento === 'receta' && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 space-y-1">
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-1.5">Bloques rapidos de receta</p>
                    {[['Base clasica', applyClassicRecipePreset], ['+ Diagnostico', () => appendDocumentBlock('<p style="margin:0 0 6px 0;"><strong>Diagnostico:</strong> {{consulta.diagnostico}}</p>')], ['+ Tratamiento', () => appendDocumentBlock('<p style="margin:0 0 6px 0;"><strong>Tratamiento:</strong></p>{{consulta.tratamiento_html}}')], ['+ Indicaciones', () => appendDocumentBlock('<p style="margin:8px 0 0 0;"><strong>Indicaciones:</strong> {{consulta.indicaciones}}</p>')], ['Firma', () => appendDocumentBlock('<p style="margin-top:24px;text-align:center;">{{firma.linea}}</p>')]].map(([lbl, fn]) => (
                      <button key={lbl} type="button" onClick={fn} className="w-full text-left text-[11px] font-semibold text-blue-700 hover:text-blue-900 py-0.5 px-1 rounded hover:bg-blue-100 transition-colors">{lbl}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Element Inspector */}
          <div className="flex-1 p-4">
            {!selectedElement ? (
              <div className="flex flex-col items-center justify-center text-center py-10 text-slate-400">
                <MousePointer2 size={28} className="mb-3 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">Selecciona un elemento</p>
                <p className="text-[11px] text-slate-400 mt-1">Haz clic sobre cualquier objeto en el lienzo para editar sus propiedades.</p>
                <p className="text-[10px] text-slate-300 mt-3">Atajos: <span className="font-mono">Del</span> borrar · <span className="font-mono">Ctrl+D</span> duplicar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SquareDashed size={14} style={{ color: elTypeInfo(selectedElement).color }} />
                    <span className="text-sm font-bold text-slate-800">{elTypeInfo(selectedElement).label}</span>
                  </div>
                  <button onClick={() => setSelectedElementId(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={14} /></button>
                </div>

                {/* Field-specific */}
                {selectedElement.type === 'field' && (
                  <div className="space-y-2">
                    <InspField label="Variable">
                      <select className="insp-input" value={selectedElement.bind} onChange={(e) => { const nb = e.target.value; const m = FIELD_LIBRARY.find((f) => f.id === nb); updateSelectedElement({ bind: nb, label: m?.label || selectedElement.label }); }}>
                        {FIELD_LIBRARY.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </InspField>
                    <InspField label="Etiqueta">
                      <input className="insp-input" value={selectedElement.label || ''} onChange={(e) => updateSelectedElement({ label: e.target.value })} />
                    </InspField>
                  </div>
                )}

                {/* Select-specific */}
                {selectedElement.type === 'select' && (
                  <div className="space-y-2">
                    <InspField label="Valor por defecto">
                      <select className="insp-input" value={selectedElement.value || ''} onChange={(e) => updateSelectedElement({ value: e.target.value })}>
                        {(selectedElement.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </InspField>
                    <InspField label="Opciones (una por línea)">
                      <textarea
                        className="insp-input min-h-[80px] resize-y text-xs"
                        value={(selectedElement.options || []).join('\n')}
                        onChange={(e) => {
                          const opts = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                          const curVal = selectedElement.value || '';
                          updateSelectedElement({ options: opts, value: opts.includes(curVal) ? curVal : (opts[0] || '') });
                        }}
                      />
                    </InspField>
                    <InspField label="Etiqueta (opcional)">
                      <input className="insp-input" value={selectedElement.label || ''} onChange={(e) => updateSelectedElement({ label: e.target.value })} placeholder="Ej: Resultado" />
                    </InspField>
                  </div>
                )}

                {/* Image-specific */}
                {selectedElement.type === 'image' && (
                  <div className="space-y-2">
                    <InspField label="URL de imagen">
                      <input className="insp-input" value={selectedElement.src || ''} onChange={(e) => updateSelectedElement({ src: e.target.value })} placeholder="https://..." />
                    </InspField>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selectedElement.isWatermark}
                        onChange={(e) => updateSelectedElement({ isWatermark: e.target.checked, zIndex: e.target.checked ? 0 : Number(selectedElement.zIndex || 2) })}
                        className="rounded"
                      />
                      Usar como marca de agua (fondo)
                    </label>
                    {selectedElement.isWatermark && <p className="text-[10px] text-slate-400">La marca de agua queda detrás del contenido. Si no puedes hacer clic directo, selecciónala desde la pestaña Capas.</p>}
                    <InspField label="Ajuste">
                      <select className="insp-input" value={selectedElement.objectFit || 'contain'} onChange={(e) => updateSelectedElement({ objectFit: e.target.value })}>
                        <option value="contain">Ajustar (contain)</option>
                        <option value="cover">Cubrir (cover)</option>
                        <option value="fill">Estirar (fill)</option>
                      </select>
                    </InspField>
                    <InspField label={`Opacidad (${Math.round(Number(selectedElement.opacity ?? 1) * 100)}%)`}>
                      <input type="range" min="0.05" max="1" step="0.05" value={Number(selectedElement.opacity ?? 1)} onChange={(e) => updateSelectedElement({ opacity: Number(e.target.value) })} className="w-full mt-1" />
                    </InspField>
                  </div>
                )}

                {/* Shape-specific */}
                {selectedElement.type === 'shape' && (
                  <div className="space-y-2">
                    <InspField label="Tipo de forma">
                      <select className="insp-input" value={selectedElement.shapeKind || 'line'} onChange={(e) => updateSelectedElement({ shapeKind: e.target.value })}>
                        <option value="line">Linea horizontal</option>
                        <option value="line-vertical">Linea vertical</option>
                        <option value="line-dashed">Linea punteada H</option>
                        <option value="line-vertical-dashed">Linea punteada V</option>
                        <option value="arrow">Flecha</option>
                        <option value="rect">Rectangulo</option>
                        <option value="circle">Circulo</option>
                      </select>
                    </InspField>
                    <div className="grid grid-cols-2 gap-2">
                      <InspField label="Color borde">
                        <input type="color" className="w-full h-8 rounded border border-slate-200 cursor-not-allowed" value={FORCED_SHAPE_STROKE} disabled readOnly />
                      </InspField>
                      <InspField label="Color relleno">
                        <input type="color" className="w-full h-8 rounded border border-slate-200 cursor-not-allowed" value={FORCED_SHAPE_STROKE} disabled readOnly />
                      </InspField>
                    </div>
                    <p className="text-[10px] text-slate-400">Para asegurar visibilidad e impresion consistente, las formas usan color negro forzado.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldNum label="Grosor" value={selectedElement.strokeWidth || 1} onChange={(v) => updateSelectedElement({ strokeWidth: Math.max(1, v) })} />
                      <FieldNum label="Radio" value={selectedElement.radius || 0} onChange={(v) => updateSelectedElement({ radius: Math.max(0, v) })} />
                    </div>
                    <InspField label={`Opacidad (${Math.round(Number(selectedElement.opacity ?? 1) * 100)}%)`}>
                      <input type="range" min="0.1" max="1" step="0.05" value={Number(selectedElement.opacity ?? 1)} onChange={(e) => updateSelectedElement({ opacity: Number(e.target.value) })} className="w-full mt-1" />
                    </InspField>
                  </div>
                )}

                {/* Text-specific */}
                {selectedElement.type === 'text' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Formato de texto</p>
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <TBtn icon={<Bold size={12} />} onClick={() => applyRichCommand('bold')} title="Negrita" />
                      <TBtn icon={<Italic size={12} />} onClick={() => applyRichCommand('italic')} title="Cursiva" />
                      <TBtn icon={<Underline size={12} />} onClick={() => applyRichCommand('underline')} title="Subrayado" />
                      <div className="w-px h-5 bg-slate-200 self-center" />
                      <TBtn icon={<AlignLeft size={12} />} onClick={() => applyRichCommand('justifyLeft')} title="Izquierda" />
                      <TBtn icon={<AlignCenter size={12} />} onClick={() => applyRichCommand('justifyCenter')} title="Centro" />
                      <TBtn icon={<AlignRight size={12} />} onClick={() => applyRichCommand('justifyRight')} title="Derecha" />
                      <TBtn icon={<List size={12} />} onClick={() => applyRichCommand('insertUnorderedList')} title="Lista" />
                      <label className="inline-flex items-center gap-1 border border-slate-200 rounded px-1.5 py-0.5 bg-white text-[10px] font-semibold text-slate-600 cursor-pointer">
                        <Type size={11} />
                        <select className="outline-none bg-transparent text-[10px]" value={Number(selectedElement.fontSize || 12)} onChange={(e) => applyRichFontSizePt(Number(e.target.value), { forceWholeElement: true })}>
                          {[8,9,10,11,12,13,14,16,18,20,24,28,32].map((s) => <option key={s} value={s}>{s}px</option>)}
                        </select>
                      </label>
                      <label className="inline-flex items-center border border-slate-200 rounded px-1.5 py-0.5 bg-white cursor-pointer" title="Color">
                        <span className="text-[10px] font-black mr-1">A</span>
                        <input type="color" onChange={(e) => applyRichCommand('foreColor', e.target.value)} className="w-4 h-4 border-0 bg-transparent p-0 cursor-pointer" />
                      </label>
                    </div>
                    <div ref={richTextEditorRef} contentEditable suppressContentEditableWarning className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-24 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" onInput={onRichEditorInput} />
                    <p className="text-[10px] text-slate-400">Usa <code className="font-mono bg-slate-100 px-1 rounded">{'{{variable}}'}</code> para datos dinamicos.</p>
                  </div>
                )}

                {/* Position & Size */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Posicion y tamano</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldNum label="X" value={selectedElement.x} onChange={(v) => updateSelectedElement({ x: v })} />
                    <FieldNum label="Y" value={selectedElement.y} onChange={(v) => updateSelectedElement({ y: v })} />
                    <FieldNum label="Ancho" value={selectedElement.w} onChange={(v) => updateSelectedElement({ w: v })} />
                    <FieldNum label="Alto" value={selectedElement.h} onChange={(v) => updateSelectedElement({ h: v })} />
                    {selectedElement.type !== 'image' && selectedElement.type !== 'shape' && (
                      <FieldNum label="Fuente (px)" value={selectedElement.fontSize} onChange={(v) => {
                        if (selectedElement.type === 'text') {
                          applyRichFontSizePt(v, { forceWholeElement: true });
                          return;
                        }
                        updateSelectedElement({ fontSize: v });
                      }} />
                    )}
                    <FieldNum label="Capa (z)" value={selectedElement.zIndex || 1} onChange={(v) => updateSelectedElement({ zIndex: v })} />
                  </div>
                </div>

                {selectedElement.type !== 'image' && selectedElement.type !== 'shape' && (
                  <InspField label="Fuente">
                    <select className="insp-input" value={selectedElement.fontFamily || 'Trebuchet MS'} onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}>
                      {FONT_FAMILY_OPTIONS.map((family) => <option key={family} value={family}>{family}</option>)}
                    </select>
                  </InspField>
                )}

                {selectedElement.type !== 'image' && selectedElement.type !== 'shape' && (
                  <InspField label="Interlineado">
                    <select className="insp-input" value={Number(selectedElement.lineHeight || 1.35)} onChange={(e) => updateSelectedElement({ lineHeight: Number(e.target.value) })}>
                      {LINE_HEIGHT_OPTIONS.map((v) => <option key={`lh_el_${v}`} value={v}>{v}x</option>)}
                    </select>
                  </InspField>
                )}

                {/* Text align & bold for non-shapes */}
                {selectedElement.type !== 'image' && selectedElement.type !== 'shape' && (
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
                      <input type="checkbox" checked={!!selectedElement.bold} onChange={(e) => updateSelectedElement({ bold: e.target.checked })} className="rounded" />
                      Negrita global
                    </label>
                    <select className="insp-input" value={selectedElement.align || 'left'} onChange={(e) => updateSelectedElement({ align: e.target.value })}>
                      <option value="left">Alineacion izquierda</option>
                      <option value="center">Alineacion centrada</option>
                      <option value="right">Alineacion derecha</option>
                    </select>
                  </div>
                )}

                {/* Layer order */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Orden de capas</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={bringSelectedToFront} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50">Traer al frente</button>
                    <button onClick={sendSelectedToBack} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50">Enviar atras</button>
                    <button onClick={() => moveSelectedLayer(1)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50">Subir capa</button>
                    <button onClick={() => moveSelectedLayer(-1)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50">Bajar capa</button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <button onClick={duplicateSelected} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">
                    <Copy size={13} /> Duplicar
                  </button>
                  <button onClick={deleteSelected} className="flex-1 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 inline-flex items-center justify-center gap-1.5">
                    <Trash2 size={13} /> Borrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── MODALS ── */}
      {urlDialog.open && (
        <div className="fixed inset-0 z-[180] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5">
            <h3 className="text-base font-black text-slate-800">Insertar imagen por URL</h3>
            <p className="text-xs text-slate-500 mt-1">Pega la URL completa de una imagen accesible.</p>
            <input className="mt-4 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="https://..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmUrlDialog()} autoFocus />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setUrlDialog({ open: false, mode: 'document' })} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmUrlDialog} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Insertar</button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-[180] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5">
            <h3 className="text-base font-black text-slate-800">Eliminar plantilla</h3>
            <p className="text-sm text-slate-500 mt-2">Esta accion no se puede deshacer. Se eliminara: <span className="font-bold text-slate-700">{deleteCandidate?.nombre}</span></p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteCandidate(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
              <button onClick={async () => { await removeTemplate(deleteCandidate); setDeleteCandidate(null); }} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {duplicateCandidate && (
        <div className="fixed inset-0 z-[180] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Copy size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Duplicar plantilla</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Se creará una copia de <span className="font-bold text-slate-600">{duplicateCandidate?.nombre}</span></p>
              </div>
            </div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nombre de la copia</label>
            <input
              className="mt-1.5 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-slate-50"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeDuplicate()}
              autoFocus
              placeholder="Nombre..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDuplicateCandidate(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={executeDuplicate} disabled={!duplicateName.trim()} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 shadow-sm">Duplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Global insp-input style */}
      <style>{`.insp-input { width:100%;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;font-size:12px;color:#1e293b;background:white;outline:none; } .insp-input:focus { border-color:#93c5fd;box-shadow:0 0 0 2px rgba(147,197,253,.3); }`}</style>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const FieldNum = ({ label, value, onChange }) => (
  <label className="text-[10px] text-slate-500 font-semibold">
    {label}
    <input type="number" className="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-300" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value || 0))} />
  </label>
);

const InspField = ({ label, children }) => (
  <div>
    <p className="text-[10px] text-slate-400 font-semibold mb-1">{label}</p>
    {children}
  </div>
);

const TBtn = ({ icon, onClick, title, active }) => (
  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} title={title} className={`studio-tb-btn ${active ? 'active' : ''}`}>{icon}</button>
);

export default PlantillasDocumentos;
