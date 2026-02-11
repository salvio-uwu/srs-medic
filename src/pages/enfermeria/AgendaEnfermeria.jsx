import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalIcon, Clock, User, Plus, ChevronLeft, ChevronRight, 
  Search, X, Activity, Stethoscope, ChevronDown, CheckCircle, 
  AlertCircle, Zap, Filter, Video, AlertTriangle, 
  MoreHorizontal, MapPin
} from 'lucide-react';
import { db } from '../../config/firebase'; 
import { collection, addDoc, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ModalPaciente from '../../components/ModalPaciente';

const AgendaEnfermeria = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef(null); 
  
  // --- CONFIGURACIÓN ---
  const INTERVALO_MINUTOS = 10; 

  // --- LISTA ESTRICTA (NO MODIFICAR) ---
  const MOTIVOS_CONSULTA = [
    "Consulta", "Valoración", "Estudios", "Vacunas", 
    "Nota de urgencia", "Nota de evolución", "Nota de traslado", 
    "Nota de interconsulta", "Rehabilitación", "Post-cirugía"
  ];

  // --- ESTADOS ---
  const [citas, setCitas] = useState([]);
  const [doctores, setDoctores] = useState([]); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [viewFilter, setViewFilter] = useState('timeline'); 
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [showSelectorDoctor, setShowSelectorDoctor] = useState(false); 
  const [selectedCita, setSelectedCita] = useState(null);

  const [todosLosPacientes, setTodosLosPacientes] = useState([]); 
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  
  const [nuevaCita, setNuevaCita] = useState({
    paciente: '', pacienteId: '', pacienteTelefono: '', 
    fecha: new Date().toLocaleDateString('en-CA'), 
    hora: '', motivo: 'Consulta', doctorAsignado: '', doctorUid: '',
    esTeleconsulta: false
  });

  // --- GENERADORES ---
  const generarLinkMeet = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return `https://meet.google.com/${chars.slice(0,3)}-${chars.slice(3,7)}-${chars.slice(7,10)}`;
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += INTERVALO_MINUTOS) {
        const startH = h.toString().padStart(2, '0');
        const startM = m.toString().padStart(2, '0');
        const startTime = `${startH}:${startM}`;
        
        const slotMinutes = h * 60 + m;
        const isPast = slotMinutes < currentMinutes - INTERVALO_MINUTOS;
        const isCurrent = slotMinutes <= currentMinutes && currentMinutes < slotMinutes + INTERVALO_MINUTOS;

        slots.push({ value: startTime, isFullHour: m === 0, isPast, isCurrent });
      }
    }
    return slots;
  }, [currentTime]);

  // --- EFECTOS ---
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    setTimeout(() => {
        if(scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 800);
    return () => clearInterval(interval);
  }, [currentDate]);

  useEffect(() => {
    const dateStr = currentDate.toLocaleDateString('en-CA');
    const startOfDay = `${dateStr}T00:00`;
    const endOfDay = `${dateStr}T23:59`;

    const q = query(
        collection(db, "citas"), 
        where("fechaHora", ">=", startOfDay),
        where("fechaHora", "<=", endOfDay),
        orderBy("fechaHora", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
        setCitas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qDocs = query(collection(db, "users"), where("rol", "==", "medico"));
    const unsubDocs = onSnapshot(qDocs, (snap) => {
        setDoctores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub(); unsubDocs(); };
  }, [currentDate]);

  useEffect(() => {
    const getPacientes = async () => {
        const qPac = query(collection(db, "pacientes"), orderBy("nombre"));
        const snap = await getDocs(qPac);
        setTodosLosPacientes(snap.docs.map(d => ({ 
            id: d.id, nombre: d.data().nombreCompleto || d.data().nombre, telefono: d.data().telefonoMovil || ''
        })));
    };
    getPacientes();
  }, []);

  // --- HELPERS ---
  const getDoctorStatus = (docData) => {
      if (!docData.isOnline) return { color: 'bg-slate-300', text: 'fuera de linea', ring: 'ring-slate-200' };
      if (docData.statusOperativo === 'ocupado') return { color: 'bg-rose-500', text: 'Ocupado', ring: 'ring-rose-200' };
      if (docData.statusOperativo === 'comida') return { color: 'bg-yellow-500', text: 'Comida', ring: 'ring-yellow-200' };
      return { color: 'bg-emerald-500', text: 'Disponible', ring: 'ring-emerald-200' };
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
    const [h, m] = slot.value.split(':');
    const fechaCita = new Date(currentDate);
    fechaCita.setHours(h, m, 0, 0);

    if (fechaCita < ahora && fechaCita.getDate() === ahora.getDate()) {
        const confirmar = window.confirm("⚠️ Estás intentando agendar en un horario pasado.\n\n¿Es un registro retroactivo?");
        if (!confirmar) return;
    }
    setNuevaCita({ ...nuevaCita, fecha: currentDate.toLocaleDateString('en-CA'), hora: slot.value });
    setShowCitaModal(true);
  };

  const handleGuardarCita = async (e) => {
      e?.preventDefault(); // Prevenir reload si viene de form
      if(!nuevaCita.paciente || !nuevaCita.hora || !nuevaCita.doctorUid) return alert("Complete datos obligatorios.");
      try {
          let meetLink = '';
          if (nuevaCita.esTeleconsulta) meetLink = generarLinkMeet();

          await addDoc(collection(db, "citas"), {
              ...nuevaCita,
              meetLink,
              fechaHora: `${nuevaCita.fecha}T${nuevaCita.hora}`,
              sucursal: user.sucursal || 'Central',
              estado: 'pendiente',
              creadoPor: user.uid,
              creadoPorRol: 'enfermeria'
          });
          setShowCitaModal(false);
          setNuevaCita({ ...nuevaCita, paciente: '', pacienteId: '', hora: '', esTeleconsulta: false });
      } catch (e) { console.error(e); alert("Error al guardar"); }
  };

  const metrics = {
      espera: citas.filter(c => c.estado === 'pendiente' || c.estado === 'en_espera').length,
      consulta: citas.filter(c => c.estado === 'en_consulta').length,
      fin: citas.filter(c => c.estado === 'completada').length
  };

  // ESTILOS UNIFICADOS CON AGENDA.JSX
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-all";
  const labelStyle = "text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1 block tracking-wide";

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans text-slate-600 overflow-hidden">
      
      {/* 1. HEADER (Igual a Agenda.jsx: px-6 py-3) */}
      <div className="bg-white px-6 py-3 border-b border-slate-200 flex justify-between items-center shadow-sm z-30 shrink-0">
         <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
               <Activity size={20}/>
             </div>
             <div>
               <h1 className="text-xl font-bold text-slate-800 leading-none">Enfermería</h1>
               <div className="flex items-center gap-2 mt-1">
                 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={10}/> {user?.sucursal || 'Central'}
                 </span>
                 <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                 <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> En linea
                 </span>
               </div>
             </div>
         </div>

         {/* Selector de Fecha (Estilo Agenda.jsx) */}
         <div className="bg-slate-100 p-1 rounded-xl flex items-center">
             <button onClick={()=>cambiarDia(-1)} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronLeft size={16}/></button>
             <div className="px-4 flex flex-col items-center w-32">
                 <span className="text-xs font-bold text-slate-800 capitalize">
                     {currentDate.toLocaleDateString('es-MX', { weekday: 'long' })}
                 </span>
                 <span className="text-[10px] font-bold text-slate-400">
                     {currentDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                 </span>
             </div>
             <button onClick={()=>cambiarDia(1)} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronRight size={16}/></button>
         </div>

         <div className="flex gap-3">
             <button onClick={() => navigate('/pacientes')} className="hidden md:flex text-slate-500 hover:text-blue-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors items-center gap-2">
                <User size={18} /> Directorio
             </button>
             <button onClick={() => { setNuevaCita({...nuevaCita, fecha: currentDate.toLocaleDateString('en-CA'), hora: ''}); setShowCitaModal(true); }} 
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
               <Plus size={18} /> Nueva Cita
             </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
          
          {/* --- COLUMNA IZQUIERDA: AGENDA --- */}
          <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-50/50">
              
              {/* HUD DE MÉTRICAS (Compacto) */}
<div className="px-6 py-3 grid grid-cols-3 gap-4 shrink-0 max-w-5xl mx-auto w-full">
    <MetricCard label="En Espera" value={metrics.espera} icon={<Clock size={20}/>} color="text-orange-600" bg="bg-orange-50" onClick={()=>setViewFilter('pendientes')} active={viewFilter==='pendientes'} />
    <MetricCard label="En Consulta" value={metrics.consulta} icon={<Stethoscope size={20}/>} color="text-blue-600" bg="bg-blue-50" />
    <MetricCard label="Finalizados" value={metrics.fin} icon={<CheckCircle size={20}/>} color="text-emerald-600" bg="bg-emerald-50" />
</div>

              {/* FILTROS (Compacto) */}
<div className="px-8 py-1 flex gap-8 shrink-0 justify-center border-b border-slate-100 mb-0">
    <button onClick={()=>setViewFilter('timeline')} className={`text-xs font-bold pb-2 border-b-[3px] transition-colors flex items-center gap-2 ${viewFilter==='timeline' ? 'text-slate-800 border-slate-800' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
        Horario de atención
    </button>
    <button onClick={()=>setViewFilter('pendientes')} className={`text-xs font-bold pb-2 border-b-[3px] transition-colors flex items-center gap-2 ${viewFilter==='pendientes' ? 'text-orange-600 border-orange-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
        Solo Pendientes
    </button>
</div>

              {/* TIMELINE ESTILO TABLA CLÍNICA (24H / 10MIN) */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-10 custom-scrollbar">
                  {viewFilter === 'timeline' ? (
                      <div className="max-w-6xl mx-auto mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                          {/* Encabezado Tabla */}
                          <div className="flex bg-slate-50 border-b border-slate-200 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                              <div className="w-24 text-center border-r border-slate-200">Hora</div>
                              <div className="flex-1 pl-6">Paciente / Detalles</div>
                              <div className="w-64 text-right pr-6">Médico Asignado</div>
                          </div>

                          {timeSlots.map((slot, index) => {
                              const citasEnSlot = citas.filter(c => {
                                  const horaCita = c.fechaHora.split('T')[1];
                                  const [hSlot, mSlot] = slot.value.split(':').map(Number);
                                  const [hCita, mCita] = horaCita.split(':').map(Number);
                                  return hSlot === hCita && mCita >= mSlot && mCita < (mSlot + INTERVALO_MINUTOS);
                              });

                              return (
                                  <div 
                                    key={slot.value} 
                                    ref={slot.isCurrent ? scrollRef : null}
                                    // AUMENTADO: min-h-[80px] para igualar la escala visual de Agenda.jsx
                                    className={`flex min-h-[60px] group border-b border-slate-100 last:border-0 relative transition-colors ${
                                        slot.isCurrent ? 'bg-blue-50/30' : 
                                        slot.isPast ? 'bg-slate-50/60' : 
                                        index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                                    }`}
                                  >
                                      {/* Línea de "Ahora" */}
                                      {slot.isCurrent && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 z-20"></div>}

                                      {/* COLUMNA HORA (w-24, text-sm bold) */}
                                      <div className={`w-24 flex items-center justify-center border-r border-slate-100 shrink-0 ${slot.isPast ? 'text-slate-300' : 'text-slate-500'} ${slot.isCurrent ? 'font-bold text-blue-600 text-lg' : 'font-bold text-sm'}`}>
                                          {slot.value}
                                      </div>
                                      
                                      {/* COLUMNA CONTENIDO */}
                                      <div className="flex-1 p-2 relative flex flex-col justify-center">
                                          {/* Botón flotante (+) */}
                                          {citasEnSlot.length === 0 && (
                                              <button 
                                                onClick={() => iniciarAgendado(slot)}
                                                className={`absolute left-4 opacity-0 group-hover:opacity-100 p-2 rounded-xl transition-all z-10 flex items-center gap-2 text-xs font-bold ${slot.isPast ? 'text-slate-400 bg-slate-100 hover:bg-slate-200' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                                              >
                                                <Plus size={16}/> {slot.isPast ? 'Registro Retroactivo' : 'Agendar'}
                                              </button>
                                          )}

                                          {/* Render Citas */}
                                          <div className="w-full space-y-2">
                                              {citasEnSlot.map(cita => (
                                                  <div key={cita.id} onClick={() => setSelectedCita(cita)} className="flex items-center justify-between p-4 hover:bg-white hover:shadow-md rounded-xl transition-all cursor-pointer border border-transparent hover:border-blue-100 group/item">
                                                      
                                                      {/* Paciente (TEXTO GRANDE) */}
                                                      <div className="flex items-center gap-4 overflow-hidden">
                                                          <div className={`w-3 h-3 rounded-full shrink-0 ${
                                                              cita.estado === 'pendiente' ? 'bg-orange-500 animate-pulse' : 
                                                              cita.estado === 'en_espera' ? 'bg-blue-500' : 'bg-emerald-500'
                                                          }`}></div>
                                                          
                                                          {/* text-lg para igualar Agenda.jsx */}
                                                          <span className="text-lg font-bold truncate text-slate-800">{cita.paciente}</span>
                                                          
                                                          {/* Badges */}
                                                          <div className="flex items-center gap-2 pl-4 border-l border-slate-200 ml-2">
                                                              {cita.esTeleconsulta && (
                                                                  <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-bold border border-indigo-100">
                                                                      <Video size={14}/> Tele
                                                                  </span>
                                                              )}
                                                              <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-bold border border-slate-200 uppercase">
                                                                 {cita.motivo}
                                                              </span>
                                                          </div>
                                                      </div>

                                                      {/* Doctor */}
                                                      <div className="flex items-center gap-3 shrink-0">
                                                          <span className="text-xs text-slate-400 uppercase font-bold hidden sm:block tracking-wide">
                                                              Dr. {cita.doctorAsignado?.split(' ')[1] || cita.doctorAsignado || 'General'}
                                                          </span>
                                                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 shadow-sm">
                                                              {cita.doctorAsignado?.charAt(0) || 'D'}
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
                      // VISTA PENDIENTES (Tarjetas Grandes)
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mt-6">
                          {citas.filter(c => c.estado === 'pendiente').map(cita => (
                              <CardCita key={cita.id} cita={cita} onClick={setSelectedCita} navigate={navigate} />
                          ))}
                      </div>
                  )}
              </div>
          </div>

          {/* --- COLUMNA DERECHA: STAFF (w-80 igual que Agenda.jsx) --- */}
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col z-20 hidden xl:flex shadow-xl shadow-slate-200/50">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-extrabold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                      <Zap size={16} className="text-amber-500" fill="currentColor"/> MÉDICO DISPONIBLE
                  </h3>
              </div>
              {/* Ajuste: p-3 en contenedor y space-y-2 para juntarlos más */}
<div className="flex-1 overflow-y-auto p-3 space-y-2">
    {doctores.map(doc => {
        const status = getDoctorStatus(doc);
        return (
            <div key={doc.id} className="p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all flex items-center justify-between group cursor-default">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        {/* Ajuste: w-10 h-10 (antes 12) y texto sm */}
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 font-bold border border-slate-100 text-sm">
                            {doc.nombre?.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${status.color}`}></div>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{doc.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{status.text}</p>
                    </div>
                </div>
            </div>
        )
    })}
</div>
          </div>
      </div>

      {/* --- MODAL NUEVA CITA --- */}
      {showCitaModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[450px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800">Nueva Cita</h2>
                <button onClick={() => setShowCitaModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6">
                <div>
                    <label className={labelStyle}>Paciente</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-4 text-slate-400" size={18}/>
                            <input 
                                className={`${inputStyle} pl-12`} placeholder="Buscar por nombre..." value={nuevaCita.paciente}
                                onChange={(e) => {
                                    setNuevaCita({...nuevaCita, paciente: e.target.value});
                                    const txt = e.target.value.toLowerCase();
                                    if(txt.length > 1) {
                                        setSugerencias(todosLosPacientes.filter(p => p.nombre.toLowerCase().includes(txt)));
                                        setMostrarSugerencias(true);
                                    } else setMostrarSugerencias(false);
                                }}
                            />
                            {mostrarSugerencias && (
                                <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl mt-1 border border-slate-100 max-h-48 overflow-y-auto z-50">
                                    {sugerencias.map(p => (
                                        <div key={p.id} onClick={() => seleccionarPaciente(p)} className="p-4 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700 border-b border-slate-50">
                                            {p.nombre}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowPacienteModal(true)} className="bg-blue-50 text-blue-600 p-3 rounded-xl hover:bg-blue-100"><Plus size={24}/></button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelStyle}>Fecha</label><input type="date" className={inputStyle} value={nuevaCita.fecha} onChange={e => setNuevaCita({...nuevaCita, fecha: e.target.value})} /></div>
                    <div><label className={labelStyle}>Hora</label><input type="time" className={inputStyle} value={nuevaCita.hora} onChange={e => setNuevaCita({...nuevaCita, hora: e.target.value})} /></div>
                </div>

                <div className="relative">
                    <label className={labelStyle}>Médico Responsable</label>
                    <div onClick={() => setShowSelectorDoctor(!showSelectorDoctor)} className={`${inputStyle} cursor-pointer flex justify-between items-center bg-white`}>
                        <span className={nuevaCita.doctorAsignado ? "text-slate-800" : "text-slate-400"}>{nuevaCita.doctorAsignado || "Seleccionar Médico"}</span>
                        <ChevronDown size={20} className="text-slate-400"/>
                    </div>
                    {showSelectorDoctor && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-56 overflow-y-auto custom-scrollbar">
                            {doctores.map(doc => {
                                const st = getDoctorStatus(doc);
                                return (
                                    <div key={doc.id} onClick={() => { setNuevaCita({...nuevaCita, doctorUid: doc.id, doctorAsignado: doc.nombre}); setShowSelectorDoctor(false); }} className="p-4 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50">
                                        <span className="text-sm font-bold text-slate-700">{doc.nombre}</span>
                                        <div className="flex items-center gap-2"><div className={`w-2.5 h-2.5 rounded-full ${st.color}`}></div><span className="text-xs font-bold text-slate-400 uppercase">{st.text}</span></div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div>
                    <label className={labelStyle}>Motivo</label>
                    <div className="relative">
                        <select className={`${inputStyle} appearance-none bg-white`} value={nuevaCita.motivo} onChange={e => setNuevaCita({...nuevaCita, motivo: e.target.value})}>
                            {MOTIVOS_CONSULTA.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown size={20} className="absolute right-4 top-4 text-slate-400 pointer-events-none"/>
                    </div>
                </div>

                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-indigo-600 rounded border-gray-300"
                        checked={nuevaCita.esTeleconsulta}
                        onChange={(e) => setNuevaCita({...nuevaCita, esTeleconsulta: e.target.checked})}
                    />
                    <div className="flex items-center gap-2">
                        <Video size={20} className={nuevaCita.esTeleconsulta ? "text-indigo-600" : "text-slate-400"}/>
                        <span className="text-base font-bold text-slate-700">Es Teleconsulta (Generar Link)</span>
                    </div>
                </label>

                <button onClick={handleGuardarCita} type="button" className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98]">Confirmar Cita</button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER DETALLE (Grandes Dimensiones) */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl transform transition-transform duration-300 z-50 ${selectedCita ? 'translate-x-0' : 'translate-x-full'}`}>
         {selectedCita && (
            <div className="h-full flex flex-col bg-slate-50">
                <div className="bg-white px-10 py-8 border-b border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <button onClick={() => setSelectedCita(null)} className="p-2 -ml-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><ChevronRight size={28}/></button>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800">{selectedCita.paciente}</h2>
                    <p className="text-lg font-medium text-slate-400 mt-2 flex items-center gap-2">
                        {selectedCita.motivo} <span className="w-1 h-1 rounded-full bg-slate-300"></span> {selectedCita.hora}
                    </p>
                    
                    {selectedCita.esTeleconsulta && selectedCita.meetLink && (
                        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Video size={20} className="text-indigo-600"/>
                                <span className="text-sm font-bold text-indigo-700">Videollamada Programada</span>
                            </div>
                            <button 
                                onClick={() => window.open(selectedCita.meetLink, '_blank')}
                                className="text-xs bg-white border border-indigo-200 px-4 py-2 rounded-lg font-bold text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                            >
                                Unirse a Meet
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="p-10 space-y-8 flex-1 overflow-y-auto">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">Estado Actual</span>
                            <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase ${
                                selectedCita.estado === 'pendiente' ? 'bg-orange-50 text-orange-600' :
                                selectedCita.estado === 'en_espera' ? 'bg-blue-50 text-blue-600' :
                                'bg-emerald-50 text-emerald-600'
                            }`}>
                                {selectedCita.estado.replace('_',' ')}
                            </span>
                        </div>
                        
                        {selectedCita.estado === 'pendiente' && (
                            <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
                                <div className="flex items-start gap-4">
                                    <AlertCircle className="text-orange-500 mt-1" size={24}/>
                                    <div>
                                        <h4 className="font-bold text-orange-800 text-base">Triage Pendiente</h4>
                                        <p className="text-sm text-orange-600 mt-1 leading-relaxed">
                                            El paciente requiere toma de signos vitales antes de pasar con el médico.
                                        </p>
                                        <button 
                                            onClick={() => navigate('/enfermeria/triage', { state: { citaId: selectedCita.id, pacienteId: selectedCita.pacienteId, pacienteNombre: selectedCita.paciente } })}
                                            className="mt-4 w-full py-3 bg-orange-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-orange-700 transition-colors"
                                        >
                                            Iniciar Triage
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
         )}
      </div>

      {showPacienteModal && <ModalPaciente onClose={() => setShowPacienteModal(false)} onPacienteCreado={handlePacienteCreado} />}
    </div>
  );
};

// --- COMPONENTES VISUALES ---
// --- COMPONENTE METRIC CARD (Versión Compacta / Horizontal) ---
const MetricCard = ({ label, value, icon, color, bg, onClick, active }) => (
    <div 
        onClick={onClick}
        // CAMBIO: p-3 en lugar de p-6 reduce drásticamente la altura
        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${active ? 'border-slate-800 shadow-md ring-1 ring-slate-800' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'}`}
    >
        <div>
            {/* Texto y número más pegados */}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
        </div>
        {/* Icono ajustado */}
        <div className={`p-2 rounded-lg ${bg} ${color} group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
    </div>
);

// --- COMPONENTE CARD CITA PENDIENTE (Vista filtrada) ---
const CardCita = ({ cita, onClick, navigate }) => {
    return (
        <div 
            onClick={() => onClick(cita)}
            className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <span className="bg-orange-50 text-orange-600 border border-orange-100 px-3 py-1 rounded-lg text-xs font-bold uppercase flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        {cita.estado.replace('_',' ')}
                    </span>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">{cita.hora}</span>
                </div>
                {cita.esTeleconsulta && <Video size={20} className="text-indigo-500"/>}
            </div>
            <h3 className="font-bold text-slate-800 text-xl mb-1">{cita.paciente}</h3>
            <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                {cita.motivo} <span className="text-slate-300">•</span> Dr. {cita.doctorAsignado?.split(' ')[0]}
            </p>
        </div>
    );
};

export default AgendaEnfermeria;