import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Save, Loader2, Thermometer, Droplet, 
  Sparkles, Package, AlertCircle, ShieldAlert,
  ScanText, Search, CheckCircle2, Activity, MapPin, ChevronDown, ChevronUp, Check, ClipboardList,
  Menu
} from 'lucide-react';
import { db, functions } from '../config/firebase'; 
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import BitacoraCarroRojo from '../pages/enfermeria/BitacoraCarroRojo';
import BitacoraPacientesEnfermeria from './BitacoraPacientesEnfermeria';
import RegistroKrit from './RegistroKrit';
import RegistroAutoclave from './RegistroAutoclave';
import RegistroCaducidades from './RegistroCaducidades';

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
  { id: 'caducidades', label: 'Caducidades', mobileLabel: 'Caduc.', icon: ShieldAlert, color: 'rose' }
];

const toMedicationSearchRow = (m) => {
  const nombreComercial = m.nombreComercial || m['*NOMBRE COMERCIAL'] || '';
  const marca = m.marca || m['*MARCA'] || '';
  const sustanciaActiva = m.sustanciasActivas || m['*SUSTANCIA(S) ACTIVA(S)'] || '';
  const presentacion = m.presentacion || m['*PRESENTACIÓN'] || m['*PRESENTACION'] || '';
  const dosis = m.dosis || m.DOSIS || '';
  const indicacion = m.indicacion || m.INDICACION || '';
  const opcion2 = m.opcion2 || m['OPCION 2'] || '';
  const advertencia = m.advertencia || m['ADVERTENCIA '] || '';
  const embarazo = m.embarazo || m.EMBARAZO || '';

  return {
    nombreComercial, marca, sustanciaActiva, presentacion, dosis, indicacion, opcion2, advertencia, embarazo,
    searchText: normalizeText(`${nombreComercial} ${marca} ${sustanciaActiva} ${presentacion} ${dosis} ${indicacion} ${opcion2} ${advertencia} ${embarazo}`)
  };
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
const RegistrosEnfermeriaModal = ({ onClose, enfermeraNombre, sucursal = '', standalone = false }) => {
  const [loading, setLoading] = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState('farmacia');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pedidoCompacto, setPedidoCompacto] = useState(true);
  const [sucursalActiva, setSucursalActiva] = useState(sucursal);
  const [catalogoSucursales, setCatalogoSucursales] = useState([]);

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
    tipo_movimiento: 'Recepción', factura: '', compuesto: '', presentacion: '', forma: '', 
    lote: '', caducidad: '', cantidad: '', observaciones: '', criterio_empaque: true, criterio_etiqueta: true
  };
  const [formFarmacia, setFormFarmacia] = useState(formFarmaciaInicial);
  const [pedidoMedicamentoRows, setPedidoMedicamentoRows] = useState([]);
  const [pedidoMedicamentoSearch, setPedidoMedicamentoSearch] = useState('');

  const [sugerenciasMeds, setSugerenciasMeds] = useState([]);
  const [mostrarMeds, setMostrarMeds] = useState(false);
  const [indiceMeds, setIndiceMeds] = useState(-1);
  const [iaLoading, setIaLoading] = useState(false);
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
        if (!sucursalActiva && items.length > 0) {
          setSucursalActiva(items[0].nombre || items[0].id);
        }
      } catch {}
    };
    loadSucursales();
  }, []);

  // ─── Carga medicamentos ───
  useEffect(() => {
    const initData = async () => {
      if (!cacheMedicamentosIndex) {
        try {
          const snap = await getDocs(collection(db, 'catalogo_medicamentos'));
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.activo !== false).map(toMedicationSearchRow).filter((m) => m.nombreComercial || m.sustanciaActiva);
          if (rows.length > 0) { cacheMedicamentosIndex = rows; return; }
          const res = await fetch('/data/medicamentos.json');
          if (res.ok) { const raw = await res.json(); cacheMedicamentosIndex = raw.map(toMedicationSearchRow); }
        } catch (e) { console.error("Error cargando medicamentos JSON", e); }
      }
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
    if (queryText.length <= 2 || !cacheMedicamentosIndex) { setSugerenciasMeds([]); setMostrarMeds(false); return undefined; }
    const timer = setTimeout(() => {
      const results = cacheMedicamentosIndex.filter((m) => m.searchText.includes(queryText)).slice(0, 12);
      setSugerenciasMeds(results); setMostrarMeds(true);
    }, 140);
    return () => clearTimeout(timer);
  }, [formFarmacia.compuesto]);

  // ─── Progreso del día (realtime) ───
  useEffect(() => {
    const hoyStr = new Date().toLocaleDateString('en-CA');
    const q = query(collection(db, "bitacoras_operativas"), where("fechaString", "==", hoyStr), where("sucursal", "==", sucursalActiva || sucursal));
    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(d => d.data());
      setProgresoHoy({
        temp_8: logs.some(l => l.tipo === 'Temperatura' && l.turno === '8:00 a.m.'),
        temp_16: logs.some(l => l.tipo === 'Temperatura' && l.turno === '4:00 p.m.'),
        temp_22: logs.some(l => l.tipo === 'Temperatura' && l.turno === '10:00 p.m.'),
        cloro_1: logs.some(l => l.tipo === 'Cloro y PH'),
        limpieza: new Set(logs.filter(l => l.tipo === 'Limpieza').map(l => l.area)).size,
        pedido_medicamento: logs.some(l => l.tipo === 'Pedido de medicamento')
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
        const result = await askGemini({ prompt: [prompt, { inlineData: { data: base64Data, mimeType: file.type } }] });
        let rawText = result.data.result.replace(/```json/g, "").replace(/```/g, "").trim();
        const info = JSON.parse(rawText);
        setFormFarmacia(prev => ({ ...prev, factura: info.factura || prev.factura, compuesto: info.compuesto || prev.compuesto, lote: info.lote || prev.lote, cantidad: info.cantidad || prev.cantidad, caducidad: info.caducidad || prev.caducidad }));
        showToast("Datos extraídos correctamente", "success");
        setIaLoading(false);
      };
    } catch (err) { setIaLoading(false); showToast("Fallo en el análisis de la imagen. Ingrese datos manualmente.", "error"); }
  };

  const handleBuscadorMedicamentos = (e) => {
    const val = e.target.value;
    setFormFarmacia({ ...formFarmacia, compuesto: val });
    setIndiceMeds(-1);
    if (normalizeText(val).length <= 2) { setSugerenciasMeds([]); setMostrarMeds(false); }
  };

  const seleccionarMedicamento = (med) => {
    let formaInferida = 'Otra';
    const pres = (med.presentacion || '').toUpperCase();
    const sust = (med.sustanciaActiva || '').toUpperCase();
    if (pres.includes('TAB') || sust.includes('TAB')) formaInferida = 'Tableta';
    else if (pres.includes('CAP') || sust.includes('CAP')) formaInferida = 'Cápsula';
    else if (pres.includes('CREM') || sust.includes('CREM')) formaInferida = 'Crema';
    else if (pres.includes('SUSP') || sust.includes('SUSP')) formaInferida = 'Suspensión';
    else if (pres.includes('JARABE') || sust.includes('JARABE')) formaInferida = 'Jarabe';
    else if (pres.includes('AMP') || sust.includes('AMP')) formaInferida = 'Ampolleta';
    else if (pres.includes('OVU') || sust.includes('OVU')) formaInferida = 'Óvulo';
    else if (pres.includes('SOL') || sust.includes('SOL')) formaInferida = 'Solución';
    else if (pres.includes('GEL') || sust.includes('GEL')) formaInferida = 'Gel';
    else if (pres.includes('GOTAS') || sust.includes('GOTAS')) formaInferida = 'Gotas';
    else if (pres.includes('POMADA') || sust.includes('POMADA')) formaInferida = 'Pomada';
    const nombreComercial = med.nombreComercial || '';
    const sustanciaActiva = med.sustanciaActiva ? `(${med.sustanciaActiva})` : '';
    setFormFarmacia({ ...formFarmacia, compuesto: `${nombreComercial} ${sustanciaActiva}`.trim(), presentacion: med.presentacion || '', forma: formaInferida });
    setMostrarMeds(false);
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

  // ─── GUARDAR ───
  const handleGuardar = async () => {
    setLoading(true);
    try {
      let datosGuardar = { fecha: serverTimestamp(), fechaString: new Date().toLocaleDateString('en-CA'), responsableNombre: enfermeraNombre, sucursal: sucursalActiva || sucursal || 'Sin asignar', estado: 'completado' };
      if (tipoRegistro === 'temperatura') {
        if (!formTemp.t_ext || !formTemp.t_ref || !formTemp.humedad) { setLoading(false); return showToast("Faltan datos de temperatura o humedad.", "error"); }
        datosGuardar = { ...datosGuardar, tipo: 'Temperatura', area: 'Red de Frío', turno: formTemp.turno, detalles: formTemp };
      } else if (tipoRegistro === 'cloro') {
        if (!formCloro.ph_1 || !formCloro.cloro_1) { setLoading(false); return showToast("Faltan datos en Lavado de Manos 1.", "error"); }
        datosGuardar = { ...datosGuardar, tipo: 'Cloro y PH', area: 'Estaciones de Lavado', detalles: formCloro };
      } else if (tipoRegistro === 'limpieza') {
        if (!Object.values(formLimpieza.tareas).some(v => v === true)) { setLoading(false); return showToast("Marque al menos una tarea realizada.", "error"); }
        datosGuardar = { ...datosGuardar, tipo: 'Limpieza', area: formLimpieza.area, detalles: formLimpieza.tareas };
      } else if (tipoRegistro === 'farmacia') {
        if (!formFarmacia.compuesto || !formFarmacia.cantidad || !formFarmacia.caducidad || !formFarmacia.lote) { setLoading(false); return showToast("Llene Compuesto, Cantidad, Lote y Caducidad.", "error"); }
        datosGuardar = { ...datosGuardar, tipo: 'Farmacia', area: formFarmacia.tipo_movimiento, detalles: formFarmacia };
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
          pedido: String(row.pedido || '').trim()
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

        {/* ── SIDEBAR DRAWER (oculto por defecto) ── */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 transition-opacity" onClick={() => setSidebarOpen(false)} />}
        <aside className={`fixed top-0 left-0 h-full w-[280px] bg-white border-r border-slate-200 z-50 flex flex-col shadow-2xl shadow-slate-900/10 transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}>
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
            <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <X size={18}/>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {REGISTRO_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tipoRegistro === tab.id;
              return (
                <button key={tab.id} onClick={() => { setTipoRegistro(tab.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : tab.id === 'carro_rojo'
                        ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : tab.id === 'carro_rojo' ? 'text-rose-400' : 'text-slate-400'}/> {tab.label}
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
                <MapPin size={12} className="sm:w-3.5 sm:h-3.5 text-blue-500 hidden sm:block"/>
                <select
                  value={sucursalActiva}
                  onChange={(e) => setSucursalActiva(e.target.value)}
                  className="px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] sm:text-[11px] font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all max-w-[110px] sm:max-w-[160px]"
                >
                  {catalogoSucursales.length === 0 && <option value={sucursalActiva}>{sucursalActiva || 'Sin sucursal'}</option>}
                  {catalogoSucursales.map(s => (
                    <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>
                  ))}
                </select>
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

          {/* ─── SCROLLABLE CONTENT ─── */}
          <div className={contentWrapClass}>

            {/* ════ FARMACIA ════ */}
            {tipoRegistro === 'farmacia' && (
              <div className="flex flex-col gap-5 flex-1 max-w-5xl w-full mx-auto">
                {/* Tipo movimiento + IA Scanner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 shrink-0">
                    {['Recepción', 'Entrada (Traspaso)', 'Salida (Traspaso)'].map(mov => (
                      <button key={mov} onClick={() => setFormFarmacia({ ...formFarmacia, tipo_movimiento: mov })}
                        className={`whitespace-nowrap px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all ${
                          formFarmacia.tipo_movimiento === mov ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                        }`}>{mov}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200/60 rounded-xl px-5 py-3 flex-1 w-full sm:w-auto">
                    <Sparkles size={18} className="text-indigo-500 shrink-0"/>
                    <span className="text-[13px] font-semibold text-indigo-700">Lectura IA</span>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={procesarFacturaIA}/>
                    <button onClick={() => fileInputRef.current.click()} disabled={iaLoading}
                      className="ml-auto bg-indigo-600 text-white px-5 py-2 rounded-lg text-[13px] font-bold hover:bg-indigo-700 flex items-center gap-2 shrink-0 transition-all active:scale-95 disabled:opacity-50">
                      {iaLoading ? <Loader2 size={15} className="animate-spin"/> : <ScanText size={15}/>}
                      {iaLoading ? 'Leyendo...' : 'Escanear'}
                    </button>
                  </div>
                </div>

                {/* Buscador medicamento */}
                <div className="relative z-20">
                  <label className={labelBase}>Compuesto / Medicamento *</label>
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input className={`${inputBase} pl-11 font-semibold text-base`} placeholder="Buscar medicamento..."
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
                  {mostrarMeds && (
                    <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl mt-1.5 max-h-56 overflow-y-auto z-50 shadow-lg p-1.5">
                      {sugerenciasMeds.map((m, i) => (
                        <div key={i} ref={el => { if (i === indiceMeds && el) el.scrollIntoView({ block: 'nearest' }) }}
                          onMouseDown={() => { seleccionarMedicamento(m); setIndiceMeds(-1); }}
                          className={`px-3 py-2.5 cursor-pointer rounded-lg transition-colors ${i === indiceMeds ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <p className="text-[15px] font-bold text-slate-800">{m.nombreComercial}</p>
                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{m.sustanciaActiva} • {m.presentacion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grid de campos — 3 cols */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <div><label className={labelBase}>Factura</label><input className={inputBase} placeholder="Nº de factura" value={formFarmacia.factura} onChange={e => setFormFarmacia({ ...formFarmacia, factura: e.target.value })}/></div>
                  <div><label className={labelBase}>Lote *</label><input className={inputBase} placeholder="Lote de fabricación" value={formFarmacia.lote} onChange={e => setFormFarmacia({ ...formFarmacia, lote: e.target.value })}/></div>
                  <div><label className={labelBase}>Caducidad *</label><input type="date" className={inputBase} value={formFarmacia.caducidad} onChange={e => setFormFarmacia({ ...formFarmacia, caducidad: e.target.value })}/></div>
                  <div><label className={labelBase}>Presentación</label><input className={inputBase} placeholder="Ej: Caja 30 tabs" value={formFarmacia.presentacion} onChange={e => setFormFarmacia({ ...formFarmacia, presentacion: e.target.value })}/></div>
                  <div><label className={labelBase}>Forma Farmacéutica</label><input className={inputBase} placeholder="Ej: Tableta" value={formFarmacia.forma} onChange={e => setFormFarmacia({ ...formFarmacia, forma: e.target.value })}/></div>
                  <div>
                    <label className={labelBase}>Cantidad *</label>
                    <input type="number" className={`${inputBase} font-black text-lg text-blue-700 bg-blue-50/50 border-blue-200 focus:border-blue-400`} placeholder="Cajas / Pzas"
                      value={formFarmacia.cantidad} onChange={e => setFormFarmacia({ ...formFarmacia, cantidad: e.target.value })}/>
                  </div>
                </div>

                {/* Criterios + Observaciones — flex-1 para llenar espacio */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 flex-1 min-h-0">
                  {formFarmacia.tipo_movimiento === 'Recepción' && (
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-4">Criterio de Aceptación</p>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors">
                          <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded shrink-0" checked={formFarmacia.criterio_empaque} onChange={e => setFormFarmacia({ ...formFarmacia, criterio_empaque: e.target.checked })}/>
                          <span className="text-[15px] font-medium text-slate-700">Empaque sin daños físicos</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors">
                          <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded shrink-0" checked={formFarmacia.criterio_etiqueta} onChange={e => setFormFarmacia({ ...formFarmacia, criterio_etiqueta: e.target.checked })}/>
                          <span className="text-[15px] font-medium text-slate-700">Etiqueta íntegra y legible</span>
                        </label>
                      </div>
                    </div>
                  )}
                  <div className={`flex flex-col ${formFarmacia.tipo_movimiento === 'Recepción' ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
                    <label className={labelBase}>Observaciones</label>
                    <textarea className={`${inputBase} flex-1 min-h-[120px] resize-none`} placeholder="Notas sobre empaque, mermas, etc." value={formFarmacia.observaciones} onChange={e => setFormFarmacia({ ...formFarmacia, observaciones: e.target.value })}/>
                  </div>
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
                    <div className="flex items-center gap-2 shrink-0">
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
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-4">Turno de Medición</p>
                  <div className="flex gap-3 mb-6">
                    {['8:00 a.m.', '4:00 p.m.', '10:00 p.m.'].map(t => (
                      <button key={t} onClick={() => setFormTemp({ ...formTemp, turno: t })}
                        className={`flex-1 py-3 rounded-xl text-[14px] font-bold transition-all ${
                          formTemp.turno === t ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white'
                        }`}>{t}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div><label className={labelBase}>T° Exterior</label><input type="number" step="0.1" placeholder="°C exterior" className={inputBase} value={formTemp.t_ext} onChange={e => setFormTemp({ ...formTemp, t_ext: e.target.value })}/></div>
                    <div><label className={labelBase}>Humedad %</label><input type="number" placeholder="% humedad" className={inputBase} value={formTemp.humedad} onChange={e => setFormTemp({ ...formTemp, humedad: e.target.value })}/></div>
                    <div><label className={labelBase}>T° Refrigerador</label><input type="number" step="0.1" placeholder="°C refrigerador" className={`${inputBase} border-blue-300 bg-blue-50/40 focus:border-blue-400`} value={formTemp.t_ref} onChange={e => setFormTemp({ ...formTemp, t_ref: e.target.value })}/></div>
                  </div>
                </div>
                <div className="flex gap-3 items-center bg-amber-50 border border-amber-200/80 rounded-xl px-5 py-3.5">
                  <AlertCircle size={16} className="text-amber-500 shrink-0"/>
                  <p className="text-[14px] text-amber-800 font-medium">Refrigerador normativo: <strong>2°C – 8°C</strong>. Reporte desviaciones a jefatura.</p>
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
              <BitacoraCarroRojo embedded />
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
                {tipoRegistro === 'pedido_medicamento' && (
                  <button
                    type="button"
                    onClick={limpiarPedidoMedicamento}
                    className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-200 text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
                <button onClick={handleGuardar} disabled={loading}
                  className="bg-slate-900 hover:bg-black text-white px-4 sm:px-7 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm disabled:opacity-50 transition-all active:scale-[0.97]">
                  {loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} className="sm:w-4 sm:h-4"/>}
                  {loading ? 'Guardando...' : 'Guardar'}
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