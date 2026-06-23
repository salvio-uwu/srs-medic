import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  X, FileText, Download, Loader2, Edit3, Calendar,
  Droplet, MapPin, Phone, Mail, ClipboardList, Pill,
  ShieldAlert, ChevronDown, ChevronRight, Clock,
  FileSignature, Printer, Share2
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { generarToken } from '../services/expedienteShareService';
import { encodeToken } from '../utils/routeObfuscator';
import ExpedienteElectronicoPDF from './pdf/ExpedienteElectronicoPDF';
import ShareExpedienteModal from './ShareExpedienteModal';
import {
  calcularEdad,
  nombrePaciente,
  direccionPaciente,
  normalizeConsulta,
  tieneConsultaContenido,
  pickSeccionReciente,
  formatHeredofamiliares,
  formatAdicciones,
  formatAlergias,
  formatEspecificos,
  limpiar,
  bulletproofSanitize,
  safeDateStr,
  resolveTemplateToPlainText,
  buildTemplateContext
} from '../utils/expedienteElectronico';

// ─── Sub-componentes ────────────────────────────────────────────────────────

const SeccionBloque = ({ titulo, badge, children }) => (
  <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
    <div className="flex items-center gap-2 mb-2">
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{titulo}</h3>
      {badge !== undefined && (
        <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-px rounded">{badge}</span>
      )}
    </div>
    <div>{children}</div>
  </div>
);

const InfoChip = ({ icon: Icon, label, value }) => (
  <div className="flex items-baseline gap-1.5">
    {Icon && <Icon size={11} className="text-slate-400 shrink-0" />}
    <span className="text-[10px] font-semibold text-slate-400 uppercase">{label}:</span>
    <span className="text-xs font-medium text-slate-700 truncate">{value || '—'}</span>
  </div>
);

const Dato = ({ label, value, fallback = 'No referido' }) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-[10px] text-slate-400 shrink-0">{label}</span>
    <span className="text-[11px] text-slate-700 text-right">{String(value || '').trim() || fallback}</span>
  </div>
);

// ─── Tarjeta de consulta (sección colapsable) ───────────────────────────────

