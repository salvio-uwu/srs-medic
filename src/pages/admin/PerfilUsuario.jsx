import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage, auth } from '../../config/firebase';
import {
  doc, updateDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Shield, Key, Calendar,
  Clock, FileText, Upload, Download, Trash2, IdCard,
  Camera, Building2, Briefcase, Stethoscope,
  Activity, Wifi, WifiOff, RefreshCw, X, Printer,
  FileImage, FileArchive, ChevronRight
} from 'lucide-react';

const ROLE_LABELS = {
  medico: 'Médico', enfermeria: 'Enfermería', jefa_enfermeria: 'Jefa Enfermería',
  intendencia: 'Intendencia', rh: 'RH', admin: 'Admin', operativo: 'Operativo',
  recepcion: 'Recepción'
};

const ROLE_COLORS = {
  medico:          { dot: 'bg-blue-500' },
  enfermeria:      { dot: 'bg-teal-500' },
  jefa_enfermeria: { dot: 'bg-indigo-500' },
  admin:           { dot: 'bg-purple-500' },
  rh:              { dot: 'bg-orange-400' },
  intendencia:     { dot: 'bg-slate-400' },
  recepcion:       { dot: 'bg-cyan-500' },
  operativo:       { dot: 'bg-amber-400' },
};

const FILE_ICONS = {
  'application/pdf': FileText,
  'image/png': FileImage,
  'image/jpeg': FileImage,
  'image/webp': FileImage,
  'application/zip': FileArchive,
  'application/x-rar-compressed': FileArchive
};

