import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getCountFromServer } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import { 
  Users, 
  Package, 
  AlertTriangle, 
  Activity, 
  Calendar, 
  UserPlus,
  Pill,
  LogOut,
  Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [pacientesHoy, setPacientesHoy] = useState(0);

  // EFECTO PARA LEER DE LA BD (CONTADOR REAL)
  useEffect(() => {
    const leerEstadisticas = async () => {
      try {
        const hoy = new Date().toLocaleDateString('en-CA'); 
        const q = query(collection(db, "consultas"), where("fechaBusqueda", "==", hoy));
        const snapshot = await getCountFromServer(q);
        setPacientesHoy(snapshot.data().count);
      } catch (error) {
        console.error("Error leyendo estadísticas:", error);
      }
    };
    leerEstadisticas();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Error al salir", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      
      {/* --- NAVBAR SUPERIOR --- */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
           <div className="bg-gradient-to-br from-blue-600 to-teal-500 p-2 rounded-lg text-white shadow-lg shadow-blue-500/20">
             <Activity size={24} />
           </div>
           <div>
             <h1 className="font-bold text-slate-800 text-lg leading-tight">SRS Médico</h1>
             <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Panel Administrativo</p>
           </div>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-700">{user?.nombre || 'Dr. Mario Sánchez'}</p>
              <p className="text-xs text-slate-500 flex items-center justify-end gap-1">
                <Building2 size={10} />
                {user?.sucursal || 'Dirección General'}
              </p>
           </div>
           <button 
             onClick={handleLogout}
             className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
             title="Cerrar Sesión"
           >
             <LogOut size={20} />
           </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* --- SALUDO Y FECHA --- */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Resumen Operativo</h2>
            <p className="text-slate-500">Estado actual de la red de sucursales.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-200 text-sm">
            <Calendar size={16} />
            <span>{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>

        {/* --- SECCIÓN 1: KPIS PRINCIPALES --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           {/* Card 1: Pacientes (CONECTADA) */}
           <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Users size={24} />
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Hoy</span>
              </div>
              <h3 className="text-3xl font-bold text-slate-800 animate-in fade-in">
                {pacientesHoy}
              </h3>
              <p className="text-sm text-slate-400 font-medium">Pacientes atendidos</p>
           </div>

           {/* Card 2: Alertas Críticas (ROJO) */}
           <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-full -mr-10 -mt-10 opacity-50"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                  <AlertTriangle size={24} />
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse">Acción Req.</span>
              </div>
              <h3 className="text-3xl font-bold text-slate-800 relative z-10">5</h3>
              <p className="text-sm text-slate-400 font-medium relative z-10">Stock Mínimo alcanzado</p>
           </div>

           {/* Card 3: Personal Activo */}
           <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                  <Activity size={24} />
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">4 Sucursales</span>
              </div>
              <h3 className="text-3xl font-bold text-slate-800">28</h3>
              <p className="text-sm text-slate-400 font-medium">Médicos y enfermeras online</p>
           </div>

           {/* Card 4: Inventario Total */}
           <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                  <Package size={24} />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-slate-800">1,204</h3>
              <p className="text-sm text-slate-400 font-medium">Unidades en farmacia</p>
           </div>
        </div>

        {/* --- SECCIÓN 2: PANELES DIVIDIDOS --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA IZQUIERDA (Acciones Rápidas) */}
          <div className="lg:col-span-2 space-y-6">
             <h3 className="text-lg font-bold text-slate-700">Gestión Rápida</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Botón Gestión Usuarios */}
                <button 
                  onClick={() => navigate('/admin/usuarios')}
                  className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100 transition-all text-left flex items-center gap-4"
                >
                  <div className="bg-blue-100 text-blue-600 p-4 rounded-full group-hover:scale-110 transition-transform">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 text-lg">Personal</h4>
                    <p className="text-sm text-slate-400">Crear cuentas, asignar roles.</p>
                  </div>
                </button>

                {/* 2. Botón Gestión Inventario */}
                <button 
                  onClick={() => navigate('/admin/inventario')}
                  className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-100 transition-all text-left flex items-center gap-4"
                >
                  <div className="bg-purple-100 text-purple-600 p-4 rounded-full group-hover:scale-110 transition-transform">
                    <Pill size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 text-lg">Farmacia</h4>
                    <p className="text-sm text-slate-400">Registrar medicamentos y stock.</p>
                  </div>
                </button>
                
                {/* 3. Botón Acceso a Agenda */}
                <button 
                  onClick={() => navigate('/agenda')}
                  className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-100 transition-all text-left flex items-center gap-4"
                >
                  <div className="bg-orange-100 text-orange-600 p-4 rounded-full group-hover:scale-110 transition-transform">
                    <Calendar size={24} /> 
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 text-lg">Agenda de Citas</h4>
                    <p className="text-sm text-slate-400">Ver programaciones.</p>
                  </div>
                </button>

                {/* 4. NUEVO BOTÓN: MONITOR DE ACTIVIDAD */}
                <button 
                  onClick={() => navigate('/admin/monitor')}
                  className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100 transition-all text-left flex items-center gap-4"
                >
                  <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full group-hover:scale-110 transition-transform">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 text-lg">Monitor en Vivo</h4>
                    <p className="text-sm text-slate-400">Productividad y asistencia.</p>
                  </div>
                </button>
             </div>

             {/* Tabla Resumen Reciente (Placeholder) */}
             <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
               <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                 <h4 className="font-bold text-slate-700">Movimientos Recientes</h4>
                 <button className="text-xs text-blue-600 font-bold hover:underline">Ver todo</button>
               </div>
               <div className="p-6 text-center text-slate-400 text-sm">
                 <p>Conectando con base de datos...</p>
               </div>
             </div>
          </div>

          {/* COLUMNA DERECHA (Centro de Alertas) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-fit">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <AlertTriangle size={18} className="text-orange-500" />
                Panel de Alertas
              </h3>
            </div>
            
            <div className="p-2">
              <div className="p-4 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border-b border-slate-50 last:border-0">
                 <div className="flex justify-between items-start">
                   <h5 className="font-bold text-slate-700 text-sm">Paracetamol 500mg</h5>
                   <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">AGOTADO</span>
                 </div>
                 <p className="text-xs text-slate-400 mt-1">Sucursal Norte • Quedan 0 cajas</p>
              </div>

              <div className="p-4 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border-b border-slate-50 last:border-0">
                 <div className="flex justify-between items-start">
                   <h5 className="font-bold text-slate-700 text-sm">Amoxicilina Susp.</h5>
                   <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full">VENCE PRONTO</span>
                 </div>
                 <p className="text-xs text-slate-400 mt-1">Sucursal Central • Vence: 20 Oct</p>
              </div>

               <div className="p-4 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                 <div className="flex justify-between items-start">
                   <h5 className="font-bold text-slate-700 text-sm">Jeringas 5ml</h5>
                   <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full">STOCK BAJO</span>
                 </div>
                 <p className="text-xs text-slate-400 mt-1">Sucursal Sur • Quedan 15 pzas</p>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 text-center">
               <button onClick={() => navigate('/admin/inventario')} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors w-full">
                 Gestionar Inventario
               </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default DashboardAdmin;