// src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  IDLE_ACTIVITY_THROTTLE_MS,
  IDLE_CHECK_MS,
  IDLE_LIMIT_MS,
  LOGOUT_REASON_KEY,
  clearFreshLogin,
  clearLastActivity,
  getLastActivity,
  isIdleExpired,
  markFreshLogin,
  markLogoutReason,
  setLastActivity,
  setLoginInflight,
} from '../utils/sessionIdle';
import {
  registrarEntrada,
  registrarSalida,
  touchActividad,
} from '../services/asistenciaService';
import AuthSplash from '../components/AuthSplash';

const AuthContext = createContext();

const PROFILE_FETCH_MS = 4000;
const LOGOUT_SIDE_EFFECT_MS = 2000;
const SIGNOUT_MS = 5000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  ]);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
};

// Perfil listo para evaluar permisos (rol o lista explícita de permisos)
export const isProfileHydrated = (user) => {
  if (!user) return false;
  if (user.rol) return true;
  if (Array.isArray(user.permissionList) && user.permissionList.length > 0) return true;
  if (user.permissions && Object.keys(user.permissions).length > 0) return true;
  return false;
};

// Cache persistente del perfil (users/{uid}) para hidratar la sesión al
// instante en recargas, sin esperar el primer onSnapshot de Firestore.
// Firestore sigue siendo la fuente de verdad: el snapshot lo refresca al llegar.
const PROFILE_CACHE_KEY = 'srs_auth_profile_cache_v1';

const readProfileCache = () => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.uid && parsed.profile ? parsed : null;
  } catch {
    return null;
  }
};

const writeProfileCache = (uid, profile) => {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, profile, savedAt: Date.now() }));
  } catch {
    // Storage bloqueado (modo privado) o lleno: seguir sin cache.
  }
};

