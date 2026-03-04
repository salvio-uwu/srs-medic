import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, Loader2, Thermometer, Droplet, 
  Sparkles, Package, CheckSquare, Building, AlertCircle,
  ScanText, Search, CheckCircle2, Activity, MapPin
} from 'lucide-react';
import { db, functions } from '../config/firebase'; 
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

let cacheMedicamentos = null;

const TAREAS_POR_AREA = {
  "Consultorios": ["Estación de lavado (Limpieza y surtido)", "Limpieza de consultorio general", "Piso barrido y trapeado", "Recolección de basura"],
  "Sanitarios": ["Sanitario y estación de lavado", "Surtido de insumos", "Piso barrido y trapeado", "Recolección de basura"],
  "Salas y Recepción": ["Lavado de manos (Limpieza y surtido)", "Sala de espera, puertas y ventanas", "Piso barrido y trapeado", "Recolección de basura"],
  "Observación": ["Lavado de manos (Limpieza y surtido)", "Limpieza de carro rojo, camas, trípie", "Piso barrido y trapeado", "Recolección de basura"],
  "Aplicaciones": ["Limpieza Silla, repisa, mesa", "Limpieza de cajón de pinzas, paredes", "Piso barrido y trapeado", "Recolección de basura"],
  "Tomas de muestra": ["Limpieza Silla, cajón de insumos", "Limpieza centrifugadora, estantes", "Piso barrido y trapeado", "Recolección de basura"],
  "Rayos X": ["Limpieza y acomodo de mobiliario", "Limpieza de cuarto de control", "Piso barrido y trapeado", "Recolección de basura"]
};

