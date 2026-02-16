// src/pages/doctor/ExpedienteClinico.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, ArrowLeft, FileText, History, ClipboardList, Calendar,
  ChevronRight, Images, Send, FileOutput, FileSignature, PlusSquare, 
  History as HistoryIcon, User, Clock, Activity, MoreVertical, Stethoscope,
  Droplet, Baby, Scissors, AlertTriangle, X, Printer, 
  FlaskConical, Syringe, FileBadge, ShieldCheck, CheckCircle2, AlertCircle, HeartHandshake 
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from "../../config/firebase";
import { 
  doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, 
  query, where, orderBy, getDocs, limit 
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext'; 

// Importación de las secciones y componentes
import SeccionConsulta from './expediente/SeccionConsulta';
import SeccionAntecedentes from './expediente/SeccionAntecedentes';
import SeccionResumen from './expediente/SeccionResumen';
import FormatoReceta from '../../components/FormatoReceta'; 
import HistoriaClinicaModal from '../../components/HistoriaClinicaModal';
import DocumentosImagenesModal from '../../components/DocumentosImagenesModal';
import ExportarHistoriaModal from '../../components/ExportarHistoriaModal';
import ConsentimientoModal from '../../components/ConsentimientoModal';
import EstudioPrevioModal from '../../components/EstudioPrevioModal';
import HistoricoEstudiosModal from '../../components/HistoricoEstudiosModal';
import EnviarHistoriaModal from '../../components/EnviarHistoriaModal';
import HistoricoEmbarazosModal from '../../components/HistoricoEmbarazosModal';
import CartaBuenaSaludModal from '../../components/CartaBuenaSaludModal'; 
import CartaPasaporteModal from '../../components/CartaPasaporteModal'; 
import SolicitudDIFModal from '../../components/SolicitudDIFModal';
import DengueModal from '../../components/DengueModal';
import PrenupcialesModal from '../../components/PrenupcialesModal';
import AvisoPrivacidadModal from '../../components/AvisoPrivacidadModal';
import AntidopingModal from '../../components/AntidopingModal';
import CovidModal from '../../components/CovidModal';
import InfluenzaModal from '../../components/InfluenzaModal';

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
const ControlEmbarazoModal = ({ onClose, data, updateCampo }) => {
  const RadioGroup = ({ label, path }) => {
    const val = path.split('.').reduce((o, i) => o[i], data) || 'No aplica';
    return (
      <div className="mb-4">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{label}</label>
        <div className="flex gap-2">
          {['Sí', 'No', 'No aplica'].map((op) => (
            <button key={op} onClick={() => updateCampo(`control_embarazo.${path}`, op)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                val === op ? 'bg-cyan-500 text-white border-cyan-500 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}>{op}</button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
          <h3 className="text-lg font-bold text-cyan-700 flex items-center gap-2"><Baby size={20} /> Control de Embarazo y Alto Riesgo</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
             <div className="bg-cyan-50/30 p-4 rounded-xl border border-cyan-100">
                <h4 className="text-xs font-black text-cyan-600 uppercase mb-3">Datos Generales</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Núm. Embarazo</label><input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={data.num_embarazo} onChange={(e) => updateCampo('control_embarazo.num_embarazo', e.target.value)} /></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Núm. Bebés</label><input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={data.num_bebes} onChange={(e) => updateCampo('control_embarazo.num_bebes', e.target.value)} /></div>
                </div>
             </div>
             <RadioGroup label="¿Primera vez que presenta alto riesgo?" path="riesgo" />
             <RadioGroup label="Ingesta de ácido fólico" path="acido_folico" />
          </div>
          <div className="space-y-4">
             <h4 className="text-xs font-black text-rose-500 uppercase border-b border-rose-100 pb-2 mb-2">Complicaciones</h4>
             <div className="grid grid-cols-1 gap-2">
                <RadioGroup label="Diabetes Gestacional" path="complicaciones.diabetes" />
                <RadioGroup label="Infección Urinaria" path="complicaciones.infeccion_urinaria" />
                <RadioGroup label="Preeclampsia" path="complicaciones.preeclampsia" />
                <RadioGroup label="Hemorragia" path="complicaciones.hemorragia" />
                <RadioGroup label="Hipertensión Arterial" path="complicaciones.hipertension" />
                <RadioGroup label="Sospecha / Conf. COVID-19" path="complicaciones.sospecha_covid" />
             </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 sticky bottom-0">
           <button onClick={onClose} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl shadow-lg transition-all">Guardar y Cerrar</button>
        </div>
      </div>
    </div>
  );
};

const ExpedienteClinico = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth(); 
  const { pacienteId, citaId, motivo } = location.state || {};
  
  // --- ESTADOS DE UI Y MODALES ---
  const [showEnviarModal, setShowEnviarModal] = useState(false);
  const [showHistoricoEmbarazos, setShowHistoricoEmbarazos] = useState(false);
  const [showFormatSelector, setShowFormatSelector] = useState(false);
  const [showPasaporteModal, setShowPasaporteModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false); 
  const [showAntidopingModal, setShowAntidopingModal] = useState(false);
  const [showCartaSalud, setShowCartaSalud] = useState(false); 
  const [showHistoriaModal, setShowHistoriaModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false); 
  const [showDengueModal, setShowDengueModal] = useState(false);
  const [showEstudioModal, setShowEstudioModal] = useState(false);
  const [showInfluenzaModal, setShowInfluenzaModal] = useState(false);
  const [showHistoricoEstudios, setShowHistoricoEstudios] = useState(false);
  const [showAvisoPrivacidad, setShowAvisoPrivacidad] = useState(false);
  const [showConsentimientoModal, setShowConsentimientoModal] = useState(false);
  const [showCovidModal, setShowCovidModal] = useState(false);
  const [showDIFModal, setShowDIFModal] = useState(false); 
  const [showEmbarazoModal, setShowEmbarazoModal] = useState(false);
  const [showMenuQx, setShowMenuQx] = useState(false); 
  const [showPrenupcialModal, setShowPrenupcialModal] = useState(false);
  const [notification, setNotification] = useState(null); 
  const [showPrintAlert, setShowPrintAlert] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('consulta'); 
  const [activeConsulta, setActiveConsulta] = useState('padecimiento');
  const [pacienteNombre, setPacienteNombre] = useState('');
  const [pacienteData, setPacienteData] = useState({}); 
  const [loading, setLoading] = useState(false);
  const [historialCompleto, setHistorialCompleto] = useState([]);

  // --- NUEVOS ESTADOS PARA DATOS TEMPORALES (ELEVACIÓN DE ESTADO) ---
  // Estos estados "viven" aquí para no perderse si el médico no da clic en "Agregar"
  const [tempMed, setTempMed] = useState({ nombre: '', dosis: '' });
  const [tempAlergia, setTempAlergia] = useState({ nombre: '' });
  const [tempCirugia, setTempCirugia] = useState({ 
    procedimiento: '', operacion: '', nota: '', unidad: '', 
    tipoFecha: 'fecha', ano: '2024', fechaHora: '', diagnostico: '' 
  });

  // --- LÓGICA DE TEMPORIZADOR Y AUDIO ---
  const [seconds, setSeconds] = useState(180); 
  const [isTimerActive, setIsTimerActive] = useState(true);
  const audioCtxRef = useRef(null);

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
    const fetchDatos = async () => {
      if (!pacienteId) return;
      try {
        const docSnap = await getDoc(doc(db, "pacientes", pacienteId));
        if (docSnap.exists()) {
          const dataPx = docSnap.data();
          setPacienteNombre(dataPx.nombreCompleto);
          setPacienteData(dataPx);

          let edadCalc = '--';
          if (dataPx.fechaNacimiento) {
            const birthDate = new Date(dataPx.fechaNacimiento);
            const today = new Date();
            edadCalc = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) edadCalc--;
          }

          let idReceta = '';
          if (dataPx.fechaNacimiento) {
            idReceta = dataPx.fechaNacimiento.split('-').reverse().join('') + (dataPx.nombre || '').toUpperCase().split(' ')[0];
          }

          updateCampo('px_info', {
            ...expediente.px_info,
            edad: `${edadCalc} años`,
            fecha_nacimiento: dataPx.fechaNacimiento, 
            id_receta: idReceta,
            telefono: dataPx.telefonoMovil || '',
            alergias_base: dataPx.notasPersonales || '',
            grupo_sanguineo: dataPx.grupoSanguineo || ''
          });
        }

        const qHistorial = query(
          collection(db, "historial_clinico"),
          where("pacienteId", "==", pacienteId),
          orderBy("fecha", "desc"),
          limit(1)
        );

        const snapHistorial = await getDocs(qHistorial);
        if (!snapHistorial.empty) {
          const ultimoExpediente = snapHistorial.docs[0].data();
          if (ultimoExpediente.antecedentes) {
             updateCampo('antecedentes', ultimoExpediente.antecedentes);
          }
          if(ultimoExpediente.control_embarazo) {
             updateCampo('control_embarazo', ultimoExpediente.control_embarazo);
          }
        }

        if (citaId) {
          const citaSnap = await getDoc(doc(db, "citas", citaId));
          if (citaSnap.exists()) {
            const dataCita = citaSnap.data();
            if (dataCita.signos_vitales) {
              const s = dataCita.signos_vitales;
              updateCampo('consulta.exploracion.signos', { 
                  ta: s.ta || '', temp: s.temp || '', fc: s.fc || '', fr: s.fr || '', spo2: s.spo2 || '' 
              });
              updateCampo('consulta.exploracion.antropometria', { 
                  peso: s.peso || '', talla: s.talla || '', imc: s.imc || '' 
              });
            }
          }
        }
      } catch (e) { showToast("Error cargando datos del paciente", "error"); }
    };
    fetchDatos();
  }, [pacienteId, citaId]);

  const handleVerHistoria = async () => {
    setLoading(true);
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
                indicaciones: data.consulta?.diagnostico?.indicaciones || ''
            };
        });
        setHistorialCompleto(historial);
        setShowHistoriaModal(true);
    } catch (error) { showToast("Error al abrir historial", "error"); }
    setLoading(false);
  };

  const handleAbrirExportar = async () => {
    setLoading(true);
    try {
        const q = query(collection(db, "historial_clinico"), where("pacienteId", "==", pacienteId), orderBy("fecha", "desc"));
        const querySnapshot = await getDocs(q);
        const historial = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const fechaObj = data.fecha?.toDate ? data.fecha.toDate() : new Date();
            return { id: doc.id, fechaRaw: fechaObj, fechaSolo: fechaObj.toLocaleDateString('es-MX'), horaSolo: fechaObj.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'}), sucursal: data.sucursal || 'SANTA CRUZ CENTRAL', motivo: data.tipoNota || data.consulta?.padecimiento?.slice(0, 40) || 'Consulta General' };
        });
        setHistorialCompleto(historial);
        setShowExportModal(true);
    } catch (error) { showToast("Error cargando lista para exportar", "error"); }
    setLoading(false);
  };

  // --- LÓGICA DE GUARDADO MEJORADA CON RESCATE DE DATOS ---
 // --- A. FUNCIÓN QUE VALIDA ANTES DE GUARDAR ---
  const handleGuardar = () => {
    // Revisamos si hay medicamentos o estudios pendientes
    const tieneReceta = (expediente.consulta.diagnostico.tratamiento_lista?.length > 0) || (tempMed.nombre?.trim() !== '');
    const tieneEstudios = (expediente.consulta.estudios.paquetes_seleccionados?.length > 0) || (expediente.consulta.estudios.estudios_seleccionados?.length > 0);

    // Si hay cosas por imprimir, mostramos nuestro modal personalizado (NO alerta nativa)
    if (tieneReceta || tieneEstudios) {
        setShowPrintAlert(true);
    } else {
        // Si no hay nada especial, guardamos directo
        executeSave();
    }
  };

  // --- B. FUNCIÓN QUE EJECUTA EL GUARDADO (REALIZA LA ACCIÓN) ---
  const executeSave = async () => {
    setLoading(true);
    setShowPrintAlert(false); // Cerramos el modal si estaba abierto

    try {
      // 1. CLONAR EXPEDIENTE
      const expedienteFinal = { ...expediente };

      // 2. RESCATE DE DATOS (Tu lógica de seguridad)
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

      // 3. GUARDAR EN FIREBASE
      await addDoc(collection(db, "historial_clinico"), { 
          ...expedienteFinal, 
          pacienteId, 
          pacienteNombre, 
          medicoNombre: user.nombre, 
          fecha: serverTimestamp(), 
          medicoId: auth.currentUser?.uid || "anonimo" 
      });

      if(citaId) await updateDoc(doc(db, "citas", citaId), { estado: 'completada' });
      
      // 4. LIMPIEZA
      setTempMed({ nombre: '', dosis: '' });
      setTempAlergia({ nombre: '' });
      setTempCirugia({ procedimiento: '', operacion: '', nota: '', unidad: '', tipoFecha: 'fecha', ano: '2024', fechaHora: '', diagnostico: '' });

      showToast("Expediente guardado correctamente.", "success");
      setTimeout(() => navigate('/agenda'), 1500);

    } catch(e) { 
        console.error(e);
        showToast("Error al guardar el expediente", "error"); 
    }
    setLoading(false);
  };
  const handleOpenPasaporte = () => {
    setShowFormatSelector(false); 
    setShowPasaporteModal(true);
  };

  const handleBackFromPasaporte = () => {
    setShowPasaporteModal(false); 
    setShowFormatSelector(true);
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex flex-col overflow-hidden text-slate-800 font-sans selection:bg-blue-100 relative">
      
      {/* --- TOAST --- */}
      {notification && <ToastNotification msg={notification.msg} type={notification.type} onClose={() => setNotification(null)} />}

      {/* --- HEADER --- */}
      <header className="bg-white/80 backdrop-blur-md px-6 py-3 border-b border-slate-200/60 flex justify-between items-center z-50 shadow-sm print:hidden sticky top-0">
        <div className="flex items-center gap-5">
          <button onClick={() => navigate('/agenda')} 
            className="group p-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all shadow-sm">
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform"/>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center text-blue-600 ring-2 ring-blue-50">
                    <User size={20} strokeWidth={2.5} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
            </div>
            
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-tight text-slate-800 tracking-tight">
                {pacienteNombre || 'Cargando paciente...'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 uppercase tracking-wide">
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

        <div className={`hidden lg:flex items-center gap-3 px-5 py-1.5 rounded-full border transition-all duration-500 ${getTimerStyles()}`}>
          <div className="relative flex items-center justify-center">
             <Clock size={16} className={`${seconds <= 10 && seconds >= 0 ? "animate-spin" : ""}`} />
             {seconds <= 60 && <span className="absolute w-full h-full rounded-full bg-current opacity-20 animate-ping"></span>}
          </div>
          <span className="text-xl font-mono font-bold tracking-tight">
            {formatTime(seconds)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
             <button 
                onClick={() => setShowMenuQx(!showMenuQx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase transition-all shadow-sm
                ${(expediente.px_info.requiere_cirugia?.general || expediente.px_info.es_embarazada) 
                  ? 'bg-rose-50 text-rose-600 border-rose-200' 
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
             >
                {pacienteData.sexo === 'Femenino' ? <Baby size={16}/> : <Scissors size={16}/>}
                <span>Estado del Paciente</span>
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
                                        className="w-full py-2 bg-cyan-500 text-white rounded-lg text-xs font-bold shadow-md hover:bg-cyan-600 transition-all"
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

          <div className="hidden lg:flex flex-col items-end mr-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Consulta</label>
            <div className="flex items-center gap-0.5">
              <span className="text-slate-400 font-bold text-sm">$</span>
              <input 
                className="w-16 bg-transparent text-right font-bold text-slate-700 outline-none placeholder:text-slate-300 text-sm" 
                value={expediente.meta.costo} 
                onChange={e => updateCampo('meta.costo', e.target.value)} 
                placeholder="0.00" 
              />
            </div>
          </div>

          <button onClick={() => window.print()} className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm mr-2 flex items-center gap-2">
            <Printer size={18} />
            <span className="text-xs font-bold hidden lg:inline">Imprimir Receta</span>
          </button>
          
          <button onClick={() => setShowActionsMenu(true)} className={`p-2.5 rounded-xl border transition-all active:scale-95 flex items-center gap-2 ${showActionsMenu ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm'}`}>
            <MoreVertical size={18} />
          </button>

          <button onClick={handleGuardar} disabled={loading} className="group relative overflow-hidden bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.95] disabled:opacity-50 disabled:shadow-none">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <Save size={18} className="relative z-10"/> 
            <span className="relative z-10">{loading ? 'Guardando...' : 'Finalizar'}</span>
          </button>
        </div>
      </header>

      {/* --- LAYOUT PRINCIPAL --- */}
      <div className="flex-1 flex overflow-hidden relative print:hidden">
        <nav className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-8 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 print:hidden">
          <NavBtn icon={<Stethoscope />} label="Consulta" active={activeMainTab === 'consulta'} onClick={() => setActiveMainTab('consulta')} color="blue" />
          <NavBtn icon={<Activity />} label="Resumen" active={activeMainTab === 'resumen'} onClick={() => setActiveMainTab('resumen')} color="emerald" />
          <NavBtn icon={<ClipboardList />} label="Historial" active={activeMainTab === 'antecedentes'} onClick={() => setActiveMainTab('antecedentes')} color="violet" />
        </nav>

        <main className="flex-1 overflow-hidden relative bg-slate-50/50 p-2 md:p-4 print:p-0">
          <div className="w-full h-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="flex-1 flex flex-col h-full w-full"> 
                {activeMainTab === 'consulta' && (
                  <div className="flex-1 h-full w-full animate-in fade-in duration-300">
                    <SeccionConsulta 
                       expediente={expediente} 
                       updateCampo={updateCampo} 
                       activeConsulta={activeConsulta} 
                       setActiveConsulta={setActiveConsulta}
                       tempMed={tempMed}
                       setTempMed={setTempMed}
                    />
                  </div>
                )}
                {activeMainTab === 'antecedentes' && (
                  <div className="flex-1 h-full w-full animate-in fade-in duration-300">
                    <SeccionAntecedentes 
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
  <div className="flex-1 h-full w-full animate-in fade-in duration-300">
    <SeccionResumen 
       expediente={expediente} 
       updateCampo={updateCampo} 
       pacienteId={pacienteId} // <--- ¡ESTE ES EL CAMBIO CLAVE!
    />
  </div>
)}
            </div>
          </div>
        </main>
      </div>

      <div className="z-50 relative">
         <FormatoReceta expediente={{...expediente, pacienteNombre}} doctor={user} />
      </div>
      
      {/* --- MODALES BÁSICOS --- */}
      {showHistoriaModal && <HistoriaClinicaModal onClose={() => setShowHistoriaModal(false)} paciente={{...pacienteData, nombre: pacienteNombre}} historial={historialCompleto} doctor={user} expedienteActual={expediente} />}
      {showDocsModal && <DocumentosImagenesModal onClose={() => setShowDocsModal(false)} pacienteId={pacienteId} pacienteNombre={pacienteNombre} />}
      {showExportModal && <ExportarHistoriaModal onClose={() => setShowExportModal(false)} pacienteNombre={pacienteNombre} historial={historialCompleto} />}
      {showConsentimientoModal && <ConsentimientoModal onClose={() => setShowConsentimientoModal(false)} pacienteNombre={pacienteNombre} pacienteId={pacienteId} doctor={user} />}
      {showEstudioModal && <EstudioPrevioModal onClose={() => setShowEstudioModal(false)} pacienteNombre={pacienteNombre} pacienteId={pacienteId} doctorId={user.uid} />}
      {showHistoricoEstudios && <HistoricoEstudiosModal onClose={() => setShowHistoricoEstudios(false)} pacienteId={pacienteId} pacienteNombre={pacienteNombre} />}
      {showEmbarazoModal && <ControlEmbarazoModal onClose={() => setShowEmbarazoModal(false)} data={expediente.control_embarazo} updateCampo={updateCampo} />}
      {showEnviarModal && <EnviarHistoriaModal onClose={() => setShowEnviarModal(false)} pacienteNombre={pacienteNombre} pacienteTelefono={pacienteData?.telefonoMovil} pacienteEmail={pacienteData?.email} />}
      {showHistoricoEmbarazos && <HistoricoEmbarazosModal onClose={() => setShowHistoricoEmbarazos(false)} pacienteId={pacienteId} pacienteNombre={pacienteNombre} />}

      {/* --- MENU ACCIONES --- */}
      {showActionsMenu && (
        <div className="fixed inset-0 z-[170] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-white/20 overflow-hidden animate-in zoom-in-95">
             <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-sm">
                <div>
                   <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Acciones del Expediente</h3>
                   <p className="text-slate-500 font-medium mt-1">Selecciona una herramienta para el paciente <span className="text-blue-600 font-bold">{pacienteNombre}</span></p>
                </div>
                <button onClick={() => setShowActionsMenu(false)} className="p-3 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all"><X size={24}/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                   <ActionCard title="Ver Historia Clínica" subtitle="Línea de tiempo" icon={<ClipboardList size={32}/>} color="bg-blue-500" onClick={handleVerHistoria} />
                   <ActionCard title="Archivos e Imágenes" subtitle="Documentos escaneados" icon={<Images size={32}/>} color="bg-purple-500" onClick={() => { setShowDocsModal(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Enviar por WhatsApp" subtitle="Compartir con paciente" icon={<Send size={32}/>} color="bg-emerald-500" onClick={() => { setShowEnviarModal(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Generar Documentos" subtitle="Certificados y Cartas" icon={<FileText size={32}/>} color="bg-orange-500" onClick={() => { setShowFormatSelector(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Exportar Word" subtitle="Descargar historial" icon={<FileOutput size={32}/>} color="bg-indigo-500" onClick={handleAbrirExportar} />
                   <ActionCard title="Consentimiento" subtitle="Carta legal firmada" icon={<FileSignature size={32}/>} color="bg-slate-600" onClick={() => { setShowConsentimientoModal(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Agregar Estudio" subtitle="Subir resultado externo" icon={<PlusSquare size={32}/>} color="bg-teal-500" onClick={() => { setShowEstudioModal(true); setShowActionsMenu(false); }} />
                   <ActionCard title="Historial Estudios" subtitle="Ver laboratorio previo" icon={<HistoryIcon size={32}/>} color="bg-cyan-500" onClick={() => { setShowHistoricoEstudios(true); setShowActionsMenu(false); }} />
                   {pacienteData?.sexo === 'Femenino' && <ActionCard title="Histórico Embarazos" subtitle="Control prenatal" icon={<Baby size={32}/>} color="bg-rose-500" onClick={() => { setShowHistoricoEmbarazos(true); setShowActionsMenu(false); }} />}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- SELECTOR FORMATOS --- */}
      {showFormatSelector && (
        <div className="fixed inset-0 z-[180] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-white/20 overflow-hidden animate-in zoom-in-95">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                 <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Centro de Documentación</h3>
                 <p className="text-slate-500 font-medium mt-1">Generación de formatos oficiales y certificados</p>
              </div>
              <button onClick={() => setShowFormatSelector(false)} className="p-3 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar space-y-10">
              
              <div>
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 border-b border-slate-200 pb-2"><FileBadge size={18}/> Certificados Médicos</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                   <FormatCard label="Buena Salud (Adulto)" onClick={() => { setShowCartaSalud(true); setShowFormatSelector(false); }} />
                   <FormatCard label="Buena Salud (Menor)" icon={<Baby size={28}/>} onClick={() => { setShowCartaSalud(true); setShowFormatSelector(false); }} /> 
                   <FormatCard label="Pasaporte (Menor/Mayor)" icon={<FileText size={28}/>} onClick={handleOpenPasaporte} />
                   
                   {/* --- CORREGIDO: Solicitud DIF ahora tiene cierre correcto --- */}
                   <FormatCard label="Solicitud DIF" icon={<FileText size={28}/>} onClick={() => { setShowFormatSelector(false); setShowDIFModal(true); }} /> 
                   
                   <FormatCard label="Prenupciales" icon={<HeartHandshake size={28}/>} onClick={() => { setShowFormatSelector(false); setShowPrenupcialModal(true); }} />
                </div>
              </div>

              {/* Otras secciones (Legal, Lab) se mantienen igual... */}
              <div>
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 border-b border-slate-200 pb-2"><ShieldCheck size={18}/> Legal y Privacidad</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                   <FormatCard label="Consentimiento Info." icon={<FileSignature size={28}/>} onClick={() => { setShowConsentimientoModal(true); setShowFormatSelector(false); }} />

                <FormatCard 
                  label="Aviso de Privacidad" 
                    icon={<ShieldCheck size={28}/>} 
                    onClick={() => { setShowFormatSelector(false); setShowAvisoPrivacidad(true); }} 
                />

                </div>
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3 border-b border-slate-200 pb-2"><FlaskConical size={18}/> Pruebas Rápidas</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
                <FormatCard 
    label="Antidoping (Orina)" 
    icon={<FlaskConical size={28}/>} // Asegúrate de importar FlaskConical de lucide-react
    onClick={() => { setShowFormatSelector(false); setShowAntidopingModal(true); }} 
/>
<FormatCard 
    label="COVID-19 (Ag)" 
    icon={<Activity size={28}/>} 
    onClick={() => { setShowFormatSelector(false); setShowCovidModal(true); }} 
/>
<FormatCard 
    label="Influenza A+B" 
    icon={<Activity size={28}/>} // O usa Thermometer si lo importas
    onClick={() => { setShowFormatSelector(false); setShowInfluenzaModal(true); }} 
/>                   <FormatCard label="Panel Viral (Combo)" icon={<Activity size={28}/>} onClick={() => showToast("Pendiente: Panel Viral")} />
                   <FormatCard label="Panel Viral + VSR" icon={<Activity size={28}/>} onClick={() => showToast("Pendiente: Panel VSR")} />

<FormatCard 
    label="Prueba Dengue" 
    icon={<Droplet size={28}/>} 
    onClick={() => { setShowFormatSelector(false); setShowDengueModal(true); }} 
/>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MODALES DOCUMENTOS --- */}
      {showCartaSalud && <CartaBuenaSaludModal onClose={() => setShowCartaSalud(false)} expediente={expediente} pacienteNombre={pacienteNombre} doctor={user} />}

      {showPasaporteModal && <CartaPasaporteModal onClose={() => setShowPasaporteModal(false)} onBackToMenu={handleBackFromPasaporte} paciente={{ nombre: pacienteNombre || "Paciente", apellidoPaterno: pacienteData?.apellidoPaterno || "", apellidoMaterno: pacienteData?.apellidoMaterno || "", edad: expediente?.px_info?.edad || "N/A" }} doctor={user} />}

      {showDIFModal && (
        <SolicitudDIFModal 
          onClose={() => setShowDIFModal(false)} 
          // --- CORREGIDO: Se pasa la función para regresar ---
          onBackToMenu={() => { setShowDIFModal(false); setShowFormatSelector(true); }}
          paciente={{...pacienteData, nombre: pacienteNombre, edad: expediente?.px_info?.edad}}
          doctor={user}
        />
      )}

      {showPrenupcialModal && (
        <PrenupcialesModal 
          onClose={() => setShowPrenupcialModal(false)}
          // --- CORREGIDO: Se pasa la función para regresar ---
          onBackToMenu={() => { setShowPrenupcialModal(false); setShowFormatSelector(true); }}
          // --- CORREGIDO: Datos seguros para evitar crash ---
          paciente={{
              nombre: pacienteNombre || "Paciente", 
              apellidoPaterno: pacienteData?.apellidoPaterno || "",
              apellidoMaterno: pacienteData?.apellidoMaterno || "",
              edad: expediente?.px_info?.edad || "N/A",
              sexo: pacienteData?.sexo || "Masculino" 
          }}
          doctor={user}
        />
      )}

  {showAvisoPrivacidad && (
    <AvisoPrivacidadModal 
      onClose={() => setShowAvisoPrivacidad(false)} 
      onBackToMenu={() => { setShowAvisoPrivacidad(false); setShowFormatSelector(true); }}
    />
  )}
      
{showAntidopingModal && (
    <AntidopingModal 
      onClose={() => setShowAntidopingModal(false)}
      onBackToMenu={() => { setShowAntidopingModal(false); setShowFormatSelector(true); }}
      paciente={{
          nombre: pacienteNombre || "Paciente", 
          apellidoPaterno: pacienteData?.apellidoPaterno || "",
          apellidoMaterno: pacienteData?.apellidoMaterno || "",
          edad: expediente?.px_info?.edad || "N/A"
      }}
      doctor={user}
    />
  )}

  {showCovidModal && (
    <CovidModal 
      onClose={() => setShowCovidModal(false)}
      onBackToMenu={() => { setShowCovidModal(false); setShowFormatSelector(true); }}
      paciente={{
          nombre: pacienteNombre || "Paciente", 
          apellidoPaterno: pacienteData?.apellidoPaterno || "",
          apellidoMaterno: pacienteData?.apellidoMaterno || "",
          edad: expediente?.px_info?.edad || "N/A"
      }}
      doctor={user}
    />
  )}

  {showInfluenzaModal && (
    <InfluenzaModal 
      onClose={() => setShowInfluenzaModal(false)}
      onBackToMenu={() => { setShowInfluenzaModal(false); setShowFormatSelector(true); }}
      paciente={{
          nombre: pacienteNombre || "Paciente", 
          apellidoPaterno: pacienteData?.apellidoPaterno || "",
          apellidoMaterno: pacienteData?.apellidoMaterno || "",
          edad: expediente?.px_info?.edad || "N/A"
      }}
      doctor={user} // <--- ¡CRÍTICO PARA QUE SALGA EL NOMBRE DEL DR!
    />
  )}

{showDengueModal && (
    <DengueModal 
      onClose={() => setShowDengueModal(false)}
      onBackToMenu={() => { setShowDengueModal(false); setShowFormatSelector(true); }}
      paciente={{
          nombre: pacienteNombre || "Paciente", 
          apellidoPaterno: pacienteData?.apellidoPaterno || "",
          apellidoMaterno: pacienteData?.apellidoMaterno || "",
          edad: expediente?.px_info?.edad || "N/A"
      }}
      doctor={user}
    />
  )}
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

const ActionCard = ({ title, subtitle, icon, color, onClick }) => (
    <button onClick={onClick} className="group relative overflow-hidden bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300 text-left flex flex-col gap-4 active:scale-[0.98]">
        <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            {icon}
        </div>
        <div>
            <h4 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-tight">{title}</h4>
            <p className="text-sm text-slate-400 font-medium mt-1">{subtitle}</p>
        </div>
    </button>
);

const FormatCard = ({ label, onClick, icon }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center gap-4 p-6 rounded-[2rem] bg-white border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all group active:scale-95 duration-200 aspect-square">
    <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-inner group-hover:shadow-lg group-hover:shadow-blue-500/30">
      {icon || <FileText size={28} />}
    </div>
    <span className="font-bold text-slate-600 text-xs text-center leading-tight group-hover:text-blue-700 uppercase tracking-wide">{label}</span>
  </button>
);

const NavBtn = ({ icon, label, active, onClick, color }) => {
    const colorClasses = {
        blue: active ? 'text-blue-600 bg-blue-50 ring-blue-100' : 'text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50/50',
        emerald: active ? 'text-emerald-600 bg-emerald-50 ring-emerald-100' : 'text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-50/50',
        violet: active ? 'text-violet-600 bg-violet-50 ring-violet-100' : 'text-slate-400 group-hover:text-violet-500 group-hover:bg-violet-50/50',
    };
    return (
        <button onClick={onClick} className="group flex flex-col items-center gap-1.5 w-full relative">
            {active && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-${color}-500`}></div>}
            <div className={`p-3 rounded-2xl transition-all duration-300 ease-out relative ${active ? 'shadow-md scale-105 ring-1' : 'hover:scale-105'} ${colorClasses[color] || colorClasses.blue}`}>
                {React.cloneElement(icon, { size: 22, strokeWidth: active ? 2.5 : 2 })}
                {active && <div className={`absolute inset-0 rounded-2xl bg-${color}-400 opacity-20 blur-md`}></div>}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${active ? `text-slate-700` : 'text-slate-400'}`}>{label}</span>
        </button>
    );
};

export default ExpedienteClinico;