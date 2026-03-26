import React, { useState, useEffect } from 'react';
import { 
  Clock, Printer, Search, Trash2, User, Calculator, 
  AlertTriangle, Stethoscope, Calendar, FileText, 
  Play, Square, CheckCircle
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, addDoc, doc, runTransaction, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const generateFolio = async (database) => {
  const counterRef = doc(database, 'contadores', 'folios_recetas');
  try {
    const siguiente = await runTransaction(database, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? (snap.data().siguiente || 1) : 1;
      tx.set(counterRef, { siguiente: current + 1 }, { merge: true });
      return current;
    });
    return `RX-${String(siguiente).padStart(7, '0')}`;
  } catch (e) {
    console.error('Error generando folio:', e);
    return `RX-${String(Date.now()).slice(-7)}`;
  }
};

const Consultorio = () => {
  const { user, cambiarEstadoOperativo } = useAuth(); // <--- CONEXIÓN CON LA TORRE DE CONTROL

  // --- ESTADOS ---
  const [folio, setFolio] = useState('');
  const [paciente, setPaciente] = useState({ nombre: '', edad: '', peso: '', temp: '', alergias: '' });
  const [diagnostico, setDiagnostico] = useState('');
  const [tratamiento, setTratamiento] = useState([]);
  
  // Buscador
  const [busquedaMed, setBusquedaMed] = useState('');
  const [inventarioMock] = useState([
    { id: 1, nombre: 'Paracetamol 500mg', stock: 50, tipo: 'Tableta' },
    { id: 2, nombre: 'Amoxicilina Susp. 250mg', stock: 12, tipo: 'Suspensión' },
    { id: 3, nombre: 'Loratadina 10mg', stock: 0, tipo: 'Tableta' },
    { id: 4, nombre: 'Ibuprofeno 400mg', stock: 30, tipo: 'Tableta' },
  ]);

  // Cronómetro y Estado
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutos por defecto
  const [timerActive, setTimerActive] = useState(false);
  const [consultaTerminada, setConsultaTerminada] = useState(false);

  // --- EFECTO: GENERAR FOLIO ---
  useEffect(() => {
    generateFolio(db).then(setFolio);
  }, []);

  // --- EFECTO: CRONÓMETRO ---
  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // --- FUNCIONES DE LA TORRE DE CONTROL ---
  const iniciarConsulta = () => {
    setTimerActive(true);
    // AVISAR A ENFERMERÍA: "ESTOY OCUPADO"
    cambiarEstadoOperativo('ocupado', {
        inicioConsulta: new Date().toISOString(),
        duracionEstimada: 15, // Minutos
        pacienteActual: paciente.nombre || 'Paciente en curso'
    });
  };

  const detenerConsulta = () => {
    setTimerActive(false);
    // AVISAR A ENFERMERÍA: "ESTOY DISPONIBLE (PAUSA)"
    cambiarEstadoOperativo('disponible');
  };

  const finalizarYGuardar = async () => {
    if (!paciente.nombre || !diagnostico) return alert("Falta Nombre o Diagnóstico.");
    
    // AVISAR A ENFERMERÍA: "YA ME DESOCUPÉ"
    cambiarEstadoOperativo('disponible');
    setTimerActive(false);
    
    try {
      await addDoc(collection(db, "consultas"), {
        doctorId: user?.uid || "uid_temporal",
        doctorNombre: user?.nombre || "Dr. Desconocido",
        sucursal: user?.sucursal || "Central",
        paciente: { ...paciente },
        diagnostico,
        receta: tratamiento,
        fecha: new Date().toISOString(),
        fechaBusqueda: new Date().toLocaleDateString('en-CA')
      });

      setConsultaTerminada(true);
      setTimeout(() => window.print(), 500);

    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar la consulta.");
    }
  };

  const calcularDosis = () => {
    if (!paciente.peso) return alert("Ingrese el peso primero.");
    const dosis = (paciente.peso * 10) / 1; 
    alert(`Dosis Sugerida: ${dosis}mg`);
  };

  const agregarMedicamento = (med) => {
     // Lógica simple de agregado directo para el ejemplo
     const indicacion = prompt(`Indicaciones para ${med.nombre}:`, "1 cada 8 horas");
     if(indicacion) {
         setTratamiento([...tratamiento, { ...med, indicaciones: indicacion }]);
         setBusquedaMed('');
     }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- ESTILOS VISUALES (LIQUID / GLASS) ---
  const glassPanel = "bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-3xl";
  const inputStyle = "w-full p-3 bg-white/50 border border-slate-200/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 outline-none transition-all text-sm font-medium text-slate-700 placeholder:text-slate-400";

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans relative overflow-x-hidden text-slate-600 selection:bg-blue-100 selection:text-blue-700">
      
      {/* --- FONDO LIQUID (Orbes difuminados animados) --- */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[100px] mix-blend-multiply animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-teal-100/40 rounded-full blur-[120px] mix-blend-multiply"></div>
      </div>

      {/* --- BARRA FLOTANTE SUPERIOR (GLASS) --- */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl h-20 ${glassPanel} z-50 flex justify-between items-center px-6 transition-all duration-500`}>
         <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors duration-500 ${timerActive ? 'bg-rose-50 text-rose-500 shadow-inner' : 'bg-blue-50 text-blue-600'}`}>
              <Stethoscope size={24} strokeWidth={2} />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-none tracking-tight">Consultorio 1</h1>
              <p className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-1">
                 <div className={`w-2 h-2 rounded-full ${timerActive ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`}></div>
                 {timerActive ? 'Consulta en curso' : 'Disponible'}
              </p>
            </div>
         </div>
         
         <div className="flex items-center gap-4">
            {/* CONTROLES DEL CRONÓMETRO */}
            <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-white/50">
                {!timerActive ? (
                    <button onClick={iniciarConsulta} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/10 transition-all flex items-center gap-2 active:scale-95">
                        <Play size={16} fill="currentColor" /> Iniciar
                    </button>
                ) : (
                    <button onClick={detenerConsulta} className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2 active:scale-95">
                        <Square size={16} fill="currentColor" /> Pausar
                    </button>
                )}
                <div className={`px-4 font-mono text-xl font-bold tracking-wider ${timeLeft < 120 && timerActive ? 'text-rose-500 animate-pulse' : 'text-slate-700'}`}>
                   {formatTime(timeLeft)}
                </div>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2"></div>

            <button onClick={() => window.open('/agenda', '_blank')} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Ver Agenda">
                <Calendar size={20} />
            </button>
         </div>
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="mt-32 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto px-6 pb-12 relative z-10 print:hidden">
        
        {/* COLUMNA IZQUIERDA: PACIENTE */}
        <div className="lg:col-span-4 space-y-6">
           <div className={`${glassPanel} p-8 space-y-6`}>
             <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><User size={18}/></div>
                 <h2 className="font-bold text-slate-700 text-lg">Ficha del Paciente</h2>
             </div>
             
             <div className="space-y-4">
               <div>
                 <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Nombre Completo</label>
                 <input type="text" className={inputStyle} 
                   value={paciente.nombre} onChange={e => setPaciente({...paciente, nombre: e.target.value})} placeholder="Ej. Mariana López" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Edad</label>
                    <input type="number" className={inputStyle} 
                      value={paciente.edad} onChange={e => setPaciente({...paciente, edad: e.target.value})} placeholder="Años" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 flex justify-between">
                        Peso (kg)
                        <button onClick={calcularDosis} className="text-blue-500 hover:text-blue-700"><Calculator size={12}/></button>
                    </label>
                    <input type="number" className={inputStyle} 
                      value={paciente.peso} onChange={e => setPaciente({...paciente, peso: e.target.value})} placeholder="0.0" />
                  </div>
               </div>

               {/* ALERTAS */}
               <div className={`p-4 rounded-2xl border transition-all ${paciente.alergias ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-transparent'}`}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className={paciente.alergias ? "text-rose-500" : "text-slate-300"} /> 
                    Alergias Críticas
                  </label>
                  <input type="text" className="w-full bg-transparent border-b border-slate-200 focus:border-rose-400 outline-none py-1 text-rose-600 font-bold placeholder-slate-300 text-sm" 
                    value={paciente.alergias} onChange={e => setPaciente({...paciente, alergias: e.target.value})} placeholder="Ninguna reportada" />
               </div>
             </div>
           </div>
        </div>

        {/* COLUMNA DERECHA: DIAGNÓSTICO */}
        <div className="lg:col-span-8 space-y-6">
           
           {/* Diagnóstico */}
           <div className={`${glassPanel} p-8`}>
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><FileText size={18}/></div>
                      <h2 className="font-bold text-slate-700 text-lg">Nota Médica</h2>
                  </div>
              </div>
              <textarea 
                className="w-full h-40 p-5 border border-slate-200/60 rounded-2xl bg-slate-50/30 focus:bg-white focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 outline-none resize-none transition-all text-sm leading-relaxed text-slate-600"
                placeholder="Escriba aquí la evolución, hallazgos físicos y diagnóstico..."
                value={diagnostico} onChange={e => setDiagnostico(e.target.value)}
              ></textarea>
           </div>

           {/* Receta */}
           <div className={`${glassPanel} p-8 min-h-[400px] flex flex-col`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                    Receta Electrónica <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{tratamiento.length} ítems</span>
                </h2>
              </div>
              
              {/* Buscador */}
              <div className="relative mb-6 z-20">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18}/>
                <input 
                  type="text" 
                  placeholder="Buscar medicamento activo..." 
                  className="w-full pl-12 pr-4 py-3 border border-slate-200/60 rounded-2xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-medium"
                  value={busquedaMed}
                  onChange={e => setBusquedaMed(e.target.value)}
                />
                
                {/* Resultados Flotantes */}
                {busquedaMed && (
                  <div className="absolute top-full left-0 w-full bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl mt-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {inventarioMock
                      .filter(m => m.nombre.toLowerCase().includes(busquedaMed.toLowerCase()))
                      .map(med => (
                        <div key={med.id} onClick={() => agregarMedicamento(med)} 
                        className="p-4 border-b border-slate-100 cursor-pointer flex justify-between items-center hover:bg-blue-50/50 transition-colors group">
                          <div>
                            <p className="font-bold text-slate-700 text-sm group-hover:text-blue-700">{med.nombre}</p>
                            <p className="text-xs text-slate-400">{med.tipo}</p>
                          </div>
                          <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg group-hover:bg-white">Stock: {med.stock}</span>
                        </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista Items */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                 {tratamiento.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">
                     <p className="font-medium text-sm">Sin medicamentos asignados</p>
                   </div>
                 )}
                 {tratamiento.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center font-bold text-xs">
                           {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{item.nombre}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.indicaciones}</p>
                        </div>
                      </div>
                      <button onClick={() => setTratamiento(tratamiento.filter((_, i) => i !== idx))} 
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                        <Trash2 size={18} />
                      </button>
                   </div>
                 ))}
              </div>

              {/* Botón Acción Final */}
              <div className="mt-8 pt-6 border-t border-slate-100/50">
                <button 
                  onClick={finalizarYGuardar}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 transition-transform active:scale-[0.99]"
                >
                  <CheckCircle size={20} /> 
                  Finalizar Consulta
                </button>
              </div>
           </div>
        </div>
      </div>

      {/* --- FORMATO DE IMPRESIÓN (MEMBRETADO) --- */}
      <div className="hidden print:block p-10 bg-white text-black h-screen w-full fixed top-0 left-0 z-[100]">
         <div className="flex justify-between items-start border-b-4 border-slate-800 pb-6 mb-8">
            <div className="flex items-center gap-4">
               <div className="border-2 border-slate-800 p-2 rounded-full">
                  <FileText size={32} className="text-slate-800"/>
               </div>
               <div>
                 <h1 className="text-3xl font-bold uppercase tracking-wider">Centro Médico Santa Cruz</h1>
                 <p className="text-sm font-semibold text-slate-600">Dr. {user?.nombre || 'General'}</p>
                 <p className="text-xs text-slate-500">Ced. Prof: 12345678 | Universidad de Medicina</p>
               </div>
            </div>
            <div className="text-right">
               <h2 className="text-xl font-bold text-slate-800">RECETA MÉDICA</h2>
               <p className="text-sm text-red-600 font-mono font-bold">FOLIO: #{folio || '—'}</p>
               <p className="text-sm font-medium mt-1">{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
         </div>

         {/* Datos Paciente Print */}
         <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 grid grid-cols-4 gap-4 text-sm">
            <div className="col-span-2">
              <span className="block font-bold text-slate-400 text-xs uppercase">Paciente</span>
              <span className="text-lg font-bold text-slate-800">{paciente.nombre}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-400 text-xs uppercase">Edad</span>
              <span className="text-lg font-bold text-slate-800">{paciente.edad} años</span>
            </div>
            <div>
              <span className="block font-bold text-slate-400 text-xs uppercase">Peso</span>
              <span className="text-lg font-bold text-slate-800">{paciente.peso} kg</span>
            </div>
            {paciente.alergias && (
              <div className="col-span-4 border-t border-slate-200 pt-2 mt-2">
                 <span className="font-bold text-red-600 uppercase text-xs flex items-center gap-1">
                   ALERGIAS: {paciente.alergias}
                 </span>
              </div>
            )}
         </div>

         {/* Tratamiento Print */}
         <div className="mb-16">
            <h3 className="font-bold text-lg border-b border-slate-300 mb-4 pb-2">Plan de Tratamiento (Rx)</h3>
            <ul className="space-y-6">
              {tratamiento.map((t, i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-bold text-slate-400 text-lg">{i + 1}.</span>
                  <div>
                    <span className="font-bold text-xl block text-slate-900">{t.nombre}</span>
                    <span className="text-slate-600 font-medium italic block mt-1">{t.indicaciones}</span>
                  </div>
                </li>
              ))}
            </ul>
         </div>

         {/* Diagnóstico Print */}
         <div className="mb-16 p-4 border border-dashed border-slate-300 rounded-lg">
            <p className="text-xs font-bold text-slate-400 uppercase">Diagnóstico Clínico:</p>
            <p className="text-sm text-slate-700">{diagnostico}</p>
         </div>

         {/* Footer Print */}
         <div className="fixed bottom-10 left-0 w-full px-10">
            <div className="flex justify-between items-end">
               <div className="text-xs text-slate-400">
                  <p>Calle Principal #123, Col. Centro</p>
                  <p>Tel: (55) 1234-5678</p>
                  <p>www.centromedicosantacruz.com</p>
               </div>
               <div className="text-center">
                  <div className="w-64 border-b-2 border-slate-800 mb-2"></div>
                  <p className="font-bold text-slate-800 uppercase">Firma del Médico</p>
               </div>
            </div>
         </div>
      </div>

    </div>
  );
};

export default Consultorio;