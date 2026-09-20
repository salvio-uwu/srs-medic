// src/pages/admin/ReporteTiemposAtencion.jsx
// Tiempos de atención — promedios mensuales por médico · export Excel

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, query, where, orderBy, limit, startAfter,
} from 'firebase/firestore';
import {
  CheckCircle2, ChevronLeft, Download, FileSpreadsheet,
  Loader2, Timer, AlertTriangle, Eye, X, UserRound,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import { db } from '../../config/firebase';

const CITAS_PAGE = 200;
const TRIAGE_IN_CHUNK = 30;
const MAX_MIN = 240; // descarta outliers absurdos

const MESES_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const METRICAS = [
  { key: 'consultaExterna', label: 'Tiempo en consulta', color: '#7EB6D9' },
  { key: 'antesEntrar', label: 'Antes de entrar a consulta', color: '#B8A9D4' },
  { key: 'tomaSignos', label: 'Toma de signos vitales', color: '#7EC8B5' },
  { key: 'antesTomaSignos', label: 'Antes de toma signos', color: '#E8D5A3' },
];

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
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const minsBetween = (a, b) => {
  if (!(a instanceof Date) || !(b instanceof Date)) return null;
  const m = (b.getTime() - a.getTime()) / 60000;
  if (!Number.isFinite(m) || m < 0) return null;
  if (m > MAX_MIN) return null;
  return m;
};

const round1 = (n) => Math.round(Number(n) * 10) / 10;

const periodoLabel = (y, m0) => `${MESES_ES[m0]} ${y}`;

const periodoKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Métricas en minutos a partir de timestamps de la cita (+ triage histórico como respaldo). */
const calcMetricasCita = (cita, triageFechaFallback) => {
  const llegada = parseFechaDoc(cita.llegadaAt);
  const triageIni = parseFechaDoc(cita.triageIniciadoAt);
  const triageFin = parseFechaDoc(cita.triageCompletadoAt) || parseFechaDoc(triageFechaFallback);
  const inicio = parseFechaDoc(cita.consultaIniciadaAt) || parseFechaDoc(cita.inicioConsultaAt);
  const fin = parseFechaDoc(cita.consultaFinalizadaAt) || parseFechaDoc(cita.completadaAt);

  let consultaExterna = null;
  if (typeof cita.duracionRealMin === 'number' && cita.duracionRealMin > 0 && cita.duracionRealMin <= MAX_MIN) {
    consultaExterna = cita.duracionRealMin;
  } else {
    consultaExterna = minsBetween(inicio, fin);
  }

  let antesEntrar = null;
  if (inicio && triageFin) antesEntrar = minsBetween(triageFin, inicio);
  else if (inicio && llegada && !triageFin) antesEntrar = minsBetween(llegada, inicio);

  const tomaSignos = minsBetween(triageIni, triageFin);
  const antesTomaSignos = minsBetween(llegada, triageIni);

  const refDate = inicio || fin || triageFin || llegada || parseFechaDoc(cita.fechaHora) || parseFechaDoc(cita.fecha);
  if (!refDate) return null;

  const hasAny = [consultaExterna, antesEntrar, tomaSignos, antesTomaSignos].some((v) => v != null);
  if (!hasAny) return null;

  return {
    periodo: periodoKey(refDate),
    consultaExterna,
    antesEntrar,
    tomaSignos,
    antesTomaSignos,
  };
};

const downloadXLSX = (rows, rangoLabel, filename) => {
  const aoa = [
    ['Tiempos de atención', rangoLabel],
    [],
    ['Periodos', 'Tiempos (min)', '', '', '', ''],
    [null, 'Tiempo en consulta', 'Antes de entrar a consulta', 'Toma de signos vitales', 'Antes de toma signos', 'Acumulado'],
    ...rows.map((r) => [
      r.periodo,
      String(r.consultaExterna.toFixed(1)),
      String(r.antesEntrar.toFixed(1)),
      String(r.tomaSignos.toFixed(1)),
      String(r.antesTomaSignos.toFixed(1)),
      String(r.acumulado.toFixed(1)),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 26 }, { wch: 24 }, { wch: 20 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tiempos de atención');
  XLSX.writeFile(wb, filename);
};

const STYLES = `
  .rt { font-family: 'DM Sans', system-ui, sans-serif; }
  .rt-steps { display: flex; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  .rt-step { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; }
  .rt-step:last-child { border-bottom: 0; }
  .rt-step.dim { opacity: .45; pointer-events: none; }
  .rt-step-hd { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .rt-badge { width: 26px; height: 26px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .rt-badge.done, .rt-badge.active { background: #0077B6; color: #fff; }
  .rt-badge.todo { background: #e2e8f0; color: #64748b; }
  .rt-step-title { font-size: .82rem; font-weight: 650; color: #0f172a; margin: 0; }
  .rt-step-sub { font-size: .68rem; color: #64748b; margin: 2px 0 0; }
  .rt-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; max-width: 520px; }
  .rt-label { display: flex; flex-direction: column; gap: 4px; font-size: .68rem; font-weight: 600; color: #64748b; }
  .rt-input, .rt-select { height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: .8rem; color: #0f172a; background: #f8fafc; font-family: inherit; outline: none; }
  .rt-input:focus, .rt-select:focus { border-color: #0077B6; background: #fff; box-shadow: 0 0 0 3px rgba(0,119,182,.12); }
  .rt-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .rt-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0; font-size: .74rem; font-weight: 650; cursor: pointer; font-family: inherit; }
  .rt-btn-primary { background: #0077B6; color: #fff; }
  .rt-btn-primary:hover { background: #023e8a; }
  .rt-btn-primary:disabled { opacity: .55; cursor: not-allowed; }
  .rt-btn-ghost { background: transparent; color: #64748b; }
  .rt-btn-ghost:hover { color: #0f172a; background: #f1f5f9; }
  .rt-btn-ok { background: #0f766e; color: #fff; }
  .rt-btn-ok:hover { background: #0d9488; }
  .rt-btn-ok:disabled { opacity: .55; cursor: not-allowed; }
  .rt-error { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: .72rem; margin-top: 12px; }
  .rt-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .rt-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .rt-kpi b { display: block; font-size: 1.05rem; color: #0f172a; font-family: 'Sora', sans-serif; }
  .rt-kpi span { font-size: .65rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
  .rt-success-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; }
  .rt-success-bar strong { font-size: .82rem; color: #14532d; }
  .rt-success-bar p { margin: 2px 0 0; font-size: .7rem; color: #166534; }
  .rt-modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .rt-modal { width: min(960px, 100%); max-height: min(90vh, 920px); background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(15,23,42,.25); display: flex; flex-direction: column; overflow: hidden; }
  .rt-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
  .rt-modal-hd h2 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1rem; color: #0f172a; text-align: center; }
  .rt-modal-hd .rt-modal-title { flex: 1; text-align: center; }
  .rt-modal-hd p { margin: 3px 0 0; font-size: .72rem; color: #64748b; }
  .rt-modal-x { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #f1f5f9; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .rt-modal-body { padding: 16px 18px; overflow: auto; flex: 1; }
  .rt-modal-ft { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
  .rt-chart-wrap { width: 100%; height: 360px; margin: 8px 0 16px; }
  .rt-table-wrap { overflow: auto; max-height: 280px; border: 1px solid #e2e8f0; border-radius: 8px; }
  .rt-table { width: 100%; border-collapse: collapse; font-size: .68rem; }
  .rt-table th { position: sticky; top: 0; background: #f1f5f9; text-align: left; padding: 7px 8px; color: #475569; font-weight: 700; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
  .rt-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .rt-spin { animation: rtSpin .8s linear infinite; }
  @keyframes rtSpin { to { transform: rotate(360deg); } }
`;

const ReporteTiemposAtencion = () => {
  const hoy = useMemo(() => new Date(), []);
  const primerDiaMes = useMemo(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1), [hoy]);

  const [step, setStep] = useState(1);
  const [fechaInicio, setFechaInicio] = useState(toDateInput(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(toDateInput(hoy));
  const [medicoId, setMedicoId] = useState('');
  const [medicos, setMedicos] = useState([]);
  const [loadingMedicos, setLoadingMedicos] = useState(true);

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
      setLoadingMedicos(true);
      try {
        let list = [];
        try {
          const qMed = query(collection(db, 'users'), where('rol', 'in', ['medico', 'doctor']));
          const snap = await getDocs(qMed);
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch {
          const snap = await getDocs(collection(db, 'users'));
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        if (cancelled) return;
        setMedicos(
          list
            .filter((u) => {
              const rol = String(u.rol || '').toLowerCase();
              return rol === 'medico' || rol === 'doctor' || rol.includes('medico');
            })
            .map((u) => ({
              id: u.id,
              nombre: u.nombre || u.displayName || u.email || u.id,
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        );
      } catch (err) {
        console.warn('[ReporteTiempos]', err);
      } finally {
        if (!cancelled) setLoadingMedicos(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const medicoLabel = useMemo(
    () => medicos.find((m) => m.id === medicoId)?.nombre || '',
    [medicoId, medicos],
  );

  const rangoLabel = `${fechaInicio} - ${fechaFin}`;

  const chartData = useMemo(
    () => [...filas].reverse().map((r) => ({
      periodo: r.periodo,
      consultaExterna: r.consultaExterna,
      antesEntrar: r.antesEntrar,
      tomaSignos: r.tomaSignos,
      antesTomaSignos: r.antesTomaSignos,
    })),
    [filas],
  );

  const generar = useCallback(async () => {
    if (!medicoId) {
      setError('Selecciona un médico.');
      return;
    }

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

      const fhInicio = `${fechaInicio}T00:00`;
      const fhFin = `${fechaFin}T23:59`;
      const warns = [];
      const citas = [];
      let cursor = null;
      let page = 0;
      let usedClientFilter = false;

      const buildQ = (withRange, cur) => {
        const parts = [where('doctorUid', '==', medicoId)];
        if (withRange) {
          parts.push(where('fechaHora', '>=', fhInicio));
          parts.push(where('fechaHora', '<=', fhFin));
          parts.push(orderBy('fechaHora', 'asc'));
        } else {
          parts.push(orderBy('fechaHora', 'asc'));
        }
        if (cur) parts.push(startAfter(cur));
        parts.push(limit(CITAS_PAGE));
        return query(collection(db, 'citas'), ...parts);
      };

      let withRange = true;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        page += 1;
        setProgress(`Citas… lote ${page}`);
        let snap;
        try {
          snap = await getDocs(buildQ(withRange, cursor));
        } catch (idxErr) {
          if (withRange) {
            console.warn('[ReporteTiempos] índice doctorUid+fechaHora:', idxErr?.message || idxErr);
            warns.push('Filtro de fechas en cliente (falta índice doctorUid + fechaHora).');
            withRange = false;
            usedClientFilter = true;
            cursor = null;
            page = 0;
            continue;
          }
          throw idxErr;
        }
        if (snap.empty) break;

        for (const d of snap.docs) {
          const data = d.data() || {};
          if (data.esCitaEnfermeria) continue;
          const fh = String(data.fechaHora || '');
          if (usedClientFilter || !withRange) {
            if (fh && (fh < fhInicio || fh > fhFin)) continue;
          }
          citas.push({ id: d.id, ...data });
        }

        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < CITAS_PAGE) break;
        // Si filtramos en cliente sin rango en query, cortar cuando ya pasamos el fin
        if (!withRange && cursor) {
          const lastFh = String(cursor.data()?.fechaHora || '');
          if (lastFh > fhFin) break;
        }
      }

      setProgress('Triage…');
      const triageByCita = {};
      const citaIds = citas.map((c) => c.id);
      for (const chunk of chunkArray(citaIds, TRIAGE_IN_CHUNK)) {
        if (chunk.length === 0) continue;
        try {
          const tSnap = await getDocs(
            query(collection(db, 'triage_enfermeria'), where('citaId', 'in', chunk)),
          );
          for (const td of tSnap.docs) {
            const t = td.data() || {};
            const cid = t.citaId;
            if (!cid) continue;
            const f = parseFechaDoc(t.fecha);
            if (!f) continue;
            const prev = triageByCita[cid];
            if (!prev || f > prev) triageByCita[cid] = f;
          }
        } catch (err) {
          console.warn('[ReporteTiempos] triage in:', err);
        }
      }

      setProgress('Calculando promedios…');
      const buckets = new Map(); // periodo -> { sums, counts }

      const ensure = (key) => {
        if (!buckets.has(key)) {
          buckets.set(key, {
            sums: {
              consultaExterna: 0,
              antesEntrar: 0,
              tomaSignos: 0,
              antesTomaSignos: 0,
            },
            counts: {
              consultaExterna: 0,
              antesEntrar: 0,
              tomaSignos: 0,
              antesTomaSignos: 0,
            },
          });
        }
        return buckets.get(key);
      };

      let usadas = 0;
      for (const c of citas) {
        const m = calcMetricasCita(c, triageByCita[c.id] || null);
        if (!m) continue;
        usadas += 1;
        const b = ensure(m.periodo);
        for (const { key } of METRICAS) {
          if (m[key] != null) {
            b.sums[key] += m[key];
            b.counts[key] += 1;
          }
        }
      }

      const keys = [...buckets.keys()].sort();
      const rows = keys.map((k) => {
        const [y, mo] = k.split('-').map(Number);
        const b = buckets.get(k);
        const avg = (key) => {
          const n = b.counts[key];
          return n > 0 ? round1(b.sums[key] / n) : 0;
        };
        const consultaExterna = avg('consultaExterna');
        const antesEntrar = avg('antesEntrar');
        const tomaSignos = avg('tomaSignos');
        const antesTomaSignos = avg('antesTomaSignos');
        return {
          periodo: periodoLabel(y, mo - 1),
          consultaExterna,
          antesEntrar,
          tomaSignos,
          antesTomaSignos,
          acumulado: round1(consultaExterna + antesEntrar + tomaSignos + antesTomaSignos),
        };
      });

      if (citas.length === 0) {
        warns.push('No hay citas del médico en el periodo.');
      } else if (usadas === 0) {
        warns.push('Hay citas, pero sin timestamps suficientes para calcular tiempos.');
      }

      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      setFilas(rows);
      setAdvertencias(warns);
      setGenMeta({ secs, citas: citas.length, usadas, periodos: rows.length });
      setStep(3);
      setShowResultModal(true);
      setProgress('');
    } catch (err) {
      console.error('[ReporteTiempos]', err);
      setError(`Error al generar el reporte: ${err.message || err}`);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, medicoId]);

  const exportar = () => {
    if (!filas.length) return;
    downloadXLSX(
      filas,
      rangoLabel,
      `TiemposDeAtencion_${fechaInicio}-${fechaFin}.xlsx`,
    );
  };

  return (
    <div className="rt">
      <style>{STYLES}</style>

      <div className="rt-steps">
        {/* 1 fechas */}
        <div className={`rt-step ${step < 1 ? 'dim' : ''}`}>
          <div className="rt-step-hd">
            <div className={`rt-badge ${step > 1 ? 'done' : 'active'}`}>{step > 1 ? <CheckCircle2 size={14} /> : '1'}</div>
            <div>
              <p className="rt-step-title">Elige un rango de fechas</p>
              <p className="rt-step-sub">Promedios mensuales del periodo</p>
            </div>
          </div>
          {step === 1 && (
            <>
              <div className="rt-fields">
                <label className="rt-label">Desde
                  <input type="date" className="rt-input" value={fechaInicio} onChange={(e) => e.target.value && setFechaInicio(e.target.value)} />
                </label>
                <label className="rt-label">Hasta
                  <input type="date" className="rt-input" value={fechaFin} max={toDateInput(hoy)} onChange={(e) => e.target.value && setFechaFin(e.target.value)} />
                </label>
              </div>
              <div className="rt-actions">
                <button type="button" className="rt-btn rt-btn-primary" onClick={() => setStep(2)}>Continuar</button>
              </div>
            </>
          )}
          {step > 1 && <p className="rt-step-sub">{fechaInicio} → {fechaFin}</p>}
        </div>

        {/* 2 médico */}
        <div className={`rt-step ${step < 2 ? 'dim' : ''}`}>
          <div className="rt-step-hd">
            <div className={`rt-badge ${step > 2 ? 'done' : step === 2 ? 'active' : 'todo'}`}>{step > 2 ? <CheckCircle2 size={14} /> : '2'}</div>
            <div>
              <p className="rt-step-title">Selecciona un médico</p>
              <p className="rt-step-sub">Requerido para este reporte</p>
            </div>
          </div>
          {step === 2 && (
            <>
              <label className="rt-label" style={{ maxWidth: 420 }}>
                Médico
                <select
                  className="rt-select"
                  value={medicoId}
                  onChange={(e) => setMedicoId(e.target.value)}
                  disabled={loadingMedicos}
                >
                  <option value="">{loadingMedicos ? 'Cargando…' : '— Seleccionar —'}</option>
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </label>
              <div className="rt-actions">
                <button type="button" className="rt-btn rt-btn-ghost" onClick={() => setStep(1)}><ChevronLeft size={14} /> Regresar</button>
                <button
                  type="button"
                  className="rt-btn rt-btn-primary"
                  disabled={!medicoId}
                  onClick={() => setStep(3)}
                >
                  Continuar <UserRound size={14} />
                </button>
              </div>
            </>
          )}
          {step > 2 && <p className="rt-step-sub">{medicoLabel}</p>}
        </div>

        {/* 3 generar */}
        <div className={`rt-step ${step < 3 ? 'dim' : ''}`}>
          <div className="rt-step-hd">
            <div className={`rt-badge ${genMeta ? 'done' : step === 3 ? 'active' : 'todo'}`}>
              {genMeta ? <CheckCircle2 size={14} /> : '3'}
            </div>
            <div>
              <p className="rt-step-title">Generar y exportar</p>
              <p className="rt-step-sub">Gráfico y descarga Excel</p>
            </div>
          </div>
          {step === 3 && !genMeta && (
            <>
              <div className="rt-kpis">
                <div className="rt-kpi"><span>Periodo</span><b style={{ fontSize: '.85rem' }}>{fechaInicio} → {fechaFin}</b></div>
                <div className="rt-kpi"><span>Médico</span><b style={{ fontSize: '.85rem' }}>{medicoLabel}</b></div>
              </div>
              <div className="rt-actions">
                <button type="button" className="rt-btn rt-btn-ghost" onClick={() => { setStep(2); setGenMeta(null); }} disabled={loading}>
                  <ChevronLeft size={14} /> Regresar
                </button>
                <button type="button" className="rt-btn rt-btn-primary" onClick={generar} disabled={loading || !medicoId}>
                  {loading ? <Loader2 size={14} className="rt-spin" /> : <Timer size={14} />}
                  {loading ? (progress || 'Generando…') : 'Generar reporte'}
                </button>
              </div>
            </>
          )}
          {genMeta && (
            <div className="rt-success-bar" style={{ marginTop: 4 }}>
              <div>
                <strong>Reporte listo</strong>
                <p>{rangoLabel} · {medicoLabel} · {genMeta.secs}s</p>
              </div>
              <div className="rt-actions" style={{ marginTop: 0 }}>
                <button type="button" className="rt-btn rt-btn-ghost" onClick={() => setShowResultModal(true)}><Eye size={14} /> Ver</button>
                <button type="button" className="rt-btn rt-btn-ok" onClick={exportar} disabled={!filas.length}>
                  <Download size={14} /> Exportar Excel
                </button>
                <button
                  type="button"
                  className="rt-btn rt-btn-ghost"
                  onClick={() => { setGenMeta(null); setFilas([]); setAdvertencias([]); setStep(2); }}
                >
                  Nuevo
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="rt-error"><AlertTriangle size={14} /><span>{error}</span></div>
          )}
        </div>
      </div>

      {showResultModal && (
        <div className="rt-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rt-modal">
            <div className="rt-modal-hd">
              <button type="button" className="rt-modal-x" onClick={() => setShowResultModal(false)} aria-label="Cerrar">
                <X size={16} />
              </button>
              <div className="rt-modal-title">
                <h2>Tiempos de atención</h2>
                <p>{rangoLabel}</p>
                <p>Dr. {medicoLabel}</p>
              </div>
              <div style={{ width: 32 }} />
            </div>
            <div className="rt-modal-body">
              {advertencias.length > 0 && (
                <div className="rt-error" style={{ marginTop: 0, marginBottom: 12, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                  <AlertTriangle size={14} />
                  <span>{advertencias.join(' ')}</span>
                </div>
              )}

              <div className="rt-kpis" style={{ marginBottom: 12 }}>
                <div className="rt-kpi"><span>Citas</span><b>{genMeta?.citas?.toLocaleString('es-MX') || 0}</b></div>
                <div className="rt-kpi"><span>Con tiempos</span><b>{genMeta?.usadas?.toLocaleString('es-MX') || 0}</b></div>
                <div className="rt-kpi"><span>Periodos</span><b>{genMeta?.periodos || 0}</b></div>
              </div>

              {filas.length > 0 ? (
                <>
                  <div className="rt-chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="periodo" width={72} tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v, name) => [`${Number(v).toFixed(1)} min`, METRICAS.find((m) => m.key === name)?.label || name]}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Legend
                          formatter={(value) => METRICAS.find((m) => m.key === value)?.label || value}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                        {METRICAS.map((m) => (
                          <Bar key={m.key} dataKey={m.key} stackId="t" fill={m.color} name={m.key} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rt-table-wrap">
                    <table className="rt-table">
                      <thead>
                        <tr>
                          <th>Periodo</th>
                          {METRICAS.map((m) => <th key={m.key}>{m.label}</th>)}
                          <th>Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((r) => (
                          <tr key={r.periodo}>
                            <td>{r.periodo}</td>
                            <td>{r.consultaExterna.toFixed(1)}</td>
                            <td>{r.antesEntrar.toFixed(1)}</td>
                            <td>{r.tomaSignos.toFixed(1)}</td>
                            <td>{r.antesTomaSignos.toFixed(1)}</td>
                            <td>{r.acumulado.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '.8rem', color: '#64748b', textAlign: 'center', padding: 24 }}>
                  Sin datos para graficar en este periodo.
                </p>
              )}
            </div>
            <div className="rt-modal-ft">
              <button type="button" className="rt-btn rt-btn-ghost" onClick={() => setShowResultModal(false)}>Cerrar</button>
              <button type="button" className="rt-btn rt-btn-ok" onClick={exportar} disabled={!filas.length}>
                <FileSpreadsheet size={14} /> Descargar Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReporteTiemposAtencion;
