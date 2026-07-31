// src/pages/auth/PortalAcceso.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSessionLocation } from '../../context/SessionLocationContext';
import { resolveUserHomePath } from '../../services/permissionService';
import LocationSelector from '../../components/LocationSelector';

/* ─────────────────────────────────────────────
   SVG Icons — médicos, sin lucide
   ───────────────────────────────────────────── */
const IconShield = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const IconStethoscope = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
    <circle cx="20" cy="10" r="2"/>
  </svg>
);

const IconHeart = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    <polyline points="9 16 11 18 15 14"/>
  </svg>
);

const IconCalc = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/>
    <line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>
    <line x1="8" y1="18" x2="12" y2="18"/>
  </svg>
);

const IconSparkle = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

const IconUser = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>
  </svg>
);

const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconCross = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M12 2v20M2 12h20"/>
  </svg>
);

/* ─────────────────────────────────────────────
   Heartbeat Line
   ───────────────────────────────────────────── */
const HeartbeatLine = ({ color = '#3b82f6' }) => (
  <svg viewBox="0 0 160 40" className="w-full h-full" preserveAspectRatio="none">
    <defs>
      <linearGradient id={`hbg-${color.replace('#','')}`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={color} stopOpacity="0"/>
        <stop offset="40%" stopColor={color} stopOpacity="0.8"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path
      d="M0,20 L35,20 L45,20 L55,4 L65,36 L75,10 L85,20 L110,20 L160,20"
      fill="none"
      stroke={`url(#hbg-${color.replace('#','')})`}
      strokeWidth="2"
      style={{
        strokeDasharray: 260,
        strokeDashoffset: 260,
        animation: 'drawLine 2.4s cubic-bezier(.4,0,.2,1) infinite',
      }}
    />
  </svg>
);

/* ─────────────────────────────────────────────
   Dot Grid decorativo
   ───────────────────────────────────────────── */
const DotGrid = () => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: 0.25 }}>
    {Array.from({ length: 6 }).map((_, r) =>
      Array.from({ length: 8 }).map((_, c) => (
        <span key={`${r}-${c}`} style={{
          position: 'absolute',
          width: 3, height: 3, borderRadius: '50%', background: '#94a3b8',
          top: `${(r + 1) * (100 / 7)}%`,
          left: `${(c + 1) * (100 / 9)}%`,
        }}/>
      ))
    )}
  </div>
);

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
   ───────────────────────────────────────────── */
