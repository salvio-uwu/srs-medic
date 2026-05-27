// src/pages/doctor/expediente/SeccionResumen.jsx
import React, { useState, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { 
  History, Activity, Clock, FileText, Calendar, 
  Stethoscope, ChevronRight, X, Pill, TrendingUp, CheckCircle,
    Sparkles, Download, Printer, Upload, UploadCloud, AlertCircle
} from 'lucide-react';
import { db } from '../../../config/firebase'; 
import { functions, storage } from '../../../config/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../../context/AuthContext';
import { listLegacyLinksByPaciente } from '../../../services/patientLinkService';
import {
    calculateHomologationMetrics,
    listHomologatedSummariesByPaciente,
    parseLegacyHtmlClinicalData,
    upsertHomologatedLegacySummary
} from '../../../services/homologationService';

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine 
} from 'recharts';

// historialmedico/ fue eliminado — glob deshabilitado
const legacyHtmlModules = {};
const AUDIT_COLLECTION = 'auditoria_historial_migrado';

const SeccionResumen = ({
    expediente,
    updateCampo,
    pacienteId,
    historialRefreshKey = 0,
    eventosDocumentalesSesion = [],
    onNextStep,
    onImprimirReceta,
    onCargarConsultaHistorica
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // --- ESTADOS ---
  const [activeResumenTab, setActiveResumenTab] = useState('consulta_previa');
  const [historial, setHistorial] = useState([]);
    const [loading, setLoading] = useState(true);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [dragOverHistorial, setDragOverHistorial] = useState(false);
  const [uploadingDocumento, setUploadingDocumento] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ type: '', text: '' });
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  // --- ESTADOS IA ---
  const [analizando, setAnalizando] = useState(false);
  const [tendenciasIA, setTendenciasIA] = useState(null);
    const [homologando, setHomologando] = useState(false);
    const [homologationRows, setHomologationRows] = useState([]);
    const [homologationMetrics, setHomologationMetrics] = useState(null);
    const [homologationInsight, setHomologationInsight] = useState('');
    const [homologationMsg, setHomologationMsg] = useState({ type: '', text: '' });
    const [patientUniqueId, setPatientUniqueId] = useState('');

  // Estados para Gráficas
  const [datosGraficas, setDatosGraficas] = useState({
    pesoEdad: [],
    tallaEdad: [],
    imcEdad: [],
    pesoTalla: [],
    tensionArterial: []
  });

  // --- HELPER: Limpiar formato Markdown residual ---
  const limpiarTextoIA = (texto) => {
    if (!texto) return "";
    return texto
      .replace(/\*\*/g, "") // Elimina negritas (**)
      .replace(/\*/g, "")   // Elimina asteriscos sueltos
      .replace(/^Here is.*$/im, "") // Elimina introducciones en inglés si las hubiera
      .replace(/^Aquí tienes.*$/im, "") // Elimina introducciones en español
      .trim();
  };

  const calcularEdadEnFecha = (fechaNacimiento, fechaConsulta) => {
    if (!fechaNacimiento) return 0;
    const nac = new Date(fechaNacimiento);
    const visita = new Date(fechaConsulta);
    const diffTime = Math.abs(visita - nac);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
    return parseFloat(diffYears.toFixed(2));
  };

    const parseLegacyDate = (value) => {
        if (!value) return null;

        const asDate = new Date(value);
        if (!Number.isNaN(asDate.getTime())) return asDate;

        const match = String(value).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
        if (!match) return null;

        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const hour = Number(match[4] || 0);
        const minute = Number(match[5] || 0);

        const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const toNumberOrNull = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(String(value).replace(',', '.'));
        return Number.isFinite(numeric) ? numeric : null;
    };

    const buildLegacyGraphData = (rows = [], fechaNacimiento = '') => {
        const dataPeso = [];
        const dataTalla = [];
        const dataIMC = [];
        const dataPesoTalla = [];
        const dataTA = [];

        rows.forEach((row) => {
            const normalized = row?.normalized || {};
            const consultas = Array.isArray(normalized.consultas) && normalized.consultas.length
                ? normalized.consultas
                : [normalized];

            consultas.forEach((consulta) => {
                const fechaConsulta = parseLegacyDate(consulta.fechaConsulta || consulta.fechaConsultaRaw || normalized.fechaConsulta);
                if (!fechaConsulta || !fechaNacimiento) return;

                const edadAlMomento = calcularEdadEnFecha(fechaNacimiento, fechaConsulta);
                const fechaCorta = fechaConsulta.toLocaleDateString('es-MX');
                const talla = toNumberOrNull(consulta.talla ?? normalized.talla);
                const peso = toNumberOrNull(consulta.peso ?? normalized.peso);
                const imc = toNumberOrNull(consulta.imc ?? normalized.imc);

                if (peso !== null) dataPeso.push({ x: edadAlMomento, y: peso, fecha: fechaCorta, source: 'legacy' });
                if (talla !== null) dataTalla.push({ x: edadAlMomento, y: talla, fecha: fechaCorta, source: 'legacy' });
                if (imc !== null) dataIMC.push({ x: edadAlMomento, y: imc, fecha: fechaCorta, source: 'legacy' });
                if (peso !== null && talla !== null) dataPesoTalla.push({ x: talla, y: peso, fecha: fechaCorta, source: 'legacy' });

                const taRaw = String(consulta.ta || normalized.ta || '').trim();
                if (taRaw.includes('/')) {
                    const [sis, dias] = taRaw.split('/');
                    const sistolica = Number.parseInt(sis, 10);
                    const diastolica = Number.parseInt(dias, 10);
                    if (Number.isFinite(sistolica) && Number.isFinite(diastolica)) {
                        dataTA.push({ fecha: fechaCorta, sistolica, diastolica, source: 'legacy' });
                    }
                }
            });
        });

        return { dataPeso, dataTalla, dataIMC, dataPesoTalla, dataTA };
    };

    const abrirDocumentoLegacy = async (modulePath) => {
        const importer = legacyHtmlModules[modulePath];
        if (!importer) {
            setHomologationMsg({ type: 'warn', text: 'No encontré el archivo HTML en el paquete actual.' });
            return;
        }

        try {
            const url = await importer();
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error('No se pudo abrir el documento legacy', error);
            setHomologationMsg({ type: 'error', text: 'No se pudo abrir el documento legacy.' });
        }
    };

    const handleTimelineItemClick = async (item) => {
        if (item.kind === 'legacy') {
            if (item.modulePath) await abrirDocumentoLegacy(item.modulePath);
            return;
        }

        const selected = historial.find((row) => row.id === item.sourceId);
        if (selected) setConsultaSeleccionada(selected);
    };

  // --- CARGA DE DATOS ---
    useEffect(() => {
    let cancelled = false;

    const fetchHistorial = async () => {
        if (!pacienteId) {
            if (!cancelled) {
                setHistorial([]);
                setLoading(false);
            }
            return;
        }

        if (!cancelled) setLoading(true);
        try {
            const q = query(
                collection(db, "historial_clinico"),
                where("pacienteId", "==", pacienteId),
                orderBy("fecha", "asc") 
            );
            const snap = await getDocs(q);
            
            const docsList = [];

            snap.docs.forEach(d => {
                const data = d.data();
                const fechaObj = data.fecha?.toDate ? data.fecha.toDate() : new Date();
                
                docsList.push({
                    id: d.id,
                    ...data,
                    source: 'plataforma',
                    fechaOrden: fechaObj.getTime(),
                    fechaFormato: fechaObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
                    horaFormato: fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                });
            });

            if (!cancelled) {
                setHistorial([...docsList].reverse());
            }

        } catch (error) {
            console.error("Error cargando historial:", error);
            if (!cancelled) setHistorial([]);
        }

        if (!cancelled) setLoading(false);
    };

    fetchHistorial();

    return () => {
        cancelled = true;
    };
    }, [pacienteId, historialRefreshKey, localRefreshKey]);

    useEffect(() => {
        const dataPeso = [];
        const dataTalla = [];
        const dataIMC = [];
        const dataPesoTalla = [];
        const dataTA = [];

        const fechaNacimiento = expediente?.px_info?.fecha_nacimiento;

        if (fechaNacimiento) {
            historial.forEach((item) => {
                const fechaObj = item?.fecha?.toDate ? item.fecha.toDate() : new Date(item.fechaOrden || Date.now());
                if (Number.isNaN(fechaObj.getTime())) return;

                const vitales = item.consulta?.exploracion?.signos || {};
                const antropo = item.consulta?.exploracion?.antropometria || {};
                const edadAlMomento = calcularEdadEnFecha(fechaNacimiento, fechaObj);
                const fechaCorta = fechaObj.toLocaleDateString('es-MX');

                const peso = Number.parseFloat(antropo.peso);
                const talla = Number.parseFloat(antropo.talla);
                const imc = Number.parseFloat(antropo.imc);

                if (Number.isFinite(peso)) dataPeso.push({ x: edadAlMomento, y: peso, fecha: fechaCorta });
                if (Number.isFinite(talla)) dataTalla.push({ x: edadAlMomento, y: talla, fecha: fechaCorta });
                if (Number.isFinite(imc)) dataIMC.push({ x: edadAlMomento, y: imc, fecha: fechaCorta });
                if (Number.isFinite(peso) && Number.isFinite(talla)) dataPesoTalla.push({ x: talla, y: peso, fecha: fechaCorta });

                if (vitales.ta && vitales.ta.includes('/')) {
                    const [sis, dias] = vitales.ta.split('/');
                    const sistolica = Number.parseInt(sis, 10);
                    const diastolica = Number.parseInt(dias, 10);
                    if (Number.isFinite(sistolica) && Number.isFinite(diastolica)) {
                        dataTA.push({ fecha: fechaCorta, sistolica, diastolica });
                    }
                }
            });
        }

        const legacyGraph = buildLegacyGraphData(homologationRows, fechaNacimiento);

        setDatosGraficas({
            pesoEdad: [...dataPeso, ...legacyGraph.dataPeso],
            tallaEdad: [...dataTalla, ...legacyGraph.dataTalla],
            imcEdad: [...dataIMC, ...legacyGraph.dataIMC],
            pesoTalla: [...dataPesoTalla, ...legacyGraph.dataPesoTalla],
            tensionArterial: [...dataTA, ...legacyGraph.dataTA]
        });
    }, [historial, homologationRows, expediente?.px_info?.fecha_nacimiento]);

    useEffect(() => {
        let cancelled = false;

        const loadHomologationRows = async () => {
            if (!pacienteId) {
                setHomologationRows([]);
                setHomologationMetrics(calculateHomologationMetrics([]));
                return;
            }

            try {
                const pacienteSnap = await getDoc(doc(db, 'pacientes', pacienteId));
                const pacienteData = pacienteSnap.exists() ? pacienteSnap.data() || {} : {};
                const uniqueId = String(pacienteData.idPaciente || pacienteData.idPacienteMigrado || '').trim();

                const rows = await listHomologatedSummariesByPaciente(pacienteId);
                const filteredRows = uniqueId
                  ? rows.filter((row) => String(row?.normalized?.idPaciente || '').trim() === uniqueId)
                  : rows;

                if (!cancelled) {
                    setPatientUniqueId(uniqueId);
                    setHomologationRows(filteredRows);
                    setHomologationMetrics(calculateHomologationMetrics(filteredRows));
                }
            } catch (error) {
                console.error('Error cargando homologacion guardada', error);
                if (!cancelled) {
                    setPatientUniqueId('');
                    setHomologationRows([]);
                    setHomologationMetrics(calculateHomologationMetrics([]));
                }
            }
        };

        loadHomologationRows();
        return () => {
            cancelled = true;
        };
    }, [pacienteId]);

    const buildUnifiedTimeline = () => {
        const platformRows = historial.flatMap((item) => {
            const fechaOrden = Number(item.fechaOrden || 0);

            const tieneConsultaReal = Boolean(
                item.consulta?.diagnostico?.enfermedad_actual ||
                item.consulta?.padecimiento ||
                (item.consulta?.exploracion && Object.keys(item.consulta.exploracion).length > 0)
            );

            // Construir preview con jerarquía de fallbacks: padecimiento -> indicaciones
            // -> resumen del tratamiento -> exploración -> 'Sin descripción clínica'.
            // Esto evita el falso 'borrado' cuando el doctor no llenó padecimiento
            // pero sí otros campos clínicos (caso reportado por el doctor).
            const tratamientoLista = Array.isArray(item.consulta?.diagnostico?.tratamiento_lista)
                ? item.consulta.diagnostico.tratamiento_lista
                : [];
            const tratamientoResumen = tratamientoLista.length > 0
                ? `Tratamiento (${tratamientoLista.length}): ${tratamientoLista
                    .map((m) => m?.nombre || '')
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(', ')}${tratamientoLista.length > 3 ? '…' : ''}`
                : '';
            const exploracionResumen = (() => {
                const signos = item.consulta?.exploracion?.signos || {};
                const partes = [];
                if (signos.peso) partes.push(`Peso: ${signos.peso}`);
                if (signos.talla) partes.push(`Talla: ${signos.talla}`);
                if (signos.ta) partes.push(`T/A: ${signos.ta}`);
                if (signos.temp) partes.push(`Temp: ${signos.temp}`);
                if (signos.fc) partes.push(`FC: ${signos.fc}`);
                return partes.length > 0 ? partes.join(' • ') : '';
            })();
            const descripcionPreview = (item.consulta?.padecimiento || '').trim()
                || (item.consulta?.diagnostico?.indicaciones || '').trim()
                || (item.consulta?.diagnostico?.pronostico || '').trim()
                || tratamientoResumen
                || exploracionResumen
                || 'Sin descripción clínica';

            const baseRow = {
                id: `platform_${item.id}`,
                sourceId: item.id,
                kind: 'platform',
                fechaOrden,
                fechaFormato: item.fechaFormato,
                horaFormato: item.horaFormato,
                origen: 'plataforma',
                tipoNota: item.tipoNota || 'Consulta General',
                titulo: item.consulta?.diagnostico?.enfermedad_actual || item.tipoNota || 'Consulta',
                descripcion: descripcionPreview,
                confianza: 'alta',
                medicoNombre: item.medicoNombre || '',
                es_embarazada: item.px_info?.es_embarazada || false,
                sdg: item.px_info?.sdg || '',
                fpp: item.px_info?.fpp || '',
                fum: item.px_info?.fum || '',
                requiere_cirugia_general: item.px_info?.requiere_cirugia?.general || false,
                requiere_cirugia_ginecologica: item.px_info?.requiere_cirugia?.ginecologica || false
            };

            const recetasEventos = Array.isArray(item.recetasGeneradas) ? item.recetasGeneradas : [];
            const documentosEventos = Array.isArray(item.documentosGenerados) ? item.documentosGenerados : [];

            // Si hay nota clínica real, la consulta es el único evento del timeline.
            // Las recetas y documentos se muestran dentro del panel de detalle al abrirla,
            // evitando duplicados confusos para auditoría.
            if (tieneConsultaReal) {
                return [baseRow];
            }

            // Sin nota clínica: mostrar cada receta/documento como evento independiente
            // (ej. documentos subidos por enfermería sin consulta asociada).
            const recetaRows = recetasEventos.map((receta, idx) => ({
                id: `platform_receta_${item.id}_${idx}`,
                sourceId: item.id,
                kind: 'platform-receta',
                fechaOrden,
                fechaFormato: item.fechaFormato,
                horaFormato: item.horaFormato,
                origen: 'plataforma',
                tipoNota: 'Receta',
                titulo: receta?.nombre || 'Receta generada',
                descripcion: [
                    receta?.totalMedicamentos ? `${receta.totalMedicamentos} medicamentos` : '',
                    receta?.formato ? `Formato: ${receta.formato}` : ''
                ].filter(Boolean).join(' • ') || 'Receta guardada en historial clínico',
                confianza: 'alta',
                archivoUrl: receta?.archivoUrl || '',
                medicoNombre: item.medicoNombre || ''
            }));

            const documentoRows = documentosEventos.map((docEvent, idx) => ({
                id: `platform_doc_${item.id}_${idx}`,
                sourceId: item.id,
                kind: 'platform-document',
                fechaOrden,
                fechaFormato: item.fechaFormato,
                horaFormato: item.horaFormato,
                origen: 'plataforma',
                tipoNota: docEvent?.tipo === 'estudio' ? 'Estudio' : 'Documento',
                titulo: docEvent?.nombre || 'Documento generado',
                descripcion: [
                    docEvent?.formato ? `Formato: ${docEvent.formato}` : '',
                    docEvent?.enfermeroNombre ? `Cargado por: ${docEvent.enfermeroNombre}` : '',
                    docEvent?.origen ? `Desde: ${docEvent.origen === 'carga_enfermeria' ? 'Enfermería' : docEvent.origen}` : ''
                ].filter(Boolean).join(' • ') || 'Documento guardado en historial clínico',
                confianza: 'alta',
                archivoUrl: docEvent?.archivoUrl || '',
                medicoNombre: item.medicoNombre || docEvent?.enfermeroNombre || ''
            }));

            return [...recetaRows, ...documentoRows];
        });

                const legacyRows = homologationRows.flatMap((row) => {
            const normalized = row.normalized || {};
                        const consultas = Array.isArray(normalized.consultas) && normalized.consultas.length
                            ? normalized.consultas
                            : [normalized];

                        return consultas.map((consulta, idx) => {
                            const fechaRaw = consulta.fechaConsultaRaw || consulta.fechaConsulta || normalized.fechaConsulta || normalized.fechaNacimiento || '';
                            const parsedDate = parseLegacyDate(fechaRaw);
                            const fallbackDate = typeof row.updatedAt?.toDate === 'function' ? row.updatedAt.toDate() : null;
                            const fechaOrden = parsedDate
                                ? parsedDate.getTime()
                                : (fallbackDate ? fallbackDate.getTime() : 0);

                            return {
                                    id: `legacy_${row.id}_${idx}`,
                                    kind: 'legacy',
                                    modulePath: row.modulePath,
                                    sourceFile: row.fileName,
                                    fechaOrden,
                                    fechaFormato: parsedDate
                                        ? parsedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : (fechaRaw || (fallbackDate ? fallbackDate.toLocaleDateString('es-MX') : 'Sin fecha')),
                                    horaFormato: parsedDate
                                        ? parsedDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                        : '',
                                    origen: 'legacy',
                                    titulo: consulta.diagnostico || consulta.padecimiento || normalized.diagnostico || normalized.padecimiento || row.fileName || 'Registro migrado',
                                    descripcion: consulta.tratamiento || consulta.indicaciones || normalized.tratamiento || normalized.alergias || row.aiSummary || 'Sin detalle clínico',
                                    confianza: row.aiConfidence || 'media'
                            };
                        });
        });

        // --- Documentos de la sesión actual (aún no guardados en Firestore) ---
        const sesionRows = eventosDocumentalesSesion.map((evt, idx) => {
            const generadoDate = evt.generadoAt ? new Date(evt.generadoAt) : new Date();
            return {
                id: `sesion_${evt.id || idx}`,
                kind: evt.tipo === 'receta' ? 'platform-receta' : 'platform-document',
                fechaOrden: generadoDate.getTime(),
                fechaFormato: generadoDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
                horaFormato: generadoDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
                origen: 'sesion_actual',
                tipoNota: evt.tipo === 'receta' ? 'Receta' : 'Documento',
                titulo: evt.nombre || (evt.tipo === 'receta' ? 'Receta generada' : 'Documento generado'),
                descripcion: [
                    evt.formato ? `Formato: ${evt.formato}` : '',
                    'Consulta en curso'
                ].filter(Boolean).join(' • '),
                confianza: 'alta',
                archivoUrl: evt.archivoUrl || ''
            };
        });

        return [...sesionRows, ...platformRows, ...legacyRows].sort((a, b) => b.fechaOrden - a.fechaOrden);
    };

    const ejecutarHomologacionIA = async () => {
        if (!pacienteId) return;

        setHomologando(true);
                setHomologationMsg({ type: '', text: '' });
        try {
                                                const uniqueId = String(patientUniqueId || '').trim();
                                                if (!uniqueId) {
                                                        setHomologationMsg({ type: 'warn', text: 'Este paciente no tiene ID único migrado (idPaciente). No puedo homologar con seguridad.' });
                                                        setHomologando(false);
                                                        return;
                                                }

                                                let links = await listLegacyLinksByPaciente(pacienteId);
                                                links = links.filter((row) => {
                                                    const legacyId = String(row.legacyPatientId || '').trim();
                                                    return legacyId ? legacyId === uniqueId : true;
                                                });

                                                if (!links.length) {
                                                    const auditSnap = await getDocs(
                                                        query(collection(db, AUDIT_COLLECTION), where('patientId', '==', uniqueId))
                                                    );

                                                    links = auditSnap.docs
                                                        .map((docSnap) => {
                                                            const data = docSnap.data() || {};
                                                            return {
                                                                id: `audit_${docSnap.id}`,
                                                                modulePath: data.modulePath || '',
                                                                fileName: data.fileName || data.modulePath?.split('/').pop() || 'sin_nombre.html',
                                                                legacyPatientId: data.patientId || null,
                                                                confidence: 'alta'
                                                            };
                                                        })
                                                        .filter((row) => !!row.modulePath);
                                                }

                        if (!links.length) {
                                setHomologationMsg({
                                    type: 'warn',
                                                                        text: `No encontré documentos vinculados con ID único ${uniqueId}.`
                                });
                                setHomologando(false);
                                return;
                        }

            const extracts = [];

            for (const link of links) {
                const importer = legacyHtmlModules[link.modulePath];
                if (!importer) continue;

                try {
                    const url = await importer();
                    const response = await fetch(url);
                    const htmlText = await response.text();
                    const parsed = parseLegacyHtmlClinicalData(htmlText, link.fileName);
                    if (!parsed) continue;
                    if (String(parsed.idPaciente || '').trim() !== uniqueId) continue;

                    extracts.push({ modulePath: link.modulePath, fileName: link.fileName, parsed });
                } catch (error) {
                    console.warn('No se pudo procesar html legacy', link.modulePath, error);
                }
            }

            if (!extracts.length) {
                                setHomologationMsg({
                                    type: 'warn',
                                    text: 'Se detectaron archivos, pero no pude extraer datos clínicos útiles de esos documentos.'
                                });
                setHomologando(false);
                return;
            }

            let iaInsight = '';
            try {
                const prompt = `
                    Actúa como auditor clínico y de migración.
                    Resume riesgos de calidad y patrones clínicos detectados en registros legacy normalizados.
                    Responde en texto plano, máximo 8 líneas, sin markdown.

                    Datos:
                    ${JSON.stringify(extracts.map((row) => row.parsed).slice(0, 15))}
                `;

                const askGemini = httpsCallable(functions, 'askGemini');
                const response = await askGemini({ prompt });
                iaInsight = limpiarTextoIA(response?.data?.result || '');
            } catch (error) {
                console.error('Error generando insight de homologación IA', error);
            }

            await Promise.all(
                extracts.map((row) =>
                    upsertHomologatedLegacySummary({
                        pacienteId,
                        modulePath: row.modulePath,
                        fileName: row.fileName,
                        normalized: row.parsed,
                        aiSummary: iaInsight,
                        aiConfidence: 'media',
                        source: 'legacy_html_ia'
                    })
                )
            );

            const updatedRows = await listHomologatedSummariesByPaciente(pacienteId);
            const strictRows = updatedRows.filter((row) => String(row?.normalized?.idPaciente || '').trim() === uniqueId);
            setHomologationRows(strictRows);
            setHomologationMetrics(calculateHomologationMetrics(strictRows));
            setHomologationInsight(iaInsight);
            setHomologationMsg({ type: 'ok', text: `Homologación completada con ID ${uniqueId}. Registros procesados: ${strictRows.length}.` });
        } catch (error) {
            console.error('Error en homologación IA', error);
            setHomologationMsg({ type: 'error', text: 'Error ejecutando homologación IA. Revisa consola para más detalle.' });
        }

        setHomologando(false);
    };

  // ==========================================
  // FUNCIONES INTELIGENCIA ARTIFICIAL (CORREGIDAS)
  // ==========================================

  // 2. Análisis de Tendencias
  const analizarTendencias = async () => {
    if (datosGraficas.pesoEdad.length < 2) return alert("Se necesitan más datos para analizar tendencias.");
    setAnalizando(true);
    try {
        const dataParaIA = {
            peso: datosGraficas.pesoEdad.map(d => ({ fecha: d.fecha, valor: d.y })),
            imc: datosGraficas.imcEdad.map(d => ({ fecha: d.fecha, valor: d.y })),
            tension: datosGraficas.tensionArterial
        };

        // PROMPT AJUSTADO: Lista técnica directa
        const prompt = `
          Analiza estos datos biométricos de un paciente:
          ${JSON.stringify(dataParaIA)}

          Genera una lista de hallazgos clínicos relevantes.

          INSTRUCCIONES ESTRICTAS:
          1. NO uses asteriscos (**) ni formato Markdown.
          2. NO uses frases como "Aquí están los hallazgos" o "Basado en los datos".
          3. Usa guiones simples (-) para listar.
          4. Sé extremadamente directo y técnico. Ejemplo: "- Descenso ponderal de 3kg en el último mes."
          5. Si detectas valores biológicamente improbables (ej. peso 22kg y luego 89kg en días), señálalo como "Error de captura probable" o "Dato inconsistente".
        `;

        const askGemini = httpsCallable(functions, 'askGemini');
        const response = await askGemini({ prompt });
        const rawText = response?.data?.result || '';
        setTendenciasIA(limpiarTextoIA(rawText));

    } catch (e) { console.error(e); }
    setAnalizando(false);
  };

    const procesarDocumentoParaPaciente = async (file) => {
        if (!pacienteId || !file) return;
        setUploadingDocumento(true);
        setUploadMsg({ type: '', text: '' });

        try {
            const timestamp = Date.now();
            const safeName = file.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `expedientes/${pacienteId}/documentos/${timestamp}_${safeName}`;
            const storageRefItem = ref(storage, storagePath);

            await uploadBytes(storageRefItem, file, {
                customMetadata: {
                    tipo: 'estudio',
                    nombre: file.name,
                    generadoAt: new Date().toISOString(),
                    origen: 'carga_expediente'
                }
            });

            const downloadURL = await getDownloadURL(storageRefItem);
            const ext = file.name.split('.').pop()?.toLowerCase() || 'archivo';

            const eventoDocumental = {
                tipo: 'estudio',
                nombre: file.name,
                formato: ext,
                origen: 'carga_expediente',
                archivoUrl: downloadURL,
                archivoPath: storagePath,
                generadoAt: new Date().toISOString(),
                medicoNombre: user?.nombre || 'Médico'
            };

            await addDoc(collection(db, 'historial_clinico'), {
                pacienteId,
                pacienteNombre: expediente?.px_info?.nombre || '',
                medicoNombre: user?.nombre || 'Médico',
                fecha: serverTimestamp(),
                medicoId: user?.uid || 'anonimo',
                tipoNota: 'Carga de Documento',
                documentosGenerados: [eventoDocumental],
                origenRegistro: 'expediente_medico',
                subidoPor: user?.nombre || 'Médico',
                subidoPorRol: user?.rol || 'medico'
            });

            setUploadMsg({ type: 'success', text: 'Documento cargado correctamente al expediente.' });
            setLocalRefreshKey(k => k + 1);
            setTimeout(() => setUploadMsg({ type: '', text: '' }), 4000);
        } catch (e) {
            console.error('Error al cargar documento:', e);
            setUploadMsg({ type: 'error', text: 'Error al cargar el documento. Intenta de nuevo.' });
            setTimeout(() => setUploadMsg({ type: '', text: '' }), 5000);
        }

        setUploadingDocumento(false);
    };

    const handleDropOnHistorial = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverHistorial(false);
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        procesarDocumentoParaPaciente(file);
    };

    const handleDragOverHistorial = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragOverHistorial) setDragOverHistorial(true);
    };

    const handleDragLeaveHistorial = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverHistorial(false);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileInputChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        procesarDocumentoParaPaciente(file);
    };

    const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full w-full flex flex-col overflow-hidden";
    const unifiedTimeline = buildUnifiedTimeline();

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200 relative">
      
      {/* TABS SUPERIORES */}
            <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-4 overflow-x-auto w-full items-center">
                <button onClick={() => setActiveResumenTab('consulta_previa')} className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeResumenTab === 'consulta_previa' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-blue-700'}`}>
            <History size={16} /> LÍNEA DE TIEMPO
        </button>
                <button onClick={() => setActiveResumenTab('graficas')} className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeResumenTab === 'graficas' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-blue-700'}`}>
            <TrendingUp size={16} /> GRÁFICAS EVOLUTIVAS
        </button>
                {onNextStep && (
                  <button 
                    onClick={onNextStep}
                    className="group ml-auto flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white rounded-full font-bold text-xs shadow-md shadow-violet-600/25 transition-all active:scale-[0.97] shrink-0"
                  >
                    Historial
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
      </div>

      {/* ÁREA DE TRABAJO */}
            <div className="flex-1 p-6 overflow-hidden bg-slate-50/30 w-full flex flex-col">
        
        {/* --- VISTA 1: HISTORIAL --- */}
        {activeResumenTab === 'consulta_previa' && (
          <div className="flex h-full w-full gap-6">
            
            <div className="flex-[3] flex flex-col h-full">
                <div 
                    className={`${sectionClass} relative transition-all duration-200 ${dragOverHistorial ? 'border-2 border-teal-500 shadow-lg shadow-teal-500/20 bg-teal-50/50' : ''}`}
                    onDragOver={handleDragOverHistorial}
                    onDragLeave={handleDragLeaveHistorial}
                    onDrop={handleDropOnHistorial}
                >
                    {/* ... (Resto del código del timeline se mantiene igual) ... */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileInputChange}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.dcm"
                    />

                    {dragOverHistorial && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-teal-50/90 rounded-2xl pointer-events-none">
                            <div className="text-center">
                                <UploadCloud size={48} className="text-teal-500 mx-auto mb-2" />
                                <p className="text-teal-700 font-bold text-lg">Suelta el documento aquí</p>
                                <p className="text-teal-500 text-sm mt-1">Se agregará al historial clínico</p>
                            </div>
                        </div>
                    )}

                    {uploadingDocumento && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 rounded-2xl">
                            <div className="text-center">
                                <Upload size={32} className="text-teal-500 mx-auto mb-2 animate-bounce" />
                                <p className="text-teal-700 font-bold text-sm">Subiendo documento...</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><History size={20}/></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg leading-none">Historial Clínico</h3>
                                <p className="text-xs text-slate-400 mt-1">Consultas, recetas y documentos generados</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleUploadClick}
                                disabled={uploadingDocumento}
                                className="bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-teal-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                title="Subir documento al historial del paciente"
                            >
                                <Upload size={13} />
                                {uploadingDocumento ? 'Subiendo...' : 'Subir doc'}
                            </button>
                            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total eventos:</span>
                                 <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-md shadow-blue-200">
                                    {unifiedTimeline.length}
                                 </span>
                            </div>
                        </div>
                    </div>

                    {uploadMsg.text && (
                        <div className={`mb-3 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                            uploadMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {uploadMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {uploadMsg.text}
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative">
                        {unifiedTimeline.length > 0 && <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2"><Clock className="animate-spin" size={24}/><span className="text-xs font-bold">Cargando historia...</span></div>
                        ) : unifiedTimeline.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200"><p className="text-sm font-medium">No hay registros previos</p></div>
                        ) : (
                            <div className="space-y-6 relative z-10 pl-2 py-2">
                                {unifiedTimeline.map((item, idx) => (
                                    <div key={item.id} className="flex gap-4 group">
                                        <div className={`w-9 h-9 rounded-full border-4 border-white shadow-sm flex items-center justify-center shrink-0 z-10 transition-colors ${idx === 0 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}><Calendar size={14} /></div>
                                                                                <div
                                                                                    onClick={() => handleTimelineItemClick(item)}
                                                                                    className={`flex-1 bg-white border border-slate-100 p-4 rounded-xl shadow-sm transition-all ${(item.kind === 'platform' || item.kind === 'legacy') ? 'hover:shadow-md hover:border-blue-300 cursor-pointer' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${item.origen === 'sesion_actual' ? 'text-violet-700 bg-violet-100 animate-pulse' : item.origen === 'legacy' ? 'text-amber-700 bg-amber-100' : item.kind === 'platform-document' ? 'text-indigo-700 bg-indigo-100' : item.kind === 'platform-receta' ? 'text-emerald-700 bg-emerald-100' : 'text-blue-600 bg-blue-50'}`}>
                                                    {item.origen === 'sesion_actual' ? `${item.tipoNota} • Sesión actual` : item.origen === 'legacy' ? 'Legacy' : (item.tipoNota || 'Consulta General')}
                                                  </span>
                                                  <h4 className="text-sm font-bold text-slate-800 mt-1">{item.fechaFormato || 'Sin fecha'} <span className="text-slate-400 font-normal text-xs">{item.horaFormato ? `• ${item.horaFormato}` : ''}</span></h4>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100"><Stethoscope size={12} className="text-slate-400"/><span className="text-[10px] font-bold text-slate-600 uppercase">{item.origen === 'legacy' ? 'Migrado' : (item.medicoNombre ? item.medicoNombre.split(' ')[0] : 'Dr.')}</span></div>
                                            </div>
                                            <div className="space-y-2">
                                                {item.titulo && <div className="flex gap-2 items-start"><Activity size={14} className="text-emerald-500 mt-0.5 shrink-0"/><p className="text-xs text-slate-600 font-medium line-clamp-1"><span className="font-bold text-slate-700">Dx:</span> {item.titulo}</p></div>}
                                                {item.descripcion && <div className="flex gap-2 items-start"><FileText size={14} className="text-slate-400 mt-0.5 shrink-0"/><p className="text-xs text-slate-500 line-clamp-1 italic">"{item.descripcion}"</p></div>}
                                                {(item.es_embarazada || item.requiere_cirugia_general || item.requiere_cirugia_ginecologica) && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {item.es_embarazada && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-50 text-pink-700 border border-pink-200">
                                                                🤰 {item.sdg ? item.sdg : 'Embarazada'}
                                                            </span>
                                                        )}
                                                        {item.es_embarazada && item.fpp && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-600 border border-pink-100">
                                                                FPP: {item.fpp}
                                                            </span>
                                                        )}
                                                        {item.requiere_cirugia_general && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                                                ✂️ Qx General
                                                            </span>
                                                        )}
                                                        {item.requiere_cirugia_ginecologica && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                                                ✂️ Qx Ginecológica
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                                                                {item.kind === 'legacy' && item.modulePath && (
                                                                                                    <button
                                                                                                        onClick={(event) => {
                                                                                                            event.stopPropagation();
                                                                                                            abrirDocumentoLegacy(item.modulePath);
                                                                                                        }}
                                                                                                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                                                                                                    >
                                                                                                        Abrir documento legacy
                                                                                                    </button>
                                                                                                )}
                                                                                                {(item.kind === 'platform-receta' || item.kind === 'platform-document') && item.archivoUrl && (
                                                                                                    <a
                                                                                                        href={item.archivoUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        onClick={(event) => event.stopPropagation()}
                                                                                                        className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${item.kind === 'platform-receta' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                                                                                                    >
                                                                                                        <Download size={12} /> Ver documento PDF
                                                                                                    </a>
                                                                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PANEL DERECHO: NOTAS PERSONALES */}
            <div className="flex-1 flex flex-col h-full">
                <div className={sectionClass}>
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl"><FileText size={20}/></div>
                        <div><h3 className="font-bold text-slate-800 text-lg leading-none">Notas personales</h3><p className="text-xs text-slate-400 mt-1">Privadas y confidenciales</p></div>
                    </div>
                    <textarea 
                        className="flex-1 w-full p-5 bg-white border-2 border-teal-500/20 rounded-2xl outline-none text-slate-700 text-sm resize-none focus:border-teal-500 transition-all leading-relaxed shadow-sm placeholder:italic placeholder:text-slate-300"
                        placeholder="Escribe recordatorios médicos aquí..."
                        value={expediente.resumen.notas_previas}
                        onChange={(e) => updateCampo('resumen.notas_previas', e.target.value)}
                    />
                </div>
            </div>
          </div>
        )}

        {/* --- VISTA 2: GRÁFICAS --- */}
        {activeResumenTab === 'graficas' && (
          <div className="h-full w-full overflow-y-auto custom-scrollbar pr-2">

                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            {[
                                { label: 'Legacy detectados', value: homologationMetrics?.totalLegacy || 0 },
                                { label: 'Homologados', value: homologationMetrics?.homologados || 0 },
                                { label: 'Completitud', value: `${homologationMetrics?.completitudPromedio || 0}%` },
                                { label: 'Score calidad', value: homologationMetrics?.scoreCalidad || 0 }
                            ].map((kpi) => (
                                <div key={kpi.label} className="bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm inline-flex items-center gap-2">
                                    <p className="text-[10px] uppercase tracking-wide font-black text-slate-500">{kpi.label}</p>
                                    <p className="text-sm font-black text-slate-900">{kpi.value}</p>
                                </div>
                            ))}
                            <button onClick={ejecutarHomologacionIA} disabled={homologando} className="bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700 inline-flex items-center gap-1.5">
                                {homologando ? <Sparkles size={12} className="animate-spin" /> : <Sparkles size={12} />} Homologar legacy
                            </button>
                        </div>

                        {homologationInsight && (
                            <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl p-3">
                                <p className="text-[10px] uppercase tracking-wide font-black text-blue-700 mb-1">Insight IA de homologación</p>
                                <p className="text-xs text-blue-900 font-medium whitespace-pre-line">{homologationInsight}</p>
                            </div>
                        )}
            
            {/* --- PANEL DE INSIGHTS IA (HALLAZGOS TÉCNICOS) --- */}
            <div className="mb-6 bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-center">
                    <h5 className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-2">
                        <TrendingUp size={14} className="text-blue-500"/> Análisis de Tendencias
                    </h5>
                    <button title="Detectar hallazgos con IA" onClick={analizarTendencias} disabled={analizando} className="bg-blue-50 text-blue-700 border border-blue-100 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-2">
                        {analizando ? <Sparkles className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                        {analizando ? "Analizando datos..." : "Detectar Hallazgos"}
                    </button>
                </div>
                
                {tendenciasIA && (
                    <div className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div style={{ whiteSpace: 'pre-line' }}>{tendenciasIA}</div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                {/* 1. GRÁFICA PESO */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Peso vs Edad</h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.pesoEdad}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="x" type="number" label={{ value: 'Edad (Años)', position: 'insideBottom', offset: -5 }} domain={['auto', 'auto']} tickCount={5}/>
                                <YAxis label={{ value: 'Peso (Kg)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']}/>
                                <Tooltip formatter={(val) => `${val} kg`} labelFormatter={(val) => `${val} años`}/>
                                <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Peso"/>
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. GRÁFICA TALLA */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Talla vs Edad</h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.tallaEdad}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="x" type="number" label={{ value: 'Edad (Años)', position: 'insideBottom', offset: -5 }} domain={['auto', 'auto']}/>
                                <YAxis label={{ value: 'Talla (m/cm)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']}/>
                                <Tooltip formatter={(val) => `${val}`} labelFormatter={(val) => `${val} años`}/>
                                <Line type="monotone" dataKey="y" stroke="#10b981" strokeWidth={3} dot={{r: 4}} name="Talla"/>
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. GRÁFICA IMC */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span> IMC vs Edad</h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.imcEdad}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="x" type="number" label={{ value: 'Edad', position: 'insideBottom', offset: -5 }}/>
                                <YAxis domain={[10, 40]}/>
                                <Tooltip />
                                <Line type="monotone" dataKey="y" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4}} name="IMC"/>
                                <ReferenceLine y={25} label="Sobrepeso" stroke="orange" strokeDasharray="3 3" />
                                <ReferenceLine y={30} label="Obesidad" stroke="red" strokeDasharray="3 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. PESO/TALLA */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Peso para la Talla</h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis type="number" dataKey="x" name="Talla" unit="" label={{ value: 'Talla', position: 'insideBottom', offset: -5 }}/>
                                <YAxis type="number" dataKey="y" name="Peso" unit="kg" label={{ value: 'Peso', angle: -90, position: 'insideLeft' }}/>
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter name="Px" data={datosGraficas.pesoTalla} fill="#f97316" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 5. TENSIÓN ARTERIAL */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col lg:col-span-2">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Evolución Tensión Arterial</h4>
                    <div className="flex-1 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={datosGraficas.tensionArterial}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                                <XAxis dataKey="fecha" />
                                <YAxis domain={[40, 180]}/>
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="sistolica" stroke="#ef4444" name="Sistólica" strokeWidth={2} />
                                <Line type="monotone" dataKey="diastolica" stroke="#3b82f6" name="Diastólica" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
          </div>
        )}


      </div>

      {/* --- MODAL DETALLE CONSULTA --- */}
            {consultaSeleccionada && (() => {
                const cs = consultaSeleccionada;
                const signos = cs.consulta?.exploracion?.signos || {};
                const antropo = cs.consulta?.exploracion?.antropometria || {};
                const fisica = cs.consulta?.exploracion?.fisica || {};
                const diag = cs.consulta?.diagnostico || {};
                const estudios = cs.consulta?.estudios || {};
                const procedimientos = cs.consulta?.procedimientos || {};
                const antecedentes = cs.antecedentes || {};
                const vitalesGrid = [
                    {l:'Peso', v: antropo.peso || signos.peso, u:'kg'},
                    {l:'Talla', v: antropo.talla || signos.talla, u:'m'},
                    {l:'IMC', v: antropo.imc || signos.imc, u:''},
                    {l:'Temp', v: signos.temp, u:'°C'},
                    {l:'T/A', v: signos.ta, u:''},
                    {l:'F.C.', v: signos.fc, u:'lpm'},
                    {l:'F.R.', v: signos.fr, u:'rpm'},
                    {l:'SpO2', v: signos.spo2, u:'%'},
                ];
                const tieneExploracionFisica = Object.values(fisica).some(v => v);
                const tieneEstudios = (estudios.estudios_seleccionados?.length > 0) || (estudios.paquetes_seleccionados?.length > 0) || estudios.notas_generales;
                const tieneProcedimientos = (procedimientos.seleccionados?.length > 0) || procedimientos.notas_generales;
                const tieneAlergias = antecedentes.alergias?.lista?.length > 0 || antecedentes.alergias?.otros || antecedentes.alergias?.preguntados_y_negados;
                const tieneCie10 = Array.isArray(diag.cie10) && diag.cie10.length > 0;
                const tieneColesterol = cs.consulta?.exploracion?.colesterol && Object.values(cs.consulta.exploracion.colesterol).some(v => v);
                const tieneGlucosa = cs.consulta?.exploracion?.glucosa?.lista?.length > 0;

                return (
                <div className="absolute inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[92%] rounded-2xl shadow-lg flex flex-col overflow-hidden">
                <div className="px-8 py-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{cs.tipoNota || 'Consulta General'}</h2>
                        <p className="text-sm text-slate-500 font-medium mt-1 flex items-center gap-2"><Calendar size={14}/> {cs.fechaFormato} <span className="w-1 h-1 bg-slate-300 rounded-full"></span> <Clock size={14}/> {cs.horaFormato}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {onCargarConsultaHistorica && (
                            <button
                                onClick={() => {
                                    onCargarConsultaHistorica(cs);
                                    setConsultaSeleccionada(null);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                                title="Carga esta consulta en el expediente actual sin generar una nueva visita"
                            >
                                <CheckCircle size={14}/> Cargar consulta
                            </button>
                        )}
                        {onImprimirReceta && diag.tratamiento_lista?.length > 0 && (
                            <button
                                onClick={() => {
                                    onImprimirReceta(cs);
                                    setConsultaSeleccionada(null);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                                title="Imprime la receta médica con los datos de esta consulta"
                            >
                                <Printer size={14}/> Imprimir receta
                            </button>
                        )}

                        <button onClick={() => setConsultaSeleccionada(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500 shadow-sm border border-transparent hover:border-slate-200"><X size={24}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">

                    {/* Meta: Costo y Duración */}
                    {(cs.costo || cs.duracionRealMin) && (
                        <div className="flex gap-4">
                            {cs.costo > 0 && (
                                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 text-sm">
                                    <span className="font-bold text-green-700">Costo:</span> <span className="text-green-800 font-black">${(Number.isFinite(Number(cs.costo)) ? Number(cs.costo) : 0).toLocaleString('es-MX')}</span>
                                </div>
                            )}
                            {cs.duracionRealMin > 0 && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-sm">
                                    <span className="font-bold text-blue-700">Duración:</span> <span className="text-blue-800 font-black">{cs.duracionRealMin} min</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Estado Obstétrico y QX - solo si hay datos */}
                    {(cs.px_info?.es_embarazada || cs.px_info?.fum || cs.px_info?.requiere_cirugia?.general || cs.px_info?.requiere_cirugia?.ginecologica) && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span>🤰</span> Estado Obstétrico y Quirúrgico
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {cs.px_info?.es_embarazada && (
                                    <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
                                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-2">Embarazo activo en esta consulta</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-pink-400 uppercase">FUM</p>
                                                <p className="text-xs font-bold text-pink-800">{cs.px_info.fum || '--'}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-pink-400 uppercase">SDG</p>
                                                <p className="text-xs font-bold text-pink-800">{cs.px_info.sdg || '--'}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-pink-400 uppercase">FPP</p>
                                                <p className="text-xs font-bold text-pink-800">{cs.px_info.fpp || '--'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {(cs.px_info?.requiere_cirugia?.general || cs.px_info?.requiere_cirugia?.ginecologica) && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Requerimientos quirúrgicos</p>
                                        <div className="space-y-1">
                                            {cs.px_info.requiere_cirugia.general && <p className="text-xs font-bold text-amber-800">✂️ Cirugía General</p>}
                                            {cs.px_info.requiere_cirugia.ginecologica && <p className="text-xs font-bold text-amber-800">✂️ Cirugía Ginecológica</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Control de embarazo (complicaciones) si está disponible */}
                            {cs.px_info?.es_embarazada && cs.control_embarazo && (
                                (() => {
                                    const ce = cs.control_embarazo;
                                    const comps = ce.complicaciones || {};
                                    const compActivas = Object.entries(comps)
                                        .filter(([, v]) => v === 'Sí')
                                        .map(([k]) => k.replace(/_/g, ' '));
                                    return (
                                        <div className="mt-3 bg-white border border-pink-100 rounded-xl p-4">
                                            <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-2">Control de embarazo</p>
                                            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                                                {ce.num_embarazo && <span className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5">Embarazo #{ce.num_embarazo}</span>}
                                                {ce.num_bebes && <span className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5">{ce.num_bebes} bebé(s)</span>}
                                                {ce.riesgo && ce.riesgo !== 'No aplica' && <span className="bg-rose-50 border border-rose-200 rounded px-2 py-0.5 text-rose-700 font-bold">Alto riesgo: {ce.riesgo}</span>}
                                                {ce.acido_folico && ce.acido_folico !== 'No aplica' && <span className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5">Ácido fólico: {ce.acido_folico}</span>}
                                            </div>
                                            {compActivas.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-[9px] font-black text-rose-500 uppercase mb-1">Complicaciones reportadas</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {compActivas.map((c) => (
                                                            <span key={c} className="bg-rose-50 border border-rose-200 rounded px-2 py-0.5 text-[10px] font-bold text-rose-700 capitalize">{c}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    )}

                    {/* Signos Vitales - Grid completo */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Signos Vitales</h4>
                        <div className="grid grid-cols-4 gap-3">
                            {vitalesGrid.map((s, i) => (
                                <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.l}</p>
                                    <p className="text-lg font-black text-slate-700">{s.v || '--'} <span className="text-[10px] font-normal text-slate-400">{s.u}</span></p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Colesterol / Lab */}
                    {tieneColesterol && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Laboratorios</h4>
                            <div className="grid grid-cols-3 gap-3">
                                {[{l:'Triglicéridos', v: cs.consulta.exploracion.colesterol.trigliceridos}, {l:'Colesterol', v: cs.consulta.exploracion.colesterol.colesterol}, {l:'HbA1c', v: cs.consulta.exploracion.colesterol.hba1c}].map((s, i) => s.v ? (
                                    <div key={i} className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-center">
                                        <p className="text-[10px] font-black text-purple-400 uppercase mb-1">{s.l}</p>
                                        <p className="text-lg font-black text-purple-700">{s.v}</p>
                                    </div>
                                ) : null)}
                            </div>
                        </div>
                    )}

                    {/* Glucosa */}
                    {tieneGlucosa && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Glucosa</h4>
                            <div className="flex flex-wrap gap-2">
                                {cs.consulta.exploracion.glucosa.lista.map((item, idx) => (
                                    <div key={idx} className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm">
                                        <span className="font-bold text-orange-700">{item.valor || item}</span>
                                        {item.momento && <span className="text-orange-500 ml-1 text-xs">({item.momento})</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Padecimiento */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Padecimiento</h4>
                        {cs.consulta?.padecimiento ? (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{cs.consulta.padecimiento}</div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-500 italic">
                                No se registró texto en el campo padecimiento. Los demás datos clínicos de la consulta (diagnóstico, exploración, tratamiento, etc.) se conservan abajo.
                            </div>
                        )}
                    </div>

                    {/* Exploración Física */}
                    {tieneExploracionFisica && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity size={14}/> Exploración Física</h4>
                            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(fisica).map(([key, val]) => val ? (
                                    <div key={key} className="text-sm">
                                        <span className="font-bold text-slate-700 capitalize">{key}:</span> <span className="text-slate-600">{val}</span>
                                    </div>
                                ) : null)}
                            </div>
                        </div>
                    )}

                    {/* Diagnóstico + CIE-10 */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Stethoscope size={14}/> Diagnóstico</h4>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-sm font-bold text-emerald-800">{diag.enfermedad_actual || 'Sin diagnóstico'}</div>
                        {tieneCie10 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {diag.cie10.map((item, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-200">
                                        {item.codigo && <span className="font-black">{item.codigo}</span>}
                                        {item.descripcion && <span>- {item.descripcion}</span>}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pronóstico */}
                    {diag.pronostico && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Pronóstico</h4>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 whitespace-pre-line">{diag.pronostico}</div>
                        </div>
                    )}

                    {/* Indicaciones Generales */}
                    {diag.indicaciones && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Indicaciones Generales</h4>
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 leading-relaxed whitespace-pre-line">{diag.indicaciones}</div>
                        </div>
                    )}

                    {/* Receta / Medicamentos */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Pill size={14}/> Receta</h4>
                        {diag.tratamiento_lista?.length > 0 ? (
                            <div className="space-y-2">
                                {diag.tratamiento_lista.map((med, idx) => (
                                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-slate-700 text-sm">{idx + 1}. {med.nombre}</span>
                                            {med.presentacion && <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{med.presentacion}</span>}
                                        </div>
                                        {med.dosis && <p className="text-xs text-slate-500 mt-1 font-medium">{med.dosis}</p>}
                                        {(med.sustanciasActivas || med.numeroAcomodo) && <p className="text-[10px] text-slate-400 mt-0.5">{[med.sustanciasActivas, med.numeroAcomodo].filter(Boolean).join(' · ')}</p>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Sin medicamentos</p>
                        )}
                    </div>

                    {/* Estudios */}
                    {tieneEstudios && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Estudios</h4>
                            <div className="space-y-2">
                                {estudios.paquetes_seleccionados?.length > 0 && (
                                    <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg text-sm text-teal-800">
                                        <span className="font-bold">Paquetes:</span> {estudios.paquetes_seleccionados.join(', ')}
                                    </div>
                                )}
                                {estudios.estudios_seleccionados?.map((est, idx) => {
                                    const nombre = typeof est === 'string' ? est : (est?.nombre || '');
                                    const nota = typeof est === 'object' ? (est?.nota || '') : '';
                                    return nombre ? (
                                        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg text-sm">
                                            <span className="font-bold text-slate-700">{nombre}</span>
                                            {nota && <span className="text-slate-400 ml-2">({nota})</span>}
                                        </div>
                                    ) : null;
                                })}
                                {estudios.notas_generales && <p className="text-xs text-slate-500 italic mt-1">Notas: {estudios.notas_generales}</p>}
                            </div>
                        </div>
                    )}

                    {/* Procedimientos */}
                    {tieneProcedimientos && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity size={14}/> Procedimientos</h4>
                            <div className="space-y-2">
                                {procedimientos.seleccionados?.map((proc, idx) => {
                                    const nombre = typeof proc === 'object' ? (proc?.nombre || proc?.procedimiento || proc?.descripcion || 'Procedimiento') : String(proc || '');
                                    const nota = typeof proc === 'object' ? (proc?.nota || '') : '';
                                    return (
                                        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg text-sm">
                                            <span className="font-bold text-slate-700">{nombre}</span>
                                            {nota && <p className="text-xs text-slate-400 mt-1">{nota}</p>}
                                        </div>
                                    );
                                })}
                                {procedimientos.notas_generales && <p className="text-xs text-slate-500 italic mt-1">Notas: {procedimientos.notas_generales}</p>}
                            </div>
                        </div>
                    )}

                    {/* Alergias */}
                    {tieneAlergias && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Alergias</h4>
                            {antecedentes.alergias.preguntados_y_negados ? (
                                <p className="text-sm text-slate-500 italic">Preguntados y negados</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {antecedentes.alergias.lista?.map((a, idx) => (
                                        <span key={idx} className="bg-red-50 text-red-700 text-xs font-bold px-3 py-1 rounded-lg border border-red-200">{a.sustancia || a.nombre || a}</span>
                                    ))}
                                    {antecedentes.alergias.otros && <span className="text-xs text-slate-500">Otros: {antecedentes.alergias.otros}</span>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recetas generadas */}
                    {Array.isArray(cs.recetasGeneradas) && cs.recetasGeneradas.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Pill size={14}/> Recetas expedidas</h4>
                            <div className="space-y-2">
                                {cs.recetasGeneradas.map((item, idx) => (
                                    <div key={`receta_generada_${idx}`} className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-900 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold">{item?.nombre || 'Receta generada'}</p>
                                            <p className="mt-1">{[item?.formato ? `Formato: ${item.formato}` : '', item?.totalMedicamentos ? `${item.totalMedicamentos} medicamentos` : ''].filter(Boolean).join(' • ')}</p>
                                        </div>
                                        {item?.archivoUrl && <a href={item.archivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold"><Download size={12}/> PDF</a>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Documentos generados */}
                    {Array.isArray(cs.documentosGenerados) && cs.documentosGenerados.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Documentos generados</h4>
                            <div className="space-y-2">
                                {cs.documentosGenerados.map((item, idx) => (
                                    <div key={`doc_generado_${idx}`} className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold">{item?.nombre || 'Documento generado'}</p>
                                            <p className="mt-1">{[item?.formato ? `Formato: ${item.formato}` : '', item?.origen ? `Origen: ${item.origen}` : ''].filter(Boolean).join(' • ')}</p>
                                        </div>
                                        {item?.archivoUrl && <a href={item.archivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-bold"><Download size={12}/> PDF</a>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                </div>
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-400 uppercase">Atendido por: <span className="text-slate-600">{cs.medicoNombre || 'Desconocido'}</span></p>
                    {cs.citaId && <p className="text-[10px] text-slate-300 font-mono">Cita: {cs.citaId}</p>}
                </div>
            </div>
        </div>
                );
      })()}

    </div>
  );
};

export default SeccionResumen;