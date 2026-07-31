import React, { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, increment
} from 'firebase/firestore';
import { X, Loader2, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

/* ════════════════════════════════════════════════════════════════
   TRASPASO ENTRE SUCURSALES (jefatura) — con justificación.
   Crea la Salida aprobada, descuenta stock del origen y genera la
   Entrada pendiente de integración en el destino (mismo flujo que
   la aprobación de salidas en jefatura).

   item esperado: {
     nombre, lote, caducidad, cantidadDisponible, sucursalOrigen,
     medicamentoId?, inventarioId?, presentacion?, numeroAcomodo?
   }
   ════════════════════════════════════════════════════════════════ */

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const TraspasoSucursalModal = ({ item, onClose, onDone }) => {
  const { user } = useAuth();
  const nombreUsuario = user?.nombre || user?.displayName || user?.email || 'Jefatura';

  const [sucursales, setSucursales] = useState([]);
  const [destino, setDestino] = useState('');
  const [cantidad, setCantidad] = useState(item?.cantidadDisponible ? String(item.cantidadDisponible) : '');
  const [justificacion, setJustificacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'catalogo_sucursales'));
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.activo !== false)
          .sort((a, b) => (a.nombre || a.id).localeCompare(b.nombre || b.id, 'es'));
        setSucursales(items);
      } catch (err) {
        console.error('Error cargando sucursales', err);
      }
    };
    load();
  }, []);

  if (!item) return null;

  const opcionesDestino = sucursales.filter((s) =>
    normalizeText(s.nombre || s.id) !== normalizeText(item.sucursalOrigen || '')
  );

  const buscarDocInventario = async () => {
    if (item.inventarioId) return doc(db, 'inventario', item.inventarioId);

    let candidatos = [];
    if (item.medicamentoId) {
      const snap = await getDocs(query(
        collection(db, 'inventario'),
        where('medicamentoId', '==', item.medicamentoId)
      ));
      candidatos = snap.docs;
    } else {
      // Registros sin vínculo al catálogo (p. ej. caducidades manuales): buscar por sucursal y empatar por nombre
      const snap = await getDocs(query(
        collection(db, 'inventario'),
        where('sucursal', '==', item.sucursalOrigen || '')
      ));
      candidatos = snap.docs;
    }

    const target = candidatos.find((d) => {
      const data = d.data() || {};
      const mismaSucursal = normalizeText(data.sucursal || data.sucursalNombre || '') === normalizeText(item.sucursalOrigen || '');
      const mismoLote = !item.lote || String(data.lote || '') === String(item.lote || '');
      if (item.medicamentoId) return mismaSucursal && mismoLote;
      const nombreInv = normalizeText(data.medicamento || data.nombreComercial || data.descripcion || '');
      const nombreItem = normalizeText(item.nombre || '');
      const mismoNombre = nombreInv && nombreItem && (nombreInv.includes(nombreItem) || nombreItem.includes(nombreInv));
      return mismaSucursal && mismoLote && mismoNombre;
    });

    return target ? target.ref : null;
  };

  const handleTraspasar = async () => {
    setError('');
    const cant = Number(cantidad);
    if (!destino) return setError('Selecciona la sucursal destino.');
    if (!cant || cant <= 0) return setError('Ingresa una cantidad válida.');
    if (item.cantidadDisponible && cant > Number(item.cantidadDisponible)) {
      return setError(`Solo hay ${item.cantidadDisponible} disponibles en ${item.sucursalOrigen}.`);
    }
    if (justificacion.trim().length < 5) return setError('Escribe la justificación del traspaso.');

    setSaving(true);
    try {
      const fechaString = new Date().toLocaleDateString('en-CA');
      const detallesBase = {
        medicamentoId: item.medicamentoId || null,
        compuesto: item.nombre || '',
        presentacion: item.presentacion || '',
        numeroAcomodo: item.numeroAcomodo || '',
        lote: item.lote || '',
        caducidad: item.caducidad || '',
        cantidad: String(cant),
        sucursalOrigen: item.sucursalOrigen || '',
        sucursalDestino: destino,
        justificacion: justificacion.trim(),
        observaciones: `Traspaso jefatura: ${justificacion.trim()}`
      };

      // 1. Salida aprobada en el origen
      const salidaRef = await addDoc(collection(db, 'bitacoras_operativas'), {
        tipo: 'Farmacia',
        area: 'Salida',
        sucursal: item.sucursalOrigen || 'Sin asignar',
        fecha: serverTimestamp(),
        fechaString,
        responsableNombre: nombreUsuario,
        estado: 'completado',
        estadoAprobacion: 'aprobado',
        aprobadoPor: user?.uid || user?.id || null,
        aprobadoPorNombre: nombreUsuario,
        aprobadoAt: serverTimestamp(),
        justificacion: justificacion.trim(),
        detalles: { ...detallesBase, tipo_movimiento: 'Salida' }
      });

      // 2. Descontar stock del origen (si se encuentra el registro)
      let stockDescontado = false;
      try {
        const invRef = await buscarDocInventario();
        if (invRef) {
          await updateDoc(invRef, {
            stock: increment(-cant),
            existencias: increment(-cant),
            actualizadoAt: serverTimestamp(),
            actualizadoPor: nombreUsuario
          });
          stockDescontado = true;
          await updateDoc(salidaRef, { stockDescontado: true });
        }
      } catch (err) {
        console.error('No se pudo descontar stock del origen', err);
      }

      // 3. Entrada pendiente de integración en el destino
      const entradaRef = await addDoc(collection(db, 'bitacoras_operativas'), {
        tipo: 'Farmacia',
        area: 'Entrada',
        sucursal: destino,
        fecha: serverTimestamp(),
        fechaString,
        responsableNombre: nombreUsuario,
        estado: 'completado',
        estadoAprobacion: 'aprobado',
        estadoInventario: 'pendiente',
        origenRecepcionId: salidaRef.id,
        aprobadoPor: user?.uid || user?.id || null,
        aprobadoPorNombre: nombreUsuario,
        aprobadoAt: serverTimestamp(),
        justificacion: justificacion.trim(),
        detalles: { ...detallesBase, tipo_movimiento: 'Entrada', origenRecepcionId: salidaRef.id }
      });
      await updateDoc(salidaRef, { entradaGeneradaId: entradaRef.id });

      onDone?.({
        cantidad: cant,
        destino,
        stockDescontado,
        inventarioId: item.inventarioId || null,
        msg: stockDescontado
          ? `Traspaso creado: −${cant} en ${item.sucursalOrigen}, Entrada pendiente en ${destino}.`
          : `Traspaso creado hacia ${destino}. No se encontró stock en ${item.sucursalOrigen} para descontar.`
      });
      onClose();
    } catch (err) {
      console.error(err);
      setError('No se pudo crear el traspaso. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const inputBase = 'w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 outline-none bg-white focus:border-slate-400';

  return (
    <div className="fixed inset-0 z-[1150] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-slate-500" /> Traspasar a otra sucursal
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 mt-3">
          <p className="text-[12px] font-bold text-slate-800">{item.nombre}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {item.sucursalOrigen || 'Sin sucursal'}
            {item.lote ? ` · Lote ${item.lote}` : ''}
            {item.caducidad ? ` · Cad. ${String(item.caducidad).split('-').reverse().join('/')}` : ''}
            {item.cantidadDisponible ? ` · ${item.cantidadDisponible} disponibles` : ''}
          </p>
        </div>

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">Destino *</span>
              <select value={destino} onChange={(e) => setDestino(e.target.value)} className={inputBase}>
                <option value="">Seleccione…</option>
                {opcionesDestino.map((s) => (
                  <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">Cantidad *</span>
              <input
                type="number" inputMode="numeric" min="1"
                max={item.cantidadDisponible || undefined}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className={`${inputBase} text-center font-black`}
              />
            </label>
          </div>
          <label>
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mb-1">Justificación *</span>
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={3}
              placeholder="Motivo del traspaso (caducidad próxima, desabasto en destino, pedido, etc.)"
              className={`${inputBase} resize-none font-medium`}
            />
          </label>
          {error && (
            <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Se descuenta del origen y se genera una Entrada en el destino, pendiente de «Aceptar e integrar» en jefatura.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" disabled={saving} onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" disabled={saving} onClick={handleTraspasar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
            {saving ? 'Creando…' : 'Traspasar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TraspasoSucursalModal;
