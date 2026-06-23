import { doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

const COLECCION = 'expedientes_compartidos';
const EXPIRACION_DIAS = 30;

export const generarToken = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

/**
 * Crea un enlace compartido para un expediente clínico.
 * Sube el PDF a Storage y guarda metadatos en Firestore.
 *
 * @param {Object} params
 * @param {Blob}   params.pdfBlob       – Blob del PDF del expediente
 * @param {string} params.pacienteId    – ID del paciente
 * @param {string} params.nombrePaciente – Nombre completo del paciente
 * @param {string} params.generadoPor   – Quién generó el PDF
 * @param {string} params.folio         – Folio del expediente
 * @param {string} [params.token]       – Token opcional pre-generado (si no, se genera uno nuevo)
 * @returns {Promise<{token: string, url: string}>}
 */
export async function crearEnlaceCompartido({
  pdfBlob,
  pacienteId,
  nombrePaciente,
  generadoPor,
  folio,
  token: tokenPredefinido
}) {
  if (!pdfBlob) throw new Error('El PDF es requerido para compartir.');

  const token = tokenPredefinido || generarToken();
  const ahora = new Date();
  const expiraEn = new Date(ahora.getTime() + EXPIRACION_DIAS * 24 * 60 * 60 * 1000);

  // Subir PDF a Firebase Storage
  const storagePath = `expedientes_compartidos/${token}.pdf`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, pdfBlob, {
    contentType: 'application/pdf',
    customMetadata: {
      pacienteId: pacienteId || '',
      nombrePaciente: nombrePaciente || '',
      generadoPor: generadoPor || '',
      folio: folio || '',
      generadoAt: ahora.toISOString()
    }
  });

  const storageUrl = await getDownloadURL(storageRef);

  // Guardar registro en Firestore
  await setDoc(doc(db, COLECCION, token), {
    token,
    pacienteId: pacienteId || '',
    nombrePaciente: nombrePaciente || '',
    generadoPor: generadoPor || '',
    folio: folio || '',
    storageUrl,
    storagePath,
    createdAt: ahora.toISOString(),
    expiresAt: expiraEn.toISOString(),
    views: 0
  });

  const dominio = typeof window !== 'undefined' ? window.location.origin : 'https://centromedicosantacruz.com';
  const url = `${dominio}/compartido/${token}`;

  return { token, url };
}

/**
 * Obtiene los datos de un expediente compartido por su token.
 * También incrementa el contador de vistas.
 *
 * @param {string} token
 * @returns {Promise<Object|null>} Datos del expediente o null si no existe/expirado
 */
export async function obtenerExpedienteCompartido(token) {
  if (!token) return null;

  const docRef = doc(db, COLECCION, token);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;

  const data = snap.data();

  // Verificar expiración
  if (data.expiresAt) {
    const expira = new Date(data.expiresAt);
    if (expira < new Date()) return null;
  }

  // Incrementar contador de vistas (no esperamos)
  updateDoc(docRef, { views: increment(1) }).catch(() => {});

  return data;
}
