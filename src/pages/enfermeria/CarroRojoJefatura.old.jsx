import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer, ChevronDown, ChevronUp, Package, Pill,
  AlertCircle, CheckCircle2, Loader2, Edit3,
  AlertTriangle, Calendar, MapPin, Clock, History
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

/* ── helpers ── */
const cadDias = (c) => c ? Math.ceil((new Date(c) - new Date()) / 86400000) : null;
const stockPct = (req, ext) => { const a = parseFloat(req), b = parseFloat(ext); return (isNaN(a)||isNaN(b)||a===0) ? null : b/a; };
const buildDef = (items) => items.map((n, i) => ({ id: `item_${i+1}`, articulo: n, cantidadExistir: '' }));
const fmtCad = (c) => c ? c.split('-').reverse().join('/') : '—';
const fmtTs = (ts) => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}); };

const MAT = ['Apósitos','Algodón','Campos estériles','Gasas','Guantes quirúrgicos estériles','Jeringas desechables con aguja diversas medidas','Material de sutura','Soluciones antisépticas','Tela adhesiva','Tiras reactivas para la determinación de glucosa en sangre','Vendas elásticas diversas medidas','Vendas de yeso'];
const MED = ['Acido acetilsalicílico, tabletas 100 mg.','Acido acetilsalicílico, tabletas 500 mg.','Ketorolaco, solución inyectable 30 mg.','Metamizol, solución inyectable 500 mg.','Paracetamol, tabletas 500 mg.','Lidocaína simple, solución inyectable al 2%','Nifedipino, cápsulas 10 mg.','Trinitrato de glicerilo, cápsulas o tabletas masticables 6.8 mg.','Difenhidramina, solución oral','Epinefrina, solución inyectable 1 mg 1:1000/ml.','Acetato de metilprednisolona, solución inyectable 40 mg.','Bultilhioscina, solución inyectable 20 mg.','Furosemida, solución inyectable 20 mg.','Salbutamol, spray','Diazepan, solución inyectable 10 mg.','Difenidol, solución inyectable 40 mg.','Dimenhidrinato, solución inyectable 50 mg.','Agua bidestilada, solución inyectable 2 ml.','Cloruro de sodio, solución al 0.9%','Glucosa, solución al 5%','Glucosa, solución al 10%','Glucosa, solución al 50%','Solución de Hartmann'];

