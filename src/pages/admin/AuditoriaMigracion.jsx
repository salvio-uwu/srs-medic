import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, ClipboardCheck, ExternalLink, Eye, Filter, Search, ShieldCheck } from 'lucide-react';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { upsertPatientLegacyLink } from '../../services/patientLinkService';

const htmlModules = import.meta.glob('../../../historialmedico/*.html', {
  query: '?url',
  import: 'default'
});

const AUDIT_COLLECTION = 'auditoria_historial_migrado';
const SYNC_STATE_KEY = 'migracion_historial_sync_state_v1';

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const normalizeMatchKey = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const cleanText = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getStoredSyncState = () => {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return { processedPaths: {} };
    const parsed = JSON.parse(raw);
    return {
      processedPaths: parsed?.processedPaths || {},
      startedAt: parsed?.startedAt || null,
      lastFile: parsed?.lastFile || ''
    };
  } catch {
    return { processedPaths: {} };
  }
};

const setStoredSyncState = (nextState) => {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore localStorage failures (private mode/quota)
  }
};

const clearStoredSyncState = () => {
  try {
    localStorage.removeItem(SYNC_STATE_KEY);
  } catch {
    // Ignore localStorage failures
  }
};

const buildPatientDocId = ({ idPaciente, nombre, fechaNacimiento, fallback }) => {
  const raw = idPaciente || `${nombre || ''}-${fechaNacimiento || ''}`;
  const key = normalizeMatchKey(raw) || normalizeMatchKey(fallback || '');
  return key ? `mig_${key}` : `mig_${Date.now()}`;
};

const getCellValueByLabel = (doc, label) => {
  const target = normalizeText(label).replace(/[:\s]+$/g, '');
  const cells = Array.from(doc.querySelectorAll('td'));

  for (const cell of cells) {
    const text = cleanText(cell.textContent || '').replace(/[:\s]+$/g, '');
    if (normalizeText(text) !== target) continue;

    const valueCell = cell.nextElementSibling;
    if (!valueCell) return '';
    return cleanText(valueCell.textContent || '');
  }

  return '';
};

