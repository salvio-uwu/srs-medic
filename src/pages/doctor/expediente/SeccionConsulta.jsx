// src/pages/doctor/expediente/SeccionConsulta.jsx
import React, { useState, useEffect } from 'react';
import { 
  FileText, Activity, ArrowLeft, Droplet, Eye, FlaskConical, 
  Search, Trash2, Scissors, HelpCircle, Package, 
  CheckCircle, Mic, Zap, AlertTriangle, ChevronRight, Pill, Sparkles, Brain, X, Check
} from 'lucide-react';

// --- CONFIGURACIÓN ---
const API_KEY = "AIzaSyCW6JzQuMgVZDsT4p9EqwtZOYaUl47O4u8"; 

let cacheCie10 = null;
let cacheMeds = null;

const SeccionConsulta = ({ 
  expediente, 
  updateCampo, 
  activeConsulta, 
  setActiveConsulta, 
  tempMed, 
  setTempMed 
}) => {  
  
  // --- ESTADOS DE NAVEGACIÓN ---
  const [activeExploracion, setActiveExploracion] = useState('signos');
  const [activeEstudiosTab, setActiveEstudiosTab] = useState('paquetes');
  
  // --- ESTADOS DE BUSCADORES ---
  const [sugerenciasCie10, setSugerenciasCie10] = useState([]);
  const [mostrarCie10, setMostrarCie10] = useState(false);
  const [sugerenciasMeds, setSugerenciasMeds] = useState([]);
  const [mostrarMeds, setMostrarMeds] = useState(false);
  
  // --- ESTADOS IA & DICTADO ---
  const [analizandoRiesgo, setAnalizandoRiesgo] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sugiriendoDosis, setSugiriendoDosis] = useState(false);
  const [generandoPlan, setGenerandoPlan] = useState(false);
  
  // --- MEMORIA DE LA IA ---
  const [planIA, setPlanIA] = useState(null); 

  // --- ESTADOS UI (MODALES) ---
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false); 
  const [riskData, setRiskData] = useState({ mensaje: '', medicamento: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [tempGlucosa, setTempGlucosa] = useState({ fecha: '', categoria: 'Antes del desayuno', valor: '' });

  // --- CARGA INICIAL ---
  useEffect(() => {
    const cargarCatalogos = async () => {
      if (!cacheCie10) {
        try { const res = await fetch('/data/cie10.json'); if (res.ok) cacheCie10 = await res.json(); } catch (e) { console.error("Error CIE10", e); }
      }
      if (!cacheMeds) {
        try { const res = await fetch('/data/medicamentos.json'); if (res.ok) cacheMeds = await res.json(); } catch (e) { console.error("Error Meds", e); }
      }
    };
    cargarCatalogos();
  }, []);

  // Timer Toast
  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast({ ...toast, show: false }), 4000);
      return () => clearTimeout(t);
    }
  }, [toast.show]);

  const showNotification = (msg, type = 'success') => setToast({ show: true, message: msg, type });

  // ==========================================
  // FUNCIONES IA (Back-end Logic)
  // ==========================================

  const cleanJSON = (text) => {
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const iStart = cleaned.indexOf('{');
    const iEnd = cleaned.lastIndexOf('}');
    if (iStart !== -1 && iEnd !== -1) cleaned = cleaned.substring(iStart, iEnd + 1);
    return cleaned;
  };

  const analizarRiesgoConIA = async (medicamentoNuevo) => {
    setAnalizandoRiesgo(true);
    try {
      const listaAlergias = expediente.antecedentes?.alergias?.lista || [];
      const nombresLista = listaAlergias.map(a => a.sustancia);
      const textoOtras = expediente.antecedentes?.alergias?.otras || "";
      const alergiasBase = expediente.px_info?.alergias_base || "";
      const contextoAlergias = [...nombresLista, textoOtras, alergiasBase].filter(Boolean).join(", ");
      const medicamentosActuales = expediente.consulta.diagnostico.tratamiento_lista?.map(m => m.nombre).join(", ") || "Ninguno";

      if (!contextoAlergias.trim() && medicamentosActuales === "Ninguno") {
         setAnalizandoRiesgo(false); return { riesgo: false };
      }

      const promptText = `Eres experto en seguridad farmacológica. Paciente con alergias: "${contextoAlergias}". Medicamentos actuales: "${medicamentosActuales}". Se intenta agregar: "${medicamentoNuevo}". Detecta riesgos GRAVES. Responde JSON: { "riesgo": true/false, "mensaje": "Explicación breve" }`;
      
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
      const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
      const data = await response.json();
      const text = cleanJSON(data.candidates[0].content.parts[0].text);
      setAnalizandoRiesgo(false);
      return JSON.parse(text);
    } catch (error) {
      setAnalizandoRiesgo(false); return { riesgo: true, mensaje: "Error de conexión. Verifique manualmente." }; 
    }
  };

  const sugerirDosisIA = async () => {
    if (!tempMed.nombre) return;
    setSugiriendoDosis(true);
    try {
        const edad = expediente.px_info?.edad || "No especificada";
        const peso = expediente.consulta.exploracion.antropometria?.peso || "No registrado";
        const promptText = `Calcula dosis para "${tempMed.nombre}". Paciente: ${edad}, Peso: ${peso}kg. Responde SOLO la indicación.`;
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
        const data = await response.json();
        setTempMed(prev => ({ ...prev, dosis: data.candidates[0].content.parts[0].text.trim() }));
    } catch (error) { console.error(error); } finally { setSugiriendoDosis(false); }
  };

  const generarPlanCompleto = async () => {
    if (!expediente.consulta.padecimiento) { showNotification("Escribe el padecimiento primero", "error"); return; }
    
    setGenerandoPlan(true);
    try {
      const datos = {
        padecimiento: expediente.consulta.padecimiento,
        signos: expediente.consulta.exploracion.signos, 
        antropometria: expediente.consulta.exploracion.antropometria, 
        edad: expediente.px_info?.edad || "?",
        alergias: [...(expediente.antecedentes?.alergias?.lista?.map(a=>a.sustancia)||[]), expediente.antecedentes?.alergias?.otras].join(", ")
      };

      const prompt = `
        Actúa como médico especialista.
        DATOS CLÍNICOS:
        - Motivo: "${datos.padecimiento}"
        - Vitales: ${JSON.stringify(datos.signos)}
        - Físico: Peso ${datos.antropometria?.peso}kg, Talla ${datos.antropometria?.talla}m, IMC ${datos.antropometria?.imc}
        - Edad: ${datos.edad}
        - Alergias: ${datos.alergias}

        Genera un plan clínico. Si el paciente es pediátrico o tiene bajo peso, ajusta dosis.
        Para medicamentos, sugiere PRINCIPIO ACTIVO.
        
        Responde SOLO JSON: 
        { 
            "diagnosticos": [{ "codigo": "CIE10", "nombre": "Nombre" }], 
            "tratamiento": [{ "nombre": "Sustancia", "dosis": "Dosis calculada" }], 
            "indicaciones": "Texto notas" 
        }
      `;

      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
      const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json();
      const rawPlan = JSON.parse(cleanJSON(data.candidates[0].content.parts[0].text));

      const planValidado = {
          ...rawPlan,
          tratamiento: rawPlan.tratamiento.map(t => {
              let match = null;
              if (cacheMeds) {
                  match = cacheMeds.find(m => 
                      m["*SUSTANCIA(S) ACTIVA(S)"]?.toUpperCase().includes(t.nombre.toUpperCase())
                  );
              }
              return match 
                ? { nombre: match["*NOMBRE COMERCIAL"], dosis: t.dosis, enInventario: true, sustancia: t.nombre } 
                : { nombre: t.nombre, dosis: t.dosis, enInventario: false };
          })
      };
      
      setPlanIA(planValidado);
      showNotification("✨ Análisis completado. Sugerencias disponibles.", "success");
      
    } catch (e) { showNotification("Error al analizar el caso", "error"); } finally { setGenerandoPlan(false); }
  };

  // --- ACTIONS ---
  const handleAgregarMedicamento = async () => {
    if (!tempMed.nombre) return;
    const yaExiste = expediente.consulta.diagnostico.tratamiento_lista?.some(m => m.nombre.toLowerCase() === tempMed.nombre.toLowerCase());
    if (yaExiste) { setRiskData({ mensaje: "Este medicamento ya está en la lista.", medicamento: tempMed.nombre }); setShowRiskModal(true); return; }
    
    const resultadoIA = await analizarRiesgoConIA(tempMed.nombre);
    if (resultadoIA.riesgo) { setRiskData({ mensaje: resultadoIA.mensaje, medicamento: tempMed.nombre }); setShowRiskModal(true); return; }
    
    ejecutarAgregado();
  };

  const ejecutarAgregado = () => {
    updateCampo('consulta.diagnostico.tratamiento_lista', [...(expediente.consulta.diagnostico.tratamiento_lista || []), tempMed]);
    setTempMed({nombre:'', dosis:''}); setShowRiskModal(false); showNotification("Medicamento agregado", "success");
  };

  const toggleDictado = () => {
    if (!('webkitSpeechRecognition' in window)) return alert("Navegador no soportado");
    if (isListening) { setIsListening(false); return; }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'es-MX'; recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => { const t = e.results[0][0].transcript; updateCampo('consulta.padecimiento', (expediente.consulta.padecimiento || '') + " " + t); };
    recognition.start();
  };

  // --- STYLES ---
  // Estilos más equilibrados (ni muy grandes ni muy chicos)
  const glassCard = "bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col";
  const inputStyle = "w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm text-slate-700 placeholder:text-slate-400 shadow-sm";
  const labelStyle = "text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 block tracking-wide";
  const buttonPrimary = "bg-slate-900 text-white shadow-lg hover:bg-black";

  // ==========================================
  // RENDERS
  // ==========================================

  const renderPadecimiento = () => (
    <div className={`${glassCard} min-h-full p-8 animate-in fade-in`}>
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100"><FileText size={24}/></div>
            <div><h3 className="font-bold text-slate-800 text-xl tracking-tight">Motivo de Consulta</h3><p className="text-sm text-slate-400 font-medium">Historia clínica y síntomas</p></div>
        </div>
        <button onClick={toggleDictado} className={`p-4 rounded-2xl transition-all flex items-center gap-2 ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100'}`}><Mic size={22}/></button>
      </div>
      
      <div className="flex-1 flex flex-col min-h-[300px]">
          <textarea className="flex-1 w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl outline-none text-slate-700 text-base leading-relaxed focus:bg-white focus:border-indigo-300 transition-all resize-none shadow-inner"
            placeholder="¿Cuál es el motivo de la consulta hoy?" value={expediente.consulta.padecimiento} onChange={e => updateCampo('consulta.padecimiento', e.target.value)} />
          
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 custom-scrollbar shrink-0">
            {["Paciente Asintomático", "Cefalea Intensa", "Cuadro Gripal", "Dolor Abdominal", "Control Niño Sano", "Hipertensión"].map(m => (
               <button key={m} onClick={() => updateCampo('consulta.padecimiento', (expediente.consulta.padecimiento || '') + (expediente.consulta.padecimiento ? "\n" : "") + m + ": ")} 
               className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-xl text-xs font-bold shadow-sm transition-all whitespace-nowrap active:scale-95">{m}</button>
            ))}
          </div>
      </div>

      <div className="mt-8 flex items-center justify-between shrink-0 pt-6 border-t border-slate-100">
        <button onClick={generarPlanCompleto} disabled={generandoPlan || !expediente.consulta.padecimiento}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center gap-3 relative overflow-hidden group ${generandoPlan ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-sm'}`}>
            {generandoPlan ? <><Sparkles className="animate-spin text-indigo-500"/> Pensando...</> : <><Brain className="text-indigo-600"/> Analizar Caso</>}
        </button>

        <button onClick={() => setActiveConsulta('exploracion')} className={`px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 ${buttonPrimary}`}>
          Siguiente <ArrowLeft size={18} className="rotate-180"/>
        </button>
      </div>
    </div>
  );

  const renderExploracion = () => (
    <div className="flex h-full w-full gap-6 animate-in fade-in">
        {/* BARRA LATERAL + ALERTA DE ALERGIAS */}
        <div className="w-64 flex flex-col gap-3 shrink-0 bg-white p-4 rounded-3xl border border-slate-200 h-full overflow-y-auto shadow-sm">
            {[{id:'signos', l:'Signos Vitales', i:<Activity size={18}/>}, {id:'colesterol', l:'Bioquímica', i:<Droplet size={18}/>}, {id:'fisica', l:'Exploración Física', i:<Eye size={18}/>}, {id:'glucosa', l:'Glucometría', i:<FlaskConical size={18}/>}].map(it => (
                <button key={it.id} onClick={()=>setActiveExploracion(it.id)} className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold transition-all ${activeExploracion===it.id ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <span className={activeExploracion===it.id?'text-indigo-500':''}>{it.i}</span> {it.l}
                </button>
            ))}
            
            <div className="flex-1"></div>

            {/* --- ALERTA DE ALERGIAS MOVIDA AQUÍ --- */}
            {expediente.px_info?.alergias_base && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-2 text-rose-600">
                        <AlertTriangle size={18} />
                        <span className="text-xs font-black uppercase tracking-wider">Alergias</span>
                    </div>
                    <p className="text-sm font-bold text-rose-800 leading-tight">
                        {expediente.px_info.alergias_base}
                    </p>
                </div>
            )}
        </div>

        {/* CONTENIDO EXPLORACIÓN */}
        <div className={`${glassCard} flex-1`}>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                {activeExploracion === 'signos' && (
                    <div className="space-y-8">
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex gap-2 border-b border-slate-100 pb-2">
                                <Activity size={18} className="text-indigo-500"/> Vitales
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                                {['TA','Temp','FC','FR','SpO2'].map(l => (
                                    <div key={l}>
                                        <label className={labelStyle}>{l}</label>
                                        <input 
                                            className={inputStyle} 
                                            placeholder="--" 
                                            value={expediente.consulta.exploracion.signos[l.toLowerCase()]} 
                                            onChange={e => updateCampo(`consulta.exploracion.signos.${l.toLowerCase()}`, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex gap-2 border-b border-slate-100 pb-2">
                                <Scissors className="rotate-90 text-indigo-500"/> Antropometría
                            </h4>
                            <div className="grid grid-cols-3 gap-5">
                                <div>
                                    <label className={labelStyle}>Peso (kg)</label>
                                    <input 
                                        type="number" 
                                        className={inputStyle} 
                                        value={expediente.consulta.exploracion.antropometria.peso} 
                                        onChange={e => {
                                            updateCampo('consulta.exploracion.antropometria.peso', e.target.value); 
                                            const t = expediente.consulta.exploracion.antropometria.talla; 
                                            if(t) updateCampo('consulta.exploracion.antropometria.imc', (e.target.value/(t*t)).toFixed(2));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelStyle}>Talla (m)</label>
                                    <input 
                                        type="number" 
                                        className={inputStyle} 
                                        value={expediente.consulta.exploracion.antropometria.talla} 
                                        onChange={e => {
                                            updateCampo('consulta.exploracion.antropometria.talla', e.target.value); 
                                            const p = expediente.consulta.exploracion.antropometria.peso; 
                                            if(p) updateCampo('consulta.exploracion.antropometria.imc', (p/(e.target.value*e.target.value)).toFixed(2));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelStyle}>IMC</label>
                                    <input 
                                        readOnly 
                                        className={`${inputStyle} bg-slate-100/50 text-slate-500`} 
                                        value={expediente.consulta.exploracion.antropometria.imc || ''}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeExploracion === 'colesterol' && (
                    <div className="grid grid-cols-2 gap-8">
                        <div><label className={labelStyle}>Triglicéridos</label><input className={inputStyle} type="number" value={expediente.consulta.exploracion.colesterol.trigliceridos} onChange={e=>updateCampo('consulta.exploracion.colesterol.trigliceridos',e.target.value)}/></div>
                        <div><label className={labelStyle}>Colesterol Total</label><input className={inputStyle} type="number" value={expediente.consulta.exploracion.colesterol.colesterol} onChange={e=>updateCampo('consulta.exploracion.colesterol.colesterol',e.target.value)}/></div>
                    </div>
                )}

                {activeExploracion === 'fisica' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {['Cabeza','Cuello','Torax','Abdomen','Extremidades','Neurologico'].map(area => (
                            <div key={area}>
                                <label className={labelStyle}>{area}</label>
                                <textarea className={`${inputStyle} h-28 resize-none`} value={expediente.consulta.exploracion.fisica[area.toLowerCase()]} onChange={e=>updateCampo(`consulta.exploracion.fisica.${area.toLowerCase()}`,e.target.value)}/>
                            </div>
                        ))}
                    </div>
                )}

                {activeExploracion === 'glucosa' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <div className="flex-1">
                                <label className={labelStyle}>Momento</label>
                                <select className={inputStyle} value={tempGlucosa.categoria} onChange={e=>setTempGlucosa({...tempGlucosa,categoria:e.target.value})}>
                                    {['Ayuno','Postprandial','Casual'].map(o=><option key={o}>{o}</option>)}
                                </select>
                            </div>
                            <div className="w-40">
                                <label className={labelStyle}>Valor mg/dL</label>
                                <input type="number" className={inputStyle} value={tempGlucosa.valor} onChange={e=>setTempGlucosa({...tempGlucosa,valor:e.target.value})}/>
                            </div>
                            <button onClick={()=>{if(tempGlucosa.valor){updateCampo('consulta.exploracion.glucosa.lista',[...expediente.consulta.exploracion.glucosa.lista,{...tempGlucosa,fecha:new Date().toLocaleDateString()}]);setTempGlucosa({...tempGlucosa,valor:''});}}} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 h-fit">Registrar</button>
                        </div>
                        <div className="space-y-3">
                            {expediente.consulta.exploracion.glucosa.lista.map((g,i)=>(
                                <div key={i} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex gap-4 items-center">
                                        <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 font-bold">{g.valor}</div>
                                        <span className="text-sm font-medium text-slate-600">{g.categoria}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{g.fecha}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end shrink-0">
                <button onClick={() => setActiveConsulta('diagnostico')} className={`px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 ${buttonPrimary}`}>
                    Siguiente <ArrowLeft size={18} className="rotate-180"/>
                </button>
            </div>
        </div>
    </div>
  );

  const renderDiagnostico = () => (
    <div className="flex gap-6 h-full w-full animate-in fade-in relative">
      <div className="w-1/2 flex flex-col gap-6 h-full">
        <div className={`${glassCard} flex-1 flex flex-col`}>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                <div className="relative z-20">
                    <label className={labelStyle}>Diagnóstico Final (CIE-10)</label>
                    <div className="relative">
                        <input className={inputStyle} placeholder="Buscar patología..." value={expediente.consulta.diagnostico.enfermedad_actual}
                        onChange={(e)=>{const t=e.target.value; updateCampo('consulta.diagnostico.enfermedad_actual',t); if(t.length>2 && cacheCie10){setSugerenciasCie10(cacheCie10.filter(i=>i.description.toLowerCase().includes(t.toLowerCase())).slice(0,20));setMostrarCie10(true)}else{setMostrarCie10(false)}}} onBlur={()=>setTimeout(()=>setMostrarCie10(false),200)}/>
                        <Search className="absolute right-4 top-4 text-slate-400" size={18}/>
                        {mostrarCie10 && <div className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1 z-50">{sugerenciasCie10.map((s,i)=><div key={i} onClick={()=>{updateCampo('consulta.diagnostico.enfermedad_actual',`${s.code} - ${s.description}`);setMostrarCie10(false)}} className="p-2 hover:bg-blue-50 rounded-lg text-xs cursor-pointer truncate border-b border-slate-50 last:border-0 text-slate-600">{s.code} - {s.description}</div>)}</div>}
                    </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col gap-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex gap-2"><Zap size={14}/> Nueva Receta</h4>
                    <div className="relative z-10">
                        <input className={inputStyle} placeholder="Nombre del medicamento..." value={tempMed.nombre} 
                        onChange={e=>{const v=e.target.value; setTempMed({...tempMed,nombre:v}); if(v.length>2 && cacheMeds){setSugerenciasMeds(cacheMeds.filter(m=>m["*NOMBRE COMERCIAL"].toLowerCase().includes(v.toLowerCase())).slice(0,20));setMostrarMeds(true)}else{setMostrarMeds(false)}}} onBlur={()=>setTimeout(()=>setMostrarMeds(false),200)}/>
                        {mostrarMeds && <div className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1 z-50">{sugerenciasMeds.map((m,i)=><div key={i} onClick={()=>{setTempMed({nombre:m["*NOMBRE COMERCIAL"],dosis:m["DOSIS"]||''});setMostrarMeds(false)}} className="p-2.5 hover:bg-blue-50 rounded-lg text-xs cursor-pointer font-bold text-slate-700 border-b border-slate-50 last:border-0">{m["*NOMBRE COMERCIAL"]} <span className="text-[10px] text-slate-400 font-normal ml-2">{m["*SUSTANCIA(S) ACTIVA(S)"]}</span></div>)}</div>}
                    </div>
                    
                    <div className="flex gap-2 relative">
                        <textarea className={`${inputStyle} resize-none h-24 pr-10`} placeholder="Dosis e indicaciones..." value={tempMed.dosis} onChange={e=>setTempMed({...tempMed,dosis:e.target.value})}/>
                        <button onClick={sugerirDosisIA} disabled={!tempMed.nombre || sugiriendoDosis} className="absolute right-3 top-3 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100" title="Calcular dosis con IA"><Sparkles size={14} className={sugiriendoDosis?'animate-spin':''}/></button>
                    </div>

                    <button onClick={handleAgregarMedicamento} disabled={analizandoRiesgo} className={`mt-2 w-full py-4 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${analizandoRiesgo ? 'bg-slate-800 text-slate-400 cursor-wait' : 'bg-slate-900 text-white hover:bg-black'}`}>
                        {analizandoRiesgo ? <><Activity className="animate-spin" size={16}/> Verificando...</> : "Agregar a Receta"}
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* COLUMNA DERECHA: RECETA LISTA */}
      <div className="w-1/2 flex flex-col gap-6">
         <div className={`${glassCard} flex-1 flex flex-col`}>
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Receta Actual</span><span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-black">{expediente.consulta.diagnostico.tratamiento_lista?.length || 0} items</span></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {expediente.consulta.diagnostico.tratamiento_lista?.map((m,i)=>(
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400"><Pill size={20}/></div>
                            <div><p className="font-bold text-slate-800 text-sm">{m.nombre}</p><p className="text-xs text-slate-500 mt-0.5">{m.dosis}</p></div>
                        </div>
                        <button onClick={()=>updateCampo('consulta.diagnostico.tratamiento_lista',expediente.consulta.diagnostico.tratamiento_lista.filter((_,idx)=>idx!==i))} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                    </div>
                ))}
                {(!expediente.consulta.diagnostico.tratamiento_lista || expediente.consulta.diagnostico.tratamiento_lista.length === 0) && <div className="h-full flex flex-col items-center justify-center text-slate-300 text-sm gap-2"><Package size={40} className="opacity-20"/><span className="italic">No hay medicamentos aún</span></div>}
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50">
                 {planIA?.indicaciones && <button onClick={()=>updateCampo('consulta.diagnostico.indicaciones', planIA.indicaciones)} className="mb-3 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2 w-fit transition-all ml-auto"><Zap size={12}/> Pegar notas sugeridas</button>}
                 <label className={labelStyle}>Indicaciones Generales</label>
                 <textarea className={`${inputStyle} h-24 resize-none bg-white`} placeholder="Dieta, cuidados, signos de alarma..." value={expediente.consulta.diagnostico.indicaciones} onChange={e=>updateCampo('consulta.diagnostico.indicaciones',e.target.value)}/>
            </div>
         </div>
         
         <div className="flex justify-end shrink-0">
            <button onClick={() => setActiveConsulta('estudios')} className={`px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 ${buttonPrimary}`}>
                Siguiente <ArrowLeft size={18} className="rotate-180"/>
            </button>
         </div>
      </div>

        {/* --- BOTÓN FLOTANTE SUGERENCIAS --- */}
        {planIA && (
            <button 
                onClick={() => setShowPlanModal(true)}
                className="absolute bottom-6 right-1/2 translate-x-1/2 z-50 bg-slate-900 text-white pl-4 pr-6 py-3 rounded-full shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all border border-slate-700 animate-in fade-in slide-in-from-bottom-10"
            >
                <div className="bg-indigo-500 rounded-full p-1.5 animate-pulse"><Sparkles size={16} className="text-white"/></div>
                <span className="font-bold text-sm">Ver Sugerencias IA</span>
            </button>
        )}
    </div>
  );

  const renderEstudios = () => (
    <div className="flex h-full w-full gap-6 animate-in fade-in">
        <div className="w-64 flex flex-col gap-3 shrink-0 bg-white p-4 rounded-3xl border border-slate-200 h-full">
            <button onClick={()=>setActiveEstudiosTab('paquetes')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold transition-all ${activeEstudiosTab==='paquetes'?'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200':'text-slate-500 hover:bg-slate-50'}`}><Package size={24}/> Paquetes Lab</button>
            <button onClick={()=>setActiveEstudiosTab('estudios')} className={`p-4 rounded-2xl flex flex-col items-center gap-2 text-xs font-bold transition-all ${activeEstudiosTab==='estudios'?'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200':'text-slate-500 hover:bg-slate-50'}`}><FlaskConical size={24}/> Individual</button>
        </div>
        <div className={`${glassCard} flex-1`}>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <h3 className="font-black text-xl mb-6 text-slate-800 tracking-tight">{activeEstudiosTab==='paquetes'?'Paquetes Comunes':'Estudios Individuales'}</h3>
                {activeEstudiosTab==='paquetes' ? (
                    <div className="grid grid-cols-2 gap-4">{['Biometría Hemática','Química Sanguínea 6','Examen General de Orina','Perfil Lipídico','Perfil Hepático','Tiempos de Coagulación'].map(p=>(<label key={p} className="flex gap-4 items-center p-4 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all group"><div className="relative flex items-center justify-center"><input type="checkbox" className="peer appearance-none w-6 h-6 border-2 border-slate-300 rounded-lg checked:bg-indigo-500 checked:border-indigo-500 transition-all"/><Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none"/></div><span className="font-bold text-slate-700 text-sm group-hover:text-indigo-700">{p}</span></label>))}</div>
                ):(
                    <div className="flex flex-col gap-6"><input className={inputStyle} placeholder="Escriba el estudio y presione Enter" onKeyDown={e=>{if(e.key==='Enter'&&e.target.value){updateCampo('consulta.estudios.estudios_seleccionados',[...expediente.consulta.estudios.estudios_seleccionados,{nombre:e.target.value,nota:''}]);e.target.value=''}}}/>
                    <div className="space-y-2">{expediente.consulta.estudios.estudios_seleccionados.map((est,i)=>(<div key={i} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm"><span className="font-bold text-slate-700 text-sm">{est.nombre}</span><button onClick={()=>updateCampo('consulta.estudios.estudios_seleccionados',expediente.consulta.estudios.estudios_seleccionados.filter((_,x)=>x!==i))} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16}/></button></div>))}</div></div>
                )}
                <div className="mt-8"><label className={labelStyle}>Notas para Laboratorio</label><textarea className={`${inputStyle} h-24`} placeholder="Indicaciones especiales..." value={expediente.consulta.estudios.notas_generales} onChange={e=>updateCampo('consulta.estudios.notas_generales',e.target.value)}/></div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
      <div className="absolute inset-0 bg-slate-50 -z-10 pointer-events-none"/>
      
      {/* TABS HEADER */}
      <div className="flex border-b border-slate-200 bg-white px-8 shrink-0 gap-8 overflow-x-auto z-20 h-16 items-center shadow-sm">
        {[{id:'padecimiento',l:'Motivo',i:<FileText size={18}/>},{id:'exploracion',l:'Exploración',i:<Activity size={18}/>},{id:'diagnostico',l:'Diagnóstico',i:<CheckCircle size={18}/>},{id:'estudios',l:'Estudios',i:<FlaskConical size={18}/>}].map(t=>(
            <button key={t.id} onClick={()=>setActiveConsulta(t.id)} className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeConsulta===t.id?'bg-slate-900 text-white shadow-lg':'text-slate-500 hover:bg-slate-100'}`}>{t.i} {t.l.toUpperCase()}</button>
        ))}
      </div>
      
      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-6 overflow-hidden w-full relative z-10">
        {activeConsulta === 'padecimiento' && renderPadecimiento()}
        {activeConsulta === 'exploracion' && renderExploracion()}
        {activeConsulta === 'diagnostico' && renderDiagnostico()}
        {activeConsulta === 'estudios' && renderEstudios()}
      </div>

      {/* --- TOAST --- */}
      <div className={`fixed bottom-8 right-8 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl border border-white/20 ${toast.type==='error'?'bg-rose-500/90 text-white':'bg-slate-900/90 text-white'}`}>
            {toast.type==='error'?<AlertTriangle size={24}/>:<CheckCircle size={24} className="text-emerald-400"/>}
            <span className="font-bold text-sm tracking-wide">{toast.message}</span>
        </div>
      </div>

      {/* --- MODAL DE RIESGO --- */}
      {showRiskModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 border-b border-orange-100 flex items-start gap-4">
              <div className="bg-white p-3 rounded-full shadow-md text-orange-500"><AlertTriangle size={28}/></div>
              <div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Alerta Clínica</h3><p className="text-xs font-bold text-orange-600 mt-1 uppercase tracking-wider">Validación de Seguridad</p></div>
            </div>
            <div className="p-8 space-y-6">
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Medicamento</p><div className="text-xl font-black text-slate-800">{riskData.medicamento}</div></div>
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-xl"><p className="text-sm font-medium text-slate-700 leading-relaxed">"{riskData.mensaje}"</p></div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={()=>setShowRiskModal(false)} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">Cancelar</button>
              <button onClick={ejecutarAgregado} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-black transition-all flex justify-center gap-2 items-center"><span>Autorizar Riesgo</span><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PLAN IA --- */}
      {showPlanModal && planIA && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Sparkles className="text-indigo-500"/> Plan Sugerido por IA</h3>
                        <p className="text-sm text-slate-400">Basado en síntomas y exploración física</p>
                    </div>
                    <button onClick={()=>setShowPlanModal(false)} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 text-slate-500"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Diagnósticos Probables</h4>
                            <div className="flex flex-wrap gap-3">
                                {planIA.diagnosticos.map((d, i) => (
                                    <button key={i} onClick={()=>{updateCampo('consulta.diagnostico.enfermedad_actual', `${d.codigo} - ${d.nombre}`); showNotification("Diagnóstico aplicado");}} className="bg-white border border-indigo-100 hover:border-indigo-500 text-slate-700 px-4 py-3 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md text-left w-full flex items-center gap-3 group">
                                        <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-xs font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors">{d.codigo}</span>
                                        {d.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Tratamiento Recomendado</h4>
                            <div className="space-y-3">
                                {planIA.tratamiento.map((t, i) => (
                                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800">{t.nombre}</span>
                                                {t.enInventario && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Check size={10}/> Inventario</span>}
                                            </div>
                                            <button onClick={()=>{setTempMed({nombre:t.nombre, dosis:t.dosis}); setShowPlanModal(false);}} className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all">Usar</button>
                                        </div>
                                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">{t.dosis}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {planIA.indicaciones && (
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Notas e Indicaciones</h4>
                                <button onClick={()=>{updateCampo('consulta.diagnostico.indicaciones', planIA.indicaciones); showNotification("Notas copiadas");}} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-2"><Zap size={14}/> Copiar al expediente</button>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-600 italic">
                                {planIA.indicaciones}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SeccionConsulta;