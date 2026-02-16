import React, { useState, useMemo } from 'react';
import { X, FileText, Download, Eye, Loader2, AlertCircle, User, Baby } from 'lucide-react'; 
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
// IMPORTAMOS AMBOS FORMATOS
import CartaBuenaSaludAdultoPDF from './pdf/CartaBuenaSaludAdultoPDF';
import CartaBuenaSaludMenorPDF from './pdf/CartaBuenaSaludMenorPDF';

const CartaBuenaSaludModal = ({ onClose, expediente, doctor, pacienteNombre }) => {
  // Estado para controlar el tipo de formato
  const [tipoFormato, setTipoFormato] = useState('adulto'); // 'adulto' o 'menor'
  const [anexarEstudios, setAnexarEstudios] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Nuevos estados para datos del tutor (solo para menor)
  const [tutorNombre, setTutorNombre] = useState('');
  const [tutorParentesco, setTutorParentesco] = useState('Madre');

  // Validación de seguridad
  if (!expediente || !expediente.px_info) return null;

  // Memoización de datos
  const dataFinal = useMemo(() => ({ 
    ...expediente, 
    pacienteNombre: pacienteNombre || 'Paciente', 
    meta: { ...expediente.meta, anexarEstudios } 
  }), [expediente, pacienteNombre, anexarEstudios]);

  // Selección dinámica del documento PDF según el tipo
  const MyDocument = useMemo(() => {
    if (tipoFormato === 'menor') {
      return <CartaBuenaSaludMenorPDF expediente={dataFinal} doctor={doctor} tutorNombre={tutorNombre} tutorParentesco={tutorParentesco} />;
    }
    return <CartaBuenaSaludAdultoPDF expediente={dataFinal} doctor={doctor} />;
  }, [dataFinal, doctor, tipoFormato, tutorNombre, tutorParentesco]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-white/20">
        
        <div className="px-8 py-5 border-b flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Generar Carta de Buena Salud</h2>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Configuración del Documento</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors">
            <X size={26}/>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* BARRA LATERAL DE CONFIGURACIÓN */}
          <div className="w-80 p-6 border-r border-slate-100 bg-slate-50/80 space-y-6 overflow-y-auto custom-scrollbar">
            
            {/* 1. SELECTOR DE TIPO */}
            <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Paciente</h3>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/50 rounded-xl">
                    <button 
                        onClick={() => setTipoFormato('adulto')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${tipoFormato === 'adulto' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <User size={16}/> Adulto
                    </button>
                    <button 
                        onClick={() => setTipoFormato('menor')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${tipoFormato === 'menor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Baby size={16}/> Menor
                    </button>
                </div>
            </div>

            {/* 2. DATOS DEL TUTOR (Solo si es menor) */}
            {tipoFormato === 'menor' && (
                <div className="space-y-3 animate-in slide-in-from-left-2 fade-in">
                    <div className="pt-2 border-t border-slate-200"></div>
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Datos del Acompañante/Tutor</h3>
                    
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo del Tutor</label>
                        <input type="text" value={tutorNombre} onChange={(e) => setTutorNombre(e.target.value)}
                            className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none" placeholder="Ej. María Pérez López" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parentesco</label>
                        <select value={tutorParentesco} onChange={(e) => setTutorParentesco(e.target.value)}
                            className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:border-blue-500 outline-none bg-white">
                            <option value="Madre">Madre</option>
                            <option value="Padre">Padre</option>
                            <option value="Abuelo(a)">Abuelo(a)</option>
                            <option value="Tutor Legal">Tutor Legal</option>
                            <option value="Familiar">Otro Familiar</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="pt-2 border-t border-slate-200"></div>

            {/* 3. OPCIONES GENERALES */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opciones</h3>
              <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 transition-all shadow-sm group">
                <input type="checkbox" checked={anexarEstudios} onChange={(e) => setAnexarEstudios(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
                <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800">Mencionar estudios anexos</span>
              </label>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="space-y-3 pt-4">
              <button onClick={() => setShowPreview(true)}
                className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95">
                <Eye size={16} /> Previsualizar
              </button>

              <PDFDownloadLink document={MyDocument} fileName={`Carta_Salud_${tipoFormato.toUpperCase()}_${pacienteNombre.replace(/\s+/g, '_')}.pdf`}>
                {({ loading }) => (
                  <button disabled={loading || (tipoFormato === 'menor' && !tutorNombre)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:bg-slate-400">
                    {loading ? <Loader2 className="animate-spin" size={16}/> : <Download size={16} />} Descargar PDF
                  </button>
                )}
              </PDFDownloadLink>
              {tipoFormato === 'menor' && !tutorNombre && (
                  <p className="text-[9px] text-red-500 text-center font-bold mt-1">Ingresa el nombre del tutor para descargar.</p>
              )}
            </div>
          </div>

          {/* VISOR CENTRAL */}
          <div className="flex-1 bg-slate-800/90 relative flex items-center justify-center p-4">
            {showPreview ? (
              <div className="w-full h-full bg-white rounded-xl overflow-hidden shadow-2xl">
                  <PDFViewer width="100%" height="100%" className="border-none">
                    {MyDocument}
                  </PDFViewer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-white/50 gap-4">
                <FileText size={80} className="opacity-20" />
                <p className="font-bold text-sm uppercase tracking-widest">Configura el documento y haz clic en Previsualizar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartaBuenaSaludModal;