import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL = 5 * 60 * 1000; // revisar cada 5 minutos
const CURRENT_VERSION = __BUILD_VERSION__;

export const useAppVersion = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const intervalRef = useRef(null);
  const hasUpdatedRef = useRef(false);

  const checkVersion = async () => {
    // Si ya se detectó una actualización, no seguir verificando
    if (hasUpdatedRef.current) {
      clearInterval(intervalRef.current);
      return;
    }

    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const { v } = await res.json();
      if (v && v !== CURRENT_VERSION) {
        setUpdateAvailable(true);
        hasUpdatedRef.current = true;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch {
      // silencioso — sin conexión o error de red
    }
  };

  useEffect(() => {
    // Verificar inmediatamente al cargar
    checkVersion();
    
    // Configurar intervalo de verificación
    intervalRef.current = setInterval(checkVersion, POLL_INTERVAL);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Función para resetear el estado de actualización (opcional)
  const resetUpdateStatus = () => {
    setUpdateAvailable(false);
    hasUpdatedRef.current = false;
  };

  return { updateAvailable, resetUpdateStatus };
};
