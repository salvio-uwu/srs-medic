/**
 * migrationService.js
 * Servicio para migrar pacientes desde pacientesold.xlsx (MedicalManik) a Firestore.
 * Adapta los datos legacy al schema exacto que usa SRS-Medic.
 */
import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { buildPatientHumanId } from '../utils/patientId';
import { sanitizePatientNameFields } from '../utils/patientName';

// ─── UTILIDADES DE TRANSFORMACIÓN ───

/** DD/MM/YYYY → YYYY-MM-DD */
export const convertLegacyDate = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim();
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return s; // ya es ISO u otro formato
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

/** DD/MM/YYYY HH:MM → Date object */
export const parseLegacyDateTime = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', mi = '0'] = match;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
  return Number.isNaN(d.getTime()) ? null : d;
};

const cleanStr = (v) => String(v ?? '').trim();
const cleanNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? String(n) : ''; };

// ─── TRANSFORMAR PACIENTE ───

export const transformPatient = (row) => {
  const rawNombre = cleanStr(row.nombre);
  const rawApellidoPaterno = cleanStr(row.apellido_paterno);
  const rawApellidoMaterno = cleanStr(row.apellido_materno);
  const { nombre, apellidoPaterno, apellidoMaterno, nombreCompleto } = sanitizePatientNameFields({
    nombre: rawNombre,
    apellidoPaterno: rawApellidoPaterno,
    apellidoMaterno: rawApellidoMaterno,
    nombreCompleto: [rawNombre, rawApellidoPaterno, rawApellidoMaterno].filter(Boolean).join(' ')
  });
  const fechaNacimiento = convertLegacyDate(row.nacimiento);
  const identificador = cleanStr(row.identificador);
  const idPaciente = identificador || buildPatientHumanId(nombreCompleto, fechaNacimiento || null);

  return {
    // Identidad
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    nombreCompleto,
    idPaciente,
    idPacienteMigrado: cleanStr(row.id),
    // Datos personales
    sexo: cleanStr(row.sexo), // "Masculino"/"Femenino" — ya coincide
    fechaNacimiento,
    grupoSanguineo: cleanStr(row.grupo_sanguineo),
    telefonoMovil: cleanStr(row.tel_movil),
    telefonoFijo: cleanStr(row.tel_fijo),
    email: cleanStr(row.correo),
    notasPersonales: cleanStr(row.nota),
    curp: '',
    // Dirección
    pais: 'México',
    calleNumero: '',
    cp: cleanStr(row.codigo_postal),
    colonia: cleanStr(row.colonia),
    municipioEstado: [cleanStr(row.municipio), cleanStr(row.estado)].filter(Boolean).join(', '),
    // Padecimientos rápidos
    padecimientoHipertension: false,
    padecimientoDiabetes: false,
    padecimientoObesidad: false,
    padecimientoArtritis: false,
    // Info de interés
    escolaridad: '',
    lengua: '',
    derechohabiente: 'Ninguno',
    programaProspera: 'No',
    cruzadaHambre: 'No',
    esIndigena: 'No',
    esAfromexicano: 'No',
    empresa: '',
    aseguradora: cleanStr(row.aseguradora),
    // Control
    fechaRegistro: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    origenRegistro: 'migracion_xlsx_medicalmanik',
    migradoDesde: 'pacientesold.xlsx'
  };
};

// ─── TRANSFORMAR ANTECEDENTES ───

