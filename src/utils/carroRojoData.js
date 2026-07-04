// Utilidades compartidas para alinear los datos capturados por sucursal con la
// plantilla global del carro rojo.
//
// Los datos por sucursal se guardan como mapas { [itemId]: { cantidadExistente,
// caducidad, articulo } }. Históricamente el único vínculo con la plantilla era
// el id del artículo: si jefatura eliminaba y re-agregaba un artículo (id nuevo
// `custom_...`), los datos guardados bajo el id viejo quedaban huérfanos y la
// tabla se mostraba vacía aunque los datos existieran en Firestore.
//
// Estrategia de alineación (en orden):
//   1. Match directo por id.
//   2. Match por nombre normalizado del artículo, usando el `articulo` guardado
//      en la propia entrada (formato nuevo) o el nombre que tenía ese id en la
//      plantilla de un snapshot del historial (recuperación de datos legacy).

export const normTexto = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Alinea el mapa de datos de una sucursal con los artículos de la plantilla.
 * @param {Array}  plantilla     Ítems de la plantilla vigente [{ id, articulo }]
 * @param {Object} dataMap       Datos guardados { [id]: { cantidadExistente, caducidad, articulo? } }
 * @param {Object} nombresPorId  Respaldo opcional { [idViejo]: articulo } (de un snapshot del historial)
 * @returns {Object} Mapa re-alineado con las llaves de la plantilla vigente.
 */
export const alignSucursalData = (plantilla = [], dataMap = {}, nombresPorId = {}) => {
  const idsPlantilla = new Set(plantilla.map((item) => item.id));

  // Índice por nombre de las entradas que NO matchean ningún id vigente
  const huerfanosPorNombre = {};
  Object.entries(dataMap).forEach(([id, v]) => {
    if (idsPlantilla.has(id)) return;
    const nombre = normTexto(v?.articulo || nombresPorId[id] || '');
    if (nombre && !huerfanosPorNombre[nombre]) huerfanosPorNombre[nombre] = v;
  });

  const aligned = {};
  plantilla.forEach((item) => {
    const directo = dataMap[item.id];
    const tieneAlgo = (v) => v && (v.cantidadExistente || v.caducidad);
    if (tieneAlgo(directo)) {
      aligned[item.id] = directo;
      return;
    }
    const porNombre = huerfanosPorNombre[normTexto(item.articulo)];
    if (tieneAlgo(porNombre)) {
      aligned[item.id] = {
        cantidadExistente: porNombre.cantidadExistente || '',
        caducidad: porNombre.caducidad || '',
        articulo: item.articulo || ''
      };
    }
  });
  return aligned;
};

/** ¿Hay entradas guardadas bajo ids que ya no existen en la plantilla? */
export const tieneDatosHuerfanos = (plantilla = [], dataMap = {}) => {
  const ids = new Set(plantilla.map((item) => item.id));
  return Object.entries(dataMap).some(([id, v]) =>
    !ids.has(id) && v && (v.cantidadExistente || v.caducidad)
  );
};

/** Construye el mapa { id: articulo } desde las plantillas guardadas en un snapshot del historial. */
export const nombresDesdeHistorial = (histDoc = {}) => {
  const out = {};
  [...(histDoc.plantillaMaterial || []), ...(histDoc.plantillaMedicamento || [])].forEach((item) => {
    if (item?.id && item?.articulo) out[item.id] = item.articulo;
  });
  return out;
};
