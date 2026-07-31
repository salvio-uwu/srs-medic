// src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  IDLE_ACTIVITY_THROTTLE_MS,
  IDLE_CHECK_MS,
  IDLE_LIMIT_MS,
  LOGOUT_REASON_KEY,
  clearLastActivity,
  getLastActivity,
  isIdleExpired,
  markLogoutReason,
  setLastActivity,
} from '../utils/sessionIdle';
import {
  registrarEntrada,
  registrarSalida,
  touchActividad,
} from '../services/asistenciaService';

const AuthContext = createContext();

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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);
  userRef.current = user;

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    setLastActivity(userCredential.user.uid);
    return userCredential.user;
  };

  // Mantiene sincronizado el perfil (users/{uid}) para reflejar cambios de consultorio al instante.
  useEffect(() => {
    let unsubscribeProfile = null;
    let initialNullTimer = null;
    // Cache en memoria: onAuthStateChanged puede re-emitir el usuario (refresco de token)
    let lastProfile = null;
    let lastProfileUid = null;

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

        // Sesión expirada por inactividad mientras la pestaña/laptop estaba dormida
        if (isIdleExpired(currentUser.uid)) {
          markLogoutReason('idle');
          clearLastActivity(currentUser.uid);
          signOut(auth).catch(() => {});
          setUser(null);
          setLoading(false);
          return;
        }

        if (!getLastActivity(currentUser.uid)) {
          setLastActivity(currentUser.uid);
        }

        const cachedProfile = lastProfileUid === currentUser.uid ? lastProfile : null;
        setUser(cachedProfile ? { ...currentUser, ...cachedProfile } : currentUser);

        if (cachedProfile && isProfileHydrated({ ...currentUser, ...cachedProfile })) {
          setLoading(false);
        }

        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snap) => {
            const profileData = snap.exists() ? snap.data() : {};
            lastProfile = profileData;
            lastProfileUid = currentUser.uid;
            setUser({ ...currentUser, ...profileData });
            setLoading(false);
          },
          (error) => {
            console.error('Error sincronizando perfil:', error);
            if (lastProfile && lastProfileUid === currentUser.uid) {
              setUser({ ...currentUser, ...lastProfile });
              setLoading(false);
            }
          }
        );
        return;
      }

      // Firebase puede emitir null antes de restaurar sesión desde IndexedDB (pestaña nueva)
      if (!initialNullTimer) {
        initialNullTimer = setTimeout(() => {
          initialNullTimer = null;
          lastProfile = null;
          lastProfileUid = null;
          setUser(null);
          setLoading(false);
        }, 5000);
      }
    });

    return () => {
      if (initialNullTimer) clearTimeout(initialNullTimer);
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const logout = useCallback(async () => {
    const current = userRef.current;
    if (current?.uid) {
      clearLastActivity(current.uid);
      const motivo = (() => {
        try {
          return sessionStorage.getItem(LOGOUT_REASON_KEY) || 'logout';
        } catch {
          return 'logout';
        }
      })();
      await registrarSalida(current, motivo).catch((error) => {
        console.error('Error registrando salida de asistencia:', error);
      });
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
      }, { merge: true }).catch((error) => {
        console.error('Error en logout:', error);
      });
    }
    await signOut(auth);
    setUser(null);
  }, []);

  // Cierre por inactividad (pestaña ignorada / laptop apagada al despertar)
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    let lastTouchWrite = 0;
    let loggingOut = false;

    const touch = () => {
      const now = Date.now();
      if (now - lastTouchWrite < IDLE_ACTIVITY_THROTTLE_MS) return;
      lastTouchWrite = now;
      setLastActivity(uid, now);
    };

    const expireIfNeeded = async () => {
      if (loggingOut) return;
      if (!isIdleExpired(uid, IDLE_LIMIT_MS)) return;
      loggingOut = true;
      markLogoutReason('idle');
      try {
        await logout();
      } catch {
        loggingOut = false;
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
    if (!user?.uid) return;

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

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, cambiarEstadoOperativo }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
