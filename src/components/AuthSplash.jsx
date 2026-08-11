// src/components/AuthSplash.jsx
import React, { useEffect, useState } from 'react';
import logoImg from '../assets/logo_azul.png';

/*
 * Splash visible mientras AuthContext resuelve sesión / perfil.
 * Mismo lenguaje visual que Login.jsx (shell, orbes, glass card, tipografías)
 * para que la transición al login o al sistema sea continua.
 */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');

  .as-shell {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; position: relative; overflow: hidden;
    background: linear-gradient(140deg, #eef4fb 0%, #ddeeff 55%, #e8f3fd 100%);
    font-family: 'Inter', sans-serif;
  }
  .as-orb {
    position: absolute; border-radius: 50%;
    pointer-events: none; filter: blur(90px); opacity: 0.85;
  }

  .as-card {
    position: relative; width: 100%; max-width: 420px;
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(255,255,255,0.88);
    border-radius: 28px;
    padding: 44px 40px 36px;
    box-shadow: 0 24px 64px rgba(30,80,160,0.13), 0 0 0 1px rgba(30,80,160,0.06), inset 0 1px 0 rgba(255,255,255,0.9);
    overflow: hidden; text-align: center;
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.55s ease, transform 0.55s ease;
  }
  .as-card.in { opacity: 1; transform: translateY(0); }

  .as-logo {
    height: 66px; width: auto; object-fit: contain; display: block;
    margin: 0 auto 18px;
  }
  .as-clinica {
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    font-size: 22px; font-weight: 700; color: #0f172a;
    letter-spacing: -0.02em; line-height: 1.2; margin: 0;
  }
  .as-sub {
    font-size: 13px; color: #64748b; line-height: 1.65;
    margin: 16px 0 26px;
  }

  /* Barra indeterminada (sin porcentaje: no sabemos cuánto falta) */
  .as-bar-track {
    height: 6px; border-radius: 999px;
    background: rgba(37, 99, 235, 0.10);
    overflow: hidden; position: relative;
  }
  .as-bar-fill {
    position: absolute; top: 0; bottom: 0; width: 42%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #0ea5e9);
    animation: as-sweep 1.15s cubic-bezier(.45,.15,.35,.85) infinite;
  }
  @keyframes as-sweep {
    from { left: -44%; }
    to   { left: 102%; }
  }

  .as-status {
    margin-top: 14px; font-size: 12px; font-weight: 600; color: #94a3b8;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .as-status .spin { animation: as-spin 0.8s linear infinite; }
  @keyframes as-spin { to { transform: rotate(360deg); } }

  .as-footer {
    margin-top: 26px; padding-top: 18px; border-top: 1px solid #f1f5f9;
    font-size: 11px; color: #b0bec5;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  @media (max-width: 480px) {
    .as-card { padding: 36px 22px 28px; border-radius: 22px; }
    .as-logo { height: 54px; }
    .as-clinica { font-size: 20px; }
  }
`;

export default function AuthSplash() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="as-shell" role="status" aria-live="polite" aria-busy="true">
        <div className="as-orb" style={{ width: 500, height: 500, top: '-150px', left: '-100px', background: 'rgba(37,99,235,0.18)' }} />
        <div className="as-orb" style={{ width: 380, height: 380, bottom: '-90px', right: '-70px', background: 'rgba(13,148,136,0.14)' }} />
        <div className="as-orb" style={{ width: 200, height: 200, top: '38%', right: '8%', background: 'rgba(99,102,241,0.10)' }} />

        <div className={'as-card' + (mounted ? ' in' : '')}>
          <img src={logoImg} alt="Centro Medico Santa Cruz" className="as-logo" />
          <h1 className="as-clinica">Centro Medico Santa Cruz</h1>
          <p className="as-sub">Preparando el sistema de gestion clinica.</p>

          <div className="as-bar-track" aria-hidden="true">
            <div className="as-bar-fill" />
          </div>
          <div className="as-status">
            <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Verificando sesion
          </div>

          <div className="as-footer">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Centro Medico Santa Cruz &middot; Acceso seguro
          </div>
        </div>
      </div>
    </>
  );
}
