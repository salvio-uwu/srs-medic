import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Trash2, MapPin, Search, ShieldCheck, Table2, FilterX, Clock3, Users, Activity, WifiOff, Stethoscope, Shield, Key, RefreshCw, User, Mail, Lock, Edit, Eye } from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, addDoc, serverTimestamp, getDoc, updateDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, deleteUser } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import useIsMobile from '../../hooks/useIsMobile';

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
  medico:          { dot: '#111',   avatar: '#f3f4f6' },
  enfermeria:      { dot: '#4b5563', avatar: '#f3f4f6' },
  jefa_enfermeria: { dot: '#374151', avatar: '#f3f4f6' },
  admin:           { dot: '#111',   avatar: '#f3f4f6' },
  rh:              { dot: '#6b7280', avatar: '#f3f4f6' },
  intendencia:     { dot: '#9ca3af', avatar: '#f3f4f6' },
  recepcion:       { dot: '#4b5563', avatar: '#f3f4f6' },
  operativo:       { dot: '#6b7280', avatar: '#f3f4f6' },
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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    const source = isMedicoRole ? consultoriosCatalogo : sucursalesCatalogo;
    return source.map((item) => item.nombre || item);
  }, [consultoriosCatalogo, sucursalesCatalogo, isMedicoRole]);

  const resolverAsignacionIds = (nombre) => {
    if (isMedicoRole) {
      const c = consultoriosCatalogo.find((item) => item.nombre === nombre);
      return { consultorioRecurrenteId: c?.id || '', sucursalId: c?.sucursalId || '', sucursalNombre: c?.sucursal || '' };
    }
    const s = sucursalesCatalogo.find((item) => item.nombre === nombre);
    return { sucursalId: s?.id || '', sucursalNombre: s?.nombre || nombre };
  };

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
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

      const sucursales = sucursalesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.activo !== false && item.nombre)
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

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
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsuarios(usersList);
      setLoading(false);
    }, () => { setLoading(false); });

    const unsub2 = onSnapshot(collection(db, 'catalogo_consultorios'), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false && item.nombre).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
      setConsultoriosCatalogo(rows);
    }, () => {});
    const unsub3 = onSnapshot(collection(db, 'catalogo_sucursales'), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false && item.nombre).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
      setSucursalesCatalogo(rows);
    }, () => {});
    const unsub4 = onSnapshot(collection(db, 'catalogo_especialidades'), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false && item.nombre).map((item) => item.nombre).sort((a, b) => String(a).localeCompare(String(b), 'es'));
      setEspecialidadesCatalogo(rows);
    }, () => {});

    return () => { unsub(); unsub2(); unsub3(); unsub4(); };
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

      const ids = resolverAsignacionIds(formData.asignacionRecurrente);
      if (isMedicoRole) {
        editableData.consultorioRecurrente = formData.asignacionRecurrente;
        editableData.consultorioRecurrenteId = ids.consultorioRecurrenteId;
        editableData.sucursal = ids.sucursalNombre || formData.asignacionRecurrente;
        editableData.sucursalId = ids.sucursalId;
      } else {
        editableData.areaRecurrente = formData.asignacionRecurrente;
        editableData.sucursal = formData.asignacionRecurrente;
        editableData.sucursalId = ids.sucursalId;
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

      const idsNew = resolverAsignacionIds(formData.asignacionRecurrente);
      if (isMedicoRole) {
        baseData.consultorioRecurrente = formData.asignacionRecurrente;
        baseData.consultorioRecurrenteId = idsNew.consultorioRecurrenteId;
        baseData.sucursal = idsNew.sucursalNombre || formData.asignacionRecurrente;
        baseData.sucursalId = idsNew.sucursalId;
      } else {
        baseData.areaRecurrente = formData.asignacionRecurrente;
        baseData.sucursal = formData.asignacionRecurrente;
        baseData.sucursalId = idsNew.sucursalId;
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
    } catch (error) {
      alert(`Error al eliminar: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '32px 28px 48px' }}>
      {/* ── CABECERA ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
            Gestion de Usuarios
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Control de personal, permisos y actividad del sistema
          </p>
        </div>
        <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', padding: 3 }}>
          <button
            onClick={() => setViewMode('tabla')}
            style={{
              padding: '7px 16px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              color: viewMode === 'tabla' ? '#fff' : '#4b5563',
              background: viewMode === 'tabla' ? '#111' : 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Table2 size={15} /> Vista Tabla
          </button>
          <button
            onClick={() => setViewMode('alta')}
            style={{
              padding: '7px 16px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              color: viewMode === 'alta' ? '#fff' : '#4b5563',
              background: viewMode === 'alta' ? '#111' : 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <UserPlus size={15} /> Alta de Usuario
          </button>
        </div>
      </div>

      {viewMode === 'alta' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <UserPlus size={15} style={{ color: '#6b7280' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{editingUserId ? 'Editar usuario' : 'Alta de usuario'}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Los campos con * son obligatorios</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', background: '#fff' }}>
              {auth.currentUser?.email || 'sin sesion'}
            </div>
          </div>

          <form onSubmit={handleRegister}>
            {/* ── Selector de rol ── */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <SectionLabel>Rol del usuario *</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {ROLE_OPTIONS.map((role) => {
                  const active = formData.rol === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => applyRoleDefaults(role.value)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: active ? '1px solid #111' : '1px solid #d1d5db',
                        background: active ? '#111' : '#fff',
                        color: active ? '#fff' : '#4b5563',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
              {formData.rol && (
                <div style={{ marginTop: 10, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, color: '#4b5563', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={13} style={{ color: '#6b7280' }} />
                  {ROLE_OPTIONS.find(r => r.value === formData.rol)?.helper}
                </div>
              )}
            </div>

            {/* ── Cuerpo en 2 columnas ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', borderBottom: '1px solid #e5e7eb' }}>
              {/* Columna izquierda */}
              <div style={{ padding: '18px 20px', borderRight: isMobile ? 'none' : '1px solid #e5e7eb' }}>
                <div style={{ marginBottom: 18 }}>
                  <SectionLabel>Datos personales</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <Field label="Nombre *">
                      <input value={formData.nombre} onChange={(e) => updateForm('nombre', e.target.value)} required style={inputCls} placeholder="Ej. Maria" />
                    </Field>
                    <Field label="Apellidos *">
                      <input value={formData.apellidos} onChange={(e) => updateForm('apellidos', e.target.value)} required style={inputCls} placeholder="Ej. Garcia Lopez" />
                    </Field>
                    <Field label="Sexo *">
                      <select value={formData.sexo} onChange={(e) => updateForm('sexo', e.target.value)} style={inputCls}>
                        <option value="Femenino">Femenino</option>
                        <option value="Masculino">Masculino</option>
                      </select>
                    </Field>
                    <Field label="Fecha de nacimiento *">
                      <input type="date" value={formData.fechaNacimiento} onChange={(e) => updateForm('fechaNacimiento', e.target.value)} required style={inputCls} />
                    </Field>
                  </div>
                </div>
                <div style={{ paddingTop: 18, borderTop: '1px solid #e5e7eb' }}>
                  <SectionLabel>Perfil laboral</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                    {isMedicoRole && (<Field label="Especialidad *"><select value={formData.especialidad} onChange={(e) => updateForm('especialidad', e.target.value)} style={inputCls}><option value="">Selecciona una especialidad...</option>{especialidadesCatalogo.map((esp) => <option key={esp} value={esp}>{esp}</option>)}</select>{especialidadesCatalogo.length === 0 && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>Sin especialidades en catalogo. Agregalas en Catalogos Globales.</p>}</Field>)}
                    {isClinicalNonMedico && (<Field label="Area de especialidad" optional><input value={formData.especialidad} onChange={(e) => updateForm('especialidad', e.target.value)} style={inputCls} placeholder="Ej. Urgencias, Triage, UCI..." /></Field>)}
                    {isClinicalRole && (<Field label="Universidad / Institucion de egreso" optional><input value={formData.universidadEgreso} onChange={(e) => updateForm('universidadEgreso', e.target.value)} style={inputCls} placeholder="Ej. UNAM, IPN, UANL..." /></Field>)}
                    {!isClinicalRole && (<Field label="Cargo / Puesto" optional><input value={formData.cargo} onChange={(e) => updateForm('cargo', e.target.value)} style={inputCls} placeholder="Ej. Administrador, Recepcionista..." /></Field>)}
                    <Field label={isMedicoRole ? 'Consultorio recurrente *' : 'Sucursal / Area de trabajo *'}><select value={formData.asignacionRecurrente} onChange={(e) => updateForm('asignacionRecurrente', e.target.value)} style={inputCls}><option value="">Selecciona una opcion...</option>{assignmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>{assignmentOptions.length === 0 && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>No hay {isMedicoRole ? 'consultorios' : 'sucursales'} activos. Agregalos en Catalogos Globales.</p>}</Field>
                    {isClinicalRole && (<Field label={isMedicoRole ? 'Cedula profesional *' : 'Cedula profesional'} optional={!isMedicoRole}><input value={formData.cedula} onChange={(e) => updateForm('cedula', e.target.value)} style={inputCls} placeholder="Ej. 12345678" /></Field>)}
                  </div>
                </div>
              </div>
              {/* Columna derecha */}
              <div style={{ padding: '18px 20px' }}>
                <div style={{ marginBottom: 18 }}>
                  <SectionLabel>Informacion de contacto</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                    <Field label="Correo electronico *">
                      <div style={{ position: 'relative' }}>
                        <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input type="email" value={formData.email} onChange={(e) => updateForm('email', e.target.value)} required readOnly={!!editingUserId} style={{ padding: '8px 12px 8px 30px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: editingUserId ? '#9ca3af' : '#111', outline: 'none', background: editingUserId ? '#fafafa' : '#fff', width: '100%', boxSizing: 'border-box', cursor: editingUserId ? 'not-allowed' : undefined }} placeholder="correo@clinica.mx" />
                        {editingUserId && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>El correo no se puede editar para evitar desincronizacion con Auth.</p>}
                      </div>
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                      <Field label="Telefono movil *"><input type="tel" value={formData.telefonoMovil} onChange={(e) => updateForm('telefonoMovil', e.target.value)} required style={inputCls} placeholder="5512345678" /></Field>
                      <Field label="Telefono fijo" optional><input type="tel" value={formData.telefonoFijo} onChange={(e) => updateForm('telefonoFijo', e.target.value)} style={inputCls} placeholder="Ej. 5512345678" /></Field>
                    </div>
                    <Field label="Direccion" optional><input value={formData.direccion} onChange={(e) => updateForm('direccion', e.target.value)} style={inputCls} placeholder="Calle, numero, colonia" /></Field>
                  </div>
                </div>
                <div style={{ paddingTop: 18, borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ marginBottom: 10 }}>
                    <SectionLabel>{editingUserId ? 'Cambiar contrasena' : 'Contrasena de acceso'}</SectionLabel>
                    {editingUserId && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Deja en blanco para no modificar la contrasena actual.</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label={editingUserId ? 'Nueva contrasena' : 'Contrasena *'} optional={!!editingUserId}>
                      <div style={{ position: 'relative' }}>
                        <Lock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input type="password" minLength={6} value={formData.password} onChange={(e) => updateForm('password', e.target.value)} required={!editingUserId} style={{ padding: '8px 12px 8px 30px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' }} placeholder={editingUserId ? 'Deja vacio para no cambiar' : 'Minimo 6 caracteres'} />
                      </div>
                    </Field>
                    <Field label={editingUserId ? 'Confirmar nueva contrasena' : 'Confirmar contrasena *'} optional={!!editingUserId}>
                      <div style={{ position: 'relative' }}>
                        <Lock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input type="password" minLength={6} value={formData.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} required={!editingUserId} style={{ padding: '8px 12px 8px 30px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#111', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' }} placeholder={editingUserId ? 'Solo si cambias contrasena' : 'Repite la contrasena'} />
                      </div>
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Permisos ── */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <SectionLabel>Permisos del sistema</SectionLabel>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: 99, padding: '2px 8px' }}>
                    {enabledPermissionIds.length} activos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, permissions: buildPermissionMap(defaultPermissionIdsByRole(prev.rol)) }))}
                  style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#4b5563', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <RefreshCw size={11} /> Restaurar por rol
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: 16 }}>
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.key}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>{group.label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {group.items.map((perm) => (
                        <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4b5563', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!formData.permissions?.[perm.id]}
                            onChange={() => togglePermission(perm.id)}
                            style={{ width: 14, height: 14, accentColor: '#111' }}
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
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setViewMode('tabla'); resetUserForm(); }}
                style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, color: '#4b5563', background: '#fff', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  border: '1px solid #111',
                  borderRadius: 6,
                  padding: '7px 20px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#111',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {saving ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</> : editingUserId ? 'Guardar cambios' : `Crear ${roleLabel(formData.rol)}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewMode === 'tabla' && (
      <div>
        {/* ── Filtros ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 400 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input style={{ ...inputCls, paddingLeft: 32, width: '100%' }} placeholder="Buscar por nombre, correo, rol o asignacion..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#111', background: '#fff', outline: 'none' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <select style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#111', background: '#fff', outline: 'none' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Todos los roles</option>
            {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label} ({roleCounts[r.value] || 0})</option>))}
          </select>
          <select style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#111', background: '#fff', outline: 'none' }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="online">Online primero</option>
            <option value="recent">Actividad reciente</option>
            <option value="role">Por rol</option>
          </select>
          <span style={{ fontSize: 12, color: '#6b7280' }}><strong style={{ color: '#111' }}>{filteredUsers.length}</strong> usuario(s)</span>
          {(roleFilter !== 'all' || statusFilter !== 'all' || searchTerm.trim()) && (
            <button onClick={() => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); setSortBy('online'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#4b5563', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <FilterX size={14} /> Limpiar
            </button>
          )}
        </div>

        {/* Desktop: table */}
        {!isMobile && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb', width: 10 }} />
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }}>Usuario</th>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }}>Rol</th>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }}>Asignacion</th>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }}>Actividad</th>
                  <th style={{ textAlign: 'right', padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e5e7eb' }} />
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ padding: '12px 20px' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f3f4f6' }} /></td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6' }} />
                        <div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: 140 }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}><div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: 80 }} /></td>
                    <td style={{ padding: '12px 20px' }}><div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: 120 }} /></td>
                    <td style={{ padding: '12px 20px' }}><div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: 70 }} /></td>
                    <td style={{ padding: '12px 20px' }}><div style={{ height: 26, background: '#f3f4f6', borderRadius: 6, width: 60, marginLeft: 'auto' }} /></td>
                  </tr>
                ))}
                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Users size={28} style={{ color: '#d1d5db' }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>No se encontraron usuarios</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>Ajusta los filtros o crea un nuevo usuario</div>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && filteredUsers.map((user, idx) => {
                  const online = isUserOnline(user);
                  const asignacion = user.consultorioRecurrente || user.areaRecurrente || user.sucursal || '—';
                  const permissionCount = Array.isArray(user.permissionList)
                    ? user.permissionList.length
                    : Object.values(user.permissions || {}).filter(Boolean).length;
                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => navigate(`/admin/usuarios/${user.id}`)}>
                      {/* Online dot */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: online ? '#111' : '#d1d5db',
                        }} />
                      </td>
                      {/* Usuario — avatar y nombre */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <UserAvatar name={user.nombre} role={user.rol} />
                          <div>
                            <div style={{ fontWeight: 600, color: '#111', fontSize: 13 }}>{user.nombre}</div>
                          </div>
                        </div>
                      </td>
                      {/* Rol */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{roleLabel(user.rol)}</span>
                      </td>
                      {/* Asignacion */}
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#4b5563' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={12} style={{ color: '#d1d5db', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap' }}>{asignacion}</span>
                        </div>
                      </td>
                      {/* Actividad */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: online ? '#111' : '#9ca3af' }}>
                            {online ? 'Online' : 'Offline'}
                          </span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            {online ? '' : formatLastSeen(user.lastSeen)}
                          </span>
                        </div>
                      </td>
                      {/* Acciones */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => startEditUser(user)}
                            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', background: '#fff', cursor: 'pointer' }}
                            title="Editar usuario"
                          >
                            <Edit size={14} />
                          </button>
                          {(user.rol !== 'admin_maestro' && user.rol !== 'admin') && (
                            <button
                              onClick={() => handleDelete(user)}
                              style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', background: '#fff', cursor: 'pointer' }}
                              title="Eliminar usuario"
                            >
                              <Trash2 size={14} />
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
        </div>
        )}

        {/* Mobile: user cards */}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: '60%', marginBottom: 6 }} />
                    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: '40%' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ height: 28, flex: 1, background: '#f3f4f6', borderRadius: 6 }} />
                  <div style={{ height: 28, width: 40, background: '#f3f4f6', borderRadius: 6 }} />
                  <div style={{ height: 28, width: 40, background: '#f3f4f6', borderRadius: 6 }} />
                </div>
              </div>
            ))}
            {!loading && filteredUsers.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '40px 20px', textAlign: 'center' }}>
                <Users size={28} style={{ color: '#d1d5db', marginBottom: 10 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>No se encontraron usuarios</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Ajusta los filtros o crea un nuevo usuario</div>
              </div>
            )}
            {!loading && filteredUsers.map((user) => {
              const online = isUserOnline(user);
              const asignacion = user.consultorioRecurrente || user.areaRecurrente || user.sucursal || '—';
              return (
                <div key={user.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, cursor: 'pointer' }} onClick={() => navigate(`/admin/usuarios/${user.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <UserAvatar name={user.nombre} role={user.rol} />
                      <div style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 8, height: 8, borderRadius: '50%',
                        background: online ? '#111' : '#d1d5db',
                        border: '2px solid #fff',
                      }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#111', fontSize: 13 }}>{user.nombre}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{roleLabel(user.rol)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4b5563' }}>
                      <MapPin size={11} style={{ color: '#9ca3af', flexShrink: 0 }} />
                      <span>{asignacion}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: online ? '#111' : '#9ca3af' }}>{online ? 'Online' : 'Offline'}</span>
                      {!online && <span style={{ color: '#9ca3af', fontSize: 11 }}>{formatLastSeen(user.lastSeen)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid #f3f4f6' }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => startEditUser(user)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      <Edit size={12} /> Editar
                    </button>
                    {(user.rol !== 'admin_maestro' && user.rol !== 'admin') && (
                      <button onClick={() => handleDelete(user)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', color: '#ef4444', background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
      )}
    </div>
  );
};

const inputCls = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  color: '#111',
  outline: 'none',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
};

const SectionLabel = ({ children }) => (
  <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', margin: 0 }}>
    {children}
  </p>
);

const Field = ({ label, children, optional = false }) => (
  <label style={{ display: 'block' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
      {label}
      {optional && <span style={{ fontSize: 10, fontWeight: 400, color: '#9ca3af' }}>(opcional)</span>}
    </span>
    {children}
  </label>
);

const UserAvatar = ({ name, role }) => {
  const initials = (name || '??').split(' ').slice(0, 2).map((n) => n[0] || '').join('').toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 12, flexShrink: 0,
      background: '#f3f4f6', color: '#4b5563',
    }}>
      {initials || <User size={14} />}
    </div>
  );
};

const RoleBadge = ({ role }) => {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 600, color: '#111',
    }}>
      {roleLabel(role)}
    </span>
  );
};

export default Usuarios;
