import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL = 5 * 60 * 1000; // revisar cada 5 minutos
const CURRENT_VERSION = __BUILD_VERSION__;

export const useAppVersion = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const intervalRef = useRef(null);

  const checkVersion = async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const { v } = await res.json();
      if (v && v !== CURRENT_VERSION) {
        setUpdateAvailable(true);
        clearInterval(intervalRef.current); // dejar de revisar, ya se detectó
      }
    } catch {
      // silencioso — sin conexión o error de red
    }
  };

  useEffect(() => {
    // Primera verificación a los 60 segundos (no inmediata al cargar)
    const initial = setTimeout(checkVersion, 60_000);
    intervalRef.current = setInterval(checkVersion, POLL_INTERVAL);
    return () => {
      clearTimeout(initial);
      clearInterval(intervalRef.current);
    };
  }, []);

  return { updateAvailable };
};
