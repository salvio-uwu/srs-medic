import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Printer, Search } from 'lucide-react';
import { db } from '../../config/firebase';

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const pickFirstText = (...values) => {
  const match = values.find((value) => String(value || '').trim());
  return match ? String(match).trim() : '';
};

const pickNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number.parseFloat(String(value).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const formatCurrency = (value) => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);

const formatInteger = (value) => new Intl.NumberFormat('es-MX').format(Number.isFinite(value) ? value : 0);

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isAlmacenRecord = (item = {}) => {
  const markers = [
    item.sucursal,
    item.sucursalNombre,
    item.sucursalId,
    item.ubicacion,
    item.area,
    item.tipoUbicacion,
    item.destino,
    item.origen,
  ].map(normalizeText).filter(Boolean);

  if (markers.length === 0) return true;

  return markers.some((marker) => (
    marker === 'almacen'
    || marker === 'almacen central'
    || marker.includes('almacen')
    || marker.includes('bodega')
  ));
};

const ORDER_OPTIONS = [
  { value: 'descripcion', label: 'Descripción' },
  { value: 'clave', label: 'Clave' },
  { value: 'existencias_desc', label: 'Existencia mayor' },
  { value: 'total_desc', label: 'Valor mayor' },
];

const PRICE_OPTIONS = [
  { value: 'compra', label: 'Precio de Compra' },
  { value: 'venta', label: 'Precio de Venta' },
];

const stockTone = (value) => {
  if (!value || value <= 0) return 'bg-rose-50/70 text-rose-700 border-rose-200/80';
  if (value <= 10) return 'bg-amber-50/70 text-amber-700 border-amber-200/80';
  return 'bg-emerald-50/70 text-emerald-700 border-emerald-200/80';
};

const moneyTone = (value) => {
  if (!value || value <= 0) return 'bg-white/55 text-slate-500 border-slate-200/80';
  return 'bg-white/70 text-slate-700 border-slate-200/90';
};