export const transformAntecedentes = (sheets, legacyId) => {
  const idStr = String(legacyId);
  const ahf = sheets.heredoFamiliar?.[idStr];
  const anp = sheets.noPatologicos?.[idStr];
  const ap = sheets.patologicos?.[idStr];
  const av = sheets.alergiasVacunas?.[idStr];
  const ago = sheets.ginecoObstetricos?.[idStr];
  const ped = sheets.pediatricos?.[idStr];

  const result = {};
  let hasData = false;

  // Heredofamiliares
  if (ahf) {
    const negados = cleanStr(ahf.interrogados_y_negados);
    const hered = { preguntados_y_negados: !!negados };
    const campos = ['diabetes', 'hipertension', 'cardiopatia', 'hepatopatia', 'nefropatia',
      'enfermedades_mentales', 'enfermedades_alergicas', 'enfermedades_endocrinas', 'asma', 'cancer', 'obesidad'];
    campos.forEach((c) => {
      const val = cleanStr(ahf[c]);
      if (val) {
        hered[c] = {};
        const famMap = { 'Mamá': 'mama', 'Papá': 'papa', 'Hermanos': 'hermanos', 'Tíos': 'tios', 'Primos': 'primos', 'Abuelos': 'abuelos' };
        val.split(',').map((s) => s.trim()).forEach((fam) => {
          const k = famMap[fam] || fam.toLowerCase();
          hered[c][k] = true;
        });
        hasData = true;
      }
    });
    if (cleanStr(ahf.otros_hereditarios_familiares)) {
      hered.otros = cleanStr(ahf.otros_hereditarios_familiares);
      hasData = true;
    }
    if (hasData || negados) result.hereditarios = hered;
  }

  // No patológicos
  if (anp) {
    const np = {};
    let npHas = false;
    const mapNp = { banio: 'bano', lavado_dientes: 'lavado_de_dientes', habitacion: 'habitacion', alimentacion: 'alimentacion', sedentarismo: 'sedentarismo' };
    Object.entries(mapNp).forEach(([src, dst]) => {
      const val = cleanStr(anp[src]);
      if (val) { np[dst] = val; npHas = true; }
    });
    if (cleanStr(anp.otros_no_patologicos)) { np.otros = cleanStr(anp.otros_no_patologicos); npHas = true; }
    if (npHas) { result.no_patologicos = np; hasData = true; }
  }

  // Patológicos
  if (ap) {
    const pat = {};
    let patHas = false;
    const directMap = {
      enfermedades_actuales: 'actuales',
      quirurgicos: 'quirurgicos',
      transfusionales: 'transfusionales',
      traumaticos: 'traumaticos',
      hospitalizaciones_previas: 'hospitalizaciones'
    };
    Object.entries(directMap).forEach(([src, dst]) => {
      const val = cleanStr(ap[src]);
      if (val) { pat[dst] = val; patHas = true; }
    });
    // Adicciones
    const tab = cleanStr(ap.tabaquismo);
    const alc = cleanStr(ap.alcoholismo);
    const dro = cleanStr(ap.drogas);
    const otraAd = cleanStr(ap.otras_adicciones);
    if (tab || alc || dro || otraAd) {
      pat.adicciones = {
        tabaquismo: !!tab,
        alcohol: !!alc,
        drogas: !!dro,
        detalle: [tab, alc, dro, otraAd].filter(Boolean).join('. ')
      };
      patHas = true;
    }
    // Específicos
    const especMap = { glaucoma: 'glaucoma', calculo_biliar: 'calculo', reflujo_gastroesofagico: 'reflujo', incontinencia_urinaria: 'incontinencia', dislipidemias: 'dislipidemias' };
    const espec = {};
    let especHas = false;
    Object.entries(especMap).forEach(([src, dst]) => {
      const val = cleanStr(ap[src]);
      if (val) { espec[dst] = val; especHas = true; }
    });
    if (cleanStr(ap.otros_patologicos)) { espec.otro = cleanStr(ap.otros_patologicos); especHas = true; }
    if (especHas) { pat.especificos = espec; patHas = true; }
    if (patHas) { result.patologicos = pat; hasData = true; }
  }

  // Alergias
  if (av) {
    const alergiaRaw = cleanStr(av.alergias);
    if (alergiaRaw) {
      hasData = true;
      const negado = /negad/i.test(alergiaRaw);
      if (negado) {
        result.alergias = { preguntados_y_negados: true, lista: [], otros: '' };
      } else {
        const lista = alergiaRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean).map((s) => ({ sustancia: s, nombre: s }));
        result.alergias = { preguntados_y_negados: false, lista, otros: '' };
      }
    }
    const vacunaRaw = cleanStr(av.vacunas);
    if (vacunaRaw) {
      result.vacunas = { lista: [], otros: vacunaRaw };
      hasData = true;
    }
  }

  // Gineco-obstétricos
  if (ago) {
    const go = {};
    let goHas = false;
    const goMap = {
      menarquia: 'menarca', ivsa: 'ivsa', menopausia: 'menopausia',
      total_embarazos: 'gestas', num_partos: 'partos', num_cesareas: 'cesareas',
      num_abortos: 'abortos', num_nacidos_vivos: 'nacidos_vivos', num_vivos_actuales: 'vivos_actuales',
      num_parejas_sexuales: 'parejas_sexuales',
      caracteristica_menstruacion: 'caracteristicas_menstruacion',
      otros_menstruacion: 'menstruacion_otros',
      metodos_anticonceptivos: 'metodos_anticonceptivos_texto',
      presencia_otros_flujos_vaginales: 'flujos_vaginales',
      procedimientos_ginecologicos: 'procedimientos_ginecologicos',
      habitos: 'habitos', otros_interes: 'otros_ginecologicos'
    };
    Object.entries(goMap).forEach(([src, dst]) => {
      const val = cleanStr(ago[src]);
      if (val) { go[dst] = val; goHas = true; }
    });
    const fumVal = cleanStr(ago.fum);
    if (fumVal) { go.fum = convertLegacyDate(fumVal); goHas = true; }
    const papVal = cleanStr(ago.fecha_ultimo_papanicolaou);
    if (papVal) { go.fecha_papanicolaou = convertLegacyDate(papVal); go.papanicolaou_check = true; goHas = true; }
    const colpVal = cleanStr(ago.fecha_ultima_colposcopia);
    if (colpVal) { go.fecha_colposcopia = convertLegacyDate(colpVal); go.colposcopia_check = true; goHas = true; }
    if (goHas) { result.gineco_obstetricos = go; hasData = true; }
  }

  // Pediátricos
  if (ped) {
    const padres = {};
    let padresHas = false;
    if (cleanStr(ped.nombre_madre)) { padres.madre_nombre = cleanStr(ped.nombre_madre); padresHas = true; }
    if (cleanStr(ped.nombre_padre)) { padres.padre_nombre = cleanStr(ped.nombre_padre); padresHas = true; }
    if (cleanStr(ped.edad_madre)) { padres.edad_madre_embarazo = cleanStr(ped.edad_madre); padresHas = true; }
    if (cleanStr(ped.numero_embarazo)) { padres.numero_embarazo = cleanStr(ped.numero_embarazo); padresHas = true; }
    if (cleanStr(ped.semanas_gestacion)) { padres.semanas_gestacion = cleanStr(ped.semanas_gestacion); padresHas = true; }
    if (padresHas) { result.padres = padres; hasData = true; }

    // Perinatales
    const peri = {};
    let periHas = false;
    const periMap = {
      nombre_anestesia: 'anestesia', sitio_atencion: 'sitio_atencion',
      tipo_nacimiento: 'tipo_nacimiento', duracion_parto: 'duracion_parto',
      peso_nacimiento: 'peso', talla_nacimiento: 'talla', apgar: 'apgar',
      silverman_anderson: 'silverman', tamiz_auditivo: 'tamiz_auditivo',
      tamiz_metabolico: 'tamiz_metabolico', maniobras_reanimacion: 'reanimacion',
      otros_perinatales: 'otros'
    };
    Object.entries(periMap).forEach(([src, dst]) => {
      const val = cleanStr(ped[src]);
      if (val) { peri[dst] = val; periHas = true; }
    });
    if (cleanStr(ped.curso_normal)) {
      peri.curso_normal = /si|sí|normal/i.test(cleanStr(ped.curso_normal));
      periHas = true;
    }
    if (periHas) { result.perinatales = peri; hasData = true; }

    // Psicomotor
    const psico = {};
    let psicoHas = false;
    const psicoMap = {
      siguio_objetos: 'siguio_objetos', sostuvo_cabeza: 'sostuvo_cabeza', 'sedestación': 'sedestacion',
      rodamiento: 'rodamiento', bisilabos: 'bisilabos', sonrio: 'sonrio', camino: 'camino',
      corrio: 'correr', gateo: 'gateo', lenguaje_fluido: 'lenguaje_fluido',
      bipedestacion: 'bipedestacion', subir_escaleras: 'subir_escaleras',
      control_esfinteres: 'control_esfinteres', desempeno_escolar: 'desempeno_escolar',
      otros_psicomotor: 'otros_psicomotor'
    };
    Object.entries(psicoMap).forEach(([src, dst]) => {
      const val = cleanStr(ped[src]);
      if (val) { psico[dst] = val; psicoHas = true; }
    });
    if (psicoHas) { result.psicomotor = psico; hasData = true; }
  }

  return hasData ? result : null;
};

