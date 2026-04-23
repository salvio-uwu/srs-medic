// src/pages/doctor/ExpedienteClinico.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, FileText, History, ClipboardList, Calendar,
  ChevronRight, Images, Send, FileOutput, FileSignature, PlusSquare,
  History as HistoryIcon, User, Clock, Activity, LayoutGrid, Stethoscope,
  Droplet, Baby, Scissors, AlertTriangle, X, Printer,
  FlaskConical, Syringe, FileBadge, ShieldCheck, CheckCircle2, AlertCircle, HeartHandshake,
  Monitor, Calculator, LogOut, Scale, Ruler
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { goBackOr } from '../../utils/navigation';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { db, auth } from "../../config/firebase";
import { 
  doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, deleteField,
  query, where, orderBy, getDocs, limit, runTransaction, setDoc, onSnapshot 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext'; 

// Importación de las secciones y componentes
import SeccionConsulta from './expediente/SeccionConsulta';
import SeccionAntecedentes from './expediente/SeccionAntecedentes';
import SeccionResumen from './expediente/SeccionResumen';
 
import HistoriaClinicaModal from '../../components/HistoriaClinicaModal';
import EstudioPrevioModal from '../../components/EstudioPrevioModal';
import HistoricoEstudiosModal from '../../components/HistoricoEstudiosModal';
import HistoricoEmbarazosModal from '../../components/HistoricoEmbarazosModal';
import NegatoscopioModal from '../../components/NegatoscopioModal';
import CalculadoraDosisModal from '../../components/CalculadoraDosisModal';
import { listLegacyLinksByPaciente } from '../../services/patientLinkService';
import { createClinicalAuditRecord, validateClinicalRecord } from '../../services/clinicalAuditService';
import { uploadDocumentoPDF } from '../../services/documentStorageService';
import { buildEnfermeriaPatientLogRecord } from '../../services/enfermeriaPatientLogService';
import AvatarPaciente from '../../components/AvatarPaciente';

// historialmedico/ fue eliminado — glob deshabilitado
const legacyHtmlModules = {};

/* ─── DESIGN SYSTEM (igual que Agenda) ──────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

  :root {
    --blue-50:  #F2F8FB;
    --blue-100: #DFF0F7;
    --blue-200: #BCE0EF;
    --blue-500: #2998C6;
    --blue-600: #0077B6;
    --blue-700: #005B8E;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-800: #1e293b;
    --slate-900: #0f172a;
    --emerald-500: #059669;
    --radius-lg: 16px;
    --shadow-sm: 0 1px 2px rgba(15,23,42,.05);
    --shadow-md: 0 4px 6px rgba(15,23,42,.06);
    --shadow-blue: 0 4px 12px rgba(0,119,182,.15);
  }

  .exp-root {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: #f4f7f9;
    color: var(--slate-800);
  }

  .exp-sora { font-family: 'Sora', system-ui, sans-serif; }

  .exp-header {
    position: sticky; top: 0; z-index: 50;
    background: #ffffff;
    border-bottom: 1px solid var(--slate-200);
    box-shadow: var(--shadow-sm);
    padding: 0 24px;
    height: 72px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }

  .exp-avatar {
    width: 44px; height: 44px; border-radius: 12px;
    background: linear-gradient(135deg, var(--blue-500) 0%, var(--blue-700) 100%);
    display: flex; align-items: center; justify-content: center;
    color: white; font-weight: 700; font-size: 18px;
    font-family: 'Sora', sans-serif;
    box-shadow: 0 4px 12px rgba(0,119,182,.25);
    flex-shrink: 0;
    border: 2px solid rgba(255,255,255,.9);
  }

  .exp-back-btn {
    width: 40px; height: 40px; border-radius: 10px;
    border: 1px solid var(--slate-200); background: white;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-500); cursor: pointer;
    transition: all .18s ease;
    box-shadow: var(--shadow-sm);
  }
  .exp-back-btn:hover { color: var(--blue-600); border-color: var(--blue-200); background: var(--blue-50); }

  .exp-btn-primary {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 20px; border-radius: 10px;
    font-size: 13px; font-weight: 700;
    font-family: 'Sora', sans-serif;
    background: var(--blue-600); color: white; border: none;
    cursor: pointer; box-shadow: var(--shadow-blue);
    transition: all .18s ease;
  }
  .exp-btn-primary:hover { background: var(--blue-700); transform: translateY(-1px); }
  .exp-btn-primary:active { transform: translateY(0); }
  .exp-btn-primary:disabled { opacity: 0.5; transform: none; cursor: not-allowed; }

  .exp-panel {
    background: white;
    border: 1px solid rgba(226,232,240,.8);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
  }

  .exp-scroll::-webkit-scrollbar { width: 6px; }
  .exp-scroll::-webkit-scrollbar-track { background: transparent; }
  .exp-scroll::-webkit-scrollbar-thumb { background: var(--slate-300); border-radius: 99px; }
  .exp-scroll::-webkit-scrollbar-thumb:hover { background: var(--slate-400); }

  .exp-icon-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 14px; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    border: 1px solid var(--slate-200); background: white;
    color: var(--slate-600); cursor: pointer;
    transition: all .18s ease;
    box-shadow: var(--shadow-sm);
  }
  .exp-icon-btn:hover { color: var(--blue-600); border-color: var(--blue-200); background: var(--blue-50); }

  /* ── ICON BUTTON HEADER (solo icono, 38px) ── */
  .exp-hdr-btn {
    position: relative;
    width: 38px; height: 38px; border-radius: 9px;
    border: 1px solid var(--slate-200); background: white;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-500); cursor: pointer;
    transition: all .18s ease;
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
  }
  .exp-hdr-btn:hover { color: var(--blue-600); border-color: var(--blue-200); background: var(--blue-50); }
  .exp-hdr-btn.active { color: var(--blue-600); border-color: var(--blue-200); background: var(--blue-50); }
  .exp-hdr-btn.alert { color: #e11d48; border-color: #fecdd3; background: #fff1f2; }

  /* ── BASE TOOLTIP ── */
  [data-tip], [data-tip-down], [data-tip-right] { position: relative; }

  /* Estilos compartidos del label */
  [data-tip]::after, [data-tip-down]::after, [data-tip-right]::after {
    background: var(--slate-900); color: white;
    font-size: 11px; font-weight: 600;
    padding: 5px 10px; border-radius: 6px;
    white-space: nowrap;
    opacity: 0; pointer-events: none;
    transition: opacity .15s ease;
    z-index: 9999;
    font-family: 'DM Sans', system-ui, sans-serif;
    position: absolute;
  }
  [data-tip]::before, [data-tip-down]::before, [data-tip-right]::before {
    content: '';
    position: absolute;
    border: 5px solid transparent;
    opacity: 0; pointer-events: none;
    transition: opacity .15s ease;
    z-index: 9999;
  }

  /* ── ARRIBA (default) — para elementos que NO están en el borde superior ── */
  [data-tip]::after {
    content: attr(data-tip);
    bottom: calc(100% + 8px); left: 50%;
    transform: translateX(-50%);
  }
  [data-tip]::before {
    bottom: calc(100% + 2px); left: 50%;
    transform: translateX(-50%);
    border-top-color: var(--slate-900);
  }

  /* ── ABAJO — para botones del header (borde superior de pantalla) ── */
  [data-tip-down]::after {
    content: attr(data-tip-down);
    top: calc(100% + 8px); left: 50%;
    transform: translateX(-50%);
  }
  [data-tip-down]::before {
    top: calc(100% + 2px); left: 50%;
    transform: translateX(-50%);
    border-bottom-color: var(--slate-900);
  }

  [data-tip]:hover::after,   [data-tip]:hover::before,
  [data-tip-down]:hover::after, [data-tip-down]:hover::before { opacity: 1; }
`;

// --- COMPONENTE INTERNO: TOAST NOTIFICATION ---
const ToastNotification = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top duration-500 backdrop-blur-md ${
    type === 'error' ? 'bg-red-50/90 border-red-200 text-red-700' : 
    type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700' : 
    'bg-blue-50/90 border-blue-200 text-blue-700'
  }`}>
    {type === 'error' ? <AlertCircle size={24}/> : type === 'success' ? <CheckCircle2 size={24}/> : <Clock size={24}/>}
    <span className="font-bold text-sm">{msg}</span>
    <button onClick={onClose} className="ml-4 p-1 hover:bg-black/5 rounded-full transition-colors"><X size={16}/></button>
  </div>
);

