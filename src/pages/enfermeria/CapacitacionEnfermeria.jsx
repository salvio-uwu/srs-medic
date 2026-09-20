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

const getFileIcon = (nombre, size = 16) => {
  if (!nombre) return <FileText size={size} className="text-slate-500" />;
  const ext = nombre.split('.').pop().toLowerCase();
  if (ext === 'pdf') return <FileText size={size} className="text-slate-500" />;
  if (['doc', 'docx'].includes(ext)) return <FileText size={size} className="text-slate-500" />;
  if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet size={size} className="text-slate-500" />;
  if (['ppt', 'pptx'].includes(ext)) return <File size={size} className="text-slate-500" />;
  return <File size={size} className="text-slate-500" />;
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

  const QUICK_PROMPTS = [
    { label: 'Resumen', prompt: 'Hazme un resumen completo y estructurado de este documento.' },
    { label: 'Puntos clave', prompt: '¿Cuáles son los puntos clave de este documento?' },
    { label: 'Evaluación', prompt: 'Hazme una evaluación de 5 preguntas tipo examen con opciones múltiples.' },
    { label: 'Glosario', prompt: 'Dame un glosario con los términos técnicos más importantes.' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-slate-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Cargando capacitación...</p>
        </div>
      </div>
    );
  }

  if (docSeleccionado) {
    const previewUrl = getPreviewUrl(docSeleccionado.archivoUrl, docSeleccionado.archivoNombre);
    const tieneContenido = !!docSeleccionado.contenido?.trim();
    const tieneArchivo = !!docSeleccionado.archivoUrl;

    return (
      <div className="h-screen bg-[#f8f9fa] flex flex-col text-slate-700 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0 z-10">
          <button onClick={cerrarDocumento} className="p-2 -ml-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <BookOpen size={18} className="text-slate-700 shrink-0" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold text-slate-900 truncate" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              {docSeleccionado.titulo}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {docSeleccionado.categoria && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {docSeleccionado.categoria}
                </span>
              )}
              {docSeleccionado.archivoNombre && (
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  {docSeleccionado.archivoNombre}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {tieneArchivo && (
              <>
                <button onClick={() => setPreviewFullscreen(f => !f)} className="p-2 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title={previewFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
                  {previewFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <a href={docSeleccionado.archivoUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Descargar">
                  <Download size={16} />
                </a>
              </>
            )}
            <button
              onClick={() => showChat ? setShowChat(false) : abrirChat()}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-bold border transition-colors ${
                showChat
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Asistente IA</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <div className={`flex-1 flex flex-col min-w-0 ${showChat && !previewFullscreen ? 'hidden lg:flex' : ''}`}>
            {tieneArchivo && previewUrl ? (
              <div className="flex-1 relative bg-slate-100">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#f8f9fa]">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={24} className="text-slate-400 animate-spin" />
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
              <div className="flex-1 flex items-center justify-center bg-[#f8f9fa] p-8">
                <div className="text-center max-w-sm">
                  <FileText size={32} className="text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                  <h3 className="text-base font-bold text-slate-800 mb-2">{docSeleccionado.archivoNombre}</h3>
                  <p className="text-sm text-slate-400 mb-5">Este tipo de archivo no se puede previsualizar directamente. Descárgalo para verlo.</p>
                  <a href={docSeleccionado.archivoUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-bold text-sm transition-colors">
                    <Download size={15} /> Descargar archivo
                  </a>
                </div>
              </div>
            ) : tieneContenido ? (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <div className="max-w-3xl mx-auto">
                  {docSeleccionado.descripcion && (
                    <p className="text-sm text-slate-500 mb-4">{docSeleccionado.descripcion}</p>
                  )}
                  <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
                    <div className="text-[14px] leading-relaxed whitespace-pre-wrap text-slate-700">
                      {docSeleccionado.contenido}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#f8f9fa]">
                <div className="text-center">
                  <FolderOpen size={40} className="text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-slate-400 font-medium">Este documento no tiene contenido ni archivo adjunto.</p>
                </div>
              </div>
            )}
          </div>

          {showChat && !previewFullscreen && (
            <div className="w-full lg:w-[400px] lg:max-w-[45%] flex flex-col border-l border-slate-200 bg-white shrink-0">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-slate-700" strokeWidth={1.75} />
                  <span className="text-[13px] font-bold text-slate-800">Asistente IA</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowChat(false)} className="lg:hidden p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Ver documento">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => setShowChat(false)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="px-3 py-2.5 border-b border-slate-100 flex gap-1.5 overflow-x-auto shrink-0 bg-[#fafafa]">
                {QUICK_PROMPTS.map((qp) => (
                  <button key={qp.label} onClick={() => { setChatInput(qp.prompt); inputRef.current?.focus(); }}
                    className="shrink-0 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors">
                    {qp.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <Bot size={16} className="text-slate-400 shrink-0 mt-1.5" strokeWidth={1.75} />
                    )}
                    <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-[#fafafa] border border-slate-200 text-slate-700'
                    }`}>
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    </div>
                    {msg.role === 'user' && (
                      <User size={16} className="text-slate-400 shrink-0 mt-1.5" strokeWidth={1.75} />
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2.5 justify-start">
                    <Bot size={16} className="text-slate-400 shrink-0 mt-1.5" strokeWidth={1.75} />
                    <div className="bg-[#fafafa] border border-slate-200 rounded-lg px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-slate-400" />
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
                    className="flex-1 px-3.5 py-2.5 bg-[#fafafa] border border-slate-200 rounded-md text-[13px] font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white transition-all resize-none"
                    style={{ minHeight: '42px', maxHeight: '100px' }}
                  />
                  <button
                    onClick={enviarPregunta}
                    disabled={!chatInput.trim() || chatLoading}
                    className="shrink-0 w-10 h-10 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-md flex items-center justify-center transition-colors"
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

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-slate-700">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 leading-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              Capacitación
            </h1>
            <p className="text-[12px] text-slate-400 font-medium mt-0.5">
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} disponible{documentos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar documento..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#fafafa] border border-slate-200 rounded-md text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white transition-all"
            />
          </div>
          {categorias.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button onClick={() => setCategoriaFiltro('')}
                className={`shrink-0 px-3 py-2 rounded-md text-[11px] font-bold border transition-colors ${
                  !categoriaFiltro ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}>
                Todos
              </button>
              {categorias.map(cat => {
                const isActive = categoriaFiltro === cat;
                return (
                  <button key={cat} onClick={() => setCategoriaFiltro(isActive ? '' : cat)}
                    className={`shrink-0 px-3 py-2 rounded-md text-[11px] font-bold border transition-colors ${
                      isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
            <FolderOpen size={36} className="text-slate-300 mb-4" strokeWidth={1.5} />
            <h3 className="text-[15px] font-bold text-slate-700">
              {busqueda || categoriaFiltro ? 'Sin resultados' : 'Sin documentos'}
            </h3>
            <p className="text-sm text-slate-400 mt-1.5 text-center max-w-sm">
              {busqueda || categoriaFiltro
                ? 'Intenta con otros términos de búsqueda o categoría.'
                : 'El administrador aún no ha cargado documentos de capacitación.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {docsFiltrados.map(doc => {
              const tieneArchivo = !!doc.archivoUrl;
              return (
                <button
                  key={doc.id}
                  onClick={() => abrirDocumento(doc)}
                  className="text-left bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-400 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-[13px] font-bold text-slate-900 leading-snug group-hover:text-slate-700 transition-colors line-clamp-2" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                      {doc.titulo}
                    </h3>
                    {tieneArchivo && getFileIcon(doc.archivoNombre, 15)}
                  </div>
                  {doc.categoria && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      {doc.categoria}
                    </p>
                  )}
                  {doc.descripcion && (
                    <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{doc.descripcion}</p>
                  )}
                  <div className="flex items-center gap-3 pt-2.5 border-t border-slate-100">
                    {tieneArchivo && (
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Eye size={11} strokeWidth={1.75} /> Previsualización
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={11} strokeWidth={1.75} /> IA disponible
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
