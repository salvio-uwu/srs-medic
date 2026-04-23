import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calculator,
  Baby,
  Weight,
  Droplets,
  AlertTriangle,
  RotateCcw,
  Search,
  Pill,
  Loader2,
  Ruler,
  ShieldCheck,
  FlaskConical,
  Sparkles,
  CheckCircle2,
  PencilLine,
  Info,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const PEDIATRIC_REFERENCE_LIBRARY = [
  { aliases: ['amoxicilina'], dosisKg: 50, unidad: 'mg', frecuencia: 'c/8h', maxDia: 3000, nota: 'Infecciones de vías respiratorias altas.' },
  { aliases: ['ibuprofeno'], dosisKg: 10, unidad: 'mg', frecuencia: 'c/8h', maxDia: 1200, nota: 'Antiinflamatorio y antipirético.' },
  { aliases: ['paracetamol', 'acetaminofen', 'acetaminophen'], dosisKg: 15, unidad: 'mg', frecuencia: 'c/6h', maxDia: 4000, nota: 'Analgésico y antipirético.' },
  { aliases: ['amikacina'], dosisKg: 15, unidad: 'mg', frecuencia: 'c/24h', maxDia: 1500, nota: 'Monitorear función renal.' },
  { aliases: ['cefalexina'], dosisKg: 25, unidad: 'mg', frecuencia: 'c/6h', maxDia: 4000, nota: 'Cefalosporina de primera generación.' },
  { aliases: ['azitromicina'], dosisKg: 10, unidad: 'mg', frecuencia: 'c/24h', maxDia: 500, nota: 'Macrólido.' },
  { aliases: ['trimetoprima', 'sulfametoxazol', 'trimetoprima/sulfa', 'tmp'], dosisKg: 8, unidad: 'mg', frecuencia: 'c/12h', maxDia: 320, nota: 'Dosis basada en trimetoprima.' },
  { aliases: ['metronidazol'], dosisKg: 30, unidad: 'mg', frecuencia: 'c/8h', maxDia: 2000, nota: 'Infecciones por anaerobios y parasitosis.' },
  { aliases: ['prednisolona'], dosisKg: 1, unidad: 'mg', frecuencia: 'c/24h', maxDia: 60, nota: 'Corticoide, validar duración.' },
  { aliases: ['salbutamol'], dosisKg: 0.15, unidad: 'mg', frecuencia: 'c/6h', maxDia: 5, nota: 'Nebulización pediátrica.' },
  { aliases: ['ceftriaxona'], dosisKg: 50, unidad: 'mg', frecuencia: 'c/24h IV/IM', maxDia: 4000, nota: 'Reservar uso hospitalario si aplica.' },
  { aliases: ['omeprazol'], dosisKg: 1, unidad: 'mg', frecuencia: 'c/24h', maxDia: 40, nota: 'Inhibidor de bomba de protones.' },
  { aliases: ['ondansetron', 'ondansetron', 'ondansetron'], dosisKg: 0.15, unidad: 'mg', frecuencia: 'c/8h', maxDia: 16, nota: 'Antiemético.' },
  { aliases: ['clindamicina'], dosisKg: 30, unidad: 'mg', frecuencia: 'c/8h', maxDia: 1800, nota: 'Piel, tejidos blandos y anaerobios.' },
  { aliases: ['dicloxacilina'], dosisKg: 25, unidad: 'mg', frecuencia: 'c/6h', maxDia: 2000, nota: 'Cobertura para estafilococo sensible.' },
];

let cachedCatalogMedications = null;

const normalizeSearchText = (value = '') => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const sanitizeDecimalInput = (value = '') => {
  const cleaned = String(value || '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');

  if (firstDot === -1) return cleaned;

  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
};

const parseDecimalInput = (value = '') => {
  const normalized = sanitizeDecimalInput(value);
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value, options = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '--';
  return parsed.toLocaleString('es-MX', {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });
};

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
};

const parsePossibleDate = (value) => {
  if (!value) return null;
  if (value?.toDate) {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateAgeLabel = (explicitAge = '', birthdate = '') => {
  const cleanAge = String(explicitAge || '').trim();
  if (cleanAge) return cleanAge;

  const birth = parsePossibleDate(birthdate);
  if (!birth) return '';

  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years -= 1;
  if (years > 0) return `${years} años`;

  const months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (months > 0) return `${months} meses`;
  return 'Recién nacido';
};

const normalizeCatalogMedication = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const nombreComercial = pickFirstNonEmpty(raw.medicamento, raw.nombreComercial, raw['*NOMBRE COMERCIAL']);
  const grupo = pickFirstNonEmpty(raw.grupo, raw.marca, raw['*MARCA']);
  const laboratorio = pickFirstNonEmpty(raw['*NOMBRE DEL LABORATORIO'], raw.laboratorio);
  const sustanciasActivas = pickFirstNonEmpty(raw['*SUSTANCIA(S) ACTIVA(S)'], raw.sustanciasActivas, raw.sustanciaActiva);
  const presentacion = pickFirstNonEmpty(raw['*PRESENTACIÓN'], raw['*PRESENTACION'], raw.presentacion);
  const dosisCatalogo = pickFirstNonEmpty(raw.DOSIS, raw.dosis);
  const indicacion = pickFirstNonEmpty(raw.INDICACION, raw.indicacion);
  const advertencia = pickFirstNonEmpty(raw['ADVERTENCIA '], raw.advertencia, raw.CONTRAINDICACIONES, raw.contraindicaciones);
  const embarazo = pickFirstNonEmpty(raw.EMBARAZO, raw.embarazo);
  const numeroAcomodo = pickFirstNonEmpty(raw.numeroAcomodo, raw.numero_acomodo);
  const color = String(raw.color || '').trim();
  const source = `${grupo} ${nombreComercial}`;
  const match = source.match(/(\d)\s*$/);
  const nivelUtilidad = match ? Number(match[1]) : Number(raw.nivelUtilidad || raw.nivel || 3);

  return {
    id: String(raw.id || '').trim(),
    nombreComercial: String(nombreComercial).trim(),
    grupo: String(grupo).trim(),
    marca: String(grupo).trim(),
    laboratorio: String(laboratorio).trim(),
    sustanciasActivas: String(sustanciasActivas).trim(),
    presentacion: String(presentacion).trim(),
    dosisCatalogo: String(dosisCatalogo).trim(),
    indicacion: String(indicacion).trim(),
    advertencia: String(advertencia).trim(),
    embarazo: String(embarazo).trim(),
    numeroAcomodo: String(numeroAcomodo).trim(),
    color,
    nivelUtilidad: [1, 2, 3, 4, 5].includes(nivelUtilidad) ? nivelUtilidad : 3,
    activo: raw.activo !== false,
  };
};

const extractReferenceFromCatalogText = (text = '') => {
  const normalized = String(text || '').replace(/,/g, '.').toLowerCase();
  const dosisMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|ui|ml)\s*\/\s*kg/);
  if (!dosisMatch) return null;

  const frecuenciaMatch = normalized.match(/c\/?\s*(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*h/)
    || normalized.match(/cada\s*(\d+(?:\.\d+)?)\s*h/);
  const maxDiaMatch = normalized.match(/(?:max|máx|maximo|máximo)[^\d]*(\d+(?:\.\d+)?)\s*(mg|mcg|ui|ml)\/?(?:dia|d[ií]a)?/);

  return {
    dosisKg: Number.parseFloat(dosisMatch[1]),
    unidad: dosisMatch[2].toLowerCase() === 'ml' ? 'mL' : dosisMatch[2],
    frecuencia: frecuenciaMatch ? `c/${frecuenciaMatch[1]}h` : 'c/24h',
    maxDia: maxDiaMatch ? Number.parseFloat(maxDiaMatch[1]) : null,
    nota: 'Referencia detectada desde el texto de dosis del catálogo.',
    origen: 'catalogo',
  };
};

const resolveDoseReference = (medication) => {
  if (!medication) return null;

  const haystack = normalizeSearchText([
    medication.nombreComercial,
    medication.sustanciasActivas,
    medication.grupo,
    medication.marca,
  ].filter(Boolean).join(' '));

  const matched = PEDIATRIC_REFERENCE_LIBRARY.find((item) => item.aliases.some((alias) => haystack.includes(normalizeSearchText(alias))));
  if (matched) return { ...matched, origen: 'biblioteca' };

  return extractReferenceFromCatalogText(medication.dosisCatalogo);
};

