import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, BookOpen, CalendarDays, Clipboard,
  ClipboardList, Crown, DollarSign, Eye, FileText, FlaskConical, HeartPulse, Home,
  LayoutDashboard, LogOut, Menu, MessageCircle, Package, Receipt, ShieldCheck,
  SprayCan, Stethoscope, Syringe, Tag, UserCog, Users, X, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSessionLocation } from '../context/SessionLocationContext';
import { getGroupedNavForUser } from '../config/navigationCatalog';
import LocationSelector from '../components/LocationSelector';
import WelcomeLocationGate from '../components/WelcomeLocationGate';
import useIsMobile from '../hooks/useIsMobile';
import { rememberNavigationPath } from '../utils/navigation';

const ICON_MAP = {
  Home, CalendarDays, Users, Stethoscope, FileText, BookOpen, LayoutDashboard,
  Syringe, Clipboard, Crown, ClipboardList, HeartPulse, Package, Receipt,
  UserCog, Tag, BarChart3, MessageCircle, Activity, Eye, FlaskConical,
  ShieldCheck, DollarSign, SprayCan
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  .app-shell {
    font-family: 'DM Sans', 'Sora', system-ui, sans-serif;
    display: flex;
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    background: #f7f8fa;
    color: #111;
  }

  .app-sidebar {
    width: 256px;
    flex-shrink: 0;
    background: #fff;
    border-right: 1px solid rgba(15, 23, 42, 0.06);
    display: flex;
    flex-direction: column;
    transition: width .28s cubic-bezier(.22, 1, .36, 1);
    z-index: 40;
    overflow: visible;
  }
  .app-sidebar.collapsed { width: 64px; }
  @media (min-width: 769px) {
    .app-shell.with-rail {
      /* Reserva solo el rail; el hover flota encima del contenido */
      padding-left: 64px;
    }
    .app-sidebar {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      height: 100%;
    }
    .app-sidebar:not(.collapsed) {
      box-shadow: 8px 0 28px rgba(15, 23, 42, 0.06);
    }
  }

  .app-sidebar-brand {
    min-height: 64px;
    padding: 14px 16px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .app-brand-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0f172a;
  }
  .app-sidebar.collapsed .app-sidebar-brand {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }
  .app-brand-text {
    flex: 1;
    min-width: 0;
    opacity: 1;
    transform: translateX(0);
    transition: opacity .2s ease, transform .25s cubic-bezier(.22, 1, .36, 1);
  }
  .app-brand-title {
    font-family: 'Sora', system-ui, sans-serif;
    font-size: 12.5px;
    font-weight: 650;
    line-height: 1.25;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .app-brand-sub {
    margin-top: 2px;
    font-size: 10px;
    font-weight: 500;
    color: #94a3b8;
    letter-spacing: 0.01em;
  }

  .app-sidebar-collapse-btn {
    display: none;
  }

  .app-sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 4px 10px 12px;
  }
  .app-sidebar-nav::-webkit-scrollbar { width: 3px; }
  .app-sidebar-nav::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 99px;
  }
  .app-sidebar-nav:hover::-webkit-scrollbar-thumb { background: #e2e8f0; }

  .app-nav-group + .app-nav-group {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(15, 23, 42, 0.05);
  }

  .app-nav-group-label {
    font-size: 10px;
    font-weight: 600;
    color: #94a3b8;
    padding: 4px 12px 8px;
    white-space: nowrap;
    overflow: hidden;
    letter-spacing: 0.02em;
  }

  .app-nav-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #64748b;
    text-decoration: none;
    margin-bottom: 2px;
    white-space: nowrap;
    transition:
      color .2s ease,
      background .2s ease,
      transform .2s cubic-bezier(.22, 1, .36, 1),
      padding .2s ease;
  }
  .app-nav-link::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 2.5px;
    height: 0;
    border-radius: 99px;
    background: #0f172a;
    transform: translateY(-50%);
    opacity: 0;
    transition: height .22s cubic-bezier(.22, 1, .36, 1), opacity .18s ease;
  }
  .app-nav-link:hover {
    color: #0f172a;
    background: rgba(15, 23, 42, 0.035);
    transform: translateX(1px);
  }
  .app-nav-link:hover .app-nav-icon {
    color: #0f172a;
    transform: translateX(1px);
  }
  .app-nav-link.active {
    color: #0f172a;
    background: rgba(15, 23, 42, 0.05);
    font-weight: 600;
  }
  .app-nav-link.active::before {
    height: 16px;
    opacity: 1;
  }
  .app-nav-link.active .app-nav-icon {
    color: #0f172a;
  }
  .app-nav-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    background: none;
    transition: color .2s ease, transform .22s cubic-bezier(.22, 1, .36, 1);
  }
  .app-nav-label {
    opacity: 1;
    transform: translateX(0);
    transition: opacity .18s ease, transform .22s cubic-bezier(.22, 1, .36, 1);
  }

  .app-sidebar.collapsed .app-nav-link {
    justify-content: center;
    padding: 10px 0;
  }
  .app-sidebar.collapsed .app-nav-link:hover {
    transform: none;
  }

  .app-sidebar-location {
    padding: 8px 12px 4px;
    flex-shrink: 0;
  }

  .app-sidebar-user {
    padding: 8px 12px 14px;
    flex-shrink: 0;
  }
  .app-user-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px 10px;
    margin-bottom: 2px;
  }
  .app-user-avatar {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    letter-spacing: 0.02em;
    border: 1px solid rgba(15, 23, 42, 0.1);
    background: transparent;
  }
  .app-user-name {
    font-size: 12px;
    font-weight: 600;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .app-user-role {
    font-size: 11px;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-logout-btn {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    border: none;
    background: transparent;
    font-size: 12.5px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: color .2s ease, background .2s ease, transform .2s ease;
  }
  .app-logout-btn:hover:not(:disabled) {
    color: #b91c1c;
    background: rgba(185, 28, 28, 0.04);
  }
  .app-logout-btn:disabled {
    cursor: wait;
    color: #0f172a;
    background: rgba(15, 23, 42, 0.04);
    opacity: 1;
  }
  .app-logout-btn .app-logout-spinner {
    animation: app-spin .7s linear infinite;
  }
  @keyframes app-spin {
    to { transform: rotate(360deg); }
  }
  .app-sidebar.collapsed .app-logout-btn {
    justify-content: center;
    padding: 10px 0;
  }

  .app-shell.logging-out {
    pointer-events: none;
  }
  .app-shell.logging-out .app-main {
    opacity: 0.55;
    transition: opacity .25s ease;
  }
  .app-logout-overlay {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(247, 248, 250, 0.55);
    backdrop-filter: blur(4px);
    animation: app-fade-in .2s ease;
  }
  .app-logout-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
    color: #0f172a;
    font-size: 13px;
    font-weight: 600;
  }
  .app-logout-card svg {
    animation: app-spin .7s linear infinite;
    color: #64748b;
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .app-content {
    flex: 1;
    overflow: auto;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  }

  /* Expediente a pantalla completa: el scroll lo maneja el expediente, no el shell */
  .app-shell.expediente-mode .app-content {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .app-shell.expediente-mode .app-content > * {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  .app-mobile-fab-menu {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 30;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    display: none;
    align-items: center;
    justify-content: center;
    color: #475569;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    transition: transform .2s ease, background .2s ease;
  }
  .app-mobile-fab-menu:hover {
    background: #fff;
    transform: scale(1.03);
  }

  .app-mobile-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.28);
    z-index: 35;
    animation: app-fade-in .2s ease;
  }

  @keyframes app-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (max-width: 768px) {
    .app-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      transform: translateX(-104%);
      transition: transform .3s cubic-bezier(.22, 1, .36, 1);
      box-shadow: 8px 0 40px rgba(15, 23, 42, 0.1);
    }
    .app-sidebar.mobile-open {
      transform: translateX(0);
      width: 272px !important;
    }
    .app-mobile-fab-menu { display: flex !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .app-sidebar,
    .app-nav-link,
    .app-nav-icon,
    .app-logout-btn,
    .app-mobile-fab-menu,
    .app-sidebar-collapse-btn {
      transition: none !important;
    }
    .app-mobile-overlay { animation: none; }
  }
`;

const ROLE_LABELS = {
  medico: 'Médico', doctor: 'Médico', enfermeria: 'Enfermería', enfermera: 'Enfermería',
  enfermero: 'Enfermería', jefa_enfermeria: 'Jefa Enfermería', jefa: 'Jefa Enfermería',
  admin: 'Administrador', admin_maestro: 'Admin Maestro', administrador: 'Administrador',
  rh: 'Recursos Humanos', recepcion: 'Recepción', intendencia: 'Intendencia',
  operativo: 'Operativo', limpieza: 'Intendencia'
};

const roleLabel = (rol) => {
  const r = String(rol || '').toLowerCase().trim();
  return ROLE_LABELS[r] || rol || 'Usuario';
};

/** Rutas de ExpedienteClinico: sin sidebar para forzar salida con «Salir». */
const isExpedienteClinicoPath = (pathname = '') =>
  pathname === '/doctor/expediente'
  || pathname === '/enfermeria/expediente'
  || pathname === '/expediente-electronico';

const AppShell = () => {
  const { user, logout } = useAuth();
  const { catalogosReady, locationConfirmed } = useSessionLocation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const hideChrome = isExpedienteClinicoPath(location.pathname);

  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const leaveTimer = useRef(null);
  const leftWhileMenuOpen = useRef(false);

  useEffect(() => {
    // Modo rail por hover: limpiar preferencia antigua de pin/collapse
    try { localStorage.removeItem('app_shell_collapsed'); } catch {}
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    rememberNavigationPath(location.pathname, location.search);
  }, [location.pathname, location.search]);

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const groupedNav = useMemo(() => getGroupedNavForUser(user), [user]);
  // Desktop: siempre rail (colapsado); solo se expande con hover o si el menú de sucursal está abierto
  const expanded = isMobile || sidebarHovered || locationMenuOpen;

  const handleLocationOpenChange = (open) => {
    setLocationMenuOpen(open);
    if (!open && leftWhileMenuOpen.current) {
      leftWhileMenuOpen.current = false;
      setSidebarHovered(false);
    }
  };

  const initials = (user?.nombre || user?.email || 'U')
    .split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } catch {
      setLoggingOut(false);
    }
  };

  const isActivePath = (path) =>
    path === '/inicio'
      ? location.pathname === '/inicio'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`app-shell${loggingOut ? ' logging-out' : ''}${!hideChrome && !isMobile ? ' with-rail' : ''}${hideChrome ? ' expediente-mode' : ''}`}>
        {loggingOut && (
          <div className="app-logout-overlay" role="status" aria-live="polite">
            <div className="app-logout-card">
              <Loader2 size={18} strokeWidth={1.75} />
              Cerrando sesión…
            </div>
          </div>
        )}

        {catalogosReady && !locationConfirmed && !loggingOut && (
          <WelcomeLocationGate />
        )}

        {!hideChrome && isMobile && mobileOpen && (
          <div className="app-mobile-overlay" onClick={() => setMobileOpen(false)} aria-hidden />
        )}

        {!hideChrome && (
        <aside
          className={`app-sidebar${!expanded && !isMobile ? ' collapsed' : ''}${isMobile && mobileOpen ? ' mobile-open' : ''}`}
          onMouseEnter={() => {
            if (isMobile) return;
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
            leftWhileMenuOpen.current = false;
            setSidebarHovered(true);
          }}
          onMouseLeave={() => {
            if (isMobile) return;
            // Si el menú de sucursal está abierto (portal fuera del aside), no colapsar
            if (locationMenuOpen) {
              leftWhileMenuOpen.current = true;
              return;
            }
            leaveTimer.current = setTimeout(() => setSidebarHovered(false), 220);
          }}
        >
          <div className="app-sidebar-brand">
            <span className="app-brand-icon" aria-hidden>
              <HeartPulse size={18} strokeWidth={1.75} />
            </span>
            {expanded && (
              <div className="app-brand-text">
                <div className="app-brand-title">Centro Médico Santa Cruz</div>
                <div className="app-brand-sub">Portal clínico</div>
              </div>
            )}
          </div>

          <nav className="app-sidebar-nav">
            {groupedNav.map(({ group, items }) => (
              <div key={group} className="app-nav-group">
                {expanded && <div className="app-nav-group-label">{group}</div>}
                {items.map((item) => {
                  const Icon = ICON_MAP[item.icon] || Activity;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      state={
                        item.path === '/pacientes' || item.path === '/admin/pacientes'
                          ? { from: `${location.pathname}${location.search || ''}` }
                          : undefined
                      }
                      className={() => `app-nav-link${isActivePath(item.path) ? ' active' : ''}`}
                      title={!expanded ? item.label : undefined}
                      onClick={() => { if (isMobile) setMobileOpen(false); }}
                    >
                      <span className="app-nav-icon"><Icon size={17} strokeWidth={1.75} /></span>
                      {expanded && <span className="app-nav-label">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {expanded && catalogosReady && locationConfirmed && (
            <div className="app-sidebar-location">
              <LocationSelector
                accentColor="#0f172a"
                onOpenChange={handleLocationOpenChange}
              />
            </div>
          )}

          <div className="app-sidebar-user">
            {expanded && (
              <div className="app-user-chip">
                <div className="app-user-avatar">{initials}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="app-user-name">{user?.nombre || 'Usuario'}</div>
                  <div className="app-user-role">{roleLabel(user?.rol)}</div>
                </div>
              </div>
            )}
            <button
              type="button"
              className="app-logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              title={!expanded ? (loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión') : undefined}
            >
              {loggingOut
                ? <Loader2 size={16} strokeWidth={1.75} className="app-logout-spinner" />
                : <LogOut size={16} strokeWidth={1.75} />}
              {expanded && <span>{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>}
            </button>
          </div>
        </aside>
        )}

        <div className="app-main">
          {!hideChrome && isMobile && (
            <button
              type="button"
              className="app-mobile-fab-menu"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menú"
            >
              {mobileOpen ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
            </button>
          )}

          <main className="app-content">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default AppShell;
