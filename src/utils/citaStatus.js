/**
 * citaStatus.js
 * Fuente de verdad única para estados de paciente en cita.
 * Usado en: AgendaEnfermeria, AgendaAdmin, Agenda (médico).
 *
 * Flujo de estados:
 *   pendiente_triage  → paciente registrado, aún no pasa por triage
 *   en_triage         → enfermería abrió la pantalla de triage (triageIniciadoAt set)
 *   esperando_consulta→ triage completado, en sala de espera (estado Firestore: en_espera)
 *   en_consulta       → médico abrió el expediente (estado Firestore: en_consulta)
 *   completada        → consulta finalizada
 *   cancelada         → cita cancelada
 */

/** Paleta visual por estado detallado */
export const ESTADOS_CONFIG = {
  pendiente_triage: {
    label: 'Esperando triage',
    sublabel: 'El paciente no ha sido evaluado aún',
    dot: '#475569',
    bg: '#f1f5f9',
    border: '#94a3b8',
    color: '#0f172a',
    pulse: false,
    cssKey: 'pendiente',
  },
  en_triage: {
    label: 'En triage',
    sublabel: 'Enfermería tomando signos vitales',
    dot: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    color: '#5b21b6',
    pulse: true,
    cssKey: 'en_triage',
  },
  esperando_consulta: {
    label: 'Esperando consulta',
    sublabel: 'Triage completado · En sala de espera',
    dot: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#92400e',
    pulse: true,
    cssKey: 'en_espera',
  },
  en_consulta: {
    label: 'En consulta',
    sublabel: 'Actualmente en consulta médica',
    dot: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
    color: '#1e40af',
    pulse: true,
    cssKey: 'en_consulta',
  },
  completada: {
    label: 'Finalizada',
    sublabel: 'Consulta concluida exitosamente',
    dot: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    color: '#065f46',
    pulse: false,
    cssKey: 'completada',
  },
  cancelada: {
    label: 'Cancelada',
    sublabel: null,
    dot: '#f43f5e',
    bg: '#fff1f2',
    border: '#fecdd3',
    color: '#9f1239',
    pulse: false,
    cssKey: 'cancelada',
  },
};

/**
 * Retorna el estado detallado de una cita.
 *
 * @param {Object} cita - Documento de cita de Firestore
 * @returns {{ key, label, sublabel, dot, bg, border, color, pulse, esUrgencia, cssKey }}
 */
export function getEstadoDetallado(cita = {}) {
  const estado = (cita.estado || 'pendiente').toLowerCase().trim();
  const esUrgencia = (cita.tipoConsulta || '').toLowerCase() === 'urgencia';

  let key;
  if (estado === 'cancelada')       key = 'cancelada';
  else if (estado === 'completada') key = 'completada';
  else if (estado === 'en_consulta')key = 'en_consulta';
  else if (estado === 'en_espera')  key = 'esperando_consulta';
  else if (cita.triageIniciadoAt)   key = 'en_triage';
  else                              key = 'pendiente_triage';

  return {
    ...ESTADOS_CONFIG[key],
    key,
    esUrgencia,
  };
}
