import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Save, Loader2, Printer, ShieldAlert, Package, Pill,
  AlertCircle, CheckCircle2, MapPin
} from 'lucide-react';
import { db } from '../../config/firebase';
import {
  collection, doc, setDoc, onSnapshot, serverTimestamp, addDoc
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useSessionLocation } from '../../context/SessionLocationContext';

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

const getCadStatus = (caducidad) => {
  if (!caducidad) return { color: '', label: '', level: 0 };
  const dias = Math.ceil((new Date(caducidad) - new Date()) / 86400000);
  if (dias <= 0)  return { color: 'bg-red-100 text-red-700 border-red-200', label: 'VENCIDO', level: 3 };
  if (dias <= 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: `${dias}d`, level: 2 };
  if (dias <= 90) return { color: 'bg-amber-50 text-amber-600 border-amber-200', label: `${dias}d`, level: 1 };
  return { color: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'OK', level: 0 };
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

/** Datos del doc pertenecen al mes en curso (incluye progreso parcial). */
const esPeriodoActualDoc = (d, mesActual) => {
  if (!d) return false;
  if (d.mesActivo === mesActual || d.mesBloqueado === mesActual) return true;
  // Legacy: guardados parciales sin mesActivo (mesBloqueado vacío) → vigentes
  const tieneDatos = !!(d.materialData && Object.keys(d.materialData).length)
    || !!(d.medicamentoData && Object.keys(d.medicamentoData).length);
  return !d.mesActivo && !d.mesBloqueado && tieneDatos;
};

const estaCompletoYBloqueado = (d, mesActual, pMat, pMed) => {
  if (!d || d.mesBloqueado !== mesActual) return false;
  // Evitar falso bloqueo mientras la plantilla aún no carga ([].every === true)
  if (!pMat.length && !pMed.length) return false;
  return pMat.every(item => d.materialData?.[item.id]?.cantidadExistente)
    && pMed.every(item => d.medicamentoData?.[item.id]?.cantidadExistente);
};

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-sm text-sm font-bold max-w-[92vw] ${
    type === 'error'   ? 'bg-red-50/95 border-red-200 text-red-700 shadow-red-500/10' :
    type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-700 shadow-amber-500/10' :
                         'bg-emerald-50/95 border-emerald-200 text-emerald-700 shadow-emerald-500/10'
  }`}>
    {type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
    <span className="text-[13px]">{msg}</span>
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
    let html = `<tr><td class="sep" colspan="5"></td></tr><tr><td class="st" colspan="5"><b>${sectionTitle}</b></td></tr><tr><td class="h">No.</td><td class="h" style="text-align:left">Artículo</td><td class="h">A existir</td><td class="h">Existente</td><td class="h">Caducidad</td></tr>`;
    rows.forEach((row, i) => {
      const cad = row.caducidad ? row.caducidad.split('-').reverse().join('/') : '';
      html += `<tr><td class="c n">${i + 1}</td><td class="c a">${row.articulo}</td><td class="c v">${row.cantidadExistir || ''}</td><td class="c v">${row.cantidadExistente || ''}</td><td class="c v">${cad}</td></tr>`;
    });
    return html;
  };
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Botiquín de Urgencias — ${sucursal}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',Times,serif;color:#000;font-size:7.5pt;line-height:1.15;padding:10mm 14mm 8mm 14mm}h1{font-size:10pt;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:3pt}.mes{text-align:center;font-size:8.5pt;font-weight:bold;margin-bottom:6pt}.mes u{text-decoration:underline}.info{font-size:7.5pt;margin-bottom:5pt;display:flex;justify-content:space-between}.info b{margin-right:2pt}table.m{width:100%;border-collapse:collapse;font-size:7.5pt}table.m .sep{height:5pt;border:none}table.m .st{text-align:center;font-size:8pt;padding:2pt 0;border:0.5pt solid #000}table.m .h{border:0.5pt solid #000;padding:1.5pt 3pt;font-weight:bold;text-align:center;font-size:7pt}table.m .c{border:0.5pt solid #000;padding:1.2pt 3pt}table.m .c.n{text-align:center;width:18pt}table.m .c.a{text-align:left}table.m .c.v{text-align:center;width:48pt}.firmas{margin-top:18pt;display:flex;justify-content:space-between;padding:0 6pt}.fb{text-align:center;width:30%}.fb .fl{border-top:0.5pt solid #000;margin-top:28pt;padding-top:2pt;font-size:7pt;font-weight:bold}.fb .fr{font-size:6pt;font-style:italic}.foot{text-align:center;margin-top:6pt;font-size:5.5pt;color:#666;border-top:0.3pt solid #bbb;padding-top:2pt}.pa{position:fixed;bottom:16px;right:16px;z-index:100}.pa button{padding:10px 22px;border:none;border-radius:4px;font:bold 12px system-ui,sans-serif;cursor:pointer;background:#000;color:#fff}.pa button:hover{background:#333}@media print{.pa{display:none!important}}</style></head><body><h1>Material de Curación y Medicamentos para el Botiquín de Urgencias</h1><div class="mes">MES: <u>${mesActual}</u></div><div class="info"><span><b>Sucursal:</b> ${sucursal || ''}</span><span><b>Fecha:</b> ${fechaHoy}</span><span><b>Responsable:</b> ${usuario || ''}</span></div><table class="m">${buildSectionRows('Material de curación', materialRows)}${buildSectionRows('Medicamentos', medicamentoRows)}</table><div class="firmas"><div class="fb"><div class="fl">Responsable de Carro Rojo</div><div class="fr">Enfermería</div></div><div class="fb"><div class="fl">Jefa de Enfermería</div><div class="fr">Supervisión y Validación</div></div><div class="fb"><div class="fl">Dirección Médica</div><div class="fr">Vo. Bo.</div></div></div><div class="foot">Generado el ${fechaHoy} a las ${horaGen} — ${sucursal || ''} — Uso interno</div><div class="pa"><button onclick="window.print()">Imprimir</button></div></body></html>`;
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE: VISTA SIMPLIFICADA SOLO PARA INGRESO DE DATOS
   - Enfermería solo ve su sucursal (auto-detectada)
   - Solo puede editar "Existente" y "Caducidad"
   - "A Existir" es solo lectura (viene de la plantilla de jefatura)
   - Sin gestión de artículos ni cambio de sucursal
   ═══════════════════════════════════════════════════════════════ */
const BitacoraCarroRojoEnfermeria = ({ embedded = false, sucursal: sucursalProp = '' }) => {
  const { user } = useAuth();
  const { sessionSucursal } = useSessionLocation();

  const mesActual = useMemo(() => new Date().toLocaleDateString('en-CA').slice(0, 7), []); // "2026-06"

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const [sucursalActiva, setSucursalActiva] = useState('');
  const [plantillaMaterial, setPlantillaMaterial] = useState([]);
  const [plantillaMedicamento, setPlantillaMedicamento] = useState([]);
  const [sucursalMaterialData, setSucursalMaterialData] = useState({});
  const [sucursalMedicamentoData, setSucursalMedicamentoData] = useState({});
  const [bloqueado, setBloqueado] = useState(false); // true = este mes ya fue enviado

  const toastTimer = useRef(null);
  const autoSelectDone = useRef(false);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ show: true, msg, type });
    toastTimer.current = setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // Auto-seleccionar sucursal: prop explícita tiene prioridad sobre sesión
  useEffect(() => {
    // Si viene una prop explícita (ej. desde el modal), usarla
    if (sucursalProp && sucursalProp.trim()) {
      setSucursalActiva(sucursalProp.trim());
      autoSelectDone.current = true;
      return;
    }
    // Si la sesión ya está confirmada, usarla (solo la primera vez)
    if (autoSelectDone.current) return;
    if (!sessionSucursal) return;
    setSucursalActiva(sessionSucursal.nombre || sessionSucursal.id || '');
    autoSelectDone.current = true;
  }, [sessionSucursal, sucursalProp]);

  // Cargar plantilla global (solo lectura para enfermería)
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

  // Cargar datos de la sucursal activa
  useEffect(() => {
    if (!sucursalActiva) { setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'bitacora_carro_rojo', sucursalActiva), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (esPeriodoActualDoc(d, mesActual)) {
          setSucursalMaterialData(d.materialData || {});
          setSucursalMedicamentoData(d.medicamentoData || {});
          setBloqueado(estaCompletoYBloqueado(d, mesActual, plantillaMaterial, plantillaMedicamento));
        } else {
          // Mes anterior (ya cerrado u obsoleto) → UI limpia para el mes nuevo; historial intacto
          setSucursalMaterialData({});
          setSucursalMedicamentoData({});
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

  // Merge: plantilla (solo lectura "A Existir") + datos de sucursal ("Existente", "Caducidad")
  const mergeRows = (plantilla, sucData) =>
    plantilla.map(item => ({
      ...item,
      cantidadExistente: sucData[item.id]?.cantidadExistente || '',
      caducidad: sucData[item.id]?.caducidad || ''
    }));

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

  // Solo actualizar datos de sucursal (Existente y Caducidad)
  const updateSucursalData = (tabla, id, field, value) => {
    const setter = tabla === 'material' ? setSucursalMaterialData : setSucursalMedicamentoData;
    setter(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleGuardar = async () => {
    if (!sucursalActiva) {
      showToast('No se detectó una sucursal asignada.', 'error');
      return;
    }
    if (bloqueado) {
      showToast(`La bitácora de ${mesActual} ya fue completada y bloqueada.`, 'warning');
      return;
    }
    setSaving(true);

    // Determinar si TODOS los campos están llenos
    const allMatFilled = plantillaMaterial.every(item => sucursalMaterialData[item.id]?.cantidadExistente);
    const allMedFilled = plantillaMedicamento.every(item => sucursalMedicamentoData[item.id]?.cantidadExistente);
    const todoCompleto = allMatFilled && allMedFilled;

    try {
      await Promise.all([
        setDoc(doc(db, 'bitacora_carro_rojo', sucursalActiva), {
          sucursal: sucursalActiva,
          materialData: sucursalMaterialData,
          medicamentoData: sucursalMedicamentoData,
          // Siempre anclar el periodo; mesBloqueado solo al completar (antes '' borraba la UI al recargar)
          mesActivo: mesActual,
          mesBloqueado: todoCompleto ? mesActual : '',
          ultimaActualizacion: serverTimestamp(),
          actualizadoPor: user?.nombre || 'Desconocido',
          actualizadoPorRol: user?.rol || '',
        }, { merge: true }),
        addDoc(collection(db, 'bitacora_carro_rojo', sucursalActiva, 'historial'), {
          plantillaMaterial: plantillaMaterial,
          plantillaMedicamento: plantillaMedicamento,
          materialData: sucursalMaterialData,
          medicamentoData: sucursalMedicamentoData,
          mes: mesActual,
          fecha: serverTimestamp(),
          actualizadoPor: user?.nombre || 'Desconocido',
          actualizadoPorRol: user?.rol || '',
          completo: todoCompleto,
        })
      ]);
      setBloqueado(todoCompleto);
      showToast(todoCompleto
        ? `Bitácora de ${mesActual} completada y bloqueada`
        : 'Progreso guardado. Puedes seguir llenando después.');
    } catch {
      showToast('Error al guardar', 'error');
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

  const rootLayoutClass = embedded
    ? 'flex flex-col flex-1 min-h-0 bg-[#f8f9fa] text-slate-700'
    : 'min-h-full bg-[#f8f9fa] text-slate-700 flex flex-col';

  /* ═══════════════════════════════════════════════════════════════
     RENDER TABLE (simplificada: sin edición de plantilla)
     ═══════════════════════════════════════════════════════════════ */
  const renderTable = (title, icon, rows, tabla) => {
    const IconComp = icon;

    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500">
            <IconComp size={15} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-bold text-slate-900 uppercase tracking-[0.06em] truncate">{title}</h3>
            <p className="text-[11px] text-slate-500">{rows.length} artículos</p>
          </div>
        </div>

        {/* ── Desktop table (md+) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 w-[5%]">#</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 w-[30%]">Artículo</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 w-[15%]">A existir</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 w-[15%]">
                  Existente
                  <span className="block text-[8px] text-slate-400 font-semibold mt-0.5 normal-case tracking-normal">{sucursalActiva || 'sucursal'}</span>
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 w-[20%]">Caducidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const stock = getStockStatus(row.cantidadExistir, row.cantidadExistente);
                const cad = getCadStatus(row.caducidad);
                return (
                  <tr key={row.id} className={`border-b border-slate-50 transition-colors ${
                    cad.level >= 3 ? 'bg-red-50/40' : cad.level >= 2 ? 'bg-amber-50/30' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  } hover:bg-slate-50`}>
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-300 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[13px] font-semibold text-slate-800">{row.articulo}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block text-center font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-md py-2 text-[13px] tabular-nums">
                        {row.cantidadExistir || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {bloqueado ? (
                        <span className={`block text-center font-bold rounded-md py-2 text-[13px] tabular-nums ${stock.color || 'text-slate-700'}`}>
                          {row.cantidadExistente || '—'}
                        </span>
                      ) : (
                        <input type="text" inputMode="decimal" value={row.cantidadExistente}
                          onChange={(e) => updateSucursalData(tabla, row.id, 'cantidadExistente', e.target.value.replace(/[^0-9.,]/g, ''))}
                          className={`w-full px-3 py-2 border rounded-md text-[13px] font-bold text-center outline-none focus:border-slate-400 transition-colors ${
                            stock.color ? stock.color + ' border-transparent' : 'bg-white border-slate-200'
                          }`}
                          placeholder="—" />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 justify-center">
                        {bloqueado ? (
                          <span className={`block text-center font-bold rounded-md py-2 px-3 text-[12px] border ${cad.color || 'text-slate-700 bg-slate-50 border-slate-200'}`}>
                            {row.caducidad ? row.caducidad.split('-').reverse().join('/') : '—'}
                          </span>
                        ) : (
                          <input type="date" value={row.caducidad}
                            onChange={(e) => updateSucursalData(tabla, row.id, 'caducidad', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md text-[12px] font-bold text-center outline-none focus:border-slate-400 transition-colors ${
                              cad.color ? cad.color : 'bg-white border-slate-200 text-slate-800'
                            }`} />
                        )}
                        {cad.label && <span className={`text-[9px] font-bold shrink-0 ${cad.level >= 3 ? 'text-rose-600' : cad.level >= 2 ? 'text-amber-600' : cad.level >= 1 ? 'text-amber-500' : 'text-emerald-600'}`}>{cad.label}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards (<md) ── */}
        <div className="md:hidden divide-y divide-slate-100">
          {rows.map((row, idx) => {
            const stock = getStockStatus(row.cantidadExistir, row.cantidadExistente);
            const cad = getCadStatus(row.caducidad);
            return (
              <div key={row.id} className={`px-4 py-3.5 ${cad.level >= 3 ? 'bg-red-50/40' : cad.level >= 2 ? 'bg-amber-50/30' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-slate-300 mt-1 shrink-0 tabular-nums w-5">{idx + 1}</span>
                    <p className="text-[13px] font-semibold text-slate-800 leading-snug flex-1">{row.articulo}</p>
                  </div>
                  {cad.label && cad.level >= 2 && (
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                      cad.level >= 3 ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>{cad.label}</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 ml-7">
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400 block mb-1">A existir</span>
                    <span className="block text-center font-bold text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md py-2 tabular-nums">
                      {row.cantidadExistir || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400 block mb-1">Existente</span>
                    {bloqueado ? (
                      <span className={`block text-center font-bold text-[12px] rounded-md py-2 tabular-nums ${stock.color || 'text-slate-600 bg-slate-50'}`}>
                        {row.cantidadExistente || '—'}
                      </span>
                    ) : (
                      <input type="text" inputMode="decimal" value={row.cantidadExistente}
                        onChange={(e) => updateSucursalData(tabla, row.id, 'cantidadExistente', e.target.value.replace(/[^0-9.,]/g, ''))}
                        className={`w-full px-2 py-2 border rounded-md text-[12px] font-bold text-center outline-none focus:border-slate-400 ${
                          stock.color ? stock.color + ' border-transparent' : 'bg-white border-slate-200 text-slate-800'
                        }`}
                        placeholder="—" />
                    )}
                  </div>
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400 block mb-1">Caducidad</span>
                    {bloqueado ? (
                      <span className={`block font-bold text-[11px] rounded-md py-2 text-center border ${cad.color || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                        {row.caducidad ? row.caducidad.split('-').reverse().join('/') : '—'}
                      </span>
                    ) : (
                      <input type="date" value={row.caducidad}
                        onChange={(e) => updateSucursalData(tabla, row.id, 'caducidad', e.target.value)}
                        className={`w-full px-1 py-2 border rounded-md text-[10px] font-bold text-center outline-none focus:border-slate-400 ${
                          cad.color ? cad.color : 'bg-white border-slate-200 text-slate-800'
                        }`} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
          <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 sticky top-0 z-20">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 min-w-0">
              <ShieldAlert size={15} className={bloqueado ? 'text-slate-300' : 'text-slate-700'} />
              <span className="truncate">{sucursalActiva || 'Cargando sucursal...'}</span>
            </div>
            {bloqueado && (
              <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                {mesActual} · Enviado
              </span>
            )}
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-lg px-3 sm:px-5 py-3">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">Enfermería</p>
                  <h1 className="text-[18px] sm:text-[22px] font-bold text-slate-900 leading-tight truncate" style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>
                    Bitácora carro rojo
                  </h1>
                  <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    {sucursalActiva || 'Sin sucursal asignada'}
                    {bloqueado && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-emerald-700 font-semibold">{mesActual} bloqueado</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </header>
          </div>
        )}

        {/* ── CONTENIDO ── */}
        <div className={`flex-1 overflow-y-auto ${embedded ? '' : 'px-3 sm:px-4 pb-4'}`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 size={18} className="text-slate-400 animate-spin"/>
              <p className="text-[13px] text-slate-500 font-medium">Cargando bitácora...</p>
            </div>
          ) : !sucursalActiva ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 px-4">
              <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                <ShieldAlert size={22} className="text-slate-300"/>
              </div>
              <p className="text-[14px] font-bold text-slate-700 text-center">No se detectó una sucursal asignada</p>
              <p className="text-[12px] text-slate-500 text-center max-w-sm">
                Contacta a tu jefa de enfermería para que te asigne una sucursal en el sistema.
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-4">
              {renderTable('Material de curación', Package, materialRows, 'material')}
              {renderTable('Medicamentos', Pill, medicamentoRows, 'medicamento')}
            </div>
          )}
        </div>

        {/* ── FOOTER SAVE BAR ── */}
        {!loading && sucursalActiva && (
          <div className="shrink-0 border-t border-slate-200 bg-white/90 backdrop-blur-md px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 sticky bottom-0 z-20">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 min-w-0">
              <span className="truncate">{sucursalActiva}</span>
              <span className="text-slate-300">·</span>
              <span className="tabular-nums">{stats.filled}/{stats.total}</span>
              {bloqueado && (
                <span className="ml-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                  {mesActual}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <Printer size={13} />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
              <button onClick={handleGuardar} disabled={saving || bloqueado}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md font-semibold text-[11px] sm:text-[12px] disabled:opacity-50 transition-colors ${
                  bloqueado ? 'bg-emerald-600 text-white cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}>
                {bloqueado ? <CheckCircle2 size={14} /> : saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                {bloqueado ? `Completado (${mesActual})` : saving ? 'Guardando...' : `Guardar (${stats.filled}/${stats.total})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BitacoraCarroRojoEnfermeria;
