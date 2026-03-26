// src/pages/doctor/ExpedienteClinico.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Save, ArrowLeft, FileText, History, ClipboardList, Calendar,
  ChevronRight, Images, Send, FileOutput, FileSignature, PlusSquare,
  History as HistoryIcon, User, Clock, Activity, LayoutGrid, Stethoscope,
  Droplet, Baby, Scissors, AlertTriangle, X, Printer,
  FlaskConical, Syringe, FileBadge, ShieldCheck, CheckCircle2, AlertCircle, HeartHandshake
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { goBackOr } from '../../utils/navigation';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { db, auth } from "../../config/firebase";
import { 
  doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, 
  query, where, orderBy, getDocs, limit, runTransaction, setDoc 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext'; 

// Importación de las secciones y componentes
import SeccionConsulta from './expediente/SeccionConsulta';
import SeccionAntecedentes from './expediente/SeccionAntecedentes';
import SeccionResumen from './expediente/SeccionResumen';
import FormatoReceta from '../../components/FormatoReceta'; 
import HistoriaClinicaModal from '../../components/HistoriaClinicaModal';
import EstudioPrevioModal from '../../components/EstudioPrevioModal';
import HistoricoEstudiosModal from '../../components/HistoricoEstudiosModal';
import HistoricoEmbarazosModal from '../../components/HistoricoEmbarazosModal';
import { listLegacyLinksByPaciente } from '../../services/patientLinkService';
import { createClinicalAuditRecord, validateClinicalRecord } from '../../services/clinicalAuditService';
import AvatarPaciente from '../../components/AvatarPaciente';

const legacyHtmlModules = import.meta.glob('../../../historialmedico/*.html', {
  query: '?url',
  import: 'default'
});

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
        <div className="flex gap-2">
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

const ExpedienteClinico = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); 
  const { pacienteId, citaId, motivo } = location.state || {};
  
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
  const [showMenuQx, setShowMenuQx] = useState(false); 
  const [plantillasDinamicas, setPlantillasDinamicas] = useState([]);
  const [plantillaRecetaPreferidaId, setPlantillaRecetaPreferidaId] = useState('');
  const [plantillaActiva, setPlantillaActiva] = useState(null);
  const [notification, setNotification] = useState(null); 
  const [showPrintAlert, setShowPrintAlert] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('consulta'); 
  const [activeConsulta, setActiveConsulta] = useState('padecimiento');
  const [pacienteNombre, setPacienteNombre] = useState('');
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
  const [tempMed, setTempMed] = useState({ nombre: '', dosis: '', presentacion: '', sustanciasActivas: '', numeroAcomodo: '' });
  const [tempAlergia, setTempAlergia] = useState({ nombre: '' });
  const [tempCirugia, setTempCirugia] = useState({ 
    procedimiento: '', operacion: '', nota: '', unidad: '', 
    tipoFecha: 'fecha', ano: '2024', fechaHora: '', diagnostico: '' 
  });
  const consultaInicioRef = useRef(new Date());
  const direccionDebugRef = useRef('');

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

  const showToast = (msg, type='info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
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
        otros: ""
      },
      no_patologicos: { bano: "", lavado_dientes: "", habitacion: "", alimentacion: "", sedentarismo: "", otros: "" },
      patologicos: {
        actuales: "", quirurgicos: "", transfusionales: "", traumaticos: "", hospitalizaciones: "",
        adicciones: { tabaquismo: false, alcohol: false, drogas: false, detalle: "" },
        especificos: { glaucoma: "", calculo: "", reflujo: "", incontinencia: "", dislipidemias: "", otro: "" }
      },
      aparatos: { 
        digestivo: "", cardiovascular: "", respiratorio: "", urinario: "", genital: "", hematologico: "",
        endocrino: "", osteomuscular: "", nervioso: "", sensorial: "", psicosomatico: "", otro: ""
      },
      alergias: { tipo: "Medicamento", buscar_sustancia: false, lista: [], otras: "" },
      vacunas: { lista: [], otras: "" },
      cirugias: { lista: [] },
      cie10: []
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
      estudios: { paquetes_seleccionados: [], estudios_seleccionados: [], notas_generales: "" }
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
    const cargarConsultorios = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc')));
        const rows = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((item) => item.activo !== false);
        setConsultoriosCatalogo(rows);
      } catch (error) {
        console.error('Error cargando catálogo de consultorios', error);
        setConsultoriosCatalogo([]);
      }
    };

    cargarConsultorios();
  }, []);

  useEffect(() => {
    const cargarSucursales = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc')));
        const rows = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((item) => item.activo !== false);
        setSucursalesCatalogo(rows);
      } catch (error) {
        console.error('Error cargando catálogo de sucursales', error);
        setSucursalesCatalogo([]);
      }
    };

    cargarSucursales();
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
      const consultorioId = String(perfil?.consultorioActualId || '').trim();
      const consultorioNombre = String(perfil?.consultorioActual || perfil?.consultorioRecurrente || perfil?.consultorio || '').trim();
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
          || filtrar(consultorioResuelto?.ubicacion)
          || filtrar(consultorioResuelto?.ubicacionConsultorio)
          || filtrar(consultorioResuelto?.direccion)
          || filtrar(consultorioResuelto?.domicilio)
          || '',
        sucursalId: String(perfil?.sucursalActualId || consultorioResuelto?.sucursalId || '').trim(),
        sucursalNombre: String(perfil?.sucursalActual || perfil?.sucursal || consultorioResuelto?.sucursal || '').trim(),
        sucursalDireccion: String(perfil?.direccionSucursal || '').trim(),
        sucursalTelefono: String(perfil?.telefonoSucursal || perfil?.telefonoConsultorio || '').trim()
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
      try {
        // 1. OBTENER TODO EN PARALELO
        const [pxSnap, historialSnap, citaSnap] = await Promise.all([
            getDoc(doc(db, "pacientes", pacienteId)),
            getDocs(query(collection(db, "historial_clinico"), where("pacienteId", "==", pacienteId), orderBy("fecha", "desc"), limit(1))),
            citaId ? getDoc(doc(db, "citas", citaId)) : Promise.resolve(null)
        ]);

        let nuevosDatos = { ...expediente }; 

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
            alergias_base: dataPx.notasPersonales || '' 
          };
        }

        // 3. PROCESAR HISTORIAL PREVIO
        if (!historialSnap.empty) {
          const ultimo = historialSnap.docs[0].data();
          if (ultimo.antecedentes) nuevosDatos.antecedentes = ultimo.antecedentes;
          if (ultimo.control_embarazo) nuevosDatos.control_embarazo = ultimo.control_embarazo;
        }

        // 4. PROCESAR DATOS DE LA CITA (TRIAGE)
        if (citaSnap && citaSnap.exists()) {
          const dataCita = citaSnap.data();

          setCitaContext({
            consultorioId: dataCita.consultorioId || dataCita.consultorio?.id || '',
            consultorioNombre: dataCita.consultorioNombre || dataCita.consultorio || '',
            consultorioDireccion: dataCita.consultorioUbicacion || dataCita.consultorioDireccion || dataCita.consultorioDomicilio || '',
            sucursalId: dataCita.sucursalId || '',
            sucursalNombre: dataCita.sucursal || dataCita.sucursalNombre || '',
            sucursalDireccion: dataCita.sucursalUbicacion || dataCita.sucursalDireccion || '',
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
            if (draftServer.consulta) nuevosDatos.consulta = draftServer.consulta;
            if (draftServer.antecedentes) nuevosDatos.antecedentes = draftServer.antecedentes;
            if (draftServer.control_embarazo) nuevosDatos.control_embarazo = draftServer.control_embarazo;
            if (draftServer.meta?.costo) nuevosDatos.meta.costo = draftServer.meta.costo;
            if (draftServer.tempMed) setTempMed(draftServer.tempMed);
            if (draftServer.tempAlergia) setTempAlergia(draftServer.tempAlergia);
            if (draftServer.tempCirugia) setTempCirugia(draftServer.tempCirugia);
            if (draftServer.px_info) {
              nuevosDatos.px_info = {
                ...nuevosDatos.px_info,
                ...draftServer.px_info
              };
            }
          }

          if (dataCita.consultaIniciadaAt?.toDate) {
            consultaInicioRef.current = dataCita.consultaIniciadaAt.toDate();
          } else {
            consultaInicioRef.current = new Date();
            await updateDoc(doc(db, "citas", citaId), {
              consultaIniciadaAt: serverTimestamp(),
              estado: 'en_consulta'
            });
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

          // C) ALERGIAS DE TRIAGE (MEJORADO)
          if (dataCita.triage_alergias) {
             const nueva = dataCita.triage_alergias;
             
             // 1. Insertar en Ficha Técnica (Para alertas rápidas e IA)
             const baseInfo = nuevosDatos.px_info.alergias_base || '';
             if (!baseInfo.includes(nueva)) {
                 nuevosDatos.px_info.alergias_base = baseInfo ? `${baseInfo} / ${nueva} (Triage)` : nueva;
             }

             // 2. Insertar en Sección Antecedentes -> Alergias -> Otras (Para que el doctor lo vea en la lista)
             // Aseguramos que existe la estructura antes de escribir
             if (!nuevosDatos.antecedentes.alergias) nuevosDatos.antecedentes.alergias = { lista: [], otras: '' };
             
             const baseOtras = nuevosDatos.antecedentes.alergias.otras || '';
             // Solo agregamos si no está ya escrito para no duplicar texto
             if (!baseOtras.includes(nueva)) {
                 nuevosDatos.antecedentes.alergias.otras = baseOtras 
                    ? `${baseOtras}. Reportado en Triage: ${nueva}` 
                    : `Reportado en Triage: ${nueva}`;
             }
          }
        }

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

      } catch (e) {
        console.error(e);
        showToast("Error cargando expediente", "error");
      }
      setLoading(false);
    };

    fetchDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, citaId]);
  
  useEffect(() => {
    if (!pacienteId || !citaId || loading) return;

    const timer = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "citas", citaId), {
          consultaDraft: {
            consulta: expediente.consulta,
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
    tempCirugia
  ]);

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

    if (tieneReceta || tieneEstudios) {
        setShowPrintAlert(true);
    } else {
        executeSave();
    }
  };

  const executeSave = async () => {
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

      const validation = validateClinicalRecord(expedienteFinal, {
        pacienteId,
        medicoNombre: user?.nombre || ''
      });

      if (validation.status === 'critico') {
        showToast(`No se puede guardar. Faltan campos criticos: ${validation.missingCritical.join(', ')}`, 'error');
        setLoading(false);
        return;
      }

      if (pacienteId) {
        try {
          await updateDoc(doc(db, "pacientes", pacienteId), {
            grupoSanguineo: grupoSanguineoNormalizado
          });
          setPacienteData(prev => ({ ...prev, grupoSanguineo: grupoSanguineoNormalizado }));
        } catch (errorPaciente) {
          console.warn("No se pudo actualizar grupo sanguíneo en paciente", errorPaciente);
        }
      }

      const historialRef = await addDoc(collection(db, "historial_clinico"), { 
          ...expedienteFinal, 
          pacienteId, 
          pacienteNombre, 
          medicoNombre: user.nombre, 
          fecha: serverTimestamp(), 
          medicoId: auth.currentUser?.uid || "anonimo",
          citaId: citaId || null,
          costo: costoSanitizado,
          duracionRealMin,
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

      if (citaId) {
        const citaRef = doc(db, "citas", citaId);
        const citaSnap = await getDoc(citaRef);
        let retrasoMin = 0;

        if (citaSnap.exists()) {
          const dataCita = citaSnap.data();
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
      
      setTempMed({ nombre: '', dosis: '', presentacion: '', sustanciasActivas: '', numeroAcomodo: '' });
      setTempAlergia({ nombre: '' });
      setTempCirugia({ procedimiento: '', operacion: '', nota: '', unidad: '', tipoFecha: 'fecha', ano: '2024', fechaHora: '', diagnostico: '' });

      showToast("Expediente guardado correctamente.", "success");
      if (validation.status === 'incompleto') {
        showToast(`Guardado con observaciones de auditoria: ${validation.missingRecommended.join(', ')}`, 'info');
      }
      setTimeout(() => goBackOr(navigate, '/agenda'), 1500);

    } catch(e) { 
        console.error(e);
        showToast("Error al guardar el expediente", "error"); 
    }
    setLoading(false);
  };

  const resolverTextoPlantilla = (texto = '') => {
    const tratamientoLista = expediente?.consulta?.diagnostico?.tratamiento_lista || [];
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

    const estudiosLista = expediente?.consulta?.estudios?.estudios_seleccionados || [];
    const paquetesLista = expediente?.consulta?.estudios?.paquetes_seleccionados || [];
    const notasEstudios = expediente?.consulta?.estudios?.notas_generales || '';

    const estudiosTexto = (() => {
      const parts = [];
      if (paquetesLista.length > 0) parts.push('Paquetes: ' + paquetesLista.join(', '));
      if (estudiosLista.length > 0) {
        estudiosLista.forEach((est, idx) => {
          const item = typeof est === 'string' ? est : (est.nombre || '');
          const nota = typeof est === 'object' && est.nota ? ` (${est.nota})` : '';
          parts.push(`${idx + 1}. ${item}${nota}`);
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
        html += '<ol>';
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

    const fechaRecetaRaw = expediente?.fechaConsulta
      || expediente?.consulta?.fecha
      || expediente?.createdAt
      || expediente?.created_at
      || new Date().toISOString();
    const fechaRecetaDate = parseFirestoreDate(fechaRecetaRaw) || new Date();

    const userFuente = userProfileDoc || user || {};
    const sucursalNombre = citaContext?.sucursalNombre || userFuente?.sucursalActual || userFuente?.sucursal || userFuente?.nombreSucursal || '';
    const sucursalTelefono = citaContext?.sucursalTelefono || userFuente?.telefonoSucursal || userFuente?.telefonoConsultorio || userFuente?.telefono || '';
    const sucursalDireccion = citaContext?.sucursalDireccion || userFuente?.direccionSucursal || userFuente?.direccionConsultorio || userFuente?.direccion || '';
    const sucursalHorario = userFuente?.horarioSucursal || userFuente?.horarioConsultorio || '';
    const telefonoQuejas = userFuente?.telefonoQuejas || userFuente?.quejasSugerencias || sucursalTelefono || '';
    const grupoSanguineo = expediente?.px_info?.grupo_sanguineo || pacienteData?.grupoSanguineo || pacienteData?.grupo_sanguineo || '';
    const alergiasLista = Array.isArray(expediente?.antecedentes?.alergias?.lista)
      ? expediente.antecedentes.alergias.lista.map((item) => (item?.sustancia || item?.nombre || '')).map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    const alergiasOtras = String(expediente?.antecedentes?.alergias?.otras || '').trim();
    const alergiasDesdeAntecedentes = [
      ...alergiasLista,
      ...(alergiasOtras ? [alergiasOtras] : [])
    ].join(', ');
    const alergiasTexto = String(expediente?.px_info?.alergias_base || '').trim() || alergiasDesdeAntecedentes || 'Interrogadas y negadas';

    // --- Resolución de consultorio con fallback a perfil del usuario ---
    const consultorioIdDesdeCita = String(citaContext?.consultorioId || '').trim();
    const consultorioNombreDesdeCita = String(citaContext?.consultorioNombre || '').trim();
    const consultorioIdDesdeUser = String(userFuente?.consultorioActualId || '').trim();
    const consultorioNombreDesdeUser = String(userFuente?.consultorioActual || userFuente?.consultorioRecurrente || userFuente?.consultorio || '').trim();

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
    const sucursalIdContext = String(citaContext?.sucursalId || consultorioEncontrado?.sucursalId || userFuente?.sucursalActualId || '').trim();
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
      || filtrarSinUbicacion(sucursalDireccion)
      || filtrarSinUbicacion(consultorioUnicoFallback?.ubicacion)
      || filtrarSinUbicacion(consultorioUnicoFallback?.direccion)
      || filtrarSinUbicacion(consultorioUnicoFallback?.domicilio)
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
          userConsultorioActual: userFuente?.consultorioActual || '',
          userDireccionConsultorio: userFuente?.direccionConsultorio || ''
        });
      }
    }
    const fechaNacimientoRaw = expediente?.px_info?.fecha_nacimiento || pacienteData?.fechaNacimiento || pacienteData?.fecha_nacimiento || '';
    const fechaNacimientoDate = parseFirestoreDate(fechaNacimientoRaw);
    const edadCalculada = (() => {
      if (!fechaNacimientoDate) return '';
      const hoy = new Date();
      let years = hoy.getFullYear() - fechaNacimientoDate.getFullYear();
      const monthDiff = hoy.getMonth() - fechaNacimientoDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && hoy.getDate() < fechaNacimientoDate.getDate())) years -= 1;
      return years > 0 ? String(years) : '';
    })();
    const telefonoPaciente = expediente?.px_info?.telefono
      || pacienteData?.telefonoMovil
      || pacienteData?.telefono
      || pacienteData?.telefonoCelular
      || pacienteData?.celular
      || '';
    let folioReceta = expediente?.px_info?.folio_receta
      || expediente?.folio
      || '';

    if (!folioReceta) {
      folioReceta = '';
    }

    const contexto = {
      paciente: {
        id: cleanPatientId(expediente?.px_info?.id_receta || getLegacyPatientIdFromDb(pacienteData) || pacienteId || ''),
        nombre: pacienteNombre || '',
        edad: expediente?.px_info?.edad || edadCalculada || '',
        fecha_nacimiento: fechaNacimientoRaw,
        id_receta: cleanPatientId(expediente?.px_info?.id_receta || getLegacyPatientIdFromDb(pacienteData) || pacienteId || ''),
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
          ta: expediente?.consulta?.exploracion?.signos?.ta || '',
          temp: expediente?.consulta?.exploracion?.signos?.temp || '',
          fc: expediente?.consulta?.exploracion?.signos?.fc || '',
          fr: expediente?.consulta?.exploracion?.signos?.fr || '',
          spo2: expediente?.consulta?.exploracion?.signos?.spo2 || ''
        },
        antropometria: {
          peso: expediente?.consulta?.exploracion?.antropometria?.peso || '',
          talla: expediente?.consulta?.exploracion?.antropometria?.talla || ''
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
        nombre: sucursalNombre,
        horario: sucursalHorario,
        quejas_sugerencias: telefonoQuejas,
        // Forzamos direccion de sucursal al consultorio para compatibilidad con plantillas legacy.
        direccion: consultorioDireccion,
        domicilio: consultorioDireccion,
        telefono: sucursalTelefono
      },
      consultorio: {
        nombre: consultorioNombre,
        direccion: consultorioDireccion,
        domicilio: consultorioDireccion
      },
      consulta: {
        padecimiento: expediente?.consulta?.padecimiento || '',
        diagnostico: expediente?.consulta?.diagnostico?.enfermedad_actual || '',
        cie10_texto: Array.isArray(expediente?.consulta?.diagnostico?.cie10)
          ? expediente.consulta.diagnostico.cie10.map((item) => item?.codigo ? `${item.codigo} - ${item.descripcion || ''}` : (item?.descripcion || '')).filter(Boolean).join(', ')
          : '',
        indicaciones: expediente?.consulta?.diagnostico?.indicaciones || '',
        tratamiento_texto: tratamientoTexto,
        tratamiento_html: tratamientoHtml,
        medicamentos_texto: medicamentosTexto,
        medicamentos_html: medicamentosHtml,
        estudios_texto: estudiosTexto,
        estudios_html: estudiosHtml
      },
      fecha: {
        hoy: new Date().toLocaleDateString('es-MX')
      }
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
      const fieldPath = key.trim();
      const valor = getDeep(contexto, fieldPath);
      return appendUnitIfNeeded(fieldPath, valor);
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
      window.print();
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

  return (
    <div className="exp-root h-screen w-full flex flex-col overflow-hidden selection:bg-blue-100 relative">
      <style dangerouslySetInnerHTML={{__html: STYLES}} />

      {/* --- TOAST --- */}
      {notification && <ToastNotification msg={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}

      {/* --- HEADER --- */}
      <header className="exp-header print:hidden">
        <div className="flex items-center gap-5">
          <button onClick={() => goBackOr(navigate, '/agenda')} className="exp-back-btn">
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
                <AvatarPaciente sexo={pacienteData?.sexo} fechaNacimiento={pacienteData?.fechaNacimiento} size="lg" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
            </div>

            <div className="flex flex-col">
              <h1 className="exp-sora text-lg font-bold leading-tight tracking-tight" style={{color: 'var(--slate-900)'}}>
                {pacienteNombre || 'Cargando paciente...'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 uppercase tracking-wide">
                  {expediente.px_info.edad || '--'}
                </span>
                <div className="relative group ml-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all ${
                        expediente.px_info.grupo_sanguineo 
                        ? 'bg-rose-50 text-rose-600 border-rose-100 ring-1 ring-rose-50' 
                        : 'bg-slate-50 text-slate-400 border-slate-200 border-dashed hover:border-slate-300'
                    }`}>
                        <Droplet size={10} className={expediente.px_info.grupo_sanguineo ? "fill-rose-500 text-rose-500" : "text-slate-300"} />
                        {expediente.px_info.grupo_sanguineo || 'TIPO ?'}
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
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 ml-2">
                  ID: <span className="font-mono text-slate-500">{expediente.px_info.id_receta || '---'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── TIMER CENTRAL ── */}
        <div className={`hidden lg:flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl border cursor-default select-none transition-all ${getTimerStyles()}`}
             data-tip-down={seconds <= 0 ? 'Tiempo de consulta agotado' : `Consulta de ${Math.floor(timerDuration/60)} minutos`}>
          <div className="flex items-center gap-2">
            <Clock size={15} className={seconds <= 10 && seconds >= 0 ? "animate-spin" : ""} />
            <span className="exp-sora text-xl font-bold tracking-tight font-mono">{formatTime(seconds)}</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{getTimerLabel()}</span>
        </div>

        <div className="flex items-center gap-2">

          {/* ── ESTADO DEL PACIENTE ── */}
          <div className="relative">
             <button
                data-tip-down="Estado del Paciente"
                onClick={() => setShowMenuQx(!showMenuQx)}
                className={`exp-hdr-btn ${(expediente.px_info.requiere_cirugia?.general || expediente.px_info.es_embarazada) ? 'alert' : ''}`}
             >
                {pacienteData.sexo === 'Femenino' ? <Baby size={17}/> : <Scissors size={17}/>}
                {(expediente.px_info.requiere_cirugia?.general || expediente.px_info.es_embarazada) && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                )}
             </button>

             {showMenuQx && (
                <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenuQx(false)}></div>
                <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-xl shadow-lg ring-1 ring-slate-900/5 z-20 overflow-hidden p-5 origin-top-right border border-slate-200">
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

          {/* ── HERRAMIENTAS ── */}
          <button data-tip-down="Herramientas del Expediente" onClick={() => setShowActionsMenu(true)} className={`exp-hdr-btn ${showActionsMenu ? 'active' : ''}`}>
            <LayoutGrid size={17} />
          </button>

          {/* ── IMPRIMIR RECETA (posición anterior de finalizar) ── */}
          <button onClick={handlePrintReceta} className="exp-icon-btn">
            <Printer size={16} />
            <span>Imprimir Receta</span>
          </button>
        </div>
      </header>

      {/* --- LAYOUT PRINCIPAL --- */}
      <div className="flex-1 flex overflow-hidden relative print:hidden">
        <nav className="w-20 bg-white border-r flex flex-col items-center justify-between py-5 z-10 print:hidden" style={{borderColor: 'var(--slate-200)', boxShadow: 'var(--shadow-sm)'}}>
          {/* ── NAVEGACIÓN PRINCIPAL ── */}
          <div className="flex flex-col items-center gap-2 w-full">
            <NavBtn icon={<Stethoscope />} label="Consulta"  active={activeMainTab === 'consulta'}     onClick={() => setActiveMainTab('consulta')}     color="blue" />
            <NavBtn icon={<Activity />}    label="Resumen"   active={activeMainTab === 'resumen'}      onClick={() => setActiveMainTab('resumen')}      color="emerald" />
            <NavBtn icon={<ClipboardList />} label="Historial" active={activeMainTab === 'antecedentes'} onClick={() => setActiveMainTab('antecedentes')} color="violet" />
          </div>

          {/* ── SEPARADOR CENTRAL ── */}
          <div className="w-8 h-px bg-slate-200"></div>

          {/* ── ACCIONES RÁPIDAS INFERIORES ── */}
          <div className="flex flex-col items-center gap-2 w-full">
            <button
              onClick={() => setShowActionsMenu(true)}
              className="group flex flex-col items-center gap-1.5 w-full"
              style={{fontFamily: "'DM Sans', system-ui, sans-serif"}}
            >
              <div className="p-3 rounded-xl border border-transparent transition-all text-slate-400 group-hover:text-orange-600 group-hover:bg-orange-50 group-hover:border-orange-100">
                <LayoutGrid size={22} strokeWidth={2} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-orange-500 transition-colors" style={{fontFamily:"'Sora', sans-serif"}}>
                Acciones
              </span>
            </button>

            <button
              onClick={handleGuardar}
              disabled={loading}
              className="group flex flex-col items-center gap-1.5 w-full"
              style={{fontFamily: "'DM Sans', system-ui, sans-serif"}}
            >
              <div className={`p-3 rounded-xl border border-transparent transition-all ${loading ? 'text-slate-300' : 'text-slate-400 group-hover:text-emerald-700 group-hover:bg-emerald-50 group-hover:border-emerald-100'}`}>
                <Save size={22} strokeWidth={2} />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${loading ? 'text-slate-300' : 'text-slate-400 group-hover:text-emerald-600'}`} style={{fontFamily:"'Sora', sans-serif"}}>
                {loading ? 'Guardando' : 'Finalizar'}
              </span>
            </button>
          </div>
        </nav>

        <main className="flex-1 overflow-hidden relative p-3 md:p-4 print:p-0" style={{background: 'var(--bg, #f4f7f9)'}}>
          <div className="exp-panel w-full h-full flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col h-full w-full"> 
                {activeMainTab === 'consulta' && (
                  <div className="flex-1 h-full w-full">
                    <SeccionConsulta 
                       key={pacienteId}
                       expediente={expediente} 
                       updateCampo={updateCampo} 
                       activeConsulta={activeConsulta} 
                       setActiveConsulta={setActiveConsulta}
                       tempMed={tempMed}
                       setTempMed={setTempMed}
                       doctorUid={user?.uid}
                    />
                  </div>
                )}
                {activeMainTab === 'antecedentes' && (
                  <div className="flex-1 h-full w-full">
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
                    />
                  </div>
                )}
                {activeMainTab === 'resumen' && (
                  <div className="flex-1 h-full w-full">
                    <SeccionResumen 
                       key={pacienteId}
                       expediente={expediente} 
                       updateCampo={updateCampo} 
                       pacienteId={pacienteId} 
                    />
                  </div>
                )}
            </div>
          </div>
        </main>
      </div>

      <div className="z-50 relative">
         <FormatoReceta
           expediente={{...expediente, pacienteNombre}}
           doctor={user}
           sucursalInfo={{
             nombre: resolverValorCampoPlantilla('sucursal.nombre'),
             direccion: resolverValorCampoPlantilla('sucursal.direccion'),
             horario: resolverValorCampoPlantilla('sucursal.horario'),
             quejas: resolverValorCampoPlantilla('sucursal.quejas_sugerencias'),
             telefono: resolverValorCampoPlantilla('sucursal.telefono'),
           }}
         />
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
                    setShowFormatSelector(false);
                    setShowActionsMenu(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 text-xs font-bold uppercase tracking-wide transition-all"
                  style={{ fontFamily: 'Sora, sans-serif' }}
                >
                  Regresar al menu
                </button>
                <button onClick={() => setShowFormatSelector(false)} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={24}/></button>
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
              <button onClick={() => setShowRecipeTemplateSelector(false)} className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={22}/></button>
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

            <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
              <button
                onClick={() => {
                  setShowRecipeTemplateSelector(false);
                  window.print();
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-wide"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                Usar formato clasico
              </button>
              <button
                onClick={() => setShowRecipeTemplateSelector(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-wide"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {plantillaActiva && <PlantillaDinamicaModal plantilla={plantillaActiva} resolverTexto={resolverTextoPlantilla} resolverCampo={resolverValorCampoPlantilla} onNotify={showToast} onClose={() => setPlantillaActiva(null)} onBackToMenu={() => { setPlantillaActiva(null); setShowFormatSelector(true); }} />}

      {/* --- MODAL DE ADVERTENCIA DE IMPRESIÓN --- */}
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
                  Detectamos una receta o estudios en esta consulta. Si finalizas ahora, se guardara y saldras de esta pantalla.
                </p>
                <p className="text-sm font-bold text-slate-800 mt-2">
                  ¿Ya imprimiste el documento para el paciente?
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
                Si, finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PlantillaDinamicaModal = ({ plantilla, resolverTexto, resolverCampo, onClose, onBackToMenu, onNotify }) => {
  const schema = plantilla?.schema || {};
  const bloques = schema?.bloques || [];
  const campos = schema?.campos || [];
  const elementos = schema?.elements || [];
  const documentHtml = schema?.documentHtml || '';
  const page = schema?.page || { width: 816, height: 1056 };
  const printPageRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const isSigningRef = useRef(false);
  const lastPointRef = useRef(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
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

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const resolveTemplateWithSignature = (raw = '', { allowHtml = false } = {}) => {
    return String(raw).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, keyRaw) => {
      const key = keyRaw.trim();

      if (key === 'firma.medico') {
        if (!signatureDataUrl) return '';
        if (!allowHtml) return '[Firma digital capturada]';
        return `<img src="${signatureDataUrl}" alt="Firma del medico" style="max-width:220px;height:80px;object-fit:contain;display:block;"/>`;
      }

      if (key === 'firma.linea') {
        const nombreMedico = resolverCampo('medico.nombre') || 'Firma del medico';
        if (!allowHtml) return '____________________________';
        return `<div style="margin:20px auto 0 auto;width:320px;max-width:100%;border-top:2px solid #334155;padding-top:8px;text-align:center;font-weight:700;">${escapeHtml(nombreMedico)}</div>`;
      }

      if (key === 'consulta.tratamiento_html') {
        if (!allowHtml) return resolverCampo('consulta.tratamiento_texto') || '';
        return resolverCampo('consulta.tratamiento_html') || '';
      }

      const value = resolverCampo(key) || '';
      if (!allowHtml) return value;
      return escapeHtml(value).replace(/\n/g, '<br/>');
    });
  };

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

  const renderTemplateCanvasContent = () => (
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
            zIndex: 10
          }}
          dangerouslySetInnerHTML={{ __html: resolveTemplateWithSignature(normalizedDocumentHtml, { allowHtml: true }) }}
        />
      ) : null}

      {orderedElementos.length > 0 ? (
        orderedElementos.map((elemento) => {
          const isField = elemento.type === 'field';
          const isImage = elemento.type === 'image';
          const isShape = elemento.type === 'shape';
          const isShapeOrImg = isImage || isShape;
          const isSignatureField = isField && (elemento.bind || elemento.id) === 'firma.medico';
          const isSignatureLineField = isField && (elemento.bind || elemento.id) === 'firma.linea';
          const shapeKind = elemento.shapeKind || 'line';
          const shapeStrokeWidth = Number(elemento.strokeWidth || 1);
          const shapeOpacity = Number(elemento.opacity ?? 1);
          const texto = isField
            ? `${elemento.label ? `${elemento.label}: ` : ''}${resolverCampo(elemento.bind || elemento.id)}`
            : resolveTemplateWithSignature(elemento.contentHtml || elemento.content || '', { allowHtml: true });

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
                fontSize: Number(elemento.fontSize || 12),
                fontFamily: elemento.fontFamily || 'Trebuchet MS',
                lineHeight: Number(elemento.lineHeight || 1.35),
                fontWeight: elemento.bold ? 700 : 500,
                textAlign: elemento.align || 'left',
                overflow: isShape ? 'visible' : 'hidden',
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
                      ? <div className="mt-5 w-[320px] max-w-full border-t-2 border-slate-700 pt-2 text-center font-bold text-slate-800 mx-auto">{resolverCampo('medico.nombre') || 'Firma del medico'}</div>
                      : texto))
                  : <div dangerouslySetInnerHTML={{ __html: texto }} />)
              }
            </div>
          );
        })
      ) : !documentHtml ? (
        <>
          {campos.filter((campo) => campo.mostrar !== false).map((campo) => (
            <div
              key={`campo_${campo.id}`}
              className="absolute text-slate-800 whitespace-pre-wrap"
              style={{
                left: Number(campo.x || 40),
                top: Number(campo.y || 80),
                width: Number(campo.w || 510),
                minHeight: Number(campo.h || 20),
                fontSize: Number(campo.fontSize || 12),
                fontWeight: campo.negrita ? 700 : 500,
                lineHeight: 1.35,
                textAlign: campo.align || 'left'
              }}
            >
              {campo.label ? `${campo.label}: ` : ''}{resolverCampo(campo.bind || campo.id)}
            </div>
          ))}

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
                textAlign: bloque.align || 'left'
              }}
            >
              {bloque.contenidoHtml
                ? <div dangerouslySetInnerHTML={{ __html: resolveTemplateWithSignature(bloque.contenidoHtml, { allowHtml: true }) }} />
                : resolveTemplateWithSignature(bloque.contenido || '', { allowHtml: false })
              }
            </div>
          ))}
        </>
      ) : null}
    </>
  );

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
    try {
      await waitForPrintableAssets();
      if (mode === 'pdf') {
        onNotify?.('Para fidelidad legal: Destino "Guardar como PDF", Escala 100 y Margenes "Ninguno".', 'info');
      }
      document.documentElement.classList.add('printing-plantilla');
      document.body.classList.add('printing-plantilla');
      const cleanupPrintScope = () => {
        document.body.classList.remove('printing-plantilla');
        document.documentElement.classList.remove('printing-plantilla');
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
    }
  };

  const downloadPdfDeterministic = async () => {
    try {
      await waitForPrintableAssets();
      const target = printPageRef.current;
      if (!target) {
        onNotify?.('No se encontro el documento para exportar.', 'error');
        return;
      }

      // Renderizamos exactamente el nodo visible para no depender del motor de impresion del navegador.
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter',
        compress: true
      });

      const pdfWidth = 612;
      const pdfHeight = 792;
      const fit = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      const drawWidth = canvas.width * fit;
      const drawHeight = canvas.height * fit;
      const offsetX = (pdfWidth - drawWidth) / 2;
      const offsetY = (pdfHeight - drawHeight) / 2;

      const imageData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imageData, 'PNG', offsetX, offsetY, drawWidth, drawHeight, undefined, 'FAST');

      const rawName = (plantilla?.nombre || 'documento_medico').trim().toLowerCase();
      const safeName = rawName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'documento_medico';

      pdf.save(`${safeName}.pdf`);
      onNotify?.('PDF generado con formato fijo (determinista).', 'success');
    } catch (error) {
      console.error('Error exportando PDF determinista:', error);
      onNotify?.('No se pudo generar el PDF determinista.', 'error');
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
          @page { size: letter; margin: 0; }
          body { background: #fff !important; }
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
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .tpl-print-canvas {
            transform: scale(var(--tpl-print-scale, 1)) !important;
            transform-origin: top left !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] border border-slate-200 flex flex-col print:shadow-none print:border-0 print:h-auto print:max-w-none print:rounded-none tpl-print-shell">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center print:hidden">
          <div>
            <h3 className="exp-sora text-xl font-black text-slate-800">{plantilla?.nombre || 'Plantilla'}</h3>
            <p className="text-xs text-slate-500">Vista previa dinámica generada por administración</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onBackToMenu} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Volver</button>
            <button onClick={() => setShowSignatureModal(true)} className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-50 inline-flex items-center gap-2">
              <FileSignature size={15} /> {signatureDataUrl ? 'Editar firma' : 'Firmar'}
            </button>
            <button onClick={downloadPdfDeterministic} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Guardar PDF</button>
            <button onClick={() => openPrintWindow('print')} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Imprimir</button>
            <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-6 print:p-0 print:bg-white tpl-print-scroll">
          <div
            ref={printPageRef}
            className="mx-auto bg-white border border-slate-200 shadow-sm relative print:shadow-none print:border-0 tpl-print-page"
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

const NavBtn = ({ icon, label, active, onClick, color }) => {
  const colorMap = {
    blue:    { active: { color: '#0077B6', bg: '#DFF0F7', border: '#BCE0EF' }, indicator: '#0077B6' },
    emerald: { active: { color: '#059669', bg: '#d1fae5', border: '#a7f3d0' }, indicator: '#059669' },
    violet:  { active: { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' }, indicator: '#7c3aed' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-1.5 w-full relative" style={{fontFamily: "'DM Sans', system-ui, sans-serif"}}>
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full" style={{background: c.indicator}}></div>
      )}
      <div className="p-3 rounded-xl transition-all border" style={active
        ? { color: c.active.color, background: c.active.bg, borderColor: c.active.border }
        : { color: 'var(--slate-400)', background: 'transparent', borderColor: 'transparent' }
      }>
        {React.cloneElement(icon, { size: 22, strokeWidth: active ? 2.5 : 2 })}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider transition-colors" style={{color: active ? 'var(--slate-700)' : 'var(--slate-400)', fontFamily: "'Sora', sans-serif"}}>
        {label}
      </span>
    </button>
  );
};

export default ExpedienteClinico;