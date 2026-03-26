import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Trash2, MapPin, Search, ShieldCheck, Table2, FilterX, Clock3, Users, Activity, WifiOff, Stethoscope, Shield, Key, RefreshCw, User, Mail, Lock, Edit } from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, addDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, deleteUser } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyCIPnSQkdWm6YgdYlIZ8G5V4wu-oTFFTfg',
  authDomain: 'srs-feacb.firebaseapp.com',
  projectId: 'srs-feacb',
  storageBucket: 'srs-feacb.firebasestorage.app',
  messagingSenderId: '568441727812',
  appId: '1:568441727812:web:ddc7f3ab84e2a5ab440511'
};

let secondaryApp;
if (getApps().some((app) => app.name === 'Secondary')) {
  secondaryApp = getApp('Secondary');
} else {
  secondaryApp = initializeApp(firebaseConfig, 'Secondary');
}

const secondaryAuth = getAuth(secondaryApp);

const ROLE_OPTIONS = [
  { value: 'medico', label: 'Médico', helper: 'Consulta médica y expediente clínico completo' },
  { value: 'enfermeria', label: 'Enfermería', helper: 'Triage, hoja de enfermería y seguimiento de pacientes' },
  { value: 'jefa_enfermeria', label: 'Jefa Enfermería', helper: 'Supervisión y auditoría del área de enfermería' },
  { value: 'intendencia', label: 'Intendencia', helper: 'Bitácoras de limpieza y operaciones internas' },
  { value: 'rh', label: 'RH', helper: 'Auditoría de personal, finanzas e inventario' },
  { value: 'admin', label: 'Admin', helper: 'Gestión central, catálogos y configuración del sistema' },
  { value: 'operativo', label: 'Operativo', helper: 'Apoyo administrativo interno general' },
  { value: 'recepcion', label: 'Recepción', helper: 'Admisión de pacientes y agenda general' }
];

const ROLE_COLORS = {
  medico:          { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',    avatar: 'bg-blue-100'   },
  enfermeria:      { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500',    avatar: 'bg-teal-100'   },
  jefa_enfermeria: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500',  avatar: 'bg-indigo-100' },
  admin:           { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500',  avatar: 'bg-purple-100' },
  rh:              { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-400',  avatar: 'bg-orange-100' },
  intendencia:     { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400',   avatar: 'bg-slate-200'  },
  recepcion:       { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500',    avatar: 'bg-cyan-100'   },
  operativo:       { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   avatar: 'bg-amber-100'  },
};

const PERMISSION_GROUPS = [
  {
    key: 'admin',
    label: 'Administracion',
    items: [
      { id: 'admin.dashboard', label: 'Dashboard admin' },
      { id: 'admin.usuarios', label: 'Gestion de usuarios' },
      { id: 'admin.catalogos', label: 'Catalogos globales' },
      { id: 'admin.plantillas', label: 'Plantillas de documentos' },
      { id: 'admin.reportes', label: 'Reportes' },
      { id: 'admin.monitor', label: 'Monitor de actividad' }
    ]
  },
  {
    key: 'doctor',
    label: 'Medico',
    items: [
      { id: 'doctor.agenda', label: 'Agenda medica' },
      { id: 'doctor.expediente', label: 'Expediente clinico' },
    ]
  },
  {
    key: 'enfermeria',
    label: 'Enfermeria',
    items: [
      { id: 'enfermeria.dashboard', label: 'Agenda enfermeria' },
      { id: 'enfermeria.triage', label: 'Triage' },
      { id: 'enfermeria.hoja', label: 'Hoja de enfermeria' },
      { id: 'enfermeria.jefatura', label: 'Panel jefatura' }
    ]
  },
  {
    key: 'rh',
    label: 'Recursos Humanos',
    items: [
      { id: 'rh.dashboard', label: 'Dashboard RH' },
      { id: 'rh.auditoria', label: 'Auditoria empleados' },
      { id: 'rh.inventario', label: 'Inventario macro' },
      { id: 'rh.finanzas', label: 'Finanzas RH' }
    ]
  },
  {
    key: 'intendencia',
    label: 'Intendencia',
    items: [
      { id: 'intendencia.registro', label: 'Registro de limpieza' }
    ]
  },
  {
    key: 'shared',
    label: 'Compartido',
    items: [
      { id: 'shared.agenda', label: 'Agenda general' },
      { id: 'shared.pacientes', label: 'Pacientes' }
    ]
  }
];

const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.id));

const roleLabel = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label || role || 'Sin rol';

const buildPermissionMap = (enabledIds = []) => {
  const set = new Set(enabledIds);
  return ALL_PERMISSION_IDS.reduce((acc, id) => {
    acc[id] = set.has(id);
    return acc;
  }, {});
};

const defaultPermissionIdsByRole = (role) => {
  switch (role) {
    case 'admin':
      return [
        'admin.dashboard',
        'admin.usuarios',
        'admin.catalogos',
        'admin.plantillas',
        'admin.reportes',
        'admin.monitor',
        'shared.agenda',
        'shared.pacientes'
      ];
    case 'medico':
      return ['doctor.agenda', 'doctor.expediente', 'doctor.notaRapida', 'shared.agenda', 'shared.pacientes'];
    case 'enfermeria':
      return ['enfermeria.dashboard', 'enfermeria.triage', 'enfermeria.hoja', 'shared.agenda', 'shared.pacientes'];
    case 'jefa_enfermeria':
      return ['enfermeria.jefatura', 'enfermeria.dashboard', 'shared.agenda'];
    case 'rh':
      return ['rh.dashboard', 'rh.auditoria', 'rh.inventario', 'rh.finanzas'];
    case 'intendencia':
      return ['intendencia.registro'];
    case 'recepcion':
      return ['shared.agenda', 'shared.pacientes'];
    default:
      return ['shared.agenda'];
  }
};

const CLINICAL_ROLES = ['medico', 'enfermeria', 'jefa_enfermeria'];

const buildInitialForm = () => ({
  rol: 'medico',
  nombre: '',
  apellidos: '',
  sexo: 'Femenino',
  fechaNacimiento: '',
  especialidad: 'Medicina General',
  universidadEgreso: '',
  cargo: '',
  asignacionRecurrente: '',
  cedula: '',
  email: '',
  telefonoMovil: '',
  telefonoFijo: '',
  direccion: '',
  password: '',
  confirmPassword: '',
  permissions: buildPermissionMap(defaultPermissionIdsByRole('medico'))
});

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('tabla');
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('online');

  const [consultoriosCatalogo, setConsultoriosCatalogo] = useState([]);
  const [sucursalesCatalogo, setSucursalesCatalogo] = useState([]);
  const [especialidadesCatalogo, setEspecialidadesCatalogo] = useState([]);

  const [formData, setFormData] = useState(buildInitialForm());
  const [editingUserId, setEditingUserId] = useState(null);
  const isMedicoRole = formData.rol === 'medico';
  const isAdminRole = formData.rol === 'admin';
  const isMedicoLikeRole = isMedicoRole; // solo médico usa consultorios
  const isClinicalRole = CLINICAL_ROLES.includes(formData.rol);
  const isClinicalNonMedico = formData.rol === 'enfermeria' || formData.rol === 'jefa_enfermeria';

  const assignmentOptions = useMemo(() => {
    if (isMedicoRole) return consultoriosCatalogo;
    return sucursalesCatalogo;
  }, [consultoriosCatalogo, sucursalesCatalogo, isMedicoRole]);

  const enabledPermissionIds = useMemo(
    () => Object.entries(formData.permissions || {}).filter(([, v]) => !!v).map(([id]) => id),
    [formData.permissions]
  );

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsuarios(usersList);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
    setLoading(false);
  };

  const fetchCatalogos = async () => {
    try {
      const [consultoriosSnap, sucursalesSnap, especialidadesSnap] = await Promise.all([
        getDocs(collection(db, 'catalogo_consultorios')),
        getDocs(collection(db, 'catalogo_sucursales')),
        getDocs(collection(db, 'catalogo_especialidades'))
      ]);

      const consultorios = consultoriosSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.activo !== false && item.nombre)
        .map((item) => item.nombre)
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));

      const sucursales = sucursalesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.activo !== false && item.nombre)
        .map((item) => item.nombre)
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));

      const especialidades = especialidadesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.activo !== false && item.nombre)
        .map((item) => item.nombre)
        .sort((a, b) => String(a).localeCompare(String(b), 'es'));

      setConsultoriosCatalogo(consultorios);
      setSucursalesCatalogo(sucursales);
      setEspecialidadesCatalogo(especialidades);
    } catch (error) {
      console.error('Error cargando catalogos:', error);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchCatalogos();
    const interval = setInterval(fetchUsuarios, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (assignmentOptions.length === 0) {
      setFormData((prev) => ({ ...prev, asignacionRecurrente: '' }));
      return;
    }
    if (!assignmentOptions.includes(formData.asignacionRecurrente)) {
      setFormData((prev) => ({ ...prev, asignacionRecurrente: assignmentOptions[0] }));
    }
  }, [assignmentOptions, formData.asignacionRecurrente]);

  const isUserOnline = (userData) => {
    if (!userData.lastSeen) return false;
    const lastSeenDate = new Date(userData.lastSeen);
    const now = new Date();
    return (now - lastSeenDate) / 1000 / 60 < 10;
  };

  const formatLastSeen = (value) => {
    if (!value) return 'Sin actividad';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Sin actividad';
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Hace instantes';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    return `Hace ${diffD} d`;
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return usuarios
      .filter((user) => {
        if (roleFilter !== 'all' && user.rol !== roleFilter) return false;
        const online = isUserOnline(user);
        if (statusFilter === 'online' && !online) return false;
        if (statusFilter === 'offline' && online) return false;
        if (!term) return true;
        const haystack = [
          user.nombre,
          user.email,
          roleLabel(user.rol),
          user.consultorioRecurrente,
          user.areaRecurrente,
          user.sucursal,
          user.especialidad,
          user.cedulaProfesional
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        if (sortBy === 'online') {
          const onlineA = isUserOnline(a) ? 1 : 0;
          const onlineB = isUserOnline(b) ? 1 : 0;
          if (onlineA !== onlineB) return onlineB - onlineA;
        }
        if (sortBy === 'role') {
          const byRole = String(roleLabel(a.rol)).localeCompare(String(roleLabel(b.rol)), 'es');
          if (byRole !== 0) return byRole;
        }
        if (sortBy === 'recent') {
          const aSeen = new Date(a.lastSeen || 0).getTime();
          const bSeen = new Date(b.lastSeen || 0).getTime();
          if (aSeen !== bSeen) return bSeen - aSeen;
        }
        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
      });
  }, [usuarios, roleFilter, statusFilter, searchTerm, sortBy]);

  const stats = useMemo(() => {
    const total = usuarios.length;
    const online = usuarios.filter((u) => isUserOnline(u)).length;
    const offline = Math.max(total - online, 0);
    const medicos = usuarios.filter((u) => u.rol === 'medico').length;
    const admins = usuarios.filter((u) => ['admin', 'admin_maestro', 'administrador'].includes(u.rol)).length;
    const withCustomPermissions = usuarios.filter((u) => Object.keys(u.permissions || {}).length > 0).length;
    return { total, online, offline, medicos, admins, withCustomPermissions };
  }, [usuarios]);

  const roleCounts = useMemo(() => {
    const map = ROLE_OPTIONS.reduce((acc, r) => ({ ...acc, [r.value]: 0 }), {});
    usuarios.forEach((u) => {
      if (map[u.rol] !== undefined) map[u.rol] += 1;
    });
    return map;
  }, [usuarios]);

  const updateForm = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const resetUserForm = () => {
    setEditingUserId(null);
    setFormData(buildInitialForm());
  };

  const applyRoleDefaults = (roleValue) => {
    const defaults = buildPermissionMap(defaultPermissionIdsByRole(roleValue));
    const isClinical = CLINICAL_ROLES.includes(roleValue);
    setFormData((prev) => ({
      ...prev,
      rol: roleValue,
      permissions: defaults,
      especialidad: isClinical ? (roleValue === 'medico' ? (prev.especialidad || 'Medicina General') : prev.especialidad) : '',
      cedula: isClinical ? prev.cedula : '',
      universidadEgreso: isClinical ? prev.universidadEgreso : '',
      cargo: !isClinical ? prev.cargo : ''
    }));
  };

  const togglePermission = (permissionId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionId]: !prev.permissions?.[permissionId]
      }
    }));
  };

  const startEditUser = (user) => {
    const normalizedPermissions = buildPermissionMap(
      Array.isArray(user.permissionList) && user.permissionList.length > 0
        ? user.permissionList
        : Object.entries(user.permissions || {}).filter(([, v]) => !!v).map(([id]) => id)
    );

    const [nombres = '', ...resto] = String(user.nombre || '').trim().split(' ');
    const apellidosFallback = resto.join(' ').trim();

    setEditingUserId(user.id);
    setFormData({
      rol: user.rol || 'medico',
      nombre: user.nombres || nombres,
      apellidos: user.apellidos || apellidosFallback,
      sexo: user.sexo || 'Femenino',
      fechaNacimiento: user.fechaNacimiento || '',
      especialidad: user.especialidad || 'Medicina General',
      universidadEgreso: user.universidadEgreso || user.centroEstudios || '',
      cargo: user.cargo || '',
      asignacionRecurrente: user.consultorioRecurrente || user.areaRecurrente || user.sucursal || '',
      cedula: user.cedula || user.cedulaProfesional || '',
      email: user.email || '',
      telefonoMovil: user.telefonoMovil || '',
      telefonoFijo: user.telefonoFijo || '',
      direccion: user.direccion || '',
      password: '',
      confirmPassword: '',
      permissions: normalizedPermissions
    });
    setViewMode('alta');
  };

  const auditAction = async ({ action, targetUid, targetNombre, payload = {} }) => {
    try {
      await addDoc(collection(db, 'auditoria_admin_usuarios'), {
        action,
        targetUid,
        targetNombre,
        payload,
        actorUid: auth.currentUser?.uid || 'sistema',
        actorEmail: auth.currentUser?.email || 'sistema',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error guardando auditoria:', error);
    }
  };

  const validateForm = () => {
    const isEditing = !!editingUserId;
    const requiredCommon = [
      formData.rol,
      formData.nombre,
      formData.apellidos,
      formData.sexo,
      formData.fechaNacimiento,
      formData.email,
      formData.telefonoMovil,
      formData.asignacionRecurrente
    ];

    if (requiredCommon.some((v) => !String(v || '').trim())) {
      alert('Completa todos los campos obligatorios.');
      return false;
    }

    if (!isEditing || formData.password || formData.confirmPassword) {
      if (formData.password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres.');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        alert('Las contraseñas no coinciden.');
        return false;
      }
    }

    if (isMedicoRole) {
      if (!formData.especialidad || !formData.cedula) {
        alert('Para médico, la especialidad y la cédula profesional son obligatorias.');
        return false;
      }
      if (consultoriosCatalogo.length === 0) {
        alert('No hay consultorios activos. Agrégalos en Catálogos Globales.');
        return false;
      }
    }

    if (!isMedicoRole && sucursalesCatalogo.length === 0) {
      alert('No hay sucursales activas. Agrégalas en Catálogos Globales.');
      return false;
    }

    if (enabledPermissionIds.length === 0) {
      alert('Debes habilitar al menos un permiso.');
      return false;
    }

    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    let newUser = null;
    let userProvisioned = false;
    try {
      const isEditing = !!editingUserId;
      const normalizedEmail = formData.email.trim().toLowerCase();
      const nombreCompleto = `${formData.nombre} ${formData.apellidos}`.trim();

      const editableData = {
        nombre: nombreCompleto,
        nombres: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        email: normalizedEmail,
        rol: formData.rol,
        sexo: formData.sexo,
        fechaNacimiento: formData.fechaNacimiento,
        telefonoMovil: formData.telefonoMovil.trim(),
        telefonoFijo: formData.telefonoFijo.trim(),
        direccion: formData.direccion.trim(),
        permissions: formData.permissions,
        permissionList: enabledPermissionIds,
        actualizadoPor: auth.currentUser?.email || 'sistema',
        fechaActualizacion: new Date().toISOString(),
        especialidad: '',
        universidadEgreso: '',
        centroEstudios: '',
        cedula: '',
        cedulaProfesional: '',
        cargo: '',
        consultorioRecurrente: '',
        areaRecurrente: ''
      };

      if (isClinicalRole) {
        editableData.especialidad = formData.especialidad;
        editableData.universidadEgreso = formData.universidadEgreso.trim();
        editableData.centroEstudios = formData.universidadEgreso.trim();
        editableData.cedula = formData.cedula.trim();
        editableData.cedulaProfesional = formData.cedula.trim();
      } else {
        editableData.cargo = formData.cargo.trim();
      }

      if (isMedicoRole) {
        editableData.consultorioRecurrente = formData.asignacionRecurrente;
        editableData.sucursal = formData.asignacionRecurrente;
      } else {
        editableData.areaRecurrente = formData.asignacionRecurrente;
        editableData.sucursal = formData.asignacionRecurrente;
      }

      if (isEditing) {
        const userRef = doc(db, 'users', editingUserId);
        await updateDoc(userRef, editableData);

        await auditAction({
          action: 'edicion_usuario',
          targetUid: editingUserId,
          targetNombre: nombreCompleto,
          payload: {
            rol: formData.rol,
            asignacionRecurrente: formData.asignacionRecurrente,
            permissionList: enabledPermissionIds
          }
        });

        alert(`${roleLabel(formData.rol)} ${nombreCompleto} actualizado con exito.`);
        setViewMode('tabla');
        resetUserForm();
        fetchUsuarios();
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, formData.password);
      newUser = userCredential.user;

      const baseData = {
        uid: newUser.uid,
        nombre: nombreCompleto,
        nombres: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        email: normalizedEmail,
        rol: formData.rol,
        sexo: formData.sexo,
        fechaNacimiento: formData.fechaNacimiento,
        telefonoMovil: formData.telefonoMovil.trim(),
        telefonoFijo: formData.telefonoFijo.trim(),
        direccion: formData.direccion.trim(),
        permissions: formData.permissions,
        permissionList: enabledPermissionIds,
        creadoPor: auth.currentUser?.email || 'sistema',
        fechaCreacion: new Date().toISOString(),
        lastLogin: null,
        lastSeen: null,
        isOnline: false
      };

      if (isClinicalRole) {
        baseData.especialidad = formData.especialidad;
        baseData.universidadEgreso = formData.universidadEgreso.trim();
        baseData.centroEstudios = formData.universidadEgreso.trim();
        baseData.cedula = formData.cedula.trim();
        baseData.cedulaProfesional = formData.cedula.trim();
      } else {
        baseData.cargo = formData.cargo.trim();
      }

      if (isMedicoRole) {
        baseData.consultorioRecurrente = formData.asignacionRecurrente;
        baseData.sucursal = formData.asignacionRecurrente;
      } else {
        baseData.areaRecurrente = formData.asignacionRecurrente;
        baseData.sucursal = formData.asignacionRecurrente;
      }

      const userRef = doc(db, 'users', newUser.uid);
      await setDoc(userRef, baseData);

      const savedSnap = await getDoc(userRef);
      const savedData = savedSnap.exists() ? savedSnap.data() : null;
      const missingFields = [];
      if (!savedData) {
        missingFields.push('documento users/{uid}');
      } else {
        const requiredPersistedFields = [
          'uid',
          'nombre',
          'nombres',
          'apellidos',
          'email',
          'rol',
          'sexo',
          'fechaNacimiento',
          'telefonoMovil',
          'permissions',
          'permissionList',
          'sucursal'
        ];

        if (isMedicoRole) {
          requiredPersistedFields.push('especialidad', 'cedula', 'cedulaProfesional', 'universidadEgreso', 'centroEstudios');
        }

        if (isMedicoRole) {
          requiredPersistedFields.push('consultorioRecurrente');
        } else {
          requiredPersistedFields.push('areaRecurrente');
        }

        requiredPersistedFields.forEach((field) => {
          const value = savedData[field];
          if (field === 'permissions') {
            if (!value || typeof value !== 'object' || Object.keys(value).length === 0) missingFields.push(field);
            return;
          }
          if (field === 'permissionList') {
            if (!Array.isArray(value) || value.length === 0) missingFields.push(field);
            return;
          }
          if (value === undefined || value === null || String(value).trim() === '') {
            missingFields.push(field);
          }
        });

        if (savedData.email !== normalizedEmail) missingFields.push('email_mismatch');
        if (savedData.rol !== formData.rol) missingFields.push('rol_mismatch');
        if ((savedData.permissionList || []).length !== enabledPermissionIds.length) missingFields.push('permissionList_mismatch');
      }

      if (missingFields.length > 0) {
        throw new Error(`No se pudo validar el guardado en Firestore. Revisa: ${missingFields.join(', ')}`);
      }

      userProvisioned = true;

      await auditAction({
        action: 'alta_usuario',
        targetUid: newUser.uid,
        targetNombre: nombreCompleto,
        payload: {
          rol: formData.rol,
          asignacionRecurrente: formData.asignacionRecurrente,
          permissionList: enabledPermissionIds
        }
      });

      alert(`${roleLabel(formData.rol)} ${nombreCompleto} creado con exito.`);
      setViewMode('tabla');
      resetUserForm();
      fetchUsuarios();
    } catch (error) {
      if (newUser && !userProvisioned) {
        try {
          await deleteUser(newUser);
        } catch (cleanupError) {
          console.error('Error limpiando usuario de Auth tras fallo de Firestore:', cleanupError);
        }
      }
      alert(`Error creando usuario: ${error.message}`);
    } finally {
      try {
        if (secondaryAuth.currentUser) {
          await secondaryAuth.signOut();
        }
      } catch (signOutError) {
        console.error('Error cerrando sesion secundaria:', signOutError);
      }
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`¿Estas seguro de eliminar a ${user.nombre}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.id));
      await auditAction({
        action: 'baja_usuario',
        targetUid: user.uid || user.id,
        targetNombre: user.nombre || 'sin nombre',
        payload: { rol: user.rol || 'sin rol' }
      });
      fetchUsuarios();
    } catch (error) {
      alert(`Error al eliminar: ${error.message}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans pb-20 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
            <Users size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 leading-tight">Gestión de Usuarios</h1>
            <p className="text-slate-500 text-sm">Control de personal, permisos y actividad del sistema</p>
          </div>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setViewMode('tabla')}
            className={`px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-all ${viewMode === 'tabla' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Table2 size={16} /> Vista Tabla
          </button>
          <button
            onClick={() => setViewMode('alta')}
            className={`px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-all ${viewMode === 'alta' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <UserPlus size={16} /> Alta de Usuario
          </button>
        </div>
      </div>

      {/* ── Estadísticas compactas ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        <StatPill label="Total" value={stats.total} />
        <span className="w-px h-4 bg-slate-200" />
        <StatPill label="En línea" value={stats.online} color="text-emerald-600" />
        <StatPill label="Offline" value={stats.offline} color="text-slate-400" />
        <span className="w-px h-4 bg-slate-200" />
        <StatPill label="Médicos" value={stats.medicos} color="text-blue-600" />
        <StatPill label="Admins" value={stats.admins} color="text-purple-600" />
        <StatPill label="Con permisos" value={stats.withCustomPermissions} color="text-amber-600" />
      </div>

      {viewMode === 'alta' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4">

          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <UserPlus size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">{editingUserId ? 'Editar usuario' : 'Alta de usuario'}</h2>
                <p className="text-[11px] text-slate-400">Los campos con <span className="text-red-400 font-semibold">*</span> son obligatorios</p>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              {auth.currentUser?.email || 'sin sesión'}
            </div>
          </div>

          <form onSubmit={handleRegister}>

            {/* ── Selector de rol ── */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <SectionLabel>Rol del usuario *</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-3">
                {ROLE_OPTIONS.map((role) => {
                  const active = formData.rol === role.value;
                  const c = ROLE_COLORS[role.value];
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => applyRoleDefaults(role.value)}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        active
                          ? `${c?.bg ?? 'bg-blue-50'} ${c?.text ?? 'text-blue-700'} ${c?.border ?? 'border-blue-300'} shadow-sm`
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? (c?.dot ?? 'bg-blue-500') : 'bg-slate-300'}`} />
                      {role.label}
                    </button>
                  );
                })}
              </div>
              {formData.rol && (
                <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg inline-flex items-center gap-2 text-xs text-blue-600">
                  <ShieldCheck size={12} className="flex-shrink-0" />
                  {ROLE_OPTIONS.find(r => r.value === formData.rol)?.helper}
                </div>
              )}
            </div>

            {/* ── Cuerpo en 2 columnas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

              {/* Columna izquierda — Identidad + Perfil laboral */}
              <div className="px-6 py-5 space-y-5">
                <SectionLabel>Datos personales</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre *">
                    <input value={formData.nombre} onChange={(e) => updateForm('nombre', e.target.value)} required className={inputCls} placeholder="Ej. María" />
                  </Field>
                  <Field label="Apellidos *">
                    <input value={formData.apellidos} onChange={(e) => updateForm('apellidos', e.target.value)} required className={inputCls} placeholder="Ej. García López" />
                  </Field>
                  <Field label="Sexo *">
                    <select value={formData.sexo} onChange={(e) => updateForm('sexo', e.target.value)} className={inputCls}>
                      <option value="Femenino">Femenino</option>
                      <option value="Masculino">Masculino</option>
                    </select>
                  </Field>
                  <Field label="Fecha de nacimiento *">
                    <input type="date" value={formData.fechaNacimiento} onChange={(e) => updateForm('fechaNacimiento', e.target.value)} required className={inputCls} />
                  </Field>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <SectionLabel>Perfil laboral</SectionLabel>

                  {/* Especialidad — médico (requerida con select) */}
                  {isMedicoRole && (
                    <Field label="Especialidad *">
                      <select value={formData.especialidad} onChange={(e) => updateForm('especialidad', e.target.value)} className={inputCls}>
                        <option value="">Selecciona una especialidad…</option>
                        {especialidadesCatalogo.map((esp) => <option key={esp} value={esp}>{esp}</option>)}
                      </select>
                      {especialidadesCatalogo.length === 0 && (
                        <p className="mt-1 text-[11px] text-amber-600">⚠ Sin especialidades en catálogo. Agrégalas en <strong>Catálogos Globales</strong>.</p>
                      )}
                    </Field>
                  )}

                  {/* Área de especialidad — enfermería (opcional, texto libre) */}
                  {isClinicalNonMedico && (
                    <Field label="Área de especialidad" optional>
                      <input value={formData.especialidad} onChange={(e) => updateForm('especialidad', e.target.value)} className={inputCls} placeholder="Ej. Urgencias, Triage, UCI…" />
                    </Field>
                  )}

                  {/* Universidad — roles clínicos (siempre opcional) */}
                  {isClinicalRole && (
                    <Field label="Universidad / Institución de egreso" optional>
                      <input value={formData.universidadEgreso} onChange={(e) => updateForm('universidadEgreso', e.target.value)} className={inputCls} placeholder="Ej. UNAM, IPN, UANL…" />
                    </Field>
                  )}

                  {/* Cargo / Puesto — roles no clínicos (opcional) */}
                  {!isClinicalRole && (
                    <Field label="Cargo / Puesto" optional>
                      <input value={formData.cargo} onChange={(e) => updateForm('cargo', e.target.value)} className={inputCls} placeholder="Ej. Administrador, Recepcionista…" />
                    </Field>
                  )}

                  {/* Asignación recurrente */}
                  <Field label={isMedicoRole ? 'Consultorio recurrente *' : 'Sucursal / Área de trabajo *'}>
                    <select value={formData.asignacionRecurrente} onChange={(e) => updateForm('asignacionRecurrente', e.target.value)} className={inputCls}>
                      <option value="">Selecciona una opción…</option>
                      {assignmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    {assignmentOptions.length === 0 && (
                      <p className="mt-1 text-[11px] text-amber-600">⚠ No hay {isMedicoRole ? 'consultorios' : 'sucursales'} activos. Agrégalos en <strong>Catálogos Globales</strong>.</p>
                    )}
                  </Field>

                  {/* Cédula profesional — médico (requerida), enfermería (opcional) */}
                  {isClinicalRole && (
                    <Field label={isMedicoRole ? 'Cédula profesional *' : 'Cédula profesional'} optional={!isMedicoRole}>
                      <input value={formData.cedula} onChange={(e) => updateForm('cedula', e.target.value)} className={inputCls} placeholder="Ej. 12345678" />
                    </Field>
                  )}
                </div>
              </div>

              {/* Columna derecha — Contacto + Credenciales */}
              <div className="px-6 py-5 space-y-5">
                <SectionLabel>Información de contacto</SectionLabel>
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Correo electrónico *">
                    <div className="relative">
                      <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="email" value={formData.email} onChange={(e) => updateForm('email', e.target.value)} required readOnly={!!editingUserId} className={`${inputCls} pl-8 ${editingUserId ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`} placeholder="correo@clinica.mx" />
                      {editingUserId && (
                        <p className="mt-1 text-[11px] text-slate-400">El correo no se puede editar para evitar desincronización con Auth.</p>
                      )}
                    </div>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Teléfono móvil *">
                      <input type="tel" value={formData.telefonoMovil} onChange={(e) => updateForm('telefonoMovil', e.target.value)} required className={inputCls} placeholder="5512345678" />
                    </Field>
                    <Field label="Teléfono fijo" optional>
                      <input type="tel" value={formData.telefonoFijo} onChange={(e) => updateForm('telefonoFijo', e.target.value)} className={inputCls} placeholder="Ej. 5512345678" />
                    </Field>
                  </div>

                  <Field label="Dirección" optional>
                    <input value={formData.direccion} onChange={(e) => updateForm('direccion', e.target.value)} className={inputCls} placeholder="Calle, número, colonia" />
                  </Field>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div>
                    <SectionLabel>{editingUserId ? 'Cambiar contraseña' : 'Contraseña de acceso'}</SectionLabel>
                    {editingUserId && <p className="text-[11px] text-slate-400 mt-1">Deja en blanco para no modificar la contraseña actual.</p>}
                  </div>
                  <Field label={editingUserId ? 'Nueva contraseña' : 'Contraseña *'} optional={!!editingUserId}>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="password" minLength={6} value={formData.password} onChange={(e) => updateForm('password', e.target.value)} required={!editingUserId} className={`${inputCls} pl-8`} placeholder={editingUserId ? 'Deja vacío para no cambiar' : 'Mínimo 6 caracteres'} />
                    </div>
                  </Field>
                  <Field label={editingUserId ? 'Confirmar nueva contraseña' : 'Confirmar contraseña *'} optional={!!editingUserId}>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="password" minLength={6} value={formData.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} required={!editingUserId} className={`${inputCls} pl-8`} placeholder={editingUserId ? 'Solo si cambias contraseña' : 'Repite la contraseña'} />
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            {/* ── Permisos ── */}
            <div className="border-t border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <SectionLabel>Permisos del sistema</SectionLabel>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                    <Key size={8} /> {enabledPermissionIds.length} activos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, permissions: buildPermissionMap(defaultPermissionIdsByRole(prev.rol)) }))}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Restaurar por rol
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.key}>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">{group.label}</p>
                    <div className="space-y-1.5">
                      {group.items.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-900 select-none">
                          <input
                            type="checkbox"
                            checked={!!formData.permissions?.[perm.id]}
                            onChange={() => togglePermission(perm.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-400 w-3.5 h-3.5"
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setViewMode('tabla'); resetUserForm(); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-sm font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-semibold text-sm shadow-sm transition-all inline-flex items-center gap-2"
              >
                {saving ? <><RefreshCw size={13} className="animate-spin" /> Guardando…</> : editingUserId ? 'Guardar cambios' : `Crear ${roleLabel(formData.rol)}`}
              </button>
            </div>

          </form>
        </section>
      )}

      {viewMode === 'tabla' && (
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Barra de control */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Directorio de usuarios</h2>
              <p className="text-xs text-slate-400 mt-0.5">Filtra, busca y administra el acceso de cada persona</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Estado:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >Todos</button>
              <button
                onClick={() => setStatusFilter('online')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all inline-flex items-center gap-1 ${statusFilter === 'online' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              ><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Online</button>
              <button
                onClick={() => setStatusFilter('offline')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${statusFilter === 'offline' ? 'bg-slate-600 text-white border-slate-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >Offline</button>
            </div>
          </div>

          {/* Filtros por rol */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRoleFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition-all ${roleFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Todos los roles
            </button>
            {ROLE_OPTIONS.map((role) => {
              const active = roleFilter === role.value;
              const c = ROLE_COLORS[role.value];
              return (
                <button
                  key={role.value}
                  onClick={() => setRoleFilter(active ? 'all' : role.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition-all inline-flex items-center gap-1.5 ${active ? `${c?.bg ?? 'bg-blue-50'} ${c?.text ?? 'text-blue-700'} ${c?.border ?? 'border-blue-200'} shadow-sm` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? (c?.dot ?? 'bg-blue-500') : 'bg-slate-300'}`} />
                  {role.label}
                  <span className={`text-[10px] font-black ${active ? '' : 'text-slate-400'}`}>{roleCounts[role.value] || 0}</span>
                </button>
              );
            })}
          </div>

          {/* Búsqueda y ordenamiento */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 md:max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-blue-400 outline-none text-sm transition-all"
                placeholder="Buscar por nombre, correo, rol o asignación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-400">
                <option value="online">Online primero</option>
                <option value="recent">Actividad reciente</option>
                <option value="role">Por rol</option>
              </select>
              <button
                onClick={() => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); setSortBy('online'); }}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 text-sm inline-flex items-center gap-1.5 transition-all"
              >
                <FilterX size={14} /> Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Resumen de filtro activo */}
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 text-xs text-slate-500 font-medium flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-700">{filteredUsers.length}</span> resultado(s)
          {roleFilter !== 'all' && <><span className="text-slate-300">·</span><span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-semibold">{roleLabel(roleFilter)}</span></>}
          {statusFilter !== 'all' && <><span className="text-slate-300">·</span><span className={`rounded-full px-2 py-0.5 font-semibold border ${statusFilter === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{statusFilter === 'online' ? 'Online' : 'Offline'}</span></>}
          {searchTerm.trim() && <><span className="text-slate-300">·</span><span className="text-slate-600">"{searchTerm.trim()}"</span></>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-3 text-xs font-bold text-slate-400 uppercase w-12 text-center">#</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center w-24">Estado</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Usuario</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Rol</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Especialidad</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Asignación</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Última actividad</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Permisos</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-3"><div className="h-3 bg-slate-100 rounded mx-auto w-5" /></td>
                    <td className="p-4"><div className="h-5 bg-slate-100 rounded-full w-16 mx-auto" /></td>
                    <td className="p-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" /><div className="space-y-1.5"><div className="h-3 bg-slate-100 rounded w-32" /><div className="h-2.5 bg-slate-100 rounded w-44" /></div></div></td>
                    <td className="p-4"><div className="h-5 bg-slate-100 rounded-full w-20" /></td>
                    <td className="p-4"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                    <td className="p-4"><div className="h-3 bg-slate-100 rounded w-28" /></td>
                    <td className="p-4"><div className="h-3 bg-slate-100 rounded w-20" /></td>
                    <td className="p-4"><div className="h-3 bg-slate-100 rounded w-16" /></td>
                    <td className="p-4"><div className="h-7 bg-slate-100 rounded w-8 ml-auto" /></td>
                  </tr>
                ))
              )}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Users size={22} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold">No hay usuarios con los filtros aplicados</p>
                      <p className="text-xs">Prueba ajustando los criterios de búsqueda</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredUsers.map((user, idx) => {
                const online = isUserOnline(user);
                const asignacion = user.consultorioRecurrente || user.areaRecurrente || user.sucursal || '--';
                const permissionCount = Array.isArray(user.permissionList)
                  ? user.permissionList.length
                  : Object.values(user.permissions || {}).filter(Boolean).length;
                const c = ROLE_COLORS[user.rol];

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-3 text-center text-xs font-semibold text-slate-300">{idx + 1}</td>
                    <td className="p-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${online ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        {online ? 'Online' : 'Offline'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={user.nombre} role={user.rol} />
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-snug">{user.nombre}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                          {!!user.cedulaProfesional && <p className="text-[10px] text-blue-600 font-bold mt-0.5">Céd. {user.cedulaProfesional}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <RoleBadge role={user.rol} />
                    </td>
                    <td className="p-4 text-xs text-slate-500">{user.especialidad || <span className="text-slate-300">—</span>}</td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin size={11} className="text-slate-300 flex-shrink-0" /> {asignacion}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock3 size={11} className="text-slate-300 flex-shrink-0" /> {formatLastSeen(user.lastSeen)}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${permissionCount > 0 ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                        <Key size={9} /> {permissionCount} activos
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditUser(user)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar usuario"
                        >
                          <Edit size={16} />
                        </button>
                        {(user.rol !== 'admin_maestro' && user.rol !== 'admin') && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar usuario"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
};

const inputCls = 'w-full p-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm transition-all';

const SectionLabel = ({ children }) => (
  <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
    <span className="w-0.5 h-3.5 rounded-full bg-blue-500 inline-block flex-shrink-0" />
    {children}
  </p>
);

const Field = ({ label, children, optional = false }) => (
  <label className="block">
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
      {label}
      {optional && <span className="text-[10px] font-normal text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">(opcional)</span>}
    </span>
    {children}
  </label>
);

const UserAvatar = ({ name, role }) => {
  const c = ROLE_COLORS[role];
  const initials = (name || '??').split(' ').slice(0, 2).map((n) => n[0] || '').join('').toUpperCase();
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${c?.avatar ?? 'bg-slate-100'} ${c?.text ?? 'text-slate-600'}`}>
      {initials || <User size={14} />}
    </div>
  );
};

const RoleBadge = ({ role }) => {
  const c = ROLE_COLORS[role];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide ${c?.bg ?? 'bg-slate-50'} ${c?.text ?? 'text-slate-600'} ${c?.border ?? 'border-slate-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c?.dot ?? 'bg-slate-400'}`} />
      {roleLabel(role)}
    </span>
  );
};

const StatPill = ({ label, value, color = 'text-slate-700' }) => (
  <div className="flex items-baseline gap-1.5">
    <span className={`text-xl font-black leading-none ${color}`}>{value}</span>
    <span className="text-xs text-slate-400 font-medium">{label}</span>
  </div>
);

export default Usuarios;
