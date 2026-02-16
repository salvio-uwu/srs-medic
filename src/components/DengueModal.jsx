import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, Droplet, Download, Loader2, Eye, CheckCircle, XCircle } from 'lucide-react';
import DenguePDF from "./pdf/DenguePDF";

const DengueModal = ({ onClose, onBackToMenu, paciente, doctor }) => {
  
  if (!paciente || !doctor) return null;

  // Estado de los 4 indicadores
  // Por defecto, CONTROL es positivo (+) y los demás negativos (-)
  const [resultados, setResultados] = useState({
    control: 'POSITIVO',
    igm: 'NEGATIVO',
    igg: 'NEGATIVO',
    antigeno: 'NEGATIVO'
  });
  
  // Hora de la muestra
  const [horaMuestra, setHoraMuestra] = useState(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }));

  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // Función para alternar resultados
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
            <DenguePDF
                paciente={paciente}
                doctor={doctor}
                resultados={resultados}
                horaMuestra={horaMuestra}
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
                    <Droplet size={24}/>
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Prueba de Dengue</h2>
                   <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">
                     Panel Viral Completo
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
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                
                {/* Hora */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Horario de muestra</label>
                    <input 
                        type="time" 
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-rose-400"
                        value={horaMuestra}
                        onChange={(e) => setHoraMuestra(e.target.value)}
                    />
                </div>

                {/* Resultados */}
                <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Resultados del Panel</h3>
                    
                    {[
                        { k: 'control', l: 'CONTROL' },
                        { k: 'igm', l: '1 (IgM)' },
                        { k: 'igg', l: '2 (IgG)' },
                        { k: 'antigeno', l: 'ANTIGENO' },
                    ].map((test) => (
                        <div key={test.k} className="flex items-center justify-between mb-3 last:mb-0">
                            <span className="text-sm font-bold text-slate-700">{test.l}</span>
                            <button 
                                onClick={() => toggleResultado(test.k)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all w-28 justify-center shadow-sm ${
                                    resultados[test.k] === 'POSITIVO' 
                                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200' 
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                }`}
                            >
                                {resultados[test.k] === 'POSITIVO' ? '+' : '-'} {resultados[test.k]}
                            </button>
                        </div>
                    ))}
                </div>
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
                      download={`Dengue_${paciente.nombre.split(' ')[0]}.pdf`}
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
                        <Droplet size={48} />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="font-black text-sm uppercase tracking-widest text-white/60">
                            Vista Previa Inactiva
                        </p>
                        <p className="text-xs max-w-xs leading-relaxed text-white/40">
                            Configura los resultados y genera el documento.
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

export default DengueModal;