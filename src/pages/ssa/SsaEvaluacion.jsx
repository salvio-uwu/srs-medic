import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronDown, CheckCircle2, XCircle, MinusCircle,
  FileText, Send, RotateCcw, Building2, ShieldCheck,
  Camera, Trash2, Loader2, User, Calendar, ArrowLeft, Printer,
  ClipboardCheck, AlertTriangle, Info, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../config/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '../../hooks/useToast';
import {
  ANSWER_OPTIONS, buildInitialState, compressImage, toDateInput,
  getComplianceStats, getVerdict, exportCSV, romanize
} from '../../utils/ssaUtils';

const SsaEvaluacion = () => {
  const { templateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState(null);
  const [sections, setSections] = useState([]);
  const [answers, setAnswers] = useState({});
  const [observations, setObservations] = useState({});
  const [subAnswers, setSubAnswers] = useState({});
  const [subObs, setSubObs] = useState({});
  const [photos, setPhotos] = useState({});
  const [tableData, setTableData] = useState({});
  const [enabled, setEnabled] = useState({});
  const [sectionEnabled, setSectionEnabled] = useState({});
  const [expandedSections, setExpandedSections] = useState(new Set());

  const [auditDate, setAuditDate] = useState(toDateInput(new Date()));
  const [auditorName, setAuditorName] = useState(user?.nombre || '');
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [isOther, setIsOther] = useState(false);
  const [otherData, setOtherData] = useState({ empresa: '', direccion: '', telefono: '', contacto: '' });
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'catalogo_sucursales'), orderBy('nombre', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setSucursales(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.activo !== false));
    }, () => {});
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user?.nombre && !auditorName) setAuditorName(user.nombre);
  }, [user]);

  useEffect(() => {
    const loadTemplate = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'ssa_cuestionario', templateId));
        if (snap.exists()) {
          const data = snap.data();
          setTemplate(data);
          const secs = data.sections || [];
          setSections(secs);
          const init = buildInitialState(secs);
          setAnswers(init.answers); setObservations(init.observations);
          setSubAnswers(init.subAnswers); setSubObs(init.subObs);
          setPhotos(init.photos); setTableData(init.tableData);
          setEnabled(init.enabled); setSectionEnabled(init.sectionEnabled);
          setExpandedSections(new Set(secs.map((s) => s.id)));
        } else {
          showToast('Cuestionario no encontrado', 'error');
        }
      } catch (err) { console.error(err); showToast('Error al cargar el cuestionario', 'error'); }
      setLoading(false);
    };
    loadTemplate();
  }, [templateId]);

  const toggleSection = (id) => setExpandedSections((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setAnswer = (qid, val) => setAnswers((p) => ({ ...p, [qid]: val }));
  const setObs = (qid, val) => setObservations((p) => ({ ...p, [qid]: val }));
  const setSubAnswer = (subid, val) => setSubAnswers((p) => ({ ...p, [subid]: val }));
  const setSubObservation = (subid, val) => setSubObs((p) => ({ ...p, [subid]: val }));
  const toggleQuestion = (qid) => setEnabled((p) => ({ ...p, [qid]: !p[qid] }));
  const toggleSectionEnabled = (sid) => setSectionEnabled((p) => ({ ...p, [sid]: !p[sid] }));

  const handleTableChange = (qid, ri, field, val) => {
    setTableData((prev) => { const n = { ...prev }; n[qid] = [...(prev[qid] || [])]; n[qid][ri] = { ...n[qid][ri], [field]: val }; return n; });
  };

  const handlePhotoCapture = (qid) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPhotos((p) => ({ ...p, [qid]: [...(p[qid] || []), { file, preview: reader.result }] }));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const removePhoto = (qid, idx) => {
    setPhotos((p) => { const arr = [...(p[qid] || [])]; arr.splice(idx, 1); return { ...p, [qid]: arr }; });
  };

  const uploadAllPhotos = async (auditId) => {
    const urls = {};
    for (const [qid, pics] of Object.entries(photos)) {
      if (!pics || pics.length === 0) continue;
      urls[qid] = [];
      for (let i = 0; i < pics.length; i++) {
        const compressed = await compressImage(pics[i].file);
        const storageRef = ref(storage, `ssa_auditorias/${auditId}/${qid}_${Date.now()}_${i}`);
        await uploadBytes(storageRef, compressed);
        urls[qid].push(await getDownloadURL(storageRef));
      }
    }
    return urls;
  };

  const { complianceCount, nonComplianceCount, totalItems, percentage, nonComplianceItems } = useMemo(
    () => getComplianceStats(sections, enabled, sectionEnabled, answers, subAnswers),
    [sections, enabled, sectionEnabled, answers, subAnswers]
  );

  const sucursalLabel = isOther ? otherData.empresa || 'Empresa externa' : (sucursales.find((s) => s.id === selectedSucursal)?.nombre || 'Sin seleccionar');
  const answeredCount = useMemo(() => {
    let count = 0;
    sections.forEach((s) => {
      if (!sectionEnabled[s.id]) return;
      s.questions.forEach((q) => {
        if (!enabled[q.id]) return;
        if (answers[q.id] !== null) count++;
        if (q.subitems) q.subitems.forEach((sub) => { if (subAnswers[sub.id] !== null) count++; });
      });
    });
    return count;
  }, [sections, enabled, sectionEnabled, answers, subAnswers]);

  const getVerdictFn = () => getVerdict(nonComplianceCount);

  const resetForm = () => {
    const init = buildInitialState(sections);
    setAnswers(init.answers); setObservations(init.observations);
    setSubAnswers(init.subAnswers); setSubObs(init.subObs);
    setPhotos(init.photos); setTableData(init.tableData);
    setAuditDate(toDateInput(new Date()));
    setAuditorName(user?.nombre || '');
    setSelectedSucursal(''); setIsOther(false);
    setOtherData({ empresa: '', direccion: '', telefono: '', contacto: '' });
  };

  const handleExportCSV = () => {
    exportCSV(sections, enabled, sectionEnabled, answers, observations, subAnswers, subObs, totalItems, complianceCount, nonComplianceCount, percentage, auditDate, sucursalLabel);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const esc = (s = '') => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ansCls = (a) => a === 'SI' ? 'si' : a === 'NO' ? 'no' : a === 'PARCIAL' ? 'parcial' : 'na';
    const ansTxt = (a) => a === 'SI' ? 'SI' : a === 'NO' ? 'NO' : a === 'PARCIAL' ? 'Parcial' : a === 'NA' ? 'N/A' : '—';
    let html = `<html><head><meta charset="UTF-8"><title>${esc(template?.name || 'Evaluacion SSA')}</title>
<style>@page{size:A4;margin:0}body{font-family:system-ui,sans-serif;color:#1a1a1a;font-size:9.5pt;line-height:1.5;padding:18mm 15mm 20mm 15mm}
h1{text-align:center;font-size:14pt;color:#0f3b5e;border-bottom:3px double #0f3b5e;padding-bottom:12px;margin-bottom:16px}
.sub{text-align:center;font-size:8pt;color:#94a3b8;margin-top:-10px;margin-bottom:14px}
.meta{background:#f8fafc;border:1px solid #d1d5db;padding:10px 14px;margin-bottom:16px;font-size:9pt}
.meta td{padding:3px 8px}.meta .lbl{font-weight:700;color:#475569;width:120px}
.sec{margin-bottom:14px;page-break-inside:avoid}.sec h2{font-size:11pt;color:#0f3b5e;border-bottom:1px solid #94a3b8;padding-bottom:4px;margin:0 0 4px}
.q{display:flex;gap:8px;padding:5px 0;border-bottom:1px dotted #e5e7eb;align-items:flex-start}.q-id{width:24px;font-size:8pt;font-weight:700;color:#64748b;text-align:center}
.q-txt{flex:1;font-size:9pt}
.badge{font-size:7pt;font-weight:800;padding:2px 8px;border-radius:3px;min-width:40px;text-align:center;flex-shrink:0}
.badge.si{background:#d1fae5;color:#065f46;border:1px solid #a7f3d0}.badge.no{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}
.badge.na{background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0}.badge.parcial{background:#fef3c7;color:#92400e;border:1px solid #fde68a}
.obs{margin-left:30px;font-size:8pt;color:#64748b;font-style:italic;padding:2px 0}
.sub-item{margin:2px 0 2px 30px;display:flex;gap:8px;font-size:8.5pt}
.photo{margin:4px 0 4px 30px}.photo img{max-width:200px;max-height:120px;border:1px solid #ddd;border-radius:3px;margin-right:6px}
.tbl{width:100%;border-collapse:collapse;margin:4px 0 4px 30px;font-size:8pt}.tbl th{background:#f1f5f9;border:1px solid #cbd5e1;padding:3px 6px;font-size:7.5pt;font-weight:700;text-align:left}.tbl td{border:1px solid #e2e8f0;padding:3px 6px}
.sigs{display:flex;justify-content:space-between;margin-top:40px;padding-top:10px}
.sig{text-align:center;width:45%}.sig .line{border-top:1px solid #334155;margin-bottom:4px}.sig .name{font-size:8pt;font-weight:600;color:#334155}.sig .role{font-size:7.5pt;color:#64748b}
.footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px solid #d1d5db;font-size:7pt;color:#94a3b8}
</style></head><body>
<h1>${esc(template?.description || template?.name || 'Evaluacion Sanitaria')}</h1>
<p class="sub">${esc(template?.subtitle || '')}</p>
<div class="meta"><table><tr><td class="lbl">Auditor:</td><td>${esc(auditorName)}</td><td class="lbl">Fecha:</td><td>${esc(auditDate)}</td></tr><tr><td class="lbl">Establecimiento:</td><td>${esc(sucursalLabel)}</td></tr></table></div>`;
    sections.forEach((s, sIdx) => {
      if (!sectionEnabled[s.id]) return;
      const qs = s.questions.filter((q) => enabled[q.id]);
      if (qs.length === 0) return;
      html += `<div class="sec"><h2>${esc(romanize(sIdx + 1))}. ${esc(s.title)}</h2>`;
      qs.forEach((q, qi) => {
        html += `<div class="q"><span class="q-id">${qi + 1}.</span><span class="q-txt">${esc(q.text)}</span><span class="badge ${ansCls(answers[q.id])}">${ansTxt(answers[q.id])}</span></div>`;
        if (observations[q.id]) html += `<div class="obs">Obs: ${esc(observations[q.id])}</div>`;
        if (q.subitems) q.subitems.forEach((sub) => {
          html += `<div class="sub-item"><span style="flex:1">${esc(sub.text)}</span><span class="badge ${ansCls(subAnswers[sub.id])}">${ansTxt(subAnswers[sub.id])}</span></div>`;
          if (subObs[sub.id]) html += `<div class="obs">Obs: ${esc(subObs[sub.id])}</div>`;
          if (photos[sub.id] && photos[sub.id].length > 0) {
            html += '<div class="photo">';
            photos[sub.id].forEach((p) => { if (p.preview) html += `<img src="${p.preview}" alt="Foto" />`; });
            html += '</div>';
          }
        });
        if (photos[q.id] && photos[q.id].length > 0) {
          html += '<div class="photo">';
          photos[q.id].forEach((p) => { if (p.preview) html += `<img src="${p.preview}" alt="Foto" />`; });
          html += '</div>';
        }
        if (q.tableHeaders && tableData[q.id]) {
          const rows = tableData[q.id].filter((r) => r.muestra || r.localizacion || r.resultado);
          if (rows.length > 0) {
            html += `<table class="tbl"><tr>${q.tableHeaders.map((h) => '<th>' + esc(h) + '</th>').join('')}</tr>`;
            rows.forEach((r) => html += `<tr><td>${esc(r.muestra)}</td><td>${esc(r.localizacion)}</td><td>${esc(r.resultado)}</td></tr>`);
            html += '</table>';
          }
        }
      });
      html += '</div>';
    });
    html += `<div class="sigs"><div class="sig"><div class="line">&nbsp;</div><div class="name">${esc(auditorName) || '________________'}</div><div class="role">Auditor Responsable</div></div><div class="sig"><div class="line">&nbsp;</div><div class="name">${isOther ? esc(otherData.contacto || '________________') : '________________'}</div><div class="role">Responsable del Establecimiento</div></div></div>`;
    html += `<div class="footer">Evaluacion Sanitaria — Secretaria de Salud, Nuevo Leon — Tel. 8181307020</div></body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const handleSubmit = async () => {
    if (!auditorName.trim()) return showToast('Ingrese el nombre del auditor.', 'warn');
    if (!selectedSucursal && !isOther) return showToast('Seleccione una sucursal.', 'warn');
    if (isOther && !otherData.empresa.trim()) return showToast('Ingrese el nombre de la empresa.', 'warn');
    setSaving(true);
    const secData = sections.map((s) => ({
      sectionId: s.id, sectionTitle: s.title, sectionEnabled: sectionEnabled[s.id],
      questions: s.questions.map((q) => ({
        id: q.id, text: q.text, enabled: enabled[q.id],
        answer: answers[q.id], observations: observations[q.id],
        subitems: q.subitems ? q.subitems.map((sub) => ({
          id: sub.id, text: sub.text, answer: subAnswers[sub.id], observations: subObs[sub.id],
        })) : [],
      })),
    }));
    try {
      const docRef = await addDoc(collection(db, 'ssa_auditorias'), {
        fecha: auditDate, createdAt: serverTimestamp(),
        auditor: auditorName, auditorUid: user?.uid || '',
        sucursal: sucursalLabel, sucursalId: isOther ? null : selectedSucursal,
        isOther, otherData: isOther ? otherData : null,
        templateId, templateName: template?.name || '',
        totalItems, cumplimientos: complianceCount, incumplimientos: nonComplianceCount,
        porcentajeCumplimiento: percentage,
        incumplimientosDetalle: nonComplianceItems,
        secciones: secData, tableData, photosUploaded: false,
      });
      const urls = await uploadAllPhotos(docRef.id);
      if (Object.keys(urls).length > 0) {
        await updateDoc(doc(db, 'ssa_auditorias', docRef.id), { photos: urls, photosUploaded: true });
      }
      setShowResults(true);
    } catch (err) { console.error(err); showToast('Error al guardar la auditoria.', 'error'); }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Cargando evaluacion...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const cfg = {
            error: { bg: 'bg-red-600', icon: XCircle },
            warn: { bg: 'bg-amber-600', icon: AlertTriangle },
            success: { bg: 'bg-emerald-600', icon: CheckCircle2 },
            info: { bg: 'bg-blue-600', icon: Info },
          }[t.type] || { bg: 'bg-slate-800', icon: Info };
          const IconComponent = cfg.icon;
          return (
            <div key={t.id} className={`${cfg.bg} text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2.5 min-w-[280px] max-w-sm pointer-events-auto animate-in slide-in-from-right fade-in duration-300`}>
              <IconComponent size={16} />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismissToast(t.id)} className="text-white/60 hover:text-white"><X size={14} /></button>
            </div>
          );
        })}
      </div>

      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="text-center flex-1 mx-4">
            <h1 className="text-base font-extrabold text-slate-800 truncate">{template?.name || 'Evaluacion SSA'}</h1>
            <p className="text-[10px] text-slate-400 font-medium">{totalItems} items &middot; {answeredCount} respondidos</p>
          </div>
          <div className="w-9" />
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 rounded-r-full"
            style={{ width: `${totalItems > 0 ? Math.round((answeredCount / totalItems) * 100) : 0}%` }} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center">
                <ClipboardCheck size={16} />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Datos de la auditoria</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase mb-1 block">Auditor</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={auditorName} onChange={(e) => setAuditorName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" placeholder="Nombre del auditor" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase mb-1 block">Fecha</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-400 uppercase mb-1 block">Establecimiento</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select value={selectedSucursal} onChange={(e) => { setSelectedSucursal(e.target.value); setIsOther(false); }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all appearance-none" disabled={isOther}>
                    <option value="">Seleccionar sucursal...</option>
                    {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isOther} onChange={(e) => { setIsOther(e.target.checked); if (e.target.checked) setSelectedSucursal(''); }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs text-slate-500 font-medium">Es una empresa / consultorio externo</span>
            </label>
            {isOther && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Nombre de la empresa *</span><input value={otherData.empresa} onChange={(e) => setOtherData((p) => ({ ...p, empresa: e.target.value }))} placeholder="Razon social" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" /></label>
                <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Direccion</span><input value={otherData.direccion} onChange={(e) => setOtherData((p) => ({ ...p, direccion: e.target.value }))} placeholder="Direccion completa" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" /></label>
                <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Telefono</span><input value={otherData.telefono} onChange={(e) => setOtherData((p) => ({ ...p, telefono: e.target.value }))} placeholder="Telefono" type="tel" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" /></label>
                <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-slate-500">Persona de contacto</span><input value={otherData.contacto} onChange={(e) => setOtherData((p) => ({ ...p, contacto: e.target.value }))} placeholder="Nombre del responsable" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" /></label>
              </div>
            )}
          </div>
        </div>

        {sections.map((section, sIdx) => {
          if (!sectionEnabled[section.id]) return null;
          const isExpanded = expandedSections.has(section.id);
          const sectionLabel = romanize(sIdx + 1);
          const secAnswered = section.questions.filter((q) => enabled[q.id] && answers[q.id] !== null).length;
          const secTotal = section.questions.filter((q) => enabled[q.id]).length + section.questions.filter((q) => enabled[q.id] && q.subitems).reduce((acc, q) => acc + (q.subitems?.length || 0), 0);
          const secNonCompliance = section.questions.filter((q) => enabled[q.id] && answers[q.id] === 'NO').length;

          return (
            <div key={section.id} className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden transition-all duration-200">
              <button onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  secAnswered === secTotal && secNonCompliance === 0 ? 'bg-emerald-50 text-emerald-600' :
                  secNonCompliance > 0 ? 'bg-red-50 text-red-600' :
                  secAnswered > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {secAnswered === secTotal && secNonCompliance === 0 ? <CheckCircle2 size={18} /> :
                   secNonCompliance > 0 ? <AlertTriangle size={18} /> :
                   <span className="text-xs font-bold">{sectionLabel}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800">{section.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{secAnswered}/{secTotal} respondidos</p>
                </div>
                <div className="flex items-center gap-2">
                  {secAnswered > 0 && (
                    <div className="h-2 w-20 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((secAnswered / secTotal) * 100)}%`, background: secNonCompliance > 0 ? '#dc2626' : '#059669' }} />
                    </div>
                  )}
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100">
                  {section.questions.map((q, qi) => {
                    if (!enabled[q.id]) return null;
                    const qAns = answers[q.id];
                    const qNum = section.questions.slice(0, qi + 1).filter((qq) => enabled[qq.id]).length;

                    return (
                      <div key={q.id} className="px-3 md:px-4 py-3">
                        <div className={`rounded-2xl border overflow-hidden transition-colors ${
                          qAns === 'NO' ? 'border-red-200' :
                          qAns === 'SI' ? 'border-emerald-200' :
                          qAns ? 'border-amber-200' : 'border-slate-200'
                        }`}>

                          {/* ── PREGUNTA ── */}
                          <div className={`flex items-start gap-3 px-4 py-3.5 border-b ${
                            qAns === 'NO' ? 'bg-red-50/70 border-red-100' :
                            qAns === 'SI' ? 'bg-emerald-50/60 border-emerald-100' :
                            qAns ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'
                          }`}>
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 mt-0.5 ${
                              qAns === 'SI' ? 'bg-emerald-600 text-white' :
                              qAns === 'NO' ? 'bg-red-600 text-white' :
                              qAns ? 'bg-amber-500 text-white' : 'bg-white border border-slate-300 text-slate-500'
                            }`}>{qNum}</span>
                            <p className="flex-1 text-[15px] font-bold text-slate-800 leading-snug">{q.text}</p>
                          </div>

                          {/* ── RESPUESTA ── */}
                          <div className="px-4 py-3.5 bg-white">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Selecciona el cumplimiento</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {ANSWER_OPTIONS.map((opt) => {
                                const active = qAns === opt.key;
                                return (
                                  <button key={opt.key} onClick={() => setAnswer(q.id, active ? null : opt.key)}
                                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                                      active
                                        ? `bg-gradient-to-r ${opt.gradient} text-white shadow-md scale-[1.02]`
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-100'
                                    }`}>
                                    <opt.icon size={15} className={active ? 'text-white' : ''} />
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                            {qAns === 'NO' && (
                              <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                <AlertTriangle size={13} className="flex-shrink-0" /> Incumplimiento — genera sancion administrativa
                              </div>
                            )}
                          </div>

                          {/* ── SUB-ITEMS ── */}
                          {q.subitems && q.subitems.length > 0 && (
                            <div className="px-4 pb-3.5 bg-white">
                              <div className="rounded-xl border border-blue-100 bg-blue-50/40 overflow-hidden">
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border-b border-blue-100">
                                  <ClipboardCheck size={12} className="text-blue-500" />
                                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Puntos a verificar · {q.subitems.length}</p>
                                </div>
                                <div className="p-2.5 space-y-2">
                                  {q.subitems.map((sub, si) => {
                                    const subAns = subAnswers[sub.id];
                                    return (
                                      <div key={sub.id} className={`rounded-xl bg-white border p-2.5 ${
                                        subAns === 'NO' ? 'border-red-200' : subAns === 'SI' ? 'border-emerald-200' : 'border-slate-200'
                                      }`}>
                                        <div className="flex items-start gap-2 mb-2">
                                          <span className="min-w-[1.9rem] px-1 h-5 rounded-md bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{qNum}.{si + 1}</span>
                                          <span className="text-xs text-slate-700 flex-1 leading-relaxed font-medium">{sub.text}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1 mb-2">
                                          {ANSWER_OPTIONS.map((opt) => {
                                            const active = subAns === opt.key;
                                            return (
                                              <button key={opt.key} onClick={() => setSubAnswer(sub.id, active ? null : opt.key)}
                                                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                  active ? `${opt.bg} ${opt.text} ring-1 ${opt.ring}` : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'
                                                }`}>
                                                <opt.icon size={12} />
                                                <span className="hidden sm:inline">{opt.short}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                        <input type="text" value={subObs[sub.id] || ''} onChange={(e) => setSubObservation(sub.id, e.target.value)}
                                          placeholder="Observacion del punto (opcional)"
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-300" />
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                          {(photos[sub.id] || []).map((p, idx) => (
                                            <div key={`${sub.id}-photo-${idx}`} className="relative group">
                                              <img src={p.preview} alt={`Foto ${idx + 1}`}
                                                className="w-12 h-12 rounded-lg border border-slate-200 object-cover shadow-sm" />
                                              <button onClick={() => removePhoto(sub.id, idx)}
                                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={8} />
                                              </button>
                                            </div>
                                          ))}
                                          <button onClick={() => handlePhotoCapture(sub.id)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 border-dashed border-slate-200 text-[10px] font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all">
                                            <Camera size={12} /> {(photos[sub.id] || []).length > 0 ? 'Mas fotos' : 'Foto'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── OBSERVACIONES Y EVIDENCIA ── */}
                          <div className="px-4 pb-4 bg-white space-y-3">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observaciones generales</p>
                              <textarea
                                value={observations[q.id] || ''} onChange={(e) => setObs(q.id, e.target.value)}
                                placeholder="Describe hallazgos, notas o evidencias..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y bg-slate-50/50"
                              />
                            </div>

                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Evidencia fotografica</p>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(photos[q.id] || []).map((p, idx) => (
                                  <div key={`${q.id}-photo-${idx}`} className="relative group">
                                    <img src={p.preview} alt={`Foto ${idx + 1}`}
                                      className="w-16 h-16 rounded-2xl border border-slate-200 object-cover shadow-sm" />
                                    <button onClick={() => removePhoto(q.id, idx)}
                                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 size={9} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button onClick={() => handlePhotoCapture(q.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-slate-200 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all">
                                <Camera size={13} /> {(photos[q.id] || []).length > 0 ? 'Agregar mas fotos' : 'Tomar foto como evidencia'}
                              </button>
                            </div>

                            {q.tableHeaders && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{q.tableNote}</p>
                                <div className="overflow-hidden rounded-xl border border-slate-200">
                                  <table className="w-full text-[11px]">
                                    <thead className="bg-slate-50">
                                      <tr>{q.tableHeaders.map((h, i) => (
                                        <th key={`${q.id}-th-${i}`} className="px-2 py-1.5 text-left font-bold text-slate-500 uppercase text-[10px]">{h}</th>
                                      ))}</tr>
                                    </thead>
                                    <tbody>
                                      {(tableData[q.id] || []).map((row, ri) => (
                                        <tr key={`${q.id}-row-${ri}`} className="border-t border-slate-100">
                                          <td className="px-2 py-1"><input type="text" value={row.muestra} onChange={(e) => handleTableChange(q.id, ri, 'muestra', e.target.value)}
                                            className="w-full px-1.5 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></td>
                                          <td className="px-2 py-1"><input type="text" value={row.localizacion} onChange={(e) => handleTableChange(q.id, ri, 'localizacion', e.target.value)}
                                            className="w-full px-1.5 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></td>
                                          <td className="px-2 py-1"><input type="text" value={row.resultado} onChange={(e) => handleTableChange(q.id, ri, 'resultado', e.target.value)}
                                            className="w-full px-1.5 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-16">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No hay secciones en este cuestionario</p>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <button onClick={resetForm} className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
              <RotateCcw size={15} /> <span className="hidden sm:inline">Reiniciar</span>
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
              <Printer size={15} /> <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
              <FileText size={15} /> <span className="hidden sm:inline">CSV</span>
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #0f3b5e, #1a6b9a)' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {saving ? 'Guardando...' : `Guardar evaluacion (${answeredCount}/${totalItems})`}
            </button>
          </div>
        </div>
      </div>

      {showResults && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowResults(false)}>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <span className="text-5xl mb-3 block">{getVerdictFn().emoji}</span>
              <h2 className="text-xl font-extrabold text-slate-800">Evaluacion guardada</h2>
              <p className="text-sm text-slate-500 mt-1">{totalItems} items evaluados &middot; {percentage}% cumplimiento</p>
            </div>
            <div className="px-6 pb-2">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%`, background: getVerdictFn().color }} />
              </div>
            </div>
            <div className="p-6 grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                <p className="text-xl font-extrabold text-emerald-700">{complianceCount}</p>
                <p className="text-[9px] font-bold text-emerald-600 uppercase">SI</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-3 text-center">
                <p className="text-xl font-extrabold text-red-700">{nonComplianceCount}</p>
                <p className="text-[9px] font-bold text-red-600 uppercase">NO</p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-3 text-center">
                <p className="text-xl font-extrabold text-blue-700">{percentage}%</p>
                <p className="text-[9px] font-bold text-blue-600 uppercase">Nota</p>
              </div>
            </div>
            {nonComplianceItems.length > 0 && (
              <div className="px-6 pb-4">
                <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> {nonComplianceItems.length} incumplimientos</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {nonComplianceItems.slice(0, 8).map((item) => (
                    <div key={`res-${item.id}`} className="text-[11px] text-red-700 bg-red-50 rounded-xl px-3 py-1.5">{item.id}: {item.text}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="p-6 pt-0 flex flex-col items-center gap-3">
              <div className="px-4 py-2 rounded-2xl text-sm font-bold" style={{ background: `${getVerdictFn().color}15`, color: getVerdictFn().color }}>
                {getVerdictFn().label}
              </div>
              <button onClick={() => setShowResults(false)}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #0f3b5e, #1a6b9a)' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SsaEvaluacion;
