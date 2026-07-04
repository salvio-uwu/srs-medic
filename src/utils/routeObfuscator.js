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
const SKIP_PREFIXES = ['/login', '/portal', '/compartido'];

const shouldObfuscate = (pathname) => {
  if (pathname === '/' || pathname === '') return false;
  if (pathname.startsWith('/app/')) return false; // ya está codificada
  return !SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

// Codifica una ruta interna a su representacion publica
export const encodeRoute = (internalPath) => {
  if (!shouldObfuscate(internalPath)) return internalPath;
  const encoded = btoa(unescape(encodeURIComponent(internalPath)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return '/app/' + encoded;
};

// Decodifica una ruta publica a su ruta interna original
export const decodeRoute = (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/app/')) return publicPath;
  const encoded = publicPath.slice(5);
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return publicPath;
  }
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
