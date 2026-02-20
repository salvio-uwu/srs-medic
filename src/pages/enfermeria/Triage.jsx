import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Save, User, Activity, ArrowLeft, Thermometer, Heart, 
  Wind, CheckCircle, AlertCircle, XCircle 
} from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const Triage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { citaId, pacienteId, pacienteNombre } = location.state || {};

  // --- ESTADOS ---
  const [signos, setSignos] = useState({
    peso: '', talla: '', temp: '', fc: '', fr: '', ta: '', spo2: '', imc: ''
  });
  const [motivo, setMotivo] = useState('');
  const [alergias, setAlergias] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false); // Modal éxito
  const [errorMsg, setErrorMsg] = useState(''); // Estado para manejar errores sin alerts nativos

  // Calcular IMC automático
  useEffect(() => {
    if (signos.peso && signos.talla) {
        const t = parseFloat(signos.talla);
        const p = parseFloat(signos.peso);
        if(t > 0) {
            const imcCalc = (p / (t * t)).toFixed(2);
            setSignos(prev => ({ ...prev, imc: imcCalc }));
        }
    }
  }, [signos.peso, signos.talla]);

// src/pages/enfermeria/Triage.jsx

// ... (imports y estados anteriores se mantienen igual)

  const guardarTriage = async () => {
    // Validación interna
    if (!pacienteNombre) {
        setErrorMsg("Error: No se ha identificado al paciente.");
        return;
    }
    if (!motivo.trim()) {
        setErrorMsg("Por favor, describe el motivo de la visita.");
        return;
    }
    
    setLoading(true);
    setErrorMsg(''); 

    try {
        // 1. Guardar Triage (Histórico para enfermería)
        await addDoc(collection(db, "triage_enfermeria"), {
            pacienteId: pacienteId || "externo",
            pacienteNombre,
            signos,
            motivo,
            alergias,
            citaId: citaId || null,
            realizadoPor: auth.currentUser?.uid || 'anonimo',
            fecha: serverTimestamp(),
            estado: 'esperando_doctor'
        });

        // 2. Actualizar Cita (Comunicación con el Médico)
        if (citaId) {
            await updateDoc(doc(db, "citas", citaId), { 
                estado: 'en_espera', 
                signos_vitales: signos,
                // --- INYECCIÓN DE DATOS PARA EL EXPEDIENTE ---
                triage_motivo: motivo, 
                triage_alergias: alergias
                // ---------------------------------------------
            });
        }

        // Mostrar modal de éxito
        setShowSuccess(true);

    } catch (error) {
        console.error(error);
        setErrorMsg("Hubo un problema al guardar en la base de datos.");
    }
    setLoading(false);
  };

