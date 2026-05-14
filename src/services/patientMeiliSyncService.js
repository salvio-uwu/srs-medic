import { getMeiliClient, PACIENTES_INDEX, ensurePatientIndex } from './meilisearchClient';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

let indexReady = false;

const ready = async () => {
  if (!indexReady) {
    await ensurePatientIndex();
    indexReady = true;
  }
};

const toMeiliDoc = (firestoreId, data) => ({
  id: firestoreId,
  nombre: data.nombre || '',
  apellidoPaterno: data.apellidoPaterno || '',
  apellidoMaterno: data.apellidoMaterno || '',
  nombreCompleto: data.nombreCompleto || '',
  telefonoMovil: data.telefonoMovil || '',
  telefonoFijo: data.telefonoFijo || '',
  idPaciente: data.idPaciente || '',
  idPacienteMigrado: data.idPacienteMigrado || '',
  curp: data.curp || '',
  sexo: data.sexo || '',
  fechaNacimiento: data.fechaNacimiento || '',
  municipioEstado: data.municipioEstado || '',
  email: data.email || '',
  grupoSanguineo: data.grupoSanguineo || '',
  fechaRegistro: data.fechaRegistro || '',
  fechaActualizacion: data.fechaActualizacion || '',
  calleNumero: data.calleNumero || '',
  colonia: data.colonia || '',
  cp: data.cp || '',
  pais: data.pais || '',
  notasPersonales: data.notasPersonales || '',
  padecimientoHipertension: !!data.padecimientoHipertension,
  padecimientoDiabetes: !!data.padecimientoDiabetes,
  padecimientoObesidad: !!data.padecimientoObesidad,
  padecimientoArtritis: !!data.padecimientoArtritis
});

export const syncPatientToMeili = async (firestoreId, data) => {
  try {
    await ready();
    const doc = toMeiliDoc(firestoreId, data);
    await getMeiliClient().index(PACIENTES_INDEX).addDocuments([doc]);
  } catch (err) {
    console.warn('[Meilisearch] sync falló (no bloqueante):', err.message);
  }
};

export const deletePatientFromMeili = async (firestoreId) => {
  try {
    await ready();
    await getMeiliClient().index(PACIENTES_INDEX).deleteDocument(firestoreId);
  } catch (err) {
    console.warn('[Meilisearch] delete falló (no bloqueante):', err.message);
  }
};

export const seedAllPatientsFromFirestore = async (onProgress) => {
  await ready();

  const snapshot = await getDocs(collection(db, 'pacientes'));
  const allDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const total = allDocs.length;

  if (onProgress) onProgress({ phase: 'read', total, current: total });

  const BATCH_SIZE = 500;
  const meiliIndex = getMeiliClient().index(PACIENTES_INDEX);

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = allDocs.slice(i, i + BATCH_SIZE).map((doc) => {
      const { id, ...data } = doc;
      return toMeiliDoc(id, data);
    });
    await meiliIndex.addDocuments(batch);
    if (onProgress) onProgress({ phase: 'index', total, current: Math.min(i + BATCH_SIZE, total) });
  }

  return total;
};
