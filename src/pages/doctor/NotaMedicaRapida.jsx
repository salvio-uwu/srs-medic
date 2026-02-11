import React, { useState, useEffect } from 'react';
import { 
  Save, ArrowLeft, Activity, FileText, Pill, 
  Thermometer, Heart, Search, XCircle, Trash2 
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../config/firebase'; 
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const NotaMedicaRapida = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pacienteId, citaId, motivo } = location.state || {}; // Recibimos el motivo aquí

  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'diagnostico' | 'estudios'
  const [loading, setLoading] = useState(false);
  const [paciente, setPaciente] = useState(null);

  // Datos del Formulario
  const [signos, setSignos] = useState({ ta: '', temp: '', fc: '', fr: '', spo2: '', peso: '', talla: '', imc: '' });
  const [padecimiento, setPadecimiento] = useState(''); // Subjetivo
  const [exploracion, setExploracion] = useState('');   // Objetivo
  const [analisis, setAnalisis] = useState('');         // Análisis (para notas SOAP)
  
  // Diagnóstico y Plan
  const [diagnostico, setDiagnostico] = useState('');
  const [tratamiento, setTratamiento] = useState([]); // { nombre, dosis }
  const [nuevoMed, setNuevoMed] = useState({ nombre: '', dosis: '' });
  const [pronostico, setPronostico] = useState('');

  // --- EFECTOS ---
  useEffect(() => {
    const fetchPaciente = async () => {
      if (!pacienteId) return;
      const snap = await getDoc(doc(db, "pacientes", pacienteId));
      if (snap.exists()) setPaciente({ id: snap.id, ...snap.data() });
    };
    fetchPaciente();
  }, [pacienteId]);

  // Cálculo IMC Auto
  useEffect(() => {
    if (signos.peso && signos.talla) {
        const t = signos.talla > 3 ? signos.talla / 100 : signos.talla;
        setSignos(s => ({ ...s, imc: (signos.peso / (t * t)).toFixed(2) }));
    }
  }, [signos.peso, signos.talla]);

  // --- GUARDADO ---
  const guardarNota = async () => {
      setLoading(true);
      try {
          const notaData = {
              pacienteId,
              pacienteNombre: paciente?.nombreCompleto,
              fecha: serverTimestamp(),
              tipoNota: motivo, // "Nota de urgencia", "Evolución", etc.
              contenido: {
                  subjetivo: padecimiento,
                  objetivo: exploracion,
                  analisis: analisis,
                  signosVitales: signos,
                  diagnostico,
                  pronostico
              },
              receta: tratamiento,
              medicoId: "uid_doctor_actual" // Usar user.uid del contexto
          };

          // 1. Guardar en historial
          await addDoc(collection(db, "historial_clinico"), notaData);

          // 2. Cerrar cita
          if (citaId) await updateDoc(doc(db, "citas", citaId), { estado: 'completada' });

          alert("✅ Nota guardada correctamente");
          navigate('/agenda');

      } catch (error) {
          console.error(error);
          alert("Error al guardar");
      }
      setLoading(false);
  };

  // --- RENDERIZADORES ---
  
  // Tab 1: Padecimiento y Signos (Layout dividido como en tu imagen)
  const renderGeneral = () => (
      <div className="flex flex-col md:flex-row gap-6 h-full animate-in fade-in">
          {/* Izquierda: Textos Libres (SOAP Adaptable) */}
          <div className="flex-1 flex flex-col gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                  <label className="text-xs font-bold text-teal-600 uppercase mb-2">
                      {motivo === 'Nota de evolución' ? 'S - Subjetivo (Padecimiento Actual)' : 'Motivo de Atención'}
                  </label>
                  <textarea className="flex-1 w-full p-3 bg-slate-50 rounded-lg border-none outline-none resize-none focus:ring-2 focus:ring-teal-100"
                      placeholder="Describa síntomas..." value={padecimiento} onChange={e => setPadecimiento(e.target.value)} />
              </div>
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                  <label className="text-xs font-bold text-teal-600 uppercase mb-2">
                      {motivo === 'Nota de evolución' ? 'O - Objetivo (Exploración Física)' : 'Exploración Física y Hallazgos'}
                  </label>
                  <textarea className="flex-1 w-full p-3 bg-slate-50 rounded-lg border-none outline-none resize-none focus:ring-2 focus:ring-teal-100"
                      placeholder="Hallazgos clínicos..." value={exploracion} onChange={e => setExploracion(e.target.value)} />
              </div>

              {motivo === 'Nota de evolución' && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                      <label className="text-xs font-bold text-teal-600 uppercase mb-2">A - Análisis</label>
                      <textarea className="flex-1 w-full p-3 bg-slate-50 rounded-lg border-none outline-none resize-none focus:ring-2 focus:ring-teal-100"
                          value={analisis} onChange={e => setAnalisis(e.target.value)} />
                  </div>
              )}
          </div>

          {/* Derecha: Signos Vitales (Panel Lateral Fijo) */}
          <div className="w-full md:w-80 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-2">
                  <Activity size={18} className="text-teal-500"/> Signos Vitales
              </h3>
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase">Talla (m)</label><input type="number" className="w-full p-2 border rounded bg-slate-50" value={signos.talla} onChange={e=>setSignos({...signos, talla:e.target.value})}/></div>
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase">Peso (kg)</label><input type="number" className="w-full p-2 border rounded bg-slate-50" value={signos.peso} onChange={e=>setSignos({...signos, peso:e.target.value})}/></div>
                  </div>
                  
                  <div className="bg-teal-50 p-3 rounded-lg border border-teal-100 text-center">
                      <span className="text-xs font-bold text-teal-600 uppercase">IMC</span>
                      <div className="text-2xl font-black text-teal-800">{signos.imc || '--'}</div>
                  </div>

                  <div className="space-y-2">
                      {['Temp','T.A.','F.C.','F.R.','SpO2'].map(k => (
                          <div key={k} className="flex justify-between items-center border-b border-slate-100 pb-1">
                              <label className="text-xs font-bold text-slate-500">{k}</label>
                              <input className="w-20 text-right font-bold text-slate-700 outline-none bg-transparent" placeholder="--" 
                                  value={signos[k.toLowerCase().replace('.','').replace('temp','temp')]} 
                                  onChange={e=>setSignos({...signos, [k.toLowerCase().replace('.','').replace('temp','temp')]: e.target.value})}
                              />
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
  );

  // Tab 2: Diagnóstico y Tratamiento
  const renderDiagnostico = () => (
      <div className="flex gap-6 h-full animate-in fade-in">
          <div className="flex-1 space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Diagnóstico (CIE-10 o Libre)</label>
                  <div className="flex gap-2">
                      <Search className="text-slate-400 mt-2" size={20}/>
                      <input type="text" className="w-full p-2 text-lg font-medium border-b border-slate-200 outline-none focus:border-teal-500"
                          placeholder="Escriba el diagnóstico..." value={diagnostico} onChange={e => setDiagnostico(e.target.value)} />
                  </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-teal-600 text-sm uppercase mb-4 flex items-center gap-2"><Pill size={16}/> Plan / Receta</h4>
                  <div className="flex gap-2 mb-4">
                      <input className="flex-1 p-2 border rounded bg-slate-50 text-sm" placeholder="Medicamento..." value={nuevoMed.nombre} onChange={e=>setNuevoMed({...nuevoMed, nombre:e.target.value})}/>
                      <input className="w-1/3 p-2 border rounded bg-slate-50 text-sm" placeholder="Indicaciones..." value={nuevoMed.dosis} onChange={e=>setNuevoMed({...nuevoMed, dosis:e.target.value})}/>
                      <button className="bg-teal-500 text-white px-4 rounded font-bold text-sm" onClick={()=>{
                          if(nuevoMed.nombre) { setTratamiento([...tratamiento, {...nuevoMed, id:Date.now()}]); setNuevoMed({nombre:'', dosis:''}); }
                      }}>Agregar</button>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-2 min-h-[150px]">
                      {tratamiento.map(t => (
                          <div key={t.id} className="flex justify-between p-2 border-b border-slate-200 bg-white mb-1 rounded shadow-sm">
                              <div><p className="font-bold text-sm">{t.nombre}</p><p className="text-xs text-slate-500">{t.dosis}</p></div>
                              <button onClick={()=>setTratamiento(tratamiento.filter(x=>x.id!==t.id))}><Trash2 size={16} className="text-red-400"/></button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
          
          <div className="w-80 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Pronóstico</label>
              <textarea className="w-full h-40 p-3 bg-slate-50 rounded-lg border-none outline-none resize-none" 
                  value={pronostico} onChange={e => setPronostico(e.target.value)} placeholder="Reservado a evolución..." />
          </div>
      </div>
  );

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-30">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/agenda')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><ArrowLeft size={20}/></button>
                <div>
                    <h1 className="text-lg font-bold text-orange-600 leading-none">{motivo || 'Nota Médica'}</h1>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">{paciente?.nombreCompleto || 'Cargando...'} • {new Date().toLocaleDateString()}</p>
                </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={()=>setActiveTab('general')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab==='general' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Padecimiento y Signos</button>
                <button onClick={()=>setActiveTab('diagnostico')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab==='diagnostico' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Diagnóstico y Tx</button>
                <button className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-400 cursor-not-allowed">Solicitar Estudios</button>
            </div>
            <button onClick={guardarNota} disabled={loading} className="bg-orange-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow hover:bg-orange-700 flex items-center gap-2">
                <Save size={16}/> Terminar Nota
            </button>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full">
            {activeTab === 'general' && renderGeneral()}
            {activeTab === 'diagnostico' && renderDiagnostico()}
        </div>
    </div>
  );
};

export default NotaMedicaRapida;