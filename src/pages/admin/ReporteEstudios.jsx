// src/pages/admin/ReporteEstudios.jsx
// Reporte de Estudios — export Excel

import React, { useCallback, useMemo, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, Timestamp, limit, startAfter,
} from 'firebase/firestore';
import {
  CheckCircle2, ChevronLeft, Download, FileSpreadsheet,
  Loader2, FlaskConical, AlertTriangle, Eye, X,
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

const formatFecha = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

const nombreEstudio = (e) => {
  if (typeof e === 'string') return e.trim();
  if (!e || typeof e !== 'object') return '';
  return String(e.nombre || e.name || e.label || '').trim();
};

/** Formato: paquetes + estudios separados por punto y coma */
const formatEstudiosResultados = (estudios) => {
  if (!estudios) return '';
  if (typeof estudios === 'string') {
    const t = estudios.trim();
    if (!t) return '';
    if (t.includes('•')) {
      return t.split('•').map((x) => x.trim()).filter(Boolean).join('; ');
    }
    return t.split(/[,;]+/).map((x) => x.trim()).filter(Boolean).join('; ');
  }

  const partes = [];
  for (const p of estudios.paquetes_seleccionados || []) {
    const n = nombreEstudio(p);
    if (n) partes.push(n);
  }
  for (const e of estudios.estudios_seleccionados || []) {
    const n = nombreEstudio(e);
    if (n) partes.push(n);
  }
  if (partes.length === 0 && estudios.notas_generales) {
    return String(estudios.notas_generales).trim().replace(/[•]\s*/g, '').replace(/\s+/g, ' ');
  }
  return partes.join('; ');
};

const EXPORT_COLS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'nombrePaciente', label: 'Nombre del paciente' },
  { key: 'estudiosResultados', label: 'Estudios Resultados' },
];

