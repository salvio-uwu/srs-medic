import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer, ChevronDown, Package, Pill,
  AlertCircle, CheckCircle2, Loader2, Edit3,
  AlertTriangle, Calendar, MapPin, Clock, History,
  TrendingDown, Activity, ShieldAlert, ArrowUpRight, User
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { alignSucursalData } from '../../utils/carroRojoData';

/* ── helpers ── */
const cadDias = (c, base = new Date()) => c ? Math.ceil((new Date(c) - base) / 86400000) : null;
const stockPct = (req, ext) => { const a = parseFloat(req), b = parseFloat(ext); return (isNaN(a)||isNaN(b)||a===0) ? null : b/a; };
const buildDef = (items) => items.map((n, i) => ({ id: `item_${i+1}`, articulo: n, cantidadExistir: '' }));
const fmtCad = (c) => c ? c.split('-').reverse().join('/') : '—';
const fmtTs = (ts) => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}); };
const fmtRelativo = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Justo ahora';
  if (diff < 60) return `hace ${diff}m`;
  if (diff < 1440) return `hace ${Math.floor(diff/60)}h`;
  return `hace ${Math.floor(diff/1440)}d`;
};

const snapshotMetrics = ({ pMat = [], pMed = [], materialData = {}, medicamentoData = {}, baseDate = new Date() }) => {
  const all = [
    ...pMat.map((p) => ({ ...p, ...(materialData?.[p.id] || {}) })),
    ...pMed.map((p) => ({ ...p, ...(medicamentoData?.[p.id] || {}) })),
  ];

  let ok = 0, bajo = 0, critico = 0, vencidos = 0;
  let capturados = 0;

  all.forEach((row) => {
    if (row?.cantidadExistente) capturados++;

    const dd = cadDias(row?.caducidad, baseDate);
    if (dd !== null && dd <= 0) vencidos++;

    const pct = stockPct(row?.cantidadExistir, row?.cantidadExistente);
    if (pct === null) return;
    if (pct >= 0.8) ok++;
    else if (pct >= 0.5) bajo++;
    else critico++;
  });

  return { ok, bajo, critico, vencidos, capturados, total: all.length };
};

const MAT = ['Apósitos','Algodón','Campos estériles','Gasas','Guantes quirúrgicos estériles','Jeringas desechables con aguja diversas medidas','Material de sutura','Soluciones antisépticas','Tela adhesiva','Tiras reactivas para la determinación de glucosa en sangre','Vendas elásticas diversas medidas','Vendas de yeso'];
const MED = ['Acido acetilsalicílico, tabletas 100 mg.','Acido acetilsalicílico, tabletas 500 mg.','Ketorolaco, solución inyectable 30 mg.','Metamizol, solución inyectable 500 mg.','Paracetamol, tabletas 500 mg.','Lidocaína simple, solución inyectable al 2%','Nifedipino, cápsulas 10 mg.','Trinitrato de glicerilo, cápsulas o tabletas masticables 6.8 mg.','Difenhidramina, solución oral','Epinefrina, solución inyectable 1 mg 1:1000/ml.','Acetato de metilprednisolona, solución inyectable 40 mg.','Bultilhioscina, solución inyectable 20 mg.','Furosemida, solución inyectable 20 mg.','Salbutamol, spray','Diazepan, solución inyectable 10 mg.','Difenidol, solución inyectable 40 mg.','Dimenhidrinato, solución inyectable 50 mg.','Agua bidestilada, solución inyectable 2 ml.','Cloruro de sodio, solución al 0.9%','Glucosa, solución al 5%','Glucosa, solución al 10%','Glucosa, solución al 50%','Solución de Hartmann'];

