import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X, Send, Paperclip, Mic, Image as ImageIcon,
  FileText, Hash, Search, Plus, Loader2, Square,
  CheckCheck, MessageSquare, Smile, ArrowLeft, Check,
  Lock, ChevronUp, Eye, Users, Trash2, MoreHorizontal
} from 'lucide-react';
import { db, storage } from '../config/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, setDoc, doc, updateDoc, limit, where, deleteField, startAfter, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { buildLastMessageSignature, isNewSignature, getMillis } from '../shared/chatSignatureCache';

// ─── STICKER PACKS ───────────────────────────────────────────────────────────
const STICKER_PACKS = {
  '\u2695\ufe0f M\u00e9dicos': ['\ud83c\udfe5','\ud83d\udc8a','\ud83e\ude7a','\ud83e\udeb8','\ud83e\ude79','\ud83e\uddec','\ud83d\udc89','\ud83e\uddea','\ud83d\udd2c','\ud83e\ude78','\ud83e\udec0','\ud83e\udec1','\ud83e\udda0','\ud83e\udde0','\ud83e\uddb4','\ud83e\uddd1\u200d\u2695\ufe0f','\ud83d\udc68\u200d\u2695\ufe0f','\ud83d\udc69\u200d\u2695\ufe0f','\ud83d\ude91','\ud83d\udee1\ufe0f'],
  '\ud83d\udc4d Reacciones': ['\ud83d\udc4d','\u2764\ufe0f','\ud83d\ude02','\ud83d\ude2e','\ud83d\ude22','\ud83d\ude4f','\ud83d\udd25','\u2705','\u26a0\ufe0f','\ud83d\udcaf','\ud83c\udf89','\ud83d\udc4f','\ud83d\udcaa','\ud83e\udd1d','\ud83d\udc4b','\ud83d\udcac','\ud83d\udce2','\ud83d\udea8','\u23f0','\ud83d\udccb'],
  '\ud83d\ude0a Emociones': ['\ud83d\ude0a','\ud83d\ude04','\ud83e\udd14','\ud83d\ude05','\ud83e\udd70','\ud83d\ude0e','\ud83e\udd17','\ud83d\ude34','\ud83e\udd2f','\ud83e\udd73','\ud83d\ude24','\ud83e\udd26','\ud83d\ude4c','\ud83d\udc83','\ud83c\udf8a','\ud83d\ude2c','\ud83e\udef1','\ud83e\udd0c','\ud83d\udcc6','\ud83e\udef6'],
};

const MESSAGES_PAGE_SIZE = 50;
const MESSAGES_LOAD_MORE = 30;
const USERS_CACHE_KEY = 'chat_users_cache_v1';
const USERS_CACHE_TTL = 10 * 60 * 1000;
const TYPING_TTL = 4000;
const TYPING_SEND_INTERVAL = 2000;
const CUSTOM_STICKERS_KEY = 'chat_mis_stickers_v1';
const CUSTOM_IMAGE_STICKERS_KEY = 'chat_mis_stickers_img_v1';
const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const formatHora = (v) => {
  const ms = getMillis(v);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const formatFechaGrupo = (v) => {
  const ms = getMillis(v);
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diaMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((hoy - diaMsg) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return d.toLocaleDateString('es-MX', { weekday: 'long' });
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const formatRelative = (v) => {
  const ms = getMillis(v);
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diaMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((hoy - diaMsg) / 86400000);
  if (diff === 0) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (diff === 1) return 'Ayer';
  if (diff < 7) return d.toLocaleDateString('es-MX', { weekday: 'short' });
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
};
const getInitials = (n) => (n || 'US').substring(0, 2).toUpperCase();
const normalizeText = (value = '') => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const formatReplyText = (msg = {}) => {
  const base = (msg.texto || '').trim();
  if (base) return base.slice(0, 80);
  if (msg.tipo === 'imagen') return 'Imagen';
  if (msg.tipo === 'documento') return 'Documento';
  if (msg.tipo === 'audio') return 'Audio';
  if (msg.tipo === 'sticker') return 'Sticker';
  if (msg.tipo === 'sticker_imagen') return 'Sticker de imagen';
  if (msg.tipo === 'gif') return 'GIF';
  return 'Mensaje';
};
const loadCustomStickers = () => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_STICKERS_KEY) || '[]'); } catch { return []; }
};
const saveCustomStickers = (list) => {
  try { localStorage.setItem(CUSTOM_STICKERS_KEY, JSON.stringify(list)); } catch {}
};
const loadCustomImageStickers = () => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_IMAGE_STICKERS_KEY) || '[]'); } catch { return []; }
};
const saveCustomImageStickers = (list) => {
  try { localStorage.setItem(CUSTOM_IMAGE_STICKERS_KEY, JSON.stringify(list)); } catch {}
};

// ─── DateSeparator ────────────────────────────────────────────────────────────
const DateSeparator = ({ label }) => (
  <div className="flex items-center gap-3 my-4 px-2 select-none">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" />
    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(148,163,184,0.25)', color: '#64748b', boxShadow: '0 1px 6px rgba(15,23,42,0.06)' }}>
      {label}
    </span>
    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-slate-200/80 to-transparent" />
  </div>
);