const clearProfileCache = () => {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // noop
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;
  const loggingOutRef = useRef(false);
  const hydrateProfileRef = useRef(null);

  const login = async (email, password) => {
    setLoginInflight(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      markFreshLogin(userCredential.user.uid);
      setProfileError(null);
      return userCredential.user;
    } finally {
      setLoginInflight(false);
    }
  };

  const applyProfile = useCallback((currentUser, profileData) => {
    const merged = { ...currentUser, ...profileData };
    writeProfileCache(currentUser.uid, profileData);
    setUser(merged);
    if (isProfileHydrated(merged)) {
      setProfileError(null);
      setLoading(false);
    }
    return merged;
  }, []);

  const fetchProfileOnce = useCallback(async (currentUser) => {
    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
      const snap = await withTimeout(getDoc(userDocRef), PROFILE_FETCH_MS);
      if (!snap || typeof snap.exists !== 'function') {
        setProfileError('timeout');
        setLoading(false);
        return null;
      }
      const profileData = snap.exists() ? snap.data() : {};
      return applyProfile(currentUser, profileData);
    } catch (error) {
      console.error('Error leyendo perfil (getDoc):', error);
      setProfileError('fetch');
      setLoading(false);
      return null;
    }
  }, [applyProfile]);

  hydrateProfileRef.current = async () => {
    const current = auth.currentUser;
    if (!current || loggingOutRef.current) return;
    setProfileError(null);
    setLoading(true);
    await fetchProfileOnce(current);
  };

  // Mantiene sincronizado el perfil (users/{uid}) para reflejar cambios de consultorio al instante.
  useEffect(() => {
    let unsubscribeProfile = null;
    let initialNullTimer = null;
    let profileReleaseTimer = null;
    // Cache en memoria: onAuthStateChanged puede re-emitir el usuario (refresco de token)
    let lastProfile = null;
    let lastProfileUid = null;

    const clearProfileReleaseTimer = () => {
      if (profileReleaseTimer) {
        clearTimeout(profileReleaseTimer);
        profileReleaseTimer = null;
      }
    };

    // Pase lo que pase (auth sin responder, red caída), el splash no puede
    // ser infinito: a los 8s se libera la UI con el estado que haya.
    const hardStopTimer = setTimeout(() => setLoading(false), 8000);

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        if (initialNullTimer) {
          clearTimeout(initialNullTimer);
          initialNullTimer = null;
        }

        // Sesión expirada por inactividad (con gracia de login / inflight)
        if (isIdleExpired(currentUser.uid)) {
          loggingOutRef.current = true;
          markLogoutReason('idle');
          clearLastActivity(currentUser.uid);
          clearFreshLogin(currentUser.uid);
          clearProfileCache();
          signOut(auth).catch(() => {});
          setUser(null);
          setProfileError(null);
          setLoading(false);
          loggingOutRef.current = false;
          return;
        }

        if (!getLastActivity(currentUser.uid)) {
          setLastActivity(currentUser.uid);
        }

        const diskCache = readProfileCache();
        const cachedProfile =
          (lastProfileUid === currentUser.uid ? lastProfile : null) ||
          (diskCache?.uid === currentUser.uid ? diskCache.profile : null);
        setUser(cachedProfile ? { ...currentUser, ...cachedProfile } : currentUser);

        if (cachedProfile && isProfileHydrated({ ...currentUser, ...cachedProfile })) {
          setLoading(false);
          setProfileError(null);
        }

        const userDocRef = doc(db, 'users', currentUser.uid);

        // Lectura puntual: no depender solo del Listen (se rompe tras sleep).
        fetchProfileOnce(currentUser).then((merged) => {
          if (merged) {
            lastProfile = merged;
            lastProfileUid = currentUser.uid;
          }
        });

        // Canal de Firestore atorado (Safari/iOS, red inestable): nunca dejar
        // el splash infinito. Si el perfil no llega pronto, liberar la UI con
        // el usuario disponible; el snapshot corrige al conectar.
        clearProfileReleaseTimer();
        profileReleaseTimer = setTimeout(() => {
          profileReleaseTimer = null;
          setLoading(false);
          setProfileError((err) => {
            const prev = userRef.current;
            if (prev?.uid === currentUser.uid && !isProfileHydrated(prev)) {
              return err || 'timeout';
            }
            return err;
          });
        }, 6000);

        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snap) => {
            if (loggingOutRef.current) return;
            clearProfileReleaseTimer();
            const profileData = snap.exists() ? snap.data() : {};
            lastProfile = profileData;
            lastProfileUid = currentUser.uid;
            applyProfile(currentUser, profileData);
          },
          (error) => {
            clearProfileReleaseTimer();
            console.error('Error sincronizando perfil:', error);
            if (lastProfile && lastProfileUid === currentUser.uid) {
              setUser({ ...currentUser, ...lastProfile });
            } else {
              setProfileError('listen');
            }
            setLoading(false);
          }
        );
        return;
      }

      // Firebase puede emitir null antes de restaurar sesión desde IndexedDB
      // (pestaña nueva). Sin cache local no hay sesión previa en este equipo:
      // mostrar login casi de inmediato. Con cache, dar un margen corto a la
      // restauración antes de rendirse (antes eran 5s fijos para todos).
      if (!initialNullTimer) {
        const graceMs = readProfileCache() ? 1500 : 250;
        initialNullTimer = setTimeout(() => {
          initialNullTimer = null;
          lastProfile = null;
          lastProfileUid = null;
          clearProfileCache();
          setUser(null);
          setProfileError(null);
          setLoading(false);
        }, graceMs);
      }
    });

    return () => {
      clearTimeout(hardStopTimer);
      if (initialNullTimer) clearTimeout(initialNullTimer);
      clearProfileReleaseTimer();
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, [applyProfile, fetchProfileOnce]);

  // Al volver de sleep: refrescar token si la sesión sigue válida (no idle).
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let refreshing = false;
    const softRecover = async () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (loggingOutRef.current) return;
      if (isIdleExpired(uid, IDLE_LIMIT_MS)) return;
      if (refreshing) return;
      refreshing = true;
      try {
        const current = auth.currentUser;
        if (current) {
          await current.getIdToken(true);
        }
      } catch {
        // Token refresh falló (Identity Toolkit 400): no forzar logout aquí.
      } finally {
        refreshing = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') softRecover();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', softRecover);
    window.addEventListener('pageshow', softRecover);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', softRecover);
      window.removeEventListener('pageshow', softRecover);
    };
  }, [user?.uid]);

  const logout = useCallback(async () => {
    loggingOutRef.current = true;
    const current = userRef.current;
    clearProfileCache();
    if (current?.uid) {
      clearLastActivity(current.uid);
      clearFreshLogin(current.uid);
      const motivo = (() => {
        try {
          return sessionStorage.getItem(LOGOUT_REASON_KEY) || 'logout';
        } catch {
          return 'logout';
        }
      })();
      // No bloquear el cierre si la red está caída (post-sleep).
      await withTimeout(
        registrarSalida(current, motivo).catch(() => {}),
        LOGOUT_SIDE_EFFECT_MS
      );
      setDoc(doc(db, 'users', current.uid), {
        isOnline: false,
        statusOperativo: 'offline',
        lastSeen: new Date().toISOString(),
        sessionSucursalId: '',
        sessionSucursalNombre: '',
        sessionConsultorioId: '',
        sessionConsultorioNombre: '',
        sucursalActual: '',
        sucursalActualId: '',
        consultorioActualId: '',
        consultorioActual: '',
        consultorioId: '',
        consultorio: '',
        consultorioUbicacion: '',
        consultorioRecurrenteId: '',
        consultorioRecurrente: ''
      }, { merge: true }).catch(() => {});
    }
    await withTimeout(signOut(auth).catch(() => {}), SIGNOUT_MS);
    setUser(null);
    setProfileError(null);
    setLoading(false);
    loggingOutRef.current = false;
  }, []);

  const retryProfile = useCallback(async () => {
    if (hydrateProfileRef.current) await hydrateProfileRef.current();
  }, []);

  // Cierre por inactividad (pestaña ignorada / laptop apagada al despertar)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let lastTouchWrite = 0;
    let loggingOut = false;

    const touch = () => {
      if (loggingOutRef.current) return;
      const now = Date.now();
      if (now - lastTouchWrite < IDLE_ACTIVITY_THROTTLE_MS) return;
      lastTouchWrite = now;
      setLastActivity(uid, now);
    };

    const expireIfNeeded = async () => {
      if (loggingOut || loggingOutRef.current) return;
      if (!isIdleExpired(uid, IDLE_LIMIT_MS)) return;
      loggingOut = true;
      loggingOutRef.current = true;
      markLogoutReason('idle');
      try {
        await logout();
      } catch {
        loggingOut = false;
        loggingOutRef.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') expireIfNeeded();
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, touch, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', expireIfNeeded);
    window.addEventListener('pageshow', expireIfNeeded);

    const interval = setInterval(expireIfNeeded, IDLE_CHECK_MS);
    expireIfNeeded();

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, touch, { capture: true });
      });
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', expireIfNeeded);
      window.removeEventListener('pageshow', expireIfNeeded);
      clearInterval(interval);
    };
  }, [user?.uid, logout]);

  const cambiarEstadoOperativo = async (estado, datosExtra = {}) => {
    if (!user?.uid || loggingOutRef.current) return;

    const updateData = {
      statusOperativo: estado,
      lastSeen: new Date().toISOString(),
      ...datosExtra
    };

    try {
      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
      setUser(prev => ({ ...prev, ...updateData }));
    } catch (error) {
      console.error('Error cambiando estado operativo:', error);
    }
  };

  const hasSetLastLogin = useRef(false);
  // Boolean estable: NO depender de user.permissions / permissionList (objetos/arrays
  // nuevos en cada onSnapshot del perfil → re-disparaban setDoc y generaban loop).
  const profileHydrated = isProfileHydrated(user);

  useEffect(() => {
    let interval;
    const uid = user?.uid;

    if (uid && profileHydrated) {
      const reportarPresencia = async () => {
        if (loggingOutRef.current) return;
        try {
          const payload = {
            lastSeen: new Date().toISOString(),
            isOnline: true,
          };
          const esNuevaSesion = !hasSetLastLogin.current;
          if (esNuevaSesion) {
            payload.lastLogin = serverTimestamp();
            hasSetLastLogin.current = true;
          }
          await setDoc(doc(db, 'users', uid), payload, { merge: true });

          const perfil = userRef.current || { uid };
          if (esNuevaSesion) {
            await registrarEntrada(perfil).catch(() => {});
          } else {
            await touchActividad(perfil).catch(() => {});
          }
        } catch {
          // Red caída o QUIC: no afectar auth
        }
      };

      reportarPresencia();
      interval = setInterval(reportarPresencia, 2 * 60 * 1000);
    } else {
      hasSetLastLogin.current = false;
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.uid, profileHydrated]);

  const showBootSplash = loading;
  const showProfileStuck =
    !loading && user && !isProfileHydrated(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        profileError,
        retryProfile,
        cambiarEstadoOperativo,
      }}
    >
      {showBootSplash ? (
        <AuthSplash />
      ) : showProfileStuck ? (
        <AuthSplash
          status="No se pudo cargar el perfil. Revisa tu conexión."
          onRetry={retryProfile}
          onLogout={logout}
        />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