const glassCard = 'rounded-2xl border border-white/60 bg-white/55 shadow-[0_18px_45px_-26px_rgba(15,23,42,0.32)] backdrop-blur-xl overflow-hidden';
const glassInput = 'w-full rounded-xl border border-white/70 bg-white/75 backdrop-blur-md px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-white/70 placeholder:text-slate-400';

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatDate = (v) => {
  if (!v) return '—';
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

const GlassBadge = ({ label, value }) => (
  <span className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
    {label && <span className="text-slate-400 font-medium">{label}:</span>}
    <span className="text-slate-800">{value}</span>
  </span>
);

const PerfilUsuario = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  const [documentos, setDocumentos] = useState([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState(null);

  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const badgeRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setUserData({ id: snap.id, ...snap.data() });
      } else {
        setUserData(null);
      }
      setLoading(false);
    }, () => setLoading(false));

    const docsUnsub = onSnapshot(
      query(collection(db, 'users', userId, 'documentos'), orderBy('createdAt', 'desc')),
      (snap) => setDocumentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    return () => { unsub(); docsUnsub(); };
  }, [userId]);

  useEffect(() => {
    if (activeTab !== 'auditoria' || !userId) return;
    const q = query(
      collection(db, 'auditoria_admin_usuarios'),
      where('targetUid', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAuditLog(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAuditLoading(false);
    }, () => setAuditLoading(false));
    return () => unsub();
  }, [activeTab, userId]);

  const online = !userData?.lastSeen
    ? false
    : (new Date().getTime() - new Date(userData.lastSeen).getTime()) / 60000 < 10;

  const roleColor = ROLE_COLORS[userData?.rol];
  const roleLabel = ROLE_LABELS[userData?.rol] || userData?.rol || 'Sin rol';
  const initials = (userData?.nombre || '??').split(' ').slice(0, 2).map((n) => n[0] || '').join('').toUpperCase();
  const cedula = userData?.cedula || userData?.cedulaProfesional || '';
  const asignacion = userData?.consultorioRecurrente || userData?.areaRecurrente || userData?.sucursal || '';

  const permissionList = useMemo(() => {
    const list = Array.isArray(userData?.permissionList)
      ? userData.permissionList
      : Object.entries(userData?.permissions || {}).filter(([, v]) => v).map(([k]) => k);
    return list;
  }, [userData]);

  const handleUploadDocument = async () => {
    if (!docFile || !docName.trim()) {
      alert('Selecciona un archivo y asigna un nombre al documento.');
      return;
    }
    setDocUploading(true);
    try {
      const safeName = docName.trim().replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s_-]/g, '');
      const timestamp = Date.now();
      const ext = docFile.name.split('.').pop();
      const storagePath = `usuarios/${userId}/documentos/${timestamp}_${safeName}.${ext}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, docFile, { contentType: docFile.type });
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'users', userId, 'documentos'), {
        nombre: docName.trim(),
        nombreArchivo: docFile.name,
        archivoUrl: downloadURL,
        archivoPath: storagePath,
        tipo: docFile.type,
        tamano: docFile.size,
        subidoPor: auth.currentUser?.email || 'sistema',
        createdAt: serverTimestamp()
      });

      setDocName('');
      setDocFile(null);
    } catch (err) {
      alert(`Error al subir: ${err.message}`);
    }
    setDocUploading(false);
  };

  const handleDeleteDocument = async (docItem) => {
    if (!window.confirm(`¿Eliminar "${docItem.nombre}"?`)) return;
    try {
      if (docItem.archivoPath) {
        await deleteObject(ref(storage, docItem.archivoPath));
      }
      await deleteDoc(doc(db, 'users', userId, 'documentos', docItem.id));
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) return;
    setPhotoUploading(true);
    try {
      const storagePath = `usuarios/${userId}/foto_perfil.${photoFile.name.split('.').pop()}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, photoFile, { contentType: photoFile.type });
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', userId), { fotoPerfil: downloadURL });
      setPhotoFile(null);
    } catch (err) {
      alert(`Error al subir foto: ${err.message}`);
    }
    setPhotoUploading(false);
  };

  const handlePrintBadge = () => {
    setTimeout(() => { window.print(); }, 400);
  };

  const handleBack = () => navigate('/admin/usuarios');

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto pb-20 space-y-5">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/60" />
          <div className="h-8 bg-white/60 rounded-xl w-48" />
        </div>
        <div className={`${glassCard} h-52`} />
        <div className="grid grid-cols-2 gap-5">
          <div className={`${glassCard} h-40`} />
          <div className={`${glassCard} h-40`} />
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-6 max-w-5xl mx-auto pb-20 flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-white/60 backdrop-blur-md border border-white/60 flex items-center justify-center mb-4">
          <User size={28} className="text-slate-400" />
        </div>
        <p className="text-slate-600 font-semibold text-lg">Usuario no encontrado</p>
        <button onClick={handleBack} className="mt-4 px-4 py-2 rounded-xl bg-white/70 backdrop-blur-md border border-white/60 text-blue-600 text-sm font-semibold hover:bg-white/90 transition-all">Volver al directorio</button>
      </div>
    );
  }

  const TABS = [
    { key: 'info', label: 'Información', icon: User },
    { key: 'documentos', label: 'Documentos', icon: FileText, badge: documentos.length },
    { key: 'auditoria', label: 'Auditoría', icon: Shield },
    { key: 'gafete', label: 'Gafete', icon: IdCard }
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20 space-y-5">

      {/* ── Back & Title ── */}
      <div className="flex items-center gap-4">
        <button onClick={handleBack} className="w-10 h-10 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-white/75 transition-all flex-shrink-0 shadow-sm" title="Volver">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-slate-800 leading-tight truncate" style={{ fontFamily: "'Sora', sans-serif" }}>{userData.nombre}</h1>
          <p className="text-sm text-slate-500">Perfil de usuario</p>
        </div>
      </div>

      {/* ── Profile Header Glass Card ── */}
      <div className={glassCard}>
        <div className="h-16 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600" />
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              {userData.fotoPerfil ? (
                <img src={userData.fotoPerfil} alt={userData.nombre} className="w-[72px] h-[72px] rounded-2xl border-[3px] border-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] object-cover" />
              ) : (
                <div className="w-[72px] h-[72px] rounded-2xl border-[3px] border-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] flex items-center justify-center text-2xl font-black bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {initials}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera size={20} className="text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </label>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-slate-800 truncate" style={{ fontFamily: "'Sora', sans-serif" }}>{userData.nombre}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-white/80 bg-white/70 text-[11px] font-bold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  <span className={`w-1.5 h-1.5 rounded-full ${roleColor?.dot ?? 'bg-slate-400'}`} /> {roleLabel}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${online ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-700' : 'bg-slate-50/80 border-slate-200/80 text-slate-500'}`}>
                  {online ? <Wifi size={10} className="text-emerald-500" /> : <WifiOff size={10} className="text-slate-400" />}
                  {online ? 'En línea' : 'Offline'}
                </span>
                {cedula && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-white/80 bg-white/70 text-[11px] font-bold text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                    <IdCard size={10} /> Céd. {cedula}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 ml-1 flex items-center gap-1">
                  <Clock size={10} /> {formatLastSeen(userData.lastSeen)}
                </span>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {photoFile && (
                <button onClick={handleUploadPhoto} disabled={photoUploading} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 shadow-sm transition-all">
                  {photoUploading ? <RefreshCw size={11} className="animate-spin" /> : <Camera size={11} />}
                  {photoUploading ? 'Subiendo…' : 'Guardar foto'}
                </button>
              )}
              <button onClick={handlePrintBadge} className="px-3 py-2 rounded-xl border border-white/70 bg-white/70 backdrop-blur-sm text-slate-700 hover:bg-white/90 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all">
                <Printer size={13} /> Imprimir Gafete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs (segmented control glass) ── */}
      <div className="flex gap-1 bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-1.5 w-fit flex-wrap shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/80'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
            {tab.badge > 0 && (
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Información ── */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Datos personales */}
          <div className={glassCard}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0"><User size={12} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Datos personales</span>
            </div>
            <div className="p-5 grid grid-cols-2 gap-y-4 gap-x-5">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Nombre</span>
                <span className="text-sm font-semibold text-slate-800">{userData.nombre}</span>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Sexo</span>
                <span className="text-sm font-semibold text-slate-800">{userData.sexo || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Fecha nacimiento</span>
                <span className="text-sm font-semibold text-slate-800">{userData.fechaNacimiento || '—'}</span>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className={glassCard}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0"><Phone size={12} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contacto</span>
            </div>
            <div className="p-5 grid grid-cols-2 gap-y-4 gap-x-5">
              <div className="col-span-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Correo</span>
                <span className="text-sm font-mono font-semibold text-slate-800 break-all">{userData.email || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Tel. Móvil</span>
                <span className="text-sm font-semibold text-slate-800">{userData.telefonoMovil || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Tel. Fijo</span>
                <span className="text-sm font-semibold text-slate-800">{userData.telefonoFijo || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Dirección</span>
                <span className="text-sm font-semibold text-slate-800">{userData.direccion || '—'}</span>
              </div>
            </div>
          </div>

          {/* Perfil laboral */}
          <div className={glassCard}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0"><Briefcase size={12} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Perfil laboral</span>
            </div>
            <div className="p-5 grid grid-cols-2 gap-y-4 gap-x-5">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Rol</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <span className={`w-1.5 h-1.5 rounded-full ${roleColor?.dot ?? 'bg-slate-400'}`} /> {roleLabel}
                </span>
              </div>
              {userData.especialidad && (
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Especialidad</span>
                  <span className="text-sm font-semibold text-slate-800">{userData.especialidad}</span>
                </div>
              )}
              {userData.cargo && (
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Cargo</span>
                  <span className="text-sm font-semibold text-slate-800">{userData.cargo}</span>
                </div>
              )}
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Asignación</span>
                <span className="text-sm font-semibold text-slate-800">{asignacion || '—'}</span>
              </div>
              {cedula && (
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Cédula</span>
                  <span className="text-sm font-mono font-semibold text-blue-700">{cedula}</span>
                </div>
              )}
              {userData.universidadEgreso && (
                <div className="col-span-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Universidad</span>
                  <span className="text-sm font-semibold text-slate-800">{userData.universidadEgreso}</span>
                </div>
              )}
            </div>
          </div>

          {/* Permisos */}
          <div className={glassCard}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center flex-shrink-0"><Key size={12} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Permisos</span>
              <span className="ml-auto text-[10px] font-bold text-slate-500">{permissionList.length} activos</span>
            </div>
            <div className="p-5">
              {permissionList.length === 0 ? (
                <p className="text-xs text-slate-400">Sin permisos asignados</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {permissionList.map((p) => (
                    <span key={p} className="px-2.5 py-1 bg-violet-50/80 border border-violet-200/80 rounded-xl text-[10px] font-semibold text-violet-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Información del sistema */}
          <div className={`${glassCard} lg:col-span-2`}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-600 flex items-center justify-center flex-shrink-0"><Activity size={12} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Información del sistema</span>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-sm p-3">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Creado por</span>
                <span className="text-sm font-semibold text-slate-800">{userData.creadoPor || '—'}</span>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-sm p-3">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Actualizado por</span>
                <span className="text-sm font-semibold text-slate-800">{userData.actualizadoPor || '—'}</span>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-sm p-3">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Fecha creación</span>
                <span className="text-sm font-semibold text-slate-800">{formatDate(userData.fechaCreacion)}</span>
              </div>
              <div className="rounded-xl border border-white/60 bg-white/60 backdrop-blur-sm p-3">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-1">Última actualización</span>
                <span className="text-sm font-semibold text-slate-800">{formatDate(userData.fechaActualizacion)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Documentos ── */}
      {activeTab === 'documentos' && (
        <div className="space-y-5">
          {/* Upload */}
          <div className={glassCard}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0"><Upload size={12} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Subir documento</span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className={`${glassInput} flex-1`}
                placeholder="Nombre del documento (ej. Credencial INE, Título, CURP...)"
              />
              <div className="flex items-center gap-2">
                <label className="px-4 py-2.5 rounded-xl border border-white/70 bg-white/75 backdrop-blur-md text-slate-600 hover:bg-white/90 text-sm font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all">
                  <FileText size={14} />
                  {docFile ? docFile.name : 'Seleccionar archivo'}
                  <input type="file" className="hidden" onChange={(e) => setDocFile(e.target.files[0])} />
                </label>
                <button
                  onClick={handleUploadDocument}
                  disabled={docUploading || !docFile || !docName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-sm transition-all"
                >
                  {docUploading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                  Subir
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <div className={glassCard}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{documentos.length} documento(s)</span>
            </div>
            {documentos.length === 0 ? (
              <div className="py-16 text-center">
                <FileText size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No hay documentos registrados</p>
                <p className="text-xs text-slate-400 mt-1">Sube archivos como identificaciones, títulos o constancias</p>
              </div>
            ) : (
              <div>
                {documentos.map((docItem, i) => {
                  const FileIcon = FILE_ICONS[docItem.tipo] || FileText;
                  return (
                    <div key={docItem.id} className={`flex items-center gap-4 px-5 py-3 group ${i % 2 === 0 ? 'bg-white/35' : 'bg-white/55'} hover:bg-white/75 transition-colors backdrop-blur-sm border-b border-white/50 last:border-b-0`}>
                      <div className="w-8 h-8 rounded-lg bg-blue-100/80 border border-blue-200/60 flex items-center justify-center flex-shrink-0">
                        <FileIcon size={15} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{docItem.nombre}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {docItem.nombreArchivo || docItem.archivoPath?.split('/').pop()} · {formatBytes(docItem.tamano)} · {formatDate(docItem.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={docItem.archivoUrl} target="_blank" rel="noopener noreferrer" download className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition-all" title="Descargar">
                          <Download size={15} />
                        </a>
                        <button onClick={() => handleDeleteDocument(docItem)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50/80 rounded-lg transition-all" title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Auditoría ── */}
      {activeTab === 'auditoria' && (
        <div className={glassCard}>
          <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-600 flex items-center justify-center flex-shrink-0"><Shield size={12} className="text-white" /></div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Registro de auditoría</span>
          </div>
          {auditLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-200 mt-2 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-100 rounded w-32" />
                    <div className="h-3 bg-slate-100 rounded w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : auditLog.length === 0 ? (
            <div className="py-16 text-center">
              <Shield size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">Sin registros de auditoría</p>
              <p className="text-xs text-slate-400 mt-1">Los cambios en este usuario aparecerán aquí</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {auditLog.map((entry, i) => {
                const actionLabel = {
                  alta_usuario: 'Alta de usuario',
                  edicion_usuario: 'Edición de usuario',
                  baja_usuario: 'Baja de usuario'
                }[entry.action] || entry.action || 'Acción';

                const actionColor = {
                  alta_usuario: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/80',
                  edicion_usuario: 'bg-blue-50/80 text-blue-700 border-blue-200/80',
                  baja_usuario: 'bg-red-50/80 text-red-700 border-red-200/80'
                }[entry.action] || 'bg-slate-50/80 text-slate-600 border-slate-200/80';

                return (
                  <div key={entry.id} className={`px-5 py-3.5 flex items-start gap-3 ${i % 2 === 0 ? 'bg-white/35' : 'bg-white/55'} backdrop-blur-sm border-b border-white/50 last:border-b-0`}>
                    <div className="mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-xl text-[10px] font-bold border shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${actionColor}`}>{actionLabel}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Por: {entry.actorEmail || 'sistema'} · {formatDate(entry.createdAt)}
                      </p>
                      {entry.payload && Object.keys(entry.payload).length > 0 && (
                        <div className="mt-2 rounded-xl border border-white/60 bg-white/60 backdrop-blur-sm p-2.5">
                          <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">Detalles del cambio</span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(entry.payload).map(([k, v]) => (
                              <span key={k} className="text-[10px] text-slate-600 bg-white border border-slate-200/60 rounded-lg px-1.5 py-0.5">
                                <span className="font-semibold">{k}:</span> {Array.isArray(v) ? v.join(', ') : String(v)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Gafete ── */}
      {activeTab === 'gafete' && (
        <div className="space-y-5">
          <div className={glassCard}>
            <div className="px-5 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0"><IdCard size={12} className="text-white" /></div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Generar Gafete</span>
              <span className="ml-auto text-[10px] text-slate-400 font-medium">54 × 86 mm</span>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-4">
                Gafete imprimible con foto, nombre completo y cédula profesional.
                {!userData.fotoPerfil && <span className="text-amber-600 font-semibold"> Sube una foto desde la pestaña Información para personalizarlo.</span>}
              </p>
              <button
                onClick={handlePrintBadge}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <Printer size={15} /> Imprimir Gafete
              </button>
            </div>
          </div>

          {/* Badge Preview */}
          <div className={glassCard}>
            <div className="p-5 flex justify-center" ref={badgeRef}>
              <div className="print-badge border-2 border-slate-300 rounded-xl overflow-hidden bg-white relative shadow-lg" style={{ width: '54mm', height: '86mm' }}>
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-2.5 px-3 text-center">
                  <p className="text-white text-[7px] font-bold tracking-[0.15em] uppercase">Centro Médico Santa Cruz</p>
                </div>
                <div className="flex justify-center pt-3 pb-2">
                  {userData.fotoPerfil ? (
                    <img src={userData.fotoPerfil} alt={userData.nombre} className="w-[54px] h-[54px] rounded-xl object-cover border-2 border-blue-600" crossOrigin="anonymous" />
                  ) : (
                    <div className="w-[54px] h-[54px] rounded-xl border-2 border-blue-600 flex items-center justify-center text-xl font-black bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {initials}
                    </div>
                  )}
                </div>
                <div className="px-3 text-center space-y-0.5">
                  <p className="text-[10px] font-black text-slate-800 leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>{userData.nombre}</p>
                  <p className="text-[7px] text-slate-500 font-semibold">{roleLabel}</p>
                  {cedula && (
                    <div className="pt-1.5">
                      <p className="text-[6px] text-slate-400 font-semibold uppercase tracking-wider">Cédula Profesional</p>
                      <p className="text-[10px] font-bold text-blue-700 font-mono tracking-wide">{cedula}</p>
                    </div>
                  )}
                  {asignacion && (
                    <div className="pt-1">
                      <p className="text-[6px] text-slate-400 font-semibold uppercase tracking-wider">Asignación</p>
                      <p className="text-[8px] font-semibold text-slate-600">{asignacion}</p>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-slate-100 py-1.5 px-2 text-center border-t border-slate-200">
                  <p className="text-[5px] text-slate-400 font-medium">Válido al {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-badge, .print-badge * { visibility: visible; }
          .print-badge {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 54mm !important;
            height: 86mm !important;
            page-break-inside: avoid;
          }
          @page {
            size: 54mm 86mm;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PerfilUsuario;