// ─── TRANSFORMAR CONSULTA → historial_clinico ───

export const transformConsulta = (row, pacienteId, pacienteNombre) => {
  const fecha = parseLegacyDateTime(row.fecha);
  if (!fecha) return null;

  // Parsear diagnóstico CIE-10: "J029-Faringitis aguda, no especificada,"
  const diagRaw = cleanStr(row.diagnostico);
  let diagTexto = diagRaw;
  const diagMatch = diagRaw.match(/^([A-Z]\d{2,3}(?:\.\d+)?)\s*[-–]\s*(.+?)(?:,\s*)?$/);
  if (diagMatch) diagTexto = `${diagMatch[1]} - ${diagMatch[2]}`;

  return {
    pacienteId,
    pacienteNombre,
    medicoNombre: cleanStr(row.nombre_medico),
    medicoPerfil: { nombre: cleanStr(row.nombre_medico), cedula: '', especialidad: '' },
    medicoId: 'migracion_legacy',
    citaId: null,
    tipoNota: cleanStr(row.tipo) || 'Consulta General',
    fecha, // Date object — Firestore lo convierte a Timestamp
    consulta: {
      padecimiento: cleanStr(row.padecimiento),
      exploracion: {
        signos: {
          temp: cleanNum(row.temperatura),
          ta: cleanStr(row.tension_arterial),
          fc: cleanNum(row.frecuencia_cardiaca),
          fr: cleanNum(row.frecuencia_respiratoria),
          spo2: ''
        },
        antropometria: {
          peso: cleanNum(row.peso),
          talla: cleanNum(row.talla),
          imc: (row.peso && row.talla) ? (() => {
            let t = parseFloat(row.talla);
            const p = parseFloat(row.peso);
            if (t > 3) t = t / 100;
            return (t > 0 && p > 0) ? (p / (t * t)).toFixed(2) : '';
          })() : ''
        },
        fisica: {
          habitus_exterior: cleanStr(row.habitus_exterior),
          cabeza: cleanStr(row.cabeza),
          cuello: cleanStr(row.cuello),
          torax: cleanStr(row.torax),
          abdomen: cleanStr(row.abdomen),
          extremidades: cleanStr(row.extremidades),
          genitales: cleanStr(row.genitales),
          columna_vertebral: cleanStr(row.columna_vertebral)
        }
      },
      diagnostico: {
        enfermedad_actual: diagTexto,
        indicaciones: '',
        pronostico: cleanStr(row.pronostico),
        tratamiento_lista: []
      },
      estudios: cleanStr(row.estudios)
    },
    resumen: {},
    antecedentes: {},
    control_embarazo: {},
    px_info: {},
    meta: {},
    costo: 0,
    recetasGeneradas: [],
    documentosGenerados: [],
    auditSnapshot: { status: 'aprobado', score: 100, source: 'migracion_legacy' },
    origenRegistro: 'migracion_xlsx_medicalmanik',
    migradoDesde: 'pacientesold.xlsx'
  };
};

