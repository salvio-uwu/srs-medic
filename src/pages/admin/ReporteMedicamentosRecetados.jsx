// src/pages/admin/ReporteMedicamentosRecetados.jsx
// Medicamentos recetados — export Excel

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, Timestamp, limit, startAfter,
} from 'firebase/firestore';
import {
  CheckCircle2, ChevronLeft, Download, FileSpreadsheet,
  Loader2, Pill, AlertTriangle, Eye, X, Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../config/firebase';

const HISTORIAL_PAGE = 150;

const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const parseFechaDoc = (v) => {
  if (!v) return null;
  if (v?.toDate) {
    const d = v.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatFechaDia = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatFechaHora = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

const COLS_VECES = [
  { key: 'sucursal', label: 'Sucursal' },
  { key: 'fechaReceta', label: 'Fecha de receta' },
  { key: 'especialidad', label: 'Especialidad del médico' },
  { key: 'medicamento', label: 'Nombre de medicamento' },
  { key: 'sustancias', label: 'Sustancias activas del medicamento' },
  { key: 'patenteGenerico', label: 'Patente o Genérico' },
  { key: 'veces', label: 'Número de veces recetados' },
];

const COLS_MEDICO = [
  { key: 'sucursal', label: 'Sucursal' },
  { key: 'fechaReceta', label: 'Fecha de receta' },
  { key: 'nombreMedico', label: 'Nombre del médico' },
  { key: 'especialidad', label: 'Especialidad del médico' },
  { key: 'medicamento', label: 'Nombre de medicamento' },
  { key: 'sustancias', label: 'Sustancias activas del medicamento' },
  { key: 'patenteGenerico', label: 'Patente o Genérico' },
  { key: 'veces', label: 'Número de veces recetados' },
];

const COLS_FOLIO = [
  { key: 'fechaReceta', label: 'Fecha de receta' },
  { key: 'folio', label: 'Folio de receta' },
  { key: 'sucursal', label: 'Sucursal' },
  { key: 'especialidad', label: 'Especialidad del médico' },
  { key: 'medicamento', label: 'Nombre de medicamento' },
  { key: 'sustancias', label: 'Sustancias activas del medicamento' },
  { key: 'grupo', label: 'Grupo' },
  { key: 'tratamiento', label: 'Tratamiento' },
];

const downloadXLSX = (rows, cols, filename, sheetName) => {
  const aoa = [
    cols.map((c) => c.label),
    ...rows.map((r) => cols.map((c) => (r[c.key] == null ? '' : String(r[c.key])))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c) => {
    if (c.key === 'medicamento' || c.key === 'sustancias' || c.key === 'tratamiento') return { wch: 40 };
    if (c.key === 'sucursal' || c.key === 'especialidad' || c.key === 'nombreMedico') return { wch: 24 };
    if (c.key === 'veces') return { wch: 12 };
    return { wch: 16 };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
};

const STYLES = `
  .rm { font-family: 'DM Sans', system-ui, sans-serif; }
  .rm-steps { display: flex; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .rm-step { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
  .rm-step:last-child { border-bottom: 0; }
  .rm-step.dim { opacity: .45; pointer-events: none; }
  .rm-step-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .rm-badge { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .rm-badge.done, .rm-badge.active { background: #0077B6; color: #fff; }
  .rm-badge.todo { background: #e2e8f0; color: #64748b; }
  .rm-step-title { font-size: .82rem; font-weight: 650; color: #0f172a; margin: 0; }
  .rm-step-sub { font-size: .68rem; color: #64748b; margin: 2px 0 0; }
  .rm-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; max-width: 520px; }
  .rm-label { display: flex; flex-direction: column; gap: 4px; font-size: .68rem; font-weight: 600; color: #64748b; }
  .rm-input, .rm-select { height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: .8rem; color: #0f172a; background: #f8fafc; font-family: inherit; outline: none; }
  .rm-input:focus, .rm-select:focus { border-color: #0077B6; background: #fff; box-shadow: 0 0 0 3px rgba(0,119,182,.12); }
  .rm-radios { display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
  .rm-radio { display: flex; align-items: flex-start; gap: 8px; font-size: .78rem; color: #334155; cursor: pointer; }
  .rm-radio input { accent-color: #0077B6; margin-top: 3px; }
  .rm-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .rm-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0; font-size: .74rem; font-weight: 650; cursor: pointer; font-family: inherit; }
  .rm-btn-primary { background: #0077B6; color: #fff; }
  .rm-btn-primary:hover { background: #023e8a; }
  .rm-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
  .rm-btn-ghost { background: transparent; color: #64748b; }
  .rm-btn-ghost:hover { color: #0f172a; background: #f1f5f9; }
  .rm-btn-ok { background: #0f766e; color: #fff; }
  .rm-btn-ok:hover { background: #0d9488; }
  .rm-btn-ok:disabled { opacity: .55; cursor: not-allowed; }
  .rm-error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: .72rem; margin-top: 12px; }
  .rm-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .rm-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .rm-kpi b { display: block; font-size: 1.05rem; color: #0f172a; font-family: 'Sora', sans-serif; }
  .rm-kpi span { font-size: .65rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
  .rm-success-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; }
  .rm-success-bar strong { font-size: .82rem; color: #14532d; }
  .rm-success-bar p { margin: 2px 0 0; font-size: .7rem; color: #166534; }
  .rm-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .rm-modal { width: min(960px, 100%); max-height: min(88vh, 900px); background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(15,23,42,.25); display: flex; flex-direction: column; overflow: hidden; }
  .rm-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
  .rm-modal-hd h2 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1rem; color: #0f172a; }
  .rm-modal-hd p { margin: 3px 0 0; font-size: .7rem; color: #64748b; }
  .rm-modal-x { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #f1f5f9; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .rm-modal-body { padding: 16px 18px; overflow: auto; flex: 1; }
  .rm-modal-ft { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
  .rm-section-label { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin: 0 0 8px; }
  .rm-note { display: flex; gap: 8px; align-items: flex-start; padding: 9px 11px; border-radius: 8px; font-size: .72rem; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; margin-bottom: 6px; }
  .rm-table-wrap { overflow: auto; max-height: 340px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .rm-table { width: 100%; border-collapse: collapse; font-size: .68rem; }
  .rm-table th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: 7px 8px; color: #475569; font-weight: 700; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
  .rm-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; max-width: 200px; }
  .rm-muted { color: #94a3b8; }
  .rm-spin { animation: rmSpin .8s linear infinite; }
  @keyframes rmSpin { to { transform: rotate(360deg); } }
`;

const MODOS = [
  { id: 'veces', label: 'General por veces recetado' },
  { id: 'medico', label: 'Por médico' },
  { id: 'folio', label: 'General por folio de receta' },
  { id: 'consultorio', label: 'Por consultorio' },
];

const ReporteMedicamentosRecetados = () => {
  const hoy = useMemo(() => new Date(), []);
  const primerDiaMes = useMemo(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1), [hoy]);

  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [modo, setModo] = useState('veces');
  const [consultorioId, setConsultorioId] = useState('all');
  const [consultorios, setConsultorios] = useState([]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [advertencias, setAdvertencias] = useState([]);
  const [filas, setFilas] = useState([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [genMeta, setGenMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'catalogo_consultorios'), orderBy('nombre', 'asc')))
          .catch(() => getDocs(collection(db, 'catalogo_consultorios')));
        if (cancelled) return;
        setConsultorios(
          snap.docs
            .map((d) => ({ id: d.id, nombre: d.data().nombre || d.id }))
            .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')),
        );
      } catch (err) {
        console.warn('[ReporteMeds]', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const exportCols = modo === 'folio' ? COLS_FOLIO : modo === 'medico' ? COLS_MEDICO : COLS_VECES;

  const modoLabel = useMemo(() => {
    const base = MODOS.find((m) => m.id === modo)?.label || modo;
    if (modo === 'consultorio' && consultorioId !== 'all') {
      const nom = consultorios.find((c) => c.id === consultorioId)?.nombre;
      return `${base}${nom ? `: ${nom}` : ''}`;
    }
    return base;
  }, [modo, consultorioId, consultorios]);

  const generar = useCallback(async () => {
    setLoading(true);
    setError('');
    setAdvertencias([]);
    setFilas([]);
    setGenMeta(null);
    setShowResultModal(false);
    setProgress('Preparando…');
    const t0 = performance.now();

    try {
      const inicio = new Date(`${fechaInicio}T00:00:00`);
      const fin = new Date(`${fechaFin}T23:59:59`);
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || inicio > fin) {
        setError('Rango de fechas inválido.');
        return;
      }

      const tsInicio = Timestamp.fromDate(inicio);
      const tsFin = Timestamp.fromDate(fin);
      const warns = [];
      const selConsultorio = modo === 'consultorio' && consultorioId !== 'all'
        ? consultorios.find((c) => c.id === consultorioId)
        : null;

      const buildPageQuery = (cursor) => {
        const parts = [
          where('fecha', '>=', tsInicio),
          where('fecha', '<=', tsFin),
          orderBy('fecha', 'asc'),
        ];
        if (cursor) parts.push(startAfter(cursor));
        parts.push(limit(HISTORIAL_PAGE));
        return query(collection(db, 'historial_clinico'), ...parts);
      };

      const agg = new Map(); // veces
      const detalle = []; // folio
      let totalHist = 0;
      let conMeds = 0;
      let cursor = null;
      let page = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        page += 1;
        setProgress(`Historial… lote ${page}`);
        const snap = await getDocs(buildPageQuery(cursor));
        if (snap.empty) break;

        for (const d of snap.docs) {
          totalHist += 1;
          const data = d.data() || {};
          const lista = data.consulta?.diagnostico?.tratamiento_lista;
          if (!Array.isArray(lista) || lista.length === 0) continue;

          const fechaConsulta = parseFechaDoc(data.fecha) || new Date();
          const sucursal = String(
            data.consultorioNombre
            || data.medicoPerfil?.sucursal
            || data.sucursalNombre
            || '',
          ).trim();
          const consultorioIdDoc = data.consultorioId || null;

          if (selConsultorio) {
            const nomSel = String(selConsultorio.nombre || '').toLowerCase();
            const matchId = consultorioIdDoc === selConsultorio.id;
            const matchNom = sucursal.toLowerCase() === nomSel;
            if (!matchId && !matchNom) continue;
          }

          const especialidad = String(
            data.medicoPerfil?.especialidad
            || data.especialidadMedico
            || '',
          ).trim().toUpperCase() || 'SIN ESPECIALIDAD';

          const nombreMedico = String(
            data.medicoNombre
            || data.medicoPerfil?.nombre
            || '',
          ).trim();

          const folio = String(
            data.px_info?.folio_receta
            || data.px_info?.id_receta
            || data.folioReceta
            || d.id,
          ).trim();

          for (const m of lista) {
            const medicamento = String(m?.nombre || '').trim();
            if (!medicamento) continue;
            conMeds += 1;

            const sustancias = String(m?.sustanciasActivas || '').trim();
            const grupo = String(m?.grupo || m?.marca || '').trim();
            const tratamiento = [m?.presentacion, m?.dosis].filter(Boolean).map(String).join(' — ').trim();
            const patenteGenerico = String(m?.patenteGenerico || m?.tipo || '').trim();

            if (modo === 'folio') {
              detalle.push({
                fechaReceta: formatFechaHora(fechaConsulta),
                folio,
                sucursal,
                especialidad,
                medicamento,
                sustancias,
                grupo,
                tratamiento,
                _sort: fechaConsulta.getTime(),
              });
            } else {
              const fechaDia = formatFechaDia(fechaConsulta);
              const porMedico = modo === 'medico';
              const keyParts = porMedico
                ? [sucursal, fechaDia, nombreMedico, especialidad, medicamento, sustancias, patenteGenerico]
                : [sucursal, fechaDia, especialidad, medicamento, sustancias, patenteGenerico];
              const key = keyParts.join('|');
              const prev = agg.get(key);
              if (prev) prev.veces += 1;
              else {
                const row = {
                  sucursal,
                  fechaReceta: fechaDia,
                  especialidad,
                  medicamento,
                  sustancias,
                  patenteGenerico,
                  veces: 1,
                  _sort: fechaConsulta.getTime(),
                };
                if (porMedico) row.nombreMedico = nombreMedico;
                agg.set(key, row);
              }
            }
          }
        }

        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < HISTORIAL_PAGE) break;
      }

      let rows;
      if (modo === 'folio') {
        rows = detalle.sort((a, b) => a._sort - b._sort);
      } else {
        const porMedico = modo === 'medico';
        rows = [...agg.values()].sort((a, b) => {
          if (a.fechaReceta !== b.fechaReceta) return a.fechaReceta.localeCompare(b.fechaReceta);
          if (a.sucursal !== b.sucursal) return a.sucursal.localeCompare(b.sucursal, 'es');
          if (porMedico && a.nombreMedico !== b.nombreMedico) {
            return String(a.nombreMedico || '').localeCompare(String(b.nombreMedico || ''), 'es');
          }
          return a.medicamento.localeCompare(b.medicamento, 'es');
        });
      }

      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (conMeds === 0) {
        warns.push('No se encontraron medicamentos recetados en el periodo.');
      }

      setFilas(rows);
      setAdvertencias(warns);
      setGenMeta({ secs, totalHist, conMeds });
      setStep(3);
      setShowResultModal(true);
      setProgress('');
    } catch (err) {
      console.error('[ReporteMeds]', err);
      setError(`Error al generar el reporte: ${err.message || err}`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, modo, consultorioId, consultorios]);

  const exportar = () => {
    if (!filas.length) return;
    const tag = modo === 'folio' ? 'folio'
      : modo === 'consultorio' ? 'consultorio'
      : modo === 'medico' ? 'medico'
      : 'veces';
    downloadXLSX(
      filas,
      exportCols,
      `Medicamentos_recetados_${tag}_${fechaInicio}-${fechaFin}.xlsx`,
      'Medicamentos',
    );
  };

  const preview = filas.slice(0, 50);
  const totalVeces = useMemo(
    () => (modo === 'folio' ? filas.length : filas.reduce((s, r) => s + (Number(r.veces) || 0), 0)),
    [filas, modo],
  );

  return (
    <div className="rm">
      <style>{STYLES}</style>

      <div className="rm-steps">
        {/* 1 fechas */}
        <div className={`rm-step ${step < 1 ? 'dim' : ''}`}>
          <div className="rm-step-hd">
            <div className={`rm-badge ${step > 1 ? 'done' : 'active'}`}>{step > 1 ? <CheckCircle2 size={14} /> : '1'}</div>
            <div>
              <p className="rm-step-title">Elige un rango de fechas</p>
              <p className="rm-step-sub">Recetas guardadas en expediente</p>
            </div>
          </div>
          {step === 1 && (
            <>
              <div className="rm-fields">
                <label className="rm-label">Desde
                  <input type="date" className="rm-input" value={fechaInicio} onChange={(e) => e.target.value && setFechaInicio(e.target.value)} />
                </label>
                <label className="rm-label">Hasta
                  <input type="date" className="rm-input" value={fechaFin} max={toDateInput(hoy)} onChange={(e) => e.target.value && setFechaFin(e.target.value)} />
                </label>
              </div>
              <div className="rm-actions">
                <button type="button" className="rm-btn rm-btn-primary" onClick={() => setStep(2)}>Continuar</button>
              </div>
            </>
          )}
          {step > 1 && <p className="rm-step-sub">{fechaInicio} → {fechaFin}</p>}
        </div>

        {/* 2 modo */}
        <div className={`rm-step ${step < 2 ? 'dim' : ''}`}>
          <div className="rm-step-hd">
            <div className={`rm-badge ${step > 2 ? 'done' : step === 2 ? 'active' : 'todo'}`}>{step > 2 ? <CheckCircle2 size={14} /> : '2'}</div>
            <div>
              <p className="rm-step-title">¿Cómo quieres consultar la información?</p>
              <p className="rm-step-sub">Veces · Folio · Consultorio</p>
            </div>
          </div>
          {step === 2 && (
            <>
              <div className="rm-radios">
                {MODOS.map((m) => (
                  <label key={m.id} className="rm-radio">
                    <input type="radio" name="modoMeds" checked={modo === m.id} onChange={() => setModo(m.id)} />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
              {modo === 'consultorio' && (
                <label className="rm-label" style={{ maxWidth: 360, marginTop: 10 }}>
                  Consultorio
                  <select className="rm-select" value={consultorioId} onChange={(e) => setConsultorioId(e.target.value)}>
                    <option value="all">Todos</option>
                    {consultorios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
              )}
              <div className="rm-actions">
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setStep(1)}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="rm-btn rm-btn-primary" onClick={() => setStep(3)}>
                  Continuar {modo === 'consultorio' ? <Building2 size={14} /> : <Pill size={14} />}
                </button>
              </div>
            </>
          )}
          {step > 2 && <p className="rm-step-sub">{modoLabel}</p>}
        </div>

        {/* 3 generar */}
        <div className={`rm-step ${step < 3 ? 'dim' : ''}`}>
          <div className="rm-step-hd">
            <div className={`rm-badge ${genMeta ? 'done' : step === 3 ? 'active' : 'todo'}`}>
              {genMeta ? <CheckCircle2 size={14} /> : '3'}
            </div>
            <div>
              <p className="rm-step-title">Generar y exportar</p>
              <p className="rm-step-sub">Vista previa y descarga Excel</p>
            </div>
          </div>
          {step === 3 && !genMeta && (
            <>
              <div className="rm-fields">
                <div className="rm-kpi"><span>Periodo</span><b style={{ fontSize: '.85rem' }}>{fechaInicio} → {fechaFin}</b></div>
                <div className="rm-kpi"><span>Modo</span><b style={{ fontSize: '.85rem' }}>{modoLabel}</b></div>
              </div>
              <div className="rm-actions">
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setStep(2)} disabled={loading}><ChevronLeft size={14} /> Regresar</button>
                <button type="button" className="rm-btn rm-btn-primary" onClick={generar} disabled={loading}>
                  {loading ? <><Loader2 size={14} className="rm-spin" /> Generando…</> : <><Pill size={14} /> Generar reporte</>}
                </button>
              </div>
              {loading && progress && <p className="rm-step-sub" style={{ marginTop: 10 }}>{progress}</p>}
              {error && <div className="rm-error"><AlertTriangle size={14} /> {error}</div>}
            </>
          )}
          {step === 3 && genMeta && (
            <div className="rm-success-bar">
              <div>
                <strong>{filas.length.toLocaleString('es-MX')} filas</strong>
                <p>{fechaInicio} → {fechaFin} · {genMeta.secs}s · {totalVeces.toLocaleString('es-MX')} recetas</p>
              </div>
              <div className="rm-actions" style={{ marginTop: 0 }}>
                <button type="button" className="rm-btn rm-btn-ghost" onClick={() => { setFilas([]); setAdvertencias([]); setGenMeta(null); setShowResultModal(false); }}>
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="rm-btn rm-btn-primary" onClick={() => setShowResultModal(true)}>
                  <Eye size={14} /> Ver resultados
                </button>
                <button type="button" className="rm-btn rm-btn-ok" onClick={exportar} disabled={!filas.length}>
                  <Download size={14} /> Exportar Excel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="rm-step-sub" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <FileSpreadsheet size={13} /> Exportación en Excel (.xlsx)
      </p>

      {showResultModal && (
        <div className="rm-modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowResultModal(false); }}>
          <div className="rm-modal" role="dialog" aria-modal="true">
            <div className="rm-modal-hd">
              <div>
                <h2>Medicamentos recetados</h2>
                <p>{fechaInicio} → {fechaFin} · {modoLabel}{genMeta ? ` · ${genMeta.secs}s` : ''}</p>
              </div>
              <button type="button" className="rm-modal-x" onClick={() => setShowResultModal(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className="rm-modal-body">
              <p className="rm-section-label">Resumen</p>
              <div className="rm-kpis" style={{ marginBottom: 14 }}>
                <div className="rm-kpi"><span>Filas</span><b>{filas.length.toLocaleString('es-MX')}</b></div>
                <div className="rm-kpi"><span>{modo === 'folio' ? 'Líneas' : 'Veces recetado'}</span><b>{totalVeces.toLocaleString('es-MX')}</b></div>
              </div>
              {advertencias.map((w) => (
                <div key={w} className="rm-note"><AlertTriangle size={14} /><span>{w}</span></div>
              ))}
              <p className="rm-section-label">Vista previa</p>
              {filas.length === 0 ? (
                <p className="rm-muted">Sin resultados.</p>
              ) : (
                <div className="rm-table-wrap">
                  <table className="rm-table">
                    <thead>
                      <tr>{exportCols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i}>
                          {exportCols.map((c) => (
                            <td key={c.key}>{r[c.key] ?? <span className="rm-muted">—</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="rm-modal-ft">
              <button type="button" className="rm-btn rm-btn-ghost" onClick={() => setShowResultModal(false)}>Cerrar</button>
              <button type="button" className="rm-btn rm-btn-ghost" onClick={generar} disabled={loading}>
                {loading ? <Loader2 size={14} className="rm-spin" /> : <Eye size={14} />} Regenerar
              </button>
              <button type="button" className="rm-btn rm-btn-ok" onClick={exportar} disabled={!filas.length}>
                <Download size={14} /> Exportar Excel ({filas.length.toLocaleString('es-MX')})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReporteMedicamentosRecetados;
