import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, FileHeart, Download, Loader2, Eye, CheckSquare, RefreshCw } from 'lucide-react';
import SolicitudDIFPDF from "./pdf/SolicitudDIFPDF";

const SolicitudDIFModal = ({ onClose, onBackToMenu, paciente, doctor }) => {
  
  const [apoyos, setApoyos] = useState({
    sillaRuedas: false,
    sillaTraslado: false,
    camaHospitalaria: false,
    colchonAntiLlagas: false,
    revisionDomicilio: false,
    otro: '' 
  });
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = (key) => {
    setApoyos({ ...apoyos, [key]: !apoyos[key] });
  };

  const generarPDF = async () => {
    if (!paciente) return;
    setLoading(true);
    try {
        const Doc = <SolicitudDIFPDF paciente={paciente} doctor={doctor} apoyos={apoyos} />;
        const blob = await pdf(Doc).toBlob();
        setPdfUrl(URL.createObjectURL(blob));
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-white/20">
        
        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
            
            {/* BOTÓN REGRESAR: Si esto no funciona, es porque el PADRE no envía la función */}
            <button 
              onClick={onBackToMenu}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
              title="Regresar al menú"
            >
              <ArrowLeft size={24}/>
            </button>
            
            <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-50 rounded-xl text-pink-600"><FileHeart size={24}/></div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Solicitud de Apoyo DIF</h2>
                   <p className="text-[10px] font-bold text-pink-600 uppercase tracking-widest mt-0.5">Constancia Médica</p>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all"><X size={26}/></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* PANEL IZQUIERDO */}
          <div className="w-96 p-6 border-r border-slate-100 bg-slate-50/80 space-y-6 overflow-y-auto custom-scrollbar flex flex-col">
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                    <CheckSquare className="text-slate-400" size={18} />
                    <span className="text-xs font-black text-slate-600 uppercase">Seleccione Requerimientos</span>
                </div>
                <div className="space-y-2">
                    {[
                        { k: 'sillaRuedas', l: 'Silla de Ruedas' },
                        { k: 'sillaTraslado', l: 'Silla de Traslado' },
                        { k: 'camaHospitalaria', l: 'Cama tipo Hospitalaria' },
                        { k: 'colchonAntiLlagas', l: 'Colchón Anti llagas' },
                        { k: 'revisionDomicilio', l: 'Revisión médica a domicilio' },
                    ].map(item => (
                        <label key={item.k} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-pink-300 hover:bg-pink-50 transition-all group">
                            <input type="checkbox" className="w-4 h-4 accent-pink-600 rounded border-gray-300" checked={apoyos[item.k]} onChange={() => handleCheck(item.k)} />
                            <span className="text-xs font-bold text-slate-600 group-hover:text-pink-700">{item.l}</span>
                        </label>
                    ))}
                </div>
                <div className="mt-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Otro</label>
                    <input className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-pink-400" placeholder="Especifique..." value={apoyos.otro} onChange={(e) => setApoyos({...apoyos, otro: e.target.value})} />
                </div>
             </div>
             <div className="flex-1"></div>
             <div className="space-y-3">
                <button onClick={generarPDF} disabled={loading} className={`w-full py-3 border-2 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${pdfUrl ? 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    {loading ? <Loader2 size={16} className="animate-spin"/> : (pdfUrl ? <RefreshCw size={16}/> : <Eye size={16} />)} 
                    {loading ? 'Procesando...' : (pdfUrl ? 'Actualizar Vista' : 'Previsualizar')}
                </button>
                {pdfUrl && <a href={pdfUrl} download={`Solicitud_DIF_${paciente.nombre.split(' ')[0]}.pdf`} className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] decoration-0"><Download size={16} /> Descargar PDF</a>}
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
                    <div className="p-6 rounded-full bg-white/5 border-2 border-white/10 border-dashed"><FileHeart size={48} /></div>
                    <p className="font-black text-sm uppercase tracking-widest text-white/60">Vista Previa Inactiva</p>
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolicitudDIFModal;