// src/pages/doctor/ExpedienteClinico.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, FileText, History, ClipboardList, Calendar,
  ChevronRight, Images, Send, FileOutput, FileSignature, PlusSquare,
  History as HistoryIcon, User, Clock, Activity, LayoutGrid, Stethoscope,
  Droplet, Baby, Scissors, AlertTriangle, X, Printer,
  FlaskConical, Syringe, FileBadge, ShieldCheck, CheckCircle2, AlertCircle, HeartHandshake,
  Monitor, Calculator, LogOut, Scale, Ruler, ArrowLeftRight
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { goBackOr } from '../../utils/navigation';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { db, auth } from "../../config/firebase";
import {
  doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, deleteField,
  query, where, orderBy, getDocs, limit, runTransaction, setDoc, onSnapshot,
  writeBatch
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
import { uploadDocumentoPDF } from '../../services/documentStorageService';
import { buildEnfermeriaPatientLogRecord } from '../../services/enfermeriaPatientLogService';
import { getTipoCitaLabel } from '../../services/referenciaMedicaService';
import AvatarPaciente from '../../components/AvatarPaciente';
import { getPatientDisplayName } from '../../utils/patientName';
import PlantillaDinamicaModal from '../../components/PlantillaDinamicaModal';

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
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top duration-500 backdrop-blur-md ${type === 'error' ? 'bg-red-50/90 border-red-200 text-red-700' :
      type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700' :
        'bg-blue-50/90 border-blue-200 text-blue-700'
    }`}>
    {type === 'error' ? <AlertCircle size={24} /> : type === 'success' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
    <span className="font-bold text-sm">{msg}</span>
    <button onClick={onClose} className="ml-4 p-1 hover:bg-black/5 rounded-full transition-colors"><X size={16} /></button>
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${val === op
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

// safeMergeForUpdate: merge profundo donde un valor VACIO del nuevo NO pisa
// un valor LLENO del original. Diseñado para escrituras de actualización en
// documentos históricos (rama de "Verificar + Finalizar"). Si el doctor borró
// intencionalmente un campo, debe escribir un espacio o reemplazar el contenido;
// pero un vacío residual del state local nunca destruirá datos previos.
const safeMergeForUpdate = (original, updated) => {
  if (updated === undefined || updated === null) return original;

  if (typeof updated === 'string') {
    if (typeof original === 'string' && original.trim().length > 0 && updated.trim().length === 0) {
      return original;
    }
    return updated;
  }

  if (typeof updated === 'number') {
    if (!Number.isFinite(updated) && typeof original === 'number' && Number.isFinite(original)) {
      return original;
    }
    return updated;
  }

  if (typeof updated === 'boolean') return updated;

  if (Array.isArray(updated)) {
    if (Array.isArray(original) && original.length > 0 && updated.length === 0) {
      return original;
    }
    return updated;
  }

  if (typeof updated === 'object') {
    const baseObj = (original && typeof original === 'object' && !Array.isArray(original)) ? original : {};
    const result = { ...baseObj };
    Object.keys(updated).forEach((key) => {
      result[key] = safeMergeForUpdate(baseObj[key], updated[key]);
    });
    // Preservar también las llaves del original que no estén en updated
    Object.keys(baseObj).forEach((key) => {
      if (!(key in updated)) result[key] = baseObj[key];
    });
    return result;
  }

  return updated;
};

// deepCloneSafe: clon profundo conservador (sin Dates, Maps, etc.) usado para
// aislar mutaciones del state al construir el payload de guardado.
const deepCloneSafe = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return Array.isArray(value) ? [...value] : { ...value };
  }
};

const mergeGeneratedEvents = (baseEvents = [], nextEvents = []) => {
  // Clave semántica: no incluye timestamps ni URLs para que la deduplicación
  // funcione correctamente entre eventos ya guardados y nuevos de sesión.
  const semanticKey = (event) => [
    event?.tipo || '',
    event?.nombre || '',
    event?.formato || '',
    event?.origen || '',
    event?.plantillaId || '',
    event?.totalMedicamentos || ''
  ].join('|');

  // Los eventos de nextEvents (sesión actual) tienen prioridad: se sobreescriben
  // los eventos base con la misma clave semántica.
  const merged = new Map();
  for (const evt of baseEvents) merged.set(semanticKey(evt), evt);
  for (const evt of nextEvents) merged.set(semanticKey(evt), evt);
  return Array.from(merged.values());
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
    openedFrom = '',
    doctorOverride = null
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
  const [showTraspasarModal, setShowTraspasarModal] = useState(false);
  const [traspasarData, setTraspasarData] = useState({ doctorUid: '', doctorNombre: '', justificacion: '' });
  const [doctoresCatalogo, setDoctoresCatalogo] = useState([]);
  const [traspasarLoading, setTraspasarLoading] = useState(false);
  const [plantillasDinamicas, setPlantillasDinamicas] = useState([]);
  const [plantillaRecetaPreferidaId, setPlantillaRecetaPreferidaId] = useState('');
  const [plantillaActiva, setPlantillaActiva] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showPrintAlert, setShowPrintAlert] = useState(false);
  const [showEmptyClinicalAlert, setShowEmptyClinicalAlert] = useState(false);
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [exitChangeList, setExitChangeList] = useState([]);
  const [discardingExit, setDiscardingExit] = useState(false);
  const [eventosDocumentales, setEventosDocumentales] = useState([]);
  const [historialRefreshKey, setHistorialRefreshKey] = useState(0);
  const [historicalReview, setHistoricalReview] = useState(null);
  const pendingExitAfterRecipePrintRef = useRef(false);
  const pendingDraftBeforeHistoricalRef = useRef(null);
  const exitBaselineRef = useRef(null);
  const savingRef = useRef(false);
  const saveCompletedRef = useRef(false);
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
    const unsub = onSnapshot(query(collection(db, 'users'), where('rol', 'in', ['medico', 'doctor'])), (snap) => {
      setDoctoresCatalogo(snap.docs
        .map((d) => ({ id: d.id, nombre: d.data().nombre || d.data().email || d.id }))
        .filter((item) => item.nombre && item.id !== (user?.uid || ''))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
    }, () => {});
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    setIsTimerActive(!isHistoricalReviewMode);
  }, [isHistoricalReviewMode]);

  const showToast = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const registrarEventoDocumental = (evento = {}) => {
    const tipo = evento.tipo === 'receta' ? 'receta' : 'documento';
    const nombre = String(evento.nombre || evento.plantillaNombre || (tipo === 'receta' ? 'Receta medica' : 'Documento medico')).trim();
    const formato = String(evento.formato || 'impresion').trim();
    const origen = String(evento.origen || 'plantilla_dinamica').trim();
    const plantillaId = String(evento.plantillaId || '').trim();

    const nuevoEvento = {
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
    };

    // Si la misma plantilla/documento ya fue registrado en esta sesión, reemplazar
    // en lugar de acumular (evita duplicados cuando se imprime dos veces).
    const sessionKey = (e) => `${e.tipo}|${e.nombre}|${e.plantillaId}`;
    const keyNuevo = sessionKey(nuevoEvento);
    setEventosDocumentales((prev) => {
      const existe = prev.some((e) => sessionKey(e) === keyNuevo);
      if (existe) return prev.map((e) => sessionKey(e) === keyNuevo ? nuevoEvento : e);
      return [...prev, nuevoEvento];
    });

    // Registrar en historial_clinico cuando se genera desde enfermeria,
    // para que aparezca en la linea de tiempo del expediente.
    if (isEnfermeriaDocumentMode && nuevoEvento.archivoUrl) {
      const eventoDocumental = {
        tipo: nuevoEvento.tipo,
        nombre: nuevoEvento.nombre,
        formato: nuevoEvento.formato,
        origen: nuevoEvento.origen,
        plantillaId: nuevoEvento.plantillaId,
        plantillaNombre: nuevoEvento.plantillaNombre,
        archivoUrl: nuevoEvento.archivoUrl,
        archivoPath: nuevoEvento.archivoPath,
        generadoAt: nuevoEvento.generadoAt,
        enfermeroNombre: user?.nombre || 'Enfermero/a'
      };

      addDoc(collection(db, 'historial_clinico'), {
        pacienteId,
        pacienteNombre,
        medicoNombre: user?.nombre || 'Enfermero/a',
        fecha: serverTimestamp(),
        medicoId: auth.currentUser?.uid || 'anonimo',
        citaId: citaId || null,
        tipoNota: nuevoEvento.tipo === 'receta' ? 'Receta' : 'Documento',
        documentosGenerados: [eventoDocumental],
        origenRegistro: 'enfermeria_agenda'
      }).catch((err) => console.warn('No se pudo registrar documento de enfermeria en historial_clinico:', err));
    }

    if (tipo === 'receta' && pendingExitAfterRecipePrintRef.current) {
      pendingExitAfterRecipePrintRef.current = false;
      if (isEnfermeriaDocumentMode) {
        goBackOr(navigate, exitFallbackPath);
        return;
      }
      setTimeout(() => executeSave({ allowCritical: true }), 50);
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
          // No borrar consultaIniciadaAt: si se borra, al reabrir la consulta
          // el sistema vuelve a auto-iniciarla y se crea un loop de "se reinicia".
          // Manteniendo consultaIniciadaAt, la segunda apertura no dispara autoStarted
          // y el estado permanece estable.
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

    // FIX: Verificar si hay un borrador local de revisión histórica pendiente
    // (ediciones a esta misma nota que no llegaron a guardarse por crash/cierre).
    let draftLocalHistorico = null;
    let nextTempMed = DEFAULT_TEMP_MED;
    let nextTempAlergia = DEFAULT_TEMP_ALERGIA;
    let nextTempCirugia = DEFAULT_TEMP_CIRUGIA;
    let nextEventosDocs = [];
    try {
      const raw = localStorage.getItem(`historical_review_draft_${consultaHistorica.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.expediente && hasMeaningfulClinicalData(parsed.expediente)) {
          draftLocalHistorico = parsed.expediente;
          if (parsed.tempMed) nextTempMed = parsed.tempMed;
          if (parsed.tempAlergia) nextTempAlergia = parsed.tempAlergia;
          if (parsed.tempCirugia) nextTempCirugia = parsed.tempCirugia;
          if (Array.isArray(parsed.eventosDocumentales)) nextEventosDocs = parsed.eventosDocumentales;
        }
      }
    } catch (e) {
      console.warn('No se pudo leer borrador local de revisión histórica:', e);
    }

    // FIX: snapshot del estado mergeado para poder sincronizar el baseline
    // (evita que assessUnsavedChanges marque siempre cambios espurios después de
    // cargar la histórica, lo que forzaba el flujo de guardado y exponía al doctor
    // a la sobreescritura del documento original).
    let mergedExpediente = null;
    setExpediente((prev) => {
      // 1. Aplicar la consulta histórica sobre el estado actual
      const baseConHistorica = {
        ...prev,
        px_info: mergeClinicalSection(prev.px_info, consultaHistorica.px_info || {}),
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
          : prev.meta,
        medicoNombre: consultaHistorica.medicoNombre || prev.medicoNombre || '',
        medicoPerfil: consultaHistorica.medicoPerfil || prev.medicoPerfil || null
      };

      // 2. Si hay borrador local más reciente con ediciones, superponerlo
      let next = baseConHistorica;
      if (draftLocalHistorico) {
        next = {
          ...baseConHistorica,
          px_info: mergeClinicalSection(baseConHistorica.px_info, draftLocalHistorico.px_info || {}),
          resumen: mergeClinicalSection(baseConHistorica.resumen, draftLocalHistorico.resumen || {}),
          antecedentes: mergeClinicalSection(baseConHistorica.antecedentes, draftLocalHistorico.antecedentes || {}),
          control_embarazo: mergeClinicalSection(baseConHistorica.control_embarazo, draftLocalHistorico.control_embarazo || {}),
          consulta: mergeClinicalSection(baseConHistorica.consulta, draftLocalHistorico.consulta || {}),
          meta: mergeClinicalSection(baseConHistorica.meta, draftLocalHistorico.meta || {})
        };
      }

      mergedExpediente = next;
      return next;
    });

    setTempMed(nextTempMed);
    setTempAlergia(nextTempAlergia);
    setTempCirugia(nextTempCirugia);
    setEventosDocumentales(nextEventosDocs);

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

    // Sincronizar baseline: el state ya tiene los datos históricos cargados,
    // así que el comparador debe usar este punto como referencia. Sin esto,
    // cualquier navegación interna disparaba "tienes cambios sin guardar".
    if (mergedExpediente) {
      syncExitBaseline({
        expediente: mergedExpediente,
        tempMed: DEFAULT_TEMP_MED,
        tempAlergia: DEFAULT_TEMP_ALERGIA,
        tempCirugia: DEFAULT_TEMP_CIRUGIA,
        eventosDocumentales: []
      });
    }

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

  // --- RENOVACIÓN PERIÓDICA DEL TOKEN DE FIREBASE AUTH ---
  // Previene que el token expire durante consultas largas (~1hr).
  // Sin esto, al dar "Finalizar" con token expirado el guardado falla
  // y Firebase dispara onAuthStateChanged(null) → redirect a login → pérdida de datos.
  useEffect(() => {
    const TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000; // cada 25 minutos
    const refreshToken = async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
        }
      } catch (e) {
        console.warn('[Expediente] No se pudo renovar token de sesión:', e.message);
      }
    };
    // Renovar inmediatamente al montar y luego cada 25 min
    refreshToken();
    const interval = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

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
      vacunas: { lista: [], otras: "", completo_para_la_edad: false },
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
      procedimientos: { seleccionados: [], notas_generales: "" },
      referencias_medicas: { seleccionadas: [], notas_generales: "" }
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
      if (!isNaN(fum.getTime())) {
        const fppDate = new Date(fum);
        fppDate.setDate(fppDate.getDate() + 7);
        fppDate.setMonth(fppDate.getMonth() - 3);
        fppDate.setFullYear(fppDate.getFullYear() + 1);
        const hoy = new Date();
        const diffTime = Math.abs(hoy - fum);
        const diffWeeks = (diffTime / (1000 * 60 * 60 * 24 * 7)).toFixed(1);
        if (expediente.px_info.sdg !== diffWeeks || expediente.px_info.fpp !== fppDate.toISOString().split('T')[0]) {
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
      savingRef.current = false;
      saveCompletedRef.current = false;
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
          const nombreCompletoPx = getPatientDisplayName(dataPx);

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
            alergias_base: '',
            // Restaurar datos obstétricos y quirúrgicos persistidos
            ...(dataPx.obstetriciaClinica ? {
              fum: dataPx.obstetriciaClinica.fum || '',
              fpp: dataPx.obstetriciaClinica.fpp || '',
              sdg: dataPx.obstetriciaClinica.sdg || '',
              es_embarazada: dataPx.obstetriciaClinica.es_embarazada || false,
              requiere_cirugia: dataPx.obstetriciaClinica.requiere_cirugia || { general: false, ginecologica: false }
            } : {})
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

          if (dataPx.notasPersonales || nuevosDatos.resumen?.notas_previas) {
            nuevosDatos.resumen.notas_previas = dataPx.notasPersonales || nuevosDatos.resumen.notas_previas || '';
          }
        }

        // 3. PROCESAR HISTORIAL PREVIO
        if (!historialSnap.empty) {
          const historialRows = historialSnap.docs.map((docSnap) => docSnap.data());
          const antecedentesPersistidos = pickMostRecentClinicalSection(historialRows, 'antecedentes');
          const resumenPersistido = pickMostRecentClinicalSection(historialRows, 'resumen');
          const controlEmbarazoPersistido = pickMostRecentClinicalSection(historialRows, 'control_embarazo');
          const pxInfoPersistida = pickMostRecentClinicalSection(historialRows, 'px_info');

          if (antecedentesPersistidos) {
            nuevosDatos.antecedentes = mergeClinicalSection(nuevosDatos.antecedentes, antecedentesPersistidos);
          }
          if (resumenPersistido) {
            nuevosDatos.resumen = mergeClinicalSection(nuevosDatos.resumen, resumenPersistido);
          }
          if (controlEmbarazoPersistido) {
            nuevosDatos.control_embarazo = mergeClinicalSection(nuevosDatos.control_embarazo, controlEmbarazoPersistido);
          }
          // Recuperar datos obstétricos/qx desde historial solo si no vinieron del doc paciente
          if (pxInfoPersistida && !nuevosDatos.px_info.fum && !nuevosDatos.px_info.es_embarazada) {
            nuevosDatos.px_info = {
              ...nuevosDatos.px_info,
              fum: pxInfoPersistida.fum || '',
              fpp: pxInfoPersistida.fpp || '',
              sdg: pxInfoPersistida.sdg || '',
              es_embarazada: pxInfoPersistida.es_embarazada || false,
              requiere_cirugia: pxInfoPersistida.requiere_cirugia || nuevosDatos.px_info.requiere_cirugia || { general: false, ginecologica: false }
            };
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

          // Recuperar respaldos locales de emergencia (autosave fallido o error al guardar)
          let recuperadoDeLocal = false;
          const autosaveKey = `autosave_draft_${citaId}`;
          const emergencyKey = `emergency_draft_${pacienteId}_${citaId || 'nocita'}`;

          try {
            const emergencyRaw = localStorage.getItem(emergencyKey);
            if (emergencyRaw) {
              const emergencyData = JSON.parse(emergencyRaw);
              const draftExp = emergencyData.expediente;
              if (draftExp) {
                if (hasMeaningfulClinicalData(draftExp.consulta)) {
                  nuevosDatos.consulta = mergeClinicalSection(nuevosDatos.consulta, draftExp.consulta);
                }
                if (hasMeaningfulClinicalData(draftExp.antecedentes)) {
                  nuevosDatos.antecedentes = mergeClinicalSection(nuevosDatos.antecedentes, draftExp.antecedentes);
                }
                if (hasMeaningfulClinicalData(draftExp.resumen)) {
                  nuevosDatos.resumen = mergeClinicalSection(nuevosDatos.resumen, draftExp.resumen);
                }
                if (hasMeaningfulClinicalData(draftExp.control_embarazo)) {
                  nuevosDatos.control_embarazo = mergeClinicalSection(nuevosDatos.control_embarazo, draftExp.control_embarazo);
                }
                if (draftExp.meta?.costo) nuevosDatos.meta.costo = draftExp.meta.costo;
                if (draftExp.px_info) {
                  nuevosDatos.px_info = { ...nuevosDatos.px_info, ...draftExp.px_info };
                }
                if (emergencyData.tempMed) nextTempMed = emergencyData.tempMed;
                if (emergencyData.tempAlergia) nextTempAlergia = emergencyData.tempAlergia;
                if (emergencyData.tempCirugia) nextTempCirugia = emergencyData.tempCirugia;
                recuperadoDeLocal = true;
                showToast("Se recuperaron datos de un guardado de emergencia anterior.", "info");
              }
              localStorage.removeItem(emergencyKey);
            }
          } catch (e) {
            console.warn('Error recuperando emergency_draft:', e);
          }

          // Si no habia emergency, intentar el autosave local
          if (!recuperadoDeLocal) {
            try {
              const autosaveRaw = localStorage.getItem(autosaveKey);
              if (autosaveRaw) {
                const draftLocal = JSON.parse(autosaveRaw);
                if (hasMeaningfulClinicalData(draftLocal.consulta)) {
                  nuevosDatos.consulta = mergeClinicalSection(nuevosDatos.consulta, draftLocal.consulta);
                }
                if (hasMeaningfulClinicalData(draftLocal.antecedentes)) {
                  nuevosDatos.antecedentes = mergeClinicalSection(nuevosDatos.antecedentes, draftLocal.antecedentes);
                }
                if (hasMeaningfulClinicalData(draftLocal.resumen)) {
                  nuevosDatos.resumen = mergeClinicalSection(nuevosDatos.resumen, draftLocal.resumen);
                }
                if (hasMeaningfulClinicalData(draftLocal.control_embarazo)) {
                  nuevosDatos.control_embarazo = mergeClinicalSection(nuevosDatos.control_embarazo, draftLocal.control_embarazo);
                }
                if (draftLocal.meta?.costo) nuevosDatos.meta.costo = draftLocal.meta.costo;
                if (draftLocal.tempMed) nextTempMed = draftLocal.tempMed;
                if (draftLocal.tempAlergia) nextTempAlergia = draftLocal.tempAlergia;
                if (draftLocal.tempCirugia) nextTempCirugia = draftLocal.tempCirugia;
                recuperadoDeLocal = true;
                showToast("Se recuperaron datos del borrador automático local.", "info");
                localStorage.removeItem(autosaveKey);
              }
            } catch (e) {
              console.warn('Error recuperando autosave_draft:', e);
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
            if (dataCita.signos_vitales.peso) nuevosDatos.consulta.exploracion.antropometria.peso = dataCita.signos_vitales.peso;
            if (dataCita.signos_vitales.talla) nuevosDatos.consulta.exploracion.antropometria.talla = dataCita.signos_vitales.talla;
            if (dataCita.signos_vitales.imc) nuevosDatos.consulta.exploracion.antropometria.imc = dataCita.signos_vitales.imc;
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
              // Si en triage fue "preguntados y negados", solo marcarlo si el doctor
              // no ha registrado ya alergias específicas (para no pisar datos clínicos).
              const listaActual = nuevosDatos.antecedentes.alergias.lista || [];
              const otrosActual = nuevosDatos.antecedentes.alergias.otros || nuevosDatos.antecedentes.alergias.otras || '';
              const yaTieneAlergias = listaActual.length > 0 || otrosActual.trim().length > 0;
              if (!yaTieneAlergias) {
                nuevosDatos.antecedentes.alergias.preguntados_y_negados = true;
              }
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
    }, () => { });
    return () => unsub();
  }, [citaId, loading, tempMed, tempAlergia, tempCirugia, eventosDocumentales]);

  useEffect(() => {
    if (!pacienteId || !citaId || loading || isHistoricalReviewMode) return;

    const timer = setTimeout(async () => {
      const draftPayload = {
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
      };

      // FIX (pérdida de datos): NO autoguardar un borrador completamente vacío.
      // Si la pantalla se reinicia (recarga/crash) y el state queda en blanco antes
      // de que se restaure el borrador previo, este efecto podría sobrescribir un
      // borrador BUENO con uno vacío. Solo escribimos cuando hay algo capturado.
      const draftTieneContenido =
        hasMeaningfulClinicalData(draftPayload.consulta) ||
        hasMeaningfulClinicalData(draftPayload.antecedentes) ||
        hasMeaningfulClinicalData(draftPayload.resumen) ||
        hasMeaningfulClinicalData(draftPayload.control_embarazo) ||
        String(draftPayload.tempMed?.nombre || '').trim() !== '' ||
        String(draftPayload.tempAlergia?.nombre || '').trim() !== '' ||
        String(draftPayload.tempCirugia?.procedimiento || '').trim() !== '' ||
        String(draftPayload.meta?.costo || '').trim() !== '';

      if (!draftTieneContenido) return;

      // FIX: Respaldo PROACTIVO en localStorage SIEMPRE (no solo si falla Firebase).
      // Garantiza que ante refresh, cierre accidental, crash o token expirado,
      // los datos clínicos sobrevivan. Se limpia al guardar correctamente.
      try {
        localStorage.setItem(
          `autosave_draft_${citaId}`,
          JSON.stringify({ ...draftPayload, savedAt: Date.now() })
        );
      } catch { /* localStorage lleno o no disponible */ }

      try {
        await updateDoc(doc(db, "citas", citaId), {
          consultaDraft: draftPayload,
          consultaDraftUpdatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Error autoguardando en Firebase", e);
        // localStorage ya fue actualizado arriba; los datos están seguros localmente.
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

  // FIX: Autosave local también para modo histórico ("Verificar + Finalizar").
  // Sin esto, si el doctor edita una nota histórica y la app crashea/refresca,
  // pierde lo editado (el autosave normal está desactivado en modo histórico).
  useEffect(() => {
    if (!isHistoricalReviewMode || !historicalReview?.historialId || loading) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `historical_review_draft_${historicalReview.historialId}`,
          JSON.stringify({
            expediente,
            tempMed,
            tempAlergia,
            tempCirugia,
            eventosDocumentales,
            savedAt: Date.now()
          })
        );
      } catch { /* localStorage lleno o no disponible */ }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    isHistoricalReviewMode,
    historicalReview?.historialId,
    loading,
    expediente,
    tempMed,
    tempAlergia,
    tempCirugia,
    eventosDocumentales
  ]);

  // Mantener alergias_base sincronizado con antecedentes.alergias (fuente de verdad)
  useEffect(() => {
    const alergias = expediente.antecedentes?.alergias;
    if (!alergias) return;

    const lista = Array.isArray(alergias.lista)
      ? alergias.lista.map((item) => String(item?.sustancia || item?.nombre || '').trim()).filter(Boolean)
      : [];
    const otros = String(alergias.otros || alergias.otras || '').trim();
    const preguntados = alergias.preguntados_y_negados === true;

    const textoActualizado = preguntados
      ? 'Preguntados y negados'
      : [...lista, ...(otros ? [otros] : [])].join(', ') || '';

    setExpediente((prev) => {
      const actual = prev.px_info?.alergias_base || '';
      if (actual === textoActualizado) return prev;
      return {
        ...prev,
        px_info: { ...prev.px_info, alergias_base: textoActualizado }
      };
    });
  }, [
    expediente.antecedentes?.alergias?.lista,
    expediente.antecedentes?.alergias?.otros,
    expediente.antecedentes?.alergias?.otras,
    expediente.antecedentes?.alergias?.preguntados_y_negados
  ]);

  useEffect(() => {
    if (!openDocumentTemplates) return;

    // Entrada rápida desde agenda de enfermería para generar plantillas.
    setShowActionsMenu(false);
    setShowFormatSelector(true);
  }, [openDocumentTemplates, openedFrom]);

  const handleTraspasarPaciente = async () => {
    if (!traspasarData.doctorUid) {
      showToast('Selecciona un médico para transferir al paciente.', 'error');
      return;
    }
    if (!traspasarData.justificacion.trim()) {
      showToast('Escribe una justificación para la transferencia.', 'error');
      return;
    }
    setTraspasarLoading(true);
    try {
      if (citaId) {
        await updateDoc(doc(db, 'citas', citaId), {
          doctorAsignado: traspasarData.doctorNombre,
          doctorUid: traspasarData.doctorUid,
          reasignadaAt: serverTimestamp(),
          reasignadaPor: user?.uid || '',
          reasignadaPorNombre: user?.nombre || '',
          reasignadaDoctorAnterior: user?.nombre || '',
          reasignadaDoctorAnteriorUid: user?.uid || '',
          reasignadaJustificacion: traspasarData.justificacion.trim()
        });
      } else {
        const today = new Date();
        const fechaStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
        const endTime = new Date(today.getTime() + 30 * 60000);
        const horaFin = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
        await addDoc(collection(db, 'citas'), {
          paciente: pacienteNombre,
          pacienteId,
          fecha: fechaStr,
          hora: nowTime,
          horaFin,
          fechaHora: `${fechaStr}T${nowTime}`,
          fechaHoraFin: `${fechaStr}T${horaFin}`,
          doctorAsignado: traspasarData.doctorNombre,
          doctorUid: traspasarData.doctorUid,
          estado: 'pendiente',
          motivo: 'Transferencia de paciente',
          motivoId: 'transferencia',
          tipoConsulta: 'transferencia',
          formaPago: 'efectivo',
          creadoPor: user?.uid || '',
          creadoPorRol: user?.rol || '',
          reasignadaAt: serverTimestamp(),
          reasignadaPor: user?.uid || '',
          reasignadaPorNombre: user?.nombre || '',
          reasignadaDoctorAnterior: user?.nombre || '',
          reasignadaDoctorAnteriorUid: user?.uid || '',
          reasignadaJustificacion: traspasarData.justificacion.trim(),
          notas: `Paciente transferido por Dr. ${user?.nombre || ''}. Justificación: ${traspasarData.justificacion.trim()}`
        });
      }
      showToast(`Paciente transferido al Dr. ${traspasarData.doctorNombre} exitosamente.`, 'success');
      setShowTraspasarModal(false);
      setShowActionsMenu(false);
      setTraspasarData({ doctorUid: '', doctorNombre: '', justificacion: '' });
    } catch (e) {
      console.error('Error al transferir paciente:', e);
      showToast('Error al transferir el paciente. Intenta de nuevo.', 'error');
    }
    setTraspasarLoading(false);
  };

  const handleVerHistoria = async () => {
    setLoading(true);
    setShowActionsMenu(false);
    try {
      const qHistorial = query(collection(db, "historial_clinico"), where("pacienteId", "==", pacienteId), orderBy("fecha", "desc"));
      const qEstudios = query(collection(db, "estudios_previos"), where("pacienteId", "==", pacienteId));

      const [snapHistorial, snapEstudios] = await Promise.all([
        getDocs(qHistorial),
        getDocs(qEstudios)
      ]);

      const historialClinico = snapHistorial.docs.map(doc => {
        const data = doc.data();
        const fisicaRaw = data.consulta?.exploracion?.fisica || {};
        const exploracionLimpia = JSON.stringify(fisicaRaw).replace(/[{}"']/g, ' ').replace(/ , /g, ', ').trim();
        return {
          id: doc.id,
          origen: 'consulta',
          fecha: data.fecha?.toDate ? data.fecha.toDate().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha no disponible',
          fechaRaw: data.fecha?.toDate ? data.fecha.toDate() : null,
          motivo: data.tipoNota || 'Consulta General',
          medicoNombre: data.medicoNombre || 'Médico General',
          padecimiento: data.consulta?.padecimiento || 'Sin descripción',
          signos: data.consulta?.exploracion?.signos || {},
          exploracionFisica: exploracionLimpia === "{}" ? "Sin hallazgos registrados" : exploracionLimpia,
          diagnostico: data.consulta?.diagnostico?.enfermedad_actual || 'Sin diagnóstico',
          receta: data.consulta?.diagnostico?.tratamiento_lista || [],
          recetasGeneradas: Array.isArray(data.recetasGeneradas) ? data.recetasGeneradas : [],
          documentosGenerados: Array.isArray(data.documentosGenerados) ? data.documentosGenerados : [],
          indicaciones: data.consulta?.diagnostico?.indicaciones || ''
        };
      });

      const historialEstudios = snapEstudios.docs.map(doc => {
        const data = doc.data();
        const fechaRaw = data.fechaRegistro?.toDate ? data.fechaRegistro.toDate() : (data.fecha ? new Date(data.fecha + 'T00:00:00') : null);
        const fechaLabel = data.fechaRegistro?.toDate
          ? data.fechaRegistro.toDate().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : (data.fecha || 'Fecha no disponible');
        const estudiosNombres = Array.isArray(data.estudios) ? data.estudios.join(', ') : '';

        return {
          id: doc.id,
          origen: 'estudio_previo',
          fecha: fechaLabel,
          fechaRaw,
          motivo: estudiosNombres ? `Estudios: ${estudiosNombres}` : 'Estudios Previos',
          tipoNota: 'Estudios Previos',
          medicoNombre: data.medicoNombre || 'Médico',
          padecimiento: data.interpretacion || 'Sin interpretación',
          diagnostico: estudiosNombres || 'Sin estudios',
          signos: {},
          exploracionFisica: '',
          receta: [],
          recetasGeneradas: [],
          documentosGenerados: [],
          indicaciones: '',
          adjuntos: Array.isArray(data.adjuntos) ? data.adjuntos : [],
          interpretacion: data.interpretacion || '',
          estudiosPrevios: Array.isArray(data.estudios) ? data.estudios : [],
          clasificacion: data.clasificacion || ''
        };
      });

      const historial = [...historialClinico, ...historialEstudios].sort((a, b) => {
        const aTs = a.fechaRaw?.getTime?.() || 0;
        const bTs = b.fechaRaw?.getTime?.() || 0;
        return bTs - aTs;
      });

      setHistorialCompleto(historial);
      setShowHistoriaModal(true);
    } catch (error) { showToast("Error al abrir historial", "error"); }
    setLoading(false);
  };

  const handleGuardar = () => {
    // Si no hay cambios clínicos, salir sin revertir el estado de la cita.
    // Nota: NO llamar restoreEntryStateAndExit aquí porque ese método cancela
    // la consulta (revierte estado → en_espera). Finalizar ≠ Cancelar.
    const { hasChanges, changes } = assessUnsavedChanges();
    if (!hasChanges) {
      goBackOr(navigate, exitFallbackPath);
      return;
    }

    // Hay cambios: reproducir pitido de advertencia y mostrar diálogo
    playSoftBeep(880, 0.12);
    setTimeout(() => playSoftBeep(660, 0.18), 180);

    setExitChangeList(changes);

    // FIX (pérdida de datos): si la consulta NO tiene contenido médico capturado
    // (sin padecimiento, diagnóstico, tratamiento, indicaciones, estudios,
    // procedimientos ni referencias) —típico cuando la pantalla se reinició y solo
    // sobreviven los signos vitales del triage— advertir antes de finalizar en blanco.
    if (!isEnfermeriaDocumentMode && !consultaTieneContenidoMedico()) {
      setShowEmptyClinicalAlert(true);
      return;
    }

    continuarGuardar();
  };

  const continuarGuardar = () => {
    setShowEmptyClinicalAlert(false);

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
    if (savingRef.current) return;
    if (saveCompletedRef.current) return;
    savingRef.current = true;
    setLoading(true);
    setShowPrintAlert(false);

    // Forzar renovación del token antes de cualquier escritura.
    // Previene el bug donde un token expirado causa que todas las escrituras
    // fallen y Firebase dispare signOut → redirect a login → pérdida de datos.
    try {
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      } else {
        showToast('Tu sesión expiró. Inicia sesión de nuevo para guardar.', 'error');
        savingRef.current = false;
        setLoading(false);
        return;
      }
    } catch (tokenError) {
      console.error('[Expediente] Token refresh falló antes de guardar:', tokenError);
      showToast('No se pudo renovar la sesión. Verifica tu conexión e intenta de nuevo.', 'error');
      savingRef.current = false;
      setLoading(false);
      return;
    }

    try {
      // Deep clone para evitar mutar el state al modificar sub-arrays
      // (tratamiento_lista, alergias.lista, cirugias.lista) durante el armado del payload.
      const expedienteFinal = deepCloneSafe(expediente);
      const grupoSanguineoNormalizado = (expedienteFinal.px_info?.grupo_sanguineo || '').trim().toUpperCase();
      if (!expedienteFinal.px_info) expedienteFinal.px_info = {};
      expedienteFinal.px_info.grupo_sanguineo = grupoSanguineoNormalizado;
      const costoConsulta = Number.parseFloat(expedienteFinal.meta?.costo || 0);
      const costoSanitizado = Number.isFinite(costoConsulta) ? costoConsulta : 0;
      const finConsulta = new Date();
      const duracionRealMin = Math.max(1, Math.round((finConsulta - consultaInicioRef.current) / 60000));

      const rawDiagnostico = String(expedienteFinal.consulta?.diagnostico?.enfermedad_actual || '').trim();
      if (rawDiagnostico) {
        const matches = rawDiagnostico.match(/([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*[-–—]?\s*([^,;\n]*)/gi);
        if (matches && matches.length > 0) {
          expedienteFinal.consulta.diagnostico.cie10 = matches.map((m) => {
            const parts = m.match(/^([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*[-–—]?\s*(.*)/i);
            if (!parts) return null;
            const codigo = parts[1].toUpperCase();
            let desc = (parts[2] || '').trim();
            desc = desc.replace(/^\.?\d{1,2}\s*[-–—]\s*/, '').trim();
            if (desc.toUpperCase().startsWith(codigo.toUpperCase())) {
              desc = desc.slice(codigo.length).replace(/^\s*[-–—]\s*/, '').trim();
            }
            return { codigo, descripcion: desc || 'Sin descripción' };
          }).filter(Boolean);
        }
      }

      if (tempMed.nombre.trim() !== '') {
        const listaActual = expedienteFinal.consulta.diagnostico.tratamiento_lista || [];
        expedienteFinal.consulta.diagnostico.tratamiento_lista = [...listaActual, tempMed];
      }
      if (tempAlergia.nombre.trim() !== '') {
        const listaAlergias = expedienteFinal.antecedentes.alergias.lista || [];
        expedienteFinal.antecedentes.alergias.lista = [...listaAlergias, { sustancia: tempAlergia.nombre }];
      }
      if (tempCirugia.procedimiento.trim() !== '') {
        const fechaRegistroCirugia = tempCirugia.tipoFecha === 'ano'
          ? (tempCirugia.ano || '')
          : (tempCirugia.fechaHora ? tempCirugia.fechaHora.split('T')[0] : '');
        const nuevaCirugia = {
          ...tempCirugia,
          id: Date.now(),
          fechaRegistro: fechaRegistroCirugia,
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
      // Enriquecer la primera receta impresa con el conteo de medicamentos para trazabilidad de auditoría.
      const mappedSessionRecetas = eventosReceta.map((evt, idx) => ({
        tipo: 'receta',
        nombre: evt.nombre,
        formato: evt.formato,
        origen: evt.origen,
        plantillaId: evt.plantillaId || '',
        plantillaNombre: evt.plantillaNombre || '',
        ...(idx === 0 && tratamientoActual.length > 0 ? { totalMedicamentos: tratamientoActual.length } : {}),
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

      // Solo agregar la entrada auto-generada si el usuario no imprimió
      // ninguna plantilla de receta durante la sesión (evita duplicados en timeline).
      const hasPrintedRecipe = mappedSessionRecetas.length > 0;
      let recetasGeneradas = [
        ...(tratamientoActual.length > 0 && !hasPrintedRecipe
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

        // Si el usuario imprimió una plantilla de receta en esta revisión, no agregar
        // la entrada auto-generada para evitar duplicados en el timeline.
        const reviewHasPrintedRecipe = mappedSessionRecetas.length > 0;
        const reviewBaseRecetas = !hasConsultaRecipe && tratamientoActual.length > 0 && !reviewHasPrintedRecipe
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

      if (!consultaTieneDatosClinicos()) {
        showToast("Sin datos clínicos para guardar.", "info");
        if (isHistoricalReviewMode) {
          savingRef.current = false;
          setLoading(false);
          return;
        }
        setTimeout(() => goBackOr(navigate, exitFallbackPath), 800);
        savingRef.current = false;
        setLoading(false);
        return;
      }

      // Preparar datos del paciente para el batch atómico
      let pacienteUpdateData = null;
      if (!isHistoricalReviewMode && pacienteId) {
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

        pacienteUpdateData = {
          grupoSanguineo: grupoSanguineoNormalizado,
          resumenClinico: resumenClinicoSnapshot,
          antecedentesClinicos: antecedentesClinicosSnapshot,
          controlEmbarazoClinico: controlEmbarazoClinicoSnapshot,
          notasPersonales: expedienteFinal.resumen?.notas_previas || "",
          obstetriciaClinica: {
            fum: expedienteFinal.px_info?.fum || '',
            fpp: expedienteFinal.px_info?.fpp || '',
            sdg: expedienteFinal.px_info?.sdg || '',
            es_embarazada: expedienteFinal.px_info?.es_embarazada || false,
            requiere_cirugia: expedienteFinal.px_info?.requiere_cirugia || { general: false, ginecologica: false },
            actualizadoAt: new Date().toISOString()
          }
        };
      }

      if (isHistoricalReviewMode && historicalReview?.historialId) {
        // FIX: leer el documento histórico actual y hacer un safeMerge para que
        // ningún campo VACIO del state local destruya un valor LLENO del original.
        // Esto soluciona el reporte del Dr. Gustavo donde "verificar + finalizar"
        // dejaba el padecimiento o cualquier sub-campo en blanco si el state lo había perdido.
        const historicoRef = doc(db, "historial_clinico", historicalReview.historialId);
        let historicoOriginal = null;
        try {
          const historicoSnap = await getDoc(historicoRef);
          if (historicoSnap.exists()) {
            historicoOriginal = historicoSnap.data() || {};
          } else {
            historicoOriginal = {};
          }
        } catch (readErr) {
          console.error('[Expediente] No se pudo leer el documento histórico antes de actualizar:', readErr);
          showToast('No se pudo verificar la nota original. Verifica tu conexión e intenta de nuevo.', 'error');
          savingRef.current = false;
          setLoading(false);
          return;
        }

        if (!historicoOriginal) {
          showToast('El documento histórico ya no existe. No se puede actualizar.', 'error');
          savingRef.current = false;
          setLoading(false);
          return;
        }

        const expedienteMergeado = safeMergeForUpdate(historicoOriginal, expedienteFinal);

        const reviewBatch = writeBatch(db);
        reviewBatch.update(historicoRef, {
          ...expedienteMergeado,
          costo: costoSanitizado,
          recetasGeneradas,
          documentosGenerados,
          actualizadoEnConsultaAt: serverTimestamp(),
          actualizadoPorMedicoId: auth.currentUser?.uid || 'anonimo',
          actualizadoPorMedicoNombre: user?.nombre || 'Medico sin nombre'
        });

        await reviewBatch.commit();

        setHistorialCompleto((prev) => (
          Array.isArray(prev)
            ? prev.map((row) => (
              row.id === historicalReview.historialId
                ? {
                  ...row,
                  ...expedienteMergeado,
                  costo: costoSanitizado,
                  recetasGeneradas,
                  documentosGenerados
                }
                : row
            ))
            : prev
        ));
        setExpediente(expedienteMergeado);
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

        // FIX: Sincronizar baseline después de guardar para que el comparador no marque
        // cambios espurios al volver a la consulta actual. Limpiar también respaldo local.
        syncExitBaseline({
          expediente: expedienteMergeado,
          tempMed: DEFAULT_TEMP_MED,
          tempAlergia: DEFAULT_TEMP_ALERGIA,
          tempCirugia: DEFAULT_TEMP_CIRUGIA,
          eventosDocumentales: []
        });
        try {
          localStorage.removeItem(`historical_review_draft_${historicalReview.historialId}`);
        } catch { /* localStorage no disponible */ }

        showToast("Consulta histórica actualizada sin generar una nueva visita.", "success");

        savingRef.current = false;
        setLoading(false);
        return;
      }

      const medicoPerfilSnapshot = {
        nombre: user?.nombre || '',
        cedula: user?.cedula || user?.cedulaProfesional || '',
        cedulaProfesional: user?.cedula || user?.cedulaProfesional || '',
        especialidad: user?.especialidad || '',
        universidadEgreso: user?.universidadEgreso || '',
        sucursal: user?.sucursal || ''
      };

      // --- Fase de lectura: consultar historial previo y datos de cita ---
      let historialRef = null;
      let esActualizacion = false;
      // Datos del registro original (para fusión segura: un campo vacío del state
      // local NUNCA debe pisar un valor lleno ya guardado en la nube).
      let historialOriginalData = null;

      if (citaId) {
        try {
          const queryDuplicados = query(
            collection(db, "historial_clinico"),
            where("citaId", "==", citaId),
            where("pacienteId", "==", pacienteId),
            limit(5)
          );
          const snapDuplicados = await getDocs(queryDuplicados);
          if (!snapDuplicados.empty) {
            const docConsulta = snapDuplicados.docs.find((d) => {
              const data = d.data();
              return data.origenRegistro !== 'enfermeria_agenda'
                && data.origenRegistro !== 'enfermeria_orden_servicio'
                && !data.soloAntecedentes
                && data.tipoNota !== 'Carga de Estudio';
            });
            if (docConsulta) {
              historialRef = docConsulta.ref;
              historialOriginalData = docConsulta.data() || {};
              esActualizacion = true;
            }
          }
        } catch (e) {
          console.warn('No se pudo verificar duplicados, creando nuevo registro:', e);
        }
      }

      let citaDataForBitacora = null;
      let retrasoMin = 0;

      if (citaId) {
        try {
          const citaRef = doc(db, "citas", citaId);
          const citaSnap = await getDoc(citaRef);
          if (citaSnap.exists()) {
            const dataCita = citaSnap.data();
            citaDataForBitacora = dataCita;
            const [fechaProgramada, horaProgramada = '00:00'] = (dataCita.fechaHora || '').split('T');
            const inicioProgramado = fechaProgramada ? new Date(`${fechaProgramada}T${horaProgramada}`) : null;
            if (inicioProgramado && !Number.isNaN(inicioProgramado.getTime())) {
              retrasoMin = Math.max(0, Math.round((consultaInicioRef.current - inicioProgramado) / 60000));
            }
          }
        } catch (e) {
          console.warn('No se pudo leer la cita para retraso/bitácora:', e);
        }
      }

      // --- Fase de escritura atómica: batch con las 4 escrituras core ---
      const batch = writeBatch(db);

      // 1. Actualizar documento del paciente
      if (pacienteUpdateData) {
        batch.update(doc(db, "pacientes", pacienteId), pacienteUpdateData);
      }

      // 2. Crear o actualizar historial_clinico
      if (!esActualizacion) {
        historialRef = doc(collection(db, "historial_clinico"));
        batch.set(historialRef, {
          ...expedienteFinal,
          pacienteId,
          pacienteNombre,
          medicoNombre: user.nombre,
          medicoPerfil: medicoPerfilSnapshot,
          fecha: serverTimestamp(),
          medicoId: auth.currentUser?.uid || "anonimo",
          citaId: citaId || null,
          consultorioId: citaContext.consultorioId || null,
          consultorioNombre: citaContext.consultorioNombre || null,
          costo: costoSanitizado,
          duracionRealMin,
          recetasGeneradas,
          documentosGenerados
        });
      } else {
        // FIX (pérdida de datos): fusión segura contra el registro original.
        // Si el state local perdió texto (recarga, reapertura, otra pestaña/equipo),
        // un campo vacío NO debe borrar el diagnóstico/receta/padecimiento ya guardado.
        const updatePayloadRaw = {
          ...expedienteFinal,
          recetasGeneradas,
          documentosGenerados
        };
        const expedienteSeguro = safeMergeForUpdate(historialOriginalData || {}, updatePayloadRaw);
        batch.update(historialRef, {
          ...expedienteSeguro,
          actualizadoEnConsultaAt: serverTimestamp()
        });
      }

      // 3. Marcar cita como completada
      if (citaId) {
        batch.update(doc(db, "citas", citaId), {
          estado: 'completada',
          consultaFinalizadaAt: serverTimestamp(),
          duracionRealMin,
          retrasoMin,
          costo: costoSanitizado,
          consultaDraft: deleteField(),
          consultaDraftUpdatedAt: deleteField()
        });
      }

      // Commit atómico: todo o nada
      await batch.commit();

      // Actualizar estado local del paciente tras commit exitoso
      if (pacienteUpdateData) {
        setPacienteData(prev => ({
          ...prev,
          grupoSanguineo: grupoSanguineoNormalizado,
          resumenClinico: pacienteUpdateData.resumenClinico,
          antecedentesClinicos: pacienteUpdateData.antecedentesClinicos,
          controlEmbarazoClinico: pacienteUpdateData.controlEmbarazoClinico
        }));
      }

      // --- Fase post-batch: operaciones no críticas (no rompen atomicidad) ---
      try {
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
      } catch (e) {
        console.warn('[Expediente] Error no crítico al escribir bitácora:', e);
      }

      try {
        const telefonoPx = expediente?.px_info?.telefono || pacienteData?.telefonoMovil || '';
        if (telefonoPx && citaId) {
          const functionsInstance = getFunctions();
          const enviarEncuesta = httpsCallable(functionsInstance, 'enviarEncuestaWhatsApp');
          await enviarEncuesta({
            telefono: telefonoPx,
            nombrePaciente: pacienteNombre,
            nombreDoctor: user?.nombre || '',
            citaId,
            pacienteId
          });
        }
      } catch (encuestaError) {
        console.warn('No se pudo enviar encuesta de satisfacción:', encuestaError);
      }

      // --- Limpieza ---
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

      // FIX: Limpiar respaldos locales al guardar exitosamente; quedaron obsoletos
      // y no deben re-aplicarse en la próxima apertura del expediente.
      try {
        if (citaId) localStorage.removeItem(`autosave_draft_${citaId}`);
        localStorage.removeItem(`emergency_draft_${pacienteId}_${citaId || 'nocita'}`);
      } catch { /* localStorage no disponible */ }

      saveCompletedRef.current = true;
      showToast("Expediente guardado correctamente.", "success");
      setTimeout(() => goBackOr(navigate, exitFallbackPath), 1500);

    } catch (e) {
      console.error('[Expediente] Error en executeSave:', e);

      // Respaldo de emergencia en localStorage para no perder datos clínicos
      let emergenciaGuardada = false;
      try {
        const emergencyKey = `emergency_draft_${pacienteId}_${citaId || 'nocita'}`;
        const expedienteFallback = { ...expediente };
        // Incluir temp forms pendientes
        if (tempMed?.nombre?.trim()) {
          const lista = expedienteFallback.consulta?.diagnostico?.tratamiento_lista || [];
          expedienteFallback.consulta.diagnostico.tratamiento_lista = [...lista, tempMed];
        }
        localStorage.setItem(emergencyKey, JSON.stringify({
          expediente: expedienteFallback,
          pacienteId,
          pacienteNombre,
          citaId: citaId || null,
          timestamp: new Date().toISOString(),
          error: e.message || 'Error desconocido'
        }));
        emergenciaGuardada = true;
        console.warn('[Expediente] Datos guardados en localStorage como respaldo de emergencia:', emergencyKey);
      } catch (lsErr) {
        console.error('[Expediente] No se pudo guardar respaldo en localStorage:', lsErr);
      }

      if (isEnfermeriaDocumentMode) {
        showToast("No se pudo guardar el expediente. Regresando a enfermería.", "info");
        setTimeout(() => goBackOr(navigate, exitFallbackPath), 800);
      } else if (emergenciaGuardada) {
        showToast(
          "Error al guardar en la nube. Se guardó una copia local. No cierre esta ventana e intente de nuevo.",
          "error"
        );
      } else {
        showToast(
          "Error grave al guardar. No se pudo crear respaldo local. Contacte a soporte técnico.",
          "error"
        );
      }
    }
    savingRef.current = false;
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

    const referenciasLista = exp?.consulta?.referencias_medicas?.seleccionadas || [];
    const referenciasOffset = tratamientoLista.length + estudiosLista.length + procedimientosLista.length;

    const referenciasTexto = (() => {
      const parts = [];
      referenciasLista.forEach((ref, idx) => {
        if (!ref || typeof ref !== 'object') return;
        const nombreMedico = String(ref.nombreMedico || '').trim();
        if (!nombreMedico) return;

        const lineas = [`${referenciasOffset + idx + 1}. ${nombreMedico.toUpperCase()} (${(ref.especialidad || '').toUpperCase()} · ${getTipoCitaLabel(ref.tipoCita).toUpperCase()})${ref.esUrgente ? ' - URGENTE' : ''}`];

        if (ref.telefonoConsultorio) lineas.push(`   Telefono: ${ref.telefonoConsultorio}`);
        if (ref.direccionConsultorio) lineas.push(`   Direccion: ${ref.direccionConsultorio}`);
        if (ref.datosExtras) lineas.push(`   ${ref.datosExtras}`);
        if (ref.notas) lineas.push(`   Notas: ${ref.notas}`);
        if (ref.diagnostico) lineas.push(`   Diagnostico: ${ref.diagnostico}`);

        parts.push(lineas.join('\n'));
      });

      return parts.length > 0 ? parts.join('\n') : '';
    })();

    const referenciasHtml = (() => {
      let html = '';
      if (referenciasLista.length > 0) {
        html += `<ol start="${referenciasOffset + 1}">`;
        referenciasLista.forEach((ref) => {
          if (!ref || typeof ref !== 'object') return;
          const nombreMedico = esc(String(ref.nombreMedico || '').trim());
          if (!nombreMedico) return;

          const titulo = `<strong>${nombreMedico.toUpperCase()}</strong> <em>(${esc(ref.especialidad || '').toUpperCase()} · ${esc(getTipoCitaLabel(ref.tipoCita)).toUpperCase()})</em>`;
          const urgenteTag = ref.esUrgente ? ' <strong style="color:#e11d48;">URGENTE</strong>' : '';

          let itemHtml = `<li>${titulo}${urgenteTag}`;

          if (ref.telefonoConsultorio) itemHtml += `<br/><span style="margin-left:16px;">Telefono: ${esc(ref.telefonoConsultorio)}</span>`;
          if (ref.direccionConsultorio) itemHtml += `<br/><span style="margin-left:16px;">Direccion: ${esc(ref.direccionConsultorio)}</span>`;
          if (ref.datosExtras) itemHtml += `<br/><span style="margin-left:16px;">${esc(ref.datosExtras)}</span>`;
          if (ref.notas) itemHtml += `<br/><span style="margin-left:16px;">Notas: ${esc(ref.notas)}</span>`;
          if (ref.diagnostico) itemHtml += `<br/><span style="margin-left:16px;">Diagnostico: ${esc(ref.diagnostico)}</span>`;

          itemHtml += '</li>';
          html += itemHtml;
        });
        html += '</ol>';
      }
      return html;
    })();

    const fechaRecetaRaw = exp?.fechaConsulta
      || exp?.consulta?.fecha
      || exp?.createdAt
      || exp?.created_at
      || new Date().toISOString();
    const fechaRecetaDate = parseFirestoreDate(fechaRecetaRaw) || new Date();

    const baseUserFuente = userProfileDoc || user || {};
    const userFuente = doctorOverride || baseUserFuente;
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
    const alergiasTexto = alergiasDesdeAntecedentes || String(exp?.px_info?.alergias_base || '').trim() || 'Interrogadas y negadas';

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
        nombre: exp?.medicoPerfil?.nombre || exp?.medicoNombre || doctorOverride?.nombre || user?.nombre || '',
        cedula: exp?.medicoPerfil?.cedula || exp?.medicoPerfil?.cedulaProfesional || doctorOverride?.cedula || doctorOverride?.cedulaProfesional || user?.cedula || user?.cedulaProfesional || '',
        cedula_profesional: exp?.medicoPerfil?.cedula || exp?.medicoPerfil?.cedulaProfesional || doctorOverride?.cedula || doctorOverride?.cedulaProfesional || user?.cedula || user?.cedulaProfesional || '',
        especialidad: exp?.medicoPerfil?.especialidad || doctorOverride?.especialidad || user?.especialidad || '',
        universidad_egreso: exp?.medicoPerfil?.universidadEgreso || doctorOverride?.universidadEgreso || user?.universidadEgreso || '',
        centro_estudios: exp?.medicoPerfil?.universidadEgreso || doctorOverride?.universidadEgreso || user?.universidadEgreso || '',
        sucursal: exp?.medicoPerfil?.sucursal || doctorOverride?.sucursal || user?.sucursal || ''
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
        referencias_texto: referenciasTexto,
        referencias_html: referenciasHtml,
        referencias_conteo: String(referenciasLista.length),
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
          if (referenciasTexto) {
            secciones.push('');
            secciones.push(referenciasTexto);
          }
          const indicacionesRaw = exp?.consulta?.diagnostico?.indicaciones || '';
          if (indicacionesRaw.trim()) {
            secciones.push('');
            secciones.push('Indicaciones:');
            secciones.push(indicacionesRaw);
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
    const tieneReferencias = (c?.referencias_medicas?.seleccionadas?.length || 0) > 0;
    return tieneSignos || tieneAntropometria || tienePadecimiento || tieneDiagnostico || tieneTratamiento || tieneIndicaciones || tieneEstudios || tieneProcedimientos || tieneReferencias;
  };

  // Igual que el anterior pero EXCLUYE los signos vitales/antropometría, porque
  // esos los rellena solo el triage de enfermería. Sirve para detectar consultas
  // que se finalizarían "en blanco" (solo signos, sin nada que el médico capturó).
  const consultaTieneContenidoMedico = () => {
    const c = expediente.consulta;
    const tienePadecimiento = String(c?.padecimiento || '').trim() !== '';
    const tieneDiagnostico = String(c?.diagnostico?.enfermedad_actual || '').trim() !== '';
    const tieneTratamiento = (c?.diagnostico?.tratamiento_lista?.length || 0) > 0 || String(tempMed?.nombre || '').trim() !== '';
    const tieneIndicaciones = String(c?.diagnostico?.indicaciones || '').trim() !== '';
    const tieneEstudios = (c?.estudios?.paquetes_seleccionados?.length || 0) > 0 || (c?.estudios?.estudios_seleccionados?.length || 0) > 0;
    const tieneProcedimientos = (c?.procedimientos?.seleccionados?.length || 0) > 0;
    const tieneReferencias = (c?.referencias_medicas?.seleccionadas?.length || 0) > 0;
    return tienePadecimiento || tieneDiagnostico || tieneTratamiento || tieneIndicaciones || tieneEstudios || tieneProcedimientos || tieneReferencias;
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

    playSoftBeep(440, 0.15);
    setTimeout(() => playSoftBeep(350, 0.2), 200);
    setExitChangeList(changes);
    setShowExitAlert(true);
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex flex-col overflow-hidden text-slate-800 font-sans selection:bg-blue-100 relative">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

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
                  <div className={`flex items-center gap-1 px-1.5 py-px rounded border text-[9px] font-black uppercase tracking-wide cursor-pointer transition-all ${expediente.px_info.grupo_sanguineo
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
                {pacienteData?.sexo === 'Femenino' && expediente.px_info.es_embarazada && (
                  <button
                    onClick={() => setShowMenuQx(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[9px] font-black bg-pink-50 text-pink-700 border-pink-300 uppercase tracking-wide hover:bg-pink-100 transition-all"
                  >
                    <Baby size={9} className="fill-pink-400" />
                    {expediente.px_info.sdg ? expediente.px_info.sdg : 'EMBARAZADA'}
                  </button>
                )}
                {expediente.px_info.requiere_cirugia?.general && (
                  <button
                    onClick={() => setShowMenuQx(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[9px] font-black bg-amber-50 text-amber-700 border-amber-300 uppercase tracking-wide hover:bg-amber-100 transition-all"
                  >
                    <Scissors size={9} />QX Gral
                  </button>
                )}
                {expediente.px_info.requiere_cirugia?.ginecologica && (
                  <button
                    onClick={() => setShowMenuQx(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[9px] font-black bg-amber-50 text-amber-700 border-amber-300 uppercase tracking-wide hover:bg-amber-100 transition-all"
                  >
                    <Scissors size={9} />QX Ginec
                  </button>
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
          <HeaderTab icon={<Activity size={15} />} label="Resumen" active={activeMainTab === 'resumen'} visited={visitedTabs.has('resumen')} onClick={() => handleTabChange('resumen')} color="emerald" />
          <div className={`w-4 h-px ${visitedTabs.has('antecedentes') ? 'bg-slate-400' : 'bg-slate-300'}`}></div>
          <HeaderTab icon={<ClipboardList size={15} />} label="Historial" active={activeMainTab === 'antecedentes'} visited={visitedTabs.has('antecedentes')} onClick={() => handleTabChange('antecedentes')} color="violet" />
          <div className={`w-4 h-px ${visitedTabs.has('consulta') ? 'bg-slate-400' : 'bg-slate-300'}`}></div>
          <HeaderTab icon={<Stethoscope size={15} />} label="Consulta" active={activeMainTab === 'consulta'} visited={visitedTabs.has('consulta')} onClick={() => handleTabChange('consulta')} color="blue" />
        </div>

        <div className="flex items-center gap-1.5">

          {/* ── ESTADO DEL PACIENTE ── */}
          <div className="relative">
            <button
              onClick={() => setShowMenuQx(!showMenuQx)}
              title="Requerimientos Qx / Estado Obstétrico"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all
                ${(expediente.px_info.requiere_cirugia?.general || expediente.px_info.requiere_cirugia?.ginecologica || expediente.px_info.es_embarazada)
                  ? 'bg-rose-50 text-rose-600 border-rose-300 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              {pacienteData.sexo === 'Femenino' ? <Baby size={14} /> : <Scissors size={14} />}
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wide">
                {pacienteData.sexo === 'Femenino' ? 'Obs / Qx' : 'Qx'}
              </span>
            </button>

            {showMenuQx && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenuQx(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/8 z-20 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right border border-slate-200">

                  {/* Header del panel */}
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pacienteData.sexo === 'Femenino' ? <Baby size={15} className="text-pink-500" /> : <Scissors size={15} className="text-amber-500" />}
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        {pacienteData.sexo === 'Femenino' ? 'Estado Obstétrico y Quirúrgico' : 'Requerimientos Quirúrgicos'}
                      </span>
                    </div>
                    <button onClick={() => setShowMenuQx(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 transition-colors">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="p-5 space-y-5">

                    {/* SECCIÓN: Requerimientos QX */}
                    <div>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Scissors size={10} /> Requerimientos Quirúrgicos
                      </p>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-3 cursor-pointer px-3 py-2 rounded-xl border border-transparent hover:bg-amber-50 hover:border-amber-100 transition-all">
                          <input type="checkbox" className="w-4 h-4 accent-amber-500 rounded flex-shrink-0"
                            checked={expediente.px_info.requiere_cirugia?.general || false}
                            onChange={(e) => updateCampo('px_info.requiere_cirugia.general', e.target.checked)} />
                          <div>
                            <span className="text-sm font-bold text-slate-700 block">Cirugía General</span>
                            <span className="text-[10px] text-slate-400">Procedimiento quirúrgico no especializado</span>
                          </div>
                        </label>
                        {pacienteData.sexo === 'Femenino' && (
                          <label className="flex items-center gap-3 cursor-pointer px-3 py-2 rounded-xl border border-transparent hover:bg-amber-50 hover:border-amber-100 transition-all">
                            <input type="checkbox" className="w-4 h-4 accent-amber-500 rounded flex-shrink-0"
                              checked={expediente.px_info.requiere_cirugia?.ginecologica || false}
                              onChange={(e) => updateCampo('px_info.requiere_cirugia.ginecologica', e.target.checked)} />
                            <div>
                              <span className="text-sm font-bold text-slate-700 block">Cirugía Ginecológica</span>
                              <span className="text-[10px] text-slate-400">Procedimiento ginecológico especializado</span>
                            </div>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* SECCIÓN: Estado Obstétrico (solo Femenino) */}
                    {pacienteData.sexo === 'Femenino' && (
                      <>
                        <div className="border-t border-slate-100"></div>
                        <div>
                          <p className="text-[10px] font-black text-pink-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Baby size={10} /> Estado Obstétrico
                          </p>

                          {/* FUM */}
                          <div className="mb-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha de Última Menstruación (F.U.M.)</label>
                            <input
                              type="date"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300"
                              value={expediente.px_info.fum}
                              onChange={(e) => updateCampo('px_info.fum', e.target.value)}
                            />
                          </div>

                          {/* Checkbox embarazo */}
                          <label className="flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl border border-transparent hover:bg-pink-50 hover:border-pink-100 transition-all mb-3">
                            <input type="checkbox" className="w-4 h-4 accent-pink-600 rounded flex-shrink-0"
                              checked={expediente.px_info.es_embarazada || false}
                              onChange={(e) => updateCampo('px_info.es_embarazada', e.target.checked)} />
                            <div>
                              <span className="text-sm font-bold text-slate-700 block">¿Existe Embarazo?</span>
                              <span className="text-[10px] text-slate-400">Marcar si la paciente está actualmente embarazada</span>
                            </div>
                          </label>

                          {/* SDG + FPP (solo si embarazada) */}
                          {expediente.px_info.es_embarazada && (
                            <div className="space-y-3 animate-in fade-in">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 text-center">
                                  <span className="block text-[9px] font-black text-pink-400 uppercase tracking-widest mb-1">Semanas de Gestación</span>
                                  <span className="text-base font-black text-pink-700">{expediente.px_info.sdg || '--'}</span>
                                </div>
                                <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 text-center">
                                  <span className="block text-[9px] font-black text-pink-400 uppercase tracking-widest mb-1">Fecha Probable de Parto</span>
                                  <span className="text-xs font-black text-pink-700">{expediente.px_info.fpp || '--'}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => { setShowMenuQx(false); setShowEmbarazoModal(true); }}
                                className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-600/20 transition-all flex items-center justify-center gap-2"
                              >
                                <Baby size={14} />
                                Ver / Editar Control de Embarazo y Alto Riesgo
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
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
                        fechaConsulta: fechaHist ? fechaHist.toISOString() : null,
                        medicoNombre: historicalData.medicoNombre || '',
                        medicoPerfil: historicalData.medicoPerfil || null
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
          paciente={{ ...pacienteData, nombre: pacienteNombre }}
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
          medicoNombre={user.nombre}
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
                <h3 className="exp-sora text-3xl font-black tracking-tighter" style={{ color: 'var(--slate-900)' }}>Acciones del Expediente</h3>
                <p className="font-medium mt-1" style={{ color: 'var(--slate-500)' }}>Selecciona una herramienta para el paciente <span className="font-bold" style={{ color: 'var(--blue-600)' }}>{pacienteNombre}</span></p>
              </div>
              <button onClick={() => setShowActionsMenu(false)} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 exp-scroll">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <ActionCard title="Ver Historia Clínica" subtitle="Línea de tiempo" icon={<ClipboardList size={32} />} color="bg-blue-500" onClick={handleVerHistoria} />
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
                <ActionCard title="Plantillas" subtitle="Documentos de administracion" icon={<FileText size={32} />} color="bg-orange-500" onClick={() => { setShowFormatSelector(true); setShowActionsMenu(false); }} />
                <ActionCard title="Agregar Estudio" subtitle="Subir resultado externo" icon={<PlusSquare size={32} />} color="bg-teal-500" onClick={() => { setShowEstudioModal(true); setShowActionsMenu(false); }} />
                <ActionCard title="Historial Estudios" subtitle="Ver laboratorio previo" icon={<HistoryIcon size={32} />} color="bg-blue-600" onClick={() => { setShowHistoricoEstudios(true); setShowActionsMenu(false); }} />
                {pacienteData?.sexo === 'Femenino' && <ActionCard title="Histórico Embarazos" subtitle="Control prenatal" icon={<Baby size={32} />} color="bg-rose-500" onClick={() => { setShowHistoricoEmbarazos(true); setShowActionsMenu(false); }} />}
                <ActionCard title="Negatoscopio" subtitle="Visor de imágenes médicas" icon={<Monitor size={32} />} color="bg-slate-700" onClick={() => { setShowNegatoscopio(true); setShowActionsMenu(false); }} />
                <ActionCard title="Calculadora de Dosis" subtitle="Dosis por peso y dilución" icon={<Calculator size={32} />} color="bg-emerald-600" onClick={() => { setShowCalculadoraDosis(true); setShowActionsMenu(false); }} />
                <ActionCard title="Traspasar PX" subtitle="Transferir a otro médico" icon={<ArrowLeftRight size={32} />} color="bg-cyan-600" onClick={() => { setShowActionsMenu(false); setTraspasarData({ doctorUid: '', doctorNombre: '', justificacion: '' }); setShowTraspasarModal(true); }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL TRASPASAR PACIENTE --- */}
      {showTraspasarModal && (
        <div className="fixed inset-0 z-[175] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-sm">
              <div>
                <h3 className="exp-sora text-xl font-black tracking-tighter" style={{ color: 'var(--slate-900)' }}>Traspasar Paciente</h3>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--slate-500)' }}>
                  Transferir <span className="font-bold" style={{ color: 'var(--blue-600)' }}>{pacienteNombre}</span> a otro médico
                </p>
              </div>
              <button onClick={() => { setShowTraspasarModal(false); setTraspasarData({ doctorUid: '', doctorNombre: '', justificacion: '' }); }} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Médico destino</label>
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                  {doctoresCatalogo.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-400 text-center">No hay médicos disponibles</p>
                  ) : (
                    doctoresCatalogo.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setTraspasarData(prev => ({ ...prev, doctorUid: doc.id, doctorNombre: doc.nombre }))}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                          traspasarData.doctorUid === doc.id
                            ? 'bg-cyan-50 text-cyan-700 border-l-2 border-cyan-500'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Dr. {doc.nombre}
                      </button>
                    ))
                  )}
                </div>
                {traspasarData.doctorNombre && (
                  <p className="text-xs text-cyan-600 font-medium mt-1.5">
                    Médico seleccionado: <span className="font-bold">Dr. {traspasarData.doctorNombre}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Justificación <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={traspasarData.justificacion}
                  onChange={(e) => setTraspasarData(prev => ({ ...prev, justificacion: e.target.value }))}
                  placeholder="Describe el motivo de la transferencia..."
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button
                onClick={() => { setShowTraspasarModal(false); setTraspasarData({ doctorUid: '', doctorNombre: '', justificacion: '' }); }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleTraspasarPaciente}
                disabled={traspasarLoading || !traspasarData.doctorUid}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-bold text-sm hover:bg-cyan-700 transition-colors disabled:opacity-50 shadow-sm shadow-cyan-600/20"
              >
                {traspasarLoading ? 'Transfiriendo...' : 'Confirmar Transferencia'}
              </button>
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
                <h3 className="exp-sora text-3xl font-black tracking-tighter" style={{ color: 'var(--slate-900)' }}>Plantillas Disponibles</h3>
                <p className="font-medium mt-1" style={{ color: 'var(--slate-500)' }}>Documentos configurados por administración</p>
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
                  <X size={24} />
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
                <h3 className="exp-sora text-2xl font-black tracking-tight" style={{ color: 'var(--slate-900)' }}>Plantilla de Receta</h3>
                <p className="font-medium mt-1 text-sm" style={{ color: 'var(--slate-500)' }}>Elige una plantilla para imprimir la receta de este paciente.</p>
              </div>
              <button onClick={() => { pendingExitAfterRecipePrintRef.current = false; expedienteParaRecetaRef.current = null; setShowRecipeTemplateSelector(false); }} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={22} /></button>
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

      {showEmptyClinicalAlert && (
        <div className="fixed inset-0 z-[210] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="bg-red-100 text-red-600 p-3 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Consulta sin datos clínicos</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Esta consulta <strong>no tiene padecimiento, diagnóstico, receta ni estudios</strong> capturados (solo signos vitales).
                </p>
                <p className="text-sm font-bold text-slate-800 mt-2">
                  Si finalizas ahora, la consulta quedará guardada en blanco. ¿Estás seguro?
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Si tú escribiste un diagnóstico o receta y no aparece, NO finalices: cierra y vuelve a abrir la consulta para recuperar la información.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEmptyClinicalAlert(false)}
                className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-50 rounded-lg transition-colors"
              >
                Volver a la consulta
              </button>
              <button
                onClick={continuarGuardar}
                className="px-6 py-2 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 shadow-lg transition-all"
              >
                Finalizar en blanco
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
const ActionCard = ({ title, subtitle, icon, color, onClick }) => (
  <button title={title} onClick={onClick} className="group bg-white p-6 rounded-2xl border text-left flex flex-col gap-3 transition-all hover:-translate-y-0.5" style={{ borderColor: 'rgba(226,232,240,.8)', boxShadow: '0 1px 2px rgba(15,23,42,.05)' }}>
    <div className={`w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center`} style={{ boxShadow: '0 4px 8px rgba(0,0,0,.12)' }}>
      {icon}
    </div>
    <div>
      <h4 className="exp-sora text-base font-semibold leading-tight transition-colors" style={{ color: 'var(--slate-800)' }}>{title}</h4>
      <p className="text-xs font-medium mt-1" style={{ color: 'var(--slate-500)' }}>{subtitle}</p>
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
    blue: { active: 'bg-white text-blue-700 shadow-sm', visited: 'text-blue-600 hover:bg-white/60', idle: 'text-slate-400 hover:text-slate-600 hover:bg-white/40' },
    emerald: { active: 'bg-white text-emerald-700 shadow-sm', visited: 'text-emerald-600 hover:bg-white/60', idle: 'text-slate-400 hover:text-slate-600 hover:bg-white/40' },
    violet: { active: 'bg-white text-violet-700 shadow-sm', visited: 'text-violet-600 hover:bg-white/60', idle: 'text-slate-400 hover:text-slate-600 hover:bg-white/40' },
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