const ConsultaCard = ({ consulta, index, total }) => {
  const [abierta, setAbierta] = useState(index === 0);
  const c = consulta;

  const vitales = [
    { l: 'Peso', v: c.antropometria.peso, u: 'kg' },
    { l: 'Talla', v: c.antropometria.talla, u: 'm' },
    { l: 'IMC', v: c.antropometria.imc, u: '' },
    { l: 'Temp', v: c.signos.temp, u: '°C' },
    { l: 'T/A', v: c.signos.ta, u: '' },
    { l: 'F.C.', v: c.signos.fc, u: 'lpm' },
    { l: 'F.R.', v: c.signos.fr, u: 'rpm' },
    { l: 'SpO₂', v: c.signos.spo2, u: '%' }
  ];
  const hayVitales = vitales.some((s) => String(s.v || '').trim());
  const hayFisica = Object.values(c.fisica).some((v) => String(v || '').trim());
  const estudios = [
    ...(c.estudios.paquetes || []),
    ...c.estudios.seleccionados.map((e) => (typeof e === 'string' ? e : (e?.nombre || '')))
  ].filter(Boolean);
  const procs = c.procedimientos.seleccionados
    .map((p) => (typeof p === 'string' ? p : (p?.nombre || p?.procedimiento || p?.descripcion || '')))
    .filter(Boolean);

  const recetas = c.recetasGeneradas || [];
  const documentos = c.documentosGenerados || [];
  const hayArchivos = recetas.length > 0 || documentos.length > 0;

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setAbierta(!abierta)}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-slate-50/50 transition-colors"
      >
        <Calendar size={13} className="text-slate-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-slate-700">{c.fechaFormato}</span>
            {c.horaFormato && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock size={9} /> {c.horaFormato}</span>}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {c.tipoNota} · {limpiar(c.medicoNombre, 'Médico')}
            {c.medicoPerfil?.cedula && <span> · Céd. {c.medicoPerfil.cedula}</span>}
            {c.diagnostico && <span className="text-slate-500"> — {c.diagnostico.length > 60 ? c.diagnostico.slice(0, 60) + '...' : c.diagnostico}</span>}
          </p>
        </div>
        <span className="text-[10px] text-slate-300">#{total - index}</span>
        {abierta ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
      </button>

      {abierta && (
        <div className="px-4 pb-3.5 space-y-3 border-t border-slate-50">
          {/* Metadatos de la receta — folio, médico, sucursal */}
          {(c.folioReceta || (c.medicoPerfil && (c.medicoPerfil.cedula || c.medicoPerfil.universidadEgreso || c.medicoPerfil.especialidad)) || c.consultorioNombre) && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] bg-slate-50 rounded-md px-3 py-2">
              {c.folioReceta && <span className="text-slate-500">Folio: <span className="font-semibold text-slate-700">{c.folioReceta}</span></span>}
              {c.medicoPerfil?.cedula && <span className="text-slate-500">Céd. Prof.: <span className="font-semibold text-slate-700">{c.medicoPerfil.cedula}</span></span>}
              {c.medicoPerfil?.universidadEgreso && <span className="text-slate-500">Univ.: <span className="font-semibold text-slate-700">{c.medicoPerfil.universidadEgreso}</span></span>}
              {c.medicoPerfil?.especialidad && <span className="text-slate-500">Esp.: <span className="font-semibold text-slate-700">{c.medicoPerfil.especialidad}</span></span>}
              {c.consultorioNombre && <span className="text-slate-500">Consultorio: <span className="font-semibold text-slate-700">{c.consultorioNombre}</span></span>}
              {c.sucursalDireccion && <span className="text-slate-500">Dirección: <span className="font-semibold text-slate-700">{c.sucursalDireccion}</span></span>}
            </div>
          )}
          {/* Padecimiento */}
          {c.padecimiento && (
            <SeccionBloque titulo="Padecimiento actual">
              <p className="text-xs text-slate-600 leading-relaxed">{c.padecimiento}</p>
            </SeccionBloque>
          )}

          {/* Signos vitales */}
          {hayVitales && (
            <SeccionBloque titulo="Signos vitales y somatometría">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {vitales.filter((s) => String(s.v || '').trim()).map((s) => (
                  <span key={s.l} className="text-[11px]">
                    <span className="text-slate-400">{s.l}</span>{' '}
                    <span className="font-semibold text-slate-700">{s.v}{s.u ? ` ${s.u}` : ''}</span>
                  </span>
                ))}
              </div>
            </SeccionBloque>
          )}

          {/* Exploración física */}
          {hayFisica && (
            <SeccionBloque titulo="Exploración física">
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {Object.entries(c.fisica).map(([k, v]) => (String(v || '').trim() ? (
                  <span key={k} className="text-[11px]">
                    <span className="text-slate-400 capitalize">{k}:</span>{' '}
                    <span className="text-slate-700">{v}</span>
                  </span>
                ) : null))}
              </div>
            </SeccionBloque>
          )}

          {/* Diagnóstico */}
          <SeccionBloque titulo="Diagnóstico">
            <p className="text-xs font-semibold text-slate-700">{limpiar(c.diagnostico, 'Sin diagnóstico registrado')}</p>
            {c.cie10.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {c.cie10.map((item, i) => (
                  <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded">
                    {[item?.codigo, item?.descripcion].filter(Boolean).join(' — ')}
                  </span>
                ))}
              </div>
            )}
          </SeccionBloque>

          {/* Receta médica — TODOS los campos */}
          {c.tratamiento.length > 0 && (
            <SeccionBloque titulo="Receta médica" badge={`${c.tratamiento.length} medicamento${c.tratamiento.length !== 1 ? 's' : ''}`}>
              <div className="space-y-2.5">
                {c.tratamiento.map((m, i) => {
                  const tieneMetadatos = m?.presentacion || m?.sustanciasActivas || m?.grupo || m?.marca || m?.numeroAcomodo;
                  const tieneDosis = m?.dosis && String(m.dosis).trim();
                  return (
                    <div key={i} className="border-l-2 border-slate-200 pl-3">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-700">{i + 1}. {limpiar(m?.nombre, 'Medicamento')}</span>
                        {m?.presentacion && <span className="text-[10px] text-slate-400">{m.presentacion}</span>}
                      </div>
                      {tieneMetadatos && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {m?.sustanciasActivas && (
                            <span className="text-[10px] text-slate-500">
                              <span className="text-slate-400">Sust. activa:</span> {m.sustanciasActivas}
                            </span>
                          )}
                          {(m?.grupo || m?.marca) && (
                            <span className="text-[10px] text-slate-500">
                              <span className="text-slate-400">Grupo:</span> {m.grupo || m.marca}
                            </span>
                          )}
                          {m?.numeroAcomodo && (
                            <span className="text-[10px] text-slate-400">Acomodo #{m.numeroAcomodo}</span>
                          )}
                        </div>
                      )}
                      {tieneDosis && (
                        <div className="mt-2 bg-slate-50 rounded-md px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Posología e indicaciones</p>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                            {String(m.dosis).trim()}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SeccionBloque>
          )}

          {/* Indicaciones generales */}
          {c.indicaciones && (
            <SeccionBloque titulo="Indicaciones generales">
              <p className="text-xs text-slate-600 leading-relaxed">{c.indicaciones}</p>
            </SeccionBloque>
          )}

          {/* Pronóstico */}
          {c.pronostico && (
            <SeccionBloque titulo="Pronóstico">
              <p className="text-xs text-slate-600">{c.pronostico}</p>
            </SeccionBloque>
          )}

          {/* Estudios */}
          {estudios.length > 0 && (
            <SeccionBloque titulo="Estudios solicitados">
              <div className="flex flex-wrap gap-1.5">
                {estudios.map((e, i) => (
                  <span key={i} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded">{e}</span>
                ))}
              </div>
            </SeccionBloque>
          )}

          {/* Procedimientos */}
          {procs.length > 0 && (
            <SeccionBloque titulo="Procedimientos">
              <div className="flex flex-wrap gap-1.5">
                {procs.map((p, i) => (
                  <span key={i} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded">{p}</span>
                ))}
              </div>
            </SeccionBloque>
          )}

          {/* Archivos generados (recetas impresas + documentos) */}
          {hayArchivos && (
            <SeccionBloque titulo="Documentos expedidos en esta consulta">
              <div className="space-y-1.5">
                {recetas.map((receta, i) => (
                  <div key={`rec-${i}`} className="flex items-center gap-2 text-[11px]">
                    <FileSignature size={11} className="text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">{receta.nombre || 'Receta médica'}</span>
                    <span className="text-slate-400">
                      {receta.formato === 'clinico' ? 'Formato clínico' : receta.plantillaNombre || receta.formato || ''}
                      {receta.totalMedicamentos > 0 && ` · ${receta.totalMedicamentos} med.`}
                    </span>
                    {receta.generadoAt && (
                      <span className="text-slate-400 ml-auto">
                        {(() => { const d = new Date(receta.generadoAt); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); })()}
                      </span>
                    )}
                  </div>
                ))}
                {documentos.map((docEmitido, i) => (
                  <div key={`doc-${i}`} className="flex items-center gap-2 text-[11px]">
                    <FileText size={11} className="text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700">{docEmitido.nombre || 'Documento'}</span>
                    <span className="text-slate-400">{docEmitido.plantillaNombre || docEmitido.formato || 'Documento clínico'}</span>
                    {docEmitido.generadoAt && (
                      <span className="text-slate-400 ml-auto">
                        {(() => { const d = new Date(docEmitido.generadoAt); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); })()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </SeccionBloque>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Componente principal ───────────────────────────────────────────────────

const ExpedienteElectronicoModal = ({ paciente, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const generadoPor = String(user?.nombre || user?.displayName || user?.email || '').trim();
  const folio = String(paciente?.idPaciente || paciente?.id || '').trim();
  const [loading, setLoading] = useState(true);
  const [consultas, setConsultas] = useState([]);
  const [antecedentes, setAntecedentes] = useState({});
  const [pxInfo, setPxInfo] = useState({});
  const [panel, setPanel] = useState('expediente');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePdfBlob, setSharePdfBlob] = useState(null);
  const [shareToken, setShareToken] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);
  const previewUrlRef = useRef('');

  const pacienteId = paciente?.id;
  const nombre = nombrePaciente(paciente || {});

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      if (!pacienteId) { setLoading(false); return; }
      setLoading(true);
      try {
        const q = query(
          collection(db, 'historial_clinico'),
          where('pacienteId', '==', pacienteId),
          orderBy('fecha', 'asc')
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ordenados = [...docs].reverse();
        const ant = pickSeccionReciente(ordenados, 'antecedentes') || {};
        const px = pickSeccionReciente(ordenados, 'px_info') || {};
        const normalizadas = ordenados.map(normalizeConsulta).filter(tieneConsultaContenido);

        // Cargar plantillas y resolver contenido de documentos emitidos
        const templateIds = new Set();
        normalizadas.forEach((c) => {
          (c.recetasGeneradas || []).forEach((r) => { if (r.plantillaId) templateIds.add(r.plantillaId); });
          (c.documentosGenerados || []).forEach((d) => { if (d.plantillaId) templateIds.add(d.plantillaId); });
        });

        const templateMap = {};
        if (templateIds.size > 0) {
          await Promise.all(
            Array.from(templateIds).map(async (tid) => {
              try {
                const tSnap = await getDoc(doc(db, 'catalogo_plantillas_documentos', tid));
                if (tSnap.exists()) templateMap[tid] = tSnap.data();
              } catch (_) { /* skip */ }
            })
          );
        }

        // Resolver contenido para cada documento
        const consultasConResuelto = normalizadas.map((c) => {
          const ctx = buildTemplateContext(paciente || {}, px || {}, c);
          const resolverDocEntry = (entry) => {
            const tpl = templateMap[entry.plantillaId];
            if (!tpl || !tpl.schema) return entry;
            const htmlSources = [
              tpl.schema.documentHtml || '',
              ...(tpl.schema.bloques || []).map((b) => b.contenidoHtml || b.contenido || ''),
              ...(tpl.schema.elements || []).map((e) => e.contentHtml || e.content || '')
            ].filter(Boolean);
            const resolvedContent = htmlSources
              .map((html) => resolveTemplateToPlainText(html, ctx))
              .filter(Boolean)
              .join('\n');
            return { ...entry, resolvedContent };
          };
          return {
            ...c,
            recetasGeneradas: (c.recetasGeneradas || []).map(resolverDocEntry),
            documentosGenerados: (c.documentosGenerados || []).map(resolverDocEntry)
          };
        });

        if (!cancelled) {
          setAntecedentes(ant);
          setPxInfo(px);
          setConsultas(consultasConResuelto);
        }
      } catch (error) {
        console.error('Error cargando expediente electrónico:', error);
        if (!cancelled) { setConsultas([]); setAntecedentes({}); setPxInfo({}); }
      }
      if (!cancelled) setLoading(false);
    };
    cargar();
    return () => { cancelled = true; };
  }, [pacienteId]);

  const pdfDocument = useMemo(() => (
    <ExpedienteElectronicoPDF
      paciente={bulletproofSanitize(paciente || {})}
      antecedentes={bulletproofSanitize(antecedentes)}
      consultas={bulletproofSanitize(consultas)}
      generadoPor={generadoPor}
      folio={folio}
    />
  ), [paciente, antecedentes, consultas, generadoPor, folio]);

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      if (panel !== 'pdf' || loading) return;
      if (previewUrl) return;
      setPreviewLoading(true);
      try {
        const blob = await pdf(pdfDocument).toBlob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (error) {
        console.error('Error generando previsualización PDF:', error);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    build();
    return () => { cancelled = true; };
  }, [panel, loading, pdfDocument, previewUrl]);

  useEffect(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setPreviewUrl('');
  }, [antecedentes, pxInfo, consultas]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const descargarPdf = async () => {
    setDownloading(true);
    try {
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Expediente_Clinico_${nombre.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error('Error descargando expediente PDF:', error);
    }
    setDownloading(false);
  };

  const compartirExpediente = async () => {
    setSharingLoading(true);
    try {
      const token = generarToken();
      const tokenEncoded = encodeToken(token);
      const dominio = typeof window !== 'undefined' ? window.location.origin : 'https://centromedicosantacruz.com';
      const shareUrl = `${dominio}/compartido/${tokenEncoded}`;
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 300,
        margin: 1,
        color: { dark: '#111827', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      });

      const pdfConQR = (
        <ExpedienteElectronicoPDF
          paciente={bulletproofSanitize(paciente || {})}
          antecedentes={bulletproofSanitize(antecedentes)}
          consultas={bulletproofSanitize(consultas)}
          generadoPor={generadoPor}
          folio={folio}
          qrDataUrl={qrDataUrl}
        />
      );

      const blob = await pdf(pdfConQR).toBlob();
      setSharePdfBlob(blob);
      setShareToken(token);
      setShareUrl(shareUrl);
      setShowShareModal(true);
    } catch (error) {
      console.error('Error preparando expediente para compartir:', error);
    }
    setSharingLoading(false);
  };

  const editarExpediente = () => {
    navigate('/expediente-electronico', {
      state: { pacienteId, pacienteNombre: nombre, openedFrom: 'admin_pacientes' }
    });
  };

  const edad = calcularEdad(paciente?.fechaNacimiento);
  const heredo = formatHeredofamiliares(antecedentes.hereditarios || {});
  const noPat = antecedentes.no_patologicos || {};
  const pat = antecedentes.patologicos || {};
  const adicciones = formatAdicciones(pat.adicciones || {});
  const esp = pat.especificos || {};
  const especificosTexto = formatEspecificos(esp);
  const alergiasTexto = formatAlergias(antecedentes.alergias || {});
  const tieneAlergias = alergiasTexto !== 'Sin alergias registradas' && alergiasTexto !== 'Preguntadas y negadas';

  return (
    <>
    <div className="fixed inset-0 z-[220] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-5xl h-[94vh] sm:h-[92vh] rounded-xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col">

        {/* ─── HEADER ─────────────────────────────────────── */}
        <div className="border-b border-slate-100 px-4 sm:px-5 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 truncate" style={{ fontFamily: 'Sora, sans-serif' }}>
              Expediente Clínico
            </h2>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {nombre} · {edad ? `${edad} años` : '—'} · {paciente?.sexo || '—'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="bg-slate-100 rounded-lg p-0.5 flex">
              <button
                onClick={() => setPanel('expediente')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all inline-flex items-center gap-1 ${
                  panel === 'expediente' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <ClipboardList size={12} /> Datos
              </button>
              <button
                onClick={() => setPanel('pdf')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all inline-flex items-center gap-1 ${
                  panel === 'pdf' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <FileText size={12} /> PDF
              </button>
            </div>
            <button
              onClick={editarExpediente}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Edit3 size={12} /> Editar
            </button>
            <button
              onClick={descargarPdf}
              disabled={loading || downloading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-medium inline-flex items-center gap-1 hover:bg-slate-900 disabled:opacity-40 transition-colors"
            >
              {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              <span className="hidden sm:inline">Descargar</span>
            </button>
            <button
              onClick={compartirExpediente}
              disabled={loading || sharingLoading}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-medium inline-flex items-center gap-1 hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {sharingLoading ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
              <span className="hidden sm:inline">Compartir</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ─── BODY ───────────────────────────────────────── */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="animate-spin" size={22} />
              <p className="text-xs">Cargando expediente...</p>
            </div>
          ) : panel === 'pdf' ? (
            <div className="h-full p-3 sm:p-4 flex flex-col">
              <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-slate-100 bg-white">
                {previewLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="animate-spin" size={20} />
                    <p className="text-xs">Generando PDF...</p>
                  </div>
                ) : previewUrl ? (
                  <iframe title="Expediente clínico PDF" src={previewUrl} className="w-full h-full" />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No se pudo generar la vista previa.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4 sm:p-5 space-y-4">

              {/* ── Ficha de identificación ─────────────── */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Ficha de identificación</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
                  <InfoChip icon={Calendar} label="Edad" value={edad ? `${edad} años` : '—'} />
                  <InfoChip label="Sexo" value={paciente?.sexo} />
                  <InfoChip icon={Droplet} label="Grupo sanguíneo" value={paciente?.grupoSanguineo} />
                  <InfoChip label="CURP" value={paciente?.curp} />
                  <InfoChip icon={Phone} label="Teléfono" value={paciente?.telefonoMovil} />
                  <InfoChip icon={Mail} label="Correo" value={paciente?.email} />
                  <InfoChip label="Fecha nac." value={safeDateStr(paciente?.fechaNacimiento)} />
                  <InfoChip label="Ocupación" value={paciente?.ocupacion} />
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
                  <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                  <span>{direccionPaciente(paciente || {}) || 'Sin domicilio registrado'}</span>
                </div>
              </div>

              {/* ── Alergias ────────────────────────────── */}
              <div className={`flex items-start gap-2.5 py-2.5 px-3 rounded-lg ${tieneAlergias ? 'bg-red-50/50' : 'bg-slate-50'}`}>
                <ShieldAlert size={13} className={tieneAlergias ? 'text-red-500 mt-0.5 shrink-0' : 'text-slate-400 mt-0.5 shrink-0'} />
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Alergias: </span>
                  <span className={`text-[11px] font-medium ${tieneAlergias ? 'text-red-700' : 'text-slate-600'}`}>
                    {alergiasTexto}
                  </span>
                </div>
              </div>

              {/* ── Antecedentes (3 columnas) ─────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Heredofamiliares</h4>
                  {heredo.length ? (
                    heredo.map((h) => <Dato key={h.label} label={h.label} value={h.valor} />)
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">Interrogados y negados.</p>
                  )}
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">No Patológicos</h4>
                  <Dato label="Alimentación" value={noPat.alimentacion} />
                  <Dato label="Higiene / baño" value={noPat.bano} />
                  <Dato label="Lavado dental" value={noPat.lavado_dientes} />
                  <Dato label="Habitación" value={noPat.habitacion} />
                  <Dato label="Sedentarismo" value={noPat.sedentarismo} />
                  {String(noPat.otros || '').trim() ? <Dato label="Otros" value={noPat.otros} /> : null}
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Patológicos</h4>
                  <Dato label="Padecimientos" value={pat.actuales} />
                  <Dato label="Quirúrgicos" value={pat.quirurgicos} />
                  <Dato label="Hospitalizaciones" value={pat.hospitalizaciones} />
                  <Dato label="Transfusionales" value={pat.transfusionales} />
                  <Dato label="Adicciones" value={adicciones || 'Negadas'} />
                  {especificosTexto ? <Dato label="Específicos" value={especificosTexto} /> : null}
                </div>
              </div>

              {/* ── Historial de Consultas ───────────────── */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Historial de consultas
                  </h3>
                  <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-px rounded">{consultas.length}</span>
                </div>
                {consultas.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-6">
                    El paciente no cuenta con consultas registradas.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {consultas.map((c, idx) => (
                      <ConsultaCard key={c.id || idx} consulta={c} index={idx} total={consultas.length} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {showShareModal && (
      <ShareExpedienteModal
        pdfBlob={sharePdfBlob}
        token={shareToken}
        shareUrl={shareUrl}
        paciente={paciente}
        generadoPor={generadoPor}
        folio={folio}
        onClose={() => { setShowShareModal(false); setSharePdfBlob(null); }}
      />
    )}
    </>
  );
};

export default ExpedienteElectronicoModal;
