// src/pages/admin/MonitorActividad.jsx
import React, { useState, useEffect } from 'react';
import { 
  Clock, Users, DollarSign, Activity, 
  LogIn, LogOut 
} from 'lucide-react';
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
        // A. Traer Médicos y Admins
        const usersRef = collection(db, "users");
        // Nota: Firestore 'in' query soporta hasta 10 valores
        const qUsers = query(usersRef, where("rol", "in", ["medico", "admin_maestro", "admin"])); 
        const usersSnap = await getDocs(qUsers);
        const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
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
            // Validamos que costo sea numérico
            const costo = parseFloat(data.costo);
            newStats[doctorId].dinero += isNaN(costo) ? 0 : costo; 
        });

        setStats(newStats);
        setMedicos(usersList);
      } catch (error) {
        console.error("Error data:", error);
      }
      setLoading(false);
    };

    fetchData();
    
    const interval = setInterval(fetchData, 60000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => { clearInterval(interval); clearInterval(clockInterval); };
  }, []);

  const getTiempoConectado = (lastLogin, isOnline) => {
    if (!isOnline || !lastLogin) return null;
    const start = new Date(lastLogin);
    // Validación de fecha inválida
    if (isNaN(start.getTime())) return "--";
    
    const diff = currentTime - start;
    
    const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    
    return `${hrs}h ${mins}m`;
  };

  const formatHora = (isoString) => {
      if(!isoString) return "--:--";
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "--:--";
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-slate-50">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-blue-600"/> Monitor de Productividad
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Supervisión en tiempo real de asistencia, pacientes y flujo de efectivo.
          </p>
        </div>
        <div className="text-right hidden md:block">
            <p className="text-2xl font-bold text-slate-700">{medicos.length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase">Personal Monitoreado</p>
        </div>
      </div>

      {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando métricas en vivo...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medicos.map(medico => {
                const isOnline = medico.isOnline; 
                const stat = stats[medico.id] || { pacientes: 0, dinero: 0 };
                const tiempoSesion = getTiempoConectado(medico.lastLogin, isOnline);
                
                // --- CORRECCIÓN AQUÍ: Validamos que nombre exista ---
                const nombreMostrar = medico.nombre || "Usuario Desconocido";
                const inicial = nombreMostrar.charAt(0).toUpperCase();

                return (
                  <div key={medico.id} className={`bg-white rounded-2xl border transition-all hover:shadow-lg overflow-hidden ${isOnline ? 'border-emerald-200 shadow-emerald-100' : 'border-slate-200'}`}>
                    
                    {/* --- 1. CABECERA --- */}
                    <div className="p-5 border-b border-slate-50 flex justify-between items-start">
                        <div className="flex gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-md ${isOnline ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-slate-300'}`}>
                                {inicial}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-700 leading-tight">{nombreMostrar}</h3>
                                <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                                    {medico.sucursal || 'General'}
                                </p>
                            </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                            {isOnline ? 'Activo' : 'Offline'}
                        </div>
                    </div>

                    {/* --- 2. TIEMPO --- */}
                    <div className="px-5 py-4 bg-slate-50/50 grid grid-cols-2 gap-4 border-b border-slate-50">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                                <LogIn size={10}/> Inicio Sesión
                            </p>
                            <p className="text-sm font-bold text-slate-700">
                                {formatHora(medico.lastLogin)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                                {isOnline ? <Clock size={10}/> : <LogOut size={10}/>}
                                {isOnline ? 'Tiempo Activo' : 'Desconectado'}
                            </p>
                            <p className={`text-sm font-bold ${isOnline ? 'text-blue-600' : 'text-slate-500'}`}>
                                {isOnline ? tiempoSesion : formatHora(medico.lastSeen)}
                            </p>
                        </div>
                    </div>

                    {/* --- 3. PRODUCTIVIDAD --- */}
                    <div className="p-5 grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                            <div className="flex items-center gap-2 mb-1">
                                <Users size={14} className="text-blue-500"/>
                                <span className="text-[10px] font-bold text-blue-400 uppercase">Pacientes</span>
                            </div>
                            <p className="text-2xl font-black text-blue-700">{stat.pacientes}</p>
                        </div>

                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                            <div className="flex items-center gap-2 mb-1">
                                <DollarSign size={14} className="text-emerald-500"/>
                                <span className="text-[10px] font-bold text-emerald-400 uppercase">Generado</span>
                            </div>
                            <p className="text-2xl font-black text-emerald-700">${stat.dinero}</p>
                        </div>
                    </div>

                  </div>
                );
            })}
          </div>
      )}
    </div>
  );
};

export default MonitorActividad;