/* ── Impresión ── */
const printSuc = ({ sucursal, matRows, medRows, usuario, fecha }) => {
  const fechaDoc = fecha?.toDate ? fecha.toDate() : fecha ? new Date(fecha) : null;
  const base = fechaDoc || new Date();
  const now = new Date();
  const f = base.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const m = base.toLocaleDateString('es-MX',{month:'long',year:'numeric'}).toUpperCase();
  const h = now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  const sec = (t, rows) => { let s = `<tr><td class="sep" colspan="4"></td></tr><tr><td class="st" colspan="4"><b>${t}</b></td></tr><tr><td class="h">No.</td><td class="h" style="text-align:left">Artículo</td><td class="h">Cantidad</td><td class="h">Caducidad</td></tr>`; rows.forEach((r,i) => { s += `<tr><td class="c n">${i+1}</td><td class="c a">${r.articulo}</td><td class="c v">${r.cantidadExistir||''}</td><td class="c v">${r.caducidad?r.caducidad.split('-').reverse().join('/'):''}</td></tr>`; }); return s; };
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Botiquín — ${sucursal}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',Times,serif;color:#000;font-size:7.5pt;line-height:1.15;padding:10mm 14mm 8mm 14mm}h1{font-size:10pt;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:3pt}.mes{text-align:center;font-size:8.5pt;font-weight:bold;margin-bottom:6pt}.mes u{text-decoration:underline}.info{font-size:7.5pt;margin-bottom:5pt;display:flex;justify-content:space-between}.info b{margin-right:2pt}table.m{width:100%;border-collapse:collapse;font-size:7.5pt}table.m .sep{height:5pt;border:none}table.m .st{text-align:center;font-size:8pt;padding:2pt 0;border:0.5pt solid #000}table.m .h{border:0.5pt solid #000;padding:1.5pt 3pt;font-weight:bold;text-align:center;font-size:7pt}table.m .c{border:0.5pt solid #000;padding:1.2pt 3pt}table.m .c.n{text-align:center;width:20pt}table.m .c.a{text-align:left}table.m .c.v{text-align:center;width:52pt}.firmas{margin-top:18pt;display:flex;justify-content:space-between;padding:0 6pt}.fb{text-align:center;width:30%}.fb .fl{border-top:0.5pt solid #000;margin-top:28pt;padding-top:2pt;font-size:7pt;font-weight:bold}.fb .fr{font-size:6pt;font-style:italic}.foot{text-align:center;margin-top:6pt;font-size:5.5pt;color:#666;border-top:0.3pt solid #bbb;padding-top:2pt}.pa{position:fixed;bottom:16px;right:16px;z-index:100}.pa button{padding:10px 22px;border:none;border-radius:4px;font:bold 12px system-ui,sans-serif;cursor:pointer;background:#000;color:#fff}@media print{.pa{display:none!important}}</style></head><body><h1>Material de Curación y Medicamentos para el Botiquín de Urgencias</h1><div class="mes">MES: <u>${m}</u></div><div class="info"><span><b>Sucursal:</b> ${sucursal||''}</span><span><b>Fecha:</b> ${f}</span><span><b>Responsable:</b> ${usuario||''}</span></div><table class="m">${sec('Material de curación',matRows)}${sec('Medicamentos',medRows)}</table><div class="firmas"><div class="fb"><div class="fl">Responsable de Carro Rojo</div><div class="fr">Enfermería</div></div><div class="fb"><div class="fl">Jefa de Enfermería</div><div class="fr">Supervisión y Validación</div></div><div class="fb"><div class="fl">Dirección Médica</div><div class="fr">Vo. Bo.</div></div></div><div class="foot">Impreso el ${now.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})} a las ${h} — ${sucursal||''} — Uso interno</div><div class="pa"><button onclick="window.print()">Imprimir</button></div></body></html>`;
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) { win.addEventListener('afterprint', () => URL.revokeObjectURL(url)); win.addEventListener('unload', () => URL.revokeObjectURL(url)); }
};

