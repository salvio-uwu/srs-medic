import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  writeBatch, serverTimestamp, increment
} from 'firebase/firestore';
import {
  Printer, Search, Trash2, Loader2, AlertTriangle, Plus,
  RefreshCcw, Save, X, CheckCircle2, ArrowLeftRight
} from 'lucide-react';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import TraspasoSucursalModal from '../../components/TraspasoSucursalModal';

/* ════════════════════════════════════════════════════════════════
   ALMACÉN — Maestro / colector central de medicamentos e insumos.
   Se trata como una sucursal más: recibe (alta/recepción/entrada)
   y expide (salidas/traspasos) hacia las demás sucursales.
   Inventario estilo Excel: Existencia · Físico · Diferencia.
   ════════════════════════════════════════════════════════════════ */

export const ALMACEN_SUCURSAL_NOMBRE = 'Almacén';
const ALMACEN_QUERY_NAMES = ['Almacén', 'Almacen', 'ALMACÉN', 'ALMACEN', 'almacén', 'almacen'];

let cacheCatalogoMeds = null;

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const isSucursalAlmacen = (value = '') => {
  const n = normalizeText(value);
  return n === 'almacen' || n === 'almacen central' || n.startsWith('almacen ');
};

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

const formatInteger = (value) => new Intl.NumberFormat('es-MX').format(Number.isFinite(value) ? value : 0);

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatCaducidad = (value = '') => {
  if (!value) return '—';
  const parts = String(value).split('-');
  return parts.length === 3 ? parts.reverse().join('/') : value;
};

const PAGE_SIZE = 100;

const ORDER_OPTIONS = [
  { value: 'descripcion', label: 'Descripción' },
  { value: 'clave', label: 'Clave' },
  { value: 'existencias_desc', label: 'Existencia mayor' },
  { value: 'caducidad', label: 'Caducidad próxima' },
];

const toCatalogRow = (d) => ({
  id: d.id,
  nombre: pickFirstText(d.medicamento, d.nombreComercial, d['*NOMBRE COMERCIAL']),
  sustancia: pickFirstText(d.sustanciaActiva, d.sustanciasActivas, d['*SUSTANCIA(S) ACTIVA(S)']),
  presentacion: pickFirstText(d.presentacion, d['*PRESENTACIÓN'], d['*PRESENTACION']),
  marca: pickFirstText(d.marca, d.grupo, d['*MARCA']),
  clave: pickFirstText(d.numeroAcomodo, d.clave, d.codigo),
});

