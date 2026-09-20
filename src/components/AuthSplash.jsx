// src/components/AuthSplash.jsx
import React, { useEffect, useState } from 'react';
import logoImg from '../assets/logo_azul.png';
import { PUBLIC_SHELL_CSS } from '../styles/publicShellStyles';

/*
 * Splash visible mientras AuthContext resuelve sesión / perfil.
 * Mismo lenguaje visual que Login y AppShell (DM Sans + Sora, #f7f8fa).
 */
export default function AuthSplash({
  status = 'Verificando sesion',
  subtitle = 'Preparando el sistema de gestion clinica.',
  onRetry = null,
  onLogout = null,
  busy = true,
}) {
  const [mounted, setMounted] = useState(false);
  const [working, setWorking] = useState(false);
  const showActions = Boolean(onRetry || onLogout);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleRetry = async () => {
    if (!onRetry || working) return;
    setWorking(true);
    try {
      await onRetry();
    } finally {
      setWorking(false);
    }
  };

  const handleLogout = async () => {
    if (!onLogout || working) return;
    setWorking(true);
    try {
      await onLogout();
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <style>{PUBLIC_SHELL_CSS}</style>
      <div className="as-shell" role="status" aria-live="polite" aria-busy={busy && !showActions}>
        <div className={'as-card' + (mounted ? ' in' : '')}>
          <img src={logoImg} alt="Centro Medico Santa Cruz" className="as-logo" />
          <h1 className="as-clinica">Centro Medico Santa Cruz</h1>
          <p className="as-sub">{subtitle}</p>

          {!showActions && (
            <div className="as-bar-track" aria-hidden="true">
              <div className="as-bar-fill" />
            </div>
          )}
          <div className="as-status">
            {!showActions && (
              <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {status}
          </div>

          {showActions && (
            <div className="as-actions">
              {onRetry && (
                <button type="button" className="as-btn as-btn-primary" onClick={handleRetry} disabled={working}>
                  {working ? 'Reintentando...' : 'Reintentar'}
                </button>
              )}
              {onLogout && (
                <button type="button" className="as-btn as-btn-ghost" onClick={handleLogout} disabled={working}>
                  Cerrar sesion
                </button>
              )}
            </div>
          )}

          <div className="as-footer">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Centro Medico Santa Cruz · Acceso seguro
          </div>
        </div>
      </div>
    </>
  );
}
