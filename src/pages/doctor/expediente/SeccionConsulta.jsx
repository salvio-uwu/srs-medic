import React, { useState, useEffect } from 'react';
import { 
  FileText, Activity, ArrowLeft, Droplet, Eye, FlaskConical, 
  Search, List, Trash2, Scissors, Camera, HelpCircle, Package, 
  Eraser, CheckCircle, AlertCircle, Plus, ChevronRight
} from 'lucide-react';

const SeccionConsulta = ({ expediente, updateCampo, activeConsulta, setActiveConsulta }) => {
  // --- ESTADOS INTERNOS (INTACTOS) ---
  const [activeExploracion, setActiveExploracion] = useState('signos');
  const [activeEstudiosTab, setActiveEstudiosTab] = useState('paquetes');
  
  const [catalogoCie10, setCatalogoCie10] = useState([]);
  const [sugerenciasCie10, setSugerenciasCie10] = useState([]);
  const [mostrarCie10, setMostrarCie10] = useState(false);

  const [catalogoMeds, setCatalogoMeds] = useState([]);
  const [sugerenciasMeds, setSugerenciasMeds] = useState([]);
  const [mostrarMeds, setMostrarMeds] = useState(false);

  const [tempMed, setTempMed] = useState({ nombre: '', dosis: '' });
  const [tempGlucosa, setTempGlucosa] = useState({ fecha: '', categoria: 'Antes del desayuno', valor: '' });

  // --- CLASES DE ESTILO ORIGINALES ---
  const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in h-full flex flex-col overflow-hidden w-full"; // Aseguramos w-full aquí
  const labelClass = "text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1 block tracking-wider";
  const inputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium text-slate-700";

  // Carga de catálogos (INTACTO)
  useEffect(() => {
    const cargarCatalogos = async () => {
      try {
        const resCie = await fetch('/data/cie10.json'); 
        if (resCie.ok) setCatalogoCie10(await resCie.json());
        const resMeds = await fetch('/data/medicamentos.json');
        if (resMeds.ok) setCatalogoMeds(await resMeds.json());
      } catch (error) { console.error("Error cargando catálogos:", error); }
    };
    cargarCatalogos();
  }, []);

  // --- RENDERS DE SUB-SECCIONES ---

  // 1. PADEZIMIENTO ACTUAL
  const renderPadecimiento = () => (
    <div className={sectionClass}>
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><FileText size={20}/></div>
        <div>
            <h3 className="font-bold text-slate-800 text-lg leading-none">Padecimiento Actual</h3>
            <p className="text-xs text-slate-400 mt-1">Síntomas y motivo de la consulta</p>
        </div>
      </div>
      <textarea 
        className="flex-1 w-full p-5 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none text-slate-700 text-base resize-none focus:bg-white focus:border-blue-500 transition-all leading-relaxed shadow-inner"
        placeholder="Describa aquí los signos, síntomas y motivo de la consulta"
        value={expediente.consulta.padecimiento}
        onChange={e => updateCampo('consulta.padecimiento', e.target.value)}
      />
      <div className="flex justify-end mt-6 shrink-0">
        <button onClick={() => setActiveConsulta('exploracion')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95">
          Continuar Exploración <ArrowLeft size={18} className="rotate-180"/>
        </button>
      </div>
    </div>
  );

  // 2. EXPLORACIÓN FÍSICA
  const renderExploracion = () => (
    <div className="flex h-full w-full gap-6 animate-in fade-in">
      <div className="w-56 flex flex-col gap-2 shrink-0 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
        {[
          {id:'signos', label:'Vitales', icon:<Activity size={18}/>},
          {id:'colesterol', label:'Lípidos', icon:<Droplet size={18}/>},
          {id:'fisica', label:'Física', icon:<Eye size={18}/>},
          {id:'glucosa', label:'Glucosa', icon:<FlaskConical size={18}/>},
        ].map(item => (
          <button key={item.id} onClick={()=>setActiveExploracion(item.id)}
            className={`p-3.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all ${
                activeExploracion === item.id 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200 ring-2 ring-blue-50' 
                : 'text-slate-400 hover:bg-white/60 hover:text-slate-600'
            }`}
          >
            <span className={activeExploracion === item.id ? 'text-blue-500' : 'text-slate-400'}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className={sectionClass}>
        <div className="flex-1 w-full overflow-y-auto custom-scrollbar pr-2">
            {activeExploracion === 'signos' && (
              <div className="space-y-8 w-full">
                <div className="animate-in fade-in slide-in-from-right-2">
                  <h4 className="text-[13px] font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Activity size={16} className="text-blue-500"/> Signos Vitales
                  </h4>
                  {/* Grid expandido a w-full */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full">
                    {['TA','Temp','FC','FR','SpO2'].map(l => (
                      <div key={l} className="w-full">
                        <label className={labelClass}>{l}</label>
                        <input className={inputClass} placeholder="--" 
                          value={expediente.consulta.exploracion.signos[l.toLowerCase()]} 
                          onChange={e => updateCampo(`consulta.exploracion.signos.${l.toLowerCase()}`, e.target.value)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="animate-in fade-in slide-in-from-right-4">
                  <h4 className="text-[13px] font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Scissors className="rotate-90 text-blue-500" size={16}/> Antropometría
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-5 w-full">
                    {['Talla','Peso','Cintura','Cadera','IMC','Peso_ideal'].map(l => (
                      <div key={l} className="w-full">
                        <label className={labelClass}>{l.replace('_',' ')}</label>
                        <input className={inputClass} placeholder="0.00"
                          value={expediente.consulta.exploracion.antropometria[l.toLowerCase()]}
                          onChange={e => updateCampo(`consulta.exploracion.antropometria.${l.toLowerCase()}`, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeExploracion === 'colesterol' && (
              <div className="space-y-6 w-full animate-in fade-in slide-in-from-right-2">
                <h4 className="text-[13px] font-black text-cyan-600 uppercase tracking-widest border-b border-slate-100 pb-2">Lípidos y Bioquímica</h4>
                {/* Grid expandido a w-full */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                  <div><label className={labelClass}>Triglicéridos (mg/dl)</label><input type="number" className={inputClass} value={expediente.consulta.exploracion.colesterol.trigliceridos} onChange={e => updateCampo('consulta.exploracion.colesterol.trigliceridos', e.target.value)} /></div>
                  <div><label className={labelClass}>Colesterol (mg/dl)</label><input type="number" className={inputClass} value={expediente.consulta.exploracion.colesterol.colesterol} onChange={e => updateCampo('consulta.exploracion.colesterol.colesterol', e.target.value)} /></div>
                  <div><label className={labelClass}>HbA1c (%)</label><input type="number" className={inputClass} value={expediente.consulta.exploracion.colesterol.hba1c} onChange={e => updateCampo('consulta.exploracion.colesterol.hba1c', e.target.value)} /></div>
                </div>
              </div>
            )}

            {activeExploracion === 'fisica' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 w-full animate-in fade-in slide-in-from-right-2">
                {['Habitus','Cabeza','Cuello','Torax','Genitales','Extremidades','Columna','Abdomen'].map(area => (
                  <div key={area} className="w-full">
                    <label className={`${labelClass} text-blue-900`}>{area}</label>
                    <textarea className={`${inputClass} h-32 resize-none bg-white`} 
                      value={expediente.consulta.exploracion.fisica[area.toLowerCase()]}
                      onChange={e => updateCampo(`consulta.exploracion.fisica.${area.toLowerCase()}`, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            {activeExploracion === 'glucosa' && (
               <div className="h-full w-full flex flex-col animate-in fade-in slide-in-from-right-2">
                  <h3 className="text-cyan-600 font-bold text-lg mb-6 shrink-0">Control de Glucosa Capilar</h3>
                  <div className="flex flex-col md:flex-row gap-4 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100 items-end shrink-0 w-full">
                      <div className="flex flex-col gap-1 flex-1">
                          <label className={labelClass}>Categoría de toma</label>
                          <select className={inputClass} value={tempGlucosa.categoria} onChange={e => setTempGlucosa({...tempGlucosa, categoria: e.target.value})}>
                              {['Antes del desayuno', '2 horas después del desayuno', 'Antes de la comida', '2 horas después de la comida', 'Antes de la cena', '2 horas después de la cena'].map(c => <option key={c}>{c}</option>)}
                          </select>
                      </div>
                      <div className="flex flex-col gap-1 w-36">
                          <label className={labelClass}>Valor (mg/dL)</label>
                          <input type="number" className={inputClass} placeholder="000" value={tempGlucosa.valor} onChange={e => setTempGlucosa({...tempGlucosa, valor: e.target.value})} />
                      </div>
                      <button onClick={() => {
                          if(tempGlucosa.valor) {
                            const fecha = new Date().toISOString().split('T')[0];
                            updateCampo('consulta.exploracion.glucosa.lista', [...expediente.consulta.exploracion.glucosa.lista, { ...tempGlucosa, fecha }]);
                            setTempGlucosa({...tempGlucosa, valor: ''});
                          }
                      }} className="bg-cyan-500 text-white px-8 h-[46px] rounded-xl font-bold shadow-lg shadow-cyan-500/20 hover:bg-cyan-600 transition-all active:scale-95">Agregar</button>
                  </div>
                  
                  <div className="flex-1 w-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col">
                      <div className="grid grid-cols-3 bg-slate-50 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 shrink-0">
                        <span>Fecha</span><span>Estado</span><span>Nivel</span>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {expediente.consulta.exploracion.glucosa.lista.map((g, i) => (
                            <div key={i} className="grid grid-cols-3 py-3 text-center text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors relative group items-center">
                            <span className="text-slate-500 font-medium">{g.fecha}</span>
                            <span className="text-slate-600 text-xs">{g.categoria}</span>
                            <span className="font-bold text-cyan-600">{g.valor} mg/dL</span>
                            <button onClick={() => updateCampo('consulta.exploracion.glucosa.lista', expediente.consulta.exploracion.glucosa.lista.filter((_, idx) => idx !== i))} className="absolute right-4 opacity-0 group-hover:opacity-100 text-red-400 p-1 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14}/></button>
                            </div>
                        ))}
                        {expediente.consulta.exploracion.glucosa.lista.length === 0 && (
                            <p className="p-20 text-center text-slate-400 text-xs italic">No hay registros de glucosa.</p>
                        )}
                      </div>
                  </div>
               </div>
            )}
        </div>
      </div>
    </div>
  );

  // 3. DIAGNÓSTICO Y PLAN
  const renderDiagnostico = () => (
    <div className="flex gap-6 h-full w-full animate-in fade-in">
      {/* Columna Izquierda */}
      <div className="w-1/2 flex flex-col gap-6">
        <div className={sectionClass}>
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h4 className="text-[13px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle size={16} className="text-blue-500"/> Juicio Clínico
                </h4>
                <HelpCircle className="text-slate-300 hover:text-blue-500 cursor-pointer transition-colors" size={20} />
            </div>
            
            <div className="relative z-[60] mb-6 shrink-0 w-full">
                <label className={labelClass}>Diagnóstico (CIE-10)</label>
                <div className="relative w-full">
                    <input className={`${inputClass} pr-12`} placeholder="Escribe código o nombre de la patología" value={expediente.consulta.diagnostico.enfermedad_actual}
                    onChange={(e) => {
                        const t = e.target.value;
                        updateCampo('consulta.diagnostico.enfermedad_actual', t);
                        if(t.length > 2 && catalogoCie10.length > 0) {
                        const res = catalogoCie10.filter(i => i.code?.toLowerCase().startsWith(t.toLowerCase()) || i.description?.toLowerCase().includes(t.toLowerCase())).slice(0, 50);
                        setSugerenciasCie10(res); setMostrarCie10(true);
                        } else setMostrarCie10(false);
                    }}
                    onBlur={() => setTimeout(() => setMostrarCie10(false), 200)}
                    />
                    <div className="absolute right-3 top-3 text-blue-500"><Search size={20}/></div>
                    {mostrarCie10 && sugerenciasCie10.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white border rounded-2xl shadow-2xl mt-2 max-h-64 overflow-y-auto z-[100] border-slate-200 p-2">
                            {sugerenciasCie10.map((item, idx) => (
                            <div key={idx} onClick={() => { updateCampo('consulta.diagnostico.enfermedad_actual', `${item.code} - ${item.description}`); setMostrarCie10(false); }} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 text-sm flex gap-3 items-start rounded-xl transition-colors">
                                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 shadow-sm">{item.code}</span>
                                <span className="text-slate-700 font-semibold leading-tight">{item.description}</span>
                            </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 w-full bg-slate-50/50 p-5 rounded-2xl border border-slate-200 flex flex-col">
                <h4 className="text-xs font-black text-cyan-600 uppercase mb-4 tracking-widest shrink-0">Prescribir Medicamento</h4>
                <div className="space-y-4 flex-1 flex flex-col w-full">
                    <div className="relative z-[50] w-full">
                        <label className={labelClass}>Buscador de fármacos</label>
                        <input className={inputClass} placeholder="Nombre comercial del medicamento o sustancia" value={tempMed.nombre} 
                            onChange={e => {
                                const val = e.target.value;
                                setTempMed({...tempMed, nombre: val});
                                if(val.length > 1 && catalogoMeds.length > 0) {
                                    const filtrados = catalogoMeds.filter(m => m["*NOMBRE COMERCIAL"]?.toLowerCase().includes(val.toLowerCase()) || m["*SUSTANCIA(S) ACTIVA(S)"]?.toLowerCase().includes(val.toLowerCase())).slice(0, 50);
                                    setSugerenciasMeds(filtrados); setMostrarMeds(true);
                                } else setMostrarMeds(false);
                            }}
                            onBlur={() => setTimeout(() => setMostrarMeds(false), 200)}
                        />
                        {mostrarMeds && sugerenciasMeds.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl mt-2 max-h-64 overflow-y-auto z-[100] p-2">
                                {sugerenciasMeds.map((item, idx) => (
                                    <div key={idx} onClick={() => { setTempMed({ nombre: item["*NOMBRE COMERCIAL"], dosis: item["DOSIS"] || '' }); setMostrarMeds(false); }} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 rounded-xl transition-colors">
                                        <div className="font-bold text-slate-800">{item["*NOMBRE COMERCIAL"]}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{item["*SUSTANCIA(S) ACTIVA(S)"]}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col flex-1 w-full">
                        <label className={labelClass}>Dosis e indicaciones</label>
                        <textarea className={`${inputClass} flex-1 resize-none bg-white`} placeholder="Indique la dosis" value={tempMed.dosis} onChange={e => setTempMed({...tempMed, dosis: e.target.value})} />
                    </div>
                    <button onClick={() => {
                        if(tempMed.nombre) {
                        updateCampo('consulta.diagnostico.tratamiento_lista', [...(expediente.consulta.diagnostico.tratamiento_lista || []), tempMed]);
                        setTempMed({nombre:'', dosis:''});
                        }
                    }} className="bg-cyan-500 text-white w-full py-3.5 rounded-xl font-bold shadow-lg shadow-cyan-500/20 hover:bg-cyan-600 transition-all active:scale-[0.98] shrink-0">
                    Agregar a Receta
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      {/* Columna Derecha */}
      <div className="w-1/2 flex flex-col gap-5">
         <div className="flex-1 w-full border border-slate-200 rounded-3xl overflow-hidden bg-white flex flex-col shadow-sm">
            <div className="grid grid-cols-[1.2fr_2fr_40px] bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest py-3 px-4 border-b border-slate-100 shrink-0 w-full">
                <span>Medicamento</span><span>Indicación</span><span></span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/30 custom-scrollbar w-full">
                {expediente.consulta.diagnostico.tratamiento_lista?.map((m, i) => (
                    <div key={i} className="grid grid-cols-[1.2fr_2fr_40px] text-xs py-3 px-4 bg-white border border-slate-100 rounded-xl shadow-sm items-center w-full">
                        <span className="font-bold text-blue-900">{m.nombre}</span>
                        <span className="text-slate-600 italic px-2">{m.dosis}</span>
                        <button onClick={() => updateCampo('consulta.diagnostico.tratamiento_lista', expediente.consulta.diagnostico.tratamiento_lista.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                ))}
                {(!expediente.consulta.diagnostico.tratamiento_lista || expediente.consulta.diagnostico.tratamiento_lista.length === 0) && (
                    <div className="h-full flex items-center justify-center text-slate-400 italic text-xs py-20">Sin medicamentos en receta</div>
                )}
            </div>
         </div>
         <div className="flex-[0.6] flex flex-col gap-4 w-full">
            <div className="flex-1 flex flex-col w-full">
                <label className={labelClass}>Notas e Instrucciones Adicionales</label>
                <textarea className={`${inputClass} flex-1 resize-none border-blue-100 focus:border-blue-500 bg-white`} placeholder="Medidas higiénico-dietéticas, cuidados especiales u otros" value={expediente.consulta.diagnostico.indicaciones} onChange={e => updateCampo('consulta.diagnostico.indicaciones', e.target.value)} />
            </div>
            <input className={`${inputClass} bg-white shadow-sm shrink-0 w-full`} placeholder="Pronóstico del paciente (Uso interno)" value={expediente.consulta.diagnostico.pronostico} onChange={e => updateCampo('consulta.diagnostico.pronostico', e.target.value)} />
         </div>
      </div>
    </div>
  );

  // 4. ESTUDIOS CLÍNICOS
  const renderEstudios = () => (
    <div className="flex h-full w-full gap-6 animate-in fade-in">
        <div className="w-56 flex flex-col gap-2 shrink-0 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">Tipo de Orden</p>
            <button onClick={()=>setActiveEstudiosTab('paquetes')} className={`p-4 rounded-xl border flex flex-col items-center gap-3 font-bold text-xs transition-all ${activeEstudiosTab==='paquetes' ? 'bg-white text-blue-600 border-slate-200 shadow-sm ring-2 ring-blue-50' : 'text-slate-400 hover:bg-white/60'}`}><Package size={24}/> Paquetes</button>
            <button onClick={()=>setActiveEstudiosTab('estudios')} className={`p-4 rounded-xl border flex flex-col items-center gap-3 font-bold text-xs transition-all ${activeEstudiosTab==='estudios' ? 'bg-white text-blue-600 border-slate-200 shadow-sm ring-2 ring-blue-50' : 'text-slate-400 hover:bg-white/60'}`}><FlaskConical size={24}/> Individual</button>
        </div>
        
        <div className={sectionClass}>
            {activeEstudiosTab === 'paquetes' ? (
                <div className="h-full w-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 overflow-hidden">
                    <h3 className="text-blue-900 font-bold text-lg flex items-center gap-2 mb-2 shrink-0 border-b pb-2"><Package size={20} className="text-blue-500"/> Solicitud por Paquetes</h3>
                    <div className="flex-1 w-full flex gap-6 overflow-hidden">
                        <div className="flex-1 border border-slate-200 rounded-2xl overflow-y-auto p-4 space-y-3 bg-slate-50/30 custom-scrollbar w-full">
                            {['Check up general', 'Perfil Diabético', 'Biometría Completa', 'Química Sanguínea', 'Perfil de Lípidos', 'Perfil Hepático', 'Pruebas de Función Tiroidea'].map(pkg => (
                                <label key={pkg} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 hover:border-blue-300 rounded-xl cursor-pointer transition-all shadow-sm group w-full">
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{pkg}</span>
                                    <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded-lg" checked={expediente.consulta.estudios.paquetes_seleccionados.some(p => p.nombre === pkg)}
                                        onChange={e => {
                                            const list = expediente.consulta.estudios.paquetes_seleccionados;
                                            updateCampo('consulta.estudios.paquetes_seleccionados', e.target.checked ? [...list, {nombre: pkg, nota: ''}] : list.filter(p => p.nombre !== pkg));
                                        }} />
                                </label>
                            ))}
                        </div>
                        <div className="flex-1 border border-blue-100 rounded-2xl bg-blue-50/30 p-4 overflow-y-auto custom-scrollbar w-full">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Notas específicas</h4>
                            {expediente.consulta.estudios.paquetes_seleccionados.map((item, i) => (
                                <div key={i} className="mb-3 bg-white p-3 rounded-xl shadow-sm border border-blue-100 animate-in zoom-in-95 w-full">
                                    <p className="text-xs font-bold text-slate-800 flex justify-between">{item.nombre} <Trash2 size={12} className="text-slate-300 cursor-pointer" onClick={() => updateCampo('consulta.estudios.paquetes_seleccionados', expediente.consulta.estudios.paquetes_seleccionados.filter(p => p.nombre !== item.nombre))}/></p>
                                    <input className="w-full mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] outline-none focus:border-blue-400" placeholder="Ej: Ayuno de 12 horas..." value={item.nota} onChange={e => {
                                        const newList = [...expediente.consulta.estudios.paquetes_seleccionados];
                                        newList[i].nota = e.target.value;
                                        updateCampo('consulta.estudios.paquetes_seleccionados', newList);
                                    }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full w-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 overflow-hidden">
                    <h3 className="text-blue-900 font-bold text-lg mb-2 shrink-0 border-b pb-2">Estudios Individuales</h3>
                    <div className="relative mb-2 shrink-0 w-full">
                        <Search className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                        <input className={`${inputClass} pl-12 h-14 text-base shadow-sm w-full`} placeholder="Teclee estudio clínico" onKeyDown={e => {
                            if(e.key === 'Enter' && e.target.value) {
                                updateCampo('consulta.estudios.estudios_seleccionados', [...expediente.consulta.estudios.estudios_seleccionados, {nombre: e.target.value, nota: ''}]);
                                e.target.value = '';
                            }
                        }} />
                    </div>
                    <div className="flex-1 w-full border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white flex flex-col">
                        <div className="grid grid-cols-[1.2fr_2fr_50px] bg-slate-50 py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 shrink-0 w-full">
                            <span>Estudio</span><span>Observaciones</span><span></span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar w-full">
                            {expediente.consulta.estudios.estudios_seleccionados.map((est, i) => (
                                <div key={i} className="grid grid-cols-[1.2fr_2fr_50px] p-3 border-b border-slate-50 items-center text-sm group hover:bg-slate-50 transition-colors w-full">
                                    <span className="font-bold text-slate-700">{est.nombre}</span>
                                    <input className="mx-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" placeholder="Nota..." value={est.nota} onChange={e => {
                                        const newList = [...expediente.consulta.estudios.estudios_seleccionados];
                                        newList[i].nota = e.target.value;
                                        updateCampo('consulta.estudios.estudios_seleccionados', newList);
                                    }} />
                                    <button className="flex justify-center" onClick={() => updateCampo('consulta.estudios.estudios_seleccionados', expediente.consulta.estudios.estudios_seleccionados.filter((_, idx) => idx !== i))}><Trash2 size={16} className="text-slate-300 hover:text-red-500 transition-colors"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <div className="mt-6 shrink-0 w-full">
                <label className={labelClass}>Instrucciones generales para el laboratorio</label>
                <textarea className={`${inputClass} h-20 resize-none border-blue-100`} placeholder="Notas globales para la orden de estudios" value={expediente.consulta.estudios.notas_generales} onChange={e => updateCampo('consulta.estudios.notas_generales', e.target.value)} />
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white rounded-3xl shadow-sm border border-slate-200 w-full">
      <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 shrink-0 gap-8 overflow-x-auto w-full">
        {[
          {id:'padecimiento', label:'Motivo', icon:<FileText size={16}/>}, 
          {id:'exploracion', label:'Exploración', icon:<Activity size={16}/>}, 
          {id:'diagnostico', label:'Diagnóstico', icon:<CheckCircle size={16}/>}, 
          {id:'estudios', label:'Estudios', icon:<FlaskConical size={16}/>}
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveConsulta(tab.id)}
            className={`py-4 px-2 text-xs font-bold border-b-[3px] transition-all flex items-center gap-2 shrink-0 ${
                activeConsulta === tab.id 
                ? 'border-blue-600 text-blue-700' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {tab.icon} {tab.label.toUpperCase()}
          </button>
        ))}
      </div>
      
      <div className="flex-1 p-6 overflow-hidden bg-slate-50/30 w-full">
        {activeConsulta === 'padecimiento' && renderPadecimiento()}
        {activeConsulta === 'exploracion' && renderExploracion()}
        {activeConsulta === 'diagnostico' && renderDiagnostico()}
        {activeConsulta === 'estudios' && renderEstudios()}
      </div>
    </div>
  );
};

export default SeccionConsulta;