// ─── PRE-CARGAR ÍNDICE DE PACIENTES (optimización: 1 sola lectura) ───

export const preloadExistingPatients = async (onStatus) => {
  if (onStatus) onStatus('Cargando directorio de pacientes existentes...');
  const snap = await getDocs(collection(db, 'pacientes'));
  const byMigratedId = new Map();  // idPacienteMigrado → docId
  const byIdPaciente = new Map();  // idPaciente → docId
  const byNameDate = new Map();    // "nombreCompleto|fechaNacimiento" → docId

  snap.docs.forEach((d) => {
    const data = d.data();
    const docId = d.id;
    if (data.idPacienteMigrado) byMigratedId.set(String(data.idPacienteMigrado), docId);
    if (data.idPaciente) byIdPaciente.set(String(data.idPaciente), docId);
    if (data.nombreCompleto && data.fechaNacimiento) {
      byNameDate.set(`${data.nombreCompleto}|${data.fechaNacimiento}`, docId);
    }
  });

  if (onStatus) onStatus(`Índice cargado: ${snap.docs.length.toLocaleString()} pacientes en memoria.`);
  return { byMigratedId, byIdPaciente, byNameDate, total: snap.docs.length };
};

// ─── DETECCIÓN DE DUPLICADOS (in-memory, sin queries) ───

