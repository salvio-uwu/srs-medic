/**
 * Cierre de sesión por inactividad.
 * Persiste lastActivity en localStorage para detectar laptop apagada / pestaña ignorada
 * al volver (visibility/focus/pageshow).
 */

export const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos
export const IDLE_CHECK_MS = 15 * 1000;
export const IDLE_ACTIVITY_THROTTLE_MS = 8 * 1000;

const activityKey = (uid) => `srs_last_activity_${uid}`;
export const LOGOUT_REASON_KEY = 'srs_logout_reason';

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

export const isIdleExpired = (uid, limitMs = IDLE_LIMIT_MS) => {
  const last = getLastActivity(uid);
  if (!last) return false;
  return Date.now() - last >= limitMs;
};
