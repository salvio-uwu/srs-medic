/**
 * Cierre de sesión por inactividad.
 * Persiste lastActivity en localStorage para detectar laptop apagada / pestaña ignorada
 * al volver (visibility/focus/pageshow).
 */

export const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos
export const IDLE_CHECK_MS = 15 * 1000;
export const IDLE_ACTIVITY_THROTTLE_MS = 8 * 1000;
/** Ventana tras login en la que no se aplica cierre por idle (evita carrera signIn vs onAuthStateChanged). */
export const LOGIN_GRACE_MS = 60 * 1000;

const activityKey = (uid) => `srs_last_activity_${uid}`;
const freshLoginKey = (uid) => `srs_fresh_login_${uid}`;
export const LOGOUT_REASON_KEY = 'srs_logout_reason';
export const LOGIN_INFLIGHT_KEY = 'srs_auth_login_inflight';

export const getLastActivity = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(activityKey(uid));
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

export const setLastActivity = (uid, ts = Date.now()) => {
  if (!uid) return;
  try {
    localStorage.setItem(activityKey(uid), String(ts));
  } catch {}
};

export const clearLastActivity = (uid) => {
  if (!uid) return;
  try {
    localStorage.removeItem(activityKey(uid));
  } catch {}
};

export const markLogoutReason = (reason) => {
  try {
    sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
  } catch {}
};

export const consumeLogoutReason = () => {
  try {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
    if (reason) sessionStorage.removeItem(LOGOUT_REASON_KEY);
    return reason;
  } catch {
    return null;
  }
};

export const setLoginInflight = (active) => {
  try {
    if (active) sessionStorage.setItem(LOGIN_INFLIGHT_KEY, '1');
    else sessionStorage.removeItem(LOGIN_INFLIGHT_KEY);
  } catch {}
};

export const isLoginInflight = () => {
  try {
    return sessionStorage.getItem(LOGIN_INFLIGHT_KEY) === '1';
  } catch {
    return false;
  }
};

/** Marca login recién exitoso para no expulsar por idle stale en la carrera con onAuthStateChanged. */
export const markFreshLogin = (uid) => {
  if (!uid) return;
  setLastActivity(uid);
  try {
    sessionStorage.setItem(freshLoginKey(uid), String(Date.now()));
  } catch {}
};

export const clearFreshLogin = (uid) => {
  if (!uid) return;
  try {
    sessionStorage.removeItem(freshLoginKey(uid));
  } catch {}
};

export const isFreshLogin = (uid, windowMs = LOGIN_GRACE_MS) => {
  if (!uid) return false;
  try {
    const t = Number(sessionStorage.getItem(freshLoginKey(uid)));
    return Number.isFinite(t) && Date.now() - t < windowMs;
  } catch {
    return false;
  }
};

/**
 * Idle expirado, salvo gracia de login o signIn en curso.
 * Si lastActivity no existe, no se considera expirado.
 */
export const isIdleExpired = (uid, limitMs = IDLE_LIMIT_MS) => {
  if (!uid) return false;
  if (isLoginInflight() || isFreshLogin(uid)) return false;
  const last = getLastActivity(uid);
  if (!last) return false;
  return Date.now() - last >= limitMs;
};