const AlmacenJefatura = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('compra');
  const [selectedOrder, setSelectedOrder] = useState('descripcion');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventario'), (snap) => {
      const rows = snap.docs
        .map((docRef) => ({ id: docRef.id, ...docRef.data() }))
        .filter((item) => isAlmacenRecord(item));

      setItems(rows);
      setLoading(false);
    }, () => {
      setItems([]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const normalizedRows = useMemo(() => items.map((item) => ({
    id: item.id,
    clave: pickFirstText(item.clave, item.codigo, item.sku, item.codigoBarras, item.numeroAcomodo, item.idProducto, item.id),
    descripcion: pickFirstText(item.descripcion, item.medicamento, item.nombre, item.compuesto, item.nombreComercial, 'Sin descripción'),
    departamento: pickFirstText(item.departamento, item.area, item.seccion, item.grupo, 'General'),
    categoria: pickFirstText(item.categoria, item.familia, item.subcategoria, item.clasificacion, item.grupo, 'General'),
    precioCompra: pickNumber(item.precioCompra, item.costo, item.costoUnitario, item.precioCosto, item.costoPromedio, item.precio),
    precioVenta: pickNumber(item.precioVenta, item.precioPublico, item.precioLista, item.precioUnitarioVenta),
    existencias: pickNumber(item.existencias, item.exis, item.stock, item.existencia, item.cantidad, item.cantidadExistente),
  })), [items]);

  const departmentOptions = useMemo(() => Array.from(new Set(
    normalizedRows.map((item) => item.departamento).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })), [normalizedRows]);

  const categoryOptions = useMemo(() => Array.from(new Set(
    normalizedRows
      .filter((item) => !selectedDepartment || item.departamento === selectedDepartment)
      .map((item) => item.categoria)
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })), [normalizedRows, selectedDepartment]);

  const visibleRows = useMemo(() => {
    const term = normalizeText(search);
    const buckets = new Map();

    normalizedRows.forEach((item) => {
      if (selectedDepartment && item.departamento !== selectedDepartment) return;
      if (selectedCategory && item.categoria !== selectedCategory) return;
      if (term) {
        const haystack = normalizeText(`${item.clave} ${item.descripcion} ${item.departamento} ${item.categoria}`);
        if (!haystack.includes(term)) return;
      }

      const precioUnitario = selectedPrice === 'venta' && item.precioVenta > 0 ? item.precioVenta : item.precioCompra;
      const bucketKey = [
        normalizeText(item.clave),
        normalizeText(item.descripcion),
        normalizeText(item.departamento),
        normalizeText(item.categoria),
        precioUnitario.toFixed(2),
      ].join('|');

      const current = buckets.get(bucketKey) || {
        ...item,
        precioUnitario,
        existencias: 0,
        total: 0,
      };

      current.existencias += item.existencias;
      current.total = current.existencias * current.precioUnitario;
      buckets.set(bucketKey, current);
    });

    const rows = Array.from(buckets.values());
    rows.sort((a, b) => {
      if (selectedOrder === 'clave') return a.clave.localeCompare(b.clave, 'es', { sensitivity: 'base' });
      if (selectedOrder === 'existencias_desc') return b.existencias - a.existencias || a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
      if (selectedOrder === 'total_desc') return b.total - a.total || a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
      return a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
    });

    return rows;
  }, [normalizedRows, search, selectedDepartment, selectedCategory, selectedPrice, selectedOrder]);

  const metrics = useMemo(() => ({
    claves: visibleRows.length,
    existencias: visibleRows.reduce((acc, row) => acc + row.existencias, 0),
    valorTotal: visibleRows.reduce((acc, row) => acc + row.total, 0),
  }), [visibleRows]);

  useEffect(() => {
    if (selectedCategory && !categoryOptions.includes(selectedCategory)) {
      setSelectedCategory('');
    }
  }, [categoryOptions, selectedCategory]);

  const handlePrint = () => {
    const departmentLabel = selectedDepartment || 'Todos';
    const categoryLabel = selectedCategory || 'Todas';
    const priceLabel = PRICE_OPTIONS.find((item) => item.value === selectedPrice)?.label || 'Precio de Compra';
    const orderLabel = ORDER_OPTIONS.find((item) => item.value === selectedOrder)?.label || 'Descripción';
    const generatedAt = new Date();
    const generatedLabel = generatedAt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const generatedTime = generatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const rowsHtml = visibleRows.length > 0
      ? visibleRows.map((row) => `
          <tr>
            <td class="cell key">${escapeHtml(row.clave || '—')}</td>
            <td class="cell text">${escapeHtml(row.descripcion)}</td>
            <td class="cell num">${escapeHtml(formatCurrency(row.precioUnitario))}</td>
            <td class="cell num">${escapeHtml(formatInteger(row.existencias))}</td>
            <td class="cell num total">${escapeHtml(formatCurrency(row.total))}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="empty">No hay registros para los filtros seleccionados.</td></tr>';

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Reporte de Inventario - Almacén</title>
          <style>
            @page { margin: 14mm 10mm; size: letter landscape; }
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #1e293b; }
            .sheet { padding: 8px 10px; }
            .title { font-size: 20px; font-weight: 700; text-align: center; color: #0f4ea3; margin-bottom: 6px; }
            .meta { border-top: 1px solid #b8c5d6; border-bottom: 1px solid #b8c5d6; padding: 8px 0 6px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 28px; }
            .meta-line { font-size: 11px; color: #475569; }
            .meta-line strong { color: #0f4ea3; margin-right: 6px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            thead th { background: #0f4ea3; color: #fff; font-size: 11px; font-weight: 700; padding: 7px 8px; text-align: left; }
            .cell { border-bottom: 1px solid #dbe4f0; font-size: 11px; padding: 6px 8px; }
            .key { width: 14%; }
            .text { width: 46%; }
            .num { width: 13%; text-align: right; }
            .total { font-weight: 700; }
            tbody tr:nth-child(even) { background: #f8fafc; }
            tfoot td { border-top: 2px solid #0f4ea3; background: #eef4fb; font-size: 11px; font-weight: 700; padding: 7px 8px; }
            .empty { text-align: center; color: #64748b; padding: 18px 8px; }
            .foot { margin-top: 10px; font-size: 10px; color: #64748b; text-align: right; }
            .print-btn { position: fixed; right: 16px; bottom: 16px; background: #0f172a; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; }
            @media print { .print-btn { display: none; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="title">Reporte de Inventario</div>
            <div class="meta">
              <div class="meta-line"><strong>Departamento:</strong> ${escapeHtml(departmentLabel)}</div>
              <div class="meta-line"><strong>Categoría:</strong> ${escapeHtml(categoryLabel)}</div>
              <div class="meta-line"><strong>Precio:</strong> ${escapeHtml(priceLabel)}</div>
              <div class="meta-line"><strong>Orden:</strong> ${escapeHtml(orderLabel)}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Descripción</th>
                  <th style="text-align:right;">Precio U.</th>
                  <th style="text-align:right;">Exis</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="3">Total general</td>
                  <td style="text-align:right;">${escapeHtml(formatInteger(metrics.existencias))}</td>
                  <td style="text-align:right;">${escapeHtml(formatCurrency(metrics.valorTotal))}</td>
                </tr>
              </tfoot>
            </table>
            <div class="foot">Generado el ${escapeHtml(generatedLabel)} a las ${escapeHtml(generatedTime)} · Almacén Jefatura de Enfermería</div>
            <button class="print-btn" onclick="window.print()">Imprimir</button>
          </div>
        </body>
      </html>`);
    printWindow.document.close();
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="rounded-2xl border border-white/60 bg-white/55 shadow-[0_18px_45px_-26px_rgba(15,23,42,0.32)] backdrop-blur-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-4 pb-1">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2.5 text-sm font-bold shadow-sm transition-colors"
          >
            <Printer size={15} />
            Imprimir
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 p-4 pt-3 border-b border-white/70 bg-white/35 backdrop-blur-md">
          <label className="space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Departamento</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/75 backdrop-blur-md px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-white/70"
            >
              <option value="">Todos</option>
              {departmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Categoría</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/75 backdrop-blur-md px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-white/70"
            >
              <option value="">Todas</option>
              {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Precio</span>
            <select
              value={selectedPrice}
              onChange={(e) => setSelectedPrice(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/75 backdrop-blur-md px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-white/70"
            >
              {PRICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Orden</span>
            <select
              value={selectedOrder}
              onChange={(e) => setSelectedOrder(e.target.value)}
              className="w-full rounded-xl border border-white/70 bg-white/75 backdrop-blur-md px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-white/70"
            >
              {ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <div className="xl:col-span-4 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por clave, descripción, departamento o categoría..."
              className="w-full rounded-xl border border-white/70 bg-white/75 backdrop-blur-md pl-10 pr-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-white/70"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/70 bg-white/35 backdrop-blur-md flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <span className="text-slate-400 uppercase tracking-wide">Filas</span>
              <span className="text-slate-900 tabular-nums">{formatInteger(visibleRows.length)}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <span className="text-slate-400 uppercase tracking-wide">Existencias</span>
              <span className="text-slate-900 tabular-nums">{formatInteger(metrics.existencias)}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <span className="text-slate-400 uppercase tracking-wide">Total</span>
              <span className="text-slate-900 tabular-nums">{formatCurrency(metrics.valorTotal)}</span>
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400">
            {selectedDepartment || 'Todos'} · {selectedCategory || 'Todas'} · {PRICE_OPTIONS.find((option) => option.value === selectedPrice)?.label}
          </p>
        </div>

        <div className="hidden md:block overflow-auto custom-scrollbar">
          <table className="w-full min-w-[860px] text-sm border-collapse">
            <thead>
              <tr className="bg-white/45 backdrop-blur-md border-b border-white/80">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 w-[5%]">#</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 w-[22%]">Clave</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Descripción</th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 w-[14%]">Precio U.</th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 w-[12%]">Exis</th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 w-[14%]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 font-semibold">
                    Cargando inventario del almacén...
                  </td>
                </tr>
              )}

              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No hay productos para estos filtros.
                  </td>
                </tr>
              )}

              {!loading && visibleRows.map((row, index) => (
                <tr key={`${row.clave}-${row.descripcion}-${index}`} className={`${index % 2 === 0 ? 'bg-white/35' : 'bg-white/55'} hover:bg-white/75 transition-colors backdrop-blur-sm`}>
                  <td className="px-4 py-3 text-[12px] font-bold text-slate-300 tabular-nums">{index + 1}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{row.clave || '—'}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-800 leading-tight">{row.descripcion}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-lg border border-white/80 bg-white/65 px-2 py-1 text-[10px] font-bold text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                          {row.departamento}
                        </span>
                        <span className="inline-flex items-center rounded-lg border border-white/80 bg-white/45 px-2 py-1 text-[10px] font-bold text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                          {row.categoria}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex min-w-24 items-center justify-center rounded-xl border px-3 py-1.5 text-[12px] font-black tabular-nums ${moneyTone(row.precioUnitario)}`}>
                      {formatCurrency(row.precioUnitario)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex min-w-20 items-center justify-center rounded-xl border px-3 py-1.5 text-[12px] font-black tabular-nums ${stockTone(row.existencias)}`}>
                      {formatInteger(row.existencias)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex min-w-24 items-center justify-center rounded-xl border px-3 py-1.5 text-[12px] font-black tabular-nums ${moneyTone(row.total)}`}>
                      {formatCurrency(row.total)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && visibleRows.length > 0 && (
              <tfoot>
                <tr className="bg-white/55 backdrop-blur-md border-t border-white/80">
                  <td colSpan={4} className="px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Total general</td>
                  <td className="px-4 py-3 text-center text-sm font-black text-slate-900">{formatInteger(metrics.existencias)}</td>
                  <td className="px-4 py-3 text-center text-sm font-black text-slate-900">{formatCurrency(metrics.valorTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="md:hidden divide-y divide-slate-100">
          {loading && (
            <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
              Cargando inventario del almacén...
            </div>
          )}

          {!loading && visibleRows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
              No hay productos para estos filtros.
            </div>
          )}

          {!loading && visibleRows.map((row, index) => (
            <div key={`${row.clave}-${row.descripcion}-${index}`} className="px-4 py-3.5 bg-white/40 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-400">#{index + 1} · {row.clave || '—'}</p>
                  <p className="mt-1 text-[13px] font-bold text-slate-800 leading-snug">{row.descripcion}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-black tabular-nums ${stockTone(row.existencias)}`}>
                  {formatInteger(row.existencias)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-lg border border-white/80 bg-white/65 px-2 py-1 text-[10px] font-bold text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  {row.departamento}
                </span>
                <span className="inline-flex items-center rounded-lg border border-white/80 bg-white/45 px-2 py-1 text-[10px] font-bold text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  {row.categoria}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className={`rounded-xl border px-3 py-2 ${moneyTone(row.precioUnitario)}`}>
                  <p className="text-[9px] uppercase tracking-wider font-black opacity-70">Precio U.</p>
                  <p className="text-[12px] font-black tabular-nums mt-1">{formatCurrency(row.precioUnitario)}</p>
                </div>
                <div className={`rounded-xl border px-3 py-2 ${moneyTone(row.total)}`}>
                  <p className="text-[9px] uppercase tracking-wider font-black opacity-70">Total</p>
                  <p className="text-[12px] font-black tabular-nums mt-1">{formatCurrency(row.total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlmacenJefatura;