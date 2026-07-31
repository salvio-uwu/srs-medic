import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Save, Activity, ArrowLeft, CheckCircle, XCircle, FlaskConical, Plus, Stethoscope
} from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDoc, deleteField } from 'firebase/firestore';
import AvatarPaciente from '../../components/AvatarPaciente';
import VirtualKeyboard from '../../components/VirtualKeyboard';

const Triage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { citaId, pacienteId, pacienteNombre, editMode } = location.state || {};

  // --- ESTADOS ---
  const [signos, setSignos] = useState({
    peso: '', talla: '', temp: '', fc: '', fr: '', ta: '', spo2: '', glucosa: '', imc: ''
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

  const [_cargandoDatos, setCargandoDatos] = useState(!!editMode);
  const [pacienteMeta, setPacienteMeta] = useState({ sexo: '', fechaNacimiento: '' });
  const [pacienteNombreFallback, setPacienteNombreFallback] = useState(String(pacienteNombre || '').trim());

  useEffect(() => {
    setPacienteNombreFallback(String(pacienteNombre || '').trim());
  }, [pacienteNombre]);

  // Marcar inicio de triage en Firestore (solo en modo nuevo, no edición)
  // Esto permite que las otras agendas muestren "En triage" en tiempo real.
  useEffect(() => {
    if (!citaId || editMode) return;
    let cancelled = false;
    const marcarInicio = async () => {
      try {
        const citaRef = doc(db, 'citas', citaId);
        const snap = await getDoc(citaRef);
        if (!snap.exists() || cancelled) return;
        if (!snap.data().triageIniciadoAt) {
          await updateDoc(citaRef, { triageIniciadoAt: serverTimestamp() });
        }
      } catch (e) {
        console.error('Error marcando inicio de triage:', e);
      }
    };
    marcarInicio();
    return () => { cancelled = true; };
  }, [citaId, editMode]);

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
                const nombreCompleto = String(data.nombreCompleto || '').trim();
                const nombreCompuesto = [data.nombre, data.apellidoPaterno, data.apellidoMaterno]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                const nombrePacienteDoc = nombreCompleto || nombreCompuesto || String(data.nombre || '').trim();
                if (nombrePacienteDoc) {
                  setPacienteNombreFallback((prev) => prev || nombrePacienteDoc);
                }
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
  const [activeField, setActiveField] = useState(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

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

  const pacienteNombreFinal = String(pacienteNombre || pacienteNombreFallback || '').trim();

  const guardarTriage = async () => {
    // Validación interna
    if (!pacienteNombreFinal && !pacienteId) {
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
          pacienteNombre: pacienteNombreFinal || 'Paciente sin nombre',
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
                triage_enfermedades: enfermedades,
                triageIniciadoAt: deleteField(), // limpia el marcador de "En triage" al completar
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

  const handleKeyPress = ({ type, char }) => {
    if (!activeField) return;
    setSignos(prev => {
      const current = prev[activeField] || '';
      if (type === 'backspace') return { ...prev, [activeField]: current.slice(0, -1) };
      if (type === 'clear') return { ...prev, [activeField]: '' };
      return { ...prev, [activeField]: current + char };
    });
  };

  const handleFieldFocus = (key) => {
    if (key === 'imc') return;
    setActiveField(key);
    setShowKeyboard(true);
  };

  const inputBase = {
    width: '100%',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: '#111',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const NegadosToggle = ({ checked, onChange, label }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        cursor: 'pointer',
        background: checked ? '#fafafa' : '#fff',
        border: `1px solid ${checked ? '#111' : '#e5e7eb'}`,
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 12,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `1.5px solid ${checked ? '#111' : '#d1d5db'}`,
        background: checked ? '#111' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && <CheckCircle size={11} color="#fff" strokeWidth={3} />}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>Preguntados y negados</div>
        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3 }}>{label}</div>
      </div>
    </button>
  );

  const Chip = ({ text, onRemove }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: '#fafafa',
      border: '1px solid #e5e7eb',
      borderRadius: 6,
      padding: '4px 6px 4px 10px',
      fontSize: 12,
      fontWeight: 600,
      color: '#374151',
    }}>
      {text}
      <button
        type="button"
        onClick={onRemove}
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: 'none',
          background: 'transparent',
          color: '#9ca3af',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <XCircle size={13} />
      </button>
    </span>
  );

  const vitales = [
    { label: 'Peso', unit: 'kg', key: 'peso', ph: '0.0' },
    { label: 'Talla', unit: 'm', key: 'talla', ph: '1.70' },
    { label: 'Temp.', unit: '°C', key: 'temp', ph: '36.5' },
    { label: 'T/A', unit: 'mmHg', key: 'ta', ph: '120/80' },
    { label: 'F.C.', unit: 'lpm', key: 'fc', ph: '80' },
    { label: 'F.R.', unit: 'rpm', key: 'fr', ph: '18' },
    { label: 'Sat. O₂', unit: '%', key: 'spo2', ph: '98' },
    { label: 'Glucosa', unit: 'mg/dL', key: 'glucosa', ph: '100' },
    { label: 'IMC', unit: '', key: 'imc', ph: '—', readOnly: true },
  ];

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  };

  const cardHeaderStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <div style={{
      maxWidth: 1280,
      margin: '0 auto',
      padding: '20px 16px 48px',
      paddingBottom: kbHeight ? kbHeight + 48 : undefined,
      minHeight: '100%',
    }}>
      {/* ── CABECERA ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: 11,
              fontWeight: 600,
              color: '#6b7280',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={12} /> Volver
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
            Triage
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Captura de signos vitales, alergias y padecimientos
          </p>
        </div>
        <button
          type="button"
          onClick={guardarTriage}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: loading ? '#9ca3af' : '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Guardando...
            </>
          ) : (
            <><Save size={14} /> {editMode ? 'Guardar cambios' : 'Finalizar triage'}</>
          )}
        </button>
      </div>

      {errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          padding: '10px 14px',
          background: '#fff',
          border: '1px solid #fecaca',
          borderRadius: 8,
        }}>
          <XCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
          <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{errorMsg}</p>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            style={{ border: 'none', background: 'transparent', fontSize: 11, fontWeight: 700, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ── PACIENTE ── */}
      <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <AvatarPaciente sexo={pacienteMeta.sexo} fechaNacimiento={pacienteMeta.fechaNacimiento} size="sm" className="shrink-0" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Paciente
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pacienteNombreFinal || 'Sin paciente seleccionado'}
          </div>
        </div>
      </div>

      {/* ── SIGNOS VITALES ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={cardHeaderStyle}>
          <Activity size={15} color="#6b7280" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Exploración física</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Signos vitales y antropometría</div>
          </div>
        </div>
        <div
          className="triage-vitales-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 8,
            padding: 12,
          }}
        >
          {vitales.map((f) => {
            const isActive = activeField === f.key;
            return (
              <label
                key={f.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  margin: 0,
                  cursor: f.readOnly ? 'default' : 'text',
                }}
              >
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                }}>
                  {f.label}
                  {f.unit ? <span style={{ fontWeight: 600, color: '#d1d5db' }}>{f.unit}</span> : null}
                </span>
                <input
                  type="text"
                  inputMode="none"
                  readOnly={f.readOnly}
                  placeholder={f.ph}
                  value={signos[f.key]}
                  onFocus={() => handleFieldFocus(f.key)}
                  onChange={(e) => setSignos({ ...signos, [f.key]: e.target.value })}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 10px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: f.readOnly ? '#6b7280' : '#111',
                    background: f.readOnly ? '#fafafa' : '#fff',
                    border: `1px solid ${isActive ? '#111' : '#e5e7eb'}`,
                    borderRadius: 6,
                    outline: 'none',
                    fontFamily: 'Sora, system-ui, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
            );
          })}
        </div>
        <style>{`
          @media (max-width: 900px) {
            .triage-vitales-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          }
          @media (max-width: 520px) {
            .triage-vitales-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          }
        `}</style>
      </div>

      {/* ── ALERGIAS + ENFERMEDADES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Alergias */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <FlaskConical size={15} color="#6b7280" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Alergias</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Sustancias y categorías</div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <NegadosToggle
              checked={alergias.preguntados_y_negados}
              onChange={(v) => setAlergias((prev) => ({ ...prev, preguntados_y_negados: v }))}
              label="El paciente niega cualquier alergia"
            />

            {!alergias.preguntados_y_negados && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', padding: 3, alignSelf: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={() => setAlergias((prev) => ({ ...prev, buscar_sustancia: false }))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: !alergias.buscar_sustancia ? '#fff' : '#4b5563',
                      background: !alergias.buscar_sustancia ? '#111' : 'transparent',
                      fontFamily: 'inherit',
                    }}
                  >
                    Categoría
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlergias((prev) => ({ ...prev, buscar_sustancia: true }))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: alergias.buscar_sustancia ? '#fff' : '#4b5563',
                      background: alergias.buscar_sustancia ? '#111' : 'transparent',
                      fontFamily: 'inherit',
                    }}
                  >
                    Sustancia
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {!alergias.buscar_sustancia ? (
                    <select
                      style={{ ...inputBase, flex: 1 }}
                      value={tempAlergia}
                      onChange={(e) => setTempAlergia(e.target.value)}
                    >
                      <option value="">Seleccionar categoría...</option>
                      {CATS_ALERGIAS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input
                      style={{ ...inputBase, flex: 1 }}
                      placeholder="Nombre de sustancia..."
                      value={tempAlergia}
                      onChange={(e) => setTempAlergia(e.target.value)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (tempAlergia.trim()) {
                        setAlergias((prev) => ({ ...prev, lista: [...prev.lista, { sustancia: tempAlergia.trim() }] }));
                        setTempAlergia('');
                      }
                    }}
                    style={{
                      width: 42,
                      height: 42,
                      flexShrink: 0,
                      background: '#111',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 28 }}>
                  {alergias.lista.map((a, i) => (
                    <Chip
                      key={i}
                      text={a.sustancia}
                      onRemove={() => setAlergias((prev) => ({ ...prev, lista: prev.lista.filter((_, idx) => idx !== i) }))}
                    />
                  ))}
                  {alergias.lista.length === 0 && (
                    <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>Sin alergias registradas</span>
                  )}
                </div>

                <textarea
                  value={alergias.otros}
                  onChange={(e) => setAlergias((prev) => ({ ...prev, otros: e.target.value }))}
                  style={{ ...inputBase, height: 64, resize: 'none', fontSize: 12 }}
                  placeholder="Otras alergias no listadas..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Enfermedades */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <Stethoscope size={15} color="#6b7280" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Enfermedades</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Padecimientos del paciente</div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <NegadosToggle
              checked={enfermedades.preguntados_y_negados}
              onChange={(v) => setEnfermedades((prev) => ({ ...prev, preguntados_y_negados: v }))}
              label="El paciente niega padecer alguna enfermedad"
            />

            {!enfermedades.preguntados_y_negados && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    style={{ ...inputBase, flex: 1 }}
                    value={tempEnfermedad}
                    onChange={(e) => setTempEnfermedad(e.target.value)}
                  >
                    <option value="">Seleccionar enfermedad...</option>
                    {ENFERMEDADES_COMUNES.filter((e) => !enfermedades.lista.includes(e)).map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (tempEnfermedad.trim()) {
                        setEnfermedades((prev) => ({ ...prev, lista: [...prev.lista, tempEnfermedad.trim()] }));
                        setTempEnfermedad('');
                      }
                    }}
                    style={{
                      width: 42,
                      height: 42,
                      flexShrink: 0,
                      background: '#111',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 28 }}>
                  {enfermedades.lista.map((enf, i) => (
                    <Chip
                      key={i}
                      text={enf}
                      onRemove={() => setEnfermedades((prev) => ({ ...prev, lista: prev.lista.filter((_, idx) => idx !== i) }))}
                    />
                  ))}
                  {enfermedades.lista.length === 0 && (
                    <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>Sin enfermedades registradas</span>
                  )}
                </div>

                <textarea
                  value={enfermedades.otros}
                  onChange={(e) => setEnfermedades((prev) => ({ ...prev, otros: e.target.value }))}
                  style={{ ...inputBase, height: 64, resize: 'none', fontSize: 12 }}
                  placeholder="Otras enfermedades o padecimientos..."
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL ÉXITO ── */}
      {showSuccess && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div
            onClick={() => navigate('/enfermeria/dashboard')}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)' }}
          />
          <div style={{
            position: 'relative',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 28,
            maxWidth: 360,
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{
              width: 52,
              height: 52,
              background: '#f0fdf4',
              color: '#16a34a',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              <CheckCircle size={26} strokeWidth={2.5} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', fontFamily: 'Sora, system-ui, sans-serif', margin: 0 }}>
              Listo
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 20px' }}>
              {editMode ? 'Triage actualizado correctamente.' : 'Información registrada correctamente.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/enfermeria/dashboard')}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Volver a la agenda
            </button>
          </div>
        </div>
      )}

      <VirtualKeyboard
        visible={showKeyboard}
        onClose={() => { setShowKeyboard(false); setActiveField(null); setKbHeight(0); }}
        layout={activeField === 'ta' ? 'bloodpressure' : 'signs'}
        onKeyPress={handleKeyPress}
        onHeightChange={setKbHeight}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Triage;