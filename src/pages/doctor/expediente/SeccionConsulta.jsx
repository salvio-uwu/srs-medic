    // src/pages/doctor/expediente/SeccionConsulta.jsx
    import React, { useState, useEffect, useMemo, useRef } from 'react';
    import { httpsCallable } from 'firebase/functions';
    import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
    import { functions } from '../../../config/firebase';
    import { db } from '../../../config/firebase';
    import { getPackageDefinitions, getStudiesCatalog } from '../../../services/studyCatalogService';
    import { 
    FileText, Activity, ArrowLeft, Droplet, Eye, FlaskConical, 
    Search, Trash2, Scissors, Package, CheckCircle, Mic, 
    AlertTriangle, ChevronRight, ChevronDown, Pill, X, Check, Info, Calculator, Zap,
    Sparkles, Loader2, Brain, Pencil, Plus, Link2
    } from 'lucide-react';

    let cacheCie10 = null;
        let cacheMeds = null;
        let cacheStudies = null;

    // --- ATAJOS INTELIGENTES: Motivos relacionados ---
    const MOTIVOS_RELACIONADOS = {
      'Cuadro Gripal': ['Fiebre', 'Tos', 'Dolor de Garganta', 'Rinorrea', 'Cefalea Intensa', 'Malestar General'],
      'Cefalea Intensa': ['Migraña', 'Náuseas', 'Hipertensión', 'Estrés', 'Vértigo'],
      'Dolor Abdominal': ['Gastritis', 'Colitis', 'Náuseas', 'Vómito', 'Diarrea', 'Estreñimiento'],
      'Hipertensión': ['Cefalea Intensa', 'Mareo', 'Taquicardia', 'Dolor Torácico', 'Disnea'],
      'Control Niño Sano': ['Vacunación', 'Peso y Talla', 'Desarrollo Psicomotor', 'Alimentación'],
      'Paciente Asintomático': ['Check-up General', 'Control de Rutina', 'Certificado Médico'],
      'Fiebre': ['Cuadro Gripal', 'Infección Urinaria', 'Faringitis', 'Otitis'],
      'Tos': ['Cuadro Gripal', 'Bronquitis', 'Asma', 'Faringitis', 'Rinorrea'],
      'Gastritis': ['Dolor Abdominal', 'Reflujo', 'Náuseas', 'Vómito'],
      'Diarrea': ['Dolor Abdominal', 'Deshidratación', 'Gastroenteritis', 'Colitis'],
      'Infección Urinaria': ['Disuria', 'Fiebre', 'Dolor Lumbar', 'Dolor Abdominal'],
      'Dolor de Garganta': ['Faringitis', 'Amigdalitis', 'Cuadro Gripal', 'Fiebre'],
      'Lumbalgia': ['Ciática', 'Contractura Muscular', 'Dolor Articular'],
      'Migraña': ['Cefalea Intensa', 'Náuseas', 'Fotofobia', 'Vértigo'],
      'Diabetes Control': ['Hiperglucemia', 'Neuropatía', 'Pie Diabético', 'Hipertensión'],
      'Alergia': ['Rinitis Alérgica', 'Urticaria', 'Dermatitis', 'Conjuntivitis'],
      'Dolor Torácico': ['Hipertensión', 'Taquicardia', 'Disnea', 'Ansiedad'],
      'Ansiedad': ['Insomnio', 'Estrés', 'Taquicardia', 'Cefalea Intensa'],
      'Vértigo': ['Mareo', 'Náuseas', 'Cefalea Intensa', 'Hipotensión'],
    };

    const ATAJOS_DEFAULT = [
      { nombre: 'Paciente Asintomático', categoria: 'generales' },
      { nombre: 'Cefalea Intensa', categoria: 'neurologicos' },
      { nombre: 'Cuadro Gripal', categoria: 'respiratorios' },
      { nombre: 'Dolor Abdominal', categoria: 'abdominales' },
      { nombre: 'Control Niño Sano', categoria: 'generales' },
      { nombre: 'Hipertensión', categoria: 'generales' },
    ];

    const CATEGORIAS_SINTOMAS = [
      { id: 'generales', label: 'Generales', color: 'bg-slate-500' },
      { id: 'respiratorios', label: 'Respiratorios', color: 'bg-sky-500' },
      { id: 'abdominales', label: 'Abdominales', color: 'bg-amber-500' },
      { id: 'urinarios', label: 'Urinarios', color: 'bg-violet-500' },
      { id: 'neurologicos', label: 'Neurológicos', color: 'bg-rose-500' },
    ];


        const normalizeCatalogMedication = (raw) => {
            if (!raw || typeof raw !== 'object') return null;
            const nombreComercial = raw.medicamento || raw.nombreComercial || raw['*NOMBRE COMERCIAL'] || '';
            const grupo = raw.grupo || raw.marca || raw['*MARCA'] || '';
            const laboratorio = raw['*NOMBRE DEL LABORATORIO'] || raw.laboratorio || '';
            const sustanciasActivas = raw['*SUSTANCIA(S) ACTIVA(S)'] || raw.sustanciasActivas || '';
            const presentacion = raw['*PRESENTACIÓN'] || raw['*PRESENTACION'] || raw.presentacion || '';
            const dosis = raw.DOSIS || raw.dosis || '';
            const indicacion = raw.INDICACION || raw.indicacion || '';
            const opcion2 = raw['OPCION 2'] || raw.opcion2 || '';
            const advertencia = raw['ADVERTENCIA '] || raw.advertencia || '';
            const embarazo = raw.EMBARAZO || raw.embarazo || '';
            const numeroAcomodo = raw.numeroAcomodo || raw.numero_acomodo || '';
            const contraindicaciones = raw.CONTRAINDICACIONES || raw.contraindicaciones || advertencia || '';
            const controlado = !!(raw.controlado ?? raw.CONTROLADO);
            const color = String(raw.color || '').trim();

            const source = `${grupo} ${nombreComercial}`;
            const match = String(source).match(/(\d)\s*$/);
            const nivelUtilidad = match ? Number(match[1]) : Number(raw.nivelUtilidad || 3);

            return {
                nombreComercial: String(nombreComercial).trim(),
                grupo: String(grupo).trim(),
                marca: String(grupo).trim(),
                sustanciasActivas: String(sustanciasActivas).trim(),
                presentacion: String(presentacion).trim(),
                dosisCatalogo: String(dosis).trim(),
                indicacion: String(indicacion).trim(),
                opcion2: String(opcion2).trim(),
                advertencia: String(advertencia).trim(),
                embarazo: String(embarazo).trim(),
                numeroAcomodo: String(numeroAcomodo).trim(),
                contraindicaciones: String(contraindicaciones).trim(),
                laboratorio: String(laboratorio).trim(),
                color,
                nivelUtilidad: [1, 2, 3, 4, 5].includes(nivelUtilidad) ? nivelUtilidad : 3,
                controlado,
                activo: raw.activo !== false,
                id: String(raw.id || '').trim()
            };
        };

    const SeccionConsulta = ({ 
    expediente, 
    updateCampo, 
    activeConsulta, 
    setActiveConsulta, 
    tempMed, 
    setTempMed,
    doctorUid
    }) => {  
    
    // --- ESTADOS DE NAVEGACIÓN ---
    const [activeExploracion, setActiveExploracion] = useState('signos');
    const [activeEstudiosTab, setActiveEstudiosTab] = useState('paquetes');

    // --- ESTADOS ATAJOS (LEÍDOS DESDE FIRESTORE) ---
    const [atajos, setAtajos] = useState(ATAJOS_DEFAULT);
    const [relacionados, setRelacionados] = useState([]);
    
    // --- ESTADOS DE BUSCADORES Y MEDICAMENTOS ---
    const [sugerenciasCie10, setSugerenciasCie10] = useState([]);
    const [mostrarCie10, setMostrarCie10] = useState(false);
    const [indiceCie10, setIndiceCie10] = useState(-1);
    const [cie10Valido, setCie10Valido] = useState(() => {
      // Si viene precargado con formato "CÓDIGO - Descripción", marcarlo válido
      const val = expediente?.consulta?.diagnostico?.enfermedad_actual || '';
      return /^[A-Z]\d{2,3}(\.\d+)?\s*[-–—]\s*.+/.test(val);
    });
    const [sugerenciasMeds, setSugerenciasMeds] = useState([]);
    const [mostrarMeds, setMostrarMeds] = useState(false);
    const [indiceMeds, setIndiceMeds] = useState(-1);
    const [dosisRecomendada, setDosisRecomendada] = useState(''); 
    const refListaCie10 = useRef(null);
    const refListaMeds = useRef(null);
    const refInputCie10 = useRef(null);
    const [sacudirCie10, setSacudirCie10] = useState(false);
    
    // --- ESTADOS IA (SOLO ALERGIAS) & DICTADO ---
    const [analizandoRiesgo, setAnalizandoRiesgo] = useState(false);
    const [isListening, setIsListening] = useState(false);
    
    // --- ESTADOS CALCULADORA DE DOSIS ---
    const [showCalculadora, setShowCalculadora] = useState(false);
    const [calcDatos, setCalcDatos] = useState({
        peso: '', 
        dosisMgKg: '',
        concentracionMg: '',
        concentracionMl: ''
    });
    const [resultadoCalc, setResultadoCalc] = useState('');

    // --- ESTADOS IA SUGERENCIAS POR MOTIVO ---
    const [sugerenciasMotivo, setSugerenciasMotivo] = useState([]);
    const [cargandoSugerencias, setCargandoSugerencias] = useState(false);
    const [medSeleccionadoDetalle, setMedSeleccionadoDetalle] = useState(null);
    const [editandoMedIndex, setEditandoMedIndex] = useState(null);
    const [medEdicion, setMedEdicion] = useState({ nombre: '', presentacion: '', sustanciasActivas: '', dosis: '' });

    // --- ESTADOS IA CALCULADORA ---
    const [iaCalcLoading, setIaCalcLoading] = useState(false);
    const [iaCalcResult, setIaCalcResult] = useState('');

    // --- ESTADOS UI (MODALES) ---
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [riskData, setRiskData] = useState({ mensaje: '', medicamento: '' });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [tempGlucosa, setTempGlucosa] = useState({ fecha: '', categoria: 'Antes del desayuno', valor: '' });
    const [catalogoEstudios, setCatalogoEstudios] = useState([]);
    const [busquedaEstudio, setBusquedaEstudio] = useState('');

    // --- FUNCIONES ATAJOS ---
    const usarAtajo = (nombre) => {
      updateCampo('consulta.padecimiento', 
        (expediente.consulta.padecimiento || '') + (expediente.consulta.padecimiento ? "\n" : "") + nombre + ": ");
      const rel = MOTIVOS_RELACIONADOS[nombre] || [];
      const existentes = atajos.map(a => a.nombre);
      setRelacionados(rel.filter(r => !existentes.includes(r)));
    };

    const usarRelacionado = (nombre) => {
      updateCampo('consulta.padecimiento', 
        (expediente.consulta.padecimiento || '') + (expediente.consulta.padecimiento ? "\n" : "") + nombre + ": ");
      const rel = MOTIVOS_RELACIONADOS[nombre] || [];
      const existentes = atajos.map(a => a.nombre);
      setRelacionados(rel.filter(r => !existentes.includes(r) && r !== nombre));
    };

    // --- CARGA INICIAL ---
    useEffect(() => {
        const cargarCatalogos = async () => {
        if (!cacheCie10) {
            try { const res = await fetch('/data/cie10.json'); if (res.ok) cacheCie10 = await res.json(); } catch (e) { console.error("Error CIE10", e); }
        }
                if (!cacheMeds) {
                        try {
                            const medsSnap = await getDocs(collection(db, 'catalogo_medicamentos'));
                            cacheMeds = medsSnap.docs
                                .map((d) => normalizeCatalogMedication({ id: d.id, ...d.data() }))
                                .filter(Boolean)
                                .filter((m) => m.activo)
                                .filter((m) => m.nombreComercial)
                                .sort((a, b) => String(a.nombreComercial).localeCompare(String(b.nombreComercial), 'es', { sensitivity: 'base' }));
                        } catch (e) {
                            console.error('Error cargando catalogo_medicamentos', e);
                            cacheMeds = [];
                        }
                }

                if (!cacheStudies) {
                    cacheStudies = await getStudiesCatalog();
                }

                setCatalogoEstudios(Array.isArray(cacheStudies) ? cacheStudies : []);
        };
        cargarCatalogos();
    }, []);

    // --- CARGA ATAJOS DESDE FIRESTORE ---
    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'catalogo_sintomatologia'), orderBy('nombre', 'asc')),
            (snap) => {
                const items = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(item => item.activo !== false && item.nombre);
                setAtajos(items.length > 0 ? items : ATAJOS_DEFAULT);
            },
            () => setAtajos(ATAJOS_DEFAULT)
        );
        return () => unsub();
    }, []);

    const paquetesCatalogo = useMemo(
        () => getPackageDefinitions(catalogoEstudios),
        [catalogoEstudios]
    );

    const paquetesPorNombre = useMemo(() => {
        const map = new Map();
        paquetesCatalogo.forEach((item) => map.set(item.nombre, item));
        return map;
    }, [paquetesCatalogo]);

    const estudiosSeleccionadosNormalizados = useMemo(() => {
        const source = expediente?.consulta?.estudios?.estudios_seleccionados || [];
        if (!Array.isArray(source)) return [];

        return source
            .map((item) => {
                if (typeof item === 'string') {
                    return { nombre: item, clave: '', nota: '' };
                }
                return {
                    nombre: String(item?.nombre || item?.descripcion || '').trim(),
                    clave: String(item?.clave || '').trim(),
                    nota: String(item?.nota || '').trim(),
                    paqueteOrigen: String(item?.paqueteOrigen || '').trim()
                };
            })
            .filter((item) => item.nombre);
    }, [expediente?.consulta?.estudios?.estudios_seleccionados]);

    const estudiosDisponiblesFiltrados = useMemo(() => {
        const seleccionados = new Set(estudiosSeleccionadosNormalizados.map((item) => item.nombre.toLowerCase()));
        const q = busquedaEstudio.trim().toLowerCase();

        return catalogoEstudios
            .filter((item) => item.categoria !== 'paquete')
            .filter((item) => !seleccionados.has(item.descripcion.toLowerCase()))
            .filter((item) => {
                if (!q) return true;
                return (`${item.descripcion} ${item.clave}`).toLowerCase().includes(q);
            })
            .slice(0, 40);
    }, [catalogoEstudios, estudiosSeleccionadosNormalizados, busquedaEstudio]);

    const paquetesSeleccionados = expediente?.consulta?.estudios?.paquetes_seleccionados || [];

    const togglePaquete = (nombrePaquete) => {
        const exists = paquetesSeleccionados.some((item) => item === nombrePaquete);
        const next = exists
            ? paquetesSeleccionados.filter((item) => item !== nombrePaquete)
            : [...paquetesSeleccionados, nombrePaquete];
        updateCampo('consulta.estudios.paquetes_seleccionados', next);

        if (!exists) {
            const paquete = paquetesPorNombre.get(nombrePaquete);
            const componentes = Array.isArray(paquete?.componentes) ? paquete.componentes : [];
            if (componentes.length > 0) {
                const actuales = [...estudiosSeleccionadosNormalizados];
                const existentes = new Set(actuales.map((est) => est.nombre.toLowerCase()));
                const toAdd = componentes
                    .map((comp) => ({
                        nombre: String(comp.descripcion || '').trim(),
                        clave: String(comp.clave || '').trim(),
                        nota: '',
                        paqueteOrigen: nombrePaquete
                    }))
                    .filter((comp) => comp.nombre)
                    .filter((comp) => !existentes.has(comp.nombre.toLowerCase()));

                if (toAdd.length > 0) {
                    updateCampo('consulta.estudios.estudios_seleccionados', [...actuales, ...toAdd]);
                }
            }
        }
    };

    const toggleEstudioIndividual = (item) => {
        const exists = estudiosSeleccionadosNormalizados.some((est) => est.nombre.toLowerCase() === item.descripcion.toLowerCase());
        const next = exists
            ? estudiosSeleccionadosNormalizados.filter((est) => est.nombre.toLowerCase() !== item.descripcion.toLowerCase())
            : [...estudiosSeleccionadosNormalizados, { nombre: item.descripcion, clave: item.clave || '', nota: '' }];
        updateCampo('consulta.estudios.estudios_seleccionados', next);
    };

    const removeEstudioSeleccionado = (index) => {
        updateCampo(
            'consulta.estudios.estudios_seleccionados',
            estudiosSeleccionadosNormalizados.filter((_, idx) => idx !== index)
        );
    };

    const agregarEstudioLibre = () => {
        const nombre = String(busquedaEstudio || '').trim();
        if (!nombre) return;

        const exists = estudiosSeleccionadosNormalizados.some(
            (est) => String(est?.nombre || '').trim().toLowerCase() === nombre.toLowerCase()
        );

        if (exists) {
            showNotification('Ese estudio ya está agregado.', 'error');
            return;
        }

        updateCampo('consulta.estudios.estudios_seleccionados', [
            ...estudiosSeleccionadosNormalizados,
            { nombre, clave: '', nota: '', capturaManual: true }
        ]);
        setBusquedaEstudio('');
        showNotification('Estudio agregado manualmente', 'success');
    };

    useEffect(() => {
        if (expediente.consulta.exploracion.antropometria?.peso) {
            setCalcDatos(prev => ({ ...prev, peso: expediente.consulta.exploracion.antropometria.peso }));
        }
    }, [expediente.consulta.exploracion.antropometria?.peso]);

    useEffect(() => {
        if (toast.show) {
        const t = setTimeout(() => setToast({ ...toast, show: false }), 4000);
        return () => clearTimeout(t);
        }
    }, [toast.show]);

    const showNotification = (msg, type = 'success') => setToast({ show: true, message: msg, type });

    // ==========================================
    // FUNCIONES DE LÓGICA Y CÁLCULOS
    // ==========================================

    // --- LÓGICA DE COLORES PARA UTILIDAD DE MEDICAMENTOS ---
    // --- LÓGICA DE COLORES PARA UTILIDAD DE MEDICAMENTOS ---
    const getMarcaColor = (marcaStr, nivelOverride = null) => {
        const parsedNivel = Number(nivelOverride || 0) || Number(String(marcaStr || '').match(/(\d)\s*$/)?.[1] || 0);
        const nivel = [1, 2, 3, 4, 5].includes(parsedNivel) ? String(parsedNivel) : '0';

        switch(nivel) {
            case '1': return { borderLeft: 'border-blue-500', bg: 'bg-blue-500' };
            case '2': return { borderLeft: 'border-emerald-500', bg: 'bg-emerald-500' };
            case '3': return { borderLeft: 'border-yellow-400', bg: 'bg-yellow-400' };
            case '4': return { borderLeft: 'border-orange-500', bg: 'bg-orange-500' };
            case '5': return { borderLeft: 'border-red-500', bg: 'bg-red-500' };
            default: return { borderLeft: 'border-slate-300', bg: 'bg-slate-300' }; 
        }
    };

    // --- LÓGICA DE COLORES PARA GLUCOSA ---
    const getGlucosaColor = (valor, categoria) => {
        const v = parseInt(valor);
        if (isNaN(v)) return 'bg-slate-100 text-slate-700';
        const isPostprandial = categoria.includes('2 horas');

        if (isPostprandial) {
        if (v < 140) return 'bg-emerald-400 text-white';
        if (v >= 140 && v <= 199) return 'bg-yellow-400 text-slate-800';
        return 'bg-red-500 text-white';
        } else {
        if (v < 100) return 'bg-emerald-400 text-white';
        if (v >= 100 && v <= 125) return 'bg-yellow-400 text-slate-800';
        return 'bg-red-500 text-white';
        }
    };

    const calcularDosisExacta = () => {
        const pesoEvaluar = calcDatos.peso || expediente.consulta.exploracion.antropometria?.peso;
        const { dosisMgKg, concentracionMg, concentracionMl } = calcDatos;
        
        if (!pesoEvaluar || !dosisMgKg) {
            showNotification("Ingresa peso y dosis (mg/kg)", "error");
            return;
        }

        const totalMg = parseFloat(pesoEvaluar) * parseFloat(dosisMgKg);
        let resultadoString = `${totalMg.toFixed(2)} mg`;

        if (concentracionMg && concentracionMl) {
            const totalMl = (totalMg * parseFloat(concentracionMl)) / parseFloat(concentracionMg);
            resultadoString += ` (Equivalente a ${totalMl.toFixed(2)} mL)`;
        }
        setResultadoCalc(resultadoString);
    };

    // --- IA: SUGERIR MEDICAMENTOS POR MOTIVO DE CONSULTA ---
    const sugerirMedicamentosPorMotivo = async () => {
        const motivo = (expediente.consulta.padecimiento || '').trim();
        if (!motivo || motivo.length < 5) {
            showNotification('Escribe un motivo de consulta más detallado', 'error');
            return;
        }
        if (!cacheMeds || cacheMeds.length === 0) {
            showNotification('No hay medicamentos en el catálogo', 'error');
            return;
        }
        setCargandoSugerencias(true);
        setSugerenciasMotivo([]);
        try {
            const catalogoResumen = cacheMeds.slice(0, 200).map(m =>
                `${m.nombreComercial}|${m.sustanciasActivas}|${m.indicacion}|${m.presentacion}|${m.dosisCatalogo}`
            ).join('\n');

            const askGemini = httpsCallable(functions, 'askGemini');
            const response = await askGemini({
                prompt: `Eres un médico farmacólogo experto. El paciente presenta: "${motivo}".
Del siguiente catálogo de medicamentos disponibles, sugiere los 5 más apropiados para este cuadro clínico.
CATÁLOGO (formato: NombreComercial|SustanciaActiva|Indicación|Presentación|Dosis):
${catalogoResumen}

Responde ÚNICAMENTE un arreglo JSON válido con los nombres comerciales exactos del catálogo:
["NombreComercial1","NombreComercial2",...]
Sin markdown, sin explicaciones.`
            });
            let text = (response?.data?.result || '').replace(/```json/g, '').replace(/```/g, '').trim();
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']');
            if (start !== -1 && end !== -1) text = text.substring(start, end + 1);
            const nombres = JSON.parse(text);
            const encontrados = nombres
                .map(n => cacheMeds.find(m => m.nombreComercial.toLowerCase() === String(n).toLowerCase()))
                .filter(Boolean);
            setSugerenciasMotivo(encontrados);
            if (encontrados.length === 0) showNotification('No se encontraron sugerencias para este motivo', 'error');
        } catch (err) {
            console.error('Error sugerencias IA:', err);
            showNotification('Error al consultar IA para sugerencias', 'error');
        } finally {
            setCargandoSugerencias(false);
        }
    };

    // --- IA: ASISTENTE DE DOSIS ---
    const consultarIADosis = async () => {
        const medNombre = tempMed.nombre;
        const peso = calcDatos.peso || expediente.consulta.exploracion.antropometria?.peso;
        if (!medNombre) { showNotification('Selecciona un medicamento primero', 'error'); return; }
        setIaCalcLoading(true);
        setIaCalcResult('');
        try {
            const edad = expediente.px_info?.edad || '';
            const askGemini = httpsCallable(functions, 'askGemini');
            const response = await askGemini({
                prompt: `Eres un médico farmacólogo experto. Necesito calcular la dosis para:
MEDICAMENTO: "${medNombre}"
PESO del paciente: ${peso ? peso + ' kg' : 'No disponible'}
EDAD del paciente: ${edad || 'No disponible'}

Proporciona la dosis recomendada en mg/kg, la dosis total calculada si hay peso, las presentaciones comunes, y la frecuencia de administración habitual.
Responde en formato breve y claro en español, máximo 4 líneas. No uses markdown.`
            });
            setIaCalcResult(response?.data?.result || 'Sin respuesta de IA');
        } catch (err) {
            console.error('Error IA dosis:', err);
            setIaCalcResult('Error al consultar IA. Intenta de nuevo.');
        } finally {
            setIaCalcLoading(false);
        }
    };

    const analizarRiesgoConIA = async (medicamentoNuevo) => {
        setAnalizandoRiesgo(true);
        try {
            const listaAlergias = expediente.antecedentes?.alergias?.lista || [];
            const nombresLista = listaAlergias.map((a) => a.sustancia);
            const textoOtras = expediente.antecedentes?.alergias?.otras || "";
            const alergiasBase = expediente.px_info?.alergias_base || "";
            const contextoAlergias = [...nombresLista, textoOtras, alergiasBase].filter(Boolean).join(", ");
            const medicamentosActuales = expediente.consulta.diagnostico.tratamiento_lista?.map((m) => m.nombre).join(", ") || "Ninguno";

            if (!contextoAlergias.trim() && medicamentosActuales === "Ninguno") {
                setAnalizandoRiesgo(false);
                return { riesgo: false };
            }

            const analizarMedicamento = httpsCallable(functions, 'analizarMedicamento');
            const response = await analizarMedicamento({
                medicamento: medicamentoNuevo,
                historialAlergias: contextoAlergias,
                medicamentosActuales
            });
            setAnalizandoRiesgo(false);
            return response?.data || { riesgo: false, mensaje: '' };
        } catch (error) {
            setAnalizandoRiesgo(false);
            return {
                riesgo: false,
                advertencia: 'No se pudo validar con IA en este momento. Verifique manualmente interacciones y alergias.'
            };
        }
    };

    const handleAgregarMedicamento = async () => {
        if (!String(tempMed.nombre || '').trim()) return;

        const nombreNuevo = String(tempMed.nombre || '').trim().toLowerCase();
        const dosisNueva = String(tempMed.dosis || '').trim().toLowerCase();
        const presentacionNueva = String(tempMed.presentacion || '').trim().toLowerCase();
        const sustanciasNueva = String(tempMed.sustanciasActivas || '').trim().toLowerCase();

        const yaExisteExacto = expediente.consulta.diagnostico.tratamiento_lista?.some((m) => {
            const nombre = String(m?.nombre || '').trim().toLowerCase();
            const dosis = String(m?.dosis || '').trim().toLowerCase();
            const presentacion = String(m?.presentacion || '').trim().toLowerCase();
            const sustancias = String(m?.sustanciasActivas || '').trim().toLowerCase();
            return nombre === nombreNuevo && dosis === dosisNueva && presentacion === presentacionNueva && sustancias === sustanciasNueva;
        });

        if (yaExisteExacto) {
            setRiskData({ mensaje: 'Este medicamento ya está capturado con la misma presentación y dosis.', medicamento: tempMed.nombre });
            setShowRiskModal(true);
            return;
        }

        const resultadoIA = await analizarRiesgoConIA(tempMed.nombre);
        if (resultadoIA?.advertencia) {
            showNotification(resultadoIA.advertencia, 'error');
        }
        if (resultadoIA.riesgo) {
            setRiskData({ mensaje: resultadoIA.mensaje, medicamento: tempMed.nombre });
            setShowRiskModal(true);
            return;
        }

        ejecutarAgregado();
    };

    const ejecutarAgregado = () => {
        updateCampo('consulta.diagnostico.tratamiento_lista', [...(expediente.consulta.diagnostico.tratamiento_lista || []), tempMed]);
        setTempMed({ nombre: '', dosis: '', presentacion: '', sustanciasActivas: '', numeroAcomodo: '' });
        setDosisRecomendada('');
        setResultadoCalc('');
        setShowCalculadora(false);
        setShowRiskModal(false);
        setMedSeleccionadoDetalle(null);
        setIaCalcResult('');
        showNotification('Medicamento agregado a la receta', 'success');
    };

    const iniciarEdicionMedicamento = (index, med = {}) => {
        setEditandoMedIndex(index);
        setMedEdicion({
            nombre: String(med?.nombre || '').trim(),
            presentacion: String(med?.presentacion || '').trim(),
            sustanciasActivas: String(med?.sustanciasActivas || '').trim(),
            dosis: String(med?.dosis || '').trim()
        });
    };

    const cancelarEdicionMedicamento = () => {
        setEditandoMedIndex(null);
        setMedEdicion({ nombre: '', presentacion: '', sustanciasActivas: '', dosis: '' });
    };

    const guardarEdicionMedicamento = () => {
        if (editandoMedIndex === null) return;

        const nombre = String(medEdicion.nombre || '').trim();
        if (!nombre) {
            showNotification('El medicamento debe tener nombre', 'error');
            return;
        }

        const listaActual = expediente.consulta.diagnostico.tratamiento_lista || [];
        const nuevaLista = listaActual.map((item, idx) => {
            if (idx !== editandoMedIndex) return item;
            return {
                ...item,
                nombre,
                presentacion: String(medEdicion.presentacion || '').trim(),
                sustanciasActivas: String(medEdicion.sustanciasActivas || '').trim(),
                dosis: String(medEdicion.dosis || '').trim()
            };
        });

        updateCampo('consulta.diagnostico.tratamiento_lista', nuevaLista);
        cancelarEdicionMedicamento();
        showNotification('Medicamento actualizado', 'success');
    };

    const eliminarMedicamento = (index) => {
        const listaActual = expediente.consulta.diagnostico.tratamiento_lista || [];
        updateCampo('consulta.diagnostico.tratamiento_lista', listaActual.filter((_, idx) => idx !== index));

        if (editandoMedIndex === index) {
            cancelarEdicionMedicamento();
            return;
        }

        if (editandoMedIndex !== null && index < editandoMedIndex) {
            setEditandoMedIndex((prev) => prev - 1);
        }
    };

    const toggleDictado = () => {
        if (!('webkitSpeechRecognition' in window)) return alert("Navegador no soportado");
        if (isListening) { setIsListening(false); return; }
        const recognition = new window.webkitSpeechRecognition();
        recognition.lang = 'es-MX'; recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false);
        recognition.onresult = (e) => { const t = e.results[0][0].transcript; updateCampo('consulta.padecimiento', (expediente.consulta.padecimiento || '') + " " + t); };
        recognition.start();
    };

    const glassCard = "bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col";
    const inputStyle = "w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-colors text-sm text-slate-700 placeholder:text-slate-400";
    const labelStyle = "text-[11px] font-semibold text-slate-500 uppercase mb-1.5 ml-1 block tracking-wide";
    const buttonPrimary = "bg-blue-600 text-white hover:bg-blue-700";

    // ==========================================
    // RENDERS
    // ==========================================

    const renderPadecimiento = () => (
        <div className={`${glassCard} min-h-full p-6`}>
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100"><FileText size={24}/></div>
                <div><h3 className="font-bold text-slate-800 text-xl tracking-tight">Motivo de Consulta</h3><p className="text-sm text-slate-400 font-medium">Historia clínica y síntomas</p></div>
            </div>
            <button title="Dictado por voz" onClick={toggleDictado} className={`p-3 rounded-lg transition-colors flex items-center gap-2 ${isListening ? 'bg-rose-500 text-white' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}><Mic size={20}/></button>
        </div>
        
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-[350px]">
            {/* Columna izquierda: Textarea */}
            <div className="flex flex-col">
                <textarea className="flex-1 w-full p-5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 text-base leading-relaxed focus:bg-white focus:border-blue-300 transition-colors resize-none"
                    placeholder="¿Cuál es el motivo de la consulta hoy?" value={expediente.consulta.padecimiento} onChange={e => updateCampo('consulta.padecimiento', e.target.value)} />

                {/* Sugerencias relacionadas */}
                {relacionados.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-2 pb-1">
                    <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-semibold whitespace-nowrap shrink-0">
                      <Link2 size={11}/> Relacionados:
                    </span>
                    {relacionados.map(r => (
                      <button key={r} onClick={() => usarRelacionado(r)}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap">
                        + {r}
                      </button>
                    ))}
                    <button onClick={() => setRelacionados([])} className="p-1 text-slate-400 hover:text-slate-600 shrink-0"><X size={12}/></button>
                  </div>
                )}
            </div>

            {/* Columna derecha: Sintomatología agrupada */}
            <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-hidden">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sintomatología rápida</p>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5">
                    {CATEGORIAS_SINTOMAS.map((cat) => {
                        const items = atajos.filter(a => (a.categoria || 'generales') === cat.id);
                        if (items.length === 0) return null;
                        return (
                            <div key={cat.id}>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className={`w-2 h-2 rounded-full ${cat.color}`}></span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{cat.label}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 ml-3.5">
                                    {items.map((a) => (
                                    <button key={a.nombre} onClick={() => usarAtajo(a.nombre)} 
                                        className="px-2 py-1 border rounded-md text-[11px] font-semibold transition-all whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm active:scale-95">
                                        {a.nombre}
                                    </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        <div className="mt-8 flex items-center justify-end shrink-0 pt-6 border-t border-slate-100">
            <button onClick={() => setActiveConsulta('exploracion')} className={`px-8 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors ${buttonPrimary}`}>
            Siguiente <ArrowLeft size={18} className="rotate-180"/>
            </button>
        </div>
        </div>
    );

    const renderExploracion = () => (
        <div className="flex h-full w-full gap-6">
            <div className="w-64 flex flex-col gap-3 shrink-0 bg-white p-4 rounded-2xl border border-slate-200 h-full overflow-y-auto shadow-sm">
                {[{id:'signos', l:'Signos Vitales', i:<Activity size={18}/>}, {id:'colesterol', l:'Bioquímica', i:<Droplet size={18}/>}, {id:'fisica', l:'Exploración Física', i:<Eye size={18}/>}, {id:'glucosa', l:'Glucometría', i:<FlaskConical size={18}/>}].map(it => (
                    <button key={it.id} onClick={()=>setActiveExploracion(it.id)} className={`p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-colors ${activeExploracion===it.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                        <span className={activeExploracion===it.id?'text-indigo-500':''}>{it.i}</span> {it.l}
                    </button>
                ))}
                
                <div className="flex-1"></div>

                {expediente.px_info?.alergias_base && (
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-rose-600">
                            <AlertTriangle size={18} />
                            <span className="text-xs font-black uppercase tracking-wider">Alergias</span>
                        </div>
                        <p className="text-sm font-bold text-rose-800 leading-tight">
                            {expediente.px_info.alergias_base}
                        </p>
                    </div>
                )}
            </div>

            <div className={`${glassCard} flex-1`}>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {activeExploracion === 'signos' && (
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex gap-2 border-b border-slate-100 pb-2">
                                    <Activity size={18} className="text-indigo-500"/> Vitales
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                                    {['TA','Temp','FC','FR','SpO2'].map(l => (
                                        <div key={l}>
                                            <label className={labelStyle}>{l}</label>
                                            <input 
                                                className={inputStyle} 
                                                placeholder="--" 
                                                value={expediente.consulta.exploracion.signos[l.toLowerCase()]} 
                                                onChange={e => updateCampo(`consulta.exploracion.signos.${l.toLowerCase()}`, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex gap-2 border-b border-slate-100 pb-2">
                                    <Scissors className="rotate-90 text-indigo-500"/> Antropometría
                                </h4>
                                <div className="grid grid-cols-3 gap-5">
                                    <div>
                                        <label className={labelStyle}>Peso (kg)</label>
                                        <input 
                                            type="number" 
                                            className={inputStyle} 
                                            value={expediente.consulta.exploracion.antropometria.peso} 
                                            onChange={e => {
                                                updateCampo('consulta.exploracion.antropometria.peso', e.target.value); 
                                                const t = expediente.consulta.exploracion.antropometria.talla; 
                                                if(t) updateCampo('consulta.exploracion.antropometria.imc', (e.target.value/(t*t)).toFixed(2));
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelStyle}>Talla (m)</label>
                                        <input 
                                            type="number" 
                                            className={inputStyle} 
                                            value={expediente.consulta.exploracion.antropometria.talla} 
                                            onChange={e => {
                                                updateCampo('consulta.exploracion.antropometria.talla', e.target.value); 
                                                const p = expediente.consulta.exploracion.antropometria.peso; 
                                                if(p) updateCampo('consulta.exploracion.antropometria.imc', (p/(e.target.value*e.target.value)).toFixed(2));
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelStyle}>IMC</label>
                                        <input 
                                            readOnly 
                                            className={`${inputStyle} bg-slate-100/50 text-slate-500`} 
                                            value={expediente.consulta.exploracion.antropometria.imc || ''}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeExploracion === 'colesterol' && (
                        <div className="flex flex-col gap-8 animate-in fade-in max-w-lg">
                            <div>
                                <h4 className="text-lg font-bold text-teal-500 mb-4 border-b border-slate-100 pb-2">
                                    Colesterol y triglicéridos
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold text-slate-800 w-32">Triglicéridos:</label>
                                        <input 
                                            className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all shadow-sm font-medium text-slate-700" 
                                            type="number" 
                                            value={expediente.consulta.exploracion.colesterol.trigliceridos || ''} 
                                            onChange={e=>updateCampo('consulta.exploracion.colesterol.trigliceridos', e.target.value)}
                                        />
                                        <span className="text-sm font-bold text-slate-800 w-12">mg/dl</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold text-slate-800 w-32">Colesterol:</label>
                                        <input 
                                            className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all shadow-sm font-medium text-slate-700" 
                                            type="number" 
                                            value={expediente.consulta.exploracion.colesterol.colesterol || ''} 
                                            onChange={e=>updateCampo('consulta.exploracion.colesterol.colesterol', e.target.value)}
                                        />
                                        <span className="text-sm font-bold text-slate-800 w-12">mg/dl</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-teal-500 mb-4 border-b border-slate-100 pb-2">
                                    Hemoglobina
                                </h4>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-bold text-slate-800 w-32">A1C:</label>
                                    <input 
                                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all shadow-sm font-medium text-slate-700" 
                                        type="number" 
                                        step="0.1" 
                                        value={expediente.consulta.exploracion.colesterol.hba1c || ''} 
                                        onChange={e=>updateCampo('consulta.exploracion.colesterol.hba1c', e.target.value)}
                                    />
                                    <span className="text-sm font-bold text-slate-800 w-12">%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeExploracion === 'fisica' && (
                        <div className="flex flex-col gap-2">
                            <p className="text-[11px] font-bold text-slate-400 mb-2">No es obligatorio llenar todos los campos.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { label: 'Habitus exterior', key: 'habitus' },
                                    { label: 'Cabeza/Ojos/Garganta/Oidos/Nariz.', key: 'cabeza' },
                                    { label: 'Cuello', key: 'cuello' },
                                    { label: 'Tórax', key: 'torax' },
                                    { label: 'Genitales ext.rectal y/o Vaginal', key: 'genitales' },
                                    { label: 'Extremidades', key: 'extremidades' },
                                    { label: 'Columna vertebral', key: 'columna' },
                                    { label: 'Abdomen', key: 'abdomen' }
                                ].map(area => (
                                    <div key={area.key}>
                                        <label className={labelStyle}>{area.label}</label>
                                        <textarea 
                                            className={`${inputStyle} h-28 resize-none`} 
                                            value={expediente.consulta.exploracion.fisica[area.key] || ''} 
                                            onChange={e => updateCampo(`consulta.exploracion.fisica.${area.key}`, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeExploracion === 'glucosa' && (
                        <div className="flex flex-col gap-4 animate-in fade-in">
                            <h4 className="text-sm font-black text-teal-600 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FlaskConical size={18} /> Niveles de glucosa
                            </h4>

                            <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div>
                                    <label className={labelStyle}>Fecha:</label>
                                    <input 
                                        type="date" 
                                        className={`${inputStyle} py-2.5`} 
                                        value={tempGlucosa.fecha || new Date().toISOString().split('T')[0]} 
                                        onChange={e => setTempGlucosa({...tempGlucosa, fecha: e.target.value})}
                                    />
                                </div>
                                <div className="flex-1 min-w-[220px]">
                                    <label className={labelStyle}>Categoría:</label>
                                    <select 
                                        className={`${inputStyle} py-2.5`} 
                                        value={tempGlucosa.categoria} 
                                        onChange={e=>setTempGlucosa({...tempGlucosa, categoria: e.target.value})}
                                    >
                                        {[
                                        'Antes del desayuno',
                                        '2 horas después del desayuno',
                                        'Antes de la comida',
                                        '2 horas después de la comida',
                                        'Antes de la cena',
                                        '2 horas después de la cena'
                                        ].map(o=><option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className={labelStyle}>Glucosa:</label>
                                    <input 
                                        type="number" 
                                        className={`${inputStyle} py-2.5`} 
                                        value={tempGlucosa.valor} 
                                        onChange={e=>setTempGlucosa({...tempGlucosa, valor: e.target.value})}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setTempGlucosa({ fecha: new Date().toISOString().split('T')[0], categoria: 'Antes del desayuno', valor: '' })} 
                                        className="bg-teal-400 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm"
                                    >
                                        Limpiar
                                    </button>
                                    <button 
                                        onClick={()=>{
                                            if(tempGlucosa.valor){
                                                const fechaAGuardar = tempGlucosa.fecha || new Date().toISOString().split('T')[0];
                                                updateCampo('consulta.exploracion.glucosa.lista', [...expediente.consulta.exploracion.glucosa.lista, { ...tempGlucosa, fecha: fechaAGuardar }]);
                                                setTempGlucosa({...tempGlucosa, valor:''});
                                            }
                                        }} 
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors text-sm"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col mt-2">
                                <div className="grid grid-cols-[120px_1fr_100px_50px] bg-blue-50/60 py-3 px-6 text-left text-[11px] font-black text-blue-800 tracking-wide border-b border-slate-200 shrink-0">
                                    <span>Fecha</span>
                                    <span>Categoría</span>
                                    <span className="text-center">Glucosa</span>
                                    <span></span>
                                </div>
                                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar">
                                    {expediente.consulta.exploracion.glucosa.lista.map((g, i) => (
                                        <div key={i} className="grid grid-cols-[120px_1fr_100px_50px] py-3 px-6 border-b border-slate-50 items-center hover:bg-slate-50 transition-colors">
                                            <span className="text-sm font-medium text-slate-600">
                                                {g.fecha.split('-').reverse().join('/')}
                                            </span>
                                            <span className="text-sm font-bold text-slate-700">{g.categoria}</span>
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1 rounded-lg font-bold text-sm shadow-sm ${getGlucosaColor(g.valor, g.categoria)}`}>
                                                    {g.valor}
                                                </span>
                                            </div>
                                            <div className="flex justify-end">
                                                <button onClick={()=>updateCampo('consulta.exploracion.glucosa.lista', expediente.consulta.exploracion.glucosa.lista.filter((_,x)=>x!==i))} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {expediente.consulta.exploracion.glucosa.lista.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 text-sm italic">No hay registros de glucosa agregados.</div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-2 flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="text-sm font-bold text-blue-900">Referencia de colores</span>
                                <div className="flex flex-wrap items-center gap-6">
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-600"><div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-sm"></div> Sin diabetes</span>
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-600"><div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-sm"></div> Pre-diabetes</span>
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-600"><div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-sm"></div> Diabetes</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-6 border-t border-slate-100 bg-white flex justify-end shrink-0">
                    <button onClick={() => setActiveConsulta('diagnostico')} className={`px-8 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors ${buttonPrimary}`}>
                        Siguiente <ArrowLeft size={18} className="rotate-180"/>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderDiagnostico = () => (
        <div className="flex gap-6 h-full w-full relative">
        
        {/* --- COLUMNA IZQUIERDA: DIAGNÓSTICO Y AGREGAR RECETA --- */}
        <div className="w-1/2 flex flex-col gap-6 h-full">
            <div className={`${glassCard} flex-1 flex flex-col`}>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    
                    {/* IA: SUGERENCIAS POR MOTIVO DE CONSULTA */}
                    {expediente.consulta.padecimiento?.trim() && (
                        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-violet-50/60 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => {
                                    if (sugerenciasMotivo.length === 0 && !cargandoSugerencias) {
                                        sugerirMedicamentosPorMotivo();
                                    } else {
                                        setSugerenciasMotivo([]);
                                    }
                                }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    {cargandoSugerencias ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                    {cargandoSugerencias ? 'Analizando motivo...' : sugerenciasMotivo.length > 0 ? `${sugerenciasMotivo.length} sugerencias disponibles` : 'Sugerir medicamentos según motivo'}
                                </span>
                                {sugerenciasMotivo.length > 0 && <ChevronDown size={14} className={`transition-transform ${sugerenciasMotivo.length > 0 ? '' : 'rotate-180'}`} />}
                            </button>
                            {sugerenciasMotivo.length > 0 && (
                                <div className="px-4 pb-3 pt-1 border-t border-indigo-100/60">
                                    <div className="flex flex-wrap gap-2">
                                        {sugerenciasMotivo.map((m, i) => {
                                            const utilidad = getMarcaColor(m.grupo || m.marca, m.nivelUtilidad);
                                            return (
                                                <button key={i} type="button"
                                                    onClick={() => {
                                                        setTempMed({ nombre: m.nombreComercial, dosis: '', presentacion: m.presentacion || '', sustanciasActivas: m.sustanciasActivas || '', numeroAcomodo: m.numeroAcomodo || '', grupo: m.grupo || m.marca || '', marca: m.grupo || m.marca || '', nivelUtilidad: m.nivelUtilidad || null, color: m.color || '' });
                                                        setDosisRecomendada(m.dosisCatalogo || '');
                                                        setMedSeleccionadoDetalle(m);
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border bg-white hover:shadow-sm hover:border-indigo-300 transition-all border-l-[3px] ${utilidad.borderLeft}`}
                                                >
                                                    <span className="text-slate-700">{m.nombreComercial}</span>
                                                    {m.sustanciasActivas && <span className="text-slate-400 font-normal hidden sm:inline">· {m.sustanciasActivas.split(',')[0]}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[9px] text-indigo-400 mt-2 italic">Haz clic en un medicamento para prellenarlo en la receta</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BUSCADOR CIE-10 */}
                    <div className="relative z-30">
                        <label className={labelStyle}>Diagnóstico Final (CIE-10)</label>
                        <div className="relative">
                            <input ref={refInputCie10} className={`${inputStyle} ${cie10Valido ? 'border-emerald-300 bg-emerald-50/30' : expediente.consulta.diagnostico.enfermedad_actual ? 'border-amber-300 bg-amber-50/30' : ''} ${sacudirCie10 ? 'animate-[sacudir_0.5s_ease-in-out] ring-2 ring-red-400' : ''}`} placeholder="Buscar patología o código CIE-10..." value={expediente.consulta.diagnostico.enfermedad_actual}
                            onChange={(e)=>{
                                const t=e.target.value;
                                const q=t.toLowerCase().trim();
                                const qCode=q.replace(/[^a-z0-9]/g,'');
                                updateCampo('consulta.diagnostico.enfermedad_actual',t);
                                setCie10Valido(false);
                                setIndiceCie10(-1);
                                if(t.length>1 && cacheCie10){
                                    setSugerenciasCie10(
                                        cacheCie10.filter(i=>{
                                            if(String(i.code||'').includes('-')) return false;
                                            const code=String(i.code||'').toLowerCase();
                                            const codeCompact=code.replace(/[^a-z0-9]/g,'');
                                            const desc=String(i.description||'').toLowerCase();
                                            return desc.includes(q) || code.includes(q) || codeCompact.startsWith(qCode) || codeCompact.includes(qCode);
                                        }).slice(0,20)
                                    );
                                    setMostrarCie10(true)
                                }else{setMostrarCie10(false)}
                            }}
                            onKeyDown={(e)=>{
                                if(!mostrarCie10 || sugerenciasCie10.length===0) return;
                                if(e.key==='ArrowDown'){e.preventDefault(); setIndiceCie10(p=> p<sugerenciasCie10.length-1 ? p+1 : 0);}
                                else if(e.key==='ArrowUp'){e.preventDefault(); setIndiceCie10(p=> p>0 ? p-1 : sugerenciasCie10.length-1);}
                                else if(e.key==='Enter' && indiceCie10>=0){e.preventDefault(); const s=sugerenciasCie10[indiceCie10]; updateCampo('consulta.diagnostico.enfermedad_actual',`${s.code} - ${s.description}`); setCie10Valido(true); setMostrarCie10(false); setIndiceCie10(-1);}
                                else if(e.key==='Escape'){setMostrarCie10(false); setIndiceCie10(-1);}
                            }}
                            onBlur={()=>setTimeout(()=>{setMostrarCie10(false);setIndiceCie10(-1)},200)}/>
                            {cie10Valido 
                              ? <CheckCircle className="absolute right-4 top-4 text-emerald-500" size={18}/>
                              : <Search className="absolute right-4 top-4 text-slate-400" size={18}/>}
                            {mostrarCie10 && <div ref={refListaCie10} className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1 z-50">{sugerenciasCie10.length > 0 ? sugerenciasCie10.map((s,i)=><div key={i} onClick={()=>{updateCampo('consulta.diagnostico.enfermedad_actual',`${s.code} - ${s.description}`);setCie10Valido(true);setMostrarCie10(false);setIndiceCie10(-1)}} ref={el=>{if(i===indiceCie10 && el) el.scrollIntoView({block:'nearest'})}} className={`p-2 rounded-lg text-xs cursor-pointer truncate border-b border-slate-50 last:border-0 ${i===indiceCie10 ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-blue-50'}`}><span className="font-bold text-blue-600">{s.code}</span> — {s.description}</div>) : <div className="p-3 text-xs text-slate-400 text-center">Sin resultados en el catálogo CIE-10</div>}</div>}
                        </div>
                        {!cie10Valido && expediente.consulta.diagnostico.enfermedad_actual && (
                          <div className="flex items-center gap-1.5 mt-1.5 px-1">
                            <AlertTriangle size={12} className="text-amber-500 shrink-0"/>
                            <span className="text-[11px] text-amber-600 font-medium">Selecciona un código CIE-10 válido del catálogo</span>
                          </div>
                        )}
                    </div>

                    {/* BLOQUE NUEVA RECETA */}
                    <div className={`relative bg-slate-50 p-6 rounded-2xl border ${!cie10Valido ? 'border-red-200' : 'border-slate-200'} flex flex-col gap-4 transition-colors`}>
                        {/* Overlay de bloqueo si no hay CIE-10 válido */}
                        {!cie10Valido && (
                            <div 
                                className="absolute inset-0 z-30 bg-white/70 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all"
                                onClick={() => {
                                    setSacudirCie10(true);
                                    setTimeout(() => setSacudirCie10(false), 600);
                                    refInputCie10.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    setTimeout(() => refInputCie10.current?.focus(), 400);
                                }}
                            >
                                <div className="flex flex-col items-center gap-2 px-6 py-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
                                    <AlertTriangle size={24} className="text-red-500"/>
                                    <p className="text-sm font-semibold text-red-700">Diagnóstico CIE-10 requerido</p>
                                    <p className="text-xs text-red-500">Selecciona un código CIE-10 válido del catálogo antes de recetar</p>
                                    <span className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><ChevronRight size={12}/> Haz clic aquí para ir al campo de diagnóstico</span>
                                </div>
                            </div>
                        )}
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex gap-2"><Zap size={16} className="text-blue-500"/> Nueva Receta</h4>
                        
                        {/* Buscador de Medicamento con Colores */}
                        <div className="relative z-20">
                            <input className={inputStyle} placeholder="Nombre del medicamento..." value={tempMed.nombre} 
                            onChange={e=>{
                                const v=e.target.value; 
                                setTempMed({...tempMed, nombre:v}); 
                                setDosisRecomendada(''); 
                                setIndiceMeds(-1);
                                if(v.length>2 && cacheMeds){
                                    const q = v.toLowerCase();
                                    setSugerenciasMeds(
                                        cacheMeds.filter((m) => (
                                            `${m.nombreComercial} ${m.sustanciasActivas} ${m.grupo} ${m.laboratorio} ${m.presentacion} ${m.indicacion} ${m.numeroAcomodo}`.toLowerCase().includes(q)
                                        )).slice(0, 20)
                                    );
                                    setMostrarMeds(true);
                                } else {
                                    setMostrarMeds(false);
                                }
                            }}
                            onKeyDown={(e)=>{
                                if(!mostrarMeds || sugerenciasMeds.length===0) return;
                                if(e.key==='ArrowDown'){e.preventDefault(); setIndiceMeds(p=> p<sugerenciasMeds.length-1 ? p+1 : 0);}
                                else if(e.key==='ArrowUp'){e.preventDefault(); setIndiceMeds(p=> p>0 ? p-1 : sugerenciasMeds.length-1);}
                                else if(e.key==='Enter' && indiceMeds>=0){
                                    e.preventDefault();
                                    const m=sugerenciasMeds[indiceMeds];
                                    setTempMed({nombre: m.nombreComercial, dosis: '', presentacion: m.presentacion || '', sustanciasActivas: m.sustanciasActivas || '', numeroAcomodo: m.numeroAcomodo || '', grupo: m.grupo || '', marca: m.grupo || '', nivelUtilidad: m.nivelUtilidad || null, color: m.color || ''});
                                    setDosisRecomendada(m.dosisCatalogo || 'No hay dosis recomendada en el catálogo.');
                                    setMedSeleccionadoDetalle(m);
                                    setMostrarMeds(false); setIndiceMeds(-1);
                                }
                                else if(e.key==='Escape'){setMostrarMeds(false); setIndiceMeds(-1);}
                            }}
                            onBlur={()=>setTimeout(()=>{setMostrarMeds(false);setIndiceMeds(-1)},200)}/>
                            
                            {mostrarMeds && (
                                <div ref={refListaMeds} className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-64 overflow-y-auto p-1 z-50">
                                    {sugerenciasMeds.map((m,i)=>{
                                        const utilidad = getMarcaColor(m.grupo || m.marca, m.nivelUtilidad);
                                        return (
                                        <div key={i} 
                                        ref={el=>{if(i===indiceMeds && el) el.scrollIntoView({block:'nearest'})}}
                                        onClick={()=>{
                                            setTempMed({nombre: m.nombreComercial, dosis: '', presentacion: m.presentacion || '', sustanciasActivas: m.sustanciasActivas || '', numeroAcomodo: m.numeroAcomodo || '', grupo: m.grupo || '', marca: m.grupo || '', nivelUtilidad: m.nivelUtilidad || null, color: m.color || ''});
                                            setDosisRecomendada(m.dosisCatalogo || 'No hay dosis recomendada en el catálogo.');
                                            setMedSeleccionadoDetalle(m);
                                            setMostrarMeds(false); setIndiceMeds(-1);
                                        }} 
                                        className={`p-3 text-xs cursor-pointer border-b border-slate-50 last:border-0 transition-colors border-l-4 ${utilidad.borderLeft} ${i===indiceMeds ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700">{m.nombreComercial}</span>
                                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${utilidad.bg}`} title={`Nivel ${m.nivelUtilidad}`}></span>
                                                        {m.controlado && <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded">CTRL</span>}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{m.sustanciasActivas}</p>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                                        {m.presentacion && <span className="text-[9px] text-slate-500"><span className="font-semibold text-slate-400">Pres:</span> {m.presentacion}</span>}
                                                        {m.grupo && <span className="text-[9px] text-slate-500"><span className="font-semibold text-slate-400">Grupo:</span> {m.grupo}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                    {sugerenciasMeds.length === 0 && <div className="p-3 text-xs text-slate-400 text-center">Sin resultados</div>}
                                </div>
                            )}
                        </div>
                        
                        {/* RECUADROS DETALLADOS DE INFO */}
                        {tempMed.nombre && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div
                                    className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500 relative">
                                            <Pill size={16} />
                                            {medSeleccionadoDetalle && (
                                                <span
                                                    className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${String(medSeleccionadoDetalle?.color || '').trim() ? '' : getMarcaColor(medSeleccionadoDetalle?.grupo || medSeleccionadoDetalle?.marca, medSeleccionadoDetalle?.nivelUtilidad).bg}`}
                                                    style={String(medSeleccionadoDetalle?.color || '').trim() ? { backgroundColor: String(medSeleccionadoDetalle.color).trim() } : undefined}
                                                    title={String(medSeleccionadoDetalle?.color || '').trim() || `Nivel ${medSeleccionadoDetalle?.nivelUtilidad || '-'}`}
                                                />
                                            )}
                                        </div>
                                            <span className="font-bold text-slate-700 text-sm truncate">{tempMed.nombre}</span>
                                            {medSeleccionadoDetalle?.controlado && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">CONTROLADO</span>}
                                        </div>
                                        {medSeleccionadoDetalle && (
                                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 shrink-0">
                                                <span
                                                    className={`w-2.5 h-2.5 rounded-full ${String(medSeleccionadoDetalle?.color || '').trim() ? '' : getMarcaColor(medSeleccionadoDetalle?.grupo || medSeleccionadoDetalle?.marca, medSeleccionadoDetalle?.nivelUtilidad).bg}`}
                                                    style={String(medSeleccionadoDetalle?.color || '').trim() ? { backgroundColor: String(medSeleccionadoDetalle.color).trim() } : undefined}
                                                />
                                                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                                                    {String(medSeleccionadoDetalle?.color || '').trim()
                                                        ? 'Color catalogo'
                                                        : `Nivel ${medSeleccionadoDetalle?.nivelUtilidad || '-'}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {medSeleccionadoDetalle && (
                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            {(medSeleccionadoDetalle.grupo || medSeleccionadoDetalle.marca) && (
                                                <div className="bg-slate-50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Grupo</p>
                                                    <p className="text-xs text-slate-700">{medSeleccionadoDetalle.grupo || medSeleccionadoDetalle.marca}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.laboratorio && (
                                                <div className="bg-slate-50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Laboratorio</p>
                                                    <p className="text-xs text-slate-700">{medSeleccionadoDetalle.laboratorio}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.sustanciasActivas && (
                                                <div className="bg-slate-50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Sustancia activa</p>
                                                    <p className="text-xs text-slate-700">{medSeleccionadoDetalle.sustanciasActivas}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.presentacion && (
                                                <div className="bg-slate-50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Presentación</p>
                                                    <p className="text-xs text-slate-700">{medSeleccionadoDetalle.presentacion}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.numeroAcomodo && (
                                                <div className="bg-slate-50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">No. acomodo</p>
                                                    <p className="text-xs text-slate-700">{medSeleccionadoDetalle.numeroAcomodo}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.indicacion && (
                                                <div className="bg-slate-50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Indicación</p>
                                                    <p className="text-xs text-slate-700">{medSeleccionadoDetalle.indicacion}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.opcion2 && (
                                                <div className="bg-slate-50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Opción 2</p>
                                                    <p className="text-xs text-slate-700">{medSeleccionadoDetalle.opcion2}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.embarazo && (
                                                <div className="bg-rose-50 rounded-lg p-2 border border-rose-100">
                                                    <p className="text-[9px] font-bold text-rose-400 uppercase">Embarazo</p>
                                                    <p className="text-xs text-rose-700">{medSeleccionadoDetalle.embarazo}</p>
                                                </div>
                                            )}
                                            {medSeleccionadoDetalle.advertencia && (
                                                <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 col-span-2">
                                                    <p className="text-[9px] font-bold text-amber-500 uppercase">Advertencia</p>
                                                    <p className="text-xs text-amber-800">{medSeleccionadoDetalle.advertencia}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {dosisRecomendada && (
                                    <div className="p-4 border border-indigo-100 bg-indigo-50/50 rounded-xl text-sm text-indigo-900 flex gap-3 items-start shadow-sm">
                                        <Info size={18} className="shrink-0 mt-0.5 text-indigo-500" />
                                        <div>
                                            <p className="text-[9px] font-bold text-indigo-400 uppercase mb-1">Dosis catálogo</p>
                                            <p className="font-medium leading-relaxed text-xs">{dosisRecomendada}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* ÁREA DE CALCULADORA E INDICACIONES MANUALES */}
                        <div className="flex flex-col gap-3 relative mt-2 border-t border-slate-200 pt-5">
                            
                            <div className="flex justify-between items-center mb-1">
                                <label className={labelStyle}>Dosis a recetar</label>
                                <button title="Herramienta de cálculo de dosis" onClick={() => setShowCalculadora(!showCalculadora)} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 border border-blue-100">
                                    <Calculator size={14} /> Calculadora de Dosis
                                </button>
                            </div>

                            {/* TARJETA CALCULADORA */}
                            {showCalculadora && (
                                <div className="p-5 bg-white border border-slate-200 shadow-md rounded-2xl mb-2 animate-in slide-in-from-top-2 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelStyle}>Peso (kg)</label>
                                            <input 
                                                type="number" 
                                                className={inputStyle} 
                                                value={calcDatos.peso || expediente.consulta.exploracion.antropometria?.peso || ''} 
                                                onChange={e => setCalcDatos({...calcDatos, peso: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Dosis (mg/kg)</label>
                                            <input type="number" className={inputStyle} value={calcDatos.dosisMgKg} onChange={e => setCalcDatos({...calcDatos, dosisMgKg: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Concentración (mg)</label>
                                            <input type="number" placeholder="Ej. 250" className={inputStyle} value={calcDatos.concentracionMg} onChange={e => setCalcDatos({...calcDatos, concentracionMg: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Volumen (mL)</label>
                                            <input type="number" placeholder="Ej. 5" className={inputStyle} value={calcDatos.concentracionMl} onChange={e => setCalcDatos({...calcDatos, concentracionMl: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 pt-2 flex-wrap">
                                        <button onClick={calcularDosisExacta} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all">
                                            Calcular
                                        </button>
                                        <button onClick={consultarIADosis} disabled={iaCalcLoading || !tempMed.nombre} 
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 bg-gradient-to-r from-violet-50 to-indigo-50 border-indigo-200 text-indigo-700 hover:from-violet-100 hover:to-indigo-100 shadow-sm">
                                            {iaCalcLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                                            {iaCalcLoading ? 'Consultando...' : 'Sugerencia de dosis'}
                                        </button>
                                        {resultadoCalc && (
                                            <div className="flex-1 flex items-center justify-between bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 animate-in fade-in min-w-[200px]">
                                                <span className="font-bold text-indigo-700 text-sm">{resultadoCalc}</span>
                                                <button onClick={() => { setTempMed({...tempMed, dosis: resultadoCalc}); setShowCalculadora(false); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline ml-2">
                                                    Usar resultado
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {iaCalcResult && (
                                        <div className="mt-2 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-200 rounded-xl animate-in fade-in">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Brain size={14} className="text-indigo-500" />
                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Asistente IA — Referencia</span>
                                            </div>
                                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{iaCalcResult}</p>
                                            <p className="text-[9px] text-slate-400 mt-2 italic">Esta información es de referencia. Valide siempre con su criterio clínico.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <textarea 
                                className={`${inputStyle} resize-none h-28`} 
                                placeholder="Escribe la dosis final e indicaciones..." 
                                value={tempMed.dosis} 
                                onChange={e => setTempMed({...tempMed, dosis: e.target.value})}
                            />
                        </div>

                        <button onClick={handleAgregarMedicamento} disabled={analizandoRiesgo} className={`mt-4 w-full py-3.5 rounded-lg font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 ${analizandoRiesgo ? 'bg-slate-800 text-slate-400 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                            {analizandoRiesgo ? <><Activity className="animate-spin" size={16}/> Verificando alergias...</> : "Agregar a Receta"}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* --- COLUMNA DERECHA: RECETA LISTA --- */}
        <div className="w-1/2 flex flex-col gap-6">
            <div className={`${glassCard} flex-1 flex flex-col`}>
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center"><span className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Receta Actual</span><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[10px] font-semibold">{expediente.consulta.diagnostico.tratamiento_lista?.length || 0} items</span></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {expediente.consulta.diagnostico.tratamiento_lista?.map((m,i)=>(
                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                            {editandoMedIndex === i ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3">
                                        <textarea
                                            className={`${inputStyle} h-20 resize-none`}
                                            placeholder="Corrige aquí la dosis e indicaciones"
                                            value={medEdicion.dosis}
                                            onChange={(e) => setMedEdicion({ ...medEdicion, dosis: e.target.value })}
                                            autoFocus
                                        />
                                        <input
                                            className={inputStyle}
                                            placeholder="Nombre del medicamento"
                                            value={medEdicion.nombre}
                                            onChange={(e) => setMedEdicion({ ...medEdicion, nombre: e.target.value })}
                                        />
                                        <input
                                            className={inputStyle}
                                            placeholder="Presentación"
                                            value={medEdicion.presentacion}
                                            onChange={(e) => setMedEdicion({ ...medEdicion, presentacion: e.target.value })}
                                        />
                                        <input
                                            className={inputStyle}
                                            placeholder="Sustancias activas"
                                            value={medEdicion.sustanciasActivas}
                                            onChange={(e) => setMedEdicion({ ...medEdicion, sustanciasActivas: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={cancelarEdicionMedicamento}
                                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                        >
                                            <X size={14}/> Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={guardarEdicionMedicamento}
                                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                        >
                                            <Check size={14}/> Guardar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400"><Pill size={20}/></div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{m.nombre}</p>
                                            {m.presentacion && <p className="text-[10px] text-slate-400 mt-0.5">{m.presentacion}</p>}
                                            {m.sustanciasActivas && <p className="text-[10px] text-indigo-400 mt-0.5">{m.sustanciasActivas}</p>}
                                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                <p className="text-xs text-slate-500">{m.dosis}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => iniciarEdicionMedicamento(i, m)}
                                                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
                                                >
                                                    Corregir dosis
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                                        <button
                                            type="button"
                                            title="Editar medicamento"
                                            onClick={() => iniciarEdicionMedicamento(i, m)}
                                            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                        >
                                            <Pencil size={17}/>
                                        </button>
                                        <button
                                            type="button"
                                            title="Eliminar medicamento"
                                            onClick={() => eliminarMedicamento(i)}
                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {(!expediente.consulta.diagnostico.tratamiento_lista || expediente.consulta.diagnostico.tratamiento_lista.length === 0) && <div className="h-full flex flex-col items-center justify-center text-slate-300 text-sm gap-2"><Package size={40} className="opacity-20"/><span className="italic">No hay medicamentos aún</span></div>}
                </div>
                
                <div className="p-5 border-t border-slate-100 bg-slate-50">
                    <label className={labelStyle}>Indicaciones Generales</label>
                    <textarea className={`${inputStyle} h-24 resize-none bg-white`} placeholder="Dieta, cuidados, signos de alarma..." value={expediente.consulta.diagnostico.indicaciones} onChange={e=>updateCampo('consulta.diagnostico.indicaciones',e.target.value)}/>
                </div>
            </div>
            
            <div className="flex justify-end shrink-0">
                <button onClick={() => setActiveConsulta('estudios')} className={`px-8 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors ${buttonPrimary}`}>
                    Siguiente <ArrowLeft size={18} className="rotate-180"/>
                </button>
            </div>
        </div>
        </div>
    );

    const renderEstudios = () => (
        <div className="flex h-full w-full gap-6">
            <div className="w-64 flex flex-col gap-3 shrink-0 bg-white p-4 rounded-2xl border border-slate-200 h-full">
                <button onClick={()=>setActiveEstudiosTab('paquetes')} className={`p-4 rounded-lg flex flex-col items-center gap-2 text-xs font-semibold transition-colors border ${activeEstudiosTab==='paquetes'?'bg-blue-50 text-blue-700 border-blue-200':'text-slate-600 hover:bg-slate-50 border-transparent'}`}><Package size={24}/> Paquetes Lab</button>
                <button onClick={()=>setActiveEstudiosTab('estudios')} className={`p-4 rounded-lg flex flex-col items-center gap-2 text-xs font-semibold transition-colors border ${activeEstudiosTab==='estudios'?'bg-blue-50 text-blue-700 border-blue-200':'text-slate-600 hover:bg-slate-50 border-transparent'}`}><FlaskConical size={24}/> Individual</button>
            </div>
            <div className={`${glassCard} flex-1`}>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <h3 className="font-black text-xl mb-6 text-slate-800 tracking-tight">{activeEstudiosTab==='paquetes'?'Paquetes Comunes':'Estudios Individuales'}</h3>
                    {activeEstudiosTab==='paquetes' ? (
                        <div className="grid grid-cols-2 gap-4">
                            {paquetesCatalogo.map((p) => (
                                <label key={p.id} className="flex gap-4 items-center p-4 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={paquetesSeleccionados.includes(p.nombre)}
                                            onChange={() => togglePaquete(p.nombre)}
                                            className="peer appearance-none w-6 h-6 border-2 border-slate-300 rounded-lg checked:bg-indigo-500 checked:border-indigo-500 transition-all"
                                        />
                                        <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none"/>
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-700 text-sm group-hover:text-indigo-700">{p.nombre}</span>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {p.componentes?.length ? `${p.componentes.length} estudio(s)` : 'Sin composicion definida'}
                                        </p>
                                    </div>
                                </label>
                            ))}
                            {paquetesCatalogo.length === 0 && (
                                <div className="col-span-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    No hay paquetes configurados en el catalogo de estudios.
                                </div>
                            )}
                        </div>
                    ):(
                        <div className="flex flex-col gap-6">
                            <div className="space-y-3">
                                <input
                                    className={inputStyle}
                                    placeholder="Buscar estudio por nombre o clave"
                                    value={busquedaEstudio}
                                    onChange={(e) => setBusquedaEstudio(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={agregarEstudioLibre}
                                        disabled={!String(busquedaEstudio || '').trim()}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Plus size={14} /> Agregar estudio libre
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                                    {estudiosDisponiblesFiltrados.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => toggleEstudioIndividual(item)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
                                        >
                                            <p className="font-semibold text-sm text-slate-700">{item.descripcion}</p>
                                            {item.clave && <p className="text-[11px] text-slate-400">Clave: {item.clave}</p>}
                                        </button>
                                    ))}
                                    {estudiosDisponiblesFiltrados.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">Sin coincidencias de estudios disponibles.</div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {estudiosSeleccionadosNormalizados.map((est, i) => (
                                    <div key={`${est.nombre}-${i}`} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div>
                                            <span className="font-bold text-slate-700 text-sm">{est.nombre}</span>
                                            {est.clave && <p className="text-[11px] text-slate-400 mt-0.5">Clave: {est.clave}</p>}
                                        </div>
                                        <button onClick={() => removeEstudioSeleccionado(i)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                {estudiosSeleccionadosNormalizados.length === 0 && (
                                    <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        Selecciona estudios del catalogo para agregarlos a la orden.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="mt-8"><label className={labelStyle}>Notas para Laboratorio</label><textarea className={`${inputStyle} h-24`} placeholder="Indicaciones especiales..." value={expediente.consulta.estudios.notas_generales} onChange={e=>updateCampo('consulta.estudios.notas_generales',e.target.value)}/></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
        <div className="absolute inset-0 bg-slate-50 -z-10 pointer-events-none"/>
        
        {/* TABS HEADER */}
        <div className="flex border-b border-slate-200 bg-white px-8 shrink-0 gap-6 overflow-x-auto z-20 h-16 items-center">
            {[{id:'padecimiento',l:'Motivo',i:<FileText size={18}/>},{id:'exploracion',l:'Exploración',i:<Activity size={18}/>},{id:'diagnostico',l:'Diagnóstico',i:<CheckCircle size={18}/>},{id:'estudios',l:'Estudios',i:<FlaskConical size={18}/>}].map(t=>(
                <button title={t.l} key={t.id} onClick={()=>setActiveConsulta(t.id)} className={`py-2 px-4 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 border ${activeConsulta===t.id?'bg-blue-600 text-white border-blue-600':'text-slate-600 hover:bg-blue-50 hover:text-blue-700 border-transparent'}`}>{t.i} {t.l.toUpperCase()}</button>
            ))}
        </div>
        
        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 p-6 overflow-hidden w-full relative z-10">
            {activeConsulta === 'padecimiento' && renderPadecimiento()}
            {activeConsulta === 'exploracion' && renderExploracion()}
            {activeConsulta === 'diagnostico' && renderDiagnostico()}
            {activeConsulta === 'estudios' && renderEstudios()}
        </div>

        {/* --- TOAST --- */}
        <div className={`fixed bottom-8 right-8 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl border border-white/20 ${toast.type==='error'?'bg-rose-500/90 text-white':'bg-slate-900/90 text-white'}`}>
                {toast.type==='error'?<AlertTriangle size={24}/>:<CheckCircle size={24} className="text-emerald-400"/>}
                <span className="font-bold text-sm tracking-wide">{toast.message}</span>
            </div>
        </div>

        {/* --- MODAL DE RIESGO DE ALERGIA --- */}
        {showRiskModal && (
            <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 border-b border-orange-100 flex items-start gap-4">
                <div className="bg-white p-3 rounded-full shadow-md text-orange-500"><AlertTriangle size={28}/></div>
                <div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Alerta de Alergia</h3><p className="text-xs font-bold text-orange-600 mt-1 uppercase tracking-wider">Validación de Seguridad</p></div>
                </div>
                <div className="p-8 space-y-6">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Medicamento</p><div className="text-xl font-black text-slate-800">{riskData.medicamento}</div></div>
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-xl"><p className="text-sm font-medium text-slate-700 leading-relaxed">"{riskData.mensaje}"</p></div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button onClick={()=>setShowRiskModal(false)} className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">Cancelar</button>
                <button onClick={ejecutarAgregado} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-black transition-all flex justify-center gap-2 items-center"><span>Autorizar Riesgo</span><ChevronRight size={16}/></button>
                </div>
            </div>
            </div>
        )}

        </div>
    );
    };

    export default SeccionConsulta;