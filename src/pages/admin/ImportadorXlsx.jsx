import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, Play, Pause, CheckCircle2, AlertCircle, Database, Users, FileText, Loader2, RotateCcw } from 'lucide-react';
import { parseXlsxFile, transformPatient, importPatientBatch, importConsultasBatch, preloadExistingPatients } from '../../services/migrationService';
import { repairPatientNames } from '../../services/patientNameRepairService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const XLSX_URL = '/data/pacientesold.xlsx';
const BATCH_SIZE = 50;
const CHECKPOINT_KEY = 'migracion_xlsx_checkpoint_v1';

const getCheckpoint = () => {
  try { return JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || 'null'); } catch { return null; }
};
const setCheckpoint = (data) => {
  try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data)); } catch { /* noop */ }
};
const clearCheckpoint = () => {
  try { localStorage.removeItem(CHECKPOINT_KEY); } catch { /* noop */ }
};

const ImportadorXlsx = () => {
  // Parsing
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState('');

  // Import state
  const [phase, setPhase] = useState('idle'); // idle | patients | consultas | done
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = React.useRef(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [results, setResults] = useState({ patients: null, consultas: null });
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Name repair state
  const [repairingNames, setRepairingNames] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairError, setRepairError] = useState('');
  const [repairSummary, setRepairSummary] = useState(null);

  // Preview
  const [previewTab, setPreviewTab] = useState('pacientes');

  // Saved checkpoint detection
  const [savedCheckpoint, setSavedCheckpoint] = useState(null);

  useEffect(() => {
    const cp = getCheckpoint();
    if (cp) setSavedCheckpoint(cp);
  }, []);

  const handleParseXlsx = useCallback(async () => {
    setParsing(true);
    setParseError('');
    setParsedData(null);
    try {
      const data = await parseXlsxFile(XLSX_URL);
      setParsedData(data);
    } catch (err) {
      console.error(err);
      setParseError(`Error al leer el archivo: ${err.message}`);
    } finally {
      setParsing(false);
    }
  }, []);

  const previewPatients = useMemo(() => {
    if (!parsedData?.pacientes) return [];
    return parsedData.pacientes.slice(0, 20).map((row) => ({
      legacy: row,
      transformed: transformPatient(row)
    }));
  }, [parsedData]);

  const stats = useMemo(() => {
    if (!parsedData) return null;
    const totalPx = parsedData.pacientes?.length || 0;
    const totalCx = parsedData.consultas?.length || 0;
    const withPhone = parsedData.pacientes?.filter((r) => String(r.tel_movil || '').trim()).length || 0;
    const withBlood = parsedData.pacientes?.filter((r) => String(r.grupo_sanguineo || '').trim()).length || 0;
    return { totalPx, totalCx, withPhone, withBlood };
  }, [parsedData]);

  const handleStartImport = useCallback(async () => {
    if (!parsedData || running) return;
    setRunning(true);
    setPaused(false);
    pausedRef.current = false;
    setErrorMsg('');

    const checkpoint = getCheckpoint();
    const startIdx = checkpoint?.phase === 'patients' ? (checkpoint.lastIndex || 0) : 0;

    try {
      // ── PRE-CARGAR ÍNDICE (1 sola lectura a Firestore) ──
      setStatusMsg('Cargando índice de pacientes existentes...');
      const patientIndex = await preloadExistingPatients((msg) => setStatusMsg(msg));
      setStatusMsg('');

      // ── FASE 1: PACIENTES ──
      setPhase('patients');
      const allPatients = parsedData.pacientes;
      let pxResults = checkpoint?.pxResults || { imported: 0, skipped: 0, updated: 0, errors: 0 };

      for (let i = startIdx; i < allPatients.length; i += BATCH_SIZE) {
        if (pausedRef.current) {
          setCheckpoint({ phase: 'patients', lastIndex: i, pxResults });
          setRunning(false);
          return;
        }

        const batch = allPatients.slice(i, i + BATCH_SIZE);
        const batchResult = await importPatientBatch(batch, parsedData.antecedentesSheets, (cur) => {
          setProgress({ current: i + cur, total: allPatients.length, label: `Pacientes: ${i + cur} / ${allPatients.length}` });
        }, patientIndex);

        pxResults = {
          imported: pxResults.imported + batchResult.imported,
          updated: pxResults.updated + batchResult.updated,
          skipped: pxResults.skipped + batchResult.skipped,
          errors: pxResults.errors + batchResult.errors
        };

        // Auto-save checkpoint every batch (survives browser crash)
        setCheckpoint({ phase: 'patients', lastIndex: i + BATCH_SIZE, pxResults });
        setResults((prev) => ({ ...prev, patients: { ...pxResults } }));
        setProgress({ current: i + batch.length, total: allPatients.length, label: `Pacientes: ${i + batch.length} / ${allPatients.length}` });
      }

      setResults((prev) => ({ ...prev, patients: pxResults }));

      // ── BUILD PATIENT ID MAP for consultas ──
      setProgress({ current: 0, total: 1, label: 'Construyendo mapa de pacientes para consultas...' });
      const snap = await getDocs(collection(db, 'pacientes'));
      const pxMap = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.idPacienteMigrado) {
          pxMap[String(data.idPacienteMigrado)] = { firestoreId: d.id, nombreCompleto: data.nombreCompleto || '' };
        }
      });

      // ── FASE 2: CONSULTAS ──
      setPhase('consultas');
      const allConsultas = parsedData.consultas;
      let cxResults = { imported: 0, skipped: 0, errors: 0 };

      for (let i = 0; i < allConsultas.length; i += BATCH_SIZE) {
        if (pausedRef.current) {
          setCheckpoint({ phase: 'consultas', lastIndex: i, cxResults });
          setRunning(false);
          return;
        }

        const batch = allConsultas.slice(i, i + BATCH_SIZE);
        const batchResult = await importConsultasBatch(batch, pxMap, (cur) => {
          setProgress({ current: i + cur, total: allConsultas.length, label: `Consultas: ${i + cur} / ${allConsultas.length}` });
        });

        cxResults = {
          imported: cxResults.imported + batchResult.imported,
          skipped: cxResults.skipped + batchResult.skipped,
          errors: cxResults.errors + batchResult.errors
        };

        // Auto-save checkpoint every batch
        setCheckpoint({ phase: 'consultas', lastIndex: i + BATCH_SIZE, cxResults });
        setResults((prev) => ({ ...prev, consultas: { ...cxResults } }));
      }

      setResults((prev) => ({ ...prev, consultas: cxResults }));
      setPhase('done');
      clearCheckpoint();
      setSavedCheckpoint(null);
    } catch (err) {
      console.error(err);
      setErrorMsg(`Error durante la importación: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [parsedData, running]);

  const handlePause = () => {
    pausedRef.current = true;
    setPaused(true);
  };

  const handleResume = () => {
    setPaused(false);
    pausedRef.current = false;
    handleStartImport();
  };

  const handleReset = () => {
    clearCheckpoint();
    setSavedCheckpoint(null);
    setPhase('idle');
    setResults({ patients: null, consultas: null });
    setProgress({ current: 0, total: 0, label: '' });
    setErrorMsg('');
  };

  const handleRepairNames = useCallback(async (dryRun = true) => {
    if (repairingNames) return;

    if (!dryRun) {
      const confirmed = window.confirm(
        'Esta accion actualizara pacientes en Firestore para normalizar nombre y apellidos. ¿Deseas continuar?'
      );
      if (!confirmed) return;
    }

    setRepairingNames(true);
    setRepairError('');
    setRepairSummary(null);
    setRepairStatus(dryRun ? 'Analizando registros...' : 'Aplicando correccion masiva...');

    try {
      const summary = await repairPatientNames({
        dryRun,
        onProgress: ({ scanned, candidates, updated, errors }) => {
          const base = dryRun ? 'Analizando' : 'Corrigiendo';
          setRepairStatus(
            `${base}: ${scanned.toLocaleString()} revisados, ${candidates.toLocaleString()} candidatos` +
            `${dryRun ? '' : `, ${updated.toLocaleString()} actualizados`}` +
            `${errors > 0 ? `, ${errors.toLocaleString()} errores` : ''}`
          );
        }
      });

      setRepairSummary(summary);
      if (dryRun) {
        setRepairStatus(
          `Analisis completo: ${summary.scanned.toLocaleString()} revisados, ${summary.candidates.toLocaleString()} candidatos a correccion.`
        );
      } else {
        setRepairStatus(
          `Correccion completa: ${summary.updated.toLocaleString()} actualizados de ${summary.candidates.toLocaleString()} candidatos.`
        );
      }
    } catch (error) {
      console.error(error);
      setRepairError(`No fue posible completar el proceso: ${error.message}`);
    } finally {
      setRepairingNames(false);
    }
  }, [repairingNames]);

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── HEADER ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Database size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
              Importar pacientes desde XLSX
            </h2>
            <p className="text-xs text-slate-500">
              Lee <code className="bg-slate-100 px-1 rounded">pacientesold.xlsx</code> y lo adapta al schema de SRS-Medic.
            </p>
          </div>
        </div>

        {!parsedData && !parsing && (
          <button
            onClick={handleParseXlsx}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
          >
            <Upload size={16} /> Cargar y analizar archivo
          </button>
        )}

        {parsing && (
          <div className="flex items-center gap-2 text-sm text-indigo-600 font-semibold">
            <Loader2 size={16} className="animate-spin" /> Leyendo archivo XLSX (77 MB)... esto puede tardar unos segundos.
          </div>
        )}

        {parseError && (
          <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {parseError}
          </div>
        )}

        {/* Checkpoint detected banner */}
        {savedCheckpoint && !parsedData && !parsing && (
          <div className="mt-3 p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
            <p className="text-sm font-bold text-blue-800 flex items-center gap-2">
              <Database size={16} /> Migración en progreso detectada
            </p>
            <p className="text-xs text-blue-700">
              Fase: <strong>{savedCheckpoint.phase === 'patients' ? 'Pacientes' : 'Consultas'}</strong>
              {savedCheckpoint.phase === 'patients' && savedCheckpoint.pxResults && (
                <> — {savedCheckpoint.pxResults.imported?.toLocaleString()} importados, último índice: {savedCheckpoint.lastIndex?.toLocaleString()}</>)}
              {savedCheckpoint.phase === 'consultas' && savedCheckpoint.cxResults && (
                <> — {savedCheckpoint.cxResults.imported?.toLocaleString()} consultas importadas, último índice: {savedCheckpoint.lastIndex?.toLocaleString()}</>)}
            </p>
            <p className="text-xs text-blue-600">
              Carga el archivo XLSX para reanudar desde donde te quedaste.
            </p>
          </div>
        )}
      </div>

      {/* ── ESTADÍSTICAS RÁPIDAS ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-bold">Pacientes</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalPx.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-bold">Consultas</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalCx.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-bold">Con teléfono</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.withPhone.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-bold">Con grupo sanguíneo</p>
            <p className="text-2xl font-bold text-blue-700">{stats.withBlood.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ── REPARACION MASIVA DE NOMBRES ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Database size={18} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Saneo masivo de nombres</h3>
        </div>

        <p className="text-xs text-slate-600">
          Normaliza los campos <strong>nombre</strong>, <strong>apellidoPaterno</strong>, <strong>apellidoMaterno</strong> y <strong>nombreCompleto</strong>
          para remover duplicados tipo "Nombre Apellido Apellido".
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleRepairNames(true)}
            disabled={repairingNames}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-300 text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors disabled:opacity-60"
          >
            {repairingNames ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />} Analizar registros
          </button>

          <button
            onClick={() => handleRepairNames(false)}
            disabled={repairingNames}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {repairingNames ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Aplicar correccion
          </button>
        </div>

        {repairStatus && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
            {repairStatus}
          </div>
        )}

        {repairError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {repairError}
          </div>
        )}

        {repairSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Revisados</p>
              <p className="text-xl font-bold text-slate-800">{repairSummary.scanned.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[10px] text-amber-600 uppercase font-bold">Candidatos</p>
              <p className="text-xl font-bold text-amber-800">{repairSummary.candidates.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[10px] text-emerald-600 uppercase font-bold">Actualizados</p>
              <p className="text-xl font-bold text-emerald-800">{repairSummary.updated.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-[10px] text-red-600 uppercase font-bold">Errores</p>
              <p className="text-xl font-bold text-red-800">{repairSummary.errors.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── PREVIEW ── */}
      {parsedData && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Preview de datos (primeros 20)</span>
            </div>
            <div className="flex gap-1">
              {['pacientes', 'transformados'].map((t) => (
                <button
                  key={t}
                  onClick={() => setPreviewTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                    previewTab === t ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t === 'pacientes' ? 'Datos Legacy' : 'Adaptados a SRS-Medic'}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {previewTab === 'pacientes'
                    ? ['#', 'ID Legacy', 'Identificador', 'Nombre', 'Ap. Paterno', 'Ap. Materno', 'Sexo', 'Nacimiento', 'Teléfono', 'Grupo Sang.']
                      .map((h) => <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">{h}</th>)
                    : ['#', 'nombreCompleto', 'idPaciente', 'idPacienteMigrado', 'sexo', 'fechaNacimiento', 'telefonoMovil', 'grupoSanguineo', 'municipioEstado']
                      .map((h) => <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">{h}</th>)
                  }
                </tr>
              </thead>
              <tbody>
                {previewPatients.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                    {previewTab === 'pacientes' ? (
                      <>
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{row.legacy.id}</td>
                        <td className="px-3 py-2 font-mono text-blue-600">{row.legacy.identificador || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{row.legacy.nombre}</td>
                        <td className="px-3 py-2 text-slate-700">{row.legacy.apellido_paterno}</td>
                        <td className="px-3 py-2 text-slate-700">{row.legacy.apellido_materno || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.legacy.sexo}</td>
                        <td className="px-3 py-2 text-slate-600">{row.legacy.nacimiento}</td>
                        <td className="px-3 py-2 text-slate-600">{row.legacy.tel_movil || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.legacy.grupo_sanguineo || '—'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{row.transformed.nombreCompleto}</td>
                        <td className="px-3 py-2 font-mono text-blue-600">{row.transformed.idPaciente}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{row.transformed.idPacienteMigrado}</td>
                        <td className="px-3 py-2 text-slate-600">{row.transformed.sexo}</td>
                        <td className="px-3 py-2 text-emerald-700 font-mono">{row.transformed.fechaNacimiento}</td>
                        <td className="px-3 py-2 text-slate-600">{row.transformed.telefonoMovil || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.transformed.grupoSanguineo || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.transformed.municipioEstado || '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONTROLES DE IMPORTACIÓN ── */}
      {parsedData && phase !== 'done' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Ejecutar migración</h3>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-semibold">
            ⚠️ Se importarán {stats?.totalPx.toLocaleString()} pacientes + {stats?.totalCx.toLocaleString()} consultas + antecedentes.
            Los duplicados se detectan por ID migrado, ID de paciente y nombre+fecha. Se puede pausar y reanudar.
          </div>

          <div className="flex flex-wrap gap-2">
            {!running && !paused && (
              <button
                onClick={handleStartImport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-colors"
              >
                <Play size={16} /> Iniciar migración completa
              </button>
            )}

            {running && !paused && (
              <button
                onClick={handlePause}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 shadow-md transition-colors"
              >
                <Pause size={16} /> Pausar
              </button>
            )}

            {paused && (
              <button
                onClick={handleResume}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md transition-colors"
              >
                <Play size={16} /> Reanudar
              </button>
            )}

            {(paused || phase === 'done') && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                <RotateCcw size={14} /> Reiniciar
              </button>
            )}
          </div>

          {/* Progress bar */}
          {(running || paused) && progress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>{progress.label}</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* ── RESULTADOS ── */}
      {(results.patients || results.consultas) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              {phase === 'done' ? 'Migración completada' : 'Progreso parcial'}
            </h3>
          </div>

          {results.patients && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[10px] text-emerald-600 uppercase font-bold">Importados</p>
                <p className="text-xl font-bold text-emerald-800">{results.patients.imported.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-[10px] text-blue-600 uppercase font-bold">Actualizados</p>
                <p className="text-xl font-bold text-blue-800">{results.patients.updated.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Omitidos</p>
                <p className="text-xl font-bold text-slate-700">{results.patients.skipped.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-[10px] text-red-600 uppercase font-bold">Errores</p>
                <p className="text-xl font-bold text-red-800">{results.patients.errors.toLocaleString()}</p>
              </div>
            </div>
          )}

          {results.consultas && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Consultas (historial_clinico)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[10px] text-emerald-600 uppercase font-bold">Importadas</p>
                  <p className="text-xl font-bold text-emerald-800">{results.consultas.imported.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Omitidas</p>
                  <p className="text-xl font-bold text-slate-700">{results.consultas.skipped.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-[10px] text-red-600 uppercase font-bold">Errores</p>
                  <p className="text-xl font-bold text-red-800">{results.consultas.errors.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportadorXlsx;
