import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { sanitizePatientNameFields } from '../utils/patientName';

const PAGE_SIZE = 600;
const WRITE_BATCH_LIMIT = 400;

const normalize = (value = '') => String(value ?? '').replace(/\s+/g, ' ').trim();

const hasNameChanges = (current = {}, next = {}) =>
  normalize(current.nombre) !== normalize(next.nombre) ||
  normalize(current.apellidoPaterno) !== normalize(next.apellidoPaterno) ||
  normalize(current.apellidoMaterno) !== normalize(next.apellidoMaterno) ||
  normalize(current.nombreCompleto) !== normalize(next.nombreCompleto);

const buildProgressSnapshot = ({ scanned, candidates, updated, errors, dryRun, done = false }) => ({
  scanned,
  candidates,
  updated,
  errors,
  dryRun,
  done
});

export const repairPatientNames = async ({ dryRun = true, onProgress, maxDocs = 0 } = {}) => {
  const pacientesRef = collection(db, 'pacientes');

  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  let errors = 0;
  let lastDoc = null;

  while (true) {
    const pageQuery = lastDoc
      ? query(pacientesRef, orderBy(documentId()), startAfter(lastDoc), limit(PAGE_SIZE))
      : query(pacientesRef, orderBy(documentId()), limit(PAGE_SIZE));

    const pageSnap = await getDocs(pageQuery);
    if (pageSnap.empty) break;

    lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
    const updates = [];

    for (const row of pageSnap.docs) {
      const data = row.data() || {};
      scanned += 1;

      const currentNames = {
        nombre: data.nombre || '',
        apellidoPaterno: data.apellidoPaterno || '',
        apellidoMaterno: data.apellidoMaterno || '',
        nombreCompleto: data.nombreCompleto || ''
      };

      const nextNames = sanitizePatientNameFields(currentNames);
      if (hasNameChanges(currentNames, nextNames)) {
        candidates += 1;
        updates.push({
          id: row.id,
          payload: {
            ...nextNames,
            fechaActualizacion: new Date().toISOString(),
            nombreNormalizadoAt: serverTimestamp(),
            nombreNormalizadoVersion: 'v1'
          }
        });
      }

      if (typeof onProgress === 'function') {
        onProgress(buildProgressSnapshot({ scanned, candidates, updated, errors, dryRun }));
      }

      if (maxDocs > 0 && scanned >= maxDocs) break;
    }

    if (!dryRun && updates.length > 0) {
      for (let i = 0; i < updates.length; i += WRITE_BATCH_LIMIT) {
        const chunk = updates.slice(i, i + WRITE_BATCH_LIMIT);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          batch.update(doc(db, 'pacientes', item.id), item.payload);
        });

        try {
          await batch.commit();
          updated += chunk.length;
        } catch (batchError) {
          for (const item of chunk) {
            try {
              await updateDoc(doc(db, 'pacientes', item.id), item.payload);
              updated += 1;
            } catch {
              errors += 1;
            }
          }
        }

        if (typeof onProgress === 'function') {
          onProgress(buildProgressSnapshot({ scanned, candidates, updated, errors, dryRun }));
        }
      }
    }

    if (maxDocs > 0 && scanned >= maxDocs) break;
  }

  const summary = buildProgressSnapshot({ scanned, candidates, updated, errors, dryRun, done: true });
  if (typeof onProgress === 'function') onProgress(summary);
  return summary;
};
