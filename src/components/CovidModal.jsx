import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, Activity, Download, Loader2, Eye, CheckCircle, XCircle } from 'lucide-react';
import CovidPDF from "./pdf/CovidPDF";

const CovidModal = ({ onClose, onBackToMenu, paciente, doctor }) => {
  
  if (!paciente || !doctor) return null;

  // Estado del formulario
  const [horaMuestra, setHoraMuestra] = useState(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }));
  const [resultado, setResultado] = useState('NEGATIVO'); // 'POSITIVO' o 'NEGATIVO'
  
  // Estado PDF
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const generarPDF = async () => {
    setLoading(true);
    try {
        const Doc = (
            <CovidPDF
                paciente={paciente}
                doctor={doctor}
                horaMuestra={horaMuestra}
                resultado={resultado}
            />
        );
        const blob = await pdf(Doc).toBlob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
    } catch (error) {
        console.error("Error generando PDF:", error);
        alert("Error al generar el documento: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-white/20">
        
        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBackToMenu}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={24}/>
            </button>
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <Activity size={24}/>
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Prueba COVID-19 (Antígeno)</h2>
                   <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                     Detección Cualitativa SARS CoV-2
                   </p>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
            <X size={26}/>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* PANEL IZQUIERDO: CONFIGURACIÓN */}
          <div className="w-96 p-6 border-r border-slate-100 bg-slate-50/80 space-y-6 overflow-y-auto custom-scrollbar flex flex-col">
             
             {/* CONFIGURACIÓN GENERAL */}
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                
                {/* Resultado */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-2 block">Resultado de la Prueba</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setResultado('NEGATIVO')}
                            className={`py-3 px-4 rounded-xl text-xs font-black uppercase flex flex-col items-center gap-2 border-2 transition-all ${resultado === 'NEGATIVO' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <CheckCircle size={24}/> Negativo (-)
                        </button>
                        <button 
                            onClick={() => setResultado('POSITIVO')}
                            className={`py-3 px-4 rounded-xl text-xs font-black uppercase flex flex-col items-center gap-2 border-2 transition-all ${resultado === 'POSITIVO' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <XCircle size={24}/> Positivo (+)
                        </button>
                    </div>
                </div>

                {/* Hora de Muestra */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Horario de toma de muestra</label>
                    <input 
                        type="time" 
                        value={horaMuestra} 
                        onChange={(e) => setHoraMuestra(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                    />
                </div>
             </div>

             <div className="flex-1"></div>

             {/* BOTONES */}
             <div className="space-y-3">
                <button 
                    onClick={generarPDF}
                    disabled={loading}
                    className="w-full py-3 bg-white border-2 border-blue-100 text-blue-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"
                >
                    {loading ? <Loader2 size={16} className="animate-spin"/> : <Eye size={16} />} 
                    Previsualizar
                </button>

                {pdfUrl && (
                    <a 
                      href={pdfUrl} 
                      download={`COVID_${paciente.nombre.split(' ')[0]}.pdf`}
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
                        <Activity size={48} />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="font-black text-sm uppercase tracking-widest text-white/60">
                            Vista Previa Inactiva
                        </p>
                        <p className="text-xs max-w-xs leading-relaxed text-white/40">
                            Selecciona el resultado y genera el documento.
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

export default CovidModal;