/* ── Impresión ── */
const printSuc = ({ sucursal, matRows, medRows, usuario }) => {
  const f = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const m = new Date().toLocaleDateString('es-MX',{month:'long',year:'numeric'}).toUpperCase();
  const h = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  const sec = (t, rows) => { let s = `<tr><td class="sep" colspan="4"></td></tr><tr><td class="st" colspan="4"><b>${t}</b></td></tr><tr><td class="h">No.</td><td class="h" style="text-align:left">Artículo</td><td class="h">Cantidad</td><td class="h">Caducidad</td></tr>`; rows.forEach((r,i) => { s += `<tr><td class="c n">${i+1}</td><td class="c a">${r.articulo}</td><td class="c v">${r.cantidadExistir||''}</td><td class="c v">${r.caducidad?r.caducidad.split('-').reverse().join('/'):''}</td></tr>`; }); return s; };
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Botiquín — ${sucursal}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',Times,serif;color:#000;font-size:7.5pt;line-height:1.15;padding:10mm 14mm 8mm 14mm}h1{font-size:10pt;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:3pt}.mes{text-align:center;font-size:8.5pt;font-weight:bold;margin-bottom:6pt}.mes u{text-decoration:underline}.info{font-size:7.5pt;margin-bottom:5pt;display:flex;justify-content:space-between}.info b{margin-right:2pt}table.m{width:100%;border-collapse:collapse;font-size:7.5pt}table.m .sep{height:5pt;border:none}table.m .st{text-align:center;font-size:8pt;padding:2pt 0;border:0.5pt solid #000}table.m .h{border:0.5pt solid #000;padding:1.5pt 3pt;font-weight:bold;text-align:center;font-size:7pt}table.m .c{border:0.5pt solid #000;padding:1.2pt 3pt}table.m .c.n{text-align:center;width:20pt}table.m .c.a{text-align:left}table.m .c.v{text-align:center;width:52pt}.firmas{margin-top:18pt;display:flex;justify-content:space-between;padding:0 6pt}.fb{text-align:center;width:30%}.fb .fl{border-top:0.5pt solid #000;margin-top:28pt;padding-top:2pt;font-size:7pt;font-weight:bold}.fb .fr{font-size:6pt;font-style:italic}.foot{text-align:center;margin-top:6pt;font-size:5.5pt;color:#666;border-top:0.3pt solid #bbb;padding-top:2pt}.pa{position:fixed;bottom:16px;right:16px;z-index:100}.pa button{padding:10px 22px;border:none;border-radius:4px;font:bold 12px system-ui,sans-serif;cursor:pointer;background:#000;color:#fff}@media print{.pa{display:none!important}}</style></head><body><h1>Material de Curación y Medicamentos para el Botiquín de Urgencias</h1><div class="mes">MES: <u>${m}</u></div><div class="info"><span><b>Sucursal:</b> ${sucursal||''}</span><span><b>Fecha:</b> ${f}</span><span><b>Responsable:</b> ${usuario||''}</span></div><table class="m">${sec('Material de curación',matRows)}${sec('Medicamentos',medRows)}</table><div class="firmas"><div class="fb"><div class="fl">Responsable de Carro Rojo</div><div class="fr">Enfermería</div></div><div class="fb"><div class="fl">Jefa de Enfermería</div><div class="fr">Supervisión y Validación</div></div><div class="fb"><div class="fl">Dirección Médica</div><div class="fr">Vo. Bo.</div></div></div><div class="foot">Generado el ${f} a las ${h} — ${sucursal||''} — Uso interno</div><div class="pa"><button onclick="window.print()">Imprimir</button></div></body></html>`;
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) { win.addEventListener('afterprint', () => URL.revokeObjectURL(url)); win.addEventListener('unload', () => URL.revokeObjectURL(url)); }
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

  useEffect(() => { const u = onSnapshot(collection(db,'catalogo_sucursales'), s => { setSucursales(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.activo!==false)); }); return ()=>u(); }, []);
  useEffect(() => { const u = onSnapshot(doc(db,'bitacora_carro_rojo','_plantilla'), s => { if(s.exists()){const d=s.data();setPMat(d.materialCuracion||buildDef(MAT));setPMed(d.medicamentos||buildDef(MED));}else{setPMat(buildDef(MAT));setPMed(buildDef(MED));}}); return ()=>u(); }, []);
  useEffect(() => { if(!sucursales.length)return; setLoading(true); const us=sucursales.map(s=>{const n=s.nombre||s.id;return onSnapshot(doc(db,'bitacora_carro_rojo',n),snap=>{setSucData(p=>({...p,[n]:snap.exists()?snap.data():null}));});}); setLoading(false); return ()=>us.forEach(u=>u()); }, [sucursales]);

  // Cargar historial on-demand cuando se expande una sucursal
  useEffect(() => {
    if (!openSuc) return;
    const q = query(
      collection(db, 'bitacora_carro_rojo', openSuc, 'historial'),
      orderBy('fecha', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(q, snap => {
      setHistorial(prev => ({
        ...prev,
        [openSuc]: snap.docs.map(d => ({ id: d.id, ...d.data() }))
      }));
    });
    return () => unsub();
  }, [openSuc]);

  const merge = (pl, d) => pl.map(it => ({ ...it, cantidadExistente: d?.[it.id]?.cantidadExistente||'', caducidad: d?.[it.id]?.caducidad||'' }));

  const data = useMemo(() => {
    const list = sucursales.map(s => {
      const n = s.nombre || s.id;
      const d = sucData[n];
      const mat = merge(pMat, d?.materialData);
      const med = merge(pMed, d?.medicamentoData);
      const all = [...mat, ...med];

      let sOk=0,sBajo=0,sCrit=0,sNa=0,cVig=0,cProx=0,cVenc=0,cNa=0;
      all.forEach(r => {
        const p = stockPct(r.cantidadExistir, r.cantidadExistente);
        if(p===null) sNa++; else if(p>=0.8) sOk++; else if(p>=0.5) sBajo++; else sCrit++;
        const dd = cadDias(r.caducidad);
        if(dd===null) cNa++; else if(dd<=0) cVenc++; else if(dd<=90) cProx++; else cVig++;
      });

      let status = 'sin_datos';
      if(d && (sOk+sBajo+sCrit>0)) { if(sCrit>0||cVenc>0) status='critico'; else if(sBajo>0||cProx>0) status='atencion'; else status='ok'; }

      // Agrupar por período de caducidad para vista calendario
      const groups = { vencido: [], urgente: [], proximo: [], vigente: [], sinFecha: [] };
      all.forEach(r => {
        const dd = cadDias(r.caducidad);
        if(dd === null) groups.sinFecha.push(r);
        else if(dd <= 0) groups.vencido.push(r);
        else if(dd <= 30) groups.urgente.push(r);
        else if(dd <= 90) groups.proximo.push(r);
        else groups.vigente.push(r);
      });
      // Dentro de cada grupo, ordenar por fecha
      ['vencido','urgente','proximo','vigente'].forEach(k => groups[k].sort((a,b) => new Date(a.caducidad) - new Date(b.caducidad)));

      return { nombre: n, d, mat, med, all, sOk, sBajo, sCrit, sNa, cVig, cProx, cVenc, cNa, status, groups, ult: d?.ultimaActualizacion, por: d?.actualizadoPor||'' };
    });

    const st = { ok:0, atencion:0, critico:0, sinDatos:0 };
    list.forEach(s => st[s.status==='sin_datos'?'sinDatos':s.status]++);
    return { list, st };
  }, [sucursales, sucData, pMat, pMed]);

  if (loading && !sucursales.length) return <div className="flex items-center justify-center py-16"><Loader2 size={22} className="text-slate-300 animate-spin"/></div>;

  const dot = (s) => s==='ok'?'bg-emerald-500':s==='atencion'?'bg-amber-400':s==='critico'?'bg-red-500':'bg-slate-300';

  const groupMeta = [
    { key: 'vencido', label: 'Vencidos', bg: 'bg-red-500', text: 'text-white', icon: AlertCircle },
    { key: 'urgente', label: 'Vencen en <30 días', bg: 'bg-amber-500', text: 'text-white', icon: AlertTriangle },
    { key: 'proximo', label: 'Vencen en 30-90 días', bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock },
    { key: 'vigente', label: 'Vigentes (+90 días)', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
    { key: 'sinFecha', label: 'Sin fecha asignada', bg: 'bg-slate-100', text: 'text-slate-500', icon: Calendar },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header: stats + editar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/>{data.st.ok} OK</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"/>{data.st.atencion} Atención</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"/>{data.st.critico} Críticas</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"/>{data.st.sinDatos} Sin datos</span>
        </div>
        <button
          onClick={() => navigate('/enfermeria/carro-rojo')}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
        >
          <Edit3 size={16}/> Editar Plantilla Global
        </button>
      </div>

      {/* ── Sucursales ── */}
      <div className="space-y-2">
        {data.list.map(suc => {
          const open = openSuc === suc.nombre;
          return (
            <div key={suc.nombre} className={`bg-white rounded-xl border ${open ? 'border-slate-300 shadow-md' : 'border-slate-200 shadow-sm'} overflow-hidden transition-all`}>
              {/* Fila */}
              <div
                className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors ${open ? 'bg-slate-50/60' : 'hover:bg-slate-50/40'}`}
                onClick={() => setOpenSuc(open ? null : suc.nombre)}
              >
                <span className={`w-3 h-3 rounded-full shrink-0 ${dot(suc.status)}`}/>
                <span className="font-bold text-[15px] text-slate-800 flex-1 truncate">{suc.nombre}</span>

                {/* Badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {suc.cVenc > 0 && <span className="text-[11px] font-black text-white bg-red-500 px-2 py-0.5 rounded-md">{suc.cVenc} venc.</span>}
                  {suc.cProx > 0 && <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">{suc.cProx} próx.</span>}
                  {suc.sCrit > 0 && <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">↓{suc.sCrit}</span>}
                </div>

                <span className="text-xs text-slate-400 shrink-0 hidden md:block font-medium">{fmtTs(suc.ult)}</span>

                <button onClick={e => { e.stopPropagation(); printSuc({ sucursal: suc.nombre, matRows: suc.mat, medRows: suc.med, usuario: user?.nombre||'' }); }}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0" title="Imprimir">
                  <Printer size={16}/>
                </button>
                {open ? <ChevronUp size={18} className="text-slate-400 shrink-0"/> : <ChevronDown size={18} className="text-slate-400 shrink-0"/>}
              </div>

              {/* ── Detalle: Tabs + contenido ── */}
              {open && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  {/* Info rápida + acciones */}
                  <div className="flex items-center gap-4 py-3 text-xs text-slate-400 font-medium border-b border-slate-100 mb-3 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={13}/> {fmtTs(suc.ult)}</span>
                    {suc.por && <span>por <b className="text-slate-500">{suc.por}</b></span>}
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-slate-500 font-bold">{suc.all.length} artículos</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/enfermeria/carro-rojo?sucursal=${encodeURIComponent(suc.nombre)}`); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-bold hover:bg-slate-700 transition-all active:scale-95"
                      >
                        <Edit3 size={13}/> Editar
                      </button>
                    </span>
                  </div>

                  {/* Sub-tabs: Estado Actual / Historial */}
                  <div className="flex items-center gap-1 mb-3 bg-slate-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setActiveSubView(p => ({ ...p, [suc.nombre]: 'actual' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold transition-all ${
                        (activeSubView[suc.nombre] || 'actual') === 'actual'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Package size={13}/> Estado Actual
                    </button>
                    <button
                      onClick={() => setActiveSubView(p => ({ ...p, [suc.nombre]: 'historial' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-bold transition-all ${
                        activeSubView[suc.nombre] === 'historial'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <History size={13}/> Historial de Envíos
                      {historial[suc.nombre]?.length > 0 && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                          {historial[suc.nombre].length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* ── Vista: Estado Actual ── */}
                  {(activeSubView[suc.nombre] || 'actual') === 'actual' && (
                    <div className="space-y-3">
                      {groupMeta.map(gm => {
                        const items = suc.groups[gm.key];
                        if (!items || items.length === 0) return null;
                        const Icon = gm.icon;
                        return (
                          <div key={gm.key}>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${gm.bg} ${gm.text} mb-1.5`}>
                              <Icon size={16}/>
                              <span className="text-[13px] font-bold uppercase tracking-wide">{gm.label}</span>
                              <span className="ml-auto text-[12px] font-bold opacity-70">{items.length}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {items.map((item) => {
                                const dd = cadDias(item.caducidad);
                                const p = stockPct(item.cantidadExistir, item.cantidadExistente);
                                const stockWarn = p !== null && p < 0.5;
                                return (
                                  <div key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm bg-white hover:bg-slate-50/50 rounded-lg border border-slate-100">
                                    <span className="flex-1 truncate font-medium text-slate-700">{item.articulo}</span>
                                    <div className="flex items-center gap-3 shrink-0 text-[13px]">
                                      {item.cantidadExistir && (
                                        <span className={`font-bold ${stockWarn ? 'text-red-600' : 'text-slate-500'}`}>
                                          {item.cantidadExistente || '0'}/{item.cantidadExistir}
                                        </span>
                                      )}
                                      {item.caducidad && (
                                        <span className={`font-mono font-bold ${dd !== null && dd <= 0 ? 'text-red-600' : dd !== null && dd <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                                          {fmtCad(item.caducidad)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Vista: Historial de Envíos ── */}
                  {activeSubView[suc.nombre] === 'historial' && (
                    <div className="space-y-2">
                      {(!historial[suc.nombre] || historial[suc.nombre].length === 0) ? (
                        <div className="text-center py-8 text-sm text-slate-400">
                          <History size={24} className="mx-auto mb-2 opacity-40"/>
                          <p className="font-medium">Sin historial de envíos registrado</p>
                          <p className="text-xs mt-1">El historial se generará con cada nueva actualización</p>
                        </div>
                      ) : (
                        historial[suc.nombre].map((h, i) => {
                          const fecha = h.fecha?.toDate ? h.fecha.toDate() : h.fecha ? new Date(h.fecha) : null;
                          const matCount = h.materialData ? Object.keys(h.materialData).filter(k => h.materialData[k]?.cantidadExistente).length : 0;
                          const medCount = h.medicamentoData ? Object.keys(h.medicamentoData).filter(k => h.medicamentoData[k]?.cantidadExistente).length : 0;
                          return (
                            <div key={h.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${i === 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-100'} transition-all`}>
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${i === 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Calendar size={16}/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] font-bold ${i === 0 ? 'text-blue-800' : 'text-slate-700'}`}>
                                  {fecha ? fecha.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                                  <span className="text-slate-400 font-medium ml-2">
                                    {fecha ? fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </span>
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[11px] text-slate-500">por <b>{h.actualizadoPor || '—'}</b></span>
                                  <span className="text-[11px] text-slate-400 capitalize">{h.actualizadoPorRol || ''}</span>
                                  {(matCount > 0 || medCount > 0) && (
                                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-2">
                                      {matCount > 0 && <span className="flex items-center gap-0.5"><Package size={10}/>{matCount}</span>}
                                      {medCount > 0 && <span className="flex items-center gap-0.5"><Pill size={10}/>{medCount}</span>}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {i === 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md shrink-0">Último</span>}
                            </div>
                          );
                        })
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