/* ── Mini Progress Ring ── */
const ProgressRing = ({ pct, size = 44, stroke = 3.5, color = '#10b981' }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        className="transition-all duration-700 ease-out" />
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════ */
const CarroRojoJefatura = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sucursales, setSucursales] = useState([]);
  const [pMat, setPMat] = useState([]);
  const [pMed, setPMed] = useState([]);
  const [sucData, setSucData] = useState({});
  const [openSuc, setOpenSuc] = useState(null);
  const [historial, setHistorial] = useState({});
  const [activeSubView, setActiveSubView] = useState({});
  const [filterStatus, setFilterStatus] = useState('all');
  const [openHistRow, setOpenHistRow] = useState({});
  const [historialMesFilter, setHistorialMesFilter] = useState(''); // '' = todos los meses

  // Mes actual como estado — se actualiza al montar y cada minuto
  const [mesActual, setMesActual] = useState(() => new Date().toLocaleDateString('en-CA').slice(0, 7));
  useEffect(() => {
    const tick = () => setMesActual(new Date().toLocaleDateString('en-CA').slice(0, 7));
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { const u = onSnapshot(collection(db,'catalogo_sucursales'), s => { setSucursales(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.activo!==false)); }); return ()=>u(); }, []);
  useEffect(() => { const u = onSnapshot(doc(db,'bitacora_carro_rojo','_plantilla'), s => { if(s.exists()){const d=s.data();setPMat(d.materialCuracion||buildDef(MAT));setPMed(d.medicamentos||buildDef(MED));}else{setPMat(buildDef(MAT));setPMed(buildDef(MED));}}); return ()=>u(); }, []);
  useEffect(() => { if(!sucursales.length)return; setLoading(true); const us=sucursales.map(s=>{const n=s.nombre||s.id;return onSnapshot(doc(db,'bitacora_carro_rojo',n),snap=>{setSucData(p=>({...p,[n]:snap.exists()?snap.data():null}));});}); setLoading(false); return ()=>us.forEach(u=>u()); }, [sucursales]);

  useEffect(() => {
    if (!openSuc) return;
    // Al abrir una nueva sucursal, resetear filtro de mes
    setHistorialMesFilter('');
    const q = query(collection(db, 'bitacora_carro_rojo', openSuc, 'historial'), orderBy('fecha', 'desc'), limit(30));
    const unsub = onSnapshot(q, snap => {
      setHistorial(prev => ({ ...prev, [openSuc]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
    return () => unsub();
  }, [openSuc]);

  // alignSucursalData recupera por nombre de artículo los datos guardados bajo
  // ids que ya no existen en la plantilla vigente (plantilla editada después).
  const merge = (pl, d) => {
    const aligned = alignSucursalData(pl, d || {});
    return pl.map(it => ({ ...it, cantidadExistente: aligned[it.id]?.cantidadExistente||'', caducidad: aligned[it.id]?.caducidad||'' }));
  };
  const mergeHist = (pl, d) => (pl || []).map(it => ({ ...it, cantidadExistente: d?.[it.id]?.cantidadExistente||'', caducidad: d?.[it.id]?.caducidad||'' }));

  const data = useMemo(() => {
    const list = sucursales.map(s => {
      const n = s.nombre || s.id;
      const d = sucData[n];
      // Datos vigentes = capturados en el mes en curso (parciales o completos).
      // `mes` se escribe en cada guardado; `mesBloqueado` solo al completar.
      // Docs antiguos sin `mes` ni `mesBloqueado` con datos se asumen del mes en curso.
      const docMes = d ? (d.mes || d.mesBloqueado || '') : '';
      const esMesActual = !!d && (
        docMes === mesActual ||
        (!docMes && !!(d.materialData || d.medicamentoData))
      );
      const datosVigentes = esMesActual ? d : null;
      const mat = merge(pMat, datosVigentes?.materialData);
      const med = merge(pMed, datosVigentes?.medicamentoData);
      const all = [...mat, ...med];

      let sOk=0,sBajo=0,sCrit=0,sNa=0,cVig=0,cProx=0,cVenc=0,cNa=0;
      all.forEach(r => {
        const p = stockPct(r.cantidadExistir, r.cantidadExistente);
        if(p===null) sNa++; else if(p>=0.8) sOk++; else if(p>=0.5) sBajo++; else sCrit++;
        const dd = cadDias(r.caducidad);
        if(dd===null) cNa++; else if(dd<=0) cVenc++; else if(dd<=90) cProx++; else cVig++;
      });

      let status = 'sin_datos';
      const hasAnyData = datosVigentes && all.some(r => r.cantidadExistente || r.caducidad);
      if(hasAnyData) { if(sCrit>0||cVenc>0) status='critico'; else if(sBajo>0||cProx>0) status='atencion'; else status='ok'; }

      const filled = all.filter(r => r.cantidadExistente).length;
      const coverage = all.length > 0 ? Math.round((filled / all.length) * 100) : 0;

      // Determinar si está realmente completo (todos los campos llenos),
      // usando las filas ya alineadas con la plantilla vigente
      const completo = esMesActual && all.length > 0 && all.every(r => r.cantidadExistente);

      return {
        nombre: n,
        d: datosVigentes,
        mat, med, all,
        sOk, sBajo, sCrit, sNa,
        cVig, cProx, cVenc, cNa,
        status,
        ult: datosVigentes?.ultimaActualizacion,
        por: datosVigentes?.actualizadoPor || '',
        coverage, filled,
        bloqueadoMes: datosVigentes?.mesBloqueado || (d?.mesBloqueado || ''),
        esMesActual,
        // Guardar el mesBloqueado del doc original para estadísticas
        ultimoMesBloqueado: d?.mesBloqueado || '',
        completo,
      };
    });

    const order = { critico: 0, atencion: 1, ok: 2, sin_datos: 3 };
    list.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    const st = { ok:0, atencion:0, critico:0, sinDatos:0 };
    list.forEach(s => st[s.status==='sin_datos'?'sinDatos':s.status]++);
    return { list, st };
  }, [sucursales, sucData, pMat, pMed, mesActual]);

  const filteredList = useMemo(() => {
    if (filterStatus === 'all') return data.list;
    return data.list.filter(s => filterStatus === 'sin_datos' ? s.status === 'sin_datos' : s.status === filterStatus);
  }, [data.list, filterStatus]);

  if (loading && !sucursales.length) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/25 animate-pulse">
        <ShieldAlert size={24} className="text-white" />
      </div>
      <Loader2 size={20} className="text-slate-300 animate-spin" />
      <p className="text-sm text-slate-400 font-medium">Cargando carro rojo...</p>
    </div>
  );

  const statusCfg = {
    ok:        { bg: 'bg-emerald-500', ring: '#10b981', glow: 'shadow-emerald-500/15' },
    atencion:  { bg: 'bg-amber-400',   ring: '#f59e0b', glow: 'shadow-amber-400/15' },
    critico:   { bg: 'bg-red-500',     ring: '#ef4444', glow: 'shadow-red-500/15' },
    sin_datos: { bg: 'bg-slate-300',   ring: '#94a3b8', glow: 'shadow-slate-300/10' },
  };

  const stockCell = (pct) => {
    if (pct === null) return 'bg-slate-50 text-slate-400 border-slate-100';
    if (pct < 0.5) return 'bg-red-50 text-red-700 border-red-200';
    if (pct < 0.8) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const cadCell = (dd) => {
    if (dd === null) return 'bg-slate-50 text-slate-400 border-slate-100';
    if (dd <= 0) return 'bg-red-50 text-red-700 border-red-200';
    if (dd <= 30) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (dd <= 90) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const renderSucursalTabla = ({ title, Icon, rows }) => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
          <Icon size={15} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-black text-slate-800 uppercase tracking-wide truncate">{title}</p>
          <p className="text-[10px] text-slate-400 font-semibold">{rows.length} artículos</p>
        </div>
      </div>

      {/* Desktop (sm+) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-[780px] w-full text-sm border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200">
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 w-[5%]">#</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Artículo</th>
              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-[14%]">A existir</th>
              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-[14%]">Existente</th>
              <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-[18%]">Caducidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => {
              const pct = stockPct(row.cantidadExistir, row.cantidadExistente);
              const dd = cadDias(row.caducidad);
              const stripe = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
              return (
                <tr key={row.id} className={`${stripe} hover:bg-blue-50/30 transition-colors`}>
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-300 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[13px] font-semibold text-slate-800">{row.articulo}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center min-w-16 px-2.5 py-1.5 rounded-xl border bg-violet-50/40 border-violet-200 text-slate-700 text-[12px] font-black tabular-nums">
                      {row.cantidadExistir || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center min-w-16 px-2.5 py-1.5 rounded-xl border text-[12px] font-black tabular-nums ${stockCell(pct)}`}>
                      {row.cantidadExistente || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center min-w-24 px-2.5 py-1.5 rounded-xl border text-[11px] font-black tabular-nums ${cadCell(dd)}`}>
                      {fmtCad(row.caducidad)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile (<sm) */}
      <div className="sm:hidden divide-y divide-slate-100">
        {rows.map((row, idx) => {
          const pct = stockPct(row.cantidadExistir, row.cantidadExistente);
          const dd = cadDias(row.caducidad);
          return (
            <div key={row.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-slate-800 leading-snug truncate">{row.articulo}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">#{idx + 1}</p>
                </div>
                <span className={`shrink-0 px-2 py-1 rounded-lg border text-[10px] font-black tabular-nums ${cadCell(dd)}`}>
                  {fmtCad(row.caducidad)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-black">A existir</p>
                  <p className="text-[13px] font-black text-slate-800 tabular-nums">{row.cantidadExistir || '—'}</p>
                </div>
                <div className={`rounded-xl border p-2 ${stockCell(pct)}`}>
                  <p className="text-[9px] uppercase tracking-wider font-black opacity-70">Existente</p>
                  <p className="text-[13px] font-black tabular-nums">{row.cantidadExistente || '—'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const statCards = [
    { key: 'all',       label: 'Total',    count: data.list.length,  icon: Activity,      activeBg: 'bg-slate-800', activeText: 'text-white' },
    { key: 'ok',        label: 'OK',       count: data.st.ok,        icon: CheckCircle2,  activeBg: 'bg-emerald-500', activeText: 'text-white' },
    { key: 'atencion',  label: 'Atención', count: data.st.atencion,  icon: AlertTriangle, activeBg: 'bg-amber-400', activeText: 'text-white' },
    { key: 'critico',   label: 'Críticas', count: data.st.critico,   icon: AlertCircle,   activeBg: 'bg-red-500', activeText: 'text-white' },
    { key: 'sin_datos', label: 'Sin datos',count: data.st.sinDatos,  icon: TrendingDown,  activeBg: 'bg-slate-400', activeText: 'text-white' },
  ];

  return (
    <div className="space-y-3">
      {/* ═══ Stats + Toolbar inline ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {statCards.map(sc => {
            const Icon = sc.icon;
            const active = filterStatus === sc.key;
            return (
              <button
                key={sc.key}
                onClick={() => setFilterStatus(active ? 'all' : sc.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  active
                    ? `${sc.activeBg} ${sc.activeText} shadow-sm`
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon size={12} />
                <span className="tabular-nums">{sc.count}</span>
                <span className="text-[10px] hidden sm:inline opacity-70">{sc.label}</span>
              </button>
            );
          })}
          {filterStatus !== 'all' && (
            <button onClick={() => setFilterStatus('all')} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 ml-1">
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            {filteredList.length} {filteredList.length === 1 ? 'sucursal' : 'sucursales'}
          </span>
          <button
            onClick={() => navigate('/enfermeria/carro-rojo')}
            className="group flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-800 transition-all active:scale-[0.97]"
          >
            <Edit3 size={12} /> Plantilla
            <ArrowUpRight size={11} className="opacity-40 group-hover:opacity-100" />
          </button>
        </div>
      </div>

      {/* ═══ Sucursales ═══ */}
      <div className="space-y-2.5">
        {filteredList.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <MapPin size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">Sin sucursales en este estado</p>
            <button onClick={() => setFilterStatus('all')} className="mt-3 text-xs font-bold text-blue-500 hover:text-blue-600 underline underline-offset-2">
              Ver todas
            </button>
          </div>
        )}

        {filteredList.map(suc => {
          const open = openSuc === suc.nombre;
          const sc = statusCfg[suc.status] || statusCfg.sin_datos;
          const covColor = suc.coverage >= 80 ? '#10b981' : suc.coverage >= 50 ? '#f59e0b' : suc.coverage > 0 ? '#ef4444' : '#cbd5e1';

          return (
            <div
              key={suc.nombre}
              className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                open ? `border-slate-300 shadow-lg ${sc.glow} bg-white` : 'border-slate-200/80 bg-white hover:shadow-md hover:border-slate-300'
              }`}
            >
              {/* ── Fila principal ── */}
              <div
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 cursor-pointer select-none"
                onClick={() => setOpenSuc(open ? null : suc.nombre)}
              >
                {/* Ring de cobertura */}
                <div className="relative shrink-0">
                  <ProgressRing pct={suc.coverage} size={42} stroke={3} color={covColor} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black text-slate-700 tabular-nums">{suc.coverage}<span className="text-[7px] text-slate-400">%</span></span>
                  </div>
                </div>

                {/* Info central */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${sc.bg} ring-2 ring-offset-1 ${
                      suc.status === 'critico' ? 'ring-red-200' : suc.status === 'atencion' ? 'ring-amber-200' : suc.status === 'ok' ? 'ring-emerald-200' : 'ring-slate-200'
                    }`} />
                    <h3 className="font-bold text-[14px] sm:text-[15px] text-slate-800 truncate leading-tight">{suc.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                    {suc.por ? (
                      <span className="truncate max-w-[120px] flex items-center gap-1"><User size={10} className="shrink-0" />{suc.por}</span>
                    ) : (
                      <span className="italic">{suc.ultimoMesBloqueado ? `Último envío: ${suc.ultimoMesBloqueado}` : 'Sin actualizaciones'}</span>
                    )}
                    <span className="hidden sm:inline text-slate-300">·</span>
                    <span className="hidden sm:inline">{fmtRelativo(suc.ult)}</span>
                    {suc.esMesActual && suc.completo && (
                      <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded hidden sm:inline-block">
                        Completado
                      </span>
                    )}
                    {suc.esMesActual && !suc.completo && (
                      <span className="text-[9px] font-black text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded hidden sm:inline-block">
                        En progreso
                      </span>
                    )}
                    {suc.ultimoMesBloqueado && !suc.esMesActual && (
                      <span className="text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded hidden sm:inline-block">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>

                {/* Badges (sm+) */}
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  {suc.cVenc > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-red-500 px-2 py-1 rounded-lg shadow-sm shadow-red-500/20">
                      <AlertCircle size={11} /> {suc.cVenc}
                    </span>
                  )}
                  {suc.cProx > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                      <Clock size={11} /> {suc.cProx}
                    </span>
                  )}
                  {suc.sCrit > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                      <TrendingDown size={11} /> {suc.sCrit}
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-slate-300 shrink-0 hidden lg:block font-medium tabular-nums">{fmtTs(suc.ult)}</span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); printSuc({ sucursal: suc.nombre, matRows: suc.mat, medRows: suc.med, usuario: user?.nombre||'' }); }}
                    className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all" title="Imprimir"
                  >
                    <Printer size={15} />
                  </button>
                  <div className={`p-1.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
                    <ChevronDown size={17} className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Badges móvil */}
              {!open && (suc.cVenc > 0 || suc.cProx > 0 || suc.sCrit > 0 || suc.esMesActual || suc.ultimoMesBloqueado) && (
                <div className="sm:hidden flex items-center gap-1.5 px-4 pb-3 -mt-1 overflow-x-auto">
                  {suc.esMesActual && suc.completo && (
                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">Completado</span>
                  )}
                  {suc.esMesActual && !suc.completo && (
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shrink-0">En progreso</span>
                  )}
                  {suc.ultimoMesBloqueado && !suc.esMesActual && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">Pendiente</span>
                  )}
                  {suc.cVenc > 0 && <span className="text-[9px] font-black text-white bg-red-500 px-2 py-0.5 rounded-md shrink-0">{suc.cVenc} vencidos</span>}
                  {suc.cProx > 0 && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">{suc.cProx} próximos</span>}
                  {suc.sCrit > 0 && <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md shrink-0">↓{suc.sCrit} stock</span>}
                </div>
              )}

              {/* ═══ Panel expandido ═══ */}
              {open && (
                <div className="border-t border-slate-100">
                  {/* Mini header con meta y acción */}
                  <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-50 to-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={11} /> {fmtTs(suc.ult)}</span>
                      {suc.por && <span>por <b className="text-slate-600">{suc.por}</b></span>}
                      {suc.esMesActual && suc.completo && (
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          Completado
                        </span>
                      )}
                      {suc.esMesActual && !suc.completo && (
                        <span className="text-[10px] font-black text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                          En progreso
                        </span>
                      )}
                      {suc.ultimoMesBloqueado && !suc.esMesActual && (
                        <span className="text-[10px] font-black text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Pendiente este mes
                        </span>
                      )}
                      <span className="text-slate-200 hidden sm:inline">|</span>
                      <span className="hidden sm:inline"><b className="text-slate-600">{suc.filled}</b> de {suc.all.length} registrados</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/enfermeria/carro-rojo?sucursal=${encodeURIComponent(suc.nombre)}`); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-[11px] font-bold hover:from-slate-700 hover:to-slate-800 transition-all active:scale-[0.97] shadow-sm"
                    >
                      <Edit3 size={12} /> {suc.completo ? 'Ver datos' : 'Editar datos'} <ArrowUpRight size={11} className="opacity-50" />
                    </button>
                  </div>

                  {/* Sub-tabs */}
                  <div className="px-4 sm:px-5 pt-2 pb-1">
                    <div className="inline-flex bg-slate-100/80 rounded-xl p-1 gap-0.5">
                      {[
                        { id: 'actual', label: 'Estado Actual', mobileLabel: 'Estado', icon: Package },
                        { id: 'historial', label: 'Historial de Envíos', mobileLabel: 'Historial', icon: History },
                      ].map(tab => {
                        const Icon = tab.icon;
                        const isActive = (activeSubView[suc.nombre] || 'actual') === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveSubView(p => ({ ...p, [suc.nombre]: tab.id }))}
                            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-[12px] font-bold transition-all ${
                              isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Icon size={13} />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.mobileLabel}</span>
                            {tab.id === 'historial' && historial[suc.nombre]?.length > 0 && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                isActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/80 text-slate-500'
                              }`}>{historial[suc.nombre].length}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Tab: Estado Actual ── */}
                  {(activeSubView[suc.nombre] || 'actual') === 'actual' && (
                    <div className="px-4 sm:px-5 pb-5 pt-3 space-y-3">
                      {/* Resumen compacto */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                          <CheckCircle2 size={12} className="text-emerald-500" /> {suc.sOk} OK
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                          <AlertTriangle size={12} className="text-amber-500" /> {suc.sBajo} Bajo
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                          <TrendingDown size={12} className="text-red-500" /> {suc.sCrit} Crítico
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-black ${
                          suc.cVenc > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          <AlertCircle size={12} /> {suc.cVenc} Vencidos
                        </span>
                      </div>

                      {renderSucursalTabla({ title: 'Material de curación', Icon: Package, rows: suc.mat })}
                      {renderSucursalTabla({ title: 'Medicamentos', Icon: Pill, rows: suc.med })}

                      {suc.status === 'sin_datos' && (
                        <div className="text-center py-10">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                            <Package size={24} className="text-slate-300" />
                          </div>
                          <p className="text-sm font-bold text-slate-400">Sin datos registrados</p>
                          <button
                            onClick={() => navigate(`/enfermeria/carro-rojo?sucursal=${encodeURIComponent(suc.nombre)}`)}
                            className="mt-3 text-[12px] font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 mx-auto"
                          >
                            Registrar ahora <ArrowUpRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab: Historial ── */}
                  {activeSubView[suc.nombre] === 'historial' && (
                    <div className="px-4 sm:px-5 pb-5 pt-3">
                      {(!historial[suc.nombre] || historial[suc.nombre].length === 0) ? (
                        <div className="text-center py-12">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                            <History size={24} className="text-slate-300" />
                          </div>
                          <p className="text-sm font-bold text-slate-400">Sin historial de envíos</p>
                          <p className="text-[11px] text-slate-300 mt-1">Se generará con cada nueva actualización</p>
                        </div>
                      ) : (
                        <>
                          {/* ── Filtro por mes ── */}
                          {(() => {
                            const mesesUnicos = [...new Set(
                              historial[suc.nombre]
                                .map(h => h.mes || (h.fecha?.toDate ? h.fecha.toDate() : h.fecha ? new Date(h.fecha) : null))
                                .filter(Boolean)
                                .map(m => typeof m === 'string' ? m : m.toLocaleDateString('en-CA').slice(0, 7))
                            )].sort().reverse();
                            const MESES_LABEL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                            const mesLabel = (ym) => { const [, m] = ym.split('-'); return `${MESES_LABEL[Number(m)-1]} ${ym.split('-')[0]}`; };
                            const entradasFiltradas = historialMesFilter
                              ? historial[suc.nombre].filter(h => {
                                  const entryMes = h.mes || (h.fecha?.toDate ? h.fecha.toDate() : h.fecha ? new Date(h.fecha) : null);
                                  if (!entryMes) return false;
                                  return (typeof entryMes === 'string' ? entryMes : entryMes.toLocaleDateString('en-CA').slice(0, 7)) === historialMesFilter;
                                })
                              : historial[suc.nombre];

                            return (
                              <>
                                {mesesUnicos.length > 1 && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Filtrar mes:</span>
                                    <div className="relative">
                                      <select
                                        value={historialMesFilter}
                                        onChange={e => setHistorialMesFilter(e.target.value)}
                                        className="pl-3 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all appearance-none"
                                      >
                                        <option value="">Todos los meses</option>
                                        {mesesUnicos.map(ym => (
                                          <option key={ym} value={ym}>{mesLabel(ym)}</option>
                                        ))}
                                      </select>
                                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    </div>
                                    {historialMesFilter && (
                                      <button onClick={() => setHistorialMesFilter('')} className="text-[10px] font-bold text-blue-500 hover:text-blue-600">
                                        Limpiar
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                  <div className="overflow-x-auto">
                                    <table className="min-w-[760px] w-full text-sm border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                          <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Mes</th>
                                          <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                          <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Usuario</th>
                                          <th className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Capt.</th>
                                          <th className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">OK</th>
                                          <th className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Bajo</th>
                                          <th className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Crit.</th>
                                          <th className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Venc.</th>
                                          <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {entradasFiltradas.map((h, i) => {
                                          const fecha = h.fecha?.toDate ? h.fecha.toDate() : h.fecha ? new Date(h.fecha) : null;
                                          const entryMes = h.mes || (fecha ? fecha.toLocaleDateString('en-CA').slice(0, 7) : '—');
                                          const plMatSnap = h.plantillaMaterial || pMat;
                                          const plMedSnap = h.plantillaMedicamento || pMed;
                                          const m = snapshotMetrics({ pMat: plMatSnap, pMed: plMedSnap, materialData: h.materialData, medicamentoData: h.medicamentoData, baseDate: fecha || new Date() });
                                          const isOpen = openHistRow[suc.nombre] === h.id;
                                          const matSnapRows = mergeHist(plMatSnap, h.materialData);
                                          const medSnapRows = mergeHist(plMedSnap, h.medicamentoData);
                                          const stripe = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
                                          return (
                                            <React.Fragment key={h.id}>
                                              <tr className={`${stripe} hover:bg-blue-50/30 transition-colors`}>
                                                <td className="px-3 py-3">
                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                                                    entryMes === mesActual ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                  }`}>
                                                    {entryMes !== '—' && entryMes.includes('-') ? entryMes.split('-').reverse().join('/') : entryMes}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                  <div className="font-bold text-slate-700 text-[12px]">
                                                    {fecha ? fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                  </div>
                                                  <div className="text-[10px] text-slate-400 font-medium tabular-nums">
                                                    {fecha ? fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                  </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                  <div className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                                                    <User size={12} className="text-slate-300" />
                                                    <span className="truncate max-w-[180px]">{h.actualizadoPor || '—'}</span>
                                                  </div>
                                                  <div className="text-[10px] text-slate-400 font-medium capitalize">{h.actualizadoPorRol || ''}</div>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                  <span className="text-[12px] font-black tabular-nums text-slate-700">{m.capturados}</span>
                                                  <span className="text-[10px] text-slate-400 font-medium">/{m.total}</span>
                                                </td>
                                                <td className="px-2 py-3 text-center text-[12px] font-black tabular-nums text-emerald-600">{m.ok}</td>
                                                <td className="px-2 py-3 text-center text-[12px] font-black tabular-nums text-amber-600">{m.bajo}</td>
                                                <td className="px-2 py-3 text-center text-[12px] font-black tabular-nums text-red-600">{m.critico}</td>
                                                <td className={`px-2 py-3 text-center text-[12px] font-black tabular-nums ${m.vencidos > 0 ? 'text-red-600' : 'text-slate-300'}`}>{m.vencidos}</td>
                                                <td className="px-4 py-3 text-right">
                                                  <div className="inline-flex items-center gap-1">
                                                    <button
                                                      onClick={() => setOpenHistRow(p => ({ ...p, [suc.nombre]: (p[suc.nombre] === h.id ? null : h.id) }))}
                                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    >
                                                      <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                      {isOpen ? 'Ocultar' : 'Ver'}
                                                    </button>
                                                    <button
                                                      onClick={() => printSuc({ sucursal: suc.nombre, matRows: matSnapRows, medRows: medSnapRows, usuario: h.actualizadoPor || '', fecha: h.fecha })}
                                                      className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all" title="Imprimir este envío"
                                                    >
                                                      <Printer size={15} />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>

                                              {isOpen && (
                                                <tr className={`${stripe}`}>
                                                  <td colSpan={9} className="px-4 sm:px-5 py-4 bg-white">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                      <div>
                                                        <p className="text-[12px] font-black text-slate-700">Detalle del envío</p>
                                                        <p className="text-[10px] text-slate-400 font-semibold">
                                                          {fecha ? fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                                                          {fecha ? ` · ${fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                        </p>
                                                      </div>
                                                      <button
                                                        onClick={() => printSuc({ sucursal: suc.nombre, matRows: matSnapRows, medRows: medSnapRows, usuario: h.actualizadoPor || '', fecha: h.fecha })}
                                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-all active:scale-[0.97]"
                                                      >
                                                        <Printer size={14} /> Imprimir este envío
                                                      </button>
                                                    </div>

                                                    <div className="space-y-3">
                                                      {renderSucursalTabla({ title: 'Material de curación', Icon: Package, rows: matSnapRows })}
                                                      {renderSucursalTabla({ title: 'Medicamentos', Icon: Pill, rows: medSnapRows })}
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
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CarroRojoJefatura;