const getDailyFactor = (frequency = '') => {
  const normalized = normalizeSearchText(frequency).replace(/\s+/g, '');
  const match = normalized.match(/c\/(\d+(?:\.\d+)?)(?:-\d+(?:\.\d+)?)?h/);
  if (match) {
    const hours = Number.parseFloat(match[1]);
    if (Number.isFinite(hours) && hours > 0) return 24 / hours;
  }
  if (normalized.includes('24h')) return 1;
  return 1;
};

const buildPatientContext = (patientData = {}) => ({
  peso: sanitizeDecimalInput(pickFirstNonEmpty(
    patientData?.peso,
    patientData?.pesoKg,
    patientData?.antropometria?.peso,
    patientData?.exploracion?.antropometria?.peso,
    patientData?.consulta?.exploracion?.antropometria?.peso,
  )),
  talla: sanitizeDecimalInput(pickFirstNonEmpty(
    patientData?.talla,
    patientData?.tallaM,
    patientData?.estatura,
    patientData?.antropometria?.talla,
    patientData?.exploracion?.antropometria?.talla,
    patientData?.consulta?.exploracion?.antropometria?.talla,
  )),
  imc: sanitizeDecimalInput(pickFirstNonEmpty(
    patientData?.imc,
    patientData?.antropometria?.imc,
    patientData?.exploracion?.antropometria?.imc,
    patientData?.consulta?.exploracion?.antropometria?.imc,
  )),
  sexo: pickFirstNonEmpty(patientData?.sexo),
  edad: calculateAgeLabel(
    patientData?.edad,
    pickFirstNonEmpty(patientData?.fecha_nacimiento, patientData?.fechaNacimiento, patientData?.nacimiento)
  ),
});