const downloadXLSX = (rows, filename) => {
  const aoa = [
    EXPORT_COLS.map((c) => c.label),
    ...rows.map((r) => EXPORT_COLS.map((c) => (r[c.key] == null ? '' : String(r[c.key])))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 72 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estudios');
  XLSX.writeFile(wb, filename);
};

const STYLES = `
  .re { font-family: 'DM Sans', system-ui, sans-serif; }
  .re-steps { display: flex; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .re-step { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
  .re-step:last-child { border-bottom: 0; }
  .re-step.dim { opacity: .45; pointer-events: none; }
  .re-step-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .re-badge { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .re-badge.done, .re-badge.active { background: #0077B6; color: #fff; }
  .re-badge.todo { background: #e2e8f0; color: #64748b; }
  .re-step-title { font-size: .82rem; font-weight: 650; color: #0f172a; margin: 0; }
  .re-step-sub { font-size: .68rem; color: #64748b; margin: 2px 0 0; }
  .re-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; max-width: 480px; }
  .re-label { display: flex; flex-direction: column; gap: 4px; font-size: .68rem; font-weight: 600; color: #64748b; }
  .re-input { height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: .8rem; color: #0f172a; background: #f8fafc; font-family: inherit; outline: none; }
  .re-input:focus { border-color: #0077B6; background: #fff; box-shadow: 0 0 0 3px rgba(0,119,182,.12); }
  .re-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .re-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0; font-size: .74rem; font-weight: 650; cursor: pointer; font-family: inherit; }
  .re-btn-primary { background: #0077B6; color: #fff; }
  .re-btn-primary:hover { background: #023e8a; }
  .re-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
  .re-btn-ghost { background: transparent; color: #64748b; }
  .re-btn-ghost:hover { color: #0f172a; background: #f1f5f9; }
  .re-btn-ok { background: #0f766e; color: #fff; }
  .re-btn-ok:hover { background: #0d9488; }
  .re-btn-ok:disabled { opacity: .55; cursor: not-allowed; }
  .re-error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: .72rem; margin-top: 12px; }
  .re-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .re-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .re-kpi b { display: block; font-size: 1.05rem; color: #0f172a; font-family: 'Sora', sans-serif; }
  .re-kpi span { font-size: .65rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
  .re-success-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; }
  .re-success-bar strong { font-size: .82rem; color: #14532d; }
  .re-success-bar p { margin: 2px 0 0; font-size: .7rem; color: #166534; }
  .re-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .re-modal { width: min(880px, 100%); max-height: min(88vh, 900px); background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(15,23,42,.25); display: flex; flex-direction: column; overflow: hidden; }
  .re-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
  .re-modal-hd h2 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1rem; color: #0f172a; }
  .re-modal-hd p { margin: 3px 0 0; font-size: .7rem; color: #64748b; }
  .re-modal-x { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #f1f5f9; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .re-modal-body { padding: 16px 18px; overflow: auto; flex: 1; }
  .re-modal-ft { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
  .re-section { margin-bottom: 14px; }
  .re-section-label { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin: 0 0 8px; }
  .re-note { display: flex; gap: 8px; align-items: flex-start; padding: 9px 11px; border-radius: 8px; font-size: .72rem; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; margin-bottom: 6px; }
  .re-table-wrap { overflow: auto; max-height: 360px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .re-table { width: 100%; border-collapse: collapse; font-size: .68rem; }
  .re-table th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: 7px 8px; color: #475569; font-weight: 700; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
  .re-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
  .re-muted { color: #94a3b8; }
  .re-spin { animation: reSpin .8s linear infinite; }
  @keyframes reSpin { to { transform: rotate(360deg); } }
`;

const ReporteEstudios = () => {
  const hoy = useMemo(() => new Date(), []);
  const primerDiaMes = useMemo(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1), [hoy]);

  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [advertencias, setAdvertencias] = useState([]);
  const [filas, setFilas] = useState([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [genMeta, setGenMeta] = useState(null);

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

      let totalBruto = 0;
      const rows = [];
      let cursor = null;
      let page = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        page += 1;
        setProgress(`Historial… lote ${page} (${rows.length} con estudios)`);
        const snap = await getDocs(buildPageQuery(cursor));
        if (snap.empty) break;

        for (const d of snap.docs) {
          totalBruto += 1;
          const data = d.data() || {};
          const estudiosRaw = data.consulta?.estudios;
          const estudiosResultados = formatEstudiosResultados(estudiosRaw);
          if (!estudiosResultados) continue;

          const fechaConsulta = parseFechaDoc(data.fecha) || new Date();
          rows.push({
            fecha: formatFecha(fechaConsulta),
            nombrePaciente: data.pacienteNombre || '',
            estudiosResultados,
            _sort: fechaConsulta.getTime(),
          });
        }

        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < HISTORIAL_PAGE) break;
      }

      rows.sort((a, b) => a._sort - b._sort);

      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (totalBruto > 0 && rows.length < totalBruto) {
        warns.push(`${rows.length} de ${totalBruto} registros del periodo tenían estudios solicitados.`);
      }

      setFilas(rows);
      setAdvertencias(warns);
      setGenMeta({ secs, totalBruto });
      setStep(2);
      setShowResultModal(true);
      setProgress('');
    } catch (err) {
      console.error('[ReporteEstudios]', err);
      setError(`Error al generar el reporte: ${err.message || err}`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  const exportar = () => {
    if (!filas.length) return;
    downloadXLSX(filas, `Estudios_${fechaInicio}-${fechaFin}.xlsx`);
  };

  const preview = filas.slice(0, 60);

  return (
    <div className="re">
      <style>{STYLES}</style>

      <div className="re-steps">
        <div className={`re-step ${step < 1 ? 'dim' : ''}`}>
          <div className="re-step-hd">
            <div className={`re-badge ${step > 1 || genMeta ? 'done' : 'active'}`}>
              {(step > 1 || genMeta) ? <CheckCircle2 size={14} /> : '1'}
            </div>
            <div>
              <p className="re-step-title">Elige un rango de fechas</p>
              <p className="re-step-sub">Consultas con estudios o paquetes solicitados</p>
            </div>
          </div>
          {step === 1 && !genMeta && (
            <>
              <div className="re-fields">
                <label className="re-label">Desde
                  <input type="date" className="re-input" value={fechaInicio} onChange={(e) => e.target.value && setFechaInicio(e.target.value)} />
                </label>
                <label className="re-label">Hasta
                  <input type="date" className="re-input" value={fechaFin} max={toDateInput(hoy)} onChange={(e) => e.target.value && setFechaFin(e.target.value)} />
                </label>
              </div>
              <div className="re-actions">
                <button type="button" className="re-btn re-btn-primary" onClick={generar} disabled={loading}>
                  {loading ? <><Loader2 size={14} className="re-spin" /> Generando…</> : <><FlaskConical size={14} /> Generar reporte</>}
                </button>
              </div>
              {loading && progress && <p className="re-step-sub" style={{ marginTop: 10 }}>{progress}</p>}
              {error && <div className="re-error"><AlertTriangle size={14} /> {error}</div>}
            </>
          )}
          {(step > 1 || genMeta) && (
            <p className="re-step-sub">{fechaInicio} → {fechaFin}</p>
          )}
        </div>

        <div className={`re-step ${!genMeta ? 'dim' : ''}`}>
          <div className="re-step-hd">
            <div className={`re-badge ${genMeta ? 'done' : 'todo'}`}>
              {genMeta ? <CheckCircle2 size={14} /> : '2'}
            </div>
            <div>
              <p className="re-step-title">Resultados y exportación</p>
              <p className="re-step-sub">Vista previa y descarga Excel</p>
            </div>
          </div>
          {genMeta && (
            <div className="re-success-bar">
              <div>
                <strong>{filas.length.toLocaleString('es-MX')} registros con estudios</strong>
                <p>{fechaInicio} → {fechaFin} · {genMeta.secs}s</p>
              </div>
              <div className="re-actions" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="re-btn re-btn-ghost"
                  onClick={() => {
                    setStep(1);
                    setFilas([]);
                    setAdvertencias([]);
                    setGenMeta(null);
                    setShowResultModal(false);
                  }}
                >
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="re-btn re-btn-primary" onClick={() => setShowResultModal(true)}>
                  <Eye size={14} /> Ver resultados
                </button>
                <button type="button" className="re-btn re-btn-ok" onClick={exportar} disabled={!filas.length}>
                  <Download size={14} /> Exportar Excel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="re-step-sub" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <FileSpreadsheet size={13} /> Fecha · Nombre del paciente · Estudios Resultados
      </p>

      {showResultModal && (
        <div className="re-modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowResultModal(false); }}>
          <div className="re-modal" role="dialog" aria-modal="true">
            <div className="re-modal-hd">
              <div>
                <h2>Estudios</h2>
                <p>{fechaInicio} → {fechaFin}{genMeta ? ` · ${genMeta.secs}s` : ''}</p>
              </div>
              <button type="button" className="re-modal-x" onClick={() => setShowResultModal(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className="re-modal-body">
              <div className="re-section">
                <p className="re-section-label">Resumen</p>
                <div className="re-kpis">
                  <div className="re-kpi"><span>Con estudios</span><b>{filas.length.toLocaleString('es-MX')}</b></div>
                  <div className="re-kpi"><span>Periodo revisado</span><b>{(genMeta?.totalBruto || 0).toLocaleString('es-MX')}</b></div>
                </div>
              </div>
              {advertencias.map((w) => (
                <div key={w} className="re-note"><AlertTriangle size={14} /><span>{w}</span></div>
              ))}
              <div className="re-section" style={{ marginBottom: 0 }}>
                <p className="re-section-label">Vista previa</p>
                {filas.length === 0 ? (
                  <p className="re-muted">No hay estudios en el periodo.</p>
                ) : (
                  <div className="re-table-wrap">
                    <table className="re-table">
                      <thead>
                        <tr>{EXPORT_COLS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.map((r, i) => (
                          <tr key={`${r.fecha}-${r.nombrePaciente}-${i}`}>
                            {EXPORT_COLS.map((c) => (
                              <td key={c.key}>{r[c.key] || <span className="re-muted">—</span>}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="re-modal-ft">
              <button type="button" className="re-btn re-btn-ghost" onClick={() => setShowResultModal(false)}>Cerrar</button>
              <button type="button" className="re-btn re-btn-ghost" onClick={generar} disabled={loading}>
                {loading ? <Loader2 size={14} className="re-spin" /> : <Eye size={14} />} Regenerar
              </button>
              <button type="button" className="re-btn re-btn-ok" onClick={exportar} disabled={!filas.length}>
                <Download size={14} /> Exportar Excel ({filas.length.toLocaleString('es-MX')})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReporteEstudios;
