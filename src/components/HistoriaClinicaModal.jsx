import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  ClipboardList,
  ChevronRight,
  User,
  Droplet,
  MapPin,
  Download,
  Eye,
  FileText,
  Loader2,
  Microscope,
  ImageIcon
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import DocumentoHistoriaPDF from './pdf/DocumentoHistoriaPDF';
import { uploadDocumentoPDF } from '../services/documentStorageService';

const HistoriaClinicaModal = ({ onClose, onBackToMenu, paciente, historial, doctor, expedienteActual, pacienteId, onDocumentGenerated }) => {
  const [activeTab, setActiveTab] = useState('antecedentes');
  const [busqueda, setBusqueda] = useState('');
  const [activePanel, setActivePanel] = useState('historia');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSignature, setPreviewSignature] = useState('');
  const previewUrlRef = useRef('');

  const historialFiltrado = useMemo(() => {
    if (!Array.isArray(historial)) return [];

    return historial.filter((row) => {
      const fecha = String(row?.fecha || '');
      const motivo = String(row?.motivo || '').toLowerCase();
      const q = busqueda.toLowerCase();
      return fecha.includes(busqueda) || motivo.includes(q);
    });
  }, [historial, busqueda]);

  const consultaActiva = useMemo(() => {
    if (!Array.isArray(historial)) return null;
    return historial.find((row) => row.id === activeTab) || null;
  }, [historial, activeTab]);

  const pdfDocument = useMemo(
    () => (
      <DocumentoHistoriaPDF
        paciente={paciente}
        historial={historial}
        doctor={doctor}
        expedienteActual={expedienteActual}
      />
    ),
    [paciente, historial, doctor, expedienteActual]
  );

  const docSignature = useMemo(
    () =>
      JSON.stringify({
        pacienteNombre: paciente?.nombre || '',
        pacienteSexo: paciente?.sexo || '',
        doctorNombre: doctor?.nombre || '',
        doctorCedula: doctor?.cedulaProfesional || doctor?.cedula || '',
        expedienteId: expedienteActual?.px_info?.id_receta || '',
        expedienteEdad: expedienteActual?.px_info?.edad || '',
        expedienteGrupo: expedienteActual?.px_info?.grupo_sanguineo || '',
        expedienteNacimiento: expedienteActual?.px_info?.fecha_nacimiento || '',
        antecedentesPatologicos: expedienteActual?.antecedentes?.patologicos?.actuales || '',
        alergias:
          Array.isArray(expedienteActual?.antecedentes?.alergias?.lista)
            ? expedienteActual.antecedentes.alergias.lista.map((a) => a?.sustancia || '').join('|')
            : '',
        historial: Array.isArray(historial)
          ? historial.map((c) => ({
              id: c?.id || '',
              fecha: c?.fecha || '',
              motivo: c?.motivo || '',
              padecimiento: c?.padecimiento || '',
              diagnostico: c?.diagnostico || '',
              indicaciones: c?.indicaciones || '',
              signos: c?.signos || {},
              receta: c?.receta || []
            }))
          : []
      }),
    [paciente, doctor, expedienteActual, historial]
  );

  useEffect(() => {
    let cancelled = false;

    const buildPreview = async () => {
      if (activePanel !== 'documento') return;
      if (previewUrl && previewSignature === docSignature) return;

      setPreviewLoading(!previewUrl);

      try {
        const blob = await pdf(pdfDocument).toBlob();
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        setPreviewSignature(docSignature);
      } catch (error) {
        console.error('Error creando previsualizacion PDF', error);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    buildPreview();

    return () => {
      cancelled = true;
    };
  }, [activePanel, pdfDocument, docSignature, previewSignature, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
    };
  }, []);

  const downloadPreview = async () => {
    try {
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Historia_Clinica_${(paciente?.nombre || 'Paciente').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      // Subir al expediente del paciente
      let archivoUrl = '';
      let archivoPath = '';
      if (pacienteId) {
        try {
          const result = await uploadDocumentoPDF({
            pacienteId,
            pdfBlob: blob,
            nombre: 'Historia Clinica',
            tipo: 'documento'
          });
          archivoUrl = result.url;
          archivoPath = result.storagePath;
        } catch (uploadErr) {
          console.warn('No se pudo subir Historia Clinica al expediente:', uploadErr);
        }
      }

      onDocumentGenerated?.({
        tipo: 'documento',
        nombre: 'Historia Clinica',
        formato: 'pdf_determinista',
        origen: 'historia_clinica',
        archivoUrl,
        archivoPath
      });
    } catch (error) {
      console.error('Error descargando PDF', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white w-full max-w-7xl h-[92vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25">
              <ClipboardList size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Expediente Clinico</h2>
              <p className="text-xs text-slate-500 font-semibold">{paciente?.nombre || 'Paciente'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBackToMenu && (
              <button
                onClick={onBackToMenu}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 text-[11px] font-bold uppercase tracking-wide transition-colors"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                Regresar al menu
              </button>
            )}
            <button
              onClick={() => setActivePanel('historia')}
              className={`px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${
                activePanel === 'historia'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              Historia
            </button>
            <button
              onClick={() => setActivePanel('documento')}
              className={`px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors inline-flex items-center gap-1.5 ${
                activePanel === 'documento'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              <Eye size={14} /> Documento
            </button>
            <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
                  placeholder="Buscar por fecha o motivo"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 space-y-2 overflow-y-auto">
              <button
                onClick={() => setActiveTab('antecedentes')}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  activeTab === 'antecedentes'
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <User size={15} />
                  <span className="text-xs font-bold uppercase tracking-wide">Ficha General</span>
                </div>
              </button>

              {historialFiltrado.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setActiveTab(row.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    activeTab === row.id
                      ? row.origen === 'estudio_previo' ? 'border-teal-300 bg-teal-50' : 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                      {row.origen === 'estudio_previo' && <Microscope size={12} className="text-teal-500" />}
                      {row.fecha}
                    </p>
                    {activeTab === row.id && <ChevronRight size={14} className="text-blue-600" />}
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate mt-1">{row.origen === 'estudio_previo' ? (row.estudiosPrevios?.join(', ') || row.motivo) : (row.motivo || 'Consulta')}</p>
                  {row.origen === 'estudio_previo' ? (
                    <p className="text-[10px] font-semibold text-teal-600 mt-1">Estudio previo</p>
                  ) : (
                    <p className="text-[10px] font-semibold text-slate-500 mt-1">
                      {row.origen !== 'estudio_previo' && row.medicoNombre ? row.medicoNombre : ''}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 min-h-0 bg-slate-50/50 p-5">
            {activePanel === 'historia' ? (
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 overflow-y-auto">
                {activeTab === 'antecedentes' ? (
                  <div className="max-w-4xl mx-auto">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Resumen del paciente</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Base clinica para auditoria y continuidad</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Edad</p>
                        <p className="text-sm font-black text-slate-800 mt-1">{expedienteActual?.px_info?.edad || '--'}</p>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Sexo</p>
                        <p className="text-sm font-black text-slate-800 mt-1">{paciente?.sexo || '--'}</p>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Grupo Sanguineo</p>
                        <p className="text-sm font-black text-slate-800 mt-1 inline-flex items-center gap-1.5">
                          <Droplet size={13} className="text-rose-500" />
                          {expedienteActual?.px_info?.grupo_sanguineo || '---'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Procedencia</p>
                        <p className="text-sm font-black text-slate-800 mt-1 inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-500" />
                          {paciente?.municipioEstado || 'Sin dato'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          {consultaActiva?.origen === 'estudio_previo' && <Microscope size={20} className="text-teal-500" />}
                          {consultaActiva?.motivo || 'Consulta medica'}
                        </h3>
                        <p className="text-xs font-semibold text-blue-700 mt-1">{consultaActiva?.fecha || '--/--/----'}</p>
                        {consultaActiva?.origen === 'estudio_previo' && consultaActiva?.medicoNombre && (
                          <p className="text-xs text-slate-500 mt-0.5">Registrado por: {consultaActiva.medicoNombre}</p>
                        )}
                      </div>
                    </div>

                    {consultaActiva?.origen === 'estudio_previo' && (
                      <div className="mt-6 space-y-4">
                        {consultaActiva?.estudiosPrevios?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-2">Estudios</h4>
                            <div className="flex flex-wrap gap-2">
                              {consultaActiva.estudiosPrevios.map((est, i) => (
                                <span key={i} className="bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full text-xs font-bold border border-teal-100">
                                  {est}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {consultaActiva?.clasificacion && consultaActiva.clasificacion !== 'GENERAL' && (
                          <div>
                            <h4 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-1">Clasificación</h4>
                            <p className="text-sm font-semibold text-slate-700 bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-200">
                              {consultaActiva.clasificacion}
                            </p>
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-2">Interpretación</h4>
                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium whitespace-pre-wrap">
                            {consultaActiva?.interpretacion || 'Sin interpretación registrada'}
                          </div>
                        </div>

                        {consultaActiva?.adjuntos?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-teal-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                              <ImageIcon size={14} /> Adjuntos ({consultaActiva.adjuntos.length})
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                              {consultaActiva.adjuntos.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block p-3 rounded-xl border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-200 transition-colors"
                                >
                                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    {url.includes('.pdf') ? <FileText size={14} className="text-red-400" /> : <ImageIcon size={14} className="text-teal-400" />}
                                    <span className="truncate">Abrir adjunto {i + 1}</span>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 flex flex-col">
                <div className="flex justify-between items-center mb-3 gap-2">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 inline-flex items-center gap-2">
                      <FileText size={16} /> Documento Profesional
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Vista estable sin parpadeo</p>
                  </div>

                  <button
                    onClick={downloadPreview}
                    disabled={!previewUrl || previewLoading}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2 hover:bg-black disabled:opacity-60"
                  >
                    <Download size={14} /> Descargar PDF
                  </button>
                </div>

                <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  {previewLoading ? (
                    <div className="h-full w-full flex items-center justify-center gap-2 text-slate-500 text-sm font-semibold">
                      <Loader2 className="animate-spin" size={18} /> Generando previsualizacion...
                    </div>
                  ) : previewUrl ? (
                    <iframe title="Vista previa documento clinico" src={previewUrl} className="w-full h-full" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                      No se pudo generar la vista previa.
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default HistoriaClinicaModal;
