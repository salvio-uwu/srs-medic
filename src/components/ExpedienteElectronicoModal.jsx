import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  X, FileText, Download, Loader2, Edit3, Calendar,
  Droplet, MapPin, Phone, Mail, ClipboardList, Pill,
  ShieldAlert, ChevronDown, ChevronRight, Clock,
  FileSignature, Printer, Share2, User, Heart, Baby,
  Scissors, Briefcase, Globe, Church, Users
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
  resolveTemplateToHtml,
  parseDocumentHtmlToBlocks,
  buildTemplateContext,
  docUsaArchivoOriginal
} from '../utils/expedienteElectronico';
import { rasterizarDocumentosEnConsultas } from '../utils/pdfToImages';

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

const Dato = ({ label, value, negado = false, fallback = 'No refiere' }) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-[10px] text-slate-400 shrink-0">{label}</span>
    <span className={`text-[11px] text-right ${negado ? 'text-amber-600 italic font-medium' : String(value || '').trim() ? 'text-slate-700' : 'text-slate-300'}`}>
      {negado ? 'Negado' : String(value || '').trim() || fallback}
    </span>
  </div>
);

/** Vista incrustada del documento archivado al expedir (canvas/plantilla dinámica). */
const DocArchivoPreview = ({ doc, icon: Icon = FileText }) => {
  if (!docUsaArchivoOriginal(doc)) return null;
  const titulo = doc?.nombre || 'Documento clínico';
  const paginas = Array.isArray(doc?.archivoPaginas) ? doc.archivoPaginas : [];
  const meta = [
    doc?.plantillaNombre || doc?.formato || '',
    doc?.totalMedicamentos ? `${doc.totalMedicamentos} med.` : '',
    paginas.length > 1 ? `${paginas.length} páginas` : '',
    doc?.generadoAt
      ? (() => {
          const d = new Date(doc.generadoAt);
          return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        })()
      : ''
  ].filter(Boolean).join(' · ');

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
        <Icon size={12} className="text-slate-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-700 truncate">{titulo}</p>
          {meta ? <p className="text-[10px] text-slate-400 truncate">{meta}</p> : null}
        </div>
      </div>
      <div className="p-2 space-y-2 bg-white">
        {paginas.length > 0 ? paginas.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${titulo} — página ${i + 1}`}
            className="w-full h-auto block border border-slate-100 rounded"
          />
        )) : (
          <p className="text-xs text-slate-400 text-center py-8">
            No se pudo incrustar el contenido del documento archivado.
          </p>
        )}
      </div>
    </div>
  );
};

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

          {/* Colesterol y perfil lipídico */}
          {(() => {
            const col = c.colesterol || {};
            const hayCol = Object.values(col).some(v => String(v || '').trim());
            if (!hayCol) return null;
            const labels = { trigliceridos: 'Triglicéridos', colesterol: 'Colesterol', hba1c: 'HbA1c' };
            return (
              <SeccionBloque titulo="Perfil lipídico">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(col).map(([k, v]) => (String(v || '').trim() ? (
                    <span key={k} className="text-[11px]">
                      <span className="text-slate-400">{labels[k] || k}:</span>{' '}
                      <span className="font-semibold text-slate-700">{v}</span>
                    </span>
                  ) : null))}
                </div>
              </SeccionBloque>
            );
          })()}

          {/* Glucosa */}
          {(() => {
            const glu = c.glucosa || {};
            const lista = glu.lista || [];
            if (lista.length === 0) return null;
            return (
              <SeccionBloque titulo="Glucosa" badge={`${lista.length} registro${lista.length !== 1 ? 's' : ''}`}>
                <div className="space-y-1">
                  {lista.map((g, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-[11px]">
                      <span className="font-semibold text-slate-700">{g.valor} mg/dL</span>
                      {g.fecha && <span className="text-slate-400">{typeof g.fecha === 'string' ? g.fecha : ''}</span>}
                      {g.nota && <span className="text-slate-400">— {g.nota}</span>}
                    </div>
                  ))}
                </div>
              </SeccionBloque>
            );
          })()}

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
              {c.estudios?.notas && String(c.estudios.notas).trim() && (
                <p className="text-[10px] text-slate-400 italic mt-1.5">Notas: {String(c.estudios.notas).trim()}</p>
              )}
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
              {c.procedimientos?.notas && String(c.procedimientos.notas).trim() && (
                <p className="text-[10px] text-slate-400 italic mt-1.5">Notas: {String(c.procedimientos.notas).trim()}</p>
              )}
            </SeccionBloque>
          )}

          {/* Referencias médicas */}
          {(() => {
            const refs = c.referencias || [];
            if (refs.length === 0) return null;
            return (
              <SeccionBloque titulo="Referencias médicas">
                <div className="flex flex-wrap gap-1.5">
                  {refs.map((r, i) => (
                    <span key={i} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded">
                      {typeof r === 'string' ? r : (r?.especialidad || r?.nombre || r)}
                    </span>
                  ))}
                </div>
              </SeccionBloque>
            );
          })()}

          {/* Notas de estudios (si hay texto y no se mostró con el bloque de estudios) */}
          {c.estudios?.notas && String(c.estudios.notas).trim() && (
            <SeccionBloque titulo="Notas de estudios">
              <p className="text-xs text-slate-600">{String(c.estudios.notas).trim()}</p>
            </SeccionBloque>
          )}

          {/* Archivos generados (recetas impresas + documentos) */}
          {hayArchivos && (
            <SeccionBloque titulo="Documentos expedidos en esta consulta">
              <div className="space-y-3">
                {recetas.map((receta, i) => (
                  docUsaArchivoOriginal(receta) ? (
                    <DocArchivoPreview key={`rec-${i}`} doc={receta} icon={FileSignature} />
                  ) : (
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
                  )
                ))}
                {documentos.map((docEmitido, i) => (
                  docUsaArchivoOriginal(docEmitido) ? (
                    <DocArchivoPreview key={`doc-${i}`} doc={docEmitido} icon={FileText} />
                  ) : (
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
                  )
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
  const [pacienteCompleto, setPacienteCompleto] = useState(paciente || null);
  const pxDoc = pacienteCompleto || paciente || {};
  const generadoPor = String(user?.nombre || user?.displayName || user?.email || '').trim();
  const folio = String(pxDoc?.idPaciente || pxDoc?.id || '').trim();
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

  const pacienteId = pxDoc?.id;
  const nombre = nombrePaciente(pxDoc);

  useEffect(() => {
    setPacienteCompleto(paciente || null);
  }, [paciente]);

  useEffect(() => {
    let cancelled = false;
    const cargar = async () => {
      if (!pacienteId) { setLoading(false); return; }
      setLoading(true);
      try {
        const [pxSnap, historialSnap] = await Promise.all([
          getDoc(doc(db, 'pacientes', pacienteId)),
          getDocs(query(
            collection(db, 'historial_clinico'),
            where('pacienteId', '==', pacienteId),
            orderBy('fecha', 'asc')
          ))
        ]);

        if (!cancelled && pxSnap.exists()) {
          setPacienteCompleto({ id: pxSnap.id, ...pxSnap.data() });
        }

        const docs = historialSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ordenados = [...docs].reverse();
        const ant = pickSeccionReciente(ordenados, 'antecedentes') || {};
        const pxInfoReciente = pickSeccionReciente(ordenados, 'px_info') || {};
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

        const pxDocActual = pxSnap.exists() ? { id: pxSnap.id, ...pxSnap.data() } : (paciente || {});

        // Resolver contenido para cada documento
        const consultasConResuelto = normalizadas.map((c) => {
          const ctx = buildTemplateContext(pxDocActual, pxInfoReciente, c);
          const resolverDocEntry = (entry) => {
            if (docUsaArchivoOriginal(entry)) {
              return {
                ...entry,
                usarArchivoOriginal: true,
                contentBlocks: [],
                resolvedContent: ''
              };
            }
            const tpl = templateMap[entry.plantillaId];
            if (!tpl || !tpl.schema) return entry;
            const schema = tpl.schema;

            // Fuentes HTML del documento. IMPORTANTE: `bloques` y `elements`
            // contienen el MISMO contenido (ambos se derivan del mismo arreglo al
            // guardar la plantilla), por lo que solo se lee `elements` para no
            // duplicar. Los `elements` de lienzo se ordenan por posición (arriba
            // -> abajo, izquierda -> derecha) para un flujo de lectura natural.
            const elementsOrdenados = Array.isArray(schema.elements)
              ? [...schema.elements]
                .filter((e) => e && e.type !== 'image' && e.type !== 'shape')
                .sort((a, b) => (Number(a.y || 0) - Number(b.y || 0)) || (Number(a.x || 0) - Number(b.x || 0)))
              : [];

            const fuentes = [
              schema.documentHtml || '',
              ...elementsOrdenados.map((e) => {
                const html = e.contentHtml || e.content || '';
                if (!html) return '';
                const align = e.align && e.align !== 'left' ? `text-align:${e.align};` : '';
                const weight = e.bold ? 'font-weight:bold;' : '';
                return (align || weight) ? `<div style="${align}${weight}">${html}</div>` : html;
              })
            ].filter((h) => String(h || '').trim());

            // Dedupe por firma de texto plano: evita repetir contenido idéntico
            // que pudiera existir tanto en documentHtml como en elements.
            const vistos = new Set();
            const fuentesUnicas = fuentes.filter((html) => {
              const firma = resolveTemplateToPlainText(html, ctx).replace(/\s+/g, ' ').trim().toLowerCase();
              if (!firma || vistos.has(firma)) return false;
              vistos.add(firma);
              return true;
            });

            const resolvedHtml = fuentesUnicas.map((html) => resolveTemplateToHtml(html, ctx)).join('\n');
            const contentBlocks = parseDocumentHtmlToBlocks(resolvedHtml);
            const resolvedContent = fuentesUnicas
              .map((html) => resolveTemplateToPlainText(html, ctx))
              .filter(Boolean)
              .join('\n');
            return { ...entry, resolvedContent, contentBlocks };
          };
          return {
            ...c,
            recetasGeneradas: (c.recetasGeneradas || []).map(resolverDocEntry),
            documentosGenerados: (c.documentosGenerados || []).map(resolverDocEntry)
          };
        });

        const consultasConRaster = await rasterizarDocumentosEnConsultas(
          consultasConResuelto,
          docUsaArchivoOriginal
        );

        if (!cancelled) {
          setAntecedentes(ant);
          setPxInfo(pxInfoReciente);
          setConsultas(consultasConRaster);
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
      paciente={bulletproofSanitize(pxDoc)}
      antecedentes={bulletproofSanitize(antecedentes)}
      consultas={bulletproofSanitize(consultas)}
      pxInfo={bulletproofSanitize(pxInfo)}
      generadoPor={generadoPor}
      folio={folio}
    />
  ), [pxDoc, antecedentes, consultas, pxInfo, generadoPor, folio]);

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
          paciente={bulletproofSanitize(pxDoc)}
          antecedentes={bulletproofSanitize(antecedentes)}
          consultas={bulletproofSanitize(consultas)}
          pxInfo={bulletproofSanitize(pxInfo)}
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

  const edad = calcularEdad(pxDoc?.fechaNacimiento);
  const edadNumerica = Number(edad) || 0;
  const esMenor = edadNumerica > 0 && edadNumerica < 18;
  const esFemenino = String(pxDoc?.sexo || '').toLowerCase() === 'femenino';
  const heredo = formatHeredofamiliares(antecedentes.hereditarios || {});
  const noPat = antecedentes.no_patologicos || {};
  const pat = antecedentes.patologicos || {};
  const adicciones = formatAdicciones(pat.adicciones || {});
  const adiccionesNegado = adicciones ? /^NEGAD/i.test(String(adicciones).trim()) : false;
  const esp = pat.especificos || {};
  const especificosTexto = formatEspecificos(esp);
  const alergiasTexto = formatAlergias(antecedentes.alergias || {});
  const tieneAlergias = alergiasTexto !== 'Niega antecedentes alérgicos' && alergiasTexto !== 'Preguntadas y negadas';
  const pxGrupoSangre = (pxInfo.grupo_sanguineo || pxDoc?.grupoSanguineo || '');
  const pxRequiereQx = pxInfo.requiere_cirugia?.general || pxInfo.requiere_cirugia?.ginecologica;
  const pxEsEmbarazada = pxInfo.es_embarazada;
  const pxFum = pxInfo.fum || '';
  const pxSdg = pxInfo.sdg || '';
  const pxFpp = pxInfo.fpp || '';
  const tieneMetaClinica = pxGrupoSangre || pxRequiereQx || pxEsEmbarazada || pxFum;

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
              {nombre} · {edad ? `${edad} años` : '—'} · {pxDoc?.sexo || '—'}
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
              <p className="text-xs">Cargando expediente y documentos...</p>
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
                  <InfoChip label="Sexo" value={pxDoc?.sexo} />
                  <InfoChip icon={Droplet} label="Grupo sanguíneo" value={pxGrupoSangre} />
                  <InfoChip label="CURP" value={pxDoc?.curp} />
                  <InfoChip label="Estado civil" value={pxDoc?.estadoCivil} />
                  <InfoChip label="Fecha nac." value={safeDateStr(pxDoc?.fechaNacimiento)} />
                  <InfoChip icon={Globe} label="Lugar nac." value={pxDoc?.lugarNacimiento} />
                  <InfoChip icon={Phone} label="Teléfono móvil" value={pxDoc?.telefonoMovil} />
                  <InfoChip icon={Phone} label="Teléfono fijo" value={pxDoc?.telefonoFijo} />
                  <InfoChip icon={Mail} label="Correo" value={pxDoc?.email} />
                  <InfoChip icon={Briefcase} label="Ocupación" value={pxDoc?.ocupacion} />
                  <InfoChip icon={Church} label="Religión" value={pxDoc?.religion} />
                  <InfoChip label="Escolaridad" value={pxDoc?.escolaridad} />
                  <InfoChip label="Lengua" value={pxDoc?.lengua} />
                  <InfoChip label="Derechohabiencia" value={pxDoc?.derechohabiente} />
                  <InfoChip label="Aseguradora" value={pxDoc?.aseguradora} />
                  <InfoChip label="Empresa" value={pxDoc?.empresa} />
                  <InfoChip icon={Users} label="Responsable" value={pxDoc?.personaResponsable} />
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
                  <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                  <span>{direccionPaciente(pxDoc) || 'Sin domicilio registrado'}</span>
                </div>
                {[
                  pxDoc?.padecimientoHipertension && 'Hipertensión',
                  pxDoc?.padecimientoDiabetes && 'Diabetes',
                  pxDoc?.padecimientoObesidad && 'Obesidad',
                  pxDoc?.padecimientoArtritis && 'Artritis'
                ].filter(Boolean).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      pxDoc?.padecimientoHipertension && 'Hipertensión',
                      pxDoc?.padecimientoDiabetes && 'Diabetes',
                      pxDoc?.padecimientoObesidad && 'Obesidad',
                      pxDoc?.padecimientoArtritis && 'Artritis'
                    ].filter(Boolean).map((label) => (
                      <span key={label} className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {String(pxDoc?.notasPersonales || '').trim() && (
                  <div className="pt-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Notas personales</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{pxDoc.notasPersonales}</p>
                  </div>
                )}
              </div>

              {/* ── Indicadores clínicos (px_info) ──────── */}
              {tieneMetaClinica && (
                <div className="space-y-2 py-2.5 px-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <h4 className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Datos clínicos de la consulta</h4>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
                    {pxGrupoSangre && (
                      <span><span className="text-slate-400">Grupo:</span> <span className="font-semibold text-slate-700">{pxGrupoSangre}</span></span>
                    )}
                    {pxInfo.requiere_cirugia?.general && (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-px rounded border border-amber-200">
                        <Scissors size={10} /> Cirugía General
                      </span>
                    )}
                    {pxInfo.requiere_cirugia?.ginecologica && (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-px rounded border border-amber-200">
                        <Scissors size={10} /> Cirugía Ginecológica
                      </span>
                    )}
                    {pxEsEmbarazada && (
                      <span className="inline-flex items-center gap-1 text-pink-700 bg-pink-50 px-1.5 py-px rounded border border-pink-200">
                        <Baby size={10} /> Embarazada
                        {pxSdg && <span className="font-semibold">· {pxSdg} SDG</span>}
                        {pxFpp && <span>· FPP: {safeDateStr(pxFpp)}</span>}
                      </span>
                    )}
                    {pxFum && !pxEsEmbarazada && (
                      <span><span className="text-slate-400">FUM:</span> <span className="text-slate-700">{safeDateStr(pxFum)}</span></span>
                    )}
                  </div>
                </div>
              )}

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
                  {(antecedentes.hereditarios?.preguntados_y_negados) ? (
                    <p className="text-[10px] text-amber-600 italic">Interrogados y negados.</p>
                  ) : heredo.length ? (
                    heredo.map((h) => <Dato key={h.label} label={h.label} value={h.valor} />)
                  ) : (
                    <p className="text-[10px] text-slate-300 italic">Interrogados y negados.</p>
                  )}
                  {antecedentes.hereditarios?.otros && !antecedentes.hereditarios.preguntados_y_negados && (
                    <Dato label="Otros" value={antecedentes.hereditarios.otros} />
                  )}
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">No Patológicos</h4>
                  <Dato label="Alimentación" value={noPat.alimentacion} fallback="Sin particularidades" />
                  <Dato label="Higiene / baño" value={noPat.bano} fallback="Sin particularidades" />
                  <Dato label="Lavado dental" value={noPat.lavado_dientes} fallback="Sin particularidades" />
                  <Dato label="Habitación" value={noPat.habitacion} fallback="Sin particularidades" />
                  <Dato label="Sedentarismo" value={noPat.sedentarismo} fallback="Sin particularidades" />
                  <Dato label="Otros" value={noPat.otros} fallback="Sin particularidades" />
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Patológicos</h4>
                  <Dato label="Padecimientos" value={pat.actuales} negado={pat.actuales_negado} fallback="Niega antecedentes" />
                  <Dato label="Quirúrgicos" value={pat.quirurgicos} negado={pat.quirurgicos_negado} fallback="Niega antecedentes" />
                  <Dato label="Traumáticos" value={pat.traumaticos} negado={pat.traumaticos_negado} fallback="Niega antecedentes" />
                  <Dato label="Hospitalizaciones" value={pat.hospitalizaciones} negado={pat.hospitalizaciones_negado} fallback="Niega antecedentes" />
                  <Dato label="Transfusionales" value={pat.transfusionales} negado={pat.transfusionales_negado} fallback="Niega antecedentes" />
                  <Dato label="Adicciones" value={adiccionesNegado ? undefined : (adicciones || undefined)} negado={adiccionesNegado} fallback="Niega adicciones" />
                  <Dato label="Glaucoma" value={esp.glaucoma} negado={esp.glaucoma_negado} fallback="S/P" />
                  <Dato label="Cálculo biliar" value={esp.calculo} negado={esp.calculo_negado} fallback="S/P" />
                  <Dato label="Reflujo" value={esp.reflujo} negado={esp.reflujo_negado} fallback="S/P" />
                  <Dato label="Incontinencia" value={esp.incontinencia} negado={esp.incontinencia_negado} fallback="S/P" />
                  <Dato label="Dislipidemias" value={esp.dislipidemias} negado={esp.dislipidemias_negado} fallback="S/P" />
                  {esp.otro && <Dato label="Otro" value={esp.otro} negado={esp.otro_negado} />}
                </div>
              </div>

              {/* ── CIE-10 del paciente ─────────────────── */}
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Enfermedades CIE-10</h4>
                {antecedentes.cie10_preguntados_y_negados ? (
                  <p className="text-[10px] text-amber-600 italic">Interrogados y negados.</p>
                ) : antecedentes.cie10 && antecedentes.cie10.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {antecedentes.cie10.map((item, i) => (
                      <span key={i} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">
                        {item.code} — {item.description}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-300 italic">Interrogados y negados.</p>
                )}
              </div>

              {/* ── Datos de padres ─────────────────────── */}
              {esMenor && (
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Datos de los padres</h4>
                {antecedentes.padres?.preguntados_y_negados ? (
                  <p className="text-[10px] text-amber-600 italic">Interrogados y negados.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4">
                    <Dato label="Madre" value={antecedentes.padres?.madre_nombre} fallback="Desconocidos" />
                    <Dato label="Padre" value={antecedentes.padres?.padre_nombre} fallback="Desconocidos" />
                    <Dato label="Edad madre al embarazo" value={antecedentes.padres?.edad_madre_embarazo ? `${antecedentes.padres.edad_madre_embarazo} años` : undefined} fallback="Desconocidos" />
                    <Dato label="Embarazo No." value={antecedentes.padres?.numero_embarazo} fallback="Desconocidos" />
                    <Dato label="Semanas gestación" value={antecedentes.padres?.semanas_gestacion} fallback="Desconocidos" />
                  </div>
                )}
              </div>
              )}

              {/* ── Perinatales ──────────────────────────── */}
              {esMenor && (
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Antecedentes perinatales</h4>
                {(() => {
                  const per = antecedentes.perinatales || {};
                  if (per.preguntados_y_negados) return <p className="text-[10px] text-amber-600 italic">Interrogados y negados.</p>;
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
                      <Dato label="Anestesia" value={per.anestesia} fallback="Desconocidos" />
                      <Dato label="Sitio atención" value={per.sitio_atencion} fallback="Desconocidos" />
                      <Dato label="Curso normal" value={per.curso_normal === true ? 'Sí' : per.curso_normal === false ? 'No' : undefined} fallback="Desconocidos" />
                      <Dato label="Tipo nacimiento" value={per.tipo_nacimiento} fallback="Desconocidos" />
                      <Dato label="Duración parto" value={per.duracion_parto} fallback="Desconocidos" />
                      <Dato label="Peso bebé" value={per.peso ? `${per.peso} kg` : undefined} fallback="Desconocidos" />
                      <Dato label="Talla bebé" value={per.talla ? `${per.talla} cm` : undefined} fallback="Desconocidos" />
                      <Dato label="APGAR" value={per.apgar} fallback="Desconocidos" />
                      <Dato label="Silverman" value={per.silverman} fallback="Desconocidos" />
                      <Dato label="Tamiz metabólico" value={per.tamiz_metabolico} fallback="Desconocidos" />
                      <Dato label="Tamiz auditivo" value={per.tamiz_auditivo} fallback="Desconocidos" />
                      <Dato label="Reanimación" value={per.reanimacion} fallback="Sin datos de interés" />
                      <Dato label="Otros" value={per.otros} fallback="Sin particularidades" />
                    </div>
                  );
                })()}
              </div>
              )}

              {/* ── Psicomotor ───────────────────────────── */}
              {esMenor && (
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Desarrollo psicomotor</h4>
                {(() => {
                  const psi = antecedentes.psicomotor || {};
                  if (psi.preguntados_y_negados) return <p className="text-[10px] text-amber-600 italic">Interrogados y negados.</p>;
                  const hitos = [
                    { k: 'sostuvo_cabeza', l: 'Sostuvo cabeza' }, { k: 'rodamiento', l: 'Rodamiento' },
                    { k: 'sedestacion', l: 'Sedestación' }, { k: 'gateo', l: 'Gateó' },
                    { k: 'sonrio', l: 'Sonrió' }, { k: 'siguio_objetos', l: 'Siguió objetos' },
                    { k: 'bisilabos', l: 'Bisílabos' }, { k: 'lenguaje_fluido', l: 'Lenguaje fluido' },
                    { k: 'camino', l: 'Caminó' }, { k: 'correr', l: 'Correr' },
                    { k: 'bipedestacion', l: 'Bipedestación' }, { k: 'subir_escaleras', l: 'Subir escaleras' },
                    { k: 'control_esfinteres', l: 'Control esfínteres' }
                  ];
                  return (
                    <>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-2">
                        {hitos.map(h => (
                          <span key={h.k} className="text-[11px]">
                            <span className="text-slate-400">{h.l}:</span>{' '}
                            <span className={psi[h.k] ? 'font-semibold text-slate-700' : 'text-slate-300'}>{psi[h.k] ? `${psi[h.k]} ${['lenguaje_fluido'].includes(h.k) ? 'años' : 'meses'}` : 'Desconocido'}</span>
                          </span>
                        ))}
                      </div>
                      <Dato label="Desempeño escolar" value={psi.desempeno_escolar} fallback="Sin datos de interés" />
                      <Dato label="Otros hallazgos" value={psi.otros_psicomotor} fallback="Sin particularidades" />
                    </>
                  );
                })()}
              </div>
              )}

              {/* ── Gineco-obstétricos ───────────────────── */}
              {esFemenino && (
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Gineco-obstétricos</h4>
                {(() => {
                  const gin = antecedentes.gineco_obstetricos || {};
                  if (gin.preguntados_y_negados) return <p className="text-[10px] text-amber-600 italic">Interrogados y negados.</p>;

                  const metodos = gin.metodos_anticonceptivos || {};
                  const metodosLista = [];
                  if (metodos.implante) metodosLista.push('Implante');
                  if (metodos.mirena) metodosLista.push('Mirena');
                  if (metodos.kyleena) metodosLista.push('Kyleena');
                  if (metodos.diu_plata) metodosLista.push('DIU plata');
                  if (metodos.diu_cobre) metodosLista.push('DIU cobre');
                  const metodosTexto = metodosLista.length > 0 ? metodosLista.join(', ') : (gin.metodos_anticonceptivos_texto || '');

                  return (
                    <div>
                      {/* Sub-sección: Menstruación */}
                      <h5 className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mt-1 mb-2 border-b border-blue-50 pb-1">Menstruación</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 mb-3">
                        <Dato label="Menarca" value={gin.menarca ? `${gin.menarca} años` : undefined} fallback="No refiere" />
                        <Dato label="FUM" value={safeDateStr(gin.fum)} fallback="No refiere" />
                        <Dato label="Características" value={gin.caracteristicas_menstruacion} fallback="No refiere" />
                        <Dato label="IVSA" value={gin.ivsa ? `${gin.ivsa} años` : undefined} fallback="No refiere" />
                        <Dato label="Menopausia" value={gin.menopausia ? `${gin.menopausia} años` : undefined} fallback="No refiere" />
                        <Dato label="Otros menstruales" value={gin.menstruacion_otros} fallback="Sin particularidades" />
                      </div>

                      {/* Sub-sección: Embarazos */}
                      <h5 className="text-[10px] font-bold text-pink-600 uppercase tracking-wide mt-3 mb-2 border-b border-pink-50 pb-1">Historial de embarazos</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 mb-3">
                        <Dato label="Gestaciones" value={gin.gestas} fallback="S/A" />
                        <Dato label="Partos" value={gin.partos} fallback="S/A" />
                        <Dato label="Cesáreas" value={gin.cesareas} fallback="S/A" />
                        <Dato label="Abortos" value={gin.abortos} fallback="S/A" />
                        <Dato label="Nacidos vivos" value={gin.nacidos_vivos} fallback="S/A" />
                        <Dato label="Vivos actuales" value={gin.vivos_actuales} fallback="S/A" />
                        <Dato label="Otros embarazos" value={gin.embarazos_otros} fallback="Sin particularidades" />
                      </div>

                      {/* Sub-sección: Salud sexual */}
                      <h5 className="text-[10px] font-bold text-rose-600 uppercase tracking-wide mt-3 mb-2 border-b border-rose-50 pb-1">Salud sexual y estudios</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 mb-3">
                        <Dato label="Parejas sexuales" value={gin.parejas_sexuales} fallback="No refiere" />
                        <Dato label="Métodos anticonceptivos" value={metodosTexto} fallback="Niega antecedentes" />
                        <Dato label="VPH" value={gin.vph} fallback="S/P" />
                        <Dato label="Papanicolaou" value={gin.papanicolaou_check ? safeDateStr(gin.fecha_papanicolaou) : (gin.papanicolaou || undefined)} fallback="S/P" />
                        <Dato label="Colposcopia" value={gin.colposcopia_check ? safeDateStr(gin.fecha_colposcopia) : undefined} fallback="S/P" />
                        <Dato label="Mastografía" value={gin.mamografia_check ? safeDateStr(gin.fecha_mamografia) : (gin.mastografia || undefined)} fallback="S/P" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                        <Dato label="Procedimientos ginecológicos" value={gin.procedimientos_ginecologicos} fallback="Niega antecedentes" />
                        <Dato label="Hábitos" value={gin.habitos} fallback="No refiere" />
                        <Dato label="Flujos vaginales" value={gin.flujos_vaginales} fallback="No refiere" />
                        <Dato label="Otros ginecológicos" value={gin.otros_ginecologicos} fallback="Sin particularidades" />
                      </div>
                    </div>
                  );
                })()}
              </div>
              )}

              {/* ── Vacunas ───────────────────────────────── */}
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Vacunación
                  {antecedentes.vacunas?.completo_para_la_edad && <span className="ml-2 text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-px rounded">Completo para la edad</span>}
                </h4>
                {(() => {
                  const vac = antecedentes.vacunas || {};
                  const lista = vac.lista || [];
                  if (lista.length > 0) {
                    return (
                      <div className="space-y-1">
                        {lista.map((v, i) => (
                          <div key={i} className="flex items-baseline gap-2 text-[11px]">
                            <span className="font-semibold text-slate-700 min-w-[100px]">{v.nombre}</span>
                            <span className="text-slate-400">{v.fecha}</span>
                            {v.nota && <span className="text-slate-400">— {v.nota}</span>}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (vac.completo_para_la_edad) return <p className="text-[10px] text-emerald-600 italic">Esquema completo para la edad.</p>;
                  return <p className="text-[10px] text-slate-300 italic">Niega antecedentes de vacunación.</p>;
                })()}
              </div>

              {/* ── Cirugías ──────────────────────────────── */}
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Cirugías previas</h4>
                {(() => {
                  const cir = antecedentes.cirugias || {};
                  if (cir.preguntados_y_negados) return <p className="text-[10px] text-amber-600 italic">Interrogadas y negadas.</p>;
                  const lista = cir.lista || [];
                  if (lista.length === 0) return <p className="text-[10px] text-slate-300 italic">Niega antecedentes quirúrgicos.</p>;
                  return (
                    <div className="space-y-1.5">
                      {lista.map((c, i) => (
                        <div key={i} className="text-[11px] flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="font-semibold text-slate-700">{c.procedimiento || c.operacion}</span>
                          {c.operacion && c.procedimiento !== c.operacion && <span className="text-slate-400">{c.operacion}</span>}
                          {c.fecha && <span className="text-slate-400">{c.fecha}</span>}
                          {c.unidad && <span className="text-slate-400">· {c.unidad}</span>}
                          {c.nota && <span className="text-slate-500 italic">— {c.nota}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ── Aparatos y sistemas ───────────────────── */}
              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Interrogatorio por aparatos y sistemas</h4>
                {(() => {
                  const SISTEMAS = [
                    'Digestivo', 'Cardiovascular', 'Respiratorio', 'Urinario', 'Genital',
                    'Hematológico', 'Endocrino', 'Osteomuscular', 'Nervioso', 'Sensorial',
                    'Psicosomático', 'Otro'
                  ];
                  const ap = antecedentes.aparatos || {};
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                      {SISTEMAS.map(sistema => {
                        const key = sistema.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' ', '_');
                        return <Dato key={key} label={sistema} value={ap[key]} fallback="Sin datos de interés" />;
                      })}
                    </div>
                  );
                })()}
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
        paciente={pxDoc}
        generadoPor={generadoPor}
        folio={folio}
        onClose={() => { setShowShareModal(false); setSharePdfBlob(null); }}
      />
    )}
    </>
  );
};

export default ExpedienteElectronicoModal;