export const findDuplicateLocal = (patient, index) => {
  if (patient.idPacienteMigrado && index.byMigratedId.has(patient.idPacienteMigrado)) {
    return { exists: true, docId: index.byMigratedId.get(patient.idPacienteMigrado), matchType: 'idMigrado' };
  }
  if (patient.idPaciente && index.byIdPaciente.has(patient.idPaciente)) {
    return { exists: true, docId: index.byIdPaciente.get(patient.idPaciente), matchType: 'idPaciente' };
  }
  if (patient.nombreCompleto && patient.fechaNacimiento) {
    const key = `${patient.nombreCompleto}|${patient.fechaNacimiento}`;
    if (index.byNameDate.has(key)) {
      return { exists: true, docId: index.byNameDate.get(key), matchType: 'nombre+fecha' };
    }
  }
  return { exists: false, docId: null, matchType: null };
};

// ─── IMPORTAR BATCH (optimizado con writeBatch + índice local) ───

const WRITE_BATCH_LIMIT = 450; // Firestore max es 500, dejamos margen

export const importPatientBatch = async (patients, antecedentesSheets, onProgress, patientIndex) => {
  const results = { imported: 0, skipped: 0, updated: 0, errors: 0, details: [] };

  // Separar en: nuevos vs ya existentes
  const toCreate = [];
  const toSkip = [];

  for (const row of patients) {
    try {
      const transformed = transformPatient(row);
      const dup = findDuplicateLocal(transformed, patientIndex);
      if (dup.exists) {
        toSkip.push({ transformed, row });
        results.skipped += 1;
      } else {
        toCreate.push({ transformed, row });
      }
    } catch (err) {
      results.errors += 1;
      results.details.push({ name: row?.nombre || '?', status: 'error', error: err.message });
    }
  }

  // Escribir nuevos en sub-batches de 450
  for (let i = 0; i < toCreate.length; i += WRITE_BATCH_LIMIT) {
    const chunk = toCreate.slice(i, i + WRITE_BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const { transformed, row } of chunk) {
      try {
        const data = { ...transformed, migradoAt: serverTimestamp() };
        const antecedentes = transformAntecedentes(antecedentesSheets, row.id);
        if (antecedentes) data.antecedentesClinicos = antecedentes;

        const newRef = doc(collection(db, 'pacientes'));
        batch.set(newRef, data);

        // Actualizar índice local para siguientes batches
        patientIndex.byMigratedId.set(transformed.idPacienteMigrado, newRef.id);
        if (transformed.idPaciente) patientIndex.byIdPaciente.set(transformed.idPaciente, newRef.id);
        if (transformed.nombreCompleto && transformed.fechaNacimiento) {
          patientIndex.byNameDate.set(`${transformed.nombreCompleto}|${transformed.fechaNacimiento}`, newRef.id);
        }

        results.imported += 1;
      } catch (err) {
        results.errors += 1;
      }
    }

    try {
      await batch.commit();
    } catch (batchErr) {
      // Si falla el batch, reintentar uno por uno
      console.warn('Batch falló, reintentando individualmente:', batchErr.message);
      for (const { transformed, row } of chunk) {
        try {
          const data = { ...transformed, migradoAt: serverTimestamp() };
          const antecedentes = transformAntecedentes(antecedentesSheets, row.id);
          if (antecedentes) data.antecedentesClinicos = antecedentes;
          await addDoc(collection(db, 'pacientes'), data);
        } catch (err) {
          results.errors += 1;
          results.imported -= 1;
        }
      }
    }

    if (onProgress) onProgress(Math.min(i + WRITE_BATCH_LIMIT, toCreate.length) + toSkip.length, patients.length);
  }

  if (onProgress) onProgress(patients.length, patients.length);
  return results;
};

