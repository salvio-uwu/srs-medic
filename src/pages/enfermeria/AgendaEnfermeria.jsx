import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalIcon, Clock, User, Plus, ChevronLeft, ChevronRight, 
  Search, X, Activity, Stethoscope, ChevronDown, CheckCircle, 
  AlertCircle, Zap, Video, MapPin, Building, AlertTriangle, CheckCircle2,
  Phone, ClipboardList, Edit3
} from 'lucide-react';
import { db, functions } from '../../config/firebase'; 
import { collection, addDoc, query, where, orderBy, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ModalPaciente from '../../components/ModalPaciente';
import RegistrosEnfermeriaModal from '../../components/RegistrosEnfermeriaModal'; 

const AgendaEnfermeria = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef(null); 
  
    // --- CONFIGURACIÓN ---
    const INTERVALO_MINUTOS = 10; 

  // --- ESTADOS ---
  const [citas, setCitas] = useState([]);
  const [doctores, setDoctores] = useState([]); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showRegistrosModal, setShowRegistrosModal] = useState(false);
  const [viewFilter, setViewFilter] = useState('timeline'); 
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [showSelectorDoctor, setShowSelectorDoctor] = useState(false); 
  const [selectedCita, setSelectedCita] = useState(null);

  const [todosLosPacientes, setTodosLosPacientes] = useState([]); 
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  
    const [consultorios, setConsultorios] = useState([]);
    const [catalogoMotivos, setCatalogoMotivos] = useState([]);
    const [catalogoSucursales, setCatalogoSucursales] = useState([]);
  const [selectedConsultorio, setSelectedConsultorio] = useState('Todos');

  const [nuevaCita, setNuevaCita] = useState({
    paciente: '', pacienteId: '', pacienteTelefono: '', 
    fecha: new Date().toLocaleDateString('en-CA'), 
        hora: '', horaFin: '', motivo: '', motivoId: '', doctorAsignado: '', doctorUid: '',
        esTeleconsulta: false, consultorio: '', consultorioId: '', sucursal: '', sucursalId: '',
        tipoConsulta: 'Primera vez'
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

        const isPast = startTotalMinutes < currentMinutes - INTERVALO_MINUTOS;
        const isCurrent = currentMinutes >= startTotalMinutes && currentMinutes < endTotalMinutes;

        slots.push({ 
            startTime, endTime, value: `${startTime} - ${endTime}`, 
            startMinutes: startTotalMinutes, endMinutes: endTotalMinutes,
            isPast, isCurrent 
        });
      }
    }
    return slots;
  }, [currentTime]);

  // --- EFECTOS ---
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  // AUTO SCROLL INTELIGENTE AL HORARIO ACTUAL
  useEffect(() => {
    if(scrollRef.current && viewFilter === 'timeline') {
            scrollRef.current.scrollIntoView({ behavior: modoLigero ? 'auto' : 'smooth', block: 'center' });
    }
    }, [timeSlots, viewFilter, modoLigero]);

    useEffect(() => {
        const dateStr = currentDate.toLocaleDateString('en-CA');
        const startOfDay = `${dateStr}T00:00`;
        const endOfDay = `${dateStr}T23:59`;

        const q = query(
            collection(db, "citas"), 
            where("fechaHora", ">=", startOfDay), where("fechaHora", "<=", endOfDay), orderBy("fechaHora", "asc")
        );

        let isMounted = true;
        const loadCitas = async () => {
            try {
                const snapshot = await getDocs(q);
                if (!isMounted) return;
                setCitas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
            } catch {}
        };

        loadCitas();
        const intervalId = setInterval(loadCitas, 120000);
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [currentDate]);

    useEffect(() => {
        let isMounted = true;
        const loadDoctores = async () => {
            try {
                const qDocs = query(collection(db, "users"), where("rol", "==", "medico"));
                const snap = await getDocs(qDocs);
                if (!isMounted) return;
                setDoctores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            } catch {}
        };

        loadDoctores();
        const intervalId = setInterval(loadDoctores, 300000);
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        const CACHE_KEY = 'agenda_enfermeria_catalogos_v1';
        const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
        let isMounted = true;

        const loadCatalogos = async () => {
            try {
                const cachedRaw = sessionStorage.getItem(CACHE_KEY);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (Date.now() - Number(cached?.savedAt || 0) < CACHE_TTL_MS) {
                        if (!isMounted) return;
                        setCatalogoMotivos(cached.motivos || []);
                        setConsultorios(cached.consultorios || []);
                        setCatalogoSucursales(cached.sucursales || []);
                        return;
                    }
                }
            } catch {}

            try {
                const qMotivos = query(collection(db, "catalogo_motivos_consulta"), orderBy("nombre", "asc"));
                const qConsultorios = query(collection(db, "catalogo_consultorios"), orderBy("nombre", "asc"));
                const qSucursales = query(collection(db, "catalogo_sucursales"), orderBy("nombre", "asc"));

                const [motivosSnap, consultoriosSnap, sucursalesSnap] = await Promise.all([
                    getDocs(qMotivos),
                    getDocs(qConsultorios),
                    getDocs(qSucursales)
                ]);
                if (!isMounted) return;

                const payload = {
                    savedAt: Date.now(),
                    motivos: motivosSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).filter((item) => item.activo !== false),
                    consultorios: consultoriosSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).filter((item) => item.activo !== false),
                    sucursales: sucursalesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).filter((item) => item.activo !== false)
                };

                setCatalogoMotivos(payload.motivos);
                setConsultorios(payload.consultorios);
                setCatalogoSucursales(payload.sucursales);
                sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
            } catch {}
        };

        loadCatalogos();
        return () => {
            isMounted = false;
        };
    }, []);

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
            return { id: '', nombre: user?.sucursal || 'Sin sucursal configurada' };
        }

        const sucursalUsuario = catalogoSucursales.find(
            (sucursal) =>
                (sucursal.nombre || '').trim().toLowerCase() === (user?.sucursal || '').trim().toLowerCase()
        );

        return sucursalUsuario || catalogoSucursales[0];
    }, [catalogoSucursales, user?.sucursal]);

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
        () => citasFiltradasConsultorio.filter((cita) => cita.estado === 'pendiente'),
        [citasFiltradasConsultorio]
    );

  // --- HELPERS ---
  const getDoctorStatus = (docData) => {
    if (!docData.isOnline) return { color: 'bg-slate-300', text: 'Fuera de Línea' };
    if (docData.statusOperativo === 'ocupado') return { color: 'bg-rose-500', text: 'Ocupado' };
    if (docData.statusOperativo === 'comida') return { color: 'bg-amber-500', text: 'Comida' };
    return { color: 'bg-emerald-500', text: 'Disponible' };
  };

  const cambiarDia = (dias) => {
    const nueva = new Date(currentDate);
    nueva.setDate(nueva.getDate() + dias);
    setCurrentDate(nueva);
  };

  const handlePacienteCreado = (nuevoPaciente) => {
    const p = { id: nuevoPaciente.id, nombre: nuevoPaciente.nombreCompleto, telefono: nuevoPaciente.telefonoMovil };
    setTodosLosPacientes(prev => [...prev, p]);
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
        fecha: currentDate.toLocaleDateString('en-CA'), 
        hora: slot.startTime, 
                horaFin: slot.endTime || sumarMinutos(slot.startTime, INTERVALO_MINUTOS),
                consultorio: consultorioNombre,
                consultorioId: consultorioData?.id || '',
                motivo: motivoData?.nombre || '',
                motivoId: motivoData?.id || '',
                sucursal: sucursalData?.nombre || user?.sucursal || '',
                sucursalId: sucursalData?.id || ''
    });
    setShowCitaModal(true);
    setConfirmModal({ show: false, slot: null });
  };

