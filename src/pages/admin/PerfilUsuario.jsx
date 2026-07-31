import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db, storage, auth } from '../../config/firebase';
import {
  doc, updateDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  ArrowLeft, User, Shield, FileText, Upload, Download, Trash2, IdCard,
  Camera, RefreshCw, Printer, FileImage, FileArchive
} from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';

const ROLE_LABELS = {
  medico: 'Médico', enfermeria: 'Enfermería', jefa_enfermeria: 'Jefa Enfermería',
  intendencia: 'Intendencia', rh: 'RH', admin: 'Admin', operativo: 'Operativo',
  recepcion: 'Recepción'
};

const ROLE_COLORS = {};

const FILE_ICONS = {
  'application/pdf': FileText,
  'image/png': FileImage,
  'image/jpeg': FileImage,
  'image/webp': FileImage,
  'application/zip': FileArchive,
  'application/x-rar-compressed': FileArchive
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  overflow: 'hidden',
};
const inputStyle = {
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

// Not used anymore - removed

const PerfilUsuario = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.from || '/admin/usuarios';
  const isMobile = useIsMobile();

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

  const handleBack = () => navigate(backTo);

  const TABS = [
    { key: 'info', label: 'Informacion', icon: User },
    { key: 'documentos', label: 'Documentos', icon: FileText, badge: documentos.length },
    { key: 'auditoria', label: 'Auditoria', icon: Shield },
    { key: 'gafete', label: 'Gafete', icon: IdCard }
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '32px 28px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f3f4f6' }} />
          <div style={{ height: 24, background: '#f3f4f6', borderRadius: 6, width: 200 }} />
        </div>
        <div style={{ ...cardStyle, height: 200 }} />
      </div>
    );
  }

  if (!userData) {
    return (
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '32px 28px 48px', textAlign: 'center' }}>
        <User size={36} style={{ color: '#d1d5db', marginBottom: 16 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: '#4b5563', margin: 0 }}>Usuario no encontrado</p>
        <button onClick={handleBack} style={{ marginTop: 16, border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, color: '#4b5563', background: '#fff', cursor: 'pointer' }}>
          {backTo.includes('supervision') ? 'Volver a Supervisión' : 'Volver al directorio'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '32px 28px 48px' }}>
      {/* ── CABECERA ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <button onClick={handleBack} style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', cursor: 'pointer' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>{userData.nombre}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Perfil de usuario</p>
        </div>
      </div>

      {/* ── Profile Header ── */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {userData.fotoPerfil ? (
              <img src={userData.fotoPerfil} alt={userData.nombre} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#4b5563' }}>
                {initials}
              </div>
            )}
            <label style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(0,0,0,0.35)', opacity: 0, cursor: 'pointer', transition: 'opacity .15s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0}>
              <Camera size={18} style={{ color: '#fff' }} />
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setPhotoFile(e.target.files[0])} />
            </label>
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{userData.nombre}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 10px' }}>{roleLabel}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: online ? '#111' : '#9ca3af' }}>{online ? 'En linea' : 'Offline'}</span>
              {cedula && <span style={{ fontSize: 12, color: '#4b5563' }}>Ced. {cedula}</span>}
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{formatLastSeen(userData.lastSeen)}</span>
            </div>
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {photoFile && (
              <button onClick={handleUploadPhoto} disabled={photoUploading} style={{ border: '1px solid #111', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#111', cursor: photoUploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: photoUploading ? 0.5 : 1 }}>
                {photoUploading ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={12} />}
                {photoUploading ? 'Subiendo...' : 'Guardar foto'}
              </button>
            )}
            <button onClick={handlePrintBadge} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#4b5563', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Printer size={13} /> Imprimir Gafete
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', padding: 3, marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              color: activeTab === tab.key ? '#fff' : '#4b5563',
              background: activeTab === tab.key ? '#111' : 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.badge > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: activeTab === tab.key ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Informacion ── */}
      {activeTab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {/* Datos personales */}
          <div style={cardStyle}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>Datos personales</div>
            <div style={{ padding: '16px 20px' }}>
              {[['Nombre', userData.nombre], ['Sexo', userData.sexo || '—'], ['Fecha nacimiento', userData.fechaNacimiento || '—']].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 14, display: 'flex' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af', width: 130, flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Contacto */}
          <div style={cardStyle}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>Contacto</div>
            <div style={{ padding: '16px 20px' }}>
              {[['Correo', userData.email || '—'], ['Tel. Movil', userData.telefonoMovil || '—'], ['Tel. Fijo', userData.telefonoFijo || '—'], ['Direccion', userData.direccion || '—']].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 14, display: 'flex' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af', width: 100, flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111', wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Perfil laboral */}
          <div style={cardStyle}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>Perfil laboral</div>
            <div style={{ padding: '16px 20px' }}>
              {[
                ['Rol', roleLabel],
                ...(userData.especialidad ? [['Especialidad', userData.especialidad]] : []),
                ...(userData.cargo ? [['Cargo', userData.cargo]] : []),
                ['Asignacion', asignacion || '—'],
                ...(cedula ? [['Cedula', cedula]] : []),
                ...(userData.universidadEgreso ? [['Universidad', userData.universidadEgreso]] : []),
              ].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 14, display: 'flex' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af', width: 110, flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Permisos */}
          <div style={cardStyle}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Permisos</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{permissionList.length} activos</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {permissionList.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Sin permisos asignados</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {permissionList.map((p) => (
                    <span key={p} style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 10px' }}>{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Sistema */}
          <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>Informacion del sistema</div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 12 }}>
              {[['Creado por', userData.creadoPor || '—'], ['Actualizado por', userData.actualizadoPor || '—'], ['Fecha creacion', formatDate(userData.fechaCreacion)], ['Ultima actualizacion', formatDate(userData.fechaActualizacion)]].map(([l, v]) => (
                <div key={l} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Documentos ── */}
      {activeTab === 'documentos' && (
        <div>
          {/* Upload */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>Subir documento</div>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Nombre del documento"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#4b5563', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={13} />
                  {docFile ? docFile.name : 'Seleccionar archivo'}
                  <input type="file" style={{ display: 'none' }} onChange={(e) => setDocFile(e.target.files[0])} />
                </label>
                <button
                  onClick={handleUploadDocument}
                  disabled={docUploading || !docFile || !docName.trim()}
                  style={{ border: '1px solid #111', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#111', cursor: (docUploading || !docFile || !docName.trim()) ? 'not-allowed' : 'pointer', opacity: (docUploading || !docFile || !docName.trim()) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {docUploading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />}
                  Subir
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <div style={cardStyle}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>{documentos.length} documento(s)</div>
            {documentos.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <FileText size={32} style={{ color: '#e5e7eb', marginBottom: 12 }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: 0 }}>No hay documentos registrados</p>
              </div>
            ) : (
              <div>
                {documentos.map((docItem) => {
                  const FileIcon = FILE_ICONS[docItem.tipo] || FileText;
                  return (
                    <div key={docItem.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f3f4f6', transition: 'background .15s' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileIcon size={14} style={{ color: '#4b5563' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docItem.nombre}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
                          {docItem.nombreArchivo || docItem.archivoPath?.split('/').pop()} · {formatBytes(docItem.tamano)} · {formatDate(docItem.createdAt)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a href={docItem.archivoUrl} target="_blank" rel="noopener noreferrer" download style={{ padding: 6, borderRadius: 4, border: '1px solid #e5e7eb', color: '#4b5563', background: '#fff', display: 'flex', cursor: 'pointer' }}>
                          <Download size={14} />
                        </a>
                        <button onClick={() => handleDeleteDocument(docItem)} style={{ padding: 6, borderRadius: 4, border: '1px solid #e5e7eb', color: '#ef4444', background: '#fff', display: 'flex', cursor: 'pointer' }}>
                          <Trash2 size={14} />
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

      {/* ── Tab: Auditoria ── */}
      {activeTab === 'auditoria' && (
        <div style={cardStyle}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>Registro de auditoria</div>
          {auditLoading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: '#e5e7eb', flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: 120, marginBottom: 6 }} />
                    <div style={{ height: 10, background: '#f3f4f6', borderRadius: 4, width: 180 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : auditLog.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Shield size={32} style={{ color: '#e5e7eb', marginBottom: 12 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: 0 }}>Sin registros de auditoria</p>
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {auditLog.map((entry) => {
                const actionLabel = {
                  alta_usuario: 'Alta de usuario',
                  edicion_usuario: 'Edicion de usuario',
                  baja_usuario: 'Baja de usuario'
                }[entry.action] || entry.action || 'Accion';

                return (
                  <div key={entry.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: '#d1d5db', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>{actionLabel}</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
                      Por: {entry.actorEmail || 'sistema'} · {formatDate(entry.createdAt)}
                    </p>
                    {entry.payload && Object.keys(entry.payload).length > 0 && (
                      <div style={{ marginTop: 10, border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px', background: '#fafafa' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Detalles del cambio</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {Object.entries(entry.payload).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 10, color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 8px', background: '#fff' }}>
                              <span style={{ fontWeight: 600 }}>{k}:</span> {Array.isArray(v) ? v.join(', ') : String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Gafete ── */}
      {activeTab === 'gafete' && (
        <div>
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: 12, fontWeight: 700, color: '#111' }}>Generar Gafete</div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 14px' }}>
                Gafete imprimible con foto, nombre completo y cedula profesional.
                {!userData.fotoPerfil && <span style={{ fontWeight: 600 }}> Sube una foto desde la pestana Informacion para personalizarlo.</span>}
              </p>
              <button
                onClick={handlePrintBadge}
                style={{ border: '1px solid #111', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#111', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={14} /> Imprimir Gafete
              </button>
            </div>
          </div>
          {/* Badge Preview */}
          <div style={cardStyle}>
            <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }} ref={badgeRef}>
              <div className="print-badge" style={{ width: '54mm', height: '86mm', border: '2px solid #d1d5db', borderRadius: 8, background: '#fff', overflow: 'hidden', position: 'relative' }}>
                <div style={{ background: '#111', padding: '8px 12px', textAlign: 'center' }}>
                  <p style={{ color: '#fff', fontSize: 7, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', margin: 0 }}>Centro Medico Santa Cruz</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
                  {userData.fotoPerfil ? (
                    <img src={userData.fotoPerfil} alt={userData.nombre} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '2px solid #111' }} crossOrigin="anonymous" />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 6, border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#111', background: '#f3f4f6' }}>
                      {initials}
                    </div>
                  )}
                </div>
                <div style={{ padding: '0 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#111', margin: 0, fontFamily: 'Sora, system-ui, sans-serif' }}>{userData.nombre}</p>
                  <p style={{ fontSize: 7, color: '#6b7280', margin: '2px 0', fontWeight: 600 }}>{roleLabel}</p>
                  {cedula && (
                    <div style={{ paddingTop: 6 }}>
                      <p style={{ fontSize: 6, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', margin: 0 }}>Cedula Profesional</p>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#111', margin: '2px 0' }}>{cedula}</p>
                    </div>
                  )}
                  {asignacion && (
                    <div style={{ paddingTop: 4 }}>
                      <p style={{ fontSize: 6, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', margin: 0 }}>Asignacion</p>
                      <p style={{ fontSize: 7, color: '#4b5563', margin: '2px 0', fontWeight: 600 }}>{asignacion}</p>
                    </div>
                  )}
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid #e5e7eb', padding: '5px 8px', textAlign: 'center', background: '#fafafa' }}>
                  <p style={{ fontSize: 5, color: '#9ca3af', margin: 0 }}>Valido al {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
