import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, HeartHandshake, Download, Loader2, Eye, Calendar, ShieldCheck, User, FileBadge } from 'lucide-react';
import PrenupcialesPDF from "./pdf/PrenupcialesPDF";

const PrenupcialesModal = ({ onClose, onBackToMenu, paciente, doctor }) => {
  
  // PROTECCIÓN SUAVE: Si no hay paciente, no mostramos nada, pero si falta doctor, usamos fallbacks
  if (!paciente) return null;

  // Datos seguros del médico (Si no hay datos, muestra texto genérico para no cerrar el modal)
  const medicoNombre = doctor?.nombre || "Dr. General";
  const medicoCedula = doctor?.cedulaProfesional || "PENDIENTE";

  const [fechaEstudios, setFechaEstudios] = useState(new Date().toISOString().split('T')[0]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const generarPDF = async () => {
    setLoading(true);
    try {
        const datosFinales = {
            fechaEstudios: fechaEstudios,
            responsableNombre: medicoNombre,
            responsableCedula: medicoCedula,
        };

        const Doc = (
            <PrenupcialesPDF
                paciente={paciente}
                datos={datosFinales}
            />
        );
        const blob = await pdf(Doc).toBlob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
    } catch (error) {
        console.error("Error generando PDF:", error);
        alert("Hubo un error al generar el documento. Verifica la consola.");
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
              title="Volver al menú"
            >
              <ArrowLeft size={24}/>
            </button>
            
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <HeartHandshake size={24}/>
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Certificado Prenupcial</h2>
                   <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">
                     Documento Oficial
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
             
             {/* FICHA PACIENTE */}
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                    <User className="text-slate-400" size={16} />
                    <span className="text-xs font-black text-slate-600 uppercase">Datos del Paciente</span>
                </div>
                <div className="space-y-1">
                    <p className="text-xs text-slate-400 uppercase font-bold">Nombre Completo</p>
                    <p className="text-sm font-bold text-slate-800 uppercase leading-tight">
                        {paciente.nombre} {paciente.apellidoPaterno} {paciente.apellidoMaterno}
                    </p>
                </div>
             </div>

             {/* CONFIGURACIÓN */}
             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                    Configuración
                </h3>

                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">
                       <Calendar size={10} className="inline mr-1"/> Fecha de Estudios
                    </label>
                    <input 
                        type="date"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-700 text-sm"
                        value={fechaEstudios}
                        onChange={(e) => setFechaEstudios(e.target.value)}
                    />
                </div>

                {/* FICHA MÉDICO (AUTOMÁTICA) */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <FileBadge size={40} className="text-blue-900"/>
                    </div>
                    <label className="text-[10px] font-black text-blue-800 uppercase mb-2 block flex items-center gap-1">
                        <ShieldCheck size={12}/> Responsable (Tu Usuario)
                    </label>
                    
                    <div className="mb-2">
                        <p className="text-[9px] font-bold text-blue-400 uppercase">Nombre</p>
                        <p className="text-xs font-bold text-blue-900 uppercase">{medicoNombre}</p>
                    </div>
                    
                    <div>
                        <p className="text-[9px] font-bold text-blue-400 uppercase">Cédula</p>
                        <p className="text-xs font-bold text-blue-900 font-mono">{medicoCedula}</p>
                    </div>
                </div>
             </div>

             <div className="flex-1"></div>

             {/* BOTONES */}
             <div className="space-y-3">
                <button 
                    onClick={generarPDF}
                    disabled={loading}
                    className="w-full py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all"
                >
                    {loading ? <Loader2 size={16} className="animate-spin"/> : <Eye size={16} />} 
                    Previsualizar
                </button>

                {pdfUrl && (
                    <a 
                      href={pdfUrl} 
                      download={`Prenupcial_${paciente.nombre.split(' ')[0]}.pdf`}
                      className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-md transition-all decoration-0"
                    >
                      <Download size={16} /> Descargar PDF
                    </a>
                )}
             </div>
          </div>

          {/* VISOR */}
          <div className="flex-1 bg-slate-800/90 relative flex items-center justify-center p-4">
             {pdfUrl ? (
                 <div className="h-full w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <iframe src={pdfUrl} className="w-full h-full border-none" title="Vista Previa PDF" />
                 </div>
             ) : (
                 <div className="flex flex-col items-center justify-center text-white/50 gap-6 animate-in fade-in">
                    <HeartHandshake size={60} className="opacity-20"/>
                    <p className="text-xs font-bold uppercase tracking-widest">Vista previa pendiente</p>
                 </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default PrenupcialesModal;