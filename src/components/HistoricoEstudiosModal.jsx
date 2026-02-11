import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const HistoricoEstudiosModal = ({ onClose, pacienteId, pacienteNombre }) => {
  const [loading, setLoading] = useState(true);
  const [estudios, setEstudios] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [errorVacio, setErrorVacio] = useState(false);

  useEffect(() => {
    const fetchHistorico = async () => {
      try {
        // Consultamos la colección 'estudios_previos' (o la que uses para guardar resultados)
        const q = query(
          collection(db, "estudios_previos"),
          where("pacienteId", "==", pacienteId),
          orderBy("fecha", "desc")
        );
        
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (docs.length === 0) {
          setErrorVacio(true);
        } else {
          setEstudios(docs);
          setSeleccionado(docs[0]); // Seleccionar el más reciente por defecto
        }
      } catch (error) {
        console.error("Error cargando histórico:", error);
      }
      setLoading(false);
    };

    fetchHistorico();
  }, [pacienteId]);

  // Si no hay estudios, mostramos la alerta estilo Mac/Web de tu imagen
  if (errorVacio) {
    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95">
          <div className="flex items-start gap-4">
            <div className="bg-slate-100 p-3 rounded-full">
              <AlertCircle size={32} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 leading-tight">
                El paciente no cuenta con estudios solicitados
              </p>
              <button 
                onClick={onClose}
                className="mt-6 w-24 py-1.5 bg-cyan-400 hover:bg-cyan-500 text-white rounded font-bold text-sm transition-all ml-auto block"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const boxStyle = "w-full p-3 border border-slate-200 rounded-lg bg-white min-h-[100px] text-sm text-slate-600 overflow-y-auto custom-scrollbar";

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95">
        
        {/* HEADER */}
        <div className="bg-slate-100/50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                <Calendar size={14}/> Histórico de estudios solicitados
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-bold">Cargando registros...</p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            
            {/* SIDEBAR: LISTA DE FECHAS */}
            <div className="w-64 border-r border-slate-200 bg-slate-50/30 p-4 flex flex-col gap-3">
                <select 
                  className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                  onChange={(e) => setSeleccionado(estudios.find(est => est.id === e.target.value))}
                  value={seleccionado?.id}
                >
                  {estudios.map(est => (
                    <option key={est.id} value={est.id}>{est.fecha}</option>
                  ))}
                </select>
                <div className="bg-blue-100 text-blue-800 text-center py-1.5 font-bold text-sm rounded shadow-sm">
                   Fecha
                </div>
                <div className="space-y-1 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                  {estudios.map(est => (
                    <button 
                      key={est.id}
                      onClick={() => setSeleccionado(est)}
                      className={`w-full py-2 px-3 text-sm font-medium rounded transition-all text-left ${seleccionado?.id === est.id ? 'bg-white shadow-sm border border-slate-200 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      {est.fecha}
                    </button>
                  ))}
                </div>
            </div>

            {/* CONTENIDO CENTRAL */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="text-blue-900 font-black text-lg uppercase tracking-tight">{pacienteNombre}</h3>
                    <span className="text-slate-400 font-bold">{seleccionado?.fecha || '--/--/----'}</span>
                </div>

                <div>
                    <h4 className="text-cyan-500 font-bold text-sm mb-2">Estudios</h4>
                    <div className={boxStyle}>
                        {seleccionado?.estudios?.join(', ') || 'Sin información'}
                    </div>
                </div>

                <div>
                    <h4 className="text-cyan-500 font-bold text-sm mb-2">Interpretación de resultados</h4>
                    <div className={boxStyle}>
                        {seleccionado?.interpretacion || 'Sin interpretación registrada'}
                    </div>
                </div>

                <div>
                    <h4 className="text-cyan-500 font-bold text-sm mb-2">Nota general de estudio(s)</h4>
                    <div className={boxStyle}>
                        {seleccionado?.notaGeneral || 'Sin notas adicionales'}
                    </div>
                </div>
            </div>

            {/* LADO DERECHO: ADJUNTOS */}
            <div className="w-64 border-l border-slate-200 p-6 flex flex-col">
                <h4 className="text-cyan-500 font-bold text-sm mb-4">Adjuntos</h4>
                <div className="flex-1 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center p-4 text-center">
                    {seleccionado?.adjuntos?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[400px]">
                        {seleccionado.adjuntos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="w-full h-20 bg-slate-50 rounded border border-slate-200 flex items-center justify-center hover:bg-cyan-50 transition-colors overflow-hidden">
                             {url.includes('.pdf') ? <FileText className="text-red-400" /> : <img src={url} alt="adjunto" className="w-full h-full object-cover"/>}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <>
                        <ImageIcon size={48} className="text-slate-200 mb-2" />
                        <p className="text-[10px] text-slate-400 leading-tight">
                          No hay archivos adjuntos para este estudio.
                        </p>
                      </>
                    )}
                </div>
                <div className="mt-6 flex flex-col gap-2">
                    <button className="w-full py-2 bg-cyan-400 hover:bg-cyan-500 text-white rounded font-bold text-sm shadow-sm transition-all uppercase">Guardar</button>
                    <button onClick={onClose} className="w-full py-2 bg-cyan-400 hover:bg-cyan-500 text-white rounded font-bold text-sm shadow-sm transition-all uppercase">Cerrar</button>
                </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoEstudiosModal;