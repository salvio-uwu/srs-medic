import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, Baby, Download, Loader2, Eye, RefreshCw, User } from 'lucide-react';
import CartaPasaporteUniversalPDF from "./pdf/CartaPasaporteUniversalPDF";

const CartaPasaporteModal = ({ onClose, onBackToMenu, paciente, doctor }) => {
  
  // Estado del switch tipo de paciente
  const [esMenor, setEsMenor] = useState(true);

  // Estado del formulario
  const [datosPadres, setDatosPadres] = useState({ padre: '', madre: '' });
  
  // Estado para la URL del PDF
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setDatosPadres({ ...datosPadres, [e.target.name]: e.target.value });
  };

  const generarPDF = async () => {
    if (!paciente) return;
    
    setLoading(true);
    try {
        const Doc = (
            <CartaPasaporteUniversalPDF
                paciente={paciente}
                doctor={doctor}
                datosPadres={datosPadres}
                esMenor={esMenor} // <--- Pasamos la bandera
            />
        );
        const blob = await pdf(Doc).toBlob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
    } catch (error) {
        console.error("Error generando PDF:", error);
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
            <div>
               <h2 className="text-xl font-black text-slate-800 tracking-tight">Carta Pasaporte</h2>
               <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                 {esMenor ? 'Formato Menor de Edad' : 'Formato Mayor de Edad'}
               </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
            <X size={26}/>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* PANEL IZQUIERDO */}
          <div className="w-80 p-6 border-r border-slate-100 bg-slate-50/80 space-y-6 overflow-y-auto custom-scrollbar flex flex-col">
             
             {/* SWITCH TIPO PACIENTE */}
             <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
                <button 
                    onClick={() => { setEsMenor(true); setPdfUrl(null); }}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all ${esMenor ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Baby size={16}/> Menor
                </button>
                <button 
                    onClick={() => { setEsMenor(false); setPdfUrl(null); }}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all ${!esMenor ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <User size={16}/> Adulto
                </button>
             </div>

             {/* Info Dinámica */}
             <div className={`p-4 rounded-xl border ${esMenor ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className={`text-[11px] leading-relaxed font-medium ${esMenor ? 'text-blue-800' : 'text-emerald-800'}`}>
                    {esMenor 
                        ? "Requiere firma autógrafa y sello sobre la fotografía del menor."
                        : "Formato estándar para identificación y salud de adultos."}
                </p>
             </div>

             {/* Inputs Condicionales */}
             {esMenor && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Datos de los Padres</h3>
                     <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Nombre de la Madre</label>
                       <input name="madre" value={datosPadres.madre} onChange={handleInputChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-bold text-slate-700 placeholder:font-normal" placeholder="Nombre completo..."/>
                     </div>
                     <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Nombre del Padre</label>
                       <input name="padre" value={datosPadres.padre} onChange={handleInputChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-bold text-slate-700 placeholder:font-normal" placeholder="Nombre completo..."/>
                     </div>
                 </div>
             )}

             <div className="flex-1"></div>

             {/* BOTONES */}
             <div className="space-y-3">
                <button 
                    onClick={generarPDF}
                    disabled={loading}
                    className={`w-full py-3 border-2 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        pdfUrl 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    {loading ? <Loader2 size={16} className="animate-spin"/> : (pdfUrl ? <RefreshCw size={16}/> : <Eye size={16} />)} 
                    {loading ? 'Procesando...' : (pdfUrl ? 'Actualizar Vista' : 'Previsualizar')}
                </button>

                {pdfUrl && (
                    <a 
                      href={pdfUrl} 
                      download={`Pasaporte_${esMenor ? 'Menor' : 'Adulto'}_${paciente.nombre.split(' ')[0]}.pdf`}
                      className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] decoration-0"
                    >
                      <Download size={16} /> Descargar PDF
                    </a>
                )}
             </div>
             
             {esMenor && (!datosPadres.madre || !datosPadres.padre) && (
                 <p className="text-[10px] text-center text-red-400 font-bold bg-red-50 py-2 rounded-lg border border-red-100">
                    * Ingresa ambos padres para habilitar
                 </p>
             )}
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
                        <Eye size={48} />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="font-black text-sm uppercase tracking-widest text-white/60">
                            Vista Previa Inactiva
                        </p>
                        <p className="text-xs max-w-xs leading-relaxed text-white/40">
                            Configura los datos del paciente y da clic en "Previsualizar".
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

export default CartaPasaporteModal;