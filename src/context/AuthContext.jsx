// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth'; 
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'; 
import { auth, db } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. LOGIN SEGURO CON ESTADO INICIAL ---
// --- 1. LOGIN SEGURO CON ESTADO INICIAL ---
// SUSTITUYE TU FUNCIÓN LOGIN POR ESTA:
const login = async (email, password) => {
  // Solo autenticamos. Dejamos que el useEffect (onAuthStateChanged) 
  // se encargue de actualizar la base de datos y cargar el perfil.
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

// MODIFICA TU MONITOR DE AUTENTICACIÓN (EFECTO 1):
// src/context/AuthContext.jsx

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          // Primero actualizamos los datos completos del usuario
          setUser({ ...currentUser, ...docSnap.data() });
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Error cargando perfil:", error);
        setUser(null);
      } finally {
        // Garantizamos que loading se apague SOLO después de intentar traer Firestore
        setLoading(false); 
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  });

  return () => unsubscribe();
}, []);

  // --- 2. LOGOUT CON LIMPIEZA DE ESTADO ---
  const logout = async () => {
    if (user && user.uid) {
      try {
        // Al salir, marcamos como offline y estado desconectado
        await updateDoc(doc(db, "users", user.uid), {
          isOnline: false,
          statusOperativo: 'offline', 
          lastSeen: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error en logout:", error);
      }
    }
    await signOut(auth);
    setUser(null);
  };

  // --- 3. NUEVA FUNCIÓN: CONTROL DE ESTADO OPERATIVO ---
  // Esta función permite al médico o enfermera cambiar su estado (Ocupado, Comida, etc.)
  const cambiarEstadoOperativo = async (estado, datosExtra = {}) => {
    if (!user?.uid) return;

    // Preparamos los datos a actualizar
    const updateData = {
      statusOperativo: estado, // 'disponible' | 'ocupado' | 'comida' | 'administrativo'
      lastSeen: new Date().toISOString(),
      ...datosExtra // Aquí pueden venir: tiempoInicio, duracionEstimada, pacienteActual
    };

    try {
      // 1. Actualizar en Firebase
      await updateDoc(doc(db, "users", user.uid), updateData);
      
      // 2. Actualizar el estado local inmediatamente para que la UI responda rápido
      setUser(prev => ({ ...prev, ...updateData }));
    } catch (error) {
      console.error("Error cambiando estado operativo:", error);
    }
  };

  // --- EFECTO 1: MONITOR DE AUTENTICACIÓN ---
// src/context/AuthContext.jsx

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          // COMBINAMOS Y LUEGO QUITAMOS EL LOADING
          setUser({ ...currentUser, ...docSnap.data() });
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Error cargando perfil:", error);
        setUser(null);
      }
    } else {
      setUser(null);
    }
    // ESTA LÍNEA DEBE IR AL FINAL DE TODO EL PROCESO
    setLoading(false); 
  });

  return () => unsubscribe();
}, []);

  // --- EFECTO 2: SISTEMA DE PRESENCIA (Heartbeat) ---
  useEffect(() => {
    let interval;

    if (user?.uid) {
      const reportarPresencia = async () => {
        try {
          // Mantenemos al usuario online y actualizamos su última vista
          await updateDoc(doc(db, "users", user.uid), { 
              lastSeen: new Date().toISOString(),
              isOnline: true
          });
        } catch (e) {
          console.log("Heartbeat skip"); 
        }
      };

      reportarPresencia();
      // Reportar cada 2 minutos (suficiente para mantener el estado online)
      interval = setInterval(reportarPresencia, 2 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.uid]);

  return (
    // Exponemos la nueva función cambiarEstadoOperativo al resto de la app
    <AuthContext.Provider value={{ user, login, logout, loading, cambiarEstadoOperativo }}>
      {!loading && children} 
    </AuthContext.Provider>
  );
};