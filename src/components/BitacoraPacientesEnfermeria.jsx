import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Loader2, ReceiptText } from 'lucide-react';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DISPENSE_STATUS_OPTIONS, getDispenseStatusMeta } from '../services/enfermeriaPatientLogService';

const todayValue = () => new Date().toLocaleDateString('en-CA');
const normalizeBranch = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const formatDateLabel = (value) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
};

const shiftDate = (value, deltaDays) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return todayValue();
  parsed.setDate(parsed.getDate() + deltaDays);
  return parsed.toLocaleDateString('en-CA');
};

const parseLogDate = (row) => {
  if (row?.consultaFinalizadaAtIso) {
    const parsed = new Date(row.consultaFinalizadaAtIso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (row?.fecha?.toDate) return row.fecha.toDate();
  if (row?.fecha) {
    const parsed = new Date(row.fecha);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const BitacoraPacientesEnfermeria = ({ sucursal = '' }) => {
  const [selectedDate, setSelectedDate] = useState(todayValue());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    if (!sucursal) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const q = query(collection(db, 'bitacora_px_enfermeria'), where('fechaString', '==', selectedDate));

    const unsub = onSnapshot(q, (snap) => {
      const nextRows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setRows(nextRows);
      setLoading(false);
    }, () => {
      setRows([]);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedDate, sucursal]);

  const filteredRows = useMemo(() => {
    const selectedBranch = normalizeBranch(sucursal);
    if (!selectedBranch) return rows;
    return rows.filter((row) => normalizeBranch(row?.sucursal) === selectedBranch);
  }, [rows, sucursal]);

  const orderedRows = useMemo(() => (
    [...filteredRows].sort((a, b) => {
      const timeA = parseLogDate(a)?.getTime() || 0;
      const timeB = parseLogDate(b)?.getTime() || 0;
      return timeA - timeB;
    })
  ), [filteredRows]);

  const otherBranchCount = useMemo(() => {
    const selectedBranch = normalizeBranch(sucursal);
    if (!selectedBranch) return 0;
    return rows.filter((row) => normalizeBranch(row?.sucursal) !== selectedBranch).length;
  }, [rows, sucursal]);

  const selectedDateLabel = useMemo(() => {
    return formatDateLabel(selectedDate);
  }, [selectedDate]);

  const renderRowsTable = (tableRows, tableKeyPrefix = 'main') => (
    <table className="min-w-[1220px] w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-white">
        <tr className="bg-slate-100 border-b-2 border-slate-300">
          <th className="px-2 py-3 text-center text-[10px] font-black text-slate-700 uppercase tracking-widest border-r border-slate-300">No. Receta</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">E/T</th>
          <th className="px-3 py-3 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest border-r border-slate-300">Motivo</th>
          <th className="px-3 py-3 text-left text-[10px] font-black text-slate-700 uppercase tracking-widest border-r border-slate-300">Nombre completo</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">Edad</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">Peso</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">Talla</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">T°</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">F.R.</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">St. O2</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">F.C.</th>
          <th className="px-2 py-3 text-center text-[11px] font-black text-slate-700 uppercase border-r border-slate-300">T/A</th>
          <th className="px-3 py-3 text-center text-[11px] font-black text-slate-700 uppercase">Receta</th>
        </tr>
      </thead>
      <tbody>
        {tableRows.map((row, index) => {
          const stripe = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
          const pagoClass = row.formaPagoShort
            ? 'text-slate-800 bg-slate-100 border-slate-200'
            : 'text-amber-700 bg-amber-50 border-amber-200';

          return (
            <tr key={`${tableKeyPrefix}_${row.id}`} className={`${stripe} border-b border-slate-200 hover:bg-blue-50/20`}>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 font-black text-[12px] text-slate-700 tabular-nums whitespace-nowrap">{row.noReceta || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200">
                <span className={`inline-flex items-center justify-center min-w-9 px-2 py-1 rounded-lg border text-[11px] font-black ${pagoClass}`}>
                  {row.formaPagoShort || '—'}
                </span>
              </td>
              <td className="px-3 py-2.5 border-r border-slate-200 text-[12px] font-semibold text-slate-700 min-w-[180px]">{row.motivo || '—'}</td>
              <td className="px-3 py-2.5 border-r border-slate-200 text-[12px] font-semibold text-slate-800 min-w-[300px]">{row.pacienteNombre || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.edad || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.peso || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.talla || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.temperatura || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.fr || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.spo2 || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.fc || '—'}</td>
              <td className="px-2 py-2.5 text-center border-r border-slate-200 text-[12px] font-bold text-slate-700">{row.ta || '—'}</td>
              <td className="px-3 py-2.5 text-center">
                <select
                  value={row.recetaSurtida || ''}
                  onChange={(e) => handleDispenseChange(row.id, e.target.value)}
                  disabled={savingId === row.id}
                  className="min-w-[120px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 disabled:opacity-60"
                >
                  <option value="">Pendiente</option>
                  {DISPENSE_STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const handleDispenseChange = async (rowId, value) => {
    setSavingId(rowId);
    try {
      const meta = getDispenseStatusMeta(value);
      await updateDoc(doc(db, 'bitacora_px_enfermeria', rowId), {
        recetaSurtida: meta?.value || '',
        recetaSurtidaLabel: meta?.label || '',
        recetaSurtidaUpdatedAt: serverTimestamp()
      });
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5">
      <div className="max-w-[1600px] w-full mx-auto flex flex-col gap-3 min-h-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-slate-800">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                  <ClipboardList size={17} />
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-slate-800">Bitácora de pacientes</h3>
                  <p className="text-[11px] font-medium text-slate-400">Formato clínico automatizado por consulta concluida. La columna Receta se captura manualmente en enfermería.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px] font-bold text-slate-600">
                <ReceiptText size={14} className="text-slate-400" />
                {orderedRows.length} registros
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
                <button
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Día anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-[12px] font-bold text-blue-700">
                  <CalendarDays size={14} />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent outline-none font-bold"
                  />
                </label>
                <button
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Día siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 min-h-0">
          {loading ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <p className="text-sm font-semibold">Cargando bitácora...</p>
            </div>
          ) : orderedRows.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-3 text-slate-400 px-6 text-center">
              <ClipboardList size={24} className="text-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-500">No hay pacientes registrados en esta fecha</p>
                <p className="text-[11px] font-medium text-slate-400 mt-1">Se llenará automáticamente cuando una consulta quede concluida en la sucursal seleccionada.</p>
                {sucursal && (
                  <p className="text-[11px] font-semibold text-slate-500 mt-2">Sucursal actual: {sucursal}</p>
                )}
                {otherBranchCount > 0 && (
                  <p className="text-[11px] font-semibold text-amber-600 mt-2">Hay {otherBranchCount} registro{otherBranchCount === 1 ? '' : 's'} en otras sucursales para esta misma fecha.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] font-black text-slate-700 uppercase tracking-wide">Registro diario de pacientes</p>
                  <p className="text-[11px] font-medium text-slate-400">Sucursal: {sucursal || 'Sin sucursal'} · Fecha: {selectedDateLabel}</p>
                </div>
              </div>
              {renderRowsTable(orderedRows, 'day')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BitacoraPacientesEnfermeria;