import React, { useEffect, useMemo, useState } from 'react';
import { Search, Building2, Plus, Stethoscope, Tags, MapPin, GraduationCap, FlaskConical, Pencil, Save, X, Activity, Trash2, ArrowUp, ArrowDown, Settings2, ChevronRight, Clock, Phone, Globe, Users, Layers, Hash, DollarSign, Video, ToggleLeft, ToggleRight, GripVertical, Shield, Package, Beaker, ClipboardList, Syringe, Bandage, BookOpen, Upload, FileText, Link2, AlertTriangle } from 'lucide-react';
import { collection, addDoc, getDocs, orderBy, query, where, serverTimestamp, updateDoc, doc, deleteDoc, writeBatch, onSnapshot, setDoc } from 'firebase/firestore';
import { db, storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { PROCEDURE_CATEGORY_OPTIONS, getProcedureCategoryLabel, normalizeProcedureCategory, normalizeProcedureRecord } from '../../services/procedureCatalogService';
import { getStudyCategoryLabel, loadStudiesFromPublicData, normalizeStudyCategory, normalizeStudyRecord, STUDY_CATEGORY_OPTIONS } from '../../services/studyCatalogService';
import { TIPO_CITA_OPTIONS, getTipoCitaLabel, normalizeReferenciaMedicaRecord } from '../../services/referenciaMedicaService';
import {
  buildSymptomCategoryId,
  buildSymptomCategorySections,
  getDefaultSymptomCategoryId,
  getSymptomCategoryLabelFromId,
  sortSymptoms,
  SYMPTOM_CATEGORY_COLOR_FALLBACK,
  SYMPTOM_CATEGORY_COLOR_OPTIONS,
  SYMPTOM_CATEGORY_DEFAULTS
} from '../../services/symptomCatalogService';
import useIsMobile from '../../hooks/useIsMobile';
import { normalizeForSearch, fuzzyScore } from '../../utils/searchUtils';

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const CONSULTORIO_HORARIO_PRESETS = [
  {
    id: 'oficina',
    label: 'Oficina (L-V 08:00-18:00)',
    horaInicio: '08:00',
    horaFin: '18:00',
    diasAtencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  },
  {
    id: 'matutino',
    label: 'Matutino (L-S 07:00-15:00)',
    horaInicio: '07:00',
    horaFin: '15:00',
    diasAtencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  },
  {
    id: 'vespertino',
    label: 'Vespertino (L-S 14:00-22:00)',
    horaInicio: '14:00',
    horaFin: '22:00',
    diasAtencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  }
];

const normalizeTimeValue = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  const compact = raw.replace(/\s+/g, '').replace(/\./g, '');
  let meridiem = '';
  let body = compact;

  if (body.endsWith('am') || body.endsWith('pm')) {
    meridiem = body.slice(-2);
    body = body.slice(0, -2);
  }

  const match = body.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return '';

  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2] || '0', 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return '';

  if (meridiem) {
    if (hour < 1 || hour > 12) return '';
    if (meridiem === 'am') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  }

  if (!meridiem && (hour < 0 || hour > 23)) return '';

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const is24hSchedule = (horaInicio = '', horaFin = '', diasAtencion = []) => {
  if (normalizeTimeValue(horaInicio) !== '00:00') return false;
  if (normalizeTimeValue(horaFin) !== '23:59') return false;
  return DIAS_SEMANA.every((dia) => diasAtencion.includes(dia));
};

const timeToMinutes = (value = '') => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return null;
  const [hour = '00', minute = '00'] = normalized.split(':');
  return (Number.parseInt(hour, 10) * 60) + Number.parseInt(minute, 10);
};

const isWithinTimeRange = (hora = '', inicio = '00:00', fin = '23:59') => {
  const horaMin = timeToMinutes(hora);
  if (horaMin === null) return false;

  const inicioMin = timeToMinutes(inicio);
  const finMin = timeToMinutes(fin);

  if (inicioMin === null || finMin === null) return true;

  if (inicioMin <= finMin) {
    return horaMin >= inicioMin && horaMin <= finMin;
  }

  return horaMin >= inicioMin || horaMin <= finMin;
};

const buildEffectiveSchedule = ({
  horarioTipo = 'personalizado',
  inicio = '',
  fin = '',
  dias = [],
  fallbackInicio = '08:00',
  fallbackFin = '20:00',
  fallbackDias = DIAS_SEMANA,
}) => {
  const normalizedInicio = normalizeTimeValue(inicio) || fallbackInicio;
  const normalizedFin = normalizeTimeValue(fin) || fallbackFin;
  const normalizedDias = Array.isArray(dias) && dias.length > 0 ? dias : fallbackDias;
  const fullDay = horarioTipo === '24h' || is24hSchedule(normalizedInicio, normalizedFin, normalizedDias);

  return {
    inicio: fullDay ? '00:00' : normalizedInicio,
    fin: fullDay ? '23:59' : normalizedFin,
    dias: fullDay ? [...DIAS_SEMANA] : normalizedDias,
    is24h: fullDay,
  };
};

const formatScheduleLabel = (schedule) => {
  if (!schedule) return 'Sin horario';
  return schedule.is24h ? '24 horas' : `${schedule.inicio}-${schedule.fin}`;
};

const hasScheduleConflict = (schedule, referenceSchedule) => {
  if (!schedule || !referenceSchedule) return false;

  const missingDay = schedule.dias.some((dia) => !referenceSchedule.dias.includes(dia));
  if (missingDay) return true;

  return !isWithinTimeRange(schedule.inicio, referenceSchedule.inicio, referenceSchedule.fin)
    || !isWithinTimeRange(schedule.fin, referenceSchedule.inicio, referenceSchedule.fin);
};

const titleFromId = getSymptomCategoryLabelFromId;

