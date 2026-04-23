import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const NegatoscopioModal = ({ onClose }) => {
  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ background: '#fff' }}
    >
      {/* Pantalla blanca a brillo máximo */}
      <div className="absolute inset-0" style={{ background: '#ffffff', filter: 'brightness(1.15)' }} />

      {/* Botón cerrar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[1000] p-3 bg-black/10 hover:bg-black/20 rounded-full transition-colors group"
        title="Cerrar negatoscopio (Esc)"
      >
        <X size={28} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
      </button>
    </div>
  );
};

export default NegatoscopioModal;
