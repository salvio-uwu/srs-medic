import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalIcon, Clock, User, Plus, ChevronLeft, ChevronRight, 
  Search, X, Activity, Stethoscope, ChevronDown, CheckCircle, 
  AlertCircle,   Zap, Video, MapPin, Building, AlertTriangle, CheckCircle2,
  Phone, ClipboardList, Edit3, Lock, CalendarClock, MessageSquare, 
  LogIn, FileText, XCircle, MoreHorizontal, Send, Ban, GitMerge, LogOut, BookOpen, ArrowLeftRight,
  Upload, Paperclip, ReceiptText, CalendarDays, Shield, Mail,
  Thermometer, Heart, Wind, UserCheck, Users
} from 'lucide-react';
import { db, functions, storage } from '../../config/firebase'; 
import { collection, addDoc, query, where, orderBy, getDocs, getDoc, updateDoc, doc, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { useSessionLocation } from '../../context/SessionLocationContext';
import { useNavigate } from 'react-router-dom';
import ModalPaciente from '../../components/ModalPaciente';
import AvatarPaciente, { calcularEdad } from '../../components/AvatarPaciente';
import RegistrosEnfermeriaModal from '../../components/RegistrosEnfermeriaModal'; 
import ModalUnificarExpedientes from '../../components/ModalUnificarExpedientes';
import CustomDropdown from '../../components/CustomDropdown';
import { PAYMENT_METHOD_OPTIONS } from '../../services/enfermeriaPatientLogService';
import EstadoPacienteBadge from '../../components/EstadoPacienteBadge';
import { getEstadoDetallado } from '../../utils/citaStatus';
import useIsMobile from '../../hooks/useIsMobile';

const formatDateLabel = (dateValue, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!dateValue) return 'Sin registro';
    const rawValue = typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
        ? `${dateValue}T00:00:00`
        : dateValue;
    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) return String(dateValue);
    return new Intl.DateTimeFormat('es-MX', options).format(parsedDate);
};

const getPatientConditions = (patientData = {}) => {
    const conditions = [];
    if (patientData.padecimientoHipertension) conditions.push('Hipertensión');
    if (patientData.padecimientoDiabetes) conditions.push('Diabetes');
    if (patientData.padecimientoObesidad) conditions.push('Obesidad');
    if (patientData.padecimientoArtritis) conditions.push('Artritis');
    return conditions;
};

const inputStyle = "w-full p-2 bg-white border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm text-slate-700 shadow-sm";
const labelStyle = "text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 ml-1";

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];

