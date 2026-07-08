const parseBirthDate = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  if (fechaNacimiento instanceof Date) {
    return Number.isNaN(fechaNacimiento.getTime()) ? null : fechaNacimiento;
  }
  const fecha = new Date(fechaNacimiento);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const diffMesesDias = (nacimiento, referencia = new Date()) => {
  const inicio = new Date(nacimiento.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  const fin = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  if (fin < inicio) return { months: 0, days: 0 };

  let months = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth());
  let days = fin.getDate() - inicio.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(fin.getFullYear(), fin.getMonth(), 0).getDate();
  }
  return { months, days };
};

/**
 * Calcula la edad en años a partir de una fecha de nacimiento.
 * Retorna un número o el fallback especificado si la fecha es inválida.
 */
export const calcularEdad = (fechaNacimiento, fallback = '-') => {
  const fecha = parseBirthDate(fechaNacimiento);
  if (!fecha) return fallback;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mesDiff = hoy.getMonth() - fecha.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
  return edad >= 0 ? edad : fallback;
};

/**
 * Texto de edad para UI clínica.
 * Menores de 2 años: meses y días. De lo contrario: años.
 */
export const formatearEdadTexto = (fechaNacimiento, fallback = '--') => {
  const fecha = parseBirthDate(fechaNacimiento);
  if (!fecha) return fallback;

  const { months, days } = diffMesesDias(fecha);
  if (months >= 24) {
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? 'año' : 'años'}`;
  }

  if (months === 0 && days === 0) return '0 días';
  if (months === 0) return `${days} ${days === 1 ? 'día' : 'días'}`;
  if (days === 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  return `${months} ${months === 1 ? 'mes' : 'meses'}, ${days} ${days === 1 ? 'día' : 'días'}`;
};