const IconCross = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M12 2v20M2 12h20"/>
  </svg>
);

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top duration-300 backdrop-blur-md ${
    type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700' : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
  }`}>
    {type === 'error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
    <span className="font-bold text-sm">{msg}</span>
    <button onClick={onClose} className="ml-4 p-1 hover:bg-black/5 rounded-full transition-colors"><X size={16}/></button>
  </div>
);

const RegistrosEnfermeriaModal = ({ onClose, enfermeraNombre, sucursal = 'Central' }) => {
  const [loading, setLoading] = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState('farmacia'); // Por defecto Farmacia para agilizar
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const [progresoHoy, setProgresoHoy] = useState({
    temp_8: false, temp_16: false, temp_22: false,
    cloro_1: false, limpieza: 0
  });

  const getTurnoActual = () => {
    const hora = new Date().getHours();
    if (hora >= 14 && hora < 20) return '4:00 p.m.';
    if (hora >= 20 || hora < 6) return '10:00 p.m.';
    return '8:00 a.m.';
  };

  const [formTemp, setFormTemp] = useState({ turno: getTurnoActual(), t_ext: '', humedad: '', t_ref: '' });
  const [formCloro, setFormCloro] = useState({ ph_1: '', cloro_1: '', ph_2: '', cloro_2: '' });
  const [formLimpieza, setFormLimpieza] = useState({ area: 'Consultorios', tareas: { col1: false, col2: false, col3: false, col4: false } });
  
  const formFarmaciaInicial = {
    tipo_movimiento: 'Recepción', factura: '', compuesto: '', presentacion: '', forma: '', 
    lote: '', caducidad: '', cantidad: '', observaciones: '', criterio_empaque: true, criterio_etiqueta: true
  };
  const [formFarmacia, setFormFarmacia] = useState(formFarmaciaInicial);

  const [sugerenciasMeds, setSugerenciasMeds] = useState([]);
  const [mostrarMeds, setMostrarMeds] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    const initData = async () => {
      if (!cacheMedicamentos) {
        try {
          const res = await fetch('/data/medicamentos.json');
          if (res.ok) cacheMedicamentos = await res.json();
        } catch (e) { console.error("Error cargando medicamentos JSON", e); }
      }
    };
    initData();
  }, []);

  useEffect(() => {
    const hoyStr = new Date().toLocaleDateString('en-CA');
    const q = query(collection(db, "bitacoras_operativas"), where("fechaString", "==", hoyStr), where("sucursal", "==", sucursal));
    
    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(d => d.data());
      setProgresoHoy({
        temp_8: logs.some(l => l.tipo === 'Temperatura' && l.turno === '8:00 a.m.'),
        temp_16: logs.some(l => l.tipo === 'Temperatura' && l.turno === '4:00 p.m.'),
        temp_22: logs.some(l => l.tipo === 'Temperatura' && l.turno === '10:00 p.m.'),
        cloro_1: logs.some(l => l.tipo === 'Cloro y PH'),
        limpieza: new Set(logs.filter(l => l.tipo === 'Limpieza').map(l => l.area)).size
      });
    });
    return () => unsub();
  }, [sucursal]);

  const procesarFacturaIA = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIaLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const prompt = `Extrae los datos de esta factura o ticket de medicamentos. 
        Devuelve estrictamente un JSON válido con esta estructura, sin formato Markdown ni texto extra:
        {"factura": "numero", "compuesto": "sustancia o nombre comercial", "lote": "numero", "cantidad": "numero", "caducidad": "YYYY-MM-DD"}`;

        const askGemini = httpsCallable(functions, 'askGemini');
        const result = await askGemini({ prompt: [prompt, { inlineData: { data: base64Data, mimeType: file.type } }] });

        let rawText = result.data.result.replace(/```json/g, "").replace(/```/g, "").trim();
        const info = JSON.parse(rawText);

        setFormFarmacia(prev => ({
          ...prev, 
          factura: info.factura || prev.factura, 
          compuesto: info.compuesto || prev.compuesto,
          lote: info.lote || prev.lote, 
          cantidad: info.cantidad || prev.cantidad, 
          caducidad: info.caducidad || prev.caducidad
        }));
        showToast("Datos extraídos correctamente", "success");
        setIaLoading(false);
      };
    } catch (err) {
      setIaLoading(false);
      showToast("Fallo en el análisis de la imagen. Ingrese datos manualmente.", "error");
    }
  };

  const handleBuscadorMedicamentos = (e) => {
    const val = e.target.value;
    setFormFarmacia({ ...formFarmacia, compuesto: val });
    if (val.length > 2 && cacheMedicamentos) {
        const results = cacheMedicamentos.filter(m => 
            (m["*NOMBRE COMERCIAL"] && m["*NOMBRE COMERCIAL"].toLowerCase().includes(val.toLowerCase())) || 
            (m["*SUSTANCIA(S) ACTIVA(S)"] && m["*SUSTANCIA(S) ACTIVA(S)"].toLowerCase().includes(val.toLowerCase()))
        ).slice(0, 15);
        setSugerenciasMeds(results);
        setMostrarMeds(true);
    } else {
        setMostrarMeds(false);
    }
  };

  const seleccionarMedicamento = (med) => {
      let formaInferida = 'Otra';
      const pres = (med["*PRESENTACIÓN"] || '').toUpperCase();
      const sust = (med["*SUSTANCIA(S) ACTIVA(S)"] || '').toUpperCase();
      
      // Motor de inferencia de formas farmacéuticas
      if (pres.includes('TAB') || sust.includes('TAB')) formaInferida = 'Tableta';
      else if (pres.includes('CAP') || sust.includes('CAP')) formaInferida = 'Cápsula';
      else if (pres.includes('CREM') || sust.includes('CREM')) formaInferida = 'Crema';
      else if (pres.includes('SUSP') || sust.includes('SUSP')) formaInferida = 'Suspensión';
      else if (pres.includes('JARABE') || sust.includes('JARABE')) formaInferida = 'Jarabe';
      else if (pres.includes('AMP') || sust.includes('AMP')) formaInferida = 'Ampolleta';
      else if (pres.includes('OVU') || sust.includes('OVU')) formaInferida = 'Óvulo';
      else if (pres.includes('SOL') || sust.includes('SOL')) formaInferida = 'Solución';
      else if (pres.includes('GEL') || sust.includes('GEL')) formaInferida = 'Gel';
      else if (pres.includes('GOTAS') || sust.includes('GOTAS')) formaInferida = 'Gotas';
      else if (pres.includes('POMADA') || sust.includes('POMADA')) formaInferida = 'Pomada';

      const nombreComercial = med["*NOMBRE COMERCIAL"] || '';
      const sustanciaActiva = med["*SUSTANCIA(S) ACTIVA(S)"] ? `(${med["*SUSTANCIA(S) ACTIVA(S)"]})` : '';

      setFormFarmacia({
          ...formFarmacia,
          compuesto: `${nombreComercial} ${sustanciaActiva}`.trim(),
          presentacion: med["*PRESENTACIÓN"] || '',
          forma: formaInferida
      });
      setMostrarMeds(false);
  };

  const handleGuardar = async () => {
    setLoading(true);
    try {
      let datosGuardar = {
        fecha: serverTimestamp(), 
        fechaString: new Date().toLocaleDateString('en-CA'),
        responsableNombre: enfermeraNombre, 
        sucursal: sucursal, 
        estado: 'completado'
      };

      if (tipoRegistro === 'temperatura') {
        if (!formTemp.t_ext || !formTemp.t_ref || !formTemp.humedad) { 
            setLoading(false); return showToast("Faltan datos de temperatura o humedad.", "error"); 
        }
        datosGuardar = { ...datosGuardar, tipo: 'Temperatura', area: 'Red de Frío', turno: formTemp.turno, detalles: formTemp };
      } 
      else if (tipoRegistro === 'cloro') {
        if (!formCloro.ph_1 || !formCloro.cloro_1) { 
            setLoading(false); return showToast("Faltan datos en Lavado de Manos 1.", "error"); 
        }
        datosGuardar = { ...datosGuardar, tipo: 'Cloro y PH', area: 'Estaciones de Lavado', detalles: formCloro };
      } 
      else if (tipoRegistro === 'limpieza') {
        const tareasSeleccionadas = Object.values(formLimpieza.tareas).some(v => v === true);
        if (!tareasSeleccionadas) {
            setLoading(false); return showToast("Marque al menos una tarea realizada.", "error");
        }
        datosGuardar = { ...datosGuardar, tipo: 'Limpieza', area: formLimpieza.area, detalles: formLimpieza.tareas };
      } 
      else if (tipoRegistro === 'farmacia') {
        // Validación estricta para inventario (evita recuadros blancos en dashboard)
        if (!formFarmacia.compuesto || !formFarmacia.cantidad || !formFarmacia.caducidad || !formFarmacia.lote) { 
            setLoading(false); return showToast("Llene Compuesto, Cantidad, Lote y Caducidad obligatoriamente.", "error"); 
        }
        datosGuardar = { ...datosGuardar, tipo: 'Farmacia', area: formFarmacia.tipo_movimiento, detalles: formFarmacia };
      }

      await addDoc(collection(db, "bitacoras_operativas"), datosGuardar);
      
      showToast("Registro guardado exitosamente.", "success");
      
      // Limpiar formulario específico para seguir capturando
      if(tipoRegistro === 'farmacia') setFormFarmacia(formFarmaciaInicial);
      if(tipoRegistro === 'temperatura') setFormTemp({...formTemp, t_ext:'', humedad:'', t_ref:''});
      if(tipoRegistro === 'cloro') setFormCloro({ph_1:'', cloro_1:'', ph_2:'', cloro_2:''});
      if(tipoRegistro === 'limpieza') setFormLimpieza({...formLimpieza, tareas:{col1:false, col2:false, col3:false, col4:false}});

    } catch (error) {
      showToast("Error de conexión al guardar el registro.", "error");
    }
    setLoading(false);
  };

  const inputStyle = "w-full p-3.5 bg-white border border-slate-300 shadow-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400";
  const labelStyle = "text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 ml-1 block";

  return (
    <>
      <style>{`
        .glass-panel { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        .font-jakarta { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .cross-float { animation: float 6s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0 z-[500] bg-[#f0f4f8] flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-300 text-slate-800 font-sans">
        
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse 70% 60% at 15% 0%, rgba(219,234,254,0.6) 0%, transparent 55%), radial-gradient(ellipse 55% 50% at 90% 100%, rgba(204,251,241,0.4) 0%, transparent 50%)' }}/>
        <div className="cross-float hidden md:block" style={{ position: 'absolute', top: '8%', left: '5%', color: 'rgba(37,99,235,0.1)', pointerEvents: 'none', zIndex: 0 }}><IconCross /></div>

        {toast.show && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({...toast, show: false})} />}

        {/* --- MENU MOBILE HORIZONTAL --- */}
        <div className="md:hidden flex overflow-x-auto gap-2 p-4 bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-20 shadow-sm">
             <MenuMobileBtn id="farmacia" icon={<Package size={18}/>} label="Insumos" active={tipoRegistro} onClick={setTipoRegistro} />
             <MenuMobileBtn id="temperatura" icon={<Thermometer size={18}/>} label="Temp." active={tipoRegistro} onClick={setTipoRegistro} />
             <MenuMobileBtn id="cloro" icon={<Droplet size={18}/>} label="Cloro/PH" active={tipoRegistro} onClick={setTipoRegistro} />
             <MenuMobileBtn id="limpieza" icon={<Sparkles size={18}/>} label="Limpieza" active={tipoRegistro} onClick={setTipoRegistro} />
        </div>

        {/* --- SIDEBAR IZQUIERDO DESKTOP --- */}
        <aside className="hidden md:flex w-80 flex-col z-10 p-6 pr-3">
            <div className="glass-panel rounded-3xl h-full flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-200/50 bg-white/50">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/30 mb-4">
                        <CheckSquare size={24} />
                    </div>
                    <h2 className="text-xl font-black font-jakarta leading-tight text-slate-800">Registros y Bitácoras</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                        <MapPin size={10}/> Suc. {sucursal}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-white/30">
                   <div>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-3">COFEPRIS e Inventario</p>
                       <MenuButton id="farmacia" icon={<Package size={18}/>} label="Control de Insumos" active={tipoRegistro} onClick={setTipoRegistro} />
                   </div>
                   <div>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-3">Auditorías Operativas</p>
                       <div className="space-y-2">
                           <MenuButton id="temperatura" icon={<Thermometer size={18}/>} label="Temperaturas" active={tipoRegistro} onClick={setTipoRegistro} />
                           <MenuButton id="cloro" icon={<Droplet size={18}/>} label="Cloro y PH" active={tipoRegistro} onClick={setTipoRegistro} />
                           <MenuButton id="limpieza" icon={<Sparkles size={18}/>} label="Limpieza de Áreas" active={tipoRegistro} onClick={setTipoRegistro} />
                       </div>
                   </div>
                </div>

                <div className="p-5 bg-white/70 border-t border-slate-200/50">
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={12}/> Progreso del Turno</p>
                   <div className="space-y-2 text-xs font-bold text-slate-600">
                       <StatusRow label="Temp. 8:00 AM" done={progresoHoy.temp_8} />
                       <StatusRow label="Temp. 4:00 PM" done={progresoHoy.temp_16} />
                       <StatusRow label="Temp. 10:00 PM" done={progresoHoy.temp_22} />
                       <StatusRow label="Cloro y PH" done={progresoHoy.cloro_1} />
                       <StatusRow label={`Limpieza (${progresoHoy.limpieza}/7)`} done={progresoHoy.limpieza >= 7} />
                   </div>
               </div>
            </div>
        </aside>

        {/* --- PANEL PRINCIPAL DERECHO --- */}
        <main className="flex-1 p-4 md:p-6 md:pl-3 z-10 flex flex-col h-full overflow-hidden">
            <header className="glass-panel rounded-2xl md:rounded-3xl h-16 md:h-20 mb-4 md:mb-6 px-4 md:px-8 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 md:p-2.5 bg-blue-100 text-blue-700 rounded-xl"><Activity size={18} /></div>
                    <span className="font-bold text-slate-800 text-sm md:text-base">Captura de Datos Requerida</span>
                </div>
                <button onClick={onClose} className="p-2 md:px-4 md:py-2.5 bg-white border border-slate-300 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    <X size={16}/> <span className="hidden md:inline">Cerrar Ventana</span>
                </button>
            </header>

           <div className="glass-panel flex-1 rounded-2xl md:rounded-3xl overflow-hidden flex flex-col relative bg-white/90">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 pb-28 md:pb-28">
                    
                    {/* VISTA TEMPERATURA */}
                    {tipoRegistro === 'temperatura' && (
                        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shadow-sm">
                                <span className="text-sm font-bold text-blue-900">Horario de Medición</span>
                                <div className="flex flex-wrap gap-2">
                                    {['8:00 a.m.', '4:00 p.m.', '10:00 p.m.'].map(t => (
                                        <button key={t} onClick={() => setFormTemp({...formTemp, turno: t})} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${formTemp.turno === t ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>{t}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div><label className={labelStyle}>T° Exterior</label><input type="number" step="0.1" placeholder="Ej. 24.5" className={inputStyle} value={formTemp.t_ext} onChange={e => setFormTemp({...formTemp, t_ext: e.target.value})}/></div>
                                <div><label className={labelStyle}>Humedad %</label><input type="number" placeholder="Ej. 45" className={inputStyle} value={formTemp.humedad} onChange={e => setFormTemp({...formTemp, humedad: e.target.value})}/></div>
                                <div><label className={labelStyle}>T° Refrigerador</label><input type="number" step="0.1" placeholder="Ej. 4.2" className={`${inputStyle} ring-2 ring-blue-500/20`} value={formTemp.t_ref} onChange={e => setFormTemp({...formTemp, t_ref: e.target.value})}/></div>
                            </div>
                            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-4">
                                <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5"/>
                                <p className="text-sm text-amber-800 font-medium leading-relaxed">La temperatura del refrigerador normativo debe mantenerse estrictamente entre <strong>2°C y 8°C</strong>. Reporte de inmediato cualquier desviación a jefatura.</p>
                            </div>
                        </div>
                    )}

                    {/* VISTA CLORO */}
                    {tipoRegistro === 'cloro' && (
                        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 space-y-6 md:space-y-10">
                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Droplet size={18} className="text-cyan-600"/> Lavado de Manos 1</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                    <div><label className={labelStyle}>Nivel de PH</label><input type="number" step="0.1" className={inputStyle} value={formCloro.ph_1} onChange={e => setFormCloro({...formCloro, ph_1: e.target.value})}/></div>
                                    <div><label className={labelStyle}>Cloro Residual</label><input type="number" step="0.1" className={inputStyle} value={formCloro.cloro_1} onChange={e => setFormCloro({...formCloro, cloro_1: e.target.value})}/></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Droplet size={18} className="text-cyan-600"/> Lavado de Manos 2</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                    <div><label className={labelStyle}>Nivel de PH</label><input type="number" step="0.1" className={inputStyle} value={formCloro.ph_2} onChange={e => setFormCloro({...formCloro, ph_2: e.target.value})}/></div>
                                    <div><label className={labelStyle}>Cloro Residual</label><input type="number" step="0.1" className={inputStyle} value={formCloro.cloro_2} onChange={e => setFormCloro({...formCloro, cloro_2: e.target.value})}/></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISTA LIMPIEZA */}
                    {tipoRegistro === 'limpieza' && (
                        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 space-y-6 md:space-y-8">
                            <div>
                                <label className={labelStyle}>Área Auditada</label>
                                <select className={`${inputStyle} appearance-none cursor-pointer`} value={formLimpieza.area} onChange={e => setFormLimpieza({ area: e.target.value, tareas: { col1: false, col2: false, col3: false, col4: false } })}>
                                    {Object.keys(TAREAS_POR_AREA).map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Lista de Verificación Específica</h4>
                                <div className="space-y-4">
                                    {TAREAS_POR_AREA[formLimpieza.area].map((tareaStr, index) => {
                                        const key = `col${index + 1}`;
                                        return (
                                            <label key={key} className="flex items-start md:items-center gap-4 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                                                <input type="checkbox" className="w-5 h-5 mt-0.5 md:mt-0 accent-blue-600 rounded border-slate-400 shrink-0" checked={formLimpieza.tareas[key]} onChange={e => setFormLimpieza({ ...formLimpieza, tareas: { ...formLimpieza.tareas, [key]: e.target.checked } })} />
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 leading-tight">{tareaStr}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISTA FARMACIA (RECONSTRUIDA PARA MÁXIMA COMPATIBILIDAD) */}
                    {tipoRegistro === 'farmacia' && (
                        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 space-y-6 md:space-y-8 pb-4">
                            
                            <div className="flex overflow-x-auto gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm w-full md:w-fit custom-scrollbar">
                                {['Recepción', 'Entrada (Traspaso)', 'Salida (Traspaso)'].map(mov => (
                                    <button key={mov} onClick={() => setFormFarmacia({...formFarmacia, tipo_movimiento: mov})} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${formFarmacia.tipo_movimiento === mov ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>{mov}</button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Bloque de Extracción IA */}
                                <div className="lg:col-span-3 bg-indigo-50 border border-indigo-200 p-5 md:p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white p-3 rounded-xl shadow-sm text-indigo-600 border border-indigo-100 shrink-0"><Sparkles size={24}/></div>
                                        <div>
                                            <p className="text-sm md:text-base font-bold text-indigo-900 font-jakarta">Lectura Automática IA</p>
                                            <p className="text-xs text-indigo-700 mt-1">Sube una foto de la factura para rellenar los datos automáticamente.</p>
                                        </div>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={procesarFacturaIA}/>
                                    <button onClick={() => fileInputRef.current.click()} disabled={iaLoading} className="w-full md:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0">
                                        {iaLoading ? <Loader2 size={18} className="animate-spin"/> : <ScanText size={18}/>}
                                        {iaLoading ? 'Analizando...' : 'Escanear Documento'}
                                    </button>
                                </div>

                                {/* Bloque Buscador Auto-Fill */}
                                <div className="lg:col-span-3 relative z-20">
                                    <label className={labelStyle}>* Búsqueda Inteligente (Compuesto / Medicamento)</label>
                                    <div className="relative">
                                        <input className={`${inputStyle} pl-12 text-base font-bold`} placeholder="Buscar en catálogo general (Ej. Paracetamol)..." value={formFarmacia.compuesto} onChange={handleBuscadorMedicamentos} onBlur={() => setTimeout(() => setMostrarMeds(false), 200)} />
                                        <Search className="absolute left-4 top-4 text-slate-400" size={20}/>
                                    </div>
                                    {mostrarMeds && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl mt-2 max-h-56 overflow-y-auto z-50 p-2">
                                            {sugerenciasMeds.map((m, i) => (
                                                <div key={i} onMouseDown={() => seleccionarMedicamento(m)} className="p-3 hover:bg-slate-50 text-sm cursor-pointer border-b border-slate-100 last:border-0 rounded-xl transition-colors">
                                                    <p className="font-bold text-slate-800">{m["*NOMBRE COMERCIAL"]}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{m["*SUSTANCIA(S) ACTIVA(S)"]} • {m["*PRESENTACIÓN"]}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Bloque Identificadores y Tiempos */}
                                <div><label className={labelStyle}>Número de Factura</label><input className={inputStyle} value={formFarmacia.factura} onChange={e => setFormFarmacia({...formFarmacia, factura: e.target.value})}/></div>
                                <div><label className={labelStyle}>* Lote de Fabricación</label><input className={inputStyle} placeholder="Requerido" value={formFarmacia.lote} onChange={e => setFormFarmacia({...formFarmacia, lote: e.target.value})}/></div>
                                <div><label className={labelStyle}>* Fecha de Caducidad</label><input type="date" className={inputStyle} value={formFarmacia.caducidad} onChange={e => setFormFarmacia({...formFarmacia, caducidad: e.target.value})}/></div>

                                {/* Bloque Atributos del Medicamento */}
                                <div><label className={labelStyle}>Presentación</label><input className={inputStyle} placeholder="Ej. Caja con 10 Tabletas" value={formFarmacia.presentacion} onChange={e => setFormFarmacia({...formFarmacia, presentacion: e.target.value})}/></div>
                                <div><label className={labelStyle}>Forma Farmacéutica</label><input className={inputStyle} placeholder="Ej. Tableta, Suspensión..." value={formFarmacia.forma} onChange={e => setFormFarmacia({...formFarmacia, forma: e.target.value})}/></div>
                                <div><label className={labelStyle}>* Cantidad (Cajas/Pzas)</label><input type="number" className={`${inputStyle} font-black text-lg text-blue-700 bg-blue-50 focus:bg-white`} placeholder="0" value={formFarmacia.cantidad} onChange={e => setFormFarmacia({...formFarmacia, cantidad: e.target.value})}/></div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
                                {formFarmacia.tipo_movimiento === 'Recepción' && (
                                    <div className="bg-slate-50 p-5 md:p-6 rounded-3xl border border-slate-200 h-full">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-4 border-b border-slate-200 pb-2">Criterio de Aceptación (Física)</span>
                                        <div className="flex flex-col gap-4">
                                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white border border-slate-100 hover:border-indigo-200 rounded-xl transition-colors shadow-sm">
                                                <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded border-slate-400" checked={formFarmacia.criterio_empaque} onChange={e => setFormFarmacia({...formFarmacia, criterio_empaque: e.target.checked})} />
                                                <span className="text-sm font-bold text-slate-800">Empaque primario sin daños físicos</span>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white border border-slate-100 hover:border-indigo-200 rounded-xl transition-colors shadow-sm">
                                                <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded border-slate-400" checked={formFarmacia.criterio_etiqueta} onChange={e => setFormFarmacia({...formFarmacia, criterio_etiqueta: e.target.checked})} />
                                                <span className="text-sm font-bold text-slate-800">Etiqueta íntegra y legible</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                                <div className={formFarmacia.tipo_movimiento !== 'Recepción' ? 'lg:col-span-2' : ''}>
                                    <label className={labelStyle}>Notas / Observaciones de Mermas</label>
                                    <textarea className={`${inputStyle} h-full min-h-[140px] resize-none leading-relaxed`} placeholder="Detalle daños en empaque, humedad, inconsistencias con la factura..." value={formFarmacia.observaciones} onChange={e => setFormFarmacia({...formFarmacia, observaciones: e.target.value})}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

               {/* --- BOTÓN FLOTANTE (Optimización de Espacio) --- */}
                <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 w-[90%] md:w-auto z-50">
                    <button onClick={handleGuardar} disabled={loading} className="w-full md:w-auto bg-slate-900/95 backdrop-blur-md border border-slate-700 hover:bg-black text-white px-8 md:px-10 py-3.5 md:py-4 rounded-2xl md:rounded-full font-black text-sm font-jakarta shadow-2xl shadow-slate-900/40 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 tracking-widest uppercase">
                        {loading ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                        {loading ? 'Sincronizando...' : 'Guardar y Nuevo'}
                    </button>
                </div>
            </div>
        </main>
      </div>
    </>
  );
};

const MenuButton = ({ id, label, icon, active, onClick }) => (
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all ${active === id ? 'bg-white text-blue-700 shadow-md border border-slate-200' : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'}`}>
        <span className={active === id ? 'text-blue-600' : 'text-slate-400'}>{icon}</span> {label}
    </button>
);

const MenuMobileBtn = ({ id, label, icon, active, onClick }) => (
    <button onClick={() => onClick(id)} className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${active === id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
        {icon} {label}
    </button>
);

const StatusRow = ({ label, done }) => (
  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/70 border border-slate-200 shadow-sm mb-2">
      <span className={`text-xs font-bold ${done ? "text-emerald-700" : "text-slate-600"}`}>{label}</span>
      {done ? <CheckCircle2 size={16} className="text-emerald-500"/> : <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>}
  </div>
);

export default RegistrosEnfermeriaModal;