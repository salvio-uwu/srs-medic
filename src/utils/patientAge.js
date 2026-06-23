/**
 * Calcula la edad en años a partir de una fecha de nacimiento.
 * Retorna un número o el fallback especificado si la fecha es inválida.
 */
export const calcularEdad = (fechaNacimiento, fallback = '-') => {
  if (!fechaNacimiento) return fallback;
  const fecha = new Date(fechaNacimiento);
  if (Number.isNaN(fecha.getTime())) return fallback;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mesDiff = hoy.getMonth() - fecha.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;
  return edad >= 0 ? edad : fallback;
};
