    // src/pages/doctor/expediente/SeccionConsulta.jsx
    import React, { useState, useEffect } from 'react';
    import { 
    FileText, Activity, ArrowLeft, Droplet, Eye, FlaskConical, 
    Search, Trash2, Scissors, Package, CheckCircle, Mic, 
    AlertTriangle, ChevronRight, Pill, X, Check, Info, Calculator, Zap
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
    
    // --- ESTADOS DE BUSCADORES Y MEDICAMENTOS ---
    const [sugerenciasCie10, setSugerenciasCie10] = useState([]);
    const [mostrarCie10, setMostrarCie10] = useState(false);
    const [sugerenciasMeds, setSugerenciasMeds] = useState([]);
    const [mostrarMeds, setMostrarMeds] = useState(false);
    const [dosisRecomendada, setDosisRecomendada] = useState(''); 
    
    // --- ESTADOS IA (SOLO ALERGIAS) & DICTADO ---
    const [analizandoRiesgo, setAnalizandoRiesgo] = useState(false);
    const [isListening, setIsListening] = useState(false);
    
    // --- ESTADOS CALCULADORA DE DOSIS ---
    const [showCalculadora, setShowCalculadora] = useState(false);
    const [calcDatos, setCalcDatos] = useState({
        peso: '', 
        dosisMgKg: '',
        concentracionMg: '',
        concentracionMl: ''
    });
    const [resultadoCalc, setResultadoCalc] = useState('');

    // --- ESTADOS UI (MODALES) ---
    const [showRiskModal, setShowRiskModal] = useState(false);
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

    useEffect(() => {
        if (expediente.consulta.exploracion.antropometria?.peso) {
            setCalcDatos(prev => ({ ...prev, peso: expediente.consulta.exploracion.antropometria.peso }));
        }
    }, [expediente.consulta.exploracion.antropometria?.peso]);

    useEffect(() => {
        if (toast.show) {
        const t = setTimeout(() => setToast({ ...toast, show: false }), 4000);
        return () => clearTimeout(t);
        }
    }, [toast.show]);

    const showNotification = (msg, type = 'success') => setToast({ show: true, message: msg, type });

    // ==========================================
    // FUNCIONES DE LÓGICA Y CÁLCULOS
    // ==========================================

    // --- LÓGICA DE COLORES PARA UTILIDAD DE MEDICAMENTOS ---
    // --- LÓGICA DE COLORES PARA UTILIDAD DE MEDICAMENTOS ---
    const getMarcaColor = (marcaStr) => {
        if (!marcaStr) return { borderLeft: 'border-transparent', bg: 'bg-slate-300' };
        
        const lastChar = marcaStr.toString().trim().slice(-1);
        
        switch(lastChar) {
            case '1': return { borderLeft: 'border-blue-500', bg: 'bg-blue-500' };
            case '2': return { borderLeft: 'border-emerald-500', bg: 'bg-emerald-500' };
            case '3': return { borderLeft: 'border-yellow-400', bg: 'bg-yellow-400' };
            case '4': return { borderLeft: 'border-orange-500', bg: 'bg-orange-500' };
            case '5': return { borderLeft: 'border-red-500', bg: 'bg-red-500' };
            default: return { borderLeft: 'border-slate-300', bg: 'bg-slate-300' }; 
        }
    };

    // --- LÓGICA DE COLORES PARA GLUCOSA ---
    const getGlucosaColor = (valor, categoria) => {
        const v = parseInt(valor);
        if (isNaN(v)) return 'bg-slate-100 text-slate-700';
        const isPostprandial = categoria.includes('2 horas');

        if (isPostprandial) {
        if (v < 140) return 'bg-emerald-400 text-white';
        if (v >= 140 && v <= 199) return 'bg-yellow-400 text-slate-800';
        return 'bg-red-500 text-white';
        } else {
        if (v < 100) return 'bg-emerald-400 text-white';
        if (v >= 100 && v <= 125) return 'bg-yellow-400 text-slate-800';
        return 'bg-red-500 text-white';
        }
    };

    const calcularDosisExacta = () => {
        const pesoEvaluar = calcDatos.peso || expediente.consulta.exploracion.antropometria?.peso;
        const { dosisMgKg, concentracionMg, concentracionMl } = calcDatos;
        
        if (!pesoEvaluar || !dosisMgKg) {
            showNotification("Ingresa peso y dosis (mg/kg)", "error");
            return;
        }

        const totalMg = parseFloat(pesoEvaluar) * parseFloat(dosisMgKg);
        let resultadoString = `${totalMg.toFixed(2)} mg`;

        if (concentracionMg && concentracionMl) {
            const totalMl = (totalMg * parseFloat(concentracionMl)) / parseFloat(concentracionMg);
            resultadoString += ` (Equivalente a ${totalMl.toFixed(2)} mL)`;
        }
        setResultadoCalc(resultadoString);
    };

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

        const promptText = `Eres experto en seguridad farmacológica. Paciente con alergias: "${contextoAlergias}". Medicamentos actuales: "${medicamentosActuales}". Se intenta agregar: "${medicamentoNuevo}". Detecta riesgos GRAVES de reacción alérgica o interacción fatal. Responde JSON: { "riesgo": true/false, "mensaje": "Explicación breve" }`;
        
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
        setTempMed({nombre:'', dosis:''}); 
        setDosisRecomendada(''); 
        setResultadoCalc(''); 
        setShowCalculadora(false); 
        setShowRiskModal(false); 
        showNotification("Medicamento agregado a la receta", "success");
    };

    const toggleDictado = () => {
        if (!('webkitSpeechRecognition' in window)) return alert("Navegador no soportado");
        if (isListening) { setIsListening(false); return; }
        const recognition = new window.webkitSpeechRecognition();
        recognition.lang = 'es-MX'; recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false);
        recognition.onresult = (e) => { const t = e.results[0][0].transcript; updateCampo('consulta.padecimiento', (expediente.consulta.padecimiento || '') + " " + t); };
        recognition.start();
    };

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

        <div className="mt-8 flex items-center justify-end shrink-0 pt-6 border-t border-slate-100">
            <button onClick={() => setActiveConsulta('exploracion')} className={`px-8 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95 ${buttonPrimary}`}>
            Siguiente <ArrowLeft size={18} className="rotate-180"/>
            </button>
        </div>
        </div>
    );

    const renderExploracion = () => (
        <div className="flex h-full w-full gap-6 animate-in fade-in">
            <div className="w-64 flex flex-col gap-3 shrink-0 bg-white p-4 rounded-3xl border border-slate-200 h-full overflow-y-auto shadow-sm">
                {[{id:'signos', l:'Signos Vitales', i:<Activity size={18}/>}, {id:'colesterol', l:'Bioquímica', i:<Droplet size={18}/>}, {id:'fisica', l:'Exploración Física', i:<Eye size={18}/>}, {id:'glucosa', l:'Glucometría', i:<FlaskConical size={18}/>}].map(it => (
                    <button key={it.id} onClick={()=>setActiveExploracion(it.id)} className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold transition-all ${activeExploracion===it.id ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <span className={activeExploracion===it.id?'text-indigo-500':''}>{it.i}</span> {it.l}
                    </button>
                ))}
                
                <div className="flex-1"></div>

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
                        <div className="flex flex-col gap-8 animate-in fade-in max-w-lg">
                            <div>
                                <h4 className="text-lg font-bold text-teal-500 mb-4 border-b border-slate-100 pb-2">
                                    Colesterol y triglicéridos
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold text-slate-800 w-32">Triglicéridos:</label>
                                        <input 
                                            className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all shadow-sm font-medium text-slate-700" 
                                            type="number" 
                                            value={expediente.consulta.exploracion.colesterol.trigliceridos || ''} 
                                            onChange={e=>updateCampo('consulta.exploracion.colesterol.trigliceridos', e.target.value)}
                                        />
                                        <span className="text-sm font-bold text-slate-800 w-12">mg/dl</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold text-slate-800 w-32">Colesterol:</label>
                                        <input 
                                            className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all shadow-sm font-medium text-slate-700" 
                                            type="number" 
                                            value={expediente.consulta.exploracion.colesterol.colesterol || ''} 
                                            onChange={e=>updateCampo('consulta.exploracion.colesterol.colesterol', e.target.value)}
                                        />
                                        <span className="text-sm font-bold text-slate-800 w-12">mg/dl</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-teal-500 mb-4 border-b border-slate-100 pb-2">
                                    Hemoglobina
                                </h4>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-bold text-slate-800 w-32">A1C:</label>
                                    <input 
                                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all shadow-sm font-medium text-slate-700" 
                                        type="number" 
                                        step="0.1" 
                                        value={expediente.consulta.exploracion.colesterol.hba1c || ''} 
                                        onChange={e=>updateCampo('consulta.exploracion.colesterol.hba1c', e.target.value)}
                                    />
                                    <span className="text-sm font-bold text-slate-800 w-12">%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeExploracion === 'fisica' && (
                        <div className="flex flex-col gap-2">
                            <p className="text-[11px] font-bold text-slate-400 mb-2">No es obligatorio llenar todos los campos.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { label: 'Habitus exterior', key: 'habitus' },
                                    { label: 'Cabeza/Ojos/Garganta/Oidos/Nariz.', key: 'cabeza' },
                                    { label: 'Cuello', key: 'cuello' },
                                    { label: 'Tórax', key: 'torax' },
                                    { label: 'Genitales ext.rectal y/o Vaginal', key: 'genitales' },
                                    { label: 'Extremidades', key: 'extremidades' },
                                    { label: 'Columna vertebral', key: 'columna' },
                                    { label: 'Abdomen', key: 'abdomen' }
                                ].map(area => (
                                    <div key={area.key}>
                                        <label className={labelStyle}>{area.label}</label>
                                        <textarea 
                                            className={`${inputStyle} h-28 resize-none`} 
                                            value={expediente.consulta.exploracion.fisica[area.key] || ''} 
                                            onChange={e => updateCampo(`consulta.exploracion.fisica.${area.key}`, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeExploracion === 'glucosa' && (
                        <div className="flex flex-col gap-4 animate-in fade-in">
                            <h4 className="text-sm font-black text-teal-600 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FlaskConical size={18} /> Niveles de glucosa
                            </h4>

                            <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div>
                                    <label className={labelStyle}>Fecha:</label>
                                    <input 
                                        type="date" 
                                        className={`${inputStyle} py-2.5`} 
                                        value={tempGlucosa.fecha || new Date().toISOString().split('T')[0]} 
                                        onChange={e => setTempGlucosa({...tempGlucosa, fecha: e.target.value})}
                                    />
                                </div>
                                <div className="flex-1 min-w-[220px]">
                                    <label className={labelStyle}>Categoría:</label>
                                    <select 
                                        className={`${inputStyle} py-2.5`} 
                                        value={tempGlucosa.categoria} 
                                        onChange={e=>setTempGlucosa({...tempGlucosa, categoria: e.target.value})}
                                    >
                                        {[
                                        'Antes del desayuno',
                                        '2 horas después del desayuno',
                                        'Antes de la comida',
                                        '2 horas después de la comida',
                                        'Antes de la cena',
                                        '2 horas después de la cena'
                                        ].map(o=><option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className={labelStyle}>Glucosa:</label>
                                    <input 
                                        type="number" 
                                        className={`${inputStyle} py-2.5`} 
                                        value={tempGlucosa.valor} 
                                        onChange={e=>setTempGlucosa({...tempGlucosa, valor: e.target.value})}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setTempGlucosa({ fecha: new Date().toISOString().split('T')[0], categoria: 'Antes del desayuno', valor: '' })} 
                                        className="bg-teal-400 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm"
                                    >
                                        Limpiar
                                    </button>
                                    <button 
                                        onClick={()=>{
                                            if(tempGlucosa.valor){
                                                const fechaAGuardar = tempGlucosa.fecha || new Date().toISOString().split('T')[0];
                                                updateCampo('consulta.exploracion.glucosa.lista', [...expediente.consulta.exploracion.glucosa.lista, { ...tempGlucosa, fecha: fechaAGuardar }]);
                                                setTempGlucosa({...tempGlucosa, valor:''});
                                            }
                                        }} 
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors text-sm"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col mt-2">
                                <div className="grid grid-cols-[120px_1fr_100px_50px] bg-blue-50/60 py-3 px-6 text-left text-[11px] font-black text-blue-800 tracking-wide border-b border-slate-200 shrink-0">
                                    <span>Fecha</span>
                                    <span>Categoría</span>
                                    <span className="text-center">Glucosa</span>
                                    <span></span>
                                </div>
                                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar">
                                    {expediente.consulta.exploracion.glucosa.lista.map((g, i) => (
                                        <div key={i} className="grid grid-cols-[120px_1fr_100px_50px] py-3 px-6 border-b border-slate-50 items-center hover:bg-slate-50 transition-colors">
                                            <span className="text-sm font-medium text-slate-600">
                                                {g.fecha.split('-').reverse().join('/')}
                                            </span>
                                            <span className="text-sm font-bold text-slate-700">{g.categoria}</span>
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1 rounded-lg font-bold text-sm shadow-sm ${getGlucosaColor(g.valor, g.categoria)}`}>
                                                    {g.valor}
                                                </span>
                                            </div>
                                            <div className="flex justify-end">
                                                <button onClick={()=>updateCampo('consulta.exploracion.glucosa.lista', expediente.consulta.exploracion.glucosa.lista.filter((_,x)=>x!==i))} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {expediente.consulta.exploracion.glucosa.lista.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 text-sm italic">No hay registros de glucosa agregados.</div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-2 flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="text-sm font-bold text-blue-900">Referencia de colores</span>
                                <div className="flex flex-wrap items-center gap-6">
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-600"><div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm"></div> Sin diabetes</span>
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-600"><div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-sm"></div> Pre-diabetes</span>
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-600"><div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-sm"></div> Diabetes</span>
                                </div>
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
        
        {/* --- COLUMNA IZQUIERDA: DIAGNÓSTICO Y AGREGAR RECETA --- */}
        <div className="w-1/2 flex flex-col gap-6 h-full">
            <div className={`${glassCard} flex-1 flex flex-col`}>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    
                    {/* BUSCADOR CIE-10 */}
                    <div className="relative z-30">
                        <label className={labelStyle}>Diagnóstico Final (CIE-10)</label>
                        <div className="relative">
                            <input className={inputStyle} placeholder="Buscar patología..." value={expediente.consulta.diagnostico.enfermedad_actual}
                            onChange={(e)=>{const t=e.target.value; updateCampo('consulta.diagnostico.enfermedad_actual',t); if(t.length>2 && cacheCie10){setSugerenciasCie10(cacheCie10.filter(i=>i.description.toLowerCase().includes(t.toLowerCase())).slice(0,20));setMostrarCie10(true)}else{setMostrarCie10(false)}}} onBlur={()=>setTimeout(()=>setMostrarCie10(false),200)}/>
                            <Search className="absolute right-4 top-4 text-slate-400" size={18}/>
                            {mostrarCie10 && <div className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1 z-50">{sugerenciasCie10.map((s,i)=><div key={i} onClick={()=>{updateCampo('consulta.diagnostico.enfermedad_actual',`${s.code} - ${s.description}`);setMostrarCie10(false)}} className="p-2 hover:bg-blue-50 rounded-lg text-xs cursor-pointer truncate border-b border-slate-50 last:border-0 text-slate-600">{s.code} - {s.description}</div>)}</div>}
                        </div>
                    </div>

                    {/* BLOQUE NUEVA RECETA */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col gap-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex gap-2"><Zap size={16} className="text-indigo-500"/> Nueva Receta</h4>
                        
                        {/* Buscador de Medicamento con Colores */}
                        <div className="relative z-20">
                            <input className={inputStyle} placeholder="Nombre del medicamento..." value={tempMed.nombre} 
                            onChange={e=>{
                                const v=e.target.value; 
                                setTempMed({...tempMed, nombre:v}); 
                                setDosisRecomendada(''); // Limpiar si escribe manual
                                if(v.length>2 && cacheMeds){
                                    setSugerenciasMeds(cacheMeds.filter(m=>m["*NOMBRE COMERCIAL"].toLowerCase().includes(v.toLowerCase())).slice(0,20));
                                    setMostrarMeds(true);
                                } else {
                                    setMostrarMeds(false);
                                }
                            }} 
                            onBlur={()=>setTimeout(()=>setMostrarMeds(false),200)}/>
                            
                            {mostrarMeds && (
                                <div className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1 z-50">
                                    {sugerenciasMeds.map((m,i)=>{
                                        const utilidad = getMarcaColor(m["*MARCA"]);
                                        return (
                                        <div key={i} 
                                        onClick={()=>{
                                            setTempMed({nombre: m["*NOMBRE COMERCIAL"], dosis: ''});
                                            setDosisRecomendada(m["DOSIS"] || 'No hay dosis recomendada en el catálogo.');
                                            setMostrarMeds(false);
                                        }} 
                                        className={`p-3 hover:bg-slate-50 text-xs cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex justify-between items-center border-l-4 ${utilidad.borderLeft}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{m["*NOMBRE COMERCIAL"]}</span> 
                                                <span className="text-[10px] text-slate-400 font-normal">{m["*SUSTANCIA(S) ACTIVA(S)"]}</span>
                                            </div>
                                            {/* Círculo indicador de color en lugar del texto */}
                                            <div className={`w-3 h-3 rounded-full shadow-sm shrink-0 ml-2 ${utilidad.bg}`} title="Clasificación"></div>
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                        
                        {/* RECUADROS ESTÁTICOS DE INFO */}
                        {tempMed.nombre && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="p-4 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 text-sm shadow-sm flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500"><Pill size={16} /></div>
                                    {tempMed.nombre}
                                </div>
                                
                                {dosisRecomendada && (
                                    <div className="p-4 border border-indigo-100 bg-indigo-50/50 rounded-xl text-sm text-indigo-900 flex gap-3 items-start shadow-sm">
                                        <Info size={18} className="shrink-0 mt-0.5 text-indigo-500" />
                                        <p className="font-medium leading-relaxed">{dosisRecomendada}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* ÁREA DE CALCULADORA E INDICACIONES MANUALES */}
                        <div className="flex flex-col gap-3 relative mt-2 border-t border-slate-200 pt-5">
                            
                            <div className="flex justify-between items-center mb-1">
                                <label className={labelStyle}>Dosis a recetar</label>
                                <button onClick={() => setShowCalculadora(!showCalculadora)} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 border border-indigo-100">
                                    <Calculator size={14} /> Calculadora de Dosis
                                </button>
                            </div>

                            {/* TARJETA CALCULADORA */}
                            {showCalculadora && (
                                <div className="p-5 bg-white border border-slate-200 shadow-md rounded-2xl mb-2 animate-in slide-in-from-top-2 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelStyle}>Peso (kg)</label>
                                            <input 
                                                type="number" 
                                                className={inputStyle} 
                                                value={calcDatos.peso || expediente.consulta.exploracion.antropometria?.peso || ''} 
                                                onChange={e => setCalcDatos({...calcDatos, peso: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Dosis (mg/kg)</label>
                                            <input type="number" className={inputStyle} value={calcDatos.dosisMgKg} onChange={e => setCalcDatos({...calcDatos, dosisMgKg: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Concentración (mg)</label>
                                            <input type="number" placeholder="Ej. 250" className={inputStyle} value={calcDatos.concentracionMg} onChange={e => setCalcDatos({...calcDatos, concentracionMg: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Volumen (mL)</label>
                                            <input type="number" placeholder="Ej. 5" className={inputStyle} value={calcDatos.concentracionMl} onChange={e => setCalcDatos({...calcDatos, concentracionMl: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 pt-2">
                                        <button onClick={calcularDosisExacta} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all">
                                            Calcular
                                        </button>
                                        {resultadoCalc && (
                                            <div className="flex-1 flex items-center justify-between bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 animate-in fade-in">
                                                <span className="font-bold text-indigo-700 text-sm">{resultadoCalc}</span>
                                                <button onClick={() => { setTempMed({...tempMed, dosis: resultadoCalc}); setShowCalculadora(false); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline">
                                                    Usar resultado
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <textarea 
                                className={`${inputStyle} resize-none h-28`} 
                                placeholder="Escribe la dosis final e indicaciones..." 
                                value={tempMed.dosis} 
                                onChange={e => setTempMed({...tempMed, dosis: e.target.value})}
                            />
                        </div>

                        <button onClick={handleAgregarMedicamento} disabled={analizandoRiesgo} className={`mt-4 w-full py-4 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${analizandoRiesgo ? 'bg-slate-800 text-slate-400 cursor-wait' : 'bg-slate-900 text-white hover:bg-black'}`}>
                            {analizandoRiesgo ? <><Activity className="animate-spin" size={16}/> Verificando alergias...</> : "Agregar a Receta"}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* --- COLUMNA DERECHA: RECETA LISTA --- */}
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

        {/* --- MODAL DE RIESGO DE ALERGIA --- */}
        {showRiskModal && (
            <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 border-b border-orange-100 flex items-start gap-4">
                <div className="bg-white p-3 rounded-full shadow-md text-orange-500"><AlertTriangle size={28}/></div>
                <div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Alerta de Alergia</h3><p className="text-xs font-bold text-orange-600 mt-1 uppercase tracking-wider">Validación de Seguridad</p></div>
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

        </div>
    );
    };

    export default SeccionConsulta;