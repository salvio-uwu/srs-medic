import { CheckCircle2, XCircle, HelpCircle, MinusCircle } from 'lucide-react';

export const ANSWER_OPTIONS = [
  { key: 'SI', label: 'Si cumple', short: 'SI', icon: CheckCircle2, color: '#059669', gradient: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'ring-emerald-400' },
  { key: 'NO', label: 'No cumple', short: 'NO', icon: XCircle, color: '#dc2626', gradient: 'from-red-400 to-red-600', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', ring: 'ring-red-400' },
  { key: 'PARCIAL', label: 'Parcial', short: 'Parcial', icon: HelpCircle, color: '#d97706', gradient: 'from-amber-400 to-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-amber-400' },
  { key: 'NA', label: 'No aplica', short: 'N/A', icon: MinusCircle, color: '#64748b', gradient: 'from-slate-400 to-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', ring: 'ring-slate-400' },
];

const ROMAN_MAP = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90],
  ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];
export const romanize = (num) => {
  let n = num;
  let out = '';
  for (const [sym, val] of ROMAN_MAP) {
    while (n >= val) { out += sym; n -= val; }
  }
  return out || String(num);
};

export const buildInitialState = (sections) => {
  const answers = {};
  const observations = {};
  const subAnswers = {};
  const subObs = {};
  const photos = {};
  const tableData = {};
  const enabled = {};
  const sectionEnabled = {};
  sections.forEach((s) => {
    sectionEnabled[s.id] = true;
    s.questions.forEach((q) => {
      enabled[q.id] = true;
      answers[q.id] = null;
      observations[q.id] = '';
      photos[q.id] = [];
      if (q.tableHeaders) {
        tableData[q.id] = [
          { muestra: '', localizacion: '', resultado: '' },
          { muestra: '', localizacion: '', resultado: '' },
          { muestra: '', localizacion: '', resultado: '' }
        ];
      }
      if (q.subitems) {
        q.subitems.forEach((sub) => {
          subAnswers[sub.id] = null;
          subObs[sub.id] = '';
        });
      }
    });
  });
  return { answers, observations, subAnswers, subObs, photos, tableData, enabled, sectionEnabled };
};

export const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxWidth && height <= maxHeight) { resolve(file); return; }
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDateES = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
};

export const sanitizeHTML = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

export const getNextId = (sections) => {
  let max = 0;
  sections.forEach((s) => s.questions.forEach((q) => {
    const n = parseInt(String(q.id), 10);
    if (!isNaN(n) && n > max) max = n;
  }));
  return max + 1;
};

export const getAllQuestionIds = (sections) => {
  const ids = [];
  sections.forEach((s) => s.questions.forEach((q) => ids.push(String(q.id))));
  return ids;
};

export const getComplianceStats = (sections, enabled, sectionEnabled, answers, subAnswers) => {
  const allQuestions = [];
  const allSubitems = [];
  sections.forEach((s) => {
    if (!sectionEnabled[s.id]) return;
    s.questions.forEach((q) => {
      if (!enabled[q.id]) return;
      allQuestions.push(q);
      if (q.subitems) {
        q.subitems.forEach((sub) => allSubitems.push({ ...sub, parentQid: q.id }));
      }
    });
  });

  const complianceCount = allQuestions.filter((q) => answers[q.id] === 'SI').length +
    allSubitems.filter((s) => subAnswers[s.id] === 'SI').length;
  const nonComplianceCount = allQuestions.filter((q) => answers[q.id] === 'NO').length +
    allSubitems.filter((s) => subAnswers[s.id] === 'NO').length;
  const totalItems = allQuestions.length + allSubitems.length;
  const percentage = totalItems > 0 ? Math.round((complianceCount / totalItems) * 100) : 0;

  const nonComplianceItems = [];
  allQuestions.forEach((q) => { if (answers[q.id] === 'NO') nonComplianceItems.push({ id: q.id, text: q.text, type: 'question' }); });
  allSubitems.forEach((s) => { if (subAnswers[s.id] === 'NO') nonComplianceItems.push({ id: s.id, text: s.text, type: 'subitem', parentQid: s.parentQid }); });

  return { allQuestions, allSubitems, complianceCount, nonComplianceCount, totalItems, percentage, nonComplianceItems };
};

export const getVerdict = (nonComplianceCount) => {
  if (nonComplianceCount === 0) return { label: 'CUMPLIMIENTO TOTAL', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', color: '#059669', emoji: '🎉' };
  if (nonComplianceCount <= 3) return { label: 'CUMPLIMIENTO PARCIAL', cls: 'bg-amber-50 text-amber-700 border-amber-200', color: '#d97706', emoji: '⚠️' };
  return { label: 'INCUMPLIMIENTO SIGNIFICATIVO', cls: 'bg-red-50 text-red-700 border-red-200', color: '#dc2626', emoji: '🚨' };
};

export const renderAnswerBadge = (ans) => {
  const map = { SI: { cls: 'si', text: 'SI' }, NO: { cls: 'no', text: 'NO' }, NA: { cls: 'pending', text: 'N/A' }, PARCIAL: { cls: 'warn', text: 'Parcial' } };
  const b = map[ans] || { cls: 'pending', text: '—' };
  return { className: `print-q-badge ${b.cls}`, text: b.text };
};

export const exportCSV = (sections, enabled, sectionEnabled, answers, observations, subAnswers, subObs, totalItems, complianceCount, nonComplianceCount, percentage, auditDate, sucursalLabel) => {
  const veredicto = getVerdict(nonComplianceCount);
  const rows = [['Seccion', 'N.', 'Pregunta', 'Respuesta', 'Observaciones']];
  sections.forEach((s) => {
    if (!sectionEnabled[s.id]) return;
    s.questions.forEach((q) => {
      if (!enabled[q.id]) return;
      rows.push([s.title, String(q.id), q.text, answers[q.id] || '—', observations[q.id] || '']);
      if (q.subitems) q.subitems.forEach((sub) => rows.push(['  ' + s.title, String(sub.id), sub.text, subAnswers[sub.id] || '—', subObs[sub.id] || '']));
    });
  });
  rows.push([]);
  rows.push(['RESUMEN', '', '', '', '']);
  rows.push(['Total items', String(totalItems), '', '', '']);
  rows.push(['Cumplimientos', String(complianceCount), '', '', '']);
  rows.push(['Incumplimientos', String(nonComplianceCount), '', '', '']);
  rows.push(['% Cumplimiento', String(percentage), '', '', '']);
  rows.push(['Veredicto', veredicto.label, '', '', '']);
  const csv = '\uFEFF' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_ssa_${auditDate}_${String(sucursalLabel).replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const getStoragePathFromUrl = (url) => {
  try {
    const match = url.match(/\/o\/(.+?)\?/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};
