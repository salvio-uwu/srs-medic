import React, { useEffect, useState, useRef } from 'react';
import { X, Search, FileUp, Trash2, Loader2 } from 'lucide-react';
import { db, storage } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getStudiesCatalog, resolveStudyPackages } from '../services/studyCatalogService';

const EstudioPrevioModal = ({ onClose, onBackToMenu, pacienteNombre, pacienteId, doctorId }) => {
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [modo, setModo] = useState('estudio'); // 'estudio' | 'paquete'
  const [clasificacion, setClasificacion] = useState('OTROS');
  const [usarClasificacion, setUsarClasificacion] = useState(false);
  
  const [busqueda, setBusqueda] = useState('');
  const [estudiosAgregados, setEstudiosAgregados] = useState([]);
  const [interpretacion, setInterpretacion] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [catalogoEstudios, setCatalogoEstudios] = useState([]);
  const fileInputRef = useRef();

  useEffect(() => {
    const cargarCatalogo = async () => {
      const rows = await getStudiesCatalog();
      setCatalogoEstudios(rows);
    };
    cargarCatalogo();
  }, []);

  const paquetesCatalogo = resolveStudyPackages(catalogoEstudios);

  const opcionesBusqueda = catalogoEstudios
    .filter((item) => {
      if (modo === 'paquete') return item.categoria === 'paquete' || paquetesCatalogo.includes(item.descripcion);
      return item.categoria !== 'paquete';
    })
    .filter((item) => !estudiosAgregados.includes(item.descripcion))
    .filter((item) => (`${item.descripcion} ${item.clave}`).toLowerCase().includes(busqueda.toLowerCase()))
    .slice(0, 30);

  const handleAgregarEstudio = (nombre) => {
    if (!estudiosAgregados.includes(nombre)) {
      setEstudiosAgregados([...estudiosAgregados, nombre]);
    }
    setBusqueda('');
  };

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    setArchivos([...archivos, ...newFiles]);
  };

  const handleGuardar = async () => {
    if (estudiosAgregados.length === 0) return alert("Debe agregar al menos un estudio.");
    if (!interpretacion.trim()) return alert("La interpretación es obligatoria.");

    setLoading(true);
    try {
      // 1. Subir archivos a Storage
      const urls = await Promise.all(archivos.map(async (file) => {
        const fileRef = ref(storage, `estudios_previos/${pacienteId}/${Date.now()}-${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
      }));

      // 2. Guardar en Firestore
      await addDoc(collection(db, "estudios_previos"), {
        pacienteId,
        pacienteNombre,
        doctorId,
        fecha,
        modo,
        clasificacion: usarClasificacion ? clasificacion : 'GENERAL',
        estudios: estudiosAgregados,
        interpretacion,
        adjuntos: urls,
        fechaRegistro: serverTimestamp()
      });

      alert("✅ Estudios previos registrados con éxito.");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error al guardar los estudios.");
    }
    setLoading(false);
  };

  const inputStyle = "h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all";

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-6xl h-[86vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-blue-700 font-black text-[28px] tracking-tight leading-none" style={{ fontFamily: 'Sora, sans-serif' }}>
              Registro de estudios previos: <span className="text-slate-700 uppercase">{pacienteNombre}</span>
            </h2>
            {onBackToMenu && (
              <button
                onClick={onBackToMenu}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 text-xs font-bold uppercase tracking-wide transition-all shadow-sm"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                Regresar al menu
              </button>
            )}
            <button onClick={onClose} className="p-2.5 rounded-xl text-slate-400 hover:bg-white hover:text-slate-700 transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto flex-1 bg-white">
          {/* BARRA DE CONFIGURACIÓN SUPERIOR */}
          <div className="flex flex-wrap items-center gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">Fecha</label>
              <input type="date" className={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={modo === 'estudio'} onChange={() => setModo('estudio')} className="accent-blue-500" /> *Por estudios
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={modo === 'paquete'} onChange={() => setModo('paquete')} className="accent-blue-500" /> *Por paquete
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" checked={usarClasificacion} onChange={e => setUsarClasificacion(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <label className="text-xs font-bold text-slate-600">Agregar clasificacion</label>
              <input disabled={!usarClasificacion} className={`${inputStyle} w-32 uppercase`} value={clasificacion} onChange={e => setClasificacion(e.target.value)} />
            </div>
          </div>

          {/* BUSCADOR */}
          <div className="relative bg-white border border-slate-200 rounded-2xl px-1">
            <input 
              placeholder="Buscar estudio dentro del catálogo" 
              className="w-full p-3 pl-11 rounded-2xl text-sm font-semibold text-slate-700 outline-none"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <Search className="absolute left-3 top-3 text-slate-300" size={18} />
            {busqueda && (
              <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-slate-200 rounded-xl z-50 max-h-44 overflow-y-auto mt-2">
                {opcionesBusqueda.map((s) => (
                  <div key={s.id} onClick={() => handleAgregarEstudio(s.descripcion)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm font-semibold text-slate-600 border-b border-slate-100 last:border-0">
                    {s.descripcion}
                    {s.clave && <div className="text-[11px] text-slate-400 font-medium mt-0.5">Clave: {s.clave}</div>}
                  </div>
                ))}
                {opcionesBusqueda.length === 0 && (
                  <div className="p-3 text-sm text-slate-400">No hay estudios disponibles con esa busqueda.</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* LADO IZQUIERDO: LISTA E INTERPRETACIÓN */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4">
                <h3 className="text-blue-700 font-black text-sm mb-2">Lista de estudios previos agregados</h3>
                <div className="border border-slate-200 rounded-xl min-h-[120px] p-3 bg-white flex flex-wrap gap-2">
                  {estudiosAgregados.map(s => (
                    <span key={s} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-blue-200">
                      {s} <Trash2 size={12} className="cursor-pointer hover:text-red-500" onClick={() => setEstudiosAgregados(estudiosAgregados.filter(x => x !== s))} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4">
                <h3 className="text-blue-700 font-black text-sm mb-2">Interpretacion de estudios</h3>
                <textarea 
                  className="w-full h-36 p-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-none bg-white"
                  placeholder="Escriba la interpretación clínica del estudio..."
                  value={interpretacion}
                  onChange={e => setInterpretacion(e.target.value)}
                />
              </div>
            </div>

            {/* LADO DERECHO: ADJUNTOS */}
            <div className="lg:col-span-1">
              <h3 className="text-blue-700 font-black text-sm mb-2">Adjuntos</h3>
              <div 
                onClick={() => fileInputRef.current.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50/50 transition-colors h-[320px] bg-slate-50/30"
              >
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                <FileUp size={48} className="text-slate-300 mb-2" />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Arrastre archivos a esta área <br/> (*.jpg, *.png, *.jpeg, *.pdf, *.mov, *.wmv, *.mpg, *.avi)
                </p>
                {archivos.length > 0 && (
                  <div className="mt-4 w-full text-[10px] font-bold text-blue-600 bg-blue-50 p-2 rounded">
                    {archivos.length} archivos seleccionados
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50/70">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="bg-white border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Regresar al menu
            </button>
          )}
          <button 
            onClick={handleGuardar}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
            style={{ fontFamily: 'Sora, sans-serif' }}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Guardar'}
          </button>
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all" style={{ fontFamily: 'Sora, sans-serif' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EstudioPrevioModal;