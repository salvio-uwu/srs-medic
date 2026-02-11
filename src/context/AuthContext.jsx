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
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    try {
      // Al loguearse, establecemos el estado inicial como 'disponible'
      // Usamos setDoc con merge para no borrar datos previos del perfil
      await setDoc(doc(db, "users", uid), {
        lastLogin: new Date().toISOString(),
        isOnline: true,
        statusOperativo: 'disponible', // Inicializamos el estado para la Torre de Control
        lastSeen: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Error actualizando login:", error);
    }
  };

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
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            // Combinamos datos de Auth + Firestore (incluyendo statusOperativo si existe)
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