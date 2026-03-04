// src/pages/admin/MonitorActividad.jsx
import React, { useState, useEffect } from 'react';
import { Clock, Users, DollarSign, Activity, LogIn, LogOut, Timer, AlertCircle } from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const MonitorActividad = () => {
  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({}); 
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // A. Traer TODO el personal (Filtramos en memoria para evitar errores de índices en Firebase)
        const usersRef = collection(db, "users");
        const usersSnap = await getDocs(usersRef);
        const usersList = usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => ['medico', 'admin', 'enfermeria', 'rh'].includes(u.rol)); // Monitoreamos operativos
        
        // B. Traer Consultas DE HOY
        const hoy = new Date().toLocaleDateString('en-CA'); 
        const consultasRef = collection(db, "consultas");
        const qConsultas = query(consultasRef, where("fechaBusqueda", "==", hoy));
        const consultasSnap = await getDocs(qConsultas);
        
        // C. Procesar Estadísticas
        const newStats = {};
        
        consultasSnap.forEach(doc => {
            const data = doc.data();
            const doctorId = data.doctorId || "sin_id";
            
            if(!newStats[doctorId]) {
                newStats[doctorId] = { pacientes: 0, dinero: 0 };
            }
            newStats[doctorId].pacientes += 1;
            const costo = parseFloat(data.costo);
            newStats[doctorId].dinero += isNaN(costo) ? 0 : costo; 
        });

        setStats(newStats);
        setMedicos(usersList);
      } catch (error) {
        console.error("Error al traer datos en vivo:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Sincronización cada 60 segundos y reloj interno cada 1 segundo
    const interval = setInterval(fetchData, 60000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => { clearInterval(interval); clearInterval(clockInterval); };
  }, []);

  // --- ALGORITMOS DE AUDITORÍA DE TIEMPOS ---
  
  const calcularTiempos = (lastLogin, isOnline, pacientes) => {
    if (!lastLogin) return { activoTxt: "--", inactivoTxt: "--", eficiencia: 0, color: '#94a3b8' };
    
    const start = new Date(lastLogin);
    if (isNaN(start.getTime())) return { activoTxt: "--", inactivoTxt: "--", eficiencia: 0, color: '#94a3b8' };
    
    // Si está offline, calculamos en base a su última sesión guardada (si la tuviéramos), 
    // pero por ahora solo mostramos datos si está online.
    if (!isOnline) return { activoTxt: "Desconectado", inactivoTxt: "-", eficiencia: 0, color: '#94a3b8' };

    const diffMs = currentTime - start;
    const hrsConectado = diffMs / (1000 * 60 * 60); // Horas totales conectado
    
    const hrsFormat = Math.floor(hrsConectado);
    const minsFormat = Math.floor((diffMs / (1000 * 60)) % 60);
    
    // AUDITORÍA: Asumimos que cada consulta toma en promedio 25 minutos efectivos.
    const horasEfectivas = (pacientes * 25) / 60;
    
    let eficiencia = hrsConectado > 0 ? (horasEfectivas / hrsConectado) * 100 : 0;
    if (eficiencia > 100) eficiencia = 100; // Tope máximo

    // Determinar el color del semáforo de eficiencia
    let colorSemáforo = '#10b981'; // Verde (Eficiente)
    if (eficiencia < 40) colorSemáforo = '#f59e0b'; // Amarillo (Regular)
    if (eficiencia < 15 && hrsConectado > 1) colorSemáforo = '#e11d48'; // Rojo (Mucho tiempo muerto)

    return {
      activoTxt: `${hrsFormat}h ${minsFormat}m`,
      eficiencia: Math.round(eficiencia),
      color: colorSemáforo
    };
  };

  const formatHora = (isoString) => {
      if(!isoString) return "--:--";
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "--:--";
      return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        
        .font-jakarta { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .font-inter { font-family: 'Inter', system-ui, sans-serif; }
        
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        
        .glass-card {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 10px 30px -10px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.04);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .glass-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -10px rgba(15,23,42,0.1), 0 0 0 1px rgba(15,23,42,0.05);
        }

        .stripe-bg {
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(15,23,42,0.01) 18px, rgba(15,23,42,0.01) 19px);
        }
        
        /* Progress Bar Animation */
        .progress-bar { transition: width 1s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      <div className="min-h-screen bg-[#f4f7f9] p-6 md:p-10 font-inter pb-20">
        
        {/* --- HEADER --- */}
        <div className="fade-up flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <h1 className="font-jakarta text-3xl font-extrabold text-[#0f172a] flex items-center gap-3 tracking-tight">
              Monitor de Productividad
            </h1>
            <p className="text-[13px] text-[#64748b] font-medium mt-1">
              Auditoría en vivo de personal, tiempos efectivos y saturación.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-full border border-[#cbd5e1] shadow-sm text-[12px] font-bold text-[#64748b] uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Actualización: 1s
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 fade-up">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-[#64748b] font-medium text-sm">Escaneando red de sucursales...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 fade-up">
            {medicos.map((medico, idx) => {
                const isOnline = medico.isOnline; 
                const stat = stats[medico.id] || { pacientes: 0, dinero: 0 };
                const tiempos = calcularTiempos(medico.lastLogin, isOnline, stat.pacientes);
                
                const nombreMostrar = medico.nombre || "Usuario Desconocido";
                const inicial = nombreMostrar.charAt(0).toUpperCase();

                return (
                  <div key={medico.id} className="glass-card stripe-bg overflow-hidden flex flex-col relative" style={{ animationDelay: `${idx * 0.05}s` }}>
                    
                    {/* Borde superior dinámico según estado */}
                    <div className="h-1.5 w-full" style={{ background: isOnline ? tiempos.color : '#cbd5e1' }}></div>

                    {/* --- 1. CABECERA (IDENTIDAD) --- */}
                    <div className="p-6 border-b border-[#f1f5f9] flex justify-between items-start bg-white">
                        <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-jakarta font-bold text-lg shadow-inner" style={{ background: isOnline ? '#f0fdf4' : '#f8fafc', color: isOnline ? '#16a34a' : '#94a3b8', border: `1px solid ${isOnline ? '#bbf7d0' : '#e2e8f0'}` }}>
                                {inicial}
                            </div>
                            <div>
                                <h3 className="font-jakarta font-bold text-[#0f172a] text-[15px] leading-tight">{nombreMostrar}</h3>
                                <p className="text-[11px] text-[#64748b] font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                                    <span className="text-blue-500">{medico.rol?.replace('_', ' ')}</span> • {medico.sucursal || 'General'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border" style={{ background: isOnline ? '#f0fdf4' : '#f8fafc', color: isOnline ? '#16a34a' : '#94a3b8', borderColor: isOnline ? '#bbf7d0' : '#e2e8f0' }}>
                            {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                            {isOnline ? 'En Turno' : 'Offline'}
                        </div>
                    </div>

                    {/* --- 2. AUDITORÍA DE TIEMPOS --- */}
                    <div className="px-6 py-5 bg-[#f8fafc] border-b border-[#f1f5f9]">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                    <LogIn size={12}/> Entrada
                                </p>
                                <p className="font-jakarta text-[15px] font-bold text-[#0f172a]">
                                    {formatHora(medico.lastLogin)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                    {isOnline ? <Clock size={12} className="text-blue-500"/> : <LogOut size={12}/>}
                                    Conectado
                                </p>
                                <p className={`font-jakarta text-[15px] font-bold ${isOnline ? 'text-blue-600' : 'text-[#94a3b8]'}`}>
                                    {isOnline ? tiempos.activoTxt : formatHora(medico.lastSeen)}
                                </p>
                            </div>
                        </div>

                        {/* Barra de Eficiencia (Solo si está online) */}
                        {isOnline && (
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1">
                                <Timer size={10} /> Eficiencia Estimada
                              </p>
                              <span className="text-[10px] font-bold" style={{ color: tiempos.color }}>{tiempos.eficiencia}%</span>
                            </div>
                            <div className="w-full bg-[#e2e8f0] rounded-full h-1.5 overflow-hidden">
                              <div className="h-full progress-bar rounded-full" style={{ width: `${tiempos.eficiencia}%`, background: tiempos.color }}></div>
                            </div>
                            {tiempos.eficiencia < 15 && tiempos.activoTxt !== "--" && (
                              <p className="text-[10px] text-[#e11d48] font-medium mt-1.5 flex items-center gap-1">
                                <AlertCircle size={10} /> Posible tiempo muerto detectado
                              </p>
                            )}
                          </div>
                        )}
                    </div>

                    {/* --- 3. RENDIMIENTO (PACIENTES / INGRESOS) --- */}
                    <div className="p-6 grid grid-cols-2 gap-4 bg-white mt-auto">
                        <div className="bg-[#f1f5f9] rounded-xl p-3 border border-[#e2e8f0] group hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Users size={12} className="text-blue-500"/>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Atenciones</span>
                            </div>
                            <p className="font-jakarta text-2xl font-extrabold text-[#0f172a] group-hover:text-blue-600 transition-colors">
                              {stat.pacientes}
                            </p>
                        </div>

                        <div className="bg-[#f1f5f9] rounded-xl p-3 border border-[#e2e8f0] group hover:border-emerald-300 transition-colors">
                            <div className="flex items-center gap-1.5 mb-1">
                                <DollarSign size={12} className="text-emerald-500"/>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Generado</span>
                            </div>
                            <p className="font-jakarta text-2xl font-extrabold text-[#0f172a] group-hover:text-emerald-600 transition-colors">
                              ${stat.dinero}
                            </p>
                        </div>
                    </div>

                  </div>
                );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default MonitorActividad;