import React from 'react';
import { getEstadoDetallado } from '../utils/citaStatus';

/**
 * EstadoPacienteBadge
 * Badge visual unificado que refleja el estado real del paciente en la cita.
 * Usado en: AgendaEnfermeria, AgendaAdmin, Agenda (médico).
 *
 * Props:
 *   cita          {Object}  Documento de cita de Firestore
 *   size          {string}  'xs' | 'sm' | 'md' (default 'md')
 *   showSublabel  {boolean} Muestra la línea descriptiva bajo el badge (default false)
 *   showUrgencia  {boolean} Muestra pill "Urgencia" si aplica (default true)
 *   className     {string}  Clases adicionales al contenedor
 */
const EstadoPacienteBadge = ({
  cita,
  size = 'md',
  showSublabel = false,
  showUrgencia = true,
  className = '',
}) => {
  const estado = getEstadoDetallado(cita);

  const sizeStyles = {
    xs: { badge: 'px-2 py-1 text-[10px] gap-1.5 rounded-md',    dot: 'w-2 h-2'     },
    sm: { badge: 'px-2.5 py-1 text-[11px] gap-1.5 rounded-lg',  dot: 'w-2 h-2'     },
    md: { badge: 'px-3 py-1.5 text-[12px] gap-2 rounded-lg',    dot: 'w-2.5 h-2.5' },
  };

  const s = sizeStyles[size] || sizeStyles.md;
  const isAnimated = estado.pulse;

  return (
    <div className={`inline-flex flex-col gap-0.5 ${className}`}>
      <span
        className={`inline-flex items-center font-black uppercase tracking-widest border ${s.badge}`}
        style={{
          background: estado.bg,
          borderColor: estado.border,
          color: estado.color,
        }}
      >
        {/* Dot indicador */}
        <span
          className={`rounded-full shrink-0 ${s.dot} ${isAnimated ? 'animate-pulse' : ''}`}
          style={{ background: estado.dot }}
        />

        {/* Label principal */}
        {estado.label}

        {/* Pill de urgencia */}
        {showUrgencia && estado.esUrgencia && (
          <span
            className="ml-1 text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{ fontSize: '9px', background: '#ef4444' }}
          >
            ⚡ Urgencia
          </span>
        )}
      </span>

      {/* Sublabel descriptivo */}
      {showSublabel && estado.sublabel && (
        <span className="text-[10px] text-slate-500 font-medium ml-0.5 mt-0.5 leading-tight">
          {estado.sublabel}
        </span>
      )}
    </div>
  );
};

export default EstadoPacienteBadge;
