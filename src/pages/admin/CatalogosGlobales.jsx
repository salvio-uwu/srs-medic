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
    const q = globalSearchQuery.toLowerCase().trim();
    const results = [];

    motivos.forEach(m => {
      if (m.nombre?.toLowerCase().includes(q) || m.area?.toLowerCase().includes(q)) {
        results.push({ id: m.id, type: 'motivos', title: m.nombre, subtitle: `Motivo • ${m.area || 'General'}` });
      }
    });
    consultorios.forEach(c => {
      if (c.nombre?.toLowerCase().includes(q) || c.sucursal?.toLowerCase().includes(q)) {
        results.push({ id: c.id, type: 'consultorios', title: c.nombre, subtitle: `Consultorio • Sucursal: ${c.sucursal || 'N/D'}` });
      }
    });
    sucursales.forEach(s => {
      if (s.nombre?.toLowerCase().includes(q) || s.ubicacion?.toLowerCase().includes(q)) {
        results.push({ id: s.id, type: 'sucursales', title: s.nombre, subtitle: `Sucursal • ${s.ubicacion || 'Sin ubicación'}` });
      }
    });
    especialidades.forEach(e => {
      if (e.nombre?.toLowerCase().includes(q)) {
        results.push({ id: e.id, type: 'especialidades', title: e.nombre, subtitle: 'Especialidad médica' });
      }
    });
    sintomatologia.forEach(s => {
      if (s.nombre?.toLowerCase().includes(q)) {
        results.push({ id: s.id, type: 'sintomatologia', title: s.nombre, subtitle: 'Síntoma' });
      }
    });
    estudios.forEach(e => {
      if (e.descripcion?.toLowerCase().includes(q) || e.clave?.toLowerCase().includes(q)) {
        results.push({ id: e.id, type: 'estudios', title: e.descripcion, subtitle: `Estudio • Clave: ${e.clave || 'S/C'}` });
      }
    });
    procedimientos.forEach(p => {
      if (p.nombre?.toLowerCase().includes(q) || p.clave?.toLowerCase().includes(q)) {
        results.push({ id: p.id, type: 'procedimientos', title: p.nombre, subtitle: `Procedimiento • Clave: ${p.clave || 'S/C'}` });
      }
    });
    referenciasMedicas.forEach(r => {
      if (r.nombreMedico?.toLowerCase().includes(q) || r.especialidad?.toLowerCase().includes(q)) {
        results.push({ id: r.id, type: 'referencias', title: r.nombreMedico, subtitle: `Referencia Médica • ${r.especialidad || 'N/D'}` });
      }
    });

    return results.slice(0, 8); // Limit to top 8 results to avoid huge dropdowns
  }, [globalSearchQuery, motivos, consultorios, sucursales, especialidades, sintomatologia, estudios, procedimientos, referenciasMedicas]);

  const handleSelectSearchResult = (result) => {
    setActiveTab(result.type);
    setGlobalSearchQuery('');
    setTargetHighlightId(result.id);
    
    // Smooth scroll and clear highlight after a delay
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

      // Propagar a citas futuras que tengan este consultorio
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
      <div className="p-8">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Sora, sans-serif' }}>Catálogos Globales</h1>
          <p className="mt-2 text-slate-500">Solo administración puede modificar motivos, consultorios, sucursales y estudios.</p>
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
    <div className="p-4 lg:p-5 max-w-[1480px] mx-auto pb-10 space-y-4">
      {pill.show && (
        <div className={`fixed top-6 right-6 z-[120] px-4 py-2 rounded-full shadow-lg border text-sm font-semibold ${pill.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700'
            : pill.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
          {pill.message}
        </div>
      )}

      {confirmState.open && (
        <div className="fixed inset-0 z-[130] bg-slate-900/35 backdrop-blur-[1px] flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-slate-700">{confirmState.message}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmState({ open: false, message: '', onAccept: null })}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-600"
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
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-600 text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm px-4 py-4 lg:px-5 lg:py-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-[28px] font-bold text-slate-900 leading-tight" style={{ fontFamily: 'Sora, sans-serif' }}>Catálogos Globales</h1>
            <p className="text-slate-500 text-sm mt-1">Configuración maestra para agenda, consultorios y documentos clínicos.</p>
          </div>
          
          <div className="relative w-full lg:w-80 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 rounded-2xl pl-9 pr-8 py-2.5 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10 transition-all"
              />
              {globalSearchQuery && (
                <button onClick={() => { setGlobalSearchQuery(''); setSearchSelectedIndex(-1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            
            {globalSearchQuery && globalSearchResults.length > 0 && (
              <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80 border-b border-slate-100 sticky top-0">Resultados globales</div>
                {globalSearchResults.map((result, idx) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectSearchResult(result)}
                    onMouseEnter={() => setSearchSelectedIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-50 transition-colors flex flex-col items-start gap-0.5 ${searchSelectedIndex === idx ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`text-sm font-semibold line-clamp-1 ${searchSelectedIndex === idx ? 'text-blue-700' : 'text-slate-800'}`}>{result.title}</span>
                    <span className="text-[11px] font-medium text-slate-500">{result.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
            {globalSearchQuery && globalSearchQuery.trim().length >= 2 && globalSearchResults.length === 0 && (
              <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-center">
                <p className="text-sm text-slate-500">No se encontraron resultados.</p>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-2xl p-1 w-max min-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
                style={activeTab === tab.id
                  ? { background: '#fff', color: '#005B8E', fontWeight: 700, boxShadow: '0 1px 2px rgba(15,23,42,.05)' }
                  : { background: 'transparent', color: '#64748b' }
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === 'motivos' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <div>
            <h2 className="text-sm font-black text-slate-800 mb-1">Motivos de consulta</h2>
            <p className="text-xs text-slate-500 mb-4">Define tarifa, duración y reglas del motivo para agenda, operación y auditoría.</p>
            {editingMotivoId && (
              <button type="button" onClick={resetMotivoForm} className="mb-3 text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearMotivo} className="space-y-3">
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre" value={motivoForm.nombre} onChange={(e) => setMotivoForm({ ...motivoForm, nombre: e.target.value })} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Precio" value={motivoForm.precio} onChange={(e) => setMotivoForm({ ...motivoForm, precio: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Precio mínimo" value={motivoForm.precioMin} onChange={(e) => setMotivoForm({ ...motivoForm, precioMin: e.target.value })} />
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Precio máximo" value={motivoForm.precioMax} onChange={(e) => setMotivoForm({ ...motivoForm, precioMax: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Área/Categoría" value={motivoForm.area} onChange={(e) => setMotivoForm({ ...motivoForm, area: e.target.value })} />
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="number" min="10" step="5" placeholder="Duración (min)" value={motivoForm.duracionMin} onChange={(e) => setMotivoForm({ ...motivoForm, duracionMin: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={motivoForm.prioridadTriage} onChange={(e) => setMotivoForm({ ...motivoForm, prioridadTriage: e.target.value })}>
                  <option value="baja">Prioridad: Baja</option>
                  <option value="media">Prioridad: Media</option>
                  <option value="alta">Prioridad: Alta</option>
                </select>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="color" value={motivoForm.colorTag} onChange={(e) => setMotivoForm({ ...motivoForm, colorTag: e.target.value })} title="Color del motivo" />
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={motivoForm.teleconsultaPermitida}
                  onChange={(e) => setMotivoForm({ ...motivoForm, teleconsultaPermitida: e.target.checked })}
                />
                Permitir teleconsulta en este motivo
              </label>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700">
                <input
                  type="checkbox"
                  checked={motivoForm.atendidoPorEnfermeria}
                  onChange={(e) => setMotivoForm({ ...motivoForm, atendidoPorEnfermeria: e.target.checked })}
                />
                Atendido por enfermería
              </label>
              <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                {editingMotivoId ? <Save size={14} /> : <Plus size={14} />}
                {editingMotivoId ? 'Guardar cambios' : 'Guardar motivo'}
              </button>
            </form>
          </div>
          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {motivos.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay motivos registrados.</p>}
            {motivos.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-lg p-3 flex items-start justify-between gap-3 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-white'}`}>
                <div>
                  <div className="text-sm font-bold text-slate-800">{item.nombre}</div>
                  <div className="text-xs text-slate-500">{formatMXN(item.precio)} • {item.area || item.categoria || 'General'} • {item.duracionMin || 20} min</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-600">
                      Rango: {formatMXN(item.precioMin || item.precio)} - {formatMXN(item.precioMax || item.precio)}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${item.teleconsultaPermitida === false ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {item.teleconsultaPermitida === false ? 'Sin teleconsulta' : 'Teleconsulta permitida'}
                    </span>
                    {item.atendidoPorEnfermeria && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700">
                        Enfermería
                      </span>
                    )}
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 bg-white text-slate-600">
                      Triage: {item.prioridadTriage || 'media'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEditMotivo(item)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => toggleActivo('catalogo_motivos_consulta', item.id, item.activo !== false)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{item.activo === false ? 'Inactivo' : 'Activo'}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'consultorios' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <div>
            <h2 className="text-sm font-black text-slate-800 mb-1">Consultorios</h2>
            <p className="text-xs text-slate-500 mb-4">Asigna consultorio, sucursal, horarios, días y capacidad operativa.</p>
            {editingConsultorioId && (
              <button type="button" onClick={resetConsultorioForm} className="mb-3 text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearConsultorio} className="space-y-3">
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre" value={consultorioForm.nombre} onChange={(e) => setConsultorioForm({ ...consultorioForm, nombre: e.target.value })} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ubicación" value={consultorioForm.ubicacion} onChange={(e) => setConsultorioForm({ ...consultorioForm, ubicacion: e.target.value })} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Especialidad" value={consultorioForm.especialidad} onChange={(e) => setConsultorioForm({ ...consultorioForm, especialidad: e.target.value })} />

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Tipo de horario</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    value={consultorioForm.horarioTipo}
                    onChange={(e) => setConsultorioForm({ ...consultorioForm, horarioTipo: e.target.value })}
                  >
                    <option value="personalizado">Personalizado</option>
                    <option value="24h">24 horas (Lunes a Domingo)</option>
                  </select>
                </div>

                {consultorioForm.horarioTipo === '24h' ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-semibold">
                    Este consultorio quedará activo de 00:00 a 23:59 todos los días.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Plantillas rápidas</label>
                      <div className="flex flex-wrap gap-1.5">
                        {CONSULTORIO_HORARIO_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => aplicarPresetConsultorio(preset.id)}
                            className="text-xs font-semibold px-2 py-1 rounded-full border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-600"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" type="time" value={consultorioForm.horaInicio} onChange={(e) => setConsultorioForm({ ...consultorioForm, horaInicio: e.target.value })} />
                      <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" type="time" value={consultorioForm.horaFin} onChange={(e) => setConsultorioForm({ ...consultorioForm, horaFin: e.target.value })} />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="number" min="5" step="5" placeholder="Intervalo (min)" value={consultorioForm.intervaloMin} onChange={(e) => setConsultorioForm({ ...consultorioForm, intervaloMin: e.target.value })} />
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="number" min="1" step="1" placeholder="Capacidad simultánea" value={consultorioForm.capacidadSimultanea} onChange={(e) => setConsultorioForm({ ...consultorioForm, capacidadSimultanea: e.target.value })} />
              </div>
              {consultorioForm.horarioTipo !== '24h' && (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {DIAS_SEMANA.map((dia) => (
                    <label key={dia} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
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
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={consultorioForm.sucursalId} onChange={(e) => setConsultorioForm({ ...consultorioForm, sucursalId: e.target.value })}>
                <option value="">Seleccionar sucursal...</option>
                {sucursalesActivas.map((item) => (<option key={item.id} value={item.id}>{item.nombre}</option>))}
              </select>
              {sucursalSeleccionadaForm && (
                <div className={`text-xs rounded-lg px-3 py-2 border ${consultorioFueraDeHorarioSucursal ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  Sucursal {sucursalSeleccionadaForm.nombre}: {formatScheduleLabel(horarioSucursalForm)}.
                  {consultorioFueraDeHorarioSucursal ? ' La agenda validará contra el horario de sucursal, aunque el consultorio tenga un rango mayor.' : ' El horario del consultorio está cubierto por la sucursal seleccionada.'}
                </div>
              )}
              <button disabled={sucursalesActivas.length === 0} className="w-full bg-blue-600 disabled:bg-slate-300 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                {editingConsultorioId ? <Save size={14} /> : <Plus size={14} />}
                {editingConsultorioId ? 'Guardar cambios' : 'Guardar consultorio'}
              </button>
            </form>
          </div>
          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {consultorios.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay consultorios registrados.</p>}
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
                <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-lg p-3 flex items-start justify-between gap-3 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-white'}`}>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{item.nombre}</div>
                    <div className="text-xs text-slate-500">{item.especialidad || 'General'} • {item.ubicacion || 'Sin ubicación'}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Sucursal: {item.sucursal || 'No definida'} • {item.horarioTipo === '24h' || is24hSchedule(item.horaInicio, item.horaFin, item.diasAtencion || []) ? '24 horas' : `${normalizeTimeValue(item.horaInicio) || '08:00'}-${normalizeTimeValue(item.horaFin) || '18:00'}`}
                    </div>
                    <div className="text-xs text-slate-400">
                      Días: {(item.horarioTipo === '24h' || is24hSchedule(item.horaInicio, item.horaFin, item.diasAtencion || [])) ? 'lunes, martes, miercoles, jueves, viernes, sabado, domingo' : (item.diasAtencion || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']).join(', ')}
                    </div>
                    <div className={`text-xs mt-1 ${horarioSucursal ? 'text-slate-400' : 'text-amber-600'}`}>
                      Horario de sucursal: {horarioSucursal ? formatScheduleLabel(horarioSucursal) : 'sin configurar'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => startEditConsultorio(item)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => toggleActivo('catalogo_consultorios', item.id, item.activo !== false)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{item.activo === false ? 'Inactivo' : 'Activo'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'sucursales' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <div>
            <h2 className="text-sm font-black text-slate-800 mb-1">Sucursales</h2>
            <p className="text-xs text-slate-500 mb-4">Define ubicación, contacto y horario operativo por sede.</p>
            {editingSucursalId && (
              <button type="button" onClick={resetSucursalForm} className="mb-3 text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearSucursal} className="space-y-3">
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre" value={sucursalForm.nombre} onChange={(e) => setSucursalForm({ ...sucursalForm, nombre: e.target.value })} />
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ubicación" value={sucursalForm.ubicacion} onChange={(e) => setSucursalForm({ ...sucursalForm, ubicacion: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Teléfono" value={sucursalForm.telefono} onChange={(e) => setSucursalForm({ ...sucursalForm, telefono: e.target.value })} />
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Responsable" value={sucursalForm.responsable} onChange={(e) => setSucursalForm({ ...sucursalForm, responsable: e.target.value })} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Tipo de horario</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    value={sucursalForm.horarioTipo}
                    onChange={(e) => setSucursalForm({ ...sucursalForm, horarioTipo: e.target.value })}
                  >
                    <option value="personalizado">Personalizado</option>
                    <option value="24h">24 horas (Lunes a Domingo)</option>
                  </select>
                </div>

                {sucursalForm.horarioTipo === '24h' ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-semibold">
                    Esta sucursal quedará operando de 00:00 a 23:59 todos los días.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" type="time" value={sucursalForm.horaApertura} onChange={(e) => setSucursalForm({ ...sucursalForm, horaApertura: e.target.value })} />
                      <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" type="time" value={sucursalForm.horaCierre} onChange={(e) => setSucursalForm({ ...sucursalForm, horaCierre: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-2">
                      {DIAS_SEMANA.map((dia) => (
                        <label key={dia} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
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
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Zona horaria (IANA)" value={sucursalForm.timezone} onChange={(e) => setSucursalForm({ ...sucursalForm, timezone: e.target.value })} />
              <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                {editingSucursalId ? <Save size={14} /> : <Plus size={14} />}
                {editingSucursalId ? 'Guardar cambios' : 'Guardar sucursal'}
              </button>
            </form>
          </div>
          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {sucursales.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay sucursales registradas.</p>}
            {sucursales.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-lg p-3 flex items-start justify-between gap-3 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-white'}`}>
                <div>
                  <div className="text-sm font-bold text-slate-800 inline-flex items-center gap-1"><MapPin size={13} /> {item.nombre}</div>
                  <div className="text-xs text-slate-500">{item.ubicacion || 'Sin ubicación'}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.telefono || 'Sin teléfono'} • {item.responsable || 'Sin responsable'}</div>
                  <div className="text-xs text-slate-400">Horario: {item.horarioTipo === '24h' || is24hSchedule(item.horaApertura, item.horaCierre, item.diasOperacion || []) ? '24 horas' : `${normalizeTimeValue(item.horaApertura) || '08:00'}-${normalizeTimeValue(item.horaCierre) || '20:00'}`} • {(item.horarioTipo === '24h' || is24hSchedule(item.horaApertura, item.horaCierre, item.diasOperacion || [])) ? 'lunes, martes, miercoles, jueves, viernes, sabado, domingo' : (item.diasOperacion || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']).join(', ')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEditSucursal(item)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => toggleActivo('catalogo_sucursales', item.id, item.activo !== false)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{item.activo === false ? 'Inactiva' : 'Activa'}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


      {activeTab === 'especialidades' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <div>
            <h2 className="text-sm font-black text-slate-800 mb-1">Especialidades médicas</h2>
            <p className="text-xs text-slate-500 mb-4">Las especialidades activas aparecerán al dar de alta un médico en el sistema.</p>
            {editingEspecialidadId && (
              <button type="button" onClick={resetEspecialidadForm} className="mb-3 text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                <X size={14} /> Cancelar edición
              </button>
            )}
            <form onSubmit={crearEspecialidad} className="flex gap-2">
              <input
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Escribe el nombre de la especialidad médica"
                value={especialidadNombre}
                onChange={(e) => setEspecialidadNombre(e.target.value)}
              />
              <button className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-bold inline-flex items-center gap-1.5">
                {editingEspecialidadId ? <Save size={14} /> : <Plus size={14} />}
                {editingEspecialidadId ? 'Guardar' : 'Agregar'}
              </button>
            </form>
            <p className="mt-3 text-[11px] text-slate-400">
              {especialidades.filter(e => e.activo !== false).length} especialidad(es) activa(s)
            </p>
          </div>
          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {especialidades.length === 0 && (
              <p className="text-sm text-slate-500 py-10 text-center">No hay especialidades registradas.</p>
            )}
            {especialidades.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2">
                  <GraduationCap size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-800">{item.nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEditEspecialidad(item)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => toggleActivo('catalogo_especialidades', item.id, item.activo !== false)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${item.activo === false
                        ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
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
        <section className="bg-white border border-slate-200 rounded-3xl p-4 lg:p-5 grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] overflow-hidden">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 mb-1">Sintomatología</h2>
                  <p className="text-xs text-slate-500">Ordena cómo verá el médico las categorías y síntomas dentro del motivo.</p>
                </div>
                <div className="rounded-2xl bg-slate-900 text-white px-3 py-2 text-right min-w-[82px]">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Activos</p>
                  <p className="text-lg font-black leading-none mt-1">{sintomatologia.filter((item) => item.activo !== false).length}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Categorías</p>
                  <p className="text-base font-black text-slate-800 mt-1">{categoriasConSintomas.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Síntomas</p>
                  <p className="text-base font-black text-slate-800 mt-1">{sintomatologia.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Vista</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">Compacta</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3.5">
              {editingSintomatologiaId && (
                <button type="button" onClick={resetSintomatologiaForm} className="mb-3 text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                  <X size={14} /> Cancelar edición
                </button>
              )}
              <form onSubmit={crearSintomatologia} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.16em] mb-1.5 block">Síntoma</label>
                  <input className="w-full border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm" placeholder="Nombre del síntoma" value={sintomatologiaNombre} onChange={(e) => setSintomatologiaNombre(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.16em] mb-1.5 block">Categoría</label>
                  <div className="flex flex-wrap gap-2">
                    {categoriasConSintomas.filter((cat) => cat.activo !== false).map((cat, index) => (
                      <button key={cat.id} type="button" onClick={() => setSintomatologiaCategoria(cat.id)}
                        className={`px-3 py-1.5 rounded-2xl text-[11px] font-semibold border transition-all inline-flex items-center gap-2 ${sintomatologiaCategoria === cat.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/15'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50'
                          }`}>
                        <span className="w-5 h-5 rounded-full border border-white/60 bg-white/70 inline-flex items-center justify-center text-[10px] font-black text-slate-500">{index + 1}</span>
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${cat.color || SYMPTOM_CATEGORY_COLOR_FALLBACK}`}></span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="w-full bg-slate-900 text-white rounded-2xl py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-slate-900/15">
                  {editingSintomatologiaId ? <Save size={14} /> : <Plus size={14} />}
                  {editingSintomatologiaId ? 'Guardar cambios' : 'Agregar síntoma'}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Nueva categoría</h3>
                {editingCategoriaSintomaId && (
                  <button type="button" onClick={resetCategoriaSintomaForm} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                    <X size={12} /> Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={saveCategoriaSintoma} className="space-y-2.5 mb-3">
                <input
                  className="w-full border border-slate-300 rounded-2xl px-3.5 py-2.5 text-sm"
                  placeholder="Nombre de categoría"
                  value={categoriaSintomaNombre}
                  onChange={(e) => setCategoriaSintomaNombre(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {SYMPTOM_CATEGORY_COLOR_OPTIONS.map((colorItem) => (
                    <button
                      key={colorItem.value}
                      type="button"
                      onClick={() => setCategoriaSintomaColor(colorItem.value)}
                      className={`px-2.5 py-1.5 rounded-2xl border text-[11px] font-semibold inline-flex items-center gap-2 ${categoriaSintomaColor === colorItem.value
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-blue-300'
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${colorItem.value}`}></span>
                      {colorItem.label}
                    </button>
                  ))}
                </div>
                <button className="w-full bg-slate-100 text-slate-800 rounded-2xl py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-200 transition-colors">
                  {editingCategoriaSintomaId ? <Save size={14} /> : <Plus size={14} />}
                  {editingCategoriaSintomaId ? 'Actualizar categoría' : 'Agregar categoría'}
                </button>
              </form>
            </div>
          </div>
          <div className="min-h-0 flex flex-col gap-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 overflow-hidden">
              <div className="border-b border-slate-200 bg-white/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Categorías</p>
                  <h3 className="text-base font-black text-slate-900 mt-1">Orden y estado de las categorías</h3>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 max-h-[320px] overflow-auto pr-1">
                  {categoriasConSintomas.map((cat, index) => {
                    const enUso = cat.items.length;
                    return (
                      <div key={cat.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-slate-200 rounded-2xl px-3 py-3 bg-white shadow-sm">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200 inline-flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{index + 1}</span>
                            <span className={`w-2.5 h-2.5 rounded-full ${cat.color || SYMPTOM_CATEGORY_COLOR_FALLBACK} shrink-0`}></span>
                            <p className="text-sm font-bold text-slate-800 truncate">{cat.label}</p>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">Orden {index + 1} • {enUso} síntoma(s) {cat.legacy ? '• legado' : ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!cat.legacy && cat.activo !== false && (
                            <>
                              <button type="button" onClick={() => moverCategoriaSintoma(cat, 'up')} className="h-8 w-8 inline-flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200" title="Subir categoría">
                                <ArrowUp size={13} />
                              </button>
                              <button type="button" onClick={() => moverCategoriaSintoma(cat, 'down')} className="h-8 w-8 inline-flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200" title="Bajar categoría">
                                <ArrowDown size={13} />
                              </button>
                            </>
                          )}
                          {!cat.legacy && (
                            <button type="button" onClick={() => startEditCategoriaSintoma(cat)} className="h-8 w-8 inline-flex items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100" title="Editar categoría">
                              <Pencil size={12} />
                            </button>
                          )}
                          {!cat.legacy && (
                            <button
                              type="button"
                              onClick={() => toggleCategoriaSintomaActiva(cat)}
                              className={`h-8 w-8 inline-flex items-center justify-center rounded-xl border ${cat.activo === false ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'}`}
                              title={cat.activo === false ? 'Activar categoría' : 'Desactivar categoría'}
                            >
                              {cat.activo === false ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                            </button>
                          )}
                          {!cat.legacy && (
                            <button
                              type="button"
                              onClick={() => eliminarCategoriaSintoma(cat)}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100"
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

            <div className="min-h-0 flex flex-col rounded-3xl border border-slate-200 bg-slate-50/60 overflow-hidden">
              <div className="border-b border-slate-200 bg-white/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">Vista previa clínica</p>
                  <h3 className="text-base font-black text-slate-900 mt-1">Así se mostrará en Sección Consulta</h3>
                </div>
                <p className="text-xs text-slate-500 max-w-sm text-right hidden xl:block">El orden que ves aquí es el mismo que recibirá el médico en Motivo.</p>
              </div>
              <div className="space-y-3 max-h-[640px] overflow-auto p-4 pr-3">
                {sintomatologia.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay síntomas registrados.</p>}
                {categoriasConSintomas.map((cat, categoryIndex) => {
                  const items = cat.items;
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.id} className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-[0_16px_50px_-40px_rgba(15,23,42,0.4)]">
                      <div className="flex items-center gap-3 mb-2.5">
                        <span className="w-7 h-7 rounded-2xl bg-slate-100 border border-slate-200 inline-flex items-center justify-center text-[11px] font-black text-slate-600">{categoryIndex + 1}</span>
                        <span className={`w-3 h-3 rounded-full ${cat.color || SYMPTOM_CATEGORY_COLOR_FALLBACK}`}></span>
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide">{cat.label}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{items.length} síntoma(s)</span>
                      </div>
                      <div className="space-y-1.5 ml-1">
                        {items.map((item, itemIndex) => (
                          <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-2xl p-2.5 flex items-center justify-between gap-3 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-slate-50/50'}`}>
                            <div className="min-w-0 flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-xl bg-white border border-slate-200 inline-flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{itemIndex + 1}</span>
                              <div className="min-w-0">
                                <span className="text-sm font-semibold text-slate-800 block truncate">{item.nombre}</span>
                                <span className="text-[10px] text-slate-400">{item.activo === false ? 'No visible en consulta' : 'Visible en consulta'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moverSintoma(item, 'up')}
                                className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white border border-transparent hover:border-slate-200"
                                title="Subir síntoma"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moverSintoma(item, 'down')}
                                className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white border border-transparent hover:border-slate-200"
                                title="Bajar síntoma"
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button type="button" onClick={() => startEditSintomatologia(item)} className="h-8 w-8 inline-flex items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100" title="Editar síntoma">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => toggleActivo('catalogo_sintomatologia', item.id, item.activo !== false)} className={`h-8 w-8 inline-flex items-center justify-center rounded-xl border ${item.activo === false ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'}`} title={item.activo === false ? 'Mostrar síntoma' : 'Ocultar síntoma'}>{item.activo === false ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}</button>
                              <button onClick={() => eliminarSintomatologia(item.id)} className="h-8 w-8 inline-flex items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100" title="Eliminar síntoma"><Trash2 size={14} /></button>
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
        <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-800 inline-flex items-center gap-2">
                <Bandage size={14} />
                Catalogo de procedimientos
              </h2>
              {editingProcedimientoId && (
                <button
                  type="button"
                  onClick={resetProcedimientoForm}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Alta, edicion y activacion de procedimientos clinicos para Seccion Consulta.
            </p>

            <form onSubmit={saveProcedimiento} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Clave"
                  value={procedimientoForm.clave}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, clave: e.target.value })}
                />
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={procedimientoForm.categoria}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, categoria: e.target.value })}
                >
                  {PROCEDURE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>

              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre del procedimiento *"
                value={procedimientoForm.nombre}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, nombre: e.target.value })}
              />

              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={2}
                placeholder="Descripcion clinica"
                value={procedimientoForm.descripcion}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, descripcion: e.target.value })}
              />

              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={2}
                placeholder="Preparacion previa del paciente"
                value={procedimientoForm.preparacion}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, preparacion: e.target.value })}
              />

              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={2}
                placeholder="Contraindicaciones y precauciones"
                value={procedimientoForm.contraindicaciones}
                onChange={(e) => setProcedimientoForm({ ...procedimientoForm, contraindicaciones: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Duracion (min)"
                  value={procedimientoForm.duracionMin}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, duracionMin: e.target.value })}
                />

                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={procedimientoForm.requiereConsentimiento === true}
                    onChange={(e) => setProcedimientoForm({ ...procedimientoForm, requiereConsentimiento: e.target.checked })}
                  />
                  Requiere consentimiento
                </label>
              </div>

              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={procedimientoForm.activo !== false}
                  onChange={(e) => setProcedimientoForm({ ...procedimientoForm, activo: e.target.checked })}
                />
                Registro activo
              </label>

              <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                {editingProcedimientoId ? <Save size={14} /> : <Plus size={14} />}
                {editingProcedimientoId ? 'Guardar cambios' : 'Agregar procedimiento'}
              </button>
            </form>
          </div>

          <div className="space-y-4 max-h-[560px] overflow-auto pr-1">
            {procedimientos.length === 0 && (
              <p className="text-sm text-slate-500 py-10 text-center">No hay procedimientos registrados en Firestore.</p>
            )}
            {procedimientosPorCategoria.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                  {group.label} ({group.items.length})
                </div>
                {group.items.length === 0 && (
                  <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">Sin registros en esta categoria.</p>
                )}
                {group.items.map((item) => (
                  <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-lg p-3 flex items-start justify-between gap-3 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-white'}`}>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{item.nombre}</div>
                      <div className="text-xs text-slate-500">
                        {item.clave || 'Sin clave'} • {getProcedureCategoryLabel(item.categoria)}
                      </div>
                      {item.descripcion && (
                        <div className="text-xs text-slate-500 mt-1">{item.descripcion}</div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          <Clock size={11} /> {item.duracionMin || 20} min
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${item.requiereConsentimiento ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {item.requiereConsentimiento ? 'Consentimiento requerido' : 'Sin consentimiento'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditProcedimiento(item)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActivo('catalogo_procedimientos', item.id, item.activo !== false)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
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
        <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-800">Catalogo de estudios</h2>
              {editingEstudioId && (
                <button
                  type="button"
                  onClick={resetEstudioForm}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Alta, edicion y activacion de catalogos de estudios. En consulta se muestran sin precio.
            </p>

            <form onSubmit={saveEstudio} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Clave"
                  value={estudioForm.clave}
                  onChange={(e) => setEstudioForm({ ...estudioForm, clave: e.target.value })}
                />
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={estudioForm.categoria}
                  onChange={(e) => setEstudioForm({ ...estudioForm, categoria: e.target.value })}
                >
                  {STUDY_CATEGORY_OPTIONS.map((option, index) => (
                    <option key={option.id} value={option.id}>{index + 1}. {option.label}</option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500">
                Si seleccionas Paquetes, aparecera para todos en Expediente Clinico &gt; Estudios &gt; Paquetes.
              </p>

              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Descripcion del servicio de estudio *"
                value={estudioForm.descripcion}
                onChange={(e) => setEstudioForm({ ...estudioForm, descripcion: e.target.value })}
              />

              {normalizeStudyCategory(estudioForm.categoria) === 'paquete' && (
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <p className="text-xs font-bold text-slate-700 mb-2">Laboratorios individuales que componen el paquete</p>
                  <div className="max-h-36 overflow-auto space-y-1.5">
                    {estudiosBaseParaPaquete.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={estudioForm.componentesIds.includes(item.id)}
                          onChange={() => toggleComponentePaquete(item.id)}
                        />
                        <span>{item.descripcion}</span>
                        {item.clave && <span className="text-slate-400">({item.clave})</span>}
                      </label>
                    ))}
                    {estudiosBaseParaPaquete.length === 0 && (
                      <p className="text-xs text-slate-400">No hay laboratorios individuales activos para agregar.</p>
                    )}
                  </div>
                </div>
              )}

              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                type="number"
                min="0"
                step="0.01"
                placeholder="Precio (solo visible en admin)"
                value={estudioForm.precio}
                onChange={(e) => setEstudioForm({ ...estudioForm, precio: e.target.value })}
              />

              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={estudioForm.activo !== false}
                  onChange={(e) => setEstudioForm({ ...estudioForm, activo: e.target.checked })}
                />
                Registro activo
              </label>

              <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                {editingEstudioId ? <Save size={14} /> : <Plus size={14} />}
                {editingEstudioId ? 'Guardar cambios' : 'Agregar registro'}
              </button>
            </form>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] text-slate-500 mb-2">
                Base detectada en `public/data/estudios.json`: {legacyEstudios.length} registros
              </p>
              <button
                type="button"
                onClick={importBaseEstudios}
                disabled={importandoEstudios || legacyEstudios.length === 0}
                className="w-full bg-slate-800 disabled:bg-slate-300 text-white rounded-lg py-2 text-sm font-bold"
              >
                {importandoEstudios ? 'Importando...' : 'Importar base de estudios'}
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[560px] overflow-auto pr-1">
            {estudios.length === 0 && (
              <p className="text-sm text-slate-500 py-10 text-center">No hay estudios registrados en Firestore.</p>
            )}
            {estudiosPorCategoria.map((group, groupIndex) => (
              <div key={group.id} className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                  {groupIndex + 1}. {group.label} ({group.items.length})
                </div>
                {group.items.length === 0 && (
                  <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">Sin registros en esta categoria.</p>
                )}
                {group.items.map((item) => (
                  <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-lg p-3 flex items-start justify-between gap-3 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-white'}`}>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{item.descripcion}</div>
                      <div className="text-xs text-slate-500">
                        {item.clave || 'Sin clave'} • {getStudyCategoryLabel(item.categoria)}
                      </div>
                      {normalizeStudyCategory(item.categoria) === 'paquete' && (
                        <div className="text-xs text-indigo-600 mt-1">
                          Incluye: {item.componentes?.length || 0} estudio(s)
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-1">Precio admin: {formatMXN(item.precio || 0)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditEstudio(item)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        onClick={() => toggleActivo('catalogo_estudios', item.id, item.activo !== false)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
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
        <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-800">Referencias Médicas</h2>
              {editingReferenciaMedicaId && (
                <button type="button" onClick={resetReferenciaMedicaForm} className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                  <X size={14} /> Cancelar edición
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">Alta de médicos y consultorios de referencia para derivación de pacientes.</p>

            <form onSubmit={saveReferenciaMedica} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.16em] block mb-1">Especialidad *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej. Cardiología"
                  value={referenciaMedicaForm.especialidad}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, especialidad: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.16em] block mb-1">Tipo de cita</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={referenciaMedicaForm.tipoCita}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, tipoCita: e.target.value })}
                >
                  {TIPO_CITA_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.16em] block mb-1">Nombre del médico *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej. Dr. Juan Pérez"
                  value={referenciaMedicaForm.nombreMedico}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, nombreMedico: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.16em] block mb-1">Teléfono</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Ej. 55-1234-5678"
                    value={referenciaMedicaForm.telefonoConsultorio}
                    onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, telefonoConsultorio: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.16em] block mb-1">Dirección</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Ej. Av. Reforma 123"
                    value={referenciaMedicaForm.direccionConsultorio}
                    onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, direccionConsultorio: e.target.value })}
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={referenciaMedicaForm.activo}
                  onChange={(e) => setReferenciaMedicaForm({ ...referenciaMedicaForm, activo: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-slate-700">Activo</span>
              </label>

              <button className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
                {editingReferenciaMedicaId ? <Save size={14} /> : <Plus size={14} />}
                {editingReferenciaMedicaId ? 'Guardar cambios' : 'Agregar referencia'}
              </button>
            </form>

            <p className="mt-3 text-[11px] text-slate-400">
              {referenciasMedicas.filter(r => r.activo !== false).length} referencia(s) activa(s) de {referenciasMedicas.length} total(es)
            </p>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {referenciasMedicas.length === 0 && (
              <p className="text-sm text-slate-500 py-10 text-center">No hay referencias médicas registradas.</p>
            )}
            {referenciasMedicas.map((item) => (
              <div id={"catalog-item-" + item.id} key={item.id} className={`border rounded-xl p-3.5 space-y-2 transition-all duration-300 ${targetHighlightId === item.id ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-400/20 shadow-sm scale-[1.01]' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{item.nombreMedico}</span>
                    </div>
                    <p className="text-xs text-slate-500">{item.especialidad} • {getTipoCitaLabel(item.tipoCita)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => startEditReferenciaMedica(item)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                      <Pencil size={12} /> Editar
                    </button>
                    <button
                      onClick={() => toggleActivo('catalogo_referencias_medicas', item.id, item.activo !== false)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {item.activo === false ? 'Inactivo' : 'Activo'}
                    </button>
                  </div>
                </div>

                {(item.telefonoConsultorio || item.direccionConsultorio) && (
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                    {item.telefonoConsultorio && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
                        <Phone size={10} /> {item.telefonoConsultorio}
                      </span>
                    )}
                    {item.direccionConsultorio && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
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
        const colorPalette = isEnfermeria ? { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600', btn: 'bg-violet-600 hover:bg-violet-700' } : { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', btn: 'bg-sky-600 hover:bg-sky-700' };
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
          <section className="space-y-5">
            {/* Sub-tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setCapacitacionSubTab('enfermeria')}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${isEnfermeria ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                Enfermería
              </button>
              <button
                onClick={() => setCapacitacionSubTab('medicos')}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${!isEnfermeria ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                Médicos
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className={colorPalette.text} />
                {editingId ? 'Editar documento' : `Nuevo documento de capacitación — ${label}`}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Título *</label>
                  <input value={form.titulo} onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Protocolo de Triage" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                  <select value={form.categoria} onChange={(e) => setForm(p => ({ ...p, categoria: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none bg-white">
                    <option value="">General</option>
                    {CATEGORIAS_CAP.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción breve</label>
                <input value={form.descripcion} onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción corta del documento" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contenido de texto (para IA)</label>
                <textarea value={form.contenido} onChange={(e) => setForm(p => ({ ...p, contenido: e.target.value }))} placeholder="Pega aquí el contenido del documento... La IA usará este texto para responder preguntas." rows={8} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none resize-y" />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Archivo (opcional)</label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-sm text-slate-600">{file ? file.name : 'Seleccionar archivo'}</span>
                    <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Orden</label>
                  <input type="number" value={form.orden} onChange={(e) => setForm(p => ({ ...p, orden: e.target.value }))} className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none" />
                </div>
                <div className="flex gap-2 ml-auto">
                  {editingId && (
                    <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                  )}
                  <button onClick={saveCap} disabled={uploading} className={`px-4 py-2 rounded-lg disabled:bg-slate-300 text-white text-sm font-bold flex items-center gap-2 transition-colors ${colorPalette.btn}`}>
                    {uploading ? <><span className="animate-spin">⏳</span> Guardando...</> : <><Save size={14} /> {editingId ? 'Actualizar' : 'Guardar'}</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de documentos */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-600">{docs.length} documento{docs.length !== 1 ? 's' : ''} registrado{docs.length !== 1 ? 's' : ''} — {label}</h3>
              {docs.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <BookOpen size={40} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No hay documentos de capacitación para {label.toLowerCase()}. Agrega el primero.</p>
                </div>
              ) : docs.map(item => (
                <div key={item.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${item.activo === false ? 'border-slate-200 opacity-50' : 'border-slate-200'}`}>
                  <div className={`w-10 h-10 rounded-lg ${colorPalette.bg} ${colorPalette.border} border flex items-center justify-center shrink-0`}>
                    <FileText size={18} className={colorPalette.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800 truncate">{item.titulo}</h4>
                      {item.categoria && <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ${colorPalette.bg} ${colorPalette.border} border ${colorPalette.text} rounded-md`}>{item.categoria}</span>}
                      {item.archivoNombre && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md">📎 {item.archivoNombre}</span>}
                    </div>
                    {item.descripcion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.descripcion}</p>}
                    {item.contenido && <p className="text-[10px] text-slate-400 mt-1">📝 {item.contenido.length} caracteres de contenido para IA</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(item)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1"><Pencil size={12} /> Editar</button>
                    <button
                      onClick={() => askConfirm(`¿Desactivar "${item.titulo}"?`, async () => {
                        await updateDoc(doc(db, collectionName, item.id), { activo: !(item.activo !== false) });
                        showPill(item.activo !== false ? 'Documento desactivado' : 'Documento activado', 'success');
                      })}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {item.activo === false ? 'Inactivo' : 'Activo'}
                    </button>
                    <button
                      onClick={() => askConfirm(`¿Eliminar "${item.titulo}" permanentemente?`, async () => {
                        await deleteDoc(doc(db, collectionName, item.id));
                        showPill('Documento eliminado', 'success');
                      })}
                      className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 inline-flex items-center gap-1"
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
