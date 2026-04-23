export const PAYMENT_METHOD_OPTIONS = [
  { value: 'efectivo', label: 'Efectivo', shortLabel: 'E' },
  { value: 'tarjeta', label: 'Tarjeta', shortLabel: 'T' },
  { value: 'na', label: 'N/A', shortLabel: 'N/A' }
];

export const DISPENSE_STATUS_OPTIONS = [
  { value: 'si', label: 'Si' },
  { value: 'no', label: 'No' }
];

const cleanText = (value) => String(value ?? '').trim();

const normalizeKey = (value) =>
  cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const normalizePaymentMethod = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('efect')) return 'efectivo';
  if (normalized.includes('tarjet') || normalized.includes('credit')) return 'tarjeta';
  if (normalized === 'na' || normalized === 'n/a' || normalized.includes('no aplica') || normalized.includes('noaplica')) return 'na';
  return '';
};

export const getPaymentMethodMeta = (value) => {
  const normalized = normalizePaymentMethod(value);
  return PAYMENT_METHOD_OPTIONS.find((item) => item.value === normalized) || null;
};

export const normalizeDispenseStatus = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized === 'si' || normalized === 'sí') return 'si';
  if (normalized === 'no') return 'no';
  return '';
};

export const getDispenseStatusMeta = (value) => {
  const normalized = normalizeDispenseStatus(value);
  return DISPENSE_STATUS_OPTIONS.find((item) => item.value === normalized) || null;
};

export const buildEnfermeriaPatientLogRecord = ({
  expediente = {},
  pacienteId = '',
  pacienteNombre = '',
  citaId = '',
  historialId = '',
  citaData = {},
  citaContext = {},
  userSource = {},
  doctorNombre = '',
  completedAt = new Date()
}) => {
  const signos = expediente?.consulta?.exploracion?.signos || {};
  const antropometria = expediente?.consulta?.exploracion?.antropometria || {};
  const pagoMeta = getPaymentMethodMeta(citaData?.formaPago || citaData?.pagoMetodo || '');

  const fechaBase = completedAt instanceof Date && !Number.isNaN(completedAt.getTime())
    ? completedAt
    : new Date();

  const sucursalId = cleanText(
    citaData?.sucursalId
    || citaContext?.sucursalId
    || userSource?.sucursalActualId
    || userSource?.sucursalId
    || ''
  );

  const sucursal = cleanText(
    citaData?.sucursalNombre
    || citaData?.sucursal
    || citaContext?.sucursalNombre
    || citaContext?.sucursal
    || userSource?.sucursalActual
    || userSource?.sucursal
    || userSource?.sucursalNombre
    || ''
  );

  const consultorioId = cleanText(
    citaData?.consultorioId
    || citaContext?.consultorioId
    || userSource?.consultorioActualId
    || userSource?.consultorioRecurrenteId
    || userSource?.consultorioId
    || ''
  );

  const consultorio = cleanText(
    citaData?.consultorio
    || citaContext?.consultorioNombre
    || userSource?.consultorioActual
    || userSource?.consultorioRecurrente
    || userSource?.consultorio
    || ''
  );

  return {
    citaId: cleanText(citaId),
    historialId: cleanText(historialId),
    pacienteId: cleanText(pacienteId),
    pacienteNombre: cleanText(pacienteNombre),
    doctorNombre: cleanText(doctorNombre),
    sucursalId,
    sucursal,
    consultorioId,
    consultorio,
    noReceta: cleanText(expediente?.px_info?.folio_receta || expediente?.px_info?.id_receta || ''),
    motivo: cleanText(citaData?.motivo || citaData?.triage_motivo || expediente?.consulta?.padecimiento || ''),
    motivoVisita: cleanText(citaData?.motivo || ''),
    padecimientoConsulta: cleanText(expediente?.consulta?.padecimiento || ''),
    edad: cleanText(expediente?.px_info?.edad || ''),
    peso: cleanText(antropometria?.peso || ''),
    talla: cleanText(antropometria?.talla || ''),
    temperatura: cleanText(signos?.temp || ''),
    fr: cleanText(signos?.fr || ''),
    spo2: cleanText(signos?.spo2 || ''),
    fc: cleanText(signos?.fc || ''),
    ta: cleanText(signos?.ta || ''),
    formaPago: pagoMeta?.value || '',
    formaPagoLabel: pagoMeta?.label || '',
    formaPagoShort: pagoMeta?.shortLabel || '',
    recetaSurtida: '',
    recetaSurtidaLabel: '',
    origen: 'consulta_concluida',
    estado: 'registrado',
    consultaFinalizadaAtIso: fechaBase.toISOString(),
    fechaString: fechaBase.toLocaleDateString('en-CA'),
    createdAtClientIso: new Date().toISOString()
  };
};