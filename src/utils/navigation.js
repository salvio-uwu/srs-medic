/**
 * Navega al fallback explícito.
 * Con ofuscación de rutas (`/app/...`), history.back/navigate(-1) es frágil:
 * puede caer en entradas rotas y el catch-all manda a /inicio o /login.
 */
export const goBackOr = (navigate, fallbackPath, options = {}) => {
  navigate(fallbackPath, {
    replace: options.replaceFallback ?? true,
    state: options.state,
  });
};

const LAST_PATH_KEY = 'srs:lastNonPacientesPath';

const PACIENTES_PATHS = new Set(['/pacientes', '/admin/pacientes']);

const EXPEDIENTE_PATHS = new Set([
  '/doctor/expediente',
  '/enfermeria/expediente',
  '/expediente-electronico',
]);

export const isPacientesPath = (pathname = '') => {
  const path = String(pathname || '').split('?')[0];
  return PACIENTES_PATHS.has(path);
};

export const isExpedientePath = (pathname = '') => {
  const path = String(pathname || '').split('?')[0];
  return EXPEDIENTE_PATHS.has(path);
};

export const isSafeInternalPath = (path) =>
  typeof path === 'string'
  && path.startsWith('/')
  && !path.startsWith('//')
  && !isPacientesPath(path)
  && !isExpedientePath(path);

/** Guarda la última ruta útil (no-directorio / no-expediente) para poder volver. */
export const rememberNavigationPath = (pathname, search = '') => {
  if (typeof window === 'undefined' || !pathname) return;
  if (isPacientesPath(pathname) || isExpedientePath(pathname)) return;
  if (pathname.startsWith('/login') || pathname.startsWith('/portal') || pathname.startsWith('/app/')) return;
  try {
    const full = `${pathname}${search || ''}`;
    if (isSafeInternalPath(pathname)) {
      sessionStorage.setItem(LAST_PATH_KEY, full);
    }
  } catch {
    // sessionStorage puede fallar en modo privado estricto
  }
};

export const getRememberedNavigationPath = () => {
  try {
    const saved = sessionStorage.getItem(LAST_PATH_KEY);
    return isSafeInternalPath(saved?.split('?')[0] || '') ? saved : null;
  } catch {
    return null;
  }
};

/**
 * Origen de vuelta desde Directorio de pacientes:
 * 1) location.state.from (explícito)
 * 2) última ruta recordada en la sesión
 * 3) /inicio
 */
export const resolvePacientesBackPath = (from) => {
  if (isSafeInternalPath(from?.split?.('?')[0] || from)) return from;
  return getRememberedNavigationPath() || '/inicio';
};

/**
 * Destino al salir del expediente clínico monolito.
 * Prioridad: from explícito → contexto enfermería/admin → última ruta → agenda médica.
 */
export const resolveExpedienteExitPath = ({ from, openedFrom = '', pathname = '' } = {}) => {
  const fromPath = typeof from === 'string' ? from : '';
  const fromBase = fromPath.split('?')[0] || '';
  // Aquí sí se permite /pacientes (origen directorio); no se permite volver al propio expediente
  if (
    fromBase.startsWith('/')
    && !fromBase.startsWith('//')
    && !isExpedientePath(fromBase)
  ) {
    return fromPath;
  }

  const origen = String(openedFrom || '').toLowerCase();
  const path = String(pathname || '').split('?')[0];

  if (
    path.startsWith('/enfermeria')
    || origen.startsWith('enfermeria')
  ) {
    return '/enfermeria/dashboard';
  }

  if (origen === 'admin_pacientes' || path === '/expediente-electronico') {
    return '/pacientes';
  }

  return getRememberedNavigationPath() || '/agenda';
};
