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
  const usuariosFiltrados = usuarios
    .filter(u => u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aMeta = privadosByUserId.get(a.id);
      const bMeta = privadosByUserId.get(b.id);
      const diff = getMillis(bMeta?.ultimoMensajeAt) - getMillis(aMeta?.ultimoMensajeAt);
      if (diff !== 0) return diff;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

  const totalNoLeidos = useMemo(
    () => Object.values(chatsNoLeidos).reduce((acc, value) => acc + (Number(value) || 0), 0),
    [chatsNoLeidos]
  );

  // Renderizado Condicional: Evitar que el componente bloquee la UI si no está abierto
  if (!isOpen) return null;

  return (
    // CONTENEDOR FLOTANTE (POP-UP) EN VEZ DE PANEL LATERAL
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[4px] pointer-events-auto" />
      
      {/* Inputs ocultos para archivos (GIFs permitidos explícitamente) */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileChange(e, 'documento')} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" />
      <input type="file" ref={imageInputRef} className="hidden" onChange={(e) => handleFileChange(e, 'imagen')} accept="image/jpeg, image/png, image/gif, image/webp" />

      {/* LA VENTANA DEL CHAT (INTERACTIVA) */}
      <div className="w-full max-w-[980px] h-[85vh] max-h-[820px] bg-white rounded-2xl shadow-[0_24px_48px_rgba(15,23,42,0.18)] flex overflow-hidden border border-slate-200 pointer-events-auto transform transition-all animate-in zoom-in-95 duration-200 font-sans">
        
        {/* --- SIDEBAR IZQUIERDO --- */}
        <div className="w-72 sm:w-80 bg-slate-50 border-r border-slate-200 flex flex-col z-10">
          
          {/* Header del Pop-up */}
          <div className="h-16 px-4 bg-slate-900 text-white flex justify-between items-center shrink-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 border-2 border-slate-700 flex items-center justify-center font-bold text-sm shadow-inner">
                {getInitials(user?.nombre)}
              </div>
              <div>
                <h2 className="font-bold text-sm leading-tight">Comunicaciones</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <p className="text-[10px] text-slate-300 font-medium truncate w-32">En línea</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 rounded-full bg-slate-700 text-[10px] font-bold text-slate-100 inline-flex items-center gap-1">
                <BellRing size={11} /> {totalNoLeidos}
              </div>
            </div>
          </div>
          
          {/* Pestañas Canales / Privados */}
          <div className="p-3 shrink-0 bg-slate-50">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button onClick={() => setActiveTab('canales')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex justify-center items-center gap-2 ${activeTab === 'canales' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Hash size={14}/> Canales <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-[10px]">{canales.length}</span>
              </button>
              <button onClick={() => setActiveTab('privados')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex justify-center items-center gap-2 ${activeTab === 'privados' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Users size={14}/> Directos <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-[10px]">{usuarios.length}</span>
              </button>
            </div>
          </div>

          {/* Buscador */}
          <div className="px-3 pb-2 shrink-0">
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar conversaciones..." 
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          {/* Lista de Chats */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 custom-scrollbar">
            {activeTab === 'canales' && (
              <>
                <div className="flex justify-between items-center px-3 py-2 mt-1">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversaciones Recientes</span>
                   {canCreateChannels ? (
                    <button onClick={() => setIsCreatingChannel(!isCreatingChannel)} className="text-blue-600 hover:bg-blue-50 p-1 rounded-md transition-colors tooltip" title="Nuevo Canal"><Plus size={16}/></button>
                   ) : (
                    <span className="text-[10px] font-bold text-slate-400">Solo Admin</span>
                   )}
                </div>
                
                 {canCreateChannels && isCreatingChannel && (
                  <form onSubmit={crearCanal} className="mx-2 p-3 mb-3 bg-white border border-blue-100 shadow-sm rounded-xl">
                    <p className="text-xs font-bold text-slate-700 mb-2">Crear nuevo canal</p>
                    <input autoFocus type="text" value={newChannelName} onChange={(e)=>setNewChannelName(e.target.value)} placeholder="Ej. Urgencias" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-blue-500 mb-2 bg-slate-50" />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={()=>setIsCreatingChannel(false)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                      <button type="submit" disabled={!newChannelName} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">Crear</button>
                    </div>
                  </form>
                )}

                {canalesFiltrados.map(c => (
                  <button key={c.id} onClick={() => setActiveChat({ id: c.id, nombre: c.nombre, tipo: 'canal' })}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all relative ${activeChat.id === c.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-100 text-slate-700 border border-transparent'}`}>
                    
                    {/* INDICADOR DE MENSAJE NO LEÍDO */}
                    {chatsNoLeidos[c.id] && (
                      <div className="absolute top-2 right-2 min-w-5 h-5 px-1 bg-rose-500 rounded-full border-2 border-white shadow-sm text-[10px] font-bold text-white flex items-center justify-center">
                        {chatsNoLeidos[c.id] > 99 ? '99+' : chatsNoLeidos[c.id]}
                      </div>
                    )}

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeChat.id === c.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 shadow-sm'}`}>
                      <Hash size={20}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm block truncate ${chatsNoLeidos[c.id] ? 'text-slate-900 font-extrabold' : (activeChat.id === c.id ? 'text-blue-900 font-bold' : 'font-semibold')}`}>{c.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">{formatHoraActividad(c.ultimoMensajeAt)}</span>
                      </div>
                      <span className={`text-[11px] truncate block ${chatsNoLeidos[c.id] ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                        {c.ultimoTexto ? c.ultimoTexto : 'Canal general'}
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {activeTab === 'privados' && (
              <>
                <div className="px-3 py-2 mt-1">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Directorio Staff</span>
                </div>
                {usuariosFiltrados.map(u => (
                  (() => {
                    const privadoMeta = privadosByUserId.get(u.id);
                    const unread = chatsNoLeidos[u.id] || 0;
                    return (
                  <button key={u.id} onClick={() => setActiveChat({ id: u.id, nombre: u.nombre, tipo: 'privado', rol: u.rol, isOnline: u.isOnline })} 
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all ${activeChat.id === u.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-100 border border-transparent'}`}>
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${activeChat.id === u.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                        {getInitials(u.nombre)}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${u.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                      {unread > 0 && (
                        <div className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-rose-500 rounded-full border-2 border-white text-[10px] font-bold text-white flex items-center justify-center">
                          {unread > 99 ? '99+' : unread}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${activeChat.id === u.id ? 'font-bold text-blue-900' : 'text-slate-800 font-semibold'}`}>{u.nombre}</p>
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">{formatHoraActividad(privadoMeta?.ultimoMensajeAt)}</span>
                      </div>
                      <p className={`text-[11px] truncate ${unread > 0 ? 'text-blue-600 font-bold' : 'text-slate-500'} capitalize`}>
                        {privadoMeta?.ultimoTexto || u.rol?.replace('_', ' ') || 'Staff Médico'}
                      </p>
                    </div>
                  </button>
                    );
                  })()
                ))}
              </>
            )}
          </div>
        </div>

        {/* --- ÁREA PRINCIPAL DEL CHAT --- */}
        <div className="flex-1 flex flex-col bg-white relative">
          
          {/* Header del Chat Activo */}
          <div className="h-16 px-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 z-10">
            <div className="flex items-center gap-4">
              {activeChat.tipo === 'canal' ? (
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600"><Hash size={22}/></div>
              ) : (
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">{getInitials(activeChat.nombre)}</div>
                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${activeChat.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-800 text-base leading-tight">{activeChat.nombre}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {activeChat.tipo === 'canal' ? `${usuarios.length + 1} miembros` : (activeChat.isOnline ? 'En línea' : 'Desconectado')}
                </p>
              </div>
            </div>
            
            {/* Controles de la Ventana Flotante */}
            <div className="flex items-center gap-2">
               <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-all shadow-sm tooltip" title="Buscar en Chat"><Search size={18}/></button>
               {/* BOTÓN PARA CERRAR EL POPUP */}
               <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all shadow-sm border border-transparent hover:border-rose-200 tooltip" title="Cerrar Chat"><X size={20}/></button>
            </div>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-slate-50 custom-scrollbar" ref={chatScrollRef}>
            
            {mensajes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <MessageSquare size={32} className="text-blue-300"/>
                </div>
                <h3 className="text-lg font-bold text-slate-700">Comienza la conversación</h3>
                <p className="text-sm">Envía un mensaje o GIF para iniciar el chat</p>
              </div>
            ) : (
              mensajes.map((msg, index) => {
                const esMio = msg.remitenteId === user?.uid;
                const msjAnterior = index > 0 ? mensajes[index - 1] : null;
                const mismoRemitente = msjAnterior && msjAnterior.remitenteId === msg.remitenteId;
                const diferenciaTiempo = msjAnterior ? (msg.timestamp?.seconds - msjAnterior.timestamp?.seconds) : 0;
                const agrupar = mismoRemitente && diferenciaTiempo < 300; 

                return (
                  <div key={msg.id} className={`flex w-full ${esMio ? 'justify-end' : 'justify-start'} ${agrupar ? '-mt-3' : 'mt-2'}`}>
                    {!esMio && !agrupar && (
                      <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-700 mr-2 shrink-0 self-end mb-1">
                        {getInitials(msg.remitenteNombre)}
                      </div>
                    )}
                    {!esMio && agrupar && <div className="w-10 shrink-0"></div>}

                    <div className={`flex flex-col max-w-[70%] ${esMio ? 'items-end' : 'items-start'}`}>
                      {!agrupar && !esMio && (
                        <span className="text-xs font-bold text-slate-600 mb-1 ml-1 flex items-center gap-1">
                          {msg.remitenteNombre} 
                          <span className="text-[9px] font-normal bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 uppercase">{msg.remitenteRol || 'Staff'}</span>
                        </span>
                      )}
                      
                        <div className={`relative group px-4 py-2.5 text-sm border ${
                          esMio ? 'bg-blue-600 text-white border-blue-600 rounded-2xl rounded-br-md' : 'bg-white border-slate-200 text-slate-800 rounded-2xl rounded-bl-md'
                        }`}>
                        
                        {msg.tipo === 'texto' && <p className="whitespace-pre-wrap leading-relaxed">{msg.texto}</p>}
                        
                        {/* SOPORTE PARA IMÁGENES Y GIFS */}
                        {msg.tipo === 'imagen' && (
                          <a href={msg.archivoUrl} target="_blank" rel="noreferrer" className="block -mx-2 -mt-1 -mb-1">
                            <img src={msg.archivoUrl} alt="Adjunto" className="max-w-full h-auto max-h-64 rounded-xl cursor-pointer hover:opacity-95 transition-opacity" />
                          </a>
                        )}

                        {msg.tipo === 'documento' && (
                          <a href={msg.archivoUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-3 p-2 rounded-xl border transition-colors ${esMio ? 'bg-blue-700/40 border-blue-500 hover:bg-blue-700/70' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                            <div className={`p-2 rounded-lg ${esMio ? 'bg-blue-500' : 'bg-slate-200 text-slate-600'}`}><FileText size={24}/></div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm truncate max-w-[200px]">{msg.texto}</span>
                              <span className="text-[10px] opacity-75">Haz clic para descargar</span>
                            </div>
                          </a>
                        )}

                        {msg.tipo === 'audio' && (
                          <audio controls src={msg.archivoUrl} className={`h-10 max-w-[220px] rounded-full ${esMio ? 'invert' : ''}`} />
                        )}

                        <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${esMio ? 'text-blue-200' : 'text-slate-400'}`}>
                          <span className="text-[9px] font-medium">{formatTimestamp(msg.timestamp)}</span>
                          {esMio && <CheckCheck size={12} className={msg.visto ? "text-blue-300" : "opacity-70"} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Barra de escritura */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 z-20">
            {uploading && (
              <div className="mb-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 text-blue-700 text-sm font-medium">
                  <Loader2 size={16} className="animate-spin"/>
                  Enviando archivo...
                </div>
                <div className="w-1/3 bg-blue-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-300" style={{width: `${uploadProgress}%`}}></div>
                </div>
              </div>
            )}

            <form onSubmit={enviarMensajeTexto} className="flex items-end bg-white border border-slate-300 rounded-2xl p-2 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
              {isRecording ? (
                 <div className="flex-1 flex items-center justify-between px-4 py-2">
                   <div className="flex items-center gap-3 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                      <div className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-pulse"></div>
                      <span className="font-mono text-sm font-bold tracking-wider">{formatTime(recordingTime)}</span>
                      <span className="text-xs font-medium">Grabando audio...</span>
                   </div>
                   <button type="button" onClick={detenerGrabacion} className="px-4 py-2 bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                      <Square size={14} fill="currentColor" /> Detener
                   </button>
                 </div>
              ) : (
                 <>
                    <div className="flex gap-1 pb-1 px-2">
                      {/* BOTONES DE ADJUNTOS CON HINTS CLAROS */}
                      <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors tooltip flex items-center gap-1" title="Enviar Foto o GIF">
                        <ImageIcon size={20} />
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors tooltip" title="Adjuntar Documento">
                        <Paperclip size={20} />
                      </button>
                    </div>

                    <textarea 
                      value={nuevoMensaje}
                      onChange={(e) => setNuevoMensaje(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeTexto(e); } }}
                      placeholder={`Envia un mensaje a ${activeChat.nombre}`}
                      className="flex-1 px-3 py-2.5 text-sm outline-none text-slate-800 bg-transparent resize-none min-h-[44px] max-h-[120px] custom-scrollbar"
                      rows={1}
                      disabled={uploading}
                    />

                    <div className="flex pb-1 px-2">
                      {nuevoMensaje.trim() ? (
                         <button type="submit" disabled={uploading} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                           <Send size={18} />
                         </button>
                      ) : (
                         <button type="button" onClick={iniciarGrabacion} disabled={uploading} className="p-2.5 bg-slate-200 text-slate-600 hover:text-white hover:bg-rose-500 rounded-xl disabled:opacity-50 transition-colors shadow-sm">
                           <Mic size={18} />
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