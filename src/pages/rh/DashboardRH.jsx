// src/pages/admin/DashboardAdmin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getCountFromServer, getDocs } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import { useAuth } from '../../context/AuthContext';
import { LogOut, Activity, Calendar as CalIcon, Users, Package, AlertTriangle, UserPlus, Pill, TrendingUp, ArrowRight } from 'lucide-react';

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pacientesHoy: 0,
    personalActivo: 0,
    inventarioTotal: 0,
    alertasInventario: []
  });

  const [fechaActual, setFechaActual] = useState('');

  useEffect(() => {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setFechaActual(new Date().toLocaleDateString('es-MX', opciones));

    const auditarSistema = async () => {
      try {
        setLoading(true);
        
        // 1. Pacientes Atendidos Hoy
        const hoy = new Date().toLocaleDateString('en-CA'); 
        const qConsultas = query(collection(db, "consultas"), where("fechaBusqueda", "==", hoy));
        const snapConsultas = await getCountFromServer(qConsultas);
        
        // 2. Personal Activo en Tiempo Real
        const qUsers = query(collection(db, "users"), where("isOnline", "==", true));
        const snapUsers = await getCountFromServer(qUsers);

        // 3. Auditoría de Inventario (Total de unidades y Alertas de Stock)
        const snapInv = await getDocs(collection(db, "inventario"));
        let totalUnidades = 0;
        let alertas = [];

        snapInv.forEach(doc => {
          const data = doc.data();
          const stock = parseInt(data.stock) || 0;
          const minimo = parseInt(data.stockMinimo) || 5; // Asumimos 5 si no hay mínimo configurado
          
          totalUnidades += stock;

          if (stock <= minimo) {
            alertas.push({
              id: doc.id,
              nombre: data.nombre || data.medicamento || 'Medicamento',
              stock: stock,
              sucursal: data.sucursal || 'General'
            });
          }
        });

        // Ordenamos las alertas para que los de menor stock salgan primero
        alertas.sort((a, b) => a.stock - b.stock);

        setStats({
          pacientesHoy: snapConsultas.data().count,
          personalActivo: snapUsers.data().count,
          inventarioTotal: totalUnidades,
          alertasInventario: alertas.slice(0, 5) // Mostramos solo top 5 alertas
        });

      } catch (error) {
        console.error("Error auditando base de datos:", error);
      } finally {
        setLoading(false);
      }
    };

    auditarSistema();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Error al salir", error);
    }
  };

  const firstName = user?.nombre?.split(' ')[0] || 'Administrador';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        .font-jakarta { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .font-inter { font-family: 'Inter', system-ui, sans-serif; }
        
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        
        .glass-card {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 10px 30px -10px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.03);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .action-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -10px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.05);
        }

        .stripe-bg {
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(15,23,42,0.015) 18px, rgba(15,23,42,0.015) 19px);
        }
      `}</style>

      <div className="min-h-screen bg-[#f4f7f9] font-inter pb-10">
        
        {/* --- NAVBAR SUPERIOR ELEGANTE --- */}
        <nav className="bg-white/80 backdrop-blur-xl border-b border-[#e2e8f0] sticky top-0 z-20 px-8 py-4 flex justify-between items-center shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-[#0f172a] rounded-xl flex items-center justify-center text-white shadow-md">
               <Activity size={20} />
             </div>
             <div>
               <h1 className="font-jakarta font-extrabold text-[#0f172a] text-lg leading-tight tracking-tight">SRS Médico</h1>
               <p className="text-[10px] text-[#64748b] font-bold tracking-widest uppercase">Dirección General</p>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-right hidden md:block">
                <p className="text-[13px] font-bold text-[#0f172a]">{user?.nombre || 'Administrador'}</p>
                <p className="text-[11px] text-[#64748b] font-medium">{user?.email}</p>
             </div>
             <button onClick={handleLogout} className="p-2 text-[#94a3b8] hover:text-[#e11d48] hover:bg-[#fff1f2] rounded-xl transition-all" title="Cerrar Sesión Segura">
               <LogOut size={18} />
             </button>
          </div>
        </nav>

        <main className="max-w-[1400px] mx-auto p-6 md:p-10 space-y-8">
          
          {/* --- HEADER --- */}
          <div className="fade-up flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="font-jakarta text-3xl font-extrabold text-[#0f172a] tracking-tight mb-2">
                Hola, {firstName}
              </h2>
              <p className="text-[14px] text-[#64748b] font-medium">
                Panel de control maestro. Conectado a la red hospitalaria en tiempo real.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[#64748b] bg-white px-5 py-2.5 rounded-full border border-[#e2e8f0] shadow-sm text-[12px] font-bold capitalize tracking-wide">
              <CalIcon size={16} />
              {fechaActual}
            </div>
          </div>

          {/* --- KPIs PRINCIPALES (DATOS REALES) --- */}
          <div className="fade-up delay-1 grid grid-cols-1 md:grid-cols-4 gap-5">
             
             <div className="glass-card stripe-bg p-6 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-[#64748b] group-hover:text-blue-600 transition-colors"><Users size={22} /></div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase tracking-wider">Hoy</span>
                </div>
                <h3 className="font-jakarta text-4xl font-extrabold text-[#0f172a]">{loading ? '--' : stats.pacientesHoy}</h3>
                <p className="text-[12px] text-[#64748b] font-medium mt-1">Pacientes atendidos</p>
             </div>

             <div className="glass-card stripe-bg p-6 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-[#64748b] group-hover:text-emerald-500 transition-colors"><Activity size={22} /></div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> En Vivo
                  </div>
                </div>
                <h3 className="font-jakarta text-4xl font-extrabold text-[#0f172a]">{loading ? '--' : stats.personalActivo}</h3>
                <p className="text-[12px] text-[#64748b] font-medium mt-1">Personal conectado</p>
             </div>

             <div className="glass-card stripe-bg p-6 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-[#64748b] group-hover:text-purple-600 transition-colors"><Package size={22} /></div>
                </div>
                <h3 className="font-jakarta text-4xl font-extrabold text-[#0f172a]">{loading ? '--' : stats.inventarioTotal.toLocaleString()}</h3>
                <p className="text-[12px] text-[#64748b] font-medium mt-1">Unidades en farmacia</p>
             </div>

             <div className={`glass-card p-6 relative overflow-hidden group ${stats.alertasInventario.length > 0 ? 'border-b-4 border-[#e11d48]' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className={`${stats.alertasInventario.length > 0 ? 'text-[#e11d48]' : 'text-[#64748b]'}`}><AlertTriangle size={22} /></div>
                  {stats.alertasInventario.length > 0 && (
                    <span className="text-[10px] font-bold text-[#e11d48] bg-[#fff1f2] px-2.5 py-1 rounded-md uppercase tracking-wider animate-pulse">Revisar</span>
                  )}
                </div>
                <h3 className={`font-jakarta text-4xl font-extrabold ${stats.alertasInventario.length > 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}>
                  {loading ? '--' : stats.alertasInventario.length}
                </h3>
                <p className="text-[12px] text-[#64748b] font-medium mt-1">Focos rojos de stock</p>
             </div>

          </div>

          {/* --- PANELES DIVIDIDOS --- */}
          <div className="fade-up delay-2 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* ACCIONES RÁPIDAS (Izquierda) */}
            <div className="lg:col-span-2 space-y-6">
               <h3 className="font-jakarta text-lg font-bold text-[#0f172a]">Gestión Hospitalaria</h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <button onClick={() => navigate('/admin/usuarios')} className="glass-card action-card p-6 text-left flex items-start gap-5 border border-transparent hover:border-[#cbd5e1] group">
                    <div className="bg-[#f1f5f9] text-[#475569] p-3.5 rounded-2xl group-hover:bg-[#0f172a] group-hover:text-white transition-colors">
                      <UserPlus size={22} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-jakarta font-bold text-[#0f172a] text-[15px] mb-1 flex justify-between items-center">
                        Directorio Médico <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#64748b]"/>
                      </h4>
                      <p className="text-[12px] text-[#64748b] leading-relaxed">Administración de credenciales, roles y altas de personal.</p>
                    </div>
                  </button>

                  <button onClick={() => navigate('/admin/inventario')} className="glass-card action-card p-6 text-left flex items-start gap-5 border border-transparent hover:border-[#cbd5e1] group">
                    <div className="bg-[#f1f5f9] text-[#475569] p-3.5 rounded-2xl group-hover:bg-[#0f172a] group-hover:text-white transition-colors">
                      <Pill size={22} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-jakarta font-bold text-[#0f172a] text-[15px] mb-1 flex justify-between items-center">
                        Inventario Maestro <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#64748b]"/>
                      </h4>
                      <p className="text-[12px] text-[#64748b] leading-relaxed">Control de almacén, entradas, salidas y catálogo.</p>
                    </div>
                  </button>

                  <button onClick={() => navigate('/admin/monitor')} className="glass-card action-card p-6 text-left flex items-start gap-5 border border-transparent hover:border-[#cbd5e1] group">
                    <div className="bg-[#f1f5f9] text-[#475569] p-3.5 rounded-2xl group-hover:bg-[#0f172a] group-hover:text-white transition-colors">
                      <TrendingUp size={22} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-jakarta font-bold text-[#0f172a] text-[15px] mb-1 flex justify-between items-center">
                        Monitor de Productividad <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#64748b]"/>
                      </h4>
                      <p className="text-[12px] text-[#64748b] leading-relaxed">Radar en vivo de ingresos, atenciones y tiempos.</p>
                    </div>
                  </button>

                  <button onClick={() => navigate('/admin/reportes')} className="glass-card action-card p-6 text-left flex items-start gap-5 border border-transparent hover:border-[#cbd5e1] group">
                    <div className="bg-[#f1f5f9] text-[#475569] p-3.5 rounded-2xl group-hover:bg-[#0f172a] group-hover:text-white transition-colors">
                      <Activity size={22} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-jakarta font-bold text-[#0f172a] text-[15px] mb-1 flex justify-between items-center">
                        Inteligencia de Negocios <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#64748b]"/>
                      </h4>
                      <p className="text-[12px] text-[#64748b] leading-relaxed">Reportes financieros, gráficas y análisis de datos.</p>
                    </div>
                  </button>
               </div>
            </div>

            {/* CENTRO DE ALERTAS REAL (Derecha) */}
            <div className="glass-card overflow-hidden h-fit flex flex-col">
              <div className="p-6 border-b border-[#e2e8f0] bg-[#f8fafc]">
                <h3 className="font-jakarta font-bold text-[#0f172a] flex items-center gap-2">
                  <AlertTriangle size={16} className={stats.alertasInventario.length > 0 ? 'text-[#e11d48]' : 'text-[#64748b]'} />
                  Focos Rojos Farmacia
                </h3>
                <p className="text-[11px] text-[#64748b] mt-1 font-medium tracking-wide">MEDICAMENTOS EN STOCK CRÍTICO</p>
              </div>
              
              <div className="flex-1">
                {loading ? (
                  <div className="p-8 text-center text-[12px] text-[#64748b] font-medium">Auditando base de datos...</div>
                ) : stats.alertasInventario.length === 0 ? (
                  <div className="p-8 text-center text-[12px] text-emerald-600 font-bold bg-emerald-50/30">
                    El inventario se encuentra estable.
                  </div>
                ) : (
                  stats.alertasInventario.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-[#f8fafc] border-b border-[#f1f5f9] last:border-0 transition-colors">
                       <div className="flex justify-between items-start mb-1">
                         <h5 className="font-bold text-[#0f172a] text-[13px]">{item.nombre}</h5>
                         <span className="bg-[#fff1f2] text-[#e11d48] text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border border-[#ffe4e6]">
                           {item.stock === 0 ? 'Agotado' : 'Crítico'}
                         </span>
                       </div>
                       <p className="text-[11px] text-[#64748b] font-medium">
                         Sucursal: {item.sucursal} <span className="mx-1">•</span> Quedan: {item.stock} pzas
                       </p>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
                 <button onClick={() => navigate('/admin/inventario')} className="w-full py-2 bg-white border border-[#cbd5e1] rounded-xl text-[12px] font-bold text-[#0f172a] hover:bg-[#0f172a] hover:text-white transition-colors shadow-sm">
                   Reabastecer Inventario
                 </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  );
};

export default DashboardAdmin;