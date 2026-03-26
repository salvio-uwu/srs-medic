import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit, Trash2, Check, X, Search, Download, Upload,
  AlertCircle, Pill, Eye, EyeOff, Settings, Loader
} from 'lucide-react';
import { db } from '../../config/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import ImportMedicamentosModal from './ImportMedicamentosModal';

/* ─── ESTILOS GLOBALES ─────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

  :root {
    --blue-50:  #F2F8FB;
    --blue-100: #DFF0F7;
    --blue-200: #BCE0EF;
    --blue-300: #8CCAE4;
    --blue-400: #5CB4D8;
    --blue-500: #2998C6;
    --blue-600: #0077B6;
    --blue-700: #005B8E;
    --blue-800: #00436B;
    --blue-900: #002E4C;

    --slate-50:  #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --slate-900: #0f172a;

    --emerald-500: #059669;
    --red-500: #ef4444;
    --orange-500: #f97316;
    --yellow-400: #facc15;
  }
`;

// ── CONSTANTES ──
const INITIAL_FORM = {
  nombreComercial: '',
  marca: '',
  laboratorio: '',
  sustanciasActivas: '',
  presentacion: '',
  dosis: '',
  numeroAcomodo: '',
  indicacion: '',
  opcion2: '',
  advertencia: '',
  embarazo: '',
  nivelUtilidad: 3,
  color: '#0077B6',
  controlado: false,
  activo: true
};

const NIVEL_COLORS = {
  1: { label: '1 - Crítico', color: '#dc2626', bg: 'bg-red-50', text: 'text-red-700' },
  2: { label: '2 - Alto', color: '#ea580c', bg: 'bg-orange-50', text: 'text-orange-700' },
  3: { label: '3 - Medio', color: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  4: { label: '4 - Bajo', color: '#16a34a', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  5: { label: '5 - Mínimo', color: '#0ea5e9', bg: 'bg-blue-50', text: 'text-blue-700' }
};

const REQUIRED_FIELDS = [
  { key: 'nombreComercial', label: 'Nombre Comercial' },
  { key: 'marca', label: 'Marca' },
  { key: 'laboratorio', label: 'Laboratorio' },
  { key: 'sustanciasActivas', label: 'Sustancia Activa' },
  { key: 'presentacion', label: 'Presentación' },
  { key: 'dosis', label: 'Dosis' },
  { key: 'numeroAcomodo', label: 'Número de Acomodo' },
  { key: 'indicacion', label: 'Indicación' },
  { key: 'advertencia', label: 'Advertencia' },
  { key: 'embarazo', label: 'Embarazo' }
];

export default function CatalogomedicamentosView() {
  const { user } = useAuth();

  // ── ESTADO ──
  const [medicamentos, setMedicamentos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState('');
  const [filterNivel, setFilterNivel] = useState('all');
  const [filterLab, setFilterLab] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // ── FIREBASE SYNC ──
  useEffect(() => {
    const q = query(
      collection(db, 'catalogo_medicamentos'),
      orderBy('nombreComercial', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setMedicamentos(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ── CÁLCULOS ──
  const laboratorios = useMemo(
    () => [...new Set(medicamentos.map((m) => m.laboratorio).filter(Boolean))].sort(),
    [medicamentos]
  );

  const filteredMedicamentos = useMemo(() => {
    const searchLower = search.toLowerCase();
    return medicamentos.filter((m) => {
      // Búsqueda multifield
      const matchesSearch =
        !searchLower ||
        `${m.nombreComercial || ''} ${m.marca || ''} ${m.sustanciasActivas || ''} ${m.laboratorio || ''}`
          .toLowerCase()
          .includes(searchLower);

      // Filtro de nivel
      if (filterNivel !== 'all' && m.nivelUtilidad !== Number(filterNivel)) return false;

      // Filtro de laboratorio
      if (filterLab !== 'all' && m.laboratorio !== filterLab) return false;

      // Filtro de estado
      if (filterEstado === 'activo' && m.activo === false) return false;
      if (filterEstado === 'inactivo' && m.activo !== false) return false;

      return matchesSearch;
    });
  }, [medicamentos, search, filterNivel, filterLab, filterEstado]);

  // ── HANDLERS ──
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validate = () => {
    const missing = REQUIRED_FIELDS.filter(({ key }) => !String(form[key] || '').trim());
    if (missing.length > 0) {
      setError(`Campos requeridos: ${missing.map((f) => f.label).join(', ')}`);
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        nombreComercial: form.nombreComercial.trim(),
        marca: form.marca.trim(),
        laboratorio: form.laboratorio.trim(),
        sustanciasActivas: form.sustanciasActivas.trim(),
        presentacion: form.presentacion.trim(),
        dosis: form.dosis.trim(),
        numeroAcomodo: form.numeroAcomodo.trim(),
        indicacion: form.indicacion.trim(),
        opcion2: form.opcion2.trim(),
        advertencia: form.advertencia.trim(),
        embarazo: form.embarazo.trim(),
        nivelUtilidad: Number(form.nivelUtilidad),
        color: form.color,
        controlado: form.controlado,
        activo: form.activo,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'sistema',
        updatedByName: user?.displayName || 'Sistema'
      };

      if (editingId) {
        await updateDoc(doc(db, 'catalogo_medicamentos', editingId), payload);
        setSuccess('Medicamento actualizado ✓');
      } else {
        await addDoc(collection(db, 'catalogo_medicamentos'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || 'sistema',
          createdByName: user?.displayName || 'Sistema'
        });
        setSuccess('Medicamento creado ✓');
      }

      setTimeout(() => {
        resetForm();
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (med) => {
    setEditingId(med.id);
    setForm({
      nombreComercial: med.nombreComercial || '',
      marca: med.marca || '',
      laboratorio: med.laboratorio || '',
      sustanciasActivas: med.sustanciasActivas || '',
      presentacion: med.presentacion || '',
      dosis: med.dosis || '',
      numeroAcomodo: med.numeroAcomodo || '',
      indicacion: med.indicacion || '',
      opcion2: med.opcion2 || '',
      advertencia: med.advertencia || '',
      embarazo: med.embarazo || '',
      nivelUtilidad: med.nivelUtilidad || 3,
      color: med.color || '#0077B6',
      controlado: med.controlado || false,
      activo: med.activo !== false
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro? Se marcará como inactivo.')) return;
    try {
      await updateDoc(doc(db, 'catalogo_medicamentos', id), {
        activo: false,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'sistema'
      });
      setSuccess('Medicamento desactivado ✓');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(`Error: ${err.message}`);
    }
  };

  const handleToggleActivo = async (id, current) => {
    try {
      await updateDoc(doc(db, 'catalogo_medicamentos', id), {
        activo: !current,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'sistema'
      });
    } catch (err) {
      setError(`Error: ${err.message}`);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setShowForm(false);
    setError('');
  };

  const handleClearFilters = () => {
    setSearch('');
    setFilterNivel('all');
    setFilterLab('all');
    setFilterEstado('all');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{STYLES}</style>

      {/* ── DRAWER OVERLAY ── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          onClick={resetForm}
        />
      )}

      {/* ── DRAWER PANEL ── */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          showForm ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Pill size={18} className="text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {editingId ? 'Editar Medicamento' : 'Nuevo Medicamento'}
            </h2>
          </div>
          <button
            onClick={resetForm}
            className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2 text-sm shrink-0">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2 text-sm shrink-0">
            <Check size={15} />
            {success}
          </div>
        )}

        {/* Drawer form (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="med-form" onSubmit={handleSave} className="space-y-4">
            {/* Fila 1: Nombre Comercial */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Nombre Comercial *</label>
              <input
                type="text"
                name="nombreComercial"
                value={form.nombreComercial}
                onChange={handleInputChange}
                placeholder="Ej: Amoxicilina"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Fila 2: Marca + Laboratorio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Marca *</label>
                <input
                  type="text"
                  name="marca"
                  value={form.marca}
                  onChange={handleInputChange}
                  placeholder="Ej: Pfizer"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Laboratorio *</label>
                <input
                  type="text"
                  name="laboratorio"
                  value={form.laboratorio}
                  onChange={handleInputChange}
                  placeholder="Ej: Pfizer Inc"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Sustancia Activa */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Sustancia Activa *</label>
              <textarea
                name="sustanciasActivas"
                value={form.sustanciasActivas}
                onChange={handleInputChange}
                placeholder="Ej: Amoxicilina trihidratada 500mg"
                rows="2"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>

            {/* Fila 3: Presentación + Dosis */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Presentación *</label>
                <input
                  type="text"
                  name="presentacion"
                  value={form.presentacion}
                  onChange={handleInputChange}
                  placeholder="Ej: Comprimido"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Dosis *</label>
                <input
                  type="text"
                  name="dosis"
                  value={form.dosis}
                  onChange={handleInputChange}
                  placeholder="Ej: 500mg c/8h"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Fila 4: N° Acomodo + Opción 2 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">N° Acomodo *</label>
                <input
                  type="text"
                  name="numeroAcomodo"
                  value={form.numeroAcomodo}
                  onChange={handleInputChange}
                  placeholder="Ej: A-01-B2"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Opción 2 (Opcional)</label>
                <input
                  type="text"
                  name="opcion2"
                  value={form.opcion2}
                  onChange={handleInputChange}
                  placeholder="Campo flexible"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Indicación */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Indicación *</label>
              <textarea
                name="indicacion"
                value={form.indicacion}
                onChange={handleInputChange}
                placeholder="Para qué sirve..."
                rows="2"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>

            {/* Advertencia */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Advertencia *</label>
              <textarea
                name="advertencia"
                value={form.advertencia}
                onChange={handleInputChange}
                placeholder="Contraindicaciones..."
                rows="2"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>

            {/* Embarazo */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Riesgo en Embarazo *</label>
              <textarea
                name="embarazo"
                value={form.embarazo}
                onChange={handleInputChange}
                placeholder="Categoría de riesgo en embarazo..."
                rows="2"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>

            {/* Fila 5: Nivel + Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nivel de Utilidad *</label>
                <select
                  name="nivelUtilidad"
                  value={form.nivelUtilidad}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {Object.entries(NIVEL_COLORS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Color ID</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    name="color"
                    value={form.color}
                    onChange={handleInputChange}
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <span className="text-xs text-slate-500 font-mono">{form.color}</span>
                </div>
              </div>
            </div>

            {/* Controlado */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="controlado"
                name="controlado"
                checked={form.controlado}
                onChange={handleInputChange}
                className="w-4 h-4 rounded border-slate-300 accent-blue-600"
              />
              <label htmlFor="controlado" className="text-sm font-medium text-slate-700">
                Medicamento controlado
              </label>
            </div>
          </form>
        </div>

        {/* Drawer footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            type="submit"
            form="med-form"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
            {editingId ? 'Actualizar' : 'Crear medicamento'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2.5 bg-white text-slate-700 rounded-lg font-semibold border border-slate-200 hover:bg-slate-100 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
              <Pill size={22} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Catálogo de Medicamentos</h1>
              <p className="text-sm text-slate-500">Gestiona el catálogo global de medicamentos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 bg-white text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold flex items-center gap-2 transition-all text-sm"
            >
              <Upload size={15} />
              Importar Excel
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 transition-all text-sm shadow-sm"
            >
              <Plus size={15} />
              Nuevo medicamento
            </button>
          </div>
        </div>

        {/* Toast messages (página, no drawer) */}
        {!showForm && success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2 text-sm">
            <Check size={15} />
            {success}
          </div>
        )}

        {/* Barra de filtros */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-wrap gap-3">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, marca, sustancia activa o laboratorio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Nivel */}
            <select
              value={filterNivel}
              onChange={(e) => setFilterNivel(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="all">Todos los niveles</option>
              {Object.entries(NIVEL_COLORS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* Laboratorio */}
            <select
              value={filterLab}
              onChange={(e) => setFilterLab(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white max-w-[180px]"
            >
              <option value="all">Todos los laboratorios</option>
              {laboratorios.map((lab) => (
                <option key={lab} value={lab}>{lab}</option>
              ))}
            </select>

            {/* Estado */}
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="all">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>

            {/* Limpiar */}
            {(search || filterNivel !== 'all' || filterLab !== 'all' || filterEstado !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <X size={14} />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">
            <span className="text-slate-800 font-bold">{filteredMedicamentos.length}</span> medicamento(s)
            {search && <span className="text-blue-600"> · "{search}"</span>}
            {filterNivel !== 'all' && <span> · Nivel {filterNivel}</span>}
            {filterLab !== 'all' && <span> · {filterLab}</span>}
            {filterEstado !== 'all' && <span> · {filterEstado === 'activo' ? 'Activos' : 'Inactivos'}</span>}
          </p>
          <p className="text-xs text-slate-400">{medicamentos.length} en total</p>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {loading ? (
            <div className="p-12 text-center">
              <Loader className="animate-spin mx-auto text-blue-500 mb-3" size={28} />
              <p className="text-slate-500 text-sm">Cargando medicamentos...</p>
            </div>
          ) : filteredMedicamentos.length === 0 ? (
            <div className="p-12 text-center">
              <Pill size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-semibold">No hay medicamentos</p>
              <p className="text-xs text-slate-400 mt-1">Crea uno nuevo o ajusta los filtros</p>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                + Nuevo medicamento
              </button>
            </div>
          ) : (
            <table className="w-full text-xs table-fixed">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide w-8">#</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide w-[22%]">Medicamento</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide w-[13%]">Marca</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide w-[14%]">Laboratorio</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide w-[12%]">Presentación</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide w-[10%]">Dosis</th>
                  <th className="px-2 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide w-[11%]">Nivel</th>
                  <th className="px-2 py-2 text-center font-semibold text-slate-400 uppercase tracking-wide w-[10%]">Estado</th>
                  <th className="px-2 py-2 text-right font-semibold text-slate-400 uppercase tracking-wide w-16">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMedicamentos.map((med, idx) => {
                  const nivel = NIVEL_COLORS[med.nivelUtilidad] || NIVEL_COLORS[3];
                  const isActive = med.activo !== false;
                  return (
                    <tr key={med.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-2 py-1.5 text-slate-300 font-medium tabular-nums">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: med.color || '#0077B6' }}
                          />
                          <span className="font-semibold text-slate-800 truncate">{med.nombreComercial}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 truncate">{med.marca}</td>
                      <td className="px-2 py-1.5 text-slate-500 truncate">{med.laboratorio}</td>
                      <td className="px-2 py-1.5 text-slate-500 truncate">{med.presentacion}</td>
                      <td className="px-2 py-1.5 text-slate-500 truncate">{med.dosis}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold ${nivel.bg} ${nivel.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: nivel.color }} />
                          {nivel.label}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => handleToggleActivo(med.id, isActive)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold transition-all ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {isActive ? <Eye size={10} /> : <EyeOff size={10} />}
                          {isActive ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(med)}
                            className="p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(med.id)}
                            className="p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded transition-colors"
                            title="Desactivar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportMedicamentosModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            setShowImportModal(false);
            setSuccess('Medicamentos importados ✓');
            setTimeout(() => setSuccess(''), 2000);
          }}
        />
      )}
    </div>
  );
}
