// src/components/AvatarPaciente.jsx
import React from 'react';

const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  const fecha = new Date(fechaNacimiento);
  if (Number.isNaN(fecha.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mesDiff = hoy.getMonth() - fecha.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
  return edad >= 0 ? edad : null;
};

const obtenerCategoria = (sexo, fechaNacimiento) => {
  const edad = calcularEdad(fechaNacimiento);
  const esFemenino = String(sexo || '').toLowerCase() === 'femenino';

  if (edad === null) return esFemenino ? 'mujer' : 'hombre';

  if (edad <= 2) return esFemenino ? 'bebe_nina' : 'bebe_nino';
  if (edad <= 12) return esFemenino ? 'nina' : 'nino';
  if (edad >= 60) return esFemenino ? 'anciana' : 'anciano';
  return esFemenino ? 'mujer' : 'hombre';
};

const avatarConfig = {
  bebe_nino: { label: 'Bebé',       img: '/avatars/bebe_nino.png', text: 'text-blue-600' },
  bebe_nina: { label: 'Bebé',       img: '/avatars/bebe_nina.png', text: 'text-pink-600' },
  nino:    { label: 'Niño',         img: '/avatars/nino.png',    text: 'text-sky-700' },
  nina:    { label: 'Niña',         img: '/avatars/nina.png',    text: 'text-pink-700' },
  hombre:  { label: 'Hombre',       img: '/avatars/hombre.png',  text: 'text-teal-700' },
  mujer:   { label: 'Mujer',        img: '/avatars/mujer.png',   text: 'text-purple-700' },
  anciano: { label: 'Adulto mayor', img: '/avatars/anciano.png', text: 'text-amber-700' },
  anciana: { label: 'Adulta mayor', img: '/avatars/anciana.png', text: 'text-rose-700' },
};

const sizes = {
  xs: { container: 'w-6 h-6',   label: 'text-[6px]' },
  sm: { container: 'w-8 h-8',   label: 'text-[7px]' },
  md: { container: 'w-10 h-10', label: 'text-[8px]' },
  lg: { container: 'w-12 h-12', label: 'text-[9px]' },
  xl: { container: 'w-20 h-20', label: 'text-[10px]' },
};

const AvatarPaciente = ({ sexo, fechaNacimiento, size = 'md', showLabel = false, className = '' }) => {
  const categoria = obtenerCategoria(sexo, fechaNacimiento);
  const config = avatarConfig[categoria];
  const sizeConfig = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      <div
        className={`${sizeConfig.container} rounded-2xl overflow-hidden shrink-0 bg-slate-50`}
        title={config.label}
      >
        <img
          src={config.img}
          alt={config.label}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
      {showLabel && (
        <span className={`${sizeConfig.label} font-bold ${config.text} uppercase tracking-wide`}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export { calcularEdad, obtenerCategoria, avatarConfig };
export default AvatarPaciente;
