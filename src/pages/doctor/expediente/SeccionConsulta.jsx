// src/pages/doctor/expediente/SeccionConsulta.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { functions } from '../../../config/firebase';
import { db } from '../../../config/firebase';
import { PROCEDURE_CATEGORY_OPTIONS, getProcedureCategoryLabel, normalizeProcedureCategory, normalizeProcedureRecord } from '../../../services/procedureCatalogService';
import { getPackageDefinitions, getStudyCategoryLabel, loadStudiesFromPublicData, normalizeStudyCategory, normalizeStudyRecord } from '../../../services/studyCatalogService';
import { TIPO_CITA_OPTIONS, getTipoCitaLabel, normalizeReferenciaMedicaRecord } from '../../../services/referenciaMedicaService';
import {
    buildSymptomCategorySections,
    getDefaultSymptomCategoryId,
    getSymptomCategoryLabelFromId,
    SYMPTOM_CATEGORY_COLOR_FALLBACK,
    SYMPTOM_CATEGORY_DEFAULTS
} from '../../../services/symptomCatalogService';
import {
    FileText, Activity, ArrowLeft, Droplet, Eye, FlaskConical,
    Search, Trash2, Scissors, Package, CheckCircle, Mic,
    AlertTriangle, ChevronRight, ChevronDown, Pill, X, Check, Info, Calculator, Zap,
    Sparkles, Loader2, Brain, Pencil, Plus, Link2, ScanLine, Radiation, Images, Boxes, Microscope, ClipboardList, Bandage, Syringe, Printer, ShieldAlert, Scale, ArrowUp, ArrowDown, Phone, MapPin
} from 'lucide-react';

let cacheCie10 = null;
let cacheMeds = null;
let cacheStudies = null;
let cacheProcedures = null;
let cacheReferenciasMedicas = null;

const PROCEDURE_PRIORITY_OPTIONS = [
    { id: 'electivo', label: 'Electivo' },
    { id: 'preferente', label: 'Preferente' },
    { id: 'urgente', label: 'Urgente' }
];

const PROCEDURE_STATUS_OPTIONS = [
    { id: 'indicado', label: 'Indicado' },
    { id: 'programado', label: 'Programado' },
    { id: 'realizado', label: 'Realizado' },
    { id: 'cancelado', label: 'Cancelado' }
];

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

const titleFromId = getSymptomCategoryLabelFromId;


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

// Normaliza texto eliminando acentos, convirtiendo a minúsculas y quitando caracteres especiales
const normalizar = (str) =>
    String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

// Divide la query en palabras y verifica que todas aparezcan en el texto objetivo
const matchFuzzy = (texto, query) => {
    const t = normalizar(texto);
    const words = normalizar(query).split(/\s+/).filter(Boolean);
    return words.every(w => t.includes(w));
};

