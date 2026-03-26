import React, { useEffect, useMemo, useState } from 'react';
import { X, Calendar, Filter, Printer, Search, RefreshCw } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const toDateInput = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalize = (value) => String(value || '').toLowerCase().trim();

const parseFlexibleDateToISO = (value) => {
  if (!value) return '';
  const raw = String(value).trim();

  // Already in ISO format YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Common locale string formats: DD/MM/YYYY or MM/DD/YYYY.
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const part1 = Number(slashMatch[1]);
    const part2 = Number(slashMatch[2]);
    const year = slashMatch[3];
    // Heuristic: if first part > 12 assume DD/MM/YYYY, otherwise treat as MM/DD/YYYY.
    const day = part1 > 12 ? part1 : part2;
    const month = part1 > 12 ? part2 : part1;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return toDateInput(parsed);
};

const getRowISODate = (row) => {
  const fromFechaString = parseFlexibleDateToISO(row.fechaString);
  if (fromFechaString) return fromFechaString;

  if (row.fecha?.toDate) {
    const d = row.fecha.toDate();
    if (!Number.isNaN(d.getTime())) return toDateInput(d);
  }

  if (row.fecha instanceof Date && !Number.isNaN(row.fecha.getTime())) {
    return toDateInput(row.fecha);
  }

  return '';
};

const getWeekdayIndexFromISODate = (isoDate) => {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};

