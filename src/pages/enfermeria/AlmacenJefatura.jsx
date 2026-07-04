import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import {
  Printer, Search, RefreshCw, ChevronDown, ChevronRight,
  Package, AlertTriangle, TrendingDown, Layers, List, X
} from 'lucide-react';
import { db } from '../../config/firebase';

const PAGE_SIZE = 60;

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

/** Filtro opcional por ubicación explícita de almacén/bodega. */
const isAlmacenRecord = (item = {}) => {
  const markers = [
    item.sucursal, item.sucursalNombre, item.ubicacion, item.area,
    item.tipoUbicacion, item.destino, item.origen,
  ].map(normalizeText).filter(Boolean);

  if (markers.length === 0) return true; // sin marcador → asumir almacén central (datos legacy)

  return markers.some((m) =>
    m === 'almacen' || m === 'almacen central' || m.includes('almacen') || m.includes('bodega')
  );
};

const stockLevel = (qty) => {
  if (!qty || qty <= 0) return 'empty';
  if (qty <= 10) return 'low';
  return 'ok';
};

const stockTone = (value) => {
  const lvl = stockLevel(value);
  if (lvl === 'empty') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (lvl === 'low') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const ORDER_OPTIONS = [
  { value: 'descripcion', label: 'Descripción A-Z' },
  { value: 'clave', label: 'Clave' },
  { value: 'existencias_desc', label: 'Mayor existencia' },
  { value: 'total_desc', label: 'Mayor valor' },
];

const PRICE_OPTIONS = [
  { value: 'compra', label: 'Precio compra' },
  { value: 'venta', label: 'Precio venta' },
];

const STOCK_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'ok', label: 'Con stock' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'empty', label: 'Sin stock' },
];

const normalizeRow = (item) => {
  const existencias = pickNumber(item.existencias, item.exis, item.stock, item.existencia, item.cantidad, item.cantidadExistente);
  const precioCompra = pickNumber(item.precioCompra, item.costo, item.costoUnitario, item.precioCosto, item.costoPromedio, item.precio);
  const precioVenta = pickNumber(item.precioVenta, item.precioPublico, item.precioLista, item.precioUnitarioVenta);
  return {
    id: item.id,
    clave: pickFirstText(item.clave, item.codigo, item.sku, item.codigoBarras, item.numeroAcomodo, item.idProducto, item.id),
    descripcion: pickFirstText(item.descripcion, item.medicamento, item.nombre, item.compuesto, item.nombreComercial, 'Sin descripción'),
    departamento: pickFirstText(item.departamento, item.area, item.seccion, item.grupo, 'General'),
    categoria: pickFirstText(item.categoria, item.familia, item.subcategoria, item.clasificacion, item.grupo, 'General'),
    precioCompra,
    precioVenta,
    existencias,
    stockLvl: stockLevel(existencias),
  };
};

const aggregateRows = (rows, selectedPrice) => {
  const buckets = new Map();
  rows.forEach((item) => {
    const precioUnitario = selectedPrice === 'venta' && item.precioVenta > 0 ? item.precioVenta : item.precioCompra;
    const key = [
      normalizeText(item.clave),
      normalizeText(item.descripcion),
      normalizeText(item.departamento),
      normalizeText(item.categoria),
      precioUnitario.toFixed(2),
    ].join('|');

    const cur = buckets.get(key) || { ...item, precioUnitario, existencias: 0, total: 0 };
    cur.existencias += item.existencias;
    cur.total = cur.existencias * cur.precioUnitario;
    cur.stockLvl = stockLevel(cur.existencias);
    buckets.set(key, cur);
  });
  return Array.from(buckets.values());
};

const sortRows = (rows, order) => {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (order === 'clave') return a.clave.localeCompare(b.clave, 'es', { sensitivity: 'base' });
    if (order === 'existencias_desc') return b.existencias - a.existencias || a.descripcion.localeCompare(b.descripcion, 'es');
    if (order === 'total_desc') return b.total - a.total || a.descripcion.localeCompare(b.descripcion, 'es');
    return a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
  });
  return sorted;
};

/* ── Fila de producto (reutilizable en tabla y acordeón) ── */
const ProductRow = ({ row, index, compact = false }) => (
  <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100/80">
    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-300 tabular-nums w-10">{index + 1}</td>
    <td className="px-3 py-2.5 font-bold text-slate-600 text-[12px] whitespace-nowrap">{row.clave || '—'}</td>
    <td className="px-3 py-2.5">
      <p className="font-semibold text-slate-800 text-[13px] leading-snug">{row.descripcion}</p>
      {!compact && (
        <span className="inline-block mt-1 text-[10px] font-bold text-slate-400">{row.categoria}</span>
      )}
    </td>
    <td className="px-3 py-2.5 text-right">
      <span className="text-[12px] font-bold text-slate-600 tabular-nums">{formatCurrency(row.precioUnitario)}</span>
    </td>
    <td className="px-3 py-2.5 text-center">
      <span className={`inline-flex min-w-[3rem] justify-center rounded-lg border px-2 py-1 text-[11px] font-black tabular-nums ${stockTone(row.existencias)}`}>
        {formatInteger(row.existencias)}
      </span>
    </td>
    <td className="px-3 py-2.5 text-right">
      <span className="text-[12px] font-black text-slate-800 tabular-nums">{formatCurrency(row.total)}</span>
    </td>
  </tr>
);

