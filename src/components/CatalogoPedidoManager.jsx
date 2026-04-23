import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, Save, Loader2, Search, X, Tag, Palette,
  ChevronDown, Check, AlertCircle, CheckCircle2, Package, GripVertical
} from 'lucide-react';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';

const COLORES_PRESET = [
  { id: 'rose', label: 'Rosa', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', dot: 'bg-rose-500' },
  { id: 'lime', label: 'Verde', bg: 'bg-lime-100', text: 'text-lime-900', border: 'border-lime-300', dot: 'bg-lime-500' },
  { id: 'blue', label: 'Azul', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
  { id: 'amber', label: 'Ámbar', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' },
  { id: 'violet', label: 'Violeta', bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', dot: 'bg-violet-500' },
  { id: 'cyan', label: 'Cian', bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', dot: 'bg-cyan-500' },
  { id: 'orange', label: 'Naranja', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' },
  { id: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  { id: 'pink', label: 'Rosa fuerte', bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', dot: 'bg-pink-500' },
  { id: 'slate', label: 'Gris', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', dot: 'bg-slate-500' },
];

const getColorClasses = (colorId) => COLORES_PRESET.find(c => c.id === colorId) || COLORES_PRESET[0];

const DEFAULT_CATEGORIES = [
  { nombre: 'Medicamento', color: 'rose' },
  { nombre: 'Insumo', color: 'lime' },
];

const normalizeText = (value) =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const CatalogoPedidoManager = () => {
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('todas');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newItem, setNewItem] = useState({ nombre: '', categoria: 'Medicamento' });
  const [newCat, setNewCat] = useState({ nombre: '', color: 'blue' });
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const toastTimer = useRef(null);

  const showToastMsg = (msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ show: true, msg, type });
    toastTimer.current = setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3500);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Load categories
        const catSnap = await getDocs(collection(db, 'catalogo_categorias_pedido'));
        let cats = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (cats.length === 0) {
          // seed defaults
          const batch = writeBatch(db);
          const seeded = [];
          for (const dc of DEFAULT_CATEGORIES) {
            const ref = doc(collection(db, 'catalogo_categorias_pedido'));
            batch.set(ref, { ...dc, activo: true, orden: seeded.length + 1 });
            seeded.push({ id: ref.id, ...dc, activo: true, orden: seeded.length + 1 });
          }
          await batch.commit();
          cats = seeded;
        }
        setCategorias(cats.sort((a, b) => (a.orden || 0) - (b.orden || 0)));

        // Load items
        const itemSnap = await getDocs(collection(db, 'catalogo_pedido_medicamentos'));
        const rows = itemSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.activo !== false);
        rows.sort((a, b) => (a.orden || 0) - (b.orden || 0) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
        setItems(rows);
      } catch (e) {
        console.error('Error loading catalog:', e);
        showToastMsg('Error cargando catálogo', 'error');
      }
      setLoading(false);
    };
    load();
  }, []);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterCat !== 'todas') result = result.filter(i => i.categoria === filterCat);
    const term = normalizeText(search);
    if (term) result = result.filter(i => normalizeText(i.nombre).includes(term));
    return result;
  }, [items, filterCat, search]);

  // Add single item
  const handleAddItem = async () => {
    const nombre = newItem.nombre.trim().toUpperCase();
    if (!nombre) return showToastMsg('Ingresa el nombre del insumo', 'error');
    if (items.some(i => normalizeText(i.nombre) === normalizeText(nombre))) return showToastMsg('Ya existe un insumo con ese nombre', 'error');

    setSaving(true);
    try {
      const data = { nombre, categoria: newItem.categoria, activo: true, orden: items.length + 1 };
      const ref = await addDoc(collection(db, 'catalogo_pedido_medicamentos'), data);
      setItems(prev => [...prev, { id: ref.id, ...data }]);
      setNewItem({ nombre: '', categoria: newItem.categoria });
      showToastMsg(`${nombre} agregado`);
    } catch {
      showToastMsg('Error al guardar', 'error');
    }
    setSaving(false);
  };

  // Bulk add
  const handleBulkAdd = async () => {
    const lines = bulkText.split('\n').map(l => l.trim().toUpperCase()).filter(Boolean);
    if (lines.length === 0) return showToastMsg('Pega una lista (un insumo por línea)', 'error');

    const existingNames = new Set(items.map(i => normalizeText(i.nombre)));
    const newLines = lines.filter(l => !existingNames.has(normalizeText(l)));
    if (newLines.length === 0) return showToastMsg('Todos los insumos ya existen', 'error');

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const added = [];
      newLines.forEach((nombre, idx) => {
        const ref = doc(collection(db, 'catalogo_pedido_medicamentos'));
        const data = { nombre, categoria: newItem.categoria, activo: true, orden: items.length + idx + 1 };
        batch.set(ref, data);
        added.push({ id: ref.id, ...data });
      });
      await batch.commit();
      setItems(prev => [...prev, ...added]);
      setBulkText('');
      setShowBulk(false);
      showToastMsg(`${added.length} insumos agregados`);
    } catch {
      showToastMsg('Error al guardar en lote', 'error');
    }
    setSaving(false);
  };

  // Delete item
  const handleDeleteItem = async (id) => {
    try {
      await updateDoc(doc(db, 'catalogo_pedido_medicamentos', id), { activo: false });
      setItems(prev => prev.filter(i => i.id !== id));
      setDeleteConfirm(null);
      showToastMsg('Insumo eliminado');
    } catch {
      showToastMsg('Error al eliminar', 'error');
    }
  };

  // Add category
  const handleAddCategory = async () => {
    const nombre = newCat.nombre.trim();
    if (!nombre) return showToastMsg('Nombre de categoría requerido', 'error');
    if (categorias.some(c => normalizeText(c.nombre) === normalizeText(nombre))) return showToastMsg('Categoría ya existe', 'error');

    setSaving(true);
    try {
      const data = { nombre, color: newCat.color, activo: true, orden: categorias.length + 1 };
      const ref = await addDoc(collection(db, 'catalogo_categorias_pedido'), data);
      setCategorias(prev => [...prev, { id: ref.id, ...data }]);
      setNewCat({ nombre: '', color: 'blue' });
      setShowAddCat(false);
      showToastMsg(`Categoría "${nombre}" creada`);
    } catch {
      showToastMsg('Error al crear categoría', 'error');
    }
    setSaving(false);
  };

  // Delete category
  const handleDeleteCategory = async (catId, catNombre) => {
    const itemsInCat = items.filter(i => i.categoria === catNombre);
    if (itemsInCat.length > 0) return showToastMsg(`No se puede eliminar: ${itemsInCat.length} insumos usan esta categoría`, 'error');
    try {
      await deleteDoc(doc(db, 'catalogo_categorias_pedido', catId));
      setCategorias(prev => prev.filter(c => c.id !== catId));
      showToastMsg('Categoría eliminada');
    } catch {
      showToastMsg('Error al eliminar categoría', 'error');
    }
  };

  const getCatColor = (catNombre) => {
    const cat = categorias.find(c => c.nombre === catNombre);
    return getColorClasses(cat?.color || 'slate');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 pr-2">
      {toast.show && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg border backdrop-blur-md ${
          toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700' : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* LEFT: Categories */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Tag size={14} className="text-violet-500" /> Categorías
              </h3>
              <button onClick={() => setShowAddCat(!showAddCat)} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                <Plus size={16} />
              </button>
            </div>

            {showAddCat && (
              <div className="px-4 py-3 border-b border-slate-100 bg-violet-50/30 space-y-3">
                <input
                  value={newCat.nombre}
                  onChange={e => setNewCat({ ...newCat, nombre: e.target.value })}
                  placeholder="Nombre de categoría"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-50"
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Color</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORES_PRESET.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setNewCat({ ...newCat, color: c.id })}
                        className={`w-7 h-7 rounded-lg ${c.dot} transition-all ${newCat.color === c.id ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'opacity-60 hover:opacity-100'}`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddCategory} disabled={saving} className="flex-1 bg-violet-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-violet-700 transition-colors disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Crear'}
                  </button>
                  <button onClick={() => setShowAddCat(false)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 space-y-1">
              {categorias.map(cat => {
                const color = getColorClasses(cat.color);
                const count = items.filter(i => i.categoria === cat.nombre).length;
                return (
                  <div key={cat.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 group transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${color.dot}`} />
                      <span className="text-sm font-semibold text-slate-700">{cat.nombre}</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{count}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.nombre)}
                      className="p-1 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Eliminar categoría"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              {categorias.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Sin categorías</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Items */}
        <div className="xl:col-span-3 space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all"
                    placeholder="Buscar insumo..."
                  />
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setFilterCat('todas')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${filterCat === 'todas' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    Todas
                  </button>
                  {categorias.map(cat => {
                    const color = getColorClasses(cat.color);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setFilterCat(filterCat === cat.nombre ? 'todas' : cat.nombre)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 ${
                          filterCat === cat.nombre ? `${color.bg} ${color.text} ${color.border} border` : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                        {cat.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowBulk(!showBulk)} className="px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  Alta masiva
                </button>
                <button onClick={() => setShowAddItem(!showAddItem)} className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors active:scale-[0.97]">
                  <Plus size={14} /> Agregar
                </button>
              </div>
            </div>
          </div>

          {/* Add single item */}
          {showAddItem && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm px-5 py-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Nuevo insumo</p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nombre</label>
                  <input
                    value={newItem.nombre}
                    onChange={e => setNewItem({ ...newItem, nombre: e.target.value })}
                    placeholder="Ej: PARACETAMOL 500MG"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                  />
                </div>
                <div className="w-48">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Categoría</label>
                  <div className="relative">
                    <select
                      value={newItem.categoria}
                      onChange={e => setNewItem({ ...newItem, categoria: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold appearance-none cursor-pointer outline-none focus:border-blue-400"
                    >
                      {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <button onClick={handleAddItem} disabled={saving} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Agregar'}
                </button>
                <button onClick={() => setShowAddItem(false)} className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Bulk add */}
          {showBulk && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm px-5 py-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Alta masiva</p>
              <p className="text-[11px] text-slate-400 mb-3">Pega una lista de insumos (uno por línea). Se asignarán a la categoría seleccionada.</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={"PARACETAMOL 500MG\nIBUPROFENO 400MG\nGUANTES DE LATEX\n..."}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 h-32 resize-none font-mono"
                  />
                </div>
                <div className="w-48 flex flex-col gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Categoría</label>
                    <div className="relative">
                      <select
                        value={newItem.categoria}
                        onChange={e => setNewItem({ ...newItem, categoria: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold appearance-none cursor-pointer outline-none"
                      >
                        {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <button onClick={handleBulkAdd} disabled={saving} className="bg-amber-600 text-white px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 mt-auto">
                    {saving ? 'Guardando...' : `Agregar lista`}
                  </button>
                  <button onClick={() => { setShowBulk(false); setBulkText(''); }} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-left w-12">#</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-left">Nombre del insumo</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-left w-40">Categoría</th>
                    <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 text-center w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const color = getCatColor(item.categoria);
                    return (
                      <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors group`}>
                        <td className="px-4 py-2 border-b border-slate-100 text-[11px] text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2 border-b border-slate-100">
                          <span className="text-[13px] font-semibold text-slate-800">{item.nombre}</span>
                        </td>
                        <td className="px-4 py-2 border-b border-slate-100">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${color.bg} ${color.text} ${color.border}`}>
                            {item.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-2 border-b border-slate-100 text-center">
                          {deleteConfirm === item.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleDeleteItem(item.id)} className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700">Sí</button>
                              <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-300">No</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Package size={32} className="mb-3 opacity-40" />
                  <p className="text-sm font-bold">{search || filterCat !== 'todas' ? 'Sin resultados para el filtro' : 'Catálogo vacío'}</p>
                  <p className="text-xs mt-1">
                    {search || filterCat !== 'todas' ? 'Intenta con otro término' : 'Agrega insumos con el botón "Agregar" o "Alta masiva"'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">
                {filteredItems.length} de {items.length} insumos • <strong className="text-slate-600">Catálogo global</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogoPedidoManager;
