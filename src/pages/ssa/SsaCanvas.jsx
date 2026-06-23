import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Eye, FileText, Users, UserCog, ShieldCheck, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Info, X,
  Copy, Settings, Search, UserPlus, Calendar, Building2, History, User, Printer
} from 'lucide-react';
import { db, storage } from '../../config/firebase';
import { collection, getDocs, setDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

const SsaCanvas = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSub, setNewSub] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSub, setEditSub] = useState('');
  const [editUsers, setEditUsers] = useState([]);
  const [editRoles, setEditRoles] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [recentAudits, setRecentAudits] = useState([]);

  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    getDocs(collection(db, 'users')).then((snap) => {
      const list = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.nombre)
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      setAllUsers(list);
    }).catch(() => showToast('Error al cargar usuarios', 'error'));
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'ssa_cuestionario'));
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        questionCount: (d.data().sections || []).reduce((acc, s) =>
          acc + (s.questions || []).length + (s.questions || []).reduce((a, q) => a + (q.subitems?.length || 0), 0), 0
        ),
        sectionCount: (d.data().sections || []).length,
      }));
      setTemplates(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (err) {
      console.error(err);
      showToast('Error al cargar cuestionarios', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    const q = query(collection(db, 'ssa_auditorias'), orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      setRecentAudits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  const formatDate = (d) => {
    if (!d) return '—';
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (typeof d?.toDate === 'function') {
      const date = d.toDate();
      return `${date.getDate()} ${meses[date.getMonth()]} ${date.getFullYear()}`;
    }
    return String(d).slice(0, 10);
  };

  const getUserNames = (uids) => {
    if (!uids || uids.length === 0) return [];
    return uids.map((uid) => {
      const u = allUsers.find((x) => x.uid === uid);
      return u ? u.nombre : uid;
    }).filter(Boolean);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return showToast('Ingrese un nombre para el cuestionario', 'warn');
    setSaving(true);
    try {
      const id = 'custom_' + Date.now();
      await setDoc(doc(db, 'ssa_cuestionario', id), {
        name: newName.trim(),
        description: newDesc.trim() || newName.trim(),
        subtitle: newSub.trim() || 'Secretaria de Salud — Nuevo Leon',
        sections: [],
        visibleToUsers: [],
        visibleToRoles: ['admin'],
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Cuestionario creado correctamente', 'success');
      setShowCreateModal(false);
      setNewName(''); setNewDesc(''); setNewSub('');
      loadTemplates();
    } catch (err) { console.error(err); showToast('Error al crear', 'error'); }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!showEditModal) return;
    if (!editName.trim()) return showToast('El nombre es requerido', 'warn');
    setSaving(true);
    try {
      await setDoc(doc(db, 'ssa_cuestionario', showEditModal.id), {
        name: editName.trim(),
        description: editDesc.trim(),
        subtitle: editSub.trim(),
        visibleToUsers: editUsers.map((u) => u.uid),
        visibleToRoles: editRoles,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast('Configuracion guardada', 'success');
      setShowEditModal(null);
      loadTemplates();
    } catch (err) { console.error(err); showToast('Error al guardar', 'error'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'ssa_cuestionario', id));
      showToast('Cuestionario eliminado', 'success');
      setShowDeleteConfirm(null);
      loadTemplates();
    } catch (err) { console.error(err); showToast('Error al eliminar', 'error'); }
    setSaving(false);
  };

  const handleDuplicate = async (tpl) => {
    setSaving(true);
    try {
      const id = 'custom_' + Date.now();
      await setDoc(doc(db, 'ssa_cuestionario', id), {
        name: (tpl.name || '') + ' (copia)',
        description: tpl.description || '',
        subtitle: tpl.subtitle || '',
        sections: JSON.parse(JSON.stringify(tpl.sections || [])),
        visibleToUsers: [],
        visibleToRoles: ['admin'],
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('Cuestionario duplicado', 'success');
      loadTemplates();
    } catch (err) { console.error(err); showToast('Error al duplicar', 'error'); }
    setSaving(false);
  };

  const openEditor = (tplId) => navigate(`/admin/ssa/editor/${tplId}`);
  const openPreview = (tplId) => navigate(`/ssa/evaluar/${tplId}`);

  const getStoragePathFromUrl = (url) => {
    try {
      const match = url.match(/\/o\/(.+?)\?/);
      if (!match) return null;
      return decodeURIComponent(match[1]);
    } catch { return null; }
  };

  const handleDeleteAudit = async (e, audit) => {
    e.stopPropagation();
    if (!window.confirm(`Eliminar esta evaluacion de "${audit.sucursal || 'Sin sucursal'}" permanentemente?`)) return;
    try {
      if (audit.photos && Object.keys(audit.photos).length > 0) {
        const deletePromises = [];
        for (const [, urls] of Object.entries(audit.photos)) {
          for (const url of urls) {
            const path = getStoragePathFromUrl(url);
            if (path) deletePromises.push(deleteObject(ref(storage, path)).catch(() => {}));
          }
        }
        await Promise.allSettled(deletePromises);
      }
      await deleteDoc(doc(db, 'ssa_auditorias', audit.id));
      showToast('Evaluacion eliminada', 'success');
    } catch (err) { showToast('Error al eliminar', 'error'); }
  };

  const handlePrintAudit = (e, audit) => {
    e.stopPropagation();
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    const pct = audit.porcentajeCumplimiento ?? (audit.totalItems > 0 ? Math.round((audit.cumplimientos / audit.totalItems) * 100) : 0);
    const verdict = pct >= 100 ? 'CUMPLIMIENTO TOTAL' : pct >= 80 ? 'CUMPLIMIENTO PARCIAL' : 'INCUMPLIMIENTO SIGNIFICATIVO';
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = `<html><head><meta charset="UTF-8"><title>${esc(audit.sucursal || 'Auditoria')}</title>
<style>body{font-family:system-ui,sans-serif;font-size:10pt;color:#1a1a1a;line-height:1.5;padding:20px}
h1{font-size:14pt;color:#0f3b5e;border-bottom:2px solid #0f3b5e;padding-bottom:8px}
.meta{background:#f8fafc;border:1px solid #d1d5db;border-radius:4px;padding:10px;margin:12px 0}
.badge{font-size:9pt;font-weight:700;padding:2px 8px;border-radius:4px}
.badge.si{background:#d1fae5;color:#065f46}.badge.no{background:#fee2e2;color:#991b1b}
.badge.na{background:#f1f5f9;color:#94a3b8}.badge.parcial{background:#fef3c7;color:#92400e}
.q{display:flex;align-items:flex-start;gap:8px;padding:4px 0;border-bottom:1px dotted #e5e7eb}
.summary{background:#f8fafc;border:1.5px solid #0f3b5e;border-radius:4px;padding:12px;margin-top:16px}
</style></head><body>
<h1>Evaluacion SSA</h1>
<div class="meta"><strong>Auditor:</strong> ${esc(audit.auditor)} &nbsp;|&nbsp; <strong>Sucursal:</strong> ${esc(audit.sucursal)} &nbsp;|&nbsp; <strong>Fecha:</strong> ${esc(formatDate(audit.fecha || audit.createdAt))} &nbsp;|&nbsp; <strong>Cumplimiento:</strong> ${pct}% — ${verdict}</div>`;
    (audit.secciones || []).forEach((sec) => {
      if (!sec.sectionEnabled) return;
      html += `<h3>${esc(sec.sectionId)}. ${esc(sec.sectionTitle)}</h3>`;
      (sec.questions || []).forEach((q) => {
        if (q.enabled === false) return;
        const ans = q.answer || '—';
        const cls = ans === 'SI' ? 'si' : ans === 'NO' ? 'no' : ans === 'NA' ? 'na' : 'parcial';
        html += `<div class="q"><span>${esc(String(q.id))}.</span><span style="flex:1">${esc(q.text)}</span><span class="badge ${cls}">${esc(ans)}</span></div>`;
        if (q.observations) html += `<div style="margin-left:24px;font-size:8pt;color:#64748b;font-style:italic">Obs: ${esc(q.observations)}</div>`;
        (q.subitems || []).forEach((sub) => {
          const sAns = sub.answer || '—';
          const sCls = sAns === 'SI' ? 'si' : sAns === 'NO' ? 'no' : sAns === 'NA' ? 'na' : 'parcial';
          html += `<div style="margin:2px 0 2px 24px;font-size:9pt;display:flex;gap:8px"><span style="flex:1">${esc(sub.text)}</span><span class="badge ${sCls}">${esc(sAns)}</span></div>`;
          if (sub.observations) html += `<div style="margin-left:52px;font-size:8pt;color:#64748b;font-style:italic">Obs: ${esc(sub.observations)}</div>`;
        });
      });
    });
    html += `<div class="summary"><strong>Cumplimientos:</strong> ${audit.cumplimientos || 0} &nbsp;|&nbsp; <strong>Incumplimientos:</strong> ${audit.incumplimientos || 0} &nbsp;|&nbsp; <strong>Porcentaje:</strong> ${pct}% &nbsp;|&nbsp; <strong>Veredicto:</strong> ${verdict}</div></body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const filteredUsers = allUsers.filter((u) =>
    !userSearch.trim() || (u.nombre || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-16 space-y-5" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const cfg = { error: { bg: 'bg-red-600', icon: XCircle }, warn: { bg: 'bg-amber-600', icon: AlertTriangle }, success: { bg: 'bg-emerald-600', icon: CheckCircle2 }, info: { bg: 'bg-blue-600', icon: Info } }[t.type] || { bg: 'bg-slate-800', icon: Info };
          const IconComponent = cfg.icon;
          return (
            <div key={t.id} className={`${cfg.bg} text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2.5 min-w-[280px] max-w-sm pointer-events-auto animate-in slide-in-from-right fade-in duration-300`}>
              <IconComponent size={16} /><span className="flex-1">{t.message}</span>
              <button onClick={() => dismissToast(t.id)} className="text-white/60 hover:text-white"><X size={14} /></button>
            </div>
          );
        })}
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Panel de Control SSA</h1>
        <p className="text-slate-500 text-xs md:text-sm mt-0.5">Gestion de cuestionarios y asignacion de evaluaciones</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-sm hover:bg-blue-700 hover:shadow-md transition-all">
          <Plus size={16} /> Crear cuestionario
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-bold">No hay cuestionarios</p>
          <p className="text-slate-400 text-sm mt-1">Crea el primer cuestionario para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => {
            const isBuiltIn = tpl.id === 'consultorios' || tpl.id === 'farmacias';
            const userNames = getUserNames(tpl.visibleToUsers || []);
            return (
              <div key={tpl.id} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isBuiltIn ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-800">{tpl.name || 'Sin nombre'}</h3>
                        <p className="text-[11px] text-slate-400">{tpl.description}</p>
                      </div>
                    </div>
                    {isBuiltIn && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">OFICIAL</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1"><FileText size={11} /> {tpl.sectionCount} secciones</span>
                    <span className="flex items-center gap-1"><FileText size={11} /> {tpl.questionCount || 0} items</span>
                    <span className="flex items-center gap-1"><Users size={11} /> {userNames.length} asignados</span>
                  </div>
                  {userNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {userNames.slice(0, 5).map((name) => (
                        <span key={`${tpl.id}-user-${name}`} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {name}
                        </span>
                      ))}
                      {userNames.length > 5 && (
                        <span className="text-[9px] font-semibold text-slate-400">+{userNames.length - 5} mas</span>
                      )}
                    </div>
                  )}
                  {userNames.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-medium mb-3 flex items-center gap-1">
                      <AlertTriangle size={10} /> Sin usuarios asignados — visible solo para admin
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEditor(tpl.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => openPreview(tpl.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                      <Eye size={12} /> Vista previa
                    </button>
                    <button onClick={() => {
                      setEditName(tpl.name || '');
                      setEditDesc(tpl.description || '');
                      setEditSub(tpl.subtitle || '');
                      const existingUids = tpl.visibleToUsers || [];
                      setEditUsers(allUsers.filter((u) => existingUids.includes(u.uid)));
                      setEditRoles(tpl.visibleToRoles || ['admin']);
                      setUserSearch('');
                      setShowEditModal(tpl);
                    }} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Asignar usuarios">
                      <UserCog size={14} />
                    </button>
                    <button onClick={() => handleDuplicate(tpl)}
                      className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Duplicar">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(tpl)}
                      className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORIAL RECIENTE ── */}
      {!loading && recentAudits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-700 flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              Evaluaciones recientes
            </h2>
            <button onClick={() => navigate('/admin/ssa/historial')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors">
              Ver historial completo
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* ── ENCABEZADO DE TABLA ── */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_80px_64px] gap-3 px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Cuestionario / Establecimiento</span>
              <span>Auditor</span>
              <span>Fecha</span>
              <span className="text-center">Nota</span>
              <span />
            </div>
            {recentAudits.slice(0, 5).map((a, idx) => {
              const pct = a.porcentajeCumplimiento ?? (a.totalItems > 0 ? Math.round((a.cumplimientos / a.totalItems) * 100) : 0);
              const templateName = templates.find((t) => t.id === a.templateId)?.name || a.templateName || 'Cuestionario';
              const iconColor = pct >= 80 ? 'bg-emerald-50 text-emerald-600' : pct >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600';
              const pctColor = pct >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : pct >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
              return (
                <div key={a.id}
                  onClick={() => navigate(`/ssa/evaluar/${a.templateId}`)}
                  className={`group sm:grid sm:grid-cols-[1fr_120px_120px_80px_64px] gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50/50 transition-colors flex flex-wrap items-center ${idx > 0 ? 'border-t border-slate-50' : ''}`}>
                  {/* Col 1: Nombre + sucursal */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                      {pct >= 80 ? <CheckCircle2 size={16} /> : pct >= 60 ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{templateName}</p>
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <Building2 size={9} className="flex-shrink-0" /> {a.sucursal || '—'}
                      </p>
                    </div>
                  </div>
                  {/* Col 2: Auditor */}
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-600 font-medium sm:justify-start ml-12 sm:ml-0">
                    <User size={11} className="text-slate-400 flex-shrink-0 sm:hidden" />
                    <span className="truncate">{a.auditor || '—'}</span>
                  </div>
                  {/* Col 3: Fecha */}
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-500 ml-12 sm:ml-0">
                    <Calendar size={11} className="text-slate-400 flex-shrink-0 sm:hidden" />
                    <span className="truncate">{formatDate(a.fecha || a.createdAt)}</span>
                  </div>
                  {/* Col 4: Nota */}
                  <div className="flex items-center gap-2 ml-12 sm:ml-0 sm:justify-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold border min-w-[44px] ${pctColor}`}>
                      {pct}%
                    </span>
                  </div>
                  {/* Col 5: Acciones */}
                  <div className="flex items-center gap-0.5 ml-auto sm:ml-0 sm:justify-end">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handlePrintAudit(e, a)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors" title="Imprimir reporte">
                        <Printer size={13} />
                      </button>
                      <button onClick={(e) => handleDeleteAudit(e, a)}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors" title="Eliminar evaluacion">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Crear nuevo cuestionario</h3>
            </div>
            <div className="p-5 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Nombre *</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Evaluacion de protesis dentales"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Titulo / descripcion</span>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Titulo que aparece en el encabezado"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Subtitulo</span>
                <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Linea secundaria"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancelar</button>
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin inline" /> : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowEditModal(null)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Configurar: {showEditModal.name}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Asigna usuarios que podran ver esta evaluacion en su agenda</p>
              </div>
              <button onClick={() => setShowEditModal(null)} className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Nombre *</span>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Titulo / descripcion</span>
                <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Subtitulo</span>
                <input value={editSub} onChange={(e) => setEditSub(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </label>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Roles visibles</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 min-h-[40px]">
                  {['admin', 'admin_maestro', 'administrador', 'doctor', 'enfermeria', 'intendencia', 'rh'].map((role) => {
                    const isSelected = editRoles.includes(role);
                    return (
                      <button key={role} onClick={() => setEditRoles((prev) => isSelected ? prev.filter((r) => r !== role) : [...prev, role])}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all ${isSelected ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'}`}>
                        {isSelected && <CheckCircle2 size={11} />}
                        {role}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Usuarios asignados ({editUsers.length})</span>
                </div>
                {editUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 min-h-[40px]">
                    {editUsers.map((u) => (
                      <span key={u.uid} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-blue-100 text-blue-700">
                        {u.nombre}
                        <button onClick={() => setEditUsers((prev) => prev.filter((x) => x.uid !== u.uid))}
                          className="text-blue-400 hover:text-red-500 transition-colors">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {editUsers.length === 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl mb-3 text-center">
                    <p className="text-[10px] font-semibold text-amber-700">Sin usuarios asignados. Agrega usuarios para que vean esta evaluacion en su agenda.</p>
                  </div>
                )}

                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar usuario por nombre..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>

                <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {filteredUsers.filter((u) => !editUsers.find((eu) => eu.uid === u.uid)).slice(0, 30).map((u) => (
                    <button key={u.uid} onClick={() => setEditUsers((prev) => [...prev, { uid: u.uid, nombre: u.nombre }])}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors text-left">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {(u.nombre || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{u.nombre}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.rol || 'Sin rol'} &middot; {u.email}</p>
                      </div>
                      <UserPlus size={14} className="text-slate-400 flex-shrink-0" />
                    </button>
                  ))}
                  {filteredUsers.filter((u) => !editUsers.find((eu) => eu.uid === u.uid)).length === 0 && (
                    <div className="px-3 py-4 text-center text-[10px] text-slate-400">Todos los usuarios ya estan asignados</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowEditModal(null)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancelar</button>
              <button onClick={handleEdit} disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin inline" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 text-center">
              <AlertTriangle size={36} className="mx-auto text-red-500 mb-3" />
              <p className="text-sm font-bold text-slate-800">Eliminar cuestionario</p>
              <p className="text-xs text-slate-500 mt-1">"{showDeleteConfirm.name}" se eliminara permanentemente</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-bl-3xl">Cancelar</button>
              <button onClick={() => handleDelete(showDeleteConfirm.id)} disabled={saving}
                className="flex-1 py-3 text-sm font-bold text-red-600 hover:bg-red-50 border-l border-slate-100 rounded-br-3xl disabled:opacity-50">
                {saving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SsaCanvas;