const AlmacenJefatura = () => {
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('compra');
  const [selectedOrder, setSelectedOrder] = useState('descripcion');
  const [stockFilter, setStockFilter] = useState('ok'); // por defecto: solo con stock
  const [viewMode, setViewMode] = useState('grouped'); // grouped | table
  const [page, setPage] = useState(0);
  const [expandedDepts, setExpandedDepts] = useState({});

  // Carga bajo demanda (getDocs) en lugar de onSnapshot permanente → reduce costos Firestore
  const loadInventory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setLoadError('');
    try {
      const snap = await getDocs(collection(db, 'inventario'));
      const filtered = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(isAlmacenRecord)
        .map(normalizeRow);
      setRawItems(filtered);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Error cargando inventario:', e);
      setLoadError('No se pudo cargar el inventario. Intenta de nuevo.');
      setRawItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // Reset página al cambiar filtros
  useEffect(() => { setPage(0); }, [search, selectedDepartment, selectedCategory, stockFilter, selectedOrder, viewMode]);

  const departmentOptions = useMemo(() => Array.from(
    new Set(rawItems.map((i) => i.departamento).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })), [rawItems]);

  const categoryOptions = useMemo(() => Array.from(
    new Set(rawItems
      .filter((i) => !selectedDepartment || i.departamento === selectedDepartment)
      .map((i) => i.categoria)
      .filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })), [rawItems, selectedDepartment]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(search);
    let rows = rawItems;

    if (selectedDepartment) rows = rows.filter((i) => i.departamento === selectedDepartment);
    if (selectedCategory) rows = rows.filter((i) => i.categoria === selectedCategory);
    if (stockFilter !== 'all') rows = rows.filter((i) => i.stockLvl === stockFilter);
    if (term) {
      rows = rows.filter((i) =>
        normalizeText(`${i.clave} ${i.descripcion} ${i.departamento} ${i.categoria}`).includes(term)
      );
    }

    return sortRows(aggregateRows(rows, selectedPrice), selectedOrder);
  }, [rawItems, search, selectedDepartment, selectedCategory, stockFilter, selectedPrice, selectedOrder]);

  const globalMetrics = useMemo(() => {
    const all = aggregateRows(rawItems, selectedPrice);
    const visible = filteredRows;
    return {
      totalClaves: rawItems.length,
      conStock: rawItems.filter((i) => i.existencias > 0).length,
      sinStock: rawItems.filter((i) => i.existencias <= 0).length,
      stockBajo: rawItems.filter((i) => i.stockLvl === 'low').length,
      clavesVisibles: visible.length,
      existencias: visible.reduce((a, r) => a + r.existencias, 0),
      valorTotal: visible.reduce((a, r) => a + r.total, 0),
      valorGlobal: all.reduce((a, r) => a + r.total, 0),
    };
  }, [rawItems, filteredRows, selectedPrice]);

  // Agrupación por departamento para vista acordeón
  const groupedByDept = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      const dept = row.departamento || 'General';
      if (!map.has(dept)) map.set(dept, { items: [], existencias: 0, valor: 0 });
      const g = map.get(dept);
      g.items.push(row);
      g.existencias += row.existencias;
      g.valor += row.total;
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, count: data.items.length }))
      .sort((a, b) => b.valor - a.valor);
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const toggleDept = (name) => setExpandedDepts((p) => ({ ...p, [name]: !p[name] }));

  const clearFilters = () => {
    setSearch('');
    setSelectedDepartment('');
    setSelectedCategory('');
    setStockFilter('ok');
    setSelectedOrder('descripcion');
  };

  const hasActiveFilters = search || selectedDepartment || selectedCategory || stockFilter !== 'ok';

  useEffect(() => {
    if (selectedCategory && !categoryOptions.includes(selectedCategory)) setSelectedCategory('');
  }, [categoryOptions, selectedCategory]);

  const handlePrint = () => {
    const deptLabel = selectedDepartment || 'Todos';
    const catLabel = selectedCategory || 'Todas';
    const priceLabel = PRICE_OPTIONS.find((o) => o.value === selectedPrice)?.label || '';
    const generatedAt = new Date();
    const rowsHtml = filteredRows.length > 0
      ? filteredRows.map((row) => `
          <tr>
            <td class="cell key">${escapeHtml(row.clave || '—')}</td>
            <td class="cell text">${escapeHtml(row.descripcion)}<br/><small>${escapeHtml(row.departamento)} · ${escapeHtml(row.categoria)}</small></td>
            <td class="cell num">${escapeHtml(formatCurrency(row.precioUnitario))}</td>
            <td class="cell num">${escapeHtml(formatInteger(row.existencias))}</td>
            <td class="cell num total">${escapeHtml(formatCurrency(row.total))}</td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="empty">Sin registros para los filtros seleccionados.</td></tr>';

    const win = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Inventario Almacén</title>
      <style>@page{margin:14mm 10mm;size:letter landscape}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#1e293b}
      .title{font-size:18px;font-weight:700;text-align:center;color:#0f4ea3;margin-bottom:8px}
      .meta{font-size:10px;color:#64748b;text-align:center;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}thead th{background:#0f4ea3;color:#fff;font-size:10px;padding:6px 8px;text-align:left}
      .cell{border-bottom:1px solid #e2e8f0;font-size:10px;padding:5px 8px}.num{text-align:right}.total{font-weight:700}
      tbody tr:nth-child(even){background:#f8fafc}tfoot td{border-top:2px solid #0f4ea3;background:#eef4fb;font-weight:700;padding:6px 8px;font-size:10px}
      .empty{text-align:center;padding:16px;color:#64748b}.print-btn{position:fixed;right:16px;bottom:16px;background:#0f172a;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer}
      @media print{.print-btn{display:none}}</style></head><body>
      <div class="title">Inventario — Almacén Central</div>
      <div class="meta">${escapeHtml(deptLabel)} · ${escapeHtml(catLabel)} · ${escapeHtml(priceLabel)} · ${filteredRows.length} claves · Generado ${generatedAt.toLocaleString('es-MX')}</div>
      <table><thead><tr><th>Clave</th><th>Descripción</th><th style="text-align:right">Precio U.</th><th style="text-align:right">Exis</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td style="text-align:right">${escapeHtml(formatInteger(globalMetrics.existencias))}</td><td style="text-align:right">${escapeHtml(formatCurrency(globalMetrics.valorTotal))}</td></tr></tfoot>
      </table><button class="print-btn" onclick="window.print()">Imprimir</button></body></html>`);
    win.document.close();
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-4">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Con stock</span>
          </div>
          <p className="text-2xl font-black text-slate-800 tabular-nums">{formatInteger(globalMetrics.conStock)}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">de {formatInteger(globalMetrics.totalClaves)} claves</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stock bajo</span>
          </div>
          <p className="text-2xl font-black text-amber-600 tabular-nums">{formatInteger(globalMetrics.stockBajo)}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">≤ 10 unidades</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-rose-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sin stock</span>
          </div>
          <p className="text-2xl font-black text-rose-600 tabular-nums">{formatInteger(globalMetrics.sinStock)}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">existencia = 0</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 shadow-sm text-white">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-white/80" />
            <span className="text-[10px] font-black uppercase tracking-wider text-white/70">Valor filtrado</span>
          </div>
          <p className="text-xl font-black tabular-nums leading-tight">{formatCurrency(globalMetrics.valorTotal)}</p>
          <p className="text-[10px] text-white/60 font-semibold mt-0.5">{formatInteger(globalMetrics.existencias)} unidades</p>
        </div>
      </div>

      {/* ── Barra de herramientas ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-800">Inventario Almacén</h2>
            {lastUpdated && (
              <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
                · Actualizado {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle vista */}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              <button type="button" onClick={() => setViewMode('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-colors ${viewMode === 'grouped' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                <Layers size={13} /> Deptos
              </button>
              <button type="button" onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold transition-colors ${viewMode === 'table' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                <List size={13} /> Tabla
              </button>
            </div>
            <button type="button" onClick={() => loadInventory(true)} disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button type="button" onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-[11px] font-bold transition-colors">
              <Printer size={13} /> Imprimir
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clave, descripción, departamento..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50" />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Chips stock */}
            {STOCK_FILTERS.map((f) => (
              <button key={f.value} type="button" onClick={() => setStockFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                  stockFilter === f.value
                    ? f.value === 'empty' ? 'bg-rose-600 text-white border-rose-600'
                      : f.value === 'low' ? 'bg-amber-500 text-white border-amber-500'
                      : f.value === 'ok' ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}>
                {f.label}
                {f.value === 'ok' && ` (${globalMetrics.conStock})`}
                {f.value === 'low' && ` (${globalMetrics.stockBajo})`}
                {f.value === 'empty' && ` (${globalMetrics.sinStock})`}
              </button>
            ))}
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 border border-dashed border-slate-300 hover:border-slate-400 transition-colors">
                <X size={12} /> Limpiar
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none focus:border-amber-400">
              <option value="">Todos los deptos ({departmentOptions.length})</option>
              {departmentOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none focus:border-amber-400">
              <option value="">Todas las categorías</option>
              {categoryOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={selectedPrice} onChange={(e) => setSelectedPrice(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none focus:border-amber-400">
              {PRICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none focus:border-amber-400">
              {ORDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Resumen de filtros activos */}
        <div className="px-4 py-2 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-slate-500">
            <span className="text-slate-800">{formatInteger(globalMetrics.clavesVisibles)}</span> claves
            · <span className="text-slate-800">{formatInteger(globalMetrics.existencias)}</span> unidades
            · <span className="text-slate-800">{formatCurrency(globalMetrics.valorTotal)}</span>
          </p>
          {viewMode === 'table' && filteredRows.length > PAGE_SIZE && (
            <p className="text-[10px] text-slate-400 font-semibold">
              Página {page + 1} de {totalPages}
            </p>
          )}
        </div>

        {/* ── Contenido ── */}
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw size={24} className="animate-spin text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400">Cargando inventario...</p>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center px-4">
            <AlertTriangle size={24} className="text-rose-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">{loadError}</p>
            <button type="button" onClick={() => loadInventory()} className="mt-3 text-[12px] font-bold text-amber-600 underline">Reintentar</button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Package size={28} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">Sin productos para estos filtros</p>
            <button type="button" onClick={clearFilters} className="mt-2 text-[12px] font-bold text-amber-600 underline">Ver todos con stock</button>
          </div>
        ) : viewMode === 'grouped' ? (
          /* ── Vista agrupada por departamento ── */
          <div className="divide-y divide-slate-100">
            {groupedByDept.map((group) => {
              const actuallyOpen = expandedDepts[group.name] ?? (groupedByDept.length <= 6);
              return (
                <div key={group.name}>
                  <button type="button" onClick={() => toggleDept(group.name)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/80 transition-colors text-left">
                    {actuallyOpen
                      ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                      : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[13px] text-slate-800 truncate">{group.name}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        {group.count} claves · {formatInteger(group.existencias)} uds · {formatCurrency(group.valor)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg tabular-nums">
                      {formatCurrency(group.valor)}
                    </span>
                  </button>
                  {actuallyOpen && (
                    <div className="overflow-x-auto border-t border-slate-100/80">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="bg-slate-50/80">
                            <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 w-8">#</th>
                            <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 w-24">Clave</th>
                            <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-wider text-slate-400">Descripción</th>
                            <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-wider text-slate-400 w-24">Precio U.</th>
                            <th className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-wider text-slate-400 w-20">Exis</th>
                            <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-wider text-slate-400 w-28">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((row, idx) => (
                            <ProductRow key={`${row.clave}-${idx}`} row={row} index={idx} compact />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Vista tabla paginada ── */
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 w-8">#</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-400 w-24">Clave</th>
                    <th className="px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-400">Descripción</th>
                    <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-wider text-slate-400 w-24">Precio U.</th>
                    <th className="px-3 py-2.5 text-center text-[9px] font-black uppercase tracking-wider text-slate-400 w-20">Exis</th>
                    <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase tracking-wider text-slate-400 w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, idx) => (
                    <ProductRow key={`${row.clave}-${page}-${idx}`} row={row} index={page * PAGE_SIZE + idx} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={4} className="px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Total filtrado</td>
                    <td className="px-3 py-2.5 text-center text-[12px] font-black text-slate-800 tabular-nums">{formatInteger(globalMetrics.existencias)}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] font-black text-slate-800 tabular-nums">{formatCurrency(globalMetrics.valorTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards paginadas */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedRows.map((row, idx) => (
                <div key={`m-${row.clave}-${idx}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400">#{page * PAGE_SIZE + idx + 1} · {row.clave || '—'}</p>
                      <p className="text-[13px] font-bold text-slate-800 leading-snug mt-0.5">{row.descripcion}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{row.departamento} · {row.categoria}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-black tabular-nums ${stockTone(row.existencias)}`}>
                      {formatInteger(row.existencias)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                      <p className="text-[9px] font-black uppercase text-slate-400">Precio U.</p>
                      <p className="text-[12px] font-black text-slate-700 tabular-nums mt-0.5">{formatCurrency(row.precioUnitario)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                      <p className="text-[9px] font-black uppercase text-slate-400">Total</p>
                      <p className="text-[12px] font-black text-slate-700 tabular-nums mt-0.5">{formatCurrency(row.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                  ← Anterior
                </button>
                <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} de {formatInteger(filteredRows.length)}
                </span>
                <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AlmacenJefatura;
