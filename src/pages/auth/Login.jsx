// src/pages/auth/Login.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo_azul.png';

/* ─────────────────────────────────────────────
   SVG Icons — médicos, únicos, sin lucide genérico
   ───────────────────────────────────────────── */
const IconID = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="3"/>
    <circle cx="8" cy="12" r="2.5"/>
    <line x1="13" y1="10" x2="20" y2="10"/>
    <line x1="13" y1="14" x2="18" y2="14"/>
  </svg>
);

const IconKey = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

const IconShieldX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
  </svg>
);

const IconShieldOk = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const IconArrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="13 6 19 12 13 18"/>
  </svg>
);

const IconWifi = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
  </svg>
);

const IconCross = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M12 2v20M2 12h20"/>
  </svg>
);

/* ─────────────────────────────────────────────
   Componente: Línea de Frecuencia Cardíaca SVG
   ───────────────────────────────────────────── */
const HeartbeatLine = () => {
  const path = "M0,30 L40,30 L50,30 L60,5 L70,55 L80,15 L90,30 L110,30 L120,30 L160,30";
  return (
    <svg viewBox="0 0 160 60" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="hbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0"/>
          <stop offset="40%" stopColor="#3b82f6" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#hbGrad)" strokeWidth="2" className="heartbeat-path"/>
    </svg>
  );
};

/* ─────────────────────────────────────────────
   Componente: Puntos de Grid decorativos
   ───────────────────────────────────────────── */
const DotGrid = ({ rows = 8, cols = 12 }) => (
  <div className="dot-grid absolute inset-0 pointer-events-none select-none overflow-hidden opacity-30">
    {Array.from({ length: rows }).map((_, r) =>
      Array.from({ length: cols }).map((_, c) => (
        <span key={`${r}-${c}`} style={{ top: `${(r + 1) * (100 / (rows + 1))}%`, left: `${(c + 1) * (100 / (cols + 1))}%` }} />
      ))
    )}
  </div>
);

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
   ───────────────────────────────────────────── */