// ─── IMPORTAR CONSULTAS EN BATCH (optimizado con writeBatch) ───

export const importConsultasBatch = async (consultas, patientIdMap, onProgress) => {
  const results = { imported: 0, skipped: 0, errors: 0 };
  const toWrite = [];

  // Preparar todas las transformaciones primero (CPU-only, sin network)
  for (const row of consultas) {
    const legacyPatientId = String(row.id);
    const mapping = patientIdMap[legacyPatientId];
    if (!mapping) { results.skipped += 1; continue; }

    const transformed = transformConsulta(row, mapping.firestoreId, mapping.nombreCompleto);
    if (!transformed) { results.skipped += 1; continue; }

    toWrite.push(transformed);
  }

  // Escribir en sub-batches de 450
  for (let i = 0; i < toWrite.length; i += WRITE_BATCH_LIMIT) {
    const chunk = toWrite.slice(i, i + WRITE_BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const data of chunk) {
      const newRef = doc(collection(db, 'historial_clinico'));
      batch.set(newRef, data);
    }

    try {
      await batch.commit();
      results.imported += chunk.length;
    } catch (batchErr) {
      console.warn('Batch de consultas falló, reintentando:', batchErr.message);
      for (const data of chunk) {
        try {
          await addDoc(collection(db, 'historial_clinico'), data);
          results.imported += 1;
        } catch { results.errors += 1; }
      }
    }

    if (onProgress) onProgress(i + chunk.length, toWrite.length);
  }

  return results;
};

// ─── PARSEAR XLSX CON SheetJS ───

export const parseXlsxFile = async (fileUrl) => {
  const XLSX = await import('xlsx');
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const readSheet = (name) => {
    const ws = wb.Sheets[name];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  };

  const indexById = (rows) => {
    const map = {};
    rows.forEach((r) => { if (r.id != null) map[String(r.id)] = r; });
    return map;
  };

  return {
    pacientes: readSheet('Pacientes'),
    consultas: readSheet('Consultas-01.05.2023-30.04.2026'),
    antecedentesSheets: {
      heredoFamiliar: indexById(readSheet('AntecedentesHeredoFamiliar')),
      noPatologicos: indexById(readSheet('AntecedentesNoPatologicos')),
      patologicos: indexById(readSheet('AntecedentesPatologicos')),
      alergiasVacunas: indexById(readSheet('AlergiasyVacunas')),
      ginecoObstetricos: indexById(readSheet('AntecedentesGinecoObstetricos')),
      pediatricos: indexById(readSheet('AntecedentesPediatricos'))
    }
  };
};
