// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth'; 
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'; 
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

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  // Mantiene sincronizado el perfil (users/{uid}) para reflejar cambios de consultorio al instante.
  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      unsubscribeProfile = onSnapshot(
        userRef,
        (snap) => {
          const profileData = snap.exists() ? snap.data() : {};
          setUser({ ...currentUser, ...profileData });
          setLoading(false);
        },
        (error) => {
          console.error('Error sincronizando perfil:', error);
          setUser(currentUser);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  // --- 2. LOGOUT CON LIMPIEZA DE ESTADO ---
  const logout = async () => {
    if (user && user.uid) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          isOnline: false,
          statusOperativo: 'offline', 
          lastSeen: new Date().toISOString()
        }, { merge: true });
      } catch (error) {
        console.error('Error en logout:', error);
      }
    }
    await signOut(auth);
    setUser(null);
  };

  // --- 3. NUEVA FUNCIÓN: CONTROL DE ESTADO OPERATIVO ---
  // Esta función permite al médico o enfermera cambiar su estado (Ocupado, Comida, etc.)
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

  // --- EFECTO 2: SISTEMA DE PRESENCIA (Heartbeat) ---
  useEffect(() => {
    let interval;

    if (user?.uid) {
      const reportarPresencia = async () => {
        try {
          await setDoc(doc(db, 'users', user.uid), { 
              lastSeen: new Date().toISOString(),
              isOnline: true
          }, { merge: true });
        } catch (e) {
          console.log('Heartbeat skip'); 
        }
      };

      reportarPresencia();
      interval = setInterval(reportarPresencia, 2 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.uid]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, cambiarEstadoOperativo }}>
      {!loading && children} 
    </AuthContext.Provider>
  );
};