// src/pages/auth/Login.jsx
import React, { useState, useEffect } from 'react'; // 1. Importamos useEffect
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn, AlertCircle, Lock, Mail, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  // 2. Extraemos 'user' además de 'login' para poder vigilar su estado
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 3. EFECTO DE REDIRECCIÓN AUTOMÁTICA
  // Este bloque se ejecuta cada vez que cambia el objeto 'user'.
  // Solo navega cuando el usuario existe Y ya tiene el rol cargado desde la BD.
  useEffect(() => {
    if (user && user.rol) {
      navigate('/portal');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 4. Solo ejecutamos la autenticación
      await login(email, password);
      
      // IMPORTANTE: Hemos quitado navigate('/portal') de aquí.
      // Dejamos que el useEffect de arriba se encargue cuando los datos estén listos.
      
      // Nota: No ponemos setLoading(false) aquí para que el botón siga mostrando 
      // "Iniciando..." mientras se cargan los datos del perfil en segundo plano.

    } catch (err) {
      console.error("Error login:", err);
      // 5. Solo detenemos la carga si hubo un error
      setLoading(false);

      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Correo o contraseña incorrectos.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Cuenta bloqueada temporalmente por intentos fallidos.");
      } else {
        setError("Error de conexión: " + err.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 font-sans">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        
        {/* Lado Izquierdo: Branding */}
        <div className="hidden md:block space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              Centro Médico <span className="text-blue-600">Santa Cruz</span>
            </h1>
            <p className="text-slate-500 text-lg">
              Sistema Integral de Gestión Hospitalaria (SRS).
            </p>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-xl shadow-sm">
            <div className="flex items-start gap-3">
              <Lock className="text-blue-600 mt-1 shrink-0" size={20} />
              <div>
                <h3 className="font-bold text-blue-800 text-sm mb-1">Acceso Seguro</h3>
                <p className="text-blue-700 text-xs leading-relaxed">
                  Ingresa tus credenciales para acceder al Portal de Servicios.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Info size={16} />
            <span>Versión 1.2.0 (Portal Activado)</span>
          </div>
        </div>

        {/* Lado Derecho: Formulario */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
          
          <div className="text-center mb-8">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-inner">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Bienvenido</h2>
            <p className="text-slate-400 text-sm">Ingresa tus credenciales</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="mt-0.5 shrink-0" /> 
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Correo Electrónico</label>
              <div className="relative group">
                <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Mail size={20} />
                </div>
                <input 
                  type="email" 
                  required
                  className="w-full pl-10 p-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  placeholder="usuario@santacruz.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Contraseña</label>
              <div className="relative group">
                <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  required
                  className="w-full pl-10 p-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Iniciando...
                </span>
              ) : (
                <>
                  Ingresar al Sistema <LogIn size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
             <p className="text-xs text-slate-400">
               SRS Médico v1.2 | Soporte Técnico
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;