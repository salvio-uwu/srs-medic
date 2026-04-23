import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Send, Paperclip, Mic, Image as ImageIcon, 
  FileText, Hash, Search, MoreVertical, Plus, Loader2, Square,
  Smile, Settings, Info, CheckCheck, MessageSquare, Users, BellRing
} from 'lucide-react';
import { db, storage } from '../config/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, setDoc, doc, updateDoc, limit, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';

const ChatPanel = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const USERS_CACHE_KEY = 'chat_users_cache_v1';
  const USERS_CACHE_TTL = 10 * 60 * 1000;
  const CHANNELS_LIMIT = 30;
  const PRIVATE_CHATS_LIMIT = 80;
  const MESSAGES_LIMIT = 80;
  
  const [activeTab, setActiveTab] = useState('canales'); 
  const [activeChat, setActiveChat] = useState({ id: 'global', nombre: 'General', tipo: 'canal' });
  
  const [canales, setCanales] = useState([]);
  const [privadosMeta, setPrivadosMeta] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  
  // Estados para Notificaciones y Ordenamiento
  const [chatsNoLeidos, setChatsNoLeidos] = useState({});
  
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  
  const getMillis = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatHoraActividad = (value) => {
    const ms = getMillis(value);
    if (!ms) return '--:--';
    return new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatRelativeTime = (value) => {
    const ms = getMillis(value);
    if (!ms) return '';
    const date = new Date(ms);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - msgDay) / 86400000);
    if (diffDays === 0) return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return date.toLocaleDateString('es-MX', { weekday: 'short' });
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
  };

  const canCreateChannels = useMemo(() => {
    const rol = (user?.rol || '').toLowerCase();
    const isAdmin = rol === 'admin' || rol === 'admin_maestro';
    const delegated = user?.chatCanCreateChannels === true || user?.canManageChannels === true;
    const permisos = Array.isArray(user?.permisos) ? user.permisos : [];
    return isAdmin || delegated || permisos.includes('chat:create-channel');
  }, [user]);

  // 1. CARGA DE CANALES (limitada para ahorro de lecturas)
  useEffect(() => {
    if (!isOpen || !user) return;

    const qCanales = query(collection(db, "canales"), orderBy("ultimoMensajeAt", "desc"), limit(CHANNELS_LIMIT));
    const unsubCanales = onSnapshot(qCanales, (snap) => {
      const canalesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Asegurar que exista el canal global
      if (!canalesData.find(c => c.id === 'global')) {
         canalesData.push({ id: 'global', nombre: 'General', creador: 'Sistema', ultimoMensajeAt: 0 });
      }
      
      // Lógica de notificación visual
      snap.docChanges().forEach((change) => {
        if (change.type === "modified" || change.type === 'added') {
          const canalActualizado = change.doc.data();
          if (canalActualizado.ultimoRemitenteId !== user.uid && activeChat.id !== change.doc.id) {
            setChatsNoLeidos(prev => ({ ...prev, [change.doc.id]: (prev[change.doc.id] || 0) + 1 }));
          }
        }
      });

      setCanales(canalesData);
    });

    return () => unsubCanales();
  }, [isOpen, user, activeChat.id]);

  // 2. CARGA DE METADATOS DE CHATS PRIVADOS (orden y unread sin abrir cada chat)
  useEffect(() => {
    if (!isOpen || !user?.uid) return;

    const qPrivados = query(
      collection(db, "chats_privados"),
      where('participantes', 'array-contains', user.uid),
      limit(PRIVATE_CHATS_LIMIT)
    );

    const unsubPrivados = onSnapshot(qPrivados, (snap) => {
      const meta = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .map(item => {
          const participantes = Array.isArray(item.participantes) ? item.participantes : [];
          const otherUserId = participantes.find(pid => pid !== user.uid) || null;
          return { ...item, otherUserId };
        })
        .sort((a, b) => getMillis(b.ultimoMensajeAt) - getMillis(a.ultimoMensajeAt));

      snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const participantes = Array.isArray(data.participantes) ? data.participantes : [];
        const otherUserId = participantes.find(pid => pid !== user.uid);
        if (!otherUserId) return;
        if ((change.type === 'modified' || change.type === 'added') && data.ultimoRemitenteId !== user.uid) {
          if (!(activeChat.tipo === 'privado' && activeChat.id === otherUserId)) {
            setChatsNoLeidos(prev => ({ ...prev, [otherUserId]: (prev[otherUserId] || 0) + 1 }));
          }
        }
      });

      setPrivadosMeta(meta);
    });

    return () => unsubPrivados();
  }, [isOpen, user?.uid, activeChat.id, activeChat.tipo]);

  // 3. CARGA DE USUARIOS CON CACHE LOCAL (evita lecturas repetidas)
  useEffect(() => {
    if (!isOpen || !user?.uid) return;

    const fetchUsuarios = async () => {
      try {
        const cachedRaw = sessionStorage.getItem(USERS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (Date.now() - cached.savedAt < USERS_CACHE_TTL && Array.isArray(cached.users)) {
            setUsuarios(cached.users.filter(u => u.id !== user.uid));
            return;
          }
        }
      } catch {
        // cache corrupto, se recarga desde Firebase
      }

      const snap = await getDocs(collection(db, 'users'));
      const usersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsuarios(usersList.filter(u => u.id !== user.uid));
      sessionStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), users: usersList }));
    };

    fetchUsuarios();
  }, [isOpen, user?.uid]);

  // 4. CARGA DE MENSAJES DEL CHAT ACTIVO (acotada por límite)
  useEffect(() => {
    if (!user || !isOpen || !activeChat.id) return;

    // Al entrar al chat, marcamos como leído
    setChatsNoLeidos(prev => ({ ...prev, [activeChat.id]: 0 }));

    let collectionRef;
    if (activeChat.tipo === 'canal') {
      collectionRef = collection(db, "canales", activeChat.id, "mensajes");
    } else {
      const chatId = [user.uid, activeChat.id].sort().join('_');
      collectionRef = collection(db, "chats_privados", chatId, "mensajes");
    }

    const q = query(collectionRef, orderBy("timestamp", "desc"), limit(MESSAGES_LIMIT));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      setMensajes(docs);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    });
    return () => unsubscribe();
  }, [user, isOpen, activeChat, MESSAGES_LIMIT]);

  // Limpieza del micrófono al cerrar
  useEffect(() => {
    if (!isOpen) detenerGrabacion();
  }, [isOpen]);

  const crearCanal = async (e) => {
    e.preventDefault();
    if (!canCreateChannels) {
      alert('No tienes permisos para crear canales.');
      return;
    }
    if (!newChannelName.trim()) return;
    try {
      const canalId = newChannelName.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(db, "canales", canalId), {
        nombre: newChannelName,
        creador: user.uid,
        timestamp: serverTimestamp(),
        ultimoMensajeAt: serverTimestamp()
      });
      setNewChannelName('');
      setIsCreatingChannel(false);
      setActiveChat({ id: canalId, nombre: newChannelName, tipo: 'canal' });
    } catch (error) {
      console.error("Error al crear canal:", error);
    }
  };

  const enviarPayload = async (texto, archivoUrl = null, tipo = 'texto', extraData = {}) => {
    let collectionRef;
    let parentDocRef;

    if (activeChat.tipo === 'canal') {
      collectionRef = collection(db, "canales", activeChat.id, "mensajes");
      parentDocRef = doc(db, "canales", activeChat.id);
    } else {
      const chatId = [user.uid, activeChat.id].sort().join('_');
      collectionRef = collection(db, "chats_privados", chatId, "mensajes");
      parentDocRef = doc(db, "chats_privados", chatId); // Para ordenar privados después
    }

    try {
      // 1. Guardar el mensaje
      await addDoc(collectionRef, {
        texto: texto || '',
        archivoUrl,
        tipo,
        remitenteId: user.uid,
        remitenteNombre: user.nombre || "Usuario",
        remitenteRol: user.rol || "general",
        timestamp: serverTimestamp(),
        ...extraData
      });

      // 2. Actualizar el padre para "Bumping" (mover el chat hasta arriba)
      if (activeChat.tipo === 'canal') {
        await setDoc(parentDocRef, {
          ultimoMensajeAt: serverTimestamp(),
          ultimoRemitenteId: user.uid,
          ultimoTexto: tipo === 'texto' ? texto : `Envió un ${tipo}`,
          nombre: activeChat.nombre || 'General'
        }, { merge: true });
      } else {
        const participantes = [user.uid, activeChat.id].sort();
        await setDoc(parentDocRef, {
          participantes,
          ultimoMensajeAt: serverTimestamp(),
          ultimoRemitenteId: user.uid,
          ultimoTexto: tipo === 'texto' ? texto : `Envió un ${tipo}`,
          actualizadoAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Error escribiendo payload:", error);
    }
  };

  const enviarMensajeTexto = (e) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;
    enviarPayload(nuevoMensaje, null, 'texto');
    setNuevoMensaje('');
  };

  const procesarSubidaArchivo = async (file, tipo) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${user.uid}.${fileExt}`;
    const storageRef = ref(storage, `chat_files/${activeChat.id}/${fileName}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(Math.round(progress));
      },
      (error) => {
        console.error("Error en Storage:", error);
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await enviarPayload(file.name, downloadURL, tipo, { peso: file.size });
        setUploading(false);
        setUploadProgress(0);
      }
    );
  };

  const handleFileChange = (e, tipo) => {
    const file = e.target.files[0];
    if (file) procesarSubidaArchivo(file, tipo);
    e.target.value = null;
  };

  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        await procesarSubidaArchivo(audioFile, 'audio');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

    } catch (err) {
      console.error("Micrófono inaccesible:", err);
      alert("No se pudo acceder al micrófono.");
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : 'US';

  const privadosByUserId = useMemo(() => {
    const map = new Map();
    privadosMeta.forEach((item) => {
      if (item.otherUserId) map.set(item.otherUserId, item);
    });
    return map;
  }, [privadosMeta]);

  const canalesFiltrados = canales.filter(c => c.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

  // Conversaciones activas: solo usuarios CON mensajes previos, ordenadas por no leídos y luego por fecha
  const conversacionesActivas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return privadosMeta
      .map(meta => {
        const otherUser = usuarios.find(u => u.id === meta.otherUserId);
        const unread = chatsNoLeidos[meta.otherUserId] || 0;
        return {
          ...meta,
          nombre: otherUser?.nombre || `Usuario ${(meta.otherUserId || '').slice(0, 6)}`,
          rol: otherUser?.rol,
          isOnline: otherUser?.isOnline || false,
          unread
        };
      })
      .filter(c => !term || c.nombre.toLowerCase().includes(term))
      .sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1;
        if (a.unread === 0 && b.unread > 0) return 1;
        return getMillis(b.ultimoMensajeAt) - getMillis(a.ultimoMensajeAt);
      });
  }, [privadosMeta, usuarios, chatsNoLeidos, searchTerm]);

  // Contactos para nuevo mensaje: se muestra solo cuando el usuario busca
  const contactosNuevoChat = useMemo(() => {
    if (!showNewChat) return [];
    const term = newChatSearch.trim().toLowerCase();
    if (!term) return usuarios.slice(0, 20);
    return usuarios.filter(u => u.nombre?.toLowerCase().includes(term)).slice(0, 20);
  }, [showNewChat, newChatSearch, usuarios]);

  const totalNoLeidos = useMemo(
    () => Object.values(chatsNoLeidos).reduce((acc, value) => acc + (Number(value) || 0), 0),
    [chatsNoLeidos]
  );

  // Renderizado Condicional: Evitar que el componente bloquee la UI si no está abierto
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 pointer-events-auto" onClick={onClose} />
      
      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileChange(e, 'documento')} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" />
      <input type="file" ref={imageInputRef} className="hidden" onChange={(e) => handleFileChange(e, 'imagen')} accept="image/jpeg, image/png, image/gif, image/webp" />

      {/* VENTANA PRINCIPAL GLASSMORPHISM */}
      <div className="w-full max-w-[1020px] h-[88vh] max-h-[860px] rounded-3xl shadow-[0_32px_64px_-12px_rgba(15,23,42,0.35)] flex overflow-hidden pointer-events-auto border border-white/60 bg-white/[0.88] backdrop-blur-xl" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", willChange: 'transform', transform: 'translateZ(0)' }}>
        
        {/* ═══ SIDEBAR ═══ */}
        <div className="w-[300px] sm:w-[320px] flex flex-col z-10 bg-slate-50/80 border-r border-slate-200/60">
          
          {/* Header sidebar */}
          <div className="px-5 py-4 shrink-0 z-20 bg-[linear-gradient(135deg,#0f172a,#1e40af)] rounded-br-2xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center font-bold text-sm text-white">
                  {getInitials(user?.nombre)}
                </div>
                <div>
                  <h2 className="font-bold text-[15px] text-white leading-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Mensajes</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.6)]" />
                    <p className="text-[10px] text-blue-200 font-medium">En línea</p>
                  </div>
                </div>
              </div>
              {totalNoLeidos > 0 && (
                <div className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold text-white inline-flex items-center gap-1.5">
                  <BellRing size={11} /> {totalNoLeidos}
                </div>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div className="p-3 shrink-0">
            <div className="flex p-1 rounded-xl border border-slate-200/60 bg-white/70">
              <button onClick={() => setActiveTab('canales')} className={`flex-1 py-2 text-xs font-bold rounded-lg flex justify-center items-center gap-2 ${activeTab === 'canales' ? 'bg-white text-[#0077B6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Hash size={13}/> Canales
              </button>
              <button onClick={() => { setActiveTab('privados'); setShowNewChat(false); }} className={`flex-1 py-2 text-xs font-bold rounded-lg flex justify-center items-center gap-2 ${activeTab === 'privados' ? 'bg-white text-[#0077B6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <MessageSquare size={13}/> Directos {conversacionesActivas.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'privados' ? 'bg-blue-50 text-[#0077B6]' : 'bg-white/60 text-slate-500'}`}>{conversacionesActivas.length}</span>}
              </button>
            </div>
          </div>

          {/* Buscador glass */}
          <div className="px-3 pb-2 shrink-0">
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-[#0077B6] transition-colors" size={15}/>
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..." 
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/60 bg-white/90 text-sm font-medium outline-none focus:border-[#0077B6]/30 focus:ring-2 focus:ring-[#0077B6]/10 transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 custom-scrollbar" style={{ willChange: 'scroll-position', contain: 'content' }}>
            {activeTab === 'canales' && (
              <>
                <div className="flex justify-between items-center px-3 py-2 mt-1">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canales</span>
                   {canCreateChannels ? (
                    <button onClick={() => setIsCreatingChannel(!isCreatingChannel)} className="text-[#0077B6] hover:bg-white/60 p-1.5 rounded-lg transition-colors" title="Nuevo Canal"><Plus size={15}/></button>
                   ) : (
                    <span className="text-[9px] font-medium text-slate-400 bg-white/50 px-2 py-0.5 rounded-full">Solo Admin</span>
                   )}
                </div>
                
                {canCreateChannels && isCreatingChannel && (
                  <form onSubmit={crearCanal} className="mx-1 p-3 mb-3 rounded-xl border border-slate-200/60 bg-white/90 shadow-sm">
                    <p className="text-xs font-bold text-slate-700 mb-2">Crear canal</p>
                    <input autoFocus type="text" value={newChannelName} onChange={(e)=>setNewChannelName(e.target.value)} placeholder="Ej. Urgencias" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200/60 bg-white outline-none focus:border-slate-300 mb-2" />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={()=>setIsCreatingChannel(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-white/60 rounded-lg">Cancelar</button>
                      <button type="submit" disabled={!newChannelName} className="px-3 py-1.5 text-xs font-bold text-white bg-[#0077B6] hover:bg-[#006098] rounded-lg disabled:opacity-50 shadow-sm">Crear</button>
                    </div>
                  </form>
                )}

                {canalesFiltrados.map(c => {
                  const isActive = activeChat.id === c.id;
                  const unread = chatsNoLeidos[c.id] || 0;
                  return (
                    <button key={c.id} onClick={() => setActiveChat({ id: c.id, nombre: c.nombre, tipo: 'canal' })}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 relative ${
                        isActive ? 'bg-white shadow-sm' : 'hover:bg-white/60 border border-transparent'
                      }`}>
                      
                      {unread > 0 && (
                        <div className="absolute top-1.5 right-2 min-w-[18px] h-[18px] px-1 bg-[#0077B6] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                          {unread > 99 ? '99+' : unread}
                        </div>
                      )}

                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-gradient-to-br from-[#0077B6] to-[#2998C6] text-white shadow-sm' : 'bg-white border border-slate-200/60 text-slate-500'
                      }`}>
                        <Hash size={17}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[13px] block truncate ${unread ? 'text-slate-900 font-bold' : isActive ? 'text-[#0077B6] font-bold' : 'font-semibold text-slate-700'}`}>{c.nombre}</span>
                          <span className={`text-[10px] shrink-0 font-medium ${unread ? 'text-[#0077B6] font-bold' : 'text-slate-400'}`}>{formatRelativeTime(c.ultimoMensajeAt)}</span>
                        </div>
                        <span className={`text-[11px] truncate block mt-0.5 ${unread ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                          {c.ultimoTexto || 'Canal general'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {activeTab === 'privados' && (
              <>
                {showNewChat ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 mt-1">
                      <button onClick={() => { setShowNewChat(false); setNewChatSearch(''); }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded-lg transition-colors">
                        <X size={14} />
                      </button>
                      <span className="text-xs font-bold text-slate-700">Nuevo mensaje</span>
                    </div>
                    <div className="px-3 pb-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-[#0077B6]" size={15} />
                        <input
                          autoFocus
                          type="text"
                          value={newChatSearch}
                          onChange={(e) => setNewChatSearch(e.target.value)}
                          placeholder="Buscar por nombre..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/60 bg-white/90 text-sm font-medium outline-none focus:border-[#0077B6]/40 focus:ring-2 focus:ring-[#0077B6]/10 transition-colors"
                        />
                      </div>
                    </div>
                    {contactosNuevoChat.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center">
                          <Search size={22} className="text-slate-300" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">{newChatSearch ? 'Sin resultados' : 'Escribe un nombre'}</p>
                      </div>
                    ) : (
                      contactosNuevoChat.map(u => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setActiveChat({ id: u.id, nombre: u.nombre, tipo: 'privado', rol: u.rol, isOnline: u.isOnline });
                            setShowNewChat(false);
                            setNewChatSearch('');
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-white/70 border border-transparent"
                        >
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/60 text-slate-600 flex items-center justify-center text-xs font-bold">
                              {getInitials(u.nombre)}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-700 truncate">{u.nombre}</p>
                            <p className="text-[10px] text-slate-400 capitalize font-medium">{u.rol?.replace('_', ' ') || 'Staff'}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center px-3 py-2 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversaciones</span>
                      <button
                        onClick={() => setShowNewChat(true)}
                        className="text-[#0077B6] hover:bg-white/60 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                        title="Nuevo mensaje"
                      >
                        <Plus size={13} />
                        <span className="text-[10px] font-bold">Nuevo</span>
                      </button>
                    </div>

                    {conversacionesActivas.length === 0 ? (
                      <div className="px-4 py-14 flex flex-col items-center text-center gap-3">
                        <div className="w-16 h-16 bg-white border border-slate-200/60 rounded-2xl flex items-center justify-center">
                          <MessageSquare size={26} className="text-slate-300" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-600">Sin conversaciones</p>
                          <p className="text-[11px] text-slate-400 mt-1">Toca <span className="text-[#0077B6] font-bold">+ Nuevo</span> para iniciar</p>
                        </div>
                      </div>
                    ) : (
                      conversacionesActivas.map(conv => {
                        const isActive = activeChat.tipo === 'privado' && activeChat.id === conv.otherUserId;
                        return (
                          <button
                            key={conv.id}
                            onClick={() => setActiveChat({ id: conv.otherUserId, nombre: conv.nombre, tipo: 'privado', rol: conv.rol, isOnline: conv.isOnline })}
                            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 ${
                              isActive ? 'bg-white shadow-sm' : 'hover:bg-white/60 border border-transparent'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                                isActive ? 'bg-gradient-to-br from-[#0077B6] to-[#2998C6] text-white shadow-sm' : 'bg-white border border-slate-200/60 text-slate-600'
                              }`}>
                                {getInitials(conv.nombre)}
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${conv.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {conv.unread > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#0077B6] rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center">
                                  {conv.unread > 99 ? '99+' : conv.unread}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-[13px] truncate ${
                                  conv.unread > 0 ? 'font-bold text-slate-900' : isActive ? 'font-bold text-[#0077B6]' : 'font-semibold text-slate-700'
                                }`}>
                                  {conv.nombre}
                                </p>
                                <span className={`text-[10px] shrink-0 font-medium ${
                                  conv.unread > 0 ? 'text-[#0077B6] font-bold' : 'text-slate-400'
                                }`}>
                                  {formatRelativeTime(conv.ultimoMensajeAt)}
                                </span>
                              </div>
                              <p className={`text-[11px] truncate mt-0.5 ${
                                conv.unread > 0 ? 'text-slate-600 font-semibold' : 'text-slate-400'
                              }`}>
                                {conv.ultimoTexto || 'Iniciar conversación'}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══ ÁREA PRINCIPAL DEL CHAT ═══ */}
        <div className="flex-1 flex flex-col relative bg-white/40">
          
          {/* Header chat activo */}
          <div className="h-[60px] px-5 flex justify-between items-center shrink-0 z-10 bg-white/80 border-b border-slate-200/60">
            <div className="flex items-center gap-3">
              {activeChat.tipo === 'canal' ? (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0077B6]/10 to-[#2998C6]/10 border border-[#0077B6]/20 flex items-center justify-center text-[#0077B6]"><Hash size={19}/></div>
              ) : (
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0077B6] to-[#2998C6] flex items-center justify-center text-white font-bold text-sm shadow-md">{getInitials(activeChat.nombre)}</div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${activeChat.isOnline ? 'bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,.5)]' : 'bg-slate-400'}`} />
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-800 text-[15px] leading-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{activeChat.nombre}</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {activeChat.tipo === 'canal' ? `${usuarios.length + 1} miembros` : (activeChat.isOnline ? <span className="text-emerald-600">En línea</span> : 'Desconectado')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
               <button className="p-2 text-slate-400 hover:text-[#0077B6] hover:bg-white/60 rounded-xl transition-all" title="Buscar en Chat"><Search size={17}/></button>
               <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50/60 rounded-xl transition-all" title="Cerrar"><X size={18}/></button>
            </div>
          </div>

          {/* Historial de mensajes */}
          <div className="flex-1 px-5 py-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar" ref={chatScrollRef} style={{ background: '#f6f8fa', willChange: 'scroll-position', contain: 'strict' }}>
            
            {mensajes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-white border border-slate-200/60 rounded-2xl flex items-center justify-center shadow-sm mb-4">
                  <MessageSquare size={30} className="text-slate-300"/>
                </div>
                <h3 className="text-base font-bold text-slate-600" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Inicia la conversación</h3>
                <p className="text-[13px] text-slate-400 mt-1">Envía un mensaje para comenzar</p>
              </div>
            ) : (
              mensajes.map((msg, index) => {
                const esMio = msg.remitenteId === user?.uid;
                const msjAnterior = index > 0 ? mensajes[index - 1] : null;
                const mismoRemitente = msjAnterior && msjAnterior.remitenteId === msg.remitenteId;
                const diferenciaTiempo = msjAnterior ? (msg.timestamp?.seconds - msjAnterior.timestamp?.seconds) : 0;
                const agrupar = mismoRemitente && diferenciaTiempo < 300; 

                return (
                  <div key={msg.id} className={`flex w-full ${esMio ? 'justify-end' : 'justify-start'} ${agrupar ? '-mt-2' : 'mt-1'}`}>
                    {!esMio && !agrupar && (
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 flex items-center justify-center text-[9px] font-bold text-slate-600 mr-2 shrink-0 self-end mb-1">
                        {getInitials(msg.remitenteNombre)}
                      </div>
                    )}
                    {!esMio && agrupar && <div className="w-9 shrink-0"></div>}

                    <div className={`flex flex-col max-w-[70%] ${esMio ? 'items-end' : 'items-start'}`}>
                      {!agrupar && !esMio && (
                        <span className="text-[11px] font-bold text-slate-500 mb-1 ml-1 flex items-center gap-1.5">
                          {msg.remitenteNombre} 
                          <span className="text-[9px] font-semibold bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-400 uppercase">{msg.remitenteRol || 'Staff'}</span>
                        </span>
                      )}
                      
                      <div className={`relative px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        esMio 
                          ? 'bg-gradient-to-br from-[#0077B6] to-[#2998C6] text-white rounded-2xl rounded-br-md shadow-[0_2px_8px_rgba(0,119,182,0.15)]' 
                          : 'bg-white border border-slate-200/50 text-slate-700 rounded-2xl rounded-bl-md shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
                      }`}>
                        
                        {msg.tipo === 'texto' && <p className="whitespace-pre-wrap">{msg.texto}</p>}
                        
                        {msg.tipo === 'imagen' && (
                          <a href={msg.archivoUrl} target="_blank" rel="noreferrer" className="block -mx-1.5 -mt-1 -mb-1">
                            <img src={msg.archivoUrl} alt="Adjunto" className="max-w-full h-auto max-h-64 rounded-xl cursor-pointer hover:opacity-90 transition-opacity" />
                          </a>
                        )}

                        {msg.tipo === 'documento' && (
                          <a href={msg.archivoUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-3 p-2 rounded-xl border ${
                            esMio ? 'bg-white/15 border-white/25 hover:bg-white/25' : 'bg-slate-50 border-slate-200/50 hover:bg-slate-100'
                          }`}>
                            <div className={`p-2 rounded-lg ${esMio ? 'bg-white/20' : 'bg-white text-slate-500'}`}><FileText size={22}/></div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm truncate max-w-[200px]">{msg.texto}</span>
                              <span className="text-[10px] opacity-70">Descargar</span>
                            </div>
                          </a>
                        )}

                        {msg.tipo === 'audio' && (
                          <audio controls src={msg.archivoUrl} className={`h-10 max-w-[220px] rounded-full ${esMio ? 'invert' : ''}`} />
                        )}

                        <div className={`flex items-center justify-end gap-1 mt-1.5 -mb-0.5 ${esMio ? 'text-blue-200' : 'text-slate-400'}`}>
                          <span className="text-[9px] font-medium">{formatTimestamp(msg.timestamp)}</span>
                          {esMio && <CheckCheck size={11} className={msg.visto ? "text-blue-200" : "opacity-60"} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Barra de escritura glass */}
          <div className="px-4 py-3 shrink-0 z-20 bg-white/80 border-t border-slate-200/60">
            {uploading && (
              <div className="mb-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-[#0077B6] text-sm font-medium">
                  <Loader2 size={15} className="animate-spin"/>
                  Enviando...
                </div>
                <div className="w-1/3 bg-blue-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[#0077B6] h-full transition-all duration-300 rounded-full" style={{width: `${uploadProgress}%`}}></div>
                </div>
              </div>
            )}

            <form onSubmit={enviarMensajeTexto} className="flex items-end rounded-2xl border border-slate-200/60 bg-white p-1.5 focus-within:border-[#0077B6]/30 focus-within:ring-2 focus-within:ring-[#0077B6]/10 transition-colors">
              {isRecording ? (
                 <div className="flex-1 flex items-center justify-between px-3 py-2">
                   <div className="flex items-center gap-3 text-rose-600 bg-rose-50/60 px-3 py-1.5 rounded-full border border-rose-100/60">
                      <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse" />
                      <span className="font-mono text-sm font-bold tracking-wider">{formatTime(recordingTime)}</span>
                      <span className="text-[11px] font-medium">Grabando...</span>
                   </div>
                   <button type="button" onClick={detenerGrabacion} className="px-3 py-1.5 bg-rose-100/60 text-rose-700 hover:bg-rose-600 hover:text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors">
                      <Square size={12} fill="currentColor" /> Detener
                   </button>
                 </div>
              ) : (
                 <>
                    <div className="flex gap-0.5 pb-0.5 px-1">
                      <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 text-slate-400 hover:text-[#0077B6] hover:bg-white/60 rounded-xl transition-colors" title="Foto o GIF">
                        <ImageIcon size={18} />
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-[#0077B6] hover:bg-white/60 rounded-xl transition-colors" title="Documento">
                        <Paperclip size={18} />
                      </button>
                    </div>

                    <textarea 
                      value={nuevoMensaje}
                      onChange={(e) => setNuevoMensaje(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeTexto(e); } }}
                      placeholder={`Mensaje a ${activeChat.nombre}`}
                      className="flex-1 px-3 py-2 text-[13px] outline-none text-slate-700 bg-transparent resize-none min-h-[40px] max-h-[110px] custom-scrollbar placeholder:text-slate-400"
                      rows={1}
                      disabled={uploading}
                    />

                    <div className="flex pb-0.5 px-1">
                      {nuevoMensaje.trim() ? (
                         <button type="submit" disabled={uploading} className="p-2.5 bg-gradient-to-br from-[#0077B6] to-[#2998C6] text-white rounded-xl hover:shadow-[0_4px_12px_rgba(0,119,182,0.3)] disabled:opacity-50 transition-all">
                           <Send size={16} />
                         </button>
                      ) : (
                         <button type="button" onClick={iniciarGrabacion} disabled={uploading} className="p-2.5 bg-slate-100 text-slate-500 hover:text-white hover:bg-rose-500 rounded-xl disabled:opacity-50 transition-colors">
                           <Mic size={16} />
                         </button>
                      )}
                    </div>
                 </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;