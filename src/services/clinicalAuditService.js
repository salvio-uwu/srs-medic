import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const AUDIT_COLLECTION = 'auditoria_expediente_clinico';

const normalize = (value) => String(value || '').trim();

const hasValue = (value) => normalize(value).length > 0;

const hasAtLeastOneVital = (signos = {}) => {
  return ['ta', 'temp', 'fc', 'fr', 'spo2'].some((key) => hasValue(signos?.[key]));
};

const buildChecks = (expediente = {}, context = {}) => {
  const checks = [
    {
      id: 'paciente_id',
      level: 'critical',
      label: 'Paciente vinculado',
      pass: hasValue(context.pacienteId)
    },
    {
      id: 'medico_nombre',
      level: 'critical',
      label: 'Medico responsable',
      pass: hasValue(context.medicoNombre)
    },
    {
      id: 'padecimiento',
      level: 'critical',
      label: 'Padecimiento actual',
      pass: hasValue(expediente?.consulta?.padecimiento)
    },
    {
      id: 'diagnostico',
      level: 'critical',
      label: 'Diagnostico principal',
      pass: hasValue(expediente?.consulta?.diagnostico?.enfermedad_actual)
    },
    {
      id: 'signos_vitales',
      level: 'critical',
      label: 'Signos vitales minimos',
      pass: hasAtLeastOneVital(expediente?.consulta?.exploracion?.signos)
    },
    {
      id: 'tratamiento_o_indicaciones',
      level: 'recommended',
      label: 'Tratamiento o indicaciones',
      pass:
        Array.isArray(expediente?.consulta?.diagnostico?.tratamiento_lista) &&
        expediente.consulta.diagnostico.tratamiento_lista.length > 0
          ? true
          : hasValue(expediente?.consulta?.diagnostico?.indicaciones)
    },
    {
      id: 'alergias_documentadas',
      level: 'recommended',
      label: 'Alergias documentadas',
      pass:
        (Array.isArray(expediente?.antecedentes?.alergias?.lista) &&
          expediente.antecedentes.alergias.lista.length > 0) ||
        hasValue(expediente?.antecedentes?.alergias?.otras) ||
        hasValue(expediente?.px_info?.alergias_base)
    },
    {
      id: 'grupo_sanguineo',
      level: 'recommended',
      label: 'Grupo sanguineo registrado',
      pass: hasValue(expediente?.px_info?.grupo_sanguineo)
    }
  ];

  return checks;
};

export const validateClinicalRecord = (expediente = {}, context = {}) => {
  const checks = buildChecks(expediente, context);
  const total = checks.length;
  const passed = checks.filter((check) => check.pass).length;

  const missingCritical = checks.filter((check) => check.level === 'critical' && !check.pass).map((check) => check.label);
  const missingRecommended = checks.filter((check) => check.level === 'recommended' && !check.pass).map((check) => check.label);

  let status = 'aprobado';
  if (missingCritical.length > 0) status = 'critico';
  else if (missingRecommended.length > 0) status = 'incompleto';

  return {
    status,
    score: Math.round((passed / total) * 100),
    totalChecks: total,
    passedChecks: passed,
    checks,
    missingCritical,
    missingRecommended,
    snapshot: {
      status,
      score: Math.round((passed / total) * 100),
      missingCritical,
      missingRecommended,
      checkedAtIso: new Date().toISOString()
    }
  };
};

export const createClinicalAuditRecord = async ({
  pacienteId,
  pacienteNombre,
  historialId,
  citaId = null,
  medicoId,
  medicoNombre,
  validation,
  expediente = {}
}) => {
  if (!pacienteId || !historialId || !validation) return null;

  const payload = {
    pacienteId,
    pacienteNombre: normalize(pacienteNombre),
    historialId,
    citaId,
    medicoId: normalize(medicoId) || 'anonimo',
    medicoNombre: normalize(medicoNombre) || 'Medico sin nombre',
    validation,
    resumen: {
      padecimiento: normalize(expediente?.consulta?.padecimiento),
      diagnostico: normalize(expediente?.consulta?.diagnostico?.enfermedad_actual),
      ta: normalize(expediente?.consulta?.exploracion?.signos?.ta),
      temp: normalize(expediente?.consulta?.exploracion?.signos?.temp)
    },
    createdAt: serverTimestamp()
  };

  return addDoc(collection(db, AUDIT_COLLECTION), payload);
};
