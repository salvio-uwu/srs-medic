import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const HOMOLOGATION_COLLECTION = 'resumenes_homologados';

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const decodeAndNormalize = (value = '') => {
  const parsed = new DOMParser().parseFromString(String(value), 'text/html');
  return normalizeText(parsed.documentElement.textContent || '');
};

const stripHtml = (value = '') => decodeAndNormalize(String(value).replace(/<br\s*\/?>/gi, '\n'));

const normalizeDateTime = (value = '') => {
  const raw = normalizeText(value);
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return raw;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);

  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toISOString();
};

const getMatch = (text = '', regex) => {
  const match = String(text).match(regex);
  return normalizeText(match?.[1] || '');
};

const getNumeric = (text = '', regex) => {
  const value = getMatch(text, regex).replace(',', '.');
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseLegacyConsultations = (htmlText = '') => {
  const blocks = [];
  const regex = /<b>\s*CONSULTA\s*<\/b>[\s\S]*?<b>\s*([^<]+?)\s*<\/b>[\s\S]*?<\/tr>([\s\S]*?)(?=<tr>\s*<td[^>]*>\s*(?:<label>)?\s*<b>\s*CONSULTA\s*<\/b>|<\/table>)/gi;
  let match;

  while ((match = regex.exec(htmlText)) !== null) {
    const fechaConsultaRaw = normalizeText(match[1]);
    const blockHtml = match[2] || '';
    const blockText = stripHtml(blockHtml);

    const padecimiento = stripHtml(
      (blockHtml.match(/<b>\s*PADECIMIENTO\s*<\/b>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || ''
    );

    const diagnostico = stripHtml(
      (blockHtml.match(/<strong>\s*Diagn[^<]*<\/strong>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i) || [])[1] || ''
    );

    const tratamiento = stripHtml(
      (blockHtml.match(/<b>\s*Tratamiento:\s*<\/b>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i) || [])[1] || ''
    );

    const indicaciones = stripHtml(
      (blockHtml.match(/Indicaciones\/Medidas generales:[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || ''
    );

    const medico = getMatch(blockText, /M[ée]dico:\s*([^\n]+?)\s+C[ée]dula:/i) || getMatch(blockText, /M[ée]dico:\s*([^\n]+)/i);
    const cedula = getMatch(blockText, /C[ée]dula:\s*([^\n]+)/i);
    const temperatura = getNumeric(blockText, /Temperatura:\s*([0-9]+(?:[\.,][0-9]+)?)/i);
    const ta = getMatch(blockText, /TA:\s*([0-9]{2,3}\s*\/\s*[0-9]{2,3})/i);
    const fc = getNumeric(blockText, /FC:\s*([0-9]+(?:[\.,][0-9]+)?)/i);
    const talla = getNumeric(blockText, /Talla:\s*([0-9]+(?:[\.,][0-9]+)?)/i);
    const peso = getNumeric(blockText, /Peso:\s*([0-9]+(?:[\.,][0-9]+)?)/i);
    const imc = getNumeric(blockText, /IMC:\s*([0-9]+(?:[\.,][0-9]+)?)/i);

    blocks.push({
      fechaConsulta: normalizeDateTime(fechaConsultaRaw),
      fechaConsultaRaw,
      medico,
      cedula,
      padecimiento,
      diagnostico,
      tratamiento,
      indicaciones,
      temperatura,
      ta,
      fc,
      talla,
      peso,
      imc
    });
  }

  return blocks;
};

const pickLabelValue = (docRef, label) => {
  const target = String(label || '').toLowerCase().trim();
  const cells = Array.from(docRef.querySelectorAll('td'));

  for (const cell of cells) {
    const key = normalizeText(cell.textContent || '').toLowerCase().replace(/[:\s]+$/g, '');
    if (key !== target) continue;
    const valueCell = cell.nextElementSibling;
    return normalizeText(valueCell?.textContent || '');
  }

  return '';
};

const pickSectionText = (htmlText, patterns = []) => {
  const lines = String(htmlText || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const match = lines.find((line) => patterns.some((pattern) => pattern.test(line)));
  return match || '';
};

export const parseLegacyHtmlClinicalData = (htmlText, fileName = '') => {
  if (!htmlText) return null;

  try {
    const parser = new DOMParser();
    const dom = parser.parseFromString(htmlText, 'text/html');

    const idPaciente = pickLabelValue(dom, 'ID del paciente');
    const nombre = pickLabelValue(dom, 'Nombre');
    const fechaNacimiento =
      pickLabelValue(dom, 'Fecha de nacimiento') || pickLabelValue(dom, 'Fecha de Nacimiento');
    const sexo = pickLabelValue(dom, 'Sexo');

    const padecimiento = pickSectionText(htmlText, [
      /padecimiento actual/i,
      /motivo de consulta/i,
      /enfermedad actual/i
    ]);

    const diagnostico = pickSectionText(htmlText, [/diagnostico/i, /impresion diagnostica/i]);
    const tratamiento = pickSectionText(htmlText, [/tratamiento/i, /indicaciones/i, /receta/i]);
    const alergias = pickSectionText(htmlText, [/alergia/i, /hipersensibilidad/i]);

    const consultas = parseLegacyConsultations(htmlText);
    const firstConsulta = consultas[0] || {};

    return {
      idPaciente,
      nombre,
      fechaNacimiento,
      sexo,
      fechaConsulta: firstConsulta.fechaConsulta || '',
      medico: firstConsulta.medico || '',
      cedula: firstConsulta.cedula || '',
      padecimiento: firstConsulta.padecimiento || padecimiento,
      diagnostico: firstConsulta.diagnostico || diagnostico,
      tratamiento: firstConsulta.tratamiento || tratamiento,
      indicaciones: firstConsulta.indicaciones || '',
      temperatura: firstConsulta.temperatura ?? null,
      ta: firstConsulta.ta || '',
      fc: firstConsulta.fc ?? null,
      talla: firstConsulta.talla ?? null,
      peso: firstConsulta.peso ?? null,
      imc: firstConsulta.imc ?? null,
      alergias,
      consultas,
      sourceFile: fileName,
      extractedAtIso: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error parseando HTML legacy', error);
    return null;
  }
};

export const calculateHomologationMetrics = (rows = []) => {
  const total = rows.length;
  if (!total) {
    return {
      totalLegacy: 0,
      homologados: 0,
      completitudPromedio: 0,
      conAlergias: 0,
      conDiagnostico: 0,
      scoreCalidad: 0
    };
  }

  let completitudAcumulada = 0;
  let conAlergias = 0;
  let conDiagnostico = 0;

  rows.forEach((row) => {
    const data = row?.normalized || {};
    const fields = [data.idPaciente, data.nombre, data.fechaNacimiento, data.sexo, data.padecimiento, data.diagnostico, data.tratamiento];
    const completos = fields.filter((field) => !!normalizeText(field)).length;
    const pct = Math.round((completos / fields.length) * 100);
    completitudAcumulada += pct;

    if (normalizeText(data.alergias)) conAlergias += 1;
    if (normalizeText(data.diagnostico)) conDiagnostico += 1;
  });

  const completitudPromedio = Math.round(completitudAcumulada / total);

  return {
    totalLegacy: total,
    homologados: total,
    completitudPromedio,
    conAlergias,
    conDiagnostico,
    scoreCalidad: Math.round((completitudPromedio * 0.7) + ((conDiagnostico / total) * 30))
  };
};

export const upsertHomologatedLegacySummary = async ({
  pacienteId,
  modulePath,
  fileName,
  normalized,
  aiSummary,
  aiConfidence = 'media',
  source = 'legacy_html'
}) => {
  if (!pacienteId || !modulePath) return { status: 'skipped' };

  const key = String(modulePath)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(-120);

  const docId = `${pacienteId}__${key}`;

  await setDoc(
    doc(db, HOMOLOGATION_COLLECTION, docId),
    {
      pacienteId,
      modulePath,
      fileName: fileName || modulePath.split('/').pop() || 'sin_nombre.html',
      normalized: normalized || {},
      aiSummary: normalizeText(aiSummary || ''),
      aiConfidence,
      source,
      updatedAt: serverTimestamp(),
      homologatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return { status: 'ok', docId };
};

export const listHomologatedSummariesByPaciente = async (pacienteId) => {
  if (!pacienteId) return [];

  const snap = await getDocs(
    query(collection(db, HOMOLOGATION_COLLECTION), where('pacienteId', '==', pacienteId))
  );

  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};