const AgendaEnfermeria = () => {
  const { user, logout } = useAuth();
  const { sessionSucursal } = useSessionLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const scrollRef = useRef(null); 
  
    // --- CONFIGURACIÓN ---
    const INTERVALO_MINUTOS = 10; 

  // --- ESTADOS ---
  const [citas, setCitas] = useState([]);
  const [doctores, setDoctores] = useState([]);
  const [enfermeros, setEnfermeros] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showRegistrosModal, setShowRegistrosModal] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [viewFilter, setViewFilter] = useState('timeline'); 
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);
  const [showSelectorDoctor, setShowSelectorDoctor] = useState(false); 
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [selectedCita, setSelectedCita] = useState(null);
  const [showReprogramar, setShowReprogramar] = useState(false);
  const [reprogramarData, setReprogramarData] = useState({ fecha: '', hora: '', horaFin: '' });
    const [editingCitaId, setEditingCitaId] = useState('');
    const [isSavingCita, setIsSavingCita] = useState(false);
  const [showCancelarConfirm, setShowCancelarConfirm] = useState(false);
  const [cancelarMotivo, setCancelarMotivo] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showUnificar, setShowUnificar] = useState(false);
  const [showReasignar, setShowReasignar] = useState(false);
  const [reasignarData, setReasignarData] = useState({ doctorUid: '', doctorNombre: '', justificacion: '' });
  const [showCambiarConsultorio, setShowCambiarConsultorio] = useState(false);
  const [cambiarConsultorioData, setCambiarConsultorioData] = useState({ consultorioId: '', consultorioNombre: '', sucursalId: '', sucursalNombre: '', justificacion: '' });
    const [showResumenJornada, setShowResumenJornada] = useState(false);
    const [horaInicioRango, setHoraInicioRango] = useState('08:00');
    const [horaFinRango, setHoraFinRango] = useState('23:59');
    const [selectedPacienteDetalle, setSelectedPacienteDetalle] = useState(null);
    const [selectedPacienteLoading, setSelectedPacienteLoading] = useState(false);
    const [showModalSelectDoctorDocumentos, setShowModalSelectDoctorDocumentos] = useState(false);
    const [selectedDoctorDocsId, setSelectedDoctorDocsId] = useState('');
    const [doctorDocsSearchTerm, setDoctorDocsSearchTerm] = useState('');
    const [uploadingEstudio, setUploadingEstudio] = useState(false);
    const [dragOverCitaId, setDragOverCitaId] = useState(null);
    const [ultimaVisita, setUltimaVisita] = useState(null);
    const fileInputRef = useRef(null);
    const [expandedDoctorId, setExpandedDoctorId] = useState(null);

  const [todosLosPacientes, setTodosLosPacientes] = useState([]); 
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  
    const [consultorios, setConsultorios] = useState([]);
    const [catalogoMotivos, setCatalogoMotivos] = useState([]);
    const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [selectedConsultorio, setSelectedConsultorio] = useState(() => {
    try {
      return sessionStorage.getItem('enfermeria_selectedConsultorio') || 'Todos';
    } catch {
      return 'Todos';
    }
  });
  const [horariosBloqueadosPorDoctor, setHorariosBloqueadosPorDoctor] = useState(new Map());

    const toInputDateValue = (dateValue = new Date()) => {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

  const [nuevaCita, setNuevaCita] = useState({
    paciente: '', pacienteId: '', pacienteTelefono: '',
    fecha: toInputDateValue(new Date()),
    hora: '', horaFin: '', motivo: '', motivoId: '', doctorAsignado: '', doctorUid: '',
    esTeleconsulta: false, consultorio: '', consultorioId: '', sucursal: '', sucursalId: '',
    tipoConsulta: 'Primera vez', formaPago: '',
    enfermeroAsignadoId: '', enfermeroAsignadoNombre: ''
  });

  // --- ESTADOS DE UI (Toasts y Alertas) ---
  const [toast, setToast] = useState({ show: false, msg: '', type: 'error' });
  const [confirmModal, setConfirmModal] = useState({ show: false, slot: null });
        const modoLigero = true;
    const isEditingCita = Boolean(editingCitaId);

    // --- GENERADORES ---

  const showToast = (msg, type = 'error') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'error' }), 4000);
  };

    const cerrarModalCita = () => {
        setShowCitaModal(false);
        setShowSelectorDoctor(false);
        setMostrarSugerencias(false);
        setEditingCitaId('');
        setIsSavingCita(false);
    };

    const cerrarDetalleCita = () => {
        setSelectedCita(null);
    };

    const sumarMinutos = (hora, minutos) => {
        if (!hora) return '';
        const [horas, mins] = hora.split(':').map(Number);
        if (Number.isNaN(horas) || Number.isNaN(mins)) return '';
        const total = horas * 60 + mins + minutos;
        const horasFinal = Math.floor((total % (24 * 60)) / 60).toString().padStart(2, '0');
        const minsFinal = (total % 60).toString().padStart(2, '0');
        return `${horasFinal}:${minsFinal}`;
    };

    const formatMotivoOption = (motivoData) => {
        const nombre = motivoData?.nombre || 'Motivo';
        const precio = Number(motivoData?.precio || 0);
        return precio > 0 ? `${nombre} · $${precio.toLocaleString('es-MX')}` : nombre;
    };

  // --- CÁLCULO DE HORARIOS EN RANGOS (Ej: 14:00 - 14:10) ---
  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = currentDate.toDateString() === now.toDateString();

    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += INTERVALO_MINUTOS) {
        const startH = h.toString().padStart(2, '0');
        const startM = m.toString().padStart(2, '0');
        const startTime = `${startH}:${startM}`;
        
        let endM = m + INTERVALO_MINUTOS;
        let endH = h;
        if (endM >= 60) { endM = endM % 60; endH = h + 1; }
        const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        
        const startTotalMinutes = h * 60 + m;
        const endTotalMinutes = endH * 60 + endM;

        const isPast = isToday && startTotalMinutes < currentMinutes - INTERVALO_MINUTOS;
        const isCurrent = isToday && currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes;

        slots.push({ 
            startTime, endTime, value: `${startTime} - ${endTime}`, 
            startMinutes: startTotalMinutes, endMinutes: endTotalMinutes,
            isPast, isCurrent 
        });
      }
    }
    return slots;
  }, [currentTime, currentDate]);

  // --- EFECTOS ---
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

    useEffect(() => {
        if (!showCitaModal) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                cerrarModalCita();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [showCitaModal]);

    useEffect(() => {
        const tieneSubmodalAbierto = showReprogramar || showCancelarConfirm || showReasignar || showCambiarConsultorio || showUnificar || showPacienteModal || showCitaModal;
        if (!selectedCita || tieneSubmodalAbierto) return undefined;

        const handleEscapeDetalle = (event) => {
            if (event.key === 'Escape') {
                cerrarDetalleCita();
            }
        };

        window.addEventListener('keydown', handleEscapeDetalle);
        return () => window.removeEventListener('keydown', handleEscapeDetalle);
    }, [selectedCita, showReprogramar, showCancelarConfirm, showReasignar, showCambiarConsultorio, showUnificar, showPacienteModal, showCitaModal]);

    useEffect(() => {
        if (!selectedCita?.pacienteId) {
            setUltimaVisita(null);
            return undefined;
        }

        let cancelled = false;

        const fetchUltimaVisita = async () => {
            try {
                const qCitas = query(
                    collection(db, 'citas'),
                    where('pacienteId', '==', selectedCita.pacienteId)
                );
                const snap = await getDocs(qCitas);
                if (cancelled) return;

                const todas = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((c) => c.id !== selectedCita.id && c.estado !== 'cancelada')
                    .sort((a, b) => {
                        const ha = a.fechaHora || '';
                        const hb = b.fechaHora || '';
                        return hb.localeCompare(ha);
                    });

                setUltimaVisita(todas.length > 0 ? todas[0] : null);
            } catch (err) {
                console.error('Error cargando última visita:', err);
                if (!cancelled) setUltimaVisita(null);
            }
        };

        fetchUltimaVisita();

        return () => { cancelled = true; };
    }, [selectedCita?.pacienteId, selectedCita?.id]);

    useEffect(() => {
        if (!selectedCita?.pacienteId) {
            setSelectedPacienteDetalle(null);
            setSelectedPacienteLoading(false);
            return undefined;
        }

        let isCancelled = false;
        setSelectedPacienteLoading(true);

        getDoc(doc(db, 'pacientes', selectedCita.pacienteId))
            .then((snap) => {
                if (isCancelled) return;
                setSelectedPacienteDetalle(snap.exists() ? { id: snap.id, ...snap.data() } : null);
            })
            .catch((error) => {
                console.error('Error cargando detalle del paciente', error);
                if (!isCancelled) setSelectedPacienteDetalle(null);
            })
            .finally(() => {
                if (!isCancelled) setSelectedPacienteLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [selectedCita?.pacienteId]);

  // AUTO SCROLL INTELIGENTE AL HORARIO ACTUAL
  useEffect(() => {
    if(scrollRef.current && viewFilter === 'timeline') {
            scrollRef.current.scrollIntoView({ behavior: modoLigero ? 'auto' : 'smooth', block: 'center' });
    }
    }, [timeSlots, viewFilter, modoLigero]);

    useEffect(() => {
        const dateStr = toInputDateValue(currentDate);
        const startOfDay = `${dateStr}T00:00`;
        const endOfDay = `${dateStr}T23:59`;

        const q = query(
            collection(db, "citas"), 
            where("fechaHora", ">=", startOfDay), where("fechaHora", "<=", endOfDay), orderBy("fechaHora", "asc")
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const nuevasCitas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setCitas(nuevasCitas);
            // Mantener selectedCita actualizada con datos frescos de Firestore
            setSelectedCita((prev) => {
                if (!prev) return null;
                const actualizada = nuevasCitas.find((c) => c.id === prev.id);
                return actualizada || prev;
            });
        }, (error) => {
            console.error('[AgendaEnfermeria] Error en listener de citas:', error);
        });

        return () => unsub();
    }, [currentDate]);

    useEffect(() => {
        const qDocs = query(collection(db, "users"), where("rol", "in", ["medico", "doctor"]));
        const unsub = onSnapshot(qDocs, (snap) => {
            const medicosActivos = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((item) => item.activo !== false);
            setDoctores(medicosActivos);
        }, () => {});

        return () => unsub();
    }, []);

    useEffect(() => {
        const qMotivos = query(collection(db, "catalogo_motivos_consulta"), orderBy("nombre", "asc"));
        const qConsultorios = query(collection(db, "catalogo_consultorios"), orderBy("nombre", "asc"));
        const qSucursales = query(collection(db, "catalogo_sucursales"), orderBy("nombre", "asc"));

        const unsub1 = onSnapshot(qMotivos, (snap) => {
            setCatalogoMotivos(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false).sort((a, b) => (b.usoCount || 0) - (a.usoCount || 0) || (a.nombre || '').localeCompare(b.nombre || '')));
        }, () => {});
        const unsub2 = onSnapshot(qConsultorios, (snap) => {
            setConsultorios(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false));
        }, () => {});
        const unsub3 = onSnapshot(qSucursales, (snap) => {
            setCatalogoSucursales(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false));
        }, () => {});

        const qEnfermeros = query(collection(db, 'users'), where('rol', 'in', ['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa']));
        const unsub4 = onSnapshot(qEnfermeros, (snap) => {
            setEnfermeros(snap.docs.map((d) => ({ id: d.id, nombre: d.data().nombre || d.data().email || d.id })).filter((item) => item.nombre));
        }, () => {});

        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, []);

    /* ── HORARIOS BLOQUEADOS POR DOCTORES (TIEMPO REAL) ── */
    useEffect(() => {
        const fechaStr = toInputDateValue(currentDate);
        const q = query(
            collection(db, 'horarios_bloqueados'),
            where('fecha', '==', fechaStr)
        );
        const unsub = onSnapshot(q, (snap) => {
            const mapa = new Map(); // doctorUid -> Map<slotKey, { justificacion, nombre, consultorioId, consultorioNombre }>
            snap.docs.forEach((d) => {
                const data = d.data();
                if (data.doctorUid && Array.isArray(data.slots)) {
                    const detalle = data.slotsDetalle || {};
                    const slotMap = new Map();
                    const consultorioId = data.consultorioId || '';
                    const consultorioNombre = data.consultorioNombre || '';
                    data.slots.forEach(s => {
                        slotMap.set(s, {
                            justificacion: detalle[s]?.justificacion || '',
                            nombre: data.doctorNombre || '',
                            consultorioId,
                            consultorioNombre
                        });
                    });
                    mapa.set(data.doctorUid, slotMap);
                }
            });
            setHorariosBloqueadosPorDoctor(mapa);
        }, () => {});
        return () => unsub();
    }, [currentDate]);

  const fetchPacientesSugerencias = async (txt) => {
    try {
      const { searchPatientsForAutocomplete } = await import('../../services/patientSearchService');
      const results = await searchPatientsForAutocomplete(txt, 20);
      setSugerencias(results);
      setMostrarSugerencias(results.length > 0);
    } catch {
      setMostrarSugerencias(false);
    }
  };

    const consultoriosNombres = useMemo(
        () => consultorios.map((c) => c.nombre).filter(Boolean),
        [consultorios]
    );

    const sucursalPredeterminada = useMemo(() => {
        // Prioridad 1: Contexto de sesión (SessionLocationContext)
        if (sessionSucursal?.id) {
            const found = catalogoSucursales.find((s) => s.id === sessionSucursal.id);
            if (found) return found;
            return sessionSucursal;
        }

        // Prioridad 2: Fallback a catálogo / perfil
        if (catalogoSucursales.length === 0) {
            return {
                id: user?.sucursalId || '',
                nombre: user?.sucursal || 'Sin sucursal configurada'
            };
        }

        const sucursalUsuarioPorId = catalogoSucursales.find(
            (sucursal) => String(sucursal.id || '').trim() === String(user?.sucursalId || '').trim()
        );

        if (sucursalUsuarioPorId) return sucursalUsuarioPorId;

        const sucursalUsuario = catalogoSucursales.find(
            (sucursal) =>
                (sucursal.nombre || '').trim().toLowerCase() === (user?.sucursal || '').trim().toLowerCase()
        );

        return sucursalUsuario || catalogoSucursales[0];
    }, [sessionSucursal, catalogoSucursales, user?.sucursalId, user?.sucursal]);

    // Persistir filtro de consultorio en sessionStorage para que sobreviva navegaciones
    useEffect(() => {
        try {
            sessionStorage.setItem('enfermeria_selectedConsultorio', selectedConsultorio);
        } catch {}
    }, [selectedConsultorio]);

    useEffect(() => {
        if (consultoriosNombres.length > 0 && selectedConsultorio !== 'Todos' && !consultoriosNombres.includes(selectedConsultorio)) {
            setSelectedConsultorio('Todos');
        }
    }, [selectedConsultorio, consultoriosNombres]);

    const citasFiltradasConsultorio = useMemo(() => {
        if (selectedConsultorio === 'Todos') return citas;
        return citas.filter((cita) => cita.consultorio === selectedConsultorio);
    }, [citas, selectedConsultorio]);

    const citasPorSlot = useMemo(() => {
        const mapa = new Map();

        citasFiltradasConsultorio.forEach((cita) => {
            const fechaHora = cita?.fechaHora || '';
            const horaTexto = fechaHora.includes('T') ? fechaHora.split('T')[1] : (cita?.hora || '');
            if (!horaTexto) return;

            const [horas, minutos] = horaTexto.split(':').map(Number);
            if (Number.isNaN(horas) || Number.isNaN(minutos)) return;

            const minutoInicioSlot = Math.floor(minutos / INTERVALO_MINUTOS) * INTERVALO_MINUTOS;
            const clave = `${horas.toString().padStart(2, '0')}:${minutoInicioSlot.toString().padStart(2, '0')}`;

            if (!mapa.has(clave)) mapa.set(clave, []);
            mapa.get(clave).push(cita);
        });

        return mapa;
    }, [citasFiltradasConsultorio, INTERVALO_MINUTOS]);

    const citasPendientesFiltradas = useMemo(
        () => citasFiltradasConsultorio
          .filter((cita) => cita.estado === 'pendiente' || cita.estado === 'en_espera')
          .sort((a, b) => {
            const horaA = a.fechaHora || a.hora || '';
            const horaB = b.fechaHora || b.hora || '';
            return horaA.localeCompare(horaB);
          }),
        [citasFiltradasConsultorio]
    );

    const citasEnConsultaFiltradas = useMemo(
        () => citasFiltradasConsultorio.filter((cita) => cita.estado === 'en_consulta'),
        [citasFiltradasConsultorio]
    );

    const citasFinalizadasFiltradas = useMemo(
        () => citasFiltradasConsultorio.filter((cita) => cita.estado === 'completada'),
        [citasFiltradasConsultorio]
    );

    // ── Mapa de UID → nombre para resolver quién creó cada cita ──
    const nombresCreadores = useMemo(() => {
        const map = {};
        enfermeros.forEach((e) => { if (e.id) map[e.id] = e.nombre || e.id; });
        doctores.forEach((d) => { if (d.id) map[d.id] = d.nombre || d.id; });
        if (user?.uid) map[user.uid] = user.nombre || user.uid;
        return map;
    }, [enfermeros, doctores, user?.uid, user?.nombre]);

    const citasJornadaSucursal = useMemo(() => {
        const sucursalIdActual = String(sucursalPredeterminada?.id || '').trim();
        if (!sucursalIdActual) return [];
        return citas
            .filter((cita) => String(cita.sucursalId || '').trim() === sucursalIdActual && cita.estado !== 'cancelada')
            .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    }, [citas, sucursalPredeterminada]);

    const citasEnRango = useMemo(() => {
        return citasJornadaSucursal.filter((cita) => {
            const hora = cita.hora || '';
            if (!hora) return true; // sin hora: siempre se muestran
            return hora >= horaInicioRango && hora <= horaFinRango;
        });
    }, [citasJornadaSucursal, horaInicioRango, horaFinRango]);

  // --- HELPERS ---
  const SESION_STALE_MS = 5 * 60 * 1000; // 5 min — el heartbeat corre cada 2 min

  const isSessionStale = (docData) => {
    if (!docData.lastSeen) return true;
    return Date.now() - new Date(docData.lastSeen).getTime() > SESION_STALE_MS;
  };

  const getDoctorStatus = (docData) => {
    if (!docData.isOnline || isSessionStale(docData))
      return { color: 'bg-slate-300', text: 'Fuera de Línea' };
    if (docData.statusOperativo === 'ocupado') return { color: 'bg-rose-500', text: 'Ocupado' };
    if (docData.statusOperativo === 'comida') return { color: 'bg-amber-500', text: 'Comida' };
    return { color: 'bg-emerald-500', text: 'Disponible' };
  };

    const getDoctorConsultorio = (docData) => {
        // Priorizar el nuevo contexto de sesión si está disponible, con fallback a los campos heredados
        const consultorioIdRaw = String(docData?.sessionConsultorioId || docData?.consultorioActualId || docData?.consultorioRecurrenteId || docData?.consultorioId || '').trim();
        const consultorioNombreRaw = String(
            docData?.sessionConsultorioNombre || docData?.consultorioActual || docData?.consultorioRecurrente || docData?.consultorio || ''
        ).trim();

        const consultorioById = consultorios.find((item) => String(item?.id || '').trim() === consultorioIdRaw);
        const consultorioByName = consultorioNombreRaw
            ? consultorios.find((item) => String(item?.nombre || '').trim().toLowerCase() === consultorioNombreRaw.toLowerCase())
            : null;
        const found = consultorioById || consultorioByName || null;

        return {
            id: found?.id || consultorioIdRaw,
            nombre: found?.nombre || consultorioNombreRaw,
            sucursalId: docData?.sessionSucursalId || found?.sucursalId || '',
            sucursal: docData?.sessionSucursalNombre || found?.sucursal || ''
        };
    };

  const cambiarDia = (dias) => {
    const nueva = new Date(currentDate);
    nueva.setDate(nueva.getDate() + dias);
    setCurrentDate(nueva);
  };

  const handlePacienteCreado = (nuevoPaciente) => {
        const p = {
            id: nuevoPaciente.id,
            nombre: nuevoPaciente.nombreCompleto,
            telefono: nuevoPaciente.telefonoMovil,
            idPaciente: nuevoPaciente.idPaciente || ''
        };
        setTodosLosPacientes((prev) => {
            const next = prev.filter((item) => item.id !== p.id);
            next.push(p);
            return next.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
        });

        if (pacienteAEditar) {
            setSelectedPacienteDetalle({ id: nuevoPaciente.id, ...nuevoPaciente });
            setSelectedCita((prev) => {
                if (!prev || prev.pacienteId !== nuevoPaciente.id) return prev;
                return {
                    ...prev,
                    paciente: nuevoPaciente.nombreCompleto || prev.paciente,
                    pacienteTelefono: nuevoPaciente.telefonoMovil || prev.pacienteTelefono
                };
            });
            setShowPacienteModal(false);
            return;
        }

        seleccionarPaciente(p);
    setShowPacienteModal(false);
  };

  const seleccionarPaciente = (p) => {
    setNuevaCita(prev => ({ ...prev, paciente: p.nombre, pacienteId: p.id, pacienteTelefono: p.telefono }));
    setMostrarSugerencias(false);
  };

  const iniciarAgendado = (slot) => {
    const ahora = new Date();
    const [h, m] = slot.startTime.split(':');
    const fechaCita = new Date(currentDate);
    fechaCita.setHours(h, m, 0, 0);

    if (fechaCita < ahora && fechaCita.getDate() === ahora.getDate()) {
        setConfirmModal({ show: true, slot });
        return;
    }
    abrirModalCita(slot);
  };

  const abrirModalCita = (slot) => {
        const consultorioNombre = selectedConsultorio !== 'Todos' ? selectedConsultorio : (consultoriosNombres[0] || '');
        const consultorioData = consultorios.find((c) => c.nombre === consultorioNombre);
        const motivoData = catalogoMotivos[0] || null;
    const sucursalData = sucursalPredeterminada || null;

    setEditingCitaId('');
    setNuevaCita({ 
        ...nuevaCita, 
        fecha: toInputDateValue(currentDate), 
        hora: slot.startTime, 
                horaFin: slot.endTime || sumarMinutos(slot.startTime, INTERVALO_MINUTOS),
                consultorio: consultorioNombre,
                consultorioId: consultorioData?.id || '',
                motivo: motivoData?.nombre || '',
                motivoId: motivoData?.id || '',
                sucursal: sessionSucursal?.nombre || sucursalData?.nombre || user?.sucursal || '',
                sucursalId: sessionSucursal?.id || sucursalData?.id || user?.sucursalId || '',
                formaPago: ''
    });
    setShowCitaModal(true);
    setConfirmModal({ show: false, slot: null });
  };

    const abrirModalEditarCita = (cita) => {
        if (!cita?.id) return;

        const motivoData = catalogoMotivos.find((m) => m.id === cita.motivoId)
            || catalogoMotivos.find((m) => m.nombre === cita.motivo)
            || null;
        const consultorioData = consultorios.find((c) => c.id === cita.consultorioId)
            || consultorios.find((c) => c.nombre === cita.consultorio)
            || null;
        const sucursalData = catalogoSucursales.find((s) => s.id === cita.sucursalId)
            || catalogoSucursales.find((s) => s.nombre === cita.sucursal)
            || null;

        const fecha = cita.fecha
            || (typeof cita.fechaHora === 'string' ? cita.fechaHora.slice(0, 10) : '')
            || toInputDateValue(currentDate);
        const hora = cita.hora
            || (typeof cita.fechaHora === 'string' ? cita.fechaHora.slice(11, 16) : '');
        const horaFin = cita.horaFin
            || (typeof cita.fechaHoraFin === 'string' ? cita.fechaHoraFin.slice(11, 16) : '')
            || (hora ? sumarMinutos(hora, INTERVALO_MINUTOS) : '');

        setEditingCitaId(cita.id);
        setNuevaCita((prev) => ({
            ...prev,
            paciente: cita.paciente || '',
            pacienteId: cita.pacienteId || '',
            pacienteTelefono: cita.pacienteTelefono || '',
            fecha,
            hora,
            horaFin,
            motivo: motivoData?.nombre || cita.motivo || '',
            motivoId: motivoData?.id || cita.motivoId || '',
            doctorAsignado: cita.doctorAsignado || '',
            doctorUid: cita.doctorUid || '',
            esTeleconsulta: Boolean(cita.esTeleconsulta),
            consultorio: consultorioData?.nombre || cita.consultorio || '',
            consultorioId: consultorioData?.id || cita.consultorioId || '',
            sucursal: cita.sucursal || sucursalData?.nombre || sessionSucursal?.nombre || user?.sucursal || '',
            sucursalId: cita.sucursalId || sucursalData?.id || sessionSucursal?.id || user?.sucursalId || '',
            tipoConsulta: cita.tipoConsulta || 'Primera vez',
            formaPago: cita.formaPago || '',
            enfermeroAsignadoId: cita.enfermeroAsignadoId || '',
            enfermeroAsignadoNombre: cita.enfermeroAsignadoNombre || ''
        }));
        setShowCitaModal(true);
    };

const handleGuardarCita = async (e) => {
    e?.preventDefault();
        if (isSavingCita) return;
    const motivoSeleccionado = catalogoMotivos.find((m) => m.id === nuevaCita.motivoId);
    const esCitaEnfermeria = Boolean(motivoSeleccionado?.atendidoPorEnfermeria);

    if (!esCitaEnfermeria) {
        const faltantes = [];
        if (!nuevaCita.paciente) faltantes.push('Paciente');
        if (!nuevaCita.hora || !nuevaCita.horaFin) faltantes.push('Horario (inicio/fin)');
        if (!nuevaCita.motivo) faltantes.push('Motivo de la visita');
        if (!nuevaCita.consultorio) faltantes.push('Consultorio');
        if (!nuevaCita.doctorUid) faltantes.push('Médico responsable');
        if (!nuevaCita.formaPago) faltantes.push('Forma de pago');
        if (faltantes.length > 0) {
            showToast(`Falta completar: ${faltantes.join(', ')}.`, 'error');
            return;
        }
    } else {
        const faltantes = [];
        if (!nuevaCita.paciente) faltantes.push('Paciente');
        if (!nuevaCita.hora || !nuevaCita.horaFin) faltantes.push('Horario (inicio/fin)');
        if (!nuevaCita.motivo) faltantes.push('Motivo de la visita');
        if (!nuevaCita.formaPago) faltantes.push('Forma de pago');
        if (faltantes.length > 0) {
            showToast(`Falta completar: ${faltantes.join(', ')}.`, 'error');
            return;
        }
    }

    // Validar horario bloqueado por el doctor (solo si aplica)
    if (!esCitaEnfermeria) {
        const bloqueadosDoctor = horariosBloqueadosPorDoctor.get(nuevaCita.doctorUid);
        if (bloqueadosDoctor) {
            const [hh, mm] = (nuevaCita.hora || '').split(':').map(Number);
            if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
                const minInicio = Math.floor(mm / INTERVALO_MINUTOS) * INTERVALO_MINUTOS;
                const slotKey = `${hh.toString().padStart(2, '0')}:${minInicio.toString().padStart(2, '0')}`;
                const infoBloqueo = bloqueadosDoctor.get(slotKey);
                if (infoBloqueo) {
                    // Solo bloquear si el bloqueo tiene consultorio definido y coincide con el de la cita
                    const consultorioCita = (nuevaCita.consultorio || '').trim();
                    const consultorioBloqueo = (infoBloqueo.consultorioNombre || '').trim();
                    if (consultorioBloqueo && consultorioBloqueo === consultorioCita) {
                        showToast(`El Dr. ${nuevaCita.doctorAsignado} bloqueó ese horario. Selecciona otro.`, "error");
                        return;
                    }
                }
            }
        }
    }

    if (!nuevaCita.pacienteId) {
        showToast('Selecciona un paciente de la lista. Si no aparece, regístralo primero con el botón +.', 'warning');
        return;
    }

    setIsSavingCita(true);
    try {
        const pacienteDoc = await getDoc(doc(db, 'pacientes', nuevaCita.pacienteId));
        if (!pacienteDoc.exists()) {
            showToast('El paciente no está dado de alta en el sistema. Regístralo primero.', 'warning');
            return;
        }

        const motivoData = catalogoMotivos.find((m) => m.id === nuevaCita.motivoId) || catalogoMotivos.find((m) => m.nombre === nuevaCita.motivo);
        const consultorioData = consultorios.find((c) => c.id === nuevaCita.consultorioId) || consultorios.find((c) => c.nombre === nuevaCita.consultorio);
                const sucursalData = catalogoSucursales.find((s) => s.id === nuevaCita.sucursalId)
                    || catalogoSucursales.find((s) => s.nombre === nuevaCita.sucursal)
                    || (consultorioData?.sucursalId ? catalogoSucursales.find((s) => s.id === consultorioData.sucursalId) : null)
                    || sucursalPredeterminada
                    || null;

                const citaActual = isEditingCita
                    ? (selectedCita?.id === editingCitaId ? selectedCita : (citas.find((c) => c.id === editingCitaId) || null))
                    : null;
                let meetLink = '';
                if (nuevaCita.esTeleconsulta) {
                    if (isEditingCita && citaActual?.meetLink) {
                        meetLink = citaActual.meetLink;
                    } else {
                        const roomId = `srs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                        meetLink = `https://meet.jit.si/${roomId}`;
                    }
                }

                const payloadBase = {
          ...nuevaCita,
          motivo: motivoData?.nombre || nuevaCita.motivo,
          motivoId: motivoData?.id || nuevaCita.motivoId || '',
          motivoPrecio: Number(motivoData?.precio || 0),
          areaConsulta: motivoData?.area || '',
          consultorio: consultorioData?.nombre || nuevaCita.consultorio,
          consultorioId: consultorioData?.id || nuevaCita.consultorioId || '',
          sucursal: sessionSucursal?.nombre || nuevaCita.sucursal || sucursalData?.nombre || sucursalPredeterminada?.nombre || user?.sucursal || '',
          sucursalId: sessionSucursal?.id || nuevaCita.sucursalId || sucursalData?.id || user?.sucursalId || '',
          meetLink,
          formaPago: nuevaCita.formaPago,
          fechaHora: `${nuevaCita.fecha}T${nuevaCita.hora}`,
          fechaHoraFin: `${nuevaCita.fecha}T${nuevaCita.horaFin}`,
          esCitaEnfermeria,
          enfermeroAsignadoId: esCitaEnfermeria ? (nuevaCita.enfermeroAsignadoId || '') : '',
          enfermeroAsignadoNombre: esCitaEnfermeria ? (nuevaCita.enfermeroAsignadoNombre || '') : ''
        };

                if (isEditingCita) {
                    const updatePayload = {
                        ...payloadBase,
                        actualizadaAt: serverTimestamp(),
                        actualizadaPor: user?.uid || '',
                        actualizadaPorNombre: user?.nombre || ''
                    };
                    await updateDoc(doc(db, 'citas', editingCitaId), updatePayload);
                    setSelectedCita((prev) => (prev && prev.id === editingCitaId ? { ...prev, ...updatePayload } : prev));
                    showToast('Cita actualizada correctamente', 'success');
                    cerrarModalCita();
                    return;
                }

                const payload = {
                    ...payloadBase,
                    estado: 'pendiente',
                    creadoPor: user.uid,
                    creadoPorRol: 'enfermeria'
                };

                const citaRef = await addDoc(collection(db, "citas"), payload);

                // Incrementar contador de uso del motivo
                if (motivoData?.id) {
                    updateDoc(doc(db, 'catalogo_motivos_consulta', motivoData.id), { usoCount: increment(1) }).catch(() => {});
                }

                // Si es cita de enfermería, abrir la pestaña antes del await para evitar bloqueos
                let ordenWindow = null;
                if (esCitaEnfermeria) {
                    ordenWindow = window.open('about:blank', '_blank');
                }

                // Redirigir la pestaña a la orden de servicio cuando se tenga el ID
                if (esCitaEnfermeria && ordenWindow) {
                    ordenWindow.location.href = `/enfermeria/orden-servicio?citaId=${citaRef.id}`;
                }

                if (nuevaCita.esTeleconsulta && nuevaCita.pacienteTelefono) {
                    try {
                        const enviarWA = httpsCallable(functions, 'enviarWhatsAppNotificacion');
                        await enviarWA({
                            telefono: nuevaCita.pacienteTelefono,
                            nombrePaciente: nuevaCita.paciente,
                            consultorio: payload.consultorio || 'Consultorio',
                            nombreDoctor: user?.nombre || '',
                            nombreClinica: payload.sucursal || user?.sucursal || 'Clínica',
                            motivo: `${payload.motivo || 'Consulta'} | Link Meet: ${meetLink}`,
                            templateName: 'teleconsulta_turno'
                        });
                        await updateDoc(doc(db, 'citas', citaRef.id), {
                            notificadoWhatsApp: true,
                            notificadoWhatsAppAt: serverTimestamp(),
                            notificadoPor: user?.uid || '',
                            notificadoPorNombre: user?.nombre || ''
                        });
                        showToast("Cita agendada y enlace enviado por WhatsApp", "success");
                    } catch (waError) {
                        console.error('Error al enviar WhatsApp automático de teleconsulta:', waError);
                        showToast("Cita agendada, pero no se pudo enviar el enlace por WhatsApp", "warning");
                    }
                } else {
                    showToast("Cita agendada correctamente", "success");
                }

                cerrarModalCita();
        setNuevaCita({ 
          ...nuevaCita,
          paciente: '',
          pacienteId: '',
          pacienteTelefono: '',
          hora: '',
          horaFin: '',
                    esTeleconsulta: false,
                    formaPago: '',
                    enfermeroAsignadoId: '',
                    enfermeroAsignadoNombre: ''
        });
        } catch (e) { 
        console.error(e); 
        showToast("Error al guardar la cita en el servidor", "error"); 
        } finally {
                setIsSavingCita(false);
    }
  };

  // ─── ACCIONES DEL DRAWER ───

  const handleReprogramar = async () => {
    if (!selectedCita || !reprogramarData.fecha || !reprogramarData.hora) {
      showToast("Selecciona fecha y hora para reprogramar.", "error");
      return;
    }
    setActionLoading('reprogramar');
    try {
      const horaFin = reprogramarData.horaFin || sumarMinutos(reprogramarData.hora, INTERVALO_MINUTOS);
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        fecha: reprogramarData.fecha,
        hora: reprogramarData.hora,
        horaFin,
        fechaHora: `${reprogramarData.fecha}T${reprogramarData.hora}`,
        fechaHoraFin: `${reprogramarData.fecha}T${horaFin}`,
        reprogramadaAt: serverTimestamp(),
        reprogramadaPor: user?.uid || '',
        reprogramadaPorNombre: user?.nombre || ''
      });
      // Actualizar en el estado local
      setSelectedCita(prev => prev ? { ...prev, fecha: reprogramarData.fecha, hora: reprogramarData.hora, horaFin, fechaHora: `${reprogramarData.fecha}T${reprogramarData.hora}` } : null);
      setShowReprogramar(false);
      showToast("Cita reprogramada correctamente", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al reprogramar la cita", "error");
    }
    setActionLoading('');
  };

  const handleRegistrarLlegada = async () => {
    if (!selectedCita) return;
    setActionLoading('llegada');
    try {
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        llegadaRegistrada: true,
        llegadaAt: serverTimestamp(),
        llegadaRegistradaPor: user?.uid || '',
        llegadaRegistradaPorNombre: user?.nombre || ''
      });
      setSelectedCita(prev => prev ? { ...prev, llegadaRegistrada: true } : null);
      showToast("Llegada del paciente registrada", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al registrar llegada", "error");
    }
    setActionLoading('');
  };

  const handleFinalizarCita = async () => {
    if (!selectedCita) return;
    setActionLoading('finalizar');
    try {
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        estado: 'completada',
        completadaAt: serverTimestamp(),
        procedimientoFinalizadoAt: serverTimestamp(),
        procedimientoFinalizadoPor: user?.uid || '',
        procedimientoFinalizadoPorNombre: user?.nombre || ''
      });
      setSelectedCita(prev => prev ? { ...prev, estado: 'completada' } : null);
      showToast("Cita de enfermería finalizada correctamente", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al finalizar la cita", "error");
    }
    setActionLoading('');
  };

  const handleEnviarRecordatorio = async () => {
    if (!selectedCita) return;
    setActionLoading('whatsapp');
    try {
      // Buscar teléfono del paciente
      let telefono = selectedCita.pacienteTelefono || '';
      if (!telefono && selectedCita.pacienteId) {
        const pacienteLocal = todosLosPacientes.find(p => p.id === selectedCita.pacienteId);
        telefono = pacienteLocal?.telefono || '';
        if (!telefono) {
          const snap = await getDoc(doc(db, 'pacientes', selectedCita.pacienteId));
          if (snap.exists()) telefono = snap.data().telefonoMovil || snap.data().telefono || '';
        }
      }
      if (!telefono) {
        showToast("No se encontró teléfono del paciente. Agrégalo en sus datos.", "error");
        setActionLoading('');
        return;
      }
      const enviarWA = httpsCallable(functions, 'enviarWhatsAppNotificacion');
      await enviarWA({
        telefono,
        nombrePaciente: selectedCita.paciente,
        consultorio: selectedCita.consultorio || 'Consultorio',
        nombreDoctor: selectedCita.doctorAsignado || '',
        nombreClinica: selectedCita.sucursal || user?.sucursal || 'Clínica',
        motivo: selectedCita.motivo || 'Consulta',
        templateName: 'recordatorio_cita'
      });
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        recordatorioEnviado: true,
        recordatorioEnviadoAt: serverTimestamp(),
        recordatorioEnviadoPor: user?.uid || ''
      });
      setSelectedCita(prev => prev ? { ...prev, recordatorioEnviado: true } : null);
      showToast("Recordatorio enviado por WhatsApp", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al enviar recordatorio. Se configurará más adelante.", "warning");
    }
    setActionLoading('');
  };

  const handleCancelarCita = async () => {
    if (!selectedCita) return;
    setActionLoading('cancelar');
    try {
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        estado: 'cancelada',
        canceladaAt: serverTimestamp(),
        canceladaPor: user?.uid || '',
        canceladaPorNombre: user?.nombre || '',
        canceladaMotivo: cancelarMotivo || 'Sin motivo especificado'
      });
      setShowCancelarConfirm(false);
      setCancelarMotivo('');
      setSelectedCita(null);
      showToast("Cita cancelada correctamente", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al cancelar la cita", "error");
    }
    setActionLoading('');
  };

  const handleEditarAntecedentes = async () => {
    if (!selectedCita?.pacienteId) {
      showToast("No hay paciente vinculado a esta cita.", "error");
      return;
    }
    navigate('/enfermeria/antecedentes', {
      state: {
        pacienteId: selectedCita.pacienteId,
        pacienteNombre: selectedCita.paciente,
        citaId: selectedCita.id,
        soloAntecedentes: true
      }
    });
  };

  const handleReasignarDoctor = async () => {
    if (!selectedCita) return;
    if (!reasignarData.doctorUid) {
      showToast('Selecciona un doctor para reasignar.', 'error');
      return;
    }
    if (!reasignarData.justificacion.trim()) {
      showToast('Escribe una justificación para la reasignación.', 'error');
      return;
    }
    setActionLoading('reasignar');
    try {
      await updateDoc(doc(db, 'citas', selectedCita.id), {
        doctorAsignado: reasignarData.doctorNombre,
        doctorUid: reasignarData.doctorUid,
        reasignadaAt: serverTimestamp(),
        reasignadaPor: user?.uid || '',
        reasignadaPorNombre: user?.nombre || '',
        reasignadaDoctorAnterior: selectedCita.doctorAsignado || '',
        reasignadaDoctorAnteriorUid: selectedCita.doctorUid || '',
        reasignadaJustificacion: reasignarData.justificacion.trim()
      });
      setSelectedCita(prev => prev ? { ...prev, doctorAsignado: reasignarData.doctorNombre, doctorUid: reasignarData.doctorUid } : null);
      setShowReasignar(false);
      setReasignarData({ doctorUid: '', doctorNombre: '', justificacion: '' });
      showToast(`Cita reasignada al Dr. ${reasignarData.doctorNombre}`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al reasignar la cita', 'error');
    }
    setActionLoading('');
  };

  const handleCambiarConsultorio = async () => {
    if (!selectedCita) return;
    if (!cambiarConsultorioData.consultorioId) {
      showToast('Selecciona un consultorio.', 'error');
      return;
    }
    if (!cambiarConsultorioData.justificacion.trim()) {
      showToast('Escribe una justificación para el cambio.', 'error');
      return;
    }
    setActionLoading('cambiarConsultorio');
    try {
      const updatePayload = {
        consultorio: cambiarConsultorioData.consultorioNombre,
        consultorioId: cambiarConsultorioData.consultorioId,
        consultorioCambiadoAt: serverTimestamp(),
        consultorioCambiadoPor: user?.uid || '',
        consultorioCambiadoPorNombre: user?.nombre || '',
        consultorioAnterior: selectedCita.consultorio || '',
        consultorioAnteriorId: selectedCita.consultorioId || '',
        consultorioCambiadoJustificacion: cambiarConsultorioData.justificacion.trim()
      };
      if (cambiarConsultorioData.sucursalId) {
        updatePayload.sucursal = cambiarConsultorioData.sucursalNombre;
        updatePayload.sucursalId = cambiarConsultorioData.sucursalId;
      }
      await updateDoc(doc(db, 'citas', selectedCita.id), updatePayload);
      setSelectedCita(prev => prev ? {
        ...prev,
        consultorio: cambiarConsultorioData.consultorioNombre,
        consultorioId: cambiarConsultorioData.consultorioId,
        ...(cambiarConsultorioData.sucursalId ? { sucursal: cambiarConsultorioData.sucursalNombre, sucursalId: cambiarConsultorioData.sucursalId } : {})
      } : null);
      setShowCambiarConsultorio(false);
      setCambiarConsultorioData({ consultorioId: '', consultorioNombre: '', sucursalId: '', sucursalNombre: '', justificacion: '' });
      showToast(`Consultorio cambiado a ${cambiarConsultorioData.consultorioNombre}`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al cambiar el consultorio', 'error');
    }
    setActionLoading('');
  };

    const handleGenerarDocumento = () => {
        if (!selectedCita?.pacienteId) {
            showToast("No hay paciente vinculado a esta cita.", "error");
            return;
        }

        setSelectedDoctorDocsId('');
        setDoctorDocsSearchTerm('');
        setShowModalSelectDoctorDocumentos(true);
    };

    const handleConfirmarDoctorDocumentos = () => {
        if (!selectedDoctorDocsId) {
            showToast("Debes seleccionar un médico a cargo para generar los documentos.", "error");
            return;
        }

        const doctorEncontrado = doctores.find(doc => doc.id === selectedDoctorDocsId) || null;

        navigate('/enfermeria/expediente', {
            state: {
                pacienteId: selectedCita.pacienteId,
                pacienteNombre: selectedCita.paciente,
                citaId: selectedCita.id,
                openDocumentTemplates: true,
                openedFrom: 'enfermeria_agenda',
                doctorOverride: doctorEncontrado
            }
        });

        setShowModalSelectDoctorDocumentos(false);
    };

    const procesarArchivoParaPaciente = async ({ file, pacienteId, pacienteNombre, citaId, motivo }) => {
        setUploadingEstudio(true);
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
                    origen: 'carga_enfermeria'
                }
            });

            const downloadURL = await getDownloadURL(storageRefItem);

            const ext = file.name.split('.').pop()?.toLowerCase() || 'archivo';
            const eventoDocumental = {
                tipo: 'estudio',
                nombre: file.name,
                formato: ext,
                origen: 'carga_enfermeria',
                plantillaId: '',
                archivoUrl: downloadURL,
                archivoPath: storagePath,
                generadoAt: new Date().toISOString(),
                enfermeroNombre: user?.nombre || 'Enfermero/a'
            };

            await addDoc(collection(db, 'historial_clinico'), {
                pacienteId,
                pacienteNombre,
                medicoNombre: user?.nombre || 'Enfermero/a',
                fecha: serverTimestamp(),
                medicoId: user?.uid || 'anonimo',
                citaId: citaId || null,
                tipoNota: 'Carga de Estudio',
                documentosGenerados: [eventoDocumental],
                motivo: motivo || '',
                origenRegistro: 'enfermeria_agenda',
                subidoPor: user?.nombre || 'Enfermero/a',
                subidoPorRol: user?.role || 'enfermeria'
            });

            showToast('Estudio cargado correctamente al expediente clínico.', 'success');
        } catch (e) {
            console.error('Error al cargar estudio:', e);
            showToast('Error al cargar el estudio. Intenta de nuevo.', 'error');
        }
        setUploadingEstudio(false);
    };

    const handleUploadEstudioClick = () => {
        if (!selectedCita?.pacienteId) {
            showToast("No hay paciente vinculado a esta cita.", "error");
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCita?.pacienteId) return;
        e.target.value = '';
        await procesarArchivoParaPaciente({
            file,
            pacienteId: selectedCita.pacienteId,
            pacienteNombre: selectedCita.paciente,
            citaId: selectedCita.id,
            motivo: selectedCita.motivo || ''
        });
    };

    const handleDropOnCard = async (e, cita) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverCitaId(null);
        if (cita.estado === 'cancelada') return;
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        await procesarArchivoParaPaciente({
            file,
            pacienteId: cita.pacienteId,
            pacienteNombre: cita.paciente,
            citaId: cita.id,
            motivo: cita.motivo || ''
        });
    };

    const handleDragOverCard = (e, citaId, cita) => {
        e.preventDefault();
        e.stopPropagation();
        if (cita?.estado === 'cancelada') return;
        setDragOverCitaId(citaId);
    };

    const handleDragLeaveCard = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverCitaId(null);
    };

    const doctoresFiltrados = useMemo(() => {
        const sucursalNurseId = String(sucursalPredeterminada?.id || '').trim();
        const sucursalNurseNombre = (sucursalPredeterminada?.nombre || '').trim().toLowerCase();

        const scored = doctores.map((doc) => {
            const status = getDoctorStatus(doc);
            const consultorio = getDoctorConsultorio(doc);
            const docSucursalId = String(consultorio.sucursalId || '').trim();
            const docSucursalNombre = String(consultorio.sucursal || '').trim().toLowerCase();
            const mismaSucursal = (sucursalNurseId && docSucursalId && sucursalNurseId === docSucursalId)
                || (sucursalNurseNombre && docSucursalNombre && docSucursalNombre.includes(sucursalNurseNombre))
                || (sucursalNurseNombre && docSucursalNombre && sucursalNurseNombre.includes(docSucursalNombre));

            const isOnline = doc.isOnline === true && !isSessionStale(doc);
            const isActive = isOnline && (doc.statusOperativo !== 'ocupado' && doc.statusOperativo !== 'comida');

            let group = 3;
            if (isActive && mismaSucursal) group = 0;
            else if (isActive && !mismaSucursal) group = 1;
            else if (mismaSucursal) group = 2;

            return { ...doc, _group: group, _consultorio: consultorio, _status: status, _mismaSucursal: mismaSucursal };
        });

        return scored.sort((a, b) => {
            if (a._group !== b._group) return a._group - b._group;
            return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' });
        });
    }, [doctores, sucursalPredeterminada]);

    const doctoresConPx = useMemo(() => {
        const ahora = new Date();
        return doctoresFiltrados.map((doc) => {
            const citasDoctor = citas.filter(
                (c) => c.doctorUid === doc.id && c.estado !== 'cancelada'
            );
            const enConsulta = citasDoctor.find((c) => c.estado === 'en_consulta') || null;
            const enEspera = citasDoctor.filter((c) => c.estado === 'en_espera' || c.estado === 'pendiente');
            const totalPendientes = enEspera.length;
            const minutosConsulta = enConsulta?.consultaIniciadaAt
                ? Math.max(0, Math.round((ahora - new Date(enConsulta.consultaIniciadaAt.seconds ? enConsulta.consultaIniciadaAt.toDate() : enConsulta.consultaIniciadaAt)) / 60000))
                : 0;

            const signosVit = enConsulta?.signos_vitales || null;
            const triageAlergias = enConsulta?.triage_alergias || '';
            const triageEnfermedades = enConsulta?.triage_enfermedades || null;

            return {
                ...doc,
                _enConsulta: enConsulta,
                _totalPendientes: totalPendientes,
                _minutosConsulta: minutosConsulta,
                _signosVit: signosVit,
                _triageAlergias: triageAlergias,
                _triageEnfermedades: triageEnfermedades,
            };
        });
    }, [doctoresFiltrados, citas]);

    const detallePacienteActivo = useMemo(() => {
        if (!selectedCita) return null;

        const patientData = selectedPacienteDetalle || {};
        const nombre = patientData.nombreCompleto || selectedCita.paciente || 'Paciente sin nombre';
        const fechaNacimiento = patientData.fechaNacimiento || '';
        const edad = calcularEdad(fechaNacimiento);
        const telefonoPrincipal = selectedCita.pacienteTelefono || patientData.telefonoMovil || patientData.telefono || '';
        const padecimientosBase = getPatientConditions(patientData);
        const enfermedadesTriage = selectedCita.triage_enfermedades?.preguntados_y_negados
            ? []
            : uniqueValues([
                ...(selectedCita.triage_enfermedades?.lista || []),
                selectedCita.triage_enfermedades?.otros || ''
            ]);
        const alertasClinicas = uniqueValues([
            selectedCita.triage_alergias ? `Alergias: ${selectedCita.triage_alergias}` : '',
            ...padecimientosBase.map((item) => `Base: ${item}`),
            ...enfermedadesTriage.map((item) => `Triage: ${item}`)
        ]);

        return {
            nombre,
            idPaciente: patientData.idPaciente || patientData.idPacienteMigrado || '',
            fechaNacimiento,
            edad,
            sexo: patientData.sexo || '',
            grupoSanguineo: patientData.grupoSanguineo || patientData.grupo_sanguineo || '',
            telefonoPrincipal,
            telefonoSecundario: patientData.telefonoFijo || '',
            email: patientData.email || '',
            direccion: [patientData.calleNumero, patientData.colonia, patientData.municipioEstado].filter(Boolean).join(', '),
            derechohabiente: patientData.derechohabiente && patientData.derechohabiente !== 'Ninguno' ? patientData.derechohabiente : '',
            aseguradora: patientData.aseguradora || '',
            notas: patientData.notasPersonales || '',
            padecimientosBase,
            enfermedadesTriage,
            alertasClinicas
        };
    }, [selectedCita, selectedPacienteDetalle]);

  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-sm";
  const labelStyle = "text-xs font-bold text-slate-500 uppercase mb-2 ml-1 block tracking-wider";

  return (
    <>
      {/* --- ESTILOS GLOBALES LIQUID / GLASS --- */}
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');

                .font-jakarta { font-family: 'Sora', system-ui, sans-serif; }
                .sora { font-family: 'Sora', system-ui, sans-serif; }
        body { font-family: 'Inter', sans-serif; }

        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .cross-float { animation: ${modoLigero ? 'none' : 'float 6s ease-in-out infinite'}; }

        .btn-main {
          background: #0f172a; color: #fff; transition: transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 8px 24px -8px rgba(15,23,42,0.4);
        }
        .btn-main:hover { background: #1e293b; transform: scale(0.98); }
        
        .glass-panel {
                    background: ${modoLigero ? 'rgba(255,255,255,1)' : 'rgba(255, 255, 255, 0.85)'};
                    backdrop-filter: ${modoLigero ? 'none' : 'blur(16px)'};
                    border: 1px solid ${modoLigero ? 'rgba(226,232,240,1)' : 'rgba(255, 255, 255, 0.6)'};
                    box-shadow: ${modoLigero ? '0 2px 8px rgba(15,23,42,0.06)' : '0 10px 40px -10px rgba(0,0,0,0.05)'};
        }

                .app-shell {
                    background: #f8fafc;
                }

                .app-header-lite {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 8px rgba(15,23,42,0.06);
                }

                .badge-branch-lite {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 2px 8px;
                    font-size: 10px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: .08em;
                }

                .status-online-lite {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 10px;
                    font-weight: 700;
                    color: #059669;
                    text-transform: uppercase;
                    letter-spacing: .08em;
                }

                .timeline-toolbar {
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    border-bottom: 1px solid #e2e8f0;
                    background: #ffffff;
                }

                @media (min-width: 640px) {
                    .timeline-toolbar {
                        padding: 12px 20px;
                        gap: 12px;
                    }
                }

                .timeline-chip-lite {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border: 1px solid #cbd5e1;
                    border-radius: 999px;
                    padding: 5px 10px;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: .05em;
                    text-transform: uppercase;
                    color: #475569;
                    background: #ffffff;
                }

                .timeline-chip-lite.active {
                    border-color: #93c5fd;
                    color: #1d4ed8;
                    background: #eff6ff;
                }

                .modo-ligero *, .modo-ligero *::before, .modo-ligero *::after {
                    animation-duration: 0ms !important;
                    transition-duration: 0ms !important;
                }
        
        /* Ocultar input date nativo pero mantenerlo clickeable */
        .date-picker-overlay::-webkit-calendar-picker-indicator {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;
            opacity: 0; cursor: pointer;
        }
      `}</style>

      {/* --- INPUT OCULTO PARA CARGAR ESTUDIOS --- */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept="*/*"
      />

      {/* --- TOAST NOTIFICATION --- */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all duration-300 ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'} ${toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-700' : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'} backdrop-blur-md`}>
        {toast.type === 'error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
        <span className="font-bold text-sm">{toast.msg}</span>
      </div>

      {/* --- MENÚ MÓVIL (Bottom Sheet) --- */}
      {showMobileNav && (
        <div className="md:hidden fixed inset-0 z-[200]" onClick={() => setShowMobileNav(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 pb-safe"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'slideUp .25s ease-out', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <nav className="px-4 pb-2 space-y-1">
              {[
                { label: 'Registros', icon: <ClipboardList size={20}/>, color: 'text-slate-700', action: () => { setShowMobileNav(false); setShowRegistrosModal(true); } },
                { label: 'Directorio de Pacientes', icon: <User size={20}/>, color: 'text-slate-700', action: () => { setShowMobileNav(false); navigate('/pacientes', { state: { from: '/enfermeria/dashboard' } }); } },
                { label: 'Capacitación', icon: <BookOpen size={20}/>, color: 'text-violet-600', action: () => { setShowMobileNav(false); navigate('/enfermeria/capacitacion'); } },
                { label: 'Cerrar sesión', icon: <LogOut size={18}/>, color: 'text-rose-500', action: async () => { setShowMobileNav(false); try { await logout(); navigate('/'); } catch {} } },
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left font-semibold text-[14px] ${item.color} hover:bg-slate-50 active:bg-slate-100 transition-colors`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* --- FAB TRIGGER MÓVIL --- */}
      <button
        type="button"
        className="md:hidden fixed bottom-5 left-5 z-[95] w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/30 flex items-center justify-center active:scale-90 transition-all"
        onClick={() => setShowMobileNav(true)}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <MoreHorizontal size={24} />
      </button>

        <div className={`h-screen flex flex-col relative overflow-hidden text-slate-700 app-shell ${modoLigero ? 'modo-ligero' : ''}`}>

{/* 1. HEADER RESPONSIVE */}
                <div className="app-header-lite px-3 sm:px-6 py-3 flex flex-wrap md:flex-nowrap justify-between items-center gap-2 z-30 shrink-0 mx-3 sm:mx-6 mt-3 rounded-2xl mb-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/30 shrink-0">
              <Activity size={18} className="sm:w-5 sm:h-5"/>
            </div>
            <div className="min-w-0">
                            <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-none sora tracking-tight truncate">Enfermería</h1>
              <div className="flex items-center gap-2 mt-1">
                                <span className="badge-branch-lite">
                    <MapPin size={10}/> <span className="hidden sm:inline">{sucursalPredeterminada?.nombre || 'Sin sucursal'}</span><span className="sm:hidden">{(sucursalPredeterminada?.nombre || 'Sucursal').split(' ').slice(0,2).join(' ')}</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                                <span className="status-online-lite hidden sm:inline-flex">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> En Linea
                </span>
              </div>
            </div>
          </div>

          {/* Selector de Fecha Inteligente */}
          <div className="bg-white/80 border border-slate-200 p-1 rounded-xl flex items-center shadow-sm order-3 md:order-none">
            <button onClick={()=>cambiarDia(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all hover:shadow-sm"><ChevronLeft size={18}/></button>
            
            <div className="relative flex items-center justify-center px-2 sm:px-4 cursor-pointer group">
                <input 
                    type="date" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 date-picker-overlay"
                    value={toInputDateValue(currentDate)}
                    onChange={(e) => {
                            if(e.target.value) setCurrentDate(new Date(e.target.value + 'T12:00:00'));
                        }}
                    />
                    <div className="flex flex-col items-center group-hover:text-blue-600 transition-colors">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <CalIcon size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800 capitalize font-jakarta group-hover:text-blue-700 transition-colors">
                            {currentDate.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}
                        </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">
                        {currentDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                </div>
            </div>
<button onClick={()=>cambiarDia(1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all hover:shadow-sm"><ChevronRight size={18}/></button>
          </div>

          <div className="flex gap-2 sm:gap-3">
            {/* --- NUEVO BOTÓN: REGISTROS ACTUALIZADO --- */}
            <button 
                onClick={() => setShowRegistrosModal(true)} 
                className="hidden md:flex text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition-all items-center gap-2 shadow-sm"
            >
                <ClipboardList size={16} /> Registros
            </button>

            {/* --- BOTÓN: RESUMEN DE JORNADA --- */}
            <button 
                onClick={() => setShowResumenJornada(true)} 
                className="hidden md:flex text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 font-bold text-xs px-4 py-2 rounded-xl transition-all items-center gap-2 shadow-sm"
            >
                <ReceiptText size={16} /> Jornada
            </button>

            {/* BOTÓN EXISTENTE: DIRECTORIO */}
            <button onClick={() => navigate('/pacientes', { state: { from: '/enfermeria/dashboard' } })} className="hidden md:flex text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition-all items-center gap-2 shadow-sm">
                <User size={16} /> Directorio
            </button>

            {/* BOTÓN: CAPACITACIÓN */}
            <button onClick={() => navigate('/enfermeria/capacitacion')} className="hidden md:flex text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 font-bold text-xs px-4 py-2 rounded-xl transition-all items-center gap-2 shadow-sm">
                <BookOpen size={16} /> Capacitación
            </button>

            {/* BOTÓN: CERRAR SESIÓN */}
            <button onClick={async () => { try { await logout(); navigate('/'); } catch {} }} className="hidden md:flex text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-200 font-bold text-xs px-3 py-2 rounded-xl transition-all items-center gap-2">
                <LogOut size={16} />
            </button>
            
            {/* BOTÓN EXISTENTE: NUEVA CITA */}
                        <button onClick={() => {
                setEditingCitaId('');
                                const consultorioNombre = selectedConsultorio !== 'Todos' ? selectedConsultorio : (consultoriosNombres[0] || '');
                                const consultorioData = consultorios.find((c) => c.nombre === consultorioNombre);
                                const motivoData = catalogoMotivos[0] || null;
                            const sucursalData = sucursalPredeterminada || null;
                                setNuevaCita({
                                    ...nuevaCita,
                                    fecha: toInputDateValue(currentDate),
                                    hora: '',
                                    horaFin: '',
                                    consultorio: consultorioNombre,
                                    consultorioId: consultorioData?.id || '',
                                    motivo: motivoData?.nombre || '',
                                    motivoId: motivoData?.id || '',
                                    sucursal: sessionSucursal?.nombre || sucursalData?.nombre || user?.sucursal || '',
                                    sucursalId: sessionSucursal?.id || sucursalData?.id || user?.sucursalId || '',
                                    formaPago: ''
                                });
                                setShowCitaModal(true);
                            }} 
                className="btn-main font-jakarta rounded-xl px-3 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2 text-xs shadow-md">
              <Plus size={16} strokeWidth={2.5} /> <span className="hidden sm:inline">Nueva Cita</span><span className="sm:hidden">Cita</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden px-3 sm:px-6 pb-3 sm:pb-6 gap-3 sm:gap-6 z-10 relative">
          
          {/* --- COLUMNA IZQUIERDA: AGENDA --- */}
          <div className="flex-1 flex flex-col relative overflow-hidden glass-panel rounded-2xl sm:rounded-3xl min-w-0">
              
             {/* HUD DE MÉTRICAS & SELECTOR DE CONSULTORIO */}
              <div className="px-3 sm:px-6 py-2 border-b border-slate-200/50 flex justify-between items-center gap-2 sm:gap-3 shrink-0 bg-white/40" />


              {/* FILTROS */}
              <div className="timeline-toolbar flex-col sm:flex-row gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 sora shrink-0">Consultas del día</h2>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                      {/* Selector de consultorio */}
                      <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
                          <div className="bg-indigo-50 p-1 rounded-md text-indigo-600"><Building size={12}/></div>
                          <div className="relative">
                              <select 
                                value={selectedConsultorio} onChange={(e) => setSelectedConsultorio(e.target.value)}
                                className="bg-transparent border-none outline-none font-bold text-[10px] text-slate-800 pr-4 cursor-pointer font-jakarta appearance-none w-full"
                              >
                                 <option value="Todos">Todos los Consultorios</option>
                                          {consultoriosNombres.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <ChevronDown size={12} className="absolute right-0 top-0 text-slate-400 pointer-events-none"/>
                          </div>
                      </div>

                      <span className="w-px h-4 bg-slate-200 hidden sm:block" />

                      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
                          <button onClick={()=>setViewFilter('timeline')} className={`timeline-chip-lite whitespace-nowrap ${viewFilter==='timeline' ? 'active' : ''}`}>
                              <Clock size={11}/> Ahora
                          </button>
                          <button onClick={()=>setViewFilter('pendientes')} className={`timeline-chip-lite whitespace-nowrap ${viewFilter==='pendientes' ? 'active' : ''}`}>
                              <AlertTriangle size={11}/> Pendientes
                          </button>
                          <button onClick={()=>setViewFilter('en_consulta')} className={`timeline-chip-lite whitespace-nowrap ${viewFilter==='en_consulta' ? 'active' : ''}`}>
                              <Stethoscope size={11}/> En Consulta
                          </button>
                          <button onClick={()=>setViewFilter('finalizados')} className={`timeline-chip-lite whitespace-nowrap ${viewFilter==='finalizados' ? 'active' : ''}`}>
                              <CheckCircle size={11}/> Finalizados
                          </button>
                      </div>
                  </div>
              </div>

              {/* TIMELINE */}
              <div className="flex-1 overflow-y-auto px-2 sm:px-6 md:px-10 pb-10 pt-4 sm:pt-8 custom-scrollbar bg-slate-50/40">
                  {viewFilter === 'timeline' ? (
                      <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                          <div className="hidden md:flex bg-slate-50/80 border-b border-slate-200 py-3 text-xs font-black text-slate-400 uppercase tracking-widest px-4">
                              <div className="w-32 lg:w-40 text-center border-r border-slate-200">Rango Horario</div>
                              <div className="flex-1 pl-4 lg:pl-8">Paciente y Detalles</div>
                              <div className="w-48 lg:w-72 text-left pl-4 lg:pl-8 border-l border-slate-200">Asignación</div>
                          </div>

                          {timeSlots.map((slot, index) => {
                              const citasEnSlot = citasPorSlot.get(slot.startTime) || [];
                              // Doctores que bloquearon este slot (con justificación)
                              const doctoresBloquearon = [];
                              horariosBloqueadosPorDoctor.forEach((slotMap, docUid) => {
                                  const info = slotMap.get(slot.startTime);
                                  if (info) {
                                      // Filtrar por consultorio seleccionado: solo mostrar bloqueos
                                      // que coincidan con el consultorio del filtro (o ver todos)
                                      if (selectedConsultorio !== 'Todos' && info.consultorioNombre !== selectedConsultorio) {
                                          return;
                                      }
                                      const docData = doctores.find(d => d.id === docUid);
                                      const nombre = docData?.nombre || info.nombre || docUid;
                                      doctoresBloquearon.push({ nombre, justificacion: info.justificacion || '' });
                                  }
                              });
                              const hayBloqueo = doctoresBloquearon.length > 0;

                              return (
                                  <div 
                                      key={slot.value} 
                                      ref={slot.isCurrent ? scrollRef : null}
                                      className={`flex flex-col sm:flex-row min-h-[60px] sm:min-h-[80px] group border-b border-slate-100 last:border-0 relative transition-colors ${
                                          slot.isCurrent ? 'bg-blue-50/40 shadow-inner' : slot.isPast ? 'bg-slate-50/60' : hayBloqueo && citasEnSlot.length === 0 ? 'bg-red-50/40' : 'bg-white hover:bg-slate-50/50'
                                      }`}
                                  >
                                      {/* Línea Activa */}
                                      {slot.isCurrent && <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 z-20 rounded-r-md ${modoLigero ? '' : 'animate-pulse'}`}></div>}

                                      <div className={`w-full sm:w-32 lg:w-40 flex items-center sm:flex-col sm:items-center justify-start sm:justify-center px-3 py-2 sm:py-0 border-b sm:border-b-0 sm:border-r border-slate-100 shrink-0 ${slot.isPast ? 'text-slate-400' : 'text-slate-600'} ${slot.isCurrent ? 'text-blue-700 bg-blue-100/30' : ''}`}>
                                          <span className={`font-bold font-mono tracking-tight ${slot.isCurrent ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>{slot.value}</span>
                                          {citasEnSlot.length > 0 && !hayBloqueo && (
                                              <button
                                                  onClick={(e) => { e.stopPropagation(); iniciarAgendado(slot); }}
                                                  className="mt-1 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 text-blue-500 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300 flex items-center justify-center transition-all shadow-sm"
                                                  title="Agendar otra cita en este horario"
                                              >
                                                  <Plus size={14}/>
                                              </button>
                                          )}
                                      </div>
                                      
                                      <div className="flex-1 p-2 sm:p-3 relative flex flex-col justify-center">
                                          {citasEnSlot.length === 0 && !hayBloqueo && (
                                              <button 
                                                  onClick={() => iniciarAgendado(slot)}
                                                  className={`absolute left-2 sm:left-8 opacity-0 group-hover:opacity-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all z-10 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold shadow-sm ${slot.isPast ? 'text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-md' : 'text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 hover:shadow-md'}`}
                                              >
                                                  <Plus size={14} className="sm:w-4 sm:h-4"/> <span className="hidden sm:inline">{slot.isPast ? 'Registro Pasado' : 'Agendar Paciente'}</span><span className="sm:hidden">{slot.isPast ? 'Registro' : 'Agendar'}</span>
                                              </button>
                                          )}
                                          {citasEnSlot.length === 0 && hayBloqueo && (
                                              <div className="flex flex-col gap-1 px-4 py-2">
                                                  {doctoresBloquearon.map((doc, i) => (
                                                      <div key={i} className="flex items-center gap-2">
                                                          <Lock size={14} className="text-red-400 shrink-0"/>
                                                          <span className="text-xs font-bold text-red-500">
                                                              Bloqueado por: {doc.nombre}{doc.justificacion ? ` — ${doc.justificacion}` : ''}
                                                          </span>
                                                      </div>
                                                  ))}
                                              </div>
                                          )}

                                           <div className="w-full space-y-2">
                                               {citasEnSlot.map(cita => {
                                                   const esCancelada = cita.estado === 'cancelada';
                                                   const isDragOver = dragOverCitaId === cita.id;
                                                   return (
                                                    <div key={cita.id}
                                                        onClick={() => setSelectedCita(cita)}
                                                        onDragOver={(e) => handleDragOverCard(e, cita.id, cita)}
                                                        onDragLeave={handleDragLeaveCard}
                                                        onDrop={(e) => handleDropOnCard(e, cita)}
                                                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border shadow-sm rounded-xl sm:rounded-2xl transition-all cursor-pointer group/item gap-2 sm:gap-0 ${
                                                            isDragOver ? 'ring-2 ring-teal-400 border-teal-400 bg-teal-50/50 scale-[1.02]' :
                                                        esCancelada
                                                            ? 'bg-red-50/60 border-red-200/60 opacity-55 hover:opacity-80 hover:border-red-300'
                                                            : 'bg-white border-slate-100 hover:shadow-md hover:border-blue-300'
                                                    }`}>
                                                       <div className="flex items-center gap-2 sm:gap-4 overflow-hidden min-w-0">
                                                             <EstadoPacienteBadge cita={cita} size="xs" />
                                                           <span className={`text-sm sm:text-base font-bold truncate font-jakarta ${esCancelada ? 'text-slate-400 line-through decoration-red-300' : 'text-slate-800'}`}>{cita.paciente}</span>
                                                           <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-4 border-l border-slate-200 ml-1 sm:ml-2 shrink-0">
                                                               {esCancelada && <span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-red-100 text-red-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-bold uppercase tracking-wider"><XCircle size={10}/> Cancelada</span>}
                                                               {cita.esTeleconsulta && <span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-indigo-50 text-indigo-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-bold uppercase tracking-wider"><Video size={10}/> Tele</span>}
                                                               <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-bold uppercase tracking-wider ${esCancelada ? 'bg-slate-100/60 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>{cita.motivo}</span>
                                                           </div>
                                                       </div>
                                                       <div className={`hidden md:flex items-center gap-3 shrink-0 w-48 lg:w-64 justify-start border-l pl-4 lg:pl-6 ${esCancelada ? 'border-red-100/60' : 'border-slate-100'}`}>
                                                           <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl border flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${esCancelada ? 'bg-slate-100 border-slate-200 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                                               {cita.doctorAsignado?.charAt(0) || 'D'}
                                                           </div>
                                                           <div className="flex flex-col min-w-0">
                                                               <span className={`text-xs lg:text-sm font-bold truncate ${esCancelada ? 'text-slate-400' : 'text-slate-700'}`}>Dr. {cita.doctorAsignado?.split(' ')[1] || cita.doctorAsignado || 'General'}</span>
                                                               <span className={`text-[9px] lg:text-[10px] font-bold uppercase tracking-widest mt-0.5 ${esCancelada ? 'text-slate-300' : 'text-slate-400'}`}>{cita.consultorio || 'Sin Asignar'}</span>
                                                           </div>
                                                       </div>
                                                   </div>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-4">
                          {(viewFilter === 'pendientes' ? citasPendientesFiltradas : viewFilter === 'en_consulta' ? citasEnConsultaFiltradas : citasFinalizadasFiltradas).map(cita => (
                              <CardCita key={cita.id} cita={cita} onClick={setSelectedCita} navigate={navigate} />
                          ))}
                          {(viewFilter === 'pendientes' ? citasPendientesFiltradas : viewFilter === 'en_consulta' ? citasEnConsultaFiltradas : citasFinalizadasFiltradas).length === 0 && (
                              <div className="col-span-full text-center py-12 text-slate-400 text-sm font-medium">
                                  No hay citas {viewFilter === 'pendientes' ? 'pendientes' : viewFilter === 'en_consulta' ? 'en consulta' : 'finalizadas'} en este momento.
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>

           {/* --- COLUMNA DERECHA: MÉDICOS DISPONIBLES --- */}
           <div className="w-[380px] glass-panel rounded-3xl flex flex-col z-20 hidden xl:flex overflow-hidden">
               <div className="p-6 border-b border-slate-200/50 bg-white/40">
                   <h3 className="text-xs font-black text-slate-500 flex items-center justify-between uppercase tracking-widest">
                       <span className="flex items-center gap-2"><Zap size={18} className="text-amber-500" fill="currentColor"/> Médicos</span>
                       <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg">{doctoresConPx.length}</span>
                   </h3>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white/20">
                   {doctoresConPx.map(doc => {
                       const status = doc._status;
                       const doctorConsultorio = doc._consultorio;
                       const esMiSucursal = doc._mismaSucursal;
                       const isActive = doc._group === 0;
                       const isExpanded = expandedDoctorId === doc.id;
                       const enConsulta = doc._enConsulta;
                       const totalPendientes = doc._totalPendientes;
                       const minutosConsulta = doc._minutosConsulta;
                       const signosVit = doc._signosVit;
                       const triageAlergias = doc._triageAlergias;
                       const triageEnfermedades = doc._triageEnfermedades;

                       const handleSendMessage = (e) => {
                           e.stopPropagation();
                           window.dispatchEvent(new CustomEvent('open-global-chat', {
                               detail: { directMessageUser: { id: doc.id, nombre: doc.nombre } }
                           }));
                       };

                       return (
                           <div key={doc.id}>
                               <div
                                   onClick={() => setExpandedDoctorId(isExpanded ? null : doc.id)}
                                   className={`p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer ${
                                       isExpanded
                                           ? 'border-blue-300 bg-blue-50/70 shadow-md'
                                           : esMiSucursal
                                               ? 'border-teal-200 bg-teal-50/50 hover:border-teal-300'
                                               : 'border-slate-100 bg-white hover:border-blue-200'
                                   }`}
                               >
                                   <div className="flex items-center gap-3 min-w-0">
                                       <div className="relative shrink-0">
                                           <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black border text-base shadow-sm ${
                                               isActive ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                           }`}>
                                               {doc.nombre?.charAt(0)}
                                           </div>
                                           <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${status.color}`}></div>
                                       </div>
                                       <div className="flex flex-col min-w-0 flex-1">
                                           <div className="flex items-center gap-2">
                                               <p className="text-sm font-bold text-slate-800 leading-tight font-jakarta truncate">{doc.nombre}</p>
                                               {esMiSucursal && <MapPin size={10} className="text-teal-500 shrink-0" />}
                                           </div>
                                           <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider truncate">
                                               {doctorConsultorio.nombre || 'Consulta Gral'}
                                           </p>
                                           <div className="flex items-center gap-2 mt-1">
                                               <p className={`text-[10px] font-black uppercase ${status.color.replace('bg-', 'text-')}`}>{status.text}</p>
                                               {totalPendientes > 0 && !enConsulta && (
                                                   <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                                       {totalPendientes} esperando
                                                   </span>
                                               )}
                                               {enConsulta && (
                                                   <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                                       <Stethoscope size={10} /> En consulta
                                                   </span>
                                               )}
                                           </div>
                                       </div>
                                       <div className="flex items-center gap-1.5 shrink-0">
                                           <button
                                               onClick={handleSendMessage}
                                               className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-colors active:scale-95"
                                               title={`Enviar mensaje a ${doc.nombre}`}
                                           >
                                               <MessageSquare size={13} className="text-slate-500" />
                                           </button>
                                           <ChevronDown
                                               size={14}
                                               className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                           />
                                       </div>
                                   </div>
                               </div>

                               {isExpanded && (
                                   <div className="mx-1 mt-1 mb-2 p-4 rounded-2xl bg-white border border-blue-200 shadow-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
                                       {enConsulta ? (
                                           <>
                                               <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                                   <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                                       <UserCheck size={13} className="text-blue-600" />
                                                   </div>
                                                   <div className="min-w-0">
                                                       <p className="text-xs font-bold text-slate-700 truncate">{enConsulta.paciente}</p>
                                                       <p className="text-[9px] text-slate-400 uppercase tracking-wider">
                                                           {enConsulta.motivo || 'Consulta'} · {minutosConsulta}m en consulta
                                                       </p>
                                                   </div>
                                               </div>

                                               {signosVit && (
                                                   <div className="grid grid-cols-3 gap-2">
                                                       {signosVit.ta && (
                                                           <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                               <Heart size={11} className="text-rose-400 mx-auto mb-0.5" />
                                                               <p className="text-[9px] text-slate-400 font-bold uppercase">T/A</p>
                                                               <p className="text-xs font-black text-slate-700">{signosVit.ta}</p>
                                                           </div>
                                                       )}
                                                       {signosVit.temp && (
                                                           <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                               <Thermometer size={11} className="text-rose-400 mx-auto mb-0.5" />
                                                               <p className="text-[9px] text-slate-400 font-bold uppercase">Temp</p>
                                                               <p className="text-xs font-black text-slate-700">{signosVit.temp}°</p>
                                                           </div>
                                                       )}
                                                       {signosVit.fc && (
                                                           <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                               <Activity size={11} className="text-blue-400 mx-auto mb-0.5" />
                                                               <p className="text-[9px] text-slate-400 font-bold uppercase">F.C.</p>
                                                               <p className="text-xs font-black text-slate-700">{signosVit.fc}</p>
                                                           </div>
                                                       )}
                                                       {signosVit.fr && (
                                                           <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                               <Wind size={11} className="text-blue-400 mx-auto mb-0.5" />
                                                               <p className="text-[9px] text-slate-400 font-bold uppercase">F.R.</p>
                                                               <p className="text-xs font-black text-slate-700">{signosVit.fr}</p>
                                                           </div>
                                                       )}
                                                       {signosVit.spo2 && (
                                                           <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                               <Activity size={11} className="text-emerald-400 mx-auto mb-0.5" />
                                                               <p className="text-[9px] text-slate-400 font-bold uppercase">SpO₂</p>
                                                               <p className="text-xs font-black text-slate-700">{signosVit.spo2}%</p>
                                                           </div>
                                                       )}
                                                       {signosVit.imc && (
                                                           <div className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                                               <User size={11} className="text-slate-400 mx-auto mb-0.5" />
                                                               <p className="text-[9px] text-slate-400 font-bold uppercase">IMC</p>
                                                               <p className="text-xs font-black text-slate-700">{signosVit.imc}</p>
                                                           </div>
                                                       )}
                                                   </div>
                                               )}

                                               {triageAlergias && triageAlergias !== 'Preguntados y negados' && (
                                                   <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-100 flex items-start gap-2">
                                                       <AlertCircle size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                                       <div>
                                                           <p className="text-[9px] font-bold text-rose-600 uppercase">Alergias</p>
                                                           <p className="text-[10px] text-rose-700 font-medium">{triageAlergias}</p>
                                                       </div>
                                                   </div>
                                               )}

                                               {triageEnfermedades && !triageEnfermedades.preguntados_y_negados && (
                                                   <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100 flex items-start gap-2">
                                                       <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                                       <div>
                                                           <p className="text-[9px] font-bold text-amber-600 uppercase">Padecimientos</p>
                                                           <p className="text-[10px] text-amber-700 font-medium">
                                                               {[...(triageEnfermedades.lista || []), ...(triageEnfermedades.otros ? [triageEnfermedades.otros] : [])].join(', ') || 'Ninguno'}
                                                           </p>
                                                       </div>
                                                   </div>
                                               )}

                                               <div className="flex gap-2 pt-1">
                                                   <div className="flex-1 bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                       <p className="text-[9px] text-slate-400 font-bold uppercase">Tipo</p>
                                                       <p className="text-[11px] font-bold text-slate-700">{enConsulta.tipoConsulta || 'Primera vez'}</p>
                                                   </div>
                                                   <div className="flex-1 bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                       <p className="text-[9px] text-slate-400 font-bold uppercase">Hora cita</p>
                                                       <p className="text-[11px] font-bold text-slate-700">{enConsulta.hora || '--'}</p>
                                                   </div>
                                               </div>
                                           </>
                                       ) : (
                                           <div className="text-center py-6">
                                               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                                                   <UserCheck size={16} className="text-slate-400" />
                                               </div>
                                               <p className="text-xs font-bold text-slate-500">Sin paciente en consulta</p>
                                               {totalPendientes > 0 ? (
                                                   <p className="text-[10px] text-amber-600 font-medium mt-1">
                                                       {totalPendientes} paciente{totalPendientes > 1 ? 's' : ''} en espera
                                                   </p>
                                               ) : (
                                                   <p className="text-[10px] text-slate-400 mt-1">Sin pacientes pendientes</p>
                                               )}
                                           </div>
                                       )}

                                       <button
                                           onClick={handleSendMessage}
                                           className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[11px] font-bold flex items-center justify-center gap-2 hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] transition-all shadow-sm"
                                       >
                                           <MessageSquare size={13} /> Enviar mensaje directo
                                       </button>
                                   </div>
                               )}
                           </div>
                       )
                   })}
                   {doctoresConPx.length === 0 && (
                       <div className="text-center p-8 text-slate-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-2xl mt-4">
                           No hay médicos disponibles.
                       </div>
                   )}
               </div>
           </div>
        </div>

        {/* --- MODAL CONFIRMACIÓN RETROACTIVO --- */}
        {confirmModal.show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm border border-slate-200 animate-in zoom-in-95 text-center">
                    <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-amber-100">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 font-jakarta leading-tight">Registro Pasado</h3>
                    <p className="text-sm text-slate-500 mt-3 font-medium leading-relaxed">
                        Estás intentando agendar en un horario que ya pasó (<span className="font-bold text-slate-700">{confirmModal.slot.startTime}</span>).<br/>¿Es un registro retroactivo?
                    </p>
                    <div className="flex gap-3 mt-8">
                        <button onClick={() => setConfirmModal({show: false, slot: null})} className="flex-1 py-3.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors border border-slate-200">Cancelar</button>
                        <button onClick={() => abrirModalCita(confirmModal.slot)} className="flex-1 py-3.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all active:scale-95">Sí, continuar</button>
                    </div>
                </div>
            </div>
        )}

       {/* --- MODAL NUEVA CITA --- */}
        {showCitaModal && (
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in"
                onClick={cerrarModalCita}
            >
            <div
                className="bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-white/50 backdrop-blur-sm shrink-0">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800 font-jakarta flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm shrink-0">
                                <CalendarClock size={16} />
                            </span>
                            {isEditingCita ? 'Editar Cita' : 'Agendar Cita'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                            <Clock size={10}/> {nuevaCita.hora || '--:--'} - {nuevaCita.horaFin || '--:--'} <span className="w-1 h-1 rounded-full bg-slate-300"></span> <CalIcon size={10}/> {nuevaCita.fecha}
                        </p>
                    </div>
                    <button onClick={cerrarModalCita} className="p-2 bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shadow-sm active:scale-95"><X size={16} /></button>
                </div>
                
                <div className="p-5 md:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 relative z-10 bg-gradient-to-b from-white to-slate-50/30">
                    
                    {/* Sección Paciente */}
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm relative">
                        <label className={labelStyle}>Paciente</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    className={`w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 pl-10 py-2.5 shadow-sm`} 
                                    placeholder="Buscar por nombre o expediente..." 
                                    value={nuevaCita.paciente}
                                    onChange={(e) => {
                                        setNuevaCita({...nuevaCita, paciente: e.target.value, pacienteId: '', pacienteTelefono: ''});
                                        const txt = e.target.value.toLowerCase().trim();
                                        if(txt.length > 1) {
                                            fetchPacientesSugerencias(txt);
                                        } else setMostrarSugerencias(false);
                                    }}
                                />
                                {mostrarSugerencias && (
                                    <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-2xl mt-1.5 border border-slate-100 z-50 max-h-48 overflow-y-auto p-1.5 animate-in slide-in-from-top-2 fade-in">
                                        {sugerencias.map(p => (
                                            <div key={p.id} onClick={() => seleccionarPaciente(p)} className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer text-sm font-bold text-slate-700 transition-colors flex flex-col">
                                                <span>{p.nombre}</span>
                                                {p.idPaciente && <span className="text-[10px] text-slate-400 uppercase tracking-wider">{p.idPaciente}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowPacienteModal(true)} className="bg-slate-900 text-white w-12 rounded-xl hover:bg-black transition-all shadow-md shadow-slate-900/20 active:scale-95 flex items-center justify-center shrink-0">
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle}>Fecha</label>
                            <input type="date" className={inputStyle} value={nuevaCita.fecha} onChange={e => setNuevaCita({...nuevaCita, fecha: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={labelStyle}>Inicio</label>
                                <input
                                    type="time"
                                    className={inputStyle}
                                    value={nuevaCita.hora}
                                    onChange={e => {
                                        const nuevaHora = e.target.value;
                                        setNuevaCita({
                                            ...nuevaCita,
                                            hora: nuevaHora,
                                            horaFin: nuevaCita.horaFin || sumarMinutos(nuevaHora, INTERVALO_MINUTOS)
                                        });
                                    }}
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>Fin</label>
                                <input type="time" className={inputStyle} value={nuevaCita.horaFin} onChange={e => setNuevaCita({...nuevaCita, horaFin: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>Motivo de la Visita</label>
                        <CustomDropdown 
                            options={catalogoMotivos.map(m => ({ value: m.id, label: formatMotivoOption(m) }))}
                            value={nuevaCita.motivoId}
                            onChange={val => {
                                const motivoData = catalogoMotivos.find(m => m.id === val);
                                const esEnfermeria = Boolean(motivoData?.atendidoPorEnfermeria);
                                setNuevaCita(prev => ({
                                    ...prev,
                                    motivoId: val,
                                    motivo: motivoData?.nombre || '',
                                    doctorUid: esEnfermeria ? '' : prev.doctorUid,
                                    doctorAsignado: esEnfermeria ? '' : prev.doctorAsignado,
                                    enfermeroAsignadoId: esEnfermeria ? prev.enfermeroAsignadoId : '',
                                    enfermeroAsignadoNombre: esEnfermeria ? prev.enfermeroAsignadoNombre : ''
                                }));
                            }}
                            placeholder="Buscar motivo..."
                            inputStyle={inputStyle}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catalogoMotivos.find(m => m.id === nuevaCita.motivoId)?.atendidoPorEnfermeria ? (
                            <div>
                                <label className={labelStyle}>Enfermero/a Asignado/a</label>
                                <CustomDropdown 
                                    options={enfermeros.map(enf => ({ value: enf.id, label: enf.nombre }))}
                                    value={nuevaCita.enfermeroAsignadoId}
                                    onChange={val => {
                                        const enf = enfermeros.find(en => en.id === val);
                                        setNuevaCita(prev => ({ ...prev, enfermeroAsignadoId: val, enfermeroAsignadoNombre: enf?.nombre || '' }));
                                    }}
                                    placeholder="Seleccionar Enfermero/a"
                                    inputStyle={inputStyle}
                                />
                                {enfermeros.length === 0 && (
                                    <p className="text-xs text-amber-600 font-semibold mt-1">No hay enfermeros registrados.</p>
                                )}
                            </div>
                        ) : (
                             <div>
                                <label className={labelStyle}>Médico Responsable</label>
                                <CustomDropdown 
                                    options={doctoresFiltrados.map(doc => {
                                        return { 
                                            value: doc.id, 
                                            label: doc.nombre,
                                            docData: doc,
                                            st: doc._status,
                                            doctorConsultorio: doc._consultorio,
                                            mismaSucursal: doc._mismaSucursal,
                                            isActive: doc._group === 0
                                        };
                                    })}
                                    value={nuevaCita.doctorUid}
                                    onChange={val => {
                                        const doc = doctores.find(d => d.id === val);
                                        if(doc) {
                                            const doctorConsultorio = getDoctorConsultorio(doc);
                                            setNuevaCita(prev => ({
                                                ...prev,
                                                doctorUid: doc.id,
                                                doctorAsignado: doc.nombre,
                                                consultorioId: doctorConsultorio.id || prev.consultorioId,
                                                consultorio: doctorConsultorio.nombre || prev.consultorio
                                            }));
                                        }
                                    }}
                                    placeholder="Seleccionar Médico"
                                    inputStyle={inputStyle}
                                    renderOption={(opt) => (
                                        <div className="flex flex-col w-full">
                                            <span className={`text-sm font-bold ${nuevaCita.doctorUid === opt.value ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                {opt.mismaSucursal && <MapPin size={12} className="inline text-teal-500 mr-1" />}
                                                {opt.label}
                                                {opt.isActive && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-100 text-emerald-600 uppercase">Activo</span>}
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    {opt.doctorConsultorio.nombre || 'General'}
                                                    {opt.doctorConsultorio.sucursal && <span className="text-slate-300"> · {opt.doctorConsultorio.sucursal}</span>}
                                                </span>
                                                <div className={`w-1.5 h-1.5 rounded-full ${opt.st.color}`}></div>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>
                        )}
                        <div>
                            <label className={labelStyle}>Sucursal</label>
                            <CustomDropdown 
                                options={catalogoSucursales.map(s => ({ value: s.id, label: s.nombre }))}
                                value={nuevaCita.sucursalId}
                                onChange={val => {
                                    const sucursalData = catalogoSucursales.find(s => s.id === val);
                                    setNuevaCita({...nuevaCita, sucursalId: val, sucursal: sucursalData?.nombre || ''});
                                }}
                                placeholder="Seleccionar sucursal..."
                                inputStyle={inputStyle}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle}>Consultorio</label>
                            <CustomDropdown 
                                options={[...consultorios].sort((a, b) => {
                                    const aEs = String(a.sucursalId || '') === String(nuevaCita.sucursalId || '');
                                    const bEs = String(b.sucursalId || '') === String(nuevaCita.sucursalId || '');
                                    if(aEs && !bEs) return -1;
                                    if(!aEs && bEs) return 1;
                                    return (a.nombre || '').localeCompare(b.nombre || '');
                                }).map(c => {
                                    const sucursalDeConsultorio = catalogoSucursales.find(s => String(s.id) === String(c.sucursalId))?.nombre || 'General';
                                    const esDeSucursalSeleccionada = String(c.sucursalId || '') === String(nuevaCita.sucursalId || '');
                                    return { 
                                        value: c.id, 
                                        label: c.nombre,
                                        sucursalNombre: sucursalDeConsultorio,
                                        esDeSucursalSeleccionada
                                    };
                                })}
                                value={nuevaCita.consultorioId}
                                onChange={val => {
                                    const consultorioData = consultorios.find(c => c.id === val);
                                    setNuevaCita(prev => ({ ...prev, consultorioId: val, consultorio: consultorioData?.nombre || '' }));
                                }}
                                placeholder="Asignar Sala..."
                                inputStyle={inputStyle}
                                renderOption={(opt) => (
                                    <div className="flex flex-col w-full">
                                        <span className={`text-sm font-bold ${nuevaCita.consultorioId === opt.value ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.label}</span>
                                        <div className="flex items-center mt-0.5">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${opt.esDeSucursalSeleccionada ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                {opt.sucursalNombre}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Tipo de Consulta</label>
                            <CustomDropdown 
                                options={[
                                    { value: 'Primera vez', label: 'Primera vez' },
                                    { value: 'Subsecuente', label: 'Subsecuente' }
                                ]}
                                value={nuevaCita.tipoConsulta}
                                onChange={val => setNuevaCita({...nuevaCita, tipoConsulta: val})}
                                placeholder="Seleccionar tipo..."
                                inputStyle={inputStyle}
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                        <label className={labelStyle}>Forma de Pago</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {PAYMENT_METHOD_OPTIONS.map(item => {
                                const checked = nuevaCita.formaPago === item.value;
                                return (
                                    <label
                                        key={item.value}
                                        onClick={() => setNuevaCita(prev => ({ ...prev, formaPago: item.value }))}
                                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none ${
                                            checked
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm shadow-blue-500/10'
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${checked ? 'border-blue-500' : 'border-slate-300'}`}>
                                            {checked && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                        </div>
                                        <span className={`text-xs font-bold ${checked ? 'text-blue-700' : 'text-slate-600'}`}>{item.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pt-1">
                        <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all duration-300 select-none ${nuevaCita.esTeleconsulta ? 'border-indigo-500 bg-indigo-50/50 shadow-sm shadow-indigo-500/10' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'}`}>
                            <div className={`relative flex items-center justify-center w-10 h-6 rounded-full transition-colors duration-300 shrink-0 ${nuevaCita.esTeleconsulta ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                <div className={`absolute w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${nuevaCita.esTeleconsulta ? 'translate-x-2' : '-translate-x-2'}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-xs font-bold ${nuevaCita.esTeleconsulta ? "text-indigo-900" : "text-slate-700"}`}>Es Teleconsulta (Videollamada)</span>
                                <span className="text-[10px] text-slate-500 font-medium mt-0.5">Se enviará un link de Meet por WhatsApp</span>
                            </div>
                            <Video size={20} className={`ml-auto shrink-0 ${nuevaCita.esTeleconsulta ? "text-indigo-500" : "text-slate-300"}`}/>
                        </label>
                    </div>

                    <button 
                        onClick={handleGuardarCita} 
                        type="button" 
                        disabled={isSavingCita}
                        className="relative w-full py-3.5 rounded-xl font-black text-xs text-white bg-slate-900 hover:bg-black transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] overflow-hidden group tracking-widest uppercase mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <CheckCircle2 size={16} />
                        {isSavingCita ? 'Guardando...' : (isEditingCita ? 'Guardar Cambios' : 'Guardar e Iniciar Proceso')}
                    </button>
                </div>
            </div>
            </div>
        )}

        {/* ═══ MODAL FLOTANTE DETALLE ═══ */}
        {selectedCita && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '12px' : '24px' }} onClick={cerrarDetalleCita}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.4)', backdropFilter: 'blur(4px)' }} />

                <div 
                    style={{ position: 'relative', background: '#fff', borderRadius: '16px', boxShadow: '0 24px 60px rgba(15,23,42,.18)', width: '100%', maxWidth: '1080px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'modalIn .25s ease-out' }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* ─── HEADER ─── */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '14px' }}>
                            {/* Avatar */}
                            <AvatarPaciente
                                sexo={detallePacienteActivo?.sexo || ''}
                                fechaNacimiento={detallePacienteActivo?.fechaNacimiento || ''}
                                size="xl"
                                className="hidden sm:flex shrink-0"
                            />

                            {/* Centro */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Badges */}
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                                    <EstadoPacienteBadge cita={selectedCita} size="sm" showUrgencia />
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', border: '1px solid #e5e7eb', background: '#f3f4f6', color: '#6b7280' }}>
                                        {selectedCita.consultorio || 'Sin consultorio'}
                                    </span>
                                    {selectedCita.esTeleconsulta && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5' }}>
                                            <Video size={10} /> Teleconsulta
                                        </span>
                                    )}
                                    {selectedCita.esCitaEnfermeria && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, border: '1px solid #99f6e4', background: '#f0fdfa', color: '#0d9488' }}>
                                            Enfermería
                                        </span>
                                    )}
                                </div>

                                {/* Nombre + chips */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#111', lineHeight: 1.2, textTransform: 'uppercase', fontFamily: 'Sora, sans-serif' }}>
                                        {detallePacienteActivo?.nombre || selectedCita.paciente}
                                    </span>
                                    {[
                                        detallePacienteActivo?.edad !== null && detallePacienteActivo?.edad !== undefined ? `${detallePacienteActivo.edad} años` : null,
                                        detallePacienteActivo?.sexo || null,
                                        detallePacienteActivo?.grupoSanguineo || null,
                                        selectedCita.tipoConsulta || null
                                    ].filter(Boolean).map((chip, i) => (
                                        <span key={i} style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, border: '1px solid #e5e7eb', background: '#fff', color: '#4b5563' }}>{chip}</span>
                                    ))}
                                </div>

                                {/* Info + acciones en una línea */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '10px', rowGap: '5px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
                                        <Clock size={11} style={{ color: '#9ca3af' }} /> {selectedCita.hora || '—'}
                                    </span>
                                    <span style={{ color: '#d1d5db', fontSize: '11px', userSelect: 'none' }}>·</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCita.motivo || 'Consulta general'}</span>
                                    {selectedCita.doctorAsignado && (<>
                                        <span style={{ color: '#d1d5db', fontSize: '11px', userSelect: 'none' }}>·</span>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>Dr. {selectedCita.doctorAsignado}</span>
                                    </>)}
                                    {detallePacienteActivo?.idPaciente && (<>
                                        <span style={{ color: '#d1d5db', fontSize: '11px', userSelect: 'none' }}>·</span>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', fontFamily: 'monospace' }}>{detallePacienteActivo.idPaciente}</span>
                                    </>)}
                                    {/* Acciones */}
                                    {selectedCita.pacienteId && (
                                        <button onClick={async () => {
                                            if (selectedPacienteDetalle?.id) { setPacienteAEditar(selectedPacienteDetalle); setShowPacienteModal(true); return; }
                                            try { const snap = await getDoc(doc(db, 'pacientes', selectedCita.pacienteId)); if (snap.exists()) { setPacienteAEditar({ id: snap.id, ...snap.data() }); setShowPacienteModal(true); } } catch {}
                                        }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <Edit3 size={11} /> Editar paciente
                                        </button>
                                    )}
                                    {selectedCita.esTeleconsulta && selectedCita.meetLink && (
                                        <button onClick={() => window.open(selectedCita.meetLink, '_blank')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', fontSize: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <Video size={11} /> Unirse a Meet
                                        </button>
                                    )}
                                    {selectedCita.esCitaEnfermeria && (
                                        <button onClick={() => window.open(`/enfermeria/orden-servicio?citaId=${selectedCita.id}`, '_blank')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', border: '1px solid #99f6e4', background: '#f0fdfa', color: '#0d9488', fontSize: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <ClipboardList size={11} /> Orden de servicio
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Cerrar */}
                            <button onClick={cerrarDetalleCita} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* ─── BODY ─── */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', padding: '16px 20px' }}>

                            {/* ── COL IZQUIERDA ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                {/* DATOS DEL PACIENTE */}
                                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: '12px', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <User size={13} style={{ color: '#9ca3af' }} /> Datos del paciente
                                    </div>
                                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {[
                                            { icon: <Phone size={11} style={{ color: '#9ca3af' }} />, label: 'Teléfono', value: detallePacienteActivo?.telefonoPrincipal || 'Sin registro' },
                                            { icon: <Shield size={11} style={{ color: '#9ca3af' }} />, label: 'Cobertura', value: detallePacienteActivo?.derechohabiente || 'Sin derechohabiencia' },
                                            { icon: <MapPin size={11} style={{ color: '#9ca3af' }} />, label: 'Ubicación', value: detallePacienteActivo?.direccion || 'Sin domicilio', truncate: true },
                                            { icon: <Stethoscope size={11} style={{ color: '#9ca3af' }} />, label: 'Tipo consulta', value: selectedCita.tipoConsulta || 'General' },
                                            { icon: <ReceiptText size={11} style={{ color: '#9ca3af' }} />, label: 'Forma de pago', value: selectedCita.formaPago ? (PAYMENT_METHOD_OPTIONS.find(o => o.value === selectedCita.formaPago)?.label || selectedCita.formaPago) : 'Sin registro', warn: !selectedCita.formaPago },
                                            detallePacienteActivo?.email ? { icon: <Mail size={11} style={{ color: '#9ca3af' }} />, label: 'Email', value: detallePacienteActivo.email, truncate: true } : null,
                                        ].filter(Boolean).map((row, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                                                    {row.icon}
                                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>{row.label}</span>
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: row.warn ? '#d97706' : '#111', textAlign: 'right', maxWidth: row.truncate ? '140px' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ÚLTIMA VISITA */}
                                {ultimaVisita && (
                                    <div style={{ background: '#fff', border: '1px solid #d1fae5', borderRadius: '8px', overflow: 'hidden' }}>
                                        <div style={{ padding: '10px 16px', borderBottom: '1px solid #d1fae5', background: '#ecfdf5', fontSize: '12px', fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CalendarClock size={13} style={{ color: '#059669' }} /> Última consulta
                                        </div>
                                        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {(() => {
                                                const fu = ultimaVisita.fechaHora ? new Date(ultimaVisita.fechaHora) : null;
                                                const fl = fu && !Number.isNaN(fu.getTime()) ? fu.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
                                                const hl = fu && !Number.isNaN(fu.getTime()) ? fu.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—';
                                                const dias = fu && !Number.isNaN(fu.getTime()) ? Math.floor((new Date() - fu) / 86400000) : null;
                                                const rows = [
                                                    { icon: <CalendarDays size={11} style={{ color: '#9ca3af' }} />, label: 'Fecha', value: fl },
                                                    { icon: <Clock size={11} style={{ color: '#9ca3af' }} />, label: 'Hora', value: hl },
                                                    { icon: <Building size={11} style={{ color: '#9ca3af' }} />, label: 'Sucursal', value: ultimaVisita.sucursal || '—' },
                                                    { icon: <User size={11} style={{ color: '#9ca3af' }} />, label: 'Médico', value: ultimaVisita.doctorAsignado ? `Dr. ${ultimaVisita.doctorAsignado}` : '—' },
                                                    { icon: <Activity size={11} style={{ color: '#9ca3af' }} />, label: 'Motivo', value: ultimaVisita.motivo || '—' },
                                                ];
                                                return (<>
                                                    {rows.map((row, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                {row.icon}
                                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{row.label}</span>
                                                            </div>
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#111' }}>{row.value}</span>
                                                        </div>
                                                    ))}
                                                    {dias !== null && dias >= 0 && (
                                                        <div style={{ padding: '6px 10px', borderRadius: '6px', textAlign: 'center', marginTop: '4px', background: dias > 30 ? '#fef3c7' : '#d1fae5', border: `1px solid ${dias > 30 ? '#fde68a' : '#a7f3d0'}` }}>
                                                            <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: dias > 30 ? '#92400e' : '#065f46' }}>
                                                                Hace {dias === 0 ? 'hoy' : `${dias} día${dias !== 1 ? 's' : ''}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </>);
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* TRIAGE PENDIENTE */}
                                {!selectedCita.signos_vitales && selectedCita.estado !== 'completada' && selectedCita.estado !== 'cancelada' && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fde68a' }}>
                                                <AlertCircle size={18} style={{ color: '#f59e0b' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>Triage Pendiente</div>
                                                <div style={{ fontSize: '11px', color: '#a16207' }}>Toma de signos vitales requerida</div>
                                            </div>
                                        </div>
                                        <button onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente } })}
                                            style={{ width: '100%', height: '36px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                                            Iniciar Triage
                                        </button>
                                    </div>
                                )}

                                {/* SIGNOS VITALES */}
                                {selectedCita.signos_vitales && (
                                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                        <div style={{ padding: '10px 16px', borderBottom: '1px solid #bfdbfe', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <CheckCircle2 size={14} style={{ color: '#3b82f6' }} />
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>Signos Vitales</span>
                                            </div>
                                            <button onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente, editMode: true } })}
                                                style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Edit3 size={10} /> Editar
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                                            {[{ l: 'Peso', v: selectedCita.signos_vitales.peso, u: 'kg' }, { l: 'Talla', v: selectedCita.signos_vitales.talla, u: 'm' }, { l: 'Temp', v: selectedCita.signos_vitales.temp, u: '°C' }, { l: 'T/A', v: selectedCita.signos_vitales.ta, u: '' },
                                              { l: 'F.C.', v: selectedCita.signos_vitales.fc, u: 'lpm' }, { l: 'F.R.', v: selectedCita.signos_vitales.fr, u: 'rpm' }, { l: 'SpO2', v: selectedCita.signos_vitales.spo2, u: '%' }, { l: 'IMC', v: selectedCita.signos_vitales.imc, u: '' }].map((s, i) => (
                                                <div key={i} style={{ padding: '10px 6px', textAlign: 'center', borderRight: i % 4 !== 3 ? '1px solid #f3f4f6' : 'none', borderTop: i >= 4 ? '1px solid #f3f4f6' : 'none' }}>
                                                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
                                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#111', marginTop: '2px' }}>{s.v || '--'}</div>
                                                    {s.u && <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '1px' }}>{s.u}</div>}
                                                </div>
                                            ))}
                                        </div>
                                        {(selectedCita.triage_alergias || (selectedCita.triage_enfermedades && !selectedCita.triage_enfermedades.preguntados_y_negados && (selectedCita.triage_enfermedades.lista?.length > 0 || selectedCita.triage_enfermedades.otros))) && (
                                            <div style={{ padding: '8px 16px', borderTop: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {selectedCita.triage_alergias && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700 }}>
                                                        <AlertCircle size={10} /> {selectedCita.triage_alergias}
                                                    </span>
                                                )}
                                                {selectedCita.triage_enfermedades && !selectedCita.triage_enfermedades.preguntados_y_negados && (selectedCita.triage_enfermedades.lista?.length > 0 || selectedCita.triage_enfermedades.otros) && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700 }}>
                                                        {[...(selectedCita.triage_enfermedades.lista || []), ...(selectedCita.triage_enfermedades.otros ? [selectedCita.triage_enfermedades.otros] : [])].join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ANTECEDENTES */}
                                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: '12px', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AlertTriangle size={13} style={{ color: '#f59e0b' }} /> Antecedentes
                                    </div>
                                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {detallePacienteActivo?.alertasClinicas?.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Alertas clínicas</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {detallePacienteActivo.alertasClinicas.map(item => (
                                                        <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                                            <AlertCircle size={10} /> {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Padecimientos base</div>
                                            {detallePacienteActivo?.padecimientosBase?.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {detallePacienteActivo.padecimientosBase.map(item => (
                                                        <span key={item} style={{ padding: '3px 8px', borderRadius: '6px', background: '#f3f4f6', border: '1px solid #e5e7eb', fontSize: '11px', fontWeight: 700, color: '#374151' }}>{item}</span>
                                                    ))}
                                                </div>
                                            ) : <div style={{ fontSize: '11px', color: '#9ca3af' }}>Sin padecimientos registrados.</div>}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Notas del paciente</div>
                                            <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.5, background: '#fafafa', borderRadius: '6px', padding: '8px 10px', border: '1px solid #f3f4f6' }}>{detallePacienteActivo?.notas || 'Sin notas registradas.'}</div>
                                        </div>
                                        {selectedCita.estado === 'cancelada' && (
                                            <div style={{ background: '#fff1f2', borderRadius: '8px', padding: '12px', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecdd3' }}>
                                                    <Ban size={16} style={{ color: '#f43f5e' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#be123c' }}>Cita Cancelada</div>
                                                    {selectedCita.canceladaMotivo && <div style={{ fontSize: '11px', color: '#e11d48', marginTop: '2px' }}>{selectedCita.canceladaMotivo}</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── COL DERECHA ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                {/* RESUMEN OPERATIVO */}
                                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: '12px', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Zap size={13} style={{ color: '#9ca3af' }} /> Resumen operativo
                                    </div>
                                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {[
                                            { label: 'Doctor', value: selectedCita.doctorAsignado ? `Dr. ${selectedCita.doctorAsignado}` : 'Sin asignar' },
                                            { label: 'Sucursal', value: selectedCita.sucursal || user?.sucursal || 'Sin sucursal' },
                                            { label: 'Consultorio', value: selectedCita.consultorio || 'Sin consultorio' },
                                            { label: 'Llegada', value: selectedCita.llegadaRegistrada ? 'Confirmada' : 'Pendiente', tone: selectedCita.llegadaRegistrada ? 'success' : 'warning' },
                                            { label: 'Recordatorio', value: selectedCita.recordatorioEnviado ? 'Enviado' : 'Pendiente', tone: selectedCita.recordatorioEnviado ? 'success' : 'neutral' },
                                            { label: 'Modalidad', value: selectedCita.esTeleconsulta ? 'Teleconsulta' : 'Presencial' },
                                        ].map((row, i) => {
                                            const toneColors = row.tone === 'success' ? { bg: '#d1fae5', color: '#065f46' } : row.tone === 'warning' ? { bg: '#fef3c7', color: '#92400e' } : { bg: '#f3f4f6', color: '#374151' };
                                            return (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{row.label}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: toneColors.bg, color: toneColors.color }}>{row.value}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ACCIONES RÁPIDAS / SEGUIMIENTO POST-ATENCIÓN */}
                                {selectedCita.estado !== 'cancelada' && (
                                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                        {selectedCita.estado === 'completada' && (
                                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #a7f3d0', background: '#ecfdf5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>Atención completada</div>
                                                    <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px' }}>Puedes seguir trabajando con el expediente del paciente</div>
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', fontSize: '12px', fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Zap size={13} style={{ color: selectedCita.estado === 'completada' ? '#059669' : '#6366f1' }} />
                                            {selectedCita.estado === 'completada' ? 'Seguimiento post-atención' : 'Acciones rápidas'}
                                        </div>
                                        <div style={{ padding: '12px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                {selectedCita.estado !== 'completada' && (
                                                    <>
                                                        <ActionBtn icon={<LogIn size={14}/>} label="Llegada" sub={selectedCita.llegadaRegistrada ? 'Confirmada' : 'Registrar'} done={selectedCita.llegadaRegistrada} loading={actionLoading === 'llegada'} onClick={handleRegistrarLlegada} disabled={selectedCita.llegadaRegistrada} color="emerald" />
                                                        <ActionBtn icon={<MessageSquare size={14}/>} label="WhatsApp" sub={selectedCita.recordatorioEnviado ? 'Enviado' : 'Enviar'} done={selectedCita.recordatorioEnviado} loading={actionLoading === 'whatsapp'} onClick={handleEnviarRecordatorio} disabled={selectedCita.recordatorioEnviado} color="green" />
                                                        <ActionBtn icon={<CalendarClock size={14}/>} label="Reprogramar" sub="Fecha/Hora" onClick={() => { setReprogramarData({ fecha: selectedCita.fecha || toInputDateValue(new Date()), hora: selectedCita.hora || '', horaFin: selectedCita.horaFin || '' }); setShowReprogramar(true); }} color="indigo" />
                                                        <ActionBtn icon={<Edit3 size={14}/>} label="Editar cita" sub="Modal completo" onClick={() => abrirModalEditarCita(selectedCita)} color="slate" />
                                                        <ActionBtn icon={<ArrowLeftRight size={14}/>} label="Reasignar" sub="Cambiar doctor" onClick={() => { setReasignarData({ doctorUid: '', doctorNombre: '', justificacion: '' }); setShowReasignar(true); }} color="amber" />
                                                        <ActionBtn icon={<Building size={14}/>} label="Consultorio" sub="Cambiar ubicación" onClick={() => { setCambiarConsultorioData({ consultorioId: '', consultorioNombre: '', sucursalId: '', sucursalNombre: '', justificacion: '' }); setShowCambiarConsultorio(true); }} color="slate" />
                                                        {selectedCita.esCitaEnfermeria && (
                                                            <ActionBtn icon={<CheckCircle2 size={14}/>} label="Finalizar" sub="Completar atención" onClick={handleFinalizarCita} loading={actionLoading === 'finalizar'} color="emerald" />
                                                        )}
                                                    </>
                                                )}
                                                {selectedCita.pacienteId && <ActionBtn icon={<FileText size={14}/>} label="Antecedentes" sub="Editar historial" onClick={handleEditarAntecedentes} color="blue" />}
                                                {selectedCita.pacienteId && <ActionBtn icon={<ClipboardList size={14}/>} label="Documentos" sub="Generar plantilla" onClick={handleGenerarDocumento} color="orange" />}
                                                {selectedCita.pacienteId && <ActionBtn icon={<Upload size={14}/>} label="Estudios" sub="Subir archivo" onClick={handleUploadEstudioClick} disabled={uploadingEstudio} loading={uploadingEstudio} color="teal" />}
                                                {selectedCita.pacienteId && <ActionBtn icon={<GitMerge size={14}/>} label="Unificar" sub="Fusionar duplicados" onClick={() => setShowUnificar(true)} color="violet" />}
                                                {selectedCita.esCitaEnfermeria && (
                                                    <ActionBtn icon={<ClipboardList size={14}/>} label="Orden" sub="Ver / editar" onClick={() => window.open(`/enfermeria/orden-servicio?citaId=${selectedCita.id}`, '_blank')} color="emerald" />
                                                )}
                                                {selectedCita.estado === 'completada' && selectedCita.pacienteId && (
                                                    <ActionBtn icon={<Activity size={14}/>} label="Signos" sub={selectedCita.signos_vitales ? 'Editar triage' : 'Registrar triage'} onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente, editMode: Boolean(selectedCita.signos_vitales) } })} color="amber" />
                                                )}
                                                {selectedCita.estado === 'completada' && (
                                                    <ActionBtn icon={<Edit3 size={14}/>} label="Editar cita" sub="Corregir datos" onClick={() => abrirModalEditarCita(selectedCita)} color="slate" />
                                                )}
                                            </div>
                                            {selectedCita.estado !== 'completada' && (
                                                <button onClick={() => setShowCancelarConfirm(true)}
                                                    style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '6px', border: '1px solid #fecdd3', background: '#fff', color: '#f43f5e', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                                                    <XCircle size={13} /> Cancelar esta cita
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ═══ SUB-MODAL REPROGRAMAR ═══ */}
        {showReprogramar && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowReprogramar(false)}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><CalendarClock size={18} className="text-indigo-500"/> Reprogramar</h3>
                        <button onClick={() => setShowReprogramar(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={16}/></button>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nueva Fecha</label>
                            <input type="date" value={reprogramarData.fecha} onChange={e => setReprogramarData(p => ({ ...p, fecha: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hora Inicio</label>
                                <input type="time" value={reprogramarData.hora} onChange={e => setReprogramarData(p => ({ ...p, hora: e.target.value, horaFin: sumarMinutos(e.target.value, INTERVALO_MINUTOS) }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hora Fin</label>
                                <input type="time" value={reprogramarData.horaFin} onChange={e => setReprogramarData(p => ({ ...p, horaFin: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"/>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleReprogramar} disabled={actionLoading === 'reprogramar'}
                        className="w-full mt-5 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {actionLoading === 'reprogramar' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Reprogramando...</> : 'Confirmar Reprogramación'}
                    </button>
                </div>
            </div>
        )}

        {/* ═══ SUB-MODAL CANCELAR ═══ */}
        {showCancelarConfirm && selectedCita && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => { setShowCancelarConfirm(false); setCancelarMotivo(''); }}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-red-500"/></div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Cancelar Cita</h3>
                            <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                        ¿Cancelar la cita de <span className="font-bold">{selectedCita.paciente}</span>?
                    </p>
                    <textarea
                        value={cancelarMotivo} onChange={e => setCancelarMotivo(e.target.value)}
                        placeholder="Motivo de cancelación (opcional)..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-red-300 resize-none h-20 mb-4"
                    />
                    <div className="flex gap-2">
                        <button onClick={() => { setShowCancelarConfirm(false); setCancelarMotivo(''); }}
                            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                            Volver
                        </button>
                        <button onClick={handleCancelarCita} disabled={actionLoading === 'cancelar'}
                            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {actionLoading === 'cancelar' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Cancelando...</> : 'Sí, Cancelar'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showPacienteModal && <ModalPaciente onClose={() => { setShowPacienteModal(false); setPacienteAEditar(null); }} onPacienteCreado={(p) => { handlePacienteCreado(p); setPacienteAEditar(null); }} pacienteAEditar={pacienteAEditar} />}
        
        {/* ═══ SUB-MODAL SELECCIONAR DOCTOR PARA DOCUMENTOS ═══ */}
        {showModalSelectDoctorDocumentos && selectedCita && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowModalSelectDoctorDocumentos(false)}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center"><ClipboardList size={18} className="text-orange-600"/></div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Generar Documentos</h3>
                                <p className="text-[11px] text-slate-400">Selecciona el médico a cargo</p>
                            </div>
                        </div>
                        <button onClick={() => setShowModalSelectDoctorDocumentos(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={16}/></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="relative mb-3">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar médico..."
                                    value={doctorDocsSearchTerm}
                                    onChange={(e) => setDoctorDocsSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
                                />
                                {doctorDocsSearchTerm && (
                                    <button onClick={() => setDoctorDocsSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={14}/>
                                    </button>
                                )}
                            </div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Médico a cargo</label>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2 bg-slate-50">
                                {doctoresFiltrados.filter(d => {
                                    if (!doctorDocsSearchTerm) return true;
                                    const searchLower = doctorDocsSearchTerm.toLowerCase();
                                    return (d.nombre || '').toLowerCase().includes(searchLower) || (d.especialidad || '').toLowerCase().includes(searchLower);
                                }).map(d => {
                                    const consultorio = d._consultorio;
                                    const esMiSucursal = d._mismaSucursal;
                                    return (
                                    <button
                                        key={d.id}
                                        onClick={() => setSelectedDoctorDocsId(d.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                                            selectedDoctorDocsId === d.id
                                                ? 'bg-orange-50 border border-orange-300 ring-1 ring-orange-200'
                                                : 'bg-white border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                                            selectedDoctorDocsId === d.id ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {(d.nombre || 'D').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold truncate ${selectedDoctorDocsId === d.id ? 'text-orange-900' : 'text-slate-700'}`}>
                                                {esMiSucursal && <MapPin size={10} className="inline text-teal-500 mr-1" />}
                                                Dr. {d.nombre}
                                            </p>
                                            <p className={`text-[10px] truncate ${selectedDoctorDocsId === d.id ? 'text-orange-600/80' : 'text-slate-400'}`}>
                                                {consultorio.nombre || 'Médico'}
                                                {consultorio.sucursal ? ` · ${consultorio.sucursal}` : ''}
                                            </p>
                                        </div>
                                        {selectedDoctorDocsId === d.id && <CheckCircle2 size={16} className="text-orange-500"/>}
                                    </button>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <button
                            onClick={handleConfirmarDoctorDocumentos}
                            disabled={!selectedDoctorDocsId}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <span>Continuar</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ═══ SUB-MODAL REASIGNAR DOCTOR ═══ */}
        {showReasignar && selectedCita && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowReasignar(false)}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><ArrowLeftRight size={18} className="text-amber-600"/></div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Reasignar Doctor</h3>
                                <p className="text-[11px] text-slate-400">
                                    Actual: <span className="font-bold text-slate-600">Dr. {selectedCita.doctorAsignado || 'Sin asignar'}</span>
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setShowReasignar(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={16}/></button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Nuevo Doctor</label>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2 bg-slate-50">
                                {doctoresFiltrados.filter(d => d.id !== selectedCita.doctorUid).map(d => {
                                    const consultorio = d._consultorio;
                                    const esMiSucursal = d._mismaSucursal;
                                    return (
                                    <button
                                        key={d.id}
                                        onClick={() => setReasignarData(prev => ({ ...prev, doctorUid: d.id, doctorNombre: d.nombre }))}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                                            reasignarData.doctorUid === d.id
                                                ? 'bg-amber-50 border border-amber-300 ring-1 ring-amber-200'
                                                : 'bg-white border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                                            reasignarData.doctorUid === d.id ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {(d.nombre || '?').charAt(0)}
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${reasignarData.doctorUid === d.id ? 'text-amber-800' : 'text-slate-700'}`}>
                                                {esMiSucursal && <MapPin size={10} className="inline text-teal-500 mr-1" />}
                                                Dr. {d.nombre}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {consultorio.nombre || 'Médico'}
                                                {consultorio.sucursal ? ` · ${consultorio.sucursal}` : ''}
                                            </p>
                                        </div>
                                        {reasignarData.doctorUid === d.id && <CheckCircle size={16} className="ml-auto text-amber-500"/>}
                                    </button>
                                    );
                                })}
                                {doctoresFiltrados.filter(d => d.id !== selectedCita.doctorUid).length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-3">No hay otros doctores disponibles</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Justificación *</label>
                            <textarea
                                value={reasignarData.justificacion}
                                onChange={e => setReasignarData(prev => ({ ...prev, justificacion: e.target.value }))}
                                placeholder="Motivo de la reasignación..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 resize-none h-20"
                            />
                        </div>
                    </div>

                    <button onClick={handleReasignarDoctor} disabled={actionLoading === 'reasignar' || !reasignarData.doctorUid}
                        className="w-full mt-4 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {actionLoading === 'reasignar' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Reasignando...</> : 'Confirmar Reasignación'}
                    </button>
                </div>
            </div>
        )}

        {/* ═══ SUB-MODAL CAMBIAR CONSULTORIO ═══ */}
        {showCambiarConsultorio && selectedCita && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowCambiarConsultorio(false)}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Building size={18} className="text-blue-600"/></div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Cambiar Consultorio</h3>
                                <p className="text-[11px] text-slate-400">
                                    Actual: <span className="font-bold text-slate-600">{selectedCita.consultorio || 'Sin consultorio'}</span>
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setShowCambiarConsultorio(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={16}/></button>
                    </div>

                    <div className="space-y-3">
                        {/* Sucursal */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Sucursal</label>
                            <select
                                value={cambiarConsultorioData.sucursalId}
                                onChange={e => {
                                    const suc = catalogoSucursales.find(s => s.id === e.target.value);
                                    setCambiarConsultorioData(prev => ({ ...prev, sucursalId: suc?.id || '', sucursalNombre: suc?.nombre || '', consultorioId: '', consultorioNombre: '' }));
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                            >
                                <option value="">Seleccionar sucursal...</option>
                                {catalogoSucursales.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* Consultorio */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">Nuevo Consultorio</label>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2 bg-slate-50">
                                {consultorios
                                    .filter(c => !cambiarConsultorioData.sucursalId || c.sucursalId === cambiarConsultorioData.sucursalId)
                                    .filter(c => c.id !== selectedCita.consultorioId)
                                    .map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            const suc = catalogoSucursales.find(s => s.id === c.sucursalId);
                                            setCambiarConsultorioData(prev => ({
                                                ...prev,
                                                consultorioId: c.id,
                                                consultorioNombre: c.nombre,
                                                sucursalId: c.sucursalId || prev.sucursalId,
                                                sucursalNombre: suc?.nombre || prev.sucursalNombre
                                            }));
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                                            cambiarConsultorioData.consultorioId === c.id
                                                ? 'bg-blue-50 border border-blue-300 ring-1 ring-blue-200'
                                                : 'bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                                            cambiarConsultorioData.consultorioId === c.id ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            <Building size={14}/>
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${cambiarConsultorioData.consultorioId === c.id ? 'text-blue-800' : 'text-slate-700'}`}>
                                                {c.nombre}
                                            </p>
                                            {c.sucursal && <p className="text-[10px] text-slate-400">{c.sucursal}</p>}
                                        </div>
                                        {cambiarConsultorioData.consultorioId === c.id && <CheckCircle size={16} className="ml-auto text-blue-500"/>}
                                    </button>
                                ))}
                                {consultorios.filter(c => !cambiarConsultorioData.sucursalId || c.sucursalId === cambiarConsultorioData.sucursalId).filter(c => c.id !== selectedCita.consultorioId).length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-3">No hay otros consultorios disponibles</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Justificación *</label>
                            <textarea
                                value={cambiarConsultorioData.justificacion}
                                onChange={e => setCambiarConsultorioData(prev => ({ ...prev, justificacion: e.target.value }))}
                                placeholder="Motivo del cambio de consultorio..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none h-20"
                            />
                        </div>
                    </div>

                    <button onClick={handleCambiarConsultorio} disabled={actionLoading === 'cambiarConsultorio' || !cambiarConsultorioData.consultorioId}
                        className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {actionLoading === 'cambiarConsultorio' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Cambiando...</> : 'Confirmar Cambio'}
                    </button>
                </div>
            </div>
        )}

        {showUnificar && selectedCita?.pacienteId && (
            <ModalUnificarExpedientes
                pacienteId={selectedCita.pacienteId}
                pacienteNombre={selectedCita.paciente}
                onClose={() => setShowUnificar(false)}
                showToast={showToast}
            />
        )}

        {/* ═══ MODAL RESUMEN DE JORNADA (POR SUCURSAL Y TURNOS) ═══ */}
        {showResumenJornada && (() => {
            const totalDia = citasJornadaSucursal.length;
            const enRango = citasEnRango.length;
            const mostrarFiltrado = horaInicioRango !== '00:00' || horaFinRango !== '23:59';
            return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowResumenJornada(false)}>
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-[95vw] xl:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100" onClick={e => e.stopPropagation()}>
                    {/* ── Encabezado ── */}
                    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-emerald-50 shrink-0 space-y-3">
                        {/* Título + fecha + cierre */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-teal-200 flex items-center justify-center text-teal-600 shadow-sm">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-slate-800 font-jakarta">Resumen de Jornada</h2>
                                        <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                                            <MapPin size={10} className="text-slate-400" />
                                            {sucursalPredeterminada?.nombre || 'Sin sucursal'}
                                        </p>
                                    </div>
                                </div>
                                {/* Navegación de fecha */}
                                <div className="flex items-center gap-1 ml-2">
                                    <button onClick={() => cambiarDia(-1)} className="p-1.5 hover:bg-white/60 rounded-lg text-slate-500 transition-all">
                                        <ChevronLeft size={15} />
                                    </button>
                                    <div className="relative flex items-center cursor-pointer px-2">
                                        <input
                                            type="date"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            value={toInputDateValue(currentDate)}
                                            onChange={(e) => { if (e.target.value) setCurrentDate(new Date(e.target.value + 'T12:00:00')); }}
                                        />
                                        <CalIcon size={13} className="text-slate-400 mr-1.5" />
                                        <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                                            {currentDate.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <button onClick={() => cambiarDia(1)} className="p-1.5 hover:bg-white/60 rounded-lg text-slate-500 transition-all">
                                        <ChevronRight size={15} />
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setShowResumenJornada(false)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shadow-sm">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Filtro de horario */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Horario:</span>
                            {[
                                { label: 'Todo el día',        inicio: '00:00', fin: '23:59' },
                                { label: 'Matutino',           inicio: '08:00', fin: '13:59' },
                                { label: 'Vespertino',         inicio: '14:00', fin: '19:59' },
                                { label: 'Nocturno',           inicio: '20:00', fin: '23:59' },
                            ].map(p => {
                                const activo = horaInicioRango === p.inicio && horaFinRango === p.fin;
                                return (
                                    <button
                                        key={p.label}
                                        onClick={() => { setHoraInicioRango(p.inicio); setHoraFinRango(p.fin); }}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border"
                                        style={{
                                            background: activo ? '#0d9488' : '#ffffff',
                                            color: activo ? '#ffffff' : '#64748b',
                                            borderColor: activo ? '#0d9488' : '#e2e8f0',
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                            <div className="flex items-center gap-1.5 ml-1">
                                <Clock size={12} className="text-slate-400 shrink-0" />
                                <input
                                    type="time"
                                    value={horaInicioRango}
                                    onChange={(e) => setHoraInicioRango(e.target.value)}
                                    className="w-[90px] px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 outline-none focus:border-teal-400 bg-white"
                                />
                                <span className="text-[10px] text-slate-400">a</span>
                                <input
                                    type="time"
                                    value={horaFinRango}
                                    onChange={(e) => setHoraFinRango(e.target.value)}
                                    className="w-[90px] px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 outline-none focus:border-teal-400 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Contenido ── */}
                    <div className="flex-1 overflow-auto">
                        {totalDia === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                                <Users size={32} className="text-slate-300" />
                                <p className="text-sm font-bold">Sin pacientes registrados</p>
                                <p className="text-xs text-slate-400">No hay citas en {sucursalPredeterminada?.nombre || 'esta sucursal'} en esta fecha.</p>
                            </div>
                        ) : enRango === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                                <Clock size={32} className="text-slate-300" />
                                <p className="text-sm font-bold">Sin pacientes en este horario</p>
                                <p className="text-xs text-slate-400">
                                    Hay {totalDia} paciente{totalDia !== 1 ? 's' : ''} en el día, pero ninguno entre {horaInicioRango} y {horaFinRango}.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[1360px] w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <th className="px-2 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Hora</th>
                                            <th className="px-2 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Creado por</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">E/T</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Motivo</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Nombre completo</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">Edad</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">Peso</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">Talla</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">T°</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">F.R.</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">St. O2</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">F.C.</th>
                                            <th className="px-2 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase border-r border-slate-200">T/A</th>
                                            <th className="px-3 py-2.5 text-center text-[11px] font-black text-slate-500 uppercase">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {citasEnRango.map((cita, idx) => {
                                            const stripe = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
                                            const sv = cita.signos_vitales || {};
                                            const pagoMeta = PAYMENT_METHOD_OPTIONS.find(o => o.value === cita.formaPago);
                                            const pagoClass = pagoMeta
                                                ? 'text-slate-800 bg-slate-100 border-slate-200'
                                                : 'text-amber-700 bg-amber-50 border-amber-200';
                                            const creadorNombre = nombresCreadores[cita.creadoPor] || cita.creadoPorNombre || cita.creadoPor || '-';

                                            return (
                                                <tr
                                                    key={cita.id}
                                                    className={`${stripe} border-b border-slate-100 hover:bg-blue-50/20 cursor-pointer`}
                                                    onClick={() => { setShowResumenJornada(false); setSelectedCita(cita); }}
                                                >
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                                                        {cita.hora || '-'}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[11px] font-semibold text-slate-600 whitespace-nowrap max-w-[120px] truncate" title={creadorNombre}>
                                                        {creadorNombre}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100">
                                                        <span className={`inline-flex items-center justify-center min-w-9 px-2 py-1 rounded-lg border text-[11px] font-black ${pagoClass}`}>
                                                            {pagoMeta?.shortLabel || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 border-r border-slate-100 text-[12px] font-semibold text-slate-700 min-w-[160px]">{cita.motivo || '-'}</td>
                                                    <td className="px-3 py-1.5 border-r border-slate-100 text-[12px] font-semibold text-slate-800 min-w-[240px]">{cita.paciente || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.edad || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.peso || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.talla || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.temp || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.fr || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.spo2 || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.fc || '-'}</td>
                                                    <td className="px-2 py-1.5 text-center border-r border-slate-100 text-[12px] font-bold text-slate-700">{sv.ta || '-'}</td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <EstadoPacienteBadge cita={cita} size="xs" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            {mostrarFiltrado ? (
                                <p className="text-xs font-bold text-slate-500">
                                    Mostrando <span className="text-slate-800">{enRango}</span> de{' '}
                                    <span className="text-slate-800">{totalDia}</span> paciente{totalDia !== 1 ? 's' : ''}
                                    {' '}<span className="text-slate-400 font-medium">({horaInicioRango} – {horaFinRango})</span>
                                </p>
                            ) : (
                                <p className="text-xs font-bold text-slate-500">
                                    Total: <span className="text-slate-800">{totalDia} paciente{totalDia !== 1 ? 's' : ''}</span>
                                </p>
                            )}
                        </div>
                        <button onClick={() => setShowResumenJornada(false)} className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-all active:scale-95 shadow-sm">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
            );
        })()}

            {/* --- MONTAR EL MODAL DE REGISTROS --- */}
        {showRegistrosModal && (
            <RegistrosEnfermeriaModal 
                onClose={() => setShowRegistrosModal(false)} 
                enfermeraNombre={user?.nombre || "Enfermería"} 
            />
        )}
        </div>
    </>
  );
};

// --- COMPONENTES VISUALES ---
const QuickInfoCard = ({ icon, label, value, helper, tone = 'slate' }) => {
    const toneStyles = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        violet: 'bg-violet-50 text-violet-600 border-violet-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100'
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${toneStyles[tone] || toneStyles.slate}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
                    <p className="text-sm font-bold text-slate-800 mt-1 leading-snug break-words">{value}</p>
                    {helper && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words">{helper}</p>}
                </div>
            </div>
        </div>
    );
};

const DetailRow = ({ label, value, statusTone = 'neutral' }) => {
    const toneStyles = {
        neutral: 'bg-slate-100 text-slate-600',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700'
    };

    return (
        <div className="flex items-center justify-between gap-3 bg-slate-50/60 rounded-lg px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${toneStyles[statusTone] || toneStyles.neutral}`}>{value}</span>
        </div>
    );
};

const InfoRow = ({ icon, label, value, truncate, tone = 'neutral' }) => {
    const toneValue = tone === 'warn'
        ? 'text-amber-700 bg-amber-50 border border-amber-200'
        : 'text-slate-700';
    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 shrink-0">{icon} {label}</span>
            <span className={`text-xs font-bold text-right ${truncate ? 'max-w-[160px] truncate' : ''} ${toneValue}`}>{value}</span>
        </div>
    );
};

const ActionBtn = ({ icon, label, sub, done, loading, onClick, disabled, color = 'slate' }) => {
    const colors = {
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', hover: 'hover:border-emerald-300 hover:shadow-emerald-100', icon: 'text-emerald-600', iconBg: 'bg-emerald-100', groupIcon: 'group-hover:bg-emerald-50 group-hover:text-emerald-600' },
        green:   { bg: 'bg-green-50', border: 'border-green-200', hover: 'hover:border-green-300 hover:shadow-green-100', icon: 'text-green-600', iconBg: 'bg-green-100', groupIcon: 'group-hover:bg-green-50 group-hover:text-green-600' },
        indigo:  { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:border-indigo-300 hover:shadow-indigo-100', icon: 'text-slate-500', iconBg: 'bg-slate-100', groupIcon: 'group-hover:bg-indigo-50 group-hover:text-indigo-600' },
        blue:    { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:border-blue-300 hover:shadow-blue-100', icon: 'text-slate-500', iconBg: 'bg-slate-100', groupIcon: 'group-hover:bg-blue-50 group-hover:text-blue-600' },
        orange:  { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:border-orange-300 hover:shadow-orange-100', icon: 'text-slate-500', iconBg: 'bg-slate-100', groupIcon: 'group-hover:bg-orange-50 group-hover:text-orange-600' },
        teal:    { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:border-teal-300 hover:shadow-teal-100', icon: 'text-slate-500', iconBg: 'bg-slate-100', groupIcon: 'group-hover:bg-teal-50 group-hover:text-teal-600' },
        amber:   { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:border-amber-300 hover:shadow-amber-100', icon: 'text-slate-500', iconBg: 'bg-slate-100', groupIcon: 'group-hover:bg-amber-50 group-hover:text-amber-600' },
        violet:  { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:border-violet-300 hover:shadow-violet-100', icon: 'text-slate-500', iconBg: 'bg-slate-100', groupIcon: 'group-hover:bg-violet-50 group-hover:text-violet-600' },
        slate:   { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:border-blue-300 hover:shadow-blue-100', icon: 'text-slate-500', iconBg: 'bg-slate-100', groupIcon: 'group-hover:bg-blue-50 group-hover:text-blue-600' },
    };
    const c = colors[color] || colors.slate;
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`group flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all active:scale-[0.96] text-center ${done ? c.bg + ' ' + c.border : 'bg-white border-slate-200 ' + c.hover + ' hover:shadow-md'}`}
        >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${done ? c.iconBg + ' ' + c.icon : 'bg-slate-100 text-slate-500 ' + c.groupIcon}`}>
                {loading ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : icon}
            </div>
            <div>
                <p className={`text-[10px] font-bold ${done ? (color === 'emerald' ? 'text-emerald-700' : 'text-green-700') : 'text-slate-700'}`}>{done ? `${label} ✓` : label}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>
            </div>
        </button>
    );
};

const CardCita = ({ cita, onClick, navigate }) => {
    const ahora = new Date();
    const horaCita = cita.fechaHora || '';
    const citaDate = horaCita ? new Date(horaCita) : null;
    const minutosEspera = citaDate ? Math.max(0, Math.round((ahora - citaDate) / 60000)) : 0;
    const esRetrasada = minutosEspera > 15;
    const esCancelada = cita.estado === 'cancelada';

    return (
        <div 
            onClick={() => onClick(cita)}
            className={`group p-6 rounded-3xl border shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden ${
                esCancelada
                    ? 'bg-slate-50 border-red-200/60 opacity-60 hover:opacity-90 hover:border-red-300'
                    : 'bg-white border-slate-200 hover:border-blue-300'
            }`}
        >
            {/* Diagonal cancelled stripe */}
            {esCancelada && (
                <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden pointer-events-none">
                    <div className="absolute top-3 -right-5 w-28 text-center text-[7px] font-black uppercase tracking-widest text-white bg-red-400 rotate-45 py-0.5 shadow-sm">
                        Cancelada
                    </div>
                </div>
            )}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    {/* Badge de estado unificado */}
                    <EstadoPacienteBadge cita={cita} size="sm" showUrgencia showSublabel />
                    <span className={`text-sm font-bold uppercase tracking-wide ${esCancelada ? 'text-slate-300 line-through' : 'text-slate-400'}`}>{cita.hora}</span>
                </div>
                {cita.esTeleconsulta && <div className="p-2 bg-indigo-50 rounded-xl"><Video size={16} className="text-indigo-600"/></div>}
            </div>
            <h3 className={`font-black text-xl mb-2 font-jakarta truncate ${esCancelada ? 'text-slate-400 line-through decoration-red-300' : 'text-slate-800'}`}>{cita.paciente}</h3>
            {!esCancelada && (cita.estado === 'pendiente' || cita.estado === 'en_espera') && minutosEspera > 0 && (
                <p className={`text-xs font-bold mt-1 ${esRetrasada ? 'text-red-500' : 'text-slate-400'}`}>
                    {minutosEspera} min esperando
                </p>
            )}
            {esCancelada && cita.canceladaMotivo && (
                <p className="text-[11px] text-red-400 font-semibold mt-1 truncate">
                    {cita.canceladaMotivo}
                </p>
            )}
            <div className={`flex items-center gap-3 mt-5 pt-4 border-t ${esCancelada ? 'border-slate-200/60' : 'border-slate-100'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border shadow-sm ${esCancelada ? 'bg-slate-100 text-slate-300 border-slate-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {cita.doctorAsignado?.charAt(0) || 'D'}
                </div>
                <div className="flex flex-col">
                    <span className={`text-sm font-bold ${esCancelada ? 'text-slate-400' : 'text-slate-700'}`}>Dr. {cita.doctorAsignado?.split(' ')[0]}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${esCancelada ? 'text-slate-300' : 'text-slate-400'}`}>{cita.consultorio || 'General'}</span>
                </div>
            </div>
        </div>
    );
};

export default AgendaEnfermeria;