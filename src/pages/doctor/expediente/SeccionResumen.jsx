// src/pages/doctor/expediente/SeccionResumen.jsx
import React, { useState, useEffect } from 'react';
import { 
  History, Activity, Clock, FileText, Calendar, 
  Stethoscope, ChevronRight, X, Pill, TrendingUp, CheckCircle 
} from 'lucide-react';
import { db } from '../../../config/firebase'; 
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

// --- IMPORTACIONES PARA GRÁFICAS ---
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine 
} from 'recharts';

const SeccionResumen = ({ expediente, updateCampo, pacienteId }) => {
  // --- ESTADOS ---
  const [activeResumenTab, setActiveResumenTab] = useState('consulta_previa');
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);

  // Estados para Gráficas
  const [datosGraficas, setDatosGraficas] = useState({
    pesoEdad: [],
    tallaEdad: [],
    imcEdad: [],
    pesoTalla: [],
    tensionArterial: []
  });

  // --- HELPER: CALCULAR EDAD ---
  const calcularEdadEnFecha = (fechaNacimiento, fechaConsulta) => {
    if (!fechaNacimiento) return 0;
    const nac = new Date(fechaNacimiento);
    const visita = new Date(fechaConsulta);
    const diffTime = Math.abs(visita - nac);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
    return parseFloat(diffYears.toFixed(2));
  };

  // --- CARGA DE DATOS (HISTORIAL + GRÁFICAS) ---
  useEffect(() => {
    const fetchHistorial = async () => {
        if (!pacienteId) return;
        setLoading(true);
        try {
            // Traemos orden ASC (antiguo -> nuevo) para dibujar las gráficas correctamente
            const q = query(
                collection(db, "historial_clinico"),
                where("pacienteId", "==", pacienteId),
                orderBy("fecha", "asc") 
            );
            const snap = await getDocs(q);
            
            const docsList = [];
            const dataPeso = [];
            const dataTalla = [];
            const dataIMC = [];
            const dataPesoTalla = [];
            const dataTA = [];

            snap.docs.forEach(d => {
                const data = d.data();
                const fechaObj = data.fecha?.toDate ? data.fecha.toDate() : new Date();
                
                // 1. Datos para la Lista (Timeline)
                docsList.push({
                    id: d.id,
                    ...data,
                    fechaFormato: fechaObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
                    horaFormato: fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                });

                // 2. Datos para Gráficas
                const vitales = data.consulta?.exploracion?.signos || {};
                const antropo = data.consulta?.exploracion?.antropometria || {};
                
                // Validamos fecha de nacimiento para el eje X
                if (expediente?.px_info?.fecha_nacimiento) {
                    const edadAlMomento = calcularEdadEnFecha(expediente.px_info.fecha_nacimiento, fechaObj);
                    const fechaCorta = fechaObj.toLocaleDateString('es-MX');

                    if (antropo.peso) dataPeso.push({ x: edadAlMomento, y: parseFloat(antropo.peso), fecha: fechaCorta });
                    if (antropo.talla) dataTalla.push({ x: edadAlMomento, y: parseFloat(antropo.talla), fecha: fechaCorta });
                    if (antropo.imc) dataIMC.push({ x: edadAlMomento, y: parseFloat(antropo.imc), fecha: fechaCorta });
                    if (antropo.peso && antropo.talla) dataPesoTalla.push({ x: parseFloat(antropo.talla), y: parseFloat(antropo.peso), fecha: fechaCorta });
                    
                    if (vitales.ta && vitales.ta.includes('/')) {
                        const [sis, dias] = vitales.ta.split('/');
                        dataTA.push({ fecha: fechaCorta, sistolica: parseInt(sis), diastolica: parseInt(dias) });
                    }
                }
            });

            // IMPORTANTE: Invertimos el orden solo para la lista visual (Timeline), para que lo más nuevo salga arriba
            setHistorial([...docsList].reverse()); 
            
            // Guardamos datos para gráficas (Orden ASC original)
            setDatosGraficas({
                pesoEdad: dataPeso,
                tallaEdad: dataTalla,
                imcEdad: dataIMC,
                pesoTalla: dataPesoTalla,
                tensionArterial: dataTA
            });

        } catch (error) {
            console.error("Error cargando historial:", error);
        }
        setLoading(false);
    };

    fetchHistorial();
  }, [pacienteId, expediente?.px_info?.fecha_nacimiento]);

  // --- CLASES ---
  const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in h-full w-full flex flex-col overflow-hidden";

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-white rounded-3xl shadow-sm border border-slate-200 relative">
      
      {/* TABS SUPERIORES */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 shrink-0 gap-8 overflow-x-auto w-full">
        <button 
            onClick={() => setActiveResumenTab('consulta_previa')}
            className={`py-4 px-2 text-xs font-bold border-b-[3px] transition-all flex items-center gap-2 shrink-0 ${
                activeResumenTab === 'consulta_previa' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
            <History size={16} /> LÍNEA DE TIEMPO
        </button>
        <button 
            onClick={() => setActiveResumenTab('graficas')}
            className={`py-4 px-2 text-xs font-bold border-b-[3px] transition-all flex items-center gap-2 shrink-0 ${
                activeResumenTab === 'graficas' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
            <TrendingUp size={16} /> GRÁFICAS EVOLUTIVAS
        </button>
      </div>

      {/* ÁREA DE TRABAJO */}
      <div className="flex-1 p-6 overflow-hidden bg-slate-50/30 w-full flex flex-col">
        
        {/* --- VISTA 1: HISTORIAL (TIMELINE ORIGINAL RESTAURADO) --- */}
        {activeResumenTab === 'consulta_previa' && (
          <div className="flex h-full w-full gap-6 animate-in fade-in">
            
            {/* PANEL IZQUIERDO: TIMELINE */}
            <div className="flex-[3] flex flex-col h-full">
                <div className={sectionClass}>
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><History size={20}/></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg leading-none">Historial de Consultas</h3>
                                <p className="text-xs text-slate-400 mt-1">Clic en una tarjeta para ver detalles</p>
                            </div>
                        </div>
                        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Visitas:</span>
                             <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-md shadow-blue-200">
                                {historial.length}
                             </span>
                        </div>
                    </div>
                    
                    {/* TIMELINE SCROLLABLE */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative">
                        {historial.length > 0 && (
                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                                <Clock className="animate-spin" size={24}/>
                                <span className="text-xs font-bold">Cargando historia...</span>
                            </div>
                        ) : historial.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                                    <Clock size={32} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-medium">No hay registros previos</p>
                            </div>
                        ) : (
                            <div className="space-y-6 relative z-10 pl-2 py-2">
                                {historial.map((item, idx) => (
                                    <div key={item.id} className="flex gap-4 group">
                                        <div className={`w-9 h-9 rounded-full border-4 border-white shadow-sm flex items-center justify-center shrink-0 z-10 transition-colors ${idx === 0 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <Calendar size={14} />
                                        </div>

                                        {/* TARJETA CLICKEABLE */}
                                        <div 
                                            onClick={() => setConsultaSeleccionada(item)}
                                            className="flex-1 bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group-hover:translate-x-1 cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wide">
                                                        {item.tipoNota || 'Consulta General'}
                                                    </span>
                                                    <h4 className="text-sm font-bold text-slate-800 mt-1">
                                                        {item.fechaFormato} <span className="text-slate-400 font-normal text-xs">• {item.horaFormato}</span>
                                                    </h4>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                    <Stethoscope size={12} className="text-slate-400"/>
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase">
                                                        {item.medicoNombre ? item.medicoNombre.split(' ')[0] : 'Dr.'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                {item.consulta?.diagnostico?.enfermedad_actual && (
                                                    <div className="flex gap-2 items-start">
                                                        <Activity size={14} className="text-emerald-500 mt-0.5 shrink-0"/>
                                                        <p className="text-xs text-slate-600 font-medium leading-tight line-clamp-1">
                                                            <span className="font-bold text-slate-700">Dx:</span> {item.consulta.diagnostico.enfermedad_actual}
                                                        </p>
                                                    </div>
                                                )}
                                                {item.consulta?.padecimiento && (
                                                    <div className="flex gap-2 items-start">
                                                        <FileText size={14} className="text-slate-400 mt-0.5 shrink-0"/>
                                                        <p className="text-xs text-slate-500 line-clamp-1 italic">
                                                            "{item.consulta.padecimiento}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PANEL DERECHO: NOTAS PERSONALES (ORIGINAL) */}
            <div className="flex-1 flex flex-col h-full">
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl"><FileText size={20}/></div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg leading-none">Notas personales</h3>
                            <p className="text-xs text-slate-400 mt-1">Privadas y confidenciales</p>
                        </div>
                    </div>
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

        {/* --- VISTA 2: GRÁFICAS (NUEVA LÓGICA) --- */}
        {activeResumenTab === 'graficas' && (
          <div className="h-full w-full overflow-y-auto custom-scrollbar pr-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                
                {/* 1. GRÁFICA PESO PARA LA EDAD */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Peso vs Edad Cronológica
                    </h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.pesoEdad}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="x" type="number" label={{ value: 'Edad (Años)', position: 'insideBottom', offset: -5 }} domain={['auto', 'auto']} tickCount={5}/>
                                <YAxis label={{ value: 'Peso (Kg)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']}/>
                                <Tooltip formatter={(val) => `${val} kg`} labelFormatter={(val) => `${val} años`}/>
                                <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Peso"/>
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. GRÁFICA TALLA PARA LA EDAD */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Talla vs Edad Cronológica
                    </h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.tallaEdad}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="x" type="number" label={{ value: 'Edad (Años)', position: 'insideBottom', offset: -5 }} domain={['auto', 'auto']}/>
                                <YAxis label={{ value: 'Talla (m/cm)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']}/>
                                <Tooltip formatter={(val) => `${val}`} labelFormatter={(val) => `${val} años`}/>
                                <Line type="monotone" dataKey="y" stroke="#10b981" strokeWidth={3} dot={{r: 4}} name="Talla"/>
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. GRÁFICA IMC */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span> IMC vs Edad
                    </h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.imcEdad}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="x" type="number" label={{ value: 'Edad', position: 'insideBottom', offset: -5 }}/>
                                <YAxis domain={[10, 40]}/>
                                <Tooltip />
                                <Line type="monotone" dataKey="y" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4}} name="IMC"/>
                                {/* Zonas de referencia con ReferenceLine */}
                                <ReferenceLine y={25} label="Sobrepeso" stroke="orange" strokeDasharray="3 3" />
                                <ReferenceLine y={30} label="Obesidad" stroke="red" strokeDasharray="3 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. PESO PARA LA TALLA (Scatter) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span> Peso para la Talla
                    </h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis type="number" dataKey="x" name="Talla" unit="" label={{ value: 'Talla', position: 'insideBottom', offset: -5 }}/>
                                <YAxis type="number" dataKey="y" name="Peso" unit="kg" label={{ value: 'Peso', angle: -90, position: 'insideLeft' }}/>
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter name="Px" data={datosGraficas.pesoTalla} fill="#f97316" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 5. TENSIÓN ARTERIAL (Doble Línea) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col lg:col-span-2">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> Evolución Tensión Arterial
                    </h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.tensionArterial}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="fecha" />
                                <YAxis domain={[40, 180]}/>
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="sistolica" stroke="#ef4444" name="Sistólica" strokeWidth={2} />
                                <Line type="monotone" dataKey="diastolica" stroke="#3b82f6" name="Diastólica" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
          </div>
        )}

      </div>

      {/* --- MODAL DETALLE DE CONSULTA (VISOR RÁPIDO - RESTAURADO) --- */}
      {consultaSeleccionada && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl max-h-[90%] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                
                {/* Header Modal */}
                <div className="px-8 py-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{consultaSeleccionada.tipoNota}</h2>
                        <p className="text-sm text-slate-500 font-medium mt-1 flex items-center gap-2">
                            <Calendar size={14}/> {consultaSeleccionada.fechaFormato} 
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span> 
                            <Clock size={14}/> {consultaSeleccionada.horaFormato}
                        </p>
                    </div>
                    <button onClick={() => setConsultaSeleccionada(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500 shadow-sm border border-transparent hover:border-slate-200">
                        <X size={24}/>
                    </button>
                </div>

                {/* Contenido Modal */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                    
                    {/* Signos Vitales */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            {l:'Peso', v: consultaSeleccionada.consulta?.exploracion?.signos?.peso, u:'kg'},
                            {l:'Temp', v: consultaSeleccionada.consulta?.exploracion?.signos?.temp, u:'°C'},
                            {l:'T/A', v: consultaSeleccionada.consulta?.exploracion?.signos?.ta, u:''},
                            {l:'SpO2', v: consultaSeleccionada.consulta?.exploracion?.signos?.spo2, u:'%'},
                        ].map((s, i) => (
                            <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.l}</p>
                                <p className="text-lg font-black text-slate-700">{s.v || '--'} <span className="text-[10px] font-normal text-slate-400">{s.u}</span></p>
                            </div>
                        ))}
                    </div>

                    {/* Notas SOAP */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <FileText size={14}/> Padecimiento (Subjetivo)
                            </h4>
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-slate-700 leading-relaxed">
                                {consultaSeleccionada.consulta?.padecimiento || 'Sin descripción'}
                            </div>
                        </div>

                        {consultaSeleccionada.consulta?.exploracion?.fisica && (
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Activity size={14}/> Exploración (Objetivo)
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.entries(consultaSeleccionada.consulta.exploracion.fisica).map(([key, val]) => 
                                        val ? (
                                            <div key={key} className="text-sm">
                                                <span className="font-bold text-slate-700 capitalize">{key}:</span> <span className="text-slate-600">{val}</span>
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Stethoscope size={14}/> Diagnóstico
                            </h4>
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-sm font-bold text-emerald-800">
                                {consultaSeleccionada.consulta?.diagnostico?.enfermedad_actual || 'Sin diagnóstico'}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Pill size={14}/> Receta / Plan
                            </h4>
                            <div className="space-y-2">
                                {consultaSeleccionada.consulta?.diagnostico?.tratamiento_lista?.map((med, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <span className="font-bold text-slate-700 text-sm">{med.nombre}</span>
                                        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">{med.dosis}</span>
                                    </div>
                                ))}
                                {(!consultaSeleccionada.consulta?.diagnostico?.tratamiento_lista || consultaSeleccionada.consulta.diagnostico.tratamiento_lista.length === 0) && (
                                    <p className="text-sm text-slate-400 italic">No se prescribieron medicamentos.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Modal */}
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Atendido por: <span className="text-slate-600">{consultaSeleccionada.medicoNombre || 'Desconocido'}</span></p>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default SeccionResumen;