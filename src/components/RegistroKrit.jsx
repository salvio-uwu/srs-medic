import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, Loader2, Plus, Trash2, Droplets, AlertCircle,
  CheckCircle2, Calendar, User, Printer, Search, X
} from 'lucide-react';
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp, query, where,
  onSnapshot, deleteDoc, doc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

/* ════════════════════════════════════════════════════════════════
   REGISTRO KRIT — Cambio de Solución Estéril
   Colección Firestore: registros_krit
   ════════════════════════════════════════════════════════════════ */

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

const formatDateMX = (str) => {
  if (!str) return '-';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
};

const RegistroKrit = ({ sucursal = '', embedded = false }) => {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const sucursalActiva = sucursal || user?.sucursal || '';

  // ─── Form state ───
  const hoy = new Date().toLocaleDateString('en-CA');
  const [formData, setFormData] = useState({
    fecha: hoy,
    proximoCambio: addDays(hoy, 7),
    cantidadAgua: '',
    observaciones: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  // ─── Auto-calcular próximo cambio cuando cambia la fecha ───
  useEffect(() => {
    if (formData.fecha) {
      setFormData(prev => ({ ...prev, proximoCambio: addDays(prev.fecha, 7) }));
    }
  }, [formData.fecha]);

  // ─── Realtime listener para registros de esta sucursal ───
  useEffect(() => {
    if (!sucursalActiva) return;
    const q = query(
      collection(db, 'registros_krit'),
      where('sucursal', '==', sucursalActiva)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      setRegistros(docs);
    }, (err) => {
      console.error('Error cargando registros KRIT:', err);
    });
    return () => unsub();
  }, [sucursalActiva]);

  // ─── Guardar ───
  const handleGuardar = async () => {
    if (!formData.cantidadAgua) {
      return showToast('Ingrese la cantidad de agua (1Lt / 10ml KRIT).', 'error');
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'registros_krit'), {
        fecha: formData.fecha,
        fechaTimestamp: serverTimestamp(),
        proximoCambio: formData.proximoCambio,
        cantidadAgua: formData.cantidadAgua,
        observaciones: formData.observaciones || '',
        responsableNombre: user?.nombre || 'Sin nombre',
        responsableId: user?.uid || '',
        responsableRol: user?.rol || '',
        sucursal: sucursalActiva,
        estado: 'completado',
        creadoEn: serverTimestamp()
      });
      showToast('Registro KRIT guardado correctamente.');
      setFormData({
        fecha: hoy,
        proximoCambio: addDays(hoy, 7),
        cantidadAgua: '',
        observaciones: ''
      });
    } catch (err) {
      console.error('Error guardando registro KRIT:', err);
      showToast('Error al guardar el registro.', 'error');
    }
    setLoading(false);
  };

  // ─── Eliminar ───
  const handleEliminar = async (id) => {
    try {
      await deleteDoc(doc(db, 'registros_krit', id));
      showToast('Registro eliminado.');
      setConfirmDelete(null);
    } catch {
      showToast('Error al eliminar.', 'error');
    }
  };

  // ─── Próximo cambio alert ───
  const proximoCambioAlerta = useMemo(() => {
    if (registros.length === 0) return null;
    const ultimo = registros[0];
    const proximo = ultimo.proximoCambio;
    if (!proximo) return null;
    const hoyDate = new Date(hoy + 'T12:00:00');
    const proxDate = new Date(proximo + 'T12:00:00');
    const diff = Math.ceil((proxDate - hoyDate) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return { type: 'critical', msg: `¡Cambio de solución vencido! Debió realizarse el ${formatDateMX(proximo)}.` };
    if (diff <= 2) return { type: 'warning', msg: `Próximo cambio en ${diff} día${diff > 1 ? 's' : ''} (${formatDateMX(proximo)}).` };
    return null;
  }, [registros, hoy]);

  const labelBase = "text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block";
  const inputBase = "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all";

  return (
    <div className={`flex flex-col gap-5 flex-1 ${embedded ? '' : 'max-w-4xl w-full mx-auto'}`}>
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg border backdrop-blur-md ${
          toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700' : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      {/* Alerta de próximo cambio */}
      {proximoCambioAlerta && (
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border ${
          proximoCambioAlerta.type === 'critical'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <AlertCircle size={18} className="shrink-0"/>
          <p className="text-[14px] font-semibold">{proximoCambioAlerta.msg}</p>
        </div>
      )}

      {/* ─── FORMULARIO DE CAPTURA ─── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-sm">
            <Droplets size={18} className="text-white"/>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">Nuevo Registro de Cambio</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Solución Estéril KRIT</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Fecha (Hoy) */}
          <div>
            <label className={labelBase}>Fecha (Hoy)</label>
            <input
              type="date"
              className={inputBase}
              value={formData.fecha}
              onChange={e => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
            />
          </div>

          {/* Próximo Cambio (auto-calculado) */}
          <div>
            <label className={labelBase}>Próximo Cambio <span className="normal-case font-normal">(7 días)</span></label>
            <input
              type="date"
              className={`${inputBase} bg-slate-50 text-slate-500`}
              value={formData.proximoCambio}
              readOnly
            />
          </div>

          {/* Cantidad Agua */}
          <div>
            <label className={labelBase}>Cantidad Agua <span className="normal-case font-normal">(1Lt / 10ml KRIT)</span></label>
            <input
              className={`${inputBase} font-bold text-teal-700 bg-teal-50/40 border-teal-200 focus:border-teal-400`}
              placeholder="Cantidad"
              value={formData.cantidadAgua}
              onChange={e => setFormData(prev => ({ ...prev, cantidadAgua: e.target.value }))}
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className={labelBase}>Observaciones</label>
            <input
              className={inputBase}
              placeholder="Opcional..."
              value={formData.observaciones}
              onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
            />
          </div>
        </div>

        {/* Info del responsable */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          <User size={14} className="text-slate-400"/>
          <span className="text-[12px] font-semibold text-slate-500">
            Responsable: <strong className="text-slate-700">{user?.nombre || 'Sin nombre'}</strong>
          </span>
          <span className="text-[10px] text-slate-400 ml-auto">Sucursal: {sucursalActiva}</span>
        </div>

        <button
          onClick={handleGuardar}
          disabled={loading}
          className="mt-4 w-full sm:w-auto bg-slate-900 hover:bg-black text-white px-7 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all active:scale-[0.97]"
        >
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          {loading ? 'Guardando...' : 'Registrar Cambio'}
        </button>
      </div>

      {/* ─── TABLA DE REGISTROS ─── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar size={16} className="text-teal-500"/>
            <h3 className="text-[14px] font-bold text-slate-800">Historial de Cambios</h3>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{registros.length}</span>
          </div>
        </div>

        {registros.length === 0 ? (
          <div className="p-8 text-center flex-1 flex items-center justify-center flex-col">
            <Droplets size={32} className="text-slate-200 mx-auto mb-3"/>
            <p className="text-sm font-bold text-slate-500">Sin registros aún</p>
            <p className="text-xs text-slate-400 mt-1">Los registros de cambio de solución KRIT aparecerán aquí.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-auto flex-1">
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-left">Fecha</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-left">Próximo Cambio</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-center">Cantidad Agua</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-left">Responsable</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-left">Observaciones</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-3 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-center w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((reg, idx) => {
                    const isVencido = reg.proximoCambio && reg.proximoCambio < hoy;
                    return (
                      <tr key={reg.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-blue-50/40 transition-colors`}>
                        <td className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">{formatDateMX(reg.fecha)}</td>
                        <td className={`px-4 py-3 border-b border-slate-100 font-semibold ${isVencido ? 'text-red-600' : 'text-slate-600'}`}>
                          {formatDateMX(reg.proximoCambio)}
                          {isVencido && <span className="ml-1.5 text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded">VENCIDO</span>}
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100 text-center">
                          <span className="inline-flex items-center px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[13px] font-bold">
                            {reg.cantidadAgua}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100">
                          <p className="text-[13px] font-semibold text-slate-700">{reg.responsableNombre}</p>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100 text-[12px] text-slate-500 italic max-w-[180px] truncate" title={reg.observaciones}>
                          {reg.observaciones || '-'}
                        </td>
                        <td className="px-3 py-3 border-b border-slate-100 text-center">
                          {confirmDelete === reg.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEliminar(reg.id)} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors" title="Confirmar">
                                <CheckCircle2 size={14}/>
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors" title="Cancelar">
                                <X size={14}/>
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(reg.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-2 p-3 overflow-auto flex-1">
              {registros.map((reg) => {
                const isVencido = reg.proximoCambio && reg.proximoCambio < hoy;
                return (
                  <div key={reg.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-[13px] font-bold text-slate-800">{formatDateMX(reg.fecha)}</p>
                        <p className={`text-[11px] font-semibold mt-0.5 ${isVencido ? 'text-red-600' : 'text-slate-500'}`}>
                          Próximo: {formatDateMX(reg.proximoCambio)}
                          {isVencido && <span className="ml-1 text-[8px] font-black bg-red-100 px-1 py-px rounded">VENCIDO</span>}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[13px] font-bold shrink-0">
                        {reg.cantidadAgua}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-slate-400"/>
                        <span className="text-[11px] font-semibold text-slate-600">{reg.responsableNombre}</span>
                      </div>
                      <button onClick={() => confirmDelete === reg.id ? handleEliminar(reg.id) : setConfirmDelete(reg.id)}
                        className={`p-1.5 rounded-lg transition-colors ${confirmDelete === reg.id ? 'bg-red-100 text-red-600' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                    {reg.observaciones && (
                      <p className="text-[10px] text-slate-400 italic mt-2">{reg.observaciones}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RegistroKrit;
