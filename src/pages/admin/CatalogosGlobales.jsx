import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Stethoscope, Tags, MapPin, GraduationCap, FlaskConical, Pencil, Save, X, Activity, Trash2 } from 'lucide-react';
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { loadStudiesFromPublicData, normalizeStudyRecord } from '../../services/studyCatalogService';

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

const is24hSchedule = (horaInicio = '', horaFin = '', diasAtencion = []) => {
  if ((horaInicio || '') !== '00:00') return false;
  if ((horaFin || '') !== '23:59') return false;
  return DIAS_SEMANA.every((dia) => diasAtencion.includes(dia));
};

const CATEGORIAS_SINTOMAS = [
  { id: 'generales', label: 'Generales', color: 'bg-slate-500' },
  { id: 'respiratorios', label: 'Respiratorios', color: 'bg-sky-500' },
  { id: 'abdominales', label: 'Abdominales', color: 'bg-amber-500' },
  { id: 'urinarios', label: 'Urinarios', color: 'bg-violet-500' },
  { id: 'neurologicos', label: 'Neurológicos', color: 'bg-rose-500' },
];

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
  const [estudios, setEstudios] = useState([]);
  const [legacyEstudios, setLegacyEstudios] = useState([]);
  const [estudioForm, setEstudioForm] = useState({
    clave: '',
    descripcion: '',
    precio: '',
    categoria: 'estudio',
    componentesIds: [],
    activo: true
  });
  const [editingEstudioId, setEditingEstudioId] = useState(null);
  const [importandoEstudios, setImportandoEstudios] = useState(false);

  const [motivoForm, setMotivoForm] = useState({
    nombre: '',
    precio: '',
    area: '',
    duracionMin: '20',
    precioMin: '',
    precioMax: '',
    teleconsultaPermitida: true,
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
  const [activeTab, setActiveTab] = useState('motivos');

  const sucursalesActivas = useMemo(
    () => sucursales.filter((item) => item.activo !== false && item.nombre),
    [sucursales]
  );

  const resumenCatalogos = useMemo(() => ({
    motivos: { total: motivos.length, activos: motivos.filter((item) => item.activo !== false).length },
    consultorios: { total: consultorios.length, activos: consultorios.filter((item) => item.activo !== false).length },
    sucursales: { total: sucursales.length, activos: sucursales.filter((item) => item.activo !== false).length },
    especialidades: { total: especialidades.length, activos: especialidades.filter((item) => item.activo !== false).length },
    sintomatologia: { total: sintomatologia.length, activos: sintomatologia.filter((item) => item.activo !== false).length },
    estudios: { total: estudios.length, activos: estudios.filter((item) => item.activo !== false).length },
  }), [motivos, consultorios, sucursales, especialidades, sintomatologia, estudios]);

  const formatMXN = (value) => Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  const toNumberSafe = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };


  useEffect(() => {
    let isMounted = true;

    const loadCatalogos = async () => {
      try {
        const [motivosSnap, consultoriosSnap, sucursalesSnap, especialidadesSnap, sintomatologiaSnap, estudiosSnap] = await Promise.all([
          getDocs(query(collection(db, 'catalogo_motivos_consulta'), orderBy('nombre', 'asc'))),
          getDocs(query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc'))),
          getDocs(query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc'))),
          getDocs(query(collection(db, 'catalogo_especialidades'), orderBy('nombre', 'asc'))),
          getDocs(query(collection(db, 'catalogo_sintomatologia'), orderBy('nombre', 'asc'))),
          getDocs(collection(db, 'catalogo_estudios'))
        ]);

        if (!isMounted) return;
        setMotivos(motivosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setConsultorios(consultoriosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSucursales(sucursalesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEspecialidades(especialidadesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSintomatologia(sintomatologiaSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const rows = estudiosSnap.docs
          .map((d) => normalizeStudyRecord({ id: d.id, ...d.data() }, d.id))
          .filter((item) => item.descripcion)
          .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
        setEstudios(rows);
      } catch (error) {
        console.error('Error cargando catalogos globales', error);
      }
    };

    loadCatalogos();
    const intervalId = setInterval(loadCatalogos, 1800000);

    loadStudiesFromPublicData().then(setLegacyEstudios).catch((error) => {
      console.error('Error cargando estudios base', error);
      setLegacyEstudios([]);
    });

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const resetEstudioForm = () => {
    setEditingEstudioId(null);
    setEstudioForm({ clave: '', descripcion: '', precio: '', categoria: 'estudio', componentesIds: [], activo: true });
  };

  const estudiosBaseParaPaquete = useMemo(
    () => estudios.filter((item) => item.categoria !== 'paquete' && item.activo !== false),
    [estudios]
  );

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
      categoria: item.categoria === 'paquete' ? 'paquete' : 'estudio',
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
    const categoriaNormalizada = estudioForm.categoria === 'paquete' ? 'paquete' : 'estudio';
    const existeDuplicado = estudios.some((item) => (
      item.id !== editingEstudioId
      && String(item.descripcion || '').trim().toLowerCase() === descripcionLower
      && (item.categoria === 'paquete' ? 'paquete' : 'estudio') === categoriaNormalizada
    ));
    if (existeDuplicado) {
      alert(`Ya existe un ${categoriaNormalizada} con ese nombre.`);
      return;
    }

    const precio = Number.parseFloat(String(estudioForm.precio || '0').replace(/[^\d.-]/g, ''));
    const componentes = estudioForm.categoria === 'paquete'
      ? estudiosBaseParaPaquete
          .filter((item) => estudioForm.componentesIds.includes(item.id))
          .map((item) => ({ id: item.id, clave: item.clave || '', descripcion: item.descripcion }))
      : [];

    if (estudioForm.categoria === 'paquete' && componentes.length === 0) {
      alert('Selecciona al menos un estudio para crear el paquete.');
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
          categoria: item.categoria === 'paquete' ? 'paquete' : 'estudio',
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
    const horaInicio = horarioTipo === '24h' ? '00:00' : (consultorioForm.horaInicio || '08:00');
    const horaFin = horarioTipo === '24h' ? '23:59' : (consultorioForm.horaFin || '18:00');
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
      await updateDoc(doc(db, 'catalogo_consultorios', editingConsultorioId), payload);
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
      horaInicio: item.horaInicio || '08:00',
      horaFin: item.horaFin || '18:00',
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
    const payload = {
      nombre: sucursalForm.nombre.trim(),
      ubicacion: sucursalForm.ubicacion.trim(),
      telefono: sucursalForm.telefono.trim() || '',
      responsable: sucursalForm.responsable.trim() || '',
      horaApertura: sucursalForm.horaApertura || '08:00',
      horaCierre: sucursalForm.horaCierre || '20:00',
      timezone: sucursalForm.timezone || 'America/Mexico_City',
      diasOperacion: Array.isArray(sucursalForm.diasOperacion) && sucursalForm.diasOperacion.length > 0
        ? sucursalForm.diasOperacion
        : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || 'sistema'
    };

    if (editingSucursalId) {
      await updateDoc(doc(db, 'catalogo_sucursales', editingSucursalId), payload);
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
      horaApertura: '08:00',
      horaCierre: '20:00',
      timezone: 'America/Mexico_City',
      diasOperacion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    });
  };

  const startEditSucursal = (item) => {
    setEditingSucursalId(item.id);
    setSucursalForm({
      nombre: item.nombre || '',
      ubicacion: item.ubicacion || '',
      telefono: item.telefono || '',
      responsable: item.responsable || '',
      horaApertura: item.horaApertura || '08:00',
      horaCierre: item.horaCierre || '20:00',
      timezone: item.timezone || 'America/Mexico_City',
      diasOperacion: Array.isArray(item.diasOperacion) && item.diasOperacion.length > 0
        ? item.diasOperacion
        : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    });
  };

  const resetSucursalForm = () => {
    setEditingSucursalId(null);
    setSucursalForm({
      nombre: '',
      ubicacion: '',
      telefono: '',
      responsable: '',
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
    if (yaExiste) { alert('Ya existe una especialidad con ese nombre.'); return; }

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

  const crearSintomatologia = async (e) => {
    e.preventDefault();
    const nombre = sintomatologiaNombre.trim();
    if (!nombre) return;
    const yaExiste = sintomatologia.some((s) => s.id !== editingSintomatologiaId && s.nombre.toLowerCase() === nombre.toLowerCase());
    if (yaExiste) { alert('Ya existe un síntoma con ese nombre.'); return; }

    if (editingSintomatologiaId) {
      await updateDoc(doc(db, 'catalogo_sintomatologia', editingSintomatologiaId), {
        nombre,
        categoria: sintomatologiaCategoria,
        actualizadoAt: serverTimestamp(),
        actualizadoPor: user?.uid || 'sistema'
      });
      setEditingSintomatologiaId(null);
    } else {
      await addDoc(collection(db, 'catalogo_sintomatologia'), {
        nombre,
        categoria: sintomatologiaCategoria,
        activo: true,
        creadoPor: user?.uid || 'sistema',
        creadoAt: serverTimestamp()
      });
    }

    setSintomatologiaNombre('');
    setSintomatologiaCategoria('generales');
  };

  const startEditSintomatologia = (item) => {
    setEditingSintomatologiaId(item.id);
    setSintomatologiaNombre(item.nombre || '');
    setSintomatologiaCategoria(item.categoria || 'generales');
  };

  const resetSintomatologiaForm = () => {
    setEditingSintomatologiaId(null);
    setSintomatologiaNombre('');
    setSintomatologiaCategoria('generales');
  };

  const eliminarSintomatologia = async (id) => {
    if (!window.confirm('¿Eliminar este síntoma permanentemente?')) return;
    await deleteDoc(doc(db, 'catalogo_sintomatologia', id));
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
    { id: 'estudios', label: 'Estudios', icon: <FlaskConical size={16} /> }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto pb-16 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>Catálogos Globales</h1>
          <p className="text-slate-500 text-sm">Configuración maestra para agenda, consultorios y documentos clínicos.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Motivos', value: `${resumenCatalogos.motivos.activos}/${resumenCatalogos.motivos.total}` },
            { label: 'Consultorios', value: `${resumenCatalogos.consultorios.activos}/${resumenCatalogos.consultorios.total}` },
            { label: 'Sucursales', value: `${resumenCatalogos.sucursales.activos}/${resumenCatalogos.sucursales.total}` },
            { label: 'Especialidades', value: `${resumenCatalogos.especialidades.activos}/${resumenCatalogos.especialidades.total}` },
            { label: 'Sintomatología', value: `${resumenCatalogos.sintomatologia.activos}/${resumenCatalogos.sintomatologia.total}` },
            { label: 'Estudios', value: `${resumenCatalogos.estudios.activos}/${resumenCatalogos.estudios.total}` },
          ].map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-700">
              {item.label}: {item.value}
            </span>
          ))}
        </div>

        <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[9px] text-sm font-semibold transition-all"
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
                <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                  {editingMotivoId ? <Save size={14}/> : <Plus size={14}/>}
                  {editingMotivoId ? 'Guardar cambios' : 'Guardar motivo'}
                </button>
              </form>
            </div>
            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {motivos.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay motivos registrados.</p>}
              {motivos.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
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
                <button disabled={sucursalesActivas.length === 0} className="w-full bg-blue-600 disabled:bg-slate-300 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                  {editingConsultorioId ? <Save size={14}/> : <Plus size={14}/>}
                  {editingConsultorioId ? 'Guardar cambios' : 'Guardar consultorio'}
                </button>
              </form>
            </div>
            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {consultorios.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay consultorios registrados.</p>}
              {consultorios.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{item.nombre}</div>
                    <div className="text-xs text-slate-500">{item.especialidad || 'General'} • {item.ubicacion || 'Sin ubicación'}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Sucursal: {item.sucursal || 'No definida'} • {item.horarioTipo === '24h' || is24hSchedule(item.horaInicio, item.horaFin, item.diasAtencion || []) ? '24 horas' : `${item.horaInicio || '08:00'}-${item.horaFin || '18:00'}`}
                    </div>
                    <div className="text-xs text-slate-400">
                      Días: {(item.horarioTipo === '24h' || is24hSchedule(item.horaInicio, item.horaFin, item.diasAtencion || [])) ? 'lunes, martes, miercoles, jueves, viernes, sabado, domingo' : (item.diasAtencion || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => startEditConsultorio(item)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => toggleActivo('catalogo_consultorios', item.id, item.activo !== false)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{item.activo === false ? 'Inactivo' : 'Activo'}</button>
                  </div>
                </div>
              ))}
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
                <div className="grid grid-cols-2 gap-2">
                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="time" value={sucursalForm.horaApertura} onChange={(e) => setSucursalForm({ ...sucursalForm, horaApertura: e.target.value })} />
                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" type="time" value={sucursalForm.horaCierre} onChange={(e) => setSucursalForm({ ...sucursalForm, horaCierre: e.target.value })} />
                </div>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Zona horaria (IANA)" value={sucursalForm.timezone} onChange={(e) => setSucursalForm({ ...sucursalForm, timezone: e.target.value })} />
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
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
                <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                  {editingSucursalId ? <Save size={14}/> : <Plus size={14}/>}
                  {editingSucursalId ? 'Guardar cambios' : 'Guardar sucursal'}
                </button>
              </form>
            </div>
            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {sucursales.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay sucursales registradas.</p>}
              {sucursales.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800 inline-flex items-center gap-1"><MapPin size={13} /> {item.nombre}</div>
                    <div className="text-xs text-slate-500">{item.ubicacion || 'Sin ubicación'}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.telefono || 'Sin teléfono'} • {item.responsable || 'Sin responsable'}</div>
                    <div className="text-xs text-slate-400">Horario: {item.horaApertura || '08:00'}-{item.horaCierre || '20:00'} • {(item.diasOperacion || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']).join(', ')}</div>
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
                <div key={item.id} className="border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
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
                      className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
                        item.activo === false
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
          <section className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
            <div>
              <h2 className="text-sm font-black text-slate-800 mb-1">Sintomatología</h2>
              <p className="text-xs text-slate-500 mb-4">Síntomas agrupados por categoría que aparecen en la consulta del doctor.</p>
              {editingSintomatologiaId && (
                <button type="button" onClick={resetSintomatologiaForm} className="mb-3 text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                  <X size={14} /> Cancelar edición
                </button>
              )}
              <form onSubmit={crearSintomatologia} className="space-y-3">
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nombre del síntoma" value={sintomatologiaNombre} onChange={(e) => setSintomatologiaNombre(e.target.value)} />
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 block">Categoría</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIAS_SINTOMAS.map((cat) => (
                      <button key={cat.id} type="button" onClick={() => setSintomatologiaCategoria(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          sintomatologiaCategoria === cat.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                        }`}>
                        <span className={`inline-block w-2 h-2 rounded-full ${cat.color} mr-1.5`}></span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                  {editingSintomatologiaId ? <Save size={14}/> : <Plus size={14}/>}
                  {editingSintomatologiaId ? 'Guardar cambios' : 'Agregar síntoma'}
                </button>
              </form>
            </div>
            <div className="space-y-4 max-h-[560px] overflow-auto pr-1">
              {sintomatologia.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">No hay síntomas registrados.</p>}
              {CATEGORIAS_SINTOMAS.map((cat) => {
                const items = sintomatologia.filter((s) => (s.categoria || 'generales') === cat.id);
                if (items.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`}></span>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{cat.label}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{items.length}</span>
                    </div>
                    <div className="space-y-1.5 ml-4">
                      {items.map((item) => (
                        <div key={item.id} className="border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-3 bg-white">
                          <span className="text-sm font-semibold text-slate-800">{item.nombre}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={() => startEditSintomatologia(item)} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                              <Pencil size={11} /> Editar
                            </button>
                            <button onClick={() => toggleActivo('catalogo_sintomatologia', item.id, item.activo !== false)} className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.activo === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{item.activo === false ? 'Inactivo' : 'Activo'}</button>
                            <button onClick={() => eliminarSintomatologia(item.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Eliminar">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
                Alta, edicion y activacion de estudios. En consulta se muestran sin precio.
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
                    <option value="estudio">Estudio individual</option>
                    <option value="paquete">Paquete</option>
                  </select>
                </div>

                <p className="text-[11px] text-slate-500">
                  Si seleccionas `Paquete`, aparecera para todos en Expediente Clinico &gt; Estudios &gt; Paquetes Lab.
                </p>

                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Descripcion del estudio *"
                  value={estudioForm.descripcion}
                  onChange={(e) => setEstudioForm({ ...estudioForm, descripcion: e.target.value })}
                />

                {estudioForm.categoria === 'paquete' && (
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <p className="text-xs font-bold text-slate-700 mb-2">Estudios que componen el paquete</p>
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
                        <p className="text-xs text-slate-400">No hay estudios individuales activos para agregar.</p>
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
                  Estudio activo
                </label>

                <button className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold inline-flex items-center justify-center gap-2">
                  {editingEstudioId ? <Save size={14} /> : <Plus size={14} />}
                  {editingEstudioId ? 'Guardar cambios' : 'Agregar estudio'}
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

            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {estudios.length === 0 && (
                <p className="text-sm text-slate-500 py-10 text-center">No hay estudios registrados en Firestore.</p>
              )}
              {estudios.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{item.descripcion}</div>
                    <div className="text-xs text-slate-500">
                      {item.clave || 'Sin clave'} • {item.categoria === 'paquete' ? 'Paquete' : 'Estudio'}
                    </div>
                    {item.categoria === 'paquete' && (
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
          </section>
        )}

    </div>
  );
};

export default CatalogosGlobales;
