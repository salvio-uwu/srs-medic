import React, { useState, useEffect } from 'react';
import {
  X, Plus, Trash2, Edit3, Save, Search, Stethoscope,
  Clock, Tag, FileText, AlertCircle, CheckCircle2
} from 'lucide-react';
import { db } from '../config/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSessionLocation } from '../context/SessionLocationContext';

const CATEGORIAS_PROCEDIMIENTOS = [
  'Curacion',
  'Inyectable',
  'Sutura',
  'Terapeutico',
  'Diagnostico',
  'Toma de muestra',
  'Canalizacion',
  'Nebulizacion',
  'Otro'
];

const COLORS_CATEGORIA = {
  'Curacion': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Inyectable': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  'Sutura': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  'Terapeutico': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Diagnostico': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  'Toma de muestra': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  'Canalizacion': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'Nebulizacion': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'Otro': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' }
};

const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all";

const CatalogoProcedimientosEnfermeriaModal = ({ onClose }) => {
  const { user } = useAuth();
  const { sessionSucursal } = useSessionLocation();

  const [procedimientos, setProcedimientos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // Form state
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    categoria: 'Curacion',
    descripcion: '',
    duracionMin: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  // Subscribe to catalog
  useEffect(() => {
    const q = query(collection(db, 'catalogo_procedimientos_enfermeria'), orderBy('nombre', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProcedimientos(items);
      setLoading(false);
    }, (err) => {
      setError('Error al cargar el catálogo: ' + err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtered list
  const procedimientosFiltrados = procedimientos.filter((p) => {
    const matchSearch = !searchTerm || (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro;
    return matchSearch && matchCat;
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ nombre: '', categoria: 'Curacion', descripcion: '', duracionMin: '' });
  };

  const startEdit = (proc) => {
    setEditingId(proc.id);
    setForm({
      nombre: proc.nombre || '',
      categoria: proc.categoria || 'Curacion',
      descripcion: proc.descripcion || '',
      duracionMin: String(proc.duracionMin || '')
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!form.nombre.trim()) {
      showToast('El nombre del procedimiento es requerido.', 'error');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        descripcion: (form.descripcion || '').trim(),
        duracionMin: form.duracionMin ? Number(form.duracionMin) : 0,
        activo: true,
        actualizadoPor: user?.uid || '',
        actualizadoPorNombre: user?.nombre || '',
        actualizadoAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'catalogo_procedimientos_enfermeria', editingId), payload);
        showToast('Procedimiento actualizado correctamente.');
      } else {
        await addDoc(collection(db, 'catalogo_procedimientos_enfermeria'), {
          ...payload,
          creadoPor: user?.uid || '',
          creadoPorNombre: user?.nombre || '',
          creadoAt: serverTimestamp()
        });
        showToast('Procedimiento agregado correctamente.');
      }
      resetForm();
    } catch (e) {
      setError('Error al guardar: ' + e.message);
      showToast('Error al guardar el procedimiento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (procId, procName) => {
    if (!window.confirm(`¿Eliminar el procedimiento "${procName}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, 'catalogo_procedimientos_enfermeria', procId));
      if (editingId === procId) resetForm();
      showToast('Procedimiento eliminado.');
    } catch (e) {
      showToast('Error al eliminar: ' + e.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast */}
        {toast.show && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm font-bold transition-all ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
              <Stethoscope size={18} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">Catálogo de Procedimientos</h2>
              <p className="text-[11px] text-slate-500">Enfermería — Gestiona tus procedimientos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Edit3 size={14} />
              {editingId ? 'Editar procedimiento' : 'Nuevo procedimiento'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre del procedimiento *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ej. Curación de herida quirúrgica, Canalización de vía periférica…"
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoría</label>
                <select
                  className={inputClass + ' bg-white'}
                  value={form.categoria}
                  onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                >
                  {CATEGORIAS_PROCEDIMIENTOS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duración (min)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Ej. 15"
                  min="0"
                  value={form.duracionMin}
                  onChange={(e) => setForm((p) => ({ ...p, duracionMin: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descripción / notas</label>
                <textarea
                  rows={2}
                  className={inputClass + ' resize-none'}
                  placeholder="Describe el procedimiento, preparación, indicaciones…"
                  value={form.descripcion}
                  onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                />
              </div>
            </div>
            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl py-2.5 inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Save size={14} />
                {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Agregar procedimiento'}
              </button>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl py-2.5 transition-all"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className={inputClass + ' pl-9'}
                placeholder="Buscar procedimiento…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className={inputClass + ' bg-white sm:w-48'}
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
            >
              <option value="Todas">Todas las categorías</option>
              {CATEGORIAS_PROCEDIMIENTOS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* List */}
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag size={14} />
              Procedimientos ({procedimientosFiltrados.length}{procedimientos.length !== procedimientosFiltrados.length ? ` de ${procedimientos.length}` : ''})
            </h3>

            {loading ? (
              <div className="text-center py-12 text-slate-400">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-semibold">Cargando catálogo…</p>
              </div>
            ) : procedimientosFiltrados.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
                <Stethoscope size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">Sin procedimientos</p>
                <p className="text-xs text-slate-400 mt-1">
                  {searchTerm ? 'No se encontraron resultados.' : 'Agrega tu primer procedimiento usando el formulario de arriba.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {procedimientosFiltrados.map((proc) => {
                  const catColors = COLORS_CATEGORIA[proc.categoria] || COLORS_CATEGORIA['Otro'];
                  return (
                    <div
                      key={proc.id}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                        editingId === proc.id
                          ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-100'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${catColors.bg} ${catColors.text} ${catColors.border} border`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${catColors.dot}`} />
                            {proc.categoria}
                          </span>
                          {proc.duracionMin > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                              <Clock size={10} className="text-slate-400" />
                              {proc.duracionMin} min
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-800 text-sm truncate">{proc.nombre}</p>
                        {proc.descripcion && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{proc.descripcion}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(proc)}
                          className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Editar"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(proc.id, proc.nombre)}
                          className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogoProcedimientosEnfermeriaModal;
