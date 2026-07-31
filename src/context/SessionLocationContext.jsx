// src/context/SessionLocationContext.jsx
// Contexto global de ubicación de sesión.
// Centraliza la sucursal y consultorio activos para toda la sesión del usuario.
// Es la FUENTE ÚNICA DE VERDAD para determinar dónde opera el personal.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const SessionLocationContext = createContext();

const LOCATION_SESSION_KEY = (uid) => `srs_loc_confirmed_${uid}`;

const readLocationSession = (uid) => {
  if (!uid) return null;
  try {
    const raw = sessionStorage.getItem(LOCATION_SESSION_KEY(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLocationSession = (uid, payload) => {
  if (!uid) return;
  try {
    sessionStorage.setItem(LOCATION_SESSION_KEY(uid), JSON.stringify(payload));
  } catch {}
};

const clearLocationSession = (uid) => {
  if (!uid) return;
  try {
    sessionStorage.removeItem(LOCATION_SESSION_KEY(uid));
  } catch {}
};

const normalizeRole = (role = '') =>
  String(role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const DOCTOR_ROLES = ['medico', 'doctor'];

export const useSessionLocation = () => {
  const context = useContext(SessionLocationContext);
  if (!context) throw new Error('useSessionLocation debe usarse dentro de SessionLocationProvider');
  return context;
};

export const SessionLocationProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const role = normalizeRole(user?.rol);
  const isDoctorRole = DOCTOR_ROLES.includes(role);

  // ── Catálogos ──
  const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [catalogoConsultorios, setCatalogoConsultorios] = useState([]);
  const [catalogosReady, setCatalogosReady] = useState(false);

  // ── Ubicación de sesión ──
  const [sessionSucursal, setSessionSucursal] = useState(null);       // { id, nombre }
  const [sessionConsultorio, setSessionConsultorio] = useState(null);  // { id, nombre, sucursalId, ...full }
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  // Evitar writes duplicados al inicializar
  const initializedRef = useRef(false);

  // ── 1. Cargar catálogos ──
  useEffect(() => {
    if (!uid) {
      setCatalogoSucursales([]);
      setCatalogoConsultorios([]);
      setCatalogosReady(false);
      return;
    }

    const qSucursales = query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc'));
    const qConsultorios = query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc'));

    let sucReady = false;
    let conReady = false;
    const checkReady = () => { if (sucReady && conReady) setCatalogosReady(true); };

    const unsub1 = onSnapshot(qSucursales, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false);
      setCatalogoSucursales(rows);
      sucReady = true;
      checkReady();
    });

    const unsub2 = onSnapshot(qConsultorios, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false);
      setCatalogoConsultorios(rows);
      conReady = true;
      checkReady();
    });

    return () => { unsub1(); unsub2(); };
  }, [uid]);

  // ── 2. Restaurar ubicación desde perfil al iniciar sesión ──
  // Usamos un ref adicional para trackear si el user data ya fue hidratado desde Firestore
  const userDataReadyRef = useRef(false);

  useEffect(() => {
    if (!uid) {
      userDataReadyRef.current = false;
      return;
    }
    // Marcar que el user data está disponible cuando sessionSucursalId deja de ser undefined
    // (el user object de AuthContext se llena con onSnapshot de Firestore)
    if (user?.sessionSucursalId !== undefined || user?.sucursalActualId !== undefined) {
      userDataReadyRef.current = true;
    }
  }, [uid, user?.sessionSucursalId, user?.sucursalActualId]);

  useEffect(() => {
    // Solo restaurar cuando: hay uid, catálogos listos, user data disponible, y no inicializado
    if (!uid || !catalogosReady || !userDataReadyRef.current || initializedRef.current) return;

    // Prefill desde sesión guardada.
    // Si en esta pestaña/navegador ya se confirmó ubicación (sessionStorage),
    // se restaura como confirmada — recargar no vuelve a pedirla.
    // Al cerrar sesión se limpia y vuelve a ser obligatorio.
    const savedSucursalId = user?.sessionSucursalId || '';
    const savedConsultorioId = user?.sessionConsultorioId || '';
    const legacySucursalId = user?.sucursalActualId || user?.sucursalId || '';
    const legacyConsultorioId = user?.consultorioActualId || user?.consultorioRecurrenteId || user?.consultorioId || '';

    const consultorioId = savedConsultorioId || legacyConsultorioId;
    const sucursalId = savedSucursalId || legacySucursalId;
    const browserSession = readLocationSession(uid);

    const applyDoctor = (found) => {
      setSessionConsultorio(found);
      const suc = catalogoSucursales.find((s) => s.id === found.sucursalId);
      setSessionSucursal(suc || { id: found.sucursalId, nombre: found.sucursal || 'Sin nombre' });
      const confirmed = !!(
        browserSession?.confirmed
        && browserSession.consultorioId === found.id
      );
      setLocationConfirmed(confirmed);
    };

    const applySucursal = (found) => {
      setSessionSucursal(found);
      let consultorio = null;
      if (isDoctorRole) {
        consultorio = catalogoConsultorios.find((c) => c.id === consultorioId) || null;
        if (consultorio) setSessionConsultorio(consultorio);
      }
      const confirmed = !!(
        browserSession?.confirmed
        && browserSession.sucursalId === found.id
        && (!isDoctorRole || (consultorio && browserSession.consultorioId === consultorio.id))
      );
      // Médico sin consultorio en sesión del navegador: no confirmar
      if (isDoctorRole && !consultorio) {
        setLocationConfirmed(false);
      } else {
        setLocationConfirmed(confirmed);
      }
    };

    if (isDoctorRole && consultorioId) {
      const found = catalogoConsultorios.find((c) => c.id === consultorioId);
      if (found) {
        applyDoctor(found);
        initializedRef.current = true;
        return;
      }
    }

    if (sucursalId) {
      const found = catalogoSucursales.find((s) => s.id === sucursalId);
      if (found) {
        applySucursal(found);
        initializedRef.current = true;
        return;
      }
    }

    setLocationConfirmed(false);
    initializedRef.current = true;
  }, [uid, catalogosReady, userDataReadyRef.current, isDoctorRole, catalogoSucursales, catalogoConsultorios,
      user?.sessionSucursalId, user?.sessionConsultorioId,
      user?.sucursalActualId, user?.sucursalId, user?.consultorioActualId, user?.consultorioRecurrenteId, user?.consultorioId]);

  // ── 3. Reset al cambiar de usuario / logout ──
  const lastUidRef = useRef(null);
  useEffect(() => {
    if (uid) {
      lastUidRef.current = uid;
      return;
    }
    if (lastUidRef.current) {
      clearLocationSession(lastUidRef.current);
      lastUidRef.current = null;
    }
    setSessionSucursal(null);
    setSessionConsultorio(null);
    setLocationConfirmed(false);
    initializedRef.current = false;
  }, [uid]);

  // ── 4. Función para establecer ubicación ──
  const confirmLocation = useCallback(async ({ sucursalId, consultorioId } = {}) => {
    if (!uid) return;

    let sucursal = null;
    let consultorio = null;

    if (isDoctorRole && consultorioId) {
      consultorio = catalogoConsultorios.find((c) => c.id === consultorioId) || null;
      if (consultorio) {
        sucursal = catalogoSucursales.find((s) => s.id === consultorio.sucursalId) || null;
        if (!sucursal && consultorio.sucursalId) {
          sucursal = { id: consultorio.sucursalId, nombre: consultorio.sucursal || 'Sin nombre' };
        }
      }
    }

    if (!sucursal && sucursalId) {
      sucursal = catalogoSucursales.find((s) => s.id === sucursalId) || null;
    }

    // Médicos deben confirmar consultorio; el resto, sucursal
    if (isDoctorRole && !consultorio) return;
    if (!sucursal) return;

    setSessionSucursal(sucursal);
    setSessionConsultorio(consultorio);
    setLocationConfirmed(true);
    writeLocationSession(uid, {
      confirmed: true,
      sucursalId: sucursal.id || '',
      consultorioId: consultorio?.id || '',
    });

    // Persistir en Firestore
    try {
      await setDoc(doc(db, 'users', uid), {
        sessionSucursalId: sucursal.id || '',
        sessionSucursalNombre: sucursal.nombre || '',
        sessionConsultorioId: consultorio?.id || '',
        sessionConsultorioNombre: consultorio?.nombre || '',
        // Mantener compatibilidad con campos legacy
        sucursalActual: sucursal.nombre || '',
        sucursalActualId: sucursal.id || '',
        ...(consultorio ? {
          consultorioActualId: consultorio.id,
          consultorioActual: consultorio.nombre || '',
          consultorioId: consultorio.id,
          consultorio: consultorio.nombre || '',
          consultorioUbicacion: consultorio.ubicacion || ''
        } : {})
      }, { merge: true });
    } catch (error) {
      console.error('Error persistiendo ubicación de sesión:', error);
    }
  }, [uid, isDoctorRole, catalogoSucursales, catalogoConsultorios]);

  // ── 5. Función para cambiar consultorio desde la Agenda (médicos) ──
  const updateConsultorio = useCallback(async (consultorioId) => {
    if (!uid || !consultorioId) return;
    const consultorio = catalogoConsultorios.find((c) => c.id === consultorioId) || null;
    if (!consultorio) return;

    const sucursal = catalogoSucursales.find((s) => s.id === consultorio.sucursalId) || null;

    setSessionConsultorio(consultorio);
    if (sucursal) setSessionSucursal(sucursal);

    try {
      await setDoc(doc(db, 'users', uid), {
        sessionSucursalId: sucursal?.id || consultorio.sucursalId || '',
        sessionSucursalNombre: sucursal?.nombre || consultorio.sucursal || '',
        sessionConsultorioId: consultorio.id,
        sessionConsultorioNombre: consultorio.nombre || '',
        // Compatibilidad legacy
        sucursalActual: sucursal?.nombre || consultorio.sucursal || '',
        sucursalActualId: sucursal?.id || consultorio.sucursalId || '',
        consultorioActualId: consultorio.id,
        consultorioActual: consultorio.nombre || '',
        consultorioId: consultorio.id,
        consultorio: consultorio.nombre || '',
        consultorioUbicacion: consultorio.ubicacion || ''
      }, { merge: true });
    } catch (error) {
      console.error('Error actualizando consultorio de sesión:', error);
    }
  }, [uid, catalogoSucursales, catalogoConsultorios]);

  // ── 6. Función para cambiar sucursal (otros roles) ──
  const updateSucursal = useCallback(async (sucursalId) => {
    if (!uid || !sucursalId) return;
    const sucursal = catalogoSucursales.find((s) => s.id === sucursalId) || null;
    if (!sucursal) return;

    setSessionSucursal(sucursal);

    try {
      await setDoc(doc(db, 'users', uid), {
        sessionSucursalId: sucursal.id,
        sessionSucursalNombre: sucursal.nombre || '',
        sucursalActual: sucursal.nombre || '',
        sucursalActualId: sucursal.id
      }, { merge: true });
    } catch (error) {
      console.error('Error actualizando sucursal de sesión:', error);
    }
  }, [uid, catalogoSucursales]);

  // ── 7. Limpiar sesión (para logout) ──
  const clearSessionLocation = useCallback(async () => {
    if (!uid) return;
    setSessionSucursal(null);
    setSessionConsultorio(null);
    setLocationConfirmed(false);
    initializedRef.current = false;
    clearLocationSession(uid);
    try {
      await setDoc(doc(db, 'users', uid), {
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
      }, { merge: true });
    } catch (error) {
      console.error('Error limpiando ubicación de sesión:', error);
    }
  }, [uid]);

  return (
    <SessionLocationContext.Provider value={{
      // Estado
      sessionSucursal,
      sessionConsultorio,
      locationConfirmed,
      catalogosReady,
      isDoctorRole,
      // Catálogos
      catalogoSucursales,
      catalogoConsultorios,
      // Acciones
      confirmLocation,
      updateConsultorio,
      updateSucursal,
      clearSessionLocation,
    }}>
      {children}
    </SessionLocationContext.Provider>
  );
};