const AlmacenJefatura = () => {
  const { user } = useAuth();
  const nombreUsuario = user?.nombre || user?.displayName || user?.email || 'Jefatura';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('descripcion');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [toast, setToast] = useState(null);

  // Conteo físico (estilo Excel)
  const [fisicoMap, setFisicoMap] = useState({});
  const [savingConteo, setSavingConteo] = useState(false);

  // Alta de medicamento
  const [showAlta, setShowAlta] = useState(false);
  const [altaForm, setAltaForm] = useState({ cantidad: '', lote: '', caducidad: '' });
  const [altaMed, setAltaMed] = useState(null);
  const [altaSearch, setAltaSearch] = useState('');
  const [altaSugerencias, setAltaSugerencias] = useState([]);
  const [savingAlta, setSavingAlta] = useState(false);
  const altaInputRef = useRef(null);

  // Vaciado temporal
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  // Traspaso a otra sucursal
  const [traspasoItem, setTraspasoItem] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ─── Carga bajo demanda: solo docs de la sucursal Almacén (barato en Firebase) ─── */
  const loadInventario = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'inventario'),
        where('sucursal', 'in', ALMACEN_QUERY_NAMES)
      ));
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => isSucursalAlmacen(item.sucursal || item.sucursalNombre));
      setItems(rows);
    } catch (err) {
      console.error('Error cargando inventario Almacén', err);
      setItems([]);
      showToast('No se pudo cargar el inventario de Almacén.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Asegurar que Almacén exista como sucursal del catálogo ─── */
  useEffect(() => {
    const ensure = async () => {
      try {
        const snap = await getDocs(collection(db, 'catalogo_sucursales'));
        const exists = snap.docs.some((d) => isSucursalAlmacen(d.data()?.nombre || d.id));
        if (!exists) {
          await addDoc(collection(db, 'catalogo_sucursales'), {
            nombre: ALMACEN_SUCURSAL_NOMBRE,
            activo: true,
            esAlmacenCentral: true,
            creadoAt: serverTimestamp(),
            notas: 'Sucursal maestra de almacén central (auto-creada)'
          });
        }
      } catch (err) {
        console.error('No se pudo asegurar la sucursal Almacén', err);
      }
    };
    ensure();
    loadInventario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Normalización de filas ─── */
  const normalizedRows = useMemo(() => items.map((item) => ({
    id: item.id,
    medicamentoId: item.medicamentoId || null,
    clave: pickFirstText(item.numeroAcomodo, item.clave, item.codigo, item.sku),
    descripcion: pickFirstText(item.descripcion, item.medicamento, item.nombre, item.compuesto, item.nombreComercial, 'Sin descripción'),
    presentacion: pickFirstText(item.presentacion),
    lote: pickFirstText(item.lote),
    caducidad: item.caducidad || '',
    existencias: pickNumber(item.existencias, item.stock, item.existencia, item.cantidad),
  })), [items]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(search);
    const rows = normalizedRows.filter((item) => {
      if (!term) return true;
      const haystack = normalizeText(`${item.clave} ${item.descripcion} ${item.presentacion} ${item.lote}`);
      return haystack.includes(term);
    });

    rows.sort((a, b) => {
      if (selectedOrder === 'clave') return a.clave.localeCompare(b.clave, 'es', { numeric: true, sensitivity: 'base' });
      if (selectedOrder === 'existencias_desc') return b.existencias - a.existencias || a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
      if (selectedOrder === 'caducidad') {
        const ca = a.caducidad || '9999-12-31';
        const cb = b.caducidad || '9999-12-31';
        return ca.localeCompare(cb) || a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
      }
      return a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' });
    });

    return rows;
  }, [normalizedRows, search, selectedOrder]);

  const visibleRows = useMemo(() => filteredRows.slice(0, visibleLimit), [filteredRows, visibleLimit]);

  useEffect(() => { setVisibleLimit(PAGE_SIZE); }, [search, selectedOrder]);

  /* ─── Conteo físico ─── */
  const getDif = (row) => {
    const raw = fisicoMap[row.id];
    if (raw === undefined || raw === '') return null;
    const fisico = Number(raw);
    if (!Number.isFinite(fisico)) return null;
    return fisico - row.existencias;
  };

  const conteoCapturado = useMemo(() => (
    filteredRows.filter((row) => fisicoMap[row.id] !== undefined && fisicoMap[row.id] !== '')
  ), [filteredRows, fisicoMap]);

  const guardarConteo = async () => {
    if (conteoCapturado.length === 0) return;
    setSavingConteo(true);
    try {
      const filas = conteoCapturado.map((row) => ({
        inventarioId: row.id,
        clave: row.clave,
        descripcion: row.descripcion,
        lote: row.lote,
        existencia: row.existencias,
        fisico: Number(fisicoMap[row.id]),
        dif: Number(fisicoMap[row.id]) - row.existencias
      }));

      const conAjuste = filas.filter((f) => f.dif !== 0);
      const CHUNK = 400;
      for (let i = 0; i < conAjuste.length; i += CHUNK) {
        const batch = writeBatch(db);
        conAjuste.slice(i, i + CHUNK).forEach((f) => {
          batch.update(doc(db, 'inventario', f.inventarioId), {
            stock: f.fisico,
            existencias: f.fisico,
            ultimoConteoAt: serverTimestamp(),
            ultimoConteoPor: nombreUsuario
          });
        });
        await batch.commit();
      }

      await addDoc(collection(db, 'bitacoras_operativas'), {
        tipo: 'Conteo Almacén',
        area: ALMACEN_SUCURSAL_NOMBRE,
        sucursal: ALMACEN_SUCURSAL_NOMBRE,
        fecha: serverTimestamp(),
        fechaString: new Date().toLocaleDateString('en-CA'),
        responsableNombre: nombreUsuario,
        estado: 'completado',
        detalles: {
          totalFilas: filas.length,
          totalAjustes: conAjuste.length,
          filas
        }
      });

      setFisicoMap({});
      await loadInventario();
      showToast(conAjuste.length > 0
        ? `Conteo guardado: ${conAjuste.length} ajuste(s) aplicado(s).`
        : 'Conteo guardado sin diferencias.');
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar el conteo.', 'error');
    } finally {
      setSavingConteo(false);
    }
  };

  /* ─── Alta de medicamento (ligada al catálogo admin) ─── */
  const openAlta = async () => {
    setShowAlta(true);
    setAltaMed(null);
    setAltaSearch('');
    setAltaSugerencias([]);
    setAltaForm({ cantidad: '', lote: '', caducidad: '' });
    if (!cacheCatalogoMeds) {
      try {
        const snap = await getDocs(collection(db, 'catalogo_medicamentos'));
        cacheCatalogoMeds = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => m.activo !== false)
          .map(toCatalogRow)
          .filter((m) => m.nombre);
      } catch (err) {
        console.error('Error cargando catálogo', err);
        cacheCatalogoMeds = [];
      }
    }
    setTimeout(() => altaInputRef.current?.focus(), 60);
  };

  useEffect(() => {
    if (!showAlta || !cacheCatalogoMeds) return;
    const term = normalizeText(altaSearch);
    if (term.length < 2) { setAltaSugerencias([]); return; }
    const tokens = term.split(/\s+/).filter(Boolean);
    const results = cacheCatalogoMeds
      .filter((m) => {
        const hay = normalizeText(`${m.nombre} ${m.sustancia} ${m.presentacion} ${m.marca} ${m.clave} ${m.id}`);
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, 12);
    setAltaSugerencias(results);
  }, [altaSearch, showAlta]);

  const guardarAlta = async () => {
    const cantidad = Number(altaForm.cantidad);
    if (!altaMed) return showToast('Selecciona un medicamento del catálogo.', 'error');
    if (!cantidad || cantidad <= 0) return showToast('Ingresa una cantidad válida.', 'error');
    if (!altaForm.lote.trim()) return showToast('Ingresa el lote.', 'error');
    if (!altaForm.caducidad) return showToast('Ingresa la caducidad.', 'error');

    setSavingAlta(true);
    try {
      const loteTrim = altaForm.lote.trim();
      const existente = items.find((i) =>
        i.medicamentoId === altaMed.id && String(i.lote || '') === loteTrim
      );

      if (existente) {
        await updateDoc(doc(db, 'inventario', existente.id), {
          stock: increment(cantidad),
          existencias: increment(cantidad),
          caducidad: altaForm.caducidad,
          actualizadoAt: serverTimestamp(),
          actualizadoPor: nombreUsuario
        });
      } else {
        await addDoc(collection(db, 'inventario'), {
          medicamentoId: altaMed.id,
          medicamento: altaMed.nombre,
          nombreComercial: altaMed.nombre,
          descripcion: altaMed.nombre,
          presentacion: altaMed.presentacion || '',
          marca: altaMed.marca || '',
          numeroAcomodo: altaMed.clave || '',
          clave: altaMed.clave || '',
          lote: loteTrim,
          caducidad: altaForm.caducidad,
          stock: cantidad,
          existencias: cantidad,
          sucursal: ALMACEN_SUCURSAL_NOMBRE,
          sucursalNombre: ALMACEN_SUCURSAL_NOMBRE,
          activo: true,
          creadoAt: serverTimestamp(),
          creadoPor: nombreUsuario,
          origen: 'alta_directa_almacen'
        });
      }

      // Registro en bitácora E/S para que todo cuente entre sí
      await addDoc(collection(db, 'bitacoras_operativas'), {
        tipo: 'Farmacia',
        area: 'Entrada',
        sucursal: ALMACEN_SUCURSAL_NOMBRE,
        fecha: serverTimestamp(),
        fechaString: new Date().toLocaleDateString('en-CA'),
        responsableNombre: nombreUsuario,
        estado: 'completado',
        estadoAprobacion: 'aprobado',
        estadoInventario: 'integrado',
        aprobadoPorNombre: nombreUsuario,
        aprobadoAt: serverTimestamp(),
        detalles: {
          tipo_movimiento: 'Entrada',
          medicamentoId: altaMed.id,
          compuesto: altaMed.nombre,
          presentacion: altaMed.presentacion || '',
          numeroAcomodo: altaMed.clave || '',
          lote: loteTrim,
          caducidad: altaForm.caducidad,
          cantidad: String(cantidad),
          sucursalOrigen: 'Alta directa',
          sucursalDestino: ALMACEN_SUCURSAL_NOMBRE,
          observaciones: 'Alta directa en almacén'
        }
      });

      setShowAlta(false);
      await loadInventario();
      showToast(`${altaMed.nombre}: +${cantidad} en Almacén.`);
    } catch (err) {
      console.error(err);
      showToast('No se pudo dar de alta el medicamento.', 'error');
    } finally {
      setSavingAlta(false);
    }
  };

  /* ─── Vaciado temporal ─── */
  const handlePurgeAlmacen = async () => {
    if (!items.length) {
      showToast('No hay inventario de Almacén para vaciar.', 'error');
      setConfirmPurge(false);
      return;
    }
    setPurging(true);
    try {
      const CHUNK = 400;
      for (let i = 0; i < items.length; i += CHUNK) {
        const batch = writeBatch(db);
        items.slice(i, i + CHUNK).forEach((row) => batch.delete(doc(db, 'inventario', row.id)));
        await batch.commit();
      }
      showToast(`Se eliminaron ${items.length} registros de Almacén.`);
      setConfirmPurge(false);
      await loadInventario();
    } catch (err) {
      console.error(err);
      showToast('No se pudo vaciar el inventario de Almacén.', 'error');
    } finally {
      setPurging(false);
    }
  };

  /* ─── Impresión (formato Excel: Existencia / Físico / Dif) ─── */
  const handlePrint = () => {
    const generatedAt = new Date();
    const generatedLabel = generatedAt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const rowsHtml = filteredRows.length > 0
      ? filteredRows.map((row) => {
        const dif = getDif(row);
        const fisico = fisicoMap[row.id];
        return `
          <tr>
            <td>${escapeHtml(row.clave || '—')}</td>
            <td>${escapeHtml(row.descripcion)}</td>
            <td>${escapeHtml(row.lote || '—')}</td>
            <td>${escapeHtml(formatCaducidad(row.caducidad))}</td>
            <td style="text-align:right;">${escapeHtml(formatInteger(row.existencias))}</td>
            <td style="text-align:right;">${fisico !== undefined && fisico !== '' ? escapeHtml(String(fisico)) : ''}</td>
            <td style="text-align:right;">${dif === null ? '' : escapeHtml(String(dif))}</td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="7" style="text-align:center;">Sin registros</td></tr>';

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Inventario · ${ALMACEN_SUCURSAL_NOMBRE}</title>
      <style>
        body{font-family:system-ui,sans-serif;color:#1e293b;padding:24px;font-size:12px}
        h1{font-size:18px;margin:0 0 4px} .meta{color:#64748b;margin-bottom:16px}
        table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px 8px}
        th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.06em}
        @media print{.no-print{display:none}}
      </style></head><body>
      <h1>Inventario — Sucursal ${ALMACEN_SUCURSAL_NOMBRE}</h1>
      <p class="meta">${escapeHtml(generatedLabel)} · ${escapeHtml(nombreUsuario)} · ${filteredRows.length} claves</p>
      <table><thead><tr><th>Clave</th><th>Descripción</th><th>Lote</th><th>Caducidad</th><th>Existencia</th><th>Físico</th><th>Dif</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <button class="no-print" onclick="window.print()" style="margin-top:16px">Imprimir</button>
      </body></html>`);
    printWindow.document.close();
  };

  const inputBase = 'w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 outline-none bg-white focus:border-slate-400';

  return (
    <div className="flex flex-col gap-3 animate-in fade-in min-h-0 flex-1">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[1200] border shadow-lg rounded-lg px-4 py-2.5 text-[13px] font-semibold ${
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-800'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Encabezado + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold text-slate-900">Sucursal {ALMACEN_SUCURSAL_NOMBRE} · maestro</p>
          <p className="text-[11px] text-slate-500">Colector central: de aquí salen traspasos hacia las sucursales y aquí se concentran recepciones</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadInventario}
            disabled={loading}
            className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button
            type="button"
            onClick={() => setConfirmPurge(true)}
            disabled={purging || loading}
            className="inline-flex items-center gap-1.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50"
            title="Temporal: vacía solo stock de la sucursal Almacén"
          >
            <Trash2 size={13} /> Vaciar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors"
          >
            <Printer size={13} /> Imprimir
          </button>
          <button
            type="button"
            onClick={openAlta}
            className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1.5 rounded-md text-[11px] font-semibold hover:bg-slate-800 transition-colors"
          >
            <Plus size={13} /> Dar de alta
          </button>
        </div>
      </div>

      {/* Búsqueda + orden */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por clave, descripción o lote…"
            className="w-full border border-slate-200 rounded-md pl-8 pr-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-slate-400"
          />
        </div>
        <select
          value={selectedOrder}
          onChange={(e) => setSelectedOrder(e.target.value)}
          className="border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 outline-none bg-white"
        >
          {ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {conteoCapturado.length > 0 && (
          <button
            type="button"
            onClick={guardarConteo}
            disabled={savingConteo}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-md text-[12px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {savingConteo ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar conteo ({conteoCapturado.length})
          </button>
        )}
      </div>

      {/* Tabla estilo Excel: Existencia / Físico / Dif */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="w-full text-sm min-w-[860px] border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-10">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-36">Clave</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Descripción</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Lote</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Caducidad</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Existencia</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Físico</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-20">Dif</th>
                <th className="px-3 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-[13px] font-semibold">
                    Cargando inventario de Almacén…
                  </td>
                </tr>
              )}
              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-[13px]">
                    Sin inventario en Almacén. Usa <strong>Dar de alta</strong> o una entrada con destino <strong>Almacén</strong>.
                  </td>
                </tr>
              )}
              {!loading && visibleRows.map((row, index) => {
                const dif = getDif(row);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-[11px] text-slate-300 tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2 text-[12px] font-mono font-semibold text-slate-700 whitespace-nowrap">{row.clave || '—'}</td>
                    <td className="px-3 py-2">
                      <p className="text-[12px] font-bold text-slate-800 leading-tight">{row.descripcion}</p>
                      {row.presentacion && <p className="text-[10px] text-slate-400 mt-0.5">{row.presentacion}</p>}
                    </td>
                    <td className="px-3 py-2 text-[11px] font-mono font-semibold text-slate-600">{row.lote || '—'}</td>
                    <td className="px-3 py-2 text-center text-[11px] font-mono font-semibold text-slate-600">{formatCaducidad(row.caducidad)}</td>
                    <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-900">{formatInteger(row.existencias)}</td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={fisicoMap[row.id] ?? ''}
                        onChange={(e) => setFisicoMap((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder={String(row.existencias)}
                        className="w-20 border border-slate-200 rounded-md px-2 py-1 text-[12px] font-bold text-center tabular-nums text-slate-800 outline-none focus:border-slate-400 bg-slate-50/50 focus:bg-white"
                      />
                    </td>
                    <td className={`px-3 py-2 text-right text-[13px] font-black tabular-nums ${
                      dif === null ? 'text-slate-300' : dif === 0 ? 'text-emerald-600' : dif > 0 ? 'text-sky-600' : 'text-rose-600'
                    }`}>
                      {dif === null ? '0.0' : dif > 0 ? `+${dif}` : dif}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        title="Traspasar a otra sucursal"
                        disabled={row.existencias <= 0}
                        onClick={() => setTraspasoItem({
                          inventarioId: row.id,
                          medicamentoId: row.medicamentoId,
                          nombre: row.descripcion,
                          presentacion: row.presentacion,
                          numeroAcomodo: row.clave,
                          lote: row.lote,
                          caducidad: row.caducidad,
                          cantidadDisponible: row.existencias,
                          sucursalOrigen: ALMACEN_SUCURSAL_NOMBRE
                        })}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ArrowLeftRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length > visibleLimit && (
          <div className="shrink-0 border-t border-slate-200 p-2 flex justify-center bg-slate-50/60">
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Mostrar más ({filteredRows.length - visibleLimit} restantes)
            </button>
          </div>
        )}
      </div>

      {/* ─── Modal: Alta de medicamento ─── */}
      {showAlta && (
        <div className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-900">Dar de alta en Almacén</h3>
              <button type="button" onClick={() => setShowAlta(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">Medicamento (catálogo admin) *</span>
                {altaMed ? (
                  <div className="flex items-center justify-between gap-2 border border-emerald-200 bg-emerald-50/60 rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" /> {altaMed.nombre}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {altaMed.sustancia}{altaMed.presentacion ? ` · ${altaMed.presentacion}` : ''}{altaMed.clave ? ` · #${altaMed.clave}` : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => { setAltaMed(null); setAltaSearch(''); setTimeout(() => altaInputRef.current?.focus(), 50); }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 shrink-0">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        ref={altaInputRef}
                        type="text"
                        value={altaSearch}
                        onChange={(e) => setAltaSearch(e.target.value)}
                        placeholder="Nombre, sustancia, clave…"
                        className={`${inputBase} pl-8`}
                      />
                    </div>
                    {altaSugerencias.length > 0 && (
                      <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-md mt-1 max-h-52 overflow-y-auto z-50 shadow-lg p-1">
                        {altaSugerencias.map((m) => (
                          <div key={m.id}
                            onMouseDown={() => { setAltaMed(m); setAltaSugerencias([]); }}
                            className="px-2.5 py-2 cursor-pointer rounded hover:bg-slate-50">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[12px] font-bold text-slate-800">{m.nombre}</p>
                              {m.clave && <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shrink-0">#{m.clave}</span>}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{m.sustancia}{m.presentacion ? ` · ${m.presentacion}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">Cantidad *</span>
                  <input type="number" inputMode="numeric" min="1" value={altaForm.cantidad}
                    onChange={(e) => setAltaForm({ ...altaForm, cantidad: e.target.value })}
                    className={`${inputBase} text-center font-black`} placeholder="0" />
                </label>
                <label>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">Lote *</span>
                  <input type="text" value={altaForm.lote}
                    onChange={(e) => setAltaForm({ ...altaForm, lote: e.target.value })}
                    className={inputBase} placeholder="Lote" />
                </label>
                <label>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">Caducidad *</span>
                  <input type="date" value={altaForm.caducidad}
                    onChange={(e) => setAltaForm({ ...altaForm, caducidad: e.target.value })}
                    className={inputBase} />
                </label>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Si ya existe el mismo medicamento y lote en Almacén, la cantidad se suma. El alta queda registrada en la bitácora de entradas.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" disabled={savingAlta} onClick={() => setShowAlta(false)}
                className="px-3 py-1.5 rounded-md border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" disabled={savingAlta} onClick={guardarAlta}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50">
                {savingAlta ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {savingAlta ? 'Guardando…' : 'Dar de alta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: traspaso a otra sucursal ─── */}
      {traspasoItem && (
        <TraspasoSucursalModal
          item={traspasoItem}
          onClose={() => setTraspasoItem(null)}
          onDone={async ({ msg }) => {
            showToast(msg);
            await loadInventario();
          }}
        />
      )}

      {/* ─── Modal: confirmación de vaciado ─── */}
      {confirmPurge && (
        <div className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertTriangle size={18} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Vaciar inventario de Almacén</h3>
                <p className="text-[12px] text-slate-600 mt-1.5 leading-relaxed">
                  Se eliminarán <strong>{items.length}</strong> documentos de inventario con sucursal <strong>Almacén</strong>.
                  No toca otras sucursales ni el catálogo de medicamentos.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" disabled={purging} onClick={() => setConfirmPurge(false)}
                className="px-3 py-1.5 rounded-md border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" disabled={purging} onClick={handlePurgeAlmacen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600 text-white text-[12px] font-semibold hover:bg-rose-700 disabled:opacity-50">
                {purging ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {purging ? 'Vaciando…' : 'Sí, vaciar Almacén'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlmacenJefatura;