// ─── TypingIndicator ─────────────────────────────────────────────────────────
const TypingIndicator = ({ names }) => {
  if (!names.length) return null;
  return (
    <div className="flex items-center gap-2 px-5 py-1.5">
      <div className="flex items-end gap-0.5 h-4">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9] inline-block"
            style={{ animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <span className="text-[11px] text-slate-500 italic font-medium">
        {names.length === 1 ? `${names[0]} est\u00e1 escribiendo\u2026` : `${names.join(', ')} est\u00e1n escribiendo\u2026`}
      </span>
    </div>
  );
};

// ─── StickerPicker ────────────────────────────────────────────────────────────
const StickerPicker = ({ onSelect, onClose, imageStickers = [], onAddImageSticker, onRemoveImageSticker }) => {
  const packs = Object.keys(STICKER_PACKS);
  const MY_TAB = '\u2b50 M\u00edos';
  const [activePack, setActivePack] = useState(packs[0]);
  const [misStickers, setMisStickers] = useState(loadCustomStickers);
  const [showCrear, setShowCrear] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newEmoji, setNewEmoji] = useState('\u2b50');
  const [newColor, setNewColor] = useState('#0ea5e9');
  const stickerInputRef = useRef(null);

  const crearSticker = () => {
    if (!newText.trim()) return;
    const sticker = { id: Date.now(), emoji: newEmoji, text: newText.trim(), color: newColor };
    const updated = [sticker, ...misStickers].slice(0, 20);
    setMisStickers(updated);
    saveCustomStickers(updated);
    setNewText('');
    setShowCrear(false);
  };
  const eliminarSticker = (id) => {
    const updated = misStickers.filter(s => s.id !== id);
    setMisStickers(updated);
    saveCustomStickers(updated);
  };

  const subirStickerImagen = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onAddImageSticker) return;
    setSubiendoImagen(true);
    const result = await onAddImageSticker(file);
    if (!result?.ok && result?.error) {
      alert(result.error);
    }
    setSubiendoImagen(false);
    e.target.value = null;
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 w-80 rounded-2xl overflow-hidden z-50"
      style={{ background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid rgba(148,163,184,0.25)', boxShadow: '0 20px 48px -8px rgba(15,23,42,0.22), 0 0 0 1px rgba(255,255,255,0.6) inset' }}
      onClick={e => e.stopPropagation()}>
      <div className="flex border-b border-slate-100 overflow-x-auto">
        {[...packs, MY_TAB].map(pack => (
          <button key={pack} onClick={() => { setActivePack(pack); setShowCrear(false); }}
            className="shrink-0 px-3 py-2 text-xs font-bold transition-colors"
            style={{ color: activePack === pack ? '#0ea5e9' : '#94a3b8', borderBottom: activePack === pack ? '2px solid #0ea5e9' : '2px solid transparent', background: activePack === pack ? 'rgba(14,165,233,0.05)' : 'transparent' }}>
            {pack.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="max-h-52 overflow-y-auto custom-scrollbar">
        {activePack === MY_TAB ? (
          <div className="p-2">
            {showCrear ? (
              <div className="p-2 space-y-2">
                <p className="text-[11px] font-bold text-slate-600">Crear sticker personalizado</p>
                <div className="flex gap-2">
                  <input type="text" value={newEmoji} onChange={e => setNewEmoji(e.target.value.slice(-2))}
                    className="w-12 text-center px-2 py-1.5 text-xl rounded-xl border border-slate-200 outline-none" maxLength={2} />
                  <input type="text" value={newText} onChange={e => setNewText(e.target.value)}
                    placeholder="Escribe un texto..." maxLength={25}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#0ea5e9]/50" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Color:</span>
                  {['#0ea5e9','#6366f1','#ec4899','#10b981','#f59e0b','#ef4444'].map(c => (
                    <button key={c} onClick={() => setNewColor(c)} className="w-5 h-5 rounded-full transition-transform"
                      style={{ background: c, transform: newColor === c ? 'scale(1.3)' : 'scale(1)', outline: newColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
                {newText.trim() && (
                  <div className="flex justify-center">
                    <span className="px-3 py-1.5 rounded-2xl text-white text-sm font-bold"
                      style={{ background: `linear-gradient(135deg, ${newColor}, ${newColor}99)` }}>
                      {newEmoji} {newText}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowCrear(false)} className="flex-1 py-1.5 text-xs font-bold text-slate-500 rounded-xl border border-slate-200">Cancelar</button>
                  <button onClick={crearSticker} disabled={!newText.trim()}
                    className="flex-1 py-1.5 text-xs font-bold text-white rounded-xl disabled:opacity-40"
                    style={{ background: `linear-gradient(135deg, ${newColor}, ${newColor}cc)` }}>
                    Crear \u2713
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-1 mb-1 px-1">
                  <button
                    onClick={() => setShowCrear(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-bold text-[#0ea5e9] hover:bg-blue-50 transition-colors"
                  >
                    <Plus size={12} /> Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => stickerInputRef.current?.click()}
                    disabled={subiendoImagen}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-bold text-[#0369a1] hover:bg-sky-50 transition-colors disabled:opacity-60"
                  >
                    {subiendoImagen ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                    {subiendoImagen ? 'Subiendo...' : 'Imagen/GIF'}
                  </button>
                  <input
                    ref={stickerInputRef}
                    type="file"
                    accept="image/png,image/webp,image/jpeg,image/gif"
                    className="hidden"
                    onChange={subirStickerImagen}
                  />
                </div>

                {misStickers.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Texto</p>
                    <div className="grid grid-cols-3 gap-1.5 p-1">
                      {misStickers.map(s => (
                        <div key={s.id} className="relative group">
                          <button onClick={() => { onSelect(`${s.emoji} ${s.text}`); onClose(); }}
                            className="w-full px-2 py-2 rounded-xl text-white text-[11px] font-bold text-center hover:scale-105 active:scale-95 transition-transform leading-tight"
                            style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}aa)` }}>
                            <div className="text-lg">{s.emoji}</div>
                            <div className="truncate">{s.text}</div>
                          </button>
                          <button onClick={() => eliminarSticker(s.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white hidden group-hover:flex items-center justify-center text-[9px] font-bold">
                            \u00d7
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {imageStickers.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mt-1">Imágenes</p>
                    <div className="grid grid-cols-4 gap-1.5 p-1">
                      {imageStickers.map(s => (
                        <div key={s.id} className="relative group">
                          <button
                            onClick={() => {
                              onSelect({ kind: 'image', ...s });
                              onClose();
                            }}
                            className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white hover:scale-105 active:scale-95 transition-transform"
                          >
                            <img src={s.url} alt={s.nombre || 'Sticker'} className="w-full h-full object-cover" />
                          </button>
                          {s.tipo === 'gif' && (
                            <span className="absolute bottom-0.5 left-0.5 text-[8px] px-1 rounded bg-black/70 text-white">GIF</span>
                          )}
                          <button
                            onClick={() => onRemoveImageSticker?.(s.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white hidden group-hover:flex items-center justify-center text-[9px] font-bold"
                          >
                            \u00d7
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {misStickers.length === 0 && imageStickers.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-5">Sin stickers personalizados</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5 p-2">
            {(STICKER_PACKS[activePack] || []).map((s, i) => (
              <button key={i} onClick={() => { onSelect(s); onClose(); }}
                className="h-9 w-9 flex items-center justify-center text-xl rounded-xl hover:bg-blue-50 hover:scale-125 transition-all active:scale-95">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const ChatPanel = ({ isOpen, onClose, directMessageUser }) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('canales');
  const [activeChat, setActiveChat] = useState({ id: 'global', nombre: 'General', tipo: 'canal' });
  const [canales, setCanales] = useState([]);
  const [privadosMeta, setPrivadosMeta] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [chatsNoLeidos, setChatsNoLeidos] = useState({});
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [channelPrivado, setChannelPrivado] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [chatReadBy, setChatReadBy] = useState({});
  const [infoToast, setInfoToast] = useState(null);
  const [lastMsgDoc, setLastMsgDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  const [customImageStickers, setCustomImageStickers] = useState(loadCustomImageStickers);

  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSendRef = useRef(0);
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;
  
  const canCreateChannels = useMemo(() => {
    const rol = (user?.rol || '').toLowerCase();
    const isAdmin = rol === 'admin' || rol === 'admin_maestro';
    const delegated = user?.chatCanCreateChannels === true || user?.canManageChannels === true;
    const permisos = Array.isArray(user?.permisos) ? user.permisos : [];
    return isAdmin || delegated || permisos.includes('chat:create-channel');
  }, [user]);

  // 1. CARGA DE CANALES
  useEffect(() => {
    if (!isOpen || !user) return;
    const qCanales = query(collection(db, 'canales'), orderBy('ultimoMensajeAt', 'desc'), limit(30));
    const unsub = onSnapshot(qCanales, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const visible = all.filter(c =>
        !c.esPrivado || !c.miembros?.length || c.miembros.includes(user.uid) || c.creador === user.uid
      );
      if (!visible.find(c => c.id === 'global'))
        visible.push({ id: 'global', nombre: 'General', creador: 'Sistema', ultimoMensajeAt: 0 });
      snap.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const d = change.doc.data();
          if (!d?.ultimoMensajeAt) return;
          const signature = buildLastMessageSignature(change.doc.id, d);
          const isNew = isNewSignature(signature);
          if (isNew && d.ultimoRemitenteId !== user.uid && activeChatRef.current.id !== change.doc.id)
            setChatsNoLeidos(prev => ({ ...prev, [change.doc.id]: (prev[change.doc.id] || 0) + 1 }));
        }
      });
      setCanales(visible);
    });
    return () => unsub();
  }, [isOpen, user]);

  // 2. CARGA DE CHATS PRIVADOS
  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    const qPrivados = query(collection(db, 'chats_privados'), where('participantes', 'array-contains', user.uid), limit(80));
    const unsub = onSnapshot(qPrivados, (snap) => {
      const meta = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .map(item => {
          const participantes = Array.isArray(item.participantes) ? item.participantes : [];
          const otherUserId = participantes.find(pid => pid !== user.uid) || null;
          return { ...item, otherUserId };
        })
        .sort((a, b) => getMillis(b.ultimoMensajeAt) - getMillis(a.ultimoMensajeAt));
      snap.docChanges().forEach(change => {
        const d = change.doc.data();
        const participantes = Array.isArray(d.participantes) ? d.participantes : [];
        const otherUserId = participantes.find(pid => pid !== user.uid);
        if (!otherUserId) return;
        if (!d?.ultimoMensajeAt) return;
        if ((change.type === 'modified' || change.type === 'added') && d.ultimoRemitenteId !== user.uid) {
          const signature = buildLastMessageSignature(change.doc.id, d);
          const isNew = isNewSignature(signature);
          if (!isNew) return;
          const ac = activeChatRef.current;
          if (!(ac.tipo === 'privado' && ac.id === otherUserId))
            setChatsNoLeidos(prev => ({ ...prev, [otherUserId]: (prev[otherUserId] || 0) + 1 }));
        }
      });
      setPrivadosMeta(meta);
    });
    return () => unsub();
  }, [isOpen, user?.uid]);

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

  // 3.5 AUTO-INICIAR CHAT DIRECTO DESDE AGENDA
  useEffect(() => {
    if (!directMessageUser?.id || !isOpen || usuarios.length === 0) return;
    const targetUser = usuarios.find((u) => u.id === directMessageUser.id);
    if (!targetUser) return;
    setActiveChat({
      id: targetUser.id,
      nombre: targetUser.nombre || directMessageUser.nombre || 'Usuario',
      tipo: 'privado',
      avatar: targetUser.avatar || ''
    });
    setActiveTab('mensajes');
  }, [directMessageUser, isOpen, usuarios]);

  // 4. MENSAJES CON PAGINACIÓN + READ RECEIPTS
  useEffect(() => {
    if (!user || !isOpen || !activeChat.id) return;
    setChatsNoLeidos(prev => ({ ...prev, [activeChat.id]: 0 }));
    setMensajes([]);
    setChatReadBy({});
    setLastMsgDoc(null);
    setHasMore(false);

    let colRef;
    if (activeChat.tipo === 'canal') {
      colRef = collection(db, 'canales', activeChat.id, 'mensajes');
    } else {
      const chatId = [user.uid, activeChat.id].sort().join('_');
      colRef = collection(db, 'chats_privados', chatId, 'mensajes');
    }

    const q = query(colRef, orderBy('timestamp', 'desc'), limit(MESSAGES_PAGE_SIZE));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setLastMsgDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length >= MESSAGES_PAGE_SIZE);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      setMensajes(docs);
      setTimeout(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }, 80);
      // Marcar como leído
      const parentRef = activeChat.tipo === 'canal'
        ? doc(db, 'canales', activeChat.id)
        : doc(db, 'chats_privados', [user.uid, activeChat.id].sort().join('_'));
      updateDoc(parentRef, { [`leidoPor.${user.uid}`]: serverTimestamp() }).catch(() => {});
    });
    return () => unsub();
  }, [user, isOpen, activeChat.id, activeChat.tipo]);

  // 5. TYPING INDICATOR
  useEffect(() => {
    if (!user || !isOpen || !activeChat.id) return;
    const parentRef = activeChat.tipo === 'canal'
      ? doc(db, 'canales', activeChat.id)
      : doc(db, 'chats_privados', [user.uid, activeChat.id].sort().join('_'));
    const unsub = onSnapshot(parentRef, (snap) => {
      const data = snap.data() || {};
      const typing = data.typing || {};
      const readBy = data.leidoPor || {};
      setChatReadBy(readBy);
      const now = Date.now();
      const active = Object.entries(typing)
        .filter(([uid, ts]) => uid !== user.uid && (now - getMillis(ts)) < TYPING_TTL)
        .map(([uid]) => {
          const u = usuarios.find(u => u.id === uid);
          return u?.nombre || uid.slice(0, 6);
        });
      setTypingUsers(active);
    });
    return () => unsub();
  }, [user, isOpen, activeChat.id, activeChat.tipo, usuarios]);

  // Limpieza del micrófono al cerrar
  useEffect(() => {
    if (!isOpen) {
      detenerGrabacion();
      setReplyTo(null);
      setOpenMessageMenuId(null);
      setInfoToast(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setReplyTo(null);
    setOpenMessageMenuId(null);
    setInfoToast(null);
  }, [activeChat.id, activeChat.tipo]);

  useEffect(() => {
    if (!infoToast) return;
    const timer = setTimeout(() => setInfoToast(null), 5200);
    return () => clearTimeout(timer);
  }, [infoToast]);

  useEffect(() => {
    if (!openMessageMenuId) return;
    const closeMenu = (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-message-actions="true"]')) {
        setOpenMessageMenuId(null);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [openMessageMenuId]);

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
          ultimoRemitenteNombre: user.nombre || 'Usuario',
          ultimoRemitenteRol: user.rol || 'general',
          ultimoTexto: tipo === 'texto' ? texto : `Envió un ${tipo}`,
          nombre: activeChat.nombre || 'General'
        }, { merge: true });
      } else {
        const participantes = [user.uid, activeChat.id].sort();
        await setDoc(parentDocRef, {
          participantes,
          ultimoMensajeAt: serverTimestamp(),
          ultimoRemitenteId: user.uid,
          ultimoRemitenteNombre: user.nombre || 'Usuario',
          ultimoRemitenteRol: user.rol || 'general',
          ultimoTexto: tipo === 'texto' ? texto : `Envió un ${tipo}`,
          actualizadoAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Error escribiendo payload:", error);
    }
  };

  const actualizarResumenChat = useCallback(async (collectionRef, parentDocRef, parentData = {}) => {
    const latestSnap = await getDocs(query(collectionRef, orderBy('timestamp', 'desc'), limit(1)));
    if (latestSnap.empty) {
      await updateDoc(parentDocRef, {
        ultimoMensajeAt: deleteField(),
        ultimoRemitenteId: deleteField(),
        ultimoRemitenteNombre: deleteField(),
        ultimoRemitenteRol: deleteField(),
        ultimoTexto: deleteField()
      }).catch(() => {});
      return;
    }

    const latest = latestSnap.docs[0].data() || {};
    const tipoMsg = latest.tipo || 'texto';
    const ultimoTexto = tipoMsg === 'texto' || tipoMsg === 'sticker'
      ? (latest.texto || '')
      : `Envió un ${tipoMsg}`;

    await setDoc(parentDocRef, {
      ultimoMensajeAt: latest.timestamp || serverTimestamp(),
      ultimoRemitenteId: latest.remitenteId || '',
      ultimoRemitenteNombre: latest.remitenteNombre || 'Usuario',
      ultimoRemitenteRol: latest.remitenteRol || 'general',
      ultimoTexto,
      ...parentData
    }, { merge: true });
  }, []);

  const eliminarMensajeParaTodos = useCallback(async (mensaje) => {
    if (!user || !mensaje?.id) return;
    const canDelete = mensaje.remitenteId === user.uid;
    if (!canDelete) {
      alert('Solo puedes eliminar tus propios mensajes.');
      return;
    }

    const ok = window.confirm('¿Eliminar este mensaje para todos? Esta acción no se puede deshacer.');
    if (!ok) return;

    let collectionRef;
    let parentDocRef;
    let parentData = {};

    if (activeChat.tipo === 'canal') {
      collectionRef = collection(db, 'canales', activeChat.id, 'mensajes');
      parentDocRef = doc(db, 'canales', activeChat.id);
      parentData = { nombre: activeChat.nombre || 'General' };
    } else {
      const chatId = [user.uid, activeChat.id].sort().join('_');
      collectionRef = collection(db, 'chats_privados', chatId, 'mensajes');
      parentDocRef = doc(db, 'chats_privados', chatId);
    }

    try {
      await deleteDoc(doc(collectionRef, mensaje.id));
      if (replyTo?.id === mensaje.id) setReplyTo(null);
      await actualizarResumenChat(collectionRef, parentDocRef, parentData);
    } catch (error) {
      console.error('Error al eliminar mensaje:', error);
      alert('No se pudo eliminar el mensaje. Intenta de nuevo.');
    }
  }, [user, activeChat, replyTo, actualizarResumenChat]);

  const verInfoMensaje = useCallback((mensaje) => {
    const remitente = mensaje?.remitenteNombre || 'Usuario';
    const fecha = formatFechaGrupo(mensaje?.timestamp);
    const hora = formatHora(mensaje?.timestamp);
    const tipo = mensaje?.tipo || 'texto';
    const messageMillis = getMillis(mensaje?.timestamp);
    const vistos = messageMillis
      ? Object.entries(chatReadBy || {})
          .filter(([uid, ts]) => uid !== mensaje?.remitenteId && getMillis(ts) >= messageMillis)
          .map(([uid]) => usuarios.find((u) => u.id === uid)?.nombre || uid.slice(0, 6))
      : [];

    setInfoToast({
      remitente,
      fecha: fecha || '-',
      hora: hora || '-',
      tipo,
      idCorto: (mensaje?.id || '').slice(0, 12),
      vistos
    });
    setOpenMessageMenuId(null);
  }, [usuarios, chatReadBy]);

  const enviarMensajeTexto = (e) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;
    const replyMeta = replyTo ? {
      respuestaA: {
        id: replyTo.id,
        remitenteId: replyTo.remitenteId,
        remitenteNombre: replyTo.remitenteNombre || 'Usuario',
        tipo: replyTo.tipo || 'texto',
        texto: formatReplyText(replyTo)
      }
    } : {};
    enviarPayload(nuevoMensaje, null, 'texto', replyMeta);
    setNuevoMensaje('');
    setReplyTo(null);
  };

  const procesarSubidaArchivo = async (file, tipo) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    const replyMeta = replyTo ? {
      respuestaA: {
        id: replyTo.id,
        remitenteId: replyTo.remitenteId,
        remitenteNombre: replyTo.remitenteNombre || 'Usuario',
        tipo: replyTo.tipo || 'texto',
        texto: formatReplyText(replyTo)
      }
    } : {};
    setReplyTo(null);

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
        await enviarPayload(file.name, downloadURL, tipo, { peso: file.size, ...replyMeta });
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

  const agregarStickerImagen = useCallback(async (file) => {
    if (!file || !user?.uid) return { ok: false, error: 'Archivo inválido.' };
    const mime = (file.type || '').toLowerCase();
    if (!mime.startsWith('image/')) return { ok: false, error: 'Solo se permiten imágenes.' };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: 'La imagen debe pesar menos de 8MB.' };

    try {
      const extByMime = mime === 'image/gif' ? 'gif' : 'png';
      const ext = (file.name.split('.').pop() || extByMime).toLowerCase();
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const storagePath = `chat_stickers/${user.uid}/${id}.${ext}`;
      const uploaded = await uploadBytes(ref(storage, storagePath), file);
      const url = await getDownloadURL(uploaded.ref);

      const nuevoSticker = {
        id,
        url,
        nombre: file.name || (mime === 'image/gif' ? 'GIF' : 'Sticker'),
        tipo: mime === 'image/gif' ? 'gif' : 'sticker_imagen',
        path: storagePath,
        creadoAt: Date.now()
      };

      setCustomImageStickers((prev) => {
        const updated = [nuevoSticker, ...prev].slice(0, 40);
        saveCustomImageStickers(updated);
        return updated;
      });
      return { ok: true };
    } catch (error) {
      console.error('Error al subir sticker de imagen:', error);
      return { ok: false, error: 'No se pudo subir la imagen. Intenta de nuevo.' };
    }
  }, [user?.uid]);

  const eliminarStickerImagen = useCallback((stickerId) => {
    setCustomImageStickers((prev) => {
      const sticker = prev.find((s) => s.id === stickerId);
      if (sticker?.path) {
        deleteObject(ref(storage, sticker.path)).catch(() => {});
      }
      const updated = prev.filter((s) => s.id !== stickerId);
      saveCustomImageStickers(updated);
      return updated;
    });
  }, []);

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const fileItems = items.filter(item => item.kind === 'file');
    if (!fileItems.length || uploading) return;
    e.preventDefault();
    const file = fileItems[0].getAsFile();
    if (!file) return;
    const mime = (file.type || '').toLowerCase();
    const tipo = mime.startsWith('image/') ? 'imagen' : 'documento';
    procesarSubidaArchivo(file, tipo);
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

  const clearTypingStatus = useCallback(async () => {
    if (!user) return;
    const parentRef = activeChat.tipo === 'canal'
      ? doc(db, 'canales', activeChat.id)
      : doc(db, 'chats_privados', [user.uid, activeChat.id].sort().join('_'));
    updateDoc(parentRef, { [`typing.${user.uid}`]: deleteField() }).catch(() => {});
  }, [user, activeChat]);

  const handleTyping = useCallback(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingSendRef.current < TYPING_SEND_INTERVAL) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(clearTypingStatus, TYPING_TTL);
      return;
    }
    lastTypingSendRef.current = now;
    const parentRef = activeChat.tipo === 'canal'
      ? doc(db, 'canales', activeChat.id)
      : doc(db, 'chats_privados', [user.uid, activeChat.id].sort().join('_'));
    updateDoc(parentRef, { [`typing.${user.uid}`]: serverTimestamp() }).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(clearTypingStatus, TYPING_TTL);
  }, [user, activeChat, clearTypingStatus]);

  const loadMoreMessages = useCallback(async () => {
    if (!lastMsgDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);
    let colRef;
    if (activeChat.tipo === 'canal') {
      colRef = collection(db, 'canales', activeChat.id, 'mensajes');
    } else {
      const chatId = [user.uid, activeChat.id].sort().join('_');
      colRef = collection(db, 'chats_privados', chatId, 'mensajes');
    }
    const q = query(colRef, orderBy('timestamp', 'desc'), startAfter(lastMsgDoc), limit(MESSAGES_LOAD_MORE));
    try {
      const snap = await getDocs(q);
      if (!snap.empty) setLastMsgDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length >= MESSAGES_LOAD_MORE);
      const older = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      setMensajes(prev => [...older, ...prev]);
    } finally {
      setLoadingMore(false);
    }
  }, [activeChat, user, lastMsgDoc, loadingMore, hasMore]);

  const enviarSticker = useCallback((sticker) => {
    const replyMeta = replyTo ? {
      respuestaA: {
        id: replyTo.id,
        remitenteId: replyTo.remitenteId,
        remitenteNombre: replyTo.remitenteNombre || 'Usuario',
        tipo: replyTo.tipo || 'texto',
        texto: formatReplyText(replyTo)
      }
    } : {};

    if (typeof sticker === 'string') {
      enviarPayload(sticker, null, 'sticker', replyMeta);
      setReplyTo(null);
      return;
    }

    if (sticker?.kind === 'image' && sticker.url) {
      const tipo = sticker.tipo === 'gif' ? 'gif' : 'sticker_imagen';
      enviarPayload(sticker.nombre || 'Sticker', sticker.url, tipo, replyMeta);
      setReplyTo(null);
      return;
    }
  }, [replyTo]);

  const crearCanal = async (e) => {
    e.preventDefault();
    if (!canCreateChannels) { alert('No tienes permisos para crear canales.'); return; }
    if (!newChannelName.trim()) return;
    try {
      const canalId = newChannelName.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(db, 'canales', canalId), {
        nombre: newChannelName,
        creador: user.uid,
        timestamp: serverTimestamp(),
        ultimoMensajeAt: serverTimestamp(),
        esPrivado: channelPrivado,
        miembros: channelPrivado ? [user.uid, ...selectedMembers] : []
      });
      setNewChannelName('');
      setChannelPrivado(false);
      setSelectedMembers([]);
      setIsCreatingChannel(false);
      setActiveChat({ id: canalId, nombre: newChannelName, tipo: 'canal' });
    } catch (error) { console.error('Error al crear canal:', error); }
  };

  const privadosByUserId = useMemo(() => {
    const map = new Map();
    privadosMeta.forEach((item) => {
      if (item.otherUserId) map.set(item.otherUserId, item);
    });
    return map;
  }, [privadosMeta]);

  const canalesFiltrados = canales.filter(c => normalizeText(c.nombre).includes(normalizeText(searchTerm)));

  // Conversaciones activas: solo usuarios CON mensajes previos, ordenadas por no leídos y luego por fecha
  const conversacionesActivas = useMemo(() => {
    const term = normalizeText(searchTerm);
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
      .filter(c => !term || normalizeText(c.nombre).includes(term))
      .sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1;
        if (a.unread === 0 && b.unread > 0) return 1;
        return getMillis(b.ultimoMensajeAt) - getMillis(a.ultimoMensajeAt);
      });
  }, [privadosMeta, usuarios, chatsNoLeidos, searchTerm]);

  // Contactos para nuevo mensaje: búsqueda explícita para evitar listar todos
  const contactosNuevoChat = useMemo(() => {
    if (!showNewChat) return [];
    const term = normalizeText(newChatSearch);
    if (term.length < 2) return [];
    return usuarios
      .filter(u => normalizeText(`${u.nombre || ''} ${u.email || ''} ${u.rol || ''}`).includes(term))
      .sort((a, b) => {
        const aHasChat = privadosByUserId.has(a.id);
        const bHasChat = privadosByUserId.has(b.id);
        if (aHasChat && !bHasChat) return -1;
        if (!aHasChat && bHasChat) return 1;
        return normalizeText(a.nombre).localeCompare(normalizeText(b.nombre));
      });
  }, [showNewChat, newChatSearch, usuarios, privadosByUserId]);

  const miembrosBuscados = useMemo(() => {
    if (!channelPrivado) return [];
    const term = normalizeText(memberSearch);
    if (term.length < 2) return [];
    return usuarios
      .filter(u => normalizeText(`${u.nombre || ''} ${u.email || ''} ${u.rol || ''}`).includes(term))
      .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
  }, [channelPrivado, memberSearch, usuarios]);

  const totalNoLeidos = useMemo(
    () => Object.values(chatsNoLeidos).reduce((acc, value) => acc + (Number(value) || 0), 0),
    [chatsNoLeidos]
  );


  // Mensajes con separadores de fecha
  const mensajesConFechas = React.useMemo(() => {
    const result = [];
    let lastDate = '';
    mensajes.forEach(m => {
      const dateLabel = formatFechaGrupo(m.timestamp);
      if (dateLabel && dateLabel !== lastDate) {
        result.push({ type: 'separator', label: dateLabel, key: 'sep_' + dateLabel });
        lastDate = dateLabel;
      }
      result.push({ type: 'message', ...m });
    });
    return result;
  }, [mensajes]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes chatBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: .7; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
        <div className="absolute inset-0 pointer-events-auto" onClick={onClose}
          style={{ background: 'rgba(226,232,240,0.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
        <input type="file" ref={fileInputRef} className="hidden" onChange={e => handleFileChange(e, 'documento')} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" />
        <input type="file" ref={imageInputRef} className="hidden" onChange={e => handleFileChange(e, 'imagen')} accept="image/jpeg,image/png,image/gif,image/webp" />

        {/* MAIN PANEL */}
        <div className="w-full max-w-[1000px] h-[88vh] max-h-[840px] flex rounded-3xl overflow-hidden pointer-events-auto relative"
          style={{ boxShadow: '0 20px 48px -20px rgba(15,23,42,0.28)', border: '1px solid rgba(148,163,184,0.28)', background: '#ffffff' }}>

          {/* SIDEBAR */}
          <div className="w-[300px] flex flex-col shrink-0 overflow-hidden"
            style={{ background: '#f8fafc', borderRight: '1px solid rgba(148,163,184,0.18)' }}>

            {/* Sidebar header */}
            <div className="px-4 py-4 flex items-center justify-between shrink-0"
              style={{ borderBottom: '1px solid rgba(148,163,184,0.16)', background: '#ffffff' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ background: 'rgba(14,165,233,0.15)', color: '#0c4a6e', border: '1px solid rgba(14,165,233,0.28)' }}>
                  {getInitials(user?.nombre)}
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-tight truncate max-w-[140px] text-slate-700">{user?.nombre || 'Usuario'}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span className="text-[10px] text-slate-500">En línea</span>
                  </div>
                </div>
              </div>
              <button onClick={onClose}
                className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: '#64748b', background: 'rgba(148,163,184,0.12)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(148,163,184,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(148,163,184,0.12)'}>
                <X size={14} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: '#ffffff', border: '1px solid rgba(148,163,184,0.25)' }}>
                <Search size={13} style={{ color: '#94a3b8' }} />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent text-[12px] outline-none text-slate-700"
                  style={{ caretColor: '#0ea5e9' }} />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex px-4 gap-1.5 shrink-0 mb-2">
              {[['canales', 'Canales', 'hash'], ['mensajes', 'Mensajes', 'msg']].map(([tab, label, icon]) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  style={{
                    background: activeTab === tab ? 'rgba(186,230,253,0.65)' : 'transparent',
                    color: activeTab === tab ? '#0369a1' : '#64748b',
                    border: activeTab === tab ? '1px solid rgba(14,165,233,0.28)' : '1px solid transparent'
                  }}>
                  {icon === 'hash' ? <Hash size={12} /> : <MessageSquare size={12} />}
                  {label}
                </button>
              ))}
            </div>

            {/* Sidebar list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3">
              {activeTab === 'canales' ? (
                <div className="space-y-0.5">
                  {canalesFiltrados.map(c => {
                    const isActive = activeChat.id === c.id && activeChat.tipo === 'canal';
                    const unread = chatsNoLeidos[c.id] || 0;
                    return (
                      <button key={c.id}
                        onClick={() => { setActiveChat({ id: c.id, nombre: c.nombre, tipo: 'canal' }); setChatsNoLeidos(prev => ({ ...prev, [c.id]: 0 })); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: isActive ? 'rgba(186,230,253,0.62)' : 'transparent',
                          border: isActive ? '1px solid rgba(14,165,233,0.36)' : '1px solid transparent'
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(226,232,240,0.55)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                        {c.esPrivado
                          ? <Lock size={13} style={{ color: isActive ? '#0369a1' : '#94a3b8', flexShrink: 0 }} />
                          : <Hash size={13} style={{ color: isActive ? '#0369a1' : '#94a3b8', flexShrink: 0 }} />
                        }
                        <span className="flex-1 truncate text-[12px] font-medium"
                          style={{ color: isActive ? '#0f172a' : '#475569' }}>
                          {c.nombre}
                        </span>
                        {unread > 0 && (
                          <span className="min-w-[18px] h-[18px] rounded-full bg-[#0ea5e9] text-white text-[9px] font-black flex items-center justify-center px-1">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {canCreateChannels && !isCreatingChannel && (
                    <button onClick={() => setIsCreatingChannel(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-all mt-2"
                      style={{ color: '#0369a1', border: '1px dashed rgba(14,165,233,0.35)', background: '#ffffff' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(14,165,233,0.45)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(14,165,233,0.22)'}>
                      <Plus size={13} /> Nuevo canal
                    </button>
                  )}
                  {isCreatingChannel && canCreateChannels && (
                    <form onSubmit={crearCanal} className="mt-2 p-3.5 rounded-2xl space-y-3"
                      style={{ background: '#ffffff', border: '1px solid rgba(14,165,233,0.26)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#0369a1' }}>Nuevo canal</p>
                      <input autoFocus type="text" value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                        placeholder="nombre-del-canal" className="w-full bg-transparent outline-none text-[12px] font-medium pb-1.5"
                        style={{ color: '#334155', borderBottom: '1px solid rgba(14,165,233,0.3)', caretColor: '#0ea5e9' }} />
                      {/* Toggle privado */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Lock size={11} style={{ color: channelPrivado ? '#0ea5e9' : '#94a3b8' }} />
                          <span className="text-[11px] text-slate-500">Canal privado</span>
                        </div>
                        <button type="button" onClick={() => setChannelPrivado(p => !p)}
                          className="w-9 h-5 rounded-full transition-all relative shrink-0"
                          style={{ background: channelPrivado ? '#0ea5e9' : 'rgba(148,163,184,0.32)' }}>
                          <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all"
                            style={{ left: channelPrivado ? '20px' : '2px' }} />
                        </button>
                      </div>
                      {channelPrivado && (
                        <div className="space-y-1.5">
                          <input type="text" placeholder="Buscar miembros..." value={memberSearch}
                            onChange={e => setMemberSearch(e.target.value)}
                            className="w-full bg-transparent text-[11px] outline-none pb-1"
                            style={{ color: '#334155', borderBottom: '1px solid rgba(148,163,184,0.24)', caretColor: '#0ea5e9' }} />
                          <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-0.5 mt-1">
                            {normalizeText(memberSearch).length < 2 && (
                              <p className="text-[10px] text-slate-400 px-1 py-2">
                                Escribe al menos 2 letras para buscar y agregar miembros.
                              </p>
                            )}
                            {normalizeText(memberSearch).length >= 2 && miembrosBuscados.length === 0 && (
                              <p className="text-[10px] text-slate-400 px-1 py-2">
                                No se encontraron usuarios con esa búsqueda.
                              </p>
                            )}
                            {normalizeText(memberSearch).length >= 2 && miembrosBuscados.map(u => {
                              const sel = selectedMembers.includes(u.id);
                              return (
                                <button key={u.id} type="button"
                                  onClick={() => setSelectedMembers(prev => sel ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
                                  style={{ background: sel ? 'rgba(14,165,233,0.14)' : 'transparent' }}>
                                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0"
                                    style={{ background: sel ? '#0ea5e9' : 'rgba(148,163,184,0.2)', color: sel ? 'white' : '#64748b' }}>
                                    {sel ? <Check size={10} /> : getInitials(u.nombre)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] truncate" style={{ color: sel ? '#0f172a' : '#64748b' }}>{u.nombre}</p>
                                    {u.email && <p className="text-[9px] text-slate-400 truncate">{u.email}</p>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {selectedMembers.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold" style={{ color: '#0ea5e9' }}>
                                {selectedMembers.length} miembro{selectedMembers.length !== 1 ? 's' : ''} seleccionado{selectedMembers.length !== 1 ? 's' : ''}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {selectedMembers.map((id) => {
                                  const selectedUser = usuarios.find(u => u.id === id);
                                  return (
                                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px]"
                                      style={{ background: 'rgba(14,165,233,0.12)', color: '#0369a1' }}>
                                      {selectedUser?.nombre || id.slice(0, 6)}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex gap-1.5 pt-1">
                        <button type="button"
                          onClick={() => { setIsCreatingChannel(false); setChannelPrivado(false); setSelectedMembers([]); setMemberSearch(''); }}
                          className="flex-1 py-2 rounded-xl text-[11px] font-medium transition-colors"
                          style={{ color: '#64748b', background: 'rgba(148,163,184,0.14)' }}>
                          Cancelar
                        </button>
                        <button type="submit" disabled={!newChannelName.trim()}
                          className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white transition-all disabled:opacity-40"
                          style={{ background: '#0ea5e9', boxShadow: '0 2px 8px rgba(14,165,233,0.22)' }}>
                          Crear
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {conversacionesActivas.map(conv => {
                    const isActive = activeChat.id === conv.otherUserId && activeChat.tipo === 'privado';
                    return (
                      <button key={conv.otherUserId}
                        onClick={() => {
                          const u = usuarios.find(u => u.id === conv.otherUserId);
                          setActiveChat({ id: conv.otherUserId, nombre: conv.nombre, tipo: 'privado', avatar: u?.avatar });
                          setChatsNoLeidos(prev => ({ ...prev, [conv.otherUserId]: 0 }));
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: isActive ? 'rgba(186,230,253,0.62)' : 'transparent',
                          border: isActive ? '1px solid rgba(14,165,233,0.36)' : '1px solid transparent'
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(226,232,240,0.55)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                        <div className="relative shrink-0">
                          {conv.avatar
                            ? <img src={conv.avatar} alt="" className="w-7 h-7 rounded-xl object-cover" />
                            : <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.4),rgba(99,102,241,0.4))' }}>
                                {getInitials(conv.nombre)}
                              </div>
                          }
                          {conv.isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
                              style={{ borderColor: '#0d2051' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate"
                            style={{ color: isActive ? '#0f172a' : '#475569' }}>
                            {conv.nombre}
                          </p>
                          {conv.ultimoTexto && (
                            <p className="text-[10px] truncate" style={{ color: 'rgba(100,116,139,0.55)' }}>{conv.ultimoTexto}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                          {conv.ultimoMensajeAt && (
                            <span className="text-[9px]" style={{ color: 'rgba(100,116,139,0.5)' }}>{formatRelative(conv.ultimoMensajeAt)}</span>
                          )}
                          {conv.unread > 0 && (
                            <span className="min-w-[16px] h-4 rounded-full bg-[#0ea5e9] text-white text-[9px] font-black flex items-center justify-center px-1">
                              {conv.unread}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  <button onClick={() => setShowNewChat(p => !p)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-all mt-2"
                    style={{ color: '#0369a1', border: '1px dashed rgba(14,165,233,0.35)', background: '#ffffff' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(14,165,233,0.45)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(14,165,233,0.22)'}>
                    <Plus size={13} /> Nuevo mensaje
                  </button>
                  {showNewChat && (
                    <div className="mt-2 p-3 rounded-2xl space-y-2"
                      style={{ background: '#ffffff', border: '1px solid rgba(14,165,233,0.24)' }}>
                      <input autoFocus type="text" placeholder="Buscar usuario..." value={newChatSearch}
                        onChange={e => setNewChatSearch(e.target.value)}
                        className="w-full bg-transparent outline-none text-[12px] pb-1"
                        style={{ color: '#334155', borderBottom: '1px solid rgba(14,165,233,0.28)', caretColor: '#0ea5e9' }} />
                      <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-0.5">
                        {normalizeText(newChatSearch).length < 2 && (
                          <p className="text-[10px] text-slate-400 px-1 py-2">
                            Escribe al menos 2 letras para buscar usuarios.
                          </p>
                        )}
                        {normalizeText(newChatSearch).length >= 2 && contactosNuevoChat.length === 0 && (
                          <p className="text-[10px] text-slate-400 px-1 py-2">
                            No se encontraron coincidencias.
                          </p>
                        )}
                        {contactosNuevoChat.map(u => (
                          <button key={u.id} type="button"
                            onClick={() => {
                              setActiveChat({ id: u.id, nombre: u.nombre, tipo: 'privado', avatar: u.avatar });
                              setShowNewChat(false); setNewChatSearch(''); setActiveTab('mensajes');
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all text-left"
                            style={{ color: '#475569' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(226,232,240,0.55)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {u.avatar
                              ? <img src={u.avatar} alt="" className="w-6 h-6 rounded-lg object-cover" />
                              : <div className="w-6 h-6 rounded-lg bg-slate-600 flex items-center justify-center text-[10px] font-bold text-white">{getInitials(u.nombre)}</div>
                            }
                            <div>
                              <p className="text-[11px] font-medium">{u.nombre}</p>
                              {u.rol && <p className="text-[9px] opacity-55">{u.rol}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex flex-col overflow-hidden"
            style={{ background: '#f8fafc' }}>

            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(148,163,184,0.14)',
                boxShadow: '0 1px 12px rgba(15,23,42,0.05)'
              }}>
              <div className="flex items-center gap-3">
                {activeChat.tipo === 'canal'
                  ? <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.15),rgba(99,102,241,0.15))' }}>
                      {canales.find(c => c.id === activeChat.id)?.esPrivado
                        ? <Lock size={14} style={{ color: '#6366f1' }} />
                        : <Hash size={14} style={{ color: '#0ea5e9' }} />
                      }
                    </div>
                  : activeChat.avatar
                    ? <img src={activeChat.avatar} alt="" className="w-8 h-8 rounded-xl object-cover" />
                    : <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>
                        {getInitials(activeChat.nombre)}
                      </div>
                }
                <div>
                  <h3 className="font-bold text-[14px] text-slate-800 leading-tight">{activeChat.nombre}</h3>
                  <p className="text-[10px] text-slate-400">{activeChat.tipo === 'canal' ? 'Canal de equipo' : 'Mensaje directo'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {activeChat.tipo === 'privado' && (() => {
                  const conv = conversacionesActivas.find(c => c.otherUserId === activeChat.id);
                  return conv?.isOnline ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-medium"
                      style={{ background: 'rgba(52,211,153,0.1)', color: '#10b981', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      En línea
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Messages area */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4"
              onClick={() => setShowStickerPicker(false)}>
              {hasMore && (
                <div className="flex justify-center mb-5">
                  <button onClick={loadMoreMessages} disabled={loadingMore}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-bold transition-all disabled:opacity-60"
                    style={{
                      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(148,163,184,0.22)', color: '#0ea5e9',
                      boxShadow: '0 2px 8px rgba(15,23,42,0.07)'
                    }}>
                    {loadingMore
                      ? <Loader2 size={13} className="animate-spin" />
                      : <ChevronUp size={13} />
                    }
                    {loadingMore ? 'Cargando...' : 'Mensajes anteriores'}
                  </button>
                </div>
              )}

              {mensajesConFechas.map((item, idx) => {
                if (item.type === 'separator') return <DateSeparator key={item.key} label={item.label} />;
                const m = item;
                const prevItem = mensajesConFechas[idx - 1];
                const nextItem = mensajesConFechas[idx + 1];
                const prevMsg = prevItem?.type === 'message' ? prevItem : null;
                const nextMsg = nextItem?.type === 'message' ? nextItem : null;
                const esMio = m.remitenteId === user?.uid;
                const groupedWithPrev = !!prevMsg
                  && prevMsg.remitenteId === m.remitenteId
                  && (Math.abs(getMillis(m.timestamp) - getMillis(prevMsg.timestamp)) <= MESSAGE_GROUP_WINDOW_MS);
                const groupedWithNext = !!nextMsg
                  && nextMsg.remitenteId === m.remitenteId
                  && (Math.abs(getMillis(nextMsg.timestamp) - getMillis(m.timestamp)) <= MESSAGE_GROUP_WINDOW_MS);
                const canDelete = m.remitenteId === user?.uid;
                const messageMillis = getMillis(m.timestamp);
                const leidoPorOtros = messageMillis
                  ? Object.entries(chatReadBy || {})
                      .filter(([uid, ts]) => uid !== m.remitenteId && getMillis(ts) >= messageMillis)
                      .map(([uid]) => uid)
                  : [];
                const isSticker = m.tipo === 'sticker';
                const isStickerImg = m.tipo === 'sticker_imagen';
                const isGif = m.tipo === 'gif';
                const isAudio = m.tipo === 'audio';
                const isImg = m.tipo === 'imagen';
                const isDoc = m.tipo === 'documento';
                const bubbleRadiusStyle = {
                  borderTopLeftRadius: esMio ? '18px' : (groupedWithPrev ? '12px' : '18px'),
                  borderTopRightRadius: esMio ? (groupedWithPrev ? '12px' : '18px') : '18px',
                  borderBottomLeftRadius: esMio ? '18px' : (groupedWithNext ? '12px' : '8px'),
                  borderBottomRightRadius: esMio ? (groupedWithNext ? '12px' : '8px') : '18px'
                };

                return (
                  <div key={m.id} className={"group flex gap-2.5 " + (groupedWithNext ? 'mb-1.5 ' : 'mb-3 ') + (esMio ? 'flex-row-reverse' : '')}>
                    {!esMio && !groupedWithPrev && (
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0 mt-1"
                        style={{ background: 'rgba(14,165,233,0.16)', border: '1px solid rgba(14,165,233,0.3)' }}>
                        {getInitials(m.remitenteNombre)}
                      </div>
                    )}
                    {!esMio && groupedWithPrev && <div className="w-7 shrink-0" />}
                    <div className={"max-w-[72%] flex flex-col relative " + (esMio ? 'items-end' : 'items-start')}>
                      {!esMio && !groupedWithPrev && (
                        <p className="text-[10px] font-bold mb-1 px-0.5 text-sky-700">{m.remitenteNombre}</p>
                      )}

                      {m.respuestaA && (
                        <div className="mb-1 px-2 py-1.5 rounded-xl"
                          style={{ background: 'rgba(226,232,240,0.7)', border: '1px solid rgba(148,163,184,0.26)' }}>
                          <p className="text-[10px] font-semibold text-slate-600">{m.respuestaA.remitenteNombre || 'Usuario'}</p>
                          <p className="text-[11px] text-slate-500 truncate">{formatReplyText(m.respuestaA)}</p>
                        </div>
                      )}

                      <div className="relative">
                        <div
                          className={"absolute top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity " + (esMio ? 'right-full mr-2' : 'left-full ml-2')}
                          data-message-actions="true"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo({
                                id: m.id,
                                remitenteId: m.remitenteId,
                                remitenteNombre: m.remitenteNombre || 'Usuario',
                                tipo: m.tipo || 'texto',
                                texto: m.texto || ''
                              });
                              setOpenMessageMenuId(null);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: 'rgba(255,255,255,0.92)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.25)' }}
                            data-message-actions="true"
                          >
                            <ArrowLeft size={10} className="rotate-180" />
                            Responder
                          </button>

                          <div className="relative" data-message-actions="true">
                            <button
                              type="button"
                              onClick={() => setOpenMessageMenuId((prev) => prev === m.id ? null : m.id)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(255,255,255,0.92)', color: '#64748b', border: '1px solid rgba(148,163,184,0.25)' }}
                              data-message-actions="true"
                              title="Más opciones"
                            >
                              <MoreHorizontal size={13} />
                            </button>

                            {openMessageMenuId === m.id && (
                              <div
                                className={"absolute top-full mt-1 min-w-[132px] rounded-xl overflow-hidden " + (esMio ? 'right-0' : 'left-0')}
                                style={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(148,163,184,0.24)', boxShadow: '0 8px 20px rgba(15,23,42,0.14)' }}
                                data-message-actions="true"
                              >
                                <button
                                  type="button"
                                  onClick={() => verInfoMensaje(m)}
                                  className="w-full px-3 py-2 text-left text-[11px] font-medium flex items-center gap-2 hover:bg-slate-50"
                                  style={{ color: '#334155' }}
                                  data-message-actions="true"
                                >
                                  <Eye size={12} /> Información
                                </button>
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMessageMenuId(null);
                                      eliminarMensajeParaTodos(m);
                                    }}
                                    className="w-full px-3 py-2 text-left text-[11px] font-medium flex items-center gap-2 hover:bg-rose-50"
                                    style={{ color: '#dc2626' }}
                                    data-message-actions="true"
                                  >
                                    <Trash2 size={12} /> Eliminar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {isSticker ? (
                          <div className="text-3xl select-none leading-none px-1 py-0.5">{m.texto}</div>
                        ) : (isStickerImg || isGif) ? (
                          <img
                            src={m.archivoUrl}
                            alt={m.texto || (isGif ? 'GIF' : 'Sticker')}
                            className={(isGif ? 'max-w-[220px] max-h-[220px]' : 'max-w-[170px] max-h-[170px]') + ' rounded-2xl object-cover cursor-zoom-in'}
                            style={{ boxShadow: '0 4px 16px rgba(15,23,42,0.12)' }}
                            onClick={() => window.open(m.archivoUrl, '_blank')}
                          />
                        ) : isAudio ? (
                          <div className="px-3 py-2.5 rounded-2xl flex items-center gap-2 text-[12px]"
                            style={{
                              background: esMio ? 'rgba(224,242,254,0.95)' : 'rgba(255,255,255,0.95)',
                              color: '#334155',
                              boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
                              border: esMio ? '1px solid rgba(125,211,252,0.55)' : '1px solid rgba(148,163,184,0.22)',
                              ...bubbleRadiusStyle
                            }}>
                            <Mic size={13} />
                            <audio src={m.archivoUrl} controls className="h-7 max-w-[160px]" />
                          </div>
                        ) : isImg ? (
                          <img src={m.archivoUrl} alt={m.texto} className="max-w-[220px] max-h-[220px] rounded-2xl object-cover cursor-zoom-in"
                            style={{ boxShadow: '0 4px 16px rgba(15,23,42,0.12)' }}
                            onClick={() => window.open(m.archivoUrl, '_blank')} />
                        ) : isDoc ? (
                          <a href={m.archivoUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-[12px] font-medium"
                            style={{
                              background: esMio ? 'rgba(224,242,254,0.95)' : 'rgba(255,255,255,0.95)',
                              color: '#0369a1',
                              boxShadow: '0 2px 8px rgba(15,23,42,0.07)',
                              border: esMio ? '1px solid rgba(125,211,252,0.55)' : '1px solid rgba(148,163,184,0.22)',
                              ...bubbleRadiusStyle
                            }}>
                            <FileText size={13} /> {m.texto}
                          </a>
                        ) : (
                          <div className="px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                            style={{
                              background: esMio ? 'rgba(224,242,254,0.95)' : 'rgba(255,255,255,0.95)',
                              color: '#0f172a',
                              boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                              border: esMio ? '1px solid rgba(125,211,252,0.55)' : '1px solid rgba(148,163,184,0.22)',
                              ...bubbleRadiusStyle
                            }}>
                            {m.texto}
                          </div>
                        )}
                      </div>

                      {!groupedWithNext && (
                        <>
                          {/* Time + read indicator */}
                          <div className={"flex items-center gap-1.5 mt-1 px-0.5 " + (esMio ? 'flex-row-reverse' : '')}>
                            <span className="text-[9px] text-slate-400">{formatHora(m.timestamp)}</span>
                            {esMio && (
                              leidoPorOtros.length > 0
                                ? <div className="flex items-center gap-0.5 text-sky-600">
                                    <Eye size={10} />
                                    <span className="text-[9px] font-bold">{leidoPorOtros.length}</span>
                                  </div>
                                : <Check size={10} className="text-slate-400" />
                            )}
                          </div>

                          {/* Visto por avatares */}
                          {esMio && leidoPorOtros.length > 0 && (
                            <div className="flex items-center gap-0.5 mt-0.5 px-0.5">
                              {leidoPorOtros.slice(0, 3).map(uid => {
                                const u = usuarios.find(u => u.id === uid);
                                return u ? (
                                  <div key={uid} title={"Visto por " + u.nombre}
                                    className="w-4 h-4 rounded-md text-[8px] font-bold flex items-center justify-center text-slate-700"
                                    style={{ background: 'rgba(14,165,233,0.16)', border: '1px solid rgba(14,165,233,0.3)' }}>
                                    {getInitials(u.nombre)}
                                  </div>
                                ) : null;
                              })}
                              {leidoPorOtros.length > 3 && (
                                <span className="text-[8px] text-slate-400">+{leidoPorOtros.length - 3}</span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              <TypingIndicator names={typingUsers} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 px-4 pb-4 pt-2" style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
              {uploading && (
                <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px]"
                  style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.18)', color: '#0ea5e9' }}>
                  <Loader2 size={12} className="animate-spin" />
                  Subiendo... {uploadProgress}%
                </div>
              )}

              {isRecording ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="flex-1 text-[13px] font-bold text-rose-600">Grabando {formatTime(recordingTime)}</span>
                  <button type="button" onClick={detenerGrabacion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-rose-600"
                    style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Square size={11} /> Detener
                  </button>
                </div>
              ) : (
                <form onSubmit={enviarMensajeTexto}
                  className="flex flex-col gap-2 px-3 py-2 rounded-2xl relative"
                  style={{
                    background: 'rgba(255,255,255,0.96)',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    boxShadow: '0 2px 12px rgba(15,23,42,0.07)'
                  }}>
                  {replyTo && (
                    <div className="flex items-start gap-2 px-2.5 py-2 rounded-xl"
                      style={{ background: 'rgba(226,232,240,0.7)', border: '1px solid rgba(148,163,184,0.22)' }}>
                      <div className="h-full w-1 rounded-full bg-sky-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-sky-700">Respondiendo a {replyTo.remitenteNombre || 'Usuario'}</p>
                        <p className="text-[11px] text-slate-600 truncate">{formatReplyText(replyTo)}</p>
                      </div>
                      <button type="button" onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-slate-700">
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    {/* Toolbar */}
                    <div className="flex items-center gap-0.5 pb-1 shrink-0 relative">
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setShowStickerPicker(p => !p); }}
                        className="w-7 h-7 flex items-center justify-center rounded-xl transition-all"
                        style={{
                          color: showStickerPicker ? '#0ea5e9' : '#64748b',
                          background: showStickerPicker ? 'rgba(14,165,233,0.1)' : 'transparent'
                        }}>
                        <Smile size={16} />
                      </button>
                      <button type="button" onClick={() => imageInputRef.current?.click()}
                        className="w-7 h-7 flex items-center justify-center rounded-xl transition-all"
                        style={{ color: '#64748b' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#0ea5e9'; e.currentTarget.style.background = 'rgba(14,165,233,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
                        disabled={uploading}>
                        <ImageIcon size={15} />
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="w-7 h-7 flex items-center justify-center rounded-xl transition-all"
                        style={{ color: '#64748b' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#0369a1'; e.currentTarget.style.background = 'rgba(14,165,233,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
                        disabled={uploading}>
                        <Paperclip size={15} />
                      </button>
                      {showStickerPicker && (
                        <StickerPicker
                          onSelect={sticker => enviarSticker(sticker)}
                          onClose={() => setShowStickerPicker(false)}
                          imageStickers={customImageStickers}
                          onAddImageSticker={agregarStickerImagen}
                          onRemoveImageSticker={eliminarStickerImagen}
                        />
                      )}
                    </div>

                    {/* Text area */}
                    <textarea
                      value={nuevoMensaje}
                      onChange={e => { setNuevoMensaje(e.target.value); handleTyping(); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeTexto(e); } }}
                      onBlur={clearTypingStatus}
                      onPaste={handlePaste}
                      placeholder="Escribe un mensaje"
                      rows={1}
                      disabled={uploading}
                      className="flex-1 bg-transparent outline-none text-[13px] text-slate-700 resize-none overflow-y-auto custom-scrollbar py-1 placeholder:text-slate-400"
                      style={{ maxHeight: '96px', lineHeight: '1.6' }}
                    />

                    {/* Send/Mic */}
                    <div className="pb-1 shrink-0">
                      {nuevoMensaje.trim() ? (
                        <button type="submit" disabled={uploading}
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-50"
                          style={{ background: '#0ea5e9', boxShadow: '0 2px 8px rgba(14,165,233,0.28)' }}>
                          <Send size={14} />
                        </button>
                      ) : (
                        <button type="button" onClick={iniciarGrabacion} disabled={uploading}
                          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all disabled:opacity-50"
                          style={{ color: '#64748b', background: 'rgba(148,163,184,0.12)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'rgba(148,163,184,0.12)'; }}>
                          <Mic size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>

            {infoToast && (
              <div
                className="absolute bottom-24 right-5 z-40 w-[330px] max-w-[calc(100%-40px)] rounded-2xl p-3"
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(148,163,184,0.24)',
                  boxShadow: '0 14px 32px rgba(15,23,42,0.16)'
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-slate-700">Información del mensaje</p>
                    <p className="text-[10px] text-slate-400">ID {infoToast.idCorto || '-'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInfoToast(null)}
                    className="w-5 h-5 rounded-lg flex items-center justify-center"
                    style={{ color: '#64748b', background: 'rgba(148,163,184,0.16)' }}
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div className="col-span-2">
                    <span className="text-slate-400">Remitente:</span>{' '}
                    <span className="font-semibold text-slate-700">{infoToast.remitente}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Fecha:</span>{' '}
                    <span className="font-semibold text-slate-700">{infoToast.fecha}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Hora:</span>{' '}
                    <span className="font-semibold text-slate-700">{infoToast.hora}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Tipo:</span>{' '}
                    <span className="font-semibold text-slate-700 uppercase">{infoToast.tipo}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Visto por:</span>{' '}
                    <span className="font-semibold text-slate-700">
                      {infoToast.vistos?.length ? infoToast.vistos.join(', ') : 'Sin vistas registradas'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatPanel;
