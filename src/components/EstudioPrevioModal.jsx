import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  X, Search, FileUp, Trash2, Loader2, Upload, FileText, FileImage, FileArchive, File,
  Plus, Microscope, CheckCircle2, AlertCircle
} from 'lucide-react';
import { db, storage } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getStudiesCatalog } from '../services/studyCatalogService';

const FILE_ICON_MAP = {
  'image/jpeg': FileImage, 'image/png': FileImage, 'image/webp': FileImage, 'image/gif': FileImage,
  'application/pdf': FileText, 'application/zip': FileArchive, 'application/x-rar-compressed': FileArchive,
};

const FILE_COLOR_MAP = {
  'image/jpeg': 'text-rose-500 bg-rose-50', 'image/png': 'text-rose-500 bg-rose-50',
  'image/webp': 'text-rose-500 bg-rose-50', 'image/gif': 'text-rose-500 bg-rose-50',
  'application/pdf': 'text-red-500 bg-red-50', 'application/zip': 'text-amber-500 bg-amber-50',
  'application/x-rar-compressed': 'text-amber-500 bg-amber-50',
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const EstudioPrevioModal = ({ onClose, onBackToMenu, pacienteNombre, pacienteId, doctorId, medicoNombre }) => {
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  const [busqueda, setBusqueda] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropIndex, setDropIndex] = useState(-1);
  const [estudiosAgregados, setEstudiosAgregados] = useState([]);
  const [interpretacion, setInterpretacion] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [catalogoEstudios, setCatalogoEstudios] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef();
  const searchInputRef = useRef();
  const dropRef = useRef();
  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const showToast = (msg, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, msg, type });
    toastTimerRef.current = setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    const cargarCatalogo = async () => {
      const rows = await getStudiesCatalog();
      setCatalogoEstudios(rows.filter(item => item.categoria !== 'paquete'));
    };
    cargarCatalogo();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) && searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resultadosBusqueda = catalogoEstudios
    .filter((item) => !estudiosAgregados.includes(item.descripcion))
    .filter((item) => {
      if (!busqueda.trim()) return false;
      const q = busqueda.toLowerCase();
      return item.descripcion.toLowerCase().includes(q) || (item.clave || '').toLowerCase().includes(q);
    })
    .slice(0, 15);

  const handleAgregarEstudio = (nombre) => {
    if (!estudiosAgregados.includes(nombre)) {
      setEstudiosAgregados([...estudiosAgregados, nombre]);
    }
    setBusqueda('');
    setShowDropdown(false);
    setDropIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleAgregarManual = () => {
    const nombre = busqueda.trim();
    if (!nombre) return;
    if (estudiosAgregados.includes(nombre)) {
      setBusqueda('');
      setShowDropdown(false);
      return;
    }
    setEstudiosAgregados([...estudiosAgregados, nombre]);
    setBusqueda('');
    setShowDropdown(false);
    setDropIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleInputChange = (e) => {
    setBusqueda(e.target.value);
    setShowDropdown(true);
    setDropIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || resultadosBusqueda.length === 0) {
      if (e.key === 'Enter' && busqueda.trim()) {
        e.preventDefault();
        handleAgregarManual();
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        setBusqueda('');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropIndex(prev => (prev < resultadosBusqueda.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropIndex(prev => (prev > 0 ? prev - 1 : resultadosBusqueda.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dropIndex >= 0 && dropIndex < resultadosBusqueda.length) {
        handleAgregarEstudio(resultadosBusqueda[dropIndex].descripcion);
      } else if (busqueda.trim()) {
        handleAgregarManual();
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setBusqueda('');
    }
  };

  const processFiles = (newFiles) => {
    setArchivos((prev) => [...prev, ...newFiles]);
  };

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    processFiles(newFiles);
  };

  const handleDragEnter = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) processFiles(droppedFiles);
  }, []);

  const handleRemoveFile = (index) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index));
  };

  const puedeGuardar = estudiosAgregados.length > 0 || archivos.length > 0;

  const handleGuardar = async () => {
    if (!puedeGuardar) return showToast("Debe agregar al menos un estudio o subir un documento.", "error");

    setLoading(true);
    try {
      const urls = await Promise.all(archivos.map(async (file) => {
        const fileRef = ref(storage, `estudios_previos/${pacienteId}/${Date.now()}-${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
      }));

      await addDoc(collection(db, "estudios_previos"), {
        pacienteId,
        pacienteNombre,
        doctorId,
        medicoNombre: medicoNombre || '',
        fecha,
        modo: 'estudio',
        clasificacion: 'GENERAL',
        estudios: estudiosAgregados,
        interpretacion,
        adjuntos: urls,
        fechaRegistro: serverTimestamp()
      });

      showToast("Estudios registrados con exito.");
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error(error);
      showToast("Error al guardar los estudios.", "error");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      
      {toast.show && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg border backdrop-blur-md ${
          toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700' : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="bg-white w-full max-w-5xl h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">

        {/* HEADER */}
        <div className="bg-slate-50/70 px-6 py-4 border-b border-slate-200 shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-slate-800 font-black text-xl uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
              <Microscope size={20} className="text-blue-600" />
              Agregar Estudio
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Paciente: <span className="text-slate-800 font-bold uppercase">{pacienteNombre}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onBackToMenu && (
              <button onClick={onBackToMenu} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-200 text-[11px] font-bold uppercase tracking-wide transition-all" style={{ fontFamily: 'Sora, sans-serif' }}>
                Regresar al menú
              </button>
            )}
            <button onClick={onClose} disabled={loading} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-40">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* FECHA */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">Fecha</label>
            <input
              type="date"
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>

          {/* BUSCADOR DE ESTUDIOS */}
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Buscar estudio</h3>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                ref={searchInputRef}
                placeholder="Escribe para buscar un estudio..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                value={busqueda}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (busqueda.trim()) setShowDropdown(true); }}
              />
              {showDropdown && busqueda.trim() && (
                <div ref={dropRef} className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar">
                  {resultadosBusqueda.length > 0 ? (
                    resultadosBusqueda.map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => handleAgregarEstudio(item.descripcion)}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                          idx === dropIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                        } ${idx !== resultadosBusqueda.length - 1 ? 'border-b border-slate-50' : ''}`}
                      >
                        <span className="text-sm font-semibold truncate">{item.descripcion}</span>
                        {item.clave && <span className="text-[10px] text-slate-400 ml-2 shrink-0">{item.clave}</span>}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-center">
                      <p className="text-xs text-slate-400 font-medium">Sin resultados.</p>
                      {busqueda.trim() && (
                        <button
                          onClick={handleAgregarManual}
                          className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
                        >
                          <Plus size={12} /> Agregar "{busqueda.trim()}" manualmente
                        </button>
                      )}
                    </div>
                  )}
                  {resultadosBusqueda.length > 0 && (
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                      <button
                        onClick={handleAgregarManual}
                        className="w-full text-left text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus size={12} /> Agregar "{busqueda.trim()}" manualmente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ESTUDIOS AGREGADOS */}
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">
              Estudios seleccionados ({estudiosAgregados.length})
            </h3>
            <div className={`rounded-xl p-4 border border-slate-200 bg-slate-50 min-h-[60px] flex flex-wrap gap-2 ${estudiosAgregados.length === 0 ? 'items-center justify-center' : ''}`}>
              {estudiosAgregados.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">Selecciona del catálogo o escribe manualmente</p>
              ) : (
                estudiosAgregados.map(s => (
                  <span key={s} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-blue-100">
                    {s}
                    <button className="hover:text-red-500 text-blue-400 transition-colors" onClick={() => setEstudiosAgregados(estudiosAgregados.filter(x => x !== s))}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* INTERPRETACIÓN */}
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Interpretación (opcional)</h3>
            <textarea
              className="w-full h-24 p-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
              placeholder="Escriba la interpretación clínica..."
              value={interpretacion}
              onChange={e => setInterpretacion(e.target.value)}
            />
          </div>

          {/* ADJUNTOS */}
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <Upload size={14} /> Documentos adjuntos ({archivos.length})
            </h3>

            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 p-8 flex flex-col items-center justify-center gap-3
                ${isDragOver ? 'border-blue-400 bg-blue-50/80 scale-[1.01]' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 bg-slate-50/50'}
              `}
            >
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
              <div className={`p-3 rounded-xl transition-all ${isDragOver ? 'bg-blue-100 text-blue-600 scale-110' : 'bg-white text-slate-400 shadow-sm border border-slate-100'}`}>
                {isDragOver ? <Upload size={28} className="animate-bounce" /> : <FileUp size={28} />}
              </div>
              <div className="text-center">
                <p className={`text-xs font-bold transition-colors ${isDragOver ? 'text-blue-600' : 'text-slate-600'}`}>
                  {isDragOver ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic aquí'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">JPG, PNG, PDF, ZIP, etc.</p>
              </div>
            </div>

            {archivos.length > 0 && (
              <div className="mt-3 space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                {archivos.map((file, i) => {
                  const IconComponent = FILE_ICON_MAP[file.type] || File;
                  const colorClass = FILE_COLOR_MAP[file.type] || 'text-slate-500 bg-slate-50';
                  return (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-200 transition-all group">
                      <div className={`p-1.5 rounded-md shrink-0 ${colorClass}`}><IconComponent size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                        <p className="text-[10px] font-semibold text-slate-400">{formatBytes(file.size)}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 shrink-0 flex justify-end gap-3">
          {onBackToMenu && (
            <button onClick={onBackToMenu} className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-700 font-bold text-sm transition-all" style={{ fontFamily: 'Sora, sans-serif' }}>
              Regresar al menú
            </button>
          )}
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-sm transition-all">
            Cerrar
          </button>
          <button
            onClick={handleGuardar}
            disabled={!puedeGuardar || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Sora, sans-serif' }}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : null}
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EstudioPrevioModal;
