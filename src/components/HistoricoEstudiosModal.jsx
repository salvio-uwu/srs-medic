import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const parseDateValue = (value) => {
  if (!value) return null;
  if (value?.toDate) {
    const parsed = value.toDate();
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateLabel = (value) => {
  const parsed = parseDateValue(value);
  return parsed
    ? parsed.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Fecha no disponible';
};

const HistoricoEstudiosModal = ({ onClose, onBackToMenu, pacienteId, pacienteNombre }) => {
  const [loading, setLoading] = useState(true);
  const [estudios, setEstudios] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [errorVacio, setErrorVacio] = useState(false);

  useEffect(() => {
    if (!pacienteId) {
      setEstudios([]);
      setSeleccionado(null);
      setErrorVacio(true);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const q = query(
      collection(db, "estudios_previos"),
      where("pacienteId", "==", pacienteId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => {
            const data = d.data();
            const fechaDate = parseDateValue(data.fecha);
            return {
              id: d.id,
              ...data,
              fechaDate,
              fechaLabel: formatDateLabel(data.fecha)
            };
          })
          .sort((a, b) => {
            const aTs = a.fechaDate?.getTime?.() || 0;
            const bTs = b.fechaDate?.getTime?.() || 0;
            return bTs - aTs;
          });

        setEstudios(docs);
        setErrorVacio(docs.length === 0);
        setSeleccionado((prev) => {
          if (docs.length === 0) return null;
          if (!prev?.id) return docs[0];
          return docs.find((row) => row.id === prev.id) || docs[0];
        });
        setLoading(false);
      },
      (error) => {
        console.error("Error cargando histórico:", error);
        setEstudios([]);
        setSeleccionado(null);
        setErrorVacio(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [pacienteId]);

  // Si no hay estudios, mostramos la alerta estilo Mac/Web de tu imagen
  if (errorVacio) {
    return (
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
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
                className="mt-6 w-24 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded font-bold text-sm transition-all ml-auto block"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                OK
              </button>
              {onBackToMenu && (
                <button
                  onClick={onBackToMenu}
                  className="mt-2 w-full py-2 bg-white border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 rounded font-bold text-sm transition-all"
                  style={{ fontFamily: 'Sora, sans-serif' }}
                >
                  Regresar al menu
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const boxStyle = "w-full p-3 border border-slate-200 rounded-lg bg-white min-h-[100px] text-sm text-slate-600 overflow-y-auto custom-scrollbar";

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-6xl h-[86vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
        
        {/* HEADER */}
        <div className="bg-slate-50/70 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs" style={{ fontFamily: 'Sora, sans-serif' }}>
                <Calendar size={14}/> Historico de estudios solicitados
            </div>
            <div className="flex items-center gap-2">
              {onBackToMenu && (
                <button
                  onClick={onBackToMenu}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 text-[11px] font-bold uppercase tracking-wide transition-all"
                  style={{ fontFamily: 'Sora, sans-serif' }}
                >
                  Regresar al menu
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-white hover:text-slate-700 transition-all"><X size={18}/></button>
            </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-bold">Cargando registros...</p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            
            {/* SIDEBAR: LISTA DE FECHAS */}
            <div className="w-64 border-r border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
                <select 
                  className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                  onChange={(e) => setSeleccionado(estudios.find(est => est.id === e.target.value))}
                  value={seleccionado?.id}
                >
                  {estudios.map(est => (
                    <option key={est.id} value={est.id}>{est.fechaLabel}</option>
                  ))}
                </select>
                 <div className="bg-blue-100 text-blue-800 text-center py-2 font-black text-xs uppercase tracking-wide rounded-xl border border-blue-200">
                   Fecha
                </div>
                <div className="space-y-1 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                  {estudios.map(est => (
                    <button 
                      key={est.id}
                      onClick={() => setSeleccionado(est)}
                      className={`w-full py-2 px-3 text-sm font-medium rounded transition-all text-left ${seleccionado?.id === est.id ? 'bg-white shadow-sm border border-slate-200 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      {est.fechaLabel}
                    </button>
                  ))}
                </div>
            </div>

            {/* CONTENIDO CENTRAL */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5 bg-white">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="text-blue-900 font-black text-3xl uppercase tracking-tight">{pacienteNombre}</h3>
                  <span className="text-slate-400 font-bold">{seleccionado?.fechaLabel || '--/--/----'}</span>
                </div>

                <div>
                    <h4 className="text-blue-600 font-bold text-sm mb-2">Estudios</h4>
                    <div className={boxStyle}>
                        {seleccionado?.estudios?.join(', ') || 'Sin información'}
                    </div>
                </div>

                <div>
                    <h4 className="text-blue-600 font-bold text-sm mb-2">Interpretación de resultados</h4>
                    <div className={boxStyle}>
                        {seleccionado?.interpretacion || 'Sin interpretación registrada'}
                    </div>
                </div>

                <div>
                    <h4 className="text-blue-600 font-bold text-sm mb-2">Nota general de estudio(s)</h4>
                    <div className={boxStyle}>
                        {seleccionado?.notaGeneral || 'Sin notas adicionales'}
                    </div>
                </div>
            </div>

            {/* LADO DERECHO: ADJUNTOS */}
            <div className="w-72 border-l border-slate-200 p-6 flex flex-col bg-slate-50/40">
              <h4 className="text-blue-700 font-black text-sm mb-4 uppercase tracking-wide">Adjuntos</h4>
                <div className="flex-1 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center p-4 text-center">
                    {seleccionado?.adjuntos?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[400px]">
                        {seleccionado.adjuntos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="w-full h-20 bg-slate-50 rounded border border-slate-200 flex items-center justify-center hover:bg-blue-50 transition-colors overflow-hidden">
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
                    {onBackToMenu && (
                      <button
                        onClick={onBackToMenu}
                        className="w-full py-2 bg-white border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 rounded font-bold text-sm shadow-sm transition-all uppercase"
                        style={{ fontFamily: 'Sora, sans-serif' }}
                      >
                        Regresar al menu
                      </button>
                    )}
                    <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all uppercase" style={{ fontFamily: 'Sora, sans-serif' }}>Guardar</button>
                    <button onClick={onClose} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all uppercase" style={{ fontFamily: 'Sora, sans-serif' }}>Cerrar</button>
                </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoEstudiosModal;