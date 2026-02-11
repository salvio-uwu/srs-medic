import React, { useState, useEffect } from 'react';
import { X, Baby, Calendar, Activity, Loader2, AlertCircle } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const HistoricoEmbarazosModal = ({ onClose, pacienteId, pacienteNombre }) => {
  const [loading, setLoading] = useState(true);
  const [embarazos, setEmbarazos] = useState([]);

  useEffect(() => {
    const fetchHistorico = async () => {
      try {
        // Consultamos una colección específica para detalles de cada embarazo
        const q = query(
          collection(db, "historico_embarazos"),
          where("pacienteId", "==", pacienteId),
          orderBy("anho", "desc")
        );
        
        const snap = await getDocs(q);
        setEmbarazos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error cargando histórico de embarazos:", error);
      }
      setLoading(false);
    };

    fetchHistorico();
  }, [pacienteId]);

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-100">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Baby size={20} className="text-rose-500"/> Histórico de Embarazos
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div className="mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paciente</p>
            <h4 className="text-xl font-black text-slate-800 uppercase">{pacienteNombre}</h4>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="font-bold text-sm uppercase">Cargando antecedentes...</p>
            </div>
          ) : embarazos.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No hay registros de embarazos previos detallados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {embarazos.map((emb) => (
                <div key={emb.id} className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-xs font-black uppercase">
                      Año: {emb.anho}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                      emb.resultado === 'Parto' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {emb.resultado}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Complicaciones:</span>
                      <span className="text-slate-700 font-medium">{emb.complicaciones || 'Ninguna'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Lugar:</span>
                      <span className="text-slate-700 font-medium">{emb.unidadMedica || 'No especificado'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-900 transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoricoEmbarazosModal;