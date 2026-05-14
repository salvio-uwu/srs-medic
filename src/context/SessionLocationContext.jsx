// src/context/SessionLocationContext.jsx
// Contexto global de ubicación de sesión.
// Centraliza la sucursal y consultorio activos para toda la sesión del usuario.
// Es la FUENTE ÚNICA DE VERDAD para determinar dónde opera el personal.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const SessionLocationContext = createContext();

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

    console.log('[DEBUG restore] uid:', uid, 'userDataReady:', userDataReadyRef.current, 'initialized:', initializedRef.current);
    console.log('[DEBUG restore] sessionSucursalId:', user?.sessionSucursalId);
    console.log('[DEBUG restore] sessionConsultorioId:', user?.sessionConsultorioId);

    // Intentar restaurar desde los campos de sesión guardados
    const savedSucursalId = user?.sessionSucursalId || '';
    const savedConsultorioId = user?.sessionConsultorioId || '';

    if (isDoctorRole && savedConsultorioId) {
      const found = catalogoConsultorios.find((c) => c.id === savedConsultorioId);
      if (found) {
        setSessionConsultorio(found);
        const suc = catalogoSucursales.find((s) => s.id === found.sucursalId);
        setSessionSucursal(suc || { id: found.sucursalId, nombre: found.sucursal || 'Sin nombre' });
        setLocationConfirmed(true);
        initializedRef.current = true;
        return;
      }
    }

    if (savedSucursalId) {
      const found = catalogoSucursales.find((s) => s.id === savedSucursalId);
      if (found) {
        setSessionSucursal(found);
        if (isDoctorRole) {
          // Intentar restaurar consultorio también
          const con = catalogoConsultorios.find((c) => c.id === savedConsultorioId);
          if (con) setSessionConsultorio(con);
        }
        setLocationConfirmed(true);
        initializedRef.current = true;
        return;
      }
    }

    // Intentar restaurar desde campos legacy como fallback
    const legacySucursalId = user?.sucursalActualId || user?.sucursalId || '';
    const legacyConsultorioId = user?.consultorioActualId || user?.consultorioRecurrenteId || user?.consultorioId || '';

    if (isDoctorRole && legacyConsultorioId) {
      const found = catalogoConsultorios.find((c) => c.id === legacyConsultorioId);
      if (found) {
        setSessionConsultorio(found);
        const suc = catalogoSucursales.find((s) => s.id === found.sucursalId);
        setSessionSucursal(suc || { id: found.sucursalId, nombre: found.sucursal || 'Sin nombre' });
        setLocationConfirmed(true);
        // Persistir los campos de sesión para migrar de legacy a nuevo formato
        setDoc(doc(db, 'users', uid), {
          sessionSucursalId: suc?.id || found.sucursalId || '',
          sessionSucursalNombre: suc?.nombre || found.sucursal || '',
          sessionConsultorioId: found.id,
          sessionConsultorioNombre: found.nombre || ''
        }, { merge: true }).catch(() => {});
        initializedRef.current = true;
        return;
      }
    }

    if (legacySucursalId) {
      const found = catalogoSucursales.find((s) => s.id === legacySucursalId);
      if (found) {
        setSessionSucursal(found);
        if (isDoctorRole) {
          const con = catalogoConsultorios.find((c) => c.id === legacyConsultorioId);
          if (con) setSessionConsultorio(con);
        }
        setLocationConfirmed(true);
        // Migrar campos legacy a formato de sesión
        setDoc(doc(db, 'users', uid), {
          sessionSucursalId: found.id,
          sessionSucursalNombre: found.nombre || ''
        }, { merge: true }).catch(() => {});
        initializedRef.current = true;
        return;
      }
    }

    // No hay sesión previa guardada — no confirmar, el usuario debe seleccionar
    initializedRef.current = true;
  }, [uid, catalogosReady, userDataReadyRef.current, isDoctorRole, catalogoSucursales, catalogoConsultorios,
      user?.sessionSucursalId, user?.sessionConsultorioId,
      user?.sucursalActualId, user?.sucursalId, user?.consultorioActualId, user?.consultorioRecurrenteId, user?.consultorioId]);

  // ── 3. Reset al cambiar de usuario ──
  useEffect(() => {
    if (!uid) {
      setSessionSucursal(null);
      setSessionConsultorio(null);
      setLocationConfirmed(false);
      initializedRef.current = false;
    }
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

    if (!sucursal) return; // No se puede confirmar sin sucursal

    setSessionSucursal(sucursal);
    setSessionConsultorio(consultorio);
    setLocationConfirmed(true);

    console.log('[DEBUG confirmLocation] sessionConsultorio:', consultorio?.id, consultorio?.nombre);
    console.log('[DEBUG confirmLocation] sessionSucursal:', sucursal?.id, sucursal?.nombre);

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
