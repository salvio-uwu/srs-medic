import React, { useState, useMemo } from 'react';
import { 
  X, Printer, Search, FileText, User, Activity, 
  ClipboardList, ChevronRight, CheckCircle, AlignJustify, 
  Columns, Droplet, MapPin, Hash, Download, Eye, Loader2
} from 'lucide-react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'; 
import DocumentoHistoriaPDF from './pdf/DocumentoHistoriaPDF'; 

const HistoriaClinicaModal = ({ onClose, paciente, historial, doctor, expedienteActual }) => {
  const [activeTab, setActiveTab] = useState('antecedentes');
  const [busqueda, setBusqueda] = useState('');
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [modoPrevisualizacion, setModoPrevisualizacion] = useState(false);

  // Filtros de búsqueda seguros
  const historialFiltrado = useMemo(() => {
    if (!Array.isArray(historial)) return [];
    return historial.filter(h => 
      (h.fecha && h.fecha.includes(busqueda)) || 
      (h.motivo && h.motivo.toLowerCase().includes(busqueda.toLowerCase()))
    );
  }, [historial, busqueda]);

  const consultaActiva = useMemo(() => {
    if (!Array.isArray(historial)) return null;
    return historial.find(h => h.id === activeTab);
  }, [historial, activeTab]);

  return (
    <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 font-sans overflow-hidden">
      
      {/* CONTENEDOR PRINCIPAL */}
      <div className="bg-white w-full max-w-7xl h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/40">
        
        {/* HEADER */}
        <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-5">
                <div className="bg-cyan-500 p-3 rounded-2xl text-white shadow-lg shadow-cyan-500/20">
                    <ClipboardList size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Expediente Histórico</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">{paciente?.nombre || 'Paciente'}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="relative hidden lg:block">
                    <Search className="absolute left-4 top-3 text-slate-400" size={16}/>
                    <input className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-400 w-64" placeholder="Filtrar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
                <button onClick={() => setShowPrintOptions(true)} className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                    <Printer size={16}/> Opciones PDF
                </button>
                <button onClick={onClose} className="p-2.5 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-colors"><X size={24}/></button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* SIDEBAR IZQUIERDA */}
            <aside className="w-80 bg-white border-r border-slate-100 flex flex-col shrink-0">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Navegación</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    <button onClick={() => setActiveTab('antecedentes')} className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border text-left ${activeTab === 'antecedentes' ? 'bg-cyan-500 text-white border-cyan-400 shadow-lg' : 'hover:bg-slate-50 text-slate-500 border-transparent bg-white'}`}>
                        <User size={18}/> 
                        <div>
                            <span className="text-xs font-black uppercase block leading-none">Ficha General</span>
                            <span className={`text-[9px] mt-1 block ${activeTab === 'antecedentes' ? 'text-cyan-100' : 'text-slate-400'}`}>Antecedentes</span>
                        </div>
                    </button>
                    {historialFiltrado.map(h => (
                        <button key={h.id} onClick={() => setActiveTab(h.id)} className={`w-full p-4 rounded-2xl flex flex-col gap-1 transition-all border text-left ${activeTab === h.id ? 'bg-white border-cyan-500 shadow-xl ring-2 ring-cyan-50' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'}`}>
                            <div className="flex justify-between items-center w-full">
                                <span className={`text-[9px] font-black uppercase ${activeTab === h.id ? 'text-cyan-600' : 'text-slate-400'}`}>{h.fecha}</span>
                                {activeTab === h.id && <ChevronRight size={14} className="text-cyan-500"/>}
                            </div>
                            <span className={`text-xs font-bold uppercase truncate w-full ${activeTab === h.id ? 'text-slate-800' : 'text-slate-600'}`}>{h.motivo}</span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* CONTENIDO UI DETALLADO */}
            <main className="flex-1 p-8 overflow-y-auto bg-slate-50/30 rounded-tl-[3.5rem] m-4 border border-slate-100 shadow-inner bg-white custom-scrollbar">
                {activeTab === 'antecedentes' ? (
                    <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* BADGES SUPERIORES */}
                        <div className="flex flex-wrap gap-3 mb-8">
                            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <Activity size={18} className="text-blue-500" />
                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Edad</p><p className="text-xs font-bold text-slate-700">{expedienteActual?.px_info?.edad || '--'}</p></div>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <User size={18} className="text-teal-500" />
                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Sexo</p><p className="text-xs font-bold text-slate-700 uppercase">{paciente?.sexo || '--'}</p></div>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <Droplet size={18} className="text-rose-500" />
                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Sangre</p><p className="text-xs font-bold text-slate-700">{expedienteActual?.px_info?.grupo_sanguineo || '---'}</p></div>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <MapPin size={18} className="text-slate-400" />
                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Origen</p><p className="text-xs font-bold text-slate-700 uppercase">{paciente?.municipioEstado || 'Sin dato'}</p></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <section>
                                <h3 className="text-[11px] font-black text-cyan-600 uppercase tracking-widest mb-4 border-b border-cyan-50 pb-2">Heredofamiliares</h3>
                                <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                                    <p className="text-sm text-slate-600 leading-relaxed italic">
                                        {Object.keys(expedienteActual?.antecedentes?.hereditarios || {}).filter(k => k !== 'otros' && Object.values(expedienteActual.antecedentes.hereditarios[k]).some(v => v)).join(', ') || 'No se registran antecedentes de relevancia.'}
                                    </p>
                                </div>
                            </section>
                            <section>
                                <h3 className="text-[11px] font-black text-cyan-600 uppercase tracking-widest mb-4 border-b border-cyan-50 pb-2">Patológicos / Alergias</h3>
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Padecimientos previos</p>
                                        <p className="text-sm text-slate-700 font-medium">{expedienteActual?.antecedentes?.patologicos?.actuales || 'Negados.'}</p>
                                    </div>
                                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                                        <p className="text-[10px] font-black text-rose-600 uppercase mb-1">Alertas / Alergias:</p>
                                        <p className="text-sm font-bold text-rose-800">{expedienteActual?.antecedentes?.alergias?.lista?.map(a => a.sustancia).join(', ') || 'Sin alergias conocidas'}</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">{consultaActiva?.motivo || 'Consulta'}</h2>
                                <p className="text-sm font-bold text-cyan-500 mt-1">{consultaActiva?.fecha}</p>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-xl text-center border border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Consultorio</p>
                                <p className="text-xs font-bold text-slate-700">SANTA CRUZ CENTRAL</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-5 gap-4 mb-10">
                            {Object.entries(consultaActiva?.signos || {}).map(([k, v]) => (
                                <div key={k} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">{k}</span>
                                    <span className="text-lg font-black text-slate-700">{v || '--'}</span>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-8">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Descripción Clínica</h4>
                                <p className="text-sm text-slate-700 leading-relaxed bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">{consultaActiva?.padecimiento}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Diagnóstico y Plan</h4>
                                <div className="bg-emerald-50/40 p-6 rounded-3xl border border-emerald-100">
                                    <p className="text-lg font-black text-slate-800 uppercase mb-4">{consultaActiva?.diagnostico}</p>
                                    <div className="space-y-3">
                                        {consultaActiva?.receta?.map((m, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                                <p className="text-xs font-bold text-slate-700 uppercase">{m.nombre} <span className="text-slate-400 font-normal normal-case">- {m.dosis}</span></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>

        {/* MODAL INTERNO: OPCIONES PDF (Corregido) */}
        {showPrintOptions && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center p-4 bg-white/90 backdrop-blur-md animate-in fade-in">
                <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center p-6 border-b border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 uppercase">Generar Reporte PDF</h3>
                        <button onClick={() => { setShowPrintOptions(false); setModoPrevisualizacion(false); }} className="p-2 hover:bg-slate-100 rounded-full"><X size={24}/></button>
                    </div>

                    <div className="flex-1 flex flex-col md:flex-row p-6 gap-8">
                        {/* Opciones Izquierda */}
                        <div className="w-full md:w-1/3 space-y-6">
                            <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100">
                                <p className="text-xs font-bold text-blue-700 mb-2">Formato Profesional</p>
                                <p className="text-[10px] text-blue-600 leading-relaxed opacity-80">
                                    Documento PDF optimizado para impresión, con diseño de expediente clínico estándar y logotipos.
                                </p>
                            </div>
                            
                            <div className="space-y-3">
                                <PDFDownloadLink 
                                    document={<DocumentoHistoriaPDF paciente={paciente} historial={historial} doctor={doctor} expedienteActual={expedienteActual} />} 
                                    fileName={`Historia_${paciente?.nombre || 'Px'}.pdf`}
                                    className="w-full"
                                >
                                    {({ loading }) => (
                                        <button disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform disabled:opacity-50">
                                            {loading ? <Loader2 className="animate-spin" size={18}/> : <><Download size={18}/> Descargar PDF</>}
                                        </button>
                                    )}
                                </PDFDownloadLink>

                                <button 
                                    onClick={() => setModoPrevisualizacion(true)}
                                    className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-50 flex items-center justify-center gap-3 transition-colors"
                                >
                                    <Eye size={18}/> Ver en Pantalla
                                </button>
                            </div>
                        </div>

                        {/* Visor Derecha */}
                        <div className="flex-1 bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 relative shadow-inner">
                            {modoPrevisualizacion ? (
                                <PDFViewer width="100%" height="100%" className="w-full h-full border-none">
                                    <DocumentoHistoriaPDF paciente={paciente} historial={historial} doctor={doctor} expedienteActual={expedienteActual} />
                                </PDFViewer>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                    <FileText size={48} className="mb-4 opacity-20"/>
                                    <p className="text-sm font-medium">Vista previa del documento aquí</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default HistoriaClinicaModal;