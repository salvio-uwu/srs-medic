import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, FileText, Search, Send, Loader2,
  Sparkles, X, FolderOpen, Bot, User,
  Download, Eye, FileSpreadsheet, File, Maximize2, Minimize2
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const normalizeText = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CAT_COLORS = {
  'Protocolos': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'Procedimientos': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  'Normas': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  'Guías clínicas': { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  'Farmacología': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
};
const DEFAULT_CAT_COLOR = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' };

const getFileIcon = (nombre) => {
  if (!nombre) return <FileText size={18} />;
  const ext = nombre.split('.').pop().toLowerCase();
  if (ext === 'pdf') return <FileText size={18} className="text-rose-500" />;
  if (['doc', 'docx'].includes(ext)) return <FileText size={18} className="text-blue-600" />;
  if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet size={18} className="text-emerald-600" />;
  if (['ppt', 'pptx'].includes(ext)) return <File size={18} className="text-orange-500" />;
  return <File size={18} className="text-slate-500" />;
};

const getFileExt = (nombre) => {
  if (!nombre) return '';
  return nombre.split('.').pop().toLowerCase();
};

const getPreviewUrl = (archivoUrl, archivoNombre) => {
  if (!archivoUrl) return null;
  const ext = getFileExt(archivoNombre);
  if (ext === 'pdf') return archivoUrl;
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(archivoUrl)}&embedded=true`;
  }
  return null;
};

const formatMessage = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n• /g, '<br/>• ')
    .replace(/\n- /g, '<br/>- ')
    .replace(/\n\d+\. /g, (match) => '<br/>' + match.trim() + ' ')
    .replace(/\n/g, '<br/>');
};

const CapacitacionEnfermeria = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [docSeleccionado, setDocSeleccionado] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'catalogo_documentos_capacitacion'), orderBy('orden', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setDocumentos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.activo !== false));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const categorias = useMemo(() => [...new Set(documentos.map(d => d.categoria).filter(Boolean))].sort(), [documentos]);

  const docsFiltrados = useMemo(() => {
    const term = normalizeText(busqueda);
    return documentos.filter(d => {
      const matchCat = !categoriaFiltro || d.categoria === categoriaFiltro;
      const matchSearch = !term || normalizeText(d.titulo).includes(term) || normalizeText(d.categoria).includes(term) || normalizeText(d.descripcion).includes(term);
      return matchCat && matchSearch;
    });
  }, [documentos, busqueda, categoriaFiltro]);

  const abrirDocumento = (doc) => {
    setDocSeleccionado(doc);
    setIframeLoading(true);
    setChatMessages([{
      role: 'assistant',
      content: `¡Hola! Soy tu asistente de capacitación para **"${doc.titulo}"**.\n\nPuedo ayudarte a:\n• Resumir el contenido\n• Responder preguntas\n• Explicar conceptos\n• Hacer evaluaciones\n\n¿En qué te puedo ayudar?`
    }]);
    setChatInput('');
    setShowChat(true);
  };

  const cerrarDocumento = () => {
    setDocSeleccionado(null);
    setShowChat(false);
    setChatMessages([]);
    setChatInput('');
    setPreviewFullscreen(false);
  };

  const abrirChat = () => {
    if (chatMessages.length === 0) {
      setChatMessages([{
        role: 'assistant',
        content: `¡Hola! Soy tu asistente de capacitación para **"${docSeleccionado.titulo}"**.\n\nPuedo ayudarte a:\n• Resumir el contenido\n• Responder preguntas\n• Explicar conceptos\n• Hacer evaluaciones\n\n¿En qué te puedo ayudar?`
      }]);
    }
    setShowChat(true);
    setPreviewFullscreen(false);
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const enviarPregunta = async () => {
    if (!chatInput.trim() || chatLoading || !docSeleccionado) return;
    const pregunta = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: pregunta }]);
    setChatLoading(true);
    try {
      const askGemini = httpsCallable(functions, 'askGemini');
      const contextoDoc = `DOCUMENTO: ${docSeleccionado.titulo}\nCategoría: ${docSeleccionado.categoria || 'General'}\nDescripción: ${docSeleccionado.descripcion || ''}\n\nCONTENIDO:\n${docSeleccionado.contenido || 'No hay contenido de texto disponible.'}`;
      const historial = chatMessages.slice(-8).map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n');
      const prompt = `Eres un asistente de capacitación médica para enfermería. Ayuda al personal a comprender documentos de capacitación.\n\nCONTEXTO:\n${contextoDoc}\n\nHISTORIAL:\n${historial}\n\nPREGUNTA:\n${pregunta}\n\nINSTRUCCIONES:\n- Responde claro, conciso y profesional en español.\n- Basa tus respuestas en el contenido del documento.\n- Usa **negritas** y viñetas (•) para organizar.\n- Si piden resumen, hazlo estructurado.\n- Si piden evaluación, crea preguntas de opción múltiple.`;
      const result = await askGemini({ prompt });
      setChatMessages(prev => [...prev, { role: 'assistant', content: result.data.result }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Error al procesar tu pregunta. Intenta de nuevo.' }]);
    }
    setChatLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarPregunta(); }
  };

  const getCatColor = (cat) => CAT_COLORS[cat] || DEFAULT_CAT_COLOR;

  const QUICK_PROMPTS = [
    { label: 'Resumen', prompt: 'Hazme un resumen completo y estructurado de este documento.' },
    { label: 'Puntos clave', prompt: '¿Cuáles son los puntos clave de este documento?' },
    { label: 'Evaluación', prompt: 'Hazme una evaluación de 5 preguntas tipo examen con opciones múltiples.' },
    { label: 'Glosario', prompt: 'Dame un glosario con los términos técnicos más importantes.' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
          <p className="text-sm font-bold text-slate-400">Cargando capacitación...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // ─── VISTA DOCUMENTO: PREVIEW + CHAT OPCIONAL ───
  // ═══════════════════════════════════════════════════
  if (docSeleccionado) {
    const catColor = getCatColor(docSeleccionado.categoria);
    const previewUrl = getPreviewUrl(docSeleccionado.archivoUrl, docSeleccionado.archivoNombre);
    const tieneContenido = !!docSeleccionado.contenido?.trim();
    const tieneArchivo = !!docSeleccionado.archivoUrl;

    return (
      <div className="h-screen bg-slate-50 flex flex-col text-slate-700 overflow-hidden">
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 shrink-0 z-10">
          <button onClick={cerrarDocumento} className="p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
            {tieneArchivo ? getFileIcon(docSeleccionado.archivoNombre) : <BookOpen size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold text-slate-800 truncate" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              {docSeleccionado.titulo}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {docSeleccionado.categoria && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${catColor.bg} ${catColor.border} ${catColor.text}`}>
                  {docSeleccionado.categoria}
                </span>
              )}
              {docSeleccionado.archivoNombre && (
                <span className="text-[10px] text-slate-400 font-medium">
                  {docSeleccionado.archivoNombre}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tieneArchivo && (
              <>
                <button onClick={() => setPreviewFullscreen(f => !f)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title={previewFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
                  {previewFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <a href={docSeleccionado.archivoUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Descargar">
                  <Download size={18} />
                </a>
              </>
            )}
            <button
              onClick={() => showChat ? setShowChat(false) : abrirChat()}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                showChat
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/25'
                  : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'
              }`}
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">Asistente IA</span>
            </button>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 flex min-h-0">
          {/* ─── PANEL PREVIEW ─── */}
          <div className={`flex-1 flex flex-col min-w-0 ${showChat && !previewFullscreen ? 'hidden lg:flex' : ''}`}>
            {tieneArchivo && previewUrl ? (
              <div className="flex-1 relative bg-slate-100">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-50">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={28} className="text-blue-500 animate-spin" />
                      <p className="text-sm font-medium text-slate-400">Cargando documento...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={docSeleccionado.titulo}
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            ) : tieneArchivo && !previewUrl ? (
              <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
                <div className="text-center max-w-sm">
                  <div className="w-20 h-20 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                    {getFileIcon(docSeleccionado.archivoNombre)}
                  </div>
                  <h3 className="text-base font-bold text-slate-700 mb-2">{docSeleccionado.archivoNombre}</h3>
                  <p className="text-sm text-slate-400 mb-5">Este tipo de archivo no se puede previsualizar directamente. Descárgalo para verlo.</p>
                  <a href={docSeleccionado.archivoUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-md shadow-blue-500/25">
                    <Download size={16} /> Descargar archivo
                  </a>
                </div>
              </div>
            ) : tieneContenido ? (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <div className="max-w-3xl mx-auto">
                  {docSeleccionado.descripcion && (
                    <p className="text-sm text-slate-500 mb-4 italic">{docSeleccionado.descripcion}</p>
                  )}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                    <div className="text-[14px] leading-relaxed whitespace-pre-wrap text-slate-700">
                      {docSeleccionado.contenido}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <FolderOpen size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-sm text-slate-400 font-medium">Este documento no tiene contenido ni archivo adjunto.</p>
                </div>
              </div>
            )}
          </div>

          {/* ─── PANEL CHAT IA (lateral colapsable) ─── */}
          {showChat && !previewFullscreen && (
            <div className="w-full lg:w-[420px] lg:max-w-[45%] flex flex-col border-l border-slate-200 bg-white shrink-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
                    <Sparkles size={14} />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">Asistente IA</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowChat(false)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Ver documento">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => setShowChat(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="px-3 py-2.5 border-b border-slate-100 flex gap-1.5 overflow-x-auto shrink-0 bg-slate-50/50">
                {QUICK_PROMPTS.map((qp) => (
                  <button key={qp.label} onClick={() => { setChatInput(qp.prompt); inputRef.current?.focus(); }}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:border-violet-200 hover:text-violet-600 transition-colors">
                    {qp.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                        <Bot size={14} />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 rounded-bl-md'
                    }`}>
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                        <User size={14} />
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
                      <Bot size={14} />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-violet-500" />
                        <span className="text-[11px] text-slate-400 font-medium">Analizando...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="shrink-0 border-t border-slate-200 px-3 py-2.5 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregunta sobre el documento..."
                    rows={1}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50 focus:bg-white transition-all resize-none"
                    style={{ minHeight: '42px', maxHeight: '100px' }}
                  />
                  <button
                    onClick={enviarPregunta}
                    disabled={!chatInput.trim() || chatLoading}
                    className="shrink-0 w-10 h-10 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
                  >
                    {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // ─── LISTA DE DOCUMENTOS ───
  // ═══════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-700">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-violet-500/25">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-slate-800" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              Capacitación
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} disponible{documentos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar documento..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all"
            />
          </div>
          {categorias.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <button onClick={() => setCategoriaFiltro('')}
                className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                  !categoriaFiltro ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}>
                Todos
              </button>
              {categorias.map(cat => {
                const cc = getCatColor(cat);
                const isActive = categoriaFiltro === cat;
                return (
                  <button key={cat} onClick={() => setCategoriaFiltro(isActive ? '' : cat)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                      isActive ? `${cc.bg} ${cc.border} ${cc.text}` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {docsFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <FolderOpen size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-600">
              {busqueda || categoriaFiltro ? 'Sin resultados' : 'Sin documentos'}
            </h3>
            <p className="text-sm text-slate-400 mt-1 text-center max-w-sm">
              {busqueda || categoriaFiltro
                ? 'Intenta con otros términos de búsqueda o categoría.'
                : 'El administrador aún no ha cargado documentos de capacitación.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docsFiltrados.map(doc => {
              const cc = getCatColor(doc.categoria);
              const tieneArchivo = !!doc.archivoUrl;
              const tieneContenido = !!doc.contenido?.trim();
              return (
                <button
                  key={doc.id}
                  onClick={() => abrirDocumento(doc)}
                  className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-md hover:shadow-blue-500/5 transition-all group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${cc.bg} ${cc.border} border flex items-center justify-center shrink-0`}>
                      {tieneArchivo ? getFileIcon(doc.archivoNombre) : <FileText size={18} className={cc.text} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-bold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                        {doc.titulo}
                      </h3>
                      {doc.categoria && (
                        <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${cc.bg} ${cc.border} ${cc.text}`}>
                          {doc.categoria}
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.descripcion && (
                    <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-3 mb-3">{doc.descripcion}</p>
                  )}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    {tieneArchivo && (
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                        <Eye size={10} /> Previsualización
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={10} /> IA disponible
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CapacitacionEnfermeria;