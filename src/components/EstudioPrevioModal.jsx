import React, { useState, useRef } from 'react';
import { X, Search, FileUp, Save, Trash2, Loader2, Package, FlaskConical } from 'lucide-react';
import { db, storage } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const EstudioPrevioModal = ({ onClose, pacienteNombre, pacienteId, doctorId }) => {
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [modo, setModo] = useState('estudio'); // 'estudio' | 'paquete'
  const [clasificacion, setClasificacion] = useState('OTROS');
  const [usarClasificacion, setUsarClasificacion] = useState(false);
  
  const [busqueda, setBusqueda] = useState('');
  const [estudiosAgregados, setEstudiosAgregados] = useState([]);
  const [interpretacion, setInterpretacion] = useState('');
  const [archivos, setArchivos] = useState([]);
  const fileInputRef = useRef();

  // Simulación de catálogo (Aquí podrías conectar un JSON de estudios)
  const CATALOGO = ["Biometría Hemática", "Química Sanguínea", "Perfil Lipídico", "Examen General de Orina", "Radiografía de Tórax"];

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

  const inputStyle = "p-2 bg-white border border-slate-200 rounded text-sm focus:border-cyan-500 outline-none transition-all";

  return (
    <div className="fixed inset-0 z-[140] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
        
        {/* HEADER */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white">
          <h2 className="text-cyan-500 font-bold text-lg">
            Registro de estudios previos: <span className="text-slate-700 uppercase">{pacienteNombre}</span>
          </h2>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[85vh]">
          {/* BARRA DE CONFIGURACIÓN SUPERIOR */}
          <div className="flex flex-wrap items-center gap-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">*Fecha</label>
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
              <input type="checkbox" checked={usarClasificacion} onChange={e => setUsarClasificacion(e.target.checked)} className="w-4 h-4 accent-cyan-500" />
              <label className="text-xs font-bold text-slate-600">Agregar clasificación</label>
              <input disabled={!usarClasificacion} className={`${inputStyle} w-32 uppercase`} value={clasificacion} onChange={e => setClasificacion(e.target.value)} />
            </div>
          </div>

          {/* BUSCADOR */}
          <div className="relative">
            <input 
              placeholder="Buscar estudio dentro del catálogo" 
              className="w-full p-2.5 pl-10 border-b border-slate-200 text-sm outline-none focus:border-cyan-500"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <Search className="absolute left-3 top-3 text-slate-300" size={18} />
            {busqueda && (
              <div className="absolute top-full left-0 w-full bg-white shadow-xl border rounded-b-lg z-50 max-h-40 overflow-y-auto">
                {CATALOGO.filter(s => s.toLowerCase().includes(busqueda.toLowerCase())).map(s => (
                  <div key={s} onClick={() => handleAgregarEstudio(s)} className="p-3 hover:bg-cyan-50 cursor-pointer text-sm text-slate-600 border-b last:border-0">{s}</div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* LADO IZQUIERDO: LISTA E INTERPRETACIÓN */}
            <div className="lg:col-span-3 space-y-4">
              <div>
                <h3 className="text-cyan-500 font-bold text-sm mb-2">Lista de estudios previos agregados</h3>
                <div className="border border-slate-200 rounded-lg min-h-[120px] p-3 bg-slate-50/30 flex flex-wrap gap-2">
                  {estudiosAgregados.map(s => (
                    <span key={s} className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-cyan-200">
                      {s} <Trash2 size={12} className="cursor-pointer hover:text-red-500" onClick={() => setEstudiosAgregados(estudiosAgregados.filter(x => x !== s))} />
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-cyan-500 font-bold text-sm mb-2">*Interpretación de estudios</h3>
                <textarea 
                  className="w-full h-32 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-cyan-500 resize-none"
                  placeholder="Escriba la interpretación clínica del estudio..."
                  value={interpretacion}
                  onChange={e => setInterpretacion(e.target.value)}
                />
              </div>
            </div>

            {/* LADO DERECHO: ADJUNTOS */}
            <div className="lg:col-span-1">
              <h3 className="text-cyan-500 font-bold text-sm mb-2">Adjuntos</h3>
              <div 
                onClick={() => fileInputRef.current.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors h-[280px]"
              >
                <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                <FileUp size={48} className="text-slate-300 mb-2" />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Arrastre archivos a esta área <br/> (*.jpg, *.png, *.jpeg, *.pdf, *.mov, *.wmv, *.mpg, *.avi)
                </p>
                {archivos.length > 0 && (
                  <div className="mt-4 w-full text-[10px] font-bold text-cyan-600 bg-cyan-50 p-2 rounded">
                    {archivos.length} archivos seleccionados
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
          <button 
            onClick={handleGuardar}
            disabled={loading}
            className="bg-cyan-400 hover:bg-cyan-500 text-white px-8 py-2 rounded font-bold text-sm shadow transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Guardar'}
          </button>
          <button onClick={onClose} className="bg-cyan-400 hover:bg-cyan-500 text-white px-8 py-2 rounded font-bold text-sm shadow transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EstudioPrevioModal;