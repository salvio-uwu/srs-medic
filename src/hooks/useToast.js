import { useState, useCallback, useRef, useEffect } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const timersRef = useRef({});

  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timersRef.current[id];
    }, 4000);
    timersRef.current[id] = timer;
  }, []);

  const dismissToast = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  return { toasts, showToast, dismissToast };
}