const exportPrintableHtml = ({ rows, filters }) => {
  const chips = [];
  if (filters.startDate && filters.endDate) chips.push(`Rango: ${filters.startDate} a ${filters.endDate}`);
  if (filters.tipo) chips.push(`Tipo: ${filters.tipo}`);
  if (filters.area) chips.push(`Area: ${filters.area}`);
  if (filters.responsable) chips.push(`Responsable: ${filters.responsable}`);
  if (filters.weekdays.length > 0) chips.push(`Dias: ${filters.weekdays.map((i) => WEEKDAY_LABELS[i]).join(', ')}`);
  if (filters.searchText) chips.push(`Busqueda: ${filters.searchText}`);

  const bodyRows = rows
    .map((row, idx) => {
      const detalles = row.detalles ? JSON.stringify(row.detalles) : '';
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${row._isoDate || row.fechaString || ''}</td>
          <td>${row.tipo || ''}</td>
          <td>${row.area || ''}</td>
          <td>${row.turno || ''}</td>
          <td>${row.responsableNombre || ''}</td>
          <td>${detalles}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Bitacoras Filtradas</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { margin: 0 0 8px 0; font-size: 18px; }
          p { margin: 0 0 12px 0; font-size: 12px; color: #475569; }
          .chips { margin-bottom: 12px; }
          .chip { display: inline-block; margin: 0 6px 6px 0; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 999px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; vertical-align: top; word-break: break-word; }
          th { background: #f8fafc; text-transform: uppercase; letter-spacing: .04em; font-size: 10px; }
          @media print { body { margin: 8mm; } }
        </style>
      </head>
      <body>
        <h1>Bitacoras Operativas Filtradas</h1>
        <p>Total de registros: ${rows.length}</p>
        <div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join('')}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Area</th>
              <th>Turno</th>
              <th>Responsable</th>
              <th>Detalles</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `;
};

const FiltroBitacorasJefaturaModal = ({ isOpen, onClose, sourceRows = [] }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tipo, setTipo] = useState('');
  const [area, setArea] = useState('');
  const [responsable, setResponsable] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    if (Array.isArray(sourceRows) && sourceRows.length > 0) {
      const data = sourceRows.map((item) => ({ ...item, _isoDate: getRowISODate(item) }));
      data.sort((a, b) => {
        const aMs = a.fecha?.toDate ? a.fecha.toDate().getTime() : (a._isoDate ? new Date(`${a._isoDate}T00:00:00`).getTime() : 0);
        const bMs = b.fecha?.toDate ? b.fecha.toDate().getTime() : (b._isoDate ? new Date(`${b._isoDate}T00:00:00`).getTime() : 0);
        return bMs - aMs;
      });
      setRows(data);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const ingestSnapshot = (snap) => {
      const data = snap.docs.map((d) => {
        const item = { id: d.id, ...d.data() };
        return { ...item, _isoDate: getRowISODate(item) };
      });

      data.sort((a, b) => {
        const aMs = a.fecha?.toDate ? a.fecha.toDate().getTime() : (a._isoDate ? new Date(`${a._isoDate}T00:00:00`).getTime() : 0);
        const bMs = b.fecha?.toDate ? b.fecha.toDate().getTime() : (b._isoDate ? new Date(`${b._isoDate}T00:00:00`).getTime() : 0);
        return bMs - aMs;
      });

      setRows(data);
      setLoading(false);
    };

    // Primary strategy: broad range by fechaString (compatible with dashboards that query this field).
    const q = query(
      collection(db, 'bitacoras_operativas'),
      where('fechaString', '>=', '2000-01-01'),
      where('fechaString', '<=', '2100-12-31')
    );

    let isMounted = true;
    const fetchRows = async () => {
      try {
        const snap = await getDocs(q);
        if (!isMounted) return;
        ingestSnapshot(snap);
      } catch {
        try {
          const fallbackSnap = await getDocs(collection(db, 'bitacoras_operativas'));
          if (!isMounted) return;
          ingestSnapshot(fallbackSnap);
        } catch {
          if (!isMounted) return;
          setRows([]);
          setLoading(false);
        }
      }
    };

    fetchRows();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sourceRows]);

  const uniqueTipos = useMemo(() => {
    return [...new Set(rows.map((r) => r.tipo).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [rows]);

  const uniqueAreas = useMemo(() => {
    return [...new Set(rows.map((r) => r.area).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [rows]);

  const uniqueResponsables = useMemo(() => {
    return [...new Set(rows.map((r) => r.responsableNombre).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const rowDate = r._isoDate || '';
      if (startDate && rowDate && rowDate < startDate) return false;
      if (endDate && rowDate && rowDate > endDate) return false;
      if ((startDate || endDate) && !rowDate) return false;

      if (tipo && r.tipo !== tipo) return false;
      if (area && r.area !== area) return false;
      if (responsable && r.responsableNombre !== responsable) return false;

      if (selectedWeekdays.length > 0) {
        const day = getWeekdayIndexFromISODate(rowDate);
        if (day === null || !selectedWeekdays.includes(day)) return false;
      }

      if (!searchText) return true;

      const haystack = [
        r.tipo,
        r.area,
        r.turno,
        r.responsableNombre,
        rowDate || r.fechaString,
        r.observaciones,
        JSON.stringify(r.detalles || {})
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalize(searchText));
    });
  }, [rows, startDate, endDate, tipo, area, responsable, selectedWeekdays, searchText]);

  const toggleWeekday = (idx) => {
    setSelectedWeekdays((prev) => {
      if (prev.includes(idx)) return prev.filter((v) => v !== idx);
      return [...prev, idx].sort((a, b) => a - b);
    });
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setTipo('');
    setArea('');
    setResponsable('');
    setSearchText('');
    setSelectedWeekdays([]);
  };

  const printFiltered = () => {
    const html = exportPrintableHtml({
      rows: filteredRows,
      filters: {
        startDate,
        endDate,
        tipo,
        area,
        responsable,
        weekdays: selectedWeekdays,
        searchText
      }
    });

    const popup = window.open('', '_blank', 'width=1200,height=800');
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-3 md:p-6">
      <div className="w-full max-w-7xl h-[88vh] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        <header className="px-4 md:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg font-black text-slate-800">Filtro de Bitacoras Operativas</h2>
            <p className="text-xs text-slate-500">Consulta por fechas, dias, area, tipo y responsable.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Cerrar">
            <X size={16} />
          </button>
        </header>

        <section className="px-4 md:px-6 py-4 border-b border-slate-100 bg-slate-50/70 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="text-xs font-bold text-slate-600">
            Fecha inicio
            <div className="relative mt-1">
              <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm" />
            </div>
          </label>

          <label className="text-xs font-bold text-slate-600">
            Fecha fin
            <div className="relative mt-1">
              <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm" />
            </div>
          </label>

          <label className="text-xs font-bold text-slate-600">
            Tipo de bitacora
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-sm">
              <option value="">Todos</option>
              {uniqueTipos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600">
            Area
            <select value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-sm">
              <option value="">Todas</option>
              {uniqueAreas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-1">
            Responsable
            <select value={responsable} onChange={(e) => setResponsable(e.target.value)} className="mt-1 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-sm">
              <option value="">Todos</option>
              {uniqueResponsables.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-3">
            Buscar (texto libre)
            <div className="relative mt-1">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tipo, area, responsable, observaciones, detalles..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
              />
            </div>
          </label>

          <div className="md:col-span-2 xl:col-span-4">
            <p className="text-xs font-bold text-slate-600 mb-2">Dias de la semana</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((day, idx) => {
                const active = selectedWeekdays.includes(idx);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(idx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="text-xs text-slate-500">
              {loading ? 'Cargando registros...' : `${filteredRows.length} resultado(s) de ${rows.length} registro(s)`}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={resetFilters} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">
                <RefreshCw size={12} /> Limpiar
              </button>
              <button onClick={printFiltered} disabled={filteredRows.length === 0} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
                <Printer size={12} /> Imprimir filtrado
              </button>
            </div>
          </div>
        </section>

        <section className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] uppercase text-slate-500 text-left">Fecha</th>
                <th className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] uppercase text-slate-500 text-left">Tipo</th>
                <th className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] uppercase text-slate-500 text-left">Area</th>
                <th className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] uppercase text-slate-500 text-left">Turno</th>
                <th className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] uppercase text-slate-500 text-left">Responsable</th>
                <th className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] uppercase text-slate-500 text-left">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 border-b border-slate-100 text-xs font-mono text-slate-600">{row._isoDate || row.fechaString || '-'}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-xs font-bold text-slate-700">{row.tipo || '-'}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-xs text-slate-600">{row.area || '-'}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-xs text-slate-600">{row.turno || '-'}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-xs text-slate-600">{row.responsableNombre || '-'}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-[11px] text-slate-500 font-mono whitespace-pre-wrap">{JSON.stringify(row.detalles || {}, null, 0)}</td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">Sin resultados para estos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <footer className="px-4 md:px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default FiltroBitacorasJefaturaModal;
