import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalIcon, Clock, User, Plus, ChevronLeft, ChevronRight, 
  Search, MapPin, CheckCircle, XCircle, Video, Phone, FileText,
  MessageCircle, Send, AlertTriangle, History, DollarSign, Activity,
  LayoutGrid, List, MoreVertical
} from 'lucide-react';
import { db } from '../config/firebase'; 
import { collection, addDoc, query, where, getDocs, orderBy, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ModalPaciente from '../components/ModalPaciente';
import sonidoCampana from '../assets/notificaciondeconsulta.wav';
const Agenda = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // --- CONFIGURACIÓN ---
  const START_HOUR = 8; 
  const END_HOUR = 20;  
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const MOTIVOS_CONSULTA = [
    "Consulta", "Valoración", "Estudios", "Vacunas", "Valoracion sin costo", "Aplicacion de medicamento", 
    "Nota de urgencia", "Nota de evolución", "Nota de traslado", "Nota de interconsulta", "Rehabilitación", "Post-cirugía"
  ];

  // --- ESTADOS ---
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // --- SONIDO CAMBIADO: 'Glass Ping' suave y elegante ---
  // Este sonido es un "ding" de cristal, muy usado en apps modernas, no asusta.
const [audio] = useState(new Audio(sonidoCampana));
  
  const prevCitasLength = useRef(0); // Para controlar el sonido

  const [vista, setVista] = useState('dashboard'); 
  const [activeTabDerecha, setActiveTabDerecha] = useState('alertas');
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [todosLosPacientes, setTodosLosPacientes] = useState([]); 
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  
  const [nuevaCita, setNuevaCita] = useState({
    paciente: '', pacienteId: '', pacienteTelefono: '', 
    fecha: new Date().toISOString().split('T')[0], hora: '', motivo: 'Consulta', esTeleconsulta: false, 
    doctorAsignado: user?.rol === 'medico' ? user.nombre : ''
  });

  // --- DATOS MOCK ---
  const COMISIONES = { dia: 1200, semana: 8500, mes: 34200 };
  const ALERTAS_CADUCIDAD = [
    { id: 1, nombre: 'Amoxicilina Susp.', dias: 5 },
    { id: 2, nombre: 'Ketorolaco Inj.', dias: 12 },
  ];
  const HISTORIAL_MEDS = [
    { id: 1, nombre: 'Paracetamol 500mg', uso: 'Hace 10 min' },
    { id: 2, nombre: 'Dexametasona', uso: 'Hace 45 min' },
  ];

  // --- TIEMPO REAL + SONIDO ---
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const citasRef = collection(db, "citas");
    const q = user?.rol === 'medico' 
      ? query(citasRef, where("doctorUid", "==", user.uid), orderBy("fechaHora", "asc"))
      : query(citasRef, orderBy("fechaHora", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nuevasCitas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Solo suena si hay MAS citas que antes (evita sonar al borrar o editar)
      if (nuevasCitas.length > prevCitasLength.current && prevCitasLength.current > 0) {
         // Bajamos un poco el volumen para que sea sutil
         audio.volume = 0.6; 
         audio.play().catch(err => console.log("Sonido bloqueado por navegador", err));
      }
      
      prevCitasLength.current = nuevasCitas.length;
      setCitas(nuevasCitas);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, audio]);

  const fetchPacientes = async () => {
    try {
      const q = query(collection(db, "pacientes"), orderBy("nombre"));
      const snapshot = await getDocs(q);
      setTodosLosPacientes(snapshot.docs.map(d => ({ 
        id: d.id, 
        nombre: d.data().nombreCompleto || d.data().nombre,
        telefono: d.data().telefonoMovil || ''
      })));
    } catch (error) { console.error("Error pacientes"); }
  };

  useEffect(() => { if (user) { fetchPacientes(); } }, [user]);

  // --- LOGICA DE CALENDARIO ---
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  
  const weekDays = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(getStartOfWeek(currentDate));
    d.setDate(d.getDate() + i);
    return d;
  });

  const handlePacienteCreado = (nuevoPaciente) => {
    const pacienteSimplificado = { 
        id: nuevoPaciente.id, 
        nombre: nuevoPaciente.nombreCompleto,
        telefono: nuevoPaciente.telefonoMovil
    };
    setTodosLosPacientes(prev => [...prev, pacienteSimplificado]);
    seleccionarPaciente(pacienteSimplificado);
    setShowPacienteModal(false);
  };

  const seleccionarPaciente = (p) => {
    setNuevaCita({ ...nuevaCita, paciente: p.nombre, pacienteId: p.id, pacienteTelefono: p.telefono });
    setMostrarSugerencias(false);
  };

  const generarLinkMeet = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return `https://meet.google.com/${chars.slice(0,3)}-${chars.slice(3,7)}-${chars.slice(7,10)}`;
  };

  const enviarWhatsApp = (telefono, mensaje) => {
    if (!telefono) return alert("El paciente no tiene teléfono registrado");
    let phone = telefono.replace(/\D/g, ''); 
    if (phone.length === 10) phone = `52${phone}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const handleGuardarCita = async (e) => {
    e.preventDefault();
    try {
      let meetLink = '';
      if (nuevaCita.esTeleconsulta) meetLink = generarLinkMeet();

      await addDoc(collection(db, "citas"), {
        ...nuevaCita,
        meetLink: meetLink,
        fechaHora: `${nuevaCita.fecha}T${nuevaCita.hora}`,
        doctorUid: user.rol === 'medico' ? user.uid : "uid_generico",
        sucursal: user.sucursal || "Central",
        estado: 'pendiente'
      });

      if (nuevaCita.esTeleconsulta && nuevaCita.pacienteTelefono) {
        const mensaje = `Hola ${nuevaCita.paciente}, su teleconsulta de "${nuevaCita.motivo}" es el ${nuevaCita.fecha} a las ${nuevaCita.hora}. Link: ${meetLink}`;
        if(window.confirm("¿Enviar enlace por WhatsApp?")) enviarWhatsApp(nuevaCita.pacienteTelefono, mensaje);
      }

      setShowCitaModal(false);
      setNuevaCita({ paciente: '', pacienteId: '', pacienteTelefono: '', fecha: '', hora: '', motivo: 'Consulta', esTeleconsulta: false, doctorAsignado: '' });
    } catch (error) { alert(error.message); }
  };

  const cambiarEstado = async (id, estado) => {
      await updateDoc(doc(db, "citas", id), { estado });
      if(estado === 'cancelada') setSelectedCita(null);
  };

  const getCitasPorHora = (date, hour) => {
    const dateStr = date.toLocaleDateString('en-CA');
    return citas.filter(c => {
      const [cDate, cTime] = c.fechaHora.split('T');
      return cDate === dateStr && parseInt(cTime.split(':')[0]) === hour;
    });
  };

  const getCitasDelDia = () => {
    const dateStr = currentDate.toLocaleDateString('en-CA');
    return citas.filter(c => c.fechaHora.startsWith(dateStr)).sort((a,b) => a.fechaHora.localeCompare(b.fechaHora));
  };

  const cambiarDia = (dias) => {
    const nuevaFecha = new Date(currentDate);
    nuevaFecha.setDate(nuevaFecha.getDate() + dias);
    setCurrentDate(nuevaFecha);
  };

  const isCurrentHour = (h) => new Date().getHours() === h;

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden">
      
      {/* HEADER */}
      <div className="z-30 px-6 py-3 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm">
         <div className="flex items-center gap-4">
             <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-2.5 rounded-xl shadow-lg shadow-slate-900/20">
               <CalIcon size={20} />
             </div>
             <div>
               <h1 className="text-xl font-bold text-slate-800 leading-none">Centro de Mando</h1>
               <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={10}/> {user?.sucursal || 'Central'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-[11px] font-bold text-green-600 flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> En linea
                  </span>
               </div>
             </div>
         </div>

         <div className="bg-slate-100 p-1 rounded-xl flex">
             <button 
                onClick={() => setVista('dashboard')} 
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${vista === 'dashboard' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
             >
                <List size={16}/> Mi Día
             </button>
             <button 
                onClick={() => setVista('semanal')} 
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${vista === 'semanal' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
             >
                <LayoutGrid size={16}/> Calendario Completo
             </button>
         </div>

         <div className="flex gap-3">
             <button onClick={() => navigate('/pacientes')} className="hidden md:flex text-slate-500 hover:text-blue-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors items-center gap-2">
                <User size={18} /> Directorio
             </button>
             <button onClick={() => setShowCitaModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
               <Plus size={18} /> Nueva Cita
             </button>
         </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        
        {vista === 'dashboard' && (
           <div className="h-full flex">
              {/* COLUMNA IZQUIERDA: CALENDARIO */}
              <div className="w-72 bg-white border-r border-slate-200 flex flex-col hidden md:flex z-20">
                  <div className="p-4 border-b border-slate-100">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                          <div className="flex justify-between items-center mb-2">
                              <button onClick={()=>cambiarDia(-1)} className="p-1 hover:bg-white rounded"><ChevronLeft size={16}/></button>
                              <span className="font-bold text-sm text-slate-700">{currentDate.toLocaleDateString('es-MX', { month: 'long' })}</span>
                              <button onClick={()=>cambiarDia(1)} className="p-1 hover:bg-white rounded"><ChevronRight size={16}/></button>
                          </div>
                          <div className="text-4xl font-black text-slate-800 py-1">{currentDate.getDate()}</div>
                          <div className="text-xs text-slate-500 font-bold uppercase">{currentDate.toLocaleDateString('es-MX', { weekday: 'long' })}</div>
                      </div>
                  </div>

                  <div className="p-6 flex-1">
                      <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><DollarSign size={14}/> Mis Comisiones</h3>
                      <div className="space-y-4">
                          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-2 opacity-10"><DollarSign size={60}/></div>
                              <p className="text-xs text-emerald-600 font-bold mb-1">Generado Hoy</p>
                              <p className="text-2xl font-black text-emerald-800">${COMISIONES.dia}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Semana</p>
                                <p className="font-bold text-slate-700">${COMISIONES.semana}</p>
                             </div>
                             <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Mes</p>
                                <p className="font-bold text-slate-700">${COMISIONES.mes}</p>
                             </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* COLUMNA CENTRAL: TIMELINE DE PACIENTES */}
              <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">
                  <div className="px-8 py-6">
                      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                          Agenda del Día <span className="text-slate-400 font-normal text-lg">({getCitasDelDia().length} pacientes)</span>
                      </h2>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar space-y-4">
                      {getCitasDelDia().length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                             <p>No hay citas para este día</p>
                             <button onClick={() => setShowCitaModal(true)} className="text-blue-600 font-bold text-sm mt-2 hover:underline">Agendar paciente</button>
                          </div>
                      ) : (
                          getCitasDelDia().map((cita) => (
                              <div key={cita.id} className="flex gap-4 group">
                                  <div className="w-16 pt-4 text-right">
                                      <span className="font-bold text-slate-700 block">{cita.fechaHora.split('T')[1]}</span>
                                      <span className="text-[10px] text-slate-400 font-bold uppercase">{parseInt(cita.fechaHora.split('T')[1]) < 12 ? 'AM' : 'PM'}</span>
                                  </div>
                                  <div className="relative flex flex-col items-center">
                                      {/* PUNTO DE ESTADO */}
                                      <div className={`w-4 h-4 rounded-full border-2 z-10 ${
                                          cita.estado === 'completada' ? 'bg-emerald-500 border-emerald-500' : 
                                          cita.estado === 'en_espera' ? 'bg-blue-500 border-blue-500 animate-pulse' :
                                          'bg-white border-slate-300'
                                      }`}></div>
                                      <div className="w-[2px] h-full bg-slate-200 -mt-2"></div>
                                  </div>
                                  
                                  {/* --- TARJETA DE CITA CON ESTADO INTEGRADO --- */}
                                  <div className={`flex-1 bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all mb-2 group-hover:border-blue-200 ${
                                      cita.estado === 'en_espera' ? 'border-blue-200 shadow-blue-100' : 'border-slate-100'
                                  }`}>
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <h3 className="font-bold text-lg text-slate-800">{cita.paciente}</h3>
                                              
                                              {/* AQUÍ ESTÁ EL CAMBIO SOLICITADO: ESTATUS DENTRO DEL BOX */}
                                              <div className="flex gap-2 mt-2 flex-wrap">
                                                  {/* Motivo Base */}
                                                  <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{cita.motivo}</span>

                                                  {/* Badge: Triage Listo / En Sala */}
                                                  {cita.estado === 'en_espera' && (
                                                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 border border-blue-200 animate-in fade-in">
                                                          <CheckCircle size={10} /> Triage Listo / En Sala
                                                      </span>
                                                  )}

                                                  {/* Badge: Por Llegar */}
                                                  {cita.estado === 'pendiente' && (
                                                      <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 border border-orange-200">
                                                          <Clock size={10} /> Por Llegar
                                                      </span>
                                                  )}

                                                  {cita.esTeleconsulta && <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-indigo-100"><Video size={10}/> Teleconsulta</span>}
                                              </div>
                                          </div>
                                          <div className="flex gap-2">
                                              {cita.pacienteTelefono && (
                                                  <button onClick={() => enviarWhatsApp(cita.pacienteTelefono, "Confirmar cita")} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"><MessageCircle size={18}/></button>
                                              )}
                                              <button 
                                                onClick={() => navigate('/doctor/expediente', { state: { pacienteId: cita.pacienteId, citaId: cita.id, motivo: cita.motivo } })}
                                                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
                                              >
                                                Iniciar <ChevronRight size={14}/>
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              {/* COLUMNA DERECHA */}
              <div className="w-80 bg-white border-l border-slate-200 flex flex-col z-20">
                  <div className="flex border-b border-slate-200">
                      <button onClick={()=>setActiveTabDerecha('alertas')} className={`flex-1 py-4 text-center border-b-2 font-bold text-xs uppercase ${activeTabDerecha==='alertas' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400'}`}>Alertas</button>
                      <button onClick={()=>setActiveTabDerecha('historial')} className={`flex-1 py-4 text-center border-b-2 font-bold text-xs uppercase ${activeTabDerecha==='historial' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}>Mi Uso</button>
                      <button onClick={()=>setActiveTabDerecha('chat')} className={`flex-1 py-4 text-center border-b-2 font-bold text-xs uppercase ${activeTabDerecha==='chat' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-400'}`}>Chat</button>
                  </div>
                  <div className="flex-1 p-4 bg-slate-50/30 overflow-y-auto">
                      {activeTabDerecha === 'alertas' && (
                          <div className="space-y-4">
                             <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                                <h4 className="font-bold text-orange-800 text-xs flex items-center gap-2 mb-2"><AlertTriangle size={14}/> Caducan Pronto</h4>
                                {ALERTAS_CADUCIDAD.map(m => (
                                    <div key={m.id} className="bg-white p-2 rounded mb-1 flex justify-between shadow-sm">
                                        <span className="text-xs font-bold text-slate-700">{m.nombre}</span>
                                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">{m.dias}d</span>
                                    </div>
                                ))}
                             </div>
                          </div>
                      )}
                      {activeTabDerecha === 'historial' && (
                          <div className="space-y-2">
                              {HISTORIAL_MEDS.map(h => (
                                  <div key={h.id} className="bg-white p-3 border border-slate-100 rounded-xl shadow-sm">
                                      <p className="font-bold text-xs text-slate-700">{h.nombre}</p>
                                      <p className="text-[10px] text-slate-400">{h.uso}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                      {activeTabDerecha === 'chat' && (
                          <div className="text-center text-slate-400 text-xs mt-10">Chat interno próximamente</div>
                      )}
                  </div>
              </div>
           </div>
        )}

        {/* VISTA 2: CALENDARIO COMPLETO */}
        {vista === 'semanal' && (
            <div className="h-full flex flex-col bg-white">
                <div className="grid grid-cols-[60px_repeat(6,_1fr)] border-b border-slate-100 bg-white flex-none">
                    <div className="p-2 border-r border-slate-50"></div>
                    {weekDays.map((day, i) => {
                        const isToday = new Date().toDateString() === day.toDateString();
                        return (
                            <div key={i} className={`py-3 px-1 text-center border-r border-slate-50 ${isToday ? 'bg-blue-50/20' : ''}`}>
                                <p className={`text-[10px] font-bold tracking-widest mb-1 ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{day.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase()}</p>
                                <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center font-bold text-sm ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>{day.getDate()}</div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar relative grid" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
                    {hours.map((hour) => (
                        <div key={hour} className="grid grid-cols-[60px_repeat(6,_1fr)] border-b border-slate-100 min-h-[90px]">
                            <div className="text-right pr-4 py-2 relative border-r border-slate-100 bg-slate-50/30">
                                <span className={`text-xs font-semibold ${isCurrentHour(hour) ? 'text-blue-600' : 'text-slate-400'}`}>{hour}:00</span>
                            </div>
                            {weekDays.map((day, dayIndex) => {
                                const citasHora = getCitasPorHora(day, hour);
                                return (
                                    <div key={dayIndex} className="relative p-1 border-r border-slate-50 hover:bg-slate-50 transition-colors"
                                        onClick={() => { setNuevaCita({ ...nuevaCita, fecha: day.toLocaleDateString('en-CA'), hora: `${hour}:00` }); setShowCitaModal(true); }}>
                                        {citasHora.map(cita => (
                                            <div key={cita.id} onClick={(e) => { e.stopPropagation(); setSelectedCita(cita); }}
                                                className={`mb-1 p-2 rounded border-l-4 shadow-sm text-xs font-bold cursor-pointer hover:shadow-md transition-all ${cita.estado === 'completada' ? 'border-emerald-500 bg-emerald-50' : 'border-blue-500 bg-white'}`}>
                                                <div className="truncate">{cita.paciente}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>

      {/* --- PANEL LATERAL DE DETALLES (DRAWER) --- */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 border-l border-slate-100 ${selectedCita ? 'translate-x-0' : 'translate-x-full'}`}>
         {selectedCita && (
            <div className="h-full flex flex-col bg-white">
                <div className="relative h-48 bg-slate-900 overflow-hidden flex flex-col justify-end p-6">
                    <button onClick={() => setSelectedCita(null)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-sm"><XCircle size={20}/></button>
                    <h2 className="text-2xl font-bold text-white">{selectedCita.paciente}</h2>
                    <p className="text-slate-400 text-sm mt-1 flex items-center gap-2"><Clock size={14}/> {selectedCita.hora} • {selectedCita.motivo}</p>
                </div>
                
                {/* MOSTRAR SIGNOS VITALES SI EXISTEN (Panel Lateral) */}
                {selectedCita.signos_vitales && (
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-3 gap-2">
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Presión</p>
                            <p className="font-bold text-slate-700">{selectedCita.signos_vitales.ta || '--'}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Temp</p>
                            <p className={`font-bold ${selectedCita.signos_vitales.temp > 37.5 ? 'text-red-500' : 'text-slate-700'}`}>
                                {selectedCita.signos_vitales.temp || '--'}°C
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">SpO2</p>
                            <p className="font-bold text-slate-700">{selectedCita.signos_vitales.spo2 || '--'}%</p>
                        </div>
                    </div>
                )}

                <div className="p-6 grid grid-cols-2 gap-4">
                    <button onClick={() => navigate('/doctor/expediente', { state: { pacienteId: selectedCita.pacienteId, citaId: selectedCita.id, motivo: selectedCita.motivo } })} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-blue-50 font-bold text-slate-700 text-sm flex flex-col items-center gap-2">
                        <FileText size={24} className="text-blue-500"/> Expediente
                    </button>
                    <button onClick={() => navigate('/doctor/consulta', { state: { pacienteId: selectedCita.pacienteId, citaId: selectedCita.id } })} className="p-4 bg-blue-600 rounded-2xl shadow-lg hover:bg-blue-700 font-bold text-white text-sm flex flex-col items-center gap-2">
                        <Activity size={24}/> Iniciar Consulta
                    </button>
                </div>
                <div className="px-6 space-y-3">
                   {selectedCita.estado === 'pendiente' && (
                       <button onClick={()=>cambiarEstado(selectedCita.id, 'cancelada')} className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50">Cancelar Cita</button>
                   )}
                </div>
            </div>
         )}
      </div>

      {/* --- MODAL CREAR CITA --- */}
      {showCitaModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
              <h2 className="text-slate-800 font-bold text-lg">Nueva Cita</h2>
              <button onClick={() => setShowCitaModal(false)}><XCircle size={20} className="text-slate-500"/></button>
            </div>
            <form onSubmit={handleGuardarCita} className="p-6 space-y-4">
              <div className="relative">
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Paciente</label>
                 <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                        <input required type="text" placeholder="Buscar..." className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                            value={nuevaCita.paciente} 
                            onChange={e => {
                                setNuevaCita({...nuevaCita, paciente: e.target.value});
                                const texto = e.target.value.toLowerCase();
                                if(texto.length > 1) {
                                    setSugerencias(todosLosPacientes.filter(p => p.nombre.toLowerCase().includes(texto)));
                                    setMostrarSugerencias(true);
                                } else setMostrarSugerencias(false);
                            }} 
                        />
                        {mostrarSugerencias && (
                            <div className="absolute top-full left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto z-[70]">
                                {sugerencias.map(p => (
                                    <div key={p.id} onClick={() => seleccionarPaciente(p)} className="p-2.5 hover:bg-blue-50 cursor-pointer text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">{p.nombre.charAt(0)}</div>{p.nombre}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button type="button" onClick={() => setShowPacienteModal(true)} className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100"><Plus size={20}/></button>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha</label><input required type="date" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={nuevaCita.fecha} onChange={e => setNuevaCita({...nuevaCita, fecha: e.target.value})} /></div>
                 <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Hora</label><input required type="time" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={nuevaCita.hora} onChange={e => setNuevaCita({...nuevaCita, hora: e.target.value})} /></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Motivo</label><select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={nuevaCita.motivo} onChange={e => setNuevaCita({...nuevaCita, motivo: e.target.value})}>{MOTIVOS_CONSULTA.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl"><input type="checkbox" className="w-4 h-4" checked={nuevaCita.esTeleconsulta} onChange={e => setNuevaCita({...nuevaCita, esTeleconsulta: e.target.checked})} /><span className="font-bold text-sm text-slate-700">Teleconsulta (Meet)</span></label>
              <button type="submit" className="w-full py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-lg">Confirmar</button>
            </form>
          </div>
        </div>
      )}
      
      {showPacienteModal && <ModalPaciente onClose={() => setShowPacienteModal(false)} onPacienteCreado={handlePacienteCreado} />}
    </div>
  );
};

export default Agenda;