const PortalAcceso = () => {
  const { user, logout, loading } = useAuth(); // Importante traer 'loading' del context
  const { locationConfirmed, catalogosReady } = useSessionLocation();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  // Si el contexto sigue cargando la comunicación inicial con Firebase, mostramos el spinner
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleSalir = async () => {
    try { await logout(); navigate('/'); }
    catch (error) { console.error("Error al salir:", error); }
  };

  // Función de normalización mejorada para evitar fallos por tildes o espacios
  const normalizar = (txt) => txt
    ? txt.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    : '';

const getRoleConfig = (rol) => {
    // 1. Limpieza absoluta: minúsculas, sin acentos y sin espacios extra
    const r = rol ? rol.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
    
    // 2. LOG DE DEPURACIÓN (Revisa la consola con F12 si falla)
    console.log("DEBUG - Rol recibido:", rol, "| Rol normalizado:", r);

    switch (r) {
      case 'admin': 
      case 'admin_maestro': 
      case 'administrador':
        return {
          label: 'Administrador General',
          description: 'Control total del sistema',
          icon: <IconShield />,
          path: '/admin/dashboard',
          color: '#2563eb',
          colorLight: '#dbeafe',
          colorMid: '#bfdbfe',
          ecgColor: '#2563eb',
        };
      case 'jefa_enfermeria': 
      case 'jefa':
        return {
          label: 'Jefatura de Enfermería',
          description: 'Auditoría y Centro de Mando',
          icon: <IconShield />, 
          path: '/enfermeria/jefatura',
          color: '#4f46e5',
          colorLight: '#e0e7ff',
          colorMid: '#c7d2fe',
          ecgColor: '#4f46e5',
        };
      case 'medico': 
      case 'doctor':
        return {
          label: 'Personal Médico',
          description: 'Consultorio y Expedientes',
          icon: <IconStethoscope />,
          path: '/agenda',
          color: '#0d9488',
          colorLight: '#ccfbf1',
          colorMid: '#99f6e4',
          ecgColor: '#0d9488',
        };
      case 'enfermeria': 
      case 'enfermera': 
      case 'enfermero':
        return {
          label: 'Estación de Enfermería',
          description: 'Triage, Signos Vitales y Asignación',
          icon: <IconHeart />,
          path: '/enfermeria/dashboard',
          color: '#e11d48',
          colorLight: '#ffe4e6',
          colorMid: '#fecdd3',
          ecgColor: '#e11d48',
        };
      case 'recepcion':
        return {
          label: 'Recepción',
          description: 'Atención al Paciente',
          icon: <IconCalendar />,
          path: '/agenda',
          color: '#7c3aed',
          colorLight: '#ede9fe',
          colorMid: '#ddd6fe',
          ecgColor: '#7c3aed',
        };
      
      // --- NUEVO ROL: RECURSOS HUMANOS ---
      case 'rh': 
      case 'recursos_humanos':
      case 'recursos humanos':
        return {
          label: 'Recursos Humanos',
          description: 'Auditoría, Inventarios Macro y Finanzas',
          icon: <IconCalc />, 
          path: '/rh/dashboard',
          color: '#f59e0b',
          colorLight: '#fef3c7',
          colorMid: '#fde68a',
          ecgColor: '#f59e0b',
        };
      
      case 'intendencia': 
      case 'limpieza':
        return {
          label: 'Intendencia y Limpieza',
          description: 'Gestión y Captura de Bitácoras',
          icon: <IconSparkle />, 
          path: '/intendencia/registro', // <--- MODIFICAR ESTA LÍNEA
          color: '#0ea5e9',
          colorLight: '#e0f2fe',
          colorMid: '#bae6fd',
          ecgColor: '#0ea5e9',
        };
        
      default:
        return {
          label: 'Usuario Operativo',
          description: 'Acceso General al Sistema',
          icon: <IconUser />,
          path: '/agenda',
          color: '#475569',
          colorLight: '#f1f5f9',
          colorMid: '#e2e8f0',
          ecgColor: '#94a3b8',
          isDefault: true,
        };
    }
  };

  const configByRole = getRoleConfig(user.rol);
  const config = {
    ...configByRole,
    path: resolveUserHomePath(user, configByRole.path)
  };
  const initial = (user.nombre || user.email || 'U').charAt(0).toUpperCase();
  const firstName = user.nombre?.split(' ')[0] || 'Usuario';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');

        :root {
          --c-bg:     #f0f4f8;
          --c-surface:#ffffff;
          --c-border: #cbd5e1;
          --c-ink:    #0f172a;
          --c-muted:  #64748b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }
        .font-jakarta {
          font-family: 'Plus Jakarta Sans', 'Aptos Display', 'Segoe UI Variable Display', system-ui, sans-serif;
        }

        @keyframes drawLine {
          0%   { stroke-dashoffset: 260; opacity: 0; }
          10%  { opacity: 1; }
          60%  { stroke-dashoffset: 0; opacity: 1; }
          85%  { stroke-dashoffset: 0; opacity: 0.5; }
          100% { stroke-dashoffset: -260; opacity: 0; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up-0 { animation: fadeUp 0.55s ease both 0.05s; }
        .fade-up-1 { animation: fadeUp 0.55s ease both 0.15s; }
        .fade-up-2 { animation: fadeUp 0.55s ease both 0.25s; }
        .fade-up-3 { animation: fadeUp 0.55s ease both 0.38s; }
        .fade-up-4 { animation: fadeUp 0.55s ease both 0.50s; }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        .cross-float { animation: float 6s ease-in-out infinite; }
        .cross-float-2 { animation: float 8s ease-in-out infinite 2s; }

        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--pulse-rgb), 0.25); }
          50%       { box-shadow: 0 0 0 10px rgba(var(--pulse-rgb), 0); }
        }
        .pulse-ring { animation: pulse-ring 2.4s ease infinite; }

        .btn-main {
          width: 100%;
          border: none;
          border-radius: 14px;
          padding: 16px 24px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #fff;
          position: relative;
          overflow: hidden;
          transition: filter 0.2s, transform 0.15s;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }
        .btn-main:hover { filter: brightness(1.08); }
        .btn-main:active { transform: scale(0.985); }
        .btn-main::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
          transform: translateX(-100%);
          transition: transform 0.5s;
        }
        .btn-main:hover::after { transform: translateX(100%); }

        .btn-logout {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--c-muted);
          transition: color 0.2s;
          padding: 8px 12px;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
        }
        .btn-logout:hover { color: #e11d48; }

        .stripe-bg {
          background-image: repeating-linear-gradient(
            -45deg, transparent, transparent 18px,
            rgba(37,99,235,0.025) 18px, rgba(37,99,235,0.025) 19px
          );
        }

        ::selection { background: #dbeafe; }
      `}</style>

      {/* ── ROOT ── */}
      <div style={{
        minHeight: '100vh',
        background: 'var(--c-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}>

        {/* Gradiente de fondo dinámico según rol */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 70% 60% at 15% 0%, ${config.colorLight}80 0%, transparent 55%), radial-gradient(ellipse 55% 50% at 90% 100%, ${config.colorMid}50 0%, transparent 50%)`,
          transition: 'background 0.5s',
        }}/>

        {/* Cruces flotantes decorativas */}
        <div className="cross-float" style={{ position: 'absolute', top: '8%', left: '4%', color: `${config.color}20`, pointerEvents: 'none' }}>
          <IconCross />
        </div>
        <div className="cross-float-2" style={{ position: 'absolute', bottom: '12%', right: '5%', color: `${config.color}15`, pointerEvents: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
        </div>

        {/* ── CARD ── */}
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--c-surface)',
          borderRadius: '32px',
          boxShadow: '0 24px 80px -16px rgba(15,23,42,0.13), 0 0 0 1px rgba(15,23,42,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}>

          {/* ── HEADER con patrón + ECG ── */}
          <div className="stripe-bg" style={{
            background: config.colorLight,
            padding: '36px 36px 28px',
            position: 'relative',
            borderBottom: `1px solid ${config.colorMid}`,
            overflow: 'hidden',
          }}>
            <DotGrid />

            {/* Avatar */}
            <div className="fade-up-0" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <div>
                {/* Línea de categoría */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ width: '20px', height: '2px', background: config.color, borderRadius: '2px' }}/>
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: config.color, fontFamily: 'Inter, sans-serif' }}>
                    Acceso Verificado
                  </span>
                </div>

                {/* Inicial grande */}
                <div style={{
                  width: '64px', height: '64px',
                  borderRadius: '20px',
                  background: '#fff',
                  border: `2px solid ${config.colorMid}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 8px 24px -4px ${config.color}25`,
                }}>
                  <span className="font-jakarta" style={{ fontSize: '28px', fontWeight: 800, color: config.color }}>
                    {initial}
                  </span>
                </div>
              </div>

              {/* Ícono del rol */}
              <div style={{
                width: '56px', height: '56px',
                borderRadius: '18px',
                background: '#fff',
                border: `1px solid ${config.colorMid}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: config.color,
                boxShadow: `0 4px 16px -4px ${config.color}30`,
              }}>
                {config.icon}
              </div>
            </div>

            {/* Nombre y email */}
            <div className="fade-up-1" style={{ marginTop: '18px', position: 'relative', zIndex: 1 }}>
              <h1 className="font-jakarta" style={{
                fontSize: '22px', fontWeight: 800,
                color: 'var(--c-ink)', letterSpacing: '-0.02em',
                lineHeight: 1.2, marginBottom: '4px',
              }}>
                Hola, {firstName}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--c-muted)', fontWeight: 500 }}>
                {user.email}
              </p>
            </div>

            {/* ECG monitor */}
            <div className="fade-up-1" style={{ marginTop: '20px', height: '32px', position: 'relative', zIndex: 1 }}>
              <HeartbeatLine color={config.color} />
            </div>
          </div>

          {/* ── CUERPO ── */}
          <div style={{ padding: '28px 36px 36px' }}>

            {/* Rol badge */}
            <div className="fade-up-2" style={{
              background: config.colorLight,
              border: `1px solid ${config.colorMid}`,
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '24px',
            }}>
              {/* Dot pulsante */}
              <div
                className="pulse-ring"
                style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: config.color, flexShrink: 0,
                  '--pulse-rgb': config.color.replace('#','').match(/.{2}/g)?.map(x=>parseInt(x,16)).join(',') || '37,99,235',
                }}
              />
              <div>
                <div className="font-jakarta" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-ink)', letterSpacing: '-0.01em' }}>
                  {config.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px', fontWeight: 400 }}>
                  {config.description}
                </div>
              </div>
            </div>

            {/* Selector de ubicación */}
            {catalogosReady && (
              <div style={{ marginBottom: 16 }}>
                <LocationSelector accentColor={config.color} required />
              </div>
            )}

            {/* Botón principal */}
            <div className="fade-up-3">
              <button
                className="btn-main font-jakarta"
                onClick={() => navigate(config.path)}
                disabled={!locationConfirmed}
                style={{
                  background: locationConfirmed ? config.color : '#94a3b8',
                  boxShadow: locationConfirmed ? `0 8px 28px -6px ${config.color}55` : 'none',
                  cursor: locationConfirmed ? 'pointer' : 'not-allowed',
                  opacity: locationConfirmed ? 1 : 0.7,
                  transition: 'all 0.3s ease'
                }}
              >
                {locationConfirmed ? 'Ingresar al Portal' : 'Selecciona tu ubicación'}
                {locationConfirmed && <IconArrow />}
              </button>
            </div>

            {/* Logout */}
            <div className="fade-up-4" style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
              <button className="btn-logout" onClick={handleSalir}>
                <IconLogout />
                Cerrar Sesión Segura
              </button>
            </div>

          </div>

          {/* ── ALERTA ROL NO CONFIGURADO ── */}
          {config.isDefault && (
            <div style={{
              background: '#fff7ed',
              borderTop: '1px solid #fed7aa',
              padding: '12px 24px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '10px', color: '#c2410c', fontWeight: 700, letterSpacing: '0.04em' }}>
                ⚠ Rol no configurado correctamente
              </p>
            </div>
          )}

          {/* ── FOOTER ── */}
          <div style={{
            borderTop: '1px solid #f1f5f9',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <span style={{
              fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: '#b0bec5', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Sistema Médico SRS v2.0 · Sesión Cifrada
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default PortalAcceso;