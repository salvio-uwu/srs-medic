import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, ChevronDown, ChevronLeft, ChevronRight, Edit3,
  Plus, RefreshCcw, Save, Search, ShieldAlert, Trash2, X
} from 'lucide-react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, where,
  serverTimestamp, setDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';

/* ─── constants ─── */
const PAGE_SIZE = 30;

const EMPTY_FORM = {
  color: '#eab308', medicamento: '', grupo: '', sustanciaActiva: '',
  numeroAcomodo: '', presentacion: '', dosis: '', indicacion: '',
  opcion2: '', advertencia: '', embarazo: '', nivel: 3, activo: true,
  consultoriosIds: [], medicosBloqueadosIds: [],
};

const NIVEL_COLORS = {
  1: '#3b82f6', 2: '#10b981', 3: '#eab308', 4: '#f97316', 5: '#ef4444',
};

const NIVEL_LABELS = {
  1: 'Azul', 2: 'Verde', 3: 'Amarillo', 4: 'Naranja', 5: 'Rojo',
};

const ALLOWED_COLORS = [
  { hex: '#3b82f6', name: 'Azul' },
  { hex: '#10b981', name: 'Verde' },
  { hex: '#eab308', name: 'Amarillo' },
  { hex: '#f97316', name: 'Naranja' },
  { hex: '#ef4444', name: 'Rojo' },
];

const colorByNivel = (nivel) => NIVEL_COLORS[nivel] || '#3b82f6';

const inferLevelFromGroup = (grupo = '') => {
  const m = String(grupo).match(/([1-5])\s*$/);
  const n = Number(m?.[1] || 0);
  return [1, 2, 3, 4, 5].includes(n) ? n : 3;
};

const resolveNivel = (data = {}, grupo = '') => {
  const fromNivel = Number(data.nivel);
  const fromUtilidad = Number(data.nivelUtilidad);
  const inferred = inferLevelFromGroup(grupo);
  const hasNivel = [1, 2, 3, 4, 5].includes(fromNivel);
  const hasUtilidad = [1, 2, 3, 4, 5].includes(fromUtilidad);

  if (hasNivel && fromNivel !== 3) return fromNivel;
  if (hasUtilidad && fromUtilidad !== 3) return fromUtilidad;
  if (inferred !== 3) return inferred;
  if (hasNivel) return fromNivel;
  if (hasUtilidad) return fromUtilidad;
  return 3;
};

const resolveUser = () => {
  try {
    const raw = localStorage.getItem('meditech_user');
    if (!raw) return { uid: 'system', nombre: 'Sistema' };
    const p = JSON.parse(raw);
    return { uid: p.uid || p.id || 'system', nombre: p.nombre || p.email || 'Admin' };
  } catch { return { uid: 'system', nombre: 'Sistema' }; }
};

/* ─── normalize from Firestore ─── */
const normalize = (id, d = {}) => {
  const med = d.medicamento || d.nombreComercial || d['*NOMBRE COMERCIAL'] || '';
  const grp = d.grupo || d.marca || d['*MARCA'] || '';
  const sa  = d.sustanciaActiva || d.sustanciasActivas || d['*SUSTANCIA(S) ACTIVA(S)'] || '';
  const pres = d.presentacion || d['*PRESENTACION'] || d['*PRESENTACIÓN'] || '';
  const dos = d.dosis || d.DOSIS || '';
  const ind = d.indicacion || d.INDICACION || '';
  const op2 = d.opcion2 || d['OPCION 2'] || '';
  const adv = d.advertencia || d['ADVERTENCIA '] || '';
  const emb = d.embarazo || d.EMBARAZO || '';
  const na  = d.numeroAcomodo || d['NUMERO ACOMODO'] || d['NUMERO DE ACOMODO'] || '';
  const niv = resolveNivel(d, grp);
  return {
    id, medicamento: med, grupo: grp, sustanciaActiva: sa, numeroAcomodo: na,
    presentacion: pres, dosis: dos, indicacion: ind, opcion2: op2,
    advertencia: adv, embarazo: emb, color: colorByNivel(niv), nivel: niv,
    activo: d.activo !== false,
    consultoriosIds: Array.isArray(d.consultoriosIds) ? d.consultoriosIds : [],
    medicosBloqueadosIds: Array.isArray(d.medicosBloqueadosIds) ? d.medicosBloqueadosIds : [],
  };
};

