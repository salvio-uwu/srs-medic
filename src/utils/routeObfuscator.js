/**
 * Route Obfuscator
 * Convierte rutas internas (ej: /enfermeria/dashboard) en URLs publicas opacas
 * usando codificacion base64url reversible.
 *
 * Interno: /enfermeria/dashboard
 * Visible: /app/L2VuZmVybWVyaWEvZGFzaGJvYXJk
 *
 * Esto evita exponer la estructura de roles en la barra del navegador.
 */

// Rutas que NO se ofuscan (login, portal, compartido, raiz)
const SKIP_PREFIXES = ['/login', '/portal', '/inicio', '/compartido'];

const shouldObfuscate = (pathname) => {
  const pathOnly = String(pathname || '').split(/[?#]/)[0];
  if (pathOnly === '/' || pathOnly === '') return false;
  return !SKIP_PREFIXES.some((prefix) => pathOnly.startsWith(prefix));
};

// Codifica una ruta interna (pathname + search + hash) a su representacion publica
export const encodeRoute = (internalPath) => {
  if (!shouldObfuscate(internalPath)) return internalPath;
  const encoded = btoa(unescape(encodeURIComponent(internalPath)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return '/app/' + encoded;
};

/**
 * Decodifica una ruta publica a su ruta interna original.
 * Soporta query/hash fuera del segmento ofuscado (legacy) y query embebida en el payload.
 */
export const decodeRoute = (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/app/')) return publicPath;
  const withoutApp = publicPath.slice(5);
  const suffixMatch = withoutApp.match(/[?#].*$/);
  const encoded = suffixMatch ? withoutApp.slice(0, suffixMatch.index) : withoutApp;
  const externalSuffix = suffixMatch ? suffixMatch[0] : '';

  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  try {
    const decoded = decodeURIComponent(escape(atob(base64)));
    if (!decoded.startsWith('/')) return publicPath;
    // Si el payload ya trae ?/#, ignorar suffix externo duplicado
    if (externalSuffix && !decoded.includes('?') && !decoded.includes('#')) {
      return decoded + externalSuffix;
    }
    return decoded;
  } catch {
    return publicPath;
  }
};

/**
 * Abre una ruta interna de la app en pestaña nueva, ofuscada y con respaldo de sessionStorage.
 * Evita perder query params (p. ej. citaId en orden de servicio).
 */
export const openAppRoute = (internalPath, { storageKey, storageValue } = {}) => {
  const path = String(internalPath || '').trim();
  if (!path.startsWith('/')) return null;
  if (storageKey && storageValue != null) {
    try {
      sessionStorage.setItem(storageKey, String(storageValue));
    } catch {
      // sessionStorage puede fallar en modo privado
    }
  }
  const target = encodeRoute(path);
  const win = window.open(target, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Popup bloqueado: navegar en la misma pestaña
    window.location.assign(target);
  }
  return win;
};

/**
 * Codifica un token UUID a su representacion opaca para URLs publicas.
 * Ej: 05d98d7e-f458-436c-b599-0a9c7dcd083b → MDVkOThkN2UtZjQ1OC00MzZjLWI1OTktMGE5YzdkY2QwODNi
 */
export const encodeToken = (token) => {
  if (!token) return '';
  const encoded = btoa(unescape(encodeURIComponent(token)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return encoded;
};

/**
 * Decodifica un token opaco a su UUID original.
 * Ej: MDVkOThkN2UtZjQ1OC00MzZjLWI1OTktMGE5YzdkY2QwODNi → 05d98d7e-f458-436c-b599-0a9c7dcd083b
 */
export const decodeToken = (encoded) => {
  if (!encoded) return '';
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return encoded;
  }
};
