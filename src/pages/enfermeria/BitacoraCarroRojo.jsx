import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Printer, Plus, Trash2, Edit3, Eye, Check, X,
  MapPin, ShieldAlert, Package, Pill, AlertCircle, CheckCircle2,
  ChevronDown, TrendingUp, AlertTriangle
} from 'lucide-react';
import { db } from '../../config/firebase';
import {
  collection, doc, setDoc, onSnapshot, serverTimestamp, addDoc, getDocs,
  query, orderBy, limit
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { alignSucursalData, tieneDatosHuerfanos, nombresDesdeHistorial } from '../../utils/carroRojoData';

/* ═══════════════════════════════════════════════════════════════
   DATOS INICIALES
   ═══════════════════════════════════════════════════════════════ */
const MATERIAL_CURACION_INICIAL = [
  'Apósitos','Algodón','Campos estériles','Gasas',
  'Guantes quirúrgicos estériles','Jeringas desechables con aguja diversas medidas',
  'Material de sutura','Soluciones antisépticas','Tela adhesiva',
  'Tiras reactivas para la determinación de glucosa en sangre',
  'Vendas elásticas diversas medidas','Vendas de yeso',
];
const MEDICAMENTOS_INICIAL = [
  'Acido acetilsalicílico, tabletas 100 mg.','Acido acetilsalicílico, tabletas 500 mg.',
  'Ketorolaco, solución inyectable 30 mg.','Metamizol, solución inyectable 500 mg.',
  'Paracetamol, tabletas 500 mg.','Lidocaína simple, solución inyectable al 2%',
  'Nifedipino, cápsulas 10 mg.','Trinitrato de glicerilo, cápsulas o tabletas masticables 6.8 mg.',
  'Difenhidramina, solución oral','Epinefrina, solución inyectable 1 mg 1:1000/ml.',
  'Acetato de metilprednisolona, solución inyectable 40 mg.',
  'Bultilhioscina, solución inyectable 20 mg.','Furosemida, solución inyectable 20 mg.',
  'Salbutamol, spray','Diazepan, solución inyectable 10 mg.',
  'Difenidol, solución inyectable 40 mg.','Dimenhidrinato, solución inyectable 50 mg.',
  'Agua bidestilada, solución inyectable 2 ml.','Cloruro de sodio, solución al 0.9%',
  'Glucosa, solución al 5%','Glucosa, solución al 10%','Glucosa, solución al 50%',
  'Solución de Hartmann',
];
const buildDefaultPlantilla = (items) => items.map((nombre, i) => ({ id: `item_${i + 1}`, articulo: nombre, cantidadExistir: '' }));

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const normSucursal = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const isJefatura = (rol) => {
  const r = (rol || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['jefa_enfermeria', 'jefa', 'admin', 'admin_maestro', 'administrador'].includes(r);
};

const getCadStatus = (caducidad) => {
  if (!caducidad) return { color: '', label: '', level: 0 };
  const dias = Math.ceil((new Date(caducidad) - new Date()) / 86400000);
  if (dias <= 0)  return { color: 'bg-red-100 text-red-700 border-red-200 ring-red-100', label: 'VENCIDO', level: 3 };
  if (dias <= 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-50', label: `${dias}d`, level: 2 };
  if (dias <= 90) return { color: 'bg-amber-50 text-amber-600 border-amber-200 ring-amber-50', label: `${dias}d`, level: 1 };
  return { color: 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-emerald-50', label: 'OK', level: 0 };
};

const getStockStatus = (existir, existente) => {
  const a = parseFloat(existir), b = parseFloat(existente);
  if (isNaN(a) || isNaN(b) || a === 0) return { color: '', pct: null };
  const pct = b / a;
  if (pct <= 0)  return { color: 'bg-red-100 text-red-700', pct };
  if (pct < 0.5) return { color: 'bg-red-50 text-red-700', pct };
  if (pct < 0.8) return { color: 'bg-amber-50 text-amber-700', pct };
  return { color: 'bg-emerald-50 text-emerald-700', pct };
};

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-sm text-sm font-bold max-w-[92vw] ${
    type === 'error'   ? 'bg-red-50/95 border-red-200 text-red-700 shadow-red-500/10' :
    type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700 shadow-amber-500/10' :
                         'bg-emerald-50/95 border-emerald-200 text-emerald-700 shadow-emerald-500/10'
  }`}>
    {type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
    <span className="text-[13px]">{msg}</span>
    <button onClick={onClose} className="ml-1 p-1 hover:bg-black/5 rounded-full"><X size={14}/></button>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   IMPRESIÓN
   ═══════════════════════════════════════════════════════════════ */
const generarFormatoImpresion = ({ sucursal, materialRows, medicamentoRows, usuario }) => {
  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const mesActual = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
  const horaGen = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const buildSectionRows = (sectionTitle, rows) => {
    let html = `<tr><td class="sep" colspan="4"></td></tr><tr><td class="st" colspan="4"><b>${sectionTitle}</b></td></tr><tr><td class="h">No.</td><td class="h" style="text-align:left">Artículo</td><td class="h">Cantidad</td><td class="h">Caducidad</td></tr>`;
    rows.forEach((row, i) => {
      const cad = row.caducidad ? row.caducidad.split('-').reverse().join('/') : '';
      html += `<tr><td class="c n">${i + 1}</td><td class="c a">${row.articulo}</td><td class="c v">${row.cantidadExistir || ''}</td><td class="c v">${cad}</td></tr>`;
    });
    return html;
  };
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Botiquín de Urgencias — ${sucursal}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',Times,serif;color:#000;font-size:7.5pt;line-height:1.15;padding:10mm 14mm 8mm 14mm}h1{font-size:10pt;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:3pt}.mes{text-align:center;font-size:8.5pt;font-weight:bold;margin-bottom:6pt}.mes u{text-decoration:underline}.info{font-size:7.5pt;margin-bottom:5pt;display:flex;justify-content:space-between}.info b{margin-right:2pt}table.m{width:100%;border-collapse:collapse;font-size:7.5pt}table.m .sep{height:5pt;border:none}table.m .st{text-align:center;font-size:8pt;padding:2pt 0;border:0.5pt solid #000}table.m .h{border:0.5pt solid #000;padding:1.5pt 3pt;font-weight:bold;text-align:center;font-size:7pt}table.m .c{border:0.5pt solid #000;padding:1.2pt 3pt}table.m .c.n{text-align:center;width:20pt}table.m .c.a{text-align:left}table.m .c.v{text-align:center;width:52pt}.firmas{margin-top:18pt;display:flex;justify-content:space-between;padding:0 6pt}.fb{text-align:center;width:30%}.fb .fl{border-top:0.5pt solid #000;margin-top:28pt;padding-top:2pt;font-size:7pt;font-weight:bold}.fb .fr{font-size:6pt;font-style:italic}.foot{text-align:center;margin-top:6pt;font-size:5.5pt;color:#666;border-top:0.3pt solid #bbb;padding-top:2pt}.pa{position:fixed;bottom:16px;right:16px;z-index:100}.pa button{padding:10px 22px;border:none;border-radius:4px;font:bold 12px system-ui,sans-serif;cursor:pointer;background:#000;color:#fff}.pa button:hover{background:#333}@media print{.pa{display:none!important}}</style></head><body><h1>Material de Curación y Medicamentos para el Botiquín de Urgencias</h1><div class="mes">MES: <u>${mesActual}</u></div><div class="info"><span><b>Sucursal:</b> ${sucursal || ''}</span><span><b>Fecha:</b> ${fechaHoy}</span><span><b>Responsable:</b> ${usuario || ''}</span></div><table class="m">${buildSectionRows('Material de curación', materialRows)}${buildSectionRows('Medicamentos', medicamentoRows)}</table><div class="firmas"><div class="fb"><div class="fl">Responsable de Carro Rojo</div><div class="fr">Enfermería</div></div><div class="fb"><div class="fl">Jefa de Enfermería</div><div class="fr">Supervisión y Validación</div></div><div class="fb"><div class="fl">Dirección Médica</div><div class="fr">Vo. Bo.</div></div></div><div class="foot">Generado el ${fechaHoy} a las ${horaGen} — ${sucursal || ''} — Uso interno</div><div class="pa"><button onclick="window.print()">Imprimir</button></div></body></html>`;
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
const BitacoraCarroRojo = ({ embedded = false, sucursal: sucursalProp = '' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esJefa = isJefatura(user?.rol);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [sucursalActiva, setSucursalActiva] = useState(searchParams.get('sucursal') || sucursalProp || '');

  const [plantillaMaterial, setPlantillaMaterial] = useState([]);
  const [plantillaMedicamento, setPlantillaMedicamento] = useState([]);
  const [sucursalMaterialData, setSucursalMaterialData] = useState({});
  const [sucursalMedicamentoData, setSucursalMedicamentoData] = useState({});

  const [editMode, setEditMode] = useState(false);
  const [newRowTarget, setNewRowTarget] = useState(null);
  const [newRowName, setNewRowName] = useState('');
  const [showSucDropdown, setShowSucDropdown] = useState(false);
  const [bloqueado, setBloqueado] = useState(false); // true = este mes en esta sucursal ya fue enviado

  // Mes actual como estado con refresco periódico: si la pestaña queda abierta
  // al cambiar de mes, la bitácora debe empezar a operar sobre el mes nuevo.
  const [mesActual, setMesActual] = useState(() => new Date().toLocaleDateString('en-CA').slice(0, 7)); // "2026-07"
  useEffect(() => {
    const id = setInterval(() => setMesActual(new Date().toLocaleDateString('en-CA').slice(0, 7)), 60000);
    return () => clearInterval(id);
  }, []);

  const toastTimer = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownMobileRef = useRef(null);
  const autoSelectDone = useRef(false);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ show: true, msg, type });
    toastTimer.current = setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      const insideDesktop = dropdownRef.current && dropdownRef.current.contains(e.target);
      const insideMobile = dropdownMobileRef.current && dropdownMobileRef.current.contains(e.target);
      if (!insideDesktop && !insideMobile) setShowSucDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'catalogo_sucursales'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.activo !== false);
      setCatalogoSucursales(items);
    });
    return () => unsub();
  }, []);

  // Sincronizar con sucursal prop (ej. desde modal) cuando está embebido
  useEffect(() => {
    if (embedded && sucursalProp) {
      setSucursalActiva(sucursalProp);
    }
  }, [embedded, sucursalProp]);

  // Auto-seleccionar sucursal del perfil del usuario cuando carga el catálogo
  // SOLO si hay una sucursal explícita en URL/props. Si no, jefatura se queda en modo
  // "plantilla global" sin sucursal, que es lo correcto para editar la plantilla.
  useEffect(() => {
    if (autoSelectDone.current) return;
    if (!catalogoSucursales.length || !user) return;

    const explicitSucursal = searchParams.get('sucursal') || sucursalProp;
    if (explicitSucursal && explicitSucursal.trim()) {
      // Ya viene una sucursal explícita, el estado inicial la tiene
      autoSelectDone.current = true;
      return;
    }

    // Si no hay sucursal explícita y es jefatura, NO auto-seleccionar
    // -> se queda en modo plantilla global
    if (esJefa) {
      autoSelectDone.current = true;
      return;
    }

    // Solo para no-jefatura: intentar matchear del perfil
    if (sucursalActiva) { autoSelectDone.current = true; return; }

    const matched = catalogoSucursales.find(s => {
      // Comparar por ID: campos modernos + legacy
      if (user.sessionSucursalId && String(s.id).trim() === String(user.sessionSucursalId).trim()) return true;
      if (user.sucursalActualId && String(s.id).trim() === String(user.sucursalActualId).trim()) return true;
      if (user.sucursalId && String(s.id).trim() === String(user.sucursalId).trim()) return true;
      // Comparar por nombre normalizado: campos modernos + legacy
      if (user.sessionSucursalNombre && normSucursal(s.nombre || s.id) === normSucursal(user.sessionSucursalNombre)) return true;
      if (user.sucursalActual && normSucursal(s.nombre || s.id) === normSucursal(user.sucursalActual)) return true;
      if (user.sucursal && normSucursal(s.nombre || s.id) === normSucursal(user.sucursal)) return true;
      return false;
    });

    if (matched) {
      setSucursalActiva(matched.nombre || matched.id);
    }
    autoSelectDone.current = true;
  }, [catalogoSucursales, user, sucursalActiva, sucursalProp, esJefa, searchParams]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'bitacora_carro_rojo', '_plantilla'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPlantillaMaterial(d.materialCuracion || buildDefaultPlantilla(MATERIAL_CURACION_INICIAL));
        setPlantillaMedicamento(d.medicamentos || buildDefaultPlantilla(MEDICAMENTOS_INICIAL));
      } else {
        setPlantillaMaterial(buildDefaultPlantilla(MATERIAL_CURACION_INICIAL));
        setPlantillaMedicamento(buildDefaultPlantilla(MEDICAMENTOS_INICIAL));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!sucursalActiva) { setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'bitacora_carro_rojo', sucursalActiva), async (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        let matData = d.materialData || {};
        let medData = d.medicamentoData || {};

        // Re-alinear con la plantilla vigente. Si se eliminaron y re-agregaron
        // artículos, los datos quedaron bajo ids viejos ("huérfanos"). Se
        // recuperan por nombre de artículo; para datos legacy sin nombre, se
        // obtiene el nombre del último snapshot del historial.
        let nombresPorId = {};
        if (tieneDatosHuerfanos(plantillaMaterial, matData) || tieneDatosHuerfanos(plantillaMedicamento, medData)) {
          try {
            const histSnap = await getDocs(query(
              collection(db, 'bitacora_carro_rojo', sucursalActiva, 'historial'),
              orderBy('fecha', 'desc'), limit(1)
            ));
            if (!histSnap.empty) nombresPorId = nombresDesdeHistorial(histSnap.docs[0].data());
          } catch { /* sin recuperación vía historial */ }
        }
        matData = alignSucursalData(plantillaMaterial, matData, nombresPorId);
        medData = alignSucursalData(plantillaMedicamento, medData, nombresPorId);
        // `mes` se escribe en CADA guardado (parcial o completo). `mesBloqueado`
        // solo cuando está al 100%. Docs antiguos sin `mes` ni `mesBloqueado`
        // con datos se asumen del mes en curso (mismo criterio que jefatura).
        const docMes = d.mes || d.mesBloqueado || '';
        const hayDatos = Object.keys(d.materialData || {}).length > 0 || Object.keys(d.medicamentoData || {}).length > 0;
        const esDelMesActual = docMes === mesActual || (!docMes && hayDatos);

        if (esDelMesActual) {
          setSucursalMaterialData(matData);
          setSucursalMedicamentoData(medData);
          const allMatFilled = plantillaMaterial.every(item => matData[item.id]?.cantidadExistente);
          const allMedFilled = plantillaMedicamento.every(item => medData[item.id]?.cantidadExistente);
          setBloqueado(d.mesBloqueado === mesActual && allMatFilled && allMedFilled);
        } else {
          // Mes nuevo: se reinician las cantidades para el re-conteo, pero las
          // caducidades se conservan (la caducidad física no cambia con el mes).
          const soloCaducidades = (data) => Object.fromEntries(
            Object.entries(data)
              .filter(([, v]) => v?.caducidad)
              .map(([id, v]) => [id, { caducidad: v.caducidad, articulo: v.articulo || '' }])
          );
          setSucursalMaterialData(soloCaducidades(matData));
          setSucursalMedicamentoData(soloCaducidades(medData));
          setBloqueado(false);
        }
      } else {
        setSucursalMaterialData({});
        setSucursalMedicamentoData({});
        setBloqueado(false);
      }
      setLoading(false);
    }, () => { showToast('Error al cargar datos de sucursal', 'error'); setLoading(false); });
    return () => unsub();
  }, [sucursalActiva, mesActual, plantillaMaterial, plantillaMedicamento, showToast]);

  const mergeRows = (plantilla, sucData) =>
    plantilla.map(item => ({ ...item, cantidadExistente: sucData[item.id]?.cantidadExistente || '', caducidad: sucData[item.id]?.caducidad || '' }));

  const materialRows = mergeRows(plantillaMaterial, sucursalMaterialData);
  const medicamentoRows = mergeRows(plantillaMedicamento, sucursalMedicamentoData);

  // Stats
  const stats = useMemo(() => {
    const all = [...materialRows, ...medicamentoRows];
    let filled = 0, warnings = 0, expired = 0;
    all.forEach(r => {
      if (r.cantidadExistente) filled++;
      const cad = getCadStatus(r.caducidad);
      if (cad.level >= 3) expired++;
      else if (cad.level >= 1) warnings++;
    });
    return { total: all.length, filled, warnings, expired, pct: all.length > 0 ? Math.round((filled / all.length) * 100) : 0 };
  }, [materialRows, medicamentoRows]);

  const updatePlantillaRow = (tabla, id, field, value) => {
    const setter = tabla === 'material' ? setPlantillaMaterial : setPlantillaMedicamento;
    setter(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const updateSucursalData = (tabla, id, field, value) => {
    const setter = tabla === 'material' ? setSucursalMaterialData : setSucursalMedicamentoData;
    setter(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleAddRow = (tabla) => {
    if (!newRowName.trim()) return;
    const setter = tabla === 'material' ? setPlantillaMaterial : setPlantillaMedicamento;
    setter(prev => [...prev, { id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, articulo: newRowName.trim(), cantidadExistir: '' }]);
    setNewRowName('');
    setNewRowTarget(null);
  };

  const handleDeleteRow = (tabla, id) => {
    const setter = tabla === 'material' ? setPlantillaMaterial : setPlantillaMedicamento;
    setter(prev => prev.filter(row => row.id !== id));
  };

  const handleGuardar = async () => {
    if (!sucursalActiva && !modoTemplate) {
      showToast('Seleccione una sucursal antes de guardar.', 'error');
      return;
    }
    if (sucursalActiva && bloqueado && !modoTemplate) {
      showToast(`La bitácora de ${mesActual} ya fue completada y bloqueada.`, 'warning');
      return;
    }
    setSaving(true);

    const allMatFilled = plantillaMaterial.every(item => sucursalMaterialData[item.id]?.cantidadExistente);
    const allMedFilled = plantillaMedicamento.every(item => sucursalMedicamentoData[item.id]?.cantidadExistente);
    const todoCompleto = allMatFilled && allMedFilled;

    // Normalizar: escribir explícitamente TODOS los artículos de la plantilla.
    // Con setDoc(merge) los mapas se fusionan campo a campo; si no escribimos
    // los vacíos, cantidades de meses anteriores "resucitarían" en Firestore.
    // Se guarda también el nombre del artículo: es el respaldo que permite
    // recuperar los datos si cambian los ids de la plantilla.
    const buildData = (plantilla, local) => Object.fromEntries(
      plantilla.map(item => [item.id, {
        articulo: item.articulo || '',
        cantidadExistente: local[item.id]?.cantidadExistente || '',
        caducidad: local[item.id]?.caducidad || ''
      }])
    );
    const materialData = buildData(plantillaMaterial, sucursalMaterialData);
    const medicamentoData = buildData(plantillaMedicamento, sucursalMedicamentoData);

    try {
      const promises = [];
      if (esJefa) {
        promises.push(
          setDoc(doc(db, 'bitacora_carro_rojo', '_plantilla'), {
            materialCuracion: plantillaMaterial,
            medicamentos: plantillaMedicamento,
            ultimaActualizacion: serverTimestamp(),
            actualizadoPor: user?.nombre || 'Desconocido',
          }, { merge: true })
        );
      }
      if (sucursalActiva) {
        promises.push(
          setDoc(doc(db, 'bitacora_carro_rojo', sucursalActiva), {
            sucursal: sucursalActiva,
            materialData,
            medicamentoData,
            // Mes al que pertenece la captura (se escribe SIEMPRE, también en parciales)
            mes: mesActual,
            mesBloqueado: todoCompleto ? mesActual : '',
            ultimaActualizacion: serverTimestamp(),
            actualizadoPor: user?.nombre || 'Desconocido',
            actualizadoPorRol: user?.rol || '',
          }, { merge: true })
        );
        promises.push(
          addDoc(collection(db, 'bitacora_carro_rojo', sucursalActiva, 'historial'), {
            plantillaMaterial: plantillaMaterial,
            plantillaMedicamento: plantillaMedicamento,
            materialData,
            medicamentoData,
            mes: mesActual,
            fecha: serverTimestamp(),
            actualizadoPor: user?.nombre || 'Desconocido',
            actualizadoPorRol: user?.rol || '',
            completo: todoCompleto,
          })
        );
      }
      await Promise.all(promises);
      setBloqueado(todoCompleto);
      showToast(modoTemplate
        ? 'Plantilla guardada exitosamente'
        : todoCompleto
          ? `Bitácora de ${mesActual} completada y bloqueada`
          : 'Progreso guardado. Puedes seguir llenando después.');
      setEditMode(false);
    } catch (e) {
      console.error('Error al guardar bitácora de carro rojo:', e);
      showToast(`Error al guardar: ${e?.code || e?.message || 'desconocido'}`, 'error');
    }
    setSaving(false);
  };

  const handlePrint = () => {
    const html = generarFormatoImpresion({ sucursal: sucursalActiva, materialRows, medicamentoRows, usuario: user?.nombre || 'Desconocido' });
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) { showToast('Ventana de impresión bloqueada por el navegador', 'warning'); URL.revokeObjectURL(url); return; }
    win.addEventListener('afterprint', () => URL.revokeObjectURL(url));
    win.addEventListener('unload', () => URL.revokeObjectURL(url));
  };

  const sucursalCatalogo = useMemo(() =>
    catalogoSucursales.find(s => (s.nombre || s.id) === sucursalActiva),
    [catalogoSucursales, sucursalActiva]
  );

  const isMySucursal = esJefa || (
    sucursalCatalogo && (
      // Comparar por ID: campos modernos + legacy
      (user?.sessionSucursalId && String(sucursalCatalogo.id).trim() === String(user.sessionSucursalId).trim()) ||
      (user?.sucursalActualId && String(sucursalCatalogo.id).trim() === String(user.sucursalActualId).trim()) ||
      (user?.sucursalId && String(sucursalCatalogo.id).trim() === String(user.sucursalId).trim()) ||
      // Comparar por nombre normalizado: campos modernos + legacy
      normSucursal(sucursalCatalogo.nombre || sucursalCatalogo.id) === normSucursal(user?.sessionSucursalNombre) ||
      normSucursal(sucursalCatalogo.nombre || sucursalCatalogo.id) === normSucursal(user?.sucursalActual) ||
      normSucursal(sucursalCatalogo.nombre || sucursalCatalogo.id) === normSucursal(user?.sucursal)
    )
  );
  const canEditSucursal = esJefa || isMySucursal;
  const canEditPlantilla = esJefa;
  // Modo plantilla global: jefatura sin sucursal seleccionada
  const modoTemplate = !sucursalActiva && esJefa;

  const rootLayoutClass = embedded
    ? 'flex flex-col flex-1 min-h-0'
    : 'min-h-screen bg-slate-50/50 flex flex-col';

  /* ═══════════════════════════════════════════════════════════════
     RENDER TABLE
     ═══════════════════════════════════════════════════════════════ */
  const renderTable = (title, icon, rows, tabla, accent) => {
    const IconComp = icon;
    const gradients = {
      rose: { header: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/15' },
      blue: { header: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/15' },
    };
    const g = gradients[accent] || gradients.blue;

    return (
      <div className={`bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md ${g.shadow} transition-all`}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${g.header} px-4 sm:px-5 py-3.5 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <IconComp size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-[13px] sm:text-[14px] tracking-wide uppercase">{title}</h3>
              <p className="text-white/50 text-[10px] font-bold">{rows.length} artículos</p>
            </div>
          </div>
          {canEditPlantilla && (modoTemplate || editMode) && (
            <button onClick={() => { setNewRowTarget(tabla); setNewRowName(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold text-white transition-all backdrop-blur-sm">
              <Plus size={13} /> Agregar
            </button>
          )}
        </div>

        {/* ── Desktop table (md+) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-[5%]">#</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-[35%]">Artículo</th>
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-[15%]">
                  A Existir
                  {canEditPlantilla && <span className="block text-[8px] text-violet-400 font-bold mt-0.5 normal-case tracking-normal">plantilla global</span>}
                </th>
                {!modoTemplate && (
                  <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-[15%]">
                    Existente
                    <span className="block text-[8px] text-blue-400 font-bold mt-0.5 normal-case tracking-normal">{sucursalActiva || 'sucursal'}</span>
                  </th>
                )}
                {!modoTemplate && (
                  <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-[20%]">
                    Caducidad
                  </th>
                )}
                {canEditPlantilla && (modoTemplate || editMode) && (
                  <th className="px-2 py-3 w-[10%]" />
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const stock = getStockStatus(row.cantidadExistir, row.cantidadExistente);
                const cad = getCadStatus(row.caducidad);
                return (
                  <tr key={row.id} className={`border-b border-slate-100/80 transition-colors ${
                    cad.level >= 3 ? 'bg-red-50/30' : cad.level >= 2 ? 'bg-amber-50/20' : idx % 2 === 1 ? 'bg-slate-50/30' : ''
                  } hover:bg-slate-50/60`}>
                    <td className="px-4 py-2.5 text-[12px] font-bold text-slate-300 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      {(canEditPlantilla && (modoTemplate || editMode)) ? (
                        <input value={row.articulo} onChange={(e) => updatePlantillaRow(tabla, row.id, 'articulo', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
                      ) : (
                        <span className="text-[13px] font-semibold text-slate-800">{row.articulo}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEditPlantilla ? (
                        <input type="text" inputMode="decimal" value={row.cantidadExistir}
                          onChange={(e) => updatePlantillaRow(tabla, row.id, 'cantidadExistir', e.target.value.replace(/[^0-9.,]/g, ''))}
                          className="w-full px-3 py-2 bg-violet-50/40 border border-violet-200 rounded-xl text-[13px] font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-300 transition-all"
                          placeholder="—" />
                      ) : (
                        <span className="block text-center font-bold text-slate-700 text-[13px]">{row.cantidadExistir || '—'}</span>
                      )}
                    </td>
                    {!modoTemplate && (
                      <td className="px-3 py-2.5">
                        {(canEditSucursal && !bloqueado) ? (
                          <input type="text" inputMode="decimal" value={row.cantidadExistente}
                            onChange={(e) => updateSucursalData(tabla, row.id, 'cantidadExistente', e.target.value.replace(/[^0-9.,]/g, ''))}
                            className={`w-full px-3 py-2 border rounded-xl text-[13px] font-bold text-center outline-none focus:ring-2 focus:ring-blue-100 transition-all ${
                              stock.color ? stock.color + ' border-transparent' : 'bg-white border-slate-200'
                            }`}
                            placeholder="—" />
                        ) : (
                          <span className={`block text-center font-bold rounded-xl py-2 text-[13px] ${stock.color || 'text-slate-700'}`}>
                            {row.cantidadExistente || '—'}
                          </span>
                        )}
                      </td>
                    )}
                    {!modoTemplate && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 justify-center">
                          {(canEditSucursal && !bloqueado) ? (
                            <input type="date" value={row.caducidad}
                              onChange={(e) => updateSucursalData(tabla, row.id, 'caducidad', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-xl text-[12px] font-bold text-center outline-none focus:ring-2 focus:ring-blue-100 transition-all ${
                                cad.color ? cad.color : 'bg-white border-slate-200 text-slate-800'
                              }`} />
                          ) : (
                            <span className={`block text-center font-bold rounded-xl py-2 px-3 text-[12px] border ${cad.color || 'text-slate-700 bg-slate-50 border-slate-100'}`}>
                              {row.caducidad ? row.caducidad.split('-').reverse().join('/') : '—'}
                            </span>
                          )}
                          {cad.label && <span className={`text-[9px] font-black shrink-0 ${cad.level >= 3 ? 'text-red-500' : cad.level >= 2 ? 'text-amber-500' : cad.level >= 1 ? 'text-amber-400' : 'text-emerald-400'}`}>{cad.label}</span>}
                        </div>
                      </td>
                    )}
                    {canEditPlantilla && (modoTemplate || editMode) && (
                      <td className="px-2 py-2.5 text-center">
                        <button onClick={() => handleDeleteRow(tabla, row.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {/* Fila para agregar */}
              {canEditPlantilla && (modoTemplate || editMode) && newRowTarget === tabla && (
                <tr className="bg-blue-50/40 border-b border-blue-100">
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="flex items-center gap-2">
                      <input autoFocus value={newRowName} onChange={(e) => setNewRowName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddRow(tabla); if (e.key === 'Escape') { setNewRowTarget(null); setNewRowName(''); } }}
                        placeholder="Nombre del artículo..."
                        className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-blue-100" />
                      <button onClick={() => handleAddRow(tabla)} className="px-4 py-2.5 bg-blue-500 text-white rounded-xl text-[12px] font-bold hover:bg-blue-600 transition-all active:scale-[0.97]"><Check size={15} /></button>
                      <button onClick={() => { setNewRowTarget(null); setNewRowName(''); }} className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-[12px] font-bold hover:bg-slate-200 transition-all"><X size={15} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards (<md) ── */}
        <div className="md:hidden divide-y divide-slate-100/80">
          {rows.map((row, idx) => {
            const stock = getStockStatus(row.cantidadExistir, row.cantidadExistente);
            const cad = getCadStatus(row.caducidad);
            return (
              <div key={row.id} className={`px-4 py-3.5 ${cad.level >= 3 ? 'bg-red-50/30' : cad.level >= 2 ? 'bg-amber-50/20' : idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                {/* Row 1: Nombre + número */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-300 mt-1 shrink-0 tabular-nums w-5">{idx + 1}</span>
                    {canEditPlantilla && (modoTemplate || editMode) ? (
                      <input value={row.articulo} onChange={(e) => updatePlantillaRow(tabla, row.id, 'articulo', e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100" />
                    ) : (
                      <p className="text-[13px] font-bold text-slate-800 leading-snug flex-1">{row.articulo}</p>
                    )}
                  </div>
                  {canEditPlantilla && (modoTemplate || editMode) && (
                    <button onClick={() => handleDeleteRow(tabla, row.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                  {!modoTemplate && !editMode && cad.label && cad.level >= 2 && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                      cad.level >= 3 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>{cad.label}</span>
                  )}
                </div>

                {/* Row 2: campos según modo */}
                {modoTemplate ? (
                  <div className="ml-7">
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400/80 block mb-1">A Existir</span>
                    <input type="text" inputMode="decimal" value={row.cantidadExistir}
                      onChange={(e) => updatePlantillaRow(tabla, row.id, 'cantidadExistir', e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="w-full px-2 py-2 bg-violet-50/40 border border-violet-200/80 rounded-xl text-[12px] font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-violet-100"
                      placeholder="—" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 ml-7">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400/80 block mb-1">A Existir</span>
                      {canEditPlantilla ? (
                        <input type="text" inputMode="decimal" value={row.cantidadExistir}
                          onChange={(e) => updatePlantillaRow(tabla, row.id, 'cantidadExistir', e.target.value.replace(/[^0-9.,]/g, ''))}
                          className="w-full px-2 py-2 bg-violet-50/40 border border-violet-200/80 rounded-xl text-[12px] font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-violet-100"
                          placeholder="—" />
                      ) : (
                        <span className="block text-center font-bold text-[12px] text-slate-600 bg-slate-50 rounded-xl py-2">{row.cantidadExistir || '—'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400/80 block mb-1">Existente</span>
                      {(canEditSucursal && !bloqueado) ? (
                        <input type="text" inputMode="decimal" value={row.cantidadExistente}
                          onChange={(e) => updateSucursalData(tabla, row.id, 'cantidadExistente', e.target.value.replace(/[^0-9.,]/g, ''))}
                          className={`w-full px-2 py-2 border rounded-xl text-[12px] font-bold text-center outline-none focus:ring-2 focus:ring-blue-100 ${
                            stock.color ? stock.color + ' border-transparent' : 'bg-white border-slate-200 text-slate-800'
                          }`}
                          placeholder="—" />
                      ) : (
                        <span className={`block text-center font-bold text-[12px] rounded-xl py-2 ${stock.color || 'text-slate-600 bg-slate-50'}`}>
                          {row.cantidadExistente || '—'}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400/80 block mb-1">Caducidad</span>
                      {(canEditSucursal && !bloqueado) ? (
                        <input type="date" value={row.caducidad}
                          onChange={(e) => updateSucursalData(tabla, row.id, 'caducidad', e.target.value)}
                          className={`w-full px-1 py-2 border rounded-xl text-[10px] font-bold text-center outline-none focus:ring-2 focus:ring-blue-100 ${
                            cad.color ? cad.color : 'bg-white border-slate-200 text-slate-800'
                          }`} />
                      ) : (
                        <span className={`block font-bold text-[11px] rounded-xl py-2 text-center border ${cad.color || 'text-slate-600 bg-slate-50 border-slate-100'}`}>
                          {row.caducidad ? row.caducidad.split('-').reverse().join('/') : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add row button mobile */}
          {canEditPlantilla && (modoTemplate || editMode) && newRowTarget === tabla && (
            <div className="px-4 py-3 bg-blue-50/30">
              <div className="flex items-center gap-2">
                <input autoFocus value={newRowName} onChange={(e) => setNewRowName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddRow(tabla); if (e.key === 'Escape') { setNewRowTarget(null); setNewRowName(''); } }}
                  placeholder="Nombre del artículo..."
                  className="flex-1 px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-blue-100" />
                <button onClick={() => handleAddRow(tabla)} className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all"><Check size={15} /></button>
                <button onClick={() => { setNewRowTarget(null); setNewRowName(''); }} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"><X size={15} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER PRINCIPAL
     ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      {toast.show && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <div className={rootLayoutClass}>
        {/* ── HEADER ── */}
        {embedded ? (
          <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/80 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-20">
            <div className="flex items-center gap-2 flex-wrap">
              {modoTemplate ? (
                <span className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-[12px] font-bold">
                  <Edit3 size={12} /> Plantilla Global
                </span>
              ) : (
                !sucursalProp && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowSucDropdown(!showSucDropdown)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-all ${
                        sucursalActiva
                          ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                          : 'bg-amber-50 border-2 border-amber-400 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <MapPin size={12} /> {sucursalActiva || 'Seleccionar'}
                      <ChevronDown size={13} className={`transition-transform ${showSucDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showSucDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-500/10 z-50 min-w-[200px] max-h-[280px] overflow-y-auto py-1">
                        {catalogoSucursales.map(s => (
                          <button key={s.id}
                            onClick={() => { setSucursalActiva(s.nombre || s.id); setShowSucDropdown(false); }}
                            className={`w-full text-left px-4 py-2.5 text-[12px] font-bold transition-all ${
                              (s.nombre || s.id) === sucursalActiva ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                            }`}>
                            {s.nombre || s.id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
              {canEditPlantilla && !modoTemplate && (
                <button onClick={() => setEditMode(!editMode)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                    editMode ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>
                  {editMode ? <Eye size={13}/> : <Edit3 size={13}/>}
                  {editMode ? 'Vista' : 'Editar'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0">
            <div className="px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
              {/* Left: back + title */}
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button onClick={() => navigate(esJefa ? '/enfermeria/jefatura' : '/enfermeria/dashboard')}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0">
                  <ArrowLeft size={18}/>
                </button>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                  modoTemplate ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/20' : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20'
                }`}>
                  {modoTemplate ? <Edit3 size={17} className="text-white"/> : <ShieldAlert size={17} className="text-white"/>}
                </div>
                <div className="min-w-0">
                  <h1 className="text-[14px] sm:text-[16px] font-black text-slate-800 truncate leading-tight">
                    {modoTemplate ? 'Plantilla Carro Rojo' : 'Bitácora Carro Rojo'}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <MapPin size={9}/> <span className="truncate">{sucursalActiva || (modoTemplate ? 'Plantilla Global' : 'Sin sucursal')}</span>
                    {esJefa && <span className="text-rose-400 shrink-0">· Jefatura</span>}
                  </div>
                </div>
              </div>

              {/* Right: sucursal selector + edit toggle */}
              <div className="flex items-center gap-2">
                {!modoTemplate && (
                  <div className="relative hidden sm:block" ref={dropdownRef}>
                    <button
                      onClick={() => setShowSucDropdown(!showSucDropdown)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all max-w-[160px] lg:max-w-[200px] ${
                        sucursalActiva
                          ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                          : 'bg-amber-50 border-2 border-amber-400 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <MapPin size={12}/> <span className="truncate">{sucursalActiva || 'Seleccionar'}</span>
                      <ChevronDown size={12} className={`shrink-0 transition-transform ${showSucDropdown ? 'rotate-180' : ''}`}/>
                    </button>
                    {showSucDropdown && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-500/10 z-50 min-w-[220px] max-h-[320px] overflow-y-auto py-1">
                        {catalogoSucursales.map(s => (
                          <button key={s.id}
                            onClick={() => { setSucursalActiva(s.nombre || s.id); setShowSucDropdown(false); }}
                            className={`w-full text-left px-4 py-2.5 text-[12px] font-bold transition-all ${
                              (s.nombre || s.id) === sucursalActiva
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}>
                            {s.nombre || s.id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {canEditPlantilla && !modoTemplate && (
                  <button onClick={() => setEditMode(!editMode)}
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                      editMode ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    {editMode ? <Eye size={13}/> : <Edit3 size={13}/>}
                  </button>
                )}
              </div>
            </div>

            {/* Mobile row 2: sucursal + edit */}
            <div className="sm:hidden px-3 pb-2.5 flex items-center gap-2">
              {modoTemplate ? (
                <span className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-[11px] font-bold">
                  <Edit3 size={11}/> Plantilla Global
                </span>
              ) : (
                <div className="relative flex-1" ref={dropdownMobileRef}>
                  <button
                    onClick={() => setShowSucDropdown(!showSucDropdown)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                      sucursalActiva
                        ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                        : 'bg-amber-50 border-2 border-amber-400 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate"><MapPin size={11}/> {sucursalActiva || 'Seleccionar'}</span>
                    <ChevronDown size={12} className={`shrink-0 transition-transform ${showSucDropdown ? 'rotate-180' : ''}`}/>
                  </button>
                  {showSucDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-[280px] overflow-y-auto py-1">
                      {catalogoSucursales.map(s => (
                        <button key={s.id}
                          onClick={() => { setSucursalActiva(s.nombre || s.id); setShowSucDropdown(false); }}
                          className={`w-full text-left px-4 py-2.5 text-[12px] font-bold transition-all ${
                            (s.nombre || s.id) === sucursalActiva ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                          }`}>
                          {s.nombre || s.id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {canEditPlantilla && !modoTemplate && (
                <button onClick={() => setEditMode(!editMode)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all shrink-0 ${
                    editMode ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                  {editMode ? <Eye size={13}/> : <Edit3 size={13}/>}
                  {editMode ? 'Vista' : 'Editar'}
                </button>
              )}
            </div>
          </header>
        )}

        {/* ── CONTENIDO ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20 animate-pulse">
                <ShieldAlert size={20} className="text-white"/>
              </div>
              <Loader2 size={18} className="text-slate-300 animate-spin"/>
              <p className="text-[13px] text-slate-400 font-medium">Cargando bitácora...</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
              {/* ── Stats inline ── */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <TrendingUp size={12}/> {stats.pct}% completado
                </span>
                <span className="text-slate-200">|</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <CheckCircle2 size={12} className="text-emerald-500"/> {stats.filled}/{stats.total}
                </span>
                {stats.warnings > 0 && <>
                  <span className="text-slate-200">|</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
                    <AlertTriangle size={11}/> {stats.warnings} alertas
                  </span>
                </>}
                {stats.expired > 0 && <>
                  <span className="text-slate-200">|</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
                    <AlertCircle size={11}/> {stats.expired} vencidos
                  </span>
                </>}
              </div>

              {/* ── Tables ── */}
              {renderTable('Material de Curación', Package, materialRows, 'material', 'rose')}
              {renderTable('Medicamentos', Pill, medicamentoRows, 'medicamento', 'blue')}
            </div>
          )}
        </div>

        {/* ── FOOTER SAVE BAR (sticky bottom) ── */}
        {!loading && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-3 sm:px-6 py-1.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 sticky bottom-0 z-20">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 min-w-0">
              <span className="truncate">{modoTemplate ? 'Plantilla Global' : sucursalActiva}</span>
              {!modoTemplate && <><span className="text-slate-200">·</span><span className="tabular-nums">{stats.filled}/{stats.total}</span></>}
              {modoTemplate && <span className="tabular-nums text-violet-400">{plantillaMaterial.length + plantillaMedicamento.length} items</span>}
              {bloqueado && (
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  {mesActual}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {sucursalActiva && (
                <button onClick={handlePrint}
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg border border-slate-200 text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  <Printer size={14} className="sm:hidden"/>
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
              )}
              {(canEditSucursal || modoTemplate) && (
                <button onClick={handleGuardar} disabled={saving || (bloqueado && !modoTemplate)}
                  className={`px-4 sm:px-7 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm disabled:opacity-50 transition-all active:scale-[0.97] ${
                    modoTemplate ? 'bg-violet-600 hover:bg-violet-700 text-white' : bloqueado ? 'bg-emerald-600 text-white' : 'bg-slate-900 hover:bg-black text-white'
                  }`}>
                  {bloqueado && !modoTemplate ? <CheckCircle2 size={14} /> : saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  {bloqueado && !modoTemplate ? `Completado (${mesActual})` : saving ? 'Guardando...' : (modoTemplate ? 'Guardar Plantilla' : `Guardar (${stats.filled}/${stats.total})`)}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BitacoraCarroRojo;
