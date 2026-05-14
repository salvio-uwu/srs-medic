#!/usr/bin/env node
// scripts/seed-meilisearch.mjs
// One-time seed: reads all patients from Firestore and indexes into Meilisearch.
//
// Usage:
//   node scripts/seed-meilisearch.mjs email@example.com password
//
// For production (Meilisearch hosted on dev server 100.95.63.70):
//   MEILI_URL=http://100.95.63.70:7700 node scripts/seed-meilisearch.mjs email@example.com password

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { Meilisearch } from 'meilisearch';

const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY || 'srs-medic-master-key';
const INDEX_NAME = 'pacientes';
const BATCH_SIZE = 1000;

const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Uso: node scripts/seed-meilisearch.mjs <email> <password>');
  console.error('   Se requiere un usuario de Firebase con acceso a la colección pacientes.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: "AIzaSyCIPnSQkdWm6YgdYlIZ8G5V4wu-oTFFTfg",
  authDomain: "srs-feacb.firebaseapp.com",
  projectId: "srs-feacb",
  storageBucket: "srs-feacb.firebasestorage.app",
  messagingSenderId: "568441727812",
  appId: "1:568441727812:web:ddc7f3ab84e2a5ab440511",
  measurementId: "G-1RR7H5R4PB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const client = new Meilisearch({ host: MEILI_URL, apiKey: MEILI_KEY });

const setupIndex = async () => {
  try {
    await client.getIndex(INDEX_NAME);
  } catch {
    await client.createIndex(INDEX_NAME, { primaryKey: 'id' });
  }

  await client.index(INDEX_NAME).updateSettings({
    searchableAttributes: [
      'nombreCompleto',
      'apellidoPaterno',
      'apellidoMaterno',
      'idPaciente',
      'idPacienteMigrado',
      'telefonoMovil',
      'curp'
    ],
    filterableAttributes: ['sexo'],
    sortableAttributes: ['nombreCompleto'],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 5 }
    }
  });

  console.log('[seed] Index configurado correctamente.');
};

const main = async () => {
  console.log('[seed] Autenticando en Firebase...');
  await signInWithEmailAndPassword(auth, email, password);
  console.log('[seed] Autenticado correctamente.');

  console.log('[seed] Leyendo pacientes de Firestore...');
  const snapshot = await getDocs(collection(db, 'pacientes'));
  const allDocs = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));

  console.log(`[seed] ${allDocs.length} pacientes leídos de Firestore.`);

  await setupIndex();

  const meiliIndex = client.index(INDEX_NAME);

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = allDocs.slice(i, i + BATCH_SIZE).map((doc) => {
      const { id, ...data } = doc;
      return {
        id,
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
      };
    });

    await meiliIndex.addDocuments(batch);
    console.log(`[seed] Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} documentos indexados.`);
  }

  console.log('[seed] Indexación completada.');
  process.exit(0);
};

main().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
