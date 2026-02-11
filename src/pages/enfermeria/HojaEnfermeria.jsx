import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Save, ArrowLeft, Activity, User, Clock, 
  Syringe, FileText, Plus, Trash2, AlertCircle 
} from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const HojaEnfermeria = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pacienteId, pacienteNombre } = location.state || {};

  const [loading, setLoading] = useState(false);
  
  // Estado del Formulario
  const [signos, setSignos] = useState({ ta: '', temp: '', fc: '', fr: '', spo2: '', glucosa: '' });
  const [procedimientos, setProcedimientos] = useState([]); // Lista de lo realizado
  const [medicamentos, setMedicamentos] = useState([]);     // Kardex de medicamentos
  const [notas, setNotas] = useState('');

  // Estados temporales para inputs
  const [tempProc, setTempProc] = useState('');
  const [tempMed, setTempMed] = useState({ nombre: '', dosis: '', via: 'Intramuscular', hora: '' });

  // Si no hay paciente seleccionado, volver
  useEffect(() => {
    if (!pacienteId) navigate('/enfermeria/dashboard');
    // Pre-llenar hora actual en medicamento
    const now = new Date();
    setTempMed(prev => ({...prev, hora: `${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}`}));
  }, [pacienteId, navigate]);

  const handleGuardar = async () => {
    if (!pacienteNombre) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "notas_enfermeria"), {
        pacienteId,
        pacienteNombre,
        enfermeraId: auth.currentUser.uid,
        enfermeraNombre: auth.currentUser.displayName || "Enfermería",
        fecha: serverTimestamp(),
        signos,
        procedimientos,
        medicamentos, // Kardex
        observaciones: notas,
        tipo: 'Hoja de Enfermería'
      });
      alert("✅ Hoja de enfermería guardada correctamente.");
      navigate('/enfermeria/dashboard');
    } catch (error) {
      console.error(error);
      alert("Error al guardar: " + error.message);
    }
    setLoading(false);
  };

  // Agregar Medicamento a la lista visual
  const addMedicamento = () => {
    if(!tempMed.nombre) return;
    setMedicamentos([...medicamentos, { ...tempMed, id: Date.now() }]);
    setTempMed({ nombre: '', dosis: '', via: 'Intramuscular', hora: tempMed.hora });
  };

  // Agregar Procedimiento
  const addProcedimiento = () => {
    if(!tempProc) return;
    setProcedimientos([...procedimientos, { nombre: tempProc, id: Date.now() }]);
    setTempProc('');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      
      {/* HEADER */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 sticky top-0 z-40 shadow-sm flex justify-between items-center">
         <div className="flex items-center gap-4">
             <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <ArrowLeft size={20}/>
             </button>
             <div>
                <h1 className="text-xl font-bold text-slate-800 leading-none">Hoja de Enfermería</h1>
                <p className="text-xs text-slate-500 font-bold mt-1 flex items-center gap-1">
                    <User size={12}/> {pacienteNombre}
                </p>
             </div>
         </div>
         <button 
           onClick={handleGuardar} 
           disabled={loading}
           className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all active:scale-95"
         >
           {loading ? 'Guardando...' : <><Save size={18}/> Guardar Hoja</>}
         </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* COLUMNA 1: SIGNOS VITALES RAPIDOS */}
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-50 pb-2">
                <Activity size={18} className="text-rose-500"/> Signos Vitales
            </h3>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase">T/A</label><input type="text" className="w-full p-2 border rounded bg-slate-50 font-bold" value={signos.ta} onChange={e=>setSignos({...signos, ta:e.target.value})} placeholder="120/80"/></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase">Temp (°C)</label><input type="number" className="w-full p-2 border rounded bg-slate-50 font-bold" value={signos.temp} onChange={e=>setSignos({...signos, temp:e.target.value})} placeholder="36.5"/></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase">F.C. (lpm)</label><input type="number" className="w-full p-2 border rounded bg-slate-50 font-bold" value={signos.fc} onChange={e=>setSignos({...signos, fc:e.target.value})} placeholder="80"/></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase">SpO2 (%)</label><input type="number" className="w-full p-2 border rounded bg-slate-50 font-bold" value={signos.spo2} onChange={e=>setSignos({...signos, spo2:e.target.value})} placeholder="98"/></div>
                   <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase text-rose-500">Glucosa Capilar (mg/dL)</label><input type="number" className="w-full p-2 border border-rose-100 rounded bg-rose-50 font-bold text-rose-700" value={signos.glucosa} onChange={e=>setSignos({...signos, glucosa:e.target.value})} placeholder="--"/></div>
                </div>
            </div>
         </div>

         {/* COLUMNA 2 y 3: PROCEDIMIENTOS Y NOTAS */}
         <div className="lg:col-span-2 space-y-6">
            
            {/* SECCIÓN MEDICAMENTOS / KARDEX */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Syringe size={18} className="text-blue-500"/> Aplicación de Medicamentos
                </h3>
                
                {/* Inputs para agregar */}
                <div className="flex flex-col md:flex-row gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <input className="flex-[2] p-2 rounded border border-slate-200 text-sm outline-none" placeholder="Nombre medicamento..." value={tempMed.nombre} onChange={e=>setTempMed({...tempMed, nombre:e.target.value})}/>
                    <input className="flex-1 p-2 rounded border border-slate-200 text-sm outline-none" placeholder="Dosis..." value={tempMed.dosis} onChange={e=>setTempMed({...tempMed, dosis:e.target.value})}/>
                    <select className="flex-1 p-2 rounded border border-slate-200 text-sm outline-none bg-white" value={tempMed.via} onChange={e=>setTempMed({...tempMed, via:e.target.value})}>
                        <option>Intramuscular</option><option>Intravenosa</option><option>Oral</option><option>Subcutánea</option><option>Nebulización</option>
                    </select>
                    <input type="time" className="w-24 p-2 rounded border border-slate-200 text-sm outline-none" value={tempMed.hora} onChange={e=>setTempMed({...tempMed, hora:e.target.value})}/>
                    <button onClick={addMedicamento} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Plus size={20}/></button>
                </div>

                {/* Lista */}
                <div className="space-y-2">
                    {medicamentos.map(m => (
                        <div key={m.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg hover:bg-blue-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">{m.hora}</span>
                                <div>
                                    <p className="text-sm font-bold text-slate-700">{m.nombre}</p>
                                    <p className="text-xs text-slate-500">{m.dosis} • {m.via}</p>
                                </div>
                            </div>
                            <button onClick={()=>setMedicamentos(medicamentos.filter(x=>x.id!==m.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    {medicamentos.length === 0 && <p className="text-center text-slate-400 text-sm py-2 italic">Ningún medicamento registrado en esta hoja.</p>}
                </div>
            </div>

            {/* SECCIÓN PROCEDIMIENTOS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-emerald-500"/> Procedimientos / Intervenciones
                </h3>
                <div className="flex gap-2 mb-4">
                    <input 
                        className="flex-1 p-2 border border-slate-200 rounded-lg text-sm outline-none"
                        placeholder="Ej. Curación de herida, Retiro de puntos, Vendaje..."
                        value={tempProc}
                        onChange={e=>setTempProc(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addProcedimiento()}
                    />
                    <button onClick={addProcedimiento} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-600">Agregar</button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {procedimientos.map(p => (
                        <span key={p.id} className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                            {p.nombre}
                            <button onClick={()=>setProcedimientos(procedimientos.filter(x=>x.id!==p.id))} className="hover:text-red-500"><Trash2 size={14}/></button>
                        </span>
                    ))}
                    {procedimientos.length === 0 && <span className="text-slate-400 text-sm italic">Sin procedimientos registrados.</span>}
                </div>
            </div>

            {/* NOTAS DE ENFERMERÍA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-64">
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText size={18} className="text-slate-400"/> Notas de Evolución
                </h3>
                <textarea 
                    className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none resize-none focus:border-rose-400 transition-colors"
                    placeholder="Escriba aquí las observaciones sobre el estado del paciente, reacciones, o detalles del turno..."
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                />
            </div>

         </div>
      </div>
    </div>
  );
};

export default HojaEnfermeria;