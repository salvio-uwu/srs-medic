import { Meilisearch } from 'meilisearch';

const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;

const MEILISEARCH_URL = import.meta.env.VITE_MEILISEARCH_URL
  || (isProd ? 'http://100.95.63.70:7700' : 'http://localhost:7700');

const MEILISEARCH_KEY = import.meta.env.VITE_MEILISEARCH_API_KEY
  || 'srs-medic-master-key';

let client = null;

export const getMeiliClient = () => {
  if (!client) {
    const config = { host: MEILISEARCH_URL };
    if (MEILISEARCH_KEY) config.apiKey = MEILISEARCH_KEY;
    client = new Meilisearch(config);
  }
  return client;
};

export const PACIENTES_INDEX = 'pacientes';

export const ensurePatientIndex = async () => {
  const c = getMeiliClient();
  try {
    await c.getIndex(PACIENTES_INDEX);
  } catch {
    await c.createIndex(PACIENTES_INDEX, { primaryKey: 'id' });

    await c.index(PACIENTES_INDEX).updateSettings({
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
        minWordSizeForTypos: {
          oneTypo: 3,
          twoTypos: 5
        }
      }
    });
  }
};