const CatalogosGlobales = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isAdmin = useMemo(() => {
    const rol = (user?.rol || '').toLowerCase();
    return rol === 'admin' || rol === 'admin_maestro';
  }, [user?.rol]);

  const [motivos, setMotivos] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [sintomatologia, setSintomatologia] = useState([]);
  const [categoriasSintomas, setCategoriasSintomas] = useState(SYMPTOM_CATEGORY_DEFAULTS);
  const [estudios, setEstudios] = useState([]);
  const [legacyEstudios, setLegacyEstudios] = useState([]);
  const [procedimientos, setProcedimientos] = useState([]);
  const [referenciasMedicas, setReferenciasMedicas] = useState([]);
  const [referenciaMedicaForm, setReferenciaMedicaForm] = useState({
    especialidad: '',
    tipoCita: TIPO_CITA_OPTIONS[0]?.id || 'primera_vez',
    nombreMedico: '',
    telefonoConsultorio: '',
    direccionConsultorio: '',
    activo: true
  });
  const [editingReferenciaMedicaId, setEditingReferenciaMedicaId] = useState(null);
  const [docsCapacitacion, setDocsCapacitacion] = useState([]);
  const [capacitacionForm, setCapacitacionForm] = useState({ titulo: '', categoria: '', descripcion: '', contenido: '', orden: 0 });
  const [editingCapacitacionId, setEditingCapacitacionId] = useState(null);
  const [capacitacionFile, setCapacitacionFile] = useState(null);
  const [uploadingCapacitacion, setUploadingCapacitacion] = useState(false);
  const [docsCapacitacionMedicos, setDocsCapacitacionMedicos] = useState([]);
  const [capacitacionMedicosForm, setCapacitacionMedicosForm] = useState({ titulo: '', categoria: '', descripcion: '', contenido: '', orden: 0 });
  const [editingCapacitacionMedicosId, setEditingCapacitacionMedicosId] = useState(null);
  const [capacitacionMedicosFile, setCapacitacionMedicosFile] = useState(null);
  const [uploadingCapacitacionMedicos, setUploadingCapacitacionMedicos] = useState(false);
  const [estudioForm, setEstudioForm] = useState({
    clave: '',
    descripcion: '',
    precio: '',
    categoria: 'laboratorio',
    componentesIds: [],
    activo: true
  });
  const [editingEstudioId, setEditingEstudioId] = useState(null);
  const [importandoEstudios, setImportandoEstudios] = useState(false);
  const [procedimientoForm, setProcedimientoForm] = useState({
    clave: '',
    nombre: '',
    categoria: PROCEDURE_CATEGORY_OPTIONS[0]?.id || 'curacion',
    descripcion: '',
    preparacion: '',
    contraindicaciones: '',
    duracionMin: '20',
    requiereConsentimiento: false,
    activo: true
  });
  const [editingProcedimientoId, setEditingProcedimientoId] = useState(null);

  const [motivoForm, setMotivoForm] = useState({
    nombre: '',
    precio: '',
    area: '',
    duracionMin: '20',
    precioMin: '',
    precioMax: '',
    teleconsultaPermitida: true,
    atendidoPorEnfermeria: false,
    prioridadTriage: 'media',
    colorTag: '#0ea5e9'
  });
  const [consultorioForm, setConsultorioForm] = useState({
    nombre: '',
    ubicacion: '',
    especialidad: '',
    sucursalId: '',
    horarioTipo: 'personalizado',
    horaInicio: '08:00',
    horaFin: '18:00',
    intervaloMin: '10',
    capacidadSimultanea: '1',
    diasAtencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  });
  const [sucursalForm, setSucursalForm] = useState({
    nombre: '',
    ubicacion: '',
    telefono: '',
    responsable: '',
    horarioTipo: 'personalizado',
    horaApertura: '08:00',
    horaCierre: '20:00',
    timezone: 'America/Mexico_City',
    diasOperacion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  });
  const [especialidadNombre, setEspecialidadNombre] = useState('');
  const [editingMotivoId, setEditingMotivoId] = useState(null);
  const [editingConsultorioId, setEditingConsultorioId] = useState(null);
  const [editingSucursalId, setEditingSucursalId] = useState(null);
  const [editingEspecialidadId, setEditingEspecialidadId] = useState(null);
  const [sintomatologiaNombre, setSintomatologiaNombre] = useState('');
  const [sintomatologiaCategoria, setSintomatologiaCategoria] = useState('generales');
  const [editingSintomatologiaId, setEditingSintomatologiaId] = useState(null);
  const [categoriaSintomaNombre, setCategoriaSintomaNombre] = useState('');
  const [categoriaSintomaColor, setCategoriaSintomaColor] = useState(SYMPTOM_CATEGORY_COLOR_FALLBACK);
  const [editingCategoriaSintomaId, setEditingCategoriaSintomaId] = useState(null);
  const [activeTab, setActiveTab] = useState('motivos');
  const [capacitacionSubTab, setCapacitacionSubTab] = useState('enfermeria');
  const [pill, setPill] = useState({ show: false, type: 'info', message: '' });
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onAccept: null });
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [targetHighlightId, setTargetHighlightId] = useState(null);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery || globalSearchQuery.trim().length < 2) return [];
    const q = globalSearchQuery.trim();
    const qNormalized = normalizeForSearch(q);
    const tokens = qNormalized.split(/\s+/).filter(t => t.length >= 1);
    const isMultiToken = tokens.length > 1;
    const results = [];

    const scoreItem = (text = '') => {
      if (!text) return 0;
      const t = normalizeForSearch(text);
      if (!t) return 0;
      if (t.includes(qNormalized)) return 1.0;
      return fuzzyScore(q, t);
    };

    const matchesMultiToken = (text = '') => {
      if (!text) return false;
      const t = normalizeForSearch(text);
      return tokens.every(tok => {
        if (t.includes(tok)) return true;
        return fuzzyScore(tok, t) > 0.3;
      });
    };

    const addItem = (item, type, name, extra, getSubtitle) => {
      let score = 0;
      if (isMultiToken) {
        const nameOk = matchesMultiToken(name);
        const extraOk = extra ? matchesMultiToken(extra) : false;
        if (!nameOk && !extraOk) return;
        score = Math.max(scoreItem(name), scoreItem(extra));
      } else {
        score = scoreItem(name);
        if (score <= 0.25 && extra) {
          score = Math.max(score, scoreItem(extra));
        }
        if (score <= 0.25) return;
      }
      results.push({
        id: item.id,
        type,
        title: name,
        subtitle: getSubtitle(item),
        _score: score,
      });
    };

    motivos.forEach(m => addItem(m, 'motivos', m.nombre || '', m.area || '', m => `Motivo • ${m.area || 'General'}`));
    consultorios.forEach(c => addItem(c, 'consultorios', c.nombre || '', c.sucursal || '', c => `Consultorio • Sucursal: ${c.sucursal || 'N/D'}`));
    sucursales.forEach(s => addItem(s, 'sucursales', s.nombre || '', s.ubicacion || '', s => `Sucursal • ${s.ubicacion || 'Sin ubicación'}`));
    especialidades.forEach(e => addItem(e, 'especialidades', e.nombre || '', '', () => 'Especialidad médica'));
    sintomatologia.forEach(s => addItem(s, 'sintomatologia', s.nombre || '', '', () => 'Síntoma'));
    estudios.forEach(e => addItem(e, 'estudios', e.descripcion || '', e.clave || '', e => `Estudio • Clave: ${e.clave || 'S/C'}`));
    procedimientos.forEach(p => addItem(p, 'procedimientos', p.nombre || '', p.clave || '', p => `Procedimiento • Clave: ${p.clave || 'S/C'}`));
    referenciasMedicas.forEach(r => addItem(r, 'referencias', r.nombreMedico || '', r.especialidad || '', r => `Referencia Médica • ${r.especialidad || 'N/D'}`));

    results.sort((a, b) => b._score - a._score);
    return results.filter(r => r._score > 0.25).slice(0, 12);
  }, [globalSearchQuery, motivos, consultorios, sucursales, especialidades, sintomatologia, estudios, procedimientos, referenciasMedicas]);

  const handleSelectSearchResult = (result) => {
    setActiveTab(result.type);
    setGlobalSearchQuery('');
    setTargetHighlightId(result.id);
    
    setTimeout(() => {
      const el = document.getElementById(`catalog-item-${result.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    setTimeout(() => {
      setTargetHighlightId(null);
    }, 3000);
  };

  const showPill = (message, type = 'info') => {
    setPill({ show: true, type, message });
  };

  const askConfirm = (message, onAccept) => {
    setConfirmState({ open: true, message, onAccept });
  };

  useEffect(() => {
    if (!pill.show) return undefined;
    const t = setTimeout(() => setPill((prev) => ({ ...prev, show: false })), 3200);
    return () => clearTimeout(t);
  }, [pill.show]);

  const categoriasSintomasActivas = useMemo(
    () => categoriasSintomas.filter((cat) => cat.activo !== false),
    [categoriasSintomas]
  );

  const categoriaDefaultId = useMemo(
    () => getDefaultSymptomCategoryId(categoriasSintomasActivas.length > 0 ? categoriasSintomasActivas : categoriasSintomas),
    [categoriasSintomas, categoriasSintomasActivas]
  );

  const categoriasConSintomas = useMemo(() => {
    return buildSymptomCategorySections({
      categories: categoriasSintomas,
      symptoms: sintomatologia,
      defaultCategoryId: categoriaDefaultId,
      includeEmptyCategories: true,
      includeInactiveCategories: true
    });
  }, [categoriaDefaultId, categoriasSintomas, sintomatologia]);

  const sintomasOrdenados = useMemo(() => [...sintomatologia].sort((a, b) => {
    const ordenA = Number(a.orden ?? 9999);
    const ordenB = Number(b.orden ?? 9999);
    if (ordenA !== ordenB) return ordenA - ordenB;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
  }), [sintomatologia]);

  useEffect(() => {
    if (!sintomatologiaCategoria || !categoriasConSintomas.some((cat) => cat.id === sintomatologiaCategoria && cat.activo !== false)) {
      setSintomatologiaCategoria(categoriaDefaultId);
    }
  }, [categoriaDefaultId, categoriasConSintomas, sintomatologiaCategoria]);

  const propagarCambioConsultorio = async (consultorioId, nuevoNombre, nuevaUbicacion, viejoNombre) => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let count = 0;
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const matchById = data.consultorioActualId === consultorioId || data.consultorioRecurrenteId === consultorioId || data.consultorioId === consultorioId;
        const matchByName = !matchById && (data.consultorioRecurrente === viejoNombre || data.consultorioActual === viejoNombre || data.consultorio === viejoNombre);
        if (matchById || matchByName) {
          const updates = {};
          if (data.consultorioRecurrenteId === consultorioId || data.consultorioRecurrente === viejoNombre) {
            updates.consultorioRecurrente = nuevoNombre;
          }
          if (data.consultorioActualId === consultorioId || data.consultorioActual === viejoNombre) {
            updates.consultorioActual = nuevoNombre;
            updates.consultorio = nuevoNombre;
          }
          if (data.consultorioId === consultorioId || data.consultorio === viejoNombre) {
            updates.consultorio = nuevoNombre;
          }
          if (Object.keys(updates).length > 0) {
            batch.update(doc(db, 'users', d.id), updates);
            count++;
          }
        }
      });
      if (count > 0) await batch.commit();
      console.log(`Propagación consultorio: ${count} usuarios actualizados`);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const hoyStr = hoy.toISOString().slice(0, 10);
      const citasBatch = writeBatch(db);
      let citasCount = 0;
      const citasSnap = await getDocs(query(collection(db, 'citas'), where('consultorioId', '==', consultorioId), where('fecha', '>=', hoyStr)));
      citasSnap.docs.forEach((d) => {
        const citaUpdates = { consultorioNombre: nuevoNombre, consultorio: nuevoNombre };
        if (nuevaUbicacion) citaUpdates.consultorioUbicacion = nuevaUbicacion;
        citasBatch.update(doc(db, 'citas', d.id), citaUpdates);
        citasCount++;
      });
      if (citasCount > 0) await citasBatch.commit();
      console.log(`Propagación consultorio en citas futuras: ${citasCount} citas actualizadas`);
    } catch (err) {
      console.error('Error propagando cambios de consultorio a usuarios:', err);
    }
  };

  const propagarCambioSucursal = async (sucursalId, nuevoNombre, nuevaUbicacion, nuevoTelefono, viejoNombre) => {
    try {
      const batch = writeBatch(db);
      let count = 0;

      const consultoriosSnap = await getDocs(query(collection(db, 'catalogo_consultorios'), where('sucursalId', '==', sucursalId)));
      consultoriosSnap.docs.forEach((d) => {
        batch.update(doc(db, 'catalogo_consultorios', d.id), { sucursal: nuevoNombre });
        count++;
      });

      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.sucursalActualId === sucursalId || data.sucursal === viejoNombre) {
          batch.update(doc(db, 'users', d.id), { sucursal: nuevoNombre });
          count++;
        }
      });

      if (count > 0) await batch.commit();
      console.log(`Propagación sucursal: ${count} documentos actualizados`);
    } catch (err) {
      console.error('Error propagando cambios de sucursal:', err);
    }
  };

  const sucursalesActivas = useMemo(
    () => sucursales.filter((item) => item.activo !== false && item.nombre),
    [sucursales]
  );

  const sucursalSeleccionadaForm = useMemo(
    () => sucursalesActivas.find((item) => item.id === consultorioForm.sucursalId) || null,
    [consultorioForm.sucursalId, sucursalesActivas]
  );

  const horarioConsultorioForm = useMemo(() => buildEffectiveSchedule({
    horarioTipo: consultorioForm.horarioTipo,
    inicio: consultorioForm.horaInicio,
    fin: consultorioForm.horaFin,
    dias: consultorioForm.diasAtencion,
    fallbackInicio: '08:00',
    fallbackFin: '18:00',
    fallbackDias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  }), [consultorioForm.diasAtencion, consultorioForm.horaFin, consultorioForm.horaInicio, consultorioForm.horarioTipo]);

  const horarioSucursalForm = useMemo(() => {
    if (!sucursalSeleccionadaForm) return null;
    return buildEffectiveSchedule({
      horarioTipo: sucursalSeleccionadaForm.horarioTipo,
      inicio: sucursalSeleccionadaForm.horaApertura,
      fin: sucursalSeleccionadaForm.horaCierre,
      dias: sucursalSeleccionadaForm.diasOperacion,
      fallbackInicio: '08:00',
      fallbackFin: '20:00',
      fallbackDias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    });
  }, [sucursalSeleccionadaForm]);

  const consultorioFueraDeHorarioSucursal = useMemo(
    () => hasScheduleConflict(horarioConsultorioForm, horarioSucursalForm),
    [horarioConsultorioForm, horarioSucursalForm]
  );

  const resumenCatalogos = useMemo(() => ({
    motivos: { total: motivos.length, activos: motivos.filter((item) => item.activo !== false).length },
    consultorios: { total: consultorios.length, activos: consultorios.filter((item) => item.activo !== false).length },
    sucursales: { total: sucursales.length, activos: sucursales.filter((item) => item.activo !== false).length },
    especialidades: { total: especialidades.length, activos: especialidades.filter((item) => item.activo !== false).length },
    sintomatologia: { total: sintomatologia.length, activos: sintomatologia.filter((item) => item.activo !== false).length },
    estudios: { total: estudios.length, activos: estudios.filter((item) => item.activo !== false).length },
    procedimientos: { total: procedimientos.length, activos: procedimientos.filter((item) => item.activo !== false).length },
    referencias_medicas: { total: referenciasMedicas.length, activos: referenciasMedicas.filter((item) => item.activo !== false).length },
  }), [motivos, consultorios, sucursales, especialidades, sintomatologia, estudios, procedimientos, referenciasMedicas]);

  const formatMXN = (value) => Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  const toNumberSafe = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };


  useEffect(() => {
    const inicializarCategorias = async () => {
      try {
        const snap = await getDocs(collection(db, 'catalogo_sintomatologia_categorias'));
        if (!snap.empty) return;

        await Promise.all(
          SYMPTOM_CATEGORY_DEFAULTS.map((cat, idx) => setDoc(doc(db, 'catalogo_sintomatologia_categorias', cat.id), {
            nombre: cat.label,
            color: cat.color,
            activo: true,
            orden: idx + 1,
            creadoAt: serverTimestamp(),
            creadoPor: user?.uid || 'sistema'
          }))
        );
      } catch (error) {
        console.error('Error inicializando categorías de sintomatología', error);
      }
    };

    inicializarCategorias();

    const unsub1 = onSnapshot(query(collection(db, 'catalogo_motivos_consulta'), orderBy('nombre', 'asc')), (snap) => {
      setMotivos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => { });
    const unsub2 = onSnapshot(query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc')), (snap) => {
      setConsultorios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => { });
    const unsub3 = onSnapshot(query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc')), (snap) => {
      setSucursales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => { });
    const unsub4 = onSnapshot(query(collection(db, 'catalogo_especialidades'), orderBy('nombre', 'asc')), (snap) => {
      setEspecialidades(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => { });
    const unsub5 = onSnapshot(collection(db, 'catalogo_sintomatologia'), (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ordenA = Number(a.orden ?? 9999);
          const ordenB = Number(b.orden ?? 9999);
          if (ordenA !== ordenB) return ordenA - ordenB;
          return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
        });
      setSintomatologia(rows);
    }, () => { });
    const unsubCategoriasSintomas = onSnapshot(query(collection(db, 'catalogo_sintomatologia_categorias'), orderBy('orden', 'asc')), (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          label: String(data.nombre || '').trim() || titleFromId(d.id),
          color: data.color || SYMPTOM_CATEGORY_COLOR_FALLBACK,
          activo: data.activo !== false,
          orden: Number(data.orden || 999)
        };
      });
      setCategoriasSintomas(rows.length > 0 ? rows : SYMPTOM_CATEGORY_DEFAULTS);
    }, () => {
      setCategoriasSintomas(SYMPTOM_CATEGORY_DEFAULTS);
    });
    const unsub6 = onSnapshot(collection(db, 'catalogo_estudios'), (snap) => {
      const rows = snap.docs
        .map((d) => normalizeStudyRecord({ id: d.id, ...d.data() }, d.id))
        .filter((item) => item.descripcion)
        .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
      setEstudios(rows);
    }, () => { });
    const unsub7 = onSnapshot(collection(db, 'catalogo_procedimientos'), (snap) => {
      const rows = snap.docs
        .map((d) => normalizeProcedureRecord({ id: d.id, ...d.data() }, d.id))
        .filter((item) => item.nombre)
        .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));
      setProcedimientos(rows);
    }, () => { });
    const unsubRefMed = onSnapshot(query(collection(db, 'catalogo_referencias_medicas'), orderBy('nombreMedico', 'asc')), (snap) => {
      const rows = snap.docs
        .map((d) => normalizeReferenciaMedicaRecord({ id: d.id, ...d.data() }, d.id))
        .sort((a, b) => String(a.nombreMedico || '').localeCompare(String(b.nombreMedico || ''), 'es', { sensitivity: 'base' }));
      setReferenciasMedicas(rows);
    }, () => { });
    const unsub8 = onSnapshot(query(collection(db, 'catalogo_documentos_capacitacion'), orderBy('orden', 'asc')), (snap) => {
      setDocsCapacitacion(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => { });
    const unsub9 = onSnapshot(query(collection(db, 'catalogo_documentos_capacitacion_medicos'), orderBy('orden', 'asc')), (snap) => {
      setDocsCapacitacionMedicos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => { });

    loadStudiesFromPublicData().then(setLegacyEstudios).catch((error) => {
      console.error('Error cargando estudios base', error);
      setLegacyEstudios([]);
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsubCategoriasSintomas(); unsub6(); unsub7(); unsubRefMed(); unsub8(); unsub9(); };
  }, [user?.uid]);

  const resetEstudioForm = () => {
    setEditingEstudioId(null);
    setEstudioForm({ clave: '', descripcion: '', precio: '', categoria: 'laboratorio', componentesIds: [], activo: true });
  };

  const estudiosBaseParaPaquete = useMemo(
    () => estudios.filter((item) => normalizeStudyCategory(item.categoria) === 'laboratorio' && item.activo !== false),
    [estudios]
  );

  const estudiosPorCategoria = useMemo(() => {
    const buckets = new Map(STUDY_CATEGORY_OPTIONS.map((option) => [option.id, []]));
    estudios.forEach((item) => {
      const categoria = normalizeStudyCategory(item.categoria);
      if (!buckets.has(categoria)) buckets.set(categoria, []);
      buckets.get(categoria).push(item);
    });

    return STUDY_CATEGORY_OPTIONS.map((option) => ({
      ...option,
      items: [...(buckets.get(option.id) || [])].sort((a, b) => String(a.descripcion || '').localeCompare(String(b.descripcion || ''), 'es', { sensitivity: 'base' }))
    }));
  }, [estudios]);

  const procedimientosPorCategoria = useMemo(() => {
    const buckets = new Map(PROCEDURE_CATEGORY_OPTIONS.map((option) => [option.id, []]));
    procedimientos.forEach((item) => {
      const categoria = normalizeProcedureCategory(item.categoria);
      if (!buckets.has(categoria)) buckets.set(categoria, []);
      buckets.get(categoria).push(item);
    });

    return PROCEDURE_CATEGORY_OPTIONS.map((option) => ({
      ...option,
      items: [...(buckets.get(option.id) || [])].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }))
    }));
  }, [procedimientos]);

  const toggleComponentePaquete = (id) => {
    setEstudioForm((prev) => {
      const exists = prev.componentesIds.includes(id);
      return {
        ...prev,
        componentesIds: exists
          ? prev.componentesIds.filter((item) => item !== id)
          : [...prev.componentesIds, id]
      };
    });
  };

  const startEditEstudio = (item) => {
    setEditingEstudioId(item.id);
    setEstudioForm({
      clave: item.clave || '',
      descripcion: item.descripcion || '',
      precio: String(item.precio || ''),
      categoria: normalizeStudyCategory(item.categoria),
      componentesIds: Array.isArray(item.componentes)
        ? item.componentes.map((comp) => comp.id).filter(Boolean)
        : [],
      activo: item.activo !== false
    });
  };

  const saveEstudio = async (e) => {
    e.preventDefault();
    const descripcion = estudioForm.descripcion.trim();
    if (!descripcion) return;

    const descripcionLower = descripcion.toLowerCase();
    const categoriaNormalizada = normalizeStudyCategory(estudioForm.categoria);
    const existeDuplicado = estudios.some((item) => (
      item.id !== editingEstudioId
      && String(item.descripcion || '').trim().toLowerCase() === descripcionLower
      && normalizeStudyCategory(item.categoria) === categoriaNormalizada
    ));
    if (existeDuplicado) {
      showPill(`Ya existe ${getStudyCategoryLabel(categoriaNormalizada)} con ese nombre.`, 'error');
      return;
    }

    const precio = Number.parseFloat(String(estudioForm.precio || '0').replace(/[^\d.-]/g, ''));
    const componentes = categoriaNormalizada === 'paquete'
      ? estudiosBaseParaPaquete
        .filter((item) => estudioForm.componentesIds.includes(item.id))
        .map((item) => ({ id: item.id, clave: item.clave || '', descripcion: item.descripcion }))
      : [];

    if (categoriaNormalizada === 'paquete' && componentes.length === 0) {
      showPill('Selecciona al menos un estudio para crear el paquete.', 'error');
      return;
    }

    const payload = {
      clave: estudioForm.clave.trim(),
      descripcion,
      descripcionLower,
      precio: Number.isFinite(precio) ? precio : 0,
      precioPublico: Number.isFinite(precio) ? precio : 0,
      categoria: categoriaNormalizada,
      componentes,
      activo: estudioForm.activo !== false,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || 'sistema'
    };

    if (editingEstudioId) {
      await updateDoc(doc(db, 'catalogo_estudios', editingEstudioId), payload);
    } else {
      await addDoc(collection(db, 'catalogo_estudios'), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'sistema'
      });
    }

    resetEstudioForm();
  };

  const resetProcedimientoForm = () => {
    setEditingProcedimientoId(null);
    setProcedimientoForm({
      clave: '',
      nombre: '',
      categoria: PROCEDURE_CATEGORY_OPTIONS[0]?.id || 'curacion',
      descripcion: '',
      preparacion: '',
      contraindicaciones: '',
      duracionMin: '20',
      requiereConsentimiento: false,
      activo: true
    });
  };

  const startEditProcedimiento = (item) => {
    setEditingProcedimientoId(item.id);
    setProcedimientoForm({
      clave: item.clave || '',
      nombre: item.nombre || '',
      categoria: normalizeProcedureCategory(item.categoria),
      descripcion: item.descripcion || '',
      preparacion: item.preparacion || '',
      contraindicaciones: item.contraindicaciones || '',
      duracionMin: String(item.duracionMin || 20),
      requiereConsentimiento: item.requiereConsentimiento === true,
      activo: item.activo !== false
    });
  };

  const saveProcedimiento = async (e) => {
    e.preventDefault();
    const nombre = procedimientoForm.nombre.trim();
    if (!nombre) return;

    const categoriaNormalizada = normalizeProcedureCategory(procedimientoForm.categoria);
    const nombreLower = nombre.toLowerCase();
    const existeDuplicado = procedimientos.some((item) => (
      item.id !== editingProcedimientoId
      && String(item.nombre || '').trim().toLowerCase() === nombreLower
      && normalizeProcedureCategory(item.categoria) === categoriaNormalizada
    ));

    if (existeDuplicado) {
      showPill(`Ya existe ${getProcedureCategoryLabel(categoriaNormalizada)} con ese nombre.`, 'error');
      return;
    }

    const duracionMin = Math.max(1, Number.parseInt(String(procedimientoForm.duracionMin || '20'), 10) || 20);

    const payload = {
      clave: procedimientoForm.clave.trim(),
      nombre,
      nombreLower,
      categoria: categoriaNormalizada,
      descripcion: procedimientoForm.descripcion.trim(),
      preparacion: procedimientoForm.preparacion.trim(),
      contraindicaciones: procedimientoForm.contraindicaciones.trim(),
      duracionMin,
      requiereConsentimiento: procedimientoForm.requiereConsentimiento === true,
      activo: procedimientoForm.activo !== false,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || 'sistema'
    };

    if (editingProcedimientoId) {
      await updateDoc(doc(db, 'catalogo_procedimientos', editingProcedimientoId), payload);
    } else {
      await addDoc(collection(db, 'catalogo_procedimientos'), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'sistema'
      });
    }

    resetProcedimientoForm();
  };

  const importBaseEstudios = async () => {
    if (legacyEstudios.length === 0 || importandoEstudios) return;
    setImportandoEstudios(true);
    try {
      const existing = new Set(
        estudios.map((item) => `${(item.clave || '').toLowerCase()}::${(item.descripcion || '').toLowerCase()}`)
      );

      for (const item of legacyEstudios) {
        const key = `${(item.clave || '').toLowerCase()}::${(item.descripcion || '').toLowerCase()}`;
        if (existing.has(key)) continue;

        await addDoc(collection(db, 'catalogo_estudios'), {
          clave: item.clave || '',
          descripcion: item.descripcion,
          descripcionLower: item.descripcion.toLowerCase(),
          precio: item.precio || 0,
          precioPublico: item.precio || 0,
          categoria: normalizeStudyCategory(item.categoria),
          activo: item.activo !== false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.uid || 'sistema',
          updatedBy: user?.uid || 'sistema',
          importedFromLegacy: true
        });
      }
    } finally {
      setImportandoEstudios(false);
    }
  };

  const crearMotivo = async (e) => {
    e.preventDefault();
    if (!motivoForm.nombre.trim()) return;
    const precio = toNumberSafe(motivoForm.precio, 0);
    const precioMin = toNumberSafe(motivoForm.precioMin, precio);
    const precioMax = toNumberSafe(motivoForm.precioMax, precio || precioMin);
    const area = motivoForm.area.trim() || 'General';
    const duracionMin = Math.max(10, toNumberSafe(motivoForm.duracionMin, 20));

    const payload = {
      nombre: motivoForm.nombre.trim(),
      precio,
      precioMin,
      precioMax,
      area,
      categoria: area,
      duracionMin,
      teleconsultaPermitida: Boolean(motivoForm.teleconsultaPermitida),
      atendidoPorEnfermeria: Boolean(motivoForm.atendidoPorEnfermeria),
      prioridadTriage: motivoForm.prioridadTriage || 'media',
      colorTag: motivoForm.colorTag || '#0ea5e9',
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || 'sistema'
    };

    if (editingMotivoId) {
      await updateDoc(doc(db, 'catalogo_motivos_consulta', editingMotivoId), payload);
      setEditingMotivoId(null);
    } else {
      await addDoc(collection(db, 'catalogo_motivos_consulta'), {
        ...payload,
        versionPrecio: 1,
        activo: true,
        creadoPor: user?.uid || 'sistema',
        creadoAt: serverTimestamp()
      });
    }

    setMotivoForm({
      nombre: '',
      precio: '',
      area: '',
      duracionMin: '20',
      precioMin: '',
      precioMax: '',
      teleconsultaPermitida: true,
      atendidoPorEnfermeria: false,
      prioridadTriage: 'media',
      colorTag: '#0ea5e9'
    });
  };

  const startEditMotivo = (item) => {
    setEditingMotivoId(item.id);
    setMotivoForm({
      nombre: item.nombre || '',
      precio: String(item.precio ?? ''),
      area: item.area || item.categoria || '',
      duracionMin: String(item.duracionMin ?? 20),
      precioMin: String(item.precioMin ?? item.precio ?? ''),
      precioMax: String(item.precioMax ?? item.precio ?? ''),
      teleconsultaPermitida: item.teleconsultaPermitida !== false,
      atendidoPorEnfermeria: Boolean(item.atendidoPorEnfermeria),
      prioridadTriage: item.prioridadTriage || 'media',
      colorTag: item.colorTag || '#0ea5e9'
    });
  };

  const resetMotivoForm = () => {
    setEditingMotivoId(null);
    setMotivoForm({
      nombre: '',
      precio: '',
      area: '',
      duracionMin: '20',
      precioMin: '',
      precioMax: '',
      teleconsultaPermitida: true,
      atendidoPorEnfermeria: false,
      prioridadTriage: 'media',
      colorTag: '#0ea5e9'
    });
  };

  const aplicarPresetConsultorio = (presetId) => {
    const preset = CONSULTORIO_HORARIO_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setConsultorioForm((prev) => ({
      ...prev,
      horarioTipo: 'personalizado',
      horaInicio: preset.horaInicio,
      horaFin: preset.horaFin,
      diasAtencion: preset.diasAtencion
    }));
  };

  const crearConsultorio = async (e) => {
    e.preventDefault();
    if (!consultorioForm.nombre.trim()) return;
    const sucursalSeleccionada = sucursalesActivas.find((s) => s.id === consultorioForm.sucursalId) || sucursalesActivas[0] || null;
    const sucursalAsignada = sucursalSeleccionada?.nombre || '';
    if (!sucursalAsignada) return;
    const horarioTipo = consultorioForm.horarioTipo === '24h' ? '24h' : 'personalizado';
    const horaInicio = normalizeTimeValue(horarioTipo === '24h' ? '00:00' : consultorioForm.horaInicio) || '08:00';
    const horaFin = normalizeTimeValue(horarioTipo === '24h' ? '23:59' : consultorioForm.horaFin) || '18:00';
    const diasAtencion = horarioTipo === '24h'
      ? [...DIAS_SEMANA]
      : (Array.isArray(consultorioForm.diasAtencion) && consultorioForm.diasAtencion.length > 0
        ? consultorioForm.diasAtencion
        : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);

    const payload = {
      nombre: consultorioForm.nombre.trim(),
      ubicacion: consultorioForm.ubicacion.trim(),
      especialidad: consultorioForm.especialidad.trim() || 'General',
      horarioTipo,
      horaInicio,
      horaFin,
      intervaloMin: Math.max(5, toNumberSafe(consultorioForm.intervaloMin, 10)),
      capacidadSimultanea: Math.max(1, toNumberSafe(consultorioForm.capacidadSimultanea, 1)),
      diasAtencion,
      sucursalId: sucursalSeleccionada?.id || '',
      sucursal: sucursalAsignada,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || 'sistema'
    };

    if (editingConsultorioId) {
      const prevData = consultorios.find((c) => c.id === editingConsultorioId);
      await updateDoc(doc(db, 'catalogo_consultorios', editingConsultorioId), payload);
      if (prevData && (prevData.nombre !== payload.nombre || prevData.ubicacion !== payload.ubicacion)) {
        await propagarCambioConsultorio(editingConsultorioId, payload.nombre, payload.ubicacion, prevData.nombre);
      }
      setEditingConsultorioId(null);
    } else {
      await addDoc(collection(db, 'catalogo_consultorios'), {
        ...payload,
        activo: true,
        creadoPor: user?.uid || 'sistema',
        creadoAt: serverTimestamp()
      });
    }

    setConsultorioForm({
      nombre: '',
      ubicacion: '',
      especialidad: '',
      sucursalId: '',
      horarioTipo: 'personalizado',
      horaInicio: '08:00',
      horaFin: '18:00',
      intervaloMin: '10',
      capacidadSimultanea: '1',
      diasAtencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
    });
  };

  const startEditConsultorio = (item) => {
    const fallbackSucursal = sucursalesActivas.find((s) => s.nombre === item.sucursal);
    const diasAtencion = Array.isArray(item.diasAtencion) && item.diasAtencion.length > 0
      ? item.diasAtencion
      : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const horarioTipo = item.horarioTipo === '24h' || is24hSchedule(item.horaInicio, item.horaFin, diasAtencion)
      ? '24h'
      : 'personalizado';

    setEditingConsultorioId(item.id);
    setConsultorioForm({
      nombre: item.nombre || '',
      ubicacion: item.ubicacion || '',
      especialidad: item.especialidad || '',
      sucursalId: item.sucursalId || fallbackSucursal?.id || '',
      horarioTipo,
      horaInicio: normalizeTimeValue(item.horaInicio) || '08:00',
      horaFin: normalizeTimeValue(item.horaFin) || '18:00',
      intervaloMin: String(item.intervaloMin ?? 10),
      capacidadSimultanea: String(item.capacidadSimultanea ?? 1),
      diasAtencion
    });
  };

  const resetConsultorioForm = () => {
    setEditingConsultorioId(null);
    setConsultorioForm({
      nombre: '',
      ubicacion: '',
      especialidad: '',
      sucursalId: '',
      horarioTipo: 'personalizado',
      horaInicio: '08:00',
      horaFin: '18:00',
      intervaloMin: '10',
      capacidadSimultanea: '1',
      diasAtencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
    });
  };

  const crearSucursal = async (e) => {
    e.preventDefault();
    if (!sucursalForm.nombre.trim()) return;
    const horarioTipo = sucursalForm.horarioTipo === '24h' ? '24h' : 'personalizado';
    const payload = {
      nombre: sucursalForm.nombre.trim(),
      ubicacion: sucursalForm.ubicacion.trim(),
      telefono: sucursalForm.telefono.trim() || '',
      responsable: sucursalForm.responsable.trim() || '',
      horarioTipo,
      horaApertura: normalizeTimeValue(horarioTipo === '24h' ? '00:00' : sucursalForm.horaApertura) || '08:00',
      horaCierre: normalizeTimeValue(horarioTipo === '24h' ? '23:59' : sucursalForm.horaCierre) || '20:00',
      timezone: sucursalForm.timezone || 'America/Mexico_City',
      diasOperacion: horarioTipo === '24h'
        ? [...DIAS_SEMANA]
        : (Array.isArray(sucursalForm.diasOperacion) && sucursalForm.diasOperacion.length > 0
          ? sucursalForm.diasOperacion
          : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']),
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || 'sistema'
    };

    if (editingSucursalId) {
      const prevData = sucursales.find((s) => s.id === editingSucursalId);
      await updateDoc(doc(db, 'catalogo_sucursales', editingSucursalId), payload);
      if (prevData && (prevData.nombre !== payload.nombre || prevData.ubicacion !== payload.ubicacion || prevData.telefono !== payload.telefono)) {
        await propagarCambioSucursal(editingSucursalId, payload.nombre, payload.ubicacion, payload.telefono, prevData.nombre);
      }
      setEditingSucursalId(null);
    } else {
      await addDoc(collection(db, 'catalogo_sucursales'), {
        ...payload,
        activo: true,
        creadoPor: user?.uid || 'sistema',
        creadoAt: serverTimestamp()
      });
    }

    setSucursalForm({
      nombre: '',
      ubicacion: '',
      telefono: '',
      responsable: '',
      horarioTipo: 'personalizado',
      horaApertura: '08:00',
      horaCierre: '20:00',
      timezone: 'America/Mexico_City',
      diasOperacion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    });
  };

  const startEditSucursal = (item) => {
    const diasOperacion = Array.isArray(item.diasOperacion) && item.diasOperacion.length > 0
      ? item.diasOperacion
      : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const horarioTipo = item.horarioTipo === '24h' || is24hSchedule(item.horaApertura, item.horaCierre, diasOperacion)
      ? '24h'
      : 'personalizado';

    setEditingSucursalId(item.id);
    setSucursalForm({
      nombre: item.nombre || '',
      ubicacion: item.ubicacion || '',
      telefono: item.telefono || '',
      responsable: item.responsable || '',
      horarioTipo,
      horaApertura: normalizeTimeValue(item.horaApertura) || '08:00',
      horaCierre: normalizeTimeValue(item.horaCierre) || '20:00',
      timezone: item.timezone || 'America/Mexico_City',
      diasOperacion
    });
  };

  const resetSucursalForm = () => {
    setEditingSucursalId(null);
    setSucursalForm({
      nombre: '',
      ubicacion: '',
      telefono: '',
      responsable: '',
      horarioTipo: 'personalizado',
      horaApertura: '08:00',
      horaCierre: '20:00',
      timezone: 'America/Mexico_City',
      diasOperacion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    });
  };

  const crearEspecialidad = async (e) => {
    e.preventDefault();
    const nombre = especialidadNombre.trim();
    if (!nombre) return;
    const yaExiste = especialidades.some((esp) => esp.id !== editingEspecialidadId && esp.nombre.toLowerCase() === nombre.toLowerCase());
    if (yaExiste) { showPill('Ya existe una especialidad con ese nombre.', 'error'); return; }

    if (editingEspecialidadId) {
      await updateDoc(doc(db, 'catalogo_especialidades', editingEspecialidadId), {
        nombre,
        actualizadoAt: serverTimestamp(),
        actualizadoPor: user?.uid || 'sistema'
      });
      setEditingEspecialidadId(null);
    } else {
      await addDoc(collection(db, 'catalogo_especialidades'), {
        nombre,
        activo: true,
        creadoPor: user?.uid || 'sistema',
        creadoAt: serverTimestamp()
      });
    }

    setEspecialidadNombre('');
  };

  const startEditEspecialidad = (item) => {
    setEditingEspecialidadId(item.id);
    setEspecialidadNombre(item.nombre || '');
  };

  const resetEspecialidadForm = () => {
    setEditingEspecialidadId(null);
    setEspecialidadNombre('');
  };

  const resetReferenciaMedicaForm = () => {
    setEditingReferenciaMedicaId(null);
    setReferenciaMedicaForm({
      especialidad: '',
      tipoCita: TIPO_CITA_OPTIONS[0]?.id || 'primera_vez',
      nombreMedico: '',
      telefonoConsultorio: '',
      direccionConsultorio: '',
      activo: true
    });
  };

  const startEditReferenciaMedica = (item) => {
    setEditingReferenciaMedicaId(item.id);
    setReferenciaMedicaForm({
      especialidad: item.especialidad || '',
      tipoCita: item.tipoCita || TIPO_CITA_OPTIONS[0]?.id || 'primera_vez',
      nombreMedico: item.nombreMedico || '',
      telefonoConsultorio: item.telefonoConsultorio || '',
      direccionConsultorio: item.direccionConsultorio || '',
      activo: item.activo !== false
    });
  };

  const saveReferenciaMedica = async (e) => {
    e.preventDefault();
    const nombreMedico = referenciaMedicaForm.nombreMedico.trim();
    const especialidad = referenciaMedicaForm.especialidad.trim();
    if (!nombreMedico) { showPill('El nombre del médico es obligatorio.', 'error'); return; }
    if (!especialidad) { showPill('La especialidad es obligatoria.', 'error'); return; }

    const existeDuplicado = referenciasMedicas.some((item) =>
      item.id !== editingReferenciaMedicaId
      && String(item.nombreMedico || '').trim().toLowerCase() === nombreMedico.toLowerCase()
      && String(item.especialidad || '').trim().toLowerCase() === especialidad.toLowerCase()
    );

    if (existeDuplicado) {
      showPill('Ya existe una referencia médica con ese médico y especialidad.', 'error');
      return;
    }

    const payload = {
      especialidad,
      tipoCita: referenciaMedicaForm.tipoCita,
      nombreMedico,
      telefonoConsultorio: referenciaMedicaForm.telefonoConsultorio.trim(),
      direccionConsultorio: referenciaMedicaForm.direccionConsultorio.trim(),
      activo: referenciaMedicaForm.activo !== false,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || 'sistema'
    };

    if (editingReferenciaMedicaId) {
      await updateDoc(doc(db, 'catalogo_referencias_medicas', editingReferenciaMedicaId), payload);
    } else {
      await addDoc(collection(db, 'catalogo_referencias_medicas'), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'sistema'
      });
    }

    resetReferenciaMedicaForm();
    showPill('Referencia médica guardada correctamente.', 'success');
  };

  const crearSintomatologia = async (e) => {
    e.preventDefault();
    const nombre = sintomatologiaNombre.trim();
    if (!nombre) return;
    if (!sintomatologiaCategoria) { showPill('Selecciona una categoría activa.', 'error'); return; }

    const yaExiste = sintomatologia.some((s) => s.id !== editingSintomatologiaId && s.nombre.toLowerCase() === nombre.toLowerCase());
    if (yaExiste) { showPill('Ya existe un síntoma con ese nombre.', 'error'); return; }

    const ordenEnCategoria = sintomatologia
      .filter((item) => (item.categoria || categoriaDefaultId) === sintomatologiaCategoria)
      .reduce((max, item) => Math.max(max, Number(item.orden || 0)), 0) + 1;

    if (editingSintomatologiaId) {
      const actual = sintomatologia.find((item) => item.id === editingSintomatologiaId) || null;
      const categoriaActualId = actual?.categoria || categoriaDefaultId;
      const cambioCategoria = actual && categoriaActualId !== sintomatologiaCategoria;

      if (cambioCategoria && actual) {
        const origen = sortSymptoms(
          sintomatologia.filter((item) => item.id !== editingSintomatologiaId && (item.categoria || categoriaDefaultId) === categoriaActualId)
        );
        const destino = sortSymptoms(
          [
            ...sintomatologia.filter((item) => item.id !== editingSintomatologiaId && (item.categoria || categoriaDefaultId) === sintomatologiaCategoria),
            { ...actual, id: editingSintomatologiaId, nombre, categoria: sintomatologiaCategoria, activo: actual.activo !== false }
          ]
        );
        const batch = writeBatch(db);
        origen.forEach((item, index) => {
          batch.update(doc(db, 'catalogo_sintomatologia', item.id), {
            categoria: categoriaActualId,
            orden: index + 1,
            actualizadoAt: serverTimestamp(),
            actualizadoPor: user?.uid || 'sistema'
          });
        });
        destino.forEach((item, index) => {
          batch.update(doc(db, 'catalogo_sintomatologia', item.id), {
            nombre: item.nombre,
            categoria: sintomatologiaCategoria,
            orden: index + 1,
            actualizadoAt: serverTimestamp(),
            actualizadoPor: user?.uid || 'sistema'
          });
        });
        await batch.commit();
      } else {
        await updateDoc(doc(db, 'catalogo_sintomatologia', editingSintomatologiaId), {
          nombre,
          categoria: sintomatologiaCategoria,
          ...(actual ? { orden: Number(actual.orden || ordenEnCategoria) } : {}),
          actualizadoAt: serverTimestamp(),
          actualizadoPor: user?.uid || 'sistema'
        });
      }
      setEditingSintomatologiaId(null);
      showPill('Síntoma actualizado.', 'success');
    } else {
      await addDoc(collection(db, 'catalogo_sintomatologia'), {
        nombre,
        categoria: sintomatologiaCategoria,
        orden: ordenEnCategoria,
        activo: true,
        creadoPor: user?.uid || 'sistema',
        creadoAt: serverTimestamp()
      });
      showPill('Síntoma agregado.', 'success');
    }

    setSintomatologiaNombre('');
    setSintomatologiaCategoria(categoriaDefaultId);
  };

  const startEditSintomatologia = (item) => {
    setEditingSintomatologiaId(item.id);
    setSintomatologiaNombre(item.nombre || '');
    setSintomatologiaCategoria(item.categoria || categoriaDefaultId);
  };

  const resetSintomatologiaForm = () => {
    setEditingSintomatologiaId(null);
    setSintomatologiaNombre('');
    setSintomatologiaCategoria(categoriaDefaultId);
  };

  const aplicarOrdenCategoriasSintoma = (batch, rows) => {
    rows.forEach((categoria, index) => {
      batch.update(doc(db, 'catalogo_sintomatologia_categorias', categoria.id), {
        orden: index + 1,
        actualizadoAt: serverTimestamp(),
        actualizadoPor: user?.uid || 'sistema'
      });
    });
  };

  const aplicarOrdenSintomas = (batch, categoriaId, rows) => {
    rows.forEach((item, index) => {
      batch.update(doc(db, 'catalogo_sintomatologia', item.id), {
        categoria: categoriaId,
        orden: index + 1,
        actualizadoAt: serverTimestamp(),
        actualizadoPor: user?.uid || 'sistema'
      });
    });
  };

  const moverCategoriaSintoma = async (categoria, direccion) => {
    const activasOrdenadas = categoriasConSintomas.filter(c => c.activo !== false && !c.legacy);
    const index = activasOrdenadas.findIndex(c => c.id === categoria.id);
    if (index < 0) return;
    const targetIndex = direccion === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activasOrdenadas.length) return;
    const reordered = [...activasOrdenadas];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const batch = writeBatch(db);
    aplicarOrdenCategoriasSintoma(batch, reordered);
    await batch.commit();
  };

  const moverSintoma = async (item, direccion) => {
    const categoriaId = item.categoria || categoriaDefaultId;
    const itemsCategoria = sortSymptoms(
      sintomatologia.filter((row) => (row.categoria || categoriaDefaultId) === categoriaId)
    );
    const index = itemsCategoria.findIndex((row) => row.id === item.id);
    if (index < 0) return;

    const targetIndex = direccion === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itemsCategoria.length) return;

    const reordered = [...itemsCategoria];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const batch = writeBatch(db);
    aplicarOrdenSintomas(batch, categoriaId, reordered);
    await batch.commit();
  };

  const resetCategoriaSintomaForm = () => {
    setEditingCategoriaSintomaId(null);
    setCategoriaSintomaNombre('');
    setCategoriaSintomaColor(SYMPTOM_CATEGORY_COLOR_FALLBACK);
  };

  const startEditCategoriaSintoma = (categoria) => {
    setEditingCategoriaSintomaId(categoria.id);
    setCategoriaSintomaNombre(categoria.label || '');
    setCategoriaSintomaColor(categoria.color || SYMPTOM_CATEGORY_COLOR_FALLBACK);
  };

  const saveCategoriaSintoma = async (e) => {
    e.preventDefault();
    const nombre = categoriaSintomaNombre.trim();
    if (!nombre) return;

    const nombreLower = nombre.toLowerCase();
    const existeNombre = categoriasSintomas.some((cat) => cat.id !== editingCategoriaSintomaId && String(cat.label || '').trim().toLowerCase() === nombreLower);
    if (existeNombre) { showPill('Ya existe una categoría con ese nombre.', 'error'); return; }

    if (editingCategoriaSintomaId) {
      await updateDoc(doc(db, 'catalogo_sintomatologia_categorias', editingCategoriaSintomaId), {
        nombre,
        color: categoriaSintomaColor || SYMPTOM_CATEGORY_COLOR_FALLBACK,
        actualizadoAt: serverTimestamp(),
        actualizadoPor: user?.uid || 'sistema'
      });
      resetCategoriaSintomaForm();
      showPill('Categoría actualizada.', 'success');
      return;
    }

    const baseId = buildSymptomCategoryId(nombre) || 'categoria';
    let categoriaId = baseId;
    let idx = 2;
    const idsActuales = new Set(categoriasSintomas.map((cat) => cat.id));
    while (idsActuales.has(categoriaId)) {
      categoriaId = `${baseId}-${idx}`;
      idx += 1;
    }

    await setDoc(doc(db, 'catalogo_sintomatologia_categorias', categoriaId), {
      nombre,
      color: categoriaSintomaColor || SYMPTOM_CATEGORY_COLOR_FALLBACK,
      activo: true,
      orden: categoriasSintomas.length + 1,
      creadoAt: serverTimestamp(),
      creadoPor: user?.uid || 'sistema'
    });

    resetCategoriaSintomaForm();
    setSintomatologiaCategoria(categoriaId);
    showPill('Categoría agregada.', 'success');
  };

  const toggleCategoriaSintomaActiva = async (categoria) => {
    const activoActual = categoria.activo !== false;
    if (activoActual) {
      const enUso = sintomatologia.some((item) => (item.categoria || categoriaDefaultId) === categoria.id && item.activo !== false);
      if (enUso) {
        showPill('No puedes desactivar esta categoría porque hay síntomas activos asignados. Reasígnalos primero.', 'error');
        return;
      }
    }

    await updateDoc(doc(db, 'catalogo_sintomatologia_categorias', categoria.id), {
      activo: !activoActual,
      actualizadoAt: serverTimestamp(),
      actualizadoPor: user?.uid || 'sistema'
    });
    showPill(activoActual ? 'Categoría desactivada.' : 'Categoría activada.', 'success');
  };

  const eliminarCategoriaSintoma = async (categoria) => {
    if (categoria.legacy) {
      showPill('Esta categoría es legacy y no se puede eliminar desde aquí. Reasigna síntomas primero.', 'error');
      return;
    }

    if (categoriasSintomas.length <= 1) {
      showPill('Debe existir al menos una categoría.', 'error');
      return;
    }

    const sintomasEnCategoria = sintomatologia.filter((item) => (item.categoria || categoriaDefaultId) === categoria.id);
    let destinoId = categoriaDefaultId;
    if (destinoId === categoria.id) {
      destinoId = categoriasSintomas.find((cat) => cat.id !== categoria.id && cat.activo !== false)?.id || categoriasSintomas.find((cat) => cat.id !== categoria.id)?.id || '';
    }

    askConfirm(
      `Se eliminará la categoría ${categoria.label}. ${sintomasEnCategoria.length > 0 ? `Los síntomas se moverán a ${titleFromId(destinoId)}.` : ''}`,
      async () => {
        const batch = writeBatch(db);
        if (sintomasEnCategoria.length > 0 && destinoId) {
          const destinoRows = sortSymptoms([
            ...sintomatologia.filter((item) => (item.categoria || categoriaDefaultId) === destinoId),
            ...sintomasEnCategoria.map((item) => ({ ...item, categoria: destinoId }))
          ]);
          aplicarOrdenSintomas(batch, destinoId, destinoRows);
        }

        batch.delete(doc(db, 'catalogo_sintomatologia_categorias', categoria.id));
        aplicarOrdenCategoriasSintoma(
          batch,
          categoriasConSintomas.filter((item) => item.id !== categoria.id && !item.legacy)
        );
        await batch.commit();
        showPill('Categoría eliminada.', 'success');
      }
    );
  };

  const eliminarSintomatologia = async (id) => {
    askConfirm('¿Eliminar este síntoma permanentemente?', async () => {
      const actual = sintomatologia.find((item) => item.id === id);
      const categoriaId = actual?.categoria || categoriaDefaultId;
      const remainingRows = sortSymptoms(
        sintomatologia.filter((item) => item.id !== id && (item.categoria || categoriaDefaultId) === categoriaId)
      );
      const batch = writeBatch(db);
      batch.delete(doc(db, 'catalogo_sintomatologia', id));
      aplicarOrdenSintomas(batch, categoriaId, remainingRows);
      await batch.commit();
      showPill('Síntoma eliminado.', 'success');
    });
  };

  const toggleActivo = async (collectionName, id, activoActual) => {
    await updateDoc(doc(db, collectionName, id), { activo: !activoActual, actualizadoAt: serverTimestamp() });
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{ maxWidth: '768px', margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#111', fontFamily: 'Sora, sans-serif' }}>Catálogos Globales</h1>
          <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '14px' }}>Solo administración puede modificar motivos, consultorios, sucursales y estudios.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'motivos', label: 'Motivos', icon: <Tags size={16} /> },
    { id: 'consultorios', label: 'Consultorios', icon: <Stethoscope size={16} /> },
    { id: 'sucursales', label: 'Sucursales', icon: <Building2 size={16} /> },
    { id: 'especialidades', label: 'Especialidades', icon: <GraduationCap size={16} /> },
    { id: 'sintomatologia', label: 'Sintomatología', icon: <Activity size={16} /> },
    { id: 'procedimientos', label: 'Procedimientos', icon: <Syringe size={16} /> },
    { id: 'estudios', label: 'Estudios', icon: <FlaskConical size={16} /> },
    { id: 'referencias_medicas', label: 'Referencias', icon: <Link2 size={16} /> },
    { id: 'capacitacion', label: 'Capacitación', icon: <BookOpen size={16} /> }
  ];

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '16px 20px', maxWidth: '1480px', margin: '0 auto', paddingBottom: '40px' }}>
      {pill.show && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 120,
          padding: '8px 16px', borderRadius: '9999px',
          border: '1px solid #e5e7eb', background: '#fafafa',
          color: '#4b5563', fontSize: '13px', fontWeight: 600
        }}>
          {pill.message}
        </div>
      )}

      {confirmState.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(17,17,17,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ width: '100%', maxWidth: '448px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '13px', color: '#4b5563' }}>{confirmState.message}</p>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmState({ open: false, message: '', onAccept: null })}
                style={{ padding: '6px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, border: '1px solid #e5e7eb', background: '#fff', color: '#4b5563', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmState.onAccept;
                  setConfirmState({ open: false, message: '', onAccept: null });
                  if (typeof action === 'function') {
                    await action();
                  }
                }}
                style={{ padding: '6px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: '#111', color: '#fff', border: '1px solid #111', cursor: 'pointer' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <section style={{ borderRadius: '16px', border: '1px solid #e5e7eb', background: '#fff', padding: isMobile ? '16px 12px' : '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: 800, color: '#111', lineHeight: 1.2, fontFamily: 'Sora, sans-serif', margin: 0 }}>Catálogos Globales</h1>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>Configuración maestra para agenda, consultorios y documentos clínicos.</p>
          </div>
          
          <div style={{ position: 'relative', width: isMobile ? '100%' : '320px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Buscar en todos los catálogos..."
                value={globalSearchQuery}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                  setSearchSelectedIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (globalSearchResults.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSearchSelectedIndex(prev => prev < globalSearchResults.length - 1 ? prev + 1 : prev);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSearchSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchSelectedIndex >= 0 && searchSelectedIndex < globalSearchResults.length) {
                      handleSelectSearchResult(globalSearchResults[searchSelectedIndex]);
                    } else if (globalSearchResults.length > 0) {
                      handleSelectSearchResult(globalSearchResults[0]);
                    }
                  }
                }}
                style={{ width: '100%', background: '#fafafa', border: '1px solid #e5e7eb', color: '#111', fontSize: '13px', borderRadius: '12px', padding: '10px 12px 10px 36px', outline: 'none', boxSizing: 'border-box' }}
              />
              {globalSearchQuery && (
                <button onClick={() => { setGlobalSearchQuery(''); setSearchSelectedIndex(-1); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>
            
            {globalSearchQuery && globalSearchResults.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 50, marginTop: '8px', width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0 }}>{globalSearchResults.length} resultado{globalSearchResults.length !== 1 ? 's' : ''}</div>
                {globalSearchResults.map((result, idx) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectSearchResult(result)}
                    onMouseEnter={() => setSearchSelectedIndex(idx)}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #fafafa', background: searchSelectedIndex === idx ? '#fafafa' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', border: 'none' }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: searchSelectedIndex === idx ? '#111' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{result.title}</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>{result.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
            {globalSearchQuery && globalSearchQuery.trim().length >= 2 && globalSearchResults.length === 0 && (
              <div style={{ position: 'absolute', zIndex: 50, marginTop: '8px', width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>No se encontraron resultados. Prueba con menos caracteres o revisa la ortografía.</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto', margin: '16px -4px 0', padding: '0 4px' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '4px', width: 'max-content', minWidth: '100%' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? 700 : 600,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  background: activeTab === tab.id ? '#111' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : '#6b7280',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === 'motivos' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: isMobile ? '16px 12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '4px' }}>Motivos de consulta</h2>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px' }}>Define tarifa, duración y reglas del motivo para agenda, operación y auditoría.</p>
            {editingMotivoId && (
              <button type="button" onClick={resetMotivoForm} style={{ marginBottom: '12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearMotivo} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Nombre" value={motivoForm.nombre} onChange={(e) => setMotivoForm({ ...motivoForm, nombre: e.target.value })} />
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} type="number" min="0" step="0.01" placeholder="Precio" value={motivoForm.precio} onChange={(e) => setMotivoForm({ ...motivoForm, precio: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} type="number" min="0" step="0.01" placeholder="Precio mínimo" value={motivoForm.precioMin} onChange={(e) => setMotivoForm({ ...motivoForm, precioMin: e.target.value })} />
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} type="number" min="0" step="0.01" placeholder="Precio máximo" value={motivoForm.precioMax} onChange={(e) => setMotivoForm({ ...motivoForm, precioMax: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Área/Categoría" value={motivoForm.area} onChange={(e) => setMotivoForm({ ...motivoForm, area: e.target.value })} />
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} type="number" min="10" step="5" placeholder="Duración (min)" value={motivoForm.duracionMin} onChange={(e) => setMotivoForm({ ...motivoForm, duracionMin: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }} value={motivoForm.prioridadTriage} onChange={(e) => setMotivoForm({ ...motivoForm, prioridadTriage: e.target.value })}>
                  <option value="baja">Prioridad: Baja</option>
                  <option value="media">Prioridad: Media</option>
                  <option value="alta">Prioridad: Alta</option>
                </select>
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} type="color" value={motivoForm.colorTag} onChange={(e) => setMotivoForm({ ...motivoForm, colorTag: e.target.value })} title="Color del motivo" />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                <input
                  type="checkbox"
                  checked={motivoForm.teleconsultaPermitida}
                  onChange={(e) => setMotivoForm({ ...motivoForm, teleconsultaPermitida: e.target.checked })}
                />
                Permitir teleconsulta en este motivo
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                <input
                  type="checkbox"
                  checked={motivoForm.atendidoPorEnfermeria}
                  onChange={(e) => setMotivoForm({ ...motivoForm, atendidoPorEnfermeria: e.target.checked })}
                />
                Atendido por enfermería
              </label>
              <button style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #111', borderRadius: '6px', padding: '8px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {editingMotivoId ? <Save size={14} /> : <Plus size={14} />}
                {editingMotivoId ? 'Guardar cambios' : 'Guardar motivo'}
              </button>
            </form>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflow: 'auto', paddingRight: '4px' }}>
            {motivos.length === 0 && <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay motivos registrados.</p>}
            {motivos.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fff' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{item.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{formatMXN(item.precio)} • {item.area || item.categoria || 'General'} • {item.duracionMin || 20} min</div>
                  <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, border: '1px solid #e5e7eb', background: '#fafafa', color: '#4b5563' }}>
                      Rango: {formatMXN(item.precioMin || item.precio)} - {formatMXN(item.precioMax || item.precio)}
                    </span>
                    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, border: '1px solid #e5e7eb', background: item.teleconsultaPermitida === false ? '#fafafa' : '#fafafa', color: item.teleconsultaPermitida === false ? '#4b5563' : '#4b5563' }}>
                      {item.teleconsultaPermitida === false ? 'Sin teleconsulta' : 'Teleconsulta permitida'}
                    </span>
                    {item.atendidoPorEnfermeria && (
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, border: '1px solid #e5e7eb', background: '#fafafa', color: '#4b5563' }}>
                        Enfermería
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, border: '1px solid #e5e7eb', background: '#fff', color: '#4b5563' }}>
                      Triage: {item.prioridadTriage || 'media'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => startEditMotivo(item)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => toggleActivo('catalogo_motivos_consulta', item.id, item.activo !== false)} style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}>{item.activo === false ? 'Inactivo' : 'Activo'}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'consultorios' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: isMobile ? '16px 12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '4px' }}>Consultorios</h2>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px' }}>Asigna consultorio, sucursal, horarios, días y capacidad operativa.</p>
            {editingConsultorioId && (
              <button type="button" onClick={resetConsultorioForm} style={{ marginBottom: '12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearConsultorio} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Nombre" value={consultorioForm.nombre} onChange={(e) => setConsultorioForm({ ...consultorioForm, nombre: e.target.value })} />
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Ubicación" value={consultorioForm.ubicacion} onChange={(e) => setConsultorioForm({ ...consultorioForm, ubicacion: e.target.value })} />
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Especialidad" value={consultorioForm.especialidad} onChange={(e) => setConsultorioForm({ ...consultorioForm, especialidad: e.target.value })} />

              <div style={{ borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Tipo de horario</label>
                  <select
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }}
                    value={consultorioForm.horarioTipo}
                    onChange={(e) => setConsultorioForm({ ...consultorioForm, horarioTipo: e.target.value })}
                  >
                    <option value="personalizado">Personalizado</option>
                    <option value="24h">24 horas (Lunes a Domingo)</option>
                  </select>
                </div>

                {consultorioForm.horarioTipo === '24h' ? (
                  <div style={{ fontSize: '11px', color: '#4b5563', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontWeight: 600 }}>
                    Este consultorio quedará activo de 00:00 a 23:59 todos los días.
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Plantillas rápidas</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {CONSULTORIO_HORARIO_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => aplicarPresetConsultorio(preset.id)}
                            style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '9999px', border: '1px solid #d1d5db', background: '#fff', color: '#4b5563', cursor: 'pointer' }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }} type="time" value={consultorioForm.horaInicio} onChange={(e) => setConsultorioForm({ ...consultorioForm, horaInicio: e.target.value })} />
                      <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }} type="time" value={consultorioForm.horaFin} onChange={(e) => setConsultorioForm({ ...consultorioForm, horaFin: e.target.value })} />
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} type="number" min="5" step="5" placeholder="Intervalo (min)" value={consultorioForm.intervaloMin} onChange={(e) => setConsultorioForm({ ...consultorioForm, intervaloMin: e.target.value })} />
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} type="number" min="1" step="1" placeholder="Capacidad simultánea" value={consultorioForm.capacidadSimultanea} onChange={(e) => setConsultorioForm({ ...consultorioForm, capacidadSimultanea: e.target.value })} />
              </div>
              {consultorioForm.horarioTipo !== '24h' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', padding: '8px' }}>
                  {DIAS_SEMANA.map((dia) => (
                    <label key={dia} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                      <input
                        type="checkbox"
                        checked={consultorioForm.diasAtencion.includes(dia)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...consultorioForm.diasAtencion, dia]
                            : consultorioForm.diasAtencion.filter((d) => d !== dia);
                          setConsultorioForm({ ...consultorioForm, diasAtencion: next });
                        }}
                      />
                      {dia}
                    </label>
                  ))}
                </div>
              )}
              <select style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }} value={consultorioForm.sucursalId} onChange={(e) => setConsultorioForm({ ...consultorioForm, sucursalId: e.target.value })}>
                <option value="">Seleccionar sucursal...</option>
                {sucursalesActivas.map((item) => (<option key={item.id} value={item.id}>{item.nombre}</option>))}
              </select>
              {sucursalSeleccionadaForm && (
                <div style={{ fontSize: '11px', borderRadius: '6px', padding: '8px 12px', border: '1px solid #e5e7eb', background: consultorioFueraDeHorarioSucursal ? '#fafafa' : '#fafafa', color: consultorioFueraDeHorarioSucursal ? '#4b5563' : '#6b7280' }}>
                  Sucursal {sucursalSeleccionadaForm.nombre}: {formatScheduleLabel(horarioSucursalForm)}.
                  {consultorioFueraDeHorarioSucursal ? ' La agenda validará contra el horario de sucursal, aunque el consultorio tenga un rango mayor.' : ' El horario del consultorio está cubierto por la sucursal seleccionada.'}
                </div>
              )}
              <button disabled={sucursalesActivas.length === 0} style={{ width: '100%', background: sucursalesActivas.length === 0 ? '#d1d5db' : '#111', color: '#fff', border: '1px solid ' + (sucursalesActivas.length === 0 ? '#d1d5db' : '#111'), borderRadius: '6px', padding: '8px 0', fontSize: '13px', fontWeight: 700, cursor: sucursalesActivas.length === 0 ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {editingConsultorioId ? <Save size={14} /> : <Plus size={14} />}
                {editingConsultorioId ? 'Guardar cambios' : 'Guardar consultorio'}
              </button>
            </form>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflow: 'auto', paddingRight: '4px' }}>
            {consultorios.length === 0 && <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay consultorios registrados.</p>}
            {consultorios.map((item) => {
              const sucursalVinculada = sucursales.find((sucursal) => sucursal.id === item.sucursalId)
                || sucursales.find((sucursal) => sucursal.nombre === item.sucursal)
                || null;
              const horarioSucursal = sucursalVinculada
                ? buildEffectiveSchedule({
                  horarioTipo: sucursalVinculada.horarioTipo,
                  inicio: sucursalVinculada.horaApertura,
                  fin: sucursalVinculada.horaCierre,
                  dias: sucursalVinculada.diasOperacion,
                  fallbackInicio: '08:00',
                  fallbackFin: '20:00',
                  fallbackDias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
                })
                : null;

              return (
                <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fff' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{item.nombre}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.especialidad || 'General'} • {item.ubicacion || 'Sin ubicación'}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                      Sucursal: {item.sucursal || 'No definida'} • {item.horarioTipo === '24h' || is24hSchedule(item.horaInicio, item.horaFin, item.diasAtencion || []) ? '24 horas' : `${normalizeTimeValue(item.horaInicio) || '08:00'}-${normalizeTimeValue(item.horaFin) || '18:00'}`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      Días: {(item.horarioTipo === '24h' || is24hSchedule(item.horaInicio, item.horaFin, item.diasAtencion || [])) ? 'lunes, martes, miercoles, jueves, viernes, sabado, domingo' : (item.diasAtencion || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']).join(', ')}
                    </div>
                    <div style={{ fontSize: '11px', marginTop: '4px', color: horarioSucursal ? '#9ca3af' : '#4b5563' }}>
                      Horario de sucursal: {horarioSucursal ? formatScheduleLabel(horarioSucursal) : 'sin configurar'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="button" onClick={() => startEditConsultorio(item)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => toggleActivo('catalogo_consultorios', item.id, item.activo !== false)} style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}>{item.activo === false ? 'Inactivo' : 'Activo'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'sucursales' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: isMobile ? '16px 12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '4px' }}>Sucursales</h2>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px' }}>Define ubicación, contacto y horario operativo por sede.</p>
            {editingSucursalId && (
              <button type="button" onClick={resetSucursalForm} style={{ marginBottom: '12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearSucursal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Nombre" value={sucursalForm.nombre} onChange={(e) => setSucursalForm({ ...sucursalForm, nombre: e.target.value })} />
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Ubicación" value={sucursalForm.ubicacion} onChange={(e) => setSucursalForm({ ...sucursalForm, ubicacion: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Teléfono" value={sucursalForm.telefono} onChange={(e) => setSucursalForm({ ...sucursalForm, telefono: e.target.value })} />
                <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Responsable" value={sucursalForm.responsable} onChange={(e) => setSucursalForm({ ...sucursalForm, responsable: e.target.value })} />
              </div>
              <div style={{ borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Tipo de horario</label>
                  <select
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }}
                    value={sucursalForm.horarioTipo}
                    onChange={(e) => setSucursalForm({ ...sucursalForm, horarioTipo: e.target.value })}
                  >
                    <option value="personalizado">Personalizado</option>
                    <option value="24h">24 horas (Lunes a Domingo)</option>
                  </select>
                </div>

                {sucursalForm.horarioTipo === '24h' ? (
                  <div style={{ fontSize: '11px', color: '#4b5563', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontWeight: 600 }}>
                    Esta sucursal quedará operando de 00:00 a 23:59 todos los días.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }} type="time" value={sucursalForm.horaApertura} onChange={(e) => setSucursalForm({ ...sucursalForm, horaApertura: e.target.value })} />
                      <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }} type="time" value={sucursalForm.horaCierre} onChange={(e) => setSucursalForm({ ...sucursalForm, horaCierre: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', padding: '8px' }}>
                      {DIAS_SEMANA.map((dia) => (
                        <label key={dia} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                          <input
                            type="checkbox"
                            checked={sucursalForm.diasOperacion.includes(dia)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...sucursalForm.diasOperacion, dia]
                                : sucursalForm.diasOperacion.filter((d) => d !== dia);
                              setSucursalForm({ ...sucursalForm, diasOperacion: next });
                            }}
                          />
                          {dia}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Zona horaria (IANA)" value={sucursalForm.timezone} onChange={(e) => setSucursalForm({ ...sucursalForm, timezone: e.target.value })} />
              <button style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #111', borderRadius: '6px', padding: '8px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {editingSucursalId ? <Save size={14} /> : <Plus size={14} />}
                {editingSucursalId ? 'Guardar cambios' : 'Guardar sucursal'}
              </button>
            </form>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflow: 'auto', paddingRight: '4px' }}>
            {sucursales.length === 0 && <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay sucursales registradas.</p>}
            {sucursales.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fff' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#111', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} /> {item.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.ubicacion || 'Sin ubicación'}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{item.telefono || 'Sin teléfono'} • {item.responsable || 'Sin responsable'}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>Horario: {item.horarioTipo === '24h' || is24hSchedule(item.horaApertura, item.horaCierre, item.diasOperacion || []) ? '24 horas' : `${normalizeTimeValue(item.horaApertura) || '08:00'}-${normalizeTimeValue(item.horaCierre) || '20:00'}`} • {(item.horarioTipo === '24h' || is24hSchedule(item.horaApertura, item.horaCierre, item.diasOperacion || [])) ? 'lunes, martes, miercoles, jueves, viernes, sabado, domingo' : (item.diasOperacion || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']).join(', ')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => startEditSucursal(item)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => toggleActivo('catalogo_sucursales', item.id, item.activo !== false)} style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}>{item.activo === false ? 'Inactiva' : 'Activa'}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


      {activeTab === 'especialidades' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: isMobile ? '16px 12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '4px' }}>Especialidades médicas</h2>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px' }}>Las especialidades activas aparecerán al dar de alta un médico en el sistema.</p>
            {editingEspecialidadId && (
              <button type="button" onClick={resetEspecialidadForm} style={{ marginBottom: '12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearEspecialidad} style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                placeholder="Escribe el nombre de la especialidad médica"
                value={especialidadNombre}
                onChange={(e) => setEspecialidadNombre(e.target.value)}
              />
              <button style={{ background: '#111', color: '#fff', border: '1px solid #111', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {editingEspecialidadId ? <Save size={14} /> : <Plus size={14} />}
                {editingEspecialidadId ? 'Guardar' : 'Agregar'}
              </button>
            </form>
            <p style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af' }}>
              {especialidades.filter(e => e.activo !== false).length} especialidad(es) activa(s)
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflow: 'auto', paddingRight: '4px' }}>
            {especialidades.length === 0 && (
              <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay especialidades registradas.</p>
            )}
            {especialidades.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '6px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GraduationCap size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111' }}>{item.nombre}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={() => startEditEspecialidad(item)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => toggleActivo('catalogo_especialidades', item.id, item.activo !== false)}
                    style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}
                  >
                    {item.activo === false ? 'Inactiva' : 'Activa'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'sintomatologia' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: isMobile ? '12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: '16px', overflow: 'hidden', marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div style={{ borderRadius: '16px', border: '1px solid #e5e7eb', background: '#fff', padding: '14px' }}>
              {editingSintomatologiaId && (
                <button type="button" onClick={resetSintomatologiaForm} style={{ marginBottom: '12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <X size={14} /> Cancelar edición
                </button>
              )}
              <form onSubmit={crearSintomatologia} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '6px', display: 'block' }}>Síntoma</label>
                  <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', boxSizing: 'border-box' }} placeholder="Nombre del síntoma" value={sintomatologiaNombre} onChange={(e) => setSintomatologiaNombre(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '6px', display: 'block' }}>Categoría</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {categoriasConSintomas.filter((cat) => cat.activo !== false).map((cat, index) => (
                      <button key={cat.id} type="button" onClick={() => setSintomatologiaCategoria(cat.id)}
                        style={{
                          padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, border: '1px solid ' + (sintomatologiaCategoria === cat.id ? '#111' : '#e5e7eb'),
                          background: sintomatologiaCategoria === cat.id ? '#111' : '#fff',
                          color: sintomatologiaCategoria === cat.id ? '#fff' : '#4b5563',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px'
                        }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.7)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#6b7280' }}>{index + 1}</span>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: cat.color || SYMPTOM_CATEGORY_COLOR_FALLBACK }}></span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #111', borderRadius: '10px', padding: '10px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {editingSintomatologiaId ? <Save size={14} /> : <Plus size={14} />}
                  {editingSintomatologiaId ? 'Guardar cambios' : 'Agregar síntoma'}
                </button>
              </form>
            </div>

            <div style={{ borderRadius: '16px', border: '1px solid #e5e7eb', background: '#fff', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Nueva categoría</h3>
                {editingCategoriaSintomaId && (
                  <button type="button" onClick={resetCategoriaSintomaForm} style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <X size={12} /> Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={saveCategoriaSintoma} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                <input
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', boxSizing: 'border-box' }}
                  placeholder="Nombre de categoría"
                  value={categoriaSintomaNombre}
                  onChange={(e) => setCategoriaSintomaNombre(e.target.value)}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SYMPTOM_CATEGORY_COLOR_OPTIONS.map((colorItem) => (
                    <button
                      key={colorItem.value}
                      type="button"
                      onClick={() => setCategoriaSintomaColor(colorItem.value)}
                      style={{
                        padding: '6px 10px', borderRadius: '10px', border: '1px solid ' + (categoriaSintomaColor === colorItem.value ? '#111' : '#e5e7eb'),
                        fontSize: '11px', fontWeight: 600,
                        background: categoriaSintomaColor === colorItem.value ? '#fafafa' : '#fff',
                        color: '#4b5563',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorItem.value }}></span>
                      {colorItem.label}
                    </button>
                  ))}
                </div>
                <button style={{ width: '100%', background: '#fafafa', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: '10px', padding: '10px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {editingCategoriaSintomaId ? <Save size={14} /> : <Plus size={14} />}
                  {editingCategoriaSintomaId ? 'Actualizar categoría' : 'Agregar categoría'}
                </button>
              </form>
            </div>
          </div>
          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderRadius: '16px', border: '1px solid #e5e7eb', background: '#fafafa', overflow: 'hidden' }}>
              <div style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>Categorías</p>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111', marginTop: '4px', margin: 0 }}>Orden y estado de las categorías</h3>
                </div>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', maxHeight: '320px', overflow: 'auto', paddingRight: '4px' }}>
                  {categoriasConSintomas.map((cat, index) => {
                    const enUso = cat.items.length;
                    return (
                      <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 12px', background: '#fff' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fafafa', border: '1px solid #e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#6b7280', flexShrink: 0 }}>{index + 1}</span>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cat.color || SYMPTOM_CATEGORY_COLOR_FALLBACK, flexShrink: 0, display: 'inline-block' }}></span>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{cat.label}</p>
                          </div>
                          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Orden {index + 1} • {enUso} síntoma(s) {cat.legacy ? '• legado' : ''}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {!cat.legacy && cat.activo !== false && (
                            <>
                              <button type="button" onClick={() => moverCategoriaSintoma(cat, 'up')} style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'pointer' }} title="Subir categoría">
                                <ArrowUp size={13} />
                              </button>
                              <button type="button" onClick={() => moverCategoriaSintoma(cat, 'down')} style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'pointer' }} title="Bajar categoría">
                                <ArrowDown size={13} />
                              </button>
                            </>
                          )}
                          {!cat.legacy && (
                            <button type="button" onClick={() => startEditCategoriaSintoma(cat)} style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }} title="Editar categoría">
                              <Pencil size={12} />
                            </button>
                          )}
                          {!cat.legacy && (
                            <button
                              type="button"
                              onClick={() => toggleCategoriaSintomaActiva(cat)}
                              style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}
                              title={cat.activo === false ? 'Activar categoría' : 'Desactivar categoría'}
                            >
                              {cat.activo === false ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                            </button>
                          )}
                          {!cat.legacy && (
                            <button
                              type="button"
                              onClick={() => eliminarCategoriaSintoma(cat)}
                              style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}
                              title="Eliminar categoría"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: '16px', border: '1px solid #e5e7eb', background: '#fafafa', overflow: 'hidden' }}>
              <div style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>Vista previa clínica</p>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111', marginTop: '4px', margin: 0 }}>Así se mostrará en Sección Consulta</h3>
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', maxWidth: '320px', textAlign: 'right', display: isMobile ? 'none' : 'block', margin: 0 }}>El orden que ves aquí es el mismo que recibirá el médico en Motivo.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '640px', overflow: 'auto', padding: '16px', paddingRight: '12px' }}>
                {sintomatologia.length === 0 && <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay síntomas registrados.</p>}
                {categoriasConSintomas.map((cat, categoryIndex) => {
                  const items = cat.items;
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.id} style={{ borderRadius: '16px', border: '1px solid #e5e7eb', background: '#fff', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fafafa', border: '1px solid #e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#4b5563' }}>{categoryIndex + 1}</span>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color || SYMPTOM_CATEGORY_COLOR_FALLBACK, display: 'inline-block' }}></span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.label}</span>
                        <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600 }}>{items.length} síntoma(s)</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '4px' }}>
                        {items.map((item, itemIndex) => (
                          <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fafafa' }}>
                            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ width: '24px', height: '24px', borderRadius: '8px', background: '#fff', border: '1px solid #e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#6b7280', flexShrink: 0 }}>{itemIndex + 1}</span>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</span>
                                <span style={{ fontSize: '10px', color: '#9ca3af' }}>{item.activo === false ? 'No visible en consulta' : 'Visible en consulta'}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => moverSintoma(item, 'up')}
                                style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                                title="Subir síntoma"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moverSintoma(item, 'down')}
                                style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                                title="Bajar síntoma"
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button type="button" onClick={() => startEditSintomatologia(item)} style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }} title="Editar síntoma">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => toggleActivo('catalogo_sintomatologia', item.id, item.activo !== false)} style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }} title={item.activo === false ? 'Mostrar síntoma' : 'Ocultar síntoma'}>{item.activo === false ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}</button>
                              <button onClick={() => eliminarSintomatologia(item.id)} style={{ height: '32px', width: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }} title="Eliminar síntoma"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'procedimientos' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: isMobile ? '16px 12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '380px 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#111', display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Bandage size={14} />
                Catalogo de procedimientos
              </h2>
              {editingProcedimientoId && (
                <button
                  type="button"
                  onClick={resetProcedimientoForm}
                  style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px' }}>
              Alta, edicion y activacion de procedimientos clinicos para Seccion Consulta.
            </p>

            <form onSubmit={saveProcedimiento} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                  placeholder="Clave"
                  value={procedimientoForm.clave}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, clave: e.target.value })}
                />
                <select
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }}
                  value={procedimientoForm.categoria}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, categoria: e.target.value })}
                >
                  {PROCEDURE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>

              <input
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                placeholder="Nombre del procedimiento *"
                value={procedimientoForm.nombre}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, nombre: e.target.value })}
              />

              <textarea
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                rows={2}
                placeholder="Descripcion clinica"
                value={procedimientoForm.descripcion}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, descripcion: e.target.value })}
              />

              <textarea
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                rows={2}
                placeholder="Preparacion previa del paciente"
                value={procedimientoForm.preparacion}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, preparacion: e.target.value })}
              />

              <textarea
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                rows={2}
                placeholder="Contraindicaciones y precauciones"
                value={procedimientoForm.contraindicaciones}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, contraindicaciones: e.target.value })}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Duracion (min)"
                  value={procedimientoForm.duracionMin}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, duracionMin: e.target.value })}
                />

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                  <input
                    type="checkbox"
                    checked={procedimientoForm.requiereConsentimiento === true}
                    onChange={(e) => setProcedimientoForm({ ...procedimientoForm, requiereConsentimiento: e.target.checked })}
                  />
                  Requiere consentimiento
                </label>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                <input
                  type="checkbox"
                  checked={procedimientoForm.activo !== false}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, activo: e.target.checked })}
                />
                Registro activo
              </label>

              <button style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #111', borderRadius: '6px', padding: '8px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {editingProcedimientoId ? <Save size={14} /> : <Plus size={14} />}
                {editingProcedimientoId ? 'Guardar cambios' : 'Agregar procedimiento'}
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '560px', overflow: 'auto', paddingRight: '4px' }}>
            {procedimientos.length === 0 && (
              <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay procedimientos registrados en Firestore.</p>
            )}
            {procedimientosPorCategoria.map((group) => (
              <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4b5563', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px' }}>
                  {group.label} ({group.items.length})
                </div>
                {group.items.length === 0 && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px' }}>Sin registros en esta categoria.</p>
                )}
                {group.items.map((item) => (
                  <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fff' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{item.nombre}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {item.clave || 'Sin clave'} • {getProcedureCategoryLabel(item.categoria)}
                      </div>
                      {item.descripcion && (
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{item.descripcion}</div>
                      )}
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', background: '#fafafa', color: '#4b5563' }}>
                          <Clock size={11} /> {item.duracionMin || 20} min
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', background: '#fafafa', color: '#4b5563' }}>
                          {item.requiereConsentimiento ? 'Consentimiento requerido' : 'Sin consentimiento'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => startEditProcedimiento(item)}
                        style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActivo('catalogo_procedimientos', item.id, item.activo !== false)}
                        style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}
                      >
                        {item.activo === false ? 'Inactivo' : 'Activo'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'estudios' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: isMobile ? '16px 12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '380px 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#111', margin: 0 }}>Catalogo de estudios</h2>
              {editingEstudioId && (
                <button
                  type="button"
                  onClick={resetEstudioForm}
                  style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px' }}>
              Alta, edicion y activacion de catalogos de estudios. En consulta se muestran sin precio.
            </p>

            <form onSubmit={saveEstudio} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                  placeholder="Clave"
                  value={estudioForm.clave}
                  onChange={(e) => setEstudioForm({ ...estudioForm, clave: e.target.value })}
                />
                <select
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }}
                  value={estudioForm.categoria}
                  onChange={(e) => setEstudioForm({ ...estudioForm, categoria: e.target.value })}
                >
                  {STUDY_CATEGORY_OPTIONS.map((option, index) => (
                    <option key={option.id} value={option.id}>{index + 1}. {option.label}</option>
                  ))}
                </select>
              </div>

              <p style={{ fontSize: '11px', color: '#6b7280' }}>
                Si seleccionas Paquetes, aparecera para todos en Expediente Clinico &gt; Estudios &gt; Paquetes.
              </p>

              <input
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                placeholder="Descripcion del servicio de estudio *"
                value={estudioForm.descripcion}
                onChange={(e) => setEstudioForm({ ...estudioForm, descripcion: e.target.value })}
              />

              {normalizeStudyCategory(estudioForm.categoria) === 'paquete' && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', background: '#fafafa' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>Laboratorios individuales que componen el paquete</p>
                  <div style={{ maxHeight: '144px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {estudiosBaseParaPaquete.map((item) => (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#4b5563' }}>
                        <input
                          type="checkbox"
                          checked={estudioForm.componentesIds.includes(item.id)}
                          onChange={() => toggleComponentePaquete(item.id)}
                        />
                        <span>{item.descripcion}</span>
                        {item.clave && <span style={{ color: '#9ca3af' }}>({item.clave})</span>}
                      </label>
                    ))}
                    {estudiosBaseParaPaquete.length === 0 && (
                      <p style={{ fontSize: '11px', color: '#9ca3af' }}>No hay laboratorios individuales activos para agregar.</p>
                    )}
                  </div>
                </div>
              )}

              <input
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                type="number"
                min="0"
                step="0.01"
                placeholder="Precio (solo visible en admin)"
                value={estudioForm.precio}
                onChange={(e) => setEstudioForm({ ...estudioForm, precio: e.target.value })}
              />

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fafafa', fontSize: '11px', fontWeight: 600, color: '#4b5563' }}>
                <input
                  type="checkbox"
                  checked={estudioForm.activo !== false}
                  onChange={(e) => setEstudioForm({ ...estudioForm, activo: e.target.checked })}
                />
                Registro activo
              </label>

              <button style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #111', borderRadius: '6px', padding: '8px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {editingEstudioId ? <Save size={14} /> : <Plus size={14} />}
                {editingEstudioId ? 'Guardar cambios' : 'Agregar registro'}
              </button>
            </form>

            <div style={{ marginTop: '16px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
              <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
                Base detectada en `public/data/estudios.json`: {legacyEstudios.length} registros
              </p>
              <button
                type="button"
                onClick={importBaseEstudios}
                disabled={importandoEstudios || legacyEstudios.length === 0}
                style={{ width: '100%', background: importandoEstudios || legacyEstudios.length === 0 ? '#d1d5db' : '#111', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 0', fontSize: '13px', fontWeight: 700, cursor: importandoEstudios || legacyEstudios.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {importandoEstudios ? 'Importando...' : 'Importar base de estudios'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '560px', overflow: 'auto', paddingRight: '4px' }}>
            {estudios.length === 0 && (
              <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay estudios registrados en Firestore.</p>
            )}
            {estudiosPorCategoria.map((group, groupIndex) => (
              <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4b5563', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px' }}>
                  {groupIndex + 1}. {group.label} ({group.items.length})
                </div>
                {group.items.length === 0 && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px' }}>Sin registros en esta categoria.</p>
                )}
                {group.items.map((item) => (
                  <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fff' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{item.descripcion}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {item.clave || 'Sin clave'} • {getStudyCategoryLabel(item.categoria)}
                      </div>
                      {normalizeStudyCategory(item.categoria) === 'paquete' && (
                        <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
                          Incluye: {item.componentes?.length || 0} estudio(s)
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Precio admin: {formatMXN(item.precio || 0)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => startEditEstudio(item)}
                        style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        onClick={() => toggleActivo('catalogo_estudios', item.id, item.activo !== false)}
                        style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}
                      >
                        {item.activo === false ? 'Inactivo' : 'Activo'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'referencias_medicas' && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: isMobile ? '16px 12px' : '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '400px 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 800, color: '#111', margin: 0 }}>Referencias Médicas</h2>
              {editingReferenciaMedicaId && (
                <button type="button" onClick={resetReferenciaMedicaForm} style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <X size={14} /> Cancelar edición
                </button>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '16px' }}>Alta de médicos y consultorios de referencia para derivación de pacientes.</p>

            <form onSubmit={saveReferenciaMedica} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '4px', display: 'block' }}>Especialidad *</label>
                <input
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                  placeholder="Ej. Cardiología"
                  value={referenciaMedicaForm.especialidad}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, especialidad: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '4px', display: 'block' }}>Tipo de cita</label>
                <select
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }}
                  value={referenciaMedicaForm.tipoCita}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, tipoCita: e.target.value })}
                >
                  {TIPO_CITA_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '4px', display: 'block' }}>Nombre del médico *</label>
                <input
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                  placeholder="Ej. Dr. Juan Pérez"
                  value={referenciaMedicaForm.nombreMedico}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, nombreMedico: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '4px', display: 'block' }}>Teléfono</label>
                  <input
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="Ej. 55-1234-5678"
                    value={referenciaMedicaForm.telefonoConsultorio}
                    onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, telefonoConsultorio: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '4px', display: 'block' }}>Dirección</label>
                  <input
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                    placeholder="Ej. Av. Reforma 123"
                    value={referenciaMedicaForm.direccionConsultorio}
                    onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, direccionConsultorio: e.target.value })}
                  />
                </div>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={referenciaMedicaForm.activo}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, activo: e.target.checked })}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#4b5563' }}>Activo</span>
              </label>

              <button style={{ width: '100%', background: '#111', color: '#fff', border: '1px solid #111', borderRadius: '6px', padding: '10px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {editingReferenciaMedicaId ? <Save size={14} /> : <Plus size={14} />}
                {editingReferenciaMedicaId ? 'Guardar cambios' : 'Agregar referencia'}
              </button>
            </form>

            <p style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af' }}>
              {referenciasMedicas.filter(r => r.activo !== false).length} referencia(s) activa(s) de {referenciasMedicas.length} total(es)
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '560px', overflow: 'auto', paddingRight: '4px' }}>
            {referenciasMedicas.length === 0 && (
              <p style={{ fontSize: '13px', color: '#6b7280', padding: '40px 0', textAlign: 'center' }}>No hay referencias médicas registradas.</p>
            )}
            {referenciasMedicas.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} style={{ border: targetHighlightId === item.id ? '1px solid #111' : '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'all 0.3s', background: targetHighlightId === item.id ? '#fafafa' : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{item.nombreMedico}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{item.especialidad} • {getTipoCitaLabel(item.tipoCita)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button type="button" onClick={() => startEditReferenciaMedica(item)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Pencil size={12} /> Editar
                    </button>
                    <button
                      onClick={() => toggleActivo('catalogo_referencias_medicas', item.id, item.activo !== false)}
                      style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}
                    >
                      {item.activo === false ? 'Inactivo' : 'Activo'}
                    </button>
                  </div>
                </div>

                {(item.telefonoConsultorio || item.direccionConsultorio) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
                    {item.telefonoConsultorio && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', background: '#fafafa', border: '1px solid #f3f4f6' }}>
                        <Phone size={10} /> {item.telefonoConsultorio}
                      </span>
                    )}
                    {item.direccionConsultorio && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', background: '#fafafa', border: '1px solid #f3f4f6' }}>
                        <MapPin size={10} /> {item.direccionConsultorio}
                      </span>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'capacitacion' && (() => {
        const CATEGORIAS_CAP = ['Protocolos', 'Procedimientos', 'Normas', 'Guías clínicas', 'Farmacología'];
        const isEnfermeria = capacitacionSubTab === 'enfermeria';

        const docs = isEnfermeria ? docsCapacitacion : docsCapacitacionMedicos;
        const form = isEnfermeria ? capacitacionForm : capacitacionMedicosForm;
        const setForm = isEnfermeria ? setCapacitacionForm : setCapacitacionMedicosForm;
        const editingId = isEnfermeria ? editingCapacitacionId : editingCapacitacionMedicosId;
        const setEditingId = isEnfermeria ? setEditingCapacitacionId : setEditingCapacitacionMedicosId;
        const file = isEnfermeria ? capacitacionFile : capacitacionMedicosFile;
        const setFile = isEnfermeria ? setCapacitacionFile : setCapacitacionMedicosFile;
        const uploading = isEnfermeria ? uploadingCapacitacion : uploadingCapacitacionMedicos;
        const setUpUploading = isEnfermeria ? setUploadingCapacitacion : setUploadingCapacitacionMedicos;
        const collectionName = isEnfermeria ? 'catalogo_documentos_capacitacion' : 'catalogo_documentos_capacitacion_medicos';
        const label = isEnfermeria ? 'Enfermería' : 'Médicos';

        const saveCap = async () => {
          const titulo = form.titulo.trim();
          if (!titulo) { showPill('El título es obligatorio', 'error'); return; }
          if (!form.contenido.trim() && !file && !editingId) { showPill('Agrega contenido de texto o un archivo', 'error'); return; }
          setUpUploading(true);
          try {
            let archivoUrl = editingId ? (docs.find(d => d.id === editingId)?.archivoUrl || '') : '';
            let archivoNombre = editingId ? (docs.find(d => d.id === editingId)?.archivoNombre || '') : '';
            if (file) {
              const storageRef = ref(storage, `capacitacion/${Date.now()}_${file.name}`);
              await uploadBytes(storageRef, file);
              archivoUrl = await getDownloadURL(storageRef);
              archivoNombre = file.name;
            }
            const payload = {
              titulo,
              categoria: form.categoria || 'General',
              descripcion: form.descripcion.trim(),
              contenido: form.contenido.trim(),
              orden: Number(form.orden || 0),
              activo: true,
              ...(archivoUrl ? { archivoUrl, archivoNombre } : {}),
              updatedAt: serverTimestamp(),
              updatedBy: user?.uid || ''
            };
            if (editingId) {
              await updateDoc(doc(db, collectionName, editingId), payload);
              showPill('Documento actualizado', 'success');
            } else {
              payload.createdAt = serverTimestamp();
              payload.createdBy = user?.uid || '';
              await addDoc(collection(db, collectionName), payload);
              showPill('Documento creado', 'success');
            }
            setForm({ titulo: '', categoria: '', descripcion: '', contenido: '', orden: 0 });
            setEditingId(null);
            setFile(null);
          } catch (err) {
            console.error(err);
            showPill('Error al guardar documento', 'error');
          }
          setUpUploading(false);
        };
        const startEdit = (item) => {
          setEditingId(item.id);
          setForm({ titulo: item.titulo || '', categoria: item.categoria || '', descripcion: item.descripcion || '', contenido: item.contenido || '', orden: item.orden || 0 });
          setFile(null);
        };
        const cancelEdit = () => {
          setEditingId(null);
          setForm({ titulo: '', categoria: '', descripcion: '', contenido: '', orden: 0 });
          setFile(null);
        };
        return (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setCapacitacionSubTab('enfermeria')}
                style={{
                  padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, border: '1px solid',
                  background: isEnfermeria ? '#111' : '#fff',
                  color: isEnfermeria ? '#fff' : '#4b5563',
                  borderColor: isEnfermeria ? '#111' : '#e5e7eb',
                  cursor: 'pointer'
                }}
              >
                Enfermería
              </button>
              <button
                onClick={() => setCapacitacionSubTab('medicos')}
                style={{
                  padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, border: '1px solid',
                  background: !isEnfermeria ? '#111' : '#fff',
                  color: !isEnfermeria ? '#fff' : '#4b5563',
                  borderColor: !isEnfermeria ? '#111' : '#e5e7eb',
                  cursor: 'pointer'
                }}
              >
                Médicos
              </button>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <BookOpen size={18} style={{ color: '#4b5563' }} />
                {editingId ? 'Editar documento' : `Nuevo documento de capacitación — ${label}`}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Título *</label>
                  <input value={form.titulo} onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Protocolo de Triage" style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Categoría</label>
                  <select value={form.categoria} onChange={(e) => setForm(p => ({ ...p, categoria: e.target.value }))} style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
                    <option value="">General</option>
                    {CATEGORIAS_CAP.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Descripción breve</label>
                <input value={form.descripcion} onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción corta del documento" style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Contenido de texto (para IA)</label>
                <textarea value={form.contenido} onChange={(e) => setForm(p => ({ ...p, contenido: e.target.value }))} placeholder="Pega aquí el contenido del documento... La IA usará este texto para responder preguntas." rows={8} style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Archivo (opcional)</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px dashed #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>
                    <Upload size={16} style={{ color: '#9ca3af' }} />
                    <span style={{ fontSize: '13px', color: '#4b5563' }}>{file ? file.name : 'Seleccionar archivo'}</span>
                    <input type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Orden</label>
                  <input type="number" value={form.orden} onChange={(e) => setForm(p => ({ ...p, orden: e.target.value }))} style={{ width: '80px', padding: '8px 12px', fontSize: '13px', border: '1px solid #e5e7eb', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  {editingId && (
                    <button onClick={cancelEdit} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 600, color: '#4b5563', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
                  )}
                  <button onClick={saveCap} disabled={uploading} style={{ padding: '8px 16px', borderRadius: '6px', background: uploading ? '#d1d5db' : '#111', color: '#fff', border: '1px solid ' + (uploading ? '#d1d5db' : '#111'), fontSize: '13px', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {uploading ? <><span>⏳</span> Guardando...</> : <><Save size={14} /> {editingId ? 'Actualizar' : 'Guardar'}</>}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563', margin: 0 }}>{docs.length} documento{docs.length !== 1 ? 's' : ''} registrado{docs.length !== 1 ? 's' : ''} — {label}</h3>
              {docs.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
                  <BookOpen size={40} style={{ color: '#e5e7eb', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>No hay documentos de capacitación para {label.toLowerCase()}. Agrega el primero.</p>
                </div>
              ) : docs.map(item => (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '16px', opacity: item.activo === false ? 0.5 : 1 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: '#fafafa', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={18} style={{ color: '#4b5563' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{item.titulo}</h4>
                      {item.categoria && <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', background: '#fafafa', border: '1px solid #e5e7eb', color: '#4b5563', borderRadius: '4px' }}>{item.categoria}</span>}
                      {item.archivoNombre && <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', background: '#fafafa', border: '1px solid #e5e7eb', color: '#4b5563', borderRadius: '4px' }}>📎 {item.archivoNombre}</span>}
                    </div>
                    {item.descripcion && <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.descripcion}</p>}
                    {item.contenido && <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>📝 {item.contenido.length} caracteres de contenido para IA</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => startEdit(item)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Pencil size={12} /> Editar</button>
                    <button
                      onClick={() => askConfirm(`¿Desactivar "${item.titulo}"?`, async () => {
                        await updateDoc(doc(db, collectionName, item.id), { activo: !(item.activo !== false) });
                        showPill(item.activo !== false ? 'Documento desactivado' : 'Documento activado', 'success');
                      })}
                      style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer' }}
                    >
                      {item.activo === false ? 'Inactivo' : 'Activo'}
                    </button>
                    <button
                      onClick={() => askConfirm(`¿Eliminar "${item.titulo}" permanentemente?`, async () => {
                        await deleteDoc(doc(db, collectionName, item.id));
                        showPill('Documento eliminado', 'success');
                      })}
                      style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '9999px', background: '#fff', color: '#4b5563', border: '1px solid #d1d5db', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

    </div>
  );
};

export default CatalogosGlobales;