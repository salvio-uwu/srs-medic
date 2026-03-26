import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const PATIENT_LINKS_COLLECTION = 'patient_links';
const AUDIT_COLLECTION = 'auditoria_historial_migrado';

const normalizeMatchKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const buildLinkId = ({ pacienteId, modulePath, fileName }) => {
  const fileKey = normalizeMatchKey(modulePath || fileName || 'legacy');
  return `${pacienteId}__${fileKey || 'legacy'}`;
};

export const upsertPatientLegacyLink = async ({
  pacienteId,
  modulePath,
  fileName,
  patientName,
  legacyPatientId,
  fechaNacimiento,
  sexo,
  linkedBy,
  source = 'auditoria_migracion',
  confidence = 'alta'
}) => {
  if (!pacienteId || !modulePath) {
    return { status: 'skipped' };
  }

  const linkId = buildLinkId({ pacienteId, modulePath, fileName });

  await setDoc(
    doc(db, PATIENT_LINKS_COLLECTION, linkId),
    {
      pacienteId,
      modulePath,
      fileName: fileName || modulePath.split('/').pop() || 'sin_nombre.html',
      patientName: patientName || null,
      legacyPatientId: legacyPatientId || null,
      fechaNacimiento: fechaNacimiento || null,
      sexo: sexo || null,
      source,
      confidence,
      active: true,
      linkedBy: linkedBy || null,
      updatedAt: serverTimestamp(),
      linkedAt: serverTimestamp()
    },
    { merge: true }
  );

  return { status: 'linked', linkId };
};

export const listLegacyLinksByPaciente = async (pacienteId) => {
  if (!pacienteId) return [];

  const rowsByKey = new Map();

  const pushRows = (rows = []) => {
    rows.forEach((row) => {
      const key = `${row.modulePath || ''}::${row.fileName || row.id || ''}`;
      if (!key.trim()) return;
      if (!rowsByKey.has(key)) rowsByKey.set(key, row);
    });
  };

  const directLinksSnap = await getDocs(
    query(collection(db, PATIENT_LINKS_COLLECTION), where('pacienteId', '==', pacienteId))
  );

  pushRows(
    directLinksSnap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((row) => row.active !== false)
  );

  const pacienteSnap = await getDoc(doc(db, 'pacientes', pacienteId));
  const pacienteData = pacienteSnap.exists() ? pacienteSnap.data() || {} : {};

  const candidateLegacyIds = Array.from(
    new Set([pacienteData.idPaciente, pacienteData.idPacienteMigrado].map((v) => String(v || '').trim()).filter(Boolean))
  );

  const candidateNames = Array.from(
    new Set([pacienteData.nombreCompleto, pacienteData.nombre].map((v) => String(v || '').trim()).filter(Boolean))
  );

  for (const legacyId of candidateLegacyIds) {
    const linksByLegacyId = await getDocs(
      query(collection(db, PATIENT_LINKS_COLLECTION), where('legacyPatientId', '==', legacyId))
    );

    pushRows(
      linksByLegacyId.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((row) => row.active !== false)
    );

    const auditByLegacyId = await getDocs(
      query(collection(db, AUDIT_COLLECTION), where('patientId', '==', legacyId))
    );

    pushRows(
      auditByLegacyId.docs
        .map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: `audit_${docSnap.id}`,
            modulePath: data.modulePath || '',
            fileName: data.fileName || data.modulePath?.split('/').pop() || 'sin_nombre.html',
            patientName: data.patientName || pacienteData.nombreCompleto || null,
            legacyPatientId: data.patientId || legacyId,
            fechaNacimiento: data.fechaNacimiento || null,
            sexo: data.sexo || null,
            source: 'auditoria_historial_migrado',
            confidence: 'media',
            active: true
          };
        })
        .filter((row) => !!row.modulePath)
    );
  }

  for (const patientName of candidateNames) {
    const auditByName = await getDocs(
      query(collection(db, AUDIT_COLLECTION), where('patientName', '==', patientName))
    );

    pushRows(
      auditByName.docs
        .map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: `audit_name_${docSnap.id}`,
            modulePath: data.modulePath || '',
            fileName: data.fileName || data.modulePath?.split('/').pop() || 'sin_nombre.html',
            patientName: data.patientName || patientName,
            legacyPatientId: data.patientId || null,
            fechaNacimiento: data.fechaNacimiento || null,
            sexo: data.sexo || null,
            source: 'auditoria_historial_migrado',
            confidence: 'media',
            active: true
          };
        })
        .filter((row) => !!row.modulePath)
    );
  }

  return Array.from(rowsByKey.values()).sort((a, b) => String(a.fileName || '').localeCompare(String(b.fileName || ''), 'es'));
};
