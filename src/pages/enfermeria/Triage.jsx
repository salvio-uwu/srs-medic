import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Save, User, Activity, ArrowLeft, Thermometer, Heart, 
  Wind, CheckCircle, AlertCircle, XCircle, FlaskConical, Trash2, Plus, Stethoscope
} from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import AvatarPaciente from '../../components/AvatarPaciente';

const Triage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { citaId, pacienteId, pacienteNombre, editMode } = location.state || {};

  // --- ESTADOS ---
  const [signos, setSignos] = useState({
    peso: '', talla: '', temp: '', fc: '', fr: '', ta: '', spo2: '', imc: ''
  });

  // Alergias estructuradas (igual que expediente clínico)
  const CATS_ALERGIAS = [
    "AINE", "ANTICONVULSIVOS", "ANTITOXINAS EXTRAÑAS", "ANTITUBERCULOSOS",
    "CEFALOSPORINA", "ENZIMA", "INSULINA", "PENICILINA", "RELAJANTES MUSCULARES",
    "SALES DE PLATINO", "SULFONAMIDAS", "MACRÓLIDOS", "LÁTEX"
  ];
  const [alergias, setAlergias] = useState({
    preguntados_y_negados: false,
    buscar_sustancia: false,
    lista: [],
    otros: ''
  });
  const [tempAlergia, setTempAlergia] = useState('');

  // Enfermedades / padecimientos del paciente
  const ENFERMEDADES_COMUNES = [
    "Diabetes", "Hipertensión", "Asma", "Epilepsia", "Cardiopatía",
    "Insuficiencia renal", "Cáncer", "VIH/SIDA", "Hepatitis",
    "Artritis", "Hipotiroidismo", "Hipertiroidismo", "EPOC", "Depresión"
  ];
  const [enfermedades, setEnfermedades] = useState({
    preguntados_y_negados: false,
    lista: [],
    otros: ''
  });
  const [tempEnfermedad, setTempEnfermedad] = useState('');

  const [cargandoDatos, setCargandoDatos] = useState(!!editMode);
  const [pacienteMeta, setPacienteMeta] = useState({ sexo: '', fechaNacimiento: '' });

  // Precargar datos existentes en modo edición
  useEffect(() => {
    if (!editMode || !citaId) return;
    const cargar = async () => {
      try {
        const snap = await getDoc(doc(db, 'citas', citaId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.signos_vitales) setSignos(prev => ({ ...prev, ...data.signos_vitales }));
          // Alergias: cargar estructura nueva o migrar texto viejo
          if (data.triage_alergias_struct) {
            setAlergias(prev => ({ ...prev, ...data.triage_alergias_struct }));
          } else if (data.triage_alergias) {
            setAlergias(prev => ({ ...prev, otros: data.triage_alergias }));
          }
          // Enfermedades
          if (data.triage_enfermedades) {
            setEnfermedades(prev => ({ ...prev, ...data.triage_enfermedades }));
          }
        }
      } catch (e) {
        console.error('Error cargando triage existente', e);
      } finally {
        setCargandoDatos(false);
      }
    };
    cargar();
  }, [editMode, citaId]);

    // Cargar datos del paciente para avatar en encabezado
    useEffect(() => {
        if (!pacienteId) {
            setPacienteMeta({ sexo: '', fechaNacimiento: '' });
            return;
        }

        let active = true;
        const cargarPaciente = async () => {
            try {
                const snap = await getDoc(doc(db, 'pacientes', pacienteId));
                if (!snap.exists() || !active) return;
                const data = snap.data() || {};
                setPacienteMeta({
                    sexo: data.sexo || '',
                    fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || ''
                });
            } catch (e) {
                console.error('Error cargando paciente para avatar', e);
            }
        };

        cargarPaciente();
        return () => { active = false; };
    }, [pacienteId]);
  
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false); // Modal éxito
  const [errorMsg, setErrorMsg] = useState(''); // Estado para manejar errores sin alerts nativos

  // Calcular IMC automático
  useEffect(() => {
    if (signos.peso && signos.talla) {
        let t = parseFloat(signos.talla);
        const p = parseFloat(signos.peso);
        if(t > 0 && p > 0) {
            // Si talla > 3, asumimos que se ingresó en cm y convertimos a metros
            if (t > 3) t = t / 100;
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
    
    setLoading(true);
    setErrorMsg(''); 

    try {
        // Generar texto resumen de alergias para compatibilidad
        const alergiasTexto = alergias.preguntados_y_negados 
          ? 'Preguntados y negados'
          : [
              ...alergias.lista.map(a => a.sustancia),
              ...(alergias.otros ? [alergias.otros] : [])
            ].join(', ') || '';

        // Generar texto resumen de enfermedades
        const enfermedadesTexto = enfermedades.preguntados_y_negados
          ? 'Preguntados y negados'
          : [
              ...enfermedades.lista,
              ...(enfermedades.otros ? [enfermedades.otros] : [])
            ].join(', ') || '';

        // 1. Guardar Triage (Histórico para enfermería)
        await addDoc(collection(db, "triage_enfermeria"), {
            pacienteId: pacienteId || "externo",
            pacienteNombre,
            signos,
            alergias: alergiasTexto,
            alergias_struct: alergias,
            enfermedades: enfermedadesTexto,
            enfermedades_struct: enfermedades,
            citaId: citaId || null,
            realizadoPor: auth.currentUser?.uid || 'anonimo',
            fecha: serverTimestamp(),
            estado: 'esperando_doctor',
            esEdicion: !!editMode
        });

        // 2. Actualizar Cita (Comunicación con el Médico)
        if (citaId) {
            await updateDoc(doc(db, "citas", citaId), { 
                estado: 'en_espera', 
                signos_vitales: signos,
                triage_alergias: alergiasTexto,
                triage_alergias_struct: alergias,
                triage_enfermedades: enfermedades
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

  const inputBase = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all placeholder:text-slate-300";

  /* ── Bloque reutilizable: cabecera de sección ── */
  const sectionBg = { blue: 'bg-blue-50', rose: 'bg-rose-50' };
  const SectionHeader = ({ icon, title, color = 'blue', right }) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg ${sectionBg[color] || 'bg-blue-50'} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</span>
      </div>
      {right}
    </div>
  );

  /* ── Bloque reutilizable: checkbox "negados" ── */
  const NegadosToggle = ({ checked, onChange, label }) => (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3 select-none active:scale-[0.98] transition-transform"
    >
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${checked ? 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'}`}>
        {checked && <CheckCircle size={13} className="text-white" strokeWidth={3}/>}
      </div>
      <div>
        <span className="text-xs font-bold text-amber-800">Preguntados y negados</span>
        <span className="text-[10px] text-amber-600 block leading-tight">{label}</span>
      </div>
    </div>
  );

  /* ── Bloque reutilizable: chip eliminable ── */
  const chipColors = {
    rose: 'bg-rose-50 border-rose-100 text-rose-300 hover:bg-rose-100 hover:text-rose-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-300 hover:bg-blue-100 hover:text-blue-600',
  };
  const Chip = ({ text, onRemove, color = 'rose' }) => {
    const c = chipColors[color] || chipColors.rose;
    const [bg, border, ...btnClasses] = c.split(' ');
    return (
      <div className={`inline-flex items-center gap-1.5 ${bg} border ${border} rounded-full pl-3 pr-1.5 py-1`}>
        <span className="text-xs font-semibold text-slate-700">{text}</span>
        <button onClick={onRemove} className={`w-5 h-5 rounded-full flex items-center justify-center ${btnClasses.join(' ')} transition-all`}>
          <XCircle size={13}/>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans">

      {/* ═══════════ HEADER ═══════════ */}
      <header className="shrink-0 bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-1 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors active:scale-95">
          <ArrowLeft size={20}/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight truncate">Triage Enfermería</h1>
          <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Captura de signos</p>
        </div>
      </header>

      {/* ═══════════ BARRA PACIENTE ═══════════ */}
      <div className="shrink-0 bg-gradient-to-r from-blue-50 via-white to-blue-50 border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-3">
        <AvatarPaciente sexo={pacienteMeta.sexo} fechaNacimiento={pacienteMeta.fechaNacimiento} size="sm" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Paciente</p>
          <p className="text-sm font-bold text-slate-800 truncate">{pacienteNombre || 'Sin paciente seleccionado'}</p>
        </div>
      </div>

      {/* BARRA DE ERROR */}
      {errorMsg && (
        <div className="shrink-0 bg-red-50 px-4 sm:px-6 py-2.5 border-b border-red-100 flex items-center gap-2">
          <XCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs font-semibold text-red-600 flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-700 font-bold text-[10px] shrink-0">CERRAR</button>
        </div>
      )}

      {/* ═══════════ CONTENIDO PRINCIPAL ═══════════ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">

          {/* ── SIGNOS VITALES ── */}
          <section>
            <SectionHeader
              icon={<Activity size={15} className="text-blue-500"/>}
              title="Exploración Física"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                { label: 'Peso', unit: 'kg', key: 'peso', ph: '0.0', icon: null },
                { label: 'Talla', unit: 'm', key: 'talla', ph: '1.70', icon: null },
                { label: 'Temp.', unit: '°C', key: 'temp', ph: '36.5', icon: <Thermometer size={13} className="text-rose-400"/> },
                { label: 'T/A', unit: 'mmHg', key: 'ta', ph: '120/80', icon: <Heart size={13} className="text-rose-400"/> },
                { label: 'F.C.', unit: 'lpm', key: 'fc', ph: '80', icon: <Activity size={13} className="text-blue-400"/> },
                { label: 'F.R.', unit: 'rpm', key: 'fr', ph: '18', icon: <Wind size={13} className="text-blue-400"/> },
                { label: 'Sat. O₂', unit: '%', key: 'spo2', ph: '98', icon: null },
                { label: 'IMC', unit: '', key: 'imc', ph: '—', readOnly: true },
              ].map(f => (
                <div key={f.key} className={`bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-col items-center ${f.readOnly ? 'bg-slate-50/80' : ''}`}>
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide">{f.label}</span>
                    {f.icon}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly={f.readOnly}
                    placeholder={f.ph}
                    value={signos[f.key]}
                    onChange={e => setSignos({ ...signos, [f.key]: e.target.value })}
                    className={`w-full text-center text-xl sm:text-2xl font-bold outline-none bg-transparent ${f.readOnly ? 'text-slate-400' : 'text-slate-800'} placeholder:text-slate-200`}
                  />
                  {f.unit && <span className="text-[9px] text-slate-400 font-medium mt-0.5">{f.unit}</span>}
                </div>
              ))}
            </div>
          </section>

          {/* ── GRID: ALERGIAS + ENFERMEDADES (2 cols en tablet+) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* ── ALERGIAS ── */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 pb-0">
                <SectionHeader
                  icon={<FlaskConical size={15} className="text-rose-500"/>}
                  title="Alergias"
                  color="rose"
                />
                <NegadosToggle
                  checked={alergias.preguntados_y_negados}
                  onChange={v => setAlergias(prev => ({ ...prev, preguntados_y_negados: v }))}
                  label="El paciente niega cualquier alergia"
                />
              </div>

              {!alergias.preguntados_y_negados && (
                <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
                  {/* Toggle Categoría / Sustancia */}
                  <div className="flex bg-slate-100 rounded-xl p-1 self-start">
                    <button
                      onClick={() => setAlergias(prev => ({ ...prev, buscar_sustancia: false }))}
                      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${!alergias.buscar_sustancia ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`}
                    >Categoría</button>
                    <button
                      onClick={() => setAlergias(prev => ({ ...prev, buscar_sustancia: true }))}
                      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${alergias.buscar_sustancia ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'}`}
                    >Sustancia</button>
                  </div>

                  {/* Input + Agregar */}
                  <div className="flex gap-2">
                    {!alergias.buscar_sustancia ? (
                      <select className={`${inputBase} flex-1`} value={tempAlergia} onChange={e => setTempAlergia(e.target.value)}>
                        <option value="">Seleccionar categoría...</option>
                        {CATS_ALERGIAS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input className={`${inputBase} flex-1`} placeholder="Nombre de sustancia..." value={tempAlergia} onChange={e => setTempAlergia(e.target.value)} />
                    )}
                    <button
                      onClick={() => { if (tempAlergia.trim()) { setAlergias(prev => ({ ...prev, lista: [...prev.lista, { sustancia: tempAlergia.trim() }] })); setTempAlergia(''); } }}
                      className="shrink-0 h-[46px] w-[46px] bg-rose-500 text-white rounded-xl flex items-center justify-center hover:bg-rose-600 active:scale-95 transition-all shadow-sm"
                    ><Plus size={18}/></button>
                  </div>

                  {/* Lista Chips */}
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {alergias.lista.map((a, i) => (
                      <Chip key={i} text={a.sustancia} color="rose" onRemove={() => setAlergias(prev => ({ ...prev, lista: prev.lista.filter((_, idx) => idx !== i) }))} />
                    ))}
                    {alergias.lista.length === 0 && (
                      <span className="text-[11px] text-slate-300 font-medium py-1">Sin alergias registradas</span>
                    )}
                  </div>

                  {/* Otros */}
                  <textarea
                    value={alergias.otros}
                    onChange={e => setAlergias(prev => ({ ...prev, otros: e.target.value }))}
                    className={`${inputBase} h-16 resize-none text-xs`}
                    placeholder="Otras alergias no listadas..."
                  />
                </div>
              )}
            </section>

            {/* ── ENFERMEDADES ── */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 pb-0">
                <SectionHeader
                  icon={<Stethoscope size={15} className="text-blue-500"/>}
                  title="Enfermedades"
                />
                <NegadosToggle
                  checked={enfermedades.preguntados_y_negados}
                  onChange={v => setEnfermedades(prev => ({ ...prev, preguntados_y_negados: v }))}
                  label="El paciente niega padecer alguna enfermedad"
                />
              </div>

              {!enfermedades.preguntados_y_negados && (
                <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
                  {/* Input + Agregar */}
                  <div className="flex gap-2">
                    <select className={`${inputBase} flex-1`} value={tempEnfermedad} onChange={e => setTempEnfermedad(e.target.value)}>
                      <option value="">Seleccionar enfermedad...</option>
                      {ENFERMEDADES_COMUNES.filter(e => !enfermedades.lista.includes(e)).map(e => <option key={e}>{e}</option>)}
                    </select>
                    <button
                      onClick={() => { if (tempEnfermedad.trim()) { setEnfermedades(prev => ({ ...prev, lista: [...prev.lista, tempEnfermedad.trim()] })); setTempEnfermedad(''); } }}
                      className="shrink-0 h-[46px] w-[46px] bg-blue-500 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all shadow-sm"
                    ><Plus size={18}/></button>
                  </div>

                  {/* Lista Chips */}
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {enfermedades.lista.map((enf, i) => (
                      <Chip key={i} text={enf} color="blue" onRemove={() => setEnfermedades(prev => ({ ...prev, lista: prev.lista.filter((_, idx) => idx !== i) }))} />
                    ))}
                    {enfermedades.lista.length === 0 && (
                      <span className="text-[11px] text-slate-300 font-medium py-1">Sin enfermedades registradas</span>
                    )}
                  </div>

                  {/* Otros */}
                  <textarea
                    value={enfermedades.otros}
                    onChange={e => setEnfermedades(prev => ({ ...prev, otros: e.target.value }))}
                    className={`${inputBase} h-16 resize-none text-xs`}
                    placeholder="Otras enfermedades o padecimientos..."
                  />
                </div>
              )}
            </section>

          </div>
        </div>
      </main>

      {/* ═══════════ FOOTER FIJO ═══════════ */}
      <footer className="shrink-0 bg-white border-t border-slate-100 px-4 sm:px-6 py-3 flex justify-end">
        <button
          onClick={guardarTriage}
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.97] transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none w-full sm:w-auto justify-center"
        >
          {loading ? (
            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Guardando...</span>
          ) : (
            <><Save size={16}/> {editMode ? 'Guardar Cambios' : 'Finalizar Triage'}</>
          )}
        </button>
      </footer>

      {/* ═══════════ MODAL ÉXITO ═══════════ */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => navigate('/enfermeria/dashboard')}></div>
          <div className="relative bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">¡Listo!</h2>
            <p className="text-sm text-slate-500 font-medium mb-6 mt-2">
              {editMode ? 'Triage actualizado correctamente.' : 'Información registrada correctamente.'}
            </p>
            <button
              onClick={() => navigate('/enfermeria/dashboard')}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-[0.97] transition-all"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Triage;