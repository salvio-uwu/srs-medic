/**
 * Detección centralizada de errores de permisos Firebase (Firestore / Storage / Auth).
 * Dispara el evento `srs-firebase-permission-error` para que el modal de soporte reaccione.
 */

export const FIREBASE_PERMISSION_EVENT = 'srs-firebase-permission-error';

const PERMISSION_CODES = new Set([
  'permission-denied',
  'storage/unauthorized',
  'storage/unauthorized-error',
]);

const PERMISSION_SNIPPETS = [
  'missing or insufficient permissions',
  'permission denied',
  'does not have permission',
  'insufficient permissions',
];

const normalizeText = (value = '') => String(value).toLowerCase().trim();

export const isFirebasePermissionDenied = (error) => {
  if (!error) return false;

  const code = normalizeText(error.code);
  if (PERMISSION_CODES.has(code)) return true;

  const message = normalizeText(error.message);
  return PERMISSION_SNIPPETS.some((snippet) => message.includes(snippet));
};

export const getFirebasePermissionMessage = (error) => {
  if (!error) return 'Acceso denegado por reglas de seguridad.';
  const code = error.code ? `[${error.code}] ` : '';
  const msg = error.message || 'Missing or insufficient permissions';
  return `${code}${msg}`;
};

let lastReportAt = 0;
const REPORT_COOLDOWN_MS = 8000;

/**
 * Notifica un error de permisos Firebase. Respeta un cooldown para no spamear modales.
 * @param {unknown} error
 * @param {{ source?: string, force?: boolean }} [options]
 * @returns {boolean} true si se despachó el evento
 */
export const reportFirebasePermissionError = (error, options = {}) => {
  if (!isFirebasePermissionDenied(error)) return false;

  const now = Date.now();
  if (!options.force && now - lastReportAt < REPORT_COOLDOWN_MS) return false;
  lastReportAt = now;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FIREBASE_PERMISSION_EVENT, {
      detail: {
        source: options.source || 'app',
        message: getFirebasePermissionMessage(error),
        at: now,
      },
    }));
  }

  return true;
};

/**
 * Envuelve una promesa Firestore/Storage y reporta permisos denegados.
 */
export const withFirebasePermissionGuard = async (promise, source = 'promise') => {
  try {
    return await promise;
  } catch (error) {
    reportFirebasePermissionError(error, { source });
    throw error;
  }
};