// ... (resto del componente igual)
  const glassInput = "w-full p-2.5 bg-white/50 border border-white/60 rounded-xl outline-none focus:ring-2 focus:ring-rose-400/50 focus:bg-white/90 transition-all text-sm font-medium text-slate-700 placeholder:text-slate-400 backdrop-blur-sm shadow-sm";
  const labelStyle = "text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 block tracking-wider";

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 font-sans overflow-hidden bg-slate-50">
        
        {/* --- FONDO LIQUID (Sutil) --- */}
        <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-rose-200/40 rounded-full blur-[80px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-[100px] mix-blend-multiply"></div>
        </div>

        {/* --- CONTENEDOR PRINCIPAL (Más compacto) --- */}
        <div className="relative z-10 w-full max-w-4xl bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            
            {/* Header Compacto */}
            <div className="px-6 py-4 border-b border-white/40 flex justify-between items-center bg-white/30">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/50 rounded-xl text-slate-600 hover:text-rose-600 transition-colors">
                        <ArrowLeft size={20}/>
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 leading-none">Triage Enfermería</h1>
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Captura de Signos</p>
                    </div>
                </div>
            </div>

            {/* BARRA DE ERROR (Toast Integrado) */}
            {errorMsg && (
                <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2">
                    <XCircle size={18} className="text-red-500" />
                    <p className="text-xs font-bold text-red-600 flex-1">{errorMsg}</p>
                    <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-700 font-bold text-xs">CERRAR</button>
                </div>
            )}

            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[85vh] custom-scrollbar">
                
                {/* 1. PACIENTE (Banner Compacto) */}
                <div className="bg-gradient-to-r from-rose-50 to-indigo-50 p-4 rounded-2xl border border-white/60 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                        <User size={20} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paciente</p>
                        <input 
                            value={pacienteNombre || ''} 
                            readOnly
                            placeholder="Sin paciente seleccionado"
                            className="w-full bg-transparent text-lg font-black text-slate-800 outline-none placeholder:text-slate-300 truncate"
                        />
                    </div>
                </div>

                {/* 2. MOTIVO Y ALERGIAS (Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelStyle}>Motivo de Visita</label>
                        <textarea 
                            value={motivo} onChange={e => setMotivo(e.target.value)}
                            className={`${glassInput} h-24 resize-none`}
                            placeholder="Razón de la urgencia..."
                        />
                    </div>
                    <div>
                        <label className={`${labelStyle} flex items-center gap-1 text-rose-500`}>
                            Alergias <AlertCircle size={10} />
                        </label>
                        <textarea 
                            value={alergias} onChange={e => setAlergias(e.target.value)}
                            className={`${glassInput} h-24 resize-none bg-rose-50/40 border-rose-100/50 focus:ring-rose-200`}
                            placeholder="Ninguna conocida..."
                        />
                    </div>
                </div>

                {/* 3. SIGNOS VITALES (Compacto) */}
                <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                        <Activity size={14} className="text-indigo-500"/> Exploración Física
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Peso (kg)', key: 'peso', ph: '0.0', icon: null },
                            { label: 'Talla (m)', key: 'talla', ph: '1.70', icon: null },
                            { label: 'Temp (°C)', key: 'temp', ph: '36.5', icon: <Thermometer size={12} className="text-rose-400"/> },
                            { label: 'T/A', key: 'ta', ph: '120/80', icon: <Heart size={12} className="text-rose-400"/> },
                            { label: 'F.C. (lpm)', key: 'fc', ph: '80', icon: <Activity size={12} className="text-indigo-400"/> },
                            { label: 'F.R. (rpm)', key: 'fr', ph: '18', icon: <Wind size={12} className="text-indigo-400"/> },
                            { label: 'Sat. O2 (%)', key: 'spo2', ph: '98', icon: null },
                            { label: 'IMC', key: 'imc', ph: '--', readOnly: true },
                        ].map((field) => (
                            <div key={field.key} className="relative">
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 flex justify-between px-1">
                                    {field.label} {field.icon}
                                </label>
                                <input 
                                    type="text"
                                    readOnly={field.readOnly}
                                    placeholder={field.ph}
                                    value={signos[field.key]}
                                    onChange={e => setSignos({...signos, [field.key]: e.target.value})}
                                    className={`${glassInput} text-center font-bold ${field.key === 'imc' ? 'bg-slate-100 text-slate-500' : ''}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Botón */}
                <div className="pt-2 flex justify-end">
                    <button 
                        onClick={guardarTriage}
                        disabled={loading}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
                    >
                        {loading ? 'Guardando...' : <>Finalizar Triage <Save size={16}/></>}
                    </button>
                </div>

            </div>
        </div>

        {/* --- MODAL ÉXITO (Compacto) --- */}
        {showSuccess && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"></div>
                <div className="relative bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl animate-in zoom-in-95">
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={28} strokeWidth={3} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">¡Listo!</h2>
                    <p className="text-xs text-slate-500 font-medium mb-6 mt-1">
                        Información registrada correctamente.
                    </p>
                    <button 
                        onClick={() => navigate('/enfermeria/dashboard')}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
                    >
                        Volver
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default Triage;