const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'error' });

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  useEffect(() => {
    if (user?.rol) navigate('/portal');
  }, [user, navigate]);

  const showToast = (msg, type = 'error') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'error' }), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToast({ show: false, msg: '', type: 'error' });
    setLoading(true);
    try {
      const userData = await login(email, password);
      if (userData) {
        showToast("Credenciales verificadas. Accediendo...", "success");
        setTimeout(() => navigate('/portal'), 800);
      }
    } catch (err) {
      setLoading(false);
      if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(err.code)) {
        showToast("Credenciales clínicas no reconocidas.");
      } else if (err.code === 'auth/too-many-requests') {
        showToast("Acceso bloqueado por seguridad. Intente más tarde.");
      } else {
        showToast("Error de conexión con el servidor hospitalario.");
      }
    }
  };

  return (
    <>
      {/* ── ESTILOS GLOBALES ── */}
      <style>{`

@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        :root {
          --c-bg:        #f0f4f8;
          --c-surface:   #ffffff;
          --c-panel:     #e8edf3;
          --c-blue:      #2563eb;
          --c-blue-lt:   #dbeafe;
          --c-teal:      #0d9488;
          --c-ink:       #0f172a;
          --c-muted:     #64748b;
          --c-border:    #cbd5e1;
          --c-accent:    #f1f5f9;
          --radius-lg:   20px;
          --radius-xl:   28px;
          --radius-2xl:  40px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Aptos Display via font-face — fallback a system fonts con carácter similar */
        @font-face {
          font-family: 'Aptos Display';
          src: local('Aptos Display'), local('AptosDisplay');
          font-weight: 100 900;
        }

        body { font-family: 'Inter', sans-serif; }

        .font-aptos {
  font-family: 'Plus Jakarta Sans', 'Aptos Display', system-ui, sans-serif;
}

        /* ── ANIMACIÓN HEARTBEAT ── */
        .heartbeat-path {
          stroke-dasharray: 260;
          stroke-dashoffset: 260;
          animation: drawLine 2.4s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes drawLine {
          0%   { stroke-dashoffset: 260; opacity: 0; }
          10%  { opacity: 1; }
          60%  { stroke-dashoffset: 0; opacity: 1; }
          85%  { stroke-dashoffset: 0; opacity: 0.6; }
          100% { stroke-dashoffset: -260; opacity: 0; }
        }

        /* ── DOT GRID ── */
        .dot-grid span {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: #94a3b8;
        }

        /* ── DIAGONAL STRIPE (panel izquierdo) ── */
        .stripe-bg {
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 18px,
            rgba(37,99,235,0.03) 18px,
            rgba(37,99,235,0.03) 19px
          );
        }

        /* ── ENTRADA ANIMADA ── */
        .fade-up {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .delay-1 { transition-delay: 0.1s; }
        .delay-2 { transition-delay: 0.22s; }
        .delay-3 { transition-delay: 0.34s; }
        .delay-4 { transition-delay: 0.46s; }
        .delay-5 { transition-delay: 0.58s; }

        /* ── INPUT FOCUS ── */
        .med-input {
          width: 100%;
          background: var(--c-accent);
          border: 1.5px solid var(--c-border);
          border-radius: 14px;
          padding: 14px 16px 14px 50px;
          font-size: 14px;
          font-weight: 500;
          color: var(--c-ink);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .med-input::placeholder { color: #b0bec5; font-weight: 400; }
        .med-input:focus {
          border-color: var(--c-blue);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.10);
        }

        /* ── BOTÓN PRINCIPAL ── */
        .btn-primary {
          position: relative;
          width: 100%;
          background: var(--c-ink);
          color: #fff;
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
          overflow: hidden;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 8px 32px -8px rgba(15,23,42,0.35);
          font-family: 'Aptos Display', 'Segoe UI Variable Display', system-ui, sans-serif;
        }
        .btn-primary:hover { background: #1e3a5f; box-shadow: 0 12px 40px -8px rgba(15,23,42,0.45); }
        .btn-primary:active { transform: scale(0.985); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary .arrow-icon { transition: transform 0.2s; }
        .btn-primary:hover .arrow-icon { transform: translateX(4px); }

        /* Shimmer en hover */
        .btn-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          transform: translateX(-100%);
          transition: transform 0.5s;
        }
        .btn-primary:hover::after { transform: translateX(100%); }

        /* ── TOAST ── */
        .toast-bar {
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(-12px);
          z-index: 999;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 22px;
          border-radius: 50px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.01em;
          backdrop-filter: blur(16px);
          border: 1px solid;
          box-shadow: 0 16px 48px -8px rgba(0,0,0,0.18);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s, transform 0.4s;
          white-space: nowrap;
          font-family: 'Inter', sans-serif;
        }
        .toast-bar.visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
          pointer-events: auto;
        }
        .toast-bar.error { background: rgba(254,242,242,0.96); border-color: #fca5a5; color: #b91c1c; }
        .toast-bar.success { background: rgba(236,253,245,0.96); border-color: #6ee7b7; color: #065f46; }

        /* ── VITALS BADGE (panel izq) ── */
        .vitals-badge {
          background: #fff;
          border: 1px solid var(--c-border);
          border-radius: 16px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        }
        .vitals-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.2);
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
          50%       { box-shadow: 0 0 0 6px rgba(16,185,129,0.08); }
        }

        /* ── LÍNEA SEPARADORA VERTICAL (panel izq) ── */
        .vertical-rule {
          width: 1px;
          height: 80px;
          background: linear-gradient(to bottom, transparent, var(--c-border), transparent);
        }

        /* ── NÚMERO ESTADÍSTICO ── */
        .stat-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── SCROLL SUAVE ── */
        html { scroll-behavior: smooth; }

        /* ── SELECCIÓN ── */
        ::selection { background: var(--c-blue-lt); }

        /* Spinner */
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── VERSIÓN BADGE ── */
        .version-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--c-accent);
          border: 1px solid var(--c-border);
          border-radius: 50px;
          padding: 5px 14px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--c-muted);
          font-family: 'Inter', sans-serif;
        }

        /* ── NÚMERO GRANDE DECORATIVO ── */
        .deco-number {
          position: absolute;
          font-size: 200px;
          font-weight: 900;
          color: rgba(37,99,235,0.04);
          pointer-events: none;
          user-select: none;
          line-height: 1;
          font-family: 'Aptos Display', 'Segoe UI Variable Display', system-ui, sans-serif;
        }

        /* ── CROSS MEDICAL MARK ── */
        .cross-mark {
          position: absolute;
          color: rgba(37,99,235,0.12);
          animation: float 6s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>

      {/* ── TOAST ── */}
      <div className={`toast-bar ${toast.show ? 'visible' : ''} ${toast.type}`}>
        {toast.type === 'error' ? <IconShieldX /> : <IconShieldOk />}
        {toast.msg}
      </div>

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
      }}>

        {/* Gradiente de fondo */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(219,234,254,0.5) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(204,251,241,0.3) 0%, transparent 50%)'
        }}/>

        {/* Número decorativo */}
        <span className="deco-number font-aptos" style={{ bottom: '-60px', right: '-20px' }}>+</span>

        {/* Cruz médica flotante */}
        <div className="cross-mark" style={{ top: '10%', left: '5%', animationDelay: '0s' }}>
          <IconCross />
        </div>
        <div className="cross-mark" style={{ top: '70%', left: '3%', animationDelay: '2s', opacity: 0.6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
        </div>

        {/* ── CARD PRINCIPAL ── */}
        <div style={{
          width: '100%',
          maxWidth: '960px',
          background: 'var(--c-surface)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: '0 24px 80px -16px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.06)',
          display: 'flex',
          overflow: 'hidden',
          minHeight: '600px',
          position: 'relative',
        }}>

          {/* ════════════════════════════════
              PANEL IZQUIERDO — IDENTIDAD
              ════════════════════════════════ */}
          <div className="stripe-bg" style={{
            display: 'none',
            width: '42%',
            background: 'var(--c-panel)',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '48px 40px',
            borderRight: '1px solid var(--c-border)',
            position: 'relative',
            overflow: 'hidden',
          }}
          ref={el => {
            if (el) el.style.display = 'flex';
          }}
          id="left-panel">
            
            <DotGrid rows={10} cols={8} />

            {/* Top */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <img
                src={logoImg}
                alt="Centro Médico Santa Cruz"
                style={{ height: '52px', width: 'auto', objectFit: 'contain', marginBottom: '36px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
              />

              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '2px', background: 'var(--c-blue)', borderRadius: '2px' }}/>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--c-blue)', fontFamily: 'Inter, sans-serif' }}>
                  Sistema de Gestión
                </span>
              </div>

              <h2 className="font-aptos" style={{ fontSize: '34px', fontWeight: 700, color: 'var(--c-ink)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '16px' }}>
                Portal Clínico<br/>
              </h2>

              <p style={{ fontSize: '13px', color: 'var(--c-muted)', fontWeight: 400, lineHeight: 1.7, maxWidth: '280px' }}>
                Acceso restringido al personal médico autorizado. Las sesiones se registran conforme a los lineamientos de privacidad del paciente.
              </p>
            </div>

            {/* Heartbeat Monitor */}
            <div style={{ position: 'relative', zIndex: 1, marginBottom: '8px' }}>
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--c-muted)' }}>
                  Monitor de Red
                </span>
              </div>
              
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid var(--c-border)',
                padding: '16px 20px 20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                {/* Señal ECG */}
                <div style={{ height: '48px', marginBottom: '14px' }}>
                  <HeartbeatLine />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="vitals-badge" style={{ flex: 1 }}>
                    <div className="vitals-dot"/>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--c-muted)', marginBottom: '2px' }}>
                        Estado
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#065f46' }}>
                        Sistema Operativo
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            
          </div>

          {/* ════════════════════════════════
              PANEL DERECHO — FORMULARIO
              ════════════════════════════════ */}
          <div style={{
            flex: 1,
            padding: '56px 52px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#fff',
            position: 'relative',
          }}>

            {/* Header del formulario */}
            <div className={`fade-up ${mounted ? 'visible' : ''}`} style={{ marginBottom: '40px' }}>
              
              {/* Ícono médico destacado */}
              <div style={{
                width: '56px', height: '56px',
                background: 'linear-gradient(135deg, var(--c-blue-lt), #e0f2fe)',
                borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--c-blue)',
                marginBottom: '24px',
                boxShadow: '0 4px 16px rgba(37,99,235,0.15)',
                border: '1px solid rgba(37,99,235,0.12)',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>

              <h1 className="font-aptos" style={{
                fontSize: '30px', fontWeight: 700,
                color: 'var(--c-ink)', letterSpacing: '-0.025em',
                lineHeight: 1.2, marginBottom: '8px',
              }}>
                Identificación<br/>Clínica
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--c-muted)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconWifi />
                Ingrese sus credenciales para continuar
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              
              {/* Campo Email */}
              <div className={`fade-up delay-1 ${mounted ? 'visible' : ''}`} style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'var(--c-muted)', marginBottom: '8px', paddingLeft: '4px',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Identificador — Correo
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                    color: '#b0bec5', pointerEvents: 'none', transition: 'color 0.2s',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <IconID />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="med-input"
                    placeholder="Escribe tu correo"
                    onFocus={e => e.target.previousSibling.style.color = 'var(--c-blue)'}
                    onBlur={e => e.target.previousSibling.style.color = '#b0bec5'}
                  />
                </div>
              </div>

              {/* Campo Password */}
              <div className={`fade-up delay-2 ${mounted ? 'visible' : ''}`} style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'var(--c-muted)', marginBottom: '8px', paddingLeft: '4px',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Código de Seguridad
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                    color: '#b0bec5', pointerEvents: 'none', transition: 'color 0.2s',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <IconKey />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="med-input"
                    placeholder="Escribe tu contraseña"
                    onFocus={e => e.target.previousSibling.style.color = 'var(--c-blue)'}
                    onBlur={e => e.target.previousSibling.style.color = '#b0bec5'}
                  />
                </div>
              </div>

              {/* Botón */}
              <div className={`fade-up delay-3 ${mounted ? 'visible' : ''}`}>
                <button type="submit" className="btn-primary font-aptos" disabled={loading}>
                  {loading ? (
                    <>
                      <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Validando Acceso...
                    </>
                  ) : (
                    <>
                      Autorizar Ingreso
                      <span className="arrow-icon"><IconArrow /></span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className={`fade-up delay-5 ${mounted ? 'visible' : ''}`} style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
              <span className="version-badge">
                <IconWifi />
                Sistema Médico SRS v2.0 · Conexión Cifrada
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* Responsive: ocultar panel izq en mobile */}
      <style>{`
        @media (max-width: 768px) {
          #left-panel { display: none !important; }
          .font-aptos { font-family: 'Aptos Display', 'Segoe UI Variable Display', system-ui, sans-serif; }
        }
        @media (max-width: 640px) {
          /* ajustar padding del form en mobile */
        }
      `}</style>
    </>
  );
};

export default Login;