const SeccionConsulta = ({
    expediente,
    updateCampo,
    activeConsulta,
    setActiveConsulta,
    onPrintRecetaSalir,
    onPrintReceta,
    tempMed,
    setTempMed
}) => {

    // --- ESTADOS DE NAVEGACIÓN ---
    const [activeExploracion, setActiveExploracion] = useState('signos');
    const [activeEstudiosTab, setActiveEstudiosTab] = useState('ecografia');

    // --- ESTADOS ATAJOS (LEÍDOS DESDE FIRESTORE) ---
    const [atajos, setAtajos] = useState(ATAJOS_DEFAULT);
    const [categoriasSintomas, setCategoriasSintomas] = useState(SYMPTOM_CATEGORY_DEFAULTS);
    const [relacionados, setRelacionados] = useState([]);

    const categoriaSintomaDefaultId = useMemo(
        () => getDefaultSymptomCategoryId(categoriasSintomas),
        [categoriasSintomas]
    );

    const categoriasConAtajos = useMemo(() => {
        return buildSymptomCategorySections({
            categories: categoriasSintomas,
            symptoms: atajos,
            defaultCategoryId: categoriaSintomaDefaultId,
            includeEmptyCategories: false,
            includeInactiveCategories: true
        });
    }, [atajos, categoriaSintomaDefaultId, categoriasSintomas]);

    const categoriasConItems = useMemo(() => {
        return categoriasConAtajos.filter((cat) => cat.items.length > 0);
    }, [categoriasConAtajos]);

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

    // --- ESTADOS DICTADO ---
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

    const isMedNameLocked = Boolean(medSeleccionadoDetalle);
    const recetaHabilitada = cie10Valido;

    const resetMedSelection = () => {
        setTempMed({ nombre: '', dosis: '', presentacion: '', sustanciasActivas: '', numeroAcomodo: '' });
        setMedSeleccionadoDetalle(null);
        setDosisRecomendada('');
        setSugerenciasMeds([]);
        setMostrarMeds(false);
        setIndiceMeds(-1);
    };

    const enfocarDiagnosticoCie10 = () => {
        setSacudirCie10(true);
        setTimeout(() => setSacudirCie10(false), 600);
        refInputCie10.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => refInputCie10.current?.focus(), 250);
    };

    const usarDosisCatalogo = () => {
        const dosisCatalogo = String(dosisRecomendada || '').trim();
        if (!dosisCatalogo) return;
        setTempMed((prev) => ({ ...prev, dosis: dosisCatalogo }));
        showNotification('La dosis del catálogo se copió a la receta.', 'success');
    };

    // --- ESTADOS IA CALCULADORA ---
    const [iaCalcLoading, setIaCalcLoading] = useState(false);
    const [iaCalcResult, setIaCalcResult] = useState('');

    // --- ESTADOS UI (MODALES) ---
    const [showDuplicadoModal, setShowDuplicadoModal] = useState(false);
    const [duplicadoMedicamento, setDuplicadoMedicamento] = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    // --- ESTADOS DE RIESGO Y ALERGIAS (Faltantes) ---
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [riskData, setRiskData] = useState({});
    const [analizandoRiesgo, setAnalizandoRiesgo] = useState(false);
    const [sugerenciasEvitarAlergia, setSugerenciasEvitarAlergia] = useState([]);
    const [cargandoSugerenciasEvitarAlergia, setCargandoSugerenciasEvitarAlergia] = useState(false);
    const [showAlergiaPopover, setShowAlergiaPopover] = useState(false);
    const alergiaPopoverRef = useRef(null);

    useEffect(() => {
        if (!showAlergiaPopover) return;
        const handleClickOutside = (e) => {
            if (alergiaPopoverRef.current && !alergiaPopoverRef.current.contains(e.target)) {
                setShowAlergiaPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAlergiaPopover]);
    const [tempGlucosa, setTempGlucosa] = useState({ fecha: '', categoria: 'Antes del desayuno', valor: '' });
    const [catalogoEstudios, setCatalogoEstudios] = useState([]);
    const [catalogoEstudiosLoading, setCatalogoEstudiosLoading] = useState(false);
    const [busquedaEstudio, setBusquedaEstudio] = useState('');
    const [catalogoProcedimientos, setCatalogoProcedimientos] = useState([]);
    const [catalogoProcedimientosLoading, setCatalogoProcedimientosLoading] = useState(false);
    const [busquedaProcedimiento, setBusquedaProcedimiento] = useState('');
    const [filtroProcedimientoCategoria, setFiltroProcedimientoCategoria] = useState('todos');
    const [catalogoReferenciasMedicas, setCatalogoReferenciasMedicas] = useState([]);
    const [catalogoReferenciasMedicasLoading, setCatalogoReferenciasMedicasLoading] = useState(false);
    const [busquedaReferencia, setBusquedaReferencia] = useState('');


    const normalizarAlergiaKey = (value = '') => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const esAlergiaNoUtil = (value = '') => {
        const token = normalizarAlergiaKey(value);
        if (!token) return true;
        const descartables = [
            'interrogadas y negadas',
            'preguntados y negados',
            'sin alergias',
            'sin alergia',
            'ninguna',
            'ninguno',
            'na',
            'n a',
            'n a',
            'no refiere alergias',
            'negado',
            'negadas'
        ];
        return descartables.some((item) => token === item);
    };

    const resumenAlergiasPaciente = useMemo(() => {
        const preguntadosNegados = expediente?.antecedentes?.alergias?.preguntados_y_negados === true;
        const listaAlergias = Array.isArray(expediente?.antecedentes?.alergias?.lista)
            ? expediente.antecedentes.alergias.lista
            : [];
        const textoOtros = String(expediente?.antecedentes?.alergias?.otros || expediente?.antecedentes?.alergias?.otras || '').trim();
        const alergiasBase = String(expediente?.px_info?.alergias_base || '').trim();

        const fromLista = listaAlergias
            .map((item) => String(item?.sustancia || item?.nombre || '').trim())
            .filter(Boolean);

        const fromOtros = textoOtros
            .split(/[\n,;/]+/)
            .map((item) => String(item || '').trim())
            .filter(Boolean);

        const fromBase = alergiasBase
            .split(/[\n,;/]+/)
            .map((item) => String(item || '').trim())
            .filter(Boolean);

        const merged = [...fromLista, ...fromOtros, ...fromBase]
            .filter((item) => !esAlergiaNoUtil(item));

        const unique = [];
        const seen = new Set();
        merged.forEach((item) => {
            const key = normalizarAlergiaKey(item);
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(item);
        });

        return {
            preguntadosNegados,
            tieneAlergias: !preguntadosNegados && unique.length > 0,
            items: unique,
            contexto: unique.join(', ')
        };
    }, [
        expediente?.antecedentes?.alergias?.lista,
        expediente?.antecedentes?.alergias?.otros,
        expediente?.antecedentes?.alergias?.otras,
        expediente?.antecedentes?.alergias?.preguntados_y_negados,
        expediente?.px_info?.alergias_base
    ]);



    useEffect(() => {
        if (cie10Valido) return;
        setMostrarMeds(false);
        setIndiceMeds(-1);
    }, [cie10Valido]);

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
        };
        cargarCatalogos();
    }, []);

    useEffect(() => {
        let isMounted = true;
        let fallbackRequested = false;

        const sortStudies = (rows = []) => [...rows].sort((a, b) => String(a?.descripcion || '').localeCompare(String(b?.descripcion || ''), 'es', { sensitivity: 'base' }));

        const applyStudies = (rows = []) => {
            const normalizedRows = sortStudies(Array.isArray(rows) ? rows : []);
            cacheStudies = normalizedRows;
            if (!isMounted) return;
            setCatalogoEstudios(normalizedRows);
            setCatalogoEstudiosLoading(false);
        };

        const applyFallback = async () => {
            if (fallbackRequested) return;
            fallbackRequested = true;
            try {
                const fallbackRows = await loadStudiesFromPublicData();
                const activeRows = (Array.isArray(fallbackRows) ? fallbackRows : []).filter((row) => row.activo !== false);
                applyStudies(activeRows);
            } catch (error) {
                console.error('Error cargando fallback de estudios', error);
                applyStudies([]);
            }
        };

        if (Array.isArray(cacheStudies) && cacheStudies.length > 0) {
            setCatalogoEstudios(cacheStudies);
            setCatalogoEstudiosLoading(false);
        } else {
            setCatalogoEstudiosLoading(true);
        }

        const unsubscribeStudies = onSnapshot(
            collection(db, 'catalogo_estudios'),
            (snap) => {
                const rows = snap.docs
                    .map((d) => normalizeStudyRecord({ id: d.id, ...d.data() }, d.id))
                    .filter((row) => row.descripcion);

                if (snap.size === 0) {
                    applyFallback();
                    return;
                }

                const activeRows = rows.filter((row) => row.activo !== false);
                applyStudies(activeRows);
            },
            (error) => {
                console.error('Error suscribiendo catalogo_estudios en tiempo real', error);
                if (Array.isArray(cacheStudies) && cacheStudies.length > 0) {
                    setCatalogoEstudios(cacheStudies);
                    setCatalogoEstudiosLoading(false);
                    return;
                }
                applyFallback();
            }
        );

        return () => {
            isMounted = false;
            unsubscribeStudies();
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const sortProcedures = (rows = []) => [...rows].sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' }));

        const applyProcedures = (rows = []) => {
            const normalizedRows = sortProcedures(Array.isArray(rows) ? rows : []);
            cacheProcedures = normalizedRows;
            if (!isMounted) return;
            setCatalogoProcedimientos(normalizedRows);
            setCatalogoProcedimientosLoading(false);
        };

        if (Array.isArray(cacheProcedures) && cacheProcedures.length > 0) {
            setCatalogoProcedimientos(cacheProcedures);
            setCatalogoProcedimientosLoading(false);
        } else {
            setCatalogoProcedimientosLoading(true);
        }

        const unsubscribeProcedures = onSnapshot(
            collection(db, 'catalogo_procedimientos'),
            (snap) => {
                const rows = snap.docs
                    .map((d) => normalizeProcedureRecord({ id: d.id, ...d.data() }, d.id))
                    .filter((row) => row.nombre)
                    .filter((row) => row.activo !== false);
                applyProcedures(rows);
            },
            (error) => {
                console.error('Error suscribiendo catalogo_procedimientos en tiempo real', error);
                if (Array.isArray(cacheProcedures) && cacheProcedures.length > 0) {
                    setCatalogoProcedimientos(cacheProcedures);
                    setCatalogoProcedimientosLoading(false);
                    return;
                }
                applyProcedures([]);
            }
        );

        return () => {
            isMounted = false;
            unsubscribeProcedures();
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const sortReferencias = (rows = []) => [...rows].sort((a, b) => String(a?.nombreMedico || '').localeCompare(String(b?.nombreMedico || ''), 'es', { sensitivity: 'base' }));

        const applyReferencias = (rows = []) => {
            const normalizedRows = sortReferencias(Array.isArray(rows) ? rows : []);
            cacheReferenciasMedicas = normalizedRows;
            if (!isMounted) return;
            setCatalogoReferenciasMedicas(normalizedRows);
            setCatalogoReferenciasMedicasLoading(false);
        };

        if (Array.isArray(cacheReferenciasMedicas) && cacheReferenciasMedicas.length > 0) {
            setCatalogoReferenciasMedicas(cacheReferenciasMedicas);
            setCatalogoReferenciasMedicasLoading(false);
        } else {
            setCatalogoReferenciasMedicasLoading(true);
        }

        const unsubscribeReferencias = onSnapshot(
            collection(db, 'catalogo_referencias_medicas'),
            (snap) => {
                const rows = snap.docs
                    .map((d) => normalizeReferenciaMedicaRecord({ id: d.id, ...d.data() }, d.id))
                    .filter((row) => row.nombreMedico)
                    .filter((row) => row.activo !== false);
                applyReferencias(rows);
            },
            (error) => {
                console.error('Error suscribiendo catalogo_referencias_medicas', error);
                if (Array.isArray(cacheReferenciasMedicas) && cacheReferenciasMedicas.length > 0) {
                    setCatalogoReferenciasMedicas(cacheReferenciasMedicas);
                    setCatalogoReferenciasMedicasLoading(false);
                    return;
                }
                applyReferencias([]);
            }
        );

        return () => {
            isMounted = false;
            unsubscribeReferencias();
        };
    }, []);

    // --- CARGA ATAJOS DESDE FIRESTORE ---
    useEffect(() => {
        const unsubSintomas = onSnapshot(
            collection(db, 'catalogo_sintomatologia'),
            (snap) => {
                const items = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(item => item.activo !== false && item.nombre)
                    .sort((a, b) => {
                        const ordenA = Number(a.orden ?? 9999);
                        const ordenB = Number(b.orden ?? 9999);
                        if (ordenA !== ordenB) return ordenA - ordenB;
                        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
                    });
                setAtajos(items.length > 0 ? items : ATAJOS_DEFAULT);
            },
            () => setAtajos(ATAJOS_DEFAULT)
        );

        const unsubCategorias = onSnapshot(
            query(collection(db, 'catalogo_sintomatologia_categorias'), orderBy('orden', 'asc')),
            (snap) => {
                const rows = snap.docs
                    .map((d) => {
                        const data = d.data();
                        return {
                            id: d.id,
                            label: String(data.nombre || '').trim() || titleFromId(d.id),
                            color: data.color || SYMPTOM_CATEGORY_COLOR_FALLBACK,
                            activo: data.activo !== false,
                            orden: Number(data.orden || 999)
                        };
                    })
                    .filter((item) => item.activo !== false);
                setCategoriasSintomas(rows.length > 0 ? rows : SYMPTOM_CATEGORY_DEFAULTS);
            },
            () => setCategoriasSintomas(SYMPTOM_CATEGORY_DEFAULTS)
        );

        return () => {
            unsubSintomas();
            unsubCategorias();
        };
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

    const estudiosTabs = useMemo(() => ([
        { id: 'ecografia', label: 'Ecografia', icon: <ScanLine size={24} /> },
        { id: 'rayos_x', label: 'Rayos X', icon: <Radiation size={24} /> },
        { id: 'estudio_imagen', label: 'Estudios de imagen', icon: <Images size={24} /> },
        { id: 'paquete', label: 'Paquetes', icon: <Boxes size={24} /> },
        { id: 'laboratorio', label: 'Laboratorios individuales', icon: <Microscope size={24} /> }
    ]), []);

    const esTabPaquete = activeEstudiosTab === 'paquete';
    const tituloTabEstudios = getStudyCategoryLabel(activeEstudiosTab);

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
                    paqueteOrigen: String(item?.paqueteOrigen || '').trim(),
                    categoria: normalizeStudyCategory(item?.categoria || item?.tipo || 'laboratorio')
                };
            })
            .filter((item) => item.nombre);
    }, [expediente?.consulta?.estudios?.estudios_seleccionados]);

    const estudiosDisponiblesFiltrados = useMemo(() => {
        if (esTabPaquete) return [];

        const seleccionados = new Set(estudiosSeleccionadosNormalizados.map((item) => item.nombre.toLowerCase()));
        const q = busquedaEstudio.trim().toLowerCase();

        return catalogoEstudios
            .filter((item) => normalizeStudyCategory(item.categoria) === activeEstudiosTab)
            .filter((item) => !seleccionados.has(item.descripcion.toLowerCase()))
            .filter((item) => {
                if (!q) return true;
                return (`${item.descripcion} ${item.clave}`).toLowerCase().includes(q);
            })
            .slice(0, 40);
    }, [activeEstudiosTab, busquedaEstudio, catalogoEstudios, esTabPaquete, estudiosSeleccionadosNormalizados]);

    const paquetesSeleccionados = expediente?.consulta?.estudios?.paquetes_seleccionados || [];

    const prioridadProcedimientoDefault = PROCEDURE_PRIORITY_OPTIONS[0].id;
    const estadoProcedimientoDefault = PROCEDURE_STATUS_OPTIONS[0].id;

    const procedimientosSeleccionadosNormalizados = useMemo(() => {
        const source = expediente?.consulta?.procedimientos?.seleccionados || [];
        if (!Array.isArray(source)) return [];

        return source
            .map((item, index) => {
                if (!item || typeof item !== 'object') {
                    const nombreLegacy = String(item || '').trim();
                    if (!nombreLegacy) return null;
                    return {
                        id: `manual-${index}`,
                        clave: '',
                        nombre: nombreLegacy,
                        categoria: 'otro',
                        duracionMin: 20,
                        requiereConsentimiento: false,
                        consentimientoFirmado: false,
                        prioridad: prioridadProcedimientoDefault,
                        estado: estadoProcedimientoDefault,
                        sitio: '',
                        nota: ''
                    };
                }

                const nombre = String(item.nombre || item.descripcion || item.procedimiento || '').trim();
                if (!nombre) return null;

                const requiereConsentimiento = item.requiereConsentimiento === true;

                return {
                    id: String(item.id || `manual-${index}`).trim() || `manual-${index}`,
                    clave: String(item.clave || '').trim(),
                    nombre,
                    categoria: normalizeProcedureCategory(item.categoria || item.tipo || 'otro'),
                    duracionMin: Number.isFinite(Number(item.duracionMin)) ? Math.max(1, Number(item.duracionMin)) : 20,
                    descripcion: String(item.descripcion || '').trim(),
                    preparacion: String(item.preparacion || '').trim(),
                    contraindicaciones: String(item.contraindicaciones || '').trim(),
                    requiereConsentimiento,
                    consentimientoFirmado: requiereConsentimiento ? item.consentimientoFirmado === true : false,
                    prioridad: String(item.prioridad || prioridadProcedimientoDefault).trim() || prioridadProcedimientoDefault,
                    estado: String(item.estado || estadoProcedimientoDefault).trim() || estadoProcedimientoDefault,
                    sitio: String(item.sitio || ''),
                    nota: String(item.nota || '')
                };
            })
            .filter(Boolean);
    }, [estadoProcedimientoDefault, expediente?.consulta?.procedimientos?.seleccionados, prioridadProcedimientoDefault]);

    const categoriasProcedimientosConConteo = useMemo(() => {
        return PROCEDURE_CATEGORY_OPTIONS.map((option) => ({
            ...option,
            count: catalogoProcedimientos.filter((item) => normalizeProcedureCategory(item.categoria) === option.id).length
        }));
    }, [catalogoProcedimientos]);

    const procedimientosDisponiblesFiltrados = useMemo(() => {
        const seleccionados = new Set(procedimientosSeleccionadosNormalizados.map((item) => item.id));
        const q = String(busquedaProcedimiento || '').trim().toLowerCase();

        return catalogoProcedimientos
            .filter((item) => filtroProcedimientoCategoria === 'todos' || normalizeProcedureCategory(item.categoria) === filtroProcedimientoCategoria)
            .filter((item) => !seleccionados.has(item.id))
            .filter((item) => {
                if (!q) return true;
                return (`${item.nombre} ${item.clave || ''} ${item.descripcion || ''}`).toLowerCase().includes(q);
            })
            .slice(0, 40);
    }, [busquedaProcedimiento, catalogoProcedimientos, filtroProcedimientoCategoria, procedimientosSeleccionadosNormalizados]);

    const agregarProcedimientoDesdeCatalogo = (item) => {
        if (!item?.id || !item?.nombre) return;

        const exists = procedimientosSeleccionadosNormalizados.some((proc) => proc.id === item.id);
        if (exists) {
            showNotification('Ese procedimiento ya esta agregado.', 'error');
            return;
        }

        updateCampo('consulta.procedimientos.seleccionados', [
            ...procedimientosSeleccionadosNormalizados,
            {
                id: item.id,
                clave: item.clave || '',
                nombre: item.nombre,
                categoria: normalizeProcedureCategory(item.categoria),
                duracionMin: item.duracionMin || 20,
                descripcion: item.descripcion || '',
                preparacion: item.preparacion || '',
                contraindicaciones: item.contraindicaciones || '',
                requiereConsentimiento: item.requiereConsentimiento === true,
                consentimientoFirmado: false,
                prioridad: prioridadProcedimientoDefault,
                estado: estadoProcedimientoDefault,
                sitio: '',
                nota: ''
            }
        ]);
    };

    const updateProcedimientoSeleccionado = (index, patch = {}) => {
        updateCampo(
            'consulta.procedimientos.seleccionados',
            procedimientosSeleccionadosNormalizados.map((item, idx) => {
                if (idx !== index) return item;
                const next = { ...item, ...patch };
                if (next.requiereConsentimiento !== true) {
                    next.consentimientoFirmado = false;
                }
                return next;
            })
        );
    };

    const removeProcedimientoSeleccionado = (index) => {
        updateCampo(
            'consulta.procedimientos.seleccionados',
            procedimientosSeleccionadosNormalizados.filter((_, idx) => idx !== index)
        );
    };

    const referenciasSeleccionadasNormalizadas = useMemo(() => {
        const source = expediente?.consulta?.referencias_medicas?.seleccionadas || [];
        if (!Array.isArray(source)) return [];
        return source.filter((item) => item && item.id && item.nombreMedico);
    }, [expediente?.consulta?.referencias_medicas?.seleccionadas]);

    const referenciasDisponiblesFiltradas = useMemo(() => {
        const seleccionadas = new Set(referenciasSeleccionadasNormalizadas.map((item) => item.id));
        const q = String(busquedaReferencia || '').trim().toLowerCase();

        return catalogoReferenciasMedicas
            .filter((item) => !seleccionadas.has(item.id))
            .filter((item) => {
                if (!q) return true;
                return (
                    `${item.nombreMedico} ${item.especialidad} ${item.diagnostico || ''} ${item.telefonoConsultorio || ''} ${item.direccionConsultorio || ''}`
                        .toLowerCase()
                        .includes(q)
                );
            })
            .slice(0, 40);
    }, [busquedaReferencia, catalogoReferenciasMedicas, referenciasSeleccionadasNormalizadas]);

    const agregarReferenciaDesdeCatalogo = (item) => {
        if (!item?.id || !item?.nombreMedico) return;

        const exists = referenciasSeleccionadasNormalizadas.some((ref) => ref.id === item.id);
        if (exists) {
            showNotification('Esa referencia médica ya está agregada.', 'error');
            return;
        }

        updateCampo('consulta.referencias_medicas.seleccionadas', [
            ...referenciasSeleccionadasNormalizadas,
            {
                id: item.id,
                especialidad: item.especialidad || '',
                tipoCita: item.tipoCita || TIPO_CITA_OPTIONS[0]?.id || 'primera_vez',
                esUrgente: false,
                nombreMedico: item.nombreMedico,
                telefonoConsultorio: item.telefonoConsultorio || '',
                direccionConsultorio: item.direccionConsultorio || '',
                diagnostico: '',
                datosExtras: '',
                notas: ''
            }
        ]);
    };

    const updateReferenciaSeleccionada = (index, patch = {}) => {
        updateCampo(
            'consulta.referencias_medicas.seleccionadas',
            referenciasSeleccionadasNormalizadas.map((item, idx) => {
                if (idx !== index) return item;
                return { ...item, ...patch };
            })
        );
    };

    const removeReferenciaSeleccionada = (index) => {
        updateCampo(
            'consulta.referencias_medicas.seleccionadas',
            referenciasSeleccionadasNormalizadas.filter((_, idx) => idx !== index)
        );
    };

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
                        paqueteOrigen: nombrePaquete,
                        categoria: 'laboratorio'
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
            : [...estudiosSeleccionadosNormalizados, { nombre: item.descripcion, clave: item.clave || '', nota: '', categoria: normalizeStudyCategory(item.categoria || activeEstudiosTab) }];
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
            { nombre, clave: '', nota: '', capturaManual: true, categoria: normalizeStudyCategory(activeEstudiosTab) }
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
            const t = setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);
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

        switch (nivel) {
            case '1': return { borderLeft: 'border-blue-500', bg: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-800' };
            case '2': return { borderLeft: 'border-emerald-500', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-800' };
            case '3': return { borderLeft: 'border-yellow-400', bg: 'bg-yellow-400', bgLight: 'bg-yellow-50', text: 'text-yellow-800' };
            case '4': return { borderLeft: 'border-orange-500', bg: 'bg-orange-500', bgLight: 'bg-orange-50', text: 'text-orange-800' };
            case '5': return { borderLeft: 'border-red-500', bg: 'bg-red-500', bgLight: 'bg-red-50', text: 'text-red-800' };
            default: return { borderLeft: 'border-slate-300', bg: 'bg-slate-300', bgLight: 'bg-white', text: 'text-slate-800' };
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

    // --- LÓGICA DE ALERGIAS Y RIESGOS ---
    const getNivelRiesgoBadge = (nivel) => {
        switch (String(nivel).toLowerCase()) {
            case 'alto': return 'bg-red-100 text-red-700 border-red-200';
            case 'medio': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'bajo': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const sugerirQueEvitarPorAlergias = async () => {
        if (!resumenAlergiasPaciente.tieneAlergias) {
            showNotification('No hay alergias registradas para este paciente', 'error');
            return;
        }
        if (!cacheMeds || cacheMeds.length === 0) {
            showNotification('No hay medicamentos en el catálogo', 'error');
            return;
        }
        setCargandoSugerenciasEvitarAlergia(true);
        setSugerenciasEvitarAlergia([]);
        try {
            // FASE 1: Detección local de alergias directas (sin IA)
            const alergiasLower = resumenAlergiasPaciente.items.map(a => normalizarAlergiaKey(a));
            const directos = [];
            const resto = [];

            for (const m of cacheMeds) {
                const sustanciasStr = (m.sustanciasActivas || '').toLowerCase();
                if (!sustanciasStr) { resto.push(m); continue; }
                const sustanciasArr = sustanciasStr.split(/[,;/]+/).map(s => normalizarAlergiaKey(s)).filter(Boolean);
                if (sustanciasArr.length === 0) { resto.push(m); continue; }

                const alergiaMatch = alergiasLower.find(alergia =>
                    sustanciasArr.some(s => s === alergia || s.includes(alergia) || alergia.includes(s))
                );
                if (alergiaMatch) {
                    directos.push({
                        item: m.nombreComercial,
                        nivel: 'alto',
                        motivo: `Contiene sustancia relacionada con la alergia a "${alergiaMatch}". Alergia directa.`
                    });
                } else {
                    resto.push(m);
                }
            }

            // FASE 2: IA para reacción cruzada (solo medicamentos sin alergia directa)
            let cruzados = [];
            if (resto.length > 0) {
                const alergiasTexto = resumenAlergiasPaciente.items.join(', ');
                const restoResumen = resto.slice(0, 60).map(m =>
                    `${m.nombreComercial}|${m.sustanciasActivas}`
                ).join('\n');

                const askGemini = httpsCallable(functions, 'askGemini');
                const response = await askGemini({
                    prompt: `Eres un validador farmacológico. Identifica SOLO medicamentos con REACCIÓN CRUZADA documentada (NO alergia directa).

DATOS:
- Alergias del paciente: "${alergiasTexto}"
- Medicamentos a evaluar (Nombre|SustanciaActiva):
${restoResumen}

TABLA DE REACTIVIDAD CRUZADA:
- BETA-LACTÁMICOS: penicilina, amoxicilina, ampicilina, piperacilina, dicloxacilina
- CEFALOSPORINAS con cruce a penicilinas: cefadroxilo, cefalexina, cefaclor (~1-2%)
- CEFALOSPORINAS SIN cruce: ceftriaxona, cefotaxima, cefepime, ceftazidima
- SULFONAMIDAS: sulfametoxazol, sulfasalazina, sulfadiazina, sulfacetamida. NO cruzan con furosemida, tiazidas, celecoxib
- AINEs subgrupo salicilatos: aspirina↔diflunisal
- AINEs subgrupo propiónico: ibuprofeno↔naproxeno↔ketoprofeno
- AINEs subgrupo oxicams: piroxicam↔meloxicam
- AINEs subgrupo acético: diclofenaco↔indometacina↔ketorolaco
- Paracetamol NO es AINE. Metamizol NO cruza con AINEs.

REGLAS: Solo marca si ALERGIA y MEDICAMENTO están en el MISMO grupo de la tabla. No inventes cruces. Si duda → no incluir.

Responde SOLO JSON sin markdown:
[{"medicamento":"NombreComercialExacto","nivel":"alto|medio","tipo":"reaccion_cruzada","motivo":"breve"}]

Si no hay reacción cruzada, responde []`
                });

                let text = (response?.data?.result || '').replace(/```json/g, '').replace(/```/g, '').trim();
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']');
                if (start !== -1 && end !== -1) text = text.substring(start, end + 1);
                const resultados = JSON.parse(text);

                if (Array.isArray(resultados) && resultados.length > 0) {
                    cruzados = resultados.map(r => ({
                        item: r.medicamento,
                        nivel: r.nivel || 'medio',
                        motivo: r.motivo || ''
                    }));
                }
            }

            const todos = [...directos, ...cruzados];
            if (todos.length === 0) {
                setSugerenciasEvitarAlergia([{ item: 'No se detectaron contraindicaciones relevantes. Verifique manualmente.', nivel: 'ninguno', motivo: '' }]);
                showNotification('Sin contraindicaciones detectadas', 'success');
            } else {
                setSugerenciasEvitarAlergia(todos);
                showNotification(`${directos.length} por alergia directa + ${cruzados.length} por reacción cruzada`, 'success');
            }
        } catch (err) {
            console.error('Error sugerencias evitar alergias:', err);
            showNotification('Error al consultar IA para alergias', 'error');
        } finally {
            setCargandoSugerenciasEvitarAlergia(false);
        }
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
            const catalogoResumen = cacheMeds.slice(0, 80).map(m =>
                `${m.nombreComercial}|${m.sustanciasActivas}|${m.indicacion || ''}`
            ).join('\n');

            const askGemini = httpsCallable(functions, 'askGemini');
            const response = await askGemini({
                prompt: `Eres un médico farmacólogo experto. El paciente presenta: "${motivo}".
Del siguiente catálogo de medicamentos disponibles, sugiere los 5 más apropiados para este cuadro clínico.
CATÁLOGO (formato: NombreComercial|SustanciaActiva|Indicación):
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



    const handleAgregarMedicamento = () => {
        if (!cie10Valido) {
            showNotification('Selecciona primero un CIE-10 válido antes de agregar medicamentos.', 'error');
            enfocarDiagnosticoCie10();
            return;
        }

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
            setDuplicadoMedicamento(tempMed.nombre);
            setShowDuplicadoModal(true);
            return;
        }

        ejecutarAgregado();
    };

    const handleDosisKeyDown = (event) => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        handleAgregarMedicamento();
    };

    const ejecutarAgregado = () => {
        updateCampo('consulta.diagnostico.tratamiento_lista', [...(expediente.consulta.diagnostico.tratamiento_lista || []), tempMed]);
        setTempMed({ nombre: '', dosis: '', presentacion: '', sustanciasActivas: '', numeroAcomodo: '' });
        setDosisRecomendada('');
        setResultadoCalc('');
        setShowCalculadora(false);
        setShowDuplicadoModal(false);
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

        const dosis = String(medEdicion.dosis || '').trim();
        if (!dosis) {
            showNotification('La dosis no puede estar vacía', 'error');
            return;
        }

        const listaActual = expediente.consulta.diagnostico.tratamiento_lista || [];
        const nuevaLista = listaActual.map((item, idx) => {
            if (idx !== editandoMedIndex) return item;
            return {
                ...item,
                dosis
            };
        });

        updateCampo('consulta.diagnostico.tratamiento_lista', nuevaLista);
        cancelarEdicionMedicamento();
        showNotification('Medicamento actualizado', 'success');
    };

    const handleEdicionDosisKeyDown = (event) => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        guardarEdicionMedicamento();
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

    const moverMedicamentoArriba = (index) => {
        if (index <= 0) return;
        const listaActual = [...(expediente.consulta.diagnostico.tratamiento_lista || [])];
        const temp = listaActual[index - 1];
        listaActual[index - 1] = listaActual[index];
        listaActual[index] = temp;
        updateCampo('consulta.diagnostico.tratamiento_lista', listaActual);

        if (editandoMedIndex === index) setEditandoMedIndex(index - 1);
        else if (editandoMedIndex === index - 1) setEditandoMedIndex(index);
    };

    const moverMedicamentoAbajo = (index) => {
        const listaActual = [...(expediente.consulta.diagnostico.tratamiento_lista || [])];
        if (index >= listaActual.length - 1) return;
        const temp = listaActual[index + 1];
        listaActual[index + 1] = listaActual[index];
        listaActual[index] = temp;
        updateCampo('consulta.diagnostico.tratamiento_lista', listaActual);

        if (editandoMedIndex === index) setEditandoMedIndex(index + 1);
        else if (editandoMedIndex === index + 1) setEditandoMedIndex(index);
    };

    const toggleDictado = () => {
        if (!('webkitSpeechRecognition' in window)) return alert("Navegador no soportado");
        if (isListening) { setIsListening(false); return; }
        const recognition = new window.webkitSpeechRecognition();
        recognition.lang = 'es-MX'; recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false);
        recognition.onresult = (e) => { const t = e.results[0][0].transcript; updateCampo('consulta.padecimiento', (expediente.consulta.padecimiento || '') + " " + t); };
        recognition.start();
    };

    const glassCard = "bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col min-h-0";
    const inputStyle = "w-full p-3 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-colors text-sm text-slate-700 placeholder:text-slate-400";
    const labelStyle = "text-[11px] font-semibold text-slate-500 uppercase mb-1.5 ml-1 block tracking-wide";
    const buttonPrimary = "bg-blue-600 text-white hover:bg-blue-700";

    // ==========================================
    // RENDERS
    // ==========================================

    const renderPadecimiento = () => (
        <div className={`${glassCard} w-full p-6 lg:h-full`}>
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100"><FileText size={24} /></div>
                    <div><h3 className="font-bold text-slate-800 text-xl tracking-tight">Motivo de Consulta</h3><p className="text-sm text-slate-400 font-medium">Historia clínica y síntomas</p></div>
                </div>
                <button title="Dictado por voz" onClick={toggleDictado} className={`p-3 rounded-lg transition-colors flex items-center gap-2 ${isListening ? 'bg-rose-500 text-white' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}><Mic size={20} /></button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 lg:min-h-[350px]">
                <div className="flex flex-col">
                    <textarea className="flex-1 w-full min-h-[180px] p-4 lg:p-5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 text-base leading-relaxed focus:bg-white focus:border-blue-300 transition-colors resize-none"
                        placeholder="¿Cuál es el motivo de la consulta hoy?" value={expediente.consulta.padecimiento} onChange={e => updateCampo('consulta.padecimiento', e.target.value)} />

                    {relacionados.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 pb-1">
                            <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-semibold whitespace-nowrap shrink-0">
                                <Link2 size={11} /> Relacionados:
                            </span>
                            {relacionados.map(r => (
                                <button key={r} onClick={() => usarRelacionado(r)}
                                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap">
                                    + {r}
                                </button>
                            ))}
                            <button onClick={() => setRelacionados([])} className="p-1 text-slate-400 hover:text-slate-600 shrink-0"><X size={12} /></button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-hidden max-h-72 lg:max-h-none">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sintomatología rápida</p>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5">
                        {categoriasConItems.map((cat) => (
                            <div key={cat.id}>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className={`w-2 h-2 rounded-full ${cat.color || SYMPTOM_CATEGORY_COLOR_FALLBACK}`}></span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{cat.label}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 ml-3.5">
                                    {cat.items.map((a) => (
                                        <button key={a.nombre} onClick={() => usarAtajo(a.nombre)}
                                            className="px-2 py-1 border rounded-md text-[11px] font-semibold transition-all whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm active:scale-95">
                                            {a.nombre}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );

    const renderExploracion = () => (
        <div className="flex flex-col lg:flex-row w-full min-h-0 gap-3 lg:gap-6 lg:h-full">
            <div className="w-full lg:w-64 flex flex-row lg:flex-col gap-2 lg:gap-3 shrink-0 bg-white p-2 lg:p-4 rounded-2xl border border-slate-200 lg:h-full overflow-x-auto lg:overflow-y-auto shadow-sm">
                {[{ id: 'signos', l: 'Signos Vitales', i: <Activity size={18} /> }, { id: 'colesterol', l: 'Bioquímica', i: <Droplet size={18} /> }, { id: 'fisica', l: 'Exploración Física', i: <Eye size={18} /> }, { id: 'glucosa', l: 'Glucometría', i: <FlaskConical size={18} /> }].map(it => (
                    <button key={it.id} onClick={() => setActiveExploracion(it.id)} className={`p-2.5 lg:p-3 rounded-lg flex items-center gap-2 lg:gap-3 text-xs lg:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${activeExploracion === it.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                        <span className={activeExploracion === it.id ? 'text-indigo-500' : ''}>{it.i}</span> {it.l}
                    </button>
                ))}

                <div className="hidden lg:block flex-1"></div>

                {resumenAlergiasPaciente.tieneAlergias && (
                    <div className="hidden lg:block bg-rose-50 border border-rose-100 p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-rose-600">
                            <AlertTriangle size={18} />
                            <span className="text-xs font-black uppercase tracking-wider">Alergias</span>
                        </div>
                        <p className="text-sm font-bold text-rose-800 leading-tight">
                            {resumenAlergiasPaciente.contexto}
                        </p>
                    </div>
                )}
            </div>

            <div className={`${glassCard} flex-1 min-h-0`}>
                <div className="p-4 md:p-8 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:custom-scrollbar">
                    {activeExploracion === 'signos' && (
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex gap-2 border-b border-slate-100 pb-2">
                                    <Activity size={18} className="text-indigo-500" /> Vitales
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                                    {['TA', 'Temp', 'FC', 'FR', 'SpO2'].map(l => (
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
                                    <Scissors className="rotate-90 text-indigo-500" /> Antropometría
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
                                    <div>
                                        <label className={labelStyle}>Peso (kg)</label>
                                        <input
                                            type="number"
                                            className={inputStyle}
                                            value={expediente.consulta.exploracion.antropometria.peso}
                                            onChange={e => {
                                                updateCampo('consulta.exploracion.antropometria.peso', e.target.value);
                                                const t = expediente.consulta.exploracion.antropometria.talla;
                                                if (t) updateCampo('consulta.exploracion.antropometria.imc', (e.target.value / (t * t)).toFixed(2));
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
                                                if (p) updateCampo('consulta.exploracion.antropometria.imc', (p / (e.target.value * e.target.value)).toFixed(2));
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
                                            onChange={e => updateCampo('consulta.exploracion.colesterol.trigliceridos', e.target.value)}
                                        />
                                        <span className="text-sm font-bold text-slate-800 w-12">mg/dl</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold text-slate-800 w-32">Colesterol:</label>
                                        <input
                                            className="flex-1 p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all shadow-sm font-medium text-slate-700"
                                            type="number"
                                            value={expediente.consulta.exploracion.colesterol.colesterol || ''}
                                            onChange={e => updateCampo('consulta.exploracion.colesterol.colesterol', e.target.value)}
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
                                        onChange={e => updateCampo('consulta.exploracion.colesterol.hba1c', e.target.value)}
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
                                        onChange={e => setTempGlucosa({ ...tempGlucosa, fecha: e.target.value })}
                                    />
                                </div>
                                <div className="flex-1 min-w-[220px]">
                                    <label className={labelStyle}>Categoría:</label>
                                    <select
                                        className={`${inputStyle} py-2.5`}
                                        value={tempGlucosa.categoria}
                                        onChange={e => setTempGlucosa({ ...tempGlucosa, categoria: e.target.value })}
                                    >
                                        {[
                                            'Antes del desayuno',
                                            '2 horas después del desayuno',
                                            'Antes de la comida',
                                            '2 horas después de la comida',
                                            'Antes de la cena',
                                            '2 horas después de la cena'
                                        ].map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className={labelStyle}>Glucosa:</label>
                                    <input
                                        type="number"
                                        className={`${inputStyle} py-2.5`}
                                        value={tempGlucosa.valor}
                                        onChange={e => setTempGlucosa({ ...tempGlucosa, valor: e.target.value })}
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
                                        onClick={() => {
                                            if (tempGlucosa.valor) {
                                                const fechaAGuardar = tempGlucosa.fecha || new Date().toISOString().split('T')[0];
                                                updateCampo('consulta.exploracion.glucosa.lista', [...expediente.consulta.exploracion.glucosa.lista, { ...tempGlucosa, fecha: fechaAGuardar }]);
                                                setTempGlucosa({ ...tempGlucosa, valor: '' });
                                            }
                                        }}
                                        className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors text-sm"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col mt-2">
                                <div className="grid grid-cols-[90px_1fr_84px_40px] md:grid-cols-[120px_1fr_100px_50px] bg-blue-50/60 py-3 px-3 md:px-6 text-left text-[11px] font-black text-blue-800 tracking-wide border-b border-slate-200 shrink-0">
                                    <span>Fecha</span>
                                    <span>Categoría</span>
                                    <span className="text-center">Glucosa</span>
                                    <span></span>
                                </div>
                                <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar">
                                    {expediente.consulta.exploracion.glucosa.lista.map((g, i) => (
                                        <div key={i} className="grid grid-cols-[90px_1fr_84px_40px] md:grid-cols-[120px_1fr_100px_50px] py-3 px-3 md:px-6 border-b border-slate-50 items-center hover:bg-slate-50 transition-colors">
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
                                                <button onClick={() => updateCampo('consulta.exploracion.glucosa.lista', expediente.consulta.exploracion.glucosa.lista.filter((_, x) => x !== i))} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 size={16} />
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

            </div>
        </div>
    );

    const renderDiagnostico = () => (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-full w-full relative overflow-y-auto lg:overflow-visible custom-scrollbar">

            {/* --- COLUMNA IZQUIERDA: DIAGNÓSTICO Y AGREGAR RECETA --- */}
            <div className="w-full lg:w-1/2 flex flex-col gap-4 lg:gap-6 lg:h-full">
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
                                                        disabled={!recetaHabilitada}
                                                        onClick={() => {
                                                            setTempMed({ nombre: m.nombreComercial, dosis: '', presentacion: m.presentacion || '', sustanciasActivas: m.sustanciasActivas || '', numeroAcomodo: m.numeroAcomodo || '', grupo: m.grupo || m.marca || '', marca: m.grupo || m.marca || '', nivelUtilidad: m.nivelUtilidad || null, color: m.color || '' });
                                                            setDosisRecomendada(m.dosisCatalogo || '');
                                                            setMedSeleccionadoDetalle(m);
                                                        }}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all border-l-[3px] ${utilidad.borderLeft} ${utilidad.bgLight} ${recetaHabilitada ? 'hover:shadow-sm hover:brightness-95' : 'opacity-50 cursor-not-allowed'}`}
                                                    >
                                                        <span className={`${utilidad.text}`}>{m.nombreComercial}</span>
                                                        {m.sustanciasActivas && <span className="opacity-70 font-normal hidden sm:inline">· {m.sustanciasActivas.split(',')[0]}</span>}
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
                                    onChange={(e) => {
                                        const t = e.target.value;
                                        const q = t.toLowerCase().trim();
                                        const qCode = q.replace(/[^a-z0-9]/g, '');
                                        updateCampo('consulta.diagnostico.enfermedad_actual', t);
                                        setCie10Valido(false);
                                        setIndiceCie10(-1);
                                        if (t.length > 1 && cacheCie10) {
                                            setSugerenciasCie10(
                                                cacheCie10.filter(i => {
                                                    if (String(i.code || '').includes('-')) return false;
                                                    const code = String(i.code || '').toLowerCase();
                                                    const codeCompact = code.replace(/[^a-z0-9]/g, '');
                                                    return matchFuzzy(i.description, t) || code.includes(q) || codeCompact.startsWith(qCode) || codeCompact.includes(qCode);
                                                }).slice(0, 20)
                                            );
                                            setMostrarCie10(true)
                                        } else { setMostrarCie10(false) }
                                    }}
                                    onKeyDown={(e) => {
                                        if (!mostrarCie10 || sugerenciasCie10.length === 0) return;
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceCie10(p => p < sugerenciasCie10.length - 1 ? p + 1 : 0); }
                                        else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceCie10(p => p > 0 ? p - 1 : sugerenciasCie10.length - 1); }
                                        else if (e.key === 'Enter' && indiceCie10 >= 0) { e.preventDefault(); const s = sugerenciasCie10[indiceCie10]; updateCampo('consulta.diagnostico.enfermedad_actual', `${s.code} - ${s.description}`); setCie10Valido(true); setMostrarCie10(false); setIndiceCie10(-1); }
                                        else if (e.key === 'Escape') { setMostrarCie10(false); setIndiceCie10(-1); }
                                    }}
                                    onBlur={() => setTimeout(() => { setMostrarCie10(false); setIndiceCie10(-1) }, 200)} />
                                {cie10Valido
                                    ? <CheckCircle className="absolute right-4 top-4 text-emerald-500" size={18} />
                                    : <Search className="absolute right-4 top-4 text-slate-400" size={18} />}
                                {mostrarCie10 && <div ref={refListaCie10} className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto p-1 z-50">{sugerenciasCie10.length > 0 ? sugerenciasCie10.map((s, i) => <div key={i} onClick={() => { updateCampo('consulta.diagnostico.enfermedad_actual', `${s.code} - ${s.description}`); setCie10Valido(true); setMostrarCie10(false); setIndiceCie10(-1) }} ref={el => { if (i === indiceCie10 && el) el.scrollIntoView({ block: 'nearest' }) }} className={`p-2 rounded-lg text-xs cursor-pointer truncate border-b border-slate-50 last:border-0 ${i === indiceCie10 ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-blue-50'}`}><span className="font-bold text-blue-600">{s.code}</span> — {s.description}</div>) : <div className="p-3 text-xs text-slate-400 text-center">Sin resultados en el catálogo CIE-10</div>}</div>}
                            </div>
                            {!cie10Valido && expediente.consulta.diagnostico.enfermedad_actual && (
                                <div className="flex items-center gap-1.5 mt-1.5 px-1">
                                    <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                                    <span className="text-[11px] text-amber-600 font-medium">Selecciona un código CIE-10 válido del catálogo</span>
                                </div>
                            )}
                        </div>

                        {resumenAlergiasPaciente.tieneAlergias && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-rose-700">Alerta de alergias del paciente</p>
                                            <p className="text-[11px] text-rose-700/90 mt-1">Verifica contraindicaciones antes de recetar. La validación IA también se ejecuta al agregar cada medicamento.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={sugerirQueEvitarPorAlergias}
                                        disabled={cargandoSugerenciasEvitarAlergia}
                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-rose-200 bg-white text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                    >
                                        {cargandoSugerenciasEvitarAlergia ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                                        IA: qué evitar
                                    </button>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {resumenAlergiasPaciente.items.slice(0, 8).map((item) => (
                                        <span key={item} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-200 bg-white text-rose-700">
                                            {item}
                                        </span>
                                    ))}
                                    {resumenAlergiasPaciente.items.length > 8 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-200 bg-white text-rose-700">
                                            +{resumenAlergiasPaciente.items.length - 8} más
                                        </span>
                                    )}
                                </div>

                                {sugerenciasEvitarAlergia.length > 0 && (
                                    <div className="mt-3 rounded-lg border border-rose-200 bg-white p-3">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-rose-600 mb-2">Sugerencias IA de no uso</p>
                                        <div className="space-y-1.5">
                                            {sugerenciasEvitarAlergia.map((item, idx) => (
                                                <div key={`${item.item}-${idx}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs font-semibold text-slate-700">{idx + 1}. {item.item}</p>
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full border ${getNivelRiesgoBadge(item.nivel)}`}>
                                                            {item.nivel}
                                                        </span>
                                                    </div>
                                                    {item.motivo && <p className="text-[11px] text-slate-500 mt-1">{item.motivo}</p>}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-2 italic">Referencia IA: confirmar con criterio clínico y farmacológico.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* BLOQUE NUEVA RECETA */}
                        <div className={`relative bg-slate-50 p-6 rounded-2xl border ${!cie10Valido ? 'border-red-200' : 'border-slate-200'} flex flex-col gap-4 transition-colors`}>
                            {!cie10Valido && (
                                <div
                                    className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl cursor-pointer hover:bg-red-100 transition-colors relative z-0"
                                    onClick={enfocarDiagnosticoCie10}
                                >
                                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                                    <p className="text-[12px] font-semibold text-red-600">Selecciona un diagnóstico CIE-10 válido antes de recetar</p>
                                    <ChevronRight size={14} className="text-red-400 ml-auto shrink-0" />
                                </div>
                            )}
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex gap-2"><Zap size={16} className="text-blue-500" /> Nueva Receta</h4>

                            {/* Buscador de Medicamento con Colores */}
                            <div className="relative z-20">
                                <input
                                    disabled={!recetaHabilitada}
                                    className={`${inputStyle} ${!recetaHabilitada ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : isMedNameLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="Nombre del medicamento..."
                                    value={tempMed.nombre}
                                    readOnly={isMedNameLocked || !recetaHabilitada}
                                    onChange={e => {
                                        if (isMedNameLocked || !recetaHabilitada) return;
                                        const v = e.target.value;
                                        setTempMed({ ...tempMed, nombre: v });
                                        setDosisRecomendada('');
                                        setIndiceMeds(-1);
                                        if (v.length > 2 && cacheMeds) {
                                            setSugerenciasMeds(
                                                cacheMeds.filter((m) =>
                                                    matchFuzzy(`${m.nombreComercial} ${m.sustanciasActivas} ${m.grupo} ${m.laboratorio} ${m.presentacion} ${m.indicacion} ${m.numeroAcomodo}`, v)
                                                ).sort((a, b) => {
                                                    const getNivel = (m) => Number(m.nivelUtilidad || 0) || Number(String(m.grupo || m.marca || '').match(/(\d)\s*$/)?.[1] || 0) || 99;
                                                    const nivelA = [1, 2, 3, 4, 5].includes(getNivel(a)) ? getNivel(a) : 99;
                                                    const nivelB = [1, 2, 3, 4, 5].includes(getNivel(b)) ? getNivel(b) : 99;
                                                    return nivelA - nivelB;
                                                }).slice(0, 20)
                                            );
                                            setMostrarMeds(true);
                                        } else {
                                            setMostrarMeds(false);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (isMedNameLocked || !recetaHabilitada) return;
                                        if (!mostrarMeds || sugerenciasMeds.length === 0) return;
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceMeds(p => p < sugerenciasMeds.length - 1 ? p + 1 : 0); }
                                        else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceMeds(p => p > 0 ? p - 1 : sugerenciasMeds.length - 1); }
                                        else if (e.key === 'Enter' && indiceMeds >= 0) {
                                            e.preventDefault();
                                            const m = sugerenciasMeds[indiceMeds];
                                            setTempMed({ nombre: m.nombreComercial, dosis: '', presentacion: m.presentacion || '', sustanciasActivas: m.sustanciasActivas || '', numeroAcomodo: m.numeroAcomodo || '', grupo: m.grupo || '', marca: m.grupo || '', nivelUtilidad: m.nivelUtilidad || null, color: m.color || '' });
                                            setDosisRecomendada(m.dosisCatalogo || 'No hay dosis recomendada en el catálogo.');
                                            setMedSeleccionadoDetalle(m);
                                            setMostrarMeds(false); setIndiceMeds(-1);
                                        }
                                        else if (e.key === 'Escape') { setMostrarMeds(false); setIndiceMeds(-1); }
                                    }}
                                    onBlur={() => setTimeout(() => { setMostrarMeds(false); setIndiceMeds(-1) }, 200)}
                                />
                                {isMedNameLocked && (
                                    <button
                                        type="button"
                                        onClick={resetMedSelection}
                                        className="absolute right-2 top-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                                    >
                                        Cambiar
                                    </button>
                                )}

                                {mostrarMeds && (
                                    <div ref={refListaMeds} className="absolute top-full w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-80 overflow-y-auto p-1 z-50">
                                        {sugerenciasMeds.map((m, i) => {
                                            const utilidad = getMarcaColor(m.grupo || m.marca, m.nivelUtilidad);
                                            return (
                                                <div key={i}
                                                    ref={el => { if (i === indiceMeds && el) el.scrollIntoView({ block: 'nearest' }) }}
                                                    onClick={() => {
                                                        setTempMed({ nombre: m.nombreComercial, dosis: '', presentacion: m.presentacion || '', sustanciasActivas: m.sustanciasActivas || '', numeroAcomodo: m.numeroAcomodo || '', grupo: m.grupo || '', marca: m.grupo || '', nivelUtilidad: m.nivelUtilidad || null, color: m.color || '' });
                                                        setDosisRecomendada(m.dosisCatalogo || 'No hay dosis recomendada en el catálogo.');
                                                        setMedSeleccionadoDetalle(m);
                                                        setMostrarMeds(false); setIndiceMeds(-1);
                                                    }}
                                                    className={`p-4 cursor-pointer border-b border-slate-100 last:border-0 transition-colors border-l-4 ${utilidad.borderLeft} ${utilidad.bgLight} hover:brightness-95 ${i === indiceMeds ? 'ring-2 ring-blue-400' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-bold ${utilidad.text}`}>{m.nombreComercial}</span>
                                                                <span className={`w-3 h-3 rounded-full shrink-0 ${utilidad.bg}`} title={`Nivel ${m.nivelUtilidad}`}></span>
                                                                {m.controlado && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-px rounded border border-amber-100">CTRL</span>}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1 font-medium">{m.sustanciasActivas}</p>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                                                                {m.presentacion && <span className="text-xs text-slate-500"><span className="font-semibold text-slate-400">Pres:</span> {m.presentacion}</span>}
                                                                {m.grupo && <span className="text-xs text-slate-500"><span className="font-semibold text-slate-400">Grupo:</span> {m.grupo}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {sugerenciasMeds.length === 0 && <div className="p-4 text-sm text-slate-400 text-center">Sin resultados</div>}
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
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                                    <p className="text-[9px] font-bold text-indigo-400 uppercase">Dosis catálogo</p>
                                                    <button
                                                        type="button"
                                                        onClick={usarDosisCatalogo}
                                                        disabled={!recetaHabilitada}
                                                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                                                    >
                                                        <Plus size={12} /> Poner en dosis a recetar
                                                    </button>
                                                </div>
                                                <p className="font-medium leading-relaxed text-xs">{dosisRecomendada}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ÁREA DE CALCULADORA E INDICACIONES MANUALES */}
                            <div className="flex flex-col gap-3 relative mt-2 border-t border-slate-200 pt-5">

                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <label className={labelStyle}>Dosis a recetar</label>
                                        {expediente.consulta.exploracion.antropometria?.peso && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 border border-slate-200 text-slate-500">
                                                <Scale size={10} />
                                                {expediente.consulta.exploracion.antropometria.peso} kg
                                            </span>
                                        )}
                                    </div>
                                    <button title="Herramienta de cálculo de dosis" onClick={() => setShowCalculadora(!showCalculadora)} disabled={!recetaHabilitada} className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 border border-blue-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50">
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
                                                    disabled={!recetaHabilitada}
                                                    className={`${inputStyle} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
                                                    value={calcDatos.peso || expediente.consulta.exploracion.antropometria?.peso || ''}
                                                    onChange={e => setCalcDatos({ ...calcDatos, peso: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelStyle}>Dosis (mg/kg)</label>
                                                <input type="number" disabled={!recetaHabilitada} className={`${inputStyle} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} value={calcDatos.dosisMgKg} onChange={e => setCalcDatos({ ...calcDatos, dosisMgKg: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className={labelStyle}>Concentración (mg)</label>
                                                <input type="number" placeholder="Ej. 250" disabled={!recetaHabilitada} className={`${inputStyle} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} value={calcDatos.concentracionMg} onChange={e => setCalcDatos({ ...calcDatos, concentracionMg: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className={labelStyle}>Volumen (mL)</label>
                                                <input type="number" placeholder="Ej. 5" disabled={!recetaHabilitada} className={`${inputStyle} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} value={calcDatos.concentracionMl} onChange={e => setCalcDatos({ ...calcDatos, concentracionMl: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 pt-2 flex-wrap">
                                            <button onClick={calcularDosisExacta} disabled={!recetaHabilitada} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900">
                                                Calcular
                                            </button>
                                            <button onClick={consultarIADosis} disabled={!recetaHabilitada || iaCalcLoading || !tempMed.nombre}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 bg-gradient-to-r from-violet-50 to-indigo-50 border-indigo-200 text-indigo-700 hover:from-violet-100 hover:to-indigo-100 shadow-sm">
                                                {iaCalcLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                                                {iaCalcLoading ? 'Consultando...' : 'Sugerencia de dosis'}
                                            </button>
                                            {resultadoCalc && (
                                                <div className="flex-1 flex items-center justify-between bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 animate-in fade-in min-w-[200px]">
                                                    <span className="font-bold text-indigo-700 text-sm">{resultadoCalc}</span>
                                                    <button onClick={() => { setTempMed({ ...tempMed, dosis: resultadoCalc }); setShowCalculadora(false); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline ml-2">
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
                                    disabled={!recetaHabilitada}
                                    className={`${inputStyle} resize-none h-28 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
                                    placeholder="Escribe la dosis final e indicaciones..."
                                    value={tempMed.dosis}
                                    onChange={e => setTempMed({ ...tempMed, dosis: e.target.value })}
                                    onKeyDown={handleDosisKeyDown}
                                />
                            </div>

                            <button onClick={handleAgregarMedicamento} disabled={!recetaHabilitada || analizandoRiesgo} className={`mt-4 w-full py-3.5 rounded-lg font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 ${!recetaHabilitada ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : analizandoRiesgo ? 'bg-slate-800 text-slate-400 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                {analizandoRiesgo ? <><Activity className="animate-spin" size={16} /> Verificando alergias...</> : "Agregar a Receta"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- COLUMNA DERECHA: RECETA LISTA --- */}
            <div className="w-full lg:w-1/2 flex flex-col gap-4 lg:gap-6">
                <div className={`${glassCard} flex-1 flex flex-col`}>
                    <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center"><span className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> Receta Actual</span><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[10px] font-semibold">{expediente.consulta.diagnostico.tratamiento_lista?.length || 0} items</span></div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[160px]">
                        {expediente.consulta.diagnostico.tratamiento_lista?.map((m, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                                {editandoMedIndex === i ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 gap-3">
                                            <textarea
                                                className={`${inputStyle} h-20 resize-none`}
                                                placeholder="Corrige aquí la dosis e indicaciones"
                                                value={medEdicion.dosis}
                                                onChange={(e) => setMedEdicion({ ...medEdicion, dosis: e.target.value })}
                                                onKeyDown={handleEdicionDosisKeyDown}
                                                autoFocus
                                            />
                                            <input
                                                className={`${inputStyle} bg-slate-100 text-slate-500 cursor-not-allowed`}
                                                placeholder="Nombre del medicamento"
                                                value={medEdicion.nombre}
                                                readOnly
                                            />
                                            <input
                                                className={`${inputStyle} bg-slate-100 text-slate-500 cursor-not-allowed`}
                                                placeholder="Presentación"
                                                value={medEdicion.presentacion}
                                                readOnly
                                            />
                                            <input
                                                className={`${inputStyle} bg-slate-100 text-slate-500 cursor-not-allowed`}
                                                placeholder="Sustancias activas"
                                                value={medEdicion.sustanciasActivas}
                                                readOnly
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={cancelarEdicionMedicamento}
                                                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                            >
                                                <X size={14} /> Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={guardarEdicionMedicamento}
                                                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                            >
                                                <Check size={14} /> Guardar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400"><Pill size={20} /></div>
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
                                            {i > 0 && (
                                                <button
                                                    type="button"
                                                    title="Mover arriba"
                                                    onClick={() => moverMedicamentoArriba(i)}
                                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <ArrowUp size={17} />
                                                </button>
                                            )}
                                            {i < ((expediente.consulta.diagnostico.tratamiento_lista?.length || 0) - 1) && (
                                                <button
                                                    type="button"
                                                    title="Mover abajo"
                                                    onClick={() => moverMedicamentoAbajo(i)}
                                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <ArrowDown size={17} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                title="Editar medicamento"
                                                onClick={() => iniciarEdicionMedicamento(i, m)}
                                                className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                            >
                                                <Pencil size={17} />
                                            </button>
                                            <button
                                                type="button"
                                                title="Eliminar medicamento"
                                                onClick={() => eliminarMedicamento(i)}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {(!expediente.consulta.diagnostico.tratamiento_lista || expediente.consulta.diagnostico.tratamiento_lista.length === 0) && <div className="h-full flex flex-col items-center justify-center text-slate-300 text-sm gap-2"><Package size={40} className="opacity-20" /><span className="italic">No hay medicamentos aún</span></div>}
                    </div>

                    <div className="p-5 border-t border-slate-100 bg-slate-50">
                        <label className={labelStyle}>Indicaciones Generales</label>
                        <textarea className={`${inputStyle} h-24 resize-none bg-white`} placeholder="Dieta, cuidados, signos de alarma..." value={expediente.consulta.diagnostico.indicaciones} onChange={e => updateCampo('consulta.diagnostico.indicaciones', e.target.value)} />
                    </div>
                </div>

            </div>
        </div>
    );

    const renderProcedimientos = () => {
        const iconoCategoria = (categoria = '') => {
            const normalized = normalizeProcedureCategory(categoria);
            if (normalized === 'curacion') return <Bandage size={16} />;
            if (normalized === 'inyectable') return <Syringe size={16} />;
            return <ClipboardList size={16} />;
        };

        return (
            <div className="flex flex-col lg:flex-row lg:h-full w-full gap-4 lg:gap-6 overflow-y-auto lg:overflow-visible custom-scrollbar">
                <div className="w-full lg:w-80 shrink-0 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                            <ClipboardList size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Catalogo de procedimientos</h3>
                            <p className="text-[11px] text-slate-500">Selecciona procedimientos medicos disponibles</p>
                        </div>
                    </div>


                    <input
                        className={inputStyle}
                        placeholder="Buscar procedimiento por nombre o clave"
                        value={busquedaProcedimiento}
                        onChange={(e) => setBusquedaProcedimiento(e.target.value)}
                    />

                    <div className="mt-3 flex-1 min-h-0 max-h-64 lg:max-h-none overflow-y-auto custom-scrollbar space-y-2">
                        {catalogoProcedimientosLoading && (
                            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">Cargando catalogo de procedimientos...</div>
                        )}

                        {!catalogoProcedimientosLoading && procedimientosDisponiblesFiltrados.map((item) => (
                            <div key={item.id} className="p-3 border border-slate-200 rounded-xl bg-white space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{item.nombre}</p>
                                        <p className="text-[11px] text-slate-500">{getProcedureCategoryLabel(item.categoria)}{item.clave ? ` • ${item.clave}` : ''}</p>
                                    </div>
                                    <span className="text-slate-400 mt-0.5">{iconoCategoria(item.categoria)}</span>
                                </div>
                                {item.descripcion && (
                                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{item.descripcion}</p>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">⏱ {item.duracionMin || 20} min</span>
                                    {item.requiereConsentimiento && <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-medium flex items-center gap-1"><ShieldAlert size={10} /> Consentimiento</span>}
                                    {item.preparacion && <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md font-medium flex items-center gap-1"><ClipboardList size={10} /> Preparación</span>}
                                    {item.contraindicaciones && <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-md font-medium flex items-center gap-1"><AlertTriangle size={10} /> Contraindicado</span>}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => agregarProcedimientoDesdeCatalogo(item)}
                                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
                                >
                                    <Plus size={14} /> Agregar procedimiento
                                </button>
                            </div>
                        ))}

                        {!catalogoProcedimientosLoading && procedimientosDisponiblesFiltrados.length === 0 && (
                            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">No hay procedimientos disponibles para este filtro.</div>
                        )}
                    </div>
                </div>

                <div className={`${glassCard} flex-1`}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        <h3 className="font-black text-xl mb-1 text-slate-800 tracking-tight">Procedimientos medicos</h3>
                        <p className="text-sm text-slate-500 mb-6">Planifica procedimientos derivados de la consulta y registra prioridad, estado y consentimiento.</p>

                        <div className="space-y-3">
                            {procedimientosSeleccionadosNormalizados.map((proc, index) => (
                                <div key={`${proc.id}-${index}`} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{proc.nombre}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">{getProcedureCategoryLabel(proc.categoria)}{proc.clave ? ` • ${proc.clave}` : ''}{proc.duracionMin ? ` • ${proc.duracionMin} min` : ''}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeProcedimientoSeleccionado(index)}
                                            className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
                                            title="Eliminar procedimiento"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {(proc.descripcion || proc.preparacion || proc.contraindicaciones) && (
                                        <div className="mt-4 grid grid-cols-1 gap-3">
                                            {proc.descripcion && (
                                                <div className="flex gap-3 p-3.5 rounded-xl bg-blue-50/50 border border-blue-100/50">
                                                    <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                                    <div className="text-xs text-slate-700 leading-relaxed">
                                                        <span className="font-bold block mb-1 text-blue-800">Descripción del procedimiento</span>
                                                        {proc.descripcion}
                                                    </div>
                                                </div>
                                            )}
                                            {proc.preparacion && (
                                                <div className="flex gap-3 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                                                    <ClipboardList className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                                                    <div className="text-xs text-slate-700 leading-relaxed">
                                                        <span className="font-bold block mb-1 text-emerald-800">Preparación y materiales</span>
                                                        {proc.preparacion}
                                                    </div>
                                                </div>
                                            )}
                                            {proc.contraindicaciones && (
                                                <div className="flex gap-3 p-3.5 rounded-xl bg-rose-50/50 border border-rose-100/50">
                                                    <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                                                    <div className="text-xs text-slate-700 leading-relaxed">
                                                        <span className="font-bold block mb-1 text-rose-800">Riesgos y contraindicaciones</span>
                                                        {proc.contraindicaciones}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                        <div>
                                            <label className={labelStyle}>Prioridad</label>
                                            <select
                                                className={inputStyle}
                                                value={proc.prioridad}
                                                onChange={(e) => updateProcedimientoSeleccionado(index, { prioridad: e.target.value })}
                                            >
                                                {PROCEDURE_PRIORITY_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Estado</label>
                                            <select
                                                className={inputStyle}
                                                value={proc.estado}
                                                onChange={(e) => updateProcedimientoSeleccionado(index, { estado: e.target.value })}
                                            >
                                                {PROCEDURE_STATUS_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelStyle}>Sitio / zona</label>
                                            <input
                                                className={inputStyle}
                                                placeholder="Ej. Brazo derecho"
                                                value={proc.sitio || ''}
                                                onChange={(e) => updateProcedimientoSeleccionado(index, { sitio: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <label className={labelStyle}>Nota clinica del procedimiento</label>
                                        <textarea
                                            className={`${inputStyle} h-20 resize-none`}
                                            placeholder="Indicaciones, tecnica, hallazgos o recomendaciones"
                                            value={proc.nota || ''}
                                            onChange={(e) => updateProcedimientoSeleccionado(index, { nota: e.target.value })}
                                        />
                                    </div>

                                    {proc.requiereConsentimiento && (
                                        <label className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800">
                                            <input
                                                type="checkbox"
                                                checked={proc.consentimientoFirmado === true}
                                                onChange={(e) => updateProcedimientoSeleccionado(index, { consentimientoFirmado: e.target.checked })}
                                            />
                                            Consentimiento informado firmado
                                        </label>
                                    )}
                                </div>
                            ))}

                            {procedimientosSeleccionadosNormalizados.length === 0 && (
                                <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    Selecciona procedimientos del catalogo para construir el plan terapeutico.
                                </div>
                            )}
                        </div>

                        <div className="mt-8">
                            <label className={labelStyle}>Notas para procedimientos</label>
                            <textarea
                                className={`${inputStyle} h-24`}
                                placeholder="Observaciones generales del plan de procedimientos..."
                                value={expediente?.consulta?.procedimientos?.notas_generales || ''}
                                onChange={(e) => updateCampo('consulta.procedimientos.notas_generales', e.target.value)}
                            />
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    const renderReferenciaMedica = () => (
        <div className="flex flex-col lg:flex-row lg:h-full w-full gap-4 lg:gap-6 overflow-y-auto lg:overflow-visible custom-scrollbar">
            <div className="w-full lg:w-80 shrink-0 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <Link2 size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Catálogo de referencias</h3>
                        <p className="text-[11px] text-slate-500">Selecciona médicos y consultorios de referencia</p>
                    </div>
                </div>

                <input
                    className={inputStyle}
                    placeholder="Buscar por médico, especialidad o diagnóstico"
                    value={busquedaReferencia}
                    onChange={(e) => setBusquedaReferencia(e.target.value)}
                />

                <div className="mt-3 flex-1 min-h-0 max-h-64 lg:max-h-none overflow-y-auto custom-scrollbar space-y-2">
                    {catalogoReferenciasMedicasLoading && (
                        <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">Cargando catálogo de referencias...</div>
                    )}

                    {!catalogoReferenciasMedicasLoading && referenciasDisponiblesFiltradas.map((item) => (
                        <div key={item.id} className="p-3 border border-slate-200 rounded-xl bg-white space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{item.nombreMedico}</p>
                                    <p className="text-[11px] text-slate-500">{item.especialidad} • {getTipoCitaLabel(item.tipoCita)}</p>
                                </div>
                            </div>

                            {(item.telefonoConsultorio || item.direccionConsultorio) && (
                                <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                                    {item.telefonoConsultorio && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
                                            <Phone size={10} /> {item.telefonoConsultorio}
                                        </span>
                                    )}
                                    {item.direccionConsultorio && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
                                            <MapPin size={10} /> {item.direccionConsultorio}
                                        </span>
                                    )}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => agregarReferenciaDesdeCatalogo(item)}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                                <Plus size={14} /> Agregar referencia
                            </button>
                        </div>
                    ))}

                    {!catalogoReferenciasMedicasLoading && referenciasDisponiblesFiltradas.length === 0 && (
                        <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">No hay referencias disponibles para este filtro.</div>
                    )}
                </div>
            </div>

            <div className={`${glassCard} flex-1`}>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <h3 className="font-black text-xl mb-1 text-slate-800 tracking-tight">Referencias médicas</h3>
                    <p className="text-sm text-slate-500 mb-6">Médicos y consultorios a los que se deriva al paciente para atención especializada.</p>

                    <div className="space-y-3">
                        {referenciasSeleccionadasNormalizadas.map((ref, index) => (
                            <div key={`${ref.id}-${index}`} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-800">{ref.nombreMedico}</p>
                                            {ref.esUrgente && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">
                                                    <AlertTriangle size={10} /> Urgente
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{ref.especialidad} • {getTipoCitaLabel(ref.tipoCita)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeReferenciaSeleccionada(index)}
                                        className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
                                        title="Eliminar referencia"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelStyle}>Teléfono</label>
                                        <input
                                            className={inputStyle}
                                            placeholder="Ej. 55-1234-5678"
                                            value={ref.telefonoConsultorio || ''}
                                            onChange={(e) => updateReferenciaSeleccionada(index, { telefonoConsultorio: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelStyle}>Dirección</label>
                                        <input
                                            className={inputStyle}
                                            placeholder="Ej. Av. Reforma 123"
                                            value={ref.direccionConsultorio || ''}
                                            onChange={(e) => updateReferenciaSeleccionada(index, { direccionConsultorio: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={ref.esUrgente === true}
                                            onChange={(e) => updateReferenciaSeleccionada(index, { esUrgente: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                        />
                                        <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
                                            <AlertTriangle size={14} className="text-rose-500" /> Referencia urgente
                                        </span>
                                    </label>
                                </div>

                                <div className="mt-3">
                                    <label className={labelStyle}>Diagnóstico de referencia</label>
                                    <input
                                        className={inputStyle}
                                        placeholder="Diagnóstico por el cual se refiere"
                                        value={ref.diagnostico || ''}
                                        onChange={(e) => updateReferenciaSeleccionada(index, { diagnostico: e.target.value })}
                                    />
                                </div>

                                <div className="mt-3">
                                    <label className={labelStyle}>Datos extras del consultorio</label>
                                    <textarea
                                        className={`${inputStyle} h-16 resize-none`}
                                        placeholder="Horarios, servicios adicionales..."
                                        value={ref.datosExtras || ''}
                                        onChange={(e) => updateReferenciaSeleccionada(index, { datosExtras: e.target.value })}
                                    />
                                </div>

                                <div className="mt-3">
                                    <label className={labelStyle}>Notas</label>
                                    <textarea
                                        className={`${inputStyle} h-16 resize-none`}
                                        placeholder="Notas sobre esta referencia..."
                                        value={ref.notas || ''}
                                        onChange={(e) => updateReferenciaSeleccionada(index, { notas: e.target.value })}
                                    />
                                </div>
                            </div>
                        ))}

                        {referenciasSeleccionadasNormalizadas.length === 0 && (
                            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                Selecciona referencias médicas del catálogo para derivar al paciente.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderEstudios = () => (
        <div className="flex flex-col lg:flex-row w-full min-h-0 gap-3 lg:gap-6 lg:h-full">
            <div className="w-full lg:w-64 flex flex-row lg:flex-col gap-2 lg:gap-3 shrink-0 bg-white p-2 lg:p-4 rounded-2xl border border-slate-200 lg:h-full overflow-x-auto lg:overflow-visible">
                {estudiosTabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveEstudiosTab(tab.id)} className={`p-2.5 lg:p-3 rounded-lg flex flex-row lg:flex-col items-center gap-2 lg:gap-1.5 text-xs font-semibold transition-colors border text-center whitespace-nowrap shrink-0 ${activeEstudiosTab === tab.id ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-600 hover:bg-slate-50 border-transparent'}`}>
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>
            <div className={`${glassCard} flex-1 min-h-0`}>
                <div className="p-4 md:p-8 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:custom-scrollbar">
                    <h3 className="font-black text-xl mb-6 text-slate-800 tracking-tight">{tituloTabEstudios}</h3>
                    {esTabPaquete ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {paquetesCatalogo.map((p) => (
                                <label key={p.id} className="flex gap-4 items-center p-4 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={paquetesSeleccionados.includes(p.nombre)}
                                            onChange={() => togglePaquete(p.nombre)}
                                            className="peer appearance-none w-6 h-6 border-2 border-slate-300 rounded-lg checked:bg-indigo-500 checked:border-indigo-500 transition-all"
                                        />
                                        <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-700 text-sm group-hover:text-indigo-700">{p.nombre}</span>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {p.componentes?.length ? `${p.componentes.length} estudio(s)` : 'Sin composicion definida'}
                                        </p>
                                    </div>
                                </label>
                            ))}
                            {catalogoEstudiosLoading && (
                                <div className="col-span-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    Cargando catalogo de paquetes...
                                </div>
                            )}
                            {!catalogoEstudiosLoading && paquetesCatalogo.length === 0 && (
                                <div className="col-span-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    No hay paquetes configurados en el catalogo.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="space-y-3">
                                <input
                                    className={inputStyle}
                                    placeholder={`Buscar en ${tituloTabEstudios.toLowerCase()} por nombre o clave`}
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
                                        <Plus size={14} /> Agregar manualmente
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                                    {catalogoEstudiosLoading && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">Cargando catalogo...</div>
                                    )}
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
                                    {!catalogoEstudiosLoading && estudiosDisponiblesFiltrados.length === 0 && (
                                        <div className="px-4 py-6 text-sm text-slate-500 text-center">Sin registros disponibles en esta categoria.</div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {estudiosSeleccionadosNormalizados.map((est, i) => (
                                    <div key={`${est.nombre}-${i}`} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div>
                                            <span className="font-bold text-slate-700 text-sm">{est.nombre}</span>
                                            {est.clave && <p className="text-[11px] text-slate-400 mt-0.5">Clave: {est.clave}</p>}
                                            {est.categoria && <p className="text-[11px] text-indigo-500 mt-0.5">{getStudyCategoryLabel(est.categoria)}</p>}
                                        </div>
                                        <button onClick={() => removeEstudioSeleccionado(i)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16} /></button>
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
                    <div className="mt-8"><label className={labelStyle}>Notas para estudios</label><textarea className={`${inputStyle} h-24`} placeholder="Indicaciones especiales..." value={expediente.consulta.estudios.notas_generales} onChange={e => updateCampo('consulta.estudios.notas_generales', e.target.value)} /></div>
                </div>
            </div>
        </div>
    );

    const tabsConsulta = [
        { id: 'padecimiento', l: 'Motivo', i: <FileText size={18} /> },
        { id: 'exploracion', l: 'Exploración', i: <Activity size={18} /> },
        { id: 'diagnostico', l: 'Diagnóstico', i: <CheckCircle size={18} /> },
        { id: 'estudios', l: 'Estudios', i: <FlaskConical size={18} /> },
        { id: 'procedimientos', l: 'Procedimientos', i: <ClipboardList size={18} /> },
        { id: 'referencia_medica', l: 'Referencia', i: <Link2 size={18} /> }
    ];

    const nextConsultaMap = {
        padecimiento: 'exploracion',
        exploracion: 'diagnostico',
        diagnostico: 'estudios',
        estudios: 'procedimientos',
        procedimientos: 'referencia_medica'
    };

    const nextConsultaTab = nextConsultaMap[activeConsulta] || null;

    return (
        <div className="flex flex-col w-full min-h-0 overflow-visible bg-slate-50 relative lg:flex-1 lg:h-full lg:overflow-hidden">
            <div className="absolute inset-0 bg-slate-50 -z-10 pointer-events-none" />

            {/* TABS HEADER */}
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-2 sm:px-3 md:px-6 shrink-0 z-20 py-2 sticky top-0 lg:static">
                <div className="flex items-center gap-2 min-w-0 w-full">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto max-w-full pb-0.5 flex-1 min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {tabsConsulta.map((t) => (
                            <button title={t.l} key={t.id} onClick={() => setActiveConsulta(t.id)} className={`py-2 px-2.5 md:px-3.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 border whitespace-nowrap shrink-0 ${activeConsulta === t.id ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700 border-transparent'}`}>{t.i} <span className="hidden lg:inline">{t.l.toUpperCase()}</span></button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 w-full">
                    {/* Indicador persistente de alergias */}
                    <div className="relative shrink-0 min-w-0" ref={alergiaPopoverRef}>
                        <button
                            onClick={() => setShowAlergiaPopover(!showAlergiaPopover)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer transition-colors max-w-full ${
                                resumenAlergiasPaciente.preguntadosNegados
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : resumenAlergiasPaciente.tieneAlergias
                                    ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                    : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
                            }`}
                        >
                            {resumenAlergiasPaciente.preguntadosNegados ? (
                                <><CheckCircle size={12} /> <span className="truncate">Sin alergias</span></>
                            ) : resumenAlergiasPaciente.tieneAlergias ? (
                                <><AlertTriangle size={12} className="shrink-0" /> <span className="truncate">{resumenAlergiasPaciente.items.length} {resumenAlergiasPaciente.items.length === 1 ? 'alergia' : 'alergias'}</span></>
                            ) : (
                                <><Info size={12} /> <span className="truncate">No verificado</span></>
                            )}
                        </button>

                        {showAlergiaPopover && (
                            <div className="absolute top-full left-0 mt-2 w-[min(18rem,calc(100vw-2rem))] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className={`px-4 py-3 border-b ${
                                    resumenAlergiasPaciente.preguntadosNegados
                                        ? 'bg-emerald-50 border-emerald-100'
                                        : resumenAlergiasPaciente.tieneAlergias
                                        ? 'bg-rose-50 border-rose-100'
                                        : 'bg-slate-50 border-slate-100'
                                }`}>
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                                        {resumenAlergiasPaciente.preguntadosNegados
                                            ? 'Alergias descartadas'
                                            : resumenAlergiasPaciente.tieneAlergias
                                            ? `Alergias registradas (${resumenAlergiasPaciente.items.length})`
                                            : 'Alergias no verificadas'}
                                    </p>
                                </div>
                                <div className="px-4 py-3">
                                    {resumenAlergiasPaciente.preguntadosNegados ? (
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Se le preguntó al paciente y <strong>negó</strong> tener alergias. 
                                            Puede modificar esta información en la sección de <strong>Antecedentes</strong>.
                                        </p>
                                    ) : resumenAlergiasPaciente.tieneAlergias ? (
                                        <div>
                                            <p className="text-xs text-slate-500 mb-2">Al recetar, verifique contraindicaciones con estos alérgenos:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {resumenAlergiasPaciente.items.map((item) => (
                                                    <span key={item} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-200 bg-white text-rose-700">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            No se ha verificado si el paciente tiene alergias. 
                                            Puede registrar esta información en <strong>Antecedentes</strong> o durante el <strong>triage</strong>.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {activeConsulta === 'procedimientos' || activeConsulta === 'referencia_medica' ? (
                        <button
                            onClick={() => onPrintRecetaSalir?.()}
                            className={`px-3 sm:px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all shadow-sm shrink-0 ${buttonPrimary}`}
                        >
                            <Printer size={16} /> <span className="hidden sm:inline">Imprimir receta</span>
                        </button>
                    ) : (activeConsulta === 'diagnostico' || activeConsulta === 'estudios') && nextConsultaTab ? (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => (onPrintReceta ?? onPrintRecetaSalir)?.()}
                                className="px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
                                title="Imprimir receta sin salir"
                            >
                                <Printer size={15} />
                                <span className="hidden sm:inline">Imprimir</span>
                            </button>
                            <button
                                onClick={() => setActiveConsulta(nextConsultaTab)}
                                className={`px-3 sm:px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all shadow-sm ${buttonPrimary}`}
                            >
                                Siguiente <ArrowLeft size={16} className="rotate-180" />
                            </button>
                        </div>
                    ) : nextConsultaTab ? (
                        <button
                            onClick={() => setActiveConsulta(nextConsultaTab)}
                            className={`px-3 sm:px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all shadow-sm shrink-0 ${buttonPrimary}`}
                        >
                            Siguiente <ArrowLeft size={16} className="rotate-180" />
                        </button>
                    ) : null}
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="w-full p-3 md:p-6 overflow-visible relative z-10 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:custom-scrollbar">
                {activeConsulta === 'padecimiento' && renderPadecimiento()}
                {activeConsulta === 'exploracion' && renderExploracion()}
                {activeConsulta === 'diagnostico' && renderDiagnostico()}
                {activeConsulta === 'procedimientos' && renderProcedimientos()}
                {activeConsulta === 'estudios' && renderEstudios()}
                {activeConsulta === 'referencia_medica' && renderReferenciaMedica()}
            </div>

            {/* --- TOAST --- */}
            <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className={`px-4 sm:px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 sm:gap-4 backdrop-blur-xl border border-white/20 ${toast.type === 'error' ? 'bg-rose-500/90 text-white' : 'bg-slate-900/90 text-white'}`}>
                    {toast.type === 'error' ? <AlertTriangle size={24} /> : <CheckCircle size={24} className="text-emerald-400" />}
                    <span className="font-bold text-sm tracking-wide">{toast.message}</span>
                </div>
            </div>

            {/* --- MODAL DE RIESGO DE ALERGIA / INTERACCIÓN --- */}
            {showRiskModal && (() => {
                const esAlergia = riskData.tipo === 'alergia_directa' || riskData.tipo === 'reaccion_cruzada';
                const esInteraccion = riskData.tipo === 'interaccion_farmacologica';
                const esDuplicado = riskData.tipo === 'duplicado';
                const esAlto = riskData.nivel === 'alto';
                const headerBg = esAlto ? 'from-red-50 to-rose-50' : esAlergia ? 'from-amber-50 to-orange-50' : esInteraccion ? 'from-blue-50 to-indigo-50' : 'from-slate-50 to-slate-100';
                const borderColor = esAlto ? 'border-red-100' : esAlergia ? 'border-orange-100' : esInteraccion ? 'border-blue-100' : 'border-slate-200';
                const iconColor = esAlto ? 'text-red-600' : esAlergia ? 'text-orange-500' : esInteraccion ? 'text-blue-500' : 'text-slate-500';
                const titulo = esDuplicado ? 'Medicamento Duplicado' : esAlergia ? 'Riesgo Alérgico Detectado' : esInteraccion ? 'Interacción Farmacológica' : 'Alerta de Seguridad';
                const subtitulo = esAlto ? 'Riesgo alto — contraindicado' : riskData.tipo === 'reaccion_cruzada' ? 'Reactividad cruzada documentada' : esInteraccion ? 'Interacción entre medicamentos' : esDuplicado ? 'Ya existe en la receta' : 'Validación de seguridad';
                const stripColor = esAlto ? 'border-red-400 bg-red-50' : esAlergia ? 'border-orange-400 bg-orange-50' : esInteraccion ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50';
                return (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95">
                            <div className={`bg-gradient-to-r ${headerBg} px-6 py-5 border-b ${borderColor} flex items-center gap-4`}>
                                <div className={`bg-white p-2.5 rounded-xl shadow-sm ${iconColor}`}>{esAlto ? <ShieldAlert size={22} /> : esAlergia ? <AlertTriangle size={22} /> : esInteraccion ? <AlertTriangle size={22} /> : <AlertTriangle size={22} />}</div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800">{titulo}</h3>
                                    <p className={`text-[11px] font-bold mt-0.5 uppercase tracking-wider ${esAlto ? 'text-red-600' : esAlergia ? 'text-orange-600' : esInteraccion ? 'text-blue-600' : 'text-slate-500'}`}>{subtitulo}</p>
                                </div>
                            </div>
                            <div className="px-6 py-5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></div>
                                    <span className="text-sm font-bold text-slate-800">{riskData.medicamento}</span>
                                </div>
                                {riskData.mensaje && (
                                    <div className={`border-l-4 ${stripColor} p-3.5 rounded-r-lg`}>
                                        <p className="text-[13px] text-slate-700 leading-relaxed">{riskData.mensaje}</p>
                                    </div>
                                )}
                                {resumenAlergiasPaciente.tieneAlergias && esAlergia && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-full mb-1">Alergias del paciente:</span>
                                        {resumenAlergiasPaciente.items.slice(0, 6).map((item) => (
                                            <span key={item} className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-200 bg-rose-50 text-rose-700">{item}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex gap-3">
                                <button onClick={() => setShowRiskModal(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-semibold text-xs hover:bg-slate-100 transition-all">Cancelar</button>
                                <button onClick={ejecutarAgregado} className={`flex-1 py-2.5 rounded-lg font-semibold text-xs shadow-sm transition-all flex justify-center gap-1.5 items-center ${esAlto ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>
                                    <span>{esAlto ? 'Agregar bajo mi responsabilidad' : 'Agregar de todas formas'}</span>
                                    <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};

export default SeccionConsulta;