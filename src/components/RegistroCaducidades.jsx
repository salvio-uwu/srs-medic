import React, { useState, useEffect } from 'react';
import {
  Save, Loader2, Plus, Trash2, AlertCircle,
  CheckCircle2, Calendar, Printer, X, Package, Pencil, CalendarX
} from 'lucide-react';
import { db } from '../config/firebase';
import {
  collection, addDoc, serverTimestamp, query, where,
  onSnapshot, updateDoc, doc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

/* ════════════════════════════════════════════════════════════════
   REGISTRO DE CADUCIDADES — Medicamentos Próximos a Caducar
   Colección Firestore: caducidades_almacen
   ════════════════════════════════════════════════════════════════ */

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const formatDateMX = (str) => {
  if (!str) return '-';
  const [y, m] = str.split('-');
  return `${MESES[Number(m) - 1]} ${y}`;
};

const RegistroCaducidades = ({ sucursal = '', embedded = false }) => {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ codigo: '', medicamento: '', cantidad: '', lote: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const sucursalActiva = sucursal || user?.sucursal || '';

  // ─── Mes activo ───
  const [mesActivo, setMesActivo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // ─── Form state ───
  const [formData, setFormData] = useState({
    codigo: '',
    medicamento: '',
    cantidad: '',
    lote: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  // ─── Realtime listener para registros de esta sucursal y mes ───
  useEffect(() => {
    if (!sucursalActiva) return;
    const q = query(
      collection(db, 'caducidades_almacen'),
      where('sucursal', '==', sucursalActiva),
      where('mesCaducidad', '==', mesActivo)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => !r.eliminado);
      docs.sort((a, b) => (a.medicamento || '').localeCompare(b.medicamento || ''));
      setRegistros(docs);
    }, (err) => {
      console.error('Error cargando caducidades:', err);
    });
    return () => unsub();
  }, [sucursalActiva, mesActivo]);

  // ─── Guardar ───
  const handleGuardar = async () => {
    if (!formData.codigo.trim()) return showToast('Ingrese el código del medicamento.', 'error');
    if (!formData.medicamento.trim()) return showToast('Ingrese el nombre del medicamento.', 'error');
    if (!formData.cantidad || Number(formData.cantidad) <= 0) return showToast('Ingrese una cantidad válida.', 'error');
    if (!formData.lote.trim()) return showToast('Ingrese el número de lote.', 'error');

    setLoading(true);
    try {
      await addDoc(collection(db, 'caducidades_almacen'), {
        codigo: formData.codigo.trim(),
        medicamento: formData.medicamento.trim().toUpperCase(),
        cantidad: Number(formData.cantidad),
        lote: formData.lote.trim().toUpperCase(),
        mesCaducidad: mesActivo,
        mesLabel: formatDateMX(mesActivo),
        sucursal: sucursalActiva,
        responsableNombre: user?.nombre || 'Sin nombre',
        responsableId: user?.uid || '',
        responsableRol: user?.rol || '',
        creadoEn: serverTimestamp()
      });
      showToast('Medicamento registrado correctamente.');
      setFormData({ codigo: '', medicamento: '', cantidad: '', lote: '' });
    } catch (err) {
      console.error('Error guardando caducidad:', err);
      showToast('Error al guardar el registro.', 'error');
    }
    setLoading(false);
  };

  // ─── Eliminar (soft delete para auditoría) ───
  const handleEliminar = async (id) => {
    try {
      await updateDoc(doc(db, 'caducidades_almacen', id), {
        eliminado: true,
        eliminadoPor: user?.nombre || 'Sin nombre',
        eliminadoPorId: user?.uid || '',
        eliminadoPorRol: user?.rol || '',
        eliminadoEn: serverTimestamp()
      });
      showToast('Registro eliminado.');
      setConfirmDelete(null);
    } catch {
      showToast('Error al eliminar.', 'error');
    }
  };

  // ─── Editar ───
  const startEdit = (reg) => {
    setEditId(reg.id);
    setEditForm({
      codigo: reg.codigo || '',
      medicamento: reg.medicamento || '',
      cantidad: String(reg.cantidad || ''),
      lote: reg.lote || ''
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ codigo: '', medicamento: '', cantidad: '', lote: '' });
  };

  const handleUpdate = async () => {
    if (!editForm.codigo.trim()) return showToast('Ingrese el código del medicamento.', 'error');
    if (!editForm.medicamento.trim()) return showToast('Ingrese el nombre del medicamento.', 'error');
    if (!editForm.cantidad || Number(editForm.cantidad) <= 0) return showToast('Ingrese una cantidad válida.', 'error');
    if (!editForm.lote.trim()) return showToast('Ingrese el número de lote.', 'error');

    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'caducidades_almacen', editId), {
        codigo: editForm.codigo.trim(),
        medicamento: editForm.medicamento.trim().toUpperCase(),
        cantidad: Number(editForm.cantidad),
        lote: editForm.lote.trim().toUpperCase(),
        actualizadoEn: serverTimestamp(),
        actualizadoPor: user?.nombre || 'Sin nombre',
        actualizadoPorId: user?.uid || '',
        actualizadoPorRol: user?.rol || ''
      });
      showToast('Registro actualizado correctamente.');
      cancelEdit();
    } catch {
      showToast('Error al actualizar el registro.', 'error');
    }
    setSavingEdit(false);
  };

  // ─── Imprimir ───
  const handlePrint = () => {
    const rows = registros.map((r, i) => `
      <tr style="${i % 2 === 0 ? '' : 'background:#f8fafc'}">
        <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;font-weight:600">${r.codigo}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px">${r.medicamento}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;text-align:center;font-weight:700">${r.cantidad}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 10px;font-size:12px;font-weight:600">${r.lote}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Caducidades ${formatDateMX(mesActivo)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}
      th{background:#1e293b;color:#fff;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid #334155}
      @media print{button{display:none!important}}</style></head><body>
      <div style="text-align:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px;color:#1e293b">MEDICAMENTO PRÓXIMO A CADUCAR</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;font-weight:600">${formatDateMX(mesActivo).toUpperCase()} — ${sucursalActiva.toUpperCase()}</p>
      </div>
      <table>
        <thead><tr><th style="text-align:left">Código</th><th style="text-align:left">Medicamento</th><th style="text-align:center">Cantidad</th><th style="text-align:left">Lote</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;font-size:10px;color:#94a3b8;text-align:right">Impreso: ${new Date().toLocaleString('es-MX')}</p>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="background:#1e293b;color:#fff;border:none;padding:10px 28px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px">Imprimir</button></div>
      </body></html>`);
    printWindow.document.close();
  };

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

      {/* ─── SELECTOR DE MES ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-sm">
            <CalendarX size={18} className="text-white"/>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">Caducidades de Almacén</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              {sucursalActiva} — {formatDateMX(mesActivo)}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              type="month"
              value={mesActivo}
              onChange={e => setMesActivo(e.target.value)}
              className="pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
            />
          </div>
          <button onClick={handlePrint} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors" title="Imprimir">
            <Printer size={15}/>
          </button>
        </div>
      </div>

      {/* ─── FORMULARIO DE CAPTURA ─── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
          <Plus size={16} className="text-blue-500"/>
          <h4 className="text-[13px] font-bold text-slate-700">Agregar Medicamento</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Código */}
          <div>
            <label className={labelBase}>Código</label>
            <input
              type="text"
              className={inputBase}
              placeholder="Código de barras del medicamento"
              value={formData.codigo}
              onChange={e => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
            />
          </div>

          {/* Medicamento */}
          <div className="sm:col-span-1 lg:col-span-1">
            <label className={labelBase}>Medicamento</label>
            <input
              type="text"
              className={inputBase}
              placeholder="Nombre completo y presentación"
              value={formData.medicamento}
              onChange={e => setFormData(prev => ({ ...prev, medicamento: e.target.value }))}
            />
          </div>

          {/* Cantidad */}
          <div>
            <label className={labelBase}>Cantidad</label>
            <input
              type="number"
              min="1"
              className={inputBase}
              placeholder="Piezas en almacén"
              value={formData.cantidad}
              onChange={e => setFormData(prev => ({ ...prev, cantidad: e.target.value }))}
            />
          </div>

          {/* Lote */}
          <div>
            <label className={labelBase}>Lote</label>
            <input
              type="text"
              className={inputBase}
              placeholder="Número de lote del fabricante"
              value={formData.lote}
              onChange={e => setFormData(prev => ({ ...prev, lote: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-slate-100">
          <button
            onClick={handleGuardar}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-sm rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            {loading ? 'Guardando...' : 'Agregar Medicamento'}
          </button>
        </div>
      </div>

      {/* ─── TABLA DE REGISTROS DEL MES ─── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-orange-500"/>
            <span className="text-[12px] font-bold text-slate-700">{formatDateMX(mesActivo)}</span>
            <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">{registros.length}</span>
          </div>
        </div>

        {registros.length === 0 ? (
          <div className="p-10 text-center">
            <Package size={28} className="text-slate-200 mx-auto mb-2"/>
            <p className="text-sm font-bold text-slate-500">Sin registros para este mes</p>
            <p className="text-xs text-slate-400 mt-1">Agregue medicamentos próximos a caducar.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Código</th>
                    <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Medicamento</th>
                    <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-center border-b border-slate-100">Cantidad</th>
                    <th className="bg-white px-4 py-2 text-[9px] uppercase tracking-wider text-slate-400 text-left border-b border-slate-100">Lote</th>
                    <th className="bg-white px-3 py-2 border-b border-slate-100 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((reg, idx) => {
                    const isEditing = editId === reg.id;
                    const inputClass = "w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-50 bg-white transition-all";

                    return (
                    <tr key={reg.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${isEditing ? 'bg-blue-50/30' : 'hover:bg-blue-50/30'} transition-colors`}>
                      {isEditing ? (
                        <>
                          <td className="px-2 py-1.5 border-b border-slate-50">
                            <input className={inputClass} value={editForm.codigo} onChange={e => setEditForm(prev => ({ ...prev, codigo: e.target.value }))} />
                          </td>
                          <td className="px-2 py-1.5 border-b border-slate-50">
                            <input className={inputClass} value={editForm.medicamento} onChange={e => setEditForm(prev => ({ ...prev, medicamento: e.target.value }))} />
                          </td>
                          <td className="px-2 py-1.5 border-b border-slate-50 text-center">
                            <input type="number" min="1" className={`${inputClass} text-center w-20`} value={editForm.cantidad} onChange={e => setEditForm(prev => ({ ...prev, cantidad: e.target.value }))} />
                          </td>
                          <td className="px-2 py-1.5 border-b border-slate-50">
                            <input className={inputClass} value={editForm.lote} onChange={e => setEditForm(prev => ({ ...prev, lote: e.target.value }))} />
                          </td>
                          <td className="px-2 py-1.5 border-b border-slate-50 text-center">
                            <div className="flex items-center gap-1">
                              <button onClick={handleUpdate} disabled={savingEdit} className="p-1 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors" title="Guardar">
                                {savingEdit ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
                              </button>
                              <button onClick={cancelEdit} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors" title="Cancelar">
                                <X size={12}/>
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 border-b border-slate-50 font-semibold text-slate-800 text-[12px]">{reg.codigo}</td>
                          <td className="px-4 py-2.5 border-b border-slate-50 text-[12px] text-slate-700">{reg.medicamento}</td>
                          <td className="px-4 py-2.5 border-b border-slate-50 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-md text-[11px] font-bold">
                              {reg.cantidad}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border-b border-slate-50 font-semibold text-slate-600 text-[12px]">{reg.lote}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-center">
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => startEdit(reg)} className="p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Editar">
                                <Pencil size={12}/>
                              </button>
                              {confirmDelete === reg.id ? (
                                <>
                                  <button onClick={() => handleEliminar(reg.id)} className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"><CheckCircle2 size={12}/></button>
                                  <button onClick={() => setConfirmDelete(null)} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"><X size={12}/></button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmDelete(reg.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12}/></button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-1.5 p-2.5">
              {registros.map((reg) => {
                const isEditing = editId === reg.id;
                const mobileInputClass = "w-full px-2 py-1.5 text-[11px] border border-slate-200 rounded-md font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-50 bg-white transition-all";

                if (isEditing) {
                  return (
                    <div key={reg.id} className="bg-blue-50/50 rounded-lg border border-blue-200 p-3">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Código</label>
                          <input className={mobileInputClass} value={editForm.codigo} onChange={e => setEditForm(prev => ({ ...prev, codigo: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Lote</label>
                          <input className={mobileInputClass} value={editForm.lote} onChange={e => setEditForm(prev => ({ ...prev, lote: e.target.value }))} />
                        </div>
                      </div>
                      <div className="mb-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Medicamento</label>
                        <input className={mobileInputClass} value={editForm.medicamento} onChange={e => setEditForm(prev => ({ ...prev, medicamento: e.target.value }))} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Cantidad</label>
                          <input type="number" min="1" className={`${mobileInputClass} text-center`} value={editForm.cantidad} onChange={e => setEditForm(prev => ({ ...prev, cantidad: e.target.value }))} />
                        </div>
                        <button onClick={handleUpdate} disabled={savingEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {savingEdit ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
                          Guardar
                        </button>
                        <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                <div key={reg.id} className="bg-white rounded-lg border border-slate-100 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{reg.medicamento}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-400 font-semibold">Cód: {reg.codigo}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Lote: {reg.lote}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-[11px] font-bold">{reg.cantidad}</span>
                  <button onClick={() => startEdit(reg)} className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Editar">
                    <Pencil size={12}/>
                  </button>
                  {confirmDelete === reg.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEliminar(reg.id)} className="p-1 rounded bg-red-100 text-red-600"><CheckCircle2 size={12}/></button>
                      <button onClick={() => setConfirmDelete(null)} className="p-1 rounded bg-slate-100 text-slate-500"><X size={12}/></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(reg.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                  )}
                </div>
              )})}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RegistroCaducidades;
