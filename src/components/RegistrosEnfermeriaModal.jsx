import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Save, Loader2, Thermometer, Droplet, 
  Sparkles, Package, AlertCircle, ShieldAlert,
  ScanText, Search, CheckCircle2, Activity, MapPin, ChevronDown, ChevronUp, Check, ClipboardList,
  Menu, Printer, Calendar, CalendarX, Plus, Trash2, Bell
} from 'lucide-react';
import { db, functions } from '../config/firebase'; 
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot, getDocs, getDoc, increment } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useSessionLocation } from '../context/SessionLocationContext';
import { useAuth } from '../context/AuthContext';
import BitacoraCarroRojoEnfermeria from '../pages/enfermeria/BitacoraCarroRojoEnfermeria';
import BitacoraPacientesEnfermeria from './BitacoraPacientesEnfermeria';
import RegistroKrit from './RegistroKrit';
import RegistroAutoclave from './RegistroAutoclave';
import RegistroCaducidades from './RegistroCaducidades';
import logoImg from '../assets/logo_azul.png';

let cacheMedicamentosIndex = null;
let cachePedidoMedicamentos = null;

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizePedidoCatalogRows = (rows = []) => {
  if (!Array.isArray(rows)) return [];

  const parsed = rows
    .map((item, index) => {
      const nombre = String(
        item?.nombre
        || item?.insumo
        || item?.medicamento
        || item?.descripcion
        || item?.nombreComercial
        || item?.['*NOMBRE COMERCIAL']
        || ''
      ).trim();
      if (!nombre) return null;

      const categoria = String(item?.categoria || item?.tipo || '').trim();
      const rawId = String(item?.id || item?.codigo || '').trim();
      const safeBaseId = normalizeText(nombre).replace(/\s+/g, '_').slice(0, 48) || `item_${index + 1}`;
      const id = rawId || `pedido_${index + 1}_${safeBaseId}`;
      const orden = Number.isFinite(Number(item?.orden)) ? Number(item.orden) : index + 1;

      return { id, nombre, categoria, orden };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });

  const seen = new Set();
  return parsed.filter((row) => {
    const dedupeKey = normalizeText(row.nombre);
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
};

const buildPedidoCaptureRows = (catalogRows = [], previousRows = []) => {
  const prevMap = new Map((previousRows || []).map((row) => [row.id, row]));
  return (catalogRows || []).map((item, index) => {
    const prev = prevMap.get(item.id) || {};
    return {
      ...item,
      fila: index + 1,
      fisico: prev.fisico ?? '',
      pedido: prev.pedido ?? ''
    };
  });
};

const TAREAS_POR_AREA = {
  "Consultorios": ["Estación de lavado (Limpieza y surtido)", "Limpieza de consultorio general", "Piso barrido y trapeado", "Recolección de basura"],
  "Sanitarios": ["Sanitario y estación de lavado", "Surtido de insumos", "Piso barrido y trapeado", "Recolección de basura"],
  "Salas y Recepción": ["Lavado de manos (Limpieza y surtido)", "Sala de espera, puertas y ventanas", "Piso barrido y trapeado", "Recolección de basura"],
  "Observación": ["Lavado de manos (Limpieza y surtido)", "Limpieza de carro rojo, camas, trípie", "Piso barrido y trapeado", "Recolección de basura"],
  "Aplicaciones": ["Limpieza Silla, repisa, mesa", "Limpieza de cajón de pinzas, paredes", "Piso barrido y trapeado", "Recolección de basura"],
  "Tomas de muestra": ["Limpieza Silla, cajón de insumos", "Limpieza centrifugadora, estantes", "Piso barrido y trapeado", "Recolección de basura"],
  "Rayos X": ["Limpieza y acomodo de mobiliario", "Limpieza de cuarto de control", "Piso barrido y trapeado", "Recolección de basura"]
};

const REGISTRO_TABS = [
  { id: 'farmacia', label: 'Control de Insumos', mobileLabel: 'Insumos', icon: Package, color: 'indigo' },
  { id: 'pedido_medicamento', label: 'Pedido de medicamento', mobileLabel: 'Pedido', icon: ClipboardList, color: 'violet' },
  { id: 'bitacora_px', label: 'Bitácora de pacientes', mobileLabel: 'Pacientes', icon: ClipboardList, color: 'slate' },
  { id: 'temperatura', label: 'Temperaturas', mobileLabel: 'Temp.', icon: Thermometer, color: 'blue' },
  { id: 'cloro', label: 'Cloro y PH', mobileLabel: 'Cloro', icon: Droplet, color: 'cyan' },
  { id: 'limpieza', label: 'Limpieza', mobileLabel: 'Limpieza', icon: Sparkles, color: 'emerald' },
  { id: 'carro_rojo', label: 'Carro Rojo', mobileLabel: 'C. Rojo', icon: ShieldAlert, color: 'rose' },
  { id: 'krit', label: 'Solución KRIT', mobileLabel: 'KRIT', icon: Droplet, color: 'teal' },
  { id: 'autoclave', label: 'Autoclave', mobileLabel: 'Autoclave', icon: Package, color: 'violet' },
  { id: 'caducidades', label: 'Caducidades', mobileLabel: 'Caduc.', icon: CalendarX, color: 'rose' }
];

const toMedicationSearchRow = (m) => {
  const id = m.id || '';
  const nombreComercial = m.nombreComercial || m['*NOMBRE COMERCIAL'] || '';
  const marca = m.marca || m['*MARCA'] || '';
  const laboratorio = m.laboratorio || m.LABORATORIO || '';
  const sustanciaActiva = m.sustanciasActivas || m['*SUSTANCIA(S) ACTIVA(S)'] || '';
  const presentacion = m.presentacion || m['*PRESENTACIÓN'] || m['*PRESENTACION'] || '';
  const dosis = m.dosis || m.DOSIS || '';
  const indicacion = m.indicacion || m.INDICACION || '';
  const opcion2 = m.opcion2 || m['OPCION 2'] || '';
  const advertencia = m.advertencia || m['ADVERTENCIA '] || '';
  const embarazo = m.embarazo || m.EMBARAZO || '';
  const numeroAcomodo = String(m.numeroAcomodo || m.acomodo || m.clave || m.codigo || '').trim();

  const searchText = normalizeText([
    id, nombreComercial, marca, laboratorio, sustanciaActiva, presentacion,
    dosis, indicacion, opcion2, advertencia, embarazo, numeroAcomodo
  ].join(' '));

  // Tokens individuales + prefijos cortos (ej. "para" → "paracetamol")
  const tokenSource = normalizeText([
    nombreComercial, marca, laboratorio, sustanciaActiva, presentacion, dosis, numeroAcomodo, id
  ].join(' '));
  const tokens = Array.from(new Set(
    tokenSource.split(/\s+/).filter(Boolean).flatMap((t) => {
      const parts = [t];
      if (t.length >= 4) parts.push(t.slice(0, 4), t.slice(0, 5));
      return parts;
    })
  ));

  return {
    id, nombreComercial, marca, laboratorio, sustanciaActiva, presentacion, dosis,
    indicacion, opcion2, advertencia, embarazo, numeroAcomodo,
    searchText, tokens
  };
};

const scoreMedicationMatch = (med, queryText) => {
  if (!queryText) return 0;
  const q = normalizeText(queryText);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  let score = 0;
  const nombre = normalizeText(med.nombreComercial);
  const sustancia = normalizeText(med.sustanciaActiva);
  const acomodo = normalizeText(med.numeroAcomodo);
  const marca = normalizeText(med.marca);

  if (acomodo && (acomodo === q || acomodo.startsWith(q))) score += 120;
  if (nombre.startsWith(q)) score += 100;
  if (sustancia.startsWith(q)) score += 80;
  if (marca.startsWith(q)) score += 60;
  if (med.searchText.includes(q)) score += 40;

  const allTokensHit = tokens.every((t) =>
    med.searchText.includes(t) || med.tokens.some((tok) => tok.startsWith(t) || t.startsWith(tok))
  );
  if (!allTokensHit) return 0;

  tokens.forEach((t) => {
    if (acomodo.includes(t)) score += 25;
    if (nombre.includes(t)) score += 18;
    if (sustancia.includes(t)) score += 14;
    if (marca.includes(t)) score += 10;
    if (med.tokens.some((tok) => tok.startsWith(t))) score += 8;
  });

  return score;
};

const normalizeMovimientoArea = (area = '') => {
  const a = String(area || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (a.startsWith('recepcion')) return 'Recepción';
  if (a.startsWith('entrada')) return 'Entrada';
  if (a.startsWith('salida')) return 'Salida';
  return String(area || '').trim();
};

const sameSucursal = (a = '', b = '') => {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const strip = (s) => s
    .replace(/^(sucursal|suursal)\s+/, '')
    .replace(/^(almacen|almacén)\s+/, '')
    .trim();
  const sa = strip(na);
  const sb = strip(nb);
  if (sa && sb && (sa === sb || sa.includes(sb) || sb.includes(sa))) return true;
  return na.includes(nb) || nb.includes(na);
};

const formatFechaMx = (fechaString = '') => {
  const raw = String(fechaString || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const labelEstadoAprobacion = (estado = '') => {
  if (estado === 'aprobado') return 'APROBADO';
  if (estado === 'rechazado') return 'NO APROBADO';
  return 'PENDIENTE';
};

const formatCaducidadCorta = (cad = '') => {
  const raw = String(cad || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[2]}/${m[1].slice(2)}`;
  if (/^\d{2}\/\d{2}/.test(raw)) return raw.slice(0, 5);
  return raw || '—';
};

const criterioBool = (det = {}, key, legacyKeys = []) => {
  if (typeof det[key] === 'boolean') return det[key];
  for (const k of legacyKeys) {
    if (typeof det[k] === 'boolean') return det[k];
  }
  return null;
};

/** Evita ver Entrada+Salida del mismo traspaso en la sucursal incorrecta. */
const bitacoraPerteneceASucursal = (reg, sucursalNombre) => {
  if (!sucursalNombre) return true;
  const area = normalizeMovimientoArea(reg.area || reg.detalles?.tipo_movimiento);
  const suc = reg.sucursal || '';
  const dest = reg.detalles?.sucursalDestino || '';
  const ori = reg.detalles?.sucursalOrigen || '';
  if (area === 'Salida') return sameSucursal(suc, sucursalNombre) || sameSucursal(ori, sucursalNombre);
  if (area === 'Entrada') return sameSucursal(suc, sucursalNombre) || sameSucursal(dest, sucursalNombre);
  // Recepción u otros
  return sameSucursal(suc, sucursalNombre) || sameSucursal(dest, sucursalNombre);
};

const MOVIMIENTOS_FARMACIA = ['Recepción', 'Entrada', 'Salida'];
const ROLES_ENFERMERIA_OPERATIVA = new Set(['enfermeria', 'enfermera', 'enfermero']);
const ROLES_JEFATURA = new Set(['jefa_enfermeria', 'jefa', 'admin', 'admin_maestro', 'administrador']);

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
const RegistrosEnfermeriaModal = ({ onClose, enfermeraNombre, sucursal = '', standalone = false }) => {
  const { user } = useAuth();
  const { sessionSucursal } = useSessionLocation();
  const rolNorm = normalizeText(user?.rol || '');
  const esEnfermeriaOperativa = ROLES_ENFERMERIA_OPERATIVA.has(rolNorm);
  const puedeCambiarSucursal = ROLES_JEFATURA.has(rolNorm) || !esEnfermeriaOperativa;
  const [loading, setLoading] = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState('farmacia');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => () => setSidebarOpen(false), []);

  const [pedidoCompacto, setPedidoCompacto] = useState(true);
  const [sucursalActiva, setSucursalActiva] = useState(sucursal);
  const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const sucursalAutoSetRef = useRef(false);
  const [integrandoId, setIntegrandoId] = useState(null);
  const [printTempMonth, setPrintTempMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [printTempLoading, setPrintTempLoading] = useState(false);
  const [printCloroMonth, setPrintCloroMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [printCloroLoading, setPrintCloroLoading] = useState(false);

  const [progresoHoy, setProgresoHoy] = useState({
    temp_8: false, temp_16: false, temp_22: false, cloro_1: false, limpieza: 0, pedido_medicamento: false
  });

  const getTurnoActual = () => {
    const hora = new Date().getHours();
    if (hora >= 14 && hora < 20) return '4:00 p.m.';
    if (hora >= 20 || hora < 6) return '10:00 p.m.';
    return '8:00 a.m.';
  };

  const [formTemp, setFormTemp] = useState({ turno: getTurnoActual(), t_ext: '', humedad: '', t_ref: '' });
  const [formCloro, setFormCloro] = useState({ ph_1: '', cloro_1: '', ph_2: '', cloro_2: '' });
  const [formLimpieza, setFormLimpieza] = useState({ area: 'Consultorios', tareas: { col1: false, col2: false, col3: false, col4: false } });
  
  const formFarmaciaInicial = {
    tipo_movimiento: 'Recepción',
    factura: '',
    compuesto: '',
    presentacion: '',
    forma: '',
    lote: '',
    caducidad: '',
    cantidad: '',
    observaciones: '',
    criterio_empaque: true,
    criterio_etiqueta: true,
    aprobadoMercancia: null, // 'si' | 'no' | null (solo Recepción)
    medicamentoId: '',
    numeroAcomodo: '',
    marca: '',
    laboratorio: '',
    proveedor: '',
    sucursalOrigen: '',
    sucursalDestino: ''
  };
  const [formFarmacia, setFormFarmacia] = useState(formFarmaciaInicial);
  const [loteFarmaciaItems, setLoteFarmaciaItems] = useState([]);
  const [cabeceraFarmaciaCongelada, setCabeceraFarmaciaCongelada] = useState(false);
  const [historialFarmacia, setHistorialFarmacia] = useState([]);
  const [historialPedidos, setHistorialPedidos] = useState([]);
  const [historialPedidosError, setHistorialPedidosError] = useState('');
  const [historialPedidosLoading, setHistorialPedidosLoading] = useState(false);
  const [historialFarmaciaLoading, setHistorialFarmaciaLoading] = useState(false);
  const [historialFarmaciaError, setHistorialFarmaciaError] = useState('');
  const [comentariosAprobacion, setComentariosAprobacion] = useState({});
  const [aprobandoEntradaId, setAprobandoEntradaId] = useState(null);
  // Abierto por defecto: el reporte operativo era "las bitácoras del mes no se ven"
  const [verHistorialFarmacia, setVerHistorialFarmacia] = useState(true);
  const [verHistorialPedidos, setVerHistorialPedidos] = useState(true);
  const [pedidoMesHistorial, setPedidoMesHistorial] = useState(() =>
    new Date().toLocaleDateString('en-CA').slice(0, 7)
  );
  const [farmaciaMesHistorial, setFarmaciaMesHistorial] = useState(() =>
    new Date().toLocaleDateString('en-CA').slice(0, 7)
  );
  const [pedidoMedicamentoRows, setPedidoMedicamentoRows] = useState([]);
  const [pedidoMedicamentoSearch, setPedidoMedicamentoSearch] = useState('');

  const [sugerenciasMeds, setSugerenciasMeds] = useState([]);
  const [mostrarMeds, setMostrarMeds] = useState(false);
  const [indiceMeds, setIndiceMeds] = useState(-1);
  const [iaLoading, setIaLoading] = useState(false);
  const [catalogoMedsCount, setCatalogoMedsCount] = useState(0);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  // ─── MOBILE PEDIDO NAV ───
  const [pedidoMobileIdx, setPedidoMobileIdx] = useState(0);
  const pedidoCardRefs = useRef([]);

  const showToast = (msg, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, msg, type });
    toastTimerRef.current = setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ─── Carga catálogo sucursales ───
  useEffect(() => {
    const loadSucursales = async () => {
      try {
        const snap = await getDocs(collection(db, 'catalogo_sucursales'));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.activo !== false);
        setCatalogoSucursales(items);
      } catch {}
    };
    loadSucursales();
  }, []);

  // ─── Auto-seleccionar sucursal desde la sesión ───
  useEffect(() => {
    if (sucursalAutoSetRef.current) return;
    if (!catalogoSucursales.length || !sessionSucursal) return;
    // Si ya se pasó una sucursal vía prop (y no está vacía), respetarla
    if (sucursal && sucursal.trim()) return;
    // Si el usuario ya seleccionó manualmente, no sobreescribir
    if (sucursalActiva) return;

    // Buscar en el catálogo la sucursal que coincida con la sesión del usuario
    const matched = catalogoSucursales.find(s => {
      if (String(s.id).trim() === String(sessionSucursal.id).trim()) return true;
      const normName = (sessionSucursal.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const normCatName = ((s.nombre || s.id || '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return normCatName === normName;
    });

    if (matched) {
      setSucursalActiva(matched.nombre || matched.id);
      setFormFarmacia((prev) => ({
        ...prev,
        sucursalDestino: prev.sucursalDestino || matched.nombre || matched.id
      }));
    }
    sucursalAutoSetRef.current = true;
  }, [catalogoSucursales, sessionSucursal, sucursal, sucursalActiva]);

  // ─── Carga medicamentos ───
  useEffect(() => {
    const initData = async () => {
      if (cacheMedicamentosIndex) {
        setCatalogoMedsCount(cacheMedicamentosIndex.length);
        return;
      }
      try {
        const snap = await getDocs(collection(db, 'catalogo_medicamentos'));
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => m.activo !== false)
          .map(toMedicationSearchRow)
          .filter((m) => m.nombreComercial || m.sustanciaActiva);
        if (rows.length > 0) {
          cacheMedicamentosIndex = rows;
          setCatalogoMedsCount(rows.length);
          return;
        }
        const res = await fetch('/data/medicamentos.json');
        if (res.ok) {
          const raw = await res.json();
          cacheMedicamentosIndex = raw.map((m, i) => toMedicationSearchRow({ ...m, id: m.id || `json_${i}` }));
          setCatalogoMedsCount(cacheMedicamentosIndex.length);
        }
      } catch (e) { console.error('Error cargando catalogo_medicamentos', e); }
    };
    initData();
  }, []);

  const [pedidoCategorias, setPedidoCategorias] = useState([]);

  // ─── Catalogo para pedido de medicamento (global) ───
  useEffect(() => {
    let isMounted = true;

    const hydrateRows = (catalogRows) => {
      if (!isMounted) return;
      setPedidoMedicamentoRows((prev) => buildPedidoCaptureRows(catalogRows, prev));
    };

    const loadPedidoCatalog = async () => {
      let catalogRows = [];

      // Load categories for color mapping (global)
      try {
        const catSnap = await getDocs(collection(db, 'catalogo_categorias_pedido'));
        if (isMounted) setPedidoCategorias(catSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}

      try {
        const pedidoSnap = await getDocs(collection(db, 'catalogo_pedido_medicamentos'));
        const rawRows = pedidoSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((item) => item.activo !== false);
        catalogRows = normalizePedidoCatalogRows(rawRows);
      } catch (error) {
        console.error('Error cargando catalogo_pedido_medicamentos:', error);
      }

      if (catalogRows.length === 0) {
        try {
          const response = await fetch('/data/pedido_medicamentos.json');
          if (response.ok) {
            const rawRows = await response.json();
            catalogRows = normalizePedidoCatalogRows(rawRows);
          }
        } catch (error) {
          console.error('Error cargando /data/pedido_medicamentos.json:', error);
        }
      }

      hydrateRows(catalogRows);
    };

    loadPedidoCatalog();
    return () => { isMounted = false; };
  }, []);

  // ─── Buscador autocompletado medicamentos ───
  useEffect(() => {
    const queryText = normalizeText(formFarmacia.compuesto);
    if (queryText.length < 2 || !cacheMedicamentosIndex) {
      setSugerenciasMeds([]);
      setMostrarMeds(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      const ranked = cacheMedicamentosIndex
        .map((m) => ({ m, score: scoreMedicationMatch(m, queryText) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.m.nombreComercial.localeCompare(b.m.nombreComercial, 'es'))
        .slice(0, 15)
        .map((x) => x.m);
      setSugerenciasMeds(ranked);
      setMostrarMeds(ranked.length > 0);
    }, 100);
    return () => clearTimeout(timer);
  }, [formFarmacia.compuesto]);

  // ─── Progreso del día (realtime) ───
  useEffect(() => {
    const hoyStr = new Date().toLocaleDateString('en-CA');
    const q = query(collection(db, 'bitacoras_operativas'), where('fechaString', '==', hoyStr), where('sucursal', '==', sucursalActiva || sucursal));
    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProgresoHoy({
        temp_8: logs.some((l) => l.tipo === 'Temperatura' && l.turno === '8:00 a.m.'),
        temp_16: logs.some((l) => l.tipo === 'Temperatura' && l.turno === '4:00 p.m.'),
        temp_22: logs.some((l) => l.tipo === 'Temperatura' && l.turno === '10:00 p.m.'),
        cloro_1: logs.some((l) => l.tipo === 'Cloro y PH'),
        limpieza: new Set(logs.filter((l) => l.tipo === 'Limpieza').map((l) => l.area)).size,
        pedido_medicamento: logs.some((l) => l.tipo === 'Pedido de medicamento')
      });
    });
    return () => unsub();
  }, [sucursalActiva, sucursal]);

  // ─── IA Factura ───
  const procesarFacturaIA = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIaLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const prompt = `Extrae los datos de esta factura o ticket de medicamentos. 
        Devuelve estrictamente un JSON válido con esta estructura, sin formato Markdown ni texto extra:
        {"factura": "numero", "compuesto": "sustancia o nombre comercial", "lote": "numero", "cantidad": "numero", "caducidad": "YYYY-MM-DD"}`;
        const askGemini = httpsCallable(functions, 'askGemini');
        const result = await askGemini({
          prompt,
          inlineData: base64Data,
          mimeType: file.type || 'image/jpeg'
        });
        let rawText = String(result?.data?.result || '').replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonStart = rawText.indexOf('{');
        const jsonEnd = rawText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          rawText = rawText.substring(jsonStart, jsonEnd + 1);
        }
        const info = JSON.parse(rawText);
        setFormFarmacia(prev => ({
          ...prev,
          factura: info.factura || prev.factura,
          compuesto: info.compuesto || prev.compuesto,
          lote: info.lote || prev.lote,
          cantidad: info.cantidad || prev.cantidad,
          caducidad: info.caducidad || prev.caducidad,
          medicamentoId: '',
          numeroAcomodo: '',
          marca: '',
          laboratorio: ''
        }));
        showToast('Datos extraídos. Selecciona el medicamento del catálogo para confirmar.', 'success');
        setIaLoading(false);
      };
    } catch (err) { setIaLoading(false); showToast("Fallo en el análisis de la imagen. Ingrese datos manualmente.", "error"); }
  };

  const handleBuscadorMedicamentos = (e) => {
    const val = e.target.value;
    setFormFarmacia((prev) => ({
      ...prev,
      compuesto: val,
      medicamentoId: '',
      numeroAcomodo: '',
      marca: '',
      laboratorio: ''
    }));
    setIndiceMeds(-1);
    if (normalizeText(val).length < 2) { setSugerenciasMeds([]); setMostrarMeds(false); }
  };

  const seleccionarMedicamento = (med) => {
    const pres = (med.presentacion || '').toUpperCase();
    const sust = (med.sustanciaActiva || '').toUpperCase();
    const nombre = (med.nombreComercial || '').toUpperCase();
    const blob = `${pres} ${sust} ${nombre}`;

    // Orden crítico: inyectables / IV / IM antes que TAB (evita "Tableta" en presentaciones INYECTABLE)
    let formaInferida = 'Otra';
    if (/\bINYECT|\bINY\b|\bAMPOL|\bAMP\b|\bIV\b|\bIM\b|\bSC\b|\bVIAL\b/.test(blob)) formaInferida = 'Inyectable';
    else if (blob.includes('SUSP')) formaInferida = 'Suspensión';
    else if (blob.includes('JARABE')) formaInferida = 'Jarabe';
    else if (blob.includes('CREM')) formaInferida = 'Crema';
    else if (blob.includes('OVU')) formaInferida = 'Óvulo';
    else if (blob.includes('GEL')) formaInferida = 'Gel';
    else if (/\bSOL(UCION|\.|\b)/.test(blob) && !blob.includes('TAB')) formaInferida = 'Solución';
    else if (blob.includes('CAP') || blob.includes('CAPS')) formaInferida = 'Cápsula';
    else if (blob.includes('TAB') || blob.includes('COMPRIM')) formaInferida = 'Tableta';

    const formaCatalogo = String(med.formaFarmaceutica || med.forma || '').trim();
    // Si la presentación ya indica forma clara, no dejar que el catálogo la pise (caso Tableta vs INYECTABLE)
    if (formaInferida === 'Otra' && formaCatalogo) formaInferida = formaCatalogo;

    const nombreComercial = med.nombreComercial || '';
    const sustanciaActiva = med.sustanciaActiva || '';
    // Functional update: no perder lote/cantidad/caducidad ya capturados
    setFormFarmacia((prev) => ({
      ...prev,
      compuesto: `${nombreComercial} ${sustanciaActiva}`.trim(),
      presentacion: med.presentacion || '',
      forma: formaInferida,
      medicamentoId: med.id || '',
      numeroAcomodo: med.numeroAcomodo || '',
      marca: med.marca || '',
      laboratorio: med.laboratorio || ''
    }));
    setMostrarMeds(false);
    setSugerenciasMeds([]);
  };

  const pedidoMedicamentoRowsFiltrados = useMemo(() => {
    const term = normalizeText(pedidoMedicamentoSearch);
    if (!term) return pedidoMedicamentoRows;
    return pedidoMedicamentoRows.filter((row) =>
      normalizeText(`${row.nombre} ${row.categoria || ''}`).includes(term)
    );
  }, [pedidoMedicamentoRows, pedidoMedicamentoSearch]);

  const filasPedidoConCaptura = useMemo(() => (
    pedidoMedicamentoRows.filter((row) => String(row.fisico || '').trim() !== '' || String(row.pedido || '').trim() !== '')
  ), [pedidoMedicamentoRows]);

  const updatePedidoMedicamentoRow = (id, key, rawValue) => {
    const value = String(rawValue ?? '').replace(/[^0-9.,]/g, '');
    setPedidoMedicamentoRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const limpiarPedidoMedicamento = () => {
    setPedidoMedicamentoRows((prev) => prev.map((row) => ({ ...row, fisico: '', pedido: '' })));
    setPedidoMedicamentoSearch('');
    setPedidoMobileIdx(0);
  };

  const scrollToPedidoCard = (idx) => {
    const rows = pedidoMedicamentoRowsFiltrados;
    if (idx >= 0 && idx < rows.length) {
      setPedidoMobileIdx(idx);
      const card = pedidoCardRefs.current[idx];
      if (card) {
        // Focus first — must be synchronous for iOS keyboard
        const firstInput = card.querySelector('input[inputmode="decimal"]');
        if (firstInput) {
          firstInput.focus();
          firstInput.select();
        }
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // ─── FARMACIA: lote de ítems + cabecera congelada ───
  /** Tras agregar un ítem: deja el mismo MX listo para otro lote (solo limpia lote/cant/cad). */
  const limpiarCamposItemFarmacia = (opts = { cambiarMedicamento: false }) => {
    setFormFarmacia((prev) => {
      const base = {
        ...prev,
        lote: '',
        caducidad: '',
        cantidad: '',
        observaciones: '',
        criterio_empaque: true,
        criterio_etiqueta: true,
        aprobadoMercancia: normalizeMovimientoArea(prev.tipo_movimiento) === 'Recepción' ? prev.aprobadoMercancia : null,
      };
      if (!opts.cambiarMedicamento) return base;
      return {
        ...base,
        compuesto: '',
        presentacion: '',
        forma: '',
        medicamentoId: '',
        numeroAcomodo: '',
        marca: '',
        laboratorio: '',
      };
    });
  };

  const validarCabeceraFarmacia = () => {
    const movimiento = normalizeMovimientoArea(formFarmacia.tipo_movimiento);
    const sucursalDestino = (formFarmacia.sucursalDestino || sucursalActiva || '').trim();
    const sucursalOrigen = (formFarmacia.sucursalOrigen || '').trim();
    if (!sucursalDestino) return 'Indica la sucursal destino del movimiento.';
    if (movimiento === 'Recepción' && !(formFarmacia.proveedor || '').trim()) {
      return 'Indica de quién/de dónde se recibe (proveedor u origen).';
    }
    if ((movimiento === 'Entrada' || movimiento === 'Salida') && !sucursalOrigen) {
      return movimiento === 'Entrada' ? 'Indica de dónde entra el insumo.' : 'Indica de dónde sale el insumo.';
    }
    if (movimiento === 'Recepción' && formFarmacia.aprobadoMercancia !== 'si' && formFarmacia.aprobadoMercancia !== 'no') {
      return 'Indica si la mercancía queda Aprobada: SI o NO.';
    }
    if (movimiento === 'Recepción' && formFarmacia.aprobadoMercancia === 'no') {
      const obs = String(formFarmacia.observaciones || '').trim();
      if (!obs) return 'Si marcas NO aprobado, el comentario/observación es obligatorio.';
    }
    if (
      movimiento === 'Recepción'
      && formFarmacia.aprobadoMercancia === 'no'
      && formFarmacia.criterio_empaque
      && formFarmacia.criterio_etiqueta
    ) {
      return 'ALERTA: criterios de empaque/etiqueta en CUMPLE pero marcaste NO aprobado. Corrige criterios u observación.';
    }
    return null;
  };

  const validarItemFarmacia = () => {
    const compuesto = String(formFarmacia.compuesto || '').trim();
    const lote = String(formFarmacia.lote || '').trim();
    const cantidad = String(formFarmacia.cantidad || '').trim();
    const caducidad = String(formFarmacia.caducidad || '').trim();
    if (!compuesto || !cantidad || !caducidad || !lote) {
      const faltan = [
        !compuesto && 'Compuesto',
        !cantidad && 'Cantidad',
        !lote && 'Lote',
        !caducidad && 'Caducidad',
      ].filter(Boolean);
      return `Falta completar: ${faltan.join(', ')}.`;
    }
    // medicamentoId opcional: permite insumos de factura no catalogados
    return null;
  };

  const buildFarmaciaDetalles = (itemOverride = null) => {
    const src = itemOverride || formFarmacia;
    const movimiento = normalizeMovimientoArea(src.tipo_movimiento || formFarmacia.tipo_movimiento);
    const sucursalDestino = (src.sucursalDestino || formFarmacia.sucursalDestino || sucursalActiva || '').trim();
    const sucursalOrigen = (src.sucursalOrigen || formFarmacia.sucursalOrigen || '').trim();
    const proveedor = (src.proveedor || formFarmacia.proveedor || '').trim();
    return {
      tipo_movimiento: movimiento,
      factura: (src.factura ?? formFarmacia.factura) || '',
      compuesto: src.compuesto || '',
      presentacion: src.presentacion || '',
      forma: src.forma || '',
      lote: src.lote || '',
      caducidad: src.caducidad || '',
      cantidad: src.cantidad || '',
      observaciones: src.observaciones || '',
      criterio_empaque: !!src.criterio_empaque,
      criterio_etiqueta: !!src.criterio_etiqueta,
      aprobadoMercancia: movimiento === 'Recepción' ? (src.aprobadoMercancia ?? formFarmacia.aprobadoMercancia) : null,
      medicamentoId: src.medicamentoId || '',
      numeroAcomodo: src.numeroAcomodo || '',
      marca: src.marca || '',
      laboratorio: src.laboratorio || '',
      sucursalOrigen: movimiento === 'Recepción' ? proveedor : sucursalOrigen,
      sucursalDestino,
      proveedor,
    };
  };

  const handleAgregarItemFarmacia = () => {
    if (!sucursalActiva) return showToast('Seleccione una sucursal antes de agregar.', 'error');
    const errCab = validarCabeceraFarmacia();
    if (errCab) return showToast(errCab, 'error');
    const errItem = validarItemFarmacia();
    if (errItem) return showToast(errItem, 'error');
    const detalles = buildFarmaciaDetalles();
    setLoteFarmaciaItems((prev) => [...prev, { ...detalles, _key: `${Date.now()}_${prev.length}` }]);
    setCabeceraFarmaciaCongelada(true);
    // Conserva el medicamento: factura con 2 lotes del mismo MX se captura seguido
    limpiarCamposItemFarmacia({ cambiarMedicamento: false });
    showToast('Ítem agregado. Captura el otro lote (o cambia de medicamento) y vuelve a agregar.', 'success');
  };

  const handleQuitarItemLote = (key) => {
    setLoteFarmaciaItems((prev) => {
      const next = prev.filter((i) => i._key !== key);
      if (next.length === 0) setCabeceraFarmaciaCongelada(false);
      return next;
    });
  };

  const guardarDocFarmacia = async (detalles) => {
    const movimiento = normalizeMovimientoArea(detalles.tipo_movimiento);
    const sucursalDestino = (detalles.sucursalDestino || '').trim();
    const sucursalOrigen = (detalles.sucursalOrigen || sucursalActiva || '').trim();
    const aprobadoCaptura = detalles.aprobadoMercancia === 'si';
    const rechazoCaptura = detalles.aprobadoMercancia === 'no';
    // Recepción: SI/NO en captura ES la aprobación (evita doble aprobación en jefatura)
    const estadoAprobacion = movimiento === 'Recepción'
      ? (rechazoCaptura ? 'rechazado' : aprobadoCaptura ? 'aprobado' : 'pendiente')
      : (rechazoCaptura ? 'rechazado' : 'pendiente');
    const resolvioEnCaptura = movimiento === 'Recepción' && (aprobadoCaptura || rechazoCaptura);

    // Salida queda en ORIGEN; Entrada/Recepción en DESTINO (evita duplicar en la misma sucursal)
    const sucursalDoc = movimiento === 'Salida'
      ? (sucursalOrigen || sucursalActiva || sucursal || 'Sin asignar')
      : (sucursalDestino || sucursalActiva || sucursal || 'Sin asignar');

    const datosGuardar = {
      fecha: serverTimestamp(),
      fechaString: new Date().toLocaleDateString('en-CA'),
      responsableNombre: enfermeraNombre,
      sucursal: sucursalDoc,
      estado: 'completado',
      tipo: 'Farmacia',
      area: movimiento,
      detalles,
      estadoAprobacion,
      estadoInventario: movimiento === 'Entrada' ? 'pendiente' : null,
      aprobadoPor: resolvioEnCaptura ? (user?.uid || null) : null,
      aprobadoPorNombre: resolvioEnCaptura ? enfermeraNombre : null,
      aprobadoAt: resolvioEnCaptura ? serverTimestamp() : null,
      comentarioAprobacion: rechazoCaptura
        ? (detalles.observaciones || 'Mercancía marcada NO aprobada en captura de recepción.')
        : (aprobadoCaptura && movimiento === 'Recepción' ? 'Aprobado en captura de recepción.' : null),
    };

    const refSalida = await addDoc(collection(db, 'bitacoras_operativas'), datosGuardar);

    // Recepción aprobada → reflejar en caducidades_almacen de la sucursal destino
    if (movimiento === 'Recepción' && aprobadoCaptura && !rechazoCaptura) {
      try {
        const cant = Number(detalles.cantidad) || 0;
        const mesCaducidad = String(detalles.caducidad || '').slice(0, 7);
        const destCad = sucursalDestino || sucursalDoc;
        if (cant > 0 && /^\d{4}-\d{2}$/.test(mesCaducidad) && destCad) {
          const cadSnap = await getDocs(query(
            collection(db, 'caducidades_almacen'),
            where('sucursal', '==', destCad),
            where('mesCaducidad', '==', mesCaducidad)
          ));
          const match = cadSnap.docs.find((d) => {
            const data = d.data() || {};
            if (data.eliminado) return false;
            return String(data.lote || '') === String(detalles.lote || '')
              && (
                (detalles.medicamentoId && data.medicamentoId === detalles.medicamentoId)
                || normalizeText(data.medicamento) === normalizeText(detalles.compuesto)
              );
          });
          if (match) {
            await updateDoc(match.ref, {
              cantidad: (Number(match.data().cantidad) || 0) + cant,
              presentacion: detalles.presentacion || match.data().presentacion || '',
              forma: detalles.forma || match.data().forma || '',
              actualizadoEn: serverTimestamp(),
              actualizadoPor: enfermeraNombre,
            });
          } else {
            await addDoc(collection(db, 'caducidades_almacen'), {
              codigo: detalles.numeroAcomodo || '',
              medicamento: String(detalles.compuesto || '').toUpperCase(),
              presentacion: detalles.presentacion || '',
              forma: detalles.forma || '',
              medicamentoId: detalles.medicamentoId || null,
              cantidad: cant,
              lote: detalles.lote || '',
              mesCaducidad,
              mesLabel: mesCaducidad,
              sucursal: destCad,
              responsableNombre: enfermeraNombre,
              responsableId: user?.uid || null,
              creadoEn: serverTimestamp(),
              origenBitacoraId: refSalida.id,
            });
          }
        }
      } catch (cadErr) {
        console.warn('No se pudo sincronizar caducidades desde recepción', cadErr);
      }
    }

    // Salida: generar Entrada pendiente en destino para que enfermería revise/apruebe e integre
    if (movimiento === 'Salida' && sucursalDestino && !rechazoCaptura) {
      const destino = sucursalDestino;
      const origen = sucursalOrigen;
      const refEntrada = await addDoc(collection(db, 'bitacoras_operativas'), {
        fecha: serverTimestamp(),
        fechaString: new Date().toLocaleDateString('en-CA'),
        responsableNombre: enfermeraNombre,
        sucursal: destino,
        estado: 'completado',
        tipo: 'Farmacia',
        area: 'Entrada',
        origenRecepcionId: refSalida.id,
        estadoAprobacion: 'pendiente',
        estadoInventario: 'pendiente',
        pendienteRecepcionEnfermeria: true,
        aprobadoPor: null,
        aprobadoPorNombre: null,
        aprobadoAt: null,
        comentarioAprobacion: null,
        detalles: {
          ...detalles,
          tipo_movimiento: 'Entrada',
          sucursalOrigen: origen,
          sucursalDestino: destino,
          origenRecepcionId: refSalida.id,
          observaciones: `${detalles.observaciones || ''} [Traspaso desde ${origen}]`.trim(),
        },
      });
      await updateDoc(refSalida, { entradaGeneradaId: refEntrada.id });
    }

    return { id: refSalida.id, aprobadoCaptura };
  };

  // Historial farmacia / pedidos para enfermería (ver + imprimir)
  useEffect(() => {
    if (!sucursalActiva) return;
    if (tipoRegistro !== 'farmacia' && tipoRegistro !== 'pedido_medicamento') return;

    const mesFarmacia = farmaciaMesHistorial || new Date().toLocaleDateString('en-CA').slice(0, 7);
    const mesPedidos = pedidoMesHistorial || mesFarmacia;
    const monthBounds = (mes) => {
      const firstDay = `${mes}-01`;
      const [y, m] = String(mes).split('-').map(Number);
      const lastDay = new Date(y, m, 0).toLocaleDateString('en-CA');
      return { firstDay, lastDay };
    };
    let cancelled = false;

    const aliasesSucursal = [
      sucursalActiva,
      sucursal,
      sessionSucursal?.nombre,
      sessionSucursal?.id,
      user?.sucursal,
      user?.sessionSucursalNombre,
    ].filter(Boolean);

    const pertenecePedidoASucursal = (reg) => {
      if (!aliasesSucursal.length) return true;
      const candidates = [reg.sucursal, reg.detalles?.sucursal, reg.sucursalNombre];
      return candidates.some((c) => aliasesSucursal.some((a) => sameSucursal(c, a)));
    };

    const enrichSalidasConEstadoDestino = async (rows) => {
      const salidas = rows.filter((r) => {
        const area = normalizeMovimientoArea(r.area || r.detalles?.tipo_movimiento);
        return area === 'Salida' && r.entradaGeneradaId;
      });
      if (salidas.length === 0) return rows;

      const estadoBySalidaId = {};
      await Promise.all(salidas.map(async (salida) => {
        try {
          const snap = await getDoc(doc(db, 'bitacoras_operativas', salida.entradaGeneradaId));
          if (snap.exists()) {
            estadoBySalidaId[salida.id] = snap.data()?.estadoAprobacion || 'pendiente';
          } else {
            estadoBySalidaId[salida.id] = 'pendiente';
          }
        } catch {
          estadoBySalidaId[salida.id] = null;
        }
      }));

      return rows.map((r) => (
        estadoBySalidaId[r.id] != null
          ? { ...r, _estadoAprobacionDestino: estadoBySalidaId[r.id] }
          : r
      ));
    };

    if (tipoRegistro === 'farmacia') {
      const { firstDay, lastDay } = monthBounds(mesFarmacia);
      setHistorialFarmaciaLoading(true);
      setHistorialFarmaciaError('');
      let loadSeq = 0;
      // Query simple por tipo (sin rango compuesto) para no depender de índice faltante.
      const qF = query(
        collection(db, 'bitacoras_operativas'),
        where('tipo', '==', 'Farmacia')
      );
      const unsub = onSnapshot(qF, async (snap) => {
        const mySeq = ++loadSeq;
        const allFarma = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => !r.eliminado);

        const delMes = allFarma.filter((r) => {
          const f = String(r.fechaString || '');
          return f >= firstDay && f <= lastDay;
        });

        // Entradas pendientes de ESTA sucursal aunque sean de otro mes (traspasos recientes)
        const pendientesOtrasFechas = allFarma.filter((r) => {
          const area = normalizeMovimientoArea(r.area || r.detalles?.tipo_movimiento);
          if (area !== 'Entrada') return false;
          const pendiente = r.pendienteRecepcionEnfermeria
            || r.estadoAprobacion === 'pendiente'
            || !r.estadoAprobacion;
          if (!pendiente) return false;
          if (!bitacoraPerteneceASucursal(r, sucursalActiva)) return false;
          const f = String(r.fechaString || '');
          return !(f >= firstDay && f <= lastDay);
        });

        let rows = delMes
          .filter((r) => bitacoraPerteneceASucursal(r, sucursalActiva))
          .sort((a, b) => {
            const fa = String(a.fechaString || '');
            const fb = String(b.fechaString || '');
            if (fa !== fb) return fb.localeCompare(fa);
            const facturaA = String(a.detalles?.factura || '');
            const facturaB = String(b.detalles?.factura || '');
            if (facturaA !== facturaB) return facturaA.localeCompare(facturaB, 'es', { numeric: true });
            return String(a.detalles?.compuesto || '').localeCompare(String(b.detalles?.compuesto || ''), 'es');
          });

        // Alias / nombre distinto: no ocultar el mes entero
        let warnSucursal = '';
        if (rows.length === 0 && delMes.length > 0) {
          rows = delMes.sort((a, b) => String(b.fechaString || '').localeCompare(String(a.fechaString || '')));
          warnSucursal = `Se muestran ${delMes.length} bitácora(s) del mes; el nombre “${sucursalActiva}” no coincidió exactamente.`;
        }

        // Pendientes primero (mes + fuera de mes)
        const pendingIds = new Set(pendientesOtrasFechas.map((r) => r.id));
        const merged = [
          ...pendientesOtrasFechas,
          ...rows.filter((r) => !pendingIds.has(r.id)),
        ];
        // Dentro de la lista, entradas pendientes arriba
        merged.sort((a, b) => {
          const pend = (r) => {
            const area = normalizeMovimientoArea(r.area || r.detalles?.tipo_movimiento);
            if (area !== 'Entrada') return 1;
            if (r.pendienteRecepcionEnfermeria || r.estadoAprobacion === 'pendiente' || !r.estadoAprobacion) return 0;
            return 1;
          };
          const d = pend(a) - pend(b);
          if (d !== 0) return d;
          return String(b.fechaString || '').localeCompare(String(a.fechaString || ''));
        });

        try {
          const enriched = await enrichSalidasConEstadoDestino(merged);
          if (cancelled || mySeq !== loadSeq) return;
          setHistorialFarmacia(enriched);
          setHistorialFarmaciaError(warnSucursal);
        } catch (err) {
          console.error('Enrich salidas', err);
          if (cancelled || mySeq !== loadSeq) return;
          setHistorialFarmacia(merged);
          setHistorialFarmaciaError(warnSucursal);
        } finally {
          if (!cancelled && mySeq === loadSeq) setHistorialFarmaciaLoading(false);
        }
      }, (err) => {
        console.error('Historial farmacia', err);
        if (cancelled) return;
        setHistorialFarmaciaLoading(false);
        setHistorialFarmaciaError(
          err?.code === 'failed-precondition'
            ? 'Falta un índice de Firestore para cargar bitácoras. Contacta a soporte.'
            : 'No se pudieron cargar las bitácoras del mes.'
        );
      });
      return () => {
        cancelled = true;
        unsub();
      };
    }

    // Pedidos: mismo patrón (sin índice compuesto). No vaciar lista en error → evita flash "con datos → Sin pedidos".
    const { firstDay, lastDay } = monthBounds(mesPedidos);
    setHistorialPedidosLoading(true);
    setHistorialPedidosError('');
    const qP = query(
      collection(db, 'bitacoras_operativas'),
      where('tipo', '==', 'Pedido de medicamento')
    );
    const unsubP = onSnapshot(qP, (snap) => {
      if (cancelled) return;
      const delMes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => {
          const f = String(r.fechaString || '');
          return f >= firstDay && f <= lastDay;
        });
      let rows = delMes
        .filter((r) => pertenecePedidoASucursal(r))
        .sort((a, b) => String(b.fechaString || '').localeCompare(String(a.fechaString || '')));

      // Si el nombre de sucursal no matchea (legacy / alias), no ocultar el mes entero:
      // muestra del mes y avisa.
      if (rows.length === 0 && delMes.length > 0) {
        rows = delMes.sort((a, b) => String(b.fechaString || '').localeCompare(String(a.fechaString || '')));
        setHistorialPedidosError(
          `Se muestran ${delMes.length} pedido(s) del mes; el nombre de sucursal no coincidió exactamente con “${sucursalActiva}”.`
        );
      } else {
        setHistorialPedidosError('');
      }
      setHistorialPedidos(rows);
      setHistorialPedidosLoading(false);
    }, (err) => {
      console.error('Historial pedidos', err);
      if (cancelled) return;
      setHistorialPedidosLoading(false);
      setHistorialPedidosError(
        err?.code === 'failed-precondition'
          ? 'Falta un índice de Firestore para cargar pedidos. Contacta a soporte.'
          : 'No se pudieron cargar los pedidos del mes.'
      );
    });
    return () => {
      cancelled = true;
      unsubP();
    };
  }, [sucursalActiva, tipoRegistro, pedidoMesHistorial, farmaciaMesHistorial, sucursal, sessionSucursal, user?.sucursal, user?.sessionSucursalNombre]);

  const handlePrintFarmaciaHistorial = () => {
    if (historialFarmaciaLoading) {
      showToast('Aún se están cargando las bitácoras. Espera un momento.', 'warning');
      return;
    }
    if (historialFarmaciaError) {
      showToast(historialFarmaciaError, 'error');
      return;
    }
    if (!historialFarmacia.length) {
      showToast(`No hay bitácoras este mes para ${sucursalActiva || 'esta sucursal'}.`, 'warning');
      return;
    }
    setVerHistorialFarmacia(true);
    // Orden: fecha → factura (misma factura junta) → compuesto
    const ordenados = [...historialFarmacia].sort((a, b) => {
      const fa = String(a.fechaString || '');
      const fb = String(b.fechaString || '');
      if (fa !== fb) return fa.localeCompare(fb);
      const facturaA = String(a.detalles?.factura || '');
      const facturaB = String(b.detalles?.factura || '');
      if (facturaA !== facturaB) return facturaA.localeCompare(facturaB, 'es', { numeric: true });
      return String(a.detalles?.compuesto || '').localeCompare(String(b.detalles?.compuesto || ''), 'es');
    });
    const rows = ordenados.map((r, i) => {
      const d = r.detalles || {};
      const areaNorm = normalizeMovimientoArea(r.area || d.tipo_movimiento);
      const estadoPrint = areaNorm === 'Salida'
        ? (r._estadoAprobacionDestino || 'pendiente')
        : (r.estadoAprobacion || 'pendiente');
      const ap = labelEstadoAprobacion(estadoPrint);
      const emp = criterioBool(d, 'criterio_empaque', ['empaque']);
      const eti = criterioBool(d, 'criterio_etiqueta', ['etiqueta']);
      const mark = (v) => (v === true ? '✓' : v === false ? '✗' : '—');
      return `<tr style="${i % 2 ? 'background:#f8fafc' : ''}">
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px">${formatFechaMx(r.fechaString)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px">${d.factura || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px">${d.compuesto || ''}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px;text-align:center">${d.cantidad || ''}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px">${d.lote || ''}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px;text-align:center">${formatCaducidadCorta(d.caducidad)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px;text-align:center">${mark(emp)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px;text-align:center">${mark(eti)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px;font-weight:700">${ap}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:11px">${r.responsableNombre || r.aprobadoPorNombre || ''}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;font-size:10px">${r.comentarioAprobacion || d.observaciones || ''}</td>
      </tr>`;
    }).join('');
    // Sin noopener: con noopener window.open() devuelve null y no se puede escribir/imprimir
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) {
      showToast('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.', 'error');
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Bitácoras farmacia — ${sucursalActiva || ''}</title>
      <style>body{font-family:system-ui,sans-serif;padding:16px}table{width:100%;border-collapse:collapse}
      th{background:#1e293b;color:#fff;padding:6px 8px;font-size:10px;text-transform:uppercase}@media print{button{display:none}}</style></head><body>
      <h2 style="margin:0 0 4px">Bitácoras recepción / entradas / salidas</h2>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px">Sucursal: <strong>${sucursalActiva || '—'}</strong> — ${farmaciaMesHistorial} — ${new Date().toLocaleDateString('es-MX')}</p>
      <table><thead><tr>
        <th>Fecha</th><th>Factura</th><th>Compuesto</th><th>Cant.</th><th>Lote</th><th>Caducidad</th>
        <th>Empaque</th><th>Etiqueta</th><th>Aprobado</th><th>Recibió</th><th>Coment.</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="11" style="padding:12px;text-align:center">Sin registros</td></tr>'}</tbody></table>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="background:#1e293b;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:700">Imprimir</button></div>
      </body></html>`);
    w.document.close();
  };

  const handleAprobarEntradaEnfermeria = async (reg, decision, comentario = '') => {
    if (!reg?.id) return;
    if (decision === 'rechazado' && !String(comentario || '').trim()) {
      showToast('El comentario es obligatorio si no apruebas la mercancía.', 'error');
      return;
    }
    setAprobandoEntradaId(reg.id);
    try {
      await updateDoc(doc(db, 'bitacoras_operativas', reg.id), {
        estadoAprobacion: decision,
        aprobadoPor: user?.uid || null,
        aprobadoPorNombre: enfermeraNombre,
        aprobadoAt: serverTimestamp(),
        comentarioAprobacion: comentario || (decision === 'rechazado' ? 'Pendiente / incompleto según enfermería' : 'Recibido completo'),
        pendienteRecepcionEnfermeria: false,
      });
      setComentariosAprobacion((prev) => {
        const next = { ...prev };
        delete next[reg.id];
        return next;
      });
      showToast(
        decision === 'aprobado'
          ? 'Entrada aprobada. Ahora puedes aceptar e integrar al inventario.'
          : 'Entrada marcada como no aprobada.',
        decision === 'aprobado' ? 'success' : 'warning'
      );
    } catch {
      showToast('No se pudo actualizar la entrada.', 'error');
    } finally {
      setAprobandoEntradaId(null);
    }
  };

  const handleIntegrarInventarioEnfermeria = async (reg) => {
    if (!reg?.id) return;
    if (reg.estadoInventario === 'integrado') {
      showToast('Esta entrada ya está integrada.', 'warning');
      return;
    }
    if (reg.estadoAprobacion !== 'aprobado') {
      showToast('Primero aprueba la entrada (Aceptar) antes de integrar.', 'warning');
      return;
    }
    const det = reg.detalles || {};
    const cantidad = Number(det.cantidad) || 0;
    if (!cantidad) {
      showToast('La entrada no tiene cantidad válida.', 'error');
      return;
    }
    const sucursalDestino = det.sucursalDestino || reg.sucursal || sucursalActiva || '';
    setIntegrandoId(reg.id);
    try {
      let invDoc = null;
      if (det.medicamentoId) {
        const invSnap = await getDocs(query(
          collection(db, 'inventario'),
          where('medicamentoId', '==', det.medicamentoId)
        ));
        invDoc = invSnap.docs.find((d) => {
          const data = d.data() || {};
          return String(data.lote || '') === String(det.lote || '')
            && sameSucursal(data.sucursal || data.sucursalNombre, sucursalDestino);
        }) || null;
      }

      if (invDoc) {
        await updateDoc(invDoc.ref, {
          stock: increment(cantidad),
          existencias: increment(cantidad),
          caducidad: det.caducidad || invDoc.data().caducidad || null,
          actualizadoAt: serverTimestamp(),
          actualizadoPor: enfermeraNombre,
        });
      } else {
        await addDoc(collection(db, 'inventario'), {
          medicamentoId: det.medicamentoId || null,
          medicamento: det.compuesto || '',
          nombreComercial: det.compuesto || '',
          descripcion: det.compuesto || '',
          presentacion: det.presentacion || '',
          forma: det.forma || '',
          lote: det.lote || '',
          caducidad: det.caducidad || null,
          stock: cantidad,
          existencias: cantidad,
          sucursal: sucursalDestino,
          sucursalNombre: sucursalDestino,
          numeroAcomodo: det.numeroAcomodo || '',
          marca: det.marca || '',
          laboratorio: det.laboratorio || '',
          activo: true,
          origenBitacoraId: reg.id,
          creadoAt: serverTimestamp(),
          creadoPor: enfermeraNombre,
        });
      }

      await updateDoc(doc(db, 'bitacoras_operativas', reg.id), {
        estadoInventario: 'integrado',
        integradoAt: serverTimestamp(),
        integradoPor: user?.uid || null,
        integradoPorNombre: enfermeraNombre,
      });

      // Sync caducidades destino
      try {
        const mesCaducidad = String(det.caducidad || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(mesCaducidad) && sucursalDestino) {
          const cadSnap = await getDocs(query(
            collection(db, 'caducidades_almacen'),
            where('sucursal', '==', sucursalDestino),
            where('mesCaducidad', '==', mesCaducidad)
          ));
          const match = cadSnap.docs.find((d) => {
            const data = d.data() || {};
            if (data.eliminado) return false;
            return String(data.lote || '') === String(det.lote || '')
              && (
                (det.medicamentoId && data.medicamentoId === det.medicamentoId)
                || normalizeText(data.medicamento) === normalizeText(det.compuesto)
              );
          });
          if (match) {
            await updateDoc(match.ref, {
              cantidad: (Number(match.data().cantidad) || 0) + cantidad,
              presentacion: det.presentacion || match.data().presentacion || '',
              forma: det.forma || match.data().forma || '',
              actualizadoEn: serverTimestamp(),
              actualizadoPor: enfermeraNombre,
            });
          } else {
            await addDoc(collection(db, 'caducidades_almacen'), {
              codigo: det.numeroAcomodo || '',
              medicamento: String(det.compuesto || '').toUpperCase(),
              presentacion: det.presentacion || '',
              forma: det.forma || '',
              medicamentoId: det.medicamentoId || null,
              cantidad,
              lote: det.lote || '',
              mesCaducidad,
              mesLabel: mesCaducidad,
              sucursal: sucursalDestino,
              responsableNombre: enfermeraNombre,
              responsableId: user?.uid || null,
              creadoEn: serverTimestamp(),
              origenBitacoraId: reg.id,
            });
          }
        }
      } catch (cadErr) {
        console.warn('caducidades sync', cadErr);
      }

      showToast('Entrada integrada al inventario de tu sucursal.', 'success');
    } catch (err) {
      console.error(err);
      showToast('No se pudo integrar al inventario.', 'error');
    } finally {
      setIntegrandoId(null);
    }
  };

  // Alerta de horario faltante temp/cloro
  const alertaHorarioFaltante = useMemo(() => {
    if (!sucursalActiva) return null;
    const hora = new Date().getHours();
    const msgs = [];
    if (hora >= 9 && hora < 16 && !progresoHoy.temp_8) msgs.push('Falta temperatura del turno 8:00 a.m.');
    if (hora >= 17 && hora < 22 && !progresoHoy.temp_16) msgs.push('Falta temperatura del turno 4:00 p.m.');
    if ((hora >= 22 || hora < 6) && !progresoHoy.temp_22) msgs.push('Falta temperatura del turno 10:00 p.m.');
    if (hora >= 10 && !progresoHoy.cloro_1) msgs.push('Falta registro de Cloro y PH de hoy.');
    return msgs.length ? msgs : null;
  }, [sucursalActiva, progresoHoy]);

  // ─── GUARDAR ───
  const handleGuardar = async () => {
    if (!sucursalActiva) { showToast("Seleccione una sucursal antes de guardar.", "error"); return; }
    setLoading(true);
    try {
      let datosGuardar = { fecha: serverTimestamp(), fechaString: new Date().toLocaleDateString('en-CA'), responsableNombre: enfermeraNombre, sucursal: sucursalActiva || sucursal || 'Sin asignar', estado: 'completado' };
      if (tipoRegistro === 'temperatura') {
        if (!formTemp.t_ext || !formTemp.t_ref || !formTemp.humedad) { setLoading(false); return showToast("Faltan datos de temperatura o humedad.", "error"); }
        const turnosBloqueados = {
          '8:00 a.m.': progresoHoy.temp_8,
          '4:00 p.m.': progresoHoy.temp_16,
          '10:00 p.m.': progresoHoy.temp_22
        };
        if (turnosBloqueados[formTemp.turno]) { setLoading(false); return showToast(`El turno ${formTemp.turno} ya fue registrado hoy en esta sucursal.`, "error"); }
        datosGuardar = { ...datosGuardar, tipo: 'Temperatura', area: 'Red de Frío', turno: formTemp.turno, detalles: formTemp };
      } else if (tipoRegistro === 'cloro') {
        if (progresoHoy.cloro_1) { setLoading(false); return showToast("El registro de Cloro y PH ya fue realizado hoy en esta sucursal.", "error"); }
        if (!formCloro.ph_1 || !formCloro.cloro_1 || !formCloro.ph_2 || !formCloro.cloro_2) { setLoading(false); return showToast("Complete todos los campos de ambas estaciones de lavado.", "error"); }
        datosGuardar = { ...datosGuardar, tipo: 'Cloro y PH', area: 'Estaciones de Lavado', detalles: formCloro };
      } else if (tipoRegistro === 'limpieza') {
        if (!Object.values(formLimpieza.tareas).some(v => v === true)) { setLoading(false); return showToast("Marque al menos una tarea realizada.", "error"); }
        datosGuardar = { ...datosGuardar, tipo: 'Limpieza', area: formLimpieza.area, detalles: formLimpieza.tareas };
      } else if (tipoRegistro === 'farmacia') {
        // Guardar lote completo (ítems agregados + ítem actual si está completo)
        const errCab = validarCabeceraFarmacia();
        if (errCab) { setLoading(false); return showToast(errCab, 'error'); }

        const items = [...loteFarmaciaItems];
        const errItem = validarItemFarmacia();
        if (!errItem) {
          items.push({ ...buildFarmaciaDetalles(), _key: `cur_${items.length}` });
        } else if (items.length === 0) {
          setLoading(false);
          return showToast(errItem, 'error');
        }

        for (const item of items) {
          const { _key, ...det } = item;
          await guardarDocFarmacia(det);
        }
        showToast(
          items.length > 1
            ? `${items.length} movimientos guardados en el lote.`
            : 'Registro guardado exitosamente.',
          'success'
        );
        setLoteFarmaciaItems([]);
        setCabeceraFarmaciaCongelada(false);
        setFormFarmacia({
          ...formFarmaciaInicial,
          tipo_movimiento: formFarmacia.tipo_movimiento,
          sucursalDestino: formFarmacia.sucursalDestino || sucursalActiva || '',
        });
        setLoading(false);
        return;
      } else if (tipoRegistro === 'pedido_medicamento') {
        if (pedidoMedicamentoRows.length === 0) {
          setLoading(false);
          return showToast('No hay catalogo de medicamentos/insumos para capturar el pedido.', 'error');
        }
        if (filasPedidoConCaptura.length === 0) {
          setLoading(false);
          return showToast('Capture al menos un valor en Fisico o Pedido.', 'error');
        }

        const detalleFilas = filasPedidoConCaptura.map((row) => ({
          insumo: row.nombre,
          categoria: row.categoria || '',
          fisico: String(row.fisico || '').trim(),
          pedido: String(row.pedido || '').trim(),
          resolucion: null, // proveedor | traspaso | pendiente (lo marca jefatura)
        }));

        datosGuardar = {
          ...datosGuardar,
          tipo: 'Pedido de medicamento',
          area: 'Farmacia',
          detalles: {
            totalCapturados: detalleFilas.length,
            filas: detalleFilas
          }
        };
      }
      await addDoc(collection(db, "bitacoras_operativas"), datosGuardar);
      showToast("Registro guardado exitosamente.", "success");
      if (tipoRegistro === 'farmacia') setFormFarmacia(formFarmaciaInicial);
      if (tipoRegistro === 'temperatura') setFormTemp({ ...formTemp, t_ext: '', humedad: '', t_ref: '' });
      if (tipoRegistro === 'cloro') setFormCloro({ ph_1: '', cloro_1: '', ph_2: '', cloro_2: '' });
      if (tipoRegistro === 'limpieza') setFormLimpieza({ ...formLimpieza, tareas: { col1: false, col2: false, col3: false, col4: false } });
      if (tipoRegistro === 'pedido_medicamento') limpiarPedidoMedicamento();
    } catch (error) { showToast("Error de conexión al guardar el registro.", "error"); }
    setLoading(false);
  };

  // ─── Imprimir temperaturas del mes ───
  const handlePrintTemperaturas = async () => {
    setPrintTempLoading(true);
    try {
      const [year, month] = printTempMonth.split('-');
      const firstDay = `${year}-${month}-01`;
      const lastDayDate = new Date(Number(year), Number(month), 0);
      const lastDay = lastDayDate.toLocaleDateString('en-CA');
      const totalDias = lastDayDate.getDate();

      const q = query(
        collection(db, 'bitacoras_operativas'),
        where('fechaString', '>=', firstDay),
        where('fechaString', '<=', lastDay),
        where('tipo', '==', 'Temperatura'),
        where('sucursal', '==', sucursalActiva || sucursal || '')
      );
      const snap = await getDocs(q);
      const registros = snap.docs.map(d => d.data());

      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const mesLabel = `${MESES[Number(month) - 1]} ${year}`;
      const sucLabel = sucursalActiva || sucursal || '';

      const rows = [];
      for (let dia = 1; dia <= totalDias; dia++) {
        const fStr = `${year}-${String(month).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const reg8 = registros.find(r => r.fechaString === fStr && r.turno?.includes('8:00'));
        const reg4 = registros.find(r => r.fechaString === fStr && r.turno?.includes('4:00'));
        const reg10 = registros.find(r => r.fechaString === fStr && r.turno?.includes('10:00'));
        const t8 = reg8?.detalles || {};
        const t4 = reg4?.detalles || {};
        const t10 = reg10?.detalles || {};
        const val = (v) => (v !== undefined && v !== null && String(v) !== '0' && String(v) !== '' ? v : '');
        rows.push(`
          <tr style="background:#f2f2f2">
            <td class="fecha">${dia} ${mesLabel}</td>
            <td>${val(t8.t_ext)}</td><td>${val(t8.humedad)}</td><td>${val(t8.t_ref)}</td>
            <td>${val(t4.t_ext)}</td><td>${val(t4.humedad)}</td><td>${val(t4.t_ref)}</td>
            <td>${val(t10.t_ext)}</td><td>${val(t10.humedad)}</td><td>${val(t10.t_ref)}</td>
          </tr>
        `);
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Temperaturas ${mesLabel}</title>
        <style>
          body{font-family:system-ui,sans-serif;padding:4px;color:#1e293b}
          @media print{body{margin:3mm}@page{size:landscape;margin:5mm}}
          table{width:100%;border-collapse:collapse;border:2px solid #666}
          th{border:1px solid #888;background:#d9d9d9;font-weight:bold;font-size:8px;text-transform:uppercase;text-align:center;padding:2px}
          td{border:1px solid #888;font-size:8px;text-align:center;padding:2px;height:16px}
          td.fecha{text-align:left;font-weight:500;padding-left:4px}
          @media print{button{display:none!important}}
        </style></head><body>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
           <img src="${logoImg}" style="height:40px" alt="Logo"/>
           <h1 style="font-size:20px;font-weight:700;color:#1e293b;text-align:center;flex:1;padding-right:40px;margin:0">Centro Medico Santa Cruz</h1>
        </div>
        <div style="background:#ffff00;padding:2px 0;border-top:2px solid #475569;border-bottom:2px solid #475569;text-align:center;margin-bottom:2px">
           <h2 style="font-size:12px;font-weight:700;color:#000;margin:0">Bitacora de Temperaturas</h2>
        </div>
        <div style="text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:4px">
           <span>MES: ${mesLabel.toUpperCase()}</span> &nbsp;&nbsp;&nbsp; <span>SUC. ${sucLabel.toUpperCase()}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width:130px">Fecha</th>
              <th colspan="3">8:00 a.m.</th>
              <th colspan="3">4:00 p.m.</th>
              <th colspan="3">10:00 p.m.</th>
            </tr>
            <tr>
              <th>T° Ext.</th><th>Hum %</th><th>T° Ref.</th>
              <th>T° Ext.</th><th>Hum %</th><th>T° Ref.</th>
              <th>T° Ext.</th><th>Hum %</th><th>T° Ref.</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
        <p style="margin-top:8px;font-size:8px;color:#94a3b8;text-align:right">Impreso: ${new Date().toLocaleString('es-MX')} — Suc. ${sucLabel}</p>
        <div style="text-align:center;margin-top:8px"><button onclick="window.print()" style="background:#1e293b;color:#fff;border:none;padding:6px 16px;border-radius:6px;font-size:11px;cursor:pointer">Imprimir</button></div>
        </body></html>`;

      const w = window.open('', '_blank', 'width=1100,height=800');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e) {
      console.error('Error imprimiendo temperaturas:', e);
      showToast('Error al cargar datos para impresion.', 'error');
    }
    setPrintTempLoading(false);
  };

  const handlePrintCloro = async () => {
    setPrintCloroLoading(true);
    try {
      const [year, month] = printCloroMonth.split('-');
      const firstDay = `${year}-${month}-01`;
      const lastDayDate = new Date(Number(year), Number(month), 0);
      const lastDay = lastDayDate.toLocaleDateString('en-CA');
      const totalDias = lastDayDate.getDate();

      const q = query(
        collection(db, 'bitacoras_operativas'),
        where('fechaString', '>=', firstDay),
        where('fechaString', '<=', lastDay),
        where('tipo', '==', 'Cloro y PH'),
        where('sucursal', '==', sucursalActiva || sucursal || '')
      );
      const snap = await getDocs(q);
      const registros = snap.docs.map(d => d.data());

      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const mesLabel = `${MESES[Number(month) - 1]} ${year}`;
      const sucLabel = sucursalActiva || sucursal || '';

      const rows = [];
      for (let dia = 1; dia <= totalDias; dia++) {
        const fStr = `${year}-${String(month).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const reg = registros.find(r => r.fechaString === fStr);
        const det = reg?.detalles || {};
        const val = (v) => (v !== undefined && v !== null && v !== '' ? v : '');
        rows.push(`
          <tr style="background:#f2f2f2">
            <td class="fecha">${dia} ${mesLabel}</td>
            <td>${val(det.ph_1)}</td><td>${val(det.cloro_1)}</td>
            <td>${val(det.ph_2)}</td><td>${val(det.cloro_2)}</td>
            <td>${reg?.responsableNombre || ''}</td>
          </tr>
        `);
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cloro y PH ${mesLabel}</title>
        <style>
          body{font-family:system-ui,sans-serif;padding:4px;color:#1e293b}
          @media print{body{margin:3mm}@page{size:landscape;margin:5mm}}
          table{width:100%;border-collapse:collapse;border:2px solid #666}
          th{border:1px solid #888;background:#d9d9d9;font-weight:bold;font-size:8px;text-transform:uppercase;text-align:center;padding:2px}
          td{border:1px solid #888;font-size:8px;text-align:center;padding:2px;height:16px}
          td.fecha{text-align:left;font-weight:500;padding-left:4px}
          @media print{button{display:none!important}}
        </style></head><body>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
           <img src="${logoImg}" style="height:40px" alt="Logo"/>
           <h1 style="font-size:20px;font-weight:700;color:#1e293b;text-align:center;flex:1;padding-right:40px;margin:0">Centro Medico Santa Cruz</h1>
        </div>
        <div style="background:#ffff00;padding:2px 0;border-top:2px solid #475569;border-bottom:2px solid #475569;text-align:center;margin-bottom:2px">
           <h2 style="font-size:12px;font-weight:700;color:#000;margin:0">Bitacora de Cloro y PH — Estaciones de Lavado de Manos</h2>
        </div>
        <div style="text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:4px">
           <span>MES: ${mesLabel.toUpperCase()}</span> &nbsp;&nbsp;&nbsp; <span>SUC. ${sucLabel.toUpperCase()}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width:130px">Fecha</th>
              <th colspan="2">Lavado de Manos 1</th>
              <th colspan="2">Lavado de Manos 2</th>
              <th rowspan="2" style="width:130px">Realizo</th>
            </tr>
            <tr>
              <th>PH</th><th>Cloro</th>
              <th>PH</th><th>Cloro</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
        <p style="margin-top:8px;font-size:8px;color:#94a3b8;text-align:right">Impreso: ${new Date().toLocaleString('es-MX')} — Suc. ${sucLabel}</p>
        <div style="text-align:center;margin-top:8px"><button onclick="window.print()" style="background:#1e293b;color:#fff;border:none;padding:6px 16px;border-radius:6px;font-size:11px;cursor:pointer">Imprimir</button></div>
        </body></html>`;

      const w = window.open('', '_blank', 'width=1100,height=800');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e) {
      console.error('Error imprimiendo cloro:', e);
      showToast('Error al cargar datos para impresion.', 'error');
    }
    setPrintCloroLoading(false);
  };

  // ─── Progreso count ───
  const progresoItems = [
    { label: 'Temp. 8 AM', done: progresoHoy.temp_8 },
    { label: 'Temp. 4 PM', done: progresoHoy.temp_16 },
    { label: 'Temp. 10 PM', done: progresoHoy.temp_22 },
    { label: 'Cloro y PH', done: progresoHoy.cloro_1 },
    { label: 'Pedido meds', done: progresoHoy.pedido_medicamento },
    { label: `Limpieza ${progresoHoy.limpieza}/7`, done: progresoHoy.limpieza >= 7 },
  ];
  const progresoTotal = progresoItems.filter(i => i.done).length;

  const activeTab = REGISTRO_TABS.find(t => t.id === tipoRegistro);

  const turnoTempBloqueado = tipoRegistro === 'temperatura' && (
    (formTemp.turno === '8:00 a.m.' && progresoHoy.temp_8) ||
    (formTemp.turno === '4:00 p.m.' && progresoHoy.temp_16) ||
    (formTemp.turno === '10:00 p.m.' && progresoHoy.temp_22)
  );

  const entradasPendientesAprobar = useMemo(() => (
    historialFarmacia.filter((r) => {
      const area = normalizeMovimientoArea(r.area || r.detalles?.tipo_movimiento);
      if (area !== 'Entrada') return false;
      const enMi = sameSucursal(r.sucursal, sucursalActiva)
        || sameSucursal(r.detalles?.sucursalDestino, sucursalActiva);
      if (!enMi) return false;
      return r.pendienteRecepcionEnfermeria
        || r.estadoAprobacion === 'pendiente'
        || !r.estadoAprobacion;
    })
  ), [historialFarmacia, sucursalActiva]);

  const rootClass = standalone
    ? "min-h-screen bg-slate-50 flex flex-col text-slate-700"
    : "fixed inset-0 z-[500] flex items-stretch text-slate-700";

  const contentWrapClass = tipoRegistro === 'carro_rojo' || tipoRegistro === 'bitacora_px' || tipoRegistro === 'krit' || tipoRegistro === 'autoclave'
    ? 'flex-1 min-h-0 overflow-hidden overflow-x-hidden flex flex-col'
    : 'flex-1 overflow-y-auto overflow-x-hidden flex flex-col px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5';
  
  const inputBase = "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all";
  const labelBase = "text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block";

  const BADGE_COLORS = {
    rose: 'bg-rose-100 text-rose-800 border-rose-300',
    lime: 'bg-lime-100 text-lime-900 border-lime-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    violet: 'bg-violet-100 text-violet-800 border-violet-300',
    cyan: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    pink: 'bg-pink-100 text-pink-800 border-pink-300',
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
  };

  const INPUT_COLORS = {
    rose: 'border-rose-300 focus:border-rose-500 focus:ring-rose-50',
    lime: 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-50',
    blue: 'border-blue-300 focus:border-blue-500 focus:ring-blue-50',
    amber: 'border-amber-300 focus:border-amber-500 focus:ring-amber-50',
    violet: 'border-violet-300 focus:border-violet-500 focus:ring-violet-50',
    cyan: 'border-cyan-300 focus:border-cyan-500 focus:ring-cyan-50',
    orange: 'border-orange-300 focus:border-orange-500 focus:ring-orange-50',
    emerald: 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-50',
    pink: 'border-pink-300 focus:border-pink-500 focus:ring-pink-50',
    slate: 'border-slate-300 focus:border-slate-500 focus:ring-slate-50',
  };

  const getCatBadgeClasses = (catNombre) => {
    const cat = pedidoCategorias.find(c => normalizeText(c.nombre) === normalizeText(catNombre));
    const colorId = cat?.color || 'slate';
    return {
      badge: BADGE_COLORS[colorId] || BADGE_COLORS.slate,
      input: INPUT_COLORS[colorId] || INPUT_COLORS.slate,
    };
  };

  return (
    <div className={rootClass}>
      {!standalone && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />}

      {toast.show && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg border backdrop-blur-md ${
          toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700' : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      <div className={`relative flex flex-col w-full ${standalone ? 'flex-1 min-h-0' : 'h-full'} z-10`}>

        {/* Drawer de pestañas: portal al body para quedar por encima del rail AppShell (z-40) */}
        {typeof document !== 'undefined' && createPortal(
          <>
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-[620] transition-opacity"
                onClick={() => setSidebarOpen(false)}
                aria-hidden
              />
            )}
            <aside
              className={`fixed top-0 left-0 h-full w-[min(280px,85vw)] bg-white border-r border-slate-200 z-[630] flex flex-col shadow-2xl shadow-slate-900/10 transition-transform duration-300 ease-out ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
              }`}
              aria-hidden={!sidebarOpen}
            >
              <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-blue-500/25">
                    <Activity size={18}/>
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-slate-800 leading-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Bitácoras</h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-0.5"><MapPin size={9}/> {sucursalActiva || 'Sin sucursal'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSidebarOpen(false)} className="p-2 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <X size={18}/>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {REGISTRO_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tipoRegistro === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => { setTipoRegistro(tab.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-semibold transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : tab.id === 'carro_rojo'
                            ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-100'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : tab.id === 'carro_rojo' ? 'text-rose-400' : 'text-slate-400'}`}/>
                      <span className="truncate text-left">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="px-5 py-4 border-t border-slate-100 bg-gradient-to-t from-slate-50 to-white">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progreso del día</p>
                  <span className="text-[11px] font-bold text-blue-600">{progresoTotal}/{progresoItems.length}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full mb-3.5 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${(progresoTotal / progresoItems.length) * 100}%` }} />
                </div>
                <div className="space-y-1.5">
                  {progresoItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className={`text-[12px] font-semibold ${item.done ? 'text-emerald-600' : 'text-slate-400'}`}>{item.label}</span>
                      {item.done
                        ? <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center"><Check size={12} className="text-emerald-600"/></div>
                        : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                      }
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </>,
          document.body
        )}

        {/* ── PANEL PRINCIPAL ── */}
  <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-50 overflow-hidden">
          <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="p-1.5 sm:p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0" title="Abrir panel de navegación">
                <Menu size={18} className="sm:w-5 sm:h-5"/>
              </button>
              {activeTab && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 shrink-0">
                  <activeTab.icon size={14} className="sm:w-4 sm:h-4"/>
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[13px] sm:text-[16px] font-bold text-slate-800 truncate" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                  {activeTab?.label || 'Registros'}
                </h1>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">{enfermeraNombre} • {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <div className="flex items-center gap-1">
                <MapPin size={12} className={`sm:w-3.5 sm:h-3.5 ${sucursalActiva ? 'text-blue-500' : 'text-amber-500 animate-pulse'} hidden sm:block`}/>
                {puedeCambiarSucursal ? (
                  <select
                    value={sucursalActiva}
                    onChange={(e) => setSucursalActiva(e.target.value)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold outline-none focus:ring-2 transition-all max-w-[110px] sm:max-w-[160px] ${
                      sucursalActiva
                        ? 'bg-blue-50 border border-blue-200 text-blue-700 focus:ring-blue-100'
                        : 'bg-amber-50 border-2 border-amber-400 text-amber-700 focus:ring-amber-100'
                    }`}
                  >
                    <option value="">Seleccione...</option>
                    {catalogoSucursales.map(s => (
                      <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>
                    ))}
                  </select>
                ) : (
                  <span
                    className="px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-700 max-w-[140px] sm:max-w-[180px] truncate"
                    title="Tu sucursal de sesión (no se puede cambiar en pedido/registros)"
                  >
                    {sucursalActiva || 'Sin sucursal'}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-1 mr-1">
                {progresoItems.map((item, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-colors ${item.done ? 'bg-emerald-500' : 'bg-slate-200'}`} title={item.label}/>
                ))}
              </div>
              <button onClick={onClose}
                className="p-2 sm:px-3.5 sm:py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-200 transition-all flex items-center gap-2">
                <X size={15}/> <span className="hidden sm:inline text-xs font-bold">{standalone ? 'Volver' : 'Cerrar'}</span>
              </button>
            </div>
          </header>

          {!sucursalActiva && catalogoSucursales.length > 0 && (
            <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500 shrink-0"/>
              <p className="text-[11px] sm:text-[12px] font-semibold text-amber-700">Seleccione la sucursal donde se registrara la bitacora.</p>
            </div>
          )}

          {/* ─── SCROLLABLE CONTENT ─── */}
          <div className={contentWrapClass}>

            {/* ════ FARMACIA ════ */}
            {tipoRegistro === 'farmacia' && (
              <div className="flex flex-col gap-5 flex-1 max-w-5xl w-full mx-auto">
                {alertaHorarioFaltante && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
                    <Bell size={16} className="shrink-0 mt-0.5"/>
                    <div className="text-[12px] font-semibold space-y-0.5">
                      <p className="font-black uppercase tracking-wider text-[10px] text-amber-600">Recordatorio de bitácora</p>
                      {alertaHorarioFaltante.map((m) => <p key={m}>{m}</p>)}
                    </div>
                  </div>
                )}

                {entradasPendientesAprobar.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black text-amber-900 uppercase tracking-wide">
                        {entradasPendientesAprobar.length} entrada(s) por aprobar en {sucursalActiva || 'tu sucursal'}
                      </p>
                      <p className="text-[11px] text-amber-800/80 mt-0.5">
                        Traspasos desde almacén u otra sucursal. En la bitácora abajo marca SI / NO (comentario obligatorio si NO) y luego Integra.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerHistorialFarmacia(true)}
                      className="shrink-0 px-3 py-2 rounded-lg bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider hover:bg-amber-700"
                    >
                      Ver pendientes
                    </button>
                  </div>
                )}

                {/* Tipo movimiento + IA Scanner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 shrink-0">
                    {MOVIMIENTOS_FARMACIA.map((mov) => (
                      <button
                        key={mov}
                        type="button"
                        disabled={cabeceraFarmaciaCongelada}
                        onClick={() => {
                          if (cabeceraFarmaciaCongelada) return;
                          setFormFarmacia({
                            ...formFarmaciaInicial,
                            tipo_movimiento: mov,
                            sucursalDestino: formFarmacia.sucursalDestino || sucursalActiva || '',
                            factura: formFarmacia.factura,
                            proveedor: mov === 'Recepción' ? formFarmacia.proveedor : '',
                            sucursalOrigen: mov === 'Recepción' ? '' : formFarmacia.sucursalOrigen,
                          });
                        }}
                        className={`whitespace-nowrap px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all ${
                          normalizeMovimientoArea(formFarmacia.tipo_movimiento) === mov ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                        } ${cabeceraFarmaciaCongelada ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {mov}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 flex-1 w-full sm:w-auto">
                    <Sparkles size={18} className="text-slate-500 shrink-0"/>
                    <span className="text-[13px] font-semibold text-slate-700">Lectura IA</span>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={procesarFacturaIA}/>
                    <button type="button" onClick={() => fileInputRef.current.click()} disabled={iaLoading || cabeceraFarmaciaCongelada}
                      className="ml-auto bg-slate-900 text-white px-5 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-800 flex items-center gap-2 shrink-0 transition-all active:scale-95 disabled:opacity-50">
                      {iaLoading ? <Loader2 size={15} className="animate-spin"/> : <ScanText size={15}/>}
                      {iaLoading ? 'Leyendo...' : 'Escanear'}
                    </button>
                  </div>
                </div>

                {/* Cabecera congelable: proveedor/sucursales + factura */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white border rounded-xl p-4 ${cabeceraFarmaciaCongelada ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'}`}>
                  {cabeceraFarmaciaCongelada && (
                    <div className="sm:col-span-2 flex items-center justify-between gap-2 -mt-1 mb-1">
                      <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Cabecera congelada — agrega todos los ítems de la factura</p>
                      <button type="button" onClick={() => { setCabeceraFarmaciaCongelada(false); setLoteFarmaciaItems([]); }}
                        className="text-[11px] font-bold text-slate-500 hover:text-rose-600">Descongelar / limpiar lote</button>
                    </div>
                  )}
                  {normalizeMovimientoArea(formFarmacia.tipo_movimiento) === 'Recepción' ? (
                    <div>
                      <label className={labelBase}>¿De dónde / proveedor? *</label>
                      <input
                        className={inputBase}
                        disabled={cabeceraFarmaciaCongelada}
                        placeholder="Ej. Proveedor XYZ…"
                        value={formFarmacia.proveedor}
                        onChange={(e) => setFormFarmacia({ ...formFarmacia, proveedor: e.target.value, sucursalOrigen: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={labelBase}>{normalizeMovimientoArea(formFarmacia.tipo_movimiento) === 'Entrada' ? '¿De dónde entra? *' : '¿De dónde sale? *'}</label>
                      <select
                        className={inputBase}
                        disabled={cabeceraFarmaciaCongelada}
                        value={formFarmacia.sucursalOrigen}
                        onChange={(e) => setFormFarmacia({ ...formFarmacia, sucursalOrigen: e.target.value })}
                      >
                        <option value="">Seleccione sucursal origen…</option>
                        {catalogoSucursales.map((s) => (
                          <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={labelBase}>
                      {normalizeMovimientoArea(formFarmacia.tipo_movimiento) === 'Recepción'
                        ? '¿En qué sucursal se recibe? *'
                        : normalizeMovimientoArea(formFarmacia.tipo_movimiento) === 'Entrada'
                          ? '¿A dónde entra? *'
                          : '¿A dónde sale / destino? *'}
                    </label>
                    <select
                      className={inputBase}
                      disabled={cabeceraFarmaciaCongelada}
                      value={formFarmacia.sucursalDestino || sucursalActiva || ''}
                      onChange={(e) => setFormFarmacia({ ...formFarmacia, sucursalDestino: e.target.value })}
                    >
                      <option value="">Seleccione sucursal destino…</option>
                      {catalogoSucursales.map((s) => (
                        <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelBase}>Factura</label>
                    <input
                      className={inputBase}
                      disabled={cabeceraFarmaciaCongelada}
                      placeholder="Nº de factura"
                      value={formFarmacia.factura}
                      onChange={(e) => setFormFarmacia({ ...formFarmacia, factura: e.target.value })}
                    />
                  </div>
                </div>

                {/* Buscador medicamento */}
                <div className="relative z-20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className={labelBase + ' mb-0'}>Compuesto / Medicamento * (catálogo admin)</label>
                    <span className="text-[10px] font-semibold text-slate-400">{catalogoMedsCount} activos</span>
                  </div>
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input className={`${inputBase} pl-11 font-semibold text-base`} placeholder="Buscar por nombre, sustancia, acomodo o clave..."
                      value={formFarmacia.compuesto} onChange={handleBuscadorMedicamentos}
                      onKeyDown={(e) => {
                        if (!mostrarMeds || sugerenciasMeds.length === 0) return;
                        if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceMeds(p => p < sugerenciasMeds.length - 1 ? p + 1 : 0); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceMeds(p => p > 0 ? p - 1 : sugerenciasMeds.length - 1); }
                        else if (e.key === 'Enter' && indiceMeds >= 0) { e.preventDefault(); seleccionarMedicamento(sugerenciasMeds[indiceMeds]); setIndiceMeds(-1); }
                        else if (e.key === 'Escape') { setMostrarMeds(false); setIndiceMeds(-1); }
                      }}
                      onBlur={() => setTimeout(() => { setMostrarMeds(false); setIndiceMeds(-1); }, 200)}
                    />
                  </div>
                  {formFarmacia.medicamentoId ? (
                    <p className="mt-1.5 text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 size={12}/> Ligado al catálogo
                      {formFarmacia.numeroAcomodo ? ` · Acomodo ${formFarmacia.numeroAcomodo}` : ''}
                      {formFarmacia.marca ? ` · ${formFarmacia.marca}` : ''}
                    </p>
                  ) : formFarmacia.compuesto ? (
                    <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
                      Sin vínculo al catálogo: se guardará como texto libre (elige sugerencia si existe).
                    </p>
                  ) : null}
                  {mostrarMeds && (
                    <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl mt-1.5 max-h-56 overflow-y-auto z-50 shadow-lg p-1.5">
                      {sugerenciasMeds.map((m, i) => (
                        <div key={m.id || i} ref={el => { if (i === indiceMeds && el) el.scrollIntoView({ block: 'nearest' }) }}
                          onMouseDown={() => { seleccionarMedicamento(m); setIndiceMeds(-1); }}
                          className={`px-3 py-2.5 cursor-pointer rounded-lg transition-colors ${i === indiceMeds ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[15px] font-bold text-slate-800">{m.nombreComercial}</p>
                            {m.numeroAcomodo ? (
                              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shrink-0">
                                #{m.numeroAcomodo}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                            {m.sustanciaActiva}{m.presentacion ? ` • ${m.presentacion}` : ''}{m.marca ? ` • ${m.marca}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grid de campos — sin factura (ya está en cabecera) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <div><label className={labelBase}>Lote *</label><input className={inputBase} placeholder="Lote de fabricación" value={formFarmacia.lote} onChange={e => setFormFarmacia((prev) => ({ ...prev, lote: e.target.value }))}/></div>
                  <div><label className={labelBase}>Caducidad *</label><input type="date" className={inputBase} value={formFarmacia.caducidad} onChange={e => setFormFarmacia((prev) => ({ ...prev, caducidad: e.target.value }))}/></div>
                  <div>
                    <label className={labelBase}>Cantidad *</label>
                    <input type="number" className={`${inputBase} font-black text-lg text-blue-700 bg-blue-50/50 border-blue-200 focus:border-blue-400`} placeholder="Cajas / Pzas"
                      value={formFarmacia.cantidad} onChange={e => setFormFarmacia((prev) => ({ ...prev, cantidad: e.target.value }))}/>
                  </div>
                  <div><label className={labelBase}>Presentación</label><input className={inputBase} placeholder="Ej: Caja 30 tabs" value={formFarmacia.presentacion} onChange={e => setFormFarmacia((prev) => ({ ...prev, presentacion: e.target.value }))}/></div>
                  <div><label className={labelBase}>Forma Farmacéutica</label><input className={inputBase} placeholder="Ej: Tableta" value={formFarmacia.forma} onChange={e => setFormFarmacia((prev) => ({ ...prev, forma: e.target.value }))}/></div>
                </div>

                {/* Criterios + Aprobado SI/NO + Observaciones */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 flex-1 min-h-0">
                  {normalizeMovimientoArea(formFarmacia.tipo_movimiento) === 'Recepción' && (
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                      <div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-4">Criterio de Aceptación</p>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors">
                            <input type="checkbox" className="w-5 h-5 accent-slate-900 rounded shrink-0" checked={!!formFarmacia.criterio_empaque} onChange={e => setFormFarmacia((prev) => ({ ...prev, criterio_empaque: e.target.checked }))}/>
                            <span className="text-[15px] font-medium text-slate-700">Empaque sin daños físicos</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors">
                            <input type="checkbox" className="w-5 h-5 accent-slate-900 rounded shrink-0" checked={!!formFarmacia.criterio_etiqueta} onChange={e => setFormFarmacia((prev) => ({ ...prev, criterio_etiqueta: e.target.checked }))}/>
                            <span className="text-[15px] font-medium text-slate-700">Etiqueta íntegra y legible</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">Aprobado en recepción *</p>
                        <p className="text-[10px] text-slate-400 mb-3">Con SI queda aprobado. Con NO el comentario es obligatorio.</p>
                        <div className="flex gap-2">
                          {['si', 'no'].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setFormFarmacia((prev) => ({ ...prev, aprobadoMercancia: v }))}
                              className={`flex-1 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-wider border transition-all ${
                                formFarmacia.aprobadoMercancia === v
                                  ? (v === 'si' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600')
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {v === 'si' ? 'SI' : 'NO'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className={`flex flex-col ${normalizeMovimientoArea(formFarmacia.tipo_movimiento) === 'Recepción' ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
                    <label className={labelBase}>Observaciones</label>
                    <textarea className={`${inputBase} flex-1 min-h-[120px] resize-none`} placeholder="Notas sobre empaque, mermas, etc." value={formFarmacia.observaciones} onChange={e => setFormFarmacia((prev) => ({ ...prev, observaciones: e.target.value }))}/>
                  </div>
                </div>

                {/* Lote de ítems pendientes de guardar */}
                {loteFarmaciaItems.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
                      <p className="text-[12px] font-black uppercase tracking-wider text-slate-600">{loteFarmaciaItems.length} ítem(s) en el lote</p>
                      {formFarmacia.medicamentoId ? (
                        <button
                          type="button"
                          onClick={() => limpiarCamposItemFarmacia({ cambiarMedicamento: true })}
                          className="text-[11px] font-bold text-slate-500 hover:text-indigo-600"
                        >
                          Cambiar medicamento
                        </button>
                      ) : null}
                    </div>
                    <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {loteFarmaciaItems.map((it) => (
                        <li key={it._key} className="px-4 py-2 flex items-center gap-3 text-[12px]">
                          <span className="font-bold text-slate-800 flex-1 truncate">{it.compuesto}</span>
                          <span className="text-slate-500">Lote {it.lote}</span>
                          <span className="font-black text-blue-700">×{it.cantidad}</span>
                          <button type="button" onClick={() => handleQuitarItemLote(it._key)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={13}/></button>
                        </li>
                      ))}
                    </ul>
                    {formFarmacia.medicamentoId && (
                      <p className="px-4 py-2 text-[11px] text-emerald-700 bg-emerald-50/80 border-t border-emerald-100">
                        Mismo medicamento listo: captura el otro lote / cantidad / caducidad y pulsa Agregar.
                      </p>
                    )}
                  </div>
                )}

                {/* Historial + entradas pendientes de recibir */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="month"
                      value={farmaciaMesHistorial}
                      onChange={(e) => setFarmaciaMesHistorial(e.target.value || new Date().toLocaleDateString('en-CA').slice(0, 7))}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 bg-white"
                      title="Mes de bitácoras"
                    />
                    <button type="button" onClick={() => setVerHistorialFarmacia((v) => !v)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                      {verHistorialFarmacia ? 'Ocultar bitácoras' : 'Ver bitácoras del mes'}
                    </button>
                    <button type="button" onClick={handlePrintFarmaciaHistorial}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                      <Printer size={12}/> Imprimir bitácoras
                    </button>
                    {historialFarmaciaLoading && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Loader2 size={12} className="animate-spin" /> Cargando…
                      </span>
                    )}
                    {!historialFarmaciaLoading && historialFarmacia.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {historialFarmacia.length} registro{historialFarmacia.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {historialFarmaciaError && (
                    <p className={`text-[11px] font-semibold rounded-lg px-3 py-2 border ${
                      historialFarmacia.length
                        ? 'text-amber-700 bg-amber-50 border-amber-100'
                        : 'text-rose-600 bg-rose-50 border-rose-100'
                    }`}>
                      {historialFarmaciaError}
                    </p>
                  )}
                  {verHistorialFarmacia && (
                    <div className="overflow-auto max-h-80 rounded-lg border border-slate-100">
                      <table className="w-full text-[10px] min-w-[980px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                            <th className="px-2 py-1.5 text-left">Fecha</th>
                            <th className="px-2 py-1.5 text-left">Factura</th>
                            <th className="px-2 py-1.5 text-left">Compuesto</th>
                            <th className="px-2 py-1.5 text-center">Cant</th>
                            <th className="px-2 py-1.5 text-left">Lote</th>
                            <th className="px-2 py-1.5 text-center">Caducidad</th>
                            <th className="px-2 py-1.5 text-center" colSpan={2}>Criterio</th>
                            <th className="px-2 py-1.5 text-center">Aprobado</th>
                            <th className="px-2 py-1.5 text-left">Recibió</th>
                            <th className="px-2 py-1.5 text-left">Coment</th>
                          </tr>
                          <tr className="bg-slate-50/80 text-slate-400 uppercase tracking-wider text-[9px]">
                            <th colSpan={6} />
                            <th className="px-1 py-0.5 text-center font-bold">Empaque</th>
                            <th className="px-1 py-0.5 text-center font-bold">Etiqueta</th>
                            <th colSpan={3} />
                          </tr>
                        </thead>
                        <tbody>
                          {historialFarmacia.slice(0, 80).map((r) => {
                            const d = r.detalles || {};
                            const areaNorm = normalizeMovimientoArea(r.area || d.tipo_movimiento);
                            const enMiSucursal = sameSucursal(r.sucursal, sucursalActiva) || sameSucursal(d.sucursalDestino, sucursalActiva);
                            const pendienteRecibir = areaNorm === 'Entrada'
                              && enMiSucursal
                              && (r.pendienteRecepcionEnfermeria || r.estadoAprobacion === 'pendiente' || !r.estadoAprobacion);
                            const pendienteIntegrar = areaNorm === 'Entrada'
                              && enMiSucursal
                              && r.estadoAprobacion === 'aprobado'
                              && r.estadoInventario !== 'integrado';
                            const comentarioDraft = comentariosAprobacion[r.id] ?? (r.comentarioAprobacion || '');
                            const busy = aprobandoEntradaId === r.id;
                            const estadoSalidaDestino = r._estadoAprobacionDestino || 'pendiente';
                            const emp = criterioBool(d, 'criterio_empaque', ['empaque']);
                            const eti = criterioBool(d, 'criterio_etiqueta', ['etiqueta']);

                            const renderAprobado = () => {
                              if (areaNorm === 'Salida') {
                                const label = labelEstadoAprobacion(estadoSalidaDestino);
                                const tone = estadoSalidaDestino === 'aprobado'
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : estadoSalidaDestino === 'rechazado'
                                    ? 'text-rose-700 bg-rose-50'
                                    : 'text-amber-700 bg-amber-50';
                                return (
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${tone}`} title="Estado según sucursal destino">
                                    {label}
                                  </span>
                                );
                              }

                              if (areaNorm === 'Entrada' && pendienteRecibir) {
                                return (
                                  <div className="flex items-center justify-center gap-2">
                                    <label className="inline-flex items-center gap-0.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        checked={false}
                                        disabled={busy}
                                        onChange={() => handleAprobarEntradaEnfermeria(r, 'aprobado', comentarioDraft || 'Recibido completo')}
                                      />
                                      <span className="font-black text-emerald-700">SI</span>
                                    </label>
                                    <label className="inline-flex items-center gap-0.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                        checked={false}
                                        disabled={busy}
                                        onChange={() => handleAprobarEntradaEnfermeria(r, 'rechazado', comentarioDraft)}
                                      />
                                      <span className="font-black text-rose-700">NO</span>
                                    </label>
                                  </div>
                                );
                              }

                              const estado = r.estadoAprobacion || 'pendiente';
                              const label = labelEstadoAprobacion(estado);
                              const tone = estado === 'aprobado'
                                ? 'text-emerald-700 bg-emerald-50'
                                : estado === 'rechazado'
                                  ? 'text-rose-700 bg-rose-50'
                                  : 'text-slate-500 bg-slate-100';
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${tone}`}>
                                    {label}
                                  </span>
                                  {pendienteIntegrar && (
                                    <button
                                      type="button"
                                      disabled={integrandoId === r.id}
                                      onClick={() => handleIntegrarInventarioEnfermeria(r)}
                                      className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold disabled:opacity-50"
                                    >
                                      {integrandoId === r.id ? 'Integrando…' : 'Integrar'}
                                    </button>
                                  )}
                                  {r.estadoInventario === 'integrado' && (
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">En inventario</span>
                                  )}
                                </div>
                              );
                            };

                            const renderComentario = () => {
                              if (areaNorm === 'Entrada' && pendienteRecibir) {
                                return (
                                  <input
                                    type="text"
                                    value={comentarioDraft}
                                    disabled={busy}
                                    onChange={(e) => setComentariosAprobacion((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                    placeholder="Obligatorio si NO"
                                    className="w-full min-w-[100px] px-1.5 py-1 rounded border border-slate-200 bg-white text-[10px] text-slate-700 outline-none focus:border-blue-400"
                                  />
                                );
                              }
                              return (
                                <span className="text-slate-600 break-words">
                                  {r.comentarioAprobacion || d.observaciones || '—'}
                                </span>
                              );
                            };

                            const CheckCell = ({ ok }) => (
                              <td className="px-1 py-1.5 text-center">
                                {ok === true ? (
                                  <span className="inline-flex w-4 h-4 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-black">✓</span>
                                ) : ok === false ? (
                                  <span className="inline-flex w-4 h-4 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-500 text-[10px] font-black">✗</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );

                            return (
                              <tr key={r.id} className="border-t border-slate-50 align-top">
                                <td className="px-2 py-1.5 whitespace-nowrap">
                                  <span className="block">{formatFechaMx(r.fechaString)}</span>
                                  <span className="text-[8px] font-bold uppercase text-slate-400">{areaNorm}</span>
                                </td>
                                <td className="px-2 py-1.5 font-bold text-slate-700">{d.factura || '—'}</td>
                                <td className="px-2 py-1.5 max-w-[200px]">
                                  <span className="block truncate font-medium text-slate-800" title={d.compuesto}>{d.compuesto}</span>
                                </td>
                                <td className="px-2 py-1.5 text-center font-bold">{d.cantidad}</td>
                                <td className="px-2 py-1.5 font-semibold text-slate-600">{d.lote || '—'}</td>
                                <td className="px-2 py-1.5 text-center font-mono">{formatCaducidadCorta(d.caducidad)}</td>
                                <CheckCell ok={emp} />
                                <CheckCell ok={eti} />
                                <td className="px-2 py-1.5 text-center">{renderAprobado()}</td>
                                <td className="px-2 py-1.5 text-slate-600 max-w-[100px] truncate" title={
                                  (r.estadoAprobacion === 'aprobado' || r.estadoAprobacion === 'rechazado')
                                    ? (r.aprobadoPorNombre || r.responsableNombre || '')
                                    : (r.responsableNombre || '')
                                }>
                                  {(r.estadoAprobacion === 'aprobado' || r.estadoAprobacion === 'rechazado')
                                    ? (r.aprobadoPorNombre || r.responsableNombre || '—')
                                    : (r.responsableNombre || '—')}
                                </td>
                                <td className="px-2 py-1.5">{renderComentario()}</td>
                              </tr>
                            );
                          })}
                          {!historialFarmaciaLoading && historialFarmacia.length === 0 && !historialFarmaciaError && (
                            <tr>
                              <td colSpan={11} className="px-3 py-4 text-center text-slate-400">
                                Sin bitácoras en {farmaciaMesHistorial} para {sucursalActiva || 'esta sucursal'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ PEDIDO DE MEDICAMENTO ════ */}
            {tipoRegistro === 'pedido_medicamento' && (
              <>
                <div className="bg-white rounded-xl border border-slate-200 px-3 sm:px-5 py-2.5 sm:py-3 mb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-[12px] sm:text-[15px] font-bold text-slate-800 truncate">Pedido de medicamento e insumos</h3>
                      <div className="hidden sm:flex items-center gap-1.5 ml-1">
                        {pedidoCategorias.map(cat => {
                          const catColor = getCatBadgeClasses(cat.nombre);
                          return (
                            <span key={cat.id} className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${catColor.badge}`}>
                              {cat.nombre}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <input
                        type="month"
                        value={pedidoMesHistorial}
                        onChange={(e) => setPedidoMesHistorial(e.target.value || new Date().toLocaleDateString('en-CA').slice(0, 7))}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 bg-white"
                        title="Mes de pedidos"
                      />
                      <button
                        type="button"
                        onClick={() => setVerHistorialPedidos((v) => !v)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors"
                      >
                        {verHistorialPedidos ? 'Ocultar pedidos' : 'Ver pedidos'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPedidoCompacto((prev) => !prev)}
                        className="hidden sm:flex px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors"
                      >
                        {pedidoCompacto ? 'Vista normal' : 'Vista compacta'}
                      </button>
                      <div className="relative flex-1 sm:flex-none sm:w-64">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={pedidoMedicamentoSearch}
                          onChange={(e) => setPedidoMedicamentoSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] sm:text-[13px] font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all"
                          placeholder="Buscar..."
                        />
                      </div>
                    </div>
                  </div>
                  {historialPedidosError && (
                    <p className={`mt-2 text-[11px] font-semibold rounded-lg px-3 py-2 border ${
                      historialPedidos.length
                        ? 'text-amber-700 bg-amber-50 border-amber-100'
                        : 'text-rose-600 bg-rose-50 border-rose-100'
                    }`}>
                      {historialPedidosError}
                    </p>
                  )}
                  {verHistorialPedidos && (
                    <div className="mt-3 overflow-auto max-h-56 rounded-lg border border-slate-100">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase">
                            <th className="px-2 py-1.5 text-left">Fecha</th>
                            <th className="px-2 py-1.5 text-left">Insumos</th>
                            <th className="px-2 py-1.5 text-left">Resolución jefatura</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historialPedidosLoading && historialPedidos.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-3 text-center text-slate-400">
                                <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando pedidos…</span>
                              </td>
                            </tr>
                          )}
                          {historialPedidos.slice(0, 30).map((p) => {
                            const filas = p.detalles?.filas || [];
                            const filasVisibles = filas.filter((f) => f.pedido || f.resolucion);
                            return (
                              <tr key={p.id} className="border-t border-slate-50 align-top">
                                <td className="px-2 py-1.5 whitespace-nowrap">{formatFechaMx(p.fechaString)}</td>
                                <td className="px-2 py-1.5">{filasVisibles.length || filas.length} ítem(s)</td>
                                <td className="px-2 py-1.5">
                                  {filasVisibles.slice(0, 24).map((f, i) => (
                                    <div key={i} className="py-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="truncate max-w-[160px] font-semibold text-slate-700" title={f.insumo}>{f.insumo}</span>
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                          f.resolucion === 'proveedor' ? 'bg-blue-50 text-blue-700'
                                            : f.resolucion === 'traspaso' ? 'bg-violet-50 text-violet-700'
                                              : f.resolucion === 'pendiente' ? 'bg-amber-50 text-amber-700'
                                                : 'bg-slate-100 text-slate-400'
                                        }`}>
                                          {f.resolucion === 'proveedor' ? 'Prov' : f.resolucion === 'traspaso' ? 'Trasp' : f.resolucion === 'pendiente' ? 'Pend' : '—'}
                                        </span>
                                      </div>
                                      {f.resolucion === 'pendiente' && f.comentarioResolucion && (
                                        <p className="text-[10px] text-amber-800/80 pl-0.5 mt-0.5 italic">
                                          {f.comentarioResolucion}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                  {filasVisibles.length === 0 && (
                                    <span className="text-slate-400">Sin resolución aún</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {!historialPedidosLoading && historialPedidos.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-3 text-center text-slate-400">
                                Sin pedidos en {pedidoMesHistorial}{sucursalActiva ? ` · ${sucursalActiva}` : ''}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {pedidoMedicamentoRows.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <p className="text-sm font-bold text-slate-700">No hay catalogo para Pedido de medicamento.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Carga una colección <strong>catalogo_pedido_medicamentos</strong> o el archivo <strong>/public/data/pedido_medicamentos.json</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                  {/* ── Desktop table (sm+) ── */}
                  <table className={`hidden sm:table w-full ${pedidoCompacto ? 'min-w-[520px]' : 'min-w-[640px]'} text-sm border-collapse`}>
                    <thead>
                      <tr>
                        <th className={`sticky top-0 z-10 bg-slate-100 border-b border-slate-200 px-4 ${pedidoCompacto ? 'py-1.5' : 'py-2'} text-[10px] uppercase tracking-wider text-slate-500 text-left`}>Insumo</th>
                        <th className={`sticky top-0 z-10 bg-slate-100 border-b border-slate-200 px-4 ${pedidoCompacto ? 'py-1.5' : 'py-2'} text-[10px] uppercase tracking-wider text-slate-500 text-center ${pedidoCompacto ? 'w-24' : 'w-32'}`}>Físico</th>
                        <th className={`sticky top-0 z-10 bg-slate-100 border-b border-slate-200 px-4 ${pedidoCompacto ? 'py-1.5' : 'py-2'} text-[10px] uppercase tracking-wider text-slate-500 text-center ${pedidoCompacto ? 'w-24' : 'w-32'}`}>Pedido</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {pedidoMedicamentoRowsFiltrados.map((row, idx) => {
                        const catColors = getCatBadgeClasses(row.categoria);
                        const inputClass = `w-full text-center ${pedidoCompacto ? 'px-2 py-1 text-xs rounded' : 'px-2.5 py-1.5 text-sm rounded-md'} border bg-white font-semibold text-slate-700 outline-none transition-all ${catColors.input}`;
                        const stripe = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

                        return (
                        <tr key={row.id} className={`${stripe} hover:bg-blue-50/40 transition-colors`}>
                          <td className={`px-4 ${pedidoCompacto ? 'py-1.5' : 'py-2'} border-b border-slate-100`}>
                            <div className="flex items-center gap-2">
                              <p className={`${pedidoCompacto ? 'text-[12px]' : 'text-[13px]'} font-semibold text-slate-800 leading-tight`}>{row.nombre}</p>
                              {row.categoria && (
                                <span className={`inline-flex items-center px-1.5 py-px rounded border text-[8px] font-bold uppercase tracking-wider ${catColors.badge}`}>
                                  {row.categoria}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`px-3 ${pedidoCompacto ? 'py-1.5' : 'py-2'} border-b border-slate-100`}>
                            <input
                              value={row.fisico}
                              onChange={(e) => updatePedidoMedicamentoRow(row.id, 'fisico', e.target.value)}
                              className={inputClass}
                              placeholder="0"
                              inputMode="decimal"
                            />
                          </td>
                          <td className={`px-3 ${pedidoCompacto ? 'py-1.5' : 'py-2'} border-b border-slate-100`}>
                            <input
                              value={row.pedido}
                              onChange={(e) => updatePedidoMedicamentoRow(row.id, 'pedido', e.target.value)}
                              className={inputClass}
                              placeholder="0"
                              inputMode="decimal"
                            />
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>

                  {/* ── Mobile cards (<sm) ── */}
                  <div className="sm:hidden flex flex-col gap-1.5">
                    {pedidoMedicamentoRowsFiltrados.map((row, idx) => {
                      const catColors = getCatBadgeClasses(row.categoria);
                      const filled = String(row.fisico || '').trim() !== '' || String(row.pedido || '').trim() !== '';
                      return (
                        <div
                          key={row.id}
                          ref={el => (pedidoCardRefs.current[idx] = el)}
                          className={`rounded-xl border px-3 py-2.5 transition-all ${
                            filled ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[12px] font-semibold text-slate-800 leading-tight flex-1 min-w-0">{row.nombre}</p>
                            {row.categoria && (
                              <span className={`shrink-0 inline-flex items-center px-1.5 py-px rounded border text-[7px] font-bold uppercase tracking-wider ${catColors.badge}`}>
                                {row.categoria}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5 block">Físico</label>
                              <input
                                value={row.fisico}
                                onChange={(e) => updatePedidoMedicamentoRow(row.id, 'fisico', e.target.value)}
                                className={`w-full text-center px-2 py-2 text-[13px] rounded-lg border bg-white font-semibold text-slate-700 outline-none transition-all ${catColors.input}`}
                                placeholder="0"
                                inputMode="decimal"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5 block">Pedido</label>
                              <input
                                value={row.pedido}
                                onChange={(e) => updatePedidoMedicamentoRow(row.id, 'pedido', e.target.value)}
                                className={`w-full text-center px-2 py-2 text-[13px] rounded-lg border bg-white font-semibold text-slate-700 outline-none transition-all ${catColors.input}`}
                                placeholder="0"
                                inputMode="decimal"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}

                {pedidoMedicamentoRowsFiltrados.length === 0 && pedidoMedicamentoRows.length > 0 && (
                  <div className="px-5 py-8 text-center text-xs font-semibold text-slate-400">
                    No hay coincidencias para la búsqueda actual.
                  </div>
                )}
              </>
            )}

            {/* ════ TEMPERATURA ════ */}
            {tipoRegistro === 'temperatura' && (
              <div className="flex flex-col gap-5 flex-1 max-w-3xl w-full mx-auto">
                {/* ─── Bloqueo de turnos ya registrados ─── */}
                {(() => {
                  const turnosBloqueados = {
                    '8:00 a.m.': progresoHoy.temp_8,
                    '4:00 p.m.': progresoHoy.temp_16,
                    '10:00 p.m.': progresoHoy.temp_22
                  };
                  const turnoActualBloqueado = turnosBloqueados[formTemp.turno];

                  return (
                    <>
                      <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-4">Turno de Medición</p>
                        <div className="flex gap-3 mb-6">
                          {['8:00 a.m.', '4:00 p.m.', '10:00 p.m.'].map(t => {
                            const bloqueado = turnosBloqueados[t];
                            const activo = formTemp.turno === t;
                            return (
                              <button key={t}
                                onClick={() => { if (!bloqueado) setFormTemp({ ...formTemp, turno: t }); }}
                                disabled={bloqueado}
                                className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-all ${
                                  bloqueado
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-not-allowed opacity-80'
                                    : activo
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white'
                                }`}
                              >
                                {bloqueado ? `${t} ✓` : t}
                              </button>
                            );
                          })}
                        </div>

                        {turnoActualBloqueado ? (
                          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                            <CheckCircle2 size={20} className="text-emerald-500 shrink-0"/>
                            <div>
                              <p className="text-[14px] font-bold text-emerald-700">Turno {formTemp.turno} ya registrado</p>
                              <p className="text-[11px] text-emerald-600 mt-0.5">El registro de este turno ya fue capturado para la sucursal {sucursalActiva || sucursal}. Seleccione otro turno pendiente.</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                              <div><label className={labelBase}>T° Exterior</label><input type="number" step="0.1" placeholder="°C exterior" className={inputBase} value={formTemp.t_ext} onChange={e => setFormTemp({ ...formTemp, t_ext: e.target.value })}/></div>
                              <div><label className={labelBase}>Humedad %</label><input type="number" placeholder="% humedad" className={inputBase} value={formTemp.humedad} onChange={e => setFormTemp({ ...formTemp, humedad: e.target.value })}/></div>
                              <div><label className={labelBase}>T° Refrigerador</label><input type="number" step="0.1" placeholder="°C refrigerador" className={`${inputBase} border-blue-300 bg-blue-50/40 focus:border-blue-400`} value={formTemp.t_ref} onChange={e => setFormTemp({ ...formTemp, t_ref: e.target.value })}/></div>
                            </div>
                            <div className="flex gap-3 items-center bg-amber-50 border border-amber-200/80 rounded-xl px-5 py-3.5 mt-5">
                              <AlertCircle size={16} className="text-amber-500 shrink-0"/>
                              <p className="text-[14px] text-amber-800 font-medium">Refrigerador normativo: <strong>2°C – 8°C</strong>. Reporte desviaciones a jefatura.</p>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* ─── Impresion de temperaturas ─── */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                    <Printer size={16} className="text-slate-500"/>
                    <h4 className="text-[13px] font-bold text-slate-700">Imprimir Bitacora del Mes</h4>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input
                        type="month"
                        value={printTempMonth}
                        onChange={e => setPrintTempMonth(e.target.value)}
                        className="pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">Sucursal: <strong className="text-slate-600">{sucursalActiva || sucursal || 'N/A'}</strong></span>
                    <button
                      onClick={handlePrintTemperaturas}
                      disabled={printTempLoading}
                      className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-bold hover:bg-black disabled:opacity-50 transition-all active:scale-[0.97]"
                    >
                      {printTempLoading ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14}/>}
                      {printTempLoading ? 'Cargando...' : 'Imprimir'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ════ CLORO Y PH ════ */}
            {tipoRegistro === 'cloro' && (
              <div className="flex flex-col gap-5 flex-1 max-w-3xl w-full mx-auto">
                {[
                  { title: 'Lavado de Manos 1', ph: 'ph_1', cloro: 'cloro_1' },
                  { title: 'Lavado de Manos 2', ph: 'ph_2', cloro: 'cloro_2' }
                ].map((section) => (
                  <div key={section.ph} className="bg-white rounded-xl border border-slate-200 p-6 flex-1">
                    <div className="flex items-center gap-2.5 mb-5">
                      <Droplet size={18} className="text-cyan-500"/>
                      <h3 className="text-[15px] font-bold text-slate-800">{section.title}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div><label className={labelBase}>Nivel de PH</label><input type="number" step="0.1" placeholder="pH" className={inputBase} value={formCloro[section.ph]} onChange={e => setFormCloro({ ...formCloro, [section.ph]: e.target.value })}/></div>
                      <div><label className={labelBase}>Cloro Residual</label><input type="number" step="0.1" placeholder="ppm" className={inputBase} value={formCloro[section.cloro]} onChange={e => setFormCloro({ ...formCloro, [section.cloro]: e.target.value })}/></div>
                    </div>
                  </div>
                ))}
                
                {/* ─── Impresión de Cloro y PH ─── */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                    <Printer size={16} className="text-slate-500"/>
                    <h4 className="text-[13px] font-bold text-slate-700">Imprimir Bitácora del Mes</h4>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input
                        type="month"
                        value={printCloroMonth}
                        onChange={e => setPrintCloroMonth(e.target.value)}
                        className="pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-50 transition-all"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">Sucursal: <strong className="text-slate-600">{sucursalActiva || sucursal || 'N/A'}</strong></span>
                    <button
                      onClick={handlePrintCloro}
                      disabled={printCloroLoading}
                      className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-bold hover:bg-black disabled:opacity-50 transition-all active:scale-[0.97]"
                    >
                      {printCloroLoading ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14}/>}
                      {printCloroLoading ? 'Cargando...' : 'Imprimir'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ════ LIMPIEZA ════ */}
            {tipoRegistro === 'limpieza' && (
              <div className="flex flex-col gap-5 flex-1 max-w-3xl w-full mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 p-6 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider shrink-0">Área a Auditar</label>
                    <div className="relative flex-1">
                      <select className={`${inputBase} appearance-none pr-10 cursor-pointer`}
                        value={formLimpieza.area}
                        onChange={e => setFormLimpieza({ area: e.target.value, tareas: { col1: false, col2: false, col3: false, col4: false } })}>
                        {Object.keys(TAREAS_POR_AREA).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {TAREAS_POR_AREA[formLimpieza.area].map((tareaStr, index) => {
                      const key = `col${index + 1}`;
                      const checked = formLimpieza.tareas[key];
                      return (
                        <label key={key}
                          className={`flex items-center gap-3.5 px-5 py-4 rounded-xl cursor-pointer transition-all border ${
                            checked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:bg-slate-50'
                          }`}>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                            checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                          }`}>
                            {checked && <Check size={15} className="text-white"/>}
                          </div>
                          <input type="checkbox" className="sr-only" checked={checked}
                            onChange={e => setFormLimpieza({ ...formLimpieza, tareas: { ...formLimpieza.tareas, [key]: e.target.checked } })}/>
                          <span className={`text-[15px] font-medium leading-tight ${checked ? 'text-emerald-800' : 'text-slate-700'}`}>{tareaStr}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ════ CARRO ROJO ════ */}
            {tipoRegistro === 'carro_rojo' && (
              <BitacoraCarroRojoEnfermeria embedded sucursal={sucursalActiva} />
            )}

            {/* ════ BITÁCORA DE PACIENTES ════ */}
            {tipoRegistro === 'bitacora_px' && (
              <BitacoraPacientesEnfermeria sucursal={sucursalActiva || sucursal} />
            )}

            {/* ════ REGISTRO KRIT ════ */}
            {tipoRegistro === 'krit' && (
              <div className="flex-1 overflow-y-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5">
                <RegistroKrit sucursal={sucursalActiva || sucursal} embedded />
              </div>
            )}

            {/* ════ REGISTRO AUTOCLAVE ════ */}
            {tipoRegistro === 'autoclave' && (
              <div className="flex-1 overflow-y-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5">
                <RegistroAutoclave sucursal={sucursalActiva || sucursal} embedded />
              </div>
            )}

            {/* ════ REGISTRO CADUCIDADES ════ */}
            {tipoRegistro === 'caducidades' && (
              <div className="flex-1 overflow-y-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5">
                <RegistroCaducidades sucursal={sucursalActiva || sucursal} embedded />
              </div>
            )}
          </div>

          {/* ─── MOBILE PEDIDO NAV ─── */}
          {tipoRegistro === 'pedido_medicamento' && pedidoMedicamentoRowsFiltrados.length > 1 && (
            <div className="sm:hidden shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={pedidoMobileIdx <= 0}
                onClick={() => scrollToPedidoCard(pedidoMobileIdx - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95 transition-all"
              >
                <ChevronUp size={14}/> Anterior
              </button>
              <span className="text-[11px] font-bold text-slate-500">
                {pedidoMobileIdx + 1} <span className="font-normal">de</span> {pedidoMedicamentoRowsFiltrados.length}
              </span>
              <button
                type="button"
                disabled={pedidoMobileIdx >= pedidoMedicamentoRowsFiltrados.length - 1}
                onClick={() => scrollToPedidoCard(pedidoMobileIdx + 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-200 bg-blue-600 text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-95 transition-all"
              >
                Siguiente <ChevronDown size={14}/>
              </button>
            </div>
          )}

          {/* ─── SAVE BAR ─── */}
          {tipoRegistro !== 'carro_rojo' && tipoRegistro !== 'bitacora_px' && tipoRegistro !== 'krit' && tipoRegistro !== 'autoclave' && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-3 sm:px-6 lg:px-8 py-1.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {tipoRegistro === 'pedido_medicamento' && pedidoMedicamentoRows.length > 0 && (
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                    <strong className="text-slate-700">{filasPedidoConCaptura.length}</strong>/{pedidoMedicamentoRows.length}
                  </span>
                )}
                <div className="hidden md:flex items-center gap-2.5">
                  <div className="flex gap-1">
                    {progresoItems.map((item, i) => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${item.done ? 'bg-emerald-500' : 'bg-slate-200'}`} title={item.label}/>
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">{progresoTotal}/{progresoItems.length}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {sucursalActiva && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-bold text-blue-700">
                    <MapPin size={11}/> {sucursalActiva}
                  </span>
                )}
                {tipoRegistro === 'pedido_medicamento' && (
                  <button
                    type="button"
                    onClick={limpiarPedidoMedicamento}
                    className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-200 text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
                {tipoRegistro === 'farmacia' && (
                  <button
                    type="button"
                    onClick={handleAgregarItemFarmacia}
                    disabled={loading || !sucursalActiva}
                    className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-300 bg-white text-slate-800 text-[10px] sm:text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus size={14}/> Agregar
                  </button>
                )}
                <button onClick={handleGuardar} disabled={loading || turnoTempBloqueado || !sucursalActiva}
                  className="bg-slate-900 hover:bg-black text-white px-4 sm:px-7 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm disabled:opacity-50 transition-all active:scale-[0.97]">
                  {loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} className="sm:w-4 sm:h-4"/>}
                  {loading ? 'Guardando...' : (tipoRegistro === 'farmacia' && loteFarmaciaItems.length > 0 ? `Guardar lote (${loteFarmaciaItems.length}+)` : 'Guardar')}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default RegistrosEnfermeriaModal;