const handleGuardarCita = async (e) => {
    e?.preventDefault(); 
    if(!nuevaCita.paciente || !nuevaCita.hora || !nuevaCita.horaFin || !nuevaCita.doctorUid || !nuevaCita.consultorio || !nuevaCita.motivo) {
        showToast("Faltan campos obligatorios (Paciente, horario, motivo, consultorio o médico).", "error");
        return;
    }
    try {
        let meetLink = '';
        if (nuevaCita.esTeleconsulta) {
          const roomId = `srs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          meetLink = `https://meet.jit.si/${roomId}`;
        }

        const motivoData = catalogoMotivos.find((m) => m.id === nuevaCita.motivoId) || catalogoMotivos.find((m) => m.nombre === nuevaCita.motivo);
        const consultorioData = consultorios.find((c) => c.id === nuevaCita.consultorioId) || consultorios.find((c) => c.nombre === nuevaCita.consultorio);
        const sucursalData = catalogoSucursales.find((s) => s.id === nuevaCita.sucursalId) || catalogoSucursales.find((s) => s.nombre === nuevaCita.sucursal);

        const payload = {
          ...nuevaCita,
          motivo: motivoData?.nombre || nuevaCita.motivo,
          motivoId: motivoData?.id || nuevaCita.motivoId || '',
          motivoPrecio: Number(motivoData?.precio || 0),
          areaConsulta: motivoData?.area || '',
          consultorio: consultorioData?.nombre || nuevaCita.consultorio,
          consultorioId: consultorioData?.id || nuevaCita.consultorioId || '',
          sucursal: sucursalData?.nombre || nuevaCita.sucursal || sucursalPredeterminada?.nombre || user?.sucursal || '',
          sucursalId: sucursalData?.id || nuevaCita.sucursalId || '',
          meetLink,
          fechaHora: `${nuevaCita.fecha}T${nuevaCita.hora}`,
          fechaHoraFin: `${nuevaCita.fecha}T${nuevaCita.horaFin}`,
          estado: 'pendiente',
          creadoPor: user.uid,
          creadoPorRol: 'enfermeria'
        };

                const citaRef = await addDoc(collection(db, "citas"), payload);

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

        setShowCitaModal(false);
        setNuevaCita({ 
          ...nuevaCita,
          paciente: '',
          pacienteId: '',
          pacienteTelefono: '',
          hora: '',
          horaFin: '',
          esTeleconsulta: false
        });
    } catch (e) { 
        console.error(e); 
        showToast("Error al guardar la cita en el servidor", "error"); 
    }
  };

    const metrics = useMemo(() => ({
        espera: citas.filter(c => c.estado === 'pendiente' || c.estado === 'en_espera').length,
        consulta: citas.filter(c => c.estado === 'en_consulta').length,
        fin: citas.filter(c => c.estado === 'completada').length
    }), [citas]);

  const doctoresFiltrados = useMemo(() => {
      if (selectedConsultorio === 'Todos') return doctores;
      return doctores.filter(doc => doc.consultorio === selectedConsultorio || !doc.consultorio);
  }, [doctores, selectedConsultorio]);

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
                    padding: 12px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    border-bottom: 1px solid #e2e8f0;
                    background: #ffffff;
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

        <div className={`h-screen flex flex-col relative overflow-hidden text-slate-700 app-shell ${modoLigero ? 'modo-ligero' : ''}`}>

