import React, { useState } from 'react';
import { History, Activity, Clock, FileText } from 'lucide-react';

const SeccionResumen = ({ expediente, updateCampo }) => {
  // --- ESTADOS LOCALES PARA NAVEGACIÓN INTERNA ---
  const [activeResumenTab, setActiveResumenTab] = useState('consulta_previa');

  // --- CLASES DE ESTILO EXTRAÍDAS EXACTAMENTE DE TU SECCIONCONSULTA.JSX ---
  const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in h-full w-full flex flex-col overflow-hidden";
  const labelClass = "text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1 block tracking-wider";

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-white rounded-3xl shadow-sm border border-slate-200">
      
      {/* TABS SUPERIORES - COPIADO EXACTO DE TU SECCIONCONSULTA.JSX (ALTURA Y ESPACIADO) */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 shrink-0 gap-8 overflow-x-auto w-full">
        {[
          { id: 'consulta_previa', label: 'Motivo previo', icon: <History size={16} /> },
          { id: 'graficas', label: 'Gráficas', icon: <Activity size={16} /> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveResumenTab(tab.id)}
            className={`py-4 px-2 text-xs font-bold border-b-[3px] transition-all flex items-center gap-2 shrink-0 ${
                activeResumenTab === tab.id 
                ? 'border-blue-600 text-blue-700' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.icon} {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ÁREA DE TRABAJO - ADAPTADA AL 100% DE ANCHO Y ALTO (SIN ESPACIOS BLANCOS) */}
      <div className="flex-1 p-6 overflow-hidden bg-slate-50/30 w-full flex flex-col">
        
        {activeResumenTab === 'consulta_previa' && (
          <div className="flex h-full w-full gap-6 animate-in fade-in">
            
            {/* PANEL IZQUIERDO: RESUMEN HISTÓRICO (Ocupa el 75% del ancho disponible) */}
            <div className="flex-[3] flex flex-col h-full">
                <div className={sectionClass}>
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><History size={20}/></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg leading-none">Resumen de consulta previa</h3>
                                <p className="text-xs text-slate-400 mt-1">Información histórica del paciente</p>
                            </div>
                        </div>
                        {/* Indicador de consultas totales */}
                        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Totales:</span>
                             <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-md shadow-blue-200">0</span>
                        </div>
                    </div>
                    
                    {/* Placeholder central elástico que llena el box blanco */}
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                            <Clock size={32} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-medium">No hay registros de consultas anteriores</p>
                        <p className="text-[11px] mt-1 italic">El historial se generará tras la primera consulta guardada</p>
                    </div>
                </div>
            </div>

            {/* PANEL DERECHO: NOTAS PERSONALES (Ocupa el 25% del ancho restante) */}
            <div className="flex-1 flex flex-col h-full">
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl"><FileText size={20}/></div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg leading-none">Notas personales</h3>
                            <p className="text-xs text-slate-400 mt-1">Privadas y confidenciales</p>
                        </div>
                    </div>
                    {/* Textarea elástico (flex-1) que ocupa todo el box hasta abajo */}
                    <textarea 
                        className="flex-1 w-full p-5 bg-white border-2 border-teal-500/20 rounded-2xl outline-none text-slate-700 text-sm resize-none focus:border-teal-500 transition-all leading-relaxed shadow-sm placeholder:italic placeholder:text-slate-300"
                        placeholder="Escribe recordatorios médicos aquí..."
                        value={expediente.resumen.notas_previas}
                        onChange={(e) => updateCampo('resumen.notas_previas', e.target.value)}
                    />
                </div>
            </div>

          </div>
        )}

        {/* VISTA 2: GRÁFICAS DE EVOLUCIÓN (ADAPTADA AL 100%) */}
        {activeResumenTab === 'graficas' && (
          <div className={sectionClass}>
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-20 h-20 bg-blue-100/50 rounded-full flex items-center justify-center mb-4">
                   <Activity size={40} className="text-blue-400 opacity-60" />
                </div>
                <h3 className="text-blue-900 font-bold text-xl mb-2">Módulo de Gráficas</h3>
                <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                  Actualmente no existen datos suficientes de signos vitales (Peso, Glucosa, TA) para generar una comparativa visual.
                </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SeccionResumen;