const parsePatientSummaryFromHtml = (htmlText) => {
  if (!htmlText) return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    return {
      idPaciente: getCellValueByLabel(doc, 'ID del paciente'),
      nombre: getCellValueByLabel(doc, 'Nombre'),
      fechaNacimiento: getCellValueByLabel(doc, 'Fecha de nacimiento'),
      edad: getCellValueByLabel(doc, 'Edad'),
      sexo: getCellValueByLabel(doc, 'Sexo'),
      grupoSanguineo: getCellValueByLabel(doc, 'Grupo sanguineo') || getCellValueByLabel(doc, 'Grupo sanguíneo'),
      domicilio: getCellValueByLabel(doc, 'Domicilio')
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};

const parseHistoryFile = (modulePath) => {
  const fileName = modulePath.split('/').pop() || '';
  const cleanFileName = fileName.replace(/\.html$/i, '');
  const isPrenatal = cleanFileName.startsWith('control-prenatal-');
  const baseName = isPrenatal ? cleanFileName.replace(/^control-prenatal-/, '') : cleanFileName;
  const match = baseName.match(/_(\d+)$/);

  const folio = match ? Number(match[1]) : null;
  const patientName = match ? baseName.slice(0, baseName.lastIndexOf('_')).trim() : baseName.trim();

  return {
    modulePath,
    fileName,
    patientName,
    folio,
    type: isPrenatal ? 'control_prenatal' : 'historia_general'
  };
};

const statusLabel = (status) => {
  if (status === 'validado') return 'Validado';
  if (status === 'en_revision') return 'En revision';
  if (status === 'observado') return 'Observado';
  return 'Pendiente';
};

const priorityLabel = (priority) => {
  if (priority === 'alta') return 'Alta';
  if (priority === 'media') return 'Media';
  if (priority === 'baja') return 'Baja';
  return 'Sin prioridad';
};

const getSortValue = (row, key) => {
  if (key === 'folio') return Number(row.folio || 0);
  return normalizeText(row[key]);
};

const buildBadgeClass = (status) => {
  if (status === 'validado') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'en_revision') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'observado') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const AuditoriaMigracion = () => {
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [folioDesde, setFolioDesde] = useState('');
  const [folioHasta, setFolioHasta] = useState('');

  const [sortBy, setSortBy] = useState('patientName');
  const [sortDir, setSortDir] = useState('asc');

  const [page, setPage] = useState(1);
  const pageSize = 40;

  const [auditDocs, setAuditDocs] = useState({});
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedUrl, setSelectedUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingPatientMeta, setLoadingPatientMeta] = useState(false);
  const [patientMeta, setPatientMeta] = useState(null);

  const [statusDraft, setStatusDraft] = useState('pendiente');
  const [priorityDraft, setPriorityDraft] = useState('media');
  const [obsDraft, setObsDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [storedSyncInfo, setStoredSyncInfo] = useState({ processedCount: 0, startedAt: null, lastFile: '' });

  const allFiles = useMemo(() => {
    return Object.keys(htmlModules)
      .map((modulePath) => parseHistoryFile(modulePath))
      .sort((a, b) => (a.folio || 0) - (b.folio || 0));
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, AUDIT_COLLECTION), (snap) => {
      const next = {};
      snap.docs.forEach((d) => {
        const row = d.data() || {};
        if (row.modulePath) next[row.modulePath] = row;
      });
      setAuditDocs(next);
    });

    return () => unsub();
  }, []);

  const mergedRows = useMemo(() => {
    return allFiles.map((file) => {
      const audit = auditDocs[file.modulePath] || {};
      return {
        ...file,
        auditStatus: audit.status || 'pendiente',
        auditPriority: audit.priority || 'media',
        auditNotes: audit.notes || '',
        auditedByName: audit.auditedByName || '',
        auditedAtLabel: audit.auditedAtLabel || ''
      };
    });
  }, [allFiles, auditDocs]);

  const stats = useMemo(() => {
    const total = mergedRows.length;
    const validados = mergedRows.filter((r) => r.auditStatus === 'validado').length;
    const observados = mergedRows.filter((r) => r.auditStatus === 'observado').length;
    const revision = mergedRows.filter((r) => r.auditStatus === 'en_revision').length;
    const pendientes = total - validados - observados - revision;

    return { total, validados, observados, revision, pendientes };
  }, [mergedRows]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(searchTerm);

    let rows = [...mergedRows];

    if (filterType !== 'todos') rows = rows.filter((r) => r.type === filterType);
    if (filterStatus !== 'todos') rows = rows.filter((r) => r.auditStatus === filterStatus);

    if (folioDesde) rows = rows.filter((r) => Number(r.folio || 0) >= Number(folioDesde));
    if (folioHasta) rows = rows.filter((r) => Number(r.folio || 0) <= Number(folioHasta));

    if (term) {
      rows = rows.filter((r) => {
        const text = `${r.patientName} ${r.fileName} ${r.auditNotes}`;
        return normalizeText(text).includes(term);
      });
    }

    rows.sort((a, b) => {
      const va = getSortValue(a, sortBy);
      const vb = getSortValue(b, sortBy);

      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return a.fileName.localeCompare(b.fileName, 'es');
    });

    return rows;
  }, [mergedRows, filterType, filterStatus, folioDesde, folioHasta, searchTerm, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentRows = useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredRows.slice(from, from + pageSize);
  }, [filteredRows, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!selectedKey && filteredRows.length > 0) setSelectedKey(filteredRows[0].modulePath);
    if (selectedKey && !filteredRows.some((r) => r.modulePath === selectedKey)) {
      setSelectedKey(filteredRows[0]?.modulePath || '');
    }
  }, [filteredRows, selectedKey]);

  const selectedRow = useMemo(
    () => mergedRows.find((r) => r.modulePath === selectedKey) || null,
    [mergedRows, selectedKey]
  );

  const selectedMatchKey = useMemo(() => {
    if (!selectedRow) return '';
    return normalizeMatchKey(selectedRow.patientName);
  }, [selectedRow]);

  const relatedRows = useMemo(() => {
    if (!selectedRow || !selectedMatchKey) return [];

    return mergedRows
      .filter((row) => row.modulePath !== selectedRow.modulePath)
      .filter((row) => normalizeMatchKey(row.patientName) === selectedMatchKey)
      .sort((a, b) => Number(b.folio || 0) - Number(a.folio || 0))
      .slice(0, 5);
  }, [mergedRows, selectedMatchKey, selectedRow]);

  useEffect(() => {
    if (!selectedRow) {
      setSelectedUrl('');
      return;
    }

    setStatusDraft(selectedRow.auditStatus || 'pendiente');
    setPriorityDraft(selectedRow.auditPriority || 'media');
    setObsDraft(selectedRow.auditNotes || '');
  }, [selectedRow]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!selectedRow) {
        setSelectedUrl('');
        return;
      }

      setLoadingPreview(true);
      try {
        const importer = htmlModules[selectedRow.modulePath];
        if (!importer) {
          setSelectedUrl('');
          return;
        }
        const url = await importer();
        if (!cancelled) setSelectedUrl(url);
      } catch (error) {
        console.error(error);
        if (!cancelled) setSelectedUrl('');
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedRow]);

  useEffect(() => {
    let cancelled = false;

    const loadPatientMeta = async () => {
      if (!selectedUrl) {
        setPatientMeta(null);
        return;
      }

      setLoadingPatientMeta(true);
      try {
        const response = await fetch(selectedUrl);
        const htmlText = await response.text();
        const meta = parsePatientSummaryFromHtml(htmlText);
        if (!cancelled) setPatientMeta(meta);
      } catch (error) {
        console.error(error);
        if (!cancelled) setPatientMeta(null);
      } finally {
        if (!cancelled) setLoadingPatientMeta(false);
      }
    };

    loadPatientMeta();

    return () => {
      cancelled = true;
    };
  }, [selectedUrl]);

  useEffect(() => {
    const stored = getStoredSyncState();
    const processedCount = Object.keys(stored.processedPaths || {}).length;
    setStoredSyncInfo({
      processedCount,
      startedAt: stored.startedAt || null,
      lastFile: stored.lastFile || ''
    });
  }, []);

  const upsertPacienteDesdeMeta = async ({ meta, fallbackName, fallbackFileName, modulePath }) => {
    const nombrePaciente = cleanText(meta?.nombre || fallbackName || '');
    const idPacienteRaw = cleanText(meta?.idPaciente || '');
    const fechaNacimientoRaw = cleanText(meta?.fechaNacimiento || '');
    const sexoRaw = cleanText(meta?.sexo || '');
    const domicilioRaw = cleanText(meta?.domicilio || '');

    if (!nombrePaciente) return { status: 'skipped' };

    const pacientesRef = collection(db, 'pacientes');
    let targetPacienteDocId = '';

    if (idPacienteRaw) {
      const byIdSnap = await getDocs(query(pacientesRef, where('idPaciente', '==', idPacienteRaw), limit(1)));
      if (!byIdSnap.empty) targetPacienteDocId = byIdSnap.docs[0].id;

      if (!targetPacienteDocId) {
        const byMigratedIdSnap = await getDocs(query(pacientesRef, where('idPacienteMigrado', '==', idPacienteRaw), limit(1)));
        if (!byMigratedIdSnap.empty) targetPacienteDocId = byMigratedIdSnap.docs[0].id;
      }
    }

    if (!targetPacienteDocId) {
      const byNameSnap = await getDocs(query(pacientesRef, where('nombreCompleto', '==', nombrePaciente), limit(5)));
      const matchedByBirthDate = byNameSnap.docs.find((d) => {
        const row = d.data() || {};
        return fechaNacimientoRaw && cleanText(row.fechaNacimiento || '') === fechaNacimientoRaw;
      });

      targetPacienteDocId = matchedByBirthDate?.id || byNameSnap.docs[0]?.id || '';
    }

    if (!targetPacienteDocId) {
      targetPacienteDocId = buildPatientDocId({
        idPaciente: idPacienteRaw,
        nombre: nombrePaciente,
        fechaNacimiento: fechaNacimientoRaw,
        fallback: fallbackFileName
      });
    }

    await setDoc(
      doc(db, 'pacientes', targetPacienteDocId),
      {
        nombre: nombrePaciente,
        nombreCompleto: nombrePaciente,
        idPaciente: idPacienteRaw || null,
        idPacienteMigrado: idPacienteRaw || null,
        fechaNacimiento: fechaNacimientoRaw || null,
        sexo: sexoRaw || null,
        domicilio: domicilioRaw || null,
        origenRegistro: 'migracion_historialmedico',
        actualizadoPorMigracion: true,
        actualizadoPor: user.uid,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await upsertPatientLegacyLink({
      pacienteId: targetPacienteDocId,
      modulePath,
      fileName: fallbackFileName,
      patientName: nombrePaciente,
      legacyPatientId: idPacienteRaw || null,
      fechaNacimiento: fechaNacimientoRaw || null,
      sexo: sexoRaw || null,
      linkedBy: user.uid,
      source: 'migracion_historialmedico',
      confidence: 'alta'
    });

    return { status: 'synced', pacienteId: targetPacienteDocId };
  };

  const handleSyncAllPacientes = async () => {
    if (!user?.uid || syncingAll) return;

    setSyncingAll(true);
    setSyncMsg('');
    setSyncProgress('Preparando sincronizacion...');

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    let resumed = 0;

    try {
      const stored = getStoredSyncState();
      const processedPaths = { ...(stored.processedPaths || {}) };

      if (!stored.startedAt) {
        setStoredSyncState({
          processedPaths,
          startedAt: new Date().toISOString(),
          lastFile: ''
        });
      }

      for (let idx = 0; idx < allFiles.length; idx += 1) {
        const file = allFiles[idx];

        if (processedPaths[file.modulePath]) {
          resumed += 1;
          continue;
        }

        setSyncProgress(`Procesando ${idx + 1}/${allFiles.length}: ${file.fileName}`);

        try {
          const importer = htmlModules[file.modulePath];
          if (!importer) {
            skipped += 1;
            continue;
          }

          const url = await importer();
          const response = await fetch(url);
          const htmlText = await response.text();
          const meta = parsePatientSummaryFromHtml(htmlText);

          const res = await upsertPacienteDesdeMeta({
            meta,
            fallbackName: file.patientName,
            fallbackFileName: file.fileName,
            modulePath: file.modulePath
          });

          if (res.status === 'synced') {
            synced += 1;
            processedPaths[file.modulePath] = true;
          } else {
            skipped += 1;
            processedPaths[file.modulePath] = true;
          }

          setStoredSyncState({
            processedPaths,
            startedAt: stored.startedAt || new Date().toISOString(),
            lastFile: file.fileName
          });
        } catch (error) {
          console.error(error);
          failed += 1;
        }
      }

      clearStoredSyncState();
      setStoredSyncInfo({ processedCount: 0, startedAt: null, lastFile: '' });
      setSyncMsg(`Sincronizacion completada. Reanudados: ${resumed}, actualizados: ${synced}, omitidos: ${skipped}, errores: ${failed}.`);
    } catch (error) {
      console.error(error);
      setSyncMsg('No fue posible completar la sincronizacion masiva.');
    } finally {
      setSyncingAll(false);
      setSyncProgress('');

      const refreshed = getStoredSyncState();
      const processedCount = Object.keys(refreshed.processedPaths || {}).length;
      setStoredSyncInfo({
        processedCount,
        startedAt: refreshed.startedAt || null,
        lastFile: refreshed.lastFile || ''
      });
    }
  };

  const handleResetSyncState = () => {
    clearStoredSyncState();
    setStoredSyncInfo({ processedCount: 0, startedAt: null, lastFile: '' });
    setSyncMsg('Checkpoint de sincronizacion reiniciado.');
  };

  const handleStartSyncFromZero = async () => {
    if (syncingAll) return;

    const confirmed = window.confirm(
      'Esto reiniciara el checkpoint y ejecutara nuevamente la sincronizacion completa desde cero. ¿Deseas continuar?'
    );

    if (!confirmed) return;

    clearStoredSyncState();
    setStoredSyncInfo({ processedCount: 0, startedAt: null, lastFile: '' });
    setSyncMsg('Sincronizacion reiniciada desde cero.');
    await handleSyncAllPacientes();
  };

  const handleSaveAudit = async () => {
    if (!selectedRow || !user?.uid) return;

    setSaving(true);
    setSaveMsg('');

    try {
      const nowLabel = new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await setDoc(
        doc(db, AUDIT_COLLECTION, selectedRow.fileName),
        {
          modulePath: selectedRow.modulePath,
          fileName: selectedRow.fileName,
          patientName: selectedRow.patientName,
          folio: selectedRow.folio || null,
          expedienteType: selectedRow.type,
          patientId: patientMeta?.idPaciente || null,
          fechaNacimiento: patientMeta?.fechaNacimiento || null,
          sexo: patientMeta?.sexo || null,
          status: statusDraft,
          priority: priorityDraft,
          notes: obsDraft.trim(),
          auditedBy: user.uid,
          auditedByName: user.nombre || user.email || 'Administrador',
          auditedAtLabel: nowLabel,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      await upsertPacienteDesdeMeta({
        meta: patientMeta,
        fallbackName: selectedRow.patientName,
        fallbackFileName: selectedRow.fileName,
        modulePath: selectedRow.modulePath
      });

      setSaveMsg('Auditoria guardada y paciente sincronizado para Agenda.');
    } catch (error) {
      console.error(error);
      setSaveMsg('No fue posible guardar la auditoria. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir('asc');
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto pb-16 space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
          Auditoria de migracion de expedientes
        </h1>
        <p className="text-sm text-slate-500">
          Vista administrativa para revisar, filtrar y validar historiales clinicos migrados desde MedicalManik.
        </p>
        <div className="pt-1 flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncAllPacientes}
            disabled={syncingAll}
            className="px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-60"
          >
            {syncingAll ? 'Sincronizando pacientes...' : 'Sincronizar todos a Directorio/Agenda'}
          </button>
          <button
            onClick={handleStartSyncFromZero}
            disabled={syncingAll}
            className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100 disabled:opacity-60"
          >
            Comenzar desde cero
          </button>
          {storedSyncInfo.processedCount > 0 && (
            <button
              onClick={handleResetSyncState}
              disabled={syncingAll}
              className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 disabled:opacity-60"
            >
              Reiniciar checkpoint
            </button>
          )}
          {syncProgress && <span className="text-xs text-slate-500">{syncProgress}</span>}
          {syncMsg && <span className="text-xs text-slate-600">{syncMsg}</span>}
          {storedSyncInfo.processedCount > 0 && !syncingAll && (
            <span className="text-xs text-slate-500">
              Avance guardado: {storedSyncInfo.processedCount} archivo(s){storedSyncInfo.lastFile ? `, ultimo: ${storedSyncInfo.lastFile}` : ''}.
            </span>
          )}
        </div>
      </header>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ClipboardCheck size={16} />
          Flujo de auditoria
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">1. Tipo de expediente</p>
            <div className="mt-2 space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={filterType === 'todos'} onChange={() => setFilterType('todos')} />
                Todos
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={filterType === 'historia_general'} onChange={() => setFilterType('historia_general')} />
                Historia general
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={filterType === 'control_prenatal'} onChange={() => setFilterType('control_prenatal')} />
                Control prenatal
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">2. Rango de folio</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Desde"
                value={folioDesde}
                onChange={(e) => setFolioDesde(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
              <input
                type="number"
                placeholder="Hasta"
                value={folioHasta}
                onChange={(e) => setFolioHasta(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">3. Estado de auditoria</p>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_revision">En revision</option>
              <option value="validado">Validado</option>
              <option value="observado">Observado</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por paciente, archivo u observaciones"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <button
            onClick={() => {
              setFilterType('todos');
              setFilterStatus('todos');
              setFolioDesde('');
              setFolioHasta('');
              setSearchTerm('');
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>

          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold">
            <Filter size={12} />
            {filteredRows.length} resultados
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Pendientes</p>
          <p className="text-xl font-bold text-slate-700">{stats.pendientes}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">En revision</p>
          <p className="text-xl font-bold text-amber-700">{stats.revision}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Validados</p>
          <p className="text-xl font-bold text-emerald-700">{stats.validados}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Observados</p>
          <p className="text-xl font-bold text-rose-700">{stats.observados}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-auto max-h-[720px]">
            <table className="w-full text-left min-w-[760px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {[
                    { key: 'folio', label: 'Folio' },
                    { key: 'patientName', label: 'Paciente' },
                    { key: 'type', label: 'Tipo' },
                    { key: 'auditStatus', label: 'Estado' },
                    { key: 'auditPriority', label: 'Prioridad' }
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 cursor-pointer"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}{sortBy === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row) => (
                  <tr
                    key={row.modulePath}
                    onClick={() => setSelectedKey(row.modulePath)}
                    className={`border-b border-slate-50 hover:bg-slate-50/70 cursor-pointer ${selectedKey === row.modulePath ? 'bg-blue-50/60' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-sm text-slate-700 font-semibold">{row.folio || '--'}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">{row.patientName}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">
                      {row.type === 'control_prenatal' ? 'Control prenatal' : 'Historia general'}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-bold ${buildBadgeClass(row.auditStatus)}`}>
                        {statusLabel(row.auditStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{priorityLabel(row.auditPriority)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Pagina {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button
                className="px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Anterior
              </button>
              <button
                className="px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 disabled:opacity-50"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            {!selectedRow && (
              <div className="text-sm text-slate-500">Selecciona un expediente para auditar.</div>
            )}

            {selectedRow && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">Expediente seleccionado</p>
                    <h2 className="text-lg font-bold text-slate-900">{selectedRow.patientName}</h2>
                    <p className="text-xs text-slate-500">Archivo: {selectedRow.fileName}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 rounded-full border text-xs font-bold ${buildBadgeClass(selectedRow.auditStatus)}`}>
                    {statusLabel(selectedRow.auditStatus)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-slate-200 p-2">
                    <p className="text-xs text-slate-400">Tipo</p>
                    <p className="font-semibold text-slate-700">{selectedRow.type === 'control_prenatal' ? 'Control prenatal' : 'Historia general'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2">
                    <p className="text-xs text-slate-400">Folio</p>
                    <p className="font-semibold text-slate-700">{selectedRow.folio || '--'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-blue-700 font-bold">Datos del paciente</p>

                  {loadingPatientMeta && <p className="mt-1 text-xs text-slate-500">Cargando datos del encabezado...</p>}

                  {!loadingPatientMeta && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-blue-100 bg-white p-2">
                        <p className="text-xs text-slate-400">ID Paciente</p>
                        <p className="font-semibold text-slate-700">{patientMeta?.idPaciente || '--'}</p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2">
                        <p className="text-xs text-slate-400">Nombre</p>
                        <p className="font-semibold text-slate-700">{patientMeta?.nombre || selectedRow.patientName || '--'}</p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2">
                        <p className="text-xs text-slate-400">Fecha de nacimiento</p>
                        <p className="font-semibold text-slate-700">{patientMeta?.fechaNacimiento || '--'}</p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2">
                        <p className="text-xs text-slate-400">Edad</p>
                        <p className="font-semibold text-slate-700">{patientMeta?.edad || '--'}</p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2">
                        <p className="text-xs text-slate-400">Sexo</p>
                        <p className="font-semibold text-slate-700">{patientMeta?.sexo || '--'}</p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2">
                        <p className="text-xs text-slate-400">Grupo sanguineo</p>
                        <p className="font-semibold text-slate-700">{patientMeta?.grupoSanguineo || '--'}</p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-white p-2 md:col-span-2">
                        <p className="text-xs text-slate-400">Domicilio</p>
                        <p className="font-semibold text-slate-700">{patientMeta?.domicilio || '--'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700 font-bold">Congruencia de paciente</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {relatedRows.length > 0
                      ? `Se encontraron ${relatedRows.length} expediente(s) posiblemente del mismo paciente en la carpeta.`
                      : 'No se detectaron otros expedientes con el mismo nombre normalizado.'}
                  </p>
                  {relatedRows.length > 0 && (
                    <ul className="mt-2 text-xs text-slate-700 space-y-1">
                      {relatedRows.map((row) => (
                        <li key={row.modulePath}>
                          Folio {row.folio || '--'} | {row.fileName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Estado
                    <select
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_revision">En revision</option>
                      <option value="validado">Validado</option>
                      <option value="observado">Observado</option>
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-600">
                    Prioridad
                    <select
                      value={priorityDraft}
                      onChange={(e) => setPriorityDraft(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </label>
                </div>

                <label className="text-xs font-semibold text-slate-600 block">
                  Observaciones
                  <textarea
                    rows={4}
                    value={obsDraft}
                    onChange={(e) => setObsDraft(e.target.value)}
                    placeholder="Notas de auditoria, datos incompletos, inconsistencias, etc."
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSaveAudit}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? 'Guardando...' : 'Guardar auditoria'}
                  </button>

                  {selectedUrl && (
                    <a
                      href={selectedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 font-semibold hover:bg-slate-50"
                    >
                      <ExternalLink size={14} />
                      Abrir completo
                    </a>
                  )}

                  {saveMsg && <span className="text-xs text-slate-600">{saveMsg}</span>}
                </div>

                <div className="text-xs text-slate-500">
                  Ultima auditoria: {selectedRow.auditedAtLabel || 'Sin registro'}
                  {selectedRow.auditedByName ? ` por ${selectedRow.auditedByName}` : ''}
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Eye size={15} />
              Vista previa del expediente
            </div>

            {loadingPreview && (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <AlertCircle size={14} />
                Cargando vista previa...
              </div>
            )}

            {!loadingPreview && !selectedUrl && (
              <div className="text-sm text-slate-500">Selecciona un expediente para previsualizar su contenido.</div>
            )}

            {!loadingPreview && selectedUrl && (
              <iframe
                title="Vista previa expediente"
                src={selectedUrl}
                className="w-full h-[520px] border border-slate-200 rounded-lg"
              />
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
          <p className="font-semibold inline-flex items-center gap-1"><ShieldCheck size={14} /> Buenas practicas de auditoria</p>
          <p className="text-slate-500 mt-1">Marca como validado solo cuando el HTML tenga datos clinicos consistentes y legibles.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
          <p className="font-semibold inline-flex items-center gap-1"><CheckCircle2 size={14} /> Trazabilidad</p>
          <p className="text-slate-500 mt-1">Cada cambio guarda usuario, fecha de auditoria, prioridad y observaciones en Firestore.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
          <p className="font-semibold inline-flex items-center gap-1"><AlertCircle size={14} /> Riesgos</p>
          <p className="text-slate-500 mt-1">Usa estado observado cuando falte informacion critica o detectes registros duplicados/inconsistentes.</p>
        </div>
      </section>
    </div>
  );
};

export default AuditoriaMigracion;