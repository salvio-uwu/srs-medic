import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Activity, ClipboardList, FlaskConical, Stethoscope, AlertCircle,
  ChevronDown, Shield, Scissors, Loader2
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

// ─── DATOS DEFAULT ────────────────────────────────────────
const DEFAULT_HEREDITARIOS = {
  diabetes: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  hipertension: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  cardiopatia: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  hepatopatia: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  nefropatia: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  mentales: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  alergicas: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  endocrinas: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  asma: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  cancer: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  negados: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  obesidad: { mama: false, papa: false, hermanos: false, tios: false, primos: false, abuelos: false },
  otros: ""
};

const DEFAULT_ANTECEDENTES = {
  hereditarios: DEFAULT_HEREDITARIOS,
  no_patologicos: { bano: "", lavado_dientes: "", habitacion: "", alimentacion: "", sedentarismo: "", otros: "" },
  patologicos: {
    actuales: "", quirurgicos: "", transfusionales: "", traumaticos: "", hospitalizaciones: "",
    adicciones: { tabaquismo: false, alcohol: false, drogas: false, detalle: "" },
    especificos: { glaucoma: "", calculo: "", reflujo: "", incontinencia: "", dislipidemias: "", otro: "" }
  },
  aparatos: {
    digestivo: "", cardiovascular: "", respiratorio: "", urinario: "", genital: "", hematologico: "",
    endocrino: "", osteomuscular: "", nervioso: "", sensorial: "", psicosomatico: "", otro: ""
  },
  alergias: { tipo: "Medicamento", buscar_sustancia: false, lista: [], otros: "", preguntados_y_negados: false },
  vacunas: { lista: [], otras: "" },
  cirugias: { lista: [] },
  cie10: []
};

const CATS_ALERGIAS = [
  'Medicamento', 'Alimento', 'Ambiental', 'Insecto', 'Látex',
  'Animal', 'Químico', 'Polen', 'Polvo', 'Metal', 'Colorante', 'Fragancia', 'Otro'
];

const FAMILIARES = ['mama', 'papa', 'hermanos', 'tios', 'primos', 'abuelos'];
const FAMILIARES_LABEL = ['Mamá', 'Papá', 'Hnos', 'Tíos', 'Primos', 'Abuelos'];

// ─── Tabs ─────────────────────────────────────────────────
const TABS = [
  { id: 'hereditarios', label: 'Hereditarios', icon: Activity },
  { id: 'patologicos', label: 'Patológicos', icon: FlaskConical },
  { id: 'no_patologicos', label: 'No Patológicos', icon: ClipboardList },
  { id: 'alergias', label: 'Alergias', icon: AlertCircle },
  { id: 'aparatos', label: 'Aparatos', icon: Stethoscope },
  { id: 'vacunas', label: 'Vacunas', icon: Shield },
  { id: 'cirugias', label: 'Cirugías', icon: Scissors },
];

