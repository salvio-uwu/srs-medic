import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalIcon, Clock, User, Plus, ChevronLeft, ChevronRight, 
  Search, X, Activity, Stethoscope, ChevronDown, CheckCircle, 
  AlertCircle, Zap, Video, MapPin, Building, AlertTriangle, CheckCircle2,
  Phone, ClipboardList, Edit3, Lock, CalendarClock, MessageSquare, 
  LogIn, FileText, XCircle, MoreHorizontal, Send, Ban, GitMerge, LogOut, BookOpen, ArrowLeftRight
} from 'lucide-react';
import { db, functions } from '../../config/firebase'; 
import { collection, addDoc, query, where, orderBy, getDocs, getDoc, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ModalPaciente from '../../components/ModalPaciente';
import AvatarPaciente, { calcularEdad } from '../../components/AvatarPaciente';
import RegistrosEnfermeriaModal from '../../components/RegistrosEnfermeriaModal'; 
import ModalUnificarExpedientes from '../../components/ModalUnificarExpedientes';
import { PAYMENT_METHOD_OPTIONS } from '../../services/enfermeriaPatientLogService';

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

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];

const AgendaEnfermeria = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
  const [showCancelarConfirm, setShowCancelarConfirm] = useState(false);
  const [cancelarMotivo, setCancelarMotivo] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showUnificar, setShowUnificar] = useState(false);
  const [showReasignar, setShowReasignar] = useState(false);
  const [reasignarData, setReasignarData] = useState({ doctorUid: '', doctorNombre: '', justificacion: '' });
    const [selectedPacienteDetalle, setSelectedPacienteDetalle] = useState(null);
    const [selectedPacienteLoading, setSelectedPacienteLoading] = useState(false);

  const [todosLosPacientes, setTodosLosPacientes] = useState([]); 
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  
    const [consultorios, setConsultorios] = useState([]);
    const [catalogoMotivos, setCatalogoMotivos] = useState([]);
    const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [selectedConsultorio, setSelectedConsultorio] = useState('Todos');
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

    // --- GENERADORES ---

  const showToast = (msg, type = 'error') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'error' }), 4000);
  };

    const cerrarModalCita = () => {
        setShowCitaModal(false);
        setShowSelectorDoctor(false);
        setMostrarSugerencias(false);
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
        const tieneSubmodalAbierto = showReprogramar || showCancelarConfirm || showReasignar || showUnificar || showPacienteModal;
        if (!selectedCita || tieneSubmodalAbierto) return undefined;

        const handleEscapeDetalle = (event) => {
            if (event.key === 'Escape') {
                cerrarDetalleCita();
            }
        };

        window.addEventListener('keydown', handleEscapeDetalle);
        return () => window.removeEventListener('keydown', handleEscapeDetalle);
    }, [selectedCita, showReprogramar, showCancelarConfirm, showReasignar, showUnificar, showPacienteModal]);

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
        }, () => {});

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
            setCatalogoMotivos(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => item.activo !== false));
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
            const mapa = new Map(); // doctorUid -> Map<slotKey, { justificacion, nombre }>
            snap.docs.forEach((d) => {
                const data = d.data();
                if (data.doctorUid && Array.isArray(data.slots)) {
                    const detalle = data.slotsDetalle || {};
                    const slotMap = new Map();
                    data.slots.forEach(s => {
                        slotMap.set(s, {
                            justificacion: detalle[s]?.justificacion || '',
                            nombre: data.doctorNombre || ''
                        });
                    });
                    mapa.set(data.doctorUid, slotMap);
                }
            });
            setHorariosBloqueadosPorDoctor(mapa);
        }, () => {});
        return () => unsub();
    }, [currentDate]);

  useEffect(() => {
    const getPacientes = async () => {
        const snap = await getDocs(collection(db, "pacientes"));
        const pacientes = snap.docs
            .map((d) => {
                const row = d.data() || {};
                return {
                    id: d.id,
                    nombre: row.nombreCompleto || row.nombre || '',
                    telefono: row.telefonoMovil || row.telefono || '',
                    idPaciente: row.idPaciente || row.idPacienteMigrado || ''
                };
            })
            .filter((p) => Boolean(p.nombre))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

        setTodosLosPacientes(pacientes);
    };
    getPacientes();
  }, []);

    const consultoriosNombres = useMemo(
        () => consultorios.map((c) => c.nombre).filter(Boolean),
        [consultorios]
    );

    const sucursalPredeterminada = useMemo(() => {
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
    }, [catalogoSucursales, user?.sucursalId, user?.sucursal]);

    useEffect(() => {
        if (selectedConsultorio !== 'Todos' && !consultoriosNombres.includes(selectedConsultorio)) {
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

  // --- HELPERS ---
  const getDoctorStatus = (docData) => {
    if (!docData.isOnline) return { color: 'bg-slate-300', text: 'Fuera de Línea' };
    if (docData.statusOperativo === 'ocupado') return { color: 'bg-rose-500', text: 'Ocupado' };
    if (docData.statusOperativo === 'comida') return { color: 'bg-amber-500', text: 'Comida' };
    return { color: 'bg-emerald-500', text: 'Disponible' };
  };

    const getDoctorConsultorio = (docData) => {
        const consultorioIdRaw = String(docData?.consultorioActualId || docData?.consultorioRecurrenteId || docData?.consultorioId || '').trim();
        const consultorioNombreRaw = String(
            docData?.consultorioActual || docData?.consultorioRecurrente || docData?.consultorio || ''
        ).trim();

        const consultorioById = consultorios.find((item) => String(item?.id || '').trim() === consultorioIdRaw);
        const consultorioByName = consultorioNombreRaw
            ? consultorios.find((item) => String(item?.nombre || '').trim().toLowerCase() === consultorioNombreRaw.toLowerCase())
            : null;
        const found = consultorioById || consultorioByName || null;

        return {
            id: found?.id || consultorioIdRaw,
            nombre: found?.nombre || consultorioNombreRaw,
            sucursalId: found?.sucursalId || '',
            sucursal: found?.sucursal || ''
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
    setNuevaCita({ ...nuevaCita, paciente: p.nombre, pacienteId: p.id, pacienteTelefono: p.telefono });
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

    setNuevaCita({ 
        ...nuevaCita, 
        fecha: toInputDateValue(currentDate), 
        hora: slot.startTime, 
                horaFin: slot.endTime || sumarMinutos(slot.startTime, INTERVALO_MINUTOS),
                consultorio: consultorioNombre,
                consultorioId: consultorioData?.id || '',
                motivo: motivoData?.nombre || '',
                motivoId: motivoData?.id || '',
                sucursal: sucursalData?.nombre || user?.sucursal || '',
                sucursalId: sucursalData?.id || user?.sucursalId || '',
                formaPago: ''
    });
    setShowCitaModal(true);
    setConfirmModal({ show: false, slot: null });
  };

const handleGuardarCita = async (e) => {
    e?.preventDefault();
    const motivoSeleccionado = catalogoMotivos.find((m) => m.id === nuevaCita.motivoId);
    const esCitaEnfermeria = Boolean(motivoSeleccionado?.atendidoPorEnfermeria);

    if (!esCitaEnfermeria) {
        if (!nuevaCita.paciente || !nuevaCita.hora || !nuevaCita.horaFin || !nuevaCita.doctorUid || !nuevaCita.consultorio || !nuevaCita.motivo || !nuevaCita.formaPago) {
            showToast("Faltan campos obligatorios (Paciente, horario, motivo, consultorio, médico o forma de pago).", "error");
            return;
        }
    } else {
        if (!nuevaCita.paciente || !nuevaCita.hora || !nuevaCita.horaFin || !nuevaCita.motivo || !nuevaCita.formaPago) {
            showToast("Faltan campos obligatorios (Paciente, horario, motivo o forma de pago).", "error");
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
                if (bloqueadosDoctor.has(slotKey)) {
                    showToast(`El Dr. ${nuevaCita.doctorAsignado} bloqueó ese horario. Selecciona otro.`, "error");
                    return;
                }
            }
        }
    }
    try {
        let meetLink = '';
        if (nuevaCita.esTeleconsulta) {
          const roomId = `srs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          meetLink = `https://meet.jit.si/${roomId}`;
        }

        const motivoData = catalogoMotivos.find((m) => m.id === nuevaCita.motivoId) || catalogoMotivos.find((m) => m.nombre === nuevaCita.motivo);
        const consultorioData = consultorios.find((c) => c.id === nuevaCita.consultorioId) || consultorios.find((c) => c.nombre === nuevaCita.consultorio);
                const sucursalData = catalogoSucursales.find((s) => s.id === nuevaCita.sucursalId)
                    || catalogoSucursales.find((s) => s.nombre === nuevaCita.sucursal)
                    || (consultorioData?.sucursalId ? catalogoSucursales.find((s) => s.id === consultorioData.sucursalId) : null)
                    || sucursalPredeterminada
                    || null;

        const payload = {
          ...nuevaCita,
          motivo: motivoData?.nombre || nuevaCita.motivo,
          motivoId: motivoData?.id || nuevaCita.motivoId || '',
          motivoPrecio: Number(motivoData?.precio || 0),
          areaConsulta: motivoData?.area || '',
          consultorio: consultorioData?.nombre || nuevaCita.consultorio,
          consultorioId: consultorioData?.id || nuevaCita.consultorioId || '',
          sucursal: nuevaCita.sucursal || sucursalData?.nombre || sucursalPredeterminada?.nombre || user?.sucursal || '',
          sucursalId: nuevaCita.sucursalId || sucursalData?.id || user?.sucursalId || '',
          meetLink,
          formaPago: nuevaCita.formaPago,
          fechaHora: `${nuevaCita.fecha}T${nuevaCita.hora}`,
          fechaHoraFin: `${nuevaCita.fecha}T${nuevaCita.horaFin}`,
          estado: 'pendiente',
          creadoPor: user.uid,
          creadoPorRol: 'enfermeria',
          esCitaEnfermeria,
          enfermeroAsignadoId: esCitaEnfermeria ? (nuevaCita.enfermeroAsignadoId || '') : '',
          enfermeroAsignadoNombre: esCitaEnfermeria ? (nuevaCita.enfermeroAsignadoNombre || '') : ''
        };

                const citaRef = await addDoc(collection(db, "citas"), payload);

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

    const handleGenerarDocumento = () => {
        if (!selectedCita?.pacienteId) {
            showToast("No hay paciente vinculado a esta cita.", "error");
            return;
        }

        navigate('/enfermeria/expediente', {
            state: {
                pacienteId: selectedCita.pacienteId,
                pacienteNombre: selectedCita.paciente,
                citaId: selectedCita.id,
                openDocumentTemplates: true,
                openedFrom: 'enfermeria_agenda'
            }
        });
    };

    const metrics = useMemo(() => ({
        espera: citas.filter(c => c.estado === 'pendiente' || c.estado === 'en_espera').length,
        consulta: citas.filter(c => c.estado === 'en_consulta').length,
        fin: citas.filter(c => c.estado === 'completada').length
    }), [citas]);

    const doctoresFiltrados = useMemo(() => {
            return [...doctores].sort((a, b) =>
                    String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
            );
        }, [doctores]);

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
                                    sucursal: sucursalData?.nombre || user?.sucursal || '',
                                    sucursalId: sucursalData?.id || user?.sucursalId || '',
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
              <div className="px-3 sm:px-6 py-2 border-b border-slate-200/50 flex flex-col md:flex-row justify-between items-center gap-2 sm:gap-3 shrink-0 bg-white/40">
                  <div className="flex gap-1.5 sm:gap-2 w-full md:w-auto overflow-x-auto">
                      <MetricCard label="En Espera" value={metrics.espera} icon={<Clock size={14}/>} color="text-orange-600" bg="bg-orange-50" onClick={()=>setViewFilter('pendientes')} active={viewFilter==='pendientes'} />
                      <MetricCard label="En Consulta" value={metrics.consulta} icon={<Stethoscope size={14}/>} color="text-blue-600" bg="bg-blue-50" onClick={()=>setViewFilter('en_consulta')} active={viewFilter==='en_consulta'} />
                      <MetricCard label="Finalizados" value={metrics.fin} icon={<CheckCircle size={14}/>} color="text-emerald-600" bg="bg-emerald-50" onClick={()=>setViewFilter('finalizados')} active={viewFilter==='finalizados'} />
                  </div>

                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors shrink-0 w-full md:w-auto">
                      <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600"><Building size={14}/></div>
                      <div className="relative flex-1 md:flex-initial">
                          <select 
                            value={selectedConsultorio} onChange={(e) => setSelectedConsultorio(e.target.value)}
                            className="bg-transparent border-none outline-none font-bold text-[11px] text-slate-800 pr-6 cursor-pointer font-jakarta appearance-none w-full"
                          >
                             <option value="Todos">Todos los Consultorios</option>
                                      {consultoriosNombres.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-1 top-0.5 text-slate-400 pointer-events-none"/>
                      </div>
                  </div>
              </div>

              {/* FILTROS */}
              <div className="timeline-toolbar flex-col sm:flex-row gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 sora shrink-0">Consultas del día</h2>
                  <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 -mb-1 sm:mb-0">
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

              {/* TIMELINE ESTILO RANGOS (14:00 - 14:10) */}
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
                                              {citasEnSlot.map(cita => (
                                                  <div key={cita.id} onClick={() => setSelectedCita(cita)} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-xl sm:rounded-2xl transition-all cursor-pointer hover:border-blue-300 group/item gap-2 sm:gap-0">
                                                      <div className="flex items-center gap-2 sm:gap-4 overflow-hidden min-w-0">
                                                          <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full shrink-0 shadow-sm ${
                                                              cita.estado === 'pendiente' ? 'bg-orange-500 animate-pulse' : 
                                                              cita.estado === 'en_espera' ? 'bg-blue-500' : 'bg-emerald-500'
                                                          }`}></div>
                                                          <span className="text-sm sm:text-base font-bold truncate text-slate-800 font-jakarta">{cita.paciente}</span>
                                                          <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-4 border-l border-slate-200 ml-1 sm:ml-2 shrink-0">
                                                              {cita.esTeleconsulta && <span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-indigo-50 text-indigo-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-bold uppercase tracking-wider"><Video size={10}/> Tele</span>}
                                                              <span className="text-[9px] sm:text-[10px] bg-slate-100 text-slate-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-bold uppercase tracking-wider">{cita.motivo}</span>
                                                          </div>
                                                      </div>
                                                      <div className="hidden md:flex items-center gap-3 shrink-0 w-48 lg:w-64 justify-start border-l border-slate-100 pl-4 lg:pl-6">
                                                          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 shadow-sm">
                                                              {cita.doctorAsignado?.charAt(0) || 'D'}
                                                          </div>
                                                          <div className="flex flex-col min-w-0">
                                                              <span className="text-xs lg:text-sm text-slate-700 font-bold truncate">Dr. {cita.doctorAsignado?.split(' ')[1] || cita.doctorAsignado || 'General'}</span>
                                                              <span className="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{cita.consultorio || 'Sin Asignar'}</span>
                                                          </div>
                                                      </div>
                                                  </div>
                                              ))}
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
          <div className="w-[340px] glass-panel rounded-3xl flex flex-col z-20 hidden xl:flex overflow-hidden">
              <div className="p-6 border-b border-slate-200/50 bg-white/40">
                  <h3 className="text-xs font-black text-slate-500 flex items-center justify-between uppercase tracking-widest">
                      <span className="flex items-center gap-2"><Zap size={18} className="text-amber-500" fill="currentColor"/> Médicos Disponibles</span>
                      <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg">{doctoresFiltrados.length}</span>
                  </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white/20">
                  {doctoresFiltrados.map(doc => {
                      const status = getDoctorStatus(doc);
                      const doctorConsultorio = getDoctorConsultorio(doc);
                      return (
                          <div key={doc.id} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between cursor-default">
                              <div className="flex items-center gap-4">
                                  <div className="relative shrink-0">
                                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 font-black border border-slate-200 text-lg shadow-sm">
                                          {doc.nombre?.charAt(0)}
                                      </div>
                                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${status.color}`}></div>
                                  </div>
                                  <div className="flex flex-col">
                                      <p className="text-sm font-bold text-slate-800 leading-tight font-jakarta">{doc.nombre}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{doctorConsultorio.nombre || 'Consulta Gral'}</p>
                                      <p className={`text-[10px] font-black uppercase mt-1 ${status.color.replace('bg-', 'text-')}`}>{status.text}</p>
                                  </div>
                              </div>
                          </div>
                      )
                  })}
                  {doctoresFiltrados.length === 0 && (
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
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in"
                onClick={cerrarModalCita}
            >
            <div
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                
                <div className="px-6 md:px-8 py-5 md:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800 font-jakarta">Agendar Cita</h2>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{nuevaCita.hora || '--:--'} - {nuevaCita.horaFin || '--:--'} • {nuevaCita.fecha}</p>
                    </div>
                    <button onClick={cerrarModalCita} className="p-2 md:p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full transition-all shadow-sm"><X size={18} className="md:w-5 md:h-5"/></button>
                </div>
                
                <div className="p-5 md:p-8 space-y-4 md:space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    <div>
                        <label className={labelStyle}>Paciente</label>
                        <div className="flex gap-2 md:gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 md:left-4 top-3 md:top-3.5 text-slate-400" size={16} />
                                <input 
                                    className={`${inputStyle} pl-10 md:pl-12 py-3 md:py-3.5`} placeholder="Buscar en expediente..." value={nuevaCita.paciente}
                                    onChange={(e) => {
                                        setNuevaCita({...nuevaCita, paciente: e.target.value});
                                        const txt = e.target.value.toLowerCase().trim();
                                        if(txt.length > 1) {
                                            const filtered = todosLosPacientes
                                                .filter((p) => {
                                                    const nombre = (p.nombre || '').toLowerCase();
                                                    const idPaciente = String(p.idPaciente || '').toLowerCase();
                                                    return nombre.includes(txt) || idPaciente.includes(txt);
                                                })
                                                .slice(0, 20);
                                            setSugerencias(filtered);
                                            setMostrarSugerencias(true);
                                        } else setMostrarSugerencias(false);
                                    }}
                                />
                                {mostrarSugerencias && (
                                    <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-xl md:rounded-2xl mt-2 border border-slate-100 z-50 p-2">
                                        {sugerencias.map(p => (
                                            <div key={p.id} onClick={() => seleccionarPaciente(p)} className="p-3 hover:bg-slate-50 rounded-lg md:rounded-xl cursor-pointer text-xs md:text-sm font-bold text-slate-700 transition-colors">
                                                {p.nombre}{p.idPaciente ? ` (${p.idPaciente})` : ''}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowPacienteModal(true)} className="bg-slate-900 text-white px-3 md:px-4 rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-900/20 active:scale-95"><Plus size={18} className="md:w-5 md:h-5"/></button>
                        </div>
                    </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Fecha</label>
                            <input type="date" className={`${inputStyle} py-3 md:py-3.5`} value={nuevaCita.fecha} onChange={e => setNuevaCita({...nuevaCita, fecha: e.target.value})} />
                        </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                                <label className={labelStyle}>Hora Inicio</label>
                                                                <input
                                                                    type="time"
                                                                    className={`${inputStyle} py-3 md:py-3.5`}
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
                                                                <label className={labelStyle}>Hora Fin</label>
                                                                <input type="time" className={`${inputStyle} py-3 md:py-3.5`} value={nuevaCita.horaFin} onChange={e => setNuevaCita({...nuevaCita, horaFin: e.target.value})} />
                                                        </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Consultorio</label>
                            <div className="relative">
                                                                <select
                                                                    className={`${inputStyle} appearance-none pr-8 py-3 md:py-3.5`}
                                                                    value={nuevaCita.consultorioId}
                                                                    onChange={e => {
                                                                        const consultorioData = consultorios.find((c) => c.id === e.target.value);
                                                                        setNuevaCita((prev) => ({
                                                                            ...prev,
                                                                            consultorioId: e.target.value,
                                                                            consultorio: consultorioData?.nombre || ''
                                                                        }));
                                                                    }}
                                                                >
                                    <option value="">Asignar Sala...</option>
                                                                        {consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 md:right-4 top-3 md:top-4 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                        {catalogoMotivos.find(m => m.id === nuevaCita.motivoId)?.atendidoPorEnfermeria ? (
                            <div>
                                <label className={labelStyle}>Enfermero/a Asignado/a</label>
                                <div className="relative">
                                    <select
                                        className={`${inputStyle} appearance-none pr-8 py-3 md:py-3.5`}
                                        value={nuevaCita.enfermeroAsignadoId}
                                        onChange={e => {
                                            const enf = enfermeros.find(en => en.id === e.target.value);
                                            setNuevaCita(prev => ({
                                                ...prev,
                                                enfermeroAsignadoId: e.target.value,
                                                enfermeroAsignadoNombre: enf?.nombre || ''
                                            }));
                                        }}
                                    >
                                        <option value="">— Seleccionar enfermero/a —</option>
                                        {enfermeros.map(enf => (
                                            <option key={enf.id} value={enf.id}>{enf.nombre}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 md:right-4 top-3 md:top-4 text-slate-400 pointer-events-none"/>
                                </div>
                                {enfermeros.length === 0 && (
                                    <p className="text-xs text-amber-600 font-semibold mt-1">No hay enfermeros registrados.</p>
                                )}
                            </div>
                        ) : (
                        <div className="relative">
                            <label className={labelStyle}>Médico Responsable</label>
                            <div onClick={() => { setShowSelectorDoctor(!showSelectorDoctor); setDoctorSearchTerm(''); }} className={`${inputStyle} cursor-pointer flex justify-between items-center py-3 md:py-3.5`}>
                                <span className={nuevaCita.doctorAsignado ? "text-slate-800 font-bold text-xs md:text-sm" : "text-slate-400 text-xs md:text-sm"}>{nuevaCita.doctorAsignado || "Seleccionar Médico"}</span>
                                <ChevronDown size={16} className="text-slate-400"/>
                            </div>
                            {showSelectorDoctor && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl md:rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-64 md:max-h-72 overflow-hidden flex flex-col">
                                    <div className="p-2 border-b border-slate-100 shrink-0">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                autoFocus
                                                className="w-full pl-8 pr-3 py-2 text-xs md:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
                                                placeholder="Buscar médico por nombre..."
                                                value={doctorSearchTerm}
                                                onChange={e => setDoctorSearchTerm(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto custom-scrollbar p-2 flex-1">
                                    {doctores
                                        .filter(doc => {
                                            if (!doctorSearchTerm.trim()) return true;
                                            return (doc.nombre || '').toLowerCase().includes(doctorSearchTerm.trim().toLowerCase());
                                        })
                                        .map(doc => {
                                        const st = getDoctorStatus(doc);
                                        const doctorConsultorio = getDoctorConsultorio(doc);
                                        return (
                                            <div key={doc.id} onClick={() => {
                                                setNuevaCita(prev => ({
                                                    ...prev,
                                                    doctorUid: doc.id,
                                                    doctorAsignado: doc.nombre,
                                                    consultorioId: doctorConsultorio.id || prev.consultorioId,
                                                    consultorio: doctorConsultorio.nombre || prev.consultorio
                                                }));
                                                setShowSelectorDoctor(false);
                                                setDoctorSearchTerm('');
                                            }} className="p-3 hover:bg-slate-50 rounded-lg md:rounded-xl cursor-pointer flex justify-between items-center transition-colors">
                                                <span className="text-xs md:text-sm font-bold text-slate-700">{doc.nombre}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{doctorConsultorio.nombre || 'General'}</span>
                                                    <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${st.color}`}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {doctores.filter(doc => !doctorSearchTerm.trim() || (doc.nombre || '').toLowerCase().includes(doctorSearchTerm.trim().toLowerCase())).length === 0 && (
                                        <p className="text-xs text-slate-400 text-center py-3">No se encontró ningún médico</p>
                                    )}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}
                    </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                        <label className={labelStyle}>Tipo de Consulta</label>
                                                        <div className="relative">
                                                                <select className={`${inputStyle} appearance-none pr-8 py-3 md:py-3.5`} value={nuevaCita.tipoConsulta} onChange={e => setNuevaCita({...nuevaCita, tipoConsulta: e.target.value})}>
                                                                        <option value="Primera vez">Primera vez</option>
                                                                        <option value="Subsecuente">Subsecuente</option>
                                                                </select>
                                                                <ChevronDown size={16} className="absolute right-3 md:right-4 top-3 md:top-4 text-slate-400 pointer-events-none"/>
                                                        </div>
                                                </div>
                                                <div>
                                                        <label className={labelStyle}>Sucursal</label>
                                                        <div className="relative">
                                                                <select
                                                                    className={`${inputStyle} appearance-none pr-8 py-3 md:py-3.5`}
                                                                    value={nuevaCita.sucursalId}
                                                                    onChange={e => {
                                                                        const sucursalData = catalogoSucursales.find((s) => s.id === e.target.value);
                                                                        setNuevaCita({
                                                                            ...nuevaCita,
                                                                            sucursalId: e.target.value,
                                                                            sucursal: sucursalData?.nombre || ''
                                                                        });
                                                                    }}
                                                                >
                                                                        <option value="">Seleccionar sucursal...</option>
                                                                        {catalogoSucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                                                </select>
                                                                <ChevronDown size={16} className="absolute right-3 md:right-4 top-3 md:top-4 text-slate-400 pointer-events-none"/>
                                                        </div>
                                                </div>
                                        </div>

                                        <div>
                        <label className={labelStyle}>Motivo de la Visita</label>
                        <div className="relative">
                                                        <select
                                                            className={`${inputStyle} appearance-none pr-8 py-3 md:py-3.5`}
                                                            value={nuevaCita.motivoId}
                                                            onChange={e => {
                                                                const motivoData = catalogoMotivos.find((m) => m.id === e.target.value);
                                                                const esEnfermeria = Boolean(motivoData?.atendidoPorEnfermeria);
                                                                setNuevaCita(prev => ({
                                                                    ...prev,
                                                                    motivoId: e.target.value,
                                                                    motivo: motivoData?.nombre || '',
                                                                    // Si cambia a enfermería, limpiar doctor; si no, limpiar enfermero
                                                                    doctorUid: esEnfermeria ? '' : prev.doctorUid,
                                                                    doctorAsignado: esEnfermeria ? '' : prev.doctorAsignado,
                                                                    enfermeroAsignadoId: esEnfermeria ? prev.enfermeroAsignadoId : '',
                                                                    enfermeroAsignadoNombre: esEnfermeria ? prev.enfermeroAsignadoNombre : ''
                                                                }));
                                                            }}
                                                        >
                                                                <option value="">Seleccionar motivo...</option>
                                                                {catalogoMotivos.map(m => <option key={m.id} value={m.id}>{formatMotivoOption(m)}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 md:right-4 top-3 md:top-4 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>Forma de Pago</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {PAYMENT_METHOD_OPTIONS.map(item => {
                                const checked = nuevaCita.formaPago === item.value;
                                return (
                                    <label
                                        key={item.value}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                                            checked
                                                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => setNuevaCita({ ...nuevaCita, formaPago: checked ? '' : item.value })}
                                            className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                                        />
                                        <span className="text-sm font-bold">{item.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center gap-3 p-3 md:p-4 border border-indigo-100 bg-indigo-50/50 rounded-xl md:rounded-2xl cursor-pointer hover:bg-indigo-50 transition-colors shadow-sm">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 md:w-5 md:h-5 accent-indigo-600 rounded border-gray-300 shrink-0"
                                checked={nuevaCita.esTeleconsulta}
                                onChange={(e) => setNuevaCita({...nuevaCita, esTeleconsulta: e.target.checked})}
                            />
                            <div className="flex items-center gap-2">
                                <Video size={18} className={`md:w-5 md:h-5 ${nuevaCita.esTeleconsulta ? "text-indigo-600" : "text-indigo-300"}`}/>
                                <span className={`text-xs md:text-sm font-bold ${nuevaCita.esTeleconsulta ? "text-indigo-900" : "text-indigo-400"}`}>Es Teleconsulta (Videollamada)</span>
                            </div>
                        </label>
                    </div>

                    <button onClick={handleGuardarCita} type="button" className="btn-main w-full py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm mt-2 md:mt-4 tracking-widest shrink-0">GUARDAR E INICIAR PROCESO</button>
                </div>
            </div>
            </div>
        )}

        {/* ═══ MODAL FLOTANTE DETALLE ═══ */}
        {selectedCita && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" onClick={cerrarDetalleCita}>
                {/* Backdrop */}
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

                {/* Floating Card */}
                <div 
                    className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in"
                    onClick={e => e.stopPropagation()}
                    style={{ animation: 'modalIn .25s ease-out' }}
                >
                    {/* ─── Header con gradiente sutil ─── */}
                    <div className="relative px-6 pt-6 pb-5 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.55),_transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] border-b border-slate-100">
                        <button onClick={cerrarDetalleCita} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all">
                            <X size={18}/>
                        </button>

                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-3 pr-8">
                                    <span className="bg-white/90 text-slate-500 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">
                                        {selectedCita.consultorio || 'Sin Consultorio'}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                                        selectedCita.estado === 'pendiente' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                        selectedCita.estado === 'en_espera' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                        selectedCita.estado === 'cancelada' ? 'bg-red-50 text-red-600 border-red-200' :
                                        'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    }`}>
                                        {selectedCita.estado === 'cancelada' ? 'Cancelada' : selectedCita.estado.replace('_', ' ')}
                                    </span>
                                    {selectedCita.esTeleconsulta && (
                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border bg-indigo-50 text-indigo-600 border-indigo-200">
                                            Teleconsulta
                                        </span>
                                    )}
                                    {selectedPacienteLoading && (
                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border bg-slate-100 text-slate-500 border-slate-200">
                                            Cargando ficha
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-start gap-4">
                                    <AvatarPaciente
                                        sexo={detallePacienteActivo?.sexo || ''}
                                        fechaNacimiento={detallePacienteActivo?.fechaNacimiento || ''}
                                        size="xl"
                                        className="hidden sm:flex shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <h2 className="text-2xl md:text-[2rem] font-black text-slate-800 font-jakarta leading-tight pr-8 uppercase">
                                            {detallePacienteActivo?.nombre || selectedCita.paciente}
                                        </h2>
                                        <p className="text-xs md:text-sm font-semibold text-slate-400 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 uppercase tracking-[0.2em]">
                                            <span>{selectedCita.motivo || 'Consulta general'}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 inline-block" />
                                            <span>{selectedCita.hora || 'Sin hora'}</span>
                                            {selectedCita.doctorAsignado && <>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 inline-block" />
                                                <span>Dr. {selectedCita.doctorAsignado}</span>
                                            </>}
                                        </p>
                                        {detallePacienteActivo?.idPaciente && (
                                            <p className="text-[11px] font-semibold text-slate-500 mt-2">
                                                Expediente: <span className="text-slate-700">{detallePacienteActivo.idPaciente}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 lg:w-[360px]">
                                {[
                                    { label: 'Edad', value: detallePacienteActivo?.edad !== null && detallePacienteActivo?.edad !== undefined ? `${detallePacienteActivo.edad} años` : 'Sin registro' },
                                    { label: 'Nacimiento', value: detallePacienteActivo?.fechaNacimiento ? formatDateLabel(detallePacienteActivo.fechaNacimiento, { day: '2-digit', month: 'short', year: '2-digit' }) : 'Sin registro' },
                                    { label: 'Sexo', value: detallePacienteActivo?.sexo || 'Sin registro' },
                                    { label: 'Sangre', value: detallePacienteActivo?.grupoSanguineo || 'Sin registro' }
                                ].map((item) => (
                                    <div key={item.label} className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-sm px-4 py-3 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                                        <p className="text-sm md:text-base font-black text-slate-800 mt-1 leading-tight">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            {selectedCita.pacienteId && (
                                <button
                                    onClick={async () => {
                                        if (selectedPacienteDetalle?.id) {
                                            setPacienteAEditar(selectedPacienteDetalle);
                                            setShowPacienteModal(true);
                                            return;
                                        }
                                        try {
                                            const snap = await getDoc(doc(db, 'pacientes', selectedCita.pacienteId));
                                            if (snap.exists()) { setPacienteAEditar({ id: snap.id, ...snap.data() }); setShowPacienteModal(true); }
                                        } catch (e) { console.error('Error cargando paciente', e); }
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 transition-all active:scale-95"
                                >
                                    <Edit3 size={12}/> Editar Paciente
                                </button>
                            )}
                            {selectedCita.esTeleconsulta && selectedCita.meetLink && (
                                <button onClick={() => window.open(selectedCita.meetLink, '_blank')}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all">
                                    <Video size={12}/> Meet
                                </button>
                            )}
                            {selectedCita.esCitaEnfermeria && (
                                <button
                                    onClick={() => window.open(`/enfermeria/orden-servicio?citaId=${selectedCita.id}`, '_blank')}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all active:scale-95"
                                >
                                    <ClipboardList size={12} /> Abrir Orden Enfermería
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ─── Scrollable Body ─── */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Ficha útil para enfermería</p>
                                    </div>
                                    <div className="grid gap-3 p-4 md:grid-cols-2">
                                        <QuickInfoCard
                                            icon={<Phone size={16} />}
                                            label="Contacto principal"
                                            value={detallePacienteActivo?.telefonoPrincipal || 'Sin teléfono móvil'}
                                            helper={detallePacienteActivo?.telefonoSecundario ? `Fijo: ${detallePacienteActivo.telefonoSecundario}` : detallePacienteActivo?.email || 'Sin correo registrado'}
                                            tone="emerald"
                                        />
                                        <QuickInfoCard
                                            icon={<Building size={16} />}
                                            label="Cobertura"
                                            value={detallePacienteActivo?.derechohabiente || 'Sin derechohabiencia'}
                                            helper={detallePacienteActivo?.aseguradora || 'Sin aseguradora registrada'}
                                            tone="amber"
                                        />
                                        <QuickInfoCard
                                            icon={<MapPin size={16} />}
                                            label="Ubicación"
                                            value={detallePacienteActivo?.direccion || 'Sin domicilio registrado'}
                                            helper={selectedCita.sucursal || user?.sucursal || 'Sin sucursal asignada'}
                                            tone="blue"
                                        />
                                        <QuickInfoCard
                                            icon={<ClipboardList size={16} />}
                                            label="Atención actual"
                                            value={selectedCita.tipoConsulta || 'Consulta general'}
                                            helper={selectedCita.esTeleconsulta ? 'Modalidad virtual' : 'Modalidad presencial'}
                                            tone="violet"
                                        />
                                    </div>
                                </div>

                                {/* TRIAGE PENDIENTE */}
                                {!selectedCita.signos_vitales && selectedCita.estado !== 'completada' && selectedCita.estado !== 'cancelada' && (
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200/60">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-100">
                                                <AlertCircle size={20}/>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-amber-800 text-sm">Triage Pendiente</h4>
                                                <p className="text-[11px] text-amber-600/80">Toma de signos vitales requerida antes de consulta</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente } })}
                                            className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.97]"
                                        >
                                            Iniciar Triage
                                        </button>
                                    </div>
                                )}

                                {/* TRIAGE COMPLETADO */}
                                {selectedCita.signos_vitales && (
                                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={15} className="text-blue-500"/>
                                                <span className="text-[11px] font-bold text-blue-700">Signos Vitales</span>
                                            </div>
                                            <button 
                                                onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente, editMode: true } })}
                                                className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-blue-100/50 transition-all"
                                            >
                                                <Edit3 size={10}/> Editar
                                            </button>
                                        </div>
                                        {selectedCita.signos_vitales && (
                                            <div className="grid grid-cols-4 divide-x divide-slate-100">
                                                {[
                                                    { l: 'Peso', v: selectedCita.signos_vitales.peso, u: 'kg' },
                                                    { l: 'Talla', v: selectedCita.signos_vitales.talla, u: 'm' },
                                                    { l: 'Temp', v: selectedCita.signos_vitales.temp, u: '°C' },
                                                    { l: 'T/A', v: selectedCita.signos_vitales.ta, u: '' },
                                                ].map((s, i) => (
                                                    <div key={i} className="py-2.5 px-2 text-center">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{s.l}</p>
                                                        <p className="text-sm font-black text-slate-800 leading-tight mt-0.5">{s.v || '--'}</p>
                                                        {s.u && <p className="text-[8px] text-slate-400 mt-0.5">{s.u}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {selectedCita.signos_vitales && (
                                            <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
                                                {[
                                                    { l: 'F.C.', v: selectedCita.signos_vitales.fc, u: 'lpm' },
                                                    { l: 'F.R.', v: selectedCita.signos_vitales.fr, u: 'rpm' },
                                                    { l: 'SpO2', v: selectedCita.signos_vitales.spo2, u: '%' },
                                                    { l: 'IMC', v: selectedCita.signos_vitales.imc, u: '' },
                                                ].map((s, i) => (
                                                    <div key={i} className="py-2.5 px-2 text-center">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{s.l}</p>
                                                        <p className="text-sm font-black text-slate-800 leading-tight mt-0.5">{s.v || '--'}</p>
                                                        {s.u && <p className="text-[8px] text-slate-400 mt-0.5">{s.u}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {(selectedCita.triage_alergias || (selectedCita.triage_enfermedades && !selectedCita.triage_enfermedades.preguntados_y_negados && (selectedCita.triage_enfermedades.lista?.length > 0 || selectedCita.triage_enfermedades.otros))) && (
                                            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-1.5">
                                                {selectedCita.triage_alergias && (
                                                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold">
                                                        <AlertCircle size={10}/> {selectedCita.triage_alergias}
                                                    </span>
                                                )}
                                                {selectedCita.triage_enfermedades && !selectedCita.triage_enfermedades.preguntados_y_negados && (selectedCita.triage_enfermedades.lista?.length > 0 || selectedCita.triage_enfermedades.otros) && (
                                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold">
                                                        {[...(selectedCita.triage_enfermedades.lista || []), ...(selectedCita.triage_enfermedades.otros ? [selectedCita.triage_enfermedades.otros] : [])].join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-rose-50/70 to-white">
                                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Alertas y antecedentes</p>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Alertas clínicas</p>
                                            {detallePacienteActivo?.alertasClinicas?.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {detallePacienteActivo.alertasClinicas.map((item) => (
                                                        <span key={item} className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                                            <AlertCircle size={12} /> {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">Sin alertas clínicas registradas en esta cita.</p>
                                            )}
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2">
                                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Padecimientos base</p>
                                                {detallePacienteActivo?.padecimientosBase?.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {detallePacienteActivo.padecimientosBase.map((item) => (
                                                            <span key={item} className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-700">{item}</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500">Sin padecimientos base capturados.</p>
                                                )}
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Notas del paciente</p>
                                                <p className="text-xs text-slate-600 leading-relaxed">{detallePacienteActivo?.notas || 'Sin notas personales registradas.'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CANCELADA */}
                                {selectedCita.estado === 'cancelada' && (
                                    <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm border border-red-100"><Ban size={18}/></div>
                                        <div>
                                            <p className="text-sm font-bold text-red-700">Cita Cancelada</p>
                                            {selectedCita.canceladaMotivo && <p className="text-xs text-red-500 mt-0.5">{selectedCita.canceladaMotivo}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Resumen operativo</p>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <DetailRow label="Doctor asignado" value={selectedCita.doctorAsignado ? `Dr. ${selectedCita.doctorAsignado}` : 'Sin asignar'} />
                                        <DetailRow label="Sucursal" value={selectedCita.sucursal || user?.sucursal || 'Sin sucursal'} />
                                        <DetailRow label="Consultorio" value={selectedCita.consultorio || 'Sin consultorio'} />
                                        <DetailRow label="Llegada" value={selectedCita.llegadaRegistrada ? 'Confirmada' : 'Pendiente'} statusTone={selectedCita.llegadaRegistrada ? 'success' : 'warning'} />
                                        <DetailRow label="Recordatorio" value={selectedCita.recordatorioEnviado ? 'Enviado' : 'Pendiente'} statusTone={selectedCita.recordatorioEnviado ? 'success' : 'neutral'} />
                                        <DetailRow label="Modalidad" value={selectedCita.esTeleconsulta ? 'Teleconsulta' : 'Presencial'} />
                                    </div>
                                </div>

                                {/* ─── ACCIONES ─── */}
                                {selectedCita.estado !== 'cancelada' && (
                                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones rápidas</p>
                                        </div>
                                        <div className="p-4">
                                            <div className="grid grid-cols-2 gap-2.5">
                                        {/* Registrar Llegada */}
                                        <button
                                            onClick={handleRegistrarLlegada}
                                            disabled={selectedCita.llegadaRegistrada || actionLoading === 'llegada'}
                                            className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all active:scale-[0.96] text-center ${
                                                selectedCita.llegadaRegistrada 
                                                    ? 'bg-emerald-50 border-emerald-200' 
                                                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100'
                                            }`}
                                        >
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${selectedCita.llegadaRegistrada ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600'} transition-colors`}>
                                                {actionLoading === 'llegada' ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : <LogIn size={20}/>}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${selectedCita.llegadaRegistrada ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                    {selectedCita.llegadaRegistrada ? 'Llegada ✓' : 'Registrar Llegada'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{selectedCita.llegadaRegistrada ? 'Paciente presente' : 'Confirmar presencia'}</p>
                                            </div>
                                        </button>

                                        {/* Recordatorio WhatsApp */}
                                        <button
                                            onClick={handleEnviarRecordatorio}
                                            disabled={selectedCita.recordatorioEnviado || actionLoading === 'whatsapp'}
                                            className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all active:scale-[0.96] text-center ${
                                                selectedCita.recordatorioEnviado 
                                                    ? 'bg-green-50 border-green-200' 
                                                    : 'bg-white border-slate-200 hover:border-green-300 hover:shadow-md hover:shadow-green-100'
                                            }`}
                                        >
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${selectedCita.recordatorioEnviado ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500 group-hover:bg-green-50 group-hover:text-green-600'} transition-colors`}>
                                                {actionLoading === 'whatsapp' ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> : <MessageSquare size={20}/>}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${selectedCita.recordatorioEnviado ? 'text-green-700' : 'text-slate-700'}`}>
                                                    {selectedCita.recordatorioEnviado ? 'Enviado ✓' : 'Recordatorio'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{selectedCita.recordatorioEnviado ? 'Ya notificado' : 'Enviar WhatsApp'}</p>
                                            </div>
                                        </button>

                                        {/* Reprogramar */}
                                        <button
                                            onClick={() => {
                                                setReprogramarData({
                                                    fecha: selectedCita.fecha || toInputDateValue(new Date()),
                                                    hora: selectedCita.hora || '',
                                                    horaFin: selectedCita.horaFin || ''
                                                });
                                                setShowReprogramar(true);
                                            }}
                                            className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100 transition-all active:scale-[0.96] text-center"
                                        >
                                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><CalendarClock size={20}/></div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">Reprogramar</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Cambiar fecha/hora</p>
                                            </div>
                                        </button>

                                        {/* Editar Antecedentes */}
                                        {selectedCita.pacienteId && (
                                            <button
                                                onClick={handleEditarAntecedentes}
                                                className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-100 transition-all active:scale-[0.96] text-center"
                                            >
                                                <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><FileText size={20}/></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">Antecedentes</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Editar historial</p>
                                                </div>
                                            </button>
                                        )}

                                        {/* Generar Documentos */}
                                        {selectedCita.pacienteId && (
                                            <button
                                                onClick={handleGenerarDocumento}
                                                className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-200 bg-white hover:border-orange-300 hover:shadow-md hover:shadow-orange-100 transition-all active:scale-[0.96] text-center"
                                            >
                                                <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors"><ClipboardList size={20}/></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">Documentos</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Generar plantilla</p>
                                                </div>
                                            </button>
                                        )}

                                        {/* Reasignar Doctor */}
                                        <button
                                            onClick={() => {
                                                setReasignarData({ doctorUid: '', doctorNombre: '', justificacion: '' });
                                                setShowReasignar(true);
                                            }}
                                            className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md hover:shadow-amber-100 transition-all active:scale-[0.96] text-center"
                                        >
                                            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors"><ArrowLeftRight size={20}/></div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">Reasignar</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Cambiar doctor</p>
                                            </div>
                                        </button>

                                        {/* Unificar Expedientes */}
                                        {selectedCita.pacienteId && (
                                            <button
                                                onClick={() => setShowUnificar(true)}
                                                className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-md hover:shadow-violet-100 transition-all active:scale-[0.96] text-center"
                                            >
                                                <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-violet-50 group-hover:text-violet-600 transition-colors"><GitMerge size={20}/></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">Unificar</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Fusionar duplicados</p>
                                                </div>
                                            </button>
                                        )}
                                            </div>

                                            <button
                                                onClick={() => setShowCancelarConfirm(true)}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all mt-3"
                                            >
                                                <XCircle size={14}/>
                                                <span className="text-[11px] font-semibold">Cancelar esta cita</span>
                                            </button>
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
                                {doctores.filter(d => d.id !== selectedCita.doctorUid).map(d => (
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
                                                Dr. {d.nombre}
                                            </p>
                                            {d.especialidad && <p className="text-[10px] text-slate-400">{d.especialidad}</p>}
                                        </div>
                                        {reasignarData.doctorUid === d.id && <CheckCircle size={16} className="ml-auto text-amber-500"/>}
                                    </button>
                                ))}
                                {doctores.filter(d => d.id !== selectedCita.doctorUid).length === 0 && (
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

        {showUnificar && selectedCita?.pacienteId && (
            <ModalUnificarExpedientes
                pacienteId={selectedCita.pacienteId}
                pacienteNombre={selectedCita.paciente}
                onClose={() => setShowUnificar(false)}
                showToast={showToast}
            />
        )}
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
const MetricCard = ({ label, value, icon, color, bg, onClick, active }) => (
    <div 
        onClick={onClick}
        className={`px-2 sm:px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 sm:gap-3 flex-1 min-w-0 group ${active ? 'border-slate-800 shadow-sm ring-1 ring-slate-800 bg-white' : 'border-slate-200/60 bg-white/60 hover:bg-white hover:border-slate-300 shadow-sm'}`}
    >
        <div className="flex flex-col justify-center min-w-0">
            <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">{label}</p>
            <p className="text-base sm:text-lg font-black text-slate-800 font-jakarta leading-none">{value}</p>
        </div>
        <div className={`w-6 h-6 sm:w-7 sm:h-7 ml-auto rounded-lg flex items-center justify-center shrink-0 ${bg} ${color} group-hover:scale-110 transition-transform shadow-sm`}>
            {icon}
        </div>
    </div>
);

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
        <div className="flex items-center justify-between gap-3 border border-slate-100 bg-slate-50/70 rounded-xl px-3 py-2.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${toneStyles[statusTone] || toneStyles.neutral}`}>{value}</span>
        </div>
    );
};

const CardCita = ({ cita, onClick, navigate }) => {
    const ahora = new Date();
    const horaCita = cita.fechaHora || '';
    const citaDate = horaCita ? new Date(horaCita) : null;
    const minutosEspera = citaDate ? Math.max(0, Math.round((ahora - citaDate) / 60000)) : 0;
    const esRetrasada = minutosEspera > 15;
    const estadoLabel = cita.estado === 'pendiente' || cita.estado === 'en_espera' ? 'Pendiente' : cita.estado === 'en_consulta' ? 'En Consulta' : 'Finalizada';
    const estadoColor = cita.estado === 'en_consulta'
        ? 'bg-blue-50 text-blue-600 border-blue-100'
        : cita.estado === 'completada'
        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
        : esRetrasada ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100';
    const pulseColor = cita.estado === 'en_consulta' ? 'bg-blue-500' : cita.estado === 'completada' ? 'bg-emerald-500' : esRetrasada ? 'bg-red-500' : 'bg-orange-500';

    return (
        <div 
            onClick={() => onClick(cita)}
            className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <span className={`${estadoColor} border px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm`}>
                        <div className={`w-2 h-2 rounded-full ${pulseColor} ${cita.estado !== 'completada' ? 'animate-pulse' : ''}`}></div>
                        {estadoLabel}
                    </span>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">{cita.hora}</span>
                </div>
                {cita.esTeleconsulta && <div className="p-2 bg-indigo-50 rounded-xl"><Video size={16} className="text-indigo-600"/></div>}
            </div>
            <h3 className="font-black text-slate-800 text-xl mb-2 font-jakarta truncate">{cita.paciente}</h3>
            {(cita.estado === 'pendiente' || cita.estado === 'en_espera') && minutosEspera > 0 && (
                <p className={`text-xs font-bold mt-1 ${esRetrasada ? 'text-red-500' : 'text-slate-400'}`}>
                    ⏱ {minutosEspera} min esperando
                </p>
            )}
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center text-sm font-bold border border-slate-200 shadow-sm">
                    {cita.doctorAsignado?.charAt(0) || 'D'}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm text-slate-700 font-bold">Dr. {cita.doctorAsignado?.split(' ')[0]}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{cita.consultorio || 'General'}</span>
                </div>
            </div>
        </div>
    );
};

export default AgendaEnfermeria;