// --- COMPONENTE INTERNO: MODAL CONTROL DE EMBARAZO ---
const ControlEmbarazoModal = ({ onClose, onBackToMenu, data, updateCampo }) => {
  const RadioGroup = ({ label, path }) => {
    const val = path.split('.').reduce((o, i) => o[i], data) || 'No aplica';
    return (
      <div className="mb-4">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{label}</label>
        <div className="flex gap-2 flex-wrap">
          {['Sí', 'No', 'No aplica'].map((op) => (
            <button
              key={op}
              onClick={() => updateCampo(`control_embarazo.${path}`, op)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                val === op
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {op}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
          <h3 className="exp-sora text-lg font-bold text-blue-700 flex items-center gap-2">
            <Baby size={20} />
            Control de Embarazo y Alto Riesgo
          </h3>
          <div className="flex items-center gap-2">
            {onBackToMenu && (
              <button
                onClick={onBackToMenu}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 text-[11px] font-bold uppercase tracking-wide transition-all"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                Regresar al menu
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-x-8">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-blue-600 uppercase mb-3">Datos Generales</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Num. Embarazo</label>
                <input
                  type="number"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  value={data.num_embarazo}
                  onChange={(e) => updateCampo('control_embarazo.num_embarazo', e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Num. de Bebes</label>
                <input
                  type="number"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                  value={data.num_bebes}
                  onChange={(e) => updateCampo('control_embarazo.num_bebes', e.target.value)}
                />
              </div>
            </div>
            <RadioGroup label="Primera vez que presenta alto riesgo" path="riesgo" />
            <RadioGroup label="Ingesta de acido folico" path="acido_folico" />
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black text-rose-500 uppercase border-b border-rose-100 pb-2 mb-2">Complicaciones</h4>
            <div className="grid grid-cols-1 gap-2">
              <RadioGroup label="Diabetes Gestacional" path="complicaciones.diabetes" />
              <RadioGroup label="Infeccion Urinaria" path="complicaciones.infeccion_urinaria" />
              <RadioGroup label="Preeclampsia" path="complicaciones.preeclampsia" />
              <RadioGroup label="Hemorragia" path="complicaciones.hemorragia" />
              <RadioGroup label="Hipertension Arterial" path="complicaciones.hipertension" />
              <RadioGroup label="Sospecha / Conf. COVID-19" path="complicaciones.sospecha_covid" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 sticky bottom-0">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="px-5 py-2 bg-white border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 font-bold rounded-xl shadow transition-all"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Regresar al menu
            </button>
          )}
          <button onClick={onClose} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all">
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const LegacyHistoryModal = ({ onClose, onBackToMenu, pacienteNombre, links, loading }) => (
  <div className="fixed inset-0 z-[190] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl h-[80vh] flex flex-col border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/90">
        <div>
          <h3 className="exp-sora text-xl font-black tracking-tight text-slate-900">Historico legado</h3>
          <p className="text-sm text-slate-500">Registros migrados de MedicalManik ligados a {pacienteNombre || 'este paciente'}.</p>
        </div>
        <div className="flex items-center gap-2">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 text-[11px] font-bold uppercase tracking-wide transition-all"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Regresar al menu
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 text-slate-500 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-slate-50/60 exp-scroll">
        {loading && <p className="text-sm text-slate-500">Cargando enlaces legacy...</p>}

        {!loading && links.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No hay archivos legacy enlazados para este paciente.
          </div>
        )}

        {!loading && links.length > 0 && (
          <div className="space-y-3">
            {links.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{row.fileName || 'Archivo sin nombre'}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    ID legacy: {row.legacyPatientId || '--'} | Nacimiento: {row.fechaNacimiento || '--'} | Sexo: {row.sexo || '--'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 font-bold uppercase tracking-wide">
                    {row.confidence || 'alta'}
                  </span>
                  {row.previewUrl ? (
                    <button
                      onClick={() => window.open(row.previewUrl, '_blank', 'noopener,noreferrer')}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Abrir archivo
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">No disponible</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

const parseFirestoreDate = (rawValue) => {
  if (!rawValue) return null;

  if (typeof rawValue?.toDate === 'function') {
    const fromTimestamp = rawValue.toDate();
    return Number.isNaN(fromTimestamp.getTime()) ? null : fromTimestamp;
  }

  if (rawValue instanceof Date) {
    return Number.isNaN(rawValue.getTime()) ? null : rawValue;
  }

  if (typeof rawValue === 'number') {
    const fromMillis = new Date(rawValue);
    return Number.isNaN(fromMillis.getTime()) ? null : fromMillis;
  }

  if (typeof rawValue === 'string') {
    const value = rawValue.trim();
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value) || /^\d{2}-\d{2}-\d{4}$/.test(value)) {
      const [day, month, year] = value.split(/[/-]/).map(Number);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const genericParsed = new Date(value);
    return Number.isNaN(genericParsed.getTime()) ? null : genericParsed;
  }

  return null;
};

const formatDateIso = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const calculateAgeFromBirthdate = (birthDate) => {
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : null;
};

const buildPacienteRecipeId = (nombreCompleto, birthDate) => {
  const safeName = (nombreCompleto || 'PACIENTE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .toUpperCase();

  const firstName = safeName.split(/\s+/).filter(Boolean)[0] || 'PACIENTE';

  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) return `${firstName}SINFN`;
  const dd = String(birthDate.getDate()).padStart(2, '0');
  const mm = String(birthDate.getMonth() + 1).padStart(2, '0');
  const yyyy = String(birthDate.getFullYear());
  return `${firstName}${dd}${mm}${yyyy}`;
};

const generateFolioReceta = async () => {
  const counterRef = doc(db, 'contadores', 'folios_recetas');
  try {
    const siguiente = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? (snap.data().siguiente || 1) : 1;
      tx.set(counterRef, { siguiente: current + 1 }, { merge: true });
      return current;
    });
    return `RX-${String(siguiente).padStart(7, '0')}`;
  } catch (e) {
    console.error('Error generando folio secuencial:', e);
    return `RX-${String(Date.now()).slice(-7)}`;
  }
};

const cleanPatientId = (rawId) => {
  let id = String(rawId || '').trim().toUpperCase();
  if (id.startsWith('MIG_')) id = id.slice(4);
  return id;
};

const getLegacyPatientIdFromDb = (pacienteData) => {
  const candidates = [
    pacienteData?.idPaciente,
    pacienteData?.idPacienteMigrado,
    pacienteData?.legacyPatientId,
    pacienteData?.patientId
  ];

  const match = candidates
    .map((value) => String(value || '').trim())
    .find(Boolean);

  return cleanPatientId(match || '');
};

const normalizeTextKey = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const hasMeaningfulClinicalData = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value === true;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulClinicalData(item));
  if (typeof value === 'object') return Object.values(value).some((item) => hasMeaningfulClinicalData(item));
  return false;
};

const mergeClinicalSection = (base, incoming) => {
  if (incoming === undefined) return base;
  if (Array.isArray(incoming)) return incoming;

  if (incoming && typeof incoming === 'object') {
    const baseObj = (base && typeof base === 'object' && !Array.isArray(base)) ? base : {};
    const result = { ...baseObj };
    Object.keys(incoming).forEach((key) => {
      result[key] = mergeClinicalSection(baseObj[key], incoming[key]);
    });
    return result;
  }

  return incoming;
};

const mergeGeneratedEvents = (baseEvents = [], nextEvents = []) => {
  const seen = new Set();

  return [...baseEvents, ...nextEvents].filter((event) => {
    const key = [
      event?.tipo || '',
      event?.nombre || '',
      event?.formato || '',
      event?.origen || '',
      event?.plantillaId || '',
      event?.generadoAt || '',
      event?.archivoUrl || '',
      event?.archivoPath || '',
      event?.totalMedicamentos || ''
    ].join('|');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const pickMostRecentClinicalSection = (rows = [], sectionKey = '') => {
  if (!Array.isArray(rows) || !sectionKey) return null;
  for (const row of rows) {
    const candidate = row?.[sectionKey];
    if (hasMeaningfulClinicalData(candidate)) return candidate;
  }
  return null;
};

const DEFAULT_TEMP_MED = { nombre: '', dosis: '', presentacion: '', sustanciasActivas: '', numeroAcomodo: '' };
const DEFAULT_TEMP_ALERGIA = { nombre: '' };
const DEFAULT_TEMP_CIRUGIA = {
  procedimiento: '', operacion: '', nota: '', unidad: '',
  tipoFecha: 'fecha', ano: '2024', fechaHora: '', diagnostico: ''
};

const computePregnancyDerivedInfo = (pxInfo = {}) => {
  const normalized = {
    ...(pxInfo || {}),
    fum: String(pxInfo?.fum || '').trim(),
    fpp: String(pxInfo?.fpp || '').trim(),
    sdg: String(pxInfo?.sdg || '').trim()
  };

  if (!normalized.fum) return normalized;

  const fumDate = new Date(normalized.fum);
  if (Number.isNaN(fumDate.getTime())) return normalized;

  const fppDate = new Date(fumDate);
  fppDate.setDate(fppDate.getDate() + 7);
  fppDate.setMonth(fppDate.getMonth() - 3);
  fppDate.setFullYear(fppDate.getFullYear() + 1);

  const hoy = new Date();
  const diffTime = Math.abs(hoy - fumDate);
  const diffWeeks = (diffTime / (1000 * 60 * 60 * 24 * 7)).toFixed(1);

  return {
    ...normalized,
    fpp: fppDate.toISOString().split('T')[0],
    sdg: `${diffWeeks} Semanas`
  };
};

const normalizeComparableValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => normalizeComparableValue(item));

  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeComparableValue(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const buildComparableDraftSnapshot = ({
  expediente,
  tempMed,
  tempAlergia,
  tempCirugia,
  eventosDocumentales
}) => {
  const normalizedExpediente = {
    ...(expediente || {}),
    px_info: computePregnancyDerivedInfo(expediente?.px_info || {})
  };

  const normalizedEventos = Array.isArray(eventosDocumentales)
    ? eventosDocumentales.map((evento) => ({
        tipo: evento?.tipo || '',
        nombre: evento?.nombre || '',
        formato: evento?.formato || '',
        origen: evento?.origen || '',
        plantillaId: evento?.plantillaId || '',
        plantillaNombre: evento?.plantillaNombre || '',
        archivoUrl: evento?.archivoUrl || '',
        archivoPath: evento?.archivoPath || ''
      }))
    : [];

  return normalizeComparableValue({
    expediente: normalizedExpediente,
    tempMed: tempMed || DEFAULT_TEMP_MED,
    tempAlergia: tempAlergia || DEFAULT_TEMP_ALERGIA,
    tempCirugia: tempCirugia || DEFAULT_TEMP_CIRUGIA,
    eventosDocumentales: normalizedEventos
  });
};

const draftSnapshotsEqual = (left, right) => JSON.stringify(left || null) === JSON.stringify(right || null);

const buildUnsavedChangeSummary = (baseline, current) => {
  const changes = [];
  const pushIfChanged = (condition, label) => {
    if (condition) changes.push(label);
  };
  const isSame = (left, right) => draftSnapshotsEqual(left, right);
  const baseExp = baseline?.expediente || {};
  const currentExp = current?.expediente || {};

  pushIfChanged(
    !isSame(baseExp?.consulta?.padecimiento, currentExp?.consulta?.padecimiento),
    'Padecimiento actual'
  );
  pushIfChanged(
    !isSame(baseExp?.consulta?.exploracion, currentExp?.consulta?.exploracion),
    'Exploración, signos vitales o antropometría'
  );
  pushIfChanged(
    !isSame(baseExp?.consulta?.diagnostico?.enfermedad_actual, currentExp?.consulta?.diagnostico?.enfermedad_actual)
      || !isSame(baseExp?.consulta?.diagnostico?.indicaciones, currentExp?.consulta?.diagnostico?.indicaciones)
      || !isSame(baseExp?.consulta?.diagnostico?.pronostico, currentExp?.consulta?.diagnostico?.pronostico),
    'Diagnóstico, indicaciones o pronóstico'
  );
  pushIfChanged(
    !isSame(baseExp?.consulta?.diagnostico?.tratamiento_lista, currentExp?.consulta?.diagnostico?.tratamiento_lista)
      || !isSame(baseline?.tempMed, current?.tempMed),
    'Tratamiento o receta pendiente'
  );
  pushIfChanged(
    !isSame(baseExp?.consulta?.estudios, currentExp?.consulta?.estudios),
    'Estudios solicitados'
  );
  pushIfChanged(
    !isSame(baseExp?.consulta?.procedimientos, currentExp?.consulta?.procedimientos),
    'Procedimientos'
  );
  pushIfChanged(
    !isSame(baseExp?.resumen, currentExp?.resumen),
    'Resumen clínico'
  );
  pushIfChanged(
    !isSame(baseExp?.antecedentes, currentExp?.antecedentes)
      || !isSame(baseline?.tempAlergia, current?.tempAlergia)
      || !isSame(baseline?.tempCirugia, current?.tempCirugia),
    'Antecedentes, alergias o cirugías'
  );
  pushIfChanged(
    !isSame(baseExp?.control_embarazo, currentExp?.control_embarazo),
    'Control de embarazo'
  );
  pushIfChanged(
    !isSame(baseExp?.px_info, currentExp?.px_info),
    'Datos complementarios del paciente'
  );
  pushIfChanged(
    !isSame(baseExp?.meta, currentExp?.meta),
    'Costo o metadatos de la consulta'
  );
  pushIfChanged(
    !isSame(baseline?.eventosDocumentales, current?.eventosDocumentales),
    'Documentos o recetas generados en esta sesión'
  );

  if (!changes.length && !draftSnapshotsEqual(baseline, current)) {
    changes.push('Cambios sin guardar en la consulta actual');
  }

  return changes;
};

const ExpedienteClinico = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); 
  const {
    pacienteId,
    citaId,
    motivo,
    pacienteNombre: pacienteNombreState,
    paciente: pacienteNombreLegacy,
    openDocumentTemplates = false,
    openedFrom = ''
  } = location.state || {};
  const nombreInicialRuta = String(pacienteNombreState || pacienteNombreLegacy || '').trim();
  const isEnfermeriaDocumentMode = Boolean(
    openDocumentTemplates &&
    (openedFrom === 'enfermeria_agenda' || location.pathname.startsWith('/enfermeria'))
  );
  const exitFallbackPath = isEnfermeriaDocumentMode ? '/enfermeria/dashboard' : '/agenda';
  
  // --- ESTADOS DE UI Y MODALES ---
  const [showHistoricoEmbarazos, setShowHistoricoEmbarazos] = useState(false);
  const [showLegacyHistory, setShowLegacyHistory] = useState(false);
  const [showFormatSelector, setShowFormatSelector] = useState(false);
  const [showRecipeTemplateSelector, setShowRecipeTemplateSelector] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false); 
  const [showHistoriaModal, setShowHistoriaModal] = useState(false);
  const [showEstudioModal, setShowEstudioModal] = useState(false);
  const [showHistoricoEstudios, setShowHistoricoEstudios] = useState(false);
  const [showEmbarazoModal, setShowEmbarazoModal] = useState(false);
  const [showNegatoscopio, setShowNegatoscopio] = useState(false);
  const [showCalculadoraDosis, setShowCalculadoraDosis] = useState(false);
  const [showMenuQx, setShowMenuQx] = useState(false); 
  const [plantillasDinamicas, setPlantillasDinamicas] = useState([]);
  const [plantillaRecetaPreferidaId, setPlantillaRecetaPreferidaId] = useState('');
  const [plantillaActiva, setPlantillaActiva] = useState(null);
  const [notification, setNotification] = useState(null); 
  const [showPrintAlert, setShowPrintAlert] = useState(false);
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [exitChangeList, setExitChangeList] = useState([]);
  const [discardingExit, setDiscardingExit] = useState(false);
  const [eventosDocumentales, setEventosDocumentales] = useState([]);
  const [historialRefreshKey, setHistorialRefreshKey] = useState(0);
  const [historicalReview, setHistoricalReview] = useState(null);
  const pendingExitAfterRecipePrintRef = useRef(false);
  const pendingDraftBeforeHistoricalRef = useRef(null);
  const exitBaselineRef = useRef(null);
  const citaEntryStateRef = useRef({
    initialized: false,
    autoStarted: false,
    previousEstado: '',
    previousDraft: null,
    previousDraftUpdatedAt: null
  });
  const [activeMainTab, setActiveMainTab] = useState('resumen'); 
  const [visitedTabs, setVisitedTabs] = useState(new Set(['resumen']));
  const [activeConsulta, setActiveConsulta] = useState('padecimiento');

  // Track visited tabs when switching
  const handleTabChange = (tab) => {
    setActiveMainTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
  };
  const [pacienteNombre, setPacienteNombre] = useState(nombreInicialRuta);
  const [pacienteData, setPacienteData] = useState({}); 
  const [loading, setLoading] = useState(false);
  const [historialCompleto, setHistorialCompleto] = useState([]);
  const [legacyLinks, setLegacyLinks] = useState([]);
  const [loadingLegacyLinks, setLoadingLegacyLinks] = useState(false);
  const [consultoriosCatalogo, setConsultoriosCatalogo] = useState([]);
  const [sucursalesCatalogo, setSucursalesCatalogo] = useState([]);
  const [userProfileDoc, setUserProfileDoc] = useState(null);
  const [citaContext, setCitaContext] = useState({
    consultorioId: '',
    consultorioNombre: '',
    consultorioDireccion: '',
    sucursalId: '',
    sucursalNombre: '',
    sucursalDireccion: '',
    sucursalTelefono: ''
  });

  // --- NUEVOS ESTADOS PARA DATOS TEMPORALES ---
  const [tempMed, setTempMed] = useState(DEFAULT_TEMP_MED);
  const [tempAlergia, setTempAlergia] = useState(DEFAULT_TEMP_ALERGIA);
  const [tempCirugia, setTempCirugia] = useState(DEFAULT_TEMP_CIRUGIA);
  const consultaInicioRef = useRef(new Date());
  const direccionDebugRef = useRef('');
  const expedienteParaRecetaRef = useRef(null);
  const isHistoricalReviewMode = Boolean(historicalReview?.historialId);

  // --- LÓGICA DE TEMPORIZADOR Y AUDIO ---
  const [timerDuration, setTimerDuration] = useState(600); // 10 min por defecto
  const [seconds, setSeconds] = useState(600);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const audioCtxRef = useRef(null);

  // Cargar duración de consulta configurada por el admin desde Firestore
  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracion', 'general'));
        if (snap.exists()) {
          const min = snap.data().duracionConsultaMin;
          if (min && Number.isFinite(min) && min > 0) {
            const secs = min * 60;
            setTimerDuration(secs);
            setSeconds(secs);
          }
        }
      } catch (e) {
        console.warn('Sin config de timer, usando 10 min por defecto.');
      }
    };
    cargarConfig();
  }, []);

  useEffect(() => {
    setIsTimerActive(!isHistoricalReviewMode);
  }, [isHistoricalReviewMode]);

  const showToast = (msg, type='info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const registrarEventoDocumental = (evento = {}) => {
    const tipo = evento.tipo === 'receta' ? 'receta' : 'documento';
    const nombre = String(evento.nombre || evento.plantillaNombre || (tipo === 'receta' ? 'Receta medica' : 'Documento medico')).trim();
    const formato = String(evento.formato || 'impresion').trim();
    const origen = String(evento.origen || 'plantilla_dinamica').trim();
    const plantillaId = String(evento.plantillaId || '').trim();

    setEventosDocumentales((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tipo,
        nombre,
        formato,
        origen,
        plantillaId,
        plantillaNombre: String(evento.plantillaNombre || '').trim(),
        generadoAt: new Date().toISOString(),
        archivoUrl: evento.archivoUrl || '',
        archivoPath: evento.archivoPath || ''
      }
    ]);

    if (tipo === 'receta' && pendingExitAfterRecipePrintRef.current) {
      pendingExitAfterRecipePrintRef.current = false;
      if (isEnfermeriaDocumentMode) {
        goBackOr(navigate, exitFallbackPath);
        return;
      }
      executeSave({ allowCritical: true });
    }
  };

  const snapshotCurrentDraft = () => ({
    expediente,
    tempMed,
    tempAlergia,
    tempCirugia,
    eventosDocumentales,
    activeMainTab,
    activeConsulta,
    visitedTabs: Array.from(visitedTabs)
  });

  const syncExitBaseline = ({
    expediente: expedienteValue = expediente,
    tempMed: tempMedValue = tempMed,
    tempAlergia: tempAlergiaValue = tempAlergia,
    tempCirugia: tempCirugiaValue = tempCirugia,
    eventosDocumentales: eventosValue = eventosDocumentales
  } = {}) => {
    exitBaselineRef.current = buildComparableDraftSnapshot({
      expediente: expedienteValue,
      tempMed: tempMedValue,
      tempAlergia: tempAlergiaValue,
      tempCirugia: tempCirugiaValue,
      eventosDocumentales: eventosValue
    });
  };

  const getCurrentComparableSnapshot = () => buildComparableDraftSnapshot({
    expediente,
    tempMed,
    tempAlergia,
    tempCirugia,
    eventosDocumentales
  });

  const assessUnsavedChanges = () => {
    const currentSnapshot = getCurrentComparableSnapshot();
    const baselineSnapshot = exitBaselineRef.current;

    if (!baselineSnapshot) {
      const hasDraftContent = consultaTieneDatosClinicos()
        || hasMeaningfulClinicalData(tempMed)
        || hasMeaningfulClinicalData(tempAlergia)
        || hasMeaningfulClinicalData(tempCirugia)
        || (Array.isArray(eventosDocumentales) && eventosDocumentales.length > 0);

      return {
        hasChanges: hasDraftContent,
        changes: hasDraftContent ? ['Cambios sin guardar en la consulta actual'] : []
      };
    }

    const hasChanges = !draftSnapshotsEqual(baselineSnapshot, currentSnapshot);
    return {
      hasChanges,
      changes: hasChanges ? buildUnsavedChangeSummary(baselineSnapshot, currentSnapshot) : []
    };
  };

  const restoreEntryStateAndExit = async () => {
    if (discardingExit) return;

    setDiscardingExit(true);
    try {
      if (citaId && citaEntryStateRef.current.initialized) {
        const payload = {
          consultaDraft: citaEntryStateRef.current.previousDraft ?? null,
          consultaDraftUpdatedAt: citaEntryStateRef.current.previousDraftUpdatedAt ?? null
        };

        if (citaEntryStateRef.current.autoStarted) {
          if (citaEntryStateRef.current.previousEstado) {
            payload.estado = citaEntryStateRef.current.previousEstado;
          }
          payload.consultaIniciadaAt = deleteField();
        }

        await updateDoc(doc(db, 'citas', citaId), payload);
      }

      setShowExitAlert(false);
      goBackOr(navigate, exitFallbackPath);
    } catch (errorExit) {
      console.error('No se pudo salir sin guardar cambios', errorExit);
      showToast('No se pudo salir sin guardar. Intenta de nuevo.', 'error');
    } finally {
      setDiscardingExit(false);
    }
  };

  const restoreConsultaActual = ({ notify = true } = {}) => {
    const snapshot = pendingDraftBeforeHistoricalRef.current;

    pendingExitAfterRecipePrintRef.current = false;
    expedienteParaRecetaRef.current = null;
    setShowPrintAlert(false);
    setShowExitAlert(false);
    setHistoricalReview(null);

    if (!snapshot) {
      if (notify) showToast('Se cerró la consulta histórica.', 'info');
      return;
    }

    setExpediente(snapshot.expediente);
    setTempMed(snapshot.tempMed || DEFAULT_TEMP_MED);
    setTempAlergia(snapshot.tempAlergia || DEFAULT_TEMP_ALERGIA);
    setTempCirugia(snapshot.tempCirugia || DEFAULT_TEMP_CIRUGIA);
    setEventosDocumentales(snapshot.eventosDocumentales || []);
    setActiveMainTab(snapshot.activeMainTab || 'resumen');
    setActiveConsulta(snapshot.activeConsulta || 'padecimiento');
    setVisitedTabs(new Set(snapshot.visitedTabs || ['resumen']));
    pendingDraftBeforeHistoricalRef.current = null;

    if (notify) showToast('Regresaste a la consulta actual.', 'info');
  };

  const cargarConsultaHistorica = (consultaHistorica = {}) => {
    if (!consultaHistorica?.id) return;

    if (!pendingDraftBeforeHistoricalRef.current) {
      pendingDraftBeforeHistoricalRef.current = snapshotCurrentDraft();
    }

    const fechaHistorica = consultaHistorica.fecha?.toDate
      ? consultaHistorica.fecha.toDate()
      : parseFirestoreDate(consultaHistorica.fecha);

    pendingExitAfterRecipePrintRef.current = false;
    expedienteParaRecetaRef.current = null;
    setShowPrintAlert(false);
    setShowExitAlert(false);
    setTempMed(DEFAULT_TEMP_MED);
    setTempAlergia(DEFAULT_TEMP_ALERGIA);
    setTempCirugia(DEFAULT_TEMP_CIRUGIA);
    setEventosDocumentales([]);

    setExpediente((prev) => ({
      ...prev,
      px_info: {
        ...prev.px_info,
        ...(consultaHistorica.px_info || {})
      },
      resumen: consultaHistorica.resumen
        ? mergeClinicalSection(prev.resumen, consultaHistorica.resumen)
        : prev.resumen,
      antecedentes: consultaHistorica.antecedentes
        ? mergeClinicalSection(prev.antecedentes, consultaHistorica.antecedentes)
        : prev.antecedentes,
      control_embarazo: consultaHistorica.control_embarazo
        ? mergeClinicalSection(prev.control_embarazo, consultaHistorica.control_embarazo)
        : prev.control_embarazo,
      consulta: consultaHistorica.consulta
        ? mergeClinicalSection(prev.consulta, consultaHistorica.consulta)
        : prev.consulta,
      meta: consultaHistorica.meta
        ? mergeClinicalSection(prev.meta, consultaHistorica.meta)
        : prev.meta
    }));

    setHistoricalReview({
      historialId: consultaHistorica.id,
      citaId: consultaHistorica.citaId || '',
      tipoNota: consultaHistorica.tipoNota || 'Consulta General',
      fechaLabel: fechaHistorica
        ? fechaHistorica.toLocaleString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : [consultaHistorica.fechaFormato, consultaHistorica.horaFormato].filter(Boolean).join(' • ') || 'sin fecha',
      recetasGeneradas: Array.isArray(consultaHistorica.recetasGeneradas) ? consultaHistorica.recetasGeneradas : [],
      documentosGenerados: Array.isArray(consultaHistorica.documentosGenerados) ? consultaHistorica.documentosGenerados : []
    });

    setVisitedTabs(new Set(['resumen', 'antecedentes', 'consulta']));
    setActiveMainTab('consulta');
    setActiveConsulta('padecimiento');

    showToast('Consulta histórica cargada. Guardar actualizará ese registro sin generar una nueva visita.', 'info');
  };

  const playSoftBeep = (freq = 440, duration = 0.2) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime); 
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) { console.log("Audio block"); }
  };

  useEffect(() => {
    let interval = null;
    if (isTimerActive) {
      interval = setInterval(() => {
        setSeconds(prev => {
          const next = prev - 1;
          if (next === 120) playSoftBeep(440, 0.3);
          if (next === 60) playSoftBeep(523, 0.3);
          if (next === 10) playSoftBeep(659, 0.4);
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  const formatTime = (s) => {
    const absSeconds = Math.abs(s);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${s < 0 ? '-' : ''}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerStyles = () => {
    if (seconds > 120) return "bg-white text-slate-600 border-slate-200 shadow-sm";
    if (seconds <= 120 && seconds > 60) return "bg-amber-50 text-amber-600 border-amber-300 shadow-amber-100/50 animate-pulse";
    if (seconds <= 60 && seconds > 10) return "bg-rose-50 text-rose-600 border-rose-300 shadow-rose-100/50 animate-pulse font-bold";
    if (seconds <= 10 && seconds >= 0) return "bg-red-500 text-white border-red-600 shadow-red-500/30 animate-bounce font-black";
    return "bg-slate-900 text-red-400 border-red-500 font-black shadow-lg";
  };
  const getTimerLabel = () => {
    if (seconds > 120) return `${Math.floor(timerDuration / 60)} min`;
    if (seconds <= 120 && seconds > 60) return '2 min restantes';
    if (seconds <= 60 && seconds > 0) return '¡Último minuto!';
    if (seconds === 0) return '¡Tiempo!';
    return `+${formatTime(Math.abs(seconds))} extra`;
  };

  // --- ESTADO DEL EXPEDIENTE ---
  const [expediente, setExpediente] = useState({
    px_info: { 
      edad: '', id_receta: '', telefono: '', alergias_base: '', 
      grupo_sanguineo: '',
      fum: '', fpp: '', sdg: '', 
      es_embarazada: false,
      requiere_cirugia: { general: false, ginecologica: false },
      fecha_nacimiento: '' 
    },
    control_embarazo: {
      num_embarazo: '', num_bebes: '', riesgo: 'No aplica', acido_folico: 'No aplica',
      complicaciones: {
          diabetes: 'No aplica', infeccion_urinaria: 'No aplica', preeclampsia: 'No aplica',
          hemorragia: 'No aplica', sospecha_covid: 'No aplica', covid_confirmado: 'No aplica',
          hipertension: 'No aplica'
      }
    },
    resumen: { notas_previas: "", resumen_paciente: "" },
    antecedentes: {
      hereditarios: {
        diabetes: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        hipertension: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        cardiopatia: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        hepatopatia: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        nefropatia: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        mentales: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        alergicas: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        endocrinas: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        asma: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        cancer: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        negados: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        obesidad: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
        otros: "",
        preguntados_y_negados: false
      },
      no_patologicos: { bano: "", lavado_dientes: "", habitacion: "", alimentacion: "", sedentarismo: "", otros: "", preguntados_y_negados: false },
      patologicos: {
        actuales: "", quirurgicos: "", transfusionales: "", traumaticos: "", hospitalizaciones: "",
        adicciones: { tabaquismo: false, alcohol: false, drogas: false, detalle: "" },
        especificos: { glaucoma: "", calculo: "", reflujo: "", incontinencia: "", dislipidemias: "", otro: "" },
        preguntados_y_negados: false
      },
      aparatos: { 
        digestivo: "", cardiovascular: "", respiratorio: "", urinario: "", genital: "", hematologico: "",
        endocrino: "", osteomuscular: "", nervioso: "", sensorial: "", psicosomatico: "", otro: "",
        preguntados_y_negados: false
      },
      alergias: { tipo: "Medicamento", buscar_sustancia: false, lista: [], otros: "", preguntados_y_negados: false },
      vacunas: { lista: [], otras: "", preguntados_y_negados: false },
      cirugias: { lista: [], preguntados_y_negados: false },
      cie10: [],
      cie10_preguntados_y_negados: false
    },
    consulta: {
      padecimiento: "", 
      exploracion: {
        signos: { ta: "", temp: "", fc: "", fr: "", spo2: "" },
        antropometria: { peso: "", talla: "", cintura: "", cadera: "", imc: "", peso_ideal: "" },
        colesterol: { trigliceridos: "", colesterol: "", hba1c: "" },
        fisica: { habitus: "", cabeza: "", cuello: "", torax: "", genitales: "", extremidades: "", columna: "", abdomen: "" },
        glucosa: { lista: [] }
      },
      diagnostico: { enfermedad_actual: "", tratamiento_lista: [], indicaciones: "", pronostico: "" },
      estudios: { paquetes_seleccionados: [], estudios_seleccionados: [], notas_generales: "" },
      procedimientos: { seleccionados: [], notas_generales: "" }
    },
    meta: { costo: "", segunda_opinion: false }
  });

  const updateCampo = (path, value) => {
    setExpediente(prev => {
      const updateDeep = (obj, pathArray, newValue) => {
        const [currentKey, ...rest] = pathArray;
        if (rest.length === 0) return { ...obj, [currentKey]: newValue };
        return { ...obj, [currentKey]: updateDeep(obj[currentKey] || {}, rest, newValue) };
      };
      return updateDeep(prev, path.split('.'), value);
    });
  };

  useEffect(() => {
    if (expediente.px_info.fum) {
        const fum = new Date(expediente.px_info.fum);
        if(!isNaN(fum.getTime())) {
            const fppDate = new Date(fum);
            fppDate.setDate(fppDate.getDate() + 7);
            fppDate.setMonth(fppDate.getMonth() - 3);
            fppDate.setFullYear(fppDate.getFullYear() + 1);
            const hoy = new Date();
            const diffTime = Math.abs(hoy - fum);
            const diffWeeks = (diffTime / (1000 * 60 * 60 * 24 * 7)).toFixed(1);
            if(expediente.px_info.sdg !== diffWeeks || expediente.px_info.fpp !== fppDate.toISOString().split('T')[0]) {
               setExpediente(prev => ({
                   ...prev,
                   px_info: { ...prev.px_info, fpp: fppDate.toISOString().split('T')[0], sdg: `${diffWeeks} Semanas` }
               }));
            }
        }
    }
  }, [expediente.px_info.fum]);

  useEffect(() => {
    const cargarPlantillas = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'catalogo_plantillas_documentos'), orderBy('orden', 'asc')));
        const plantillas = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((item) => item.activo !== false && item.publicada !== false);
        setPlantillasDinamicas(plantillas);
      } catch (error) {
        console.error('Error cargando plantillas dinámicas', error);
      }
    };

    cargarPlantillas();
  }, []);

  useEffect(() => {
    const qConsultorios = query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc'));
    const unsubscribe = onSnapshot(
      qConsultorios,
      (snap) => {
        const rows = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((item) => item.activo !== false);
        setConsultoriosCatalogo(rows);
      },
      (error) => {
        console.error('Error cargando catálogo de consultorios', error);
        setConsultoriosCatalogo([]);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qSucursales = query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc'));
    const unsubscribe = onSnapshot(
      qSucursales,
      (snap) => {
        const rows = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((item) => item.activo !== false);
        setSucursalesCatalogo(rows);
      },
      (error) => {
        console.error('Error cargando catálogo de sucursales', error);
        setSucursalesCatalogo([]);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const cargarPerfilUsuario = async () => {
      if (!user?.uid) {
        setUserProfileDoc(null);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setUserProfileDoc(snap.exists() ? snap.data() : null);
      } catch (error) {
        console.warn('No se pudo cargar perfil actualizado del usuario', error);
        setUserProfileDoc(null);
      }
    };

    cargarPerfilUsuario();
  }, [user?.uid]);

  useEffect(() => {
    // Si no hay cita enlazada, usamos el consultorio activo/recurrente del usuario.
    if (citaId) return;

    setCitaContext((prev) => {
      if (prev.consultorioDireccion) return prev;

      const perfil = userProfileDoc || user || {};
      const consultorioId = String(
        perfil?.consultorioActualId
        || perfil?.consultorioRecurrenteId
        || perfil?.consultorioId
        || ''
      ).trim();
      const consultorioNombre = String(
        perfil?.consultorioActual
        || perfil?.consultorioRecurrente
        || perfil?.consultorio
        || ''
      ).trim();
      const consultorioPorPerfil = consultoriosCatalogo.find((item) => {
        const byId = consultorioId && String(item?.id || '').trim() === consultorioId;
        const byName = normalizeTextKey(item?.nombre || '') === normalizeTextKey(consultorioNombre || '');
        return byId || byName;
      });
      // Fallback: si no hay match pero solo hay 1 consultorio, usarlo
      const consultorioResuelto = consultorioPorPerfil
        || (consultoriosCatalogo.length === 1 ? consultoriosCatalogo[0] : null);

      const filtrar = (v) => {
        const norm = String(v || '').trim().toLowerCase();
        return norm && norm !== 'sin ubicación' && norm !== 'sin ubicacion' ? String(v).trim() : '';
      };

      return {
        ...prev,
        consultorioId: consultorioId || consultorioResuelto?.id || '',
        consultorioNombre: consultorioNombre || consultorioResuelto?.nombre || '',
        consultorioDireccion:
          filtrar(perfil?.consultorioUbicacion)
          || filtrar(perfil?.direccionConsultorio)
          || filtrar(consultorioResuelto?.ubicacion)
          || filtrar(consultorioResuelto?.ubicacionConsultorio)
          || filtrar(consultorioResuelto?.direccion)
          || filtrar(consultorioResuelto?.domicilio)
          || filtrar(perfil?.direccion)
          || '',
        sucursalId: String(perfil?.sucursalActualId || perfil?.sucursalId || consultorioResuelto?.sucursalId || '').trim(),
        sucursalNombre: String(perfil?.sucursalActual || perfil?.sucursal || perfil?.sucursalNombre || consultorioResuelto?.sucursal || '').trim(),
        sucursalDireccion: String(perfil?.direccionSucursal || perfil?.sucursalDireccion || '').trim(),
        sucursalTelefono: String(perfil?.telefonoSucursal || perfil?.sucursalTelefono || perfil?.telefonoConsultorio || '').trim()
      };
    });
  }, [citaId, consultoriosCatalogo, user, userProfileDoc]);

  useEffect(() => {
    let cancelled = false;

    const fetchLegacyLinks = async () => {
      if (!pacienteId) {
        setLegacyLinks([]);
        return;
      }

      setLoadingLegacyLinks(true);
      try {
        const links = await listLegacyLinksByPaciente(pacienteId);
        const withUrls = await Promise.all(
          links.map(async (row) => {
            const importer = legacyHtmlModules[row.modulePath];
            if (!importer) return { ...row, previewUrl: '' };

            try {
              const previewUrl = await importer();
              return { ...row, previewUrl };
            } catch {
              return { ...row, previewUrl: '' };
            }
          })
        );

        if (!cancelled) setLegacyLinks(withUrls);
      } catch (error) {
        console.error('Error cargando enlaces legacy', error);
        if (!cancelled) setLegacyLinks([]);
      } finally {
        if (!cancelled) setLoadingLegacyLinks(false);
      }
    };

    fetchLegacyLinks();

    return () => {
      cancelled = true;
    };
  }, [pacienteId]);


// src/pages/doctor/ExpedienteClinico.jsx

  // ... (inicio del componente)

  // --- EFECTO DE CARGA DE DATOS (VERSIÓN FINAL CON ALERGIAS) ---
  useEffect(() => {
    const fetchDatos = async () => {
      if (!pacienteId) return;
      setLoading(true); 
      citaEntryStateRef.current = {
        initialized: false,
        autoStarted: false,
        previousEstado: '',
        previousDraft: null,
        previousDraftUpdatedAt: null
      };
      try {
        // 1. OBTENER TODO EN PARALELO
        const [pxSnap, historialSnap, citaSnap] = await Promise.all([
            getDoc(doc(db, "pacientes", pacienteId)),
          getDocs(query(collection(db, "historial_clinico"), where("pacienteId", "==", pacienteId), orderBy("fecha", "desc"), limit(25))),
            citaId ? getDoc(doc(db, "citas", citaId)) : Promise.resolve(null)
        ]);

        let nuevosDatos = { ...expediente }; 
        let nextTempMed = DEFAULT_TEMP_MED;
        let nextTempAlergia = DEFAULT_TEMP_ALERGIA;
        let nextTempCirugia = DEFAULT_TEMP_CIRUGIA;

        // 2. PROCESAR DATOS PACIENTE
        if (pxSnap.exists()) {
          const dataPx = pxSnap.data();
          const nombreCompletoPx =
            dataPx.nombreCompleto ||
            [dataPx.nombre, dataPx.apellidoPaterno, dataPx.apellidoMaterno].filter(Boolean).join(' ').trim();

          setPacienteNombre(nombreCompletoPx || 'Paciente sin nombre');
          setPacienteData(dataPx);

          const fechaNacimientoDate = parseFirestoreDate(dataPx.fechaNacimiento);
          const fechaNacimientoIso = formatDateIso(fechaNacimientoDate);
          const edadCalc = calculateAgeFromBirthdate(fechaNacimientoDate);
          const legacyId = getLegacyPatientIdFromDb(dataPx);
          const generatedId = buildPacienteRecipeId(nombreCompletoPx, fechaNacimientoDate);

          nuevosDatos.px_info = {
            ...nuevosDatos.px_info,
            edad: Number.isInteger(edadCalc) ? `${edadCalc} años` : '--',
            fecha_nacimiento: fechaNacimientoIso,
            id_receta: legacyId || generatedId,
            telefono: dataPx.telefonoMovil || '',
            grupo_sanguineo: dataPx.grupoSanguineo || '',
            alergias_base: '' 
          };

          if (hasMeaningfulClinicalData(dataPx.resumenClinico)) {
            nuevosDatos.resumen = mergeClinicalSection(nuevosDatos.resumen, dataPx.resumenClinico);
          }
          if (hasMeaningfulClinicalData(dataPx.antecedentesClinicos)) {
            nuevosDatos.antecedentes = mergeClinicalSection(nuevosDatos.antecedentes, dataPx.antecedentesClinicos);
          }
          if (hasMeaningfulClinicalData(dataPx.controlEmbarazoClinico)) {
            nuevosDatos.control_embarazo = mergeClinicalSection(nuevosDatos.control_embarazo, dataPx.controlEmbarazoClinico);
          }
        }

        // 3. PROCESAR HISTORIAL PREVIO
        if (!historialSnap.empty) {
          const historialRows = historialSnap.docs.map((docSnap) => docSnap.data());
          const antecedentesPersistidos = pickMostRecentClinicalSection(historialRows, 'antecedentes');
          const resumenPersistido = pickMostRecentClinicalSection(historialRows, 'resumen');
          const controlEmbarazoPersistido = pickMostRecentClinicalSection(historialRows, 'control_embarazo');

          if (antecedentesPersistidos) {
            nuevosDatos.antecedentes = mergeClinicalSection(nuevosDatos.antecedentes, antecedentesPersistidos);
          }
          if (resumenPersistido) {
            nuevosDatos.resumen = mergeClinicalSection(nuevosDatos.resumen, resumenPersistido);
          }
          if (controlEmbarazoPersistido) {
            nuevosDatos.control_embarazo = mergeClinicalSection(nuevosDatos.control_embarazo, controlEmbarazoPersistido);
          }
        }

        // 4. PROCESAR DATOS DE LA CITA (TRIAGE)
        if (citaSnap && citaSnap.exists()) {
          const dataCita = citaSnap.data();

          citaEntryStateRef.current = {
            initialized: true,
            autoStarted: false,
            previousEstado: String(dataCita.estado || '').trim(),
            previousDraft: dataCita.consultaDraft ?? null,
            previousDraftUpdatedAt: dataCita.consultaDraftUpdatedAt ?? null
          };

          setCitaContext({
            consultorioId: dataCita.consultorioId || dataCita.consultorio?.id || '',
            consultorioNombre: dataCita.consultorioNombre || dataCita.consultorio?.nombre || (typeof dataCita.consultorio === 'string' ? dataCita.consultorio : '') || '',
            consultorioDireccion:
              dataCita.consultorioUbicacion
              || dataCita.consultorioDireccion
              || dataCita.consultorioDomicilio
              || dataCita.consultorio?.ubicacion
              || dataCita.consultorio?.direccion
              || dataCita.consultorio?.domicilio
              || '',
            sucursalId: dataCita.sucursalId || dataCita.sucursal?.id || '',
            sucursalNombre: dataCita.sucursalNombre || dataCita.sucursal?.nombre || (typeof dataCita.sucursal === 'string' ? dataCita.sucursal : '') || '',
            sucursalDireccion:
              dataCita.sucursalUbicacion
              || dataCita.sucursalDireccion
              || dataCita.sucursal?.ubicacion
              || dataCita.sucursal?.direccion
              || dataCita.sucursal?.domicilio
              || '',
            sucursalTelefono: dataCita.sucursalTelefono || ''
          });

          const precioDesdeCita = Number(dataCita.motivoPrecio);
          if (Number.isFinite(precioDesdeCita) && precioDesdeCita > 0) {
            nuevosDatos.meta.costo = precioDesdeCita;
          } else if (dataCita.motivoId) {
            try {
              const motivoSnap = await getDoc(doc(db, 'catalogo_motivos_consulta', dataCita.motivoId));
              if (motivoSnap.exists()) {
                const precioCatalogo = Number(motivoSnap.data()?.precio || 0);
                if (Number.isFinite(precioCatalogo) && precioCatalogo > 0) {
                  nuevosDatos.meta.costo = precioCatalogo;
                }
              }
            } catch (errorMotivo) {
              console.warn('No se pudo obtener precio por motivoId', errorMotivo);
            }
          } else if (dataCita.motivo) {
            try {
              const motivoQuery = query(
                collection(db, 'catalogo_motivos_consulta'),
                where('nombre', '==', dataCita.motivo),
                limit(1)
              );
              const motivoByName = await getDocs(motivoQuery);
              if (!motivoByName.empty) {
                const precioCatalogo = Number(motivoByName.docs[0].data()?.precio || 0);
                if (Number.isFinite(precioCatalogo) && precioCatalogo > 0) {
                  nuevosDatos.meta.costo = precioCatalogo;
                }
              }
            } catch (errorMotivo) {
              console.warn('No se pudo obtener precio por nombre de motivo', errorMotivo);
            }
          }

          if (dataCita.consultaDraft) {
            const draftServer = dataCita.consultaDraft;

            if (hasMeaningfulClinicalData(draftServer.consulta)) {
              nuevosDatos.consulta = mergeClinicalSection(nuevosDatos.consulta, draftServer.consulta);
            }
            if (hasMeaningfulClinicalData(draftServer.antecedentes)) {
              nuevosDatos.antecedentes = mergeClinicalSection(nuevosDatos.antecedentes, draftServer.antecedentes);
            }
            if (hasMeaningfulClinicalData(draftServer.resumen)) {
              nuevosDatos.resumen = mergeClinicalSection(nuevosDatos.resumen, draftServer.resumen);
            }
            if (hasMeaningfulClinicalData(draftServer.control_embarazo)) {
              nuevosDatos.control_embarazo = mergeClinicalSection(nuevosDatos.control_embarazo, draftServer.control_embarazo);
            }
            if (draftServer.meta?.costo) nuevosDatos.meta.costo = draftServer.meta.costo;
            if (draftServer.tempMed) nextTempMed = draftServer.tempMed;
            if (draftServer.tempAlergia) nextTempAlergia = draftServer.tempAlergia;
            if (draftServer.tempCirugia) nextTempCirugia = draftServer.tempCirugia;
            if (draftServer.px_info) {
              nuevosDatos.px_info = {
                ...nuevosDatos.px_info,
                ...draftServer.px_info
              };
            }
          }

          if (dataCita.consultaIniciadaAt?.toDate) {
            consultaInicioRef.current = dataCita.consultaIniciadaAt.toDate();
          } else if (dataCita.estado !== 'completada') {
            // Solo iniciar consulta si la cita NO está completada
            // (evita crear residuales al solo "ver" un expediente terminado)
            consultaInicioRef.current = new Date();
            await updateDoc(doc(db, "citas", citaId), {
              consultaIniciadaAt: serverTimestamp(),
              estado: 'en_consulta'
            });
            citaEntryStateRef.current = {
              ...citaEntryStateRef.current,
              autoStarted: true
            };
          } else {
            consultaInicioRef.current = new Date();
          }
          
          // A) Signos Vitales
          if (dataCita.signos_vitales) {
             nuevosDatos.consulta.exploracion.signos = {
                 ...nuevosDatos.consulta.exploracion.signos,
                 ...dataCita.signos_vitales 
             };
             if(dataCita.signos_vitales.peso) nuevosDatos.consulta.exploracion.antropometria.peso = dataCita.signos_vitales.peso;
             if(dataCita.signos_vitales.talla) nuevosDatos.consulta.exploracion.antropometria.talla = dataCita.signos_vitales.talla;
             if(dataCita.signos_vitales.imc) nuevosDatos.consulta.exploracion.antropometria.imc = dataCita.signos_vitales.imc;
          }

          // B) Motivo de Triage
          if (dataCita.triage_motivo) {
             nuevosDatos.consulta.padecimiento = dataCita.triage_motivo;
          }

          // C) ALERGIAS DE TRIAGE (ESTRUCTURADO)
          if (dataCita.triage_alergias_struct) {
             const as = dataCita.triage_alergias_struct;
             
             // Aseguramos que existe la estructura
             if (!nuevosDatos.antecedentes.alergias) nuevosDatos.antecedentes.alergias = { lista: [], otros: '' };

             if (as.preguntados_y_negados) {
                // Si en triage fue "preguntados y negados", marcarlo igual en expediente
                nuevosDatos.antecedentes.alergias.preguntados_y_negados = true;
             } else {
                // Insertar cada alergia de la lista del triage en la lista del expediente
                const listaExistente = nuevosDatos.antecedentes.alergias.lista || [];
                const sustanciasExistentes = new Set(listaExistente.map(a => (a.sustancia || '').toUpperCase()));
                const nuevas = (as.lista || []).filter(a => !sustanciasExistentes.has((a.sustancia || '').toUpperCase()));
                if (nuevas.length > 0) {
                   nuevosDatos.antecedentes.alergias.lista = [...listaExistente, ...nuevas];
                }

                // Insertar "otros" del triage
                if (as.otros) {
                   const baseOtros = nuevosDatos.antecedentes.alergias.otros || nuevosDatos.antecedentes.alergias.otras || '';
                   if (!baseOtros.includes(as.otros)) {
                      nuevosDatos.antecedentes.alergias.otros = baseOtros 
                         ? `${baseOtros}. Reportado en Triage: ${as.otros}` 
                         : `Reportado en Triage: ${as.otros}`;
                   }
                }
             }

             // Actualizar alergias_base para alertas rápidas
             const nueva = dataCita.triage_alergias || '';
             if (nueva) {
                const baseInfo = nuevosDatos.px_info.alergias_base || '';
                if (!baseInfo.includes(nueva)) {
                   nuevosDatos.px_info.alergias_base = baseInfo ? `${baseInfo} / ${nueva} (Triage)` : nueva;
                }
             }
          } else if (dataCita.triage_alergias) {
             const nueva = dataCita.triage_alergias;
             
             // 1. Insertar en Ficha Técnica (Para alertas rápidas e IA)
             const baseInfo = nuevosDatos.px_info.alergias_base || '';
             if (!baseInfo.includes(nueva)) {
                 nuevosDatos.px_info.alergias_base = baseInfo ? `${baseInfo} / ${nueva} (Triage)` : nueva;
             }

             // 2. Insertar en Sección Antecedentes -> Alergias -> Otros (Para que el doctor lo vea en la lista)
             // Aseguramos que existe la estructura antes de escribir
             if (!nuevosDatos.antecedentes.alergias) nuevosDatos.antecedentes.alergias = { lista: [], otros: '' };
             
             const baseOtros = nuevosDatos.antecedentes.alergias.otros || nuevosDatos.antecedentes.alergias.otras || '';
             // Solo agregamos si no está ya escrito para no duplicar texto
             if (!baseOtros.includes(nueva)) {
                 nuevosDatos.antecedentes.alergias.otros = baseOtros 
                    ? `${baseOtros}. Reportado en Triage: ${nueva}` 
                    : `Reportado en Triage: ${nueva}`;
             }
          }

          // D) ENFERMEDADES DE TRIAGE
          if (dataCita.triage_enfermedades) {
             const enf = dataCita.triage_enfermedades;
             if (!enf.preguntados_y_negados) {
                // Insertar enfermedades en antecedentes patológicos -> actuales
                const enfTexto = [
                   ...(enf.lista || []),
                   ...(enf.otros ? [enf.otros] : [])
                ].join(', ');

                if (enfTexto) {
                   const actuales = nuevosDatos.antecedentes.patologicos?.actuales || '';
                   if (!actuales.includes(enfTexto)) {
                      nuevosDatos.antecedentes.patologicos = nuevosDatos.antecedentes.patologicos || {};
                      nuevosDatos.antecedentes.patologicos.actuales = actuales 
                         ? `${actuales}. Reportado en Triage: ${enfTexto}`
                         : `Reportado en Triage: ${enfTexto}`;
                   }
                }
             }
          }
        }

        const consultaActual = nuevosDatos.consulta || {};
        nuevosDatos.consulta = {
          ...consultaActual,
          estudios: {
            paquetes_seleccionados: [],
            estudios_seleccionados: [],
            notas_generales: '',
            ...(consultaActual.estudios || {})
          },
          procedimientos: {
            seleccionados: [],
            notas_generales: '',
            ...(consultaActual.procedimientos || {})
          }
        };

        // 5. GENERAR FOLIO DE RECETA
        if (!nuevosDatos.px_info.folio_receta) {
          try {
            nuevosDatos.px_info.folio_receta = await generateFolioReceta();
          } catch (e) {
            console.error('Error generando folio:', e);
          }
        }

        // 6. IMPACTAR EL ESTADO
        setExpediente(nuevosDatos);
        setTempMed(nextTempMed);
        setTempAlergia(nextTempAlergia);
        setTempCirugia(nextTempCirugia);
        syncExitBaseline({
          expediente: nuevosDatos,
          tempMed: nextTempMed,
          tempAlergia: nextTempAlergia,
          tempCirugia: nextTempCirugia,
          eventosDocumentales: []
        });

      } catch (e) {
        console.error(e);
        showToast("Error cargando expediente", "error");
      }
      setLoading(false);
    };

    fetchDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, citaId]);

  // --- LISTENER TIEMPO REAL: Signos vitales de triage capturados después de iniciar consulta ---
  useEffect(() => {
    if (!citaId || loading) return;
    const unsub = onSnapshot(doc(db, "citas", citaId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data.signos_vitales) return;
      setExpediente((prev) => {
        // Solo actualizar si los signos están vacíos en el expediente (no sobreescribir ediciones del doctor)
        const signosActuales = prev.consulta?.exploracion?.signos || {};
        const tieneSignos = signosActuales.peso || signosActuales.talla || signosActuales.temp || signosActuales.ta || signosActuales.fc;
        if (tieneSignos) return prev;
        const sv = data.signos_vitales;
        const nextExpediente = {
          ...prev,
          consulta: {
            ...prev.consulta,
            exploracion: {
              ...prev.consulta.exploracion,
              signos: { ...prev.consulta.exploracion.signos, ...sv },
              antropometria: {
                ...prev.consulta.exploracion.antropometria,
                ...(sv.peso ? { peso: sv.peso } : {}),
                ...(sv.talla ? { talla: sv.talla } : {}),
                ...(sv.imc ? { imc: sv.imc } : {})
              }
            }
          }
        };

        const currentSnapshot = buildComparableDraftSnapshot({
          expediente: prev,
          tempMed,
          tempAlergia,
          tempCirugia,
          eventosDocumentales
        });

        if (!exitBaselineRef.current || draftSnapshotsEqual(exitBaselineRef.current, currentSnapshot)) {
          exitBaselineRef.current = buildComparableDraftSnapshot({
            expediente: nextExpediente,
            tempMed,
            tempAlergia,
            tempCirugia,
            eventosDocumentales
          });
        }

        return nextExpediente;
      });
    }, () => {});
    return () => unsub();
  }, [citaId, loading, tempMed, tempAlergia, tempCirugia, eventosDocumentales]);
  
  useEffect(() => {
    if (!pacienteId || !citaId || loading || isHistoricalReviewMode) return;

    const timer = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "citas", citaId), {
          consultaDraft: {
            consulta: expediente.consulta,
            resumen: expediente.resumen,
            antecedentes: expediente.antecedentes,
            control_embarazo: expediente.control_embarazo,
            px_info: {
              grupo_sanguineo: expediente.px_info?.grupo_sanguineo || '',
              fum: expediente.px_info?.fum || '',
              fpp: expediente.px_info?.fpp || '',
              sdg: expediente.px_info?.sdg || '',
              es_embarazada: !!expediente.px_info?.es_embarazada,
              requiere_cirugia: expediente.px_info?.requiere_cirugia || { general: false, ginecologica: false }
            },
            meta: { costo: expediente.meta?.costo || '' },
            tempMed,
            tempAlergia,
            tempCirugia
          },
          consultaDraftUpdatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Error autoguardando en Firebase", e);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    pacienteId,
    citaId,
    loading,
    expediente.consulta,
    expediente.resumen,
    expediente.antecedentes,
    expediente.control_embarazo,
    expediente.px_info?.grupo_sanguineo,
    expediente.px_info?.fum,
    expediente.px_info?.fpp,
    expediente.px_info?.sdg,
    expediente.px_info?.es_embarazada,
    expediente.px_info?.requiere_cirugia,
    expediente.meta?.costo,
    tempMed,
    tempAlergia,
    tempCirugia,
    isHistoricalReviewMode
  ]);

  useEffect(() => {
    if (!openDocumentTemplates) return;

    // Entrada rápida desde agenda de enfermería para generar plantillas.
    setShowActionsMenu(false);
    setShowFormatSelector(true);
  }, [openDocumentTemplates, openedFrom]);

  const handleVerHistoria = async () => {
    setLoading(true);
    setShowActionsMenu(false);
    try {
        const q = query(collection(db, "historial_clinico"), where("pacienteId", "==", pacienteId), orderBy("fecha", "desc"));
        const querySnapshot = await getDocs(q);
        const historial = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const fisicaRaw = data.consulta?.exploracion?.fisica || {};
            const exploracionLimpia = JSON.stringify(fisicaRaw).replace(/[{}"']/g, ' ').replace(/ , /g, ', ').trim();
            return {
                id: doc.id,
                fecha: data.fecha?.toDate ? data.fecha.toDate().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : 'Fecha no disponible',
                motivo: data.tipoNota || 'Consulta General',
                medicoNombre: data.medicoNombre || 'Médico General',
                padecimiento: data.consulta?.padecimiento || 'Sin descripción',
                signos: data.consulta?.exploracion?.signos || {},
                exploracionFisica: exploracionLimpia === "{}" ? "Sin hallazgos registrados" : exploracionLimpia,
                diagnostico: data.consulta?.diagnostico?.enfermedad_actual || 'Sin diagnóstico',
                receta: data.consulta?.diagnostico?.tratamiento_lista || [],
                recetasGeneradas: Array.isArray(data.recetasGeneradas) ? data.recetasGeneradas : [],
                documentosGenerados: Array.isArray(data.documentosGenerados) ? data.documentosGenerados : [],
                indicaciones: data.consulta?.diagnostico?.indicaciones || '',
                auditSnapshot: data.auditSnapshot || null
            };
        });
        setHistorialCompleto(historial);
        setShowHistoriaModal(true);
    } catch (error) { showToast("Error al abrir historial", "error"); }
    setLoading(false);
  };

  const handleGuardar = () => {
    const tieneReceta = (expediente.consulta.diagnostico.tratamiento_lista?.length > 0) || (tempMed.nombre?.trim() !== '');
    const tieneEstudios = (expediente.consulta.estudios.paquetes_seleccionados?.length > 0) || (expediente.consulta.estudios.estudios_seleccionados?.length > 0);
    const tieneProcedimientos = (expediente.consulta.procedimientos?.seleccionados?.length || 0) > 0;

    if (tieneReceta || tieneEstudios || tieneProcedimientos) {
        setShowPrintAlert(true);
    } else {
        executeSave({ allowCritical: true });
    }
  };

  const executeSave = async ({ allowCritical = false } = {}) => {
    setLoading(true);
    setShowPrintAlert(false);

    try {
      const expedienteFinal = { ...expediente };
      const grupoSanguineoNormalizado = (expedienteFinal.px_info?.grupo_sanguineo || '').trim().toUpperCase();
      expedienteFinal.px_info.grupo_sanguineo = grupoSanguineoNormalizado;
      const costoConsulta = Number.parseFloat(expedienteFinal.meta?.costo || 0);
      const costoSanitizado = Number.isFinite(costoConsulta) ? costoConsulta : 0;
      const finConsulta = new Date();
      const duracionRealMin = Math.max(1, Math.round((finConsulta - consultaInicioRef.current) / 60000));

      if (tempMed.nombre.trim() !== '') {
         const listaActual = expedienteFinal.consulta.diagnostico.tratamiento_lista || [];
         expedienteFinal.consulta.diagnostico.tratamiento_lista = [...listaActual, tempMed];
      }
      if (tempAlergia.nombre.trim() !== '') {
         const listaAlergias = expedienteFinal.antecedentes.alergias.lista || [];
         expedienteFinal.antecedentes.alergias.lista = [...listaAlergias, { sustancia: tempAlergia.nombre }];
      }
      if (tempCirugia.procedimiento.trim() !== '') {
         const nuevaCirugia = {
            ...tempCirugia,
            id: Date.now(),
            fechaRegistro: tempCirugia.tipoFecha === 'ano' ? tempCirugia.ano : tempCirugia.fechaHora.split('T')[0],
            medico: expediente.medicoNombre || 'Medico Tratante'
         };
         const listaCirugias = expedienteFinal.antecedentes.cirugias.lista || [];
         expedienteFinal.antecedentes.cirugias.lista = [...listaCirugias, nuevaCirugia];
      }

      const tratamientoActual = Array.isArray(expedienteFinal?.consulta?.diagnostico?.tratamiento_lista)
        ? expedienteFinal.consulta.diagnostico.tratamiento_lista
        : [];

      const eventosDocumento = eventosDocumentales.filter((evt) => evt.tipo === 'documento');
      const eventosReceta = eventosDocumentales.filter((evt) => evt.tipo === 'receta');
      const mappedSessionRecetas = eventosReceta.map((evt) => ({
        tipo: 'receta',
        nombre: evt.nombre,
        formato: evt.formato,
        origen: evt.origen,
        plantillaId: evt.plantillaId || '',
        plantillaNombre: evt.plantillaNombre || '',
        generadoAt: evt.generadoAt,
        archivoUrl: evt.archivoUrl || '',
        archivoPath: evt.archivoPath || ''
      }));

      const mappedSessionDocumentos = eventosDocumento.map((evt) => ({
        tipo: 'documento',
        nombre: evt.nombre,
        formato: evt.formato,
        origen: evt.origen,
        plantillaId: evt.plantillaId || '',
        plantillaNombre: evt.plantillaNombre || '',
        generadoAt: evt.generadoAt,
        archivoUrl: evt.archivoUrl || '',
        archivoPath: evt.archivoPath || ''
      }));

      let recetasGeneradas = [
        ...(tratamientoActual.length > 0
          ? [{
              tipo: 'receta',
              nombre: 'Receta medica de consulta',
              totalMedicamentos: tratamientoActual.length,
              formato: 'clinico',
              origen: 'consulta',
              generadoAt: finConsulta.toISOString()
            }]
          : []),
        ...mappedSessionRecetas
      ];

      let documentosGenerados = mappedSessionDocumentos;

      if (isHistoricalReviewMode) {
        const baseRecetas = Array.isArray(historicalReview?.recetasGeneradas)
          ? historicalReview.recetasGeneradas.map((evt) => {
              if ((evt?.origen === 'consulta' || evt?.nombre === 'Receta medica de consulta') && tratamientoActual.length > 0) {
                return { ...evt, totalMedicamentos: tratamientoActual.length };
              }
              return evt;
            })
          : [];

        const hasConsultaRecipe = baseRecetas.some(
          (evt) => evt?.origen === 'consulta' || evt?.nombre === 'Receta medica de consulta'
        );

        const reviewBaseRecetas = !hasConsultaRecipe && tratamientoActual.length > 0
          ? [{
              tipo: 'receta',
              nombre: 'Receta medica de consulta',
              totalMedicamentos: tratamientoActual.length,
              formato: 'clinico',
              origen: 'consulta',
              generadoAt: finConsulta.toISOString()
            }, ...baseRecetas]
          : baseRecetas;

        recetasGeneradas = mergeGeneratedEvents(reviewBaseRecetas, mappedSessionRecetas);
        documentosGenerados = mergeGeneratedEvents(
          Array.isArray(historicalReview?.documentosGenerados) ? historicalReview.documentosGenerados : [],
          mappedSessionDocumentos
        );
      }

      const validation = validateClinicalRecord(expedienteFinal, {
        pacienteId,
        medicoNombre: user?.nombre || ''
      });

      if (validation.status === 'critico' && !allowCritical) {
        showToast(`Guardado con campos pendientes: ${validation.missingCritical.join(', ')}`, 'info');
      }

      if (!consultaTieneDatosClinicos()) {
        showToast("Sin datos clínicos para guardar.", "info");
        if (isHistoricalReviewMode) {
          setLoading(false);
          return;
        }
        setTimeout(() => goBackOr(navigate, exitFallbackPath), 800);
        setLoading(false);
        return;
      }

      if (!isHistoricalReviewMode && pacienteId) {
        try {
          const resumenClinicoSnapshot = mergeClinicalSection(
            pacienteData?.resumenClinico,
            expedienteFinal.resumen
          );
          const antecedentesClinicosSnapshot = mergeClinicalSection(
            pacienteData?.antecedentesClinicos,
            expedienteFinal.antecedentes
          );
          const controlEmbarazoClinicoSnapshot = mergeClinicalSection(
            pacienteData?.controlEmbarazoClinico,
            expedienteFinal.control_embarazo
          );

          await updateDoc(doc(db, "pacientes", pacienteId), {
            grupoSanguineo: grupoSanguineoNormalizado,
            resumenClinico: resumenClinicoSnapshot,
            antecedentesClinicos: antecedentesClinicosSnapshot,
            controlEmbarazoClinico: controlEmbarazoClinicoSnapshot
          });
          setPacienteData(prev => ({
            ...prev,
            grupoSanguineo: grupoSanguineoNormalizado,
            resumenClinico: resumenClinicoSnapshot,
            antecedentesClinicos: antecedentesClinicosSnapshot,
            controlEmbarazoClinico: controlEmbarazoClinicoSnapshot
          }));
        } catch (errorPaciente) {
          console.warn("No se pudo actualizar grupo sanguíneo en paciente", errorPaciente);
        }
      }

      if (isHistoricalReviewMode && historicalReview?.historialId) {
        await updateDoc(doc(db, "historial_clinico", historicalReview.historialId), {
          ...expedienteFinal,
          costo: costoSanitizado,
          recetasGeneradas,
          documentosGenerados,
          auditSnapshot: validation.snapshot,
          actualizadoEnConsultaAt: serverTimestamp(),
          actualizadoPorMedicoId: auth.currentUser?.uid || 'anonimo',
          actualizadoPorMedicoNombre: user?.nombre || 'Medico sin nombre'
        });

        await createClinicalAuditRecord({
          pacienteId,
          pacienteNombre,
          historialId: historicalReview.historialId,
          citaId: historicalReview.citaId || null,
          medicoId: auth.currentUser?.uid || 'anonimo',
          medicoNombre: user?.nombre || 'Medico sin nombre',
          validation,
          expediente: expedienteFinal
        });

        setHistorialCompleto((prev) => (
          Array.isArray(prev)
            ? prev.map((row) => (
                row.id === historicalReview.historialId
                  ? {
                      ...row,
                      ...expedienteFinal,
                      costo: costoSanitizado,
                      recetasGeneradas,
                      documentosGenerados,
                      auditSnapshot: validation.snapshot
                    }
                  : row
              ))
            : prev
        ));
        setExpediente(expedienteFinal);
        setTempMed(DEFAULT_TEMP_MED);
        setTempAlergia(DEFAULT_TEMP_ALERGIA);
        setTempCirugia(DEFAULT_TEMP_CIRUGIA);
        setEventosDocumentales([]);
        setHistoricalReview((prev) => (
          prev
            ? {
                ...prev,
                recetasGeneradas,
                documentosGenerados
              }
            : prev
        ));
        setHistorialRefreshKey((prev) => prev + 1);

        showToast("Consulta histórica actualizada sin generar una nueva visita.", "success");
        if (validation.status === 'critico') {
          showToast(`Guardado con campos pendientes: ${validation.missingCritical.join(', ')}`, 'info');
        } else if (validation.status === 'incompleto') {
          showToast(`Guardado con observaciones de auditoria: ${validation.missingRecommended.join(', ')}`, 'info');
        }

        setLoading(false);
        return;
      }

      const historialRef = await addDoc(collection(db, "historial_clinico"), { 
          ...expedienteFinal, 
          pacienteId, 
          pacienteNombre, 
          medicoNombre: user.nombre, 
          fecha: serverTimestamp(), 
          medicoId: auth.currentUser?.uid || "anonimo",
          citaId: citaId || null,
          consultorioId: citaContext.consultorioId || null,
          consultorioNombre: citaContext.consultorioNombre || null,
          costo: costoSanitizado,
          duracionRealMin,
            recetasGeneradas,
            documentosGenerados,
          auditSnapshot: validation.snapshot
      });

      await createClinicalAuditRecord({
        pacienteId,
        pacienteNombre,
        historialId: historialRef.id,
        citaId: citaId || null,
        medicoId: auth.currentUser?.uid || 'anonimo',
        medicoNombre: user?.nombre || 'Medico sin nombre',
        validation,
        expediente: expedienteFinal
      });

      let citaDataForBitacora = null;

      if (citaId) {
        const citaRef = doc(db, "citas", citaId);
        const citaSnap = await getDoc(citaRef);
        let retrasoMin = 0;

        if (citaSnap.exists()) {
          const dataCita = citaSnap.data();
          citaDataForBitacora = dataCita;
          const [fechaProgramada, horaProgramada = '00:00'] = (dataCita.fechaHora || '').split('T');
          const inicioProgramado = fechaProgramada ? new Date(`${fechaProgramada}T${horaProgramada}`) : null;
          if (inicioProgramado && !Number.isNaN(inicioProgramado.getTime())) {
            retrasoMin = Math.max(0, Math.round((consultaInicioRef.current - inicioProgramado) / 60000));
          }
        }

        await updateDoc(citaRef, {
          estado: 'completada',
          consultaFinalizadaAt: serverTimestamp(),
          duracionRealMin,
          retrasoMin,
          costo: costoSanitizado,
          consultaDraft: null,
          consultaDraftUpdatedAt: null
        });
      }

      const bitacoraDocId = citaId ? `cita_${citaId}` : `hist_${historialRef.id}`;
      const bitacoraRef = doc(db, 'bitacora_px_enfermeria', bitacoraDocId);
      const bitacoraAutoBase = buildEnfermeriaPatientLogRecord({
        expediente: expedienteFinal,
        pacienteId,
        pacienteNombre,
        citaId: citaId || '',
        historialId: historialRef.id,
        citaData: citaDataForBitacora || {},
        citaContext,
        userSource: userProfileDoc || user || {},
        doctorNombre: user?.nombre || '',
        completedAt: finConsulta
      });
      const {
        recetaSurtida: _manualRecetaSurtida,
        recetaSurtidaLabel: _manualRecetaSurtidaLabel,
        ...bitacoraAutoPayload
      } = bitacoraAutoBase;
      await setDoc(bitacoraRef, {
        ...bitacoraAutoPayload,
        updatedAt: serverTimestamp(),
        fecha: serverTimestamp()
      }, { merge: true });

      // Enviar encuesta de satisfacción por WhatsApp
      const telefonoPx = expediente?.px_info?.telefono || pacienteData?.telefonoMovil || '';
      if (telefonoPx && citaId) {
        try {
          const functionsInstance = getFunctions();
          const enviarEncuesta = httpsCallable(functionsInstance, 'enviarEncuestaWhatsApp');
          await enviarEncuesta({
            telefono: telefonoPx,
            nombrePaciente: pacienteNombre,
            nombreDoctor: user?.nombre || '',
            citaId,
            pacienteId
          });
        } catch (encuestaError) {
          console.warn('No se pudo enviar encuesta de satisfacción:', encuestaError);
        }
      }
      
      setTempMed(DEFAULT_TEMP_MED);
      setTempAlergia(DEFAULT_TEMP_ALERGIA);
      setTempCirugia(DEFAULT_TEMP_CIRUGIA);
      setEventosDocumentales([]);
      syncExitBaseline({
        expediente: expedienteFinal,
        tempMed: DEFAULT_TEMP_MED,
        tempAlergia: DEFAULT_TEMP_ALERGIA,
        tempCirugia: DEFAULT_TEMP_CIRUGIA,
        eventosDocumentales: []
      });

      showToast("Expediente guardado correctamente.", "success");
      if (validation.status === 'critico') {
        showToast(`Guardado al salir con campos pendientes: ${validation.missingCritical.join(', ')}`, 'info');
      } else if (validation.status === 'incompleto') {
        showToast(`Guardado con observaciones de auditoria: ${validation.missingRecommended.join(', ')}`, 'info');
      }
      setTimeout(() => goBackOr(navigate, exitFallbackPath), 1500);

    } catch(e) { 
        console.error(e);
        if (isEnfermeriaDocumentMode) {
          showToast("No se pudo guardar el expediente. Regresando a enfermería.", "info");
          setTimeout(() => goBackOr(navigate, exitFallbackPath), 800);
        } else {
          showToast("Error al guardar el expediente", "error");
        }
    }
    setLoading(false);
  };

  const resolverTextoPlantilla = (texto = '') => {
    const normalizeTemplateFieldKey = (raw = '') => String(raw || '').replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();

    // Si hay override histórico, usarlo en lugar del expediente activo
    const exp = expedienteParaRecetaRef.current || expediente;

    const tratamientoLista = exp?.consulta?.diagnostico?.tratamiento_lista || [];
    const tratamientoTexto = tratamientoLista.length > 0
      ? tratamientoLista
        .map((med, idx) => `${idx + 1}. ${med.nombre || 'Medicamento'}${med.dosis ? ` - ${med.dosis}` : ''}`)
        .join('\n')
      : '';

    const tratamientoHtml = tratamientoLista.length > 0
      ? `<ol>${tratamientoLista.map((med) => `<li><strong>${String(med.nombre || 'Medicamento').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>${med.dosis ? ` - ${String(med.dosis).replace(/</g, '&lt;').replace(/>/g, '&gt;')}` : ''}</li>`).join('')}</ol>`
      : '';

    const esc = (v) => String(v || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const medicamentosTexto = tratamientoLista.length > 0
      ? tratamientoLista.map((med, idx) => {
          const lines = [`${idx + 1}. ${med.nombre || 'Medicamento'} ${med.presentacion || ''}`];
          const subParts = [med.numeroAcomodo || '', med.sustanciasActivas || ''].filter(Boolean);
          if (subParts.length > 0) lines.push(`   ${subParts.join(' ')}`);
          if (med.dosis) lines.push(`   ${med.dosis}`);
          return lines.join('\n');
        }).join('\n')
      : '';

    const medicamentosHtml = tratamientoLista.length > 0
      ? tratamientoLista.map((med, idx) => {
          const nombre = esc(med.nombre || 'Medicamento');
          const presentacion = esc(med.presentacion || '');
          const sustancia = esc(med.sustanciasActivas || '');
          const numAcomodo = esc(med.numeroAcomodo || '');
          const dosis = esc(med.dosis || '');
          let html = `<div style="margin-bottom:8px;"><div><strong>${idx + 1}. ${nombre}</strong>${presentacion ? ` ${presentacion}` : ''}</div>`;
          const subParts = [numAcomodo, sustancia].filter(Boolean);
          if (subParts.length > 0) html += `<div style="margin-left:16px;">${subParts.join(' ')}</div>`;
          if (dosis) html += `<div style="margin-left:16px;">${dosis}</div>`;
          html += '</div>';
          return html;
        }).join('')
      : '';

    const estudiosLista = exp?.consulta?.estudios?.estudios_seleccionados || [];
    const paquetesLista = exp?.consulta?.estudios?.paquetes_seleccionados || [];
    const notasEstudios = exp?.consulta?.estudios?.notas_generales || '';
    const estudiosOffset = tratamientoLista.length;

    const estudiosTexto = (() => {
      const parts = [];
      if (paquetesLista.length > 0) parts.push('Paquetes: ' + paquetesLista.join(', '));
      if (estudiosLista.length > 0) {
        estudiosLista.forEach((est, idx) => {
          const item = typeof est === 'string' ? est : (est.nombre || '');
          const nota = typeof est === 'object' && est.nota ? ` (${est.nota})` : '';
          parts.push(`${estudiosOffset + idx + 1}. ${item}${nota}`);
        });
      }
      if (notasEstudios) parts.push('Notas: ' + notasEstudios);
      return parts.length > 0 ? parts.join('\n') : '';
    })();

    const estudiosHtml = (() => {
      let html = '';
      if (paquetesLista.length > 0) {
        html += `<div style="margin-bottom:6px;"><strong>Paquetes:</strong> ${esc(paquetesLista.join(', '))}</div>`;
      }
      if (estudiosLista.length > 0) {
        html += `<ol start="${estudiosOffset + 1}">`;
        estudiosLista.forEach((est) => {
          const item = esc(typeof est === 'string' ? est : (est.nombre || ''));
          const nota = typeof est === 'object' && est.nota ? ` <em>(${esc(est.nota)})</em>` : '';
          html += `<li>${item}${nota}</li>`;
        });
        html += '</ol>';
      }
      if (notasEstudios) {
        html += `<div style="margin-top:6px;"><em>Notas: ${esc(notasEstudios)}</em></div>`;
      }
      return html;
    })();

    const procedimientosLista = exp?.consulta?.procedimientos?.seleccionados || [];
    const notasProcedimientos = exp?.consulta?.procedimientos?.notas_generales || '';
    const procedimientosOffset = tratamientoLista.length + estudiosLista.length;
    const formatProcedureToken = (value = '') => String(value || '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const procedimientosTexto = (() => {
      const parts = [];
      procedimientosLista.forEach((proc, idx) => {
        if (!proc || typeof proc !== 'object') {
          const nombrePlano = String(proc || '').trim();
          if (nombrePlano) parts.push(`${procedimientosOffset + idx + 1}. ${nombrePlano}`);
          return;
        }

        const nombre = String(proc.nombre || proc.procedimiento || proc.descripcion || '').trim() || 'Procedimiento';
        const extras = [];
        if (proc.prioridad) extras.push(`Prioridad: ${formatProcedureToken(proc.prioridad)}`);
        if (proc.estado) extras.push(`Estado: ${formatProcedureToken(proc.estado)}`);
        if (proc.sitio) extras.push(`Sitio: ${proc.sitio}`);
        if (proc.nota) extras.push(`Nota: ${proc.nota}`);
        if (proc.requiereConsentimiento === true) {
          extras.push(`Consentimiento: ${proc.consentimientoFirmado === true ? 'firmado' : 'pendiente'}`);
        }

        parts.push(`${procedimientosOffset + idx + 1}. ${nombre}${extras.length > 0 ? ` (${extras.join(' | ')})` : ''}`);
      });

      if (notasProcedimientos) parts.push('Notas: ' + notasProcedimientos);
      return parts.length > 0 ? parts.join('\n') : '';
    })();

    const procedimientosHtml = (() => {
      let html = '';
      if (procedimientosLista.length > 0) {
        html += `<ol start="${procedimientosOffset + 1}">`;
        procedimientosLista.forEach((proc) => {
          if (!proc || typeof proc !== 'object') {
            const nombrePlano = esc(String(proc || '').trim());
            if (nombrePlano) html += `<li>${nombrePlano}</li>`;
            return;
          }

          const nombre = esc(String(proc.nombre || proc.procedimiento || proc.descripcion || '').trim() || 'Procedimiento');
          const extras = [];
          if (proc.prioridad) extras.push(`Prioridad: ${esc(formatProcedureToken(proc.prioridad))}`);
          if (proc.estado) extras.push(`Estado: ${esc(formatProcedureToken(proc.estado))}`);
          if (proc.sitio) extras.push(`Sitio: ${esc(proc.sitio)}`);
          if (proc.nota) extras.push(`Nota: ${esc(proc.nota)}`);
          if (proc.requiereConsentimiento === true) {
            extras.push(`Consentimiento: ${proc.consentimientoFirmado === true ? 'firmado' : 'pendiente'}`);
          }

          html += `<li>${nombre}${extras.length > 0 ? ` <em>(${extras.join(' | ')})</em>` : ''}</li>`;
        });
        html += '</ol>';
      }
      if (notasProcedimientos) {
        html += `<div style="margin-top:6px;"><em>Notas: ${esc(notasProcedimientos)}</em></div>`;
      }
      return html;
    })();

    const fechaRecetaRaw = exp?.fechaConsulta
      || exp?.consulta?.fecha
      || exp?.createdAt
      || exp?.created_at
      || new Date().toISOString();
    const fechaRecetaDate = parseFirestoreDate(fechaRecetaRaw) || new Date();

    const userFuente = userProfileDoc || user || {};
    const existeCitaEnContexto = Boolean(citaId);
    const sucursalNombreDesdeCita = String(citaContext?.sucursalNombre || '').trim();
    const sucursalTelefonoDesdeCita = String(citaContext?.sucursalTelefono || '').trim();
    const sucursalDireccionDesdeCita = String(citaContext?.sucursalDireccion || '').trim();
    const sucursalNombreUsuario = String(userFuente?.sucursalActual || userFuente?.sucursal || userFuente?.nombreSucursal || '').trim();
    const sucursalTelefonoUsuario = String(userFuente?.telefonoSucursal || userFuente?.telefonoConsultorio || userFuente?.telefono || '').trim();
    const sucursalDireccionUsuario = String(userFuente?.direccionSucursal || userFuente?.direccionConsultorio || userFuente?.direccion || '').trim();
    const sucursalNombre = sucursalNombreDesdeCita || sucursalNombreUsuario || '';
    const sucursalTelefono = sucursalTelefonoDesdeCita || sucursalTelefonoUsuario || '';
    const sucursalDireccion = sucursalDireccionDesdeCita || sucursalDireccionUsuario || '';
    const sucursalHorario = userFuente?.horarioSucursal || userFuente?.horarioConsultorio || '';
    const telefonoQuejas = userFuente?.telefonoQuejas || userFuente?.quejasSugerencias || sucursalTelefono || '';
    const grupoSanguineo = exp?.px_info?.grupo_sanguineo || pacienteData?.grupoSanguineo || pacienteData?.grupo_sanguineo || '';
    const alergiasLista = Array.isArray(exp?.antecedentes?.alergias?.lista)
      ? exp.antecedentes.alergias.lista.map((item) => (item?.sustancia || item?.nombre || '')).map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    const alergiasOtros = String(exp?.antecedentes?.alergias?.otros || exp?.antecedentes?.alergias?.otras || '').trim();
    const preguntadosYNegados = exp?.antecedentes?.alergias?.preguntados_y_negados || false;
    const alergiasDesdeAntecedentes = preguntadosYNegados
      ? 'Preguntados y negados'
      : [
          ...alergiasLista,
          ...(alergiasOtros ? [alergiasOtros] : [])
        ].join(', ');
    const alergiasTexto = String(exp?.px_info?.alergias_base || '').trim() || alergiasDesdeAntecedentes || 'Interrogadas y negadas';

    // --- Resolución de consultorio con fallback a perfil del usuario ---
    const consultorioIdDesdeCita = String(citaContext?.consultorioId || '').trim();
    const consultorioNombreDesdeCita = String(citaContext?.consultorioNombre || '').trim();
    const consultorioIdDesdeUser = String(
      userFuente?.consultorioActualId
      || userFuente?.consultorioRecurrenteId
      || userFuente?.consultorioId
      || ''
    ).trim();
    const consultorioNombreDesdeUser = String(
      userFuente?.consultorioActual
      || userFuente?.consultorioRecurrente
      || userFuente?.consultorio
      || ''
    ).trim();

    // Intento 1: buscar por datos de la cita
    const consultorioEncontradoPorCita = (consultorioIdDesdeCita || consultorioNombreDesdeCita)
      ? consultoriosCatalogo.find((item) => {
          const byId = consultorioIdDesdeCita && String(item?.id || '').trim() === consultorioIdDesdeCita;
          const byName = consultorioNombreDesdeCita
            && consultorioNombreDesdeCita.toLowerCase() !== 'sin asignar'
            && normalizeTextKey(item?.nombre || '') === normalizeTextKey(consultorioNombreDesdeCita);
          return byId || byName;
        })
      : null;

    // Intento 2: buscar por datos del perfil del usuario (si la cita no resolvió)
    const consultorioEncontradoPorUser = !consultorioEncontradoPorCita
      ? consultoriosCatalogo.find((item) => {
          const byId = consultorioIdDesdeUser && String(item?.id || '').trim() === consultorioIdDesdeUser;
          const byName = consultorioNombreDesdeUser && normalizeTextKey(item?.nombre || '') === normalizeTextKey(consultorioNombreDesdeUser);
          return byId || byName;
        })
      : null;

    const consultorioEncontrado = consultorioEncontradoPorCita || consultorioEncontradoPorUser || null;
    const consultorioNombre = consultorioEncontrado?.nombre || consultorioNombreDesdeCita || consultorioNombreDesdeUser || '';
    const consultorioIdContext = consultorioEncontrado?.id || consultorioIdDesdeCita || consultorioIdDesdeUser || '';
    const sucursalIdContext = String(citaContext?.sucursalId || consultorioEncontrado?.sucursalId || userFuente?.sucursalActualId || userFuente?.sucursalId || '').trim();
    const consultoriosMismaSucursal = consultoriosCatalogo.filter((item) => {
      const itemSucursalId = String(item?.sucursalId || '').trim();
      const itemSucursalNombre = normalizeTextKey(item?.sucursal || item?.sucursalNombre || '');
      const bySucursalId = Boolean(sucursalIdContext) && itemSucursalId === sucursalIdContext;
      const bySucursalNombre = Boolean(sucursalNombre) && itemSucursalNombre === normalizeTextKey(sucursalNombre);
      return bySucursalId || bySucursalNombre;
    });
    const consultorioFallbackSucursalUnico = consultoriosMismaSucursal.length === 1
      ? consultoriosMismaSucursal[0]
      : null;
    const sucursalCatalogoEncontrada = sucursalesCatalogo.find((item) => {
      const byId = sucursalIdContext && String(item?.id || '').trim() === sucursalIdContext;
      const byName = normalizeTextKey(item?.nombre || '') === normalizeTextKey(sucursalNombre || '');
      return byId || byName;
    });
    const sucursalNombreResuelto = String(
      sucursalNombre
      || sucursalCatalogoEncontrada?.nombre
      || consultorioEncontrado?.sucursal
      || consultorioFallbackSucursalUnico?.sucursal
      || sucursalNombreUsuario
      || ''
    ).trim();
    const sucursalTelefonoResuelto = String(
      sucursalTelefono
      || sucursalCatalogoEncontrada?.telefono
      || sucursalTelefonoUsuario
      || ''
    ).trim();
    const sucursalDireccionCatalogo =
      sucursalCatalogoEncontrada?.ubicacion
      || sucursalCatalogoEncontrada?.direccion
      || sucursalCatalogoEncontrada?.domicilio
      || '';
    const filtrarSinUbicacion = (v) => {
      const norm = String(v || '').trim().toLowerCase();
      return norm && norm !== 'sin ubicación' && norm !== 'sin ubicacion' ? String(v).trim() : '';
    };
    const consultorioUnicoFallback = consultoriosCatalogo.length === 1
      ? consultoriosCatalogo[0]
      : null;
    const consultorioDireccion = filtrarSinUbicacion(citaContext?.consultorioDireccion)
      || filtrarSinUbicacion(consultorioEncontrado?.ubicacion)
      || filtrarSinUbicacion(consultorioEncontrado?.ubicacionConsultorio)
      || filtrarSinUbicacion(consultorioEncontrado?.direccion)
      || filtrarSinUbicacion(consultorioEncontrado?.domicilio)
      || filtrarSinUbicacion(consultorioFallbackSucursalUnico?.ubicacion)
      || filtrarSinUbicacion(consultorioFallbackSucursalUnico?.ubicacionConsultorio)
      || filtrarSinUbicacion(consultorioFallbackSucursalUnico?.direccion)
      || filtrarSinUbicacion(consultorioFallbackSucursalUnico?.domicilio)
      || filtrarSinUbicacion(sucursalDireccionCatalogo)
      || filtrarSinUbicacion(userFuente?.consultorioUbicacion)
      || filtrarSinUbicacion(userFuente?.direccionConsultorio)
      || filtrarSinUbicacion(sucursalDireccion || sucursalDireccionCatalogo)
      || filtrarSinUbicacion(consultorioUnicoFallback?.ubicacion)
      || filtrarSinUbicacion(consultorioUnicoFallback?.direccion)
      || filtrarSinUbicacion(consultorioUnicoFallback?.domicilio)
      || '';
    const direccionReceta = consultorioDireccion
      || filtrarSinUbicacion(sucursalDireccion)
      || filtrarSinUbicacion(sucursalDireccionCatalogo)
      || filtrarSinUbicacion(sucursalDireccionDesdeCita)
      || filtrarSinUbicacion(sucursalDireccionUsuario)
      || '';

    // Diagnóstico controlado: solo loguear una vez
    if (!consultorioDireccion && consultoriosCatalogo.length > 0) {
      const debugKey = `${consultorioIdContext}|${consultorioNombre}|${consultoriosCatalogo.length}`;
      if (direccionDebugRef.current !== debugKey) {
        direccionDebugRef.current = debugKey;
        console.warn('[Receta] Dirección de consultorio/sucursal VACIA. Datos evaluados:', {
          catalogoConsultoriosCargados: consultoriosCatalogo.length,
          catalogoSucursalesCargadas: sucursalesCatalogo.length,
          todosLosConsultoriosUbicacion: consultoriosCatalogo.map((c) => ({ id: c.id, nombre: c.nombre, ubicacion: c.ubicacion })),
          citaId: citaId || '(sin cita)',
          citaContextDireccion: citaContext?.consultorioDireccion || '',
          citaContextConsultorioId: citaContext?.consultorioId || '',
          consultorioIdContext,
          consultorioNombreContext: consultorioNombre,
          consultorioEncontrado: consultorioEncontrado ? { id: consultorioEncontrado.id, nombre: consultorioEncontrado.nombre, ubicacion: consultorioEncontrado.ubicacion } : null,
          consultorioFallbackSucursalUnico: consultorioFallbackSucursalUnico ? { id: consultorioFallbackSucursalUnico.id, nombre: consultorioFallbackSucursalUnico.nombre, ubicacion: consultorioFallbackSucursalUnico.ubicacion } : null,
          consultorioUnicoFallback: consultorioUnicoFallback ? { id: consultorioUnicoFallback.id, nombre: consultorioUnicoFallback.nombre, ubicacion: consultorioUnicoFallback.ubicacion } : null,
          sucursalCatalogoEncontrada: sucursalCatalogoEncontrada ? { id: sucursalCatalogoEncontrada.id, nombre: sucursalCatalogoEncontrada.nombre, ubicacion: sucursalCatalogoEncontrada.ubicacion } : null,
          userConsultorioActualId: userFuente?.consultorioActualId || '',
          userConsultorioRecurrenteId: userFuente?.consultorioRecurrenteId || '',
          userConsultorioActual: userFuente?.consultorioActual || '',
          userDireccionConsultorio: userFuente?.direccionConsultorio || '',
          userSucursalId: userFuente?.sucursalId || userFuente?.sucursalActualId || ''
        });
      }
    }
    const fechaNacimientoRaw = exp?.px_info?.fecha_nacimiento || pacienteData?.fechaNacimiento || pacienteData?.fecha_nacimiento || '';
    const fechaNacimientoDate = parseFirestoreDate(fechaNacimientoRaw);
    const edadCalculada = (() => {
      if (!fechaNacimientoDate) return '';
      const hoy = new Date();
      let years = hoy.getFullYear() - fechaNacimientoDate.getFullYear();
      const monthDiff = hoy.getMonth() - fechaNacimientoDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && hoy.getDate() < fechaNacimientoDate.getDate())) years -= 1;
      return years > 0 ? String(years) : '';
    })();
    const telefonoPaciente = exp?.px_info?.telefono
      || pacienteData?.telefonoMovil
      || pacienteData?.telefono
      || pacienteData?.telefonoCelular
      || pacienteData?.celular
      || '';
    let folioReceta = exp?.px_info?.folio_receta
      || exp?.folio
      || '';

    if (!folioReceta) {
      folioReceta = '';
    }

    const horaExpedida = formatIssuedTimeEsMx(new Date());

    const contexto = {
      paciente: {
        id: cleanPatientId(exp?.px_info?.id_receta || getLegacyPatientIdFromDb(pacienteData) || pacienteId || ''),
        nombre: pacienteNombre || '',
        edad: exp?.px_info?.edad || edadCalculada || '',
        fecha_nacimiento: fechaNacimientoRaw,
        id_receta: cleanPatientId(exp?.px_info?.id_receta || getLegacyPatientIdFromDb(pacienteData) || pacienteId || ''),
        folio_receta: folioReceta,
        alergias_base: alergiasTexto,
        alergias: alergiasTexto,
        telefono: telefonoPaciente,
        sexo: pacienteData?.sexo || '',
        grupo_sanguineo: grupoSanguineo,
        tipo_sangre: grupoSanguineo
      },
      exploracion: {
        signos: {
          ta: exp?.consulta?.exploracion?.signos?.ta || '',
          temp: exp?.consulta?.exploracion?.signos?.temp || '',
          fc: exp?.consulta?.exploracion?.signos?.fc || '',
          fr: exp?.consulta?.exploracion?.signos?.fr || '',
          spo2: exp?.consulta?.exploracion?.signos?.spo2 || ''
        },
        antropometria: {
          peso: exp?.consulta?.exploracion?.antropometria?.peso || '',
          talla: exp?.consulta?.exploracion?.antropometria?.talla || ''
        }
      },
      medico: {
        nombre: user?.nombre || '',
        cedula: user?.cedula || user?.cedulaProfesional || '',
        cedula_profesional: user?.cedula || user?.cedulaProfesional || '',
        especialidad: user?.especialidad || '',
        universidad_egreso: user?.universidadEgreso || '',
        centro_estudios: user?.universidadEgreso || '',
        sucursal: user?.sucursal || ''
      },
      receta: {
        folio: folioReceta,
        fecha: fechaRecetaDate.toLocaleDateString('es-MX')
      },
      sucursal: {
        nombre: sucursalNombreResuelto,
        horario: sucursalHorario,
        quejas_sugerencias: telefonoQuejas,
        // Forzamos direccion de sucursal al origen mas confiable para compatibilidad con plantillas legacy.
        direccion: direccionReceta,
        ubicacion: direccionReceta,
        domicilio: direccionReceta,
        telefono: sucursalTelefonoResuelto
      },
      consultorio: {
        nombre: consultorioNombre,
        direccion: direccionReceta,
        ubicacion: direccionReceta,
        domicilio: direccionReceta
      },
      consulta: {
        padecimiento: exp?.consulta?.padecimiento || '',
        diagnostico: exp?.consulta?.diagnostico?.enfermedad_actual || '',
        cie10_texto: Array.isArray(exp?.consulta?.diagnostico?.cie10)
          ? exp.consulta.diagnostico.cie10.map((item) => item?.codigo ? `${item.codigo} - ${item.descripcion || ''}` : (item?.descripcion || '')).filter(Boolean).join(', ')
          : '',
        indicaciones: exp?.consulta?.diagnostico?.indicaciones || '',
        tratamiento_texto: tratamientoTexto,
        tratamiento_html: tratamientoHtml,
        medicamentos_texto: medicamentosTexto,
        medicamentos_html: medicamentosHtml,
        estudios_texto: estudiosTexto,
        estudios_html: estudiosHtml,
        estudios_conteo: String(estudiosLista.length),
        paquetes_texto: paquetesLista.length > 0 ? paquetesLista.join(', ') : '',
        estudios_notas: notasEstudios,
        procedimientos_texto: procedimientosTexto,
        procedimientos_html: procedimientosHtml,
        procedimientos_conteo: String(procedimientosLista.length),
        procedimientos_notas: notasProcedimientos,
        receta_contenido: (() => {
          const secciones = [];
          if (medicamentosTexto) secciones.push(medicamentosTexto);
          if (estudiosTexto) {
            secciones.push('');
            secciones.push(estudiosTexto);
          }
          if (procedimientosTexto) {
            secciones.push('');
            secciones.push(procedimientosTexto);
          }
          return secciones.join('\n');
        })()
      },
      fecha: {
        hoy: fechaRecetaDate.toLocaleDateString('es-MX'),
        hoy_larga: formatDateLongEsMx(fechaRecetaDate),
        expedida: horaExpedida,
        larga: formatDateLongEsMx(fechaRecetaDate)
      },
      fechaexpedida: horaExpedida
    };

    const getDeep = (obj, path) => path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), obj);
    const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

    const unitByField = {
      'exploracion.antropometria.peso': 'kg',
      'exploracion.antropometria.talla': 'm',
      'exploracion.signos.temp': '°C',
      'exploracion.signos.fc': 'lpm',
      'exploracion.signos.fr': 'rpm',
      'exploracion.signos.spo2': '%'
    };

    const appendUnitIfNeeded = (fieldPath, value) => {
      const unit = unitByField[fieldPath];
      if (!unit || !hasValue(value)) return value ?? '';

      const raw = String(value).trim();
      const lowerRaw = raw.toLowerCase();
      const lowerUnit = unit.toLowerCase();
      if (lowerRaw.includes(lowerUnit)) return raw;
      return `${raw} ${unit}`;
    };

    return String(texto).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, key) => {
      const fieldPath = normalizeTemplateFieldKey(key).toLowerCase();
      const aliasFieldPath = (
        fieldPath === 'consultorio.ubicacion'
        || fieldPath === 'consultorio.ubicacionconsultorio'
      )
        ? 'consultorio.direccion'
        : fieldPath === 'sucursal.ubicacion'
          ? 'sucursal.direccion'
          : fieldPath;
      const valor = getDeep(contexto, aliasFieldPath);
      return appendUnitIfNeeded(aliasFieldPath, valor);
    });
  };

  const resolverValorCampoPlantilla = (campoId = '') => resolverTextoPlantilla(`{{${campoId}}}`);

  const plantillasReceta = useMemo(
    () => plantillasDinamicas.filter((tpl) => (tpl.tipoDocumento || 'general') === 'receta'),
    [plantillasDinamicas]
  );

  const plantillaRecetaPreferida = useMemo(
    () => plantillasReceta.find((tpl) => tpl.id === plantillaRecetaPreferidaId) || null,
    [plantillasReceta, plantillaRecetaPreferidaId]
  );

  const handlePrintReceta = () => {

    if (plantillasReceta.length === 0) {
      showToast('No hay plantillas de receta configuradas. Contacte al administrador.', 'error');
      expedienteParaRecetaRef.current = null;
      return;
    }

    if (plantillaRecetaPreferida) {
      setPlantillaActiva(plantillaRecetaPreferida);
      return;
    }

    if (plantillasReceta.length === 1) {
      const unica = plantillasReceta[0];
      setPlantillaRecetaPreferidaId(unica.id);
      setPlantillaActiva(unica);
      return;
    }

    setShowRecipeTemplateSelector(true);
  };

  const handlePrintRecetaYSalir = () => {
    pendingExitAfterRecipePrintRef.current = true;
    handlePrintReceta();
  };

  // Determina si la consulta actual tiene datos clínicos que justifiquen guardar en historial
  const consultaTieneDatosClinicos = () => {
    const c = expediente.consulta;
    const signos = c?.exploracion?.signos || {};
    const antropometria = c?.exploracion?.antropometria || {};
    const tieneSignos = Object.values(signos).some(v => String(v || '').trim() !== '');
    const tieneAntropometria = ['peso', 'talla'].some(k => String(antropometria[k] || '').trim() !== '');
    const tienePadecimiento = String(c?.padecimiento || '').trim() !== '';
    const tieneDiagnostico = String(c?.diagnostico?.enfermedad_actual || '').trim() !== '';
    const tieneTratamiento = (c?.diagnostico?.tratamiento_lista?.length || 0) > 0 || String(tempMed?.nombre || '').trim() !== '';
    const tieneIndicaciones = String(c?.diagnostico?.indicaciones || '').trim() !== '';
    const tieneEstudios = (c?.estudios?.paquetes_seleccionados?.length || 0) > 0 || (c?.estudios?.estudios_seleccionados?.length || 0) > 0;
    const tieneProcedimientos = (c?.procedimientos?.seleccionados?.length || 0) > 0;
    return tieneSignos || tieneAntropometria || tienePadecimiento || tieneDiagnostico || tieneTratamiento || tieneIndicaciones || tieneEstudios || tieneProcedimientos;
  };

  const handleSalir = () => {
    pendingExitAfterRecipePrintRef.current = false;
    if (isHistoricalReviewMode) {
      restoreConsultaActual();
      return;
    }

    const { hasChanges, changes } = assessUnsavedChanges();

    if (!hasChanges) {
      restoreEntryStateAndExit();
      return;
    }

    setExitChangeList(changes);
    setShowExitAlert(true);
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex flex-col overflow-hidden text-slate-800 font-sans selection:bg-blue-100 relative">
      <style dangerouslySetInnerHTML={{__html: STYLES}} />

      {/* --- TOAST --- */}
      {notification && <ToastNotification msg={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}

      {/* --- HEADER --- */}
      <header className="bg-white/80 backdrop-blur-md px-3 py-1.5 border-b border-slate-200/60 flex justify-between items-center z-50 shadow-sm print:hidden sticky top-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleSalir}
            disabled={loading}
            className="group relative overflow-hidden bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-[0.95] disabled:opacity-50 disabled:shadow-none text-xs"
          >
            <ArrowLeft size={14} />
            <span>{loading ? '...' : isHistoricalReviewMode ? 'Volver' : 'Salir'}</span>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
                <AvatarPaciente sexo={pacienteData?.sexo} fechaNacimiento={pacienteData?.fechaNacimiento} size="md" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
            </div>

            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-bold leading-tight text-slate-800 tracking-tight truncate max-w-[220px]" title={pacienteNombre}>
                {pacienteNombre || 'Cargando...'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-px rounded border border-blue-100 uppercase tracking-wide">
                  {expediente.px_info.edad || '--'}
                </span>
                {expediente.px_info.fecha_nacimiento && (() => {
                  const d = parseFirestoreDate(expediente.px_info.fecha_nacimiento);
                  if (!d) return null;
                  const dd = String(d.getDate()).padStart(2, '0');
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const yyyy = d.getFullYear();
                  return (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-px rounded border border-slate-100 tracking-wide">
                      {`${dd}/${mm}/${yyyy}`}
                    </span>
                  );
                })()}
                <div className="relative group">
                    <div className={`flex items-center gap-1 px-1.5 py-px rounded border text-[9px] font-black uppercase tracking-wide cursor-pointer transition-all ${
                        expediente.px_info.grupo_sanguineo 
                        ? 'bg-rose-50 text-rose-600 border-rose-100 ring-1 ring-rose-50' 
                        : 'bg-slate-50 text-slate-400 border-slate-200 border-dashed hover:border-slate-300'
                    }`}>
                        <Droplet size={8} className={expediente.px_info.grupo_sanguineo ? "fill-rose-500 text-rose-500" : "text-slate-300"} />
                        {expediente.px_info.grupo_sanguineo || '?'}
                    </div>
                    <select
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        value={expediente.px_info.grupo_sanguineo || ''}
                        onChange={(e) => updateCampo('px_info.grupo_sanguineo', e.target.value)}
                    >
                        <option value="">Definir...</option>
                        {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
                {expediente.consulta.exploracion.antropometria?.peso && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[9px] font-bold bg-slate-50 text-slate-500 border-slate-200 uppercase tracking-wide">
                    <Scale size={8} />
                    {expediente.consulta.exploracion.antropometria.peso} kg
                  </span>
                )}
                {expediente.consulta.exploracion.antropometria?.talla && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[9px] font-bold bg-slate-50 text-slate-500 border-slate-200 uppercase tracking-wide">
                    <Ruler size={8} />
                    {expediente.consulta.exploracion.antropometria.talla} cm
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className={`hidden lg:flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 ${getTimerStyles()}`}>
          <div className="relative flex items-center justify-center">
             <Clock size={14} className={`${seconds <= 10 && seconds >= 0 ? "animate-spin" : ""}`} />
             {seconds <= 60 && <span className="absolute w-full h-full rounded-full bg-current opacity-20 animate-ping"></span>}
          </div>
          <span className="text-base font-mono font-bold tracking-tight">
            {formatTime(seconds)}
          </span>
        </div>

        {/* ── NAVEGACIÓN PRINCIPAL ── */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
          <HeaderTab icon={<Activity size={15}/>} label="Resumen" active={activeMainTab === 'resumen'} visited={visitedTabs.has('resumen')} onClick={() => handleTabChange('resumen')} color="emerald" />
          <div className={`w-4 h-px ${visitedTabs.has('antecedentes') ? 'bg-slate-400' : 'bg-slate-300'}`}></div>
          <HeaderTab icon={<ClipboardList size={15}/>} label="Historial" active={activeMainTab === 'antecedentes'} visited={visitedTabs.has('antecedentes')} onClick={() => handleTabChange('antecedentes')} color="violet" />
          <div className={`w-4 h-px ${visitedTabs.has('consulta') ? 'bg-slate-400' : 'bg-slate-300'}`}></div>
          <HeaderTab icon={<Stethoscope size={15}/>} label="Consulta" active={activeMainTab === 'consulta'} visited={visitedTabs.has('consulta')} onClick={() => handleTabChange('consulta')} color="blue" />
        </div>

        <div className="flex items-center gap-1.5">

          {/* ── ESTADO DEL PACIENTE ── */}
          <div className="relative">
             <button 
                onClick={() => setShowMenuQx(!showMenuQx)}
                title="Estado del Paciente"
                className={`p-2 rounded-lg border text-xs font-bold transition-all
                ${(expediente.px_info.requiere_cirugia?.general || expediente.px_info.es_embarazada) 
                  ? 'bg-rose-50 text-rose-600 border-rose-200' 
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
             >
                {pacienteData.sexo === 'Femenino' ? <Baby size={16}/> : <Scissors size={16}/>}
             </button>

             {showMenuQx && (
                <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenuQx(false)}></div>
                <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 z-20 overflow-hidden p-5 animate-in fade-in zoom-in-95 origin-top-right border border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Requerimientos Qx</h4>
                    <div className="space-y-3 mb-6">
                        <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                            <input type="checkbox" className="w-4 h-4 accent-rose-500 rounded" 
                                checked={expediente.px_info.requiere_cirugia?.general || false}
                                onChange={(e) => updateCampo('px_info.requiere_cirugia.general', e.target.checked)} />
                            <span className="text-sm font-bold text-slate-700">Cirugía General</span>
                        </label>
                        {pacienteData.sexo === 'Femenino' && (
                            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                                <input type="checkbox" className="w-4 h-4 accent-rose-500 rounded" 
                                    checked={expediente.px_info.requiere_cirugia?.ginecologica || false}
                                    onChange={(e) => updateCampo('px_info.requiere_cirugia.ginecologica', e.target.checked)} />
                                <span className="text-sm font-bold text-slate-700">Cirugía Ginecológica</span>
                            </label>
                        )}
                    </div>

                    {pacienteData.sexo === 'Femenino' && (
                        <>
                            <div className="border-t border-slate-100 my-4"></div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Estado Obstétrico</h4>
                            
                            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">F.U.M.</label>
                                <input type="date" className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded text-sm font-bold text-slate-700" 
                                    value={expediente.px_info.fum} onChange={(e) => updateCampo('px_info.fum', e.target.value)} />
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-blue-50 mb-3">
                                <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" 
                                    checked={expediente.px_info.es_embarazada || false}
                                    onChange={(e) => updateCampo('px_info.es_embarazada', e.target.checked)} />
                                <span className="text-sm font-bold text-slate-700">¿Existe Embarazo?</span>
                            </label>

                            {expediente.px_info.es_embarazada && (
                                <div className="space-y-3 animate-in fade-in">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="block text-[9px] font-bold text-slate-400">S.D.G.</span>
                                            <span className="text-xs font-bold text-blue-600">{expediente.px_info.sdg || '--'}</span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="block text-[9px] font-bold text-slate-400">F.P.P.</span>
                                            <span className="text-xs font-bold text-blue-600">{expediente.px_info.fpp || '--'}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => { setShowMenuQx(false); setShowEmbarazoModal(true); }}
                                        className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-blue-600 transition-all"
                                    >
                                        Detalles Control Embarazo
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
                </>
             )}
          </div>

          {/* ── COSTO CONSULTA ── */}
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100" title="Costo consulta">
            <span className="text-slate-400 font-bold text-xs">$</span>
            <input 
              className="w-14 bg-transparent text-right font-bold text-slate-700 outline-none placeholder:text-slate-300 text-xs" 
              value={expediente.meta.costo} 
              onChange={e => updateCampo('meta.costo', e.target.value)} 
              placeholder="0.00" 
            />
          </div>

          <div className="w-px h-5 bg-slate-200"></div>

          {/* ── IMPRIMIR RECETA ── */}
          <button 
            onClick={handlePrintReceta} 
            title="Imprimir Receta" 
            className="p-2 rounded-lg border transition-all active:scale-95 bg-white border-slate-200 text-purple-500 hover:bg-purple-50 hover:border-purple-300"
          >
            <Printer size={16} />
          </button>

          {/* ── ACCIONES ── */}
          <button onClick={() => setShowActionsMenu(true)} title="Acciones" className={`p-2 rounded-lg border transition-all active:scale-95 ${showActionsMenu ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}>
            <LayoutGrid size={16} />
          </button>

          {/* ── FINALIZAR CONSULTA ── */}
          <button 
            onClick={handleGuardar} 
            disabled={loading}
            title={isHistoricalReviewMode ? 'Guardar consulta histórica' : 'Finalizar consulta'} 
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            <span>{loading ? '...' : isHistoricalReviewMode ? 'Guardar consulta' : 'Finalizar'}</span>
          </button>

        </div>
      </header>

      {isHistoricalReviewMode && (
        <div className="px-3 pt-3 print:hidden">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Modo consulta histórica</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                Estás revisando {historicalReview?.tipoNota || 'la consulta histórica'} del {historicalReview?.fechaLabel || 'registro seleccionado'}. Guardar actualizará este registro y no se contará como una nueva visita.
              </p>
            </div>
            <button
              onClick={() => restoreConsultaActual()}
              className="px-4 py-2 rounded-xl bg-white text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-black uppercase tracking-wide shadow-sm"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Volver a consulta actual
            </button>
          </div>
        </div>
      )}

      {/* --- LAYOUT PRINCIPAL --- */}
      <div className="flex-1 flex overflow-hidden relative print:hidden">
        <main className="flex-1 overflow-hidden relative bg-slate-50/50 p-2 md:p-4 print:p-0">
          <div className="w-full h-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="flex-1 flex flex-col h-full w-full"> 
                {activeMainTab === 'consulta' && (
                  <div className="flex-1 h-full w-full animate-in fade-in duration-300">
                    <SeccionConsulta 
                       key={pacienteId}
                       expediente={expediente} 
                       updateCampo={updateCampo} 
                       activeConsulta={activeConsulta} 
                       setActiveConsulta={setActiveConsulta}
                        onPrintReceta={handlePrintReceta}
                        onPrintRecetaSalir={isHistoricalReviewMode ? handlePrintReceta : handlePrintRecetaYSalir}
                       tempMed={tempMed}
                       setTempMed={setTempMed}
                       doctorUid={user?.uid}
                    />
                  </div>
                )}
                {activeMainTab === 'antecedentes' && (
                  <div className="flex-1 h-full w-full animate-in fade-in duration-300">
                    <SeccionAntecedentes 
                       key={pacienteId}
                       expediente={expediente} 
                       updateCampo={updateCampo} 
                       sexo={pacienteData?.sexo} 
                       edad={parseInt(expediente.px_info.edad)}
                       tempAlergia={tempAlergia}
                       setTempAlergia={setTempAlergia}
                       tempCirugia={tempCirugia}
                       setTempCirugia={setTempCirugia}
                       onNextStep={() => handleTabChange('consulta')}
                    />
                  </div>
                )}
                {activeMainTab === 'resumen' && (
                  <div className="flex-1 h-full w-full animate-in fade-in duration-300">
                    <SeccionResumen 
                       key={pacienteId}
                       expediente={expediente} 
                       updateCampo={updateCampo} 
                       pacienteId={pacienteId}
                        historialRefreshKey={historialRefreshKey}
                       eventosDocumentalesSesion={eventosDocumentales}
                       onNextStep={() => handleTabChange('antecedentes')}
                        onCargarConsultaHistorica={cargarConsultaHistorica}

                       onImprimirReceta={(historicalData) => {
                         const fechaHist = historicalData.fecha?.toDate ? historicalData.fecha.toDate() : (historicalData.fecha instanceof Date ? historicalData.fecha : null);
                         expedienteParaRecetaRef.current = {
                           ...expediente,
                           consulta: historicalData.consulta || expediente.consulta,
                           antecedentes: historicalData.antecedentes || expediente.antecedentes,
                           resumen: historicalData.resumen || expediente.resumen,
                           meta: historicalData.meta || expediente.meta,
                           px_info: { ...expediente.px_info, ...(historicalData.px_info || {}) },
                           fechaConsulta: fechaHist ? fechaHist.toISOString() : null
                         };
                         handlePrintReceta();
                       }}
                    />
                  </div>
                )}
            </div>
          </div>
        </main>
      </div>


      
      {/* --- OTROS MODALES --- */}
      {showHistoriaModal && (
        <HistoriaClinicaModal
          onClose={() => setShowHistoriaModal(false)}
          onBackToMenu={() => {
            setShowHistoriaModal(false);
            setShowActionsMenu(true);
          }}
          paciente={{...pacienteData, nombre: pacienteNombre}}
          historial={historialCompleto}
          doctor={user}
          expedienteActual={expediente}
          pacienteId={pacienteId}
          onDocumentGenerated={registrarEventoDocumental}
        />
      )}
      {showEstudioModal && (
        <EstudioPrevioModal
          onClose={() => setShowEstudioModal(false)}
          onBackToMenu={() => {
            setShowEstudioModal(false);
            setShowActionsMenu(true);
          }}
          pacienteNombre={pacienteNombre}
          pacienteId={pacienteId}
          doctorId={user.uid}
        />
      )}
      {showHistoricoEstudios && (
        <HistoricoEstudiosModal
          onClose={() => setShowHistoricoEstudios(false)}
          onBackToMenu={() => {
            setShowHistoricoEstudios(false);
            setShowActionsMenu(true);
          }}
          pacienteId={pacienteId}
          pacienteNombre={pacienteNombre}
        />
      )}
      {showEmbarazoModal && (
        <ControlEmbarazoModal
          onClose={() => setShowEmbarazoModal(false)}
          onBackToMenu={() => {
            setShowEmbarazoModal(false);
            setShowActionsMenu(true);
          }}
          data={expediente.control_embarazo}
          updateCampo={updateCampo}
        />
      )}
      {showHistoricoEmbarazos && (
        <HistoricoEmbarazosModal
          onClose={() => setShowHistoricoEmbarazos(false)}
          onBackToMenu={() => {
            setShowHistoricoEmbarazos(false);
            setShowActionsMenu(true);
          }}
          pacienteId={pacienteId}
          pacienteNombre={pacienteNombre}
        />
      )}
      {showNegatoscopio && (
        <NegatoscopioModal
          onClose={() => setShowNegatoscopio(false)}
        />
      )}
      {showCalculadoraDosis && (
        <CalculadoraDosisModal
          onClose={() => setShowCalculadoraDosis(false)}
          onBackToMenu={() => {
            setShowCalculadoraDosis(false);
            setShowActionsMenu(true);
          }}
          pacienteNombre={pacienteNombre}
          pacienteData={{
            ...pacienteData,
            edad: expediente?.px_info?.edad || pacienteData?.edad || '',
            fecha_nacimiento: expediente?.px_info?.fecha_nacimiento || pacienteData?.fecha_nacimiento || pacienteData?.fechaNacimiento || '',
            sexo: expediente?.px_info?.sexo || pacienteData?.sexo || '',
            peso: expediente?.consulta?.exploracion?.antropometria?.peso || pacienteData?.peso || pacienteData?.pesoKg || '',
            talla: expediente?.consulta?.exploracion?.antropometria?.talla || pacienteData?.talla || pacienteData?.estatura || '',
            imc: expediente?.consulta?.exploracion?.antropometria?.imc || pacienteData?.imc || '',
          }}
        />
      )}

      {/* --- MENU ACCIONES --- */}
      {showActionsMenu && (
        <div className="fixed inset-0 z-[170] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-5xl h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
             <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-sm">
                <div>
                   <h3 className="exp-sora text-3xl font-black tracking-tighter" style={{color: 'var(--slate-900)'}}>Acciones del Expediente</h3>
                   <p className="font-medium mt-1" style={{color: 'var(--slate-500)'}}>Selecciona una herramienta para el paciente <span className="font-bold" style={{color: 'var(--blue-600)'}}>{pacienteNombre}</span></p>
                </div>
                <button onClick={() => setShowActionsMenu(false)} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={24}/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 exp-scroll">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                   <ActionCard title="Ver Historia Clínica" subtitle="Línea de tiempo" icon={<ClipboardList size={32}/>} color="bg-blue-500" onClick={handleVerHistoria} />
                   <ActionCard
                     title="Historico legado"
                     subtitle="Migrado de MedicalManik"
                     icon={<History size={32} />}
                     color="bg-indigo-500"
                     onClick={() => {
                       setShowLegacyHistory(true);
                       setShowActionsMenu(false);
                     }}
                   />
                   <ActionCard title="Plantillas" subtitle="Documentos de administracion" icon={<FileText size={32}/>} color="bg-orange-500" onClick={() => { setShowFormatSelector(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Agregar Estudio" subtitle="Subir resultado externo" icon={<PlusSquare size={32}/>} color="bg-teal-500" onClick={() => { setShowEstudioModal(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Historial Estudios" subtitle="Ver laboratorio previo" icon={<HistoryIcon size={32}/>} color="bg-blue-600" onClick={() => { setShowHistoricoEstudios(true); setShowActionsMenu(false); }} />
                   {pacienteData?.sexo === 'Femenino' && <ActionCard title="Histórico Embarazos" subtitle="Control prenatal" icon={<Baby size={32}/>} color="bg-rose-500" onClick={() => { setShowHistoricoEmbarazos(true); setShowActionsMenu(false); }} />}
                   <ActionCard title="Negatoscopio" subtitle="Visor de imágenes médicas" icon={<Monitor size={32}/>} color="bg-slate-700" onClick={() => { setShowNegatoscopio(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Calculadora de Dosis" subtitle="Dosis por peso y dilución" icon={<Calculator size={32}/>} color="bg-emerald-600" onClick={() => { setShowCalculadoraDosis(true); setShowActionsMenu(false); }} />
                </div>
             </div>
          </div>
        </div>
      )}

      {showLegacyHistory && (
        <LegacyHistoryModal
          onClose={() => setShowLegacyHistory(false)}
          onBackToMenu={() => {
            setShowLegacyHistory(false);
            setShowActionsMenu(true);
          }}
          pacienteNombre={pacienteNombre}
          links={legacyLinks}
          loading={loadingLegacyLinks}
        />
      )}

      {/* --- SELECTOR FORMATOS --- */}
      {showFormatSelector && (
        <div className="fixed inset-0 z-[180] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-5xl h-[75vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                 <h3 className="exp-sora text-3xl font-black tracking-tighter" style={{color: 'var(--slate-900)'}}>Plantillas Disponibles</h3>
                 <p className="font-medium mt-1" style={{color: 'var(--slate-500)'}}>Documentos configurados por administración</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (isEnfermeriaDocumentMode) {
                      setShowFormatSelector(false);
                      goBackOr(navigate, exitFallbackPath);
                      return;
                    }
                    setShowFormatSelector(false);
                    setShowActionsMenu(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 text-xs font-bold uppercase tracking-wide transition-all"
                  style={{ fontFamily: 'Sora, sans-serif' }}
                >
                  Regresar al menu
                </button>
                <button
                  onClick={() => {
                    if (isEnfermeriaDocumentMode) {
                      setShowFormatSelector(false);
                      goBackOr(navigate, exitFallbackPath);
                      return;
                    }
                    setShowFormatSelector(false);
                  }}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"
                >
                  <X size={24}/>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 exp-scroll">
              {plantillasDinamicas.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {plantillasDinamicas.map((tpl) => (
                    <FormatCard
                      key={tpl.id}
                      label={`${tpl.nombre}${(tpl.tipoDocumento || 'general') === 'receta' ? ' • receta' : ''}`}
                      icon={<FileText size={28} />}
                      onClick={() => {
                        setPlantillaActiva(tpl);
                        setShowFormatSelector(false);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-full min-h-[220px] flex items-center justify-center text-sm text-slate-500 font-semibold">
                  No hay plantillas publicadas por administración.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecipeTemplateSelector && (
        <div className="fixed inset-0 z-[185] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl h-[68vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="exp-sora text-2xl font-black tracking-tight" style={{color: 'var(--slate-900)'}}>Plantilla de Receta</h3>
                <p className="font-medium mt-1 text-sm" style={{color: 'var(--slate-500)'}}>Elige una plantilla para imprimir la receta de este paciente.</p>
              </div>
              <button onClick={() => { pendingExitAfterRecipePrintRef.current = false; expedienteParaRecetaRef.current = null; setShowRecipeTemplateSelector(false); }} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={22}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 exp-scroll">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plantillasReceta.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setPlantillaRecetaPreferidaId(tpl.id);
                      setPlantillaActiva(tpl);
                      setShowRecipeTemplateSelector(false);
                    }}
                    className={`text-left rounded-xl border p-4 transition-all ${plantillaRecetaPreferidaId === tpl.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30'}`}
                  >
                    <p className="text-sm font-black text-slate-800 uppercase tracking-wide">{tpl.nombre}</p>
                    <p className="text-xs text-slate-500 mt-1">{tpl.descripcionNatural || 'Plantilla de receta medica.'}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-end bg-white">
              <button
                onClick={() => { pendingExitAfterRecipePrintRef.current = false; expedienteParaRecetaRef.current = null; setShowRecipeTemplateSelector(false); }}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-wide"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {plantillaActiva && (
        <PlantillaDinamicaModal
          plantilla={plantillaActiva}
          resolverTexto={resolverTextoPlantilla}
          resolverCampo={resolverValorCampoPlantilla}
          onNotify={showToast}
          onDocumentGenerated={registrarEventoDocumental}
          onClose={() => {
            pendingExitAfterRecipePrintRef.current = false;
            expedienteParaRecetaRef.current = null;
            setPlantillaActiva(null);
            if (isEnfermeriaDocumentMode) {
              setShowFormatSelector(true);
            }
          }}
          onBackToMenu={() => {
            pendingExitAfterRecipePrintRef.current = false;
            expedienteParaRecetaRef.current = null;
            setPlantillaActiva(null);
            setShowFormatSelector(true);
          }}
          pacienteId={pacienteId}
        />
      )}

      {/* --- MODAL DE ADVERTENCIA DE IMPRESIÓN --- */}
      {showExitAlert && (
        <div className="fixed inset-0 z-[205] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="bg-rose-100 text-rose-600 p-3 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Hay cambios sin guardar</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Salir descartará esta información. Si quieres conservarla, usa Finalizar para guardar la consulta antes de cerrar esta pantalla.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/70 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Cambios detectados</p>
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                {exitChangeList.map((change, index) => (
                  <div key={`${change}_${index}`} className="flex items-start gap-2 text-sm text-slate-700">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
                    <span>{change}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                onClick={() => setShowExitAlert(false)}
                className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowExitAlert(false);
                  handleGuardar();
                }}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 shadow-lg transition-all disabled:opacity-50"
              >
                Finalizar
              </button>
              <button
                onClick={restoreEntryStateAndExit}
                disabled={discardingExit || loading}
                className="px-5 py-2 bg-rose-600 text-white font-bold text-sm rounded-lg hover:bg-rose-700 shadow-lg transition-all disabled:opacity-50"
              >
                {discardingExit ? 'Saliendo...' : 'Salir sin guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrintAlert && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 text-amber-600 p-3 rounded-full">
                <Printer size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Confirmacion Requerida</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  {isHistoricalReviewMode
                    ? 'Detectamos una receta, estudios o procedimientos en esta consulta histórica. Si guardas ahora, se actualizará este registro y no se contará como una nueva visita.'
                    : 'Detectamos una receta, estudios o procedimientos en esta consulta. Si finalizas ahora, se guardara y saldras de esta pantalla.'}
                </p>
                <p className="text-sm font-bold text-slate-800 mt-2">
                  {isHistoricalReviewMode
                    ? '¿Ya imprimiste el documento que necesitabas de esta consulta?'
                    : '¿Ya imprimiste el documento para el paciente?'}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowPrintAlert(false)}
                className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg transition-colors"
              >
                No, cancelar
              </button>
              <button 
                onClick={executeSave}
                className="px-6 py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 shadow-lg transition-all"
              >
                {isHistoricalReviewMode ? 'Si, guardar consulta' : 'Si, finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InlineHtmlEditor = ({ value, onCommit, className = '' }) => {
  const editorRef = useRef(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current || isFocusedRef.current) return;
    const nextValue = String(value || '');
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={(event) => {
        isFocusedRef.current = false;
        onCommit?.(event.currentTarget.innerHTML);
      }}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 overflow-auto break-words [&_table]:w-full [&_table]:border-collapse [&_table_td]:border [&_table_td]:border-slate-300 [&_table_td]:px-2 [&_table_td]:py-1 [&_table_td]:text-xs [&_table_th]:border [&_table_th]:border-slate-300 [&_table_th]:px-2 [&_table_th]:py-1 [&_table_th]:text-xs [&_table_th]:font-bold [&_table_th]:bg-slate-50 ${className}`}
    />
  );
};

const PlantillaDinamicaModal = ({ plantilla, resolverTexto, resolverCampo, onClose, onBackToMenu, onNotify, onDocumentGenerated, pacienteId }) => {
  const schema = plantilla?.schema || {};
  const bloques = schema?.bloques || [];
  const campos = schema?.campos || [];
  const elementos = schema?.elements || [];
  const documentHtml = schema?.documentHtml || '';
  const page = schema?.page || { width: 816, height: 1056 };
  const printPageRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const editMenuRef = useRef(null);
  const isSigningRef = useRef(false);
  const lastPointRef = useRef(null);
  const recipePageOverridesRef = useRef(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [showContentEditor, setShowContentEditor] = useState(false);
  const [contentEditorUnified, setContentEditorUnified] = useState(true);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [fieldOverrides, setFieldOverrides] = useState({});
  const [contentOverrides, setContentOverrides] = useState({});
  const docMargins = { top: 0, right: 0, bottom: 0, left: 0 };
  const docBaseFontPt = 12;
  const documentFontFamily = schema?.documentFontFamily || 'Trebuchet MS';
  const documentLineHeight = Number(schema?.documentLineHeight || 1.45);
  const normalizedDocumentHtml = String(documentHtml || '').replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi, (_, num) => `font-size:${num}pt`);
  const isRecipeTemplate = (plantilla?.tipoDocumento || 'general') === 'receta';
  const getElementRenderZ = (el) => {
    if (el?.type === 'image' && el?.isWatermark) return 0;
    return Number(el?.zIndex || 1) + 10;
  };
  const orderedElementos = [...elementos].sort((a, b) => Number(getElementRenderZ(a)) - Number(getElementRenderZ(b)));

  const detectedFieldKeys = useMemo(() => {
    const keySet = new Set();
    const collectFromText = (text = '') => {
      const regex = /\{\{\s*([^}]+)\s*\}\}/g;
      let match;
      while ((match = regex.exec(String(text))) !== null) {
        const key = String(match[1] || '').trim();
        if (key) keySet.add(key);
      }
    };

    collectFromText(documentHtml || '');
    (elementos || []).forEach((el) => {
      if (el?.type === 'field') {
        const bind = String(el?.bind || el?.id || '').trim();
        if (bind) keySet.add(bind);
        return;
      }
      collectFromText(el?.contentHtml || el?.content || '');
    });
    (bloques || []).forEach((bloque) => {
      collectFromText(bloque?.contenidoHtml || bloque?.contenido || '');
    });

    return Array.from(keySet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [bloques, documentHtml, elementos]);

  const normalizeTemplateFieldKey = (raw = '') => String(raw || '').replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim();
  const hasOverrideKey = (source = {}, key = '') => Object.prototype.hasOwnProperty.call(source, String(key || '').trim());
  const normalizeComparableHtml = (value = '') => String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<div><br><\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '<br/>')
    .replace(/>\s+</g, '><')
    .trim();

  const hasManualEdits = useMemo(
    () => Object.keys(fieldOverrides).length > 0 || Object.keys(contentOverrides).length > 0,
    [contentOverrides, fieldOverrides]
  );

  const updateFieldOverride = (fieldKey = '', value = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    if (!key) return;
    const normalizedValue = String(value ?? '');
    const baseValue = String(resolverCampo(key) || '');
    setFieldOverrides((prev) => {
      const next = { ...prev };
      if (normalizedValue === baseValue) {
        delete next[key];
      } else {
        next[key] = normalizedValue;
      }
      return next;
    });
  };

  const updateContentOverride = (sectionKey = '', value = '', baseValue = '') => {
    const key = String(sectionKey || '').trim();
    if (!key) return;
    const normalizedValue = String(value || '');
    setContentOverrides((prev) => {
      const next = { ...prev };
      if (normalizeComparableHtml(normalizedValue) === normalizeComparableHtml(baseValue)) {
        delete next[key];
      } else {
        next[key] = normalizedValue;
      }
      return next;
    });
  };

  const UNIFIED_SEPARATOR = '<!-- __section_break__ -->';
  const UNIFIED_SEPARATOR_VISIBLE = '<hr data-section-break="true" style="border:none;border-top:2px dashed #cbd5e1;margin:12px 0;" />';

  const buildUnifiedHtml = (sections) => {
    return sections.map((s) => {
      const html = getContentHtml(s.key, s.baseHtml);
      return `<div data-section-key="${s.key}">${html}</div>`;
    }).join(UNIFIED_SEPARATOR_VISIBLE);
  };

  const commitUnifiedHtml = (fullHtml, sections) => {
    const parts = fullHtml.split(/<hr[^>]*data-section-break[^>]*\/?>/gi);
    const keyExtract = /<div[^>]*data-section-key="([^"]*)"[^>]*>([\s\S]*?)<\/div>$/i;
    sections.forEach((section, idx) => {
      if (idx < parts.length) {
        let partHtml = parts[idx].trim();
        const match = keyExtract.exec(partHtml);
        if (match) {
          partHtml = match[2];
        } else {
          partHtml = partHtml.replace(/<div[^>]*data-section-key[^>]*>/gi, '').replace(/<\/div>\s*$/i, '');
        }
        updateContentOverride(section.key, partHtml, section.baseHtml);
      }
    });
  };

  const resolveCampoEditable = (fieldKey = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    if (!key) return '';
    const pageOv = recipePageOverridesRef.current;
    if (pageOv && Object.prototype.hasOwnProperty.call(pageOv, key)) {
      return String(pageOv[key] ?? '');
    }
    if (hasOverrideKey(fieldOverrides, key)) {
      return String(fieldOverrides[key] ?? '');
    }
    return resolverCampo(key) || '';
  };

  const shouldHideFieldLabel = (fieldKey = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    return key === 'fecha.hoy'
      || key === 'fecha.hoy_larga'
      || key === 'fecha.larga'
      || key === 'fechaexpedida'
      || key === 'fecha.expedida';
  };

  const isGuardedAddressField = (fieldKey = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    return key === 'sucursal.direccion'
      || key === 'sucursal.ubicacion'
      || key === 'sucursal.domicilio'
      || key === 'consultorio.direccion'
      || key === 'consultorio.ubicacion'
      || key === 'consultorio.domicilio';
  };

  const addAddressSoftWrapHints = (value = '') => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([,;\/-])/g, '$1\u200B');

  const getAddressGuardStyle = (fieldKey = '', { fontSize = 12, lineHeight = 1.35, boxHeight = 20 } = {}) => {
    if (!isRecipeTemplate || !isGuardedAddressField(fieldKey)) return null;

    const compactFont = Math.min(Number(fontSize || 12), 9);
    const compactLineHeight = Math.min(Number(lineHeight || 1.35), 1.15);
    const estimatedLines = Math.max(
      2,
      Math.min(
        4,
        Math.floor(Number(boxHeight || 20) / Math.max(1, compactFont * compactLineHeight))
      )
    );

    return {
      fontSize: compactFont,
      lineHeight: compactLineHeight,
      overflow: 'hidden',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      whiteSpace: 'normal',
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: estimatedLines,
      textOverflow: 'ellipsis'
    };
  };

  const buildFieldDisplayText = (fieldKey = '', label = '', value = '') => {
    const safeValue = String(value || '');
    const normalizedValue = isRecipeTemplate && isGuardedAddressField(fieldKey)
      ? addAddressSoftWrapHints(safeValue)
      : safeValue;
    if (shouldHideFieldLabel(fieldKey)) return safeValue;
    return `${label ? `${label}: ` : ''}${normalizedValue}`;
  };

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const toPlainTextHtml = (value = '') => escapeHtml(String(value || '')).replace(/\n/g, '<br/>');

  const getContentHtml = (sectionKey = '', baseHtml = '') => {
    if (hasOverrideKey(contentOverrides, sectionKey)) {
      return String(contentOverrides[sectionKey] ?? '');
    }
    return String(baseHtml || '');
  };

  const resolveTemplateWithSignature = (raw = '', { allowHtml = false } = {}) => {
    return String(raw).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, keyRaw) => {
      const key = normalizeTemplateFieldKey(keyRaw);

      if (key === 'firma.medico') {
        if (!signatureDataUrl) return '';
        if (!allowHtml) return '[Firma digital capturada]';
        return `<img src="${signatureDataUrl}" alt="Firma del medico" style="max-width:220px;height:80px;object-fit:contain;display:block;"/>`;
      }

      if (key === 'firma.linea') {
        const nombreMedico = resolveCampoEditable('medico.nombre') || 'Firma del medico';
        if (!allowHtml) return '____________________________';
        return `<div style="margin:20px auto 0 auto;width:320px;max-width:100%;border-top:2px solid #334155;padding-top:8px;text-align:center;font-weight:700;">${escapeHtml(nombreMedico)}</div>`;
      }

      if (key === 'consulta.tratamiento_html') {
        if (!allowHtml) return resolveCampoEditable('consulta.tratamiento_texto') || '';
        if (hasOverrideKey(fieldOverrides, 'consulta.tratamiento_html')) {
          return String(fieldOverrides['consulta.tratamiento_html'] || '');
        }
        const tratamientoHtml = resolveCampoEditable('consulta.tratamiento_html') || '';
        return tratamientoHtml;
      }

      const value = resolveCampoEditable(key) || '';
      const normalizedValue = isRecipeTemplate && isGuardedAddressField(key)
        ? addAddressSoftWrapHints(value)
        : value;

      if (!allowHtml) return normalizedValue;

      if (isRecipeTemplate && isGuardedAddressField(key)) {
        const safeAddress = escapeHtml(normalizedValue).replace(/\n/g, '<br/>');
        return `<span style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;word-break:break-word;overflow-wrap:anywhere;line-height:1.15;max-width:100%;font-size:0.92em;">${safeAddress}</span>`;
      }

      return escapeHtml(normalizedValue).replace(/\n/g, '<br/>');
    });
  };

  const buildElementResolvedHtml = (elemento = {}) => {
    const isField = elemento.type === 'field';
    const bindKey = elemento.bind || elemento.id;
    if (isField && bindKey === 'firma.medico') return null;
    if (isField && bindKey === 'firma.linea') return null;
    if (isField) {
      const value = resolveCampoEditable(bindKey);
      return toPlainTextHtml(buildFieldDisplayText(bindKey, elemento.label, value));
    }
    return resolveTemplateWithSignature(elemento.contentHtml || elemento.content || '', { allowHtml: true });
  };

  const buildCampoResolvedHtml = (campo = {}) => {
    const bindKey = campo.bind || campo.id;
    const value = resolveCampoEditable(bindKey);
    return toPlainTextHtml(buildFieldDisplayText(bindKey, campo.label, value));
  };

  const buildBloqueResolvedHtml = (bloque = {}) => {
    if (bloque.contenidoHtml) {
      return resolveTemplateWithSignature(bloque.contenidoHtml, { allowHtml: true });
    }
    return toPlainTextHtml(resolveTemplateWithSignature(bloque.contenido || '', { allowHtml: false }));
  };

  const editableContentSections = useMemo(() => {
    const sections = [];

    if (documentHtml) {
      sections.push({
        key: 'documentHtml',
        label: 'Documento completo',
        helper: 'Edita el cuerpo principal manteniendo el formato visible.',
        baseHtml: resolveTemplateWithSignature(normalizedDocumentHtml, { allowHtml: true })
      });
    }

    orderedElementos.forEach((elemento, index) => {
      if (elemento.type === 'image' || elemento.type === 'shape') return;
      const bindKey = elemento.bind || elemento.id;
      if (bindKey === 'firma.medico' || bindKey === 'firma.linea') return;
      const baseHtml = buildElementResolvedHtml(elemento);
      if (baseHtml === null) return;

      sections.push({
        key: `element:${elemento.id}`,
        label: elemento.type === 'field'
          ? (elemento.label || bindKey || `Campo ${index + 1}`)
          : `Texto ${index + 1}`,
        helper: elemento.type === 'field'
          ? 'Sobrescribe el texto final de este campo tal como se imprimira.'
          : 'Edita este bloque de texto libre ya resuelto.',
        baseHtml
      });
    });

    if (!documentHtml) {
      campos.filter((campo) => campo.mostrar !== false).forEach((campo, index) => {
        sections.push({
          key: `campo:${campo.id}`,
          label: campo.label || `Campo legacy ${index + 1}`,
          helper: 'Sobrescribe el valor final de este campo.',
          baseHtml: buildCampoResolvedHtml(campo)
        });
      });

      bloques.forEach((bloque, index) => {
        sections.push({
          key: `bloque:${bloque.id}`,
          label: `Bloque ${index + 1}`,
          helper: 'Edita este bloque legacy con el texto ya resuelto.',
          baseHtml: buildBloqueResolvedHtml(bloque)
        });
      });
    }

    return sections;
  }, [bloques, campos, documentHtml, normalizedDocumentHtml, orderedElementos, fieldOverrides, signatureDataUrl]);

  const getCanvasPoint = (evt) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    const touch = evt.touches?.[0] || evt.changedTouches?.[0];
    const clientX = touch ? touch.clientX : evt.clientX;
    const clientY = touch ? touch.clientY : evt.clientY;
    if (clientX === undefined || clientY === undefined) return null;

    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height
    };
  };

  const drawStroke = (from, to) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !from || !to) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const startSignature = (evt) => {
    evt.preventDefault();
    const point = getCanvasPoint(evt);
    if (!point) return;
    isSigningRef.current = true;
    lastPointRef.current = point;
  };

  const moveSignature = (evt) => {
    if (!isSigningRef.current) return;
    evt.preventDefault();
    const point = getCanvasPoint(evt);
    if (!point || !lastPointRef.current) return;
    drawStroke(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const endSignature = (evt) => {
    evt?.preventDefault?.();
    isSigningRef.current = false;
    lastPointRef.current = null;
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const persistSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    setSignatureDataUrl(data);
    setShowSignatureModal(false);
    onNotify?.('Firma digital capturada.', 'success');
  };

  useEffect(() => {
    if (!showSignatureModal) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = signatureDataUrl;
    }
  }, [showSignatureModal, signatureDataUrl]);

  const LETTER_WIDTH = 816;
  const LETTER_HEIGHT = 1056;
  const HALF_LETTER_HEIGHT = LETTER_HEIGHT / 2;
  const pageWidth = Number(page?.width || 816);
  const pageHeight = Number(page?.height || 1056);
  const looksLegacyPt = Math.abs(pageWidth - 595) <= 2 && Math.abs(pageHeight - 842) <= 2;
  const legacyToCssScale = looksLegacyPt ? (96 / 72) : 1;
  const convertedWidth = pageWidth * legacyToCssScale;
  const convertedHeight = pageHeight * legacyToCssScale;
  const fitToLetterScale = Math.min(1, LETTER_WIDTH / convertedWidth, LETTER_HEIGHT / convertedHeight);
  const printScale = legacyToCssScale * fitToLetterScale;
  const printWidth = Math.round(pageWidth * printScale);
  const printHeight = Math.round(pageHeight * printScale);
  const recipeFitToHalfScale = Math.min(1, LETTER_WIDTH / convertedWidth, HALF_LETTER_HEIGHT / convertedHeight);
  const recipeCopyScale = legacyToCssScale * recipeFitToHalfScale;
  const finalPrintWidth = isRecipeTemplate ? LETTER_WIDTH : printWidth;
  const finalPrintHeight = isRecipeTemplate ? LETTER_HEIGHT : printHeight;
  const activeEditorMode = showFieldEditor ? 'info' : showContentEditor ? 'document' : null;
  const activeEditorLabel = activeEditorMode === 'info'
    ? 'Informacion'
    : activeEditorMode === 'document'
      ? 'Documento'
      : 'Editar';
  const computeDocResolvedHtml = () => getContentHtml(
    'documentHtml',
    resolveTemplateWithSignature(normalizedDocumentHtml, { allowHtml: true })
  );
  const documentResolvedHtml = computeDocResolvedHtml();

  // --- Paginación de contenido de receta ---
  const splitRecipeTextIntoItems = (text) => {
    if (!text || !text.trim()) return [];
    const lines = text.split('\n');
    const items = [];
    let current = [];
    for (const line of lines) {
      const t = line.trimStart();
      const isStart = /^\d+\.\s/.test(t) || /^(Paquetes|Notas):\s/i.test(t);
      if (isStart && current.length > 0) {
        items.push(current.join('\n'));
        current = [line];
      } else if (line.trim()) {
        current.push(line);
      }
    }
    if (current.length > 0) items.push(current.join('\n'));
    return items;
  };

  const recipeContentPages = useMemo(() => {
    if (!isRecipeTemplate) return [null];

    const fullContent = resolverCampo('consulta.receta_contenido') || '';
    const medsText = resolverCampo('consulta.medicamentos_texto') || '';
    const estText = resolverCampo('consulta.estudios_texto') || '';
    const procText = resolverCampo('consulta.procedimientos_texto') || '';
    const tratText = resolverCampo('consulta.tratamiento_texto') || '';

    const tag = (items, src) => items.map(t => ({ text: t, src, lines: t.split('\n').length }));
    const medsItems = tag(splitRecipeTextIntoItems(medsText), 'meds');
    const estItems = tag(splitRecipeTextIntoItems(estText), 'est');
    const procItems = tag(splitRecipeTextIntoItems(procText), 'proc');
    const tratItems = splitRecipeTextIntoItems(tratText);

    const allItems = [...medsItems, ...estItems, ...procItems];
    const totalLines = allItems.reduce((s, i) => s + i.lines, 0);
    const MAX_LINES = 16;

    if (totalLines <= MAX_LINES || allItems.length === 0) return [null];

    const pages = [];
    let page = [];
    let used = 0;
    for (const item of allItems) {
      if (used + item.lines > MAX_LINES && page.length > 0) {
        pages.push(page);
        page = [];
        used = 0;
      }
      page.push(item);
      used += item.lines;
    }
    if (page.length > 0) pages.push(page);

    return pages.map(pageItems => {
      const pm = pageItems.filter(i => i.src === 'meds');
      const pe = pageItems.filter(i => i.src === 'est');
      const pp = pageItems.filter(i => i.src === 'proc');
      const medIndices = pm.map(m => medsItems.indexOf(m));
      const pageTrat = medIndices.map(idx => tratItems[idx]).filter(Boolean).join('\n');

      // Build combined receta_contenido for this page
      const seccionesPage = [];
      const medsPage = pm.map(i => i.text).join('\n');
      const estPage = pe.map(i => i.text).join('\n');
      const procPage = pp.map(i => i.text).join('\n');
      if (medsPage) seccionesPage.push(medsPage);
      if (estPage) { seccionesPage.push(''); seccionesPage.push(estPage); }
      if (procPage) { seccionesPage.push(''); seccionesPage.push(procPage); }

      return {
        'consulta.medicamentos_texto': medsPage,
        'consulta.estudios_texto': estPage,
        'consulta.procedimientos_texto': procPage,
        'consulta.tratamiento_texto': pageTrat,
        'consulta.receta_contenido': seccionesPage.join('\n'),
      };
    });
  }, [isRecipeTemplate, resolverCampo]);

  const openEditorMode = (mode) => {
    setShowEditMenu(false);
    setShowFieldEditor(mode === 'info');
    setShowContentEditor(mode === 'document');
  };

  const closeEditorMode = () => {
    setShowEditMenu(false);
    setShowFieldEditor(false);
    setShowContentEditor(false);
  };

  useEffect(() => {
    if (!showEditMenu) return undefined;

    const handleClickOutside = (event) => {
      if (!editMenuRef.current?.contains(event.target)) {
        setShowEditMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEditMenu]);

  const renderTemplateCanvasContent = () => {
    // Compute document HTML lazily so recipe‐page overrides (via ref) are picked up
    const resolvedDocHtml = documentHtml
      ? computeDocResolvedHtml()
      : '';

    return (
    <>
      {documentHtml ? (
        <div
          className="absolute inset-0 text-slate-800"
          style={{
            paddingTop: docMargins.top,
            paddingRight: docMargins.right,
            paddingBottom: docMargins.bottom,
            paddingLeft: docMargins.left,
            fontSize: `${docBaseFontPt}pt`,
            lineHeight: documentLineHeight,
            fontFamily: documentFontFamily,
            overflow: 'visible',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            zIndex: 10
          }}
          dangerouslySetInnerHTML={{ __html: resolvedDocHtml }}
        />
      ) : null}

      {orderedElementos.length > 0 ? (
        orderedElementos.map((elemento) => {
          const isField = elemento.type === 'field';
          const bindKey = isField ? (elemento.bind || elemento.id || '') : '';
          const isImage = elemento.type === 'image';
          const isShape = elemento.type === 'shape';
          const isShapeOrImg = isImage || isShape;
          const isSignatureField = isField && (elemento.bind || elemento.id) === 'firma.medico';
          const isSignatureLineField = isField && (elemento.bind || elemento.id) === 'firma.linea';
          const shapeKind = elemento.shapeKind || 'line';
          const shapeStrokeWidth = Number(elemento.strokeWidth || 1);
          const shapeOpacity = Number(elemento.opacity ?? 1);
          const addressGuardStyle = isField
            ? getAddressGuardStyle(bindKey, {
                fontSize: Number(elemento.fontSize || 12),
                lineHeight: Number(elemento.lineHeight || 1.35),
                boxHeight: Number(elemento.h || 20)
              })
            : null;
          const texto = getContentHtml(`element:${elemento.id}`, buildElementResolvedHtml(elemento));

          return (
            <div
              key={elemento.id}
              className="absolute whitespace-pre-wrap leading-relaxed text-slate-800"
              style={{
                left: isSignatureLineField ? '50%' : Number(elemento.x || 0),
                top: Number(elemento.y || 0),
                width: isSignatureLineField ? 320 : Number(elemento.w || 80),
                height: isShapeOrImg ? Number(elemento.h || 20) : undefined,
                minHeight: isShapeOrImg ? undefined : Number(elemento.h || 20),
                fontSize: addressGuardStyle?.fontSize ?? Number(elemento.fontSize || 12),
                fontFamily: elemento.fontFamily || 'Trebuchet MS',
                lineHeight: addressGuardStyle?.lineHeight ?? Number(elemento.lineHeight || 1.35),
                fontWeight: elemento.bold ? 700 : 500,
                textAlign: elemento.align || 'left',
                overflow: addressGuardStyle?.overflow ?? 'visible',
                wordBreak: addressGuardStyle?.wordBreak ?? (isShape ? 'normal' : 'break-word'),
                overflowWrap: addressGuardStyle?.overflowWrap ?? (isShape ? 'normal' : 'anywhere'),
                whiteSpace: addressGuardStyle?.whiteSpace,
                display: addressGuardStyle?.display,
                WebkitBoxOrient: addressGuardStyle?.WebkitBoxOrient,
                WebkitLineClamp: addressGuardStyle?.WebkitLineClamp,
                textOverflow: addressGuardStyle?.textOverflow,
                transform: isSignatureLineField ? 'translateX(-50%)' : undefined,
                zIndex: getElementRenderZ(elemento),
                opacity: Number(elemento.opacity ?? 1)
              }}
            >
              {isImage
                ? (elemento.src ? <img src={elemento.src} alt="" className="w-full h-full" style={{ objectFit: elemento.objectFit || 'contain', opacity: Number(elemento.opacity ?? 1) }} /> : null)
                : isShape
                  ? (
                    shapeKind === 'arrow'
                      ? (
                        <svg width={Number(elemento.w || 200)} height={Math.max(Number(elemento.h || 20), 20)} style={{ display: 'block', overflow: 'visible' }}>
                          <defs>
                            <marker id={`shape_arrow_${elemento.id}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                              <polygon points="0 0, 8 3, 0 6" fill="#000000" opacity={shapeOpacity} />
                            </marker>
                          </defs>
                          <line x1={shapeStrokeWidth} y1={Math.max(Number(elemento.h || 20), 20) / 2} x2={Number(elemento.w || 200) - 8} y2={Math.max(Number(elemento.h || 20), 20) / 2} stroke="#000000" strokeWidth={shapeStrokeWidth} markerEnd={`url(#shape_arrow_${elemento.id})`} opacity={shapeOpacity} />
                        </svg>
                      )
                      : (shapeKind === 'line-vertical' || shapeKind === 'line-vertical-dashed')
                        ? (
                          <div className="w-full h-full flex justify-center">
                            <div style={{ width: shapeStrokeWidth, height: '100%', borderLeft: `${shapeStrokeWidth}px ${shapeKind === 'line-vertical-dashed' ? 'dashed' : 'solid'} #000000`, opacity: shapeOpacity }} />
                          </div>
                        )
                        : (
                          <div
                            className="w-full h-full"
                            style={{
                              borderTop: shapeKind === 'line' || shapeKind === 'line-dashed' ? `${shapeStrokeWidth}px ${shapeKind === 'line-dashed' ? 'dashed' : 'solid'} #000000` : 'none',
                              border: shapeKind === 'rect' || shapeKind === 'circle' ? `${shapeStrokeWidth}px solid #000000` : undefined,
                              backgroundColor: 'transparent',
                              borderRadius: shapeKind === 'circle' ? '999px' : Number(elemento.radius || 0),
                              opacity: shapeOpacity
                            }}
                          />
                        )
                  )
                : (isField
                  ? (isSignatureField
                    ? (signatureDataUrl
                      ? <img src={signatureDataUrl} alt="Firma del medico" className="h-20 w-auto max-w-[220px] object-contain" />
                      : <span className="italic text-slate-400">Firma pendiente</span>)
                    : (isSignatureLineField
                      ? <div className="mt-5 w-[320px] max-w-full border-t-2 border-slate-700 pt-2 text-center font-bold text-slate-800 mx-auto">{resolveCampoEditable('medico.nombre') || 'Firma del medico'}</div>
                      : <div dangerouslySetInnerHTML={{ __html: texto || '&nbsp;' }} />))
                  : <div dangerouslySetInnerHTML={{ __html: texto }} />)
              }
            </div>
          );
        })
      ) : !documentHtml ? (
        <>
          {campos.filter((campo) => campo.mostrar !== false).map((campo) => {
            const bindKey = campo.bind || campo.id;
            const addressGuardStyle = getAddressGuardStyle(bindKey, {
              fontSize: Number(campo.fontSize || 12),
              lineHeight: 1.35,
              boxHeight: Number(campo.h || 20)
            });

            return (
              <div
                key={`campo_${campo.id}`}
                className="absolute text-slate-800 whitespace-pre-wrap"
                style={{
                  left: Number(campo.x || 40),
                  top: Number(campo.y || 80),
                  width: Number(campo.w || 510),
                  minHeight: Number(campo.h || 20),
                  fontSize: addressGuardStyle?.fontSize ?? Number(campo.fontSize || 12),
                  fontWeight: campo.negrita ? 700 : 500,
                  lineHeight: addressGuardStyle?.lineHeight ?? 1.35,
                  textAlign: campo.align || 'left',
                  overflow: addressGuardStyle?.overflow ?? 'visible',
                  wordBreak: addressGuardStyle?.wordBreak ?? 'break-word',
                  overflowWrap: addressGuardStyle?.overflowWrap ?? 'anywhere',
                  whiteSpace: addressGuardStyle?.whiteSpace,
                  display: addressGuardStyle?.display,
                  WebkitBoxOrient: addressGuardStyle?.WebkitBoxOrient,
                  WebkitLineClamp: addressGuardStyle?.WebkitLineClamp,
                  textOverflow: addressGuardStyle?.textOverflow
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: getContentHtml(`campo:${campo.id}`, buildCampoResolvedHtml(campo)) || '&nbsp;' }} />
              </div>
            );
          })}

          {bloques.map((bloque) => (
            <div
              key={bloque.id}
              className="absolute text-slate-800 leading-relaxed whitespace-pre-wrap"
              style={{
                left: Number(bloque.x || 40),
                top: Number(bloque.y || 80),
                width: Number(bloque.w || 510),
                minHeight: Number(bloque.h || 20),
                fontSize: Number(bloque.fontSize || 13),
                fontWeight: bloque.negrita ? 700 : 500,
                textAlign: bloque.align || 'left',
                overflow: 'visible',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: getContentHtml(`bloque:${bloque.id}`, buildBloqueResolvedHtml(bloque)) || '&nbsp;' }} />
            </div>
          ))}
        </>
      ) : null}
    </>
  );
  };

  const waitForPrintableAssets = async () => {
    const container = printPageRef.current;
    if (!container) return;

    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        let resolved = false;
        const done = () => {
          if (!resolved) {
            resolved = true;
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
          }
        };

        img.addEventListener('load', done);
        img.addEventListener('error', done);
        setTimeout(done, 2500);
      });
    }));

    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Continue even if font API fails in older browsers.
      }
    }
  };

  const openPrintWindow = async (mode = 'print') => {
    const originalTitle = document.title;
    try {
      await waitForPrintableAssets();
      const docBaseName = plantilla?.nombre || (isRecipeTemplate ? 'Receta medica' : 'Documento medico');
      const docNombre = hasManualEdits ? `${docBaseName} (editado)` : docBaseName;

      // Capturar y subir PDF al expediente antes de imprimir
      let archivoUrl = '';
      let archivoPath = '';
      if (pacienteId && printPageRef.current) {
        try {
          const canvas = await html2canvas(printPageRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 0
          });
          const capturePdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter', compress: true });
          const pW = 612, pH = 792;
          const s = Math.min(pW / canvas.width, pH / canvas.height);
          const imgData = canvas.toDataURL('image/png', 1.0);
          capturePdf.addImage(imgData, 'PNG', (pW - canvas.width * s) / 2, (pH - canvas.height * s) / 2, canvas.width * s, canvas.height * s, undefined, 'FAST');
          const pdfBlob = capturePdf.output('blob');
          const result = await uploadDocumentoPDF({
            pacienteId,
            pdfBlob,
            nombre: docNombre,
            tipo: isRecipeTemplate ? 'receta' : 'documento'
          });
          archivoUrl = result.url;
          archivoPath = result.storagePath;
        } catch (uploadErr) {
          console.warn('No se pudo capturar/subir el PDF al expediente:', uploadErr);
        }
      }

      onDocumentGenerated?.({
        tipo: isRecipeTemplate ? 'receta' : 'documento',
        nombre: docNombre,
        plantillaId: plantilla?.id || '',
        plantillaNombre: plantilla?.nombre || '',
        formato: mode === 'pdf' ? 'pdf_print' : 'impresion',
        origen: 'plantilla_dinamica',
        editadoManualmente: hasManualEdits,
        archivoUrl,
        archivoPath
      });

      if (mode === 'pdf') {
        onNotify?.('Para fidelidad legal: Destino "Guardar como PDF", Escala 100 y Margenes "Ninguno".', 'info');
      }

      // Cambiar título del documento para evitar "about:blank" en headers del navegador
      const originalTitle = document.title;
      document.title = docNombre;

      document.documentElement.classList.add('printing-plantilla');
      document.body.classList.add('printing-plantilla');
      const cleanupPrintScope = () => {
        document.body.classList.remove('printing-plantilla');
        document.documentElement.classList.remove('printing-plantilla');
        document.title = originalTitle;
      };
      window.addEventListener('afterprint', cleanupPrintScope, { once: true });
      window.print();
      // Fallback: algunos navegadores no siempre disparan afterprint.
      setTimeout(cleanupPrintScope, 5000);
    } catch (error) {
      console.error('Error preparando impresion/PDF:', error);
      onNotify?.('Error generando el documento para imprimir.', 'error');
      document.body.classList.remove('printing-plantilla');
      document.documentElement.classList.remove('printing-plantilla');
      document.title = originalTitle;
    }
  };

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:bg-white print:p-0 tpl-print-overlay">
      <style>{`
        html.printing-plantilla,
        body.printing-plantilla {
          background: #fff !important;
        }

        body.printing-plantilla * {
          visibility: hidden !important;
        }

        body.printing-plantilla .tpl-print-overlay,
        body.printing-plantilla .tpl-print-overlay * {
          visibility: visible !important;
        }

        body.printing-plantilla .tpl-print-overlay {
          position: fixed !important;
          inset: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
          background: #fff !important;
          z-index: 2147483647 !important;
        }

        @media print {
          @page { size: letter; margin: 0 !important; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .tpl-print-overlay {
            position: static !important;
            inset: auto !important;
            background: #fff !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            display: block !important;
          }
          .tpl-print-shell {
            max-width: none !important;
            width: auto !important;
            height: auto !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .tpl-print-scroll {
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .tpl-print-page {
            margin: 0 auto !important;
            border: 0 !important;
            box-shadow: none !important;
            width: var(--tpl-print-width, 816px) !important;
            height: var(--tpl-print-height, 1056px) !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .tpl-print-page + .tpl-print-page {
            break-before: page !important;
            page-break-before: always !important;
            margin-top: 0 !important;
          }
          .tpl-print-canvas {
            transform: scale(var(--tpl-print-scale, 1)) !important;
            transform-origin: top left !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] border border-slate-200 flex flex-col print:shadow-none print:border-0 print:h-auto print:max-w-none print:rounded-none tpl-print-shell">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:justify-between md:items-center print:hidden">
          <div className="min-w-0">
            <h3 className="exp-sora text-xl font-black text-slate-800">{plantilla?.nombre || 'Plantilla'}</h3>
            <p className="text-xs text-slate-500">Vista previa dinámica generada por administración</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button onClick={onBackToMenu} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all whitespace-nowrap shadow-sm">Volver</button>

            <div ref={editMenuRef} className="relative">
              <button
                onClick={() => setShowEditMenu((prev) => !prev)}
                className={`h-10 px-4 rounded-xl border text-sm font-semibold transition-all whitespace-nowrap shadow-sm ${activeEditorMode ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
              >
                {activeEditorLabel}
              </button>

              {showEditMenu && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-20">
                  <button
                    onClick={() => openEditorMode('info')}
                    className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-bold text-slate-800">Informacion</p>
                    <p className="text-xs text-slate-500 mt-1">Corrige datos del paciente, medico o consulta.</p>
                  </button>
                  <button
                    onClick={() => openEditorMode('document')}
                    className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-bold text-slate-800">Documento</p>
                    <p className="text-xs text-slate-500 mt-1">Edita el texto final y el contenido fijo de la plantilla.</p>
                  </button>
                  {activeEditorMode && (
                    <button
                      onClick={closeEditorMode}
                      className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-rose-50 transition-colors"
                    >
                      <p className="text-sm font-bold text-rose-600">Cerrar edicion</p>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => setShowSignatureModal(true)} className="h-10 px-4 rounded-xl border border-blue-200 bg-blue-50/60 text-blue-700 text-sm font-semibold hover:bg-blue-50 inline-flex items-center gap-2 whitespace-nowrap shadow-sm transition-all">
              <FileSignature size={15} /> {signatureDataUrl ? 'Editar firma' : 'Firmar'}
            </button>
            <button onClick={() => openPrintWindow('print')} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all whitespace-nowrap shadow-sm">Imprimir</button>
            <button onClick={onClose} className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all inline-flex items-center justify-center shadow-sm"><X size={18} /></button>
          </div>
        </div>

        {(showFieldEditor || showContentEditor) && (
          <div className={`px-6 py-4 border-b border-slate-100 print:hidden ${showFieldEditor ? 'bg-emerald-50/40' : 'bg-blue-50/40'}`}>
            <div className="space-y-5">
              {showFieldEditor && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-wide">Edicion manual de informacion</p>
                      <p className="text-xs text-slate-500">Ajusta datos faltantes, incorrectos o incluso dejalos en blanco antes de imprimir.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFieldOverrides({})}
                        className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wide hover:bg-white"
                      >
                        Limpiar informacion
                      </button>
                      <button
                        onClick={closeEditorMode}
                        className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wide hover:bg-white"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>

                  {detectedFieldKeys.length === 0 ? (
                    <p className="text-xs text-slate-500">Esta plantilla no tiene campos dinamicos detectables.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {detectedFieldKeys.map((fieldKey) => {
                        const baseValue = resolverCampo(fieldKey) || '';
                        const currentValue = hasOverrideKey(fieldOverrides, fieldKey) ? fieldOverrides[fieldKey] ?? '' : '';
                        const isMultiline = fieldKey.includes('html') || fieldKey.includes('texto') || fieldKey.includes('indicaciones') || fieldKey.includes('diagnostico') || fieldKey.includes('padecimiento');

                        return (
                          <label key={fieldKey} className="flex flex-col gap-1">
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide">{fieldKey}</span>
                            {isMultiline ? (
                              <textarea
                                value={currentValue}
                                placeholder={baseValue ? `Actual: ${String(baseValue).slice(0, 120)}` : 'Sin valor actual'}
                                onChange={(e) => updateFieldOverride(fieldKey, e.target.value)}
                                className="w-full min-h-[70px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              />
                            ) : (
                              <input
                                value={currentValue}
                                placeholder={baseValue ? `Actual: ${baseValue}` : 'Sin valor actual'}
                                onChange={(e) => updateFieldOverride(fieldKey, e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {showContentEditor && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 uppercase tracking-wide">Edicion libre del documento</p>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Corrige texto fijo y resuelto. Los cambios tienen prioridad sobre las variables.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setContentEditorUnified(true)}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${contentEditorUnified ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          Unificado
                        </button>
                        <button
                          onClick={() => setContentEditorUnified(false)}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${!contentEditorUnified ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          Por sección
                        </button>
                      </div>
                      <button
                        onClick={() => setContentOverrides({})}
                        className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wide hover:bg-white whitespace-nowrap"
                      >
                        Restaurar todo
                      </button>
                      <button
                        onClick={closeEditorMode}
                        className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wide hover:bg-white"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>

                  {editableContentSections.length === 0 ? (
                    <p className="text-xs text-slate-500">Esta plantilla no tiene secciones de texto editables.</p>
                  ) : contentEditorUnified ? (
                    <div className="max-h-[50vh] overflow-y-auto">
                      <InlineHtmlEditor
                        value={buildUnifiedHtml(editableContentSections)}
                        onCommit={(html) => commitUnifiedHtml(html, editableContentSections)}
                        className="min-h-[200px] [&_hr[data-section-break]]:my-3"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {editableContentSections.map((section) => {
                        const currentHtml = getContentHtml(section.key, section.baseHtml);
                        const hasTable = currentHtml.includes('<table') || currentHtml.includes('<TABLE');
                        return (
                          <div key={section.key} className={`rounded-lg border border-slate-200 bg-white/90 p-2.5 shadow-sm ${hasTable ? 'md:col-span-2' : ''}`}>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide truncate">{section.label}</p>
                              <button
                                onClick={() => updateContentOverride(section.key, section.baseHtml, section.baseHtml)}
                                className="px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold uppercase text-slate-500 hover:bg-slate-50 shrink-0"
                              >
                                Restaurar
                              </button>
                            </div>

                            <InlineHtmlEditor
                              value={currentHtml}
                              onCommit={(nextHtml) => updateContentOverride(section.key, nextHtml, section.baseHtml)}
                              className={hasTable ? 'min-h-[80px]' : 'min-h-[60px]'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto bg-slate-50 p-6 print:p-0 print:bg-white tpl-print-scroll">
          {isRecipeTemplate && recipeContentPages.length > 1 ? (
            /* --- MULTI-PAGE RECIPE --- */
            recipeContentPages.map((pageOverrides, rpIdx) => {
              recipePageOverridesRef.current = pageOverrides;
              const pageCanvas = renderTemplateCanvasContent();
              recipePageOverridesRef.current = null;

              return (
                <div
                  key={`recipe-page-${rpIdx}`}
                  ref={rpIdx === 0 ? printPageRef : undefined}
                  className={`mx-auto bg-white border border-slate-200 shadow-sm relative overflow-hidden print:shadow-none print:border-0 tpl-print-page ${rpIdx > 0 ? 'mt-6 print:mt-0' : ''}`}
                  style={{
                    width: finalPrintWidth,
                    height: finalPrintHeight,
                    '--tpl-print-scale': String(printScale),
                    '--tpl-print-width': `${finalPrintWidth}px`,
                    '--tpl-print-height': `${finalPrintHeight}px`,
                    breakBefore: rpIdx > 0 ? 'page' : undefined,
                    pageBreakBefore: rpIdx > 0 ? 'always' : undefined
                  }}
                >
                  <div className="relative w-full h-full bg-white">
                    {[0, 1].map((copyIndex) => (
                      <div
                        key={`receta_copy_${copyIndex}`}
                        className="absolute left-0 w-full overflow-hidden border-b border-dashed border-slate-300 print:border-0"
                        style={{
                          top: copyIndex * HALF_LETTER_HEIGHT,
                          height: HALF_LETTER_HEIGHT,
                          borderBottomWidth: copyIndex === 0 ? 1 : 0
                        }}
                      >
                        <div
                          className="absolute top-0 left-0"
                          style={{
                            width: pageWidth,
                            height: pageHeight,
                            transform: `scale(${recipeCopyScale})`,
                            transformOrigin: 'top left'
                          }}
                        >
                          {pageCanvas}
                        </div>
                        {copyIndex === 0 && (
                          <div className="absolute bottom-0 left-3 px-1 text-[10px] text-slate-300 bg-white print:hidden">Corte aqui</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {recipeContentPages.length > 1 && (
                    <div className="absolute bottom-1 right-3 text-[9px] text-slate-400 font-bold print:text-slate-300">
                      Pág {rpIdx + 1} de {recipeContentPages.length}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* --- SINGLE PAGE (original) --- */
            <div
              ref={printPageRef}
              className="mx-auto bg-white border border-slate-200 shadow-sm relative overflow-hidden print:shadow-none print:border-0 tpl-print-page"
              style={{
                width: finalPrintWidth,
                height: finalPrintHeight,
                '--tpl-print-scale': String(printScale),
                '--tpl-print-width': `${finalPrintWidth}px`,
                '--tpl-print-height': `${finalPrintHeight}px`
              }}
            >
              {isRecipeTemplate ? (
                <div className="relative w-full h-full bg-white">
                  {[0, 1].map((copyIndex) => (
                    <div
                      key={`receta_copy_${copyIndex}`}
                      className="absolute left-0 w-full overflow-hidden border-b border-dashed border-slate-300 print:border-0"
                      style={{
                        top: copyIndex * HALF_LETTER_HEIGHT,
                        height: HALF_LETTER_HEIGHT,
                        borderBottomWidth: copyIndex === 0 ? 1 : 0
                      }}
                    >
                      <div
                        className="absolute top-0 left-0"
                        style={{
                          width: pageWidth,
                          height: pageHeight,
                          transform: `scale(${recipeCopyScale})`,
                          transformOrigin: 'top left'
                        }}
                      >
                        {renderTemplateCanvasContent()}
                      </div>
                      {copyIndex === 0 && (
                        <div className="absolute bottom-0 left-3 px-1 text-[10px] text-slate-300 bg-white print:hidden">Corte aqui</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tpl-print-canvas relative w-full h-full">
                  {renderTemplateCanvasContent()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSignatureModal && (
        <div className="fixed inset-0 z-[260] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-5">
            <h4 className="text-lg font-black text-slate-800">Firma digital del medico</h4>
            <p className="text-sm text-slate-500 mt-1">Dibuja tu firma con mouse o touch. Se insertara en <code>{'{{firma.medico}}'}</code>.</p>

            <div className="mt-4 rounded-xl border border-slate-300 overflow-hidden bg-white">
              <canvas
                ref={signatureCanvasRef}
                width={900}
                height={280}
                className="w-full h-56 touch-none cursor-crosshair"
                onMouseDown={startSignature}
                onMouseMove={moveSignature}
                onMouseUp={endSignature}
                onMouseLeave={endSignature}
                onTouchStart={startSignature}
                onTouchMove={moveSignature}
                onTouchEnd={endSignature}
                onTouchCancel={endSignature}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowSignatureModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Cancelar</button>
              <button onClick={clearSignatureCanvas} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Limpiar</button>
              <button onClick={persistSignature} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">Guardar firma</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionCard = ({ title, subtitle, icon, color, onClick }) => (
  <button title={title} onClick={onClick} className="group bg-white p-6 rounded-2xl border text-left flex flex-col gap-3 transition-all hover:-translate-y-0.5" style={{borderColor: 'rgba(226,232,240,.8)', boxShadow: '0 1px 2px rgba(15,23,42,.05)'}}>
    <div className={`w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center`} style={{boxShadow: '0 4px 8px rgba(0,0,0,.12)'}}>
      {icon}
    </div>
    <div>
      <h4 className="exp-sora text-base font-semibold leading-tight transition-colors" style={{color: 'var(--slate-800)'}}>{title}</h4>
      <p className="text-xs font-medium mt-1" style={{color: 'var(--slate-500)'}}>{subtitle}</p>
    </div>
  </button>
);

const FormatCard = ({ label, onClick, icon }) => (
  <button title={label} onClick={onClick} className="flex flex-col items-center justify-center gap-4 p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors group aspect-square">
  <div className="p-4 bg-slate-50 text-slate-500 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
      {icon || <FileText size={28} />}
    </div>
  <span className="font-semibold text-slate-600 text-xs text-center leading-tight group-hover:text-blue-700 uppercase tracking-wide">{label}</span>
  </button>
);

const HeaderTab = ({ icon, label, active, visited, onClick, color }) => {
    const colors = {
        blue:    { active: 'bg-white text-blue-700 shadow-sm', visited: 'text-blue-600 hover:bg-white/60', idle: 'text-slate-400 hover:text-slate-600 hover:bg-white/40' },
        emerald: { active: 'bg-white text-emerald-700 shadow-sm', visited: 'text-emerald-600 hover:bg-white/60', idle: 'text-slate-400 hover:text-slate-600 hover:bg-white/40' },
        violet:  { active: 'bg-white text-violet-700 shadow-sm', visited: 'text-violet-600 hover:bg-white/60', idle: 'text-slate-400 hover:text-slate-600 hover:bg-white/40' },
    };
    const c = colors[color] || colors.blue;
    const state = active ? 'active' : visited ? 'visited' : 'idle';
    return (
        <button onClick={onClick} title={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${c[state]}`}>
            {state === 'visited' && !active ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : icon}
            <span className="hidden md:inline">{label}</span>
        </button>
    );
};

export default ExpedienteClinico;