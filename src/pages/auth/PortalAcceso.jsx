import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  Stethoscope, 
  HeartPulse, 
  CalendarCheck, 
  Calculator,  
  Sparkles,    
  LogOut,
  ArrowRight,
  UserCircle
} from 'lucide-react';

const PortalAcceso = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Normalización de texto (seguridad para acentos/mayúsculas)
  const normalizar = (txt) => txt ? txt.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';

  const getRoleConfig = (rol) => {
    const rolLimpio = normalizar(rol);

    switch (rolLimpio) {
      case 'admin':
      case 'admin_maestro':
      case 'administrador':
        return {
          label: 'Administrador General',
          description: 'Control total del sistema',
          icon: <ShieldCheck size={56} className="text-white" />,
          path: '/admin/dashboard', 
          theme: 'from-blue-600 to-indigo-700', // Gradiente
          shadow: 'shadow-blue-500/30'
        };

      case 'medico':
      case 'doctor':
        return {
          label: 'Personal Médico',
          description: 'Consultorio y Expedientes',
          icon: <Stethoscope size={56} className="text-white" />,
          path: '/agenda', 
          theme: 'from-teal-500 to-emerald-600',
          shadow: 'shadow-teal-500/30'
        };

      case 'enfermeria':
      case 'enfermera': 
      case 'enfermero':
        return {
          label: 'Estación de Enfermería',
          description: 'Triage, Signos Vitales y Asignación',
          icon: <HeartPulse size={56} className="text-white" />,
          path: '/enfermeria/dashboard', 
          theme: 'from-rose-500 to-pink-600',
          shadow: 'shadow-rose-500/30'
        };

      case 'recepcion':
        return {
          label: 'Recepción',
          description: 'Atención al Paciente',
          icon: <CalendarCheck size={56} className="text-white" />,
          path: '/agenda',
          theme: 'from-violet-500 to-purple-600',
          shadow: 'shadow-violet-500/30'
        };

      case 'contadores':
        return {
          label: 'Contabilidad',
          description: 'Finanzas y Caja',
          icon: <Calculator size={56} className="text-white" />,
          path: '/admin/reportes',
          theme: 'from-slate-600 to-slate-800',
          shadow: 'shadow-slate-500/30'
        };

      case 'limpieza':
        return {
          label: 'Servicios Generales',
          description: 'Bitácoras de Mantenimiento',
          icon: <Sparkles size={56} className="text-white" />,
          path: '/admin/supervision',
          theme: 'from-cyan-500 to-blue-500',
          shadow: 'shadow-cyan-500/30'
        };

      default:
        return {
          label: 'Usuario Operativo',
          description: 'Acceso General al Sistema',
          icon: <UserCircle size={56} className="text-slate-400" />,
          path: '/agenda',
          theme: 'from-slate-700 to-slate-900',
          shadow: 'shadow-slate-500/30',
          isDefault: true
        };
    }
  };

  if (!user) return null; 

  const config = getRoleConfig(user.rol);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      {/* --- FONDO LIQUID (Efecto visual) --- */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-100/50 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>

      {/* --- TARJETA DE ACCESO (Glassmorphism) --- */}
      <div className="relative z-10 max-w-sm w-full bg-white/70 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/50 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Cabecera Usuario */}
        <div className="pt-10 pb-6 text-center px-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-500 mb-4 border-4 border-white shadow-sm">
            {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">¡Hola, {user.nombre?.split(' ')[0] || 'Usuario'}!</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">{user.email}</p>
        </div>

        {/* Cuerpo del Rol */}
        <div className="px-8 pb-10 flex flex-col items-center gap-6">
          
          {/* Icono del Rol con Gradiente */}
          <div className={`p-6 rounded-3xl bg-gradient-to-br ${config.theme} shadow-lg ${config.shadow} transform transition-transform hover:scale-105 duration-300`}>
            {config.icon}
          </div>

          <div className="text-center space-y-1">
            <h2 className={`text-lg font-black uppercase tracking-wider bg-gradient-to-br ${config.theme} bg-clip-text text-transparent`}>
              {config.label}
            </h2>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              {config.description}
            </p>
          </div>

          {/* Botón Principal */}
          <button 
            onClick={() => navigate(config.path)}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl bg-gradient-to-r ${config.theme} ${config.shadow} hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3`}
          >
            Ingresar al Portal <ArrowRight size={20} />
          </button>

          {/* Botón Salir */}
          <button 
            onClick={() => { logout(); navigate('/'); }}
            className="text-slate-400 text-xs font-bold flex items-center gap-2 hover:text-red-500 transition-colors py-2"
          >
            <LogOut size={14} /> Cerrar Sesión Segura
          </button>

        </div>
        
        {/* Alerta Discreta si no hay rol */}
        {config.isDefault && (
          <div className="bg-orange-50 p-3 text-center border-t border-orange-100">
            <p className="text-[10px] text-orange-600 font-bold flex items-center justify-center gap-2">
              ⚠️ Rol no configurado correctamente.
            </p>
          </div>
        )}

      </div>

      <p className="mt-8 text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase opacity-60">
        Sistema Médico Santa Cruz v2.0
      </p>
    </div>
  );
};

export default PortalAcceso;