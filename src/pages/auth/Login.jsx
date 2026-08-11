// src/pages/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSessionLocation } from '../../context/SessionLocationContext';
import { resolveUserHomePath } from '../../services/permissionService';
import LocationSelector from '../../components/LocationSelector';
import logoImg from '../../assets/logo_azul.png';
import { consumeLogoutReason } from '../../utils/sessionIdle';

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
   CSS
══════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; }

  /* Shell */
  .ac-shell {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; position: relative; overflow: hidden;
    background: linear-gradient(140deg, #eef4fb 0%, #ddeeff 55%, #e8f3fd 100%);
    font-family: 'Inter', sans-serif;
  }
  .ac-orb {
    position: absolute; border-radius: 50%;
    pointer-events: none; filter: blur(90px); opacity: 0.85;
  }

  /* Card */
  .ac-card {
    position: relative; width: 100%; max-width: 420px;
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(255,255,255,0.88);
    border-radius: 28px;
    padding: 44px 40px 36px;
    box-shadow: 0 24px 64px rgba(30,80,160,0.13), 0 0 0 1px rgba(30,80,160,0.06), inset 0 1px 0 rgba(255,255,255,0.9);
    overflow: hidden;
    text-align: center;
  }

  /* Entrada de la card */
  .ac-card { opacity: 0; transform: translateY(20px); transition: opacity 0.55s ease, transform 0.55s ease; }
  .ac-card.in { opacity: 1; transform: translateY(0); }

  /* ─── BRAND AREA (logo + nombre) ─── */
  .ac-brand {
    overflow: hidden;
    transition: max-height 0.42s cubic-bezier(.4,0,.2,1), opacity 0.3s ease, margin-bottom 0.42s;
    max-height: 180px; opacity: 1; margin-bottom: 0;
  }
  .ac-brand.gone { max-height: 0; opacity: 0; margin-bottom: 0; }
  .ac-logo {
    height: 66px; width: auto; object-fit: contain; display: block;
    margin: 0 auto 18px;
    transition: height 0.42s cubic-bezier(.4,0,.2,1), margin-bottom 0.42s;
  }
  .ac-brand.compact .ac-logo { height: 42px; margin-bottom: 10px; }
  .ac-clinica {
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    font-size: 22px; font-weight: 700; color: #0f172a;
    letter-spacing: -0.02em; line-height: 1.2;
    transition: font-size 0.42s cubic-bezier(.4,0,.2,1), color 0.3s ease;
  }
  .ac-brand.compact .ac-clinica { font-size: 15px; color: #475569; font-weight: 600; }

  /* ─── BLOQUE BIENVENIDA ─── */
  .ac-welcome {
    max-height: 260px; opacity: 1; overflow: hidden;
    transition: max-height 0.38s cubic-bezier(.4,0,.2,1), opacity 0.28s ease;
  }
  .ac-welcome.off { max-height: 0; opacity: 0; }
  .ac-subtitle {
    font-size: 13px; color: #64748b; line-height: 1.65;
    margin: 16px 0 28px;
  }

  /* ─── BLOQUE FORMULARIO ─── */
  .ac-form-area {
    max-height: 0; opacity: 0; overflow: hidden;
    transition: max-height 0.52s cubic-bezier(.4,0,.2,1) 0.14s, opacity 0.38s ease 0.16s;
  }
  .ac-form-area.open { max-height: 540px; opacity: 1; }

  /* ─── BLOQUE PORTAL ─── */
  .ac-portal {
    max-height: 0; opacity: 0; overflow: hidden;
    transition: max-height 0.58s cubic-bezier(.4,0,.2,1) 0.18s, opacity 0.42s ease 0.22s;
  }
  .ac-portal.open { max-height: 860px; opacity: 1; overflow: visible; }

  /* Dot pulsante */
  .ac-pulse {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    animation: ac-pulse-ring 2.2s ease infinite;
  }
  @keyframes ac-pulse-ring {
    0%,100% { box-shadow: 0 0 0 0 rgba(var(--pr),0.3); }
    50%      { box-shadow: 0 0 0 8px rgba(var(--pr),0); }
  }

  /* Animaciones portal items */
  @keyframes ac-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ap0 { animation: ac-up 0.45s ease both 0.28s; }
  .ap1 { animation: ac-up 0.45s ease both 0.38s; }
  .ap2 { animation: ac-up 0.45s ease both 0.46s; }
  .ap3 { animation: ac-up 0.45s ease both 0.54s; }
  .ap4 { animation: ac-up 0.45s ease both 0.62s; }

  /* Label e inputs */
  .ac-label {
    display: block; font-size: 10px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8;
    margin-bottom: 7px; text-align: left; padding-left: 2px;
  }
  .ac-field { margin-bottom: 14px; }
  .ac-input {
    width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0;
    border-radius: 13px; padding: 13px 16px 13px 44px;
    font-size: 14px; font-weight: 500; color: #0f172a; outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    font-family: 'Inter', sans-serif;
  }
  .ac-input::placeholder { color: #b0bec5; font-weight: 400; }
  .ac-input:focus { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 3px rgba(37,99,235,0.10); }
  .ac-icon {
    position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
    color: #b0bec5; pointer-events: none; display: flex; align-items: center;
  }

  /* Botón CTA / submit */
  .ac-btn {
    width: 100%; background: #0f172a; color: #fff;
    border: none; border-radius: 13px; padding: 15px 24px;
    font-size: 12px; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
    position: relative; overflow: hidden;
    transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 8px 28px -6px rgba(15,23,42,0.35);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  .ac-btn:hover { background: #1e3a5f; box-shadow: 0 10px 32px -6px rgba(15,23,42,0.45); }
  .ac-btn:active { transform: scale(0.985); }
  .ac-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ac-btn .arr { transition: transform 0.2s; }
  .ac-btn:hover .arr { transform: translateX(4px); }
  .ac-btn::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    transform: translateX(-100%); transition: transform 0.5s;
  }
  .ac-btn:hover::after { transform: translateX(100%); }

  /* Botón coloreado (portal) */
  .ac-btn-role {
    width: 100%; color: #fff; border: none; border-radius: 13px; padding: 15px 24px;
    font-size: 12px; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
    position: relative; overflow: hidden;
    transition: filter 0.2s, transform 0.15s;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  .ac-btn-role:hover { filter: brightness(1.08); }
  .ac-btn-role:active { transform: scale(0.985); }
  .ac-btn-role::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    transform: translateX(-100%); transition: transform 0.5s;
  }
  .ac-btn-role:hover::after { transform: translateX(100%); }

  /* Botón volver / logout */
  .ac-ghost {
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 12px; font-weight: 600; color: #94a3b8;
    transition: color 0.2s; padding: 8px 12px; border-radius: 10px;
    font-family: 'Inter', sans-serif; width: 100%; margin-top: 10px;
  }
  .ac-ghost:hover { color: #64748b; }
  .ac-ghost.danger:hover { color: #e11d48; }

  /* Footer */
  .ac-footer {
    margin-top: 26px; padding-top: 18px; border-top: 1px solid #f1f5f9;
    font-size: 11px; color: #b0bec5;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  /* Toast */
  .ac-toast {
    position: fixed; top: 24px; left: 50%;
    transform: translateX(-50%) translateY(-12px);
    z-index: 999; display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 50px;
    font-size: 13px; font-weight: 600;
    backdrop-filter: blur(16px); border: 1px solid;
    box-shadow: 0 16px 48px rgba(0,0,0,0.18);
    opacity: 0; pointer-events: none;
    transition: opacity 0.35s, transform 0.35s;
    white-space: nowrap; font-family: 'Inter', sans-serif;
  }
  .ac-toast.vis { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
  .ac-toast.error { background: rgba(254,242,242,0.96); border-color: #fca5a5; color: #b91c1c; }
  .ac-toast.success { background: rgba(236,253,245,0.96); border-color: #6ee7b7; color: #065f46; }

  /* Spinner */
  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Alerta rol no configurado */
  .ac-warn {
    background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px;
    padding: 9px 14px; margin-top: 12px; text-align: center;
    font-size: 10px; color: #c2410c; font-weight: 700; letter-spacing: 0.04em;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .ac-card { padding: 36px 22px 28px; border-radius: 22px; }
    .ac-logo { height: 54px; }
    .ac-brand.compact .ac-logo { height: 36px; }
    .ac-clinica { font-size: 20px; }
    .ac-brand.compact .ac-clinica { font-size: 14px; }
  }
  ::selection { background: #dbeafe; }
`;

/* ══════════════════════════════════════════
   ROLE CONFIG — copia exacta de PortalAcceso
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

  // Hex color -> rgb para CSS variable del pulso
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  };

  return (
    <>
      <style>{CSS}</style>

      {/* Toast */}
      <div className={'ac-toast ' + (toast.show ? 'vis ' : '') + toast.type}>
        {toast.type === 'error' ? <IconShieldX /> : <IconShieldOk />}
        {toast.msg}
      </div>

      <div className="ac-shell">
        {/* Orbes de luz */}
        <div className="ac-orb" style={{ width: 500, height: 500, top: '-150px', left: '-100px', background: 'rgba(37,99,235,0.18)' }}/>
        <div className="ac-orb" style={{ width: 380, height: 380, bottom: '-90px', right: '-70px', background: 'rgba(13,148,136,0.14)' }}/>
        <div className="ac-orb" style={{ width: 200, height: 200, top: '38%', right: '8%', background: 'rgba(99,102,241,0.10)' }}/>

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
                {/* Avatar centrado con gradiente */}
                <div className="ap0" style={{ textAlign: 'center', paddingTop: 10 }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <div style={{
                      width: 90, height: 90, borderRadius: '50%',
                      background: 'linear-gradient(135deg, ' + config.colorMid + ' 0%, ' + config.color + ' 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 14px 40px -8px ' + config.color + '60',
                    }}>
                      <span style={{
                        fontSize: 36, fontWeight: 800, color: '#fff',
                        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                        textShadow: '0 1px 6px rgba(0,0,0,0.18)',
                      }}>
                        {initial}
                      </span>
                    </div>
                    {/* Icono de rol como badge */}
                    <div style={{
                      position: 'absolute', bottom: -3, right: -3,
                      width: 32, height: 32, borderRadius: '50%',
                      background: '#fff', border: '2px solid ' + config.colorMid,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: config.color,
                      boxShadow: '0 4px 12px ' + config.color + '28',
                    }}>
                      <span style={{ display: 'flex', transform: 'scale(0.7)' }}>{config.icon}</span>
                    </div>
                  </div>
                </div>

                {/* Nombre y email */}
                <div className="ap1" style={{ textAlign: 'center', marginTop: 16, marginBottom: 22 }}>
                  <h2 style={{
                    fontSize: 22, fontWeight: 800, color: '#0f172a',
                    letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 5,
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  }}>
                    Hola, {firstName}
                  </h2>
                  <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{user.email}</p>
                </div>

                {/* Divisor */}
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #e2e8f0 25%, #e2e8f0 75%, transparent)', marginBottom: 18 }} />

                {/* Badge de rol */}
                <div className="ap2" style={{
                  background: config.colorLight, border: '1px solid ' + config.colorMid,
                  borderRadius: 14, padding: '13px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4,
                }}>
                  <div className="ac-pulse" style={{ background: config.color, '--pr': hexToRgb(config.color) }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                      {config.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {config.description}
                    </div>
                  </div>
                </div>

                {/* Selector de ubicación */}
                {catalogosReady && (
                  <div className="ap2" style={{ marginBottom: 16 }}>
                    <LocationSelector accentColor={config.color} required />
                  </div>
                )}

                {/* Boton ingresar */}
                <div className="ap3">
                  <button
                    className="ac-btn-role"
                    onClick={() => navigate(config.path)}
                    disabled={!locationConfirmed}
                    style={{
                      background: locationConfirmed ? config.color : '#94a3b8',
                      boxShadow: locationConfirmed ? '0 8px 24px -6px ' + config.color + '55' : 'none',
                      cursor: locationConfirmed ? 'pointer' : 'not-allowed',
                      opacity: locationConfirmed ? 1 : 0.7,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {locationConfirmed ? 'Ingresar al Portal' : 'Selecciona tu ubicación'}
                    {locationConfirmed && <IconArrow />}
                  </button>
                </div>

                {/* Cerrar sesion */}
                <div className="ap4">
                  <button className="ac-ghost danger" onClick={handleSalir}>
                    <IconLogout /> Cerrar Sesion Segura
                  </button>
                </div>

                {/* Alerta rol no configurado */}
                {config.isDefault && (
                  <div className="ac-warn">⚠ Rol no configurado correctamente</div>
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
