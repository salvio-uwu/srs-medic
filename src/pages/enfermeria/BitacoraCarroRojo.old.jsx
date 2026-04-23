import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Printer, Plus, Trash2, Edit3, Eye, Check, X,
  MapPin, ShieldAlert, Package, Pill, AlertCircle, CheckCircle2
} from 'lucide-react';
import { db } from '../../config/firebase';
import {
  collection, doc, setDoc, onSnapshot, serverTimestamp, addDoc
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

/* ═══════════════════════════════════════════════════════════════
   DATOS INICIALES (semilla para la plantilla global)
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

const buildDefaultPlantilla = (items) =>
  items.map((nombre, i) => ({ id: `item_${i + 1}`, articulo: nombre, cantidadExistir: '' }));

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const normSucursal = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const isJefatura = (rol) => {
  const r = (rol || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['jefa_enfermeria', 'jefa', 'admin', 'admin_maestro', 'administrador'].includes(r);
};

const getCaducidadColor = (caducidad) => {
  if (!caducidad) return '';
  const dias = Math.ceil((new Date(caducidad) - new Date()) / 86400000);
  if (dias <= 0)  return 'bg-red-100 text-red-800 border-red-300';
  if (dias <= 30) return 'bg-red-50 text-red-700 border-red-200';
  if (dias <= 90) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const getCaducidadLabel = (caducidad) => {
  if (!caducidad) return '';
  const dias = Math.ceil((new Date(caducidad) - new Date()) / 86400000);
  if (dias <= 0)  return 'VENCIDO';
  if (dias <= 30) return 'Próximo a vencer';
  if (dias <= 90) return 'Precaución';
  return 'Vigente';
};

const getStockColor = (existir, existente) => {
  const a = parseFloat(existir), b = parseFloat(existente);
  if (isNaN(a) || isNaN(b) || a === 0) return '';
  const pct = b / a;
  if (pct <= 0)   return 'bg-red-100 text-red-800';
  if (pct < 0.5)  return 'bg-amber-50 text-amber-700';
  if (pct >= 1)   return 'bg-emerald-50 text-emerald-700';
  return 'bg-blue-50 text-blue-700';
};

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-lg border text-sm font-semibold animate-in slide-in-from-top-4 max-w-[90vw] ${
    type === 'error'   ? 'bg-red-50/90 border-red-200 text-red-700' :
    type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-700' :
                         'bg-emerald-50/90 border-emerald-200 text-emerald-700'
  }`}>
    {type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
    <span className="font-bold text-xs sm:text-sm">{msg}</span>
    <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 p-1 bg-black/5 rounded-full flex-shrink-0"><X size={14}/></button>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   GENERADOR DE FORMATO DE IMPRESIÓN — DOCUMENTO CLÍNICO FORMAL
   Todo en UNA sola hoja tamaño carta
   ═══════════════════════════════════════════════════════════════ */
const generarFormatoImpresion = ({ sucursal, materialRows, medicamentoRows, usuario }) => {
  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const mesActual = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
  const horaGen = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const buildSectionRows = (sectionTitle, rows) => {
    let html = `<tr><td class="sep" colspan="4"></td></tr>`;
    html += `<tr><td class="st" colspan="4"><b>${sectionTitle}</b></td></tr>`;
    html += `<tr><td class="h">No.</td><td class="h" style="text-align:left">Artículo</td><td class="h">Cantidad</td><td class="h">Caducidad</td></tr>`;
    rows.forEach((row, i) => {
      const cad = row.caducidad ? row.caducidad.split('-').reverse().join('/') : '';
      html += `<tr><td class="c n">${i + 1}</td><td class="c a">${row.articulo}</td><td class="c v">${row.cantidadExistir || ''}</td><td class="c v">${cad}</td></tr>`;
    });
    return html;
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Botiquín de Urgencias — ${sucursal}</title>
<style>
@page{size:letter;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',Times,serif;color:#000;font-size:7.5pt;line-height:1.15;padding:10mm 14mm 8mm 14mm}

h1{font-size:10pt;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:3pt}
.mes{text-align:center;font-size:8.5pt;font-weight:bold;margin-bottom:6pt}
.mes u{text-decoration:underline}

.info{font-size:7.5pt;margin-bottom:5pt;display:flex;justify-content:space-between}
.info b{margin-right:2pt}

table.m{width:100%;border-collapse:collapse;font-size:7.5pt}
table.m .sep{height:5pt;border:none}
table.m .st{text-align:center;font-size:8pt;padding:2pt 0;border:0.5pt solid #000}
table.m .h{border:0.5pt solid #000;padding:1.5pt 3pt;font-weight:bold;text-align:center;font-size:7pt}
table.m .c{border:0.5pt solid #000;padding:1.2pt 3pt}
table.m .c.n{text-align:center;width:20pt}
table.m .c.a{text-align:left}
table.m .c.v{text-align:center;width:52pt}

.firmas{margin-top:18pt;display:flex;justify-content:space-between;padding:0 6pt}
.fb{text-align:center;width:30%}
.fb .fl{border-top:0.5pt solid #000;margin-top:28pt;padding-top:2pt;font-size:7pt;font-weight:bold}
.fb .fr{font-size:6pt;font-style:italic}

.foot{text-align:center;margin-top:6pt;font-size:5.5pt;color:#666;border-top:0.3pt solid #bbb;padding-top:2pt}

.pa{position:fixed;bottom:16px;right:16px;z-index:100}
.pa button{padding:10px 22px;border:none;border-radius:4px;font:bold 12px system-ui,sans-serif;cursor:pointer;background:#000;color:#fff}
.pa button:hover{background:#333}
@media print{.pa{display:none!important}}
</style>
</head>
<body>

<h1>Material de Curación y Medicamentos para el Botiquín de Urgencias</h1>
<div class="mes">MES: <u>${mesActual}</u></div>

<div class="info">
<span><b>Sucursal:</b> ${sucursal || ''}</span>
<span><b>Fecha:</b> ${fechaHoy}</span>
<span><b>Responsable:</b> ${usuario || ''}</span>
</div>

<table class="m">
${buildSectionRows('Material de curación', materialRows)}
${buildSectionRows('Medicamentos', medicamentoRows)}
</table>

<div class="firmas">
<div class="fb"><div class="fl">Responsable de Carro Rojo</div><div class="fr">Enfermería</div></div>
<div class="fb"><div class="fl">Jefa de Enfermería</div><div class="fr">Supervisión y Validación</div></div>
<div class="fb"><div class="fl">Dirección Médica</div><div class="fr">Vo. Bo.</div></div>
</div>

<div class="foot">Generado el ${fechaHoy} a las ${horaGen} — ${sucursal || ''} — Uso interno</div>

<div class="pa"><button onclick="window.print()">Imprimir</button></div>

</body>
</html>`;
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
const BitacoraCarroRojo = ({ embedded = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esJefa = isJefatura(user?.rol);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [sucursalActiva, setSucursalActiva] = useState(searchParams.get('sucursal') || user?.sucursal || '');

  const [plantillaMaterial, setPlantillaMaterial] = useState([]);
  const [plantillaMedicamento, setPlantillaMedicamento] = useState([]);

  const [sucursalMaterialData, setSucursalMaterialData] = useState({});
  const [sucursalMedicamentoData, setSucursalMedicamentoData] = useState({});

  const [editMode, setEditMode] = useState(false);
  const [newRowTarget, setNewRowTarget] = useState(null);
  const [newRowName, setNewRowName] = useState('');

  const toastTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ show: true, msg, type });
    toastTimer.current = setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 4000);
  };

  // ─── Carga sucursales ───
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'catalogo_sucursales'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.activo !== false);
      setCatalogoSucursales(items);
      if (!sucursalActiva && items.length > 0) setSucursalActiva(items[0].nombre || items[0].id);
    });
    return () => unsub();
  }, []);

  // ─── Carga plantilla global (realtime) ───
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

  // ─── Carga datos de la sucursal activa (realtime) ───
  useEffect(() => {
    if (!sucursalActiva) { setLoading(false); return; }
    setLoading(true);

    const unsub = onSnapshot(doc(db, 'bitacora_carro_rojo', sucursalActiva), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setSucursalMaterialData(d.materialData || {});
        setSucursalMedicamentoData(d.medicamentoData || {});
      } else {
        setSucursalMaterialData({});
        setSucursalMedicamentoData({});
      }
      setLoading(false);
    }, () => { showToast('Error al cargar datos de sucursal', 'error'); setLoading(false); });

    return () => unsub();
  }, [sucursalActiva]);

  // ─── Combinar plantilla + datos sucursal ───
  const mergeRows = (plantilla, sucData) =>
    plantilla.map(item => ({
      ...item,
      cantidadExistente: sucData[item.id]?.cantidadExistente || '',
      caducidad: sucData[item.id]?.caducidad || '',
    }));

  const materialRows = mergeRows(plantillaMaterial, sucursalMaterialData);
  const medicamentoRows = mergeRows(plantillaMedicamento, sucursalMedicamentoData);

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
    setter(prev => [...prev, {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      articulo: newRowName.trim(),
      cantidadExistir: '',
    }]);
    setNewRowName('');
    setNewRowTarget(null);
  };

  const handleDeleteRow = (tabla, id) => {
    const setter = tabla === 'material' ? setPlantillaMaterial : setPlantillaMedicamento;
    setter(prev => prev.filter(row => row.id !== id));
  };

  const handleGuardar = async () => {
    setSaving(true);
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
            materialData: sucursalMaterialData,
            medicamentoData: sucursalMedicamentoData,
            ultimaActualizacion: serverTimestamp(),
            actualizadoPor: user?.nombre || 'Desconocido',
            actualizadoPorRol: user?.rol || '',
          }, { merge: true })
        );
        // Registro histórico para auditoría de jefatura
        promises.push(
          addDoc(collection(db, 'bitacora_carro_rojo', sucursalActiva, 'historial'), {
            materialData: sucursalMaterialData,
            medicamentoData: sucursalMedicamentoData,
            fecha: serverTimestamp(),
            actualizadoPor: user?.nombre || 'Desconocido',
            actualizadoPorRol: user?.rol || '',
          })
        );
      }
      await Promise.all(promises);
      showToast('Bitácora guardada exitosamente');
      setEditMode(false);
    } catch {
      showToast('Error al guardar', 'error');
    }
    setSaving(false);
  };

  // ─── Impresión profesional en ventana nueva (Blob URL elimina "about:blank") ───
  const handlePrint = () => {
    const html = generarFormatoImpresion({
      sucursal: sucursalActiva,
      materialRows,
      medicamentoRows,
      usuario: user?.nombre || 'Desconocido',
    });
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) { showToast('No se pudo abrir la ventana de impresión. Verifica que no esté bloqueada por el navegador.', 'warning'); URL.revokeObjectURL(url); return; }
    win.addEventListener('afterprint', () => URL.revokeObjectURL(url));
    win.addEventListener('unload', () => URL.revokeObjectURL(url));
  };

  // ─── Permisos ───
  const isMySucursal = normSucursal(sucursalActiva) === normSucursal(user?.sucursal);
  const canEditSucursal = esJefa || isMySucursal;
  const canEditPlantilla = esJefa;

  const inputBase = "w-full px-2 py-1.5 bg-white border rounded-lg text-[13px] font-medium text-slate-800 outline-none focus:ring-2 transition-all text-center";

  /* ═══════════════════════════════════════════════════════════════
     RENDER DE TABLA — responsive: cards en móvil, tabla en md+
     ═══════════════════════════════════════════════════════════════ */
  const renderTable = (title, icon, rows, tabla, colorAccent) => {
    const IconComp = icon;
    const accentHeader = colorAccent === 'rose' ? 'from-rose-500 to-pink-600' : 'from-blue-500 to-indigo-600';

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${accentHeader} px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <IconComp size={16} className="text-white sm:w-[18px] sm:h-[18px]"/>
            </div>
            <h3 className="text-white font-bold text-[13px] sm:text-[15px] tracking-wide uppercase">
              {title}
            </h3>
          </div>
          <span className="text-white/80 text-[10px] sm:text-[11px] font-bold">
            {rows.length} artículos
          </span>
        </div>

        {/* ── Vista TABLA: md+ ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-[40%]">
                  Artículo
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-[15%]">
                  <span>Cant. a Existir</span>
                  {canEditPlantilla && <span className="block text-[8px] text-indigo-400 font-bold mt-0.5">GLOBAL</span>}
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-[15%]">
                  <span>Cant. Existente</span>
                  <span className="block text-[8px] text-blue-400 font-bold mt-0.5">{sucursalActiva || 'SUCURSAL'}</span>
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-[20%]">
                  <span>Caducidad</span>
                  <span className="block text-[8px] text-blue-400 font-bold mt-0.5">{sucursalActiva || 'SUCURSAL'}</span>
                </th>
                {canEditPlantilla && editMode && (
                  <th className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 w-[10%]">
                    Acción
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const stockColor = getStockColor(row.cantidadExistir, row.cantidadExistente);
                const cadColor = getCaducidadColor(row.caducidad);
                return (
                  <tr key={row.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-2.5">
                      {canEditPlantilla && editMode ? (
                        <input value={row.articulo} onChange={(e) => updatePlantillaRow(tabla, row.id, 'articulo', e.target.value)}
                          className={`${inputBase} text-left border-slate-200 focus:border-blue-400 focus:ring-blue-50`}/>
                      ) : (
                        <span className="text-[13px] font-semibold text-slate-800">{row.articulo}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEditPlantilla ? (
                        <input type="text" inputMode="decimal" value={row.cantidadExistir}
                          onChange={(e) => updatePlantillaRow(tabla, row.id, 'cantidadExistir', e.target.value.replace(/[^0-9.,]/g, ''))}
                          className={`${inputBase} border-indigo-200 bg-indigo-50/30 focus:border-indigo-400 focus:ring-indigo-50`}
                          placeholder="—"/>
                      ) : (
                        <span className="block text-center font-bold text-slate-700">{row.cantidadExistir || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEditSucursal ? (
                        <input type="text" inputMode="decimal" value={row.cantidadExistente}
                          onChange={(e) => updateSucursalData(tabla, row.id, 'cantidadExistente', e.target.value.replace(/[^0-9.,]/g, ''))}
                          className={`${inputBase} ${stockColor ? stockColor + ' border-transparent' : 'border-slate-200'} focus:border-indigo-400 focus:ring-indigo-50`}
                          placeholder="—"/>
                      ) : (
                        <span className={`block text-center font-bold rounded-lg py-1 ${stockColor || 'text-slate-700'}`}>
                          {row.cantidadExistente || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEditSucursal ? (
                        <input type="date" value={row.caducidad}
                          onChange={(e) => updateSucursalData(tabla, row.id, 'caducidad', e.target.value)}
                          className={`${inputBase} ${cadColor ? cadColor + ' border' : 'border-slate-200'} focus:border-indigo-400 focus:ring-indigo-50`}/>
                      ) : (
                        <span className={`block text-center font-bold rounded-lg py-1 px-2 ${cadColor || 'text-slate-700'} ${cadColor ? 'border' : ''}`}>
                          {row.caducidad ? row.caducidad.split('-').reverse().join('/') : '—'}
                        </span>
                      )}
                    </td>
                    {canEditPlantilla && editMode && (
                      <td className="px-2 py-2.5 text-center">
                        <button onClick={() => handleDeleteRow(tabla, row.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar fila">
                          <Trash2 size={14}/>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {canEditPlantilla && editMode && newRowTarget === tabla && (
                <tr className="bg-blue-50/50 border-b border-blue-100">
                  <td className="px-4 py-2.5" colSpan={5}>
                    <div className="flex items-center gap-2">
                      <input autoFocus value={newRowName} onChange={(e) => setNewRowName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddRow(tabla); if (e.key === 'Escape') { setNewRowTarget(null); setNewRowName(''); } }}
                        placeholder="Nombre del artículo..."
                        className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100"/>
                      <button onClick={() => handleAddRow(tabla)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"><Check size={14}/></button>
                      <button onClick={() => { setNewRowTarget(null); setNewRowName(''); }} className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X size={14}/></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Vista CARDS: móvil y tablet (< md) ── */}
        <div className="md:hidden divide-y divide-slate-100">
          {rows.map((row, idx) => {
            const stockColor = getStockColor(row.cantidadExistir, row.cantidadExistente);
            const cadColor = getCaducidadColor(row.caducidad);
            const cadLabel = getCaducidadLabel(row.caducidad);
            return (
              <div key={row.id} className={`px-4 py-3 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                {/* Nombre del artículo */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  {canEditPlantilla && editMode ? (
                    <input value={row.articulo} onChange={(e) => updatePlantillaRow(tabla, row.id, 'articulo', e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"/>
                  ) : (
                    <p className="text-[13px] font-bold text-slate-800 leading-snug flex-1">{row.articulo}</p>
                  )}
                  {canEditPlantilla && editMode && (
                    <button onClick={() => handleDeleteRow(tabla, row.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 mt-0.5">
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>

                {/* Grid 3 columnas */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Cant. a Existir */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">A Existir</span>
                    {canEditPlantilla ? (
                      <input type="text" inputMode="decimal" value={row.cantidadExistir}
                        onChange={(e) => updatePlantillaRow(tabla, row.id, 'cantidadExistir', e.target.value.replace(/[^0-9.,]/g, ''))}
                        className="w-full px-2 py-1.5 bg-indigo-50/30 border border-indigo-200 rounded-lg text-[12px] font-bold text-slate-800 text-center outline-none focus:ring-2 focus:ring-indigo-100"
                        placeholder="—"/>
                    ) : (
                      <span className="block text-center font-bold text-[12px] text-slate-700 bg-slate-50 rounded-lg py-1.5">{row.cantidadExistir || '—'}</span>
                    )}
                  </div>

                  {/* Cant. Existente */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Existente</span>
                    {canEditSucursal ? (
                      <input type="text" inputMode="decimal" value={row.cantidadExistente}
                        onChange={(e) => updateSucursalData(tabla, row.id, 'cantidadExistente', e.target.value.replace(/[^0-9.,]/g, ''))}
                        className={`w-full px-2 py-1.5 border rounded-lg text-[12px] font-bold text-center outline-none focus:ring-2 focus:ring-indigo-100 ${stockColor ? stockColor + ' border-transparent' : 'bg-white border-slate-200 text-slate-800'}`}
                        placeholder="—"/>
                    ) : (
                      <span className={`block text-center font-bold text-[12px] rounded-lg py-1.5 ${stockColor || 'text-slate-700 bg-slate-50'}`}>
                        {row.cantidadExistente || '—'}
                      </span>
                    )}
                  </div>

                  {/* Caducidad */}
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Caducidad</span>
                    {canEditSucursal ? (
                      <input type="date" value={row.caducidad}
                        onChange={(e) => updateSucursalData(tabla, row.id, 'caducidad', e.target.value)}
                        className={`w-full px-1 py-1.5 border rounded-lg text-[11px] font-bold text-center outline-none focus:ring-2 focus:ring-indigo-100 ${cadColor ? cadColor + ' border' : 'bg-white border-slate-200 text-slate-800'}`}/>
                    ) : (
                      <div className="text-center">
                        <span className={`block font-bold text-[11px] rounded-lg py-1.5 px-1 ${cadColor || 'text-slate-700 bg-slate-50'} ${cadColor ? 'border' : ''}`}>
                          {row.caducidad ? row.caducidad.split('-').reverse().join('/') : '—'}
                        </span>
                        {cadLabel && <span className="text-[8px] font-bold text-slate-400 mt-0.5 block">{cadLabel}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Fila agregar en móvil */}
          {canEditPlantilla && editMode && newRowTarget === tabla && (
            <div className="px-4 py-3 bg-blue-50/50">
              <div className="flex items-center gap-2">
                <input autoFocus value={newRowName} onChange={(e) => setNewRowName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddRow(tabla); if (e.key === 'Escape') { setNewRowTarget(null); setNewRowName(''); } }}
                  placeholder="Nombre del artículo..."
                  className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100"/>
                <button onClick={() => handleAddRow(tabla)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"><Check size={14}/></button>
                <button onClick={() => { setNewRowTarget(null); setNewRowName(''); }} className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"><X size={14}/></button>
              </div>
            </div>
          )}
        </div>

        {/* Botón agregar fila */}
        {canEditPlantilla && editMode && newRowTarget !== tabla && (
          <button onClick={() => { setNewRowTarget(tabla); setNewRowName(''); }}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-t border-slate-100 transition-colors">
            <Plus size={16}/> Agregar artículo
          </button>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER PRINCIPAL
     ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {toast.show && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}

      <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
        {/* ── HEADER ── */}
        {embedded ? (
          /* ── Toolbar compacto para modo embebido (dentro del dashboard) ── */
          <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {esJefa && (
                <select value={sucursalActiva} onChange={(e) => setSucursalActiva(e.target.value)}
                  className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] sm:text-[12px] font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all max-w-[180px]">
                  {catalogoSucursales.length === 0 && <option value={sucursalActiva}>{sucursalActiva || 'Sin sucursal'}</option>}
                  {catalogoSucursales.map(s => <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>)}
                </select>
              )}
              {canEditPlantilla && (
                <button onClick={() => setEditMode(!editMode)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold border transition-all ${
                    editMode ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {editMode ? <Eye size={14}/> : <Edit3 size={14}/>}
                  {editMode ? 'Ver' : 'Editar'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-all">
                <Printer size={14}/><span className="hidden sm:inline">Imprimir</span>
              </button>
              {canEditSucursal && (
                <button onClick={handleGuardar} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-bold hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95">
                  {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  <span className="hidden sm:inline">Guardar</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Header completo para modo standalone (ruta directa) ── */
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          {/* Fila superior: título + acciones principales */}
          <div className="px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={() => navigate(esJefa ? '/enfermeria/jefatura' : '/enfermeria/dashboard')}
                className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0">
                <ArrowLeft size={18} className="sm:w-5 sm:h-5"/>
              </button>
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-sm shadow-red-500/25 flex-shrink-0">
                <ShieldAlert size={16} className="text-white sm:w-[18px] sm:h-[18px]"/>
              </div>
              <div className="min-w-0">
                <h1 className="text-[14px] sm:text-[15px] lg:text-lg font-black text-slate-800 leading-tight truncate" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                  Bitácora de Carro Rojo
                </h1>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5 truncate">
                  <MapPin size={9} className="flex-shrink-0"/> <span className="truncate">{sucursalActiva || 'Sin sucursal'}</span>
                  {esJefa && <span className="ml-1.5 text-rose-500 flex-shrink-0">• Jefatura</span>}
                </p>
              </div>
            </div>

            {/* Acciones desktop */}
            <div className="hidden sm:flex items-center gap-2">
              {esJefa && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-blue-500 hidden lg:block"/>
                  <select value={sucursalActiva} onChange={(e) => setSucursalActiva(e.target.value)}
                    className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] sm:text-[12px] font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all max-w-[140px] lg:max-w-[200px]">
                    {catalogoSucursales.length === 0 && <option value={sucursalActiva}>{sucursalActiva || 'Sin sucursal'}</option>}
                    {catalogoSucursales.map(s => <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>)}
                  </select>
                </div>
              )}
              {canEditPlantilla && (
                <button onClick={() => setEditMode(!editMode)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold border transition-all ${
                    editMode ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {editMode ? <Eye size={14}/> : <Edit3 size={14}/>}
                  <span className="hidden lg:inline">{editMode ? 'Ver' : 'Editar'}</span>
                </button>
              )}
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[12px] font-bold hover:bg-slate-50 transition-all">
                <Printer size={14}/><span className="hidden lg:inline">Imprimir</span>
              </button>
              {canEditSucursal && (
                <button onClick={handleGuardar} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-[12px] font-bold hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95">
                  {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  <span className="hidden lg:inline">Guardar</span>
                </button>
              )}
            </div>

            {/* Botones móvil (compact) */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button onClick={handlePrint}
                className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all">
                <Printer size={16}/>
              </button>
              {canEditSucursal && (
                <button onClick={handleGuardar} disabled={saving}
                  className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95">
                  {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                </button>
              )}
            </div>
          </div>

          {/* Fila inferior móvil: selector sucursal + editar */}
          <div className="sm:hidden px-3 pb-2.5 flex items-center gap-2">
            {esJefa && (
              <select value={sucursalActiva} onChange={(e) => setSucursalActiva(e.target.value)}
                className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all truncate">
                {catalogoSucursales.length === 0 && <option value={sucursalActiva}>{sucursalActiva || 'Sin sucursal'}</option>}
                {catalogoSucursales.map(s => <option key={s.id} value={s.nombre || s.id}>{s.nombre || s.id}</option>)}
              </select>
            )}
            {canEditPlantilla && (
              <button onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border transition-all flex-shrink-0 ${
                  editMode ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'
                }`}>
                {editMode ? <Eye size={14}/> : <Edit3 size={14}/>}
                {editMode ? 'Ver' : 'Editar'}
              </button>
            )}
          </div>
        </header>
        )}

        {/* ── CONTENIDO ── */}
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 size={40} className="text-slate-300 animate-spin"/>
              <p className="text-sm text-slate-400 mt-3 font-medium">Cargando bitácora...</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 lg:space-y-8">
              {/* Leyenda */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-400">Colores:</span>
                <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">Stock OK / Vigente</span>
                <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">Parcial</span>
                <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">Bajo / Próx. vencer</span>
                <span className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200">Crítico / Vencido</span>
                {esJefa && <>
                  <span className="hidden sm:inline ml-2 text-slate-300">|</span>
                  <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200">Global</span>
                  <span className="px-2 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200">Sucursal</span>
                </>}
              </div>

              {renderTable('Material de Curación', Package, materialRows, 'material', 'rose')}
              {renderTable('Medicamentos', Pill, medicamentoRows, 'medicamento', 'blue')}

              <div className="text-center text-[10px] sm:text-[11px] text-slate-400 font-medium py-3 sm:py-4">
                Bitácora de Carro Rojo — {sucursalActiva} — {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BitacoraCarroRojo;
