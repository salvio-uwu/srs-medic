import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Detecta si el paciente ya tuvo atención clínica previa
 * (nota en historial_clinico o cita con estado completada).
 */
export async function pacienteHaVenidoAConsulta(pacienteId) {
  const id = String(pacienteId || '').trim();
  if (!id) return false;

  try {
    const histSnap = await getDocs(
      query(collection(db, 'historial_clinico'), where('pacienteId', '==', id), limit(1))
    );
    if (!histSnap.empty) return true;
  } catch (err) {
    console.warn('No se pudo consultar historial_clinico para tipo de consulta:', err);
  }

  try {
    const citasSnap = await getDocs(
      query(collection(db, 'citas'), where('pacienteId', '==', id), limit(30))
    );
    return citasSnap.docs.some((d) => {
      const estado = String(d.data()?.estado || '').toLowerCase().trim();
      return estado === 'completada';
    });
  } catch (err) {
    console.warn('No se pudo consultar citas para tipo de consulta:', err);
    return false;
  }
}

export function esTipoConsultaPrimeraVez(tipo = '') {
  const t = String(tipo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!t) return true;
  return t.includes('primera') || t === 'primera_vez' || t === '1a' || t === '1ra';
}

/** Valor canónico según el formato de cada agenda. */
export function tipoConsultaSubsecuente(formato = 'slug') {
  if (formato === 'label' || formato === 'admin') return 'Subsecuente';
  return 'subsecuente';
}

/**
 * Si aún está en primera vez y el paciente ya vino, corrige a subsecuente.
 * No toca urgencia / otros tipos.
 */
export function resolverTipoConsultaConHistorial(tipoActual, haVenido, formato = 'slug') {
  if (!haVenido) return tipoActual;
  const t = String(tipoActual || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (t.includes('urgencia')) return tipoActual;
  if (esTipoConsultaPrimeraVez(tipoActual)) {
    return tipoConsultaSubsecuente(formato);
  }
  return tipoActual;
}