const AntecedentesRapidos = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pacienteId, pacienteNombre, citaId } = state || {};

  const [antecedentes, setAntecedentes] = useState(DEFAULT_ANTECEDENTES);
  const [activeTab, setActiveTab] = useState('hereditarios');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Temp inputs
  const [tempAlergia, setTempAlergia] = useState('');
  const [tempVacuna, setTempVacuna] = useState({ nombre: '', fecha: '', nota: '' });
  const [tempCirugia, setTempCirugia] = useState({ procedimiento: '', nota: '', ano: '' });

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Deep updater
  const updateCampo = useCallback((path, value) => {
    setAntecedentes(prev => {
      const keys = path.split('.');
      const updateDeep = (obj, [key, ...rest], val) => {
        if (rest.length === 0) return { ...obj, [key]: val };
        return { ...obj, [key]: updateDeep(obj[key] || {}, rest, val) };
      };
      return updateDeep(prev, keys, value);
    });
  }, []);

  // ─── CARGA ──────────────────────────────────────────────
  useEffect(() => {
    if (!pacienteId) return;
    const fetchData = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'historial_clinico'), where('pacienteId', '==', pacienteId), orderBy('fecha', 'desc'), limit(1))
        );
        if (!snap.empty) {
          const ultimo = snap.docs[0].data();
          if (ultimo.antecedentes) {
            setAntecedentes(prev => ({
              ...prev,
              ...ultimo.antecedentes,
              hereditarios: { ...DEFAULT_HEREDITARIOS, ...(ultimo.antecedentes.hereditarios || {}) }
            }));
          }
        }
      } catch (err) {
        console.error('Error cargando antecedentes:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [pacienteId]);

  // ─── GUARDAR ────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!pacienteId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'historial_clinico'), {
        pacienteId,
        pacienteNombre: pacienteNombre || '',
        antecedentes,
        fecha: serverTimestamp(),
        soloAntecedentes: true,
        editadoPor: user?.nombre || 'Enfermería',
        editadoPorRol: user?.role || 'enfermeria',
        citaIdOrigen: citaId || null
      });
      showToast('Antecedentes guardados correctamente');
      setTimeout(() => navigate(-1), 800);
    } catch (err) {
      console.error('Error guardando antecedentes:', err);
      showToast('Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!pacienteId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No se recibió información del paciente.</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 text-sm font-bold hover:underline">Volver</button>
        </div>
      </div>
    );
  }

  // ─── STYLES ─────────────────────────────────────────────
  const inputClass = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-colors text-sm font-medium text-slate-700 placeholder:text-slate-400";
  const labelClass = "text-[10px] font-bold text-slate-500 uppercase mb-1.5 block tracking-widest";

  // ─── RENDER SECTIONS ───────────────────────────────────
  const renderHereditarios = () => (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left pl-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-36">Padecimiento</th>
              {FAMILIARES_LABEL.map(f => (
                <th key={f} className="text-center py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{f}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(antecedentes.hereditarios || {}).filter(k => k !== 'otros').map(enf => (
              <tr key={enf} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="pl-4 py-2.5 text-xs font-bold text-slate-700 capitalize">{enf.replace('_', ' ')}</td>
                {FAMILIARES.map(fam => (
                  <td key={fam} className="text-center py-2.5">
                    <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      checked={antecedentes.hereditarios?.[enf]?.[fam] || false}
                      onChange={e => updateCampo(`hereditarios.${enf}.${fam}`, e.target.checked)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label className={labelClass}>Otros</label>
        <textarea className={`${inputClass} h-20 resize-none`} value={antecedentes.hereditarios?.otros || ''} onChange={e => updateCampo('hereditarios.otros', e.target.value)} />
      </div>
    </div>
  );

  const renderPatologicos = () => {
    const pat = antecedentes.patologicos || {};
    const fields = [
      { label: 'Enfermedades actuales', key: 'actuales' },
      { label: 'Quirúrgicos', key: 'quirurgicos' },
      { label: 'Transfusionales', key: 'transfusionales' },
      { label: 'Traumáticos', key: 'traumaticos' },
      { label: 'Hospitalizaciones', key: 'hospitalizaciones' },
    ];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className={labelClass}>{f.label}</label>
              <textarea className={`${inputClass} h-20 resize-none`} value={pat[f.key] || ''} onChange={e => updateCampo(`patologicos.${f.key}`, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <label className={labelClass}>Adicciones</label>
          <div className="flex gap-6 mt-2">
            {['tabaquismo', 'alcohol', 'drogas'].map(a => (
              <label key={a} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  checked={pat.adicciones?.[a] || false}
                  onChange={e => updateCampo(`patologicos.adicciones.${a}`, e.target.checked)} />
                <span className="capitalize font-medium">{a}</span>
              </label>
            ))}
          </div>
          <textarea className={`${inputClass} h-16 resize-none mt-3`} placeholder="Detalle de adicciones..."
            value={pat.adicciones?.detalle || ''} onChange={e => updateCampo('patologicos.adicciones.detalle', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Específicos</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['glaucoma', 'calculo', 'reflujo', 'incontinencia', 'dislipidemias', 'otro'].map(k => (
              <div key={k}>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block capitalize">{k}</label>
                <input className={inputClass} value={pat.especificos?.[k] || ''} onChange={e => updateCampo(`patologicos.especificos.${k}`, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderNoPatologicos = () => {
    const np = antecedentes.no_patologicos || {};
    const items = [
      { label: 'Baño', key: 'bano', opts: ['Diario', 'Cada 3er día', 'Irregular'] },
      { label: 'Lavado de dientes', key: 'lavado_dientes', opts: ['Buena', 'Regular', 'Mala'] },
      { label: 'Habitación', key: 'habitacion', opts: ['Buena', 'Regular', 'Mala'] },
      { label: 'Alimentación', key: 'alimentacion', opts: ['Buena', 'Regular', 'Mala'] },
      { label: 'Sedentarismo', key: 'sedentarismo', opts: ['Si', 'No'] },
    ];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.key} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <label className={labelClass}>{item.label}</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {item.opts.map(opt => (
                  <button key={opt} type="button"
                    onClick={() => updateCampo(`no_patologicos.${item.key}`, opt)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      np[item.key] === opt ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className={labelClass}>Otros</label>
          <textarea className={`${inputClass} h-20 resize-none`} value={np.otros || ''} onChange={e => updateCampo('no_patologicos.otros', e.target.value)} />
        </div>
      </div>
    );
  };

  const renderAlergias = () => {
    const al = antecedentes.alergias || {};
    return (
      <div className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded"
            checked={al.preguntados_y_negados || false}
            onChange={e => updateCampo('alergias.preguntados_y_negados', e.target.checked)} />
          <span className="text-sm font-bold text-slate-700">Preguntados y negados</span>
        </label>

        {!al.preguntados_y_negados && (
          <>
            <div>
              <label className={labelClass}>Categoría</label>
              <div className="flex flex-wrap gap-1.5">
                {CATS_ALERGIAS.map(c => (
                  <button key={c} type="button"
                    onClick={() => updateCampo('alergias.tipo', c)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      al.tipo === c ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input className={`${inputClass} flex-1`} placeholder="Escribir sustancia o alergia..."
                value={tempAlergia} onChange={e => setTempAlergia(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tempAlergia.trim()) {
                    updateCampo('alergias.lista', [...(al.lista || []), { sustancia: tempAlergia.trim() }]);
                    setTempAlergia('');
                  }
                }} />
              <button type="button" disabled={!tempAlergia.trim()}
                onClick={() => { updateCampo('alergias.lista', [...(al.lista || []), { sustancia: tempAlergia.trim() }]); setTempAlergia(''); }}
                className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-all disabled:opacity-40">
                Agregar
              </button>
            </div>

            {al.lista?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {al.lista.map((a, i) => (
                  <span key={i} className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                    {a.sustancia}
                    <button type="button" onClick={() => updateCampo('alergias.lista', al.lista.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600">×</button>
                  </span>
                ))}
              </div>
            )}

            <div>
              <label className={labelClass}>Otras alergias</label>
              <textarea className={`${inputClass} h-16 resize-none`} value={al.otros || ''} onChange={e => updateCampo('alergias.otros', e.target.value)} />
            </div>
          </>
        )}
      </div>
    );
  };

  const renderAparatos = () => {
    const ap = antecedentes.aparatos || {};
    const systems = [
      'digestivo', 'cardiovascular', 'respiratorio', 'urinario', 'genital', 'hematologico',
      'endocrino', 'osteomuscular', 'nervioso', 'sensorial', 'psicosomatico', 'otro'
    ];
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {systems.map(s => (
          <div key={s}>
            <label className={labelClass}>{s.charAt(0).toUpperCase() + s.slice(1)}</label>
            <textarea className={`${inputClass} h-16 resize-none`} value={ap[s] || ''} onChange={e => updateCampo(`aparatos.${s}`, e.target.value)} />
          </div>
        ))}
      </div>
    );
  };

  const renderVacunas = () => {
    const vac = antecedentes.vacunas || {};
    return (
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input className={`${inputClass} flex-1`} placeholder="Nombre de vacuna" value={tempVacuna.nombre} onChange={e => setTempVacuna(p => ({ ...p, nombre: e.target.value }))} />
          <input type="date" className={`${inputClass} w-36`} value={tempVacuna.fecha} onChange={e => setTempVacuna(p => ({ ...p, fecha: e.target.value }))} />
          <input className={`${inputClass} flex-1`} placeholder="Nota" value={tempVacuna.nota} onChange={e => setTempVacuna(p => ({ ...p, nota: e.target.value }))} />
          <button type="button" disabled={!tempVacuna.nombre.trim()}
            onClick={() => {
              updateCampo('vacunas.lista', [...(vac.lista || []), { ...tempVacuna, seAplicoAqui: false }]);
              setTempVacuna({ nombre: '', fecha: '', nota: '' });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-40 shrink-0">
            Agregar
          </button>
        </div>
        {vac.lista?.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="text-left pl-4 py-2.5">Vacuna</th><th className="text-left py-2.5">Fecha</th><th className="text-left py-2.5">Nota</th><th className="w-10"></th>
              </tr></thead>
              <tbody>
                {vac.lista.map((v, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="pl-4 py-2 text-xs font-medium text-slate-700">{v.nombre}</td>
                    <td className="py-2 text-xs text-slate-500">{v.fecha || '—'}</td>
                    <td className="py-2 text-xs text-slate-500">{v.nota || '—'}</td>
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => updateCampo('vacunas.lista', vac.lista.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div>
          <label className={labelClass}>Otras vacunas</label>
          <textarea className={`${inputClass} h-16 resize-none`} value={vac.otras || ''} onChange={e => updateCampo('vacunas.otras', e.target.value)} />
        </div>
      </div>
    );
  };

  const renderCirugias = () => {
    const cir = antecedentes.cirugias || {};
    return (
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input className={`${inputClass} flex-1`} placeholder="Procedimiento" value={tempCirugia.procedimiento} onChange={e => setTempCirugia(p => ({ ...p, procedimiento: e.target.value }))} />
          <input className={`${inputClass} w-20`} placeholder="Año" value={tempCirugia.ano} onChange={e => setTempCirugia(p => ({ ...p, ano: e.target.value }))} />
          <input className={`${inputClass} flex-1`} placeholder="Nota" value={tempCirugia.nota} onChange={e => setTempCirugia(p => ({ ...p, nota: e.target.value }))} />
          <button type="button" disabled={!tempCirugia.procedimiento.trim()}
            onClick={() => {
              updateCampo('cirugias.lista', [...(cir.lista || []), { id: Date.now(), ...tempCirugia, fechaRegistro: tempCirugia.ano, tipoFecha: 'ano' }]);
              setTempCirugia({ procedimiento: '', nota: '', ano: '' });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-40 shrink-0">
            Agregar
          </button>
        </div>
        {cir.lista?.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="text-left pl-4 py-2.5">Procedimiento</th><th className="text-left py-2.5">Año</th><th className="text-left py-2.5">Nota</th><th className="w-10"></th>
              </tr></thead>
              <tbody>
                {cir.lista.map((c, i) => (
                  <tr key={c.id || i} className="border-t border-slate-100">
                    <td className="pl-4 py-2 text-xs font-medium text-slate-700">{c.procedimiento}</td>
                    <td className="py-2 text-xs text-slate-500">{c.fechaRegistro || c.ano || '—'}</td>
                    <td className="py-2 text-xs text-slate-500">{c.nota || '—'}</td>
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => updateCampo('cirugias.lista', cir.lista.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const sectionRenderers = {
    hereditarios: renderHereditarios,
    patologicos: renderPatologicos,
    no_patologicos: renderNoPatologicos,
    alergias: renderAlergias,
    aparatos: renderAparatos,
    vacunas: renderVacunas,
    cirugias: renderCirugias,
  };

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex flex-col">
      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-4 shrink-0 sticky top-0 z-20 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-black text-slate-800 truncate">Edición de Antecedentes</h1>
          <p className="text-xs text-slate-400 font-medium truncate">{pacienteNombre}</p>
        </div>
        <button onClick={handleGuardar} disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-[0.97] transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar'}</span>
        </button>
      </header>

      {/* ─── TABS ─── */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 overflow-x-auto shrink-0">
        <div className="flex gap-1 min-w-max py-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                }`}>
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── CONTENT ─── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            {sectionRenderers[activeTab]?.()}
          </div>
        )}
      </main>

      {/* ─── TOAST ─── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg z-50 transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AntecedentesRapidos;
