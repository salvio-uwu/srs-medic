// src/services/documentStorageService.js
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Sube un PDF (Blob) a Firebase Storage dentro del expediente del paciente.
 *
 * Ruta: expedientes/{pacienteId}/documentos/{timestamp}_{safeName}.pdf
 *
 * @param {Object} params
 * @param {string} params.pacienteId – ID del paciente
 * @param {Blob}   params.pdfBlob    – Blob del PDF generado
 * @param {string} params.nombre     – Nombre legible del documento
 * @param {string} params.tipo       – 'receta' | 'documento'
 * @returns {Promise<{url: string, storagePath: string}>}
 */
export async function uploadDocumentoPDF({ pacienteId, pdfBlob, nombre, tipo }) {
  if (!pacienteId || !pdfBlob) {
    throw new Error('pacienteId y pdfBlob son requeridos para subir documento.');
  }

  const timestamp = Date.now();
  const safeName = (nombre || tipo || 'documento')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'documento';

  const storagePath = `expedientes/${pacienteId}/documentos/${timestamp}_${safeName}.pdf`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, pdfBlob, {
    contentType: 'application/pdf',
    customMetadata: {
      tipo: tipo || 'documento',
      nombre: nombre || '',
      generadoAt: new Date().toISOString()
    }
  });

  const url = await getDownloadURL(storageRef);
  return { url, storagePath };
}