const Badge = ({ icon, label, value, tone = 'slate' }) => {
  const palette = {
    slate: 'border-slate-200 bg-white text-slate-600',
    blue: 'border-blue-200 bg-blue-50/60 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-700',
  };

  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${palette[tone] || palette.slate}`}>
      <span className="opacity-60">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
        <div className="truncate text-xs font-semibold">{value || 'No disponible'}</div>
      </div>
    </div>
  );
};

const DecimalInput = ({ label, value, onChange, placeholder, suffix, hint }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-12 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{suffix}</span>}
    </div>
    {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
  </label>
);

const CalculadoraDosisModal = ({ onClose, onBackToMenu, pacienteNombre, pacienteData }) => {
  const patientContext = useMemo(() => buildPatientContext(pacienteData), [pacienteData]);

  const [modo, setModo] = useState('pediatrica');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [medications, setMedications] = useState([]);
  const [medicationQuery, setMedicationQuery] = useState('');
  const [selectedMedicationId, setSelectedMedicationId] = useState('');
  const [peso, setPeso] = useState(patientContext.peso || '');
  const [customReferenceMode, setCustomReferenceMode] = useState(false);
  const [customDosePerKg, setCustomDosePerKg] = useState('');
  const [customUnit, setCustomUnit] = useState('mg');
  const [customFrequency, setCustomFrequency] = useState('');
  const [customMaxDay, setCustomMaxDay] = useState('');
  const [concInicial, setConcInicial] = useState('');
  const [volInicial, setVolInicial] = useState('');
  const [concFinal, setConcFinal] = useState('');
  const [volFinal, setVolFinal] = useState('');
  const [concSolving, setConcSolving] = useState('volFinal');

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError('');

      try {
        if (!cachedCatalogMedications) {
          const snap = await getDocs(collection(db, 'catalogo_medicamentos'));
          cachedCatalogMedications = snap.docs
            .map((doc) => normalizeCatalogMedication({ id: doc.id, ...doc.data() }))
            .filter(Boolean)
            .filter((item) => item.activo !== false && item.nombreComercial)
            .sort((a, b) => a.nombreComercial.localeCompare(b.nombreComercial, 'es', { sensitivity: 'base' }));
        }

        if (!cancelled) setMedications(cachedCatalogMedications);
      } catch (error) {
        console.error('Error cargando catalogo_medicamentos para calculadora', error);
        if (!cancelled) setCatalogError('No se pudo cargar el catálogo de medicamentos.');
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };

    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!peso && patientContext.peso) {
      setPeso(patientContext.peso);
    }
  }, [patientContext.peso, peso]);

  const selectedMedication = useMemo(
    () => medications.find((item) => item.id === selectedMedicationId) || null,
    [medications, selectedMedicationId]
  );

  const detectedReference = useMemo(
    () => resolveDoseReference(selectedMedication),
    [selectedMedication]
  );

  const filteredMedications = useMemo(() => {
    const query = normalizeSearchText(medicationQuery);
    const source = medications.filter((item) => item.activo !== false);
    if (!query) return source.slice(0, 10);

    return source.filter((item) => (
      normalizeSearchText([
        item.nombreComercial,
        item.sustanciasActivas,
        item.presentacion,
        item.grupo,
        item.laboratorio,
        item.numeroAcomodo,
      ].join(' ')).includes(query)
    )).slice(0, 12);
  }, [medicationQuery, medications]);

  const showSearchResults = useMemo(() => {
    if (catalogLoading || catalogError) return false;
    if (!medicationQuery.trim()) return !selectedMedication;
    return normalizeSearchText(medicationQuery) !== normalizeSearchText(selectedMedication?.nombreComercial || '');
  }, [catalogError, catalogLoading, medicationQuery, selectedMedication]);

  const effectiveReference = useMemo(() => {
    if (!selectedMedication) return null;

    if (!customReferenceMode && detectedReference) {
      return detectedReference;
    }

    const dosisKg = parseDecimalInput(customDosePerKg);
    if (!dosisKg || dosisKg <= 0) return null;

    return {
      dosisKg,
      unidad: customUnit || detectedReference?.unidad || 'mg',
      frecuencia: String(customFrequency || detectedReference?.frecuencia || 'c/24h').trim(),
      maxDia: parseDecimalInput(customMaxDay),
      nota: detectedReference?.nota || 'Referencia ajustada manualmente sobre un medicamento del catálogo.',
      origen: 'manual',
    };
  }, [customDosePerKg, customFrequency, customMaxDay, customReferenceMode, customUnit, detectedReference, selectedMedication]);

  const resultado = useMemo(() => {
    const pesoNum = parseDecimalInput(peso);
    if (!selectedMedication || !pesoNum || pesoNum <= 0 || !effectiveReference) return null;

    const dosisPorToma = effectiveReference.dosisKg * pesoNum;
    const dosisDia = dosisPorToma * getDailyFactor(effectiveReference.frecuencia);
    const excede = effectiveReference.maxDia && dosisDia > effectiveReference.maxDia;

    return {
      dosisPorToma,
      dosisDia,
      frecuencia: effectiveReference.frecuencia,
      unidad: effectiveReference.unidad,
      maxDia: effectiveReference.maxDia,
      excede,
      origen: effectiveReference.origen,
    };
  }, [effectiveReference, peso, selectedMedication]);

  const resultadoConc = useMemo(() => {
    const c1 = parseDecimalInput(concInicial);
    const v1 = parseDecimalInput(volInicial);
    const c2 = parseDecimalInput(concFinal);
    const v2 = parseDecimalInput(volFinal);

    if (concSolving === 'volFinal') {
      if (c1 && v1 && c2) return { valor: (c1 * v1) / c2, label: 'Volumen final', unidad: 'mL' };
    }
    if (concSolving === 'concFinal') {
      if (c1 && v1 && v2) return { valor: (c1 * v1) / v2, label: 'Concentración final', unidad: 'mg/mL' };
    }
    if (concSolving === 'volInicial') {
      if (c2 && v2 && c1) return { valor: (c2 * v2) / c1, label: 'Volumen inicial', unidad: 'mL' };
    }

    return null;
  }, [concFinal, concInicial, concSolving, volFinal, volInicial]);

  const selectMedication = (medication) => {
    const nextReference = resolveDoseReference(medication);
    setSelectedMedicationId(medication.id);
    setMedicationQuery(medication.nombreComercial);
    setCustomReferenceMode(!nextReference);
    setCustomDosePerKg(nextReference?.dosisKg ? String(nextReference.dosisKg) : '');
    setCustomUnit(nextReference?.unidad || 'mg');
    setCustomFrequency(nextReference?.frecuencia || '');
    setCustomMaxDay(nextReference?.maxDia ? String(nextReference.maxDia) : '');
  };

  const resetAll = () => {
    setModo('pediatrica');
    setPeso(patientContext.peso || '');
    setMedicationQuery('');
    setSelectedMedicationId('');
    setCustomReferenceMode(false);
    setCustomDosePerKg('');
    setCustomUnit('mg');
    setCustomFrequency('');
    setCustomMaxDay('');
    setConcInicial('');
    setVolInicial('');
    setConcFinal('');
    setVolFinal('');
    setConcSolving('volFinal');
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" style={{ fontFamily: 'Sora, DM Sans, sans-serif' }}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e40af_60%,#2563eb_100%)] px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Calculator size={16} className="shrink-0 text-blue-300" />
                <h3 className="text-base font-bold tracking-tight">Calculadora de Dosis</h3>
              </div>
              <p className="mt-0.5 truncate text-xs font-medium text-white/70">
                {pacienteNombre || 'Paciente sin nombre'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {onBackToMenu && (
                <button onClick={onBackToMenu} className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/90 transition hover:bg-white/20">
                  ← Menú
                </button>
              )}
              <button onClick={resetAll} className="rounded-lg border border-white/15 bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20" title="Reiniciar calculadora">
                <RotateCcw size={14} />
              </button>
              <button onClick={onClose} className="rounded-lg border border-white/15 bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Badge icon={<Baby size={13} />} label="Edad" value={patientContext.edad || 'No disponible'} tone="blue" />
            <Badge icon={<Weight size={13} />} label="Peso" value={patientContext.peso ? `${patientContext.peso} kg` : 'No capturado'} tone="emerald" />
            <Badge icon={<Ruler size={13} />} label="Talla" value={patientContext.talla ? `${patientContext.talla} m` : 'No capturada'} />
            <Badge icon={<Calculator size={13} />} label="IMC / Sexo" value={[patientContext.imc ? `IMC ${patientContext.imc}` : '', patientContext.sexo || 'Sin sexo'].filter(Boolean).join(' · ') || 'No disponible'} />
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setModo('pediatrica')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${modo === 'pediatrica' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
            >
              <Baby size={14} /> Dosis por peso
            </button>
            <button
              onClick={() => setModo('concentracion')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${modo === 'concentracion' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
            >
              <Droplets size={14} /> Concentración / Dilución
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 px-5 py-4">
          {modo === 'pediatrica' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-slate-800">Exploración y selección farmacológica</h4>
                    {patientContext.peso && (
                      <button onClick={() => setPeso(patientContext.peso)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100">
                        <ShieldCheck size={12} /> Usar peso del expediente
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr]">
                    <DecimalInput
                      label="Peso del paciente"
                      value={peso}
                      onChange={setPeso}
                      placeholder="Ej. 12.5"
                      suffix="kg"
                      hint={patientContext.peso ? `Expediente: ${patientContext.peso} kg` : 'Punto o coma decimal.'}
                    />

                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Pill size={12} />
                        Fármaco desde catálogo
                      </div>

                      <div className="relative mt-2">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={medicationQuery}
                          onChange={(e) => {
                            setMedicationQuery(e.target.value);
                            if (selectedMedication && normalizeSearchText(e.target.value) !== normalizeSearchText(selectedMedication.nombreComercial)) {
                              setSelectedMedicationId('');
                            }
                          }}
                          placeholder="Buscar por nombre comercial, sustancia o presentación"
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        {catalogLoading ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-xs font-medium text-slate-500">
                            <Loader2 size={14} className="animate-spin text-blue-500" />
                            Cargando catálogo...
                          </div>
                        ) : catalogError ? (
                          <div className="px-3 py-3 text-xs font-medium text-red-600">{catalogError}</div>
                        ) : showSearchResults ? (
                          <div className="max-h-56 overflow-y-auto p-1.5">
                            {filteredMedications.length > 0 ? filteredMedications.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => selectMedication(item)}
                                className="mb-1 w-full rounded-lg border border-transparent bg-slate-50/80 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50 last:mb-0"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-800">{item.nombreComercial}</div>
                                    <div className="mt-0.5 truncate text-[11px] text-slate-500">{item.sustanciasActivas || item.grupo || 'Sin sustancia activa'}</div>
                                  </div>
                                  {item.numeroAcomodo && <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">#{item.numeroAcomodo}</span>}
                                </div>
                                {item.presentacion && <div className="mt-1 truncate text-[11px] text-slate-400">{item.presentacion}</div>}
                              </button>
                            )) : (
                              <div className="px-3 py-3 text-xs text-slate-400">No hay coincidencias en el catálogo.</div>
                            )}
                          </div>
                        ) : (
                          <div className="px-3 py-2.5 text-xs text-emerald-700">
                            Fármaco seleccionado. Busca otro nombre arriba para cambiarlo.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {selectedMedication && (
                  <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Medicamento seleccionado</p>
                        <h4 className="mt-0.5 text-sm font-bold text-slate-900">{selectedMedication.nombreComercial}</h4>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{selectedMedication.sustanciasActivas || 'Sin sustancia activa capturada'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMedicationId('');
                          setMedicationQuery('');
                          setCustomReferenceMode(false);
                          setCustomDosePerKg('');
                          setCustomUnit('mg');
                          setCustomFrequency('');
                          setCustomMaxDay('');
                        }}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        Limpiar
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="rounded-lg border border-white bg-white/80 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Presentación</p>
                        <p className="mt-1 text-xs font-medium text-slate-700">{selectedMedication.presentacion || 'No especificada'}</p>
                      </div>
                      <div className="rounded-lg border border-white bg-white/80 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dosis catálogo</p>
                        <p className="mt-1 whitespace-pre-line text-xs font-medium text-slate-700">{selectedMedication.dosisCatalogo || 'Sin dosis en catálogo.'}</p>
                      </div>
                    </div>

                    {(selectedMedication.indicacion || selectedMedication.advertencia || selectedMedication.embarazo) && (
                      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
                        {selectedMedication.indicacion && (
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Indicación</p>
                            <p className="mt-1 text-[11px] font-medium text-emerald-800">{selectedMedication.indicacion}</p>
                          </div>
                        )}
                        {selectedMedication.advertencia && (
                          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Advertencia</p>
                            <p className="mt-1 text-[11px] font-medium text-amber-800">{selectedMedication.advertencia}</p>
                          </div>
                        )}
                        {selectedMedication.embarazo && (
                          <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Embarazo</p>
                            <p className="mt-1 text-[11px] font-medium text-rose-800">{selectedMedication.embarazo}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>

              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-bold text-slate-800">Referencia terapéutica</h4>
                    {selectedMedication && (
                      <button
                        type="button"
                        onClick={() => setCustomReferenceMode((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${customReferenceMode ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border border-slate-200 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-700'}`}
                      >
                        <PencilLine size={12} /> {customReferenceMode ? 'Usar detectada' : 'Ajustar'}
                      </button>
                    )}
                  </div>

                  {!selectedMedication ? (
                    <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                      Selecciona un medicamento del catálogo para habilitar el cálculo por peso.
                    </div>
                  ) : (
                    <>
                      {detectedReference && !customReferenceMode && (
                        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                            <Sparkles size={12} />
                            {detectedReference.origen === 'catalogo' ? 'Referencia del catálogo' : 'Referencia clínica'}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-white px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dosis / kg</p>
                              <p className="mt-0.5 text-sm font-bold text-slate-800">{formatNumber(detectedReference.dosisKg, { maximumFractionDigits: 2 })} {detectedReference.unidad}/kg</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Frecuencia</p>
                              <p className="mt-0.5 text-sm font-bold text-slate-800">{detectedReference.frecuencia}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] font-medium text-blue-700">{detectedReference.nota}</p>
                        </div>
                      )}

                      {(!detectedReference || customReferenceMode) && (
                        <div className="mt-3 space-y-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                          <div className="flex items-start gap-1.5 text-[11px] font-medium text-amber-800">
                            <Info size={13} className="mt-0.5 shrink-0" />
                            <span>
                              {detectedReference
                                ? 'Ajusta la referencia sin cambiar el medicamento seleccionado.'
                                : 'Sin referencia pediátrica estructurada. Completa los campos para calcular.'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <DecimalInput label="Dosis por kg" value={customDosePerKg} onChange={setCustomDosePerKg} placeholder="Ej. 50" suffix={customUnit} />
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unidad</span>
                              <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                                <option value="mg">mg</option>
                                <option value="mcg">mcg</option>
                                <option value="mL">mL</option>
                                <option value="UI">UI</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Frecuencia</span>
                              <input
                                type="text"
                                value={customFrequency}
                                onChange={(e) => setCustomFrequency(e.target.value)}
                                placeholder="Ej. c/8h"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              />
                            </label>
                            <DecimalInput label="Máximo por día" value={customMaxDay} onChange={setCustomMaxDay} placeholder="Ej. 4000" suffix={customUnit} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>

                <section className={`rounded-xl border p-4 shadow-sm ${resultado ? (resultado.excede ? 'border-red-200 bg-red-50/80' : 'border-emerald-200 bg-emerald-50/80') : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <Calculator size={14} className={resultado ? (resultado.excede ? 'text-red-600' : 'text-emerald-600') : 'text-slate-400'} />
                    <h4 className="text-sm font-bold text-slate-800">Resultado</h4>
                  </div>

                  {!resultado ? (
                    <p className="mt-3 text-xs text-slate-500">Completa peso y referencia terapéutica para obtener la dosis estimada.</p>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-white/80 px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Por toma</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{formatNumber(resultado.dosisPorToma, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</p>
                          <p className="text-[11px] font-medium text-slate-500">{resultado.unidad}</p>
                        </div>
                        <div className="rounded-lg bg-white/80 px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total diaria</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{formatNumber(resultado.dosisDia, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</p>
                          <p className="text-[11px] font-medium text-slate-500">{resultado.unidad}/día</p>
                        </div>
                        <div className="rounded-lg bg-white/80 px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Frecuencia</p>
                          <p className="mt-1 text-base font-bold text-slate-900">{resultado.frecuencia}</p>
                          <p className="text-[11px] font-medium text-slate-500">{resultado.origen}</p>
                        </div>
                      </div>

                      {resultado.excede ? (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-100/80 px-3 py-2.5 text-red-700">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                          <p className="text-[11px] font-bold">Dosis diaria excede el máximo de {formatNumber(resultado.maxDia, { maximumFractionDigits: 2 })} {resultado.unidad}/día. Verificar antes de prescribir.</p>
                        </div>
                      ) : resultado.maxDia ? (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-100/70 px-3 py-2.5 text-emerald-700">
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                          <p className="text-[11px] font-bold">Dentro del rango. Máx: {formatNumber(resultado.maxDia, { maximumFractionDigits: 2 })} {resultado.unidad}/día.</p>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.8fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                  <FlaskConical size={12} />
                  Preparación y dilución
                </div>
                <h4 className="mt-1 text-sm font-bold text-slate-800">Fórmula C₁ × V₁ = C₂ × V₂</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">Completa tres valores y elige cuál resolver.</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    { value: 'volFinal', label: 'Calcular V₂' },
                    { value: 'concFinal', label: 'Calcular C₂' },
                    { value: 'volInicial', label: 'Calcular V₁' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setConcSolving(option.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${concSolving === option.value ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <DecimalInput label="C₁ Concentración inicial" value={concInicial} onChange={setConcInicial} placeholder="Ej. 500" suffix="mg/mL" />
                  <DecimalInput label="V₁ Volumen inicial" value={volInicial} onChange={setVolInicial} placeholder="Ej. 2" suffix="mL" />
                  <DecimalInput label="C₂ Concentración final" value={concFinal} onChange={setConcFinal} placeholder="Ej. 100" suffix="mg/mL" />
                  <DecimalInput label="V₂ Volumen final" value={volFinal} onChange={setVolFinal} placeholder="Ej. 10" suffix="mL" />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                  <Droplets size={12} />
                  Resultado de dilución
                </div>
                <h4 className="mt-1 text-sm font-bold text-slate-800">Resolución</h4>

                {resultadoConc ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{resultadoConc.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(resultadoConc.valor, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs font-medium text-slate-500">{resultadoConc.unidad}</p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                    Ingresa valores válidos. Acepta punto o coma decimal.
                  </div>
                )}

                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600">
                  <p className="font-bold text-slate-700">Consejo</p>
                  <p className="mt-1">Verifica unidades antes de preparar. Esta sección resuelve la relación matemática, no reemplaza la validación farmacológica.</p>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-[11px] text-slate-500">
          <div className="flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
            <span>Herramienta de apoyo clínico. Usa únicamente medicamentos del catálogo institucional y verifica con juicio clínico antes de prescribir o administrar.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculadoraDosisModal;