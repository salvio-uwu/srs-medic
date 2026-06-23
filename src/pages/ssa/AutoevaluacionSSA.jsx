import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle, MinusCircle,
  HelpCircle, FileText, Building2, Stethoscope, Droplets, Pill,
  SprayCan, Beaker, Biohazard, ThermometerSnowflake, Siren, Brain, Apple,
  ShieldCheck, Camera, Trash2, Loader2,
  Plus, Pencil, Eye, EyeOff, ListPlus, FolderPlus, History,
  ClipboardCheck, Users, Lock, FlaskConical, Info, X, Package
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';

const ANSWER_OPTIONS = [
  { key: 'SI', label: 'Sí cumple', short: 'SI', icon: CheckCircle2, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'ring-emerald-400' },
  { key: 'NO', label: 'No cumple', short: 'NO', icon: XCircle, color: '#dc2626', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', ring: 'ring-red-400' },
  { key: 'PARCIAL', label: 'Parcial', short: 'Parcial', icon: HelpCircle, color: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-amber-400' },
  { key: 'NA', label: 'No aplica', short: 'N/A', icon: MinusCircle, color: '#64748b', bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', ring: 'ring-slate-400' },
];

const INITIAL_SECTIONS = [
  { id: 'I', title: 'Documentación general del consultorio', icon: 'ClipboardCheck', questions: [
    { id: 1, text: 'Aviso de funcionamiento y responsable sanitario.' },
    { id: 2, text: 'El establecimiento cuenta con registro diario de pacientes.' },
    { id: 3, text: 'Tiene anuncio o rótulo en donde se da a conocer el horario del establecimiento.' },
  ]},
  { id: 'II', title: 'Documentación del personal de la salud y archivo clínico', icon: 'Users', questions: [
    { id: 4, text: 'Los documentos del personal de la salud (médicos, enfermeras, técnicos y auxiliares) están completos y actualizados.' },
    { id: 5, text: 'El personal médico cuenta con título profesional médico y/o documentos que acrediten como tal, de manera visible al público.' },
    { id: 6, text: 'El personal médico cuenta con recetario médico impreso e incluye: Nombre del Médico, Institución que expide el Título, Número de Cédula Profesional, Domicilio del establecimiento, Fecha de expedición y Número de Cédula de especialidad.' },
    { id: 7, text: 'Los expedientes clínicos se encuentran completos, ordenados e incluyen: ficha de identificación, historia clínica, hoja de seguimiento, nota de interconsulta, con carta de consentimiento informado, conservándose por un periodo mínimo de cinco años.' },
  ]},
  { id: 'III', title: 'Lavado de manos', icon: 'Droplets', questions: [
    { id: 8, text: 'Se cuenta con: Agua potable, jabón antiséptico líquido, desinfectante y toallas desechables para la práctica del lavado correcto de manos.' },
    { id: 9, text: 'Personal de salud lleva a cabo el lavado de manos antes y después de revisar a cada paciente y/o en cada procedimiento, así como también personal que labore dentro del consultorio.' },
  ]},
  { id: 'IV', title: 'Medicamentos e insumos', icon: 'Pill', questions: [
    { id: 10, text: 'Los medicamentos e insumos: Tienen fecha de caducidad vigente, Cuentan con registro sanitario, Se almacenan según indicaciones del fabricante, No cuentan con medicamentos del Sector Salud Público (si es privado), Cuenta con política para manejo de soluciones de uso pediátrico.' },
  ]},
  { id: 'V', title: 'Control de fauna nociva y mantenimiento', icon: 'SprayCan', questions: [
    { id: 11, text: 'Cuenta con comprobante para el control y erradicación de fauna nociva, en un periodo menor a 365 días naturales.' },
    { id: 12, text: 'Cuenta con registros y bitácoras de limpieza para el chequeo diario, así como la práctica de desinfección de las instalaciones y equipos del establecimiento.' },
  ]},
  { id: 'VI', title: 'Infraestructura y equipamiento del consultorio', icon: 'Stethoscope', questions: [
    { id: 13, text: 'El consultorio cuenta con los siguientes requisitos de infraestructura y equipamiento:', subitems: [
      { id: '13a', text: 'Área para entrevista y otra para exploración física; espacio o mueble para guardar expedientes clínicos.' },
      { id: '13b', text: 'Lavabo funcional con jabón antiséptico, desinfectante y toallas desechables en el área de exploración.' },
      { id: '13c', text: 'Botiquín de urgencias con: Paracetamol 500 mg, Lidocaína al 2%, Epinefrina 1 mg/ml, Salbutamol spray, Butilhioscina 20 mg, Difenidol 40 mg, Agua bidestilada 2 ml, Diazepam 10 mg, Solución de Hartmann, Glucosa 5%/10%/50%, NaCl 0.9%.' },
      { id: '13d', text: 'Mobiliario y equipo: asientos, báscula con estadímetro, mesa de exploración con pierneras, esfigmomanómetro, estetoscopio, estuche de diagnóstico, pinzas, tijeras, termómetro, apósitos, gasas, guantes, suturas, antisépticos.' },
    ]},
  ]},
  { id: 'VII', title: 'Agua potable', icon: 'Beaker', questions: [
    { id: 14, text: 'Cuenta con sistema de abastecimiento de agua potable y se realiza limpieza y mantenimiento a las cisternas por lo menos una vez al año, verificando pH, cloro residual, viscosidad, etc.' },
    { id: 15, text: 'Se realizó determinación de cloro residual en al menos tres puntos: cisterna o depósito, salida de la misma y otros puntos de la red de distribución interna.' },
    { id: 16, text: 'Se realiza limpieza y mantenimiento a las cisternas por lo menos una vez al año.', tableNote: 'Resultados de muestras de agua:', tableHeaders: ['N.° Muestra', 'Localización', 'Resultado'] },
  ]},
  { id: 'VIII', title: 'Residuos Peligrosos Biológico-Infecciosos (RPBI)', icon: 'Biohazard', questions: [
    { id: 17, text: 'Se cuenta con contrato con empresa recolectora de R.P.B.I. vigente, así como de los manifiestos de recolección o bien se encuentra adherido a un plan de manejo externo.' },
    { id: 18, text: 'En las áreas del establecimiento se separan y envasan los residuos peligrosos biológico-infecciosos, de acuerdo con sus características, sin mezclarse con residuos municipales o peligrosos.' },
  ]},
  { id: 'IX', title: 'Cadena de frío para biológicos', icon: 'ThermometerSnowflake', questions: [
    { id: 19, text: 'Cuenta con un sistema de refrigeración con control y registro diario que garantice temperatura constante para preservar exclusivamente biológicos.' },
  ]},
  { id: 'X', title: 'Atención de urgencias', icon: 'Siren', questions: [
    { id: 20, text: 'Cuenta con: Aspirador, Cánulas orofaríngeas varios tamaños (pediátrico y adulto), Mangos de laringoscopio varios tamaños (pediátrico y adulto).' },
  ]},
  { id: 'XI', title: 'Esterilización y control de infecciones', icon: 'FlaskConical', questions: [
    { id: 21, text: 'Cuenta con procedimientos documentados de limpieza, desinfección y esterilización del instrumental y equipo médico.' },
    { id: 22, text: 'El material estéril se encuentra debidamente identificado, fechado y almacenado en condiciones que garanticen su conservación.' },
    { id: 23, text: 'Se realiza control biológico y químico de los procesos de esterilización de manera periódica, con registros documentados.' },
  ]},
  { id: 'XII', title: 'Consultorio de psicología', icon: 'Brain', questions: [
    { id: 25, text: 'Cuenta con espacio y mobiliario suficiente: asiento para psicólogo, asiento para paciente y acompañante, sistema para guarda de expedientes clínicos.' },
  ]},
  { id: 'XIII', title: 'Manejo de medicamentos controlados', icon: 'Lock', questions: [
    { id: 26, text: 'Los medicamentos controlados (estupefacientes y psicotrópicos) se almacenan en gabinete bajo llave, con acceso restringido.' },
    { id: 27, text: 'Se lleva un libro de control de medicamentos controlados con registro de entradas, salidas y saldos actualizado, conforme a la normatividad vigente.' },
    { id: 28, text: 'Se cuenta con recetarios especiales para medicamentos controlados y avisos de funcionamiento ante COFEPRIS vigentes.' },
  ]},
  { id: 'XIV', title: 'Consultorio de nutriología', icon: 'Apple', questions: [
    { id: 29, text: 'Cuenta con espacio y mobiliario suficiente: asiento para nutriólogo, asiento para paciente y acompañante, sistema para guarda de expedientes, báscula clínica con estadímetro, cinta antropométrica de fibra de vidrio.' },
  ]},
];

const FARMACIAS_SECTIONS = [
  { id: 'I', title: 'Documentacion legal y tecnica', icon: 'ClipboardCheck', questions: [
    { id: 1, text: 'La Licencia Sanitaria o Aviso de funcionamiento se encuentran actualizados y en lugar visible.' },
    { id: 2, text: 'Corresponde el giro autorizado con las funciones del establecimiento.' },
    { id: 3, text: 'Cuenta con aviso de responsable sanitario actualizado.' },
    { id: 4, text: 'El responsable sanitario cuenta con Titulo profesional y la carrera es acorde a los requisitos que establece la Ley General de Salud.' },
    { id: 5, text: 'Supervisa el cumplimiento de la Regulacion Sanitaria en materia de manejo, seleccion, adquisicion, conservacion, distribucion, control, preparacion, dispensacion e informacion de medicamentos y demas insumos para la salud.' },
    { id: 6, text: 'El establecimiento esta registrado ante la Secretaria de Hacienda y Credito Publico.' },
    { id: 7, text: 'Cuenta con ordenes, actas, tramites, oficios y su seguimiento.' },
    { id: 8, text: 'Cuentan con facturas o documentos que amparen la tenencia legitima de los insumos para la salud, incluyen razon social y domicilio de procedencia, cantidad, denominacion generica y distintiva, presentacion, numero de lote, fecha de caducidad y fecha de emision.' },
    { id: 9, text: 'En el caso de traspasos entre farmacias; solo se realiza entre farmacias de la misma razon social o filial y con justificacion escrita.' },
    { id: 10, text: 'Cuenta con plano arquitectonico o diagrama de distribucion del establecimiento, actualizado y autorizado por el responsable sanitario.' },
    { id: 11, text: 'Cuenta con organigrama que indique nombre y puesto de cada empleado, se encuentra actualizado y autorizado por el responsable sanitario.' },
    { id: 12, text: 'Cuentan con descripciones actualizadas de cada puesto.' },
    { id: 13, text: 'Cuenta con la edicion vigente del Suplemento para establecimientos dedicados a la venta y suministro de medicamentos y demas insumos para la salud.' },
    { id: 14, text: 'Se cuenta con PNO de Elaboracion de procedimientos normalizados de operacion.' },
    { id: 15, text: 'Se cuenta con PNO de Buenas Practicas de Documentacion.' },
    { id: 16, text: 'Se cuenta con PNO de adquisicion de medicamento y demas insumos para la salud, que contemple la adquisicion a proveedores legalmente establecidos.' },
    { id: 17, text: 'Se cuenta con PNO de Recepcion de medicamentos y demas insumos para la salud.' },
    { id: 18, text: 'Cuenta con PNO de registros que establezca como realizan la captura de las entradas y salidas (denominacion, presentacion, lote, caducidad, fecha de movimiento, tipo, factura, saldo).' },
    { id: 19, text: 'Se cuenta con un PNO para el manejo y conservacion de medicamentos y demas insumos para la salud.' },
    { id: 20, text: 'Cuenta con PNO, contrato, programa vigente, licencia sanitaria del proveedor y constancias de servicio del control de fauna nociva (voladores, roedores y rastreros).' },
    { id: 21, text: 'Se cuenta con un PNO de Control de existencias de medicamentos y demas insumos para la salud (inspeccion, criterios de aceptacion, registros, almacenamiento, caducidad, inventario).' },
    { id: 22, text: 'Se cuenta con un PNO de venta o suministro de medicamentos y demas insumos para la salud.' },
    { id: 23, text: 'Se cuenta con un PNO de devolucion y destino de medicamentos y demas insumos para la salud a proveedores.' },
    { id: 24, text: 'Se cuenta con un PNO de devolucion de medicamentos y demas insumos para la salud de usuarios a la farmacia.' },
    { id: 25, text: 'Se cuenta con un PNO de auditorias tecnicas internas (auto inspeccion) y externas (proveedores y contratistas).' },
    { id: 26, text: 'Se cuenta con un PNO de calibracion y mantenimiento de los instrumentos de medicion (relacion actualizada, bitacora, documentos probatorios de calibracion).' },
    { id: 27, text: 'Se cuenta con un PNO de denuncia a la autoridad sanitaria de todo hecho, acto u omision que represente un riesgo o provoque un dano a la salud.' },
    { id: 28, text: 'Se cuenta con un PNO de destruccion de medicamentos y demas insumos para la salud deteriorados o caducos, realizado por empresas autorizadas por la SEMARNAT.' },
    { id: 29, text: 'Se cuenta con un PNO de atencion de contingencias para prevenir su impacto en la calidad y conservacion de los medicamentos.' },
    { id: 30, text: 'Se cuenta con un PNO de traslado de medicamentos que requieran refrigeracion (contenedores isotermicos, geles, tiempo y ruta).' },
    { id: 31, text: 'Se cuenta con un PNO de manejo de desviaciones o no conformidades.' },
    { id: 32, text: 'Se cuenta con un PNO de limpieza de areas, mobiliario, medicamentos y demas insumos para la salud.' },
    { id: 33, text: 'Se cuenta con un PNO de recepcion, atencion y solucion de quejas de los usuarios.' },
    { id: 34, text: 'Se cuenta con un PNO de notificacion de sospechas de reacciones adversas a medicamentos e incidentes adversos de dispositivos medicos (farmacovigilancia).' },
    { id: 35, text: 'Se cuenta con un PNO de mantenimiento preventivo y correctivo de refrigeradores, congeladores, instalaciones y mobiliario.' },
    { id: 36, text: 'Se cuenta con un PNO de Retiro del producto del mercado, que contemple por lo menos un simulacro al ano.' },
    { id: 37, text: 'Los PNO se encuentran autorizados por el responsable sanitario.' },
  ]},
  { id: 'II', title: 'Recursos humanos y capacitacion', icon: 'Users', questions: [
    { id: 38, text: 'El personal que labora en el establecimiento cuenta con capacitacion documentada en Buenas Practicas de Farmacia.' },
    { id: 39, text: 'Se cuenta con expediente actualizado por cada empleado que incluya documentacion que acredite su puesto y capacitacion recibida.' },
    { id: 40, text: 'El personal usa vestimenta adecuada, limpia e identificacion visible durante su jornada laboral.' },
    { id: 41, text: 'Se cuenta con un programa anual de capacitacion continua para todo el personal.' },
  ]},
  { id: 'III', title: 'Infraestructura e instalaciones', icon: 'Building2', questions: [
    { id: 42, text: 'El establecimiento cuenta con areas delimitadas para recepcion, almacenamiento, dispensacion y atencion al publico.' },
    { id: 43, text: 'Las instalaciones electricas, hidraulicas y sanitarias se encuentran en buen estado y funcionamiento.' },
    { id: 44, text: 'Se cuenta con iluminacion y ventilacion adecuadas, naturales o artificiales, en todas las areas.' },
    { id: 45, text: 'Pisos, paredes y techos son de materiales lisos, lavables y de facil limpieza.' },
    { id: 46, text: 'Se cuenta con servicios sanitarios limpios y funcionales para el personal.' },
  ]},
  { id: 'IV', title: 'Almacenamiento y conservacion', icon: 'Droplets', questions: [
    { id: 47, text: 'Los medicamentos se almacenan en areas secas, limpias, ventiladas y protegidas de la luz solar directa.' },
    { id: 48, text: 'Se cuenta con tarimas, estanteria o anaqueles de material liso y lavable para el almacenamiento de medicamentos, separados del piso y paredes.' },
    { id: 49, text: 'Los medicamentos que requieren refrigeracion se almacenan en refrigeradores exclusivos con control y registro diario de temperatura (2°C a 8°C).' },
    { id: 50, text: 'Los medicamentos caducos, deteriorados u obsoletos se encuentran identificados, segregados y en area separada para su destino final.' },
    { id: 51, text: 'Se respeta el sistema PEPS (Primeras Entradas, Primeras Salidas) en la dispensacion y rotacion de inventario.' },
  ]},
  { id: 'V', title: 'Control de medicamentos controlados', icon: 'Lock', questions: [
    { id: 52, text: 'Los medicamentos estupefacientes y psicotropicos se almacenan en gabinete o caja fuerte bajo llave con acceso restringido.' },
    { id: 53, text: 'Se lleva libro de control de medicamentos controlados con registro de entradas, salidas y saldos actualizado diariamente.' },
    { id: 54, text: 'Se cuenta con recetarios especiales para medicamentos controlados y avisos de funcionamiento ante COFEPRIS vigentes.' },
    { id: 55, text: 'Se conservan copias de las recetas de medicamentos controlados por el periodo establecido en la normatividad.' },
  ]},
  { id: 'VI', title: 'Dispensacion y atencion al publico', icon: 'Stethoscope', questions: [
    { id: 56, text: 'El area de dispensacion se encuentra limpia, ordenada y permite una atencion agil al publico.' },
    { id: 57, text: 'Se exhibe en lugar visible el horario de atencion, aviso de funcionamiento y responsable sanitario.' },
    { id: 58, text: 'Se cuenta con cartel informativo para la recepcion de reportes de sospechas de reacciones adversas a medicamentos (farmacovigilancia).' },
    { id: 59, text: 'El personal orienta al usuario sobre el uso, conservacion y posibles efectos adversos del medicamento dispensado.' },
    { id: 60, text: 'No se realiza la venta de medicamentos que requieren receta medica sin la presentacion de la misma.' },
  ]},
  { id: 'VII', title: 'Manejo de residuos', icon: 'Biohazard', questions: [
    { id: 61, text: 'Se cuenta con contrato con empresa autorizada para la recoleccion y disposicion final de medicamentos caducos y residuos peligrosos.' },
    { id: 62, text: 'Los residuos peligrosos (medicamentos caducos, RPBI) se separan de los residuos municipales y se almacenan en contenedores identificados.' },
    { id: 63, text: 'Se cuenta con bitacora de generacion y salida de residuos peligrosos actualizada.' },
  ]},
];

const iconMap = {
  Building2, FileText, Droplets, Pill, SprayCan, Beaker, Biohazard,
  ThermometerSnowflake, Siren, Brain, Apple, ShieldCheck, Stethoscope,
  ClipboardCheck, Users, Lock, FlaskConical, Package
};

const TEMPLATES = {
  consultorios: {
    name: 'Consultorios Medicos',
    description: 'Evaluacion para Establecimientos de Atencion Medica Ambulatoria',
    subtitle: 'Consultorios Medicos Generales y de Especialidades — Nuevo Leon',
    sections: INITIAL_SECTIONS,
  },
  farmacias: {
    name: 'Farmacias, Boticas y Droguerias',
    description: 'Guia de Autoevaluacion para Farmacias, Boticas y Droguerias',
    subtitle: 'Subsecretaria de Regulacion y Fomento Sanitario — Nuevo Leon',
    sections: FARMACIAS_SECTIONS,
  },
};

const buildInitialState = (sections) => {
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

const getNextId = (sections, sectionId) => {
  let max = 0;
  const targetSection = sectionId ? sections.find((s) => s.id === sectionId) : null;
  const questionsToScan = targetSection ? targetSection.questions : sections.flatMap((s) => s.questions);
  questionsToScan.forEach((q) => {
    const n = parseInt(String(q.id), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
};

const genId = (() => {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    return `${prefix}_${Date.now().toString(36)}_${counter}`;
  };
})();

const ROMAN = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90],
  ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];
const romanize = (num) => {
  let n = num;
  let out = '';
  for (const [sym, val] of ROMAN) {
    while (n >= val) { out += sym; n -= val; }
  }
  return out || String(num);
};

const SECTION_ICON_POOL = [
  'ClipboardCheck', 'Users', 'Droplets', 'Pill', 'SprayCan', 'Beaker', 'Biohazard',
  'ThermometerSnowflake', 'Siren', 'Brain', 'Apple', 'FlaskConical', 'Lock',
  'Stethoscope', 'Building2', 'Package', 'FileText', 'ShieldCheck',
];

const AutoevaluacionSSA = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { templateId } = useParams();

  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [templateMeta, setTemplateMeta] = useState({ name: '', description: '', subtitle: '' });
  const [showMetaEditor, setShowMetaEditor] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaSub, setMetaSub] = useState('');
  const init = buildInitialState(INITIAL_SECTIONS);
  const [answers, setAnswers] = useState(init.answers);
  const [observations, setObservations] = useState(init.observations);
  const [subAnswers, setSubAnswers] = useState(init.subAnswers);
  const [subObs, setSubObs] = useState(init.subObs);
  const [photos, setPhotos] = useState(init.photos);
  const [tableData, setTableData] = useState(init.tableData);
  const [enabled, setEnabled] = useState(init.enabled);
  const [sectionEnabled, setSectionEnabled] = useState(init.sectionEnabled);
  const [expandedSections, setExpandedSections] = useState(new Set(INITIAL_SECTIONS.map((s) => s.id)));
  const [questionnaireLoading, setQuestionnaireLoading] = useState(true);
  const [questionnaireSaved, setQuestionnaireSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState('section');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionSectionId, setNewQuestionSectionId] = useState('');
  const [newQuestionType, setNewQuestionType] = useState('simple');
  const [inlineQuestionInput, setInlineQuestionInput] = useState({});
  const [inlineSubitemInput, setInlineSubitemInput] = useState({});
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  // ── Inline editing (admin only) ──
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [editingSubitemId, setEditingSubitemId] = useState(null);
  const [editingSubitemText, setEditingSubitemText] = useState('');
  const [iconPickerSection, setIconPickerSection] = useState(null);

  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const [confirmState, setConfirmState] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const showConfirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        message,
        title: opts.title || 'Confirmacion requerida',
        confirmLabel: opts.confirmLabel || 'Eliminar',
        cancelLabel: opts.cancelLabel || 'Cancelar',
        tone: opts.tone || 'danger',
        resolve,
      });
    });
  }, []);

  const markDirty = useCallback(() => setDirty(true), []);

  const isAdmin = useMemo(() => {
    const role = (user?.rol || '').toLowerCase().trim();
    return role === 'admin' || role === 'admin_maestro' || role === 'administrador' || role === 'admin maestro';
  }, [user]);

  const isBuiltIn = templateId === 'consultorios' || templateId === 'farmacias';

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    const loadQuestionnaire = async () => {
      setQuestionnaireLoading(true);
      try {
        const snap = await getDoc(doc(db, 'ssa_cuestionario', templateId));
        if (snap.exists() && snap.data().sections) {
          const data = snap.data();
          setTemplateMeta({ name: data.name || '', description: data.description || '', subtitle: data.subtitle || '' });
          const savedSections = data.sections;
          setSections(savedSections);
          const sInit = buildInitialState(savedSections);
          setAnswers(sInit.answers); setObservations(sInit.observations);
          setSubAnswers(sInit.subAnswers); setSubObs(sInit.subObs);
          setPhotos(sInit.photos); setTableData(sInit.tableData);
          setEnabled(sInit.enabled); setSectionEnabled(sInit.sectionEnabled);
          setExpandedSections(new Set(savedSections.map((s) => s.id)));
          setExpandedQuestions(new Set(savedSections.flatMap((s) => s.questions.map((q) => String(q.id)))));
        } else {
          const defaultSections = TEMPLATES[templateId]?.sections || INITIAL_SECTIONS;
          const meta = TEMPLATES[templateId] || {};
          setTemplateMeta({ name: meta.name || '', description: meta.description || '', subtitle: meta.subtitle || '' });
          setSections(defaultSections);
          const sInit = buildInitialState(defaultSections);
          setAnswers(sInit.answers); setObservations(sInit.observations);
          setSubAnswers(sInit.subAnswers); setSubObs(sInit.subObs);
          setPhotos(sInit.photos); setTableData(sInit.tableData);
          setEnabled(sInit.enabled); setSectionEnabled(sInit.sectionEnabled);
          setExpandedSections(new Set(defaultSections.map((s) => s.id)));
          setExpandedQuestions(new Set(defaultSections.flatMap((s) => s.questions.map((q) => String(q.id)))));
        }
      } catch (err) { console.warn('No se pudo cargar el cuestionario:', err); }
      setDirty(false);
      setQuestionnaireLoading(false);
    };
    loadQuestionnaire();
  }, [templateId]);

  const guardedNavigate = useCallback(async (to) => {
    if (dirty) {
      const ok = await showConfirm(
        'Tienes cambios sin guardar en el cuestionario. Si sales ahora se perderan.',
        { title: 'Cambios sin guardar', confirmLabel: 'Salir sin guardar', cancelLabel: 'Seguir editando', tone: 'warn' }
      );
      if (!ok) return;
    }
    navigate(to);
  }, [dirty, navigate, showConfirm]);

  const toggleSection = (id) => setExpandedSections((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setAnswer = (qid, val) => setAnswers((p) => ({ ...p, [qid]: val }));
  const setObs = (qid, val) => setObservations((p) => ({ ...p, [qid]: val }));
  const setSubAnswer = (subid, val) => setSubAnswers((p) => ({ ...p, [subid]: val }));
  const setSubObservation = (subid, val) => setSubObs((p) => ({ ...p, [subid]: val }));
  const toggleQuestion = (qid) => setEnabled((p) => ({ ...p, [qid]: !p[qid] }));
  const toggleSectionEnabled = (sid) => setSectionEnabled((p) => ({ ...p, [sid]: !p[sid] }));

  const handleTableChange = (qid, ri, field, val) => {
    setTableData((prev) => { const n = { ...prev }; n[qid] = [...(prev[qid] || [])]; n[qid][ri] = { ...n[qid][ri], [field]: val }; return n; });
  };

  const handlePhotoCapture = (qid) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPhotos((p) => ({ ...p, [qid]: [...(p[qid] || []), { file, preview: reader.result }] }));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const removePhoto = (qid, idx) => {
    setPhotos((p) => { const arr = [...(p[qid] || [])]; arr.splice(idx, 1); return { ...p, [qid]: arr }; });
  };

  const handleSaveQuestionnaire = async () => {
    try {
      await setDoc(doc(db, 'ssa_cuestionario', templateId), { sections, updatedAt: serverTimestamp(), updatedBy: user?.uid || '' }, { merge: true });
      setQuestionnaireSaved(true);
      setDirty(false);
      showToast('Cuestionario guardado correctamente.', 'success');
      setTimeout(() => setQuestionnaireSaved(false), 2000);
    } catch (err) { console.error('Error al guardar el cuestionario:', err); showToast('Error al guardar el cuestionario.', 'error'); }
  };

  const handleSaveMeta = async () => {
    if (!metaName.trim()) return showToast('El nombre es requerido', 'warn');
    try {
      await setDoc(doc(db, 'ssa_cuestionario', templateId), {
        name: metaName.trim(),
        description: metaDesc.trim(),
        subtitle: metaSub.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setTemplateMeta({ name: metaName.trim(), description: metaDesc.trim(), subtitle: metaSub.trim() });
      setShowMetaEditor(false);
      showToast('Metadatos actualizados', 'success');
    } catch (err) { console.error(err); showToast('Error al guardar metadatos', 'error'); }
  };

  // ── Admin functions ──
  const handleAddSection = () => {
    if (!newSectionTitle.trim()) return showToast('Escribe un titulo para la seccion.', 'warn');
    const secId = genId('C');
    const icon = SECTION_ICON_POOL[sections.length % SECTION_ICON_POOL.length];
    setSections((p) => [...p, { id: secId, title: newSectionTitle.trim(), icon, questions: [] }]);
    setSectionEnabled((p) => ({ ...p, [secId]: true }));
    setExpandedSections((p) => new Set([...p, secId]));
    setNewSectionTitle(''); setShowAddModal(false); markDirty();
  };

  const handleQuickAddSection = () => {
    const secId = genId('C');
    const icon = SECTION_ICON_POOL[sections.length % SECTION_ICON_POOL.length];
    setSections((p) => [...p, { id: secId, title: 'Nueva seccion', icon, questions: [] }]);
    setSectionEnabled((p) => ({ ...p, [secId]: true }));
    setExpandedSections((p) => new Set([...p, secId]));
    markDirty();
    showToast('Seccion creada. Edita su titulo y agrega sus preguntas.', 'success');
    setTimeout(() => {
      const el = document.getElementById(`ssa-section-${secId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      startEditSectionTitle(secId, 'Nueva seccion');
    }, 120);
  };

  const handleAddQuestion = () => {
    if (!newQuestionSectionId) return showToast('Selecciona la seccion destino.', 'warn');
    if (!newQuestionText.trim()) return showToast('Escribe el texto de la pregunta.', 'warn');
    const qid = getNextId(sections);
    setSections((p) => p.map((s) => String(s.id) === String(newQuestionSectionId) ? { ...s, questions: [...s.questions, { id: qid, text: newQuestionText.trim() }] } : s));
    setAnswers((p) => ({ ...p, [qid]: null }));
    setObservations((p) => ({ ...p, [qid]: '' }));
    setPhotos((p) => ({ ...p, [qid]: [] }));
    setEnabled((p) => ({ ...p, [qid]: true }));
    setExpandedQuestions((p) => new Set([...p, String(qid)]));
    setNewQuestionText(''); setNewQuestionSectionId(''); setNewQuestionType('simple'); setShowAddModal(false); markDirty();
  };

  const handleAddQuestionWithSubitems = () => {
    if (!newQuestionSectionId) return showToast('Selecciona la seccion destino.', 'warn');
    if (!newQuestionText.trim()) return showToast('Escribe el enunciado y los sub-items.', 'warn');
    const qid = getNextId(sections);
    const lines = newQuestionText.trim().split('\n').filter((l) => l.trim());
    const primaryText = lines[0];
    const subitemLines = lines.slice(1).map((l) => ({ id: genId('sub'), text: l.trim() }));
    setSections((p) => p.map((s) => String(s.id) === String(newQuestionSectionId)
      ? { ...s, questions: [...s.questions, { id: qid, text: primaryText, subitems: subitemLines }] }
      : s));
    setAnswers((p) => ({ ...p, [qid]: null }));
    setObservations((p) => ({ ...p, [qid]: '' }));
    setPhotos((p) => ({ ...p, [qid]: [] }));
    setEnabled((p) => ({ ...p, [qid]: true }));
    setExpandedQuestions((p) => new Set([...p, String(qid)]));
    subitemLines.forEach((sub) => {
      setSubAnswers((p) => ({ ...p, [sub.id]: null }));
      setSubObs((p) => ({ ...p, [sub.id]: '' }));
    });
    setNewQuestionText(''); setNewQuestionSectionId(''); setNewQuestionType('simple'); setShowAddModal(false); markDirty();
  };

  const handleAddInlineQuestion = (sectionId) => {
    const text = (inlineQuestionInput[sectionId] || '').trim();
    if (!text) return;
    const qid = getNextId(sections);
    setSections((p) => p.map((s) => String(s.id) === String(sectionId)
      ? { ...s, questions: [...s.questions, { id: qid, text }] }
      : s));
    setAnswers((p) => ({ ...p, [qid]: null }));
    setObservations((p) => ({ ...p, [qid]: '' }));
    setPhotos((p) => ({ ...p, [qid]: [] }));
    setEnabled((p) => ({ ...p, [qid]: true }));
    setExpandedQuestions((p) => new Set([...p, String(qid)]));
    setInlineQuestionInput((p) => ({ ...p, [sectionId]: '' }));
    markDirty();
  };

  const handleAddInlineSubitem = (questionId) => {
    const text = (inlineSubitemInput[questionId] || '').trim();
    if (!text) return;
    const subId = genId('sub');
    setSections((p) => p.map((s) => ({
      ...s,
      questions: s.questions.map((q) => String(q.id) === String(questionId)
        ? { ...q, subitems: [...(q.subitems || []), { id: subId, text }] }
        : q),
    })));
    setSubAnswers((p) => ({ ...p, [subId]: null }));
    setSubObs((p) => ({ ...p, [subId]: '' }));
    setInlineSubitemInput((p) => ({ ...p, [questionId]: '' }));
    markDirty();
  };

  const handleDeleteQuestion = (questionId) => {
    setSections((p) => p.map((s) => ({ ...s, questions: s.questions.filter((q) => String(q.id) !== String(questionId)) })));
    setAnswers((p) => { const n = { ...p }; delete n[questionId]; return n; });
    setObservations((p) => { const n = { ...p }; delete n[questionId]; return n; });
    setPhotos((p) => { const n = { ...p }; delete n[questionId]; return n; });
    setEnabled((p) => { const n = { ...p }; delete n[questionId]; return n; });
    markDirty();
  };

  const handleDeleteSection = (sectionId) => {
    setSections((p) => p.filter((s) => String(s.id) !== String(sectionId)));
    setSectionEnabled((p) => { const n = { ...p }; delete n[sectionId]; return n; });
    setExpandedSections((p) => { const n = new Set(p); n.delete(sectionId); return n; });
    markDirty();
  };

  const handleDeleteSubitem = (questionId, subitemId) => {
    setSections((p) => p.map((s) => ({
      ...s, questions: s.questions.map((q) => String(q.id) === String(questionId) ? { ...q, subitems: (q.subitems || []).filter((sub) => String(sub.id) !== String(subitemId)) } : q),
    })));
    setSubAnswers((p) => { const n = { ...p }; delete n[subitemId]; return n; });
    setSubObs((p) => { const n = { ...p }; delete n[subitemId]; return n; });
    markDirty();
  };

  const toggleExpandQuestion = (qid) => {
    setExpandedQuestions((prev) => { const next = new Set(prev); next.has(qid) ? next.delete(qid) : next.add(qid); return next; });
  };

  // ── Inline edit helpers (admin) ──
  const startEditQuestion = (qid, text) => { setEditingQuestionId(qid); setEditingQuestionText(text); };
  const saveEditQuestion = (qid) => {
    const text = editingQuestionText.trim();
    if (!text) return;
    setSections((p) => p.map((s) => ({ ...s, questions: s.questions.map((q) => String(q.id) === String(qid) ? { ...q, text } : q) })));
    setEditingQuestionId(null); setEditingQuestionText(''); markDirty();
  };
  const cancelEditQuestion = () => { setEditingQuestionId(null); setEditingQuestionText(''); };

  const startEditSectionTitle = (sid, title) => { setEditingSectionId(sid); setEditingSectionTitle(title); };
  const saveEditSectionTitle = (sid) => {
    const title = editingSectionTitle.trim();
    if (!title) return;
    setSections((p) => p.map((s) => String(s.id) === String(sid) ? { ...s, title } : s));
    setEditingSectionId(null); setEditingSectionTitle(''); markDirty();
  };
  const cancelEditSectionTitle = () => { setEditingSectionId(null); setEditingSectionTitle(''); };

  const setSectionIcon = (sectionId, iconName) => {
    setSections((p) => p.map((s) => String(s.id) === String(sectionId) ? { ...s, icon: iconName } : s));
    setIconPickerSection(null);
    markDirty();
  };

  const startEditSubitem = (subid, text) => { setEditingSubitemId(subid); setEditingSubitemText(text); };
  const saveEditSubitem = (qid, subid) => {
    const text = editingSubitemText.trim();
    if (!text) return;
    setSections((p) => p.map((s) => ({ ...s, questions: s.questions.map((q) => String(q.id) === String(qid) ? { ...q, subitems: (q.subitems || []).map((sub) => String(sub.id) === String(subid) ? { ...sub, text } : sub) } : q) })));
    setEditingSubitemId(null); setEditingSubitemText(''); markDirty();
  };
  const cancelEditSubitem = () => { setEditingSubitemId(null); setEditingSubitemText(''); };

  const confirmDeleteSection = async (sectionId) => {
    const ok = await showConfirm(
      isBuiltIn
        ? 'Esta es una plantilla OFICIAL. Vas a eliminar una seccion completa y sus preguntas. Esta accion no se puede deshacer. ¿Continuar?'
        : 'Eliminar esta seccion y todas sus preguntas?',
      isBuiltIn ? { title: 'Editando plantilla oficial', confirmLabel: 'Eliminar seccion' } : {}
    );
    if (ok) handleDeleteSection(sectionId);
  };

  const confirmDeleteQuestion = async (questionId) => {
    const ok = await showConfirm(
      isBuiltIn ? 'Plantilla OFICIAL: eliminar esta pregunta? Esta accion no se puede deshacer.' : 'Eliminar esta pregunta?',
      isBuiltIn ? { title: 'Editando plantilla oficial' } : {}
    );
    if (ok) handleDeleteQuestion(questionId);
  };

  const confirmDeleteSubitem = async (questionId, subitemId) => {
    const ok = await showConfirm('Eliminar este sub-item?');
    if (ok) handleDeleteSubitem(questionId, subitemId);
  };

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400";
  const selectClass = "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-28 space-y-5 md:space-y-6" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => guardedNavigate('/admin/ssa')} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <ChevronDown size={12} className="rotate-90" /> Canvas SSA
              </button>
              {isAdmin && (
                <button onClick={() => { setMetaName(templateMeta.name); setMetaDesc(templateMeta.description); setMetaSub(templateMeta.subtitle); setShowMetaEditor(true); }}
                  className="text-[10px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1">
                  <Pencil size={10} /> Editar metadatos
                </button>
              )}
              {dirty && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle size={10} /> Cambios sin guardar
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              {templateMeta.description || templateMeta.name || 'Editor de Cuestionario'}
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-0.5">
              {templateMeta.subtitle || 'Secretaria de Salud — Nuevo Leon'}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => guardedNavigate(`/ssa/evaluar/${templateId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
              <Eye size={14} /> Vista previa
            </button>
            <button onClick={() => guardedNavigate('/admin/ssa/historial')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <History size={14} /> Historial
            </button>
          </div>
        </div>

        {/* ── LOADING ── */}
        {questionnaireLoading && (
          <div className="flex flex-col items-center justify-center py-16 no-print gap-3">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium text-slate-500">Cargando cuestionario...</span>
          </div>
        )}

        {/* ── SECTIONS ── */}
        {!questionnaireLoading && sections.map((section, sIdx) => {
          const isExpanded = expandedSections.has(section.id);
          const sectionLabel = romanize(sIdx + 1);
          const SectionIcon = iconMap[section.icon] || ShieldCheck;
          const secEnabled = sectionEnabled[section.id];
          const secCompliance = section.questions.filter((q) => enabled[q.id] && answers[q.id] === 'SI').length;
          const secTotal = section.questions.filter((q) => enabled[q.id]).length
            + section.questions.filter((q) => enabled[q.id] && q.subitems).reduce((acc, q) => acc + (q.subitems?.length || 0), 0);
          const secNonCompliance = section.questions.filter((q) => enabled[q.id] && answers[q.id] === 'NO').length;

          return (
            <div key={section.id} id={`ssa-section-${section.id}`}
              className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                !secEnabled ? 'opacity-40 border-slate-100' : secNonCompliance > 0 ? 'border-red-200' : 'border-slate-200'
              }`}>
              {/* Section header */}
              <div
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-3 px-4 md:px-5 py-3.5 md:py-4 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
              >
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); if (isAdmin) setIconPickerSection(section.id); }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    !secEnabled ? 'bg-slate-100 text-slate-400' :
                    secNonCompliance > 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  } ${isAdmin ? 'hover:ring-2 hover:ring-blue-300 cursor-pointer' : 'cursor-default'}`}
                  title={isAdmin ? 'Cambiar icono' : undefined}>
                  <SectionIcon size={17} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{sectionLabel}</span>
                    {editingSectionId === section.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); saveEditSectionTitle(section.id); }}
                        className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input value={editingSectionTitle} onChange={(e) => setEditingSectionTitle(e.target.value)}
                          className="flex-1 px-2 py-1 rounded-lg border-2 border-blue-400 text-sm font-bold text-slate-800 bg-white focus:outline-none"
                          autoFocus onBlur={() => saveEditSectionTitle(section.id)} />
                      </form>
                    ) : (
                      <h3 className="text-sm md:text-[15px] font-bold text-slate-800 truncate">{section.title}</h3>
                    )}
                    {!secEnabled && <span className="text-[10px] text-slate-400 font-medium">Deshabilitada</span>}
                  </div>
                  {secEnabled && (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-medium text-emerald-600">{secCompliance} SI</span>
                      {secNonCompliance > 0 && <span className="text-[10px] font-medium text-red-600">{secNonCompliance} NO</span>}
                      <span className="text-[10px] text-slate-400">{secTotal} items</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 no-print">
                  {isAdmin && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); startEditSectionTitle(section.id, section.title); }}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors" title="Editar titulo de seccion">
                        <Pencil size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); confirmDeleteSection(section.id); }}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors" title="Eliminar seccion">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); toggleSectionEnabled(section.id); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      secEnabled ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'
                    }`} title={secEnabled ? 'Deshabilitar' : 'Habilitar'}>
                    {secEnabled ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <ChevronDown size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Section body */}
              {isExpanded && secEnabled && (
                <div className="border-t border-slate-100">
                  {section.questions.map((q, qi) => {
                    const qDisabled = !enabled[q.id];
                    const qPhotos = photos[q.id] || [];
                    const qAns = answers[q.id];
                    const isExpandedQ = expandedQuestions.has(q.id);
                    const showDetails = !qDisabled && (isAdmin || isExpandedQ);

                    return (
                      <div key={q.id} className={`${qi < section.questions.length - 1 ? 'border-b border-slate-50' : ''} ${qDisabled ? 'opacity-30 bg-slate-50/50' : ''}`}>

                        {/* Question row */}
                        <div className="flex items-start gap-2 md:gap-3 px-4 md:px-5 py-3">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 ${
                            qAns === 'SI' ? 'bg-emerald-100 text-emerald-700' :
                            qAns === 'NO' ? 'bg-red-100 text-red-700' :
                            qAns === 'PARCIAL' ? 'bg-amber-100 text-amber-700' :
                            qAns === 'NA' ? 'bg-slate-200 text-slate-500' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {qi + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            {editingQuestionId === q.id ? (
                              <form onSubmit={(e) => { e.preventDefault(); saveEditQuestion(q.id); }}
                                className="flex gap-1">
                                <textarea value={editingQuestionText} onChange={(e) => setEditingQuestionText(e.target.value)}
                                  className="flex-1 px-2 py-1.5 rounded-lg border-2 border-blue-400 text-sm text-slate-700 bg-white focus:outline-none resize-y"
                                  rows={2} autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Escape') cancelEditQuestion(); }} />
                                <div className="flex flex-col gap-1">
                                  <button type="submit" className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors" title="Guardar">
                                    <CheckCircle2 size={13} />
                                  </button>
                                  <button type="button" onClick={cancelEditQuestion}
                                    className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors" title="Cancelar">
                                    <XCircle size={13} />
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium">{q.text}</p>
                                {q.subitems && (
                                  <span className="text-[10px] text-slate-400 font-medium mt-0.5 inline-block">
                                    {q.subitems.length} sub-items
                                  </span>
                                )}
                              </>
                            )}
                            {qAns === 'NO' && !qDisabled && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                                <AlertTriangle size={12} className="flex-shrink-0" />
                                Incumplimiento — genera sancion administrativa
                              </div>
                            )}
                          </div>

                          {/* Answer buttons */}
                          <div className="flex flex-shrink-0 no-print">
                            <div className={`flex bg-slate-100 rounded-xl p-1 gap-0.5 ${qDisabled ? 'pointer-events-none' : ''}`}>
                              {ANSWER_OPTIONS.map((opt) => {
                                const active = qAns === opt.key;
                                return (
                                  <button key={opt.key} onClick={() => setAnswer(q.id, active ? null : opt.key)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                      active
                                        ? `${opt.bg} ${opt.text} ring-1 ${opt.ring} shadow-sm`
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'
                                    }`}
                                    title={opt.label}>
                                    <opt.icon size={13} />
                                    <span className="hidden sm:inline">{opt.short}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Expand/Admin controls */}
                          <div className="flex items-center gap-0.5 flex-shrink-0 no-print">
                            {!isAdmin && (
                              <button onClick={() => toggleExpandQuestion(q.id)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                  isExpandedQ ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`} title={isExpandedQ ? 'Ocultar' : 'Mas opciones'}>
                                <ChevronRight size={14} className={`transition-transform duration-200 ${isExpandedQ ? 'rotate-90' : ''}`} />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button onClick={() => startEditQuestion(q.id, q.text)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Editar texto de pregunta">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => toggleQuestion(q.id)}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                    qDisabled ? 'text-slate-300 hover:text-blue-500 hover:bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                  }`} title={qDisabled ? 'Activar' : 'Desactivar'}>
                                  {qDisabled ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                <button onClick={() => confirmDeleteQuestion(q.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {showDetails && (
                          <div className="px-4 md:px-5 pb-4 ml-8 space-y-3 no-print">

                            {/* Sub-items */}
                            {(isAdmin || (q.subitems && q.subitems.length > 0)) && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sub-items de verificacion</p>
                                {(q.subitems || []).map((sub, si) => {
                                  const subAns = subAnswers[sub.id];
                                  return (
                                    <div key={sub.id} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                      <div className="flex items-start gap-2">
                                      <span className="min-w-[1.9rem] px-1 h-5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{qi + 1}.{si + 1}</span>
                                      {editingSubitemId === sub.id ? (
                                        <form onSubmit={(e) => { e.preventDefault(); saveEditSubitem(q.id, sub.id); }}
                                          className="flex-1 flex gap-1">
                                          <textarea value={editingSubitemText} onChange={(e) => setEditingSubitemText(e.target.value)}
                                            className="flex-1 px-2 py-1 rounded-lg border-2 border-blue-400 text-xs text-slate-700 bg-white focus:outline-none resize-y"
                                            rows={2} autoFocus
                                            onKeyDown={(e) => { if (e.key === 'Escape') cancelEditSubitem(); }} />
                                          <div className="flex flex-col gap-0.5">
                                            <button type="submit" className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors" title="Guardar">
                                              <CheckCircle2 size={11} />
                                            </button>
                                            <button type="button" onClick={cancelEditSubitem}
                                              className="w-6 h-6 rounded-md bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors" title="Cancelar">
                                              <XCircle size={11} />
                                            </button>
                                          </div>
                                        </form>
                                      ) : (
                                        <span className="text-xs text-slate-700 flex-1 leading-relaxed">{sub.text}</span>
                                      )}
                                      <div className="flex gap-0.5 bg-white rounded-lg p-0.5 border border-slate-200 flex-shrink-0">
                                        {ANSWER_OPTIONS.map((opt) => {
                                          const active = subAns === opt.key;
                                          return (
                                            <button key={opt.key} onClick={() => setSubAnswer(sub.id, active ? null : opt.key)}
                                              className={`flex items-center justify-center w-8 h-7 rounded-md text-[10px] font-bold transition-all ${
                                                active ? `${opt.bg} ${opt.text}` : 'text-slate-400 hover:text-slate-600'
                                              }`}
                                              title={opt.label}>
                                              <opt.icon size={12} />
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <input type="text" value={subObs[sub.id] || ''} onChange={(e) => setSubObservation(sub.id, e.target.value)}
                                        placeholder="Obs."
                                        className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                                      {isAdmin && (
                                        <>
                                          <button onClick={() => startEditSubitem(sub.id, sub.text)}
                                            className="text-slate-300 hover:text-blue-500 flex-shrink-0" title="Editar sub-item">
                                            <Pencil size={11} />
                                          </button>
                                          <button onClick={() => confirmDeleteSubitem(q.id, sub.id)}
                                            className="text-slate-300 hover:text-red-500 flex-shrink-0" title="Eliminar sub-item">
                                            <Trash2 size={11} />
                                          </button>
                                        </>
                                      )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 mt-2 pl-[2.4rem]">
                                        {(photos[sub.id] || []).map((p, idx) => (
                                          <div key={`${sub.id}-photo-${idx}`} className="relative group">
                                            <img src={p.preview} alt={`Foto ${idx + 1}`} className="w-12 h-12 rounded-lg border border-slate-200 object-cover shadow-sm" />
                                            <button onClick={() => removePhoto(sub.id, idx)}
                                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Trash2 size={8} />
                                            </button>
                                          </div>
                                        ))}
                                        <button onClick={() => handlePhotoCapture(sub.id)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 border-dashed border-slate-300 text-[10px] font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all">
                                          <Camera size={12} /> {(photos[sub.id] || []).length > 0 ? 'Mas fotos' : 'Foto'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {isAdmin && (
                                  <div className="flex items-center gap-2 pl-10">
                                    <input type="text" value={inlineSubitemInput[q.id] || ''}
                                      onChange={(e) => setInlineSubitemInput((p) => ({ ...p, [q.id]: e.target.value }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddInlineSubitem(q.id); } }}
                                      placeholder="Nuevo sub-item para esta pregunta..."
                                      className="flex-1 px-2.5 py-1.5 rounded-lg border-2 border-dashed border-slate-300 text-[11px] text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-400" />
                                    <button onClick={() => handleAddInlineSubitem(q.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 text-white text-[11px] font-bold hover:bg-slate-800 transition-colors flex-shrink-0">
                                      <Plus size={11} /> Sub-item
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Observations */}
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observaciones</p>
                              <textarea
                                value={observations[q.id] || ''} onChange={(e) => setObs(q.id, e.target.value)}
                                placeholder="Describe hallazgos, notas o evidencias encontradas durante la evaluacion..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-400 resize-y bg-white"
                              />
                            </div>

                            {/* Photos */}
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Evidencia fotografica</p>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {qPhotos.map((p, idx) => (
                                  <div key={idx} className="relative group">
                                    <img src={p.preview} alt={`Foto ${idx + 1}`} className="w-20 h-20 rounded-xl border border-slate-200 object-cover shadow-sm" />
                                    <button onClick={() => removePhoto(q.id, idx)}
                                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 size={9} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button onClick={() => handlePhotoCapture(q.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                <Camera size={14} /> {qPhotos.length > 0 ? 'Agregar otra foto' : 'Tomar foto'}
                              </button>
                            </div>

                            {/* Table */}
                            {q.tableHeaders && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{q.tableNote}</p>
                                <div className="overflow-hidden rounded-xl border border-slate-200">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        {q.tableHeaders.map((h, i) => (
                                          <th key={i} className="px-3 py-2 text-left font-bold text-slate-500 uppercase text-[10px] border-b border-slate-200">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(tableData[q.id] || []).map((row, ri) => (
                                        <tr key={ri} className="border-b border-slate-100 last:border-0">
                                          <td className="px-3 py-1.5">
                                            <input type="text" value={row.muestra} onChange={(e) => handleTableChange(q.id, ri, 'muestra', e.target.value)}
                                              placeholder="N." className="w-full px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                                          </td>
                                          <td className="px-3 py-1.5">
                                            <input type="text" value={row.localizacion} onChange={(e) => handleTableChange(q.id, ri, 'localizacion', e.target.value)}
                                              placeholder="Ubicacion" className="w-full px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                                          </td>
                                          <td className="px-3 py-1.5">
                                            <input type="text" value={row.resultado} onChange={(e) => handleTableChange(q.id, ri, 'resultado', e.target.value)}
                                              placeholder="Resultado" className="w-full px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Inline add question (admin) */}
                  {isAdmin && (
                    <div className="px-4 md:px-5 py-3 border-t border-dashed border-slate-200 bg-slate-50/30 no-print">
                      <div className="flex items-center gap-2">
                        <input type="text" value={inlineQuestionInput[section.id] || ''}
                          onChange={(e) => setInlineQuestionInput((p) => ({ ...p, [section.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddInlineQuestion(section.id); } }}
                          placeholder="Escribe una nueva pregunta para esta seccion..."
                          className="flex-1 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder:text-slate-400" />
                        <button onClick={() => handleAddInlineQuestion(section.id)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors flex-shrink-0 shadow-sm">
                          <Plus size={13} /> Agregar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed disabled section hint */}
              {isExpanded && !secEnabled && (
                <div className="border-t border-slate-100 px-4 md:px-5 py-6 text-center">
                  <EyeOff size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Seccion deshabilitada</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Habilita la seccion para evaluar sus items</p>
                </div>
              )}
            </div>
          );
        })}

        {/* ── AGREGAR NUEVA SECCION ── */}
        {isAdmin && !questionnaireLoading && (
          <button onClick={handleQuickAddSection}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 transition-all no-print">
            <FolderPlus size={17} /> Agregar nueva seccion
          </button>
        )}

        {/* ── PANEL INFERIOR ── */}
        {isAdmin && !questionnaireLoading && (
          <div className="flex items-center justify-center gap-3 pt-2 no-print flex-wrap sticky bottom-4 z-10">
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg p-1.5">
              <button onClick={handleSaveQuestionnaire}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  questionnaireSaved ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {questionnaireSaved ? <CheckCircle2 size={15} /> : <FolderPlus size={15} />}
                {questionnaireSaved ? 'Guardado' : 'Guardar cuestionario'}
              </button>
              <button onClick={() => { setShowAddModal(true); setAddMode('section'); setNewQuestionType('simple'); setNewSectionTitle(''); setNewQuestionText(''); setNewQuestionSectionId(''); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #0f3b5e, #1a5f8a)' }}>
                <Plus size={15} /> Agregar elemento
              </button>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        {!questionnaireLoading && (
          <div className="text-center pb-6 no-print">
            <p className="text-[10px] font-bold text-slate-500">Centro Integral de Servicios</p>
            <p className="text-[10px] text-slate-400">Tel. 8181307020 &mdash; cis.ventanilla@saludnl.gob.mx</p>
          </div>
        )}

        {/* ── ADD ELEMENT MODAL ── */}
        {showAddModal && (
          <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Agregar elemento al cuestionario</h3>
                <button onClick={() => setShowAddModal(false)} className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center">
                  <XCircle size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  {[
                    { id: 'section', label: 'Seccion', icon: FolderPlus },
                    { id: 'question', label: 'Pregunta', icon: ListPlus },
                  ].map((m) => (
                    <button key={m.id} onClick={() => setAddMode(m.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        addMode === m.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      <m.icon size={13} /> {m.label}
                    </button>
                  ))}
                </div>

                {addMode === 'section' && (
                  <div className="space-y-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Titulo de la seccion</span>
                      <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)}
                        placeholder="Ej: Consultorio de odontologia" className={inputClass} />
                    </label>
                    <button onClick={handleAddSection}
                      className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
                      Crear seccion
                    </button>
                  </div>
                )}

                {addMode === 'question' && (
                  <div className="space-y-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Seccion destino</span>
                      <select value={newQuestionSectionId} onChange={(e) => setNewQuestionSectionId(e.target.value)} className={selectClass}>
                        <option value="">Seleccionar seccion...</option>
                        {sections.map((s, i) => <option key={s.id} value={s.id}>{romanize(i + 1)}. {s.title}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Tipo de pregunta</span>
                      <select value={newQuestionType} onChange={(e) => setNewQuestionType(e.target.value)} className={selectClass}>
                        <option value="simple">Texto simple</option>
                        <option value="subitems">Con sub-items (uno por linea)</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">
                        {newQuestionType === 'subitems' ? 'Primera linea = enunciado principal, resto = sub-items' : 'Texto de la pregunta'}
                      </span>
                      <textarea value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)}
                        placeholder={newQuestionType === 'subitems' ? 'Enunciado principal\nSub-item 1\nSub-item 2' : 'Escribe la pregunta...'}
                        rows={4} className={`${inputClass} resize-y`} />
                    </label>
                    <button onClick={newQuestionType === 'subitems' ? handleAddQuestionWithSubitems : handleAddQuestion}
                      className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
                      Agregar pregunta
                    </button>
                    <p className="text-[11px] text-slate-400 text-center">
                      ¿Solo un sub-item? Usa el campo "Nuevo sub-item" dentro de cada pregunta.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* ── TOAST CONTAINER ── */}
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const config = {
            error: { bg: 'bg-red-600', icon: XCircle, iconColor: 'text-red-200' },
            warn: { bg: 'bg-amber-600', icon: AlertTriangle, iconColor: 'text-amber-200' },
            success: { bg: 'bg-emerald-600', icon: CheckCircle2, iconColor: 'text-emerald-200' },
            info: { bg: 'bg-blue-600', icon: Info, iconColor: 'text-blue-200' },
          }[t.type] || { bg: 'bg-slate-800', icon: Info, iconColor: 'text-slate-300' };
          const Icon = config.icon;
          return (
            <div key={t.id}
              className={`${config.bg} text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2.5 min-w-[280px] max-w-sm pointer-events-auto animate-in slide-in-from-right fade-in duration-300`}>
              <Icon size={16} className={config.iconColor} />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-white/60 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── METADATA EDITOR MODAL ── */}
      {showMetaEditor && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowMetaEditor(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Editar metadatos del cuestionario</h3>
            </div>
            <div className="p-5 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Nombre *</span>
                <input value={metaName} onChange={(e) => setMetaName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Descripcion / Titulo</span>
                <input value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Subtitulo</span>
                <input value={metaSub} onChange={(e) => setMetaSub(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowMetaEditor(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancelar</button>
              <button onClick={handleSaveMeta}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ICON PICKER MODAL ── */}
      {iconPickerSection && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 no-print" onClick={() => setIconPickerSection(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xs w-full animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Elegir icono de la seccion</h3>
              <button onClick={() => setIconPickerSection(null)} className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-6 gap-1.5">
              {SECTION_ICON_POOL.map((name) => {
                const Ic = iconMap[name] || ShieldCheck;
                const current = sections.find((s) => String(s.id) === String(iconPickerSection));
                const isCur = current?.icon === name;
                return (
                  <button key={name} type="button" onClick={() => setSectionIcon(iconPickerSection, name)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isCur ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                    title={name}>
                    <Ic size={18} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DIALOG ── */}
      {confirmState && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { confirmState.resolve(false); setConfirmState(null); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 text-center">
              <AlertTriangle size={36} className={`mx-auto mb-3 ${confirmState.tone === 'warn' ? 'text-amber-500' : 'text-red-500'}`} />
              <p className="text-sm font-bold text-slate-800 mb-1">{confirmState.title}</p>
              <p className="text-xs text-slate-500">{confirmState.message}</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
                className="flex-1 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-bl-2xl transition-colors">
                {confirmState.cancelLabel}
              </button>
              <button onClick={() => { confirmState.resolve(true); setConfirmState(null); }}
                className={`flex-1 py-3 text-sm font-bold border-l border-slate-100 rounded-br-2xl transition-colors ${
                  confirmState.tone === 'warn' ? 'text-amber-600 hover:bg-amber-50' : 'text-red-600 hover:bg-red-50'
                }`}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoevaluacionSSA;
