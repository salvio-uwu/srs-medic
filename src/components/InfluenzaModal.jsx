import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, Thermometer, Download, Loader2, Eye, CheckCircle, AlertTriangle } from 'lucide-react';
import InfluenzaPDF from "./pdf/InfluenzaPDF";

const InfluenzaModal = ({ onClose, onBackToMenu, paciente, doctor }) => {
  
  if (!paciente || !doctor) return null;

  // Estado de los 3 indicadores
  const [resultados, setResultados] = useState({
    influenzaB: 'NEGATIVO',
    influenzaA: 'NEGATIVO',
    h1n1: 'NEGATIVO'
  });
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // Función para alternar entre NEGATIVO / POSITIVO
  const toggleResultado = (key) => {
    setResultados(prev => ({
        ...prev,
        [key]: prev[key] === 'NEGATIVO' ? 'POSITIVO' : 'NEGATIVO'
    }));
  };

  const generarPDF = async () => {
    setLoading(true);
    try {
        const Doc = (
            <InfluenzaPDF
                paciente={paciente}
                doctor={doctor}
                resultados={resultados}
            />
        );
        const blob = await pdf(Doc).toBlob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
    } catch (error) {
        console.error("Error generando PDF:", error);
        alert("Error al generar documento: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-white/20">
        
        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBackToMenu} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
              <ArrowLeft size={24}/>
            </button>
            <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                    <Thermometer size={24}/>
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Prueba de Influenza</h2>
                   <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">
                     A + B + H1N1
                   </p>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
            <X size={26}/>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* PANEL IZQUIERDO */}
          <div className="w-96 p-6 border-r border-slate-100 bg-slate-50/80 space-y-6 overflow-y-auto custom-scrollbar flex flex-col">
             
             {/* CONFIGURACIÓN */}
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Resultados del Panel</h3>
                
                {[
                    { k: 'influenzaB', l: 'Influenza B' },
                    { k: 'influenzaA', l: 'Influenza A' },
                    { k: 'h1n1', l: 'Influenza A (H1N1)' },
                ].map((test) => (
                    <div key={test.k} className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700">{test.l}</span>
                        <button 
                            onClick={() => toggleResultado(test.k)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all w-28 justify-center shadow-sm ${
                                resultados[test.k] === 'NEGATIVO' 
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200' 
                                : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                            }`}
                        >
                            {resultados[test.k] === 'NEGATIVO' ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                            {resultados[test.k]}
                        </button>
                    </div>
                ))}
             </div>

             <div className="flex-1"></div>

             {/* BOTONES */}
             <div className="space-y-3">
                <button 
                    onClick={generarPDF}
                    disabled={loading}
                    className="w-full py-3 bg-white border-2 border-rose-100 text-rose-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-rose-50 transition-all"
                >
                    {loading ? <Loader2 size={16} className="animate-spin"/> : <Eye size={16} />} 
                    Previsualizar
                </button>

                {pdfUrl && (
                    <a 
                      href={pdfUrl} 
                      download={`Influenza_${paciente.nombre.split(' ')[0]}.pdf`}
                      className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-md transition-all decoration-0"
                    >
                      <Download size={16} /> Descargar PDF
                    </a>
                )}
             </div>
          </div>

          {/* VISOR DERECHO */}
          <div className="flex-1 bg-slate-800/90 relative flex items-center justify-center p-4">
             {pdfUrl ? (
                 <div className="h-full w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <iframe src={pdfUrl} className="w-full h-full border-none" title="Vista Previa PDF" />
                 </div>
             ) : (
                 <div className="flex flex-col items-center justify-center text-white/50 gap-6 animate-in fade-in">
                    <div className="p-6 rounded-full bg-white/5 border-2 border-white/10 border-dashed">
                        <Thermometer size={48} />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="font-black text-sm uppercase tracking-widest text-white/60">
                            Vista Previa Inactiva
                        </p>
                        <p className="text-xs max-w-xs leading-relaxed text-white/40">
                            Configura los resultados del panel viral y genera el documento.
                        </p>
                    </div>
                 </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default InfluenzaModal;