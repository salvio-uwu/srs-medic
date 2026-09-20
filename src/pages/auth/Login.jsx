// src/pages/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSessionLocation } from '../../context/SessionLocationContext';
import { resolveUserHomePath } from '../../services/permissionService';
import LocationSelector from '../../components/LocationSelector';
import logoImg from '../../assets/logo_azul.png';
import { consumeLogoutReason } from '../../utils/sessionIdle';
import { PUBLIC_SHELL_CSS } from '../../styles/publicShellStyles';

const LOGIN_EXTRA_CSS = `
  .spin { animation: pub-spin 0.8s linear infinite; }
  ::selection { background: rgba(15, 23, 42, 0.12); }
`;

/* ══════════════════════════════════════════
   ICONS — Form
══════════════════════════════════════════ */
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 7 10-7"/>
  </svg>
);
const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconArrow = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>
  </svg>
);
const IconBack = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/>
  </svg>
);
const IconShieldX = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
  </svg>
);
const IconShieldOk = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

/* ══════════════════════════════════════════
   ICONS — Roles (portal)
══════════════════════════════════════════ */
const IconShield28 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IconStethoscope28 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
    <circle cx="20" cy="10" r="2"/>
  </svg>
);
const IconHeart28 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconCalendar28 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    <polyline points="9 16 11 18 15 14"/>
  </svg>
);
const IconCalc28 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/>
    <line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/>
    <line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/>
    <line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>
    <line x1="8" y1="18" x2="12" y2="18"/>
  </svg>
);
const IconSparkle28 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);
const IconUser28 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

/* ══════════════════════════════════════════
   DECORATIVOS
══════════════════════════════════════════ */


/* ══════════════════════════════════════════
   ROLE CONFIG
══════════════════════════════════════════ */
const getRoleConfig = (rol) => {
  const r = rol
    ? rol.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    : '';
  switch (r) {
    case 'admin':
    case 'admin_maestro':
    case 'administrador':
      return { label: 'Administrador General', description: 'Control total del sistema', icon: <IconShield28 />, path: '/admin/dashboard', color: '#2563eb', colorLight: '#dbeafe', colorMid: '#bfdbfe' };
    case 'jefa_enfermeria':
    case 'jefa':
      return { label: 'Jefatura de Enfermeria', description: 'Auditoria y Centro de Mando', icon: <IconShield28 />, path: '/enfermeria/jefatura', color: '#4f46e5', colorLight: '#e0e7ff', colorMid: '#c7d2fe' };
    case 'medico':
    case 'doctor':
      return { label: 'Personal Medico', description: 'Consultorio y Expedientes', icon: <IconStethoscope28 />, path: '/agenda', color: '#0d9488', colorLight: '#ccfbf1', colorMid: '#99f6e4' };
    case 'enfermeria':
    case 'enfermera':
    case 'enfermero':
      return { label: 'Estacion de Enfermeria', description: 'Triage, Signos Vitales y Asignacion', icon: <IconHeart28 />, path: '/enfermeria/dashboard', color: '#e11d48', colorLight: '#ffe4e6', colorMid: '#fecdd3' };
    case 'recepcion':
      return { label: 'Recepcion', description: 'Atencion al Paciente', icon: <IconCalendar28 />, path: '/agenda', color: '#7c3aed', colorLight: '#ede9fe', colorMid: '#ddd6fe' };
    case 'rh':
    case 'recursos_humanos':
    case 'recursos humanos':
      return { label: 'Recursos Humanos', description: 'Auditoria, Inventarios Macro y Finanzas', icon: <IconCalc28 />, path: '/rh/dashboard', color: '#f59e0b', colorLight: '#fef3c7', colorMid: '#fde68a' };
    case 'intendencia':
    case 'limpieza':
      return { label: 'Intendencia y Limpieza', description: 'Gestion y Captura de Bitacoras', icon: <IconSparkle28 />, path: '/intendencia/registro', color: '#0ea5e9', colorLight: '#e0f2fe', colorMid: '#bae6fd' };
    default:
      return { label: 'Usuario Operativo', description: 'Acceso General al Sistema', icon: <IconUser28 />, path: '/agenda', color: '#475569', colorLight: '#f1f5f9', colorMid: '#e2e8f0', isDefault: true };
  }
};

/* ══════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════ */
const Login = () => {
  const { login, logout, user, loading } = useAuth();
  const { locationConfirmed, catalogosReady } = useSessionLocation();
  const navigate = useNavigate();
  const location = useLocation();

  const startsAtLogin = location.pathname === '/login';
  const [step, setStep] = useState(startsAtLogin ? 'form' : 'welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'error' });

  // Entrada animada del card
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Aviso si la sesión se cerró por inactividad
  useEffect(() => {
    const reason = consumeLogoutReason();
    if (reason === 'idle') {
      setToast({
        show: true,
        msg: 'Sesión cerrada por inactividad (30 min). Vuelve a iniciar sesión.',
        type: 'error',
      });
      const t = setTimeout(() => setToast({ show: false, msg: '', type: 'error' }), 7000);
      return () => clearTimeout(t);
    }
  }, []);

  // Tras autenticación, ir al home unificado
  useEffect(() => {
    if (!loading && user?.rol) {
      navigate('/inicio', { replace: true });
    }
  }, [loading, user?.rol, navigate]);

  const showToast = (msg, type = 'error') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'error' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToast({ show: false, msg: '', type: 'error' });
    setSubmitting(true);
    try {
      const userData = await login(email, password);
      if (userData) {
        showToast('Credenciales verificadas. Accediendo...', 'success');
        // El useEffect de user?.rol navega a /inicio al hidratar el perfil.
      }
    } catch (err) {
      if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(err.code)) {
        showToast('Credenciales no reconocidas.');
      } else if (err.code === 'auth/too-many-requests') {
        showToast('Acceso bloqueado. Intente mas tarde.');
      } else {
        showToast('Error de conexion.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSalir = async () => {
    try {
      await logout();
      setEmail('');
      setPassword('');
      setSubmitting(false);
      setStep('welcome');
    } catch (err) {
      console.error('Error al cerrar sesion:', err);
    }
  };

  // Config de rol (solo cuando hay usuario)
  const roleBase = user?.rol ? getRoleConfig(user.rol) : null;
  const config = roleBase && user
    ? { ...roleBase, path: resolveUserHomePath(user, roleBase.path) }
    : null;

  const initial = user ? (user.nombre || user.email || 'U').charAt(0).toUpperCase() : '';
  const firstName = user?.nombre?.split(' ')[0] || 'Usuario';

  // Clases CSS segun step
  const brandClass = 'ac-brand' + (step === 'portal' ? ' gone' : step === 'form' ? ' compact' : '');
  const welcomeClass = 'ac-welcome' + (step !== 'welcome' ? ' off' : '');
  const formClass = 'ac-form-area' + (step === 'form' ? ' open' : '');
  const portalClass = 'ac-portal' + (step === 'portal' ? ' open' : '');

  return (
    <>
      <style>{PUBLIC_SHELL_CSS}{LOGIN_EXTRA_CSS}</style>

      {/* Toast */}
      <div className={'ac-toast ' + (toast.show ? 'vis ' : '') + toast.type}>
        {toast.type === 'error' ? <IconShieldX /> : <IconShieldOk />}
        {toast.msg}
      </div>

      <div className="ac-shell">

        <div className={'ac-card ' + (mounted ? 'in' : '')}>

          {/* ── BRAND (logo + nombre clinica) ── */}
          <div className={brandClass}>
            <img src={logoImg} alt="Centro Medico Santa Cruz" className="ac-logo" />
            <h1 className="ac-clinica">Centro Medico Santa Cruz</h1>
          </div>

          {/* ── BIENVENIDA ── */}
          <div className={welcomeClass}>
            <p className="ac-subtitle">
              Bienvenido al sistema de gestion clinica.<br />
              Ingrese sus credenciales para continuar.
            </p>
            <button className="ac-btn" onClick={() => setStep('form')}>
              Iniciar sesion
              <span className="arr"><IconArrow /></span>
            </button>
          </div>

          {/* ── FORMULARIO ── */}
          <div className={formClass}>
            <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
              <div className="ac-field">
                <label className="ac-label">Correo</label>
                <div style={{ position: 'relative' }}>
                  <span className="ac-icon"><IconMail /></span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required className="ac-input" placeholder="Escribe tu correo" />
                </div>
              </div>
              <div className="ac-field" style={{ marginBottom: 0 }}>
                <label className="ac-label">Contrasena</label>
                <div style={{ position: 'relative' }}>
                  <span className="ac-icon"><IconLock /></span>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required className="ac-input" placeholder="Escribe tu contrasena" />
                </div>
              </div>
              <button type="submit" className="ac-btn" disabled={submitting} style={{ marginTop: 22 }}>
                {submitting ? (
                  <>
                    <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Verificando...
                  </>
                ) : (
                  <>Autorizar Ingreso <span className="arr"><IconArrow /></span></>
                )}
              </button>
            </form>
            {!startsAtLogin && (
              <button className="ac-ghost" onClick={() => setStep('welcome')}>
                <IconBack /> Regresar
              </button>
            )}
          </div>

          {/* ── PORTAL ── */}
          <div className={portalClass}>
            {config && (
              <>
                <div className="ap0" style={{ paddingTop: 8 }}>
                  <div className="ac-avatar">{initial}</div>
                </div>

                <div className="ap1" style={{ textAlign: 'center', marginTop: 14, marginBottom: 18 }}>
                  <h2 style={{
                    fontSize: 20, fontWeight: 650, color: '#0f172a',
                    letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 4,
                    fontFamily: "'Sora', system-ui, sans-serif",
                  }}>
                    Hola, {firstName}
                  </h2>
                  <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{user.email}</p>
                </div>

                <div style={{ height: 1, background: 'rgba(15, 23, 42, 0.06)', marginBottom: 16 }} />

                <div className="ap2 ac-role-badge">
                  <div className="ac-pulse" />
                  <div style={{ color: config.color, display: 'flex', alignItems: 'center' }}>
                    {config.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: "'Sora', system-ui, sans-serif" }}>
                      {config.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {config.description}
                    </div>
                  </div>
                </div>

                {catalogosReady && (
                  <div className="ap2" style={{ marginBottom: 14 }}>
                    <LocationSelector accentColor="#0f172a" required />
                  </div>
                )}

                <div className="ap3">
                  <button
                    className="ac-btn-role"
                    onClick={() => navigate(config.path)}
                    disabled={!locationConfirmed}
                  >
                    {locationConfirmed ? 'Ingresar al sistema' : 'Selecciona tu ubicación'}
                    {locationConfirmed && <IconArrow />}
                  </button>
                </div>

                <div className="ap4">
                  <button className="ac-ghost danger" onClick={handleSalir}>
                    <IconLogout /> Cerrar sesión
                  </button>
                </div>

                {config.isDefault && (
                  <div className="ac-warn">Rol no configurado correctamente. Contacta a administración.</div>
                )}
              </>
            )}
          </div>

          {/* ── FOOTER (solo en welcome/form) ── */}
          {step !== 'portal' && (
            <div className="ac-footer">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Centro Medico Santa Cruz &middot; Acceso seguro
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default Login;
