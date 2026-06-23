import { useEffect, useRef, useState, useCallback } from 'react';

const POLL_INTERVAL = 2 * 60 * 1000; // revisar cada 2 minutos (antes 5 min — demasiado lento para detectar deploys)
const POSTPONE_MINUTES = 5;
const CURRENT_VERSION = __BUILD_VERSION__;

export const useAppVersion = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [notes, setNotes] = useState([]);
  const intervalRef = useRef(null);
  const postponeTimerRef = useRef(null);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.v && data.v !== CURRENT_VERSION) {
        setNotes(Array.isArray(data.notes) ? data.notes : []);
        setUpdateAvailable(true);
        // Parar el polling una vez detectada la actualización
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch {
      // silencioso — sin conexión o error de red
    }
  }, []);

  useEffect(() => {
    checkVersion();

    intervalRef.current = setInterval(checkVersion, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (postponeTimerRef.current) {
        clearTimeout(postponeTimerRef.current);
        postponeTimerRef.current = null;
      }
    };
  }, [checkVersion]);

  const postponeUpdate = useCallback((minutes = POSTPONE_MINUTES) => {
    setUpdateAvailable(false);

    if (postponeTimerRef.current) {
      clearTimeout(postponeTimerRef.current);
    }

    postponeTimerRef.current = setTimeout(() => {
      // Re-verificar al cumplirse el plazo
      checkVersion();
    }, minutes * 60 * 1000);
  }, [checkVersion]);

  return { updateAvailable, notes, postponeUpdate };
};
