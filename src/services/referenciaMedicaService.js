const clean = (value) => String(value ?? '').trim();

export const TIPO_CITA_OPTIONS = [
  { id: 'primera_vez', label: 'Primera vez' },
  { id: 'subsecuente', label: 'Subsecuente' },
  { id: 'control', label: 'Control' },
  { id: 'urgencia', label: 'Urgencia' },
  { id: 'valoracion', label: 'Valoración' },
  { id: 'interconsulta', label: 'Interconsulta' },
  { id: 'alta', label: 'Alta' }
];

export const getTipoCitaLabel = (id) => {
  const found = TIPO_CITA_OPTIONS.find((o) => o.id === id);
  return found ? found.label : clean(id);
};

export const normalizeReferenciaMedicaRecord = (raw = {}, idFallback = '') => ({
  id: clean(raw.id || idFallback),
  especialidad: clean(raw.especialidad || raw.especialidadId),
  tipoCita: clean(raw.tipoCita || raw.tipo_cita || TIPO_CITA_OPTIONS[0]?.id),
  esUrgente: raw.esUrgente === true || raw.es_urgente === true,
  nombreMedico: clean(raw.nombreMedico || raw.nombre_medico || raw.medico),
  telefonoConsultorio: clean(raw.telefonoConsultorio || raw.telefono_consultorio || raw.telefono),
  direccionConsultorio: clean(raw.direccionConsultorio || raw.direccion_consultorio || raw.direccion),
  diagnostico: clean(raw.diagnostico),
  datosExtras: clean(raw.datosExtras || raw.datos_extras || raw.notas),
  activo: raw.activo !== false,
  source: raw.source || 'catalogo'
});