/* ─── build payload for Firestore ─── */
const buildPayload = (f, user) => ({
  medicamento: f.medicamento.trim(),
  medicamentoLower: f.medicamento.trim().toLowerCase(),
  grupo: f.grupo.trim(),
  sustanciaActiva: f.sustanciaActiva.trim(),
  numeroAcomodo: (f.numeroAcomodo || '').trim(),
  presentacion: f.presentacion.trim(),
  dosis: f.dosis.trim(),
  indicacion: (f.indicacion || '').trim(),
  opcion2: (f.opcion2 || '').trim(),
  advertencia: (f.advertencia || '').trim(),
  embarazo: (f.embarazo || '').trim(),
  color: colorByNivel(Number(f.nivel) || 3),
  nivel: Number(f.nivel) || 3,
  activo: !!f.activo,
  consultoriosIds: Array.isArray(f.consultoriosIds) ? f.consultoriosIds : [],
  medicosBloqueadosIds: Array.isArray(f.medicosBloqueadosIds) ? f.medicosBloqueadosIds : [],
  // backward-compat
  nombreComercial: f.medicamento.trim(),
  nombreComercialLower: f.medicamento.trim().toLowerCase(),
  marca: f.grupo.trim(),
  sustanciasActivas: f.sustanciaActiva.trim(),
  nivelUtilidad: Number(f.nivel) || 3,
  '*NOMBRE COMERCIAL': f.medicamento.trim(),
  '*MARCA': f.grupo.trim(),
  '*SUSTANCIA(S) ACTIVA(S)': f.sustanciaActiva.trim(),
  '*PRESENTACIÓN': f.presentacion.trim(),
  '*PRESENTACION': f.presentacion.trim(),
  DOSIS: f.dosis.trim(),
  INDICACION: (f.indicacion || '').trim(),
  'OPCION 2': (f.opcion2 || '').trim(),
  'ADVERTENCIA ': (f.advertencia || '').trim(),
  EMBARAZO: (f.embarazo || '').trim(),
  updatedAt: serverTimestamp(),
  updatedBy: user.uid,
  updatedByName: user.nombre,
});

const trunc = (s, n = 20) => (!s ? '—' : s.length > n ? s.slice(0, n) + '…' : s);

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const Inventario = () => {
  /* ── state ── */
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [nivelFilter, setNivelFilter] = useState(0);
  const [estadoFilter, setEstadoFilter] = useState('todos');

  // pagination
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // modal create/edit
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);

  // row selection → side panel
  const [selectedMed, setSelectedMed] = useState(null);

  // delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  // modal tab + access control catalogs
  const [modalTab, setModalTab] = useState('general');
  const [consultorios, setConsultorios] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [accessSearch, setAccessSearch] = useState('');


  /* ── fetch ALL then paginate client-side ── */
  const allDocsRef = useRef([]);

  const fetchPage = useCallback(async (reset = false) => {
    setLoading(true);
    setError('');
    try {
      if (reset) {
        const colRef = collection(db, 'catalogo_medicamentos');
        const snap = await getDocs(colRef);
        const rows = snap.docs.map(d => normalize(d.id, d.data()));
        rows.sort((a, b) => {
          const na = parseInt(a.numeroAcomodo, 10);
          const nb = parseInt(b.numeroAcomodo, 10);
          const aNum = isNaN(na) ? Infinity : na;
          const bNum = isNaN(nb) ? Infinity : nb;
          if (aNum !== bNum) return aNum - bNum;
          return a.medicamento.localeCompare(b.medicamento, 'es');
        });
        allDocsRef.current = rows;
        setTotalCount(rows.length);
        setPage(1);
      }
      const start = ((reset ? 1 : page) - 1) * PAGE_SIZE;
      const slice = allDocsRef.current.slice(start, start + PAGE_SIZE);
      setMeds(slice);
      setHasMore(start + PAGE_SIZE < allDocsRef.current.length);
    } catch (e) {
      console.error(e);
      setError('Error cargando catálogo.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPage(true); }, []);

  /* ── load consultorios + doctors ── */
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [consSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'catalogo_consultorios')),
          getDocs(query(collection(db, 'users'), where('rol', '==', 'medico'))),
        ]);
        setConsultorios(
          consSnap.docs
            .map(d => ({ id: d.id, nombre: d.data().nombre || '', ubicacion: d.data().ubicacion || '', activo: d.data().activo !== false }))
            .filter(c => c.activo)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
        setDoctors(
          usersSnap.docs
            .map(d => ({ id: d.id, nombre: d.data().nombre || `${d.data().nombres || ''} ${d.data().apellidos || ''}`.trim(), especialidad: d.data().especialidad || '' }))
            .filter(d => d.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
      } catch (e) {
        console.error('Error cargando catálogos auxiliares:', e);
      }
    };
    loadCatalogs();
  }, []);

  /* ── filtered meds (search over ALL docs, not just current page) ── */
  const filtered = useMemo(() => {
    let list = allDocsRef.current;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        `${m.medicamento} ${m.grupo} ${m.sustanciaActiva} ${m.presentacion} ${m.numeroAcomodo} ${m.indicacion} ${m.dosis}`.toLowerCase().includes(q)
      );
    }
    if (nivelFilter > 0) list = list.filter(m => m.nivel === nivelFilter);
    if (estadoFilter === 'activos') list = list.filter(m => m.activo);
    if (estadoFilter === 'inactivos') list = list.filter(m => !m.activo);
    return list;
  }, [meds, search, nivelFilter, estadoFilter]);

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1); }, [search, nivelFilter, estadoFilter]);

  /* ── paginated slice of filtered results ── */
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginatedMeds = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  /* ── stats ── */
  const stats = useMemo(() => {
    const all = allDocsRef.current;
    return {
      total: totalCount || all.length,
      activos: all.filter(m => m.activo).length,
      inactivos: all.filter(m => !m.activo).length,
      conRestricciones: all.filter(m => m.consultoriosIds.length > 0 || m.medicosBloqueadosIds.length > 0).length,
    };
  }, [meds, totalCount]);

  /* ── pagination ── */
  const goNext = () => {
    if (page >= totalPages) return;
    setPage(p => p + 1);
  };

  const goPrev = () => {
    if (page <= 1) return;
    setPage(p => p - 1);
  };

  /* ── open modal ── */
  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalTab('general');
    setAccessSearch('');
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({
      color: m.color || colorByNivel(m.nivel || 3),
      medicamento: m.medicamento || '',
      grupo: m.grupo || '',
      sustanciaActiva: m.sustanciaActiva || '',
      numeroAcomodo: m.numeroAcomodo || '',
      presentacion: m.presentacion || '',
      dosis: m.dosis || '',
      indicacion: m.indicacion || '',
      opcion2: m.opcion2 || '',
      advertencia: m.advertencia || '',
      embarazo: m.embarazo || '',
      nivel: m.nivel || 3,
      activo: m.activo !== false,
      consultoriosIds: m.consultoriosIds || [],
      medicosBloqueadosIds: m.medicosBloqueadosIds || [],
    });
    setModalTab('general');
    setAccessSearch('');
    setShowModal(true);
  };

  /* ── toggle array item (for access control checkboxes) ── */
  const toggleArrayItem = (field, itemId) => {
    setForm(prev => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(itemId) ? arr.filter(x => x !== itemId) : [...arr, itemId],
      };
    });
  };

  /* ── save ── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.medicamento.trim()) { setError('Medicamento es obligatorio.'); return; }
    setSaving(true);
    setError('');
    const user = resolveUser();
    const payload = buildPayload(form, user);
    try {
      if (editingId) {
        await setDoc(doc(db, 'catalogo_medicamentos', editingId), payload, { merge: true });
      } else {
        await addDoc(collection(db, 'catalogo_medicamentos'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: user.nombre,
        });
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      await fetchPage(true);
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar. Verifica permisos.');
    } finally {
      setSaving(false);
    }
  };

  /* ── toggle activo ── */
  const toggleActivo = async (m) => {
    try {
      const user = resolveUser();
      await updateDoc(doc(db, 'catalogo_medicamentos', m.id), {
        activo: !m.activo,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: user.nombre,
      });
      setMeds(prev => prev.map(r => r.id === m.id ? { ...r, activo: !r.activo } : r));
      allDocsRef.current = allDocsRef.current.map(r => r.id === m.id ? { ...r, activo: !r.activo } : r);
    } catch (err) {
      console.error(err);
      setError('No se pudo cambiar estado.');
    }
  };

  /* ── delete ── */
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'catalogo_medicamentos', id));
      setConfirmDelete(null);
      if (selectedMed?.id === id) setSelectedMed(null);
      await fetchPage(true);
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar.');
    }
  };

  const consultorioMap = useMemo(
    () => Object.fromEntries(consultorios.map(c => [c.id, c])),
    [consultorios]
  );

  const doctorMap = useMemo(
    () => Object.fromEntries(doctors.map(d => [d.id, d])),
    [doctors]
  );

  const accessQuery = accessSearch.trim().toLowerCase();

  const filteredConsultorios = useMemo(() => {
    if (!accessQuery) return consultorios;
    return consultorios.filter(c =>
      `${c.nombre} ${c.ubicacion}`.toLowerCase().includes(accessQuery)
    );
  }, [consultorios, accessQuery]);

  const filteredDoctors = useMemo(() => {
    if (!accessQuery) return doctors;
    return doctors.filter(d =>
      `${d.nombre} ${d.especialidad}`.toLowerCase().includes(accessQuery)
    );
  }, [doctors, accessQuery]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto pb-16 space-y-5">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-800"
              style={{ fontFamily: 'Sora, sans-serif' }}>
            Catálogo de Medicamentos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestión, altas, bajas y control del catálogo de medicamentos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold shadow-sm hover:bg-sky-700 transition"
            onClick={openNew}>
            <Plus size={15} />
            Nuevo medicamento
          </button>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={16} /> {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* ── SUMMARY BAR ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold bg-slate-100 text-slate-700 border-slate-200">
            Total: {stats.total}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
            Activos: {stats.activos}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold bg-slate-50 text-slate-700 border-slate-200">
            Inactivos: {stats.inactivos}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
            Con reglas: {stats.conRestricciones}
          </span>
        </div>
      </div>

      {/* ── SEARCH + FILTERS ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-200 focus:border-sky-400 outline-none"
            placeholder="Buscar medicamento, grupo, sustancia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
          value={nivelFilter}
          onChange={e => setNivelFilter(+e.target.value)}>
          <option value={0}>Todos los niveles</option>
          {[1,2,3,4,5].map(n => <option key={n} value={n}>Nivel {n}</option>)}
        </select>
        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <button type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium transition"
          onClick={() => fetchPage(true)}>
          <RefreshCcw size={14} /> Recargar
        </button>
      </div>

      {/* ── MAIN TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-8"></th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Medicamento</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Grupo</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Sust. Activa</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">N° Acomodo</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Presentación</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dosis</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Indicación</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-16">
                  <div className="flex flex-col items-center gap-0.5">
                    Nivel
                    <select value={nivelFilter} onChange={e => setNivelFilter(+e.target.value)}
                      className={`text-[10px] font-semibold border rounded px-1 py-0.5 outline-none cursor-pointer ${nivelFilter ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                      <option value={0}>Todos</option>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">Cargando...</td></tr>
              ) : paginatedMeds.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">Sin resultados.</td></tr>
              ) : paginatedMeds.map((m, mIdx) => {
                const isOpen = selectedMed?.id === m.id;
                return (
                  <React.Fragment key={m.id}>
                    {/* main row */}
                    <tr
                      onClick={() => setSelectedMed(prev => prev?.id === m.id ? null : m)}
                      className={`cursor-pointer transition-colors select-none ${
                        isOpen
                          ? 'bg-sky-50/70'
                          : 'hover:bg-slate-50'
                      } ${!m.activo ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2.5 text-center">
                        <ChevronDown size={14} className={`inline text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 inline-block w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                          <span title={m.medicamento} className="truncate">{m.medicamento}</span>
                          {!m.activo && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500">OFF</span>
                          )}
                          {(m.consultoriosIds.length > 0 || m.medicosBloqueadosIds.length > 0) && (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400" title="Tiene reglas de acceso" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[140px]">
                        <span title={m.grupo} className="truncate block">{trunc(m.grupo, 20)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[160px]">
                        <span title={m.sustanciaActiva} className="truncate block">{trunc(m.sustanciaActiva, 22)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[100px]">
                        {m.numeroAcomodo ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">#{m.numeroAcomodo}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[140px]">
                        <span title={m.presentacion} className="truncate block">{trunc(m.presentacion, 18)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[140px]">
                        <span title={m.dosis} className="truncate block">{trunc(m.dosis, 18)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[140px]">
                        <span title={m.indicacion} className="truncate block">{trunc(m.indicacion, 18)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold"
                          style={{ backgroundColor: NIVEL_COLORS[m.nivel] || '#94a3b8' }}>
                          {m.nivel}
                        </span>
                      </td>
                    </tr>

                    {/* expanded detail row */}
                    {isOpen && (
                      <tr className="bg-sky-50">
                        <td colSpan={10} className="px-0 py-0">
                          <div className="px-5 py-4 border-t-2 border-sky-300 border-b-2 bg-gradient-to-b from-sky-50 to-sky-50/30 border-l-4"
                            style={{ borderLeftColor: m.color }}>
                            {/* top: actions + status */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); toggleActivo(m); setSelectedMed(prev => prev ? { ...prev, activo: !prev.activo } : null); }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    m.activo
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                  }`}>
                                  {m.activo ? '● Activo' : '○ Inactivo'}
                                </button>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                                  style={{ backgroundColor: NIVEL_COLORS[m.nivel] || '#94a3b8' }}>
                                  Nivel {m.nivel} — {NIVEL_LABELS[m.nivel]}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition shadow-sm">
                                  <Edit3 size={13} /> Editar
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.id); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-red-600 hover:bg-red-50 border border-slate-200 transition shadow-sm">
                                  <Trash2 size={13} /> Eliminar
                                </button>
                              </div>
                            </div>

                            {/* detail grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3">
                              {[
                                ['N° Acomodo', m.numeroAcomodo],
                                ['Presentación', m.presentacion],
                                ['Dosis', m.dosis],
                                ['Indicación', m.indicacion],
                                ['Opción 2', m.opcion2],
                                ['Advertencia', m.advertencia],
                                ['Embarazo', m.embarazo],
                                ['Sustancia activa', m.sustanciaActiva],
                              ].map(([label, val]) => (
                                <div key={label}>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                                  <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{val || '—'}</p>
                                </div>
                              ))}
                            </div>

                            {/* access control */}
                            <div className="flex flex-wrap gap-6 mt-4 pt-3 border-t border-slate-200/60">
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                  <Building2 size={10} /> Consultorios
                                </p>
                                {m.consultoriosIds?.length ? (
                                  <div className="flex flex-wrap gap-1">
                                    {m.consultoriosIds.map(id => (
                                      <span key={id} className="px-2 py-0.5 rounded text-[11px] bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                                        {consultorioMap[id]?.nombre || id}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">Todos</p>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                  <ShieldAlert size={10} /> Médicos bloqueados
                                </p>
                                {m.medicosBloqueadosIds?.length ? (
                                  <div className="flex flex-wrap gap-1">
                                    {m.medicosBloqueadosIds.map(id => (
                                      <span key={id} className="px-2 py-0.5 rounded text-[11px] bg-red-50 text-red-700 border border-red-100 font-medium">
                                        {doctorMap[id]?.nombre || id}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">Ninguno</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <span className="text-xs text-slate-500">
            Página {page} de {totalPages} · {totalFiltered} resultado{totalFiltered !== 1 ? 's' : ''} de {totalCount} registros
          </span>
          <div className="flex items-center gap-1">
            <button onClick={goPrev} disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-700 px-2">{page}</span>
            <button onClick={goNext} disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MODAL NEW / EDIT ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Editar medicamento' : 'Nuevo medicamento'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pt-4">
              <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setModalTab('general')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    modalTab === 'general' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Datos generales
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('acceso')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    modalTab === 'acceso' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Control de acceso
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {modalTab === 'general' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Color</label>
                      <div className="flex items-center gap-1.5 h-10">
                        {ALLOWED_COLORS.map(c => (
                          <button key={c.hex} type="button" title={c.name}
                            className={`w-7 h-7 rounded-full border-2 transition ${
                              form.color === c.hex ? 'border-slate-800 scale-110 ring-2 ring-offset-1 ring-slate-300' : 'border-slate-200 hover:border-slate-400'
                            }`}
                            style={{ backgroundColor: c.hex }}
                            onClick={() => setForm(p => ({ ...p, color: c.hex }))} />
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Medicamento *</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.medicamento} onChange={e => setForm(p => ({ ...p, medicamento: e.target.value }))} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Grupo</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.grupo} onChange={e => setForm(p => ({ ...p, grupo: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Sustancia activa</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.sustanciaActiva} onChange={e => setForm(p => ({ ...p, sustanciaActiva: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">N° de acomodo</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.numeroAcomodo} onChange={e => setForm(p => ({ ...p, numeroAcomodo: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Presentación</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.presentacion} onChange={e => setForm(p => ({ ...p, presentacion: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Dosis</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.dosis} onChange={e => setForm(p => ({ ...p, dosis: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Indicación</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.indicacion} onChange={e => setForm(p => ({ ...p, indicacion: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Opción 2</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.opcion2} onChange={e => setForm(p => ({ ...p, opcion2: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Advertencia</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.advertencia} onChange={e => setForm(p => ({ ...p, advertencia: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Embarazo</label>
                      <input className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                        value={form.embarazo} onChange={e => setForm(p => ({ ...p, embarazo: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Nivel (1-5)</label>
                      <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none bg-white"
                        value={form.nivel} onChange={e => { const n = +e.target.value; setForm(p => ({ ...p, nivel: n, color: colorByNivel(n) })); }}>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>Nivel {n} - {NIVEL_LABELS[n]}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs font-semibold text-slate-500">Activo:</label>
                    <button type="button"
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition ${form.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                      onClick={() => setForm(p => ({ ...p, activo: !p.activo }))}>
                      {form.activo ? 'Sí' : 'No'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {!editingId && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Guarda primero el medicamento para configurar consultorios y bloqueos por médico.
                    </div>
                  )}

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-200 outline-none"
                      placeholder="Buscar consultorio o médico"
                      value={accessSearch}
                      onChange={(e) => setAccessSearch(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Consultorios habilitados</p>
                        <p className="text-[11px] text-slate-500">Si no marcas ninguno, queda disponible en todos.</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                        {filteredConsultorios.length === 0 ? (
                          <p className="text-xs text-slate-400 px-2 py-1">Sin consultorios coincidentes.</p>
                        ) : filteredConsultorios.map(c => (
                          <label key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.consultoriosIds.includes(c.id)}
                              onChange={() => toggleArrayItem('consultoriosIds', c.id)}
                              className="mt-0.5"
                              disabled={!editingId}
                            />
                            <span>
                              <span className="text-sm text-slate-700 font-medium">{c.nombre}</span>
                              {c.ubicacion && <span className="block text-xs text-slate-500">{c.ubicacion}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Médicos bloqueados</p>
                        <p className="text-[11px] text-slate-500">Los marcados no podrán usar este medicamento.</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                        {filteredDoctors.length === 0 ? (
                          <p className="text-xs text-slate-400 px-2 py-1">Sin médicos coincidentes.</p>
                        ) : filteredDoctors.map(d => (
                          <label key={d.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.medicosBloqueadosIds.includes(d.id)}
                              onChange={() => toggleArrayItem('medicosBloqueadosIds', d.id)}
                              className="mt-0.5"
                              disabled={!editingId}
                            />
                            <span>
                              <span className="text-sm text-slate-700 font-medium">{d.nombre}</span>
                              {d.especialidad && <span className="block text-xs text-slate-500">{d.especialidad}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-50 transition">
                  <Save size={14} />
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM ═══ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Eliminar medicamento</h3>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
