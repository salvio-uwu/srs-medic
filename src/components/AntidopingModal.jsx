import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { X, ArrowLeft, FlaskConical, Download, Loader2, Eye, CheckCircle, XCircle } from 'lucide-react';
import AntidopingPDF from "./pdf/AntidopingPDF";

const AntidopingModal = ({ onClose, onBackToMenu, paciente, doctor }) => {
  
  // Si no hay datos críticos, mostramos error visual
  if (!paciente || !doctor) return (
      <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl">
              <p className="text-red-600 font-bold">Error: Faltan datos del paciente o médico.</p>
              <button onClick={onClose} className="mt-4 bg-slate-200 px-4 py-2 rounded">Cerrar</button>
          </div>
      </div>
  );

  const [motivo, setMotivo] = useState('LABORAL');
  const [resultados, setResultados] = useState({
    cocaina: 'NEGATIVO',
    marihuana: 'NEGATIVO',
    anfetaminas: 'NEGATIVO',
    opiaceos: 'NEGATIVO',
    metanfetaminas: 'NEGATIVO'
  });
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleResultado = (droga) => {
    setResultados(prev => ({
        ...prev,
        [droga]: prev[droga] === 'NEGATIVO' ? 'POSITIVO' : 'NEGATIVO'
    }));
  };

  const generarPDF = async () => {
    setLoading(true);
    try {
        const Doc = (
            <AntidopingPDF
                paciente={paciente}
                doctor={doctor}
                motivo={motivo}
                resultados={resultados}
            />
        );
        const blob = await pdf(Doc).toBlob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
    } catch (error) {
        console.error("Error generando PDF:", error);
        // ¡ESTO TE DIRÁ EL ERROR EN PANTALLA!
        alert(`Error al crear el documento: ${error.message}`);
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
                <div className="p-2 bg-teal-50 rounded-xl text-teal-600"><FlaskConical size={24}/></div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Prueba de Antidoping</h2>
                   <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mt-0.5">Panel de 5 Elementos</p>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all"><X size={26}/></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* PANEL IZQUIERDO */}
          <div className="w-96 p-6 border-r border-slate-100 bg-slate-50/80 space-y-6 overflow-y-auto custom-scrollbar flex flex-col">
             
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Motivo del Estudio</label>
                    <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none">
                        <option value="LABORAL">LABORAL</option>
                        <option value="PERSONAL">PERSONAL</option>
                        <option value="MÉDICO">MÉDICO</option>
                        <option value="LEGAL">LEGAL</option>
                    </select>
                </div>
             </div>

             <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Resultados</h3>
                {[
                    { k: 'cocaina', l: 'COC "COCAINA"' },
                    { k: 'marihuana', l: 'THC "MARIHUANA"' },
                    { k: 'anfetaminas', l: 'AMP "ANFETAMINAS"' },
                    { k: 'opiaceos', l: 'OPI "OPIACEOS"' },
                    { k: 'metanfetaminas', l: 'MET "METANFETAMINAS"' },
                ].map((item) => (
                    <div key={item.k} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-xs font-bold text-slate-700">{item.l}</span>
                        <button onClick={() => toggleResultado(item.k)} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${resultados[item.k] === 'NEGATIVO' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                            {resultados[item.k] === 'NEGATIVO' ? <CheckCircle size={12}/> : <XCircle size={12}/>}
                            {resultados[item.k]}
                        </button>
                    </div>
                ))}
             </div>

             <div className="flex-1"></div>

             <div className="space-y-3">
                <button onClick={generarPDF} disabled={loading} className="w-full py-3 bg-white border-2 border-teal-100 text-teal-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-teal-50 transition-all">
                    {loading ? <Loader2 size={16} className="animate-spin"/> : <Eye size={16} />} Previsualizar
                </button>
                {pdfUrl && (
                    <a href={pdfUrl} download={`Antidoping_${paciente.nombre.split(' ')[0]}.pdf`} className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-md transition-all decoration-0">
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
                    <div className="p-6 rounded-full bg-white/5 border-2 border-white/10 border-dashed"><FlaskConical size={48} /></div>
                    <p className="font-black text-sm uppercase tracking-widest text-white/60">Vista Previa Inactiva</p>
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AntidopingModal;