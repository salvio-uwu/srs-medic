import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, ChevronDown, ChevronLeft, ChevronRight, Edit3,
  FileText, Plus, RefreshCcw, Save, Search, ShieldAlert, Trash2, X
} from 'lucide-react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, where,
  serverTimestamp, setDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import { pdf } from '@react-pdf/renderer';
import { db } from '../../config/firebase';
import useIsMobile from '../../hooks/useIsMobile';
import EtiquetasAcomodoPDF from '../../components/pdf/EtiquetasAcomodoPDF';

/* ─── constants ─── */
const PAGE_SIZE = 30;
const BATCH_LIMIT = 450;

const EMPTY_FORM = {
  color: '#eab308', medicamento: '', grupo: '', sustanciaActiva: '',
  numeroAcomodo: '', presentacion: '', dosis: '', indicacion: '',
  opcion2: '', advertencia: '', embarazo: '', nivel: 3, activo: true,
  antibiotico: false,
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

/* ─── número de acomodo: parse / format / cascada ─── */
/** 0 = permitido y repetible; el orden del anaquel (cascada) inicia en 1. */
const parseAcomodo = (value) => {
  const raw = String(value ?? '').trim().replace(/^#/, '');
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const isOrderedAcomodo = (n) => n != null && n >= 1;

const isAntibiotico = (rowOrFlag) => {
  if (typeof rowOrFlag === 'boolean') return rowOrFlag;
  return !!(rowOrFlag?.antibiotico || rowOrFlag?.esAntibiotico);
};

const apartadoLabel = (antibiotico) => (antibiotico ? 'antibióticos' : 'venta libre');

const detectAcomodoWidth = (rows = [], antibiotico = null) => {
  let width = 0;
  rows.forEach((row) => {
    if (antibiotico != null && isAntibiotico(row) !== !!antibiotico) return;
    const raw = String(row.numeroAcomodo ?? '').trim().replace(/^#/, '');
    if (/^\d+$/.test(raw) && parseInt(raw, 10) >= 1) width = Math.max(width, raw.length);
  });
  return width || 3;
};

const formatAcomodo = (n, width = 3) => {
  if (n === 0) return '0';
  return String(n).padStart(Math.max(width, String(n).length), '0');
};

const acomodoUpdateFields = (formatted, user) => ({
  numeroAcomodo: formatted,
  'NUMERO ACOMODO': formatted,
  'NUMERO DE ACOMODO': formatted,
  updatedAt: serverTimestamp(),
  updatedBy: user.uid,
  updatedByName: user.nombre,
});

/**
 * Desplaza en cascada solo acomodos >= 1 del mismo apartado
 * (venta libre o antibióticos). El 0 nunca participa.
 */
const shiftAcomodos = async ({
  rows, fromInclusive, toInclusive = Infinity, delta,
  excludeId = null, width = 3, user, antibiotico = false,
}) => {
  if (!delta || !Number.isFinite(fromInclusive)) return 0;
  const from = Math.max(1, fromInclusive);
  const wantAbx = !!antibiotico;

  const targets = rows
    .map((row) => ({
      id: row.id,
      n: parseAcomodo(row.numeroAcomodo),
      antibiotico: isAntibiotico(row),
    }))
    .filter((row) => {
      if (!row.id || row.id === excludeId || !isOrderedAcomodo(row.n)) return false;
      if (row.antibiotico !== wantAbx) return false;
      if (row.n < from) return false;
      if (Number.isFinite(toInclusive) && row.n > toInclusive) return false;
      return true;
    })
    .sort((a, b) => (delta > 0 ? b.n - a.n : a.n - b.n));

  if (!targets.length) return 0;

  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const chunk = targets.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((row) => {
      const next = row.n + delta;
      if (next < 1) return;
      batch.update(doc(db, 'catalogo_medicamentos', row.id), acomodoUpdateFields(formatAcomodo(next, width), user));
    });
    await batch.commit();
  }

  return targets.length;
};

const countShiftTargets = (rows, {
  fromInclusive, toInclusive = Infinity, excludeId = null, antibiotico = false,
}) => {
  const from = Math.max(1, fromInclusive);
  const wantAbx = !!antibiotico;
  return rows.filter((row) => {
    if (!row.id || row.id === excludeId) return false;
    if (isAntibiotico(row) !== wantAbx) return false;
    const n = parseAcomodo(row.numeroAcomodo);
    if (!isOrderedAcomodo(n) || n < from) return false;
    if (Number.isFinite(toInclusive) && n > toInclusive) return false;
    return true;
  }).length;
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
    antibiotico: !!(d.antibiotico || d.esAntibiotico),
    consultoriosIds: Array.isArray(d.consultoriosIds) ? d.consultoriosIds : [],
    medicosBloqueadosIds: Array.isArray(d.medicosBloqueadosIds) ? d.medicosBloqueadosIds : [],
  };
};

/* ─── build payload for Firestore ─── */
const buildPayload = (f, user, acomodoOverride = null) => {
  const acomodoRaw = acomodoOverride != null ? acomodoOverride : (f.numeroAcomodo || '').trim();
  return {
  medicamento: f.medicamento.trim(),
  medicamentoLower: f.medicamento.trim().toLowerCase(),
  grupo: f.grupo.trim(),
  sustanciaActiva: f.sustanciaActiva.trim(),
  numeroAcomodo: acomodoRaw,
  presentacion: f.presentacion.trim(),
  dosis: f.dosis.trim(),
  indicacion: (f.indicacion || '').trim(),
  opcion2: (f.opcion2 || '').trim(),
  advertencia: (f.advertencia || '').trim(),
  embarazo: (f.embarazo || '').trim(),
  color: colorByNivel(Number(f.nivel) || 3),
  nivel: Number(f.nivel) || 3,
  activo: !!f.activo,
  antibiotico: !!f.antibiotico,
  esAntibiotico: !!f.antibiotico,
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
  'NUMERO ACOMODO': acomodoRaw,
  'NUMERO DE ACOMODO': acomodoRaw,
  updatedAt: serverTimestamp(),
  updatedBy: user.uid,
  updatedByName: user.nombre,
};
};

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
  const [apartadoFilter, setApartadoFilter] = useState('todos'); // todos | libre | antibioticos

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

  // reacomodo confirm (popup limpio para usuario final)
  const [confirmAcomodo, setConfirmAcomodo] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

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
    if (apartadoFilter === 'libre') list = list.filter(m => !m.antibiotico);
    if (apartadoFilter === 'antibioticos') list = list.filter(m => !!m.antibiotico);
    return list;
  }, [meds, search, nivelFilter, estadoFilter, apartadoFilter]);

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1); }, [search, nivelFilter, estadoFilter, apartadoFilter]);

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
      antibioticos: all.filter(m => m.antibiotico).length,
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
      antibiotico: !!m.antibiotico,
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

  /* ── save (con reacomodo en cascada del N° de acomodo, por apartado) ── */
  const buildAcomodoPlan = () => {
    const rows = allDocsRef.current;
    const targetN = parseAcomodo(form.numeroAcomodo);
    const newAbx = !!form.antibiotico;
    const width = detectAcomodoWidth(rows, newAbx);
    const editingRow = editingId ? rows.find((r) => r.id === editingId) : null;
    const oldN = editingRow ? parseAcomodo(editingRow.numeroAcomodo) : null;
    const oldAbx = editingRow ? isAntibiotico(editingRow) : newAbx;
    const apartadoChanged = !!editingId && oldAbx !== newAbx;

    let needsShift = false;
    let mode = 'none';
    // Acciones de cascada a ejecutar (orden importa)
    const actions = [];

    const pushInsert = (antibiotico, n) => {
      const count = countShiftTargets(rows, {
        fromInclusive: n, excludeId: editingId, antibiotico,
      });
      if (count > 0) {
        actions.push({ type: 'insert', antibiotico, from: n, count });
        needsShift = true;
      }
    };
    const pushClose = (antibiotico, n) => {
      if (!isOrderedAcomodo(n)) return;
      const count = countShiftTargets(rows, {
        fromInclusive: n + 1, excludeId: editingId, antibiotico,
      });
      if (count > 0) {
        actions.push({ type: 'close', antibiotico, from: n + 1, count });
        needsShift = true;
      }
    };
    const pushMoveForward = (antibiotico, target, old) => {
      const count = countShiftTargets(rows, {
        fromInclusive: target, toInclusive: old - 1, excludeId: editingId, antibiotico,
      });
      if (count > 0) {
        actions.push({ type: 'moveForward', antibiotico, from: target, to: old - 1, count });
        needsShift = true;
      }
    };
    const pushMoveBack = (antibiotico, target, old) => {
      const count = countShiftTargets(rows, {
        fromInclusive: old + 1, toInclusive: target, excludeId: editingId, antibiotico,
      });
      if (count > 0) {
        actions.push({ type: 'moveBack', antibiotico, from: old + 1, to: target, count });
        needsShift = true;
      }
    };

    if (apartadoChanged) {
      // Sale de un estante e entra al otro
      pushClose(oldAbx, oldN);
      if (isOrderedAcomodo(targetN)) pushInsert(newAbx, targetN);
      mode = needsShift ? 'switchApartado' : 'none';
    } else if (targetN === 0) {
      if (isOrderedAcomodo(oldN)) {
        pushClose(newAbx, oldN);
        mode = needsShift ? 'toZero' : 'none';
      }
    } else if (isOrderedAcomodo(targetN)) {
      if (!editingId || !isOrderedAcomodo(oldN)) {
        pushInsert(newAbx, targetN);
        mode = needsShift ? 'insert' : 'none';
      } else if (targetN < oldN) {
        pushMoveForward(newAbx, targetN, oldN);
        mode = needsShift ? 'moveForward' : 'none';
      } else if (targetN > oldN) {
        pushMoveBack(newAbx, targetN, oldN);
        mode = needsShift ? 'moveBack' : 'none';
      }
    } else if (editingId && isOrderedAcomodo(oldN)) {
      pushClose(oldAbx, oldN);
      mode = needsShift ? 'clear' : 'none';
    }

    const posLabel = targetN != null ? formatAcomodo(targetN, width) : '';
    const apLabel = apartadoLabel(newAbx);
    let title = 'Actualizar orden del anaquel';
    let message = '';
    let detail = '';

    if (mode === 'insert') {
      title = 'Este número ya está en uso';
      message = `El número #${posLabel} ya está ocupado en ${apLabel}. Si continúas, este medicamento ocupará ese lugar.`;
      detail = `Solo se reordenarán los medicamentos del apartado de ${apLabel}.`;
    } else if (mode === 'moveForward' || mode === 'moveBack') {
      title = 'Cambiar número de acomodo';
      message = `Este medicamento pasará a ocupar el número #${posLabel} en ${apLabel}.`;
      detail = `Los números del mismo apartado se ajustarán solos.`;
    } else if (mode === 'switchApartado') {
      title = newAbx ? 'Mover a estante de antibióticos' : 'Mover a venta libre';
      message = newAbx
        ? 'Este medicamento se marcará como antibiótico y pasará al anaquel de antibióticos.'
        : 'Este medicamento dejará de ser antibiótico y pasará al anaquel de venta libre.';
      detail = 'Se cerrará su lugar en el estante anterior y se acomodará en el nuevo apartado.';
    } else if (mode === 'toZero') {
      title = 'Pasar a acomodo 0';
      message = 'Este medicamento quedará con número 0. Puedes tener varios con 0.';
      detail = `El lugar que ocupaba en ${apLabel} se cerrará automáticamente.`;
    } else if (mode === 'clear') {
      title = 'Quitar número de acomodo';
      message = 'Se quitará el número de acomodo de este medicamento.';
      detail = `Los siguientes en ${apLabel} se ajustarán para no dejar un espacio vacío.`;
    }

    return {
      rows, width, targetN, oldN, newAbx, oldAbx, apartadoChanged,
      needsShift, mode, actions, title, message, detail,
    };
  };

  const executeSave = async (plan) => {
    const user = resolveUser();
    const {
      rows, width, targetN, oldN, newAbx, oldAbx, apartadoChanged, actions = [],
    } = plan;
    const formattedAcomodo = targetN != null ? formatAcomodo(targetN, width) : '';
    const payload = buildPayload(form, user, formattedAcomodo);

    setSaving(true);
    setError('');
    setConfirmAcomodo(null);

    try {
      // Ejecutar acciones de cascada en orden
      for (const action of actions) {
        const abx = !!action.antibiotico;
        const w = detectAcomodoWidth(rows, abx) || width;
        if (action.type === 'insert') {
          await shiftAcomodos({
            rows, fromInclusive: action.from, delta: 1,
            excludeId: editingId, width: w, user, antibiotico: abx,
          });
        } else if (action.type === 'close') {
          await shiftAcomodos({
            rows, fromInclusive: action.from, delta: -1,
            excludeId: editingId, width: w, user, antibiotico: abx,
          });
        } else if (action.type === 'moveForward') {
          await shiftAcomodos({
            rows, fromInclusive: action.from, toInclusive: action.to, delta: 1,
            excludeId: editingId, width: w, user, antibiotico: abx,
          });
        } else if (action.type === 'moveBack') {
          await shiftAcomodos({
            rows, fromInclusive: action.from, toInclusive: action.to, delta: -1,
            excludeId: editingId, width: w, user, antibiotico: abx,
          });
        }
      }

      // Fallback si no venía plan con actions (compat)
      if (!actions.length) {
        if (apartadoChanged) {
          if (isOrderedAcomodo(oldN)) {
            await shiftAcomodos({
              rows, fromInclusive: oldN + 1, delta: -1,
              excludeId: editingId, width: detectAcomodoWidth(rows, oldAbx), user, antibiotico: oldAbx,
            });
          }
          if (isOrderedAcomodo(targetN)) {
            await shiftAcomodos({
              rows, fromInclusive: targetN, delta: 1,
              excludeId: editingId, width, user, antibiotico: newAbx,
            });
          }
        } else if (targetN === 0) {
          if (isOrderedAcomodo(oldN)) {
            await shiftAcomodos({
              rows, fromInclusive: oldN + 1, delta: -1,
              excludeId: editingId, width, user, antibiotico: newAbx,
            });
          }
        } else if (isOrderedAcomodo(targetN)) {
          if (!editingId || !isOrderedAcomodo(oldN)) {
            await shiftAcomodos({
              rows, fromInclusive: targetN, delta: 1,
              excludeId: editingId, width, user, antibiotico: newAbx,
            });
          } else if (targetN < oldN) {
            await shiftAcomodos({
              rows, fromInclusive: targetN, toInclusive: oldN - 1, delta: 1,
              excludeId: editingId, width, user, antibiotico: newAbx,
            });
          } else if (targetN > oldN) {
            await shiftAcomodos({
              rows, fromInclusive: oldN + 1, toInclusive: targetN, delta: -1,
              excludeId: editingId, width, user, antibiotico: newAbx,
            });
          }
        } else if (editingId && isOrderedAcomodo(oldN)) {
          await shiftAcomodos({
            rows, fromInclusive: oldN + 1, delta: -1,
            excludeId: editingId, width, user, antibiotico: oldAbx,
          });
        }
      }

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
      setError('No se pudo guardar. Revisa tu conexión o permisos e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.medicamento.trim()) { setError('El nombre del medicamento es obligatorio.'); return; }

    if (String(form.numeroAcomodo || '').trim() && parseAcomodo(form.numeroAcomodo) == null) {
      setError('El número de acomodo debe ser 0 o un entero positivo (por ejemplo: 0, 1, 6).');
      return;
    }

    const plan = buildAcomodoPlan();
    if (plan.needsShift) {
      setConfirmAcomodo(plan);
      return;
    }
    await executeSave(plan);
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

  /* ── delete (cierra hueco de acomodo en su apartado) ── */
  const handleDelete = async (id) => {
    try {
      const user = resolveUser();
      const rows = allDocsRef.current;
      const deleted = rows.find((r) => r.id === id);
      const deletedN = parseAcomodo(deleted?.numeroAcomodo);
      const deletedAbx = isAntibiotico(deleted);
      const width = detectAcomodoWidth(rows, deletedAbx);

      await deleteDoc(doc(db, 'catalogo_medicamentos', id));

      // Solo cerrar hueco si salía del anaquel ordenado (>= 1) de su apartado.
      if (isOrderedAcomodo(deletedN)) {
        await shiftAcomodos({
          rows,
          fromInclusive: deletedN + 1,
          delta: -1,
          excludeId: id,
          width,
          user,
          antibiotico: deletedAbx,
        });
      }

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

  /* ── PDF etiquetas de acomodo (venta libre + antibióticos) ── */
  const handleGenerarDocumentoAcomodo = async () => {
    const sortAcomodo = (list) => list.slice().sort((a, b) => {
      const na = parseAcomodo(a.numeroAcomodo);
      const nb = parseAcomodo(b.numeroAcomodo);
      if (na !== nb) return na - nb;
      return String(a.medicamento || '').localeCompare(String(b.medicamento || ''), 'es');
    });

    const activos = allDocsRef.current.filter(
      (m) => m.activo !== false && isOrderedAcomodo(parseAcomodo(m.numeroAcomodo))
    );
    const ventaLibre = sortAcomodo(activos.filter((m) => !m.antibiotico));
    const antibioticos = sortAcomodo(activos.filter((m) => !!m.antibiotico));

    if (!ventaLibre.length && !antibioticos.length) {
      setError('No hay medicamentos activos con número de acomodo desde 1 para generar el documento.');
      return;
    }

    setGeneratingPdf(true);
    setError('');
    try {
      const blob = await pdf(
        <EtiquetasAcomodoPDF ventaLibre={ventaLibre} antibioticos={antibioticos} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Documento_Acomodo_${stamp}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el documento de acomodo. Intenta de nuevo.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  const isMobile = useIsMobile();

  return (
    <div style={{ padding: isMobile ? '16px 12px 48px' : '20px 24px 40px', maxWidth: 1600, margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#111', fontFamily: 'Sora, sans-serif', margin: 0, letterSpacing: '-0.02em' }}>
            Catalogo de Medicamentos
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
            Gestion, altas, bajas y control del catalogo de medicamentos.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <button type="button"
            disabled={generatingPdf}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#111', background: '#fff', cursor: generatingPdf ? 'not-allowed' : 'pointer', opacity: generatingPdf ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={handleGenerarDocumentoAcomodo}>
            <FileText size={14} />
            {generatingPdf ? 'Generando…' : 'Generar documento de acomodo'}
          </button>
          <button type="button"
            style={{ border: '1px solid #111', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', background: '#111', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={openNew}>
            <Plus size={14} />
            Nuevo medicamento
          </button>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 6, border: '1px solid #e5e7eb', color: '#111', fontSize: 12, background: '#fafafa', marginBottom: 16 }}>
          <AlertTriangle size={14} /> {error}
          <button style={{ marginLeft: 'auto', color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setError('')}><X size={12} /></button>
        </div>
      )}

      {/* ── SUMMARY BAR ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f3f4f6', fontSize: 11, fontWeight: 700, color: '#111' }}>
            Total: {stats.total}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#111' }}>
            Activos: {stats.activos}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>
            Inactivos: {stats.inactivos}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#111' }}>
            Antibióticos: {stats.antibioticos}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#111' }}>
            Con reglas: {stats.conRestricciones}
          </span>
        </div>
      </div>

      {/* ── SEARCH + FILTERS ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: isMobile ? '100%' : 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            style={{ width: '100%', padding: '8px 12px 8px 34px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
            placeholder="Buscar medicamento, grupo, sustancia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#111', outline: 'none' }}
          value={nivelFilter}
          onChange={e => setNivelFilter(+e.target.value)}>
          <option value={0}>Todos los niveles</option>
          {[1,2,3,4,5].map(n => <option key={n} value={n}>Nivel {n}</option>)}
        </select>
        <select
          style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#111', outline: 'none' }}
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <select
          style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#111', outline: 'none' }}
          value={apartadoFilter}
          onChange={e => setApartadoFilter(e.target.value)}>
          <option value="todos">Todos los estantes</option>
          <option value="libre">Venta libre</option>
          <option value="antibioticos">Antibióticos</option>
        </select>
        <button type="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#4b5563', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => fetchPage(true)}>
          <RefreshCcw size={13} /> Recargar
        </button>
      </div>

      {/* ── MAIN TABLE ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', width: 32 }}></th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Medicamento</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Grupo</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sust. Activa</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>N° Acomodo</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Presentacion</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Dosis</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>Indicacion</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', width: 64 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    Nivel
                    <select value={nivelFilter} onChange={e => setNivelFilter(+e.target.value)}
                      style={{ fontSize: 9, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 4, padding: '1px 4px', outline: 'none', cursor: 'pointer', color: nivelFilter ? '#111' : '#6b7280', background: '#fff' }}>
                      <option value={0}>Todos</option>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>Cargando...</td></tr>
              ) : paginatedMeds.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>Sin resultados.</td></tr>
              ) : paginatedMeds.map((m, mIdx) => {
                const isOpen = selectedMed?.id === m.id;
                return (
                  <React.Fragment key={m.id}>
                    {/* main row */}
                    <tr
                      onClick={() => setSelectedMed(prev => prev?.id === m.id ? null : m)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: isOpen ? '#fafafa' : '#fff', opacity: !m.activo ? 0.5 : 1 }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <ChevronDown size={12} style={{ color: '#9ca3af', display: 'inline', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </td>
                      <td style={{ padding: '8px 12px', maxWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ flexShrink: 0, display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: m.color }} />
                          <span title={m.medicamento} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111', fontWeight: 600 }}>{m.medicamento}</span>
                          {!m.activo && (
                            <span style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: '#e5e7eb', color: '#6b7280' }}>OFF</span>
                          )}
                          {m.antibiotico && (
                            <span style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>ABX</span>
                          )}
                          {(m.consultoriosIds.length > 0 || m.medicosBloqueadosIds.length > 0) && (
                            <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: '#4b5563' }} title="Tiene reglas de acceso" />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', maxWidth: 140 }}>
                        <span title={m.grupo} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trunc(m.grupo, 20)}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', maxWidth: 160 }}>
                        <span title={m.sustanciaActiva} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trunc(m.sustanciaActiva, 22)}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', maxWidth: 100 }}>
                        {m.numeroAcomodo ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', border: '1px solid #e5e7eb', fontSize: 10, fontWeight: 700, color: '#111' }}>#{m.numeroAcomodo}</span>
                            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>{m.antibiotico ? 'ABX' : 'VL'}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#d1d5db' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', maxWidth: 140 }}>
                        <span title={m.presentacion} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trunc(m.presentacion, 18)}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', maxWidth: 140 }}>
                        <span title={m.dosis} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trunc(m.dosis, 18)}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', maxWidth: 140 }}>
                        <span title={m.indicacion} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trunc(m.indicacion, 18)}</span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', color: '#fff', fontSize: 11, fontWeight: 700, backgroundColor: NIVEL_COLORS[m.nivel] || '#94a3b8' }}>
                          {m.nivel}
                        </span>
                      </td>
                    </tr>

                    {/* expanded detail row */}
                    {isOpen && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0 }}>
                          <div style={{ padding: '14px 20px', borderTop: '2px solid #e5e7eb', borderBottom: '2px solid #e5e7eb', borderLeft: `4px solid ${m.color}`, background: '#fafafa' }}>
                            {/* top: actions + status */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={(e) => { e.stopPropagation(); toggleActivo(m); setSelectedMed(prev => prev ? { ...prev, activo: !prev.activo } : null); }}
                                  style={{ padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid #e5e7eb', color: m.activo ? '#111' : '#6b7280', background: m.activo ? '#fff' : '#e5e7eb', cursor: 'pointer' }}>
                                  {m.activo ? '● Activo' : '○ Inactivo'}
                                </button>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#fff', backgroundColor: NIVEL_COLORS[m.nivel] || '#94a3b8' }}>
                                  Nivel {m.nivel} — {NIVEL_LABELS[m.nivel]}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid #d1d5db', background: '#fff', color: '#4b5563', cursor: 'pointer' }}>
                                  <Edit3 size={12} /> Editar
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.id); }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid #d1d5db', background: '#fff', color: '#111', cursor: 'pointer' }}>
                                  <Trash2 size={12} /> Eliminar
                                </button>
                              </div>
                            </div>

                            {/* detail grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px 20px' }}>
                              {[
                                ['N° Acomodo', m.numeroAcomodo],
                                ['Presentacion', m.presentacion],
                                ['Dosis', m.dosis],
                                ['Indicacion', m.indicacion],
                                ['Opcion 2', m.opcion2],
                                ['Advertencia', m.advertencia],
                                ['Embarazo', m.embarazo],
                                ['Sustancia activa', m.sustanciaActiva],
                              ].map(([label, val]) => (
                                <div key={label}>
                                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{label}</p>
                                  <p style={{ fontSize: 11, color: '#111', margin: '2px 0 0', lineHeight: 1.4 }}>{val || '—'}</p>
                                </div>
                              ))}
                            </div>

                            {/* access control */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 4, margin: '0 0 4px' }}>
                                  <Building2 size={10} /> Consultorios
                                </p>
                                {m.consultoriosIds?.length ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {m.consultoriosIds.map(id => (
                                      <span key={id} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: '#f3f4f6', color: '#111', border: '1px solid #e5e7eb', fontWeight: 600 }}>
                                        {consultorioMap[id]?.nombre || id}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Todos</p>
                                )}
                              </div>
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 4, margin: '0 0 4px' }}>
                                  <ShieldAlert size={10} /> Medicos bloqueados
                                </p>
                                {m.medicosBloqueadosIds?.length ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {m.medicosBloqueadosIds.map(id => (
                                      <span key={id} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: '#f3f4f6', color: '#111', border: '1px solid #e5e7eb', fontWeight: 600 }}>
                                        {doctorMap[id]?.nombre || id}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Ninguno</p>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            Pagina {page} de {totalPages} · {totalFiltered} resultado{totalFiltered !== 1 ? 's' : ''} de {totalCount} registros
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={goPrev} disabled={page <= 1}
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.3 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111', padding: '0 6px' }}>{page}</span>
            <button onClick={goNext} disabled={page >= totalPages}
              style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.3 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ MODAL NEW / EDIT ═══ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', width: '100%', maxWidth: 1024, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
                {editingId ? 'Editar medicamento' : 'Nuevo medicamento'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }}
                style={{ padding: 6, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '14px 20px 0' }}>
              <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid #e5e7eb', padding: 2, background: '#f3f4f6' }}>
                <button type="button" onClick={() => setModalTab('general')}
                  style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 4, border: 'none', cursor: 'pointer', color: modalTab === 'general' ? '#111' : '#6b7280', background: modalTab === 'general' ? '#fff' : 'transparent' }}>
                  Datos generales
                </button>
                <button type="button" onClick={() => setModalTab('acceso')}
                  style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 4, border: 'none', cursor: 'pointer', color: modalTab === 'acceso' ? '#111' : '#6b7280', background: modalTab === 'acceso' ? '#fff' : 'transparent' }}>
                  Control de acceso
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {modalTab === 'general' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 3fr 2fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Color</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40 }}>
                        {ALLOWED_COLORS.map(c => (
                          <button key={c.hex} type="button" title={c.name}
                            style={{ width: 28, height: 28, borderRadius: '50%', border: form.color === c.hex ? '2px solid #111' : '1px solid #d1d5db', cursor: 'pointer', backgroundColor: c.hex, transform: form.color === c.hex ? 'scale(1.15)' : 'none' }}
                            onClick={() => setForm(p => ({ ...p, color: c.hex }))} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Medicamento *</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.medicamento} onChange={e => setForm(p => ({ ...p, medicamento: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Grupo</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.grupo} onChange={e => setForm(p => ({ ...p, grupo: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Sustancia activa</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.sustanciaActiva} onChange={e => setForm(p => ({ ...p, sustanciaActiva: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>N° de acomodo</label>
                      <input
                        style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        inputMode="numeric"
                        placeholder="Ej. 6"
                        value={form.numeroAcomodo}
                        onChange={e => setForm(p => ({ ...p, numeroAcomodo: e.target.value.replace(/[^\d]/g, '') }))}
                      />
                      <p style={{ fontSize: 10, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.35 }}>
                        El 0 se puede repetir (no se vende / sin anaquel). Desde 1, el reorden es solo dentro del mismo estante: venta libre o antibióticos.
                      </p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Presentacion</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.presentacion} onChange={e => setForm(p => ({ ...p, presentacion: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Dosis</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.dosis} onChange={e => setForm(p => ({ ...p, dosis: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Indicacion</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.indicacion} onChange={e => setForm(p => ({ ...p, indicacion: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Opcion 2</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.opcion2} onChange={e => setForm(p => ({ ...p, opcion2: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Advertencia</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.advertencia} onChange={e => setForm(p => ({ ...p, advertencia: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Embarazo</label>
                      <input style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                        value={form.embarazo} onChange={e => setForm(p => ({ ...p, embarazo: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Nivel (1-5)</label>
                      <select style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', background: '#fff', boxSizing: 'border-box' }}
                        value={form.nivel} onChange={e => { const n = +e.target.value; setForm(p => ({ ...p, nivel: n, color: colorByNivel(n) })); }}>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>Nivel {n} - {NIVEL_LABELS[n]}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Antibiótico (estante aparte):</label>
                      <button type="button"
                        style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: form.antibiotico ? '1px solid #fecaca' : '1px solid #e5e7eb', color: form.antibiotico ? '#991b1b' : '#6b7280', background: form.antibiotico ? '#fee2e2' : '#fff', cursor: 'pointer' }}
                        onClick={() => setForm(p => ({ ...p, antibiotico: !p.antibiotico }))}>
                        {form.antibiotico ? 'Sí — anaquel antibióticos' : 'No — venta libre'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Activo:</label>
                      <button type="button"
                        style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #e5e7eb', color: form.activo ? '#111' : '#6b7280', background: form.activo ? '#fff' : '#e5e7eb', cursor: 'pointer' }}
                        onClick={() => setForm(p => ({ ...p, activo: !p.activo }))}>
                        {form.activo ? 'Si' : 'No'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {!editingId && (
                    <div style={{ borderRadius: 6, border: '1px solid #e5e7eb', background: '#fafafa', padding: '8px 12px', fontSize: 11, color: '#111' }}>
                      Guarda primero el medicamento para configurar consultorios y bloqueos por medico.
                    </div>
                  )}

                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111', boxSizing: 'border-box' }}
                      placeholder="Buscar consultorio o medico"
                      value={accessSearch}
                      onChange={(e) => setAccessSearch(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                    <div style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>Consultorios habilitados</p>
                        <p style={{ fontSize: 10, color: '#6b7280', margin: '2px 0 0' }}>Si no marcas ninguno, queda disponible en todos.</p>
                      </div>
                      <div style={{ maxHeight: 256, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredConsultorios.length === 0 ? (
                          <p style={{ fontSize: 11, color: '#9ca3af', padding: '4px 8px' }}>Sin consultorios coincidentes.</p>
                        ) : filteredConsultorios.map(c => (
                          <label key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                            <input type="checkbox" checked={form.consultoriosIds.includes(c.id)}
                              onChange={() => toggleArrayItem('consultoriosIds', c.id)} disabled={!editingId} />
                            <span>
                              <span style={{ color: '#111', fontWeight: 600 }}>{c.nombre}</span>
                              {c.ubicacion && <span style={{ display: 'block', fontSize: 10, color: '#6b7280' }}>{c.ubicacion}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>Medicos bloqueados</p>
                        <p style={{ fontSize: 10, color: '#6b7280', margin: '2px 0 0' }}>Los marcados no podran usar este medicamento.</p>
                      </div>
                      <div style={{ maxHeight: 256, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredDoctors.length === 0 ? (
                          <p style={{ fontSize: 11, color: '#9ca3af', padding: '4px 8px' }}>Sin medicos coincidentes.</p>
                        ) : filteredDoctors.map(d => (
                          <label key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                            <input type="checkbox" checked={form.medicosBloqueadosIds.includes(d.id)}
                              onChange={() => toggleArrayItem('medicosBloqueadosIds', d.id)} disabled={!editingId} />
                            <span>
                              <span style={{ color: '#111', fontWeight: 600 }}>{d.nombre}</span>
                              {d.especialidad && <span style={{ display: 'block', fontSize: 10, color: '#6b7280' }}>{d.especialidad}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }}
                  style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', color: '#6b7280', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 12, borderRadius: 6, border: '1px solid #111', color: '#fff', background: '#111', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, fontWeight: 700 }}>
                  <Save size={13} />
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM ═══ */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', width: '100%', maxWidth: 380, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} style={{ color: '#111' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: 0 }}>Eliminar medicamento</h3>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>Esta acción no se puede deshacer. Si tenía número de acomodo, el orden del anaquel se ajustará solo.</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', color: '#6b7280', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, border: '1px solid #111', color: '#fff', background: '#111', cursor: 'pointer', fontWeight: 700 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REACOMODO CONFIRM ═══ */}
      {confirmAcomodo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', width: '100%', maxWidth: 420, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RefreshCcw size={18} style={{ color: '#111' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{confirmAcomodo.title}</h3>
                <p style={{ fontSize: 13, color: '#374151', margin: '8px 0 0', lineHeight: 1.45 }}>
                  {confirmAcomodo.message}
                </p>
                {confirmAcomodo.detail && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.45 }}>
                    {confirmAcomodo.detail}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmAcomodo(null)}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', color: '#6b7280', background: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => executeSave(confirmAcomodo)}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, border: '1px solid #111', color: '#fff', background: '#111', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontWeight: 700 }}
              >
                {saving ? 'Guardando...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
