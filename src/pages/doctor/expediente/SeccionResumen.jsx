// src/pages/doctor/expediente/SeccionResumen.jsx
import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { 
  History, Activity, Clock, FileText, Calendar, 
  Stethoscope, ChevronRight, X, Pill, TrendingUp, CheckCircle,
  Sparkles, Brain 
} from 'lucide-react';
import { db } from '../../../config/firebase'; 
import { functions } from '../../../config/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
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

const legacyHtmlModules = import.meta.glob('../../../../historialmedico/*.html', {
    query: '?url',
    import: 'default'
});
const AUDIT_COLLECTION = 'auditoria_historial_migrado';

const SeccionResumen = ({ expediente, updateCampo, pacienteId }) => {
  // --- ESTADOS ---
  const [activeResumenTab, setActiveResumenTab] = useState('consulta_previa');
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);

  // --- ESTADOS IA ---
  const [analizando, setAnalizando] = useState(false);
  const [resumenIA, setResumenIA] = useState(null);
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
    const fetchHistorial = async () => {
        if (!pacienteId) return;
        setLoading(true);
        try {
            const q = query(
                collection(db, "historial_clinico"),
                where("pacienteId", "==", pacienteId),
                orderBy("fecha", "asc") 
            );
            const snap = await getDocs(q);
            
            const docsList = [];
            const dataPeso = [];
            const dataTalla = [];
            const dataIMC = [];
            const dataPesoTalla = [];
            const dataTA = [];

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

                const vitales = data.consulta?.exploracion?.signos || {};
                const antropo = data.consulta?.exploracion?.antropometria || {};
                
                if (expediente?.px_info?.fecha_nacimiento) {
                    const edadAlMomento = calcularEdadEnFecha(expediente.px_info.fecha_nacimiento, fechaObj);
                    const fechaCorta = fechaObj.toLocaleDateString('es-MX');

                    if (antropo.peso) dataPeso.push({ x: edadAlMomento, y: parseFloat(antropo.peso), fecha: fechaCorta });
                    if (antropo.talla) dataTalla.push({ x: edadAlMomento, y: parseFloat(antropo.talla), fecha: fechaCorta });
                    if (antropo.imc) dataIMC.push({ x: edadAlMomento, y: parseFloat(antropo.imc), fecha: fechaCorta });
                    if (antropo.peso && antropo.talla) dataPesoTalla.push({ x: parseFloat(antropo.talla), y: parseFloat(antropo.peso), fecha: fechaCorta });
                    
                    if (vitales.ta && vitales.ta.includes('/')) {
                        const [sis, dias] = vitales.ta.split('/');
                        dataTA.push({ fecha: fechaCorta, sistolica: parseInt(sis), diastolica: parseInt(dias) });
                    }
                }
            });

            setHistorial([...docsList].reverse());

            const legacyGraph = buildLegacyGraphData(homologationRows, expediente?.px_info?.fecha_nacimiento);
            
            setDatosGraficas({
                pesoEdad: [...dataPeso, ...legacyGraph.dataPeso],
                tallaEdad: [...dataTalla, ...legacyGraph.dataTalla],
                imcEdad: [...dataIMC, ...legacyGraph.dataIMC],
                pesoTalla: [...dataPesoTalla, ...legacyGraph.dataPesoTalla],
                tensionArterial: [...dataTA, ...legacyGraph.dataTA]
            });

        } catch (error) {
            console.error("Error cargando historial:", error);
        }
        setLoading(false);
    };

    fetchHistorial();
    }, [pacienteId, expediente?.px_info?.fecha_nacimiento, homologationRows]);

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
        const platformRows = historial.map((item) => ({
            id: `platform_${item.id}`,
            sourceId: item.id,
            kind: 'platform',
            fechaOrden: Number(item.fechaOrden || 0),
            fechaFormato: item.fechaFormato,
            origen: 'plataforma',
            titulo: item.consulta?.diagnostico?.enfermedad_actual || item.tipoNota || 'Consulta',
            descripcion: item.consulta?.padecimiento || 'Sin descripción clínica',
            confianza: 'alta'
        }));

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

        return [...platformRows, ...legacyRows].sort((a, b) => b.fechaOrden - a.fechaOrden);
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

  // 1. Resumen Evolutivo
  const generarResumenClinico = async () => {
    if (historial.length === 0) return alert("No hay historial suficiente.");
    setAnalizando(true);
    try {
      const contexto = historial.slice(0, 10).map(c => ({
        fecha: c.fechaFormato,
        motivo: c.consulta?.padecimiento,
        diagnostico: c.consulta?.diagnostico?.enfermedad_actual,
        tratamiento: c.consulta?.diagnostico?.tratamiento_lista?.map(t => t.nombre).join(', ')
      }));

      // PROMPT AJUSTADO: Cero formato chat, tono clínico puro.
      const prompt = `
        Actúa como un médico especialista redactando una nota de evolución clínica formal.
        
        Datos del historial cronológico:
        ${JSON.stringify(contexto)}

        INSTRUCCIONES ESTRICTAS:
        1. NO uses saludos, ni introducciones, ni despedidas.
        2. NO uses asteriscos (**), ni negritas, ni formato Markdown. Solo texto plano.
        3. NO uses etiquetas como "Resumen:" o "Conclusión:".
        4. Redacta en un solo párrafo cohesivo o dos breves.
        5. Usa lenguaje médico técnico, impersonal y directo.
        
        Objetivo de la nota: Sintetizar la evolución del paciente, adherencia terapéutica y recurrencia de patologías.
      `;

      const askGemini = httpsCallable(functions, 'askGemini');
      const response = await askGemini({ prompt });
      const rawText = response?.data?.result || '';
      setResumenIA(limpiarTextoIA(rawText));

    } catch (e) { console.error(e); alert("Error al conectar con IA"); }
    setAnalizando(false);
  };

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

    const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full w-full flex flex-col overflow-hidden";
    const unifiedTimeline = buildUnifiedTimeline();

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200 relative">
      
      {/* TABS SUPERIORES */}
            <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-4 overflow-x-auto w-full">
                <button onClick={() => setActiveResumenTab('consulta_previa')} className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeResumenTab === 'consulta_previa' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-blue-700'}`}>
            <History size={16} /> LÍNEA DE TIEMPO
        </button>
                <button onClick={() => setActiveResumenTab('graficas')} className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 shrink-0 ${activeResumenTab === 'graficas' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-blue-700'}`}>
            <TrendingUp size={16} /> GRÁFICAS EVOLUTIVAS
        </button>
      </div>

      {/* ÁREA DE TRABAJO */}
      <div className="flex-1 p-6 overflow-hidden bg-slate-50/30 w-full flex flex-col">
        
        {/* --- VISTA 1: HISTORIAL --- */}
        {activeResumenTab === 'consulta_previa' && (
          <div className="flex h-full w-full gap-6">
            
            <div className="flex-[3] flex flex-col h-full">
                {/* --- BLOQUE IA (RESUMEN CLÍNICO) --- */}
                <div className="mb-4 bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-3 shadow-sm">
                    <div className="flex justify-between items-start">
                        <h5 className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-2">
                            <Brain size={14} className="text-indigo-500"/> Análisis Evolutivo
                        </h5>
                        <div className="flex items-center gap-2">
                            <button title="Generar resumen clínico con IA" onClick={generarResumenClinico} disabled={analizando} className="bg-blue-50 text-blue-700 border border-blue-100 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-2">
                                {analizando ? <Sparkles className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                                {analizando ? "Procesando..." : "Generar Nota de Resumen"}
                            </button>
                            <button title="Homologar documentos migrados por ID único" onClick={ejecutarHomologacionIA} disabled={homologando} className="bg-white text-slate-700 border border-slate-200 px-4 py-1.5 rounded-lg text-xs font-semibold hover:border-blue-200 hover:text-blue-700 transition-colors flex items-center gap-2">
                                {homologando ? <Sparkles className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                                {homologando ? 'Homologando...' : 'Homologar legacy'}
                            </button>
                        </div>
                    </div>

                    {homologationMsg.text && (
                      <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        homologationMsg.type === 'ok'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : homologationMsg.type === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {homologationMsg.text}
                      </div>
                    )}
                    
                    {resumenIA ? (
                        <div className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {/* Renderizamos texto limpio */}
                            {resumenIA}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic pl-1">
                            Solicita un análisis para ver un resumen clínico profesional de la evolución del paciente.
                        </p>
                    )}
                </div>

                <div className={sectionClass}>
                    {/* ... (Resto del código del timeline se mantiene igual) ... */}
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><History size={20}/></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg leading-none">Historial de Consultas</h3>
                                <p className="text-xs text-slate-400 mt-1">Clic en una tarjeta para ver detalles</p>
                            </div>
                        </div>
                        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Visitas:</span>
                             <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-md shadow-blue-200">
                                {unifiedTimeline.length}
                             </span>
                        </div>
                    </div>
                    
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
                                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${item.origen === 'legacy' ? 'text-amber-700 bg-amber-100' : 'text-blue-600 bg-blue-50'}`}>
                                                    {item.origen === 'legacy' ? 'Legacy' : (item.tipoNota || 'Consulta General')}
                                                  </span>
                                                  <h4 className="text-sm font-bold text-slate-800 mt-1">{item.fechaFormato || 'Sin fecha'} <span className="text-slate-400 font-normal text-xs">{item.horaFormato ? `• ${item.horaFormato}` : ''}</span></h4>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100"><Stethoscope size={12} className="text-slate-400"/><span className="text-[10px] font-bold text-slate-600 uppercase">{item.origen === 'legacy' ? 'Migrado' : (item.medicoNombre ? item.medicoNombre.split(' ')[0] : 'Dr.')}</span></div>
                                            </div>
                                            <div className="space-y-2">
                                                {item.titulo && <div className="flex gap-2 items-start"><Activity size={14} className="text-emerald-500 mt-0.5 shrink-0"/><p className="text-xs text-slate-600 font-medium line-clamp-1"><span className="font-bold text-slate-700">Dx:</span> {item.titulo}</p></div>}
                                                {item.descripcion && <div className="flex gap-2 items-start"><FileText size={14} className="text-slate-400 mt-0.5 shrink-0"/><p className="text-xs text-slate-500 line-clamp-1 italic">"{item.descripcion}"</p></div>}
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
            {consultaSeleccionada && (
                <div className="absolute inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-6">
                        <div className="bg-white w-full max-w-2xl max-h-[90%] rounded-2xl shadow-lg flex flex-col overflow-hidden">
                <div className="px-8 py-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{consultaSeleccionada.tipoNota}</h2>
                        <p className="text-sm text-slate-500 font-medium mt-1 flex items-center gap-2"><Calendar size={14}/> {consultaSeleccionada.fechaFormato} <span className="w-1 h-1 bg-slate-300 rounded-full"></span> <Clock size={14}/> {consultaSeleccionada.horaFormato}</p>
                    </div>
                    <button onClick={() => setConsultaSeleccionada(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-red-500 shadow-sm border border-transparent hover:border-slate-200"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                    <div className="grid grid-cols-4 gap-4">
                        {[{l:'Peso', v: consultaSeleccionada.consulta?.exploracion?.signos?.peso, u:'kg'}, {l:'Temp', v: consultaSeleccionada.consulta?.exploracion?.signos?.temp, u:'°C'}, {l:'T/A', v: consultaSeleccionada.consulta?.exploracion?.signos?.ta, u:''}, {l:'SpO2', v: consultaSeleccionada.consulta?.exploracion?.signos?.spo2, u:'%'}].map((s, i) => (
                            <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.l}</p>
                                <p className="text-lg font-black text-slate-700">{s.v || '--'} <span className="text-[10px] font-normal text-slate-400">{s.u}</span></p>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-6">
                        <div><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Padecimiento</h4><div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-slate-700 leading-relaxed">{consultaSeleccionada.consulta?.padecimiento || 'Sin descripción'}</div></div>
                        {consultaSeleccionada.consulta?.exploracion?.fisica && <div><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity size={14}/> Exploración</h4><div className="grid grid-cols-1 gap-2">{Object.entries(consultaSeleccionada.consulta.exploracion.fisica).map(([key, val]) => val ? (<div key={key} className="text-sm"><span className="font-bold text-slate-700 capitalize">{key}:</span> <span className="text-slate-600">{val}</span></div>) : null)}</div></div>}
                        <div><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Stethoscope size={14}/> Diagnóstico</h4><div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-sm font-bold text-emerald-800">{consultaSeleccionada.consulta?.diagnostico?.enfermedad_actual || 'Sin diagnóstico'}</div></div>
                        <div><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Pill size={14}/> Receta</h4><div className="space-y-2">{consultaSeleccionada.consulta?.diagnostico?.tratamiento_lista?.map((med, idx) => (<div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm"><span className="font-bold text-slate-700 text-sm">{med.nombre}</span><span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">{med.dosis}</span></div>))}</div></div>
                    </div>
                </div>
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Atendido por: <span className="text-slate-600">{consultaSeleccionada.medicoNombre || 'Desconocido'}</span></p>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default SeccionResumen;