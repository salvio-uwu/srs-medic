import React, { useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, ShieldCheck, Download, Loader2 } from 'lucide-react';
import AvisoPrivacidadPDF from "./pdf/AvisoPrivacidadPDF";

const AvisoPrivacidadModal = ({ onClose, onBackToMenu }) => {
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Generamos el PDF una sola vez al abrir el modal
  useEffect(() => {
    const generarDocumento = async () => {
      try {
        const blob = await pdf(<AvisoPrivacidadPDF />).toBlob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (error) {
        console.error("Error generando PDF:", error);
      }
      setLoading(false);
    };

    generarDocumento();

    // Limpieza de memoria al cerrar
    return () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-white/20">
        
        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBackToMenu}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
              title="Volver al menú"
            >
              <ArrowLeft size={24}/>
            </button>
            
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-xl text-white">
                    <ShieldCheck size={24}/>
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Aviso de Privacidad</h2>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                     Protección de Datos Personales
                   </p>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
            <X size={26}/>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* PANEL IZQUIERDO: INFORMACIÓN */}
          <div className="w-80 p-6 border-r border-slate-100 bg-slate-50/80 space-y-6 flex flex-col">
             
             {/* Info Box */}
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                    <ShieldCheck className="text-slate-800" size={18} />
                    <span className="text-xs font-black text-slate-600 uppercase">Documento Legal</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed text-justify">
                    Este documento describe cómo el <strong>Centro Médico Santa Cruz</strong> recopila, usa y protege los datos personales de los pacientes conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Última Actualización</p>
                    <p className="text-xs font-bold text-slate-700">22 de Mayo de 2024</p>
                </div>
             </div>

             <div className="flex-1"></div>

             {/* BOTÓN DESCARGA */}
             <div className="space-y-3">
                {pdfUrl && (
                    <a 
                      href={pdfUrl} 
                      download="Aviso_Privacidad_Santa_Cruz.pdf"
                      className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] decoration-0"
                    >
                      <Download size={16} /> Descargar PDF
                    </a>
                )}
             </div>
          </div>

          {/* VISOR DERECHO (IFRAME ESTÁTICO - NO PARPADEA) */}
          <div className="flex-1 bg-slate-800/90 relative flex items-center justify-center p-4">
             {loading ? (
                 <div className="flex flex-col items-center gap-3 text-white/50">
                    <Loader2 size={40} className="animate-spin text-white"/>
                    <p className="text-xs font-bold uppercase tracking-widest">Cargando documento...</p>
                 </div>
             ) : (
                 <div className="h-full w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <iframe 
                        src={pdfUrl} 
                        className="w-full h-full border-none" 
                        title="Aviso de Privacidad"
                    />
                 </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AvisoPrivacidadModal;