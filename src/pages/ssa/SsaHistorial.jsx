import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck, Calendar, Building2, Search, ChevronDown, ChevronUp, Eye,
  Printer, FileText, Loader2, AlertTriangle, CheckCircle2, XCircle, ArrowLeft,
  User, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../../config/firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { sanitizeHTML, getStoragePathFromUrl } from '../../utils/ssaUtils';

const PAGE_SIZE = 20;

const formatDate = (d) => {
  if (!d) return '—';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  if (d?.toDate) {
    const date = d.toDate();
    return `${date.getDate()} ${meses[date.getMonth()]} ${date.getFullYear()}`;
  }
  return d;
};

const deleteStoragePhotos = async (auditoria) => {
  if (!auditoria.photos || Object.keys(auditoria.photos).length === 0) return;
  const deletePromises = [];
  for (const [, urls] of Object.entries(auditoria.photos)) {
    for (const url of urls) {
      const path = getStoragePathFromUrl(url);
      if (path) {
        try {
          const fileRef = ref(storage, path);
          deletePromises.push(deleteObject(fileRef));
        } catch { /* skip individual file errors */ }
      }
    }
  }
  await Promise.allSettled(deletePromises);
};

const SsaHistorial = () => {
  useAuth();
  const navigate = useNavigate();
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSucursal, setFilterSucursal] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(0);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'ssa_auditorias'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAuditorias(list);
      setAllLoaded(true);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const getVerdictBadge = (porcentaje) => {
    if (porcentaje >= 100) return { label: 'Cumplimiento total', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (porcentaje >= 80) return { label: 'Cumplimiento parcial', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Incumplimiento significativo', cls: 'bg-red-50 text-red-700 border-red-200' };
  };

  const filtered = useMemo(() => {
    let list = auditorias;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((a) =>
        (a.auditor || '').toLowerCase().includes(s) ||
        (a.sucursal || '').toLowerCase().includes(s) ||
        (a.templateName || '').toLowerCase().includes(s) ||
        (a.fecha || '').includes(s)
      );
    }
    if (filterSucursal) {
      list = list.filter((a) => a.sucursalId === filterSucursal || a.sucursal === filterSucursal);
    }
    return list;
  }, [auditorias, search, filterSucursal]);

  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filtered.slice(start, end);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const uniqueSucursales = useMemo(() => {
    const set = new Set();
    auditorias.forEach((a) => { if (a.sucursal) set.add(a.sucursal); });
    return [...set].sort();
  }, [auditorias]);

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar esta auditoria permanentemente?')) return;
    setDeleting(id);
    try {
      const auditoria = auditorias.find((a) => a.id === id);
      if (auditoria) {
        await deleteStoragePhotos(auditoria);
      }
      await deleteDoc(doc(db, 'ssa_auditorias', id));
    } catch (err) { console.error(err); alert('Error al eliminar.'); }
    setDeleting(null);
  };

  const handlePrint = (auditoria) => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    const fecha = sanitizeHTML(formatDate(auditoria.fecha));
    const porcentaje = auditoria.porcentajeCumplimiento ?? (auditoria.totalItems > 0 ? Math.round((auditoria.cumplimientos / auditoria.totalItems) * 100) : 0);
    const veredicto = getVerdictBadge(porcentaje);
    const sAuditor = sanitizeHTML(auditoria.auditor || '—');
    const sSucursal = sanitizeHTML(auditoria.sucursal || '—');

    let html = `<html><head><meta charset="UTF-8"><title>Auditoria SSA</title><style>
      @page { size: A4; margin: 18mm; }
      body { font-family: system-ui, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; }
      h1 { font-size: 14pt; color: #0f3b5e; text-align: center; border-bottom: 3px double #0f3b5e; padding-bottom: 12px; margin-bottom: 16px; }
      .meta { background: #f8fafc; border: 1px solid #d1d5db; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; font-size: 9pt; }
      .meta td { padding: 3px 8px; }
      .meta td.label { font-weight: 700; color: #475569; width: 140px; }
      .section h2 { font-size: 11pt; font-weight: 700; color: #0f3b5e; border-bottom: 1px solid #94a3b8; padding-bottom: 4px; margin: 14px 0 6px; }
      .q { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-bottom: 1px dotted #e5e7eb; }
      .q-num { width: 24px; font-size: 8pt; font-weight: 700; color: #64748b; flex-shrink: 0; }
      .q-text { flex: 1; font-size: 9pt; }
      .badge { font-size: 7pt; font-weight: 800; padding: 2px 7px; border-radius: 3px; min-width: 40px; text-align: center; }
      .badge.si { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
      .badge.no { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
      .badge.na { background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; }
      .badge.parcial { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      .summary { background: #f8fafc; border: 1.5px solid #0f3b5e; border-radius: 4px; padding: 12px 16px; margin: 18px 0; }
      .summary-grid { display: flex; gap: 24px; }
      .summary-item { text-align: center; }
      .summary-item .num { font-size: 20pt; font-weight: 800; }
      .summary-item .lbl { font-size: 7.5pt; font-weight: 600; text-transform: uppercase; color: #64748b; }
      .verdict { text-align: center; padding: 10px; font-size: 10pt; font-weight: 700; border-radius: 4px; }
    </style></head><body>
      <h1>Evaluacion para Establecimientos de Atencion Medica Ambulatoria</h1>
      <div class="meta"><table>
        <tr><td class="label">Auditor:</td><td>${sAuditor}</td><td class="label">Fecha:</td><td>${fecha}</td></tr>
        <tr><td class="label">Establecimiento:</td><td>${sSucursal}</td></tr>
      </table></div>`;

    if (auditoria.secciones) {
      auditoria.secciones.forEach((sec) => {
        if (!sec.sectionEnabled) return;
        const qs = sec.questions.filter((q) => q.enabled !== false);
        if (qs.length === 0) return;
        html += `<div class="section"><h2>${sanitizeHTML(String(sec.sectionId))}. ${sanitizeHTML(sec.sectionTitle)}</h2>`;
        qs.forEach((q) => {
          const ans = q.answer || '—';
          const badgeCls = ans === 'SI' ? 'si' : ans === 'NO' ? 'no' : ans === 'NA' ? 'na' : 'parcial';
          html += `<div class="q"><span class="q-num">${sanitizeHTML(String(q.id))}.</span><span class="q-text">${sanitizeHTML(q.text || '')}</span><span class="badge ${badgeCls}">${sanitizeHTML(ans)}</span></div>`;
          if (q.observations) html += `<div style="margin-left:32px;font-size:8pt;color:#64748b;font-style:italic;padding:2px 0;">Obs: ${sanitizeHTML(q.observations)}</div>`;
          if (q.subitems) {
            q.subitems.forEach((sub) => {
              const sAns = sub.answer || '—';
              const sCls = sAns === 'SI' ? 'si' : sAns === 'NO' ? 'no' : sAns === 'NA' ? 'na' : 'parcial';
              html += `<div style="margin:3px 0 3px 30px;font-size:8.5pt;display:flex;gap:8px;"><span style="flex:1;">${sanitizeHTML(sub.text || '')}</span><span class="badge ${sCls}">${sanitizeHTML(sAns)}</span></div>`;
              if (sub.observations) html += `<div style="margin-left:60px;font-size:8pt;color:#64748b;font-style:italic;">Obs: ${sanitizeHTML(sub.observations)}</div>`;
            });
          }
        });
        html += '</div>';
      });
    }

    html += `<div class="summary"><h2 style="font-size:11pt;font-weight:700;color:#0f3b5e;margin:0 0 8px;">Resumen</h2>
      <div class="summary-grid">
        <div class="summary-item ok"><div class="num">${auditoria.cumplimientos || 0}</div><div class="lbl">Cumplimientos</div></div>
        <div class="summary-item bad"><div class="num">${auditoria.incumplimientos || 0}</div><div class="lbl">Incumplimientos</div></div>
        <div class="summary-item ok"><div class="num">${porcentaje}%</div><div class="lbl">% Cumplimiento</div></div>
      </div>
      <div class="verdict" style="background:${veredicto.cls.split(' ')[0]};color:${veredicto.cls.split(' ')[1]};border:1px solid ${veredicto.cls.split(' ')[2]};margin-top:12px;">${veredicto.label}</div>
    </div></body></html>`;

    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-16 space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/ssa')} className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
            <span className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </span>
            Historial de Auditorias SSA
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 ml-10 md:ml-11">
            Evaluaciones realizadas — Secretaria de Salud, Nuevo Leon
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por auditor, sucursal o fecha..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
          />
        </div>
        <select
          value={filterSucursal} onChange={(e) => { setFilterSucursal(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400"
        >
          <option value="">Todas las sucursales</option>
          {uniqueSucursales.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Cargando auditorias...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron auditorias</p>
          <p className="text-slate-400 text-sm mt-1">Las evaluaciones guardadas apareceran aqui</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((a) => {
              const isExpanded = expandedId === a.id;
              const porcentaje = a.porcentajeCumplimiento ?? (a.totalItems > 0 ? Math.round((a.cumplimientos / a.totalItems) * 100) : 0);
              const veredicto = getVerdictBadge(porcentaje);
              const fecha = formatDate(a.fecha || a.createdAt);

              return (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">{a.sucursal || 'Sin sucursal'}</p>
                        {a.templateName && (
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">{a.templateName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1"><User size={10} /> {a.auditor || '—'}</span>
                        <span className="flex items-center gap-1"><Calendar size={10} /> {fecha}</span>
                        <span className="flex items-center gap-1"><FileText size={10} /> {a.totalItems || 0} items</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${veredicto.cls}`}>
                        {porcentaje}%
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                          <p className="text-lg font-extrabold text-emerald-700">{a.cumplimientos || 0}</p>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase">Cumplimientos</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                          <p className="text-lg font-extrabold text-red-700">{a.incumplimientos || 0}</p>
                          <p className="text-[9px] font-bold text-red-600 uppercase">Incumplimientos</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                          <p className="text-lg font-extrabold text-blue-700">{porcentaje}%</p>
                          <p className="text-[9px] font-bold text-blue-600 uppercase">% Cumplimiento</p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${veredicto.cls}`}>
                        {veredicto.label}
                      </span>

                      {a.incumplimientosDetalle && a.incumplimientosDetalle.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-red-700 mb-1.5 flex items-center gap-1.5"><AlertTriangle size={12} /> Incumplimientos detectados:</h4>
                          <ul className="space-y-1 max-h-40 overflow-y-auto">
                            {a.incumplimientosDetalle.map((item, i) => (
                              <li key={`${a.id}-inc-${item.id}`} className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                <XCircle size={11} className="flex-shrink-0 mt-0.5" />
                                <span><strong>{item.id}:</strong> {item.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {a.secciones && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-800">Ver detalle completo</summary>
                          <div className="mt-2 space-y-2">
                            {a.secciones.filter((s) => s.sectionEnabled).map((sec) => {
                              const qs = sec.questions.filter((q) => q.enabled !== false);
                              if (qs.length === 0) return null;
                              return (
                                <div key={sec.sectionId} className="border border-slate-100 rounded-lg p-2">
                                  <p className="font-bold text-slate-700 text-[11px] mb-1">{sec.sectionId}. {sec.sectionTitle}</p>
                                  {qs.map((q) => (
                                    <div key={q.id} className="flex items-start gap-1 py-0.5">
                                      <span className="text-slate-400 text-[10px] w-5">{q.id}</span>
                                      <span className="text-slate-600 text-[10px] flex-1">{q.text}</span>
                                      <span className="text-[9px] font-bold px-1.5 py-px rounded ml-1 flex-shrink-0"
                                        style={{
                                          background: q.answer === 'SI' ? '#d1fae5' : q.answer === 'NO' ? '#fee2e2' : q.answer === 'NA' ? '#f1f5f9' : '#fef3c7',
                                          color: q.answer === 'SI' ? '#065f46' : q.answer === 'NO' ? '#991b1b' : q.answer === 'NA' ? '#94a3b8' : '#92400e'
                                        }}>
                                        {q.answer || '—'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={(e) => { e.stopPropagation(); handlePrint(a); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                          <Printer size={12} /> Imprimir
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }} disabled={deleting === a.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                          {deleting === a.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-slate-600 px-2">
                {page + 1} de {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SsaHistorial;