{/* 1. HEADER GLASSMORPHISM */}
                <div className="app-header-lite px-6 py-3 flex justify-between items-center z-30 shrink-0 mx-6 mt-3 rounded-2xl mb-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <Activity size={20}/>
            </div>
            <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-none sora tracking-tight">Enfermería</h1>
              <div className="flex items-center gap-2 mt-1">
                                <span className="badge-branch-lite">
                    <MapPin size={10}/> {sucursalPredeterminada?.nombre || 'Sin sucursal configurada'}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="status-online-lite">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> En Linea
                </span>
              </div>
            </div>
          </div>

          {/* Selector de Fecha Inteligente */}
          <div className="bg-white/80 border border-slate-200 p-1 rounded-xl flex items-center shadow-sm">
            <button onClick={()=>cambiarDia(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all hover:shadow-sm"><ChevronLeft size={18}/></button>
            
            <div className="relative flex items-center justify-center px-4 cursor-pointer group">
                <input 
                    type="date" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 date-picker-overlay"
                    value={currentDate.toLocaleDateString('en-CA')}
                    onChange={(e) => {
                            if(e.target.value) setCurrentDate(new Date(e.target.value + 'T12:00:00'));
                        }}
                    />
                    <div className="flex flex-col items-center group-hover:text-blue-600 transition-colors">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <CalIcon size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <span className="text-sm font-bold text-slate-800 capitalize font-jakarta group-hover:text-blue-700 transition-colors">
                            {currentDate.toLocaleDateString('es-MX', { weekday: 'long' })}
                        </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                        {currentDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                    </span>
                </div>
            </div>
<button onClick={()=>cambiarDia(1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all hover:shadow-sm"><ChevronRight size={18}/></button>
          </div>

          <div className="flex gap-3">
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
            
            {/* BOTÓN EXISTENTE: NUEVA CITA */}
                        <button onClick={() => {
                                const consultorioNombre = selectedConsultorio !== 'Todos' ? selectedConsultorio : (consultoriosNombres[0] || '');
                                const consultorioData = consultorios.find((c) => c.nombre === consultorioNombre);
                                const motivoData = catalogoMotivos[0] || null;
                                const sucursalData = sucursalPredeterminada || null;
                                setNuevaCita({
                                    ...nuevaCita,
                                    fecha: currentDate.toLocaleDateString('en-CA'),
                                    hora: '',
                                    horaFin: '',
                                    consultorio: consultorioNombre,
                                    consultorioId: consultorioData?.id || '',
                                    motivo: motivoData?.nombre || '',
                                    motivoId: motivoData?.id || '',
                                    sucursal: sucursalData?.nombre || user?.sucursal || '',
                                    sucursalId: sucursalData?.id || ''
                                });
                                setShowCitaModal(true);
                            }} 
                className="btn-main font-jakarta rounded-xl px-4 py-2 flex items-center gap-2 text-xs shadow-md">
              <Plus size={16} strokeWidth={2.5} /> Nueva Cita
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-6 z-10 relative">
          
          {/* --- COLUMNA IZQUIERDA: AGENDA --- */}
          <div className="flex-1 flex flex-col relative overflow-hidden glass-panel rounded-3xl">
              
             {/* HUD DE MÉTRICAS & SELECTOR DE CONSULTORIO */}
              <div className="px-6 py-2 border-b border-slate-200/50 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0 bg-white/40">
                  <div className="flex gap-2 w-full md:w-auto">
                      <MetricCard label="En Espera" value={metrics.espera} icon={<Clock size={14}/>} color="text-orange-600" bg="bg-orange-50" onClick={()=>setViewFilter('pendientes')} active={viewFilter==='pendientes'} />
                      <MetricCard label="En Consulta" value={metrics.consulta} icon={<Stethoscope size={14}/>} color="text-blue-600" bg="bg-blue-50" />
                      <MetricCard label="Finalizados" value={metrics.fin} icon={<CheckCircle size={14}/>} color="text-emerald-600" bg="bg-emerald-50" />
                  </div>

                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors shrink-0">
                      <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600"><Building size={14}/></div>
                      <div className="relative">
                          <select 
                            value={selectedConsultorio} onChange={(e) => setSelectedConsultorio(e.target.value)}
                            className="bg-transparent border-none outline-none font-bold text-[11px] text-slate-800 pr-6 cursor-pointer font-jakarta appearance-none"
                          >
                             <option value="Todos">Todos los Consultorios</option>
                                      {consultoriosNombres.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-1 top-0.5 text-slate-400 pointer-events-none"/>
                      </div>
                  </div>
              </div>

              {/* FILTROS */}
              <div className="timeline-toolbar">
                  <h2 className="text-base font-bold text-slate-900 sora">Consultas del día</h2>
                  <div className="flex items-center gap-2">
                      <button onClick={()=>setViewFilter('timeline')} className={`timeline-chip-lite ${viewFilter==='timeline' ? 'active' : ''}`}>
                          <Clock size={11}/> Ahora
                      </button>
                      <button onClick={()=>setViewFilter('pendientes')} className={`timeline-chip-lite ${viewFilter==='pendientes' ? 'active' : ''}`}>
                          <AlertTriangle size={11}/> Pendientes
                      </button>
                  </div>
              </div>

              {/* TIMELINE ESTILO RANGOS (14:00 - 14:10) */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-10 pt-8 custom-scrollbar bg-slate-50/40">
                  {viewFilter === 'timeline' ? (
                      <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                          <div className="flex bg-slate-50/80 border-b border-slate-200 py-3 text-xs font-black text-slate-400 uppercase tracking-widest px-4">
                              <div className="w-40 text-center border-r border-slate-200">Rango Horario</div>
                              <div className="flex-1 pl-8">Paciente y Detalles</div>
                              <div className="w-72 text-left pl-8 border-l border-slate-200">Asignación</div>
                          </div>

                          {timeSlots.map((slot, index) => {
                              const citasEnSlot = citasPorSlot.get(slot.startTime) || [];

                              return (
                                  <div 
                                      key={slot.value} 
                                      ref={slot.isCurrent ? scrollRef : null}
                                      className={`flex min-h-[80px] group border-b border-slate-100 last:border-0 relative transition-colors ${
                                          slot.isCurrent ? 'bg-blue-50/40 shadow-inner' : slot.isPast ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/50'
                                      }`}
                                  >
                                      {/* Línea Activa */}
                                      {slot.isCurrent && <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 z-20 rounded-r-md ${modoLigero ? '' : 'animate-pulse'}`}></div>}

                                      <div className={`w-40 flex flex-col items-center justify-center border-r border-slate-100 shrink-0 ${slot.isPast ? 'text-slate-400' : 'text-slate-600'} ${slot.isCurrent ? 'text-blue-700 bg-blue-100/30' : ''}`}>
                                          <span className={`font-bold font-mono tracking-tight ${slot.isCurrent ? 'text-base' : 'text-sm'}`}>{slot.value}</span>
                                      </div>
                                      
                                      <div className="flex-1 p-3 relative flex flex-col justify-center">
                                          {citasEnSlot.length === 0 && (
                                              <button 
                                                  onClick={() => iniciarAgendado(slot)}
                                                  className={`absolute left-8 opacity-0 group-hover:opacity-100 px-4 py-2.5 rounded-xl transition-all z-10 flex items-center gap-2 text-xs font-bold shadow-sm ${slot.isPast ? 'text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-md' : 'text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 hover:shadow-md'}`}
                                              >
                                                  <Plus size={16}/> {slot.isPast ? 'Registro Pasado' : 'Agendar Paciente'}
                                              </button>
                                          )}

                                          <div className="w-full space-y-2">
                                              {citasEnSlot.map(cita => (
                                                  <div key={cita.id} onClick={() => setSelectedCita(cita)} className="flex items-center justify-between p-4 bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-2xl transition-all cursor-pointer hover:border-blue-300 group/item">
                                                      <div className="flex items-center gap-4 overflow-hidden">
                                                          <div className={`w-3.5 h-3.5 rounded-full shrink-0 shadow-sm ${
                                                              cita.estado === 'pendiente' ? 'bg-orange-500 animate-pulse' : 
                                                              cita.estado === 'en_espera' ? 'bg-blue-500' : 'bg-emerald-500'
                                                          }`}></div>
                                                          <span className="text-base font-bold truncate text-slate-800 font-jakarta">{cita.paciente}</span>
                                                          <div className="flex items-center gap-2 pl-4 border-l border-slate-200 ml-2">
                                                              {cita.esTeleconsulta && <span className="flex items-center gap-1.5 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-bold uppercase tracking-wider"><Video size={12}/> Tele</span>}
                                                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold uppercase tracking-wider">{cita.motivo}</span>
                                                          </div>
                                                      </div>
                                                      <div className="flex items-center gap-3 shrink-0 w-64 justify-start border-l border-slate-100 pl-6">
                                                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 shadow-sm">
                                                              {cita.doctorAsignado?.charAt(0) || 'D'}
                                                          </div>
                                                          <div className="flex flex-col">
                                                              <span className="text-sm text-slate-700 font-bold truncate">Dr. {cita.doctorAsignado?.split(' ')[1] || cita.doctorAsignado || 'General'}</span>
                                                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{cita.consultorio || 'Sin Asignar'}</span>
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
                          {citasPendientesFiltradas.map(cita => (
                              <CardCita key={cita.id} cita={cita} onClick={setSelectedCita} navigate={navigate} />
                          ))}
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
                                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{doc.consultorio || 'Consulta Gral'}</p>
                                      <p className={`text-[10px] font-black uppercase mt-1 ${status.color.replace('bg-', 'text-')}`}>{status.text}</p>
                                  </div>
                              </div>
                          </div>
                      )
                  })}
                  {doctoresFiltrados.length === 0 && (
                      <div className="text-center p-8 text-slate-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-2xl mt-4">
                          No hay médicos en {selectedConsultorio}.
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
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                
                <div className="px-6 md:px-8 py-5 md:py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800 font-jakarta">Agendar Cita</h2>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{nuevaCita.hora || '--:--'} - {nuevaCita.horaFin || '--:--'} • {nuevaCita.fecha}</p>
                    </div>
                    <button onClick={() => setShowCitaModal(false)} className="p-2 md:p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full transition-all shadow-sm"><X size={18} className="md:w-5 md:h-5"/></button>
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
                                    <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-xl md:rounded-2xl mt-2 border border-slate-100 max-h-40 md:max-h-48 overflow-y-auto z-50 p-2">
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
                                                                        setNuevaCita({
                                                                            ...nuevaCita,
                                                                            consultorioId: e.target.value,
                                                                            consultorio: consultorioData?.nombre || ''
                                                                        });
                                                                    }}
                                                                >
                                    <option value="">Asignar Sala...</option>
                                                                        {consultorios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 md:right-4 top-3 md:top-4 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                        <div className="relative">
                            <label className={labelStyle}>Médico Responsable</label>
                            <div onClick={() => setShowSelectorDoctor(!showSelectorDoctor)} className={`${inputStyle} cursor-pointer flex justify-between items-center py-3 md:py-3.5`}>
                                <span className={nuevaCita.doctorAsignado ? "text-slate-800 font-bold text-xs md:text-sm" : "text-slate-400 text-xs md:text-sm"}>{nuevaCita.doctorAsignado || "Seleccionar Médico"}</span>
                                <ChevronDown size={16} className="text-slate-400"/>
                            </div>
                            {showSelectorDoctor && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl md:rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-48 md:max-h-56 overflow-y-auto custom-scrollbar p-2">
                                    {doctores.map(doc => {
                                        const st = getDoctorStatus(doc);
                                        return (
                                            <div key={doc.id} onClick={() => { setNuevaCita({...nuevaCita, doctorUid: doc.id, doctorAsignado: doc.nombre}); setShowSelectorDoctor(false); }} className="p-3 hover:bg-slate-50 rounded-lg md:rounded-xl cursor-pointer flex justify-between items-center transition-colors">
                                                <span className="text-xs md:text-sm font-bold text-slate-700">{doc.nombre}</span>
                                                <div className="flex items-center gap-2"><div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${st.color}`}></div></div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
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
                                                                setNuevaCita({
                                                                    ...nuevaCita,
                                                                    motivoId: e.target.value,
                                                                    motivo: motivoData?.nombre || ''
                                                                });
                                                            }}
                                                        >
                                                                <option value="">Seleccionar motivo...</option>
                                                                {catalogoMotivos.map(m => <option key={m.id} value={m.id}>{formatMotivoOption(m)}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 md:right-4 top-3 md:top-4 text-slate-400 pointer-events-none"/>
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

        {/* DRAWER DETALLE */}
        <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 z-50 border-l border-slate-100 ${selectedCita ? 'translate-x-0' : 'translate-x-full'}`}>
            {selectedCita && (
                <div className="h-full flex flex-col bg-slate-50/50 relative">
                    <div className="bg-white px-8 py-10 border-b border-slate-200">
                        <button onClick={() => setSelectedCita(null)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all border border-slate-200 shadow-sm"><X size={20}/></button>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                {selectedCita.consultorio || 'Sin Consultorio'}
                            </span>
                        </div>
                        
                        <h2 className="text-3xl font-black text-slate-800 font-jakarta leading-tight">{selectedCita.paciente}</h2>
                        <p className="text-sm font-bold text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-wider">
                            {selectedCita.motivo} <span className="w-1 h-1 rounded-full bg-slate-300"></span> {selectedCita.hora}
                        </p>
                        
                        {selectedCita.esTeleconsulta && selectedCita.meetLink && (
                            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm"><Video size={18}/></div>
                                    <span className="text-xs font-black text-indigo-800 uppercase tracking-widest">Sala Virtual Creada</span>
                                </div>
                                <button 
                                    onClick={() => window.open(selectedCita.meetLink, '_blank')}
                                    className="text-xs bg-indigo-600 px-5 py-2.5 rounded-xl font-bold text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                                >
                                    Ir a Meet
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Fase del Proceso</span>
                                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${
                                    selectedCita.estado === 'pendiente' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                    selectedCita.estado === 'en_espera' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                    'bg-emerald-50 text-emerald-600 border-emerald-200'
                                }`}>
                                    {selectedCita.estado.replace('_',' ')}
                                </span>
                            </div>
                            
                            {selectedCita.estado === 'pendiente' && (
                                <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-28 h-28 bg-orange-500 opacity-5 rounded-full -mr-8 -mt-8 blur-xl"></div>
                                    <div className="flex items-start gap-4 relative z-10">
                                        <div className="bg-white p-3 rounded-2xl text-orange-500 shadow-sm"><AlertCircle size={24}/></div>
                                        <div>
                                            <h4 className="font-black text-orange-800 text-base">Triage Pendiente</h4>
                                            <p className="text-sm text-orange-600 mt-1.5 font-medium leading-relaxed">
                                                Toma de signos vitales requerida antes de autorizar el paso a consultorio.
                                            </p>
                                            <button 
                                                onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente } })}
                                                className="mt-5 w-full py-3.5 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 uppercase tracking-widest"
                                            >
                                                Iniciar Triage
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCita.estado === 'en_espera' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 relative overflow-hidden">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="bg-white p-2 rounded-xl text-blue-500 shadow-sm"><CheckCircle2 size={20}/></div>
                                            <h4 className="font-black text-blue-800 text-sm">Triage Completado</h4>
                                        </div>
                                        {selectedCita.signos_vitales && (
                                            <div className="grid grid-cols-4 gap-2 mb-4">
                                                {[
                                                    { l: 'Peso', v: selectedCita.signos_vitales.peso, u: 'kg' },
                                                    { l: 'Talla', v: selectedCita.signos_vitales.talla, u: 'm' },
                                                    { l: 'Temp', v: selectedCita.signos_vitales.temp, u: '°C' },
                                                    { l: 'T/A', v: selectedCita.signos_vitales.ta, u: '' },
                                                    { l: 'F.C.', v: selectedCita.signos_vitales.fc, u: 'lpm' },
                                                    { l: 'F.R.', v: selectedCita.signos_vitales.fr, u: 'rpm' },
                                                    { l: 'SpO2', v: selectedCita.signos_vitales.spo2, u: '%' },
                                                    { l: 'IMC', v: selectedCita.signos_vitales.imc, u: '' },
                                                ].map((s, i) => (
                                                    <div key={i} className="bg-white rounded-lg p-2 text-center border border-blue-100">
                                                        <p className="text-[8px] font-bold text-blue-400 uppercase">{s.l}</p>
                                                        <p className="text-sm font-black text-slate-700">{s.v || '--'} <span className="text-[8px] font-normal text-slate-400">{s.u}</span></p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {selectedCita.triage_alergias && (
                                            <div className="bg-white rounded-lg p-3 border border-blue-100 mb-4">
                                                <p className="text-[9px] font-bold text-rose-400 uppercase mb-0.5">Alergias</p>
                                                <p className="text-xs text-slate-700 font-medium">{selectedCita.triage_alergias}</p>
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente, editMode: true } })}
                                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Edit3 size={16}/> Editar Triage
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {showPacienteModal && <ModalPaciente onClose={() => setShowPacienteModal(false)} onPacienteCreado={handlePacienteCreado} />}
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
        className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 flex-1 group ${active ? 'border-slate-800 shadow-sm ring-1 ring-slate-800 bg-white' : 'border-slate-200/60 bg-white/60 hover:bg-white hover:border-slate-300 shadow-sm'}`}
    >
        <div className="flex flex-col justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-lg font-black text-slate-800 font-jakarta leading-none">{value}</p>
        </div>
        <div className={`w-7 h-7 ml-auto rounded-lg flex items-center justify-center ${bg} ${color} group-hover:scale-110 transition-transform shadow-sm`}>
            {icon}
        </div>
    </div>
);

const CardCita = ({ cita, onClick, navigate }) => {
    return (
        <div 
            onClick={() => onClick(cita)}
            className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer relative overflow-hidden"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <span className="bg-orange-50 text-orange-600 border border-orange-100 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                        {cita.estado.replace('_',' ')}
                    </span>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">{cita.hora}</span>
                </div>
                {cita.esTeleconsulta && <div className="p-2 bg-indigo-50 rounded-xl"><Video size={16} className="text-indigo-600"/></div>}
            </div>
            <h3 className="font-black text-slate-800 text-xl mb-2 font-jakarta truncate">{cita.paciente}</h3>
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