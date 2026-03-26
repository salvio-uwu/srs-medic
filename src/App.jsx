import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Compass, HeartPulse, MessageCircle, Shield, Stethoscope, Users, X,
  LayoutDashboard, Package, UserCog, Eye, Tag, FileText, BarChart3, ClipboardList, Activity,
  CalendarDays, Syringe, Clipboard, Crown, DollarSign, SprayCan, ChevronRight
} from 'lucide-react';
import { db } from './config/firebase';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import Login from './pages/auth/Login';
import PortalAcceso from './pages/auth/PortalAcceso';
import ChatPanel from './components/ChatPanel';
import { useAuth } from './context/AuthContext';
import { hasPermission } from './services/permissionService';

// Layout Admin
import AdminLayout from './shared/AdminLayout';

// Módulos Administrativos
import DashboardAdmin from './pages/admin/DashboardAdmin';
import Inventario from './pages/admin/Inventario';
import Usuarios from './pages/admin/Usuarios';
import Supervision from './pages/admin/Supervision';
import Reportes from './pages/admin/Reportes'; 
import EncuestasSatisfaccion from './pages/admin/EncuestasSatisfaccion';
import MonitorActividad from './pages/admin/MonitorActividad';
import CatalogosGlobales from './pages/admin/CatalogosGlobales';
import PlantillasDocumentos from './pages/admin/PlantillasDocumentos';
const AuditoriaMigracion = lazy(() => import('./pages/admin/AuditoriaMigracion'));

// Módulos Doctor
import Consultorio from './pages/doctor/Consultorio'; 
import ExpedienteClinico from './pages/doctor/ExpedienteClinico'; 
import Pacientes from './pages/doctor/Pacientes';

// Módulos Intendencia
import RegistroLimpiezaManual from './pages/intendencia/RegistroLimpiezaManual';
// Módulos Enfermería
import AgendaEnfermeria from './pages/enfermeria/AgendaEnfermeria'; 
import Triage from './pages/enfermeria/Triage';
import HojaEnfermeria from './pages/enfermeria/HojaEnfermeria'; 
import DashboardJefaEnfermeria from './pages/enfermeria/DashboardJefaEnfermeria';
import RegistrosEnfermeriaView from './pages/enfermeria/RegistrosEnfermeriaView';

// Módulos Recursos Humanos
import DashboardRH from './pages/rh/DashboardRH';
import AuditoriaEmpleados from './pages/rh/AuditoriaEmpleados';
import InventarioMacro from './pages/rh/InventarioMacro';
import FinanzasRH from './pages/rh/FinanzasRH';

// Módulos Compartidos
import Agenda from './shared/Agenda';

const normalizeRole = (role = '') => String(role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const GlobalChatLauncher = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showLauncherMenu, setShowLauncherMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const initCanalesRef = useRef(false);
  const initPrivadosRef = useRef(false);
  const launcherRef = useRef(null);

  const rutasSinChat = ['/', '/portal'];
  const mostrarChat = Boolean(user?.uid) && !rutasSinChat.includes(location.pathname);

  useEffect(() => {
    if (!mostrarChat) {
      setIsChatOpen(false);
      setShowLauncherMenu(false);
      setShowShortcuts(false);
    }
  }, [mostrarChat, location.pathname]);

  const shortcutCandidates = useMemo(() => ([
    { id: 'admin.dashboard', label: 'Dashboard', path: '/admin/dashboard', group: 'Administracion', permission: 'admin.dashboard', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: LayoutDashboard },
    { id: 'admin.inventario', label: 'Inventario', path: '/admin/inventario', group: 'Administracion', permission: 'admin.dashboard', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: Package },
    { id: 'admin.usuarios', label: 'Usuarios', path: '/admin/usuarios', group: 'Administracion', permission: 'admin.usuarios', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: UserCog },
    { id: 'admin.supervision', label: 'Supervisión', path: '/admin/supervision', group: 'Administracion', permission: 'admin.monitor', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: Eye },
    { id: 'admin.catalogos', label: 'Catálogos', path: '/admin/catalogos', group: 'Administracion', permission: 'admin.catalogos', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: Tag },
    { id: 'admin.plantillas', label: 'Plantillas', path: '/admin/plantillas', group: 'Administracion', permission: 'admin.plantillas', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: FileText },
    { id: 'admin.reportes', label: 'Reportes', path: '/admin/reportes', group: 'Administracion', permission: 'admin.reportes', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: BarChart3 },
    { id: 'admin.encuestas', label: 'Encuestas', path: '/admin/encuestas', group: 'Administracion', permission: 'admin.reportes', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: ClipboardList },
    { id: 'admin.monitor', label: 'Monitor', path: '/admin/monitor', group: 'Administracion', permission: 'admin.monitor', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: Activity },
    { id: 'rh.dashboard', label: 'Dashboard', path: '/rh/dashboard', group: 'Recursos Humanos', permission: 'rh.dashboard', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: LayoutDashboard },
    { id: 'rh.auditoria', label: 'Auditoría', path: '/rh/auditoria', group: 'Recursos Humanos', permission: 'rh.auditoria', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: Clipboard },
    { id: 'rh.inventario', label: 'Inventario Macro', path: '/rh/inventario-macro', group: 'Recursos Humanos', permission: 'rh.inventario', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: Package },
    { id: 'rh.finanzas', label: 'Finanzas', path: '/rh/finanzas', group: 'Recursos Humanos', permission: 'rh.finanzas', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: DollarSign },
    { id: 'intendencia.registro', label: 'Registro', path: '/intendencia/registro', group: 'Intendencia', permission: 'intendencia.registro', fallbackRoles: ['intendencia', 'limpieza'], icon: SprayCan },
    { id: 'doctor.consulta', label: 'Consulta', path: '/doctor/consulta', group: 'Doctor', permission: 'doctor.agenda', fallbackRoles: ['medico', 'doctor'], icon: Stethoscope },
    { id: 'enfermeria.dashboard', label: 'Dashboard', path: '/enfermeria/dashboard', group: 'Enfermeria', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: LayoutDashboard },
    { id: 'enfermeria.triage', label: 'Triage', path: '/enfermeria/triage', group: 'Enfermeria', permission: 'enfermeria.triage', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: Syringe },
    { id: 'enfermeria.hoja', label: 'Hoja de enfermería', path: '/enfermeria/hoja-enfermeria', group: 'Enfermeria', permission: 'enfermeria.hoja', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: FileText },
    { id: 'enfermeria.jefatura', label: 'Jefatura', path: '/enfermeria/jefatura', group: 'Enfermeria', permission: 'enfermeria.jefatura', fallbackRoles: ['jefa_enfermeria', 'jefa'], icon: Crown },
    { id: 'shared.agenda', label: 'Agenda', path: '/agenda', group: 'General', permission: 'shared.agenda', fallbackRoles: ['admin', 'admin_maestro', 'administrador', 'medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion', 'operativo', 'jefa_enfermeria', 'jefa'], icon: CalendarDays },
    { id: 'shared.pacientes', label: 'Pacientes', path: '/pacientes', group: 'General', permission: 'shared.pacientes', fallbackRoles: ['admin', 'admin_maestro', 'administrador', 'medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion'], icon: Users },
  ]), []);

  const availableShortcuts = useMemo(() => {
    if (!user) return [];
    return shortcutCandidates.filter((r) => hasPermission(user, r.permission, r.fallbackRoles));
  }, [shortcutCandidates, user]);

  const groupedShortcuts = useMemo(() => {
    const groups = {
      General: [],
      Enfermeria: [],
      Doctor: [],
      Administracion: [],
      'Recursos Humanos': [],
      Intendencia: []
    };

    availableShortcuts.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });

    const iconMap = {
      General: Users,
      Enfermeria: HeartPulse,
      Doctor: Stethoscope,
      Administracion: Shield,
      'Recursos Humanos': Building2,
      Intendencia: Building2
    };

    const roleGroup = (() => {
      const role = normalizeRole(user?.rol);
      if (['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa'].includes(role)) return 'Enfermeria';
      if (['medico', 'doctor'].includes(role)) return 'Doctor';
      if (['admin', 'admin_maestro', 'administrador'].includes(role)) return 'Administracion';
      if (['rh', 'recursos_humanos', 'recursos humanos'].includes(role)) return 'Recursos Humanos';
      if (['intendencia', 'limpieza'].includes(role)) return 'Intendencia';
      return 'General';
    })();

    const priority = [roleGroup, 'General', 'Enfermeria', 'Doctor', 'Administracion', 'Recursos Humanos', 'Intendencia'];
    const uniquePriority = Array.from(new Set(priority));

    return uniquePriority
      .filter((groupName) => groups[groupName] && groups[groupName].length > 0)
      .map((groupName) => ({
        groupName,
        Icon: iconMap[groupName] || Compass,
        isPrimary: groupName === roleGroup,
        items: groups[groupName]
      }));
  }, [availableShortcuts, user?.rol]);

  useEffect(() => {
    if (!showLauncherMenu && !showShortcuts) return;

    const onMouseDown = (event) => {
      if (!launcherRef.current) return;
      if (!launcherRef.current.contains(event.target)) {
        setShowShortcuts(false);
        setShowLauncherMenu(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showLauncherMenu, showShortcuts]);

  useEffect(() => {
    const openHandler = () => setIsChatOpen(true);
    window.addEventListener('open-global-chat', openHandler);
    return () => window.removeEventListener('open-global-chat', openHandler);
  }, []);

  useEffect(() => {
    if (!mostrarChat || !user?.uid || isChatOpen) return;

    initCanalesRef.current = false;
    initPrivadosRef.current = false;

    const qCanales = query(collection(db, 'canales'), orderBy('ultimoMensajeAt', 'desc'), limit(20));
    const unsubCanales = onSnapshot(qCanales, (snap) => {
      if (!initCanalesRef.current) {
        initCanalesRef.current = true;
        return;
      }
      const hayNuevos = snap.docChanges().some((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return false;
        const data = change.doc.data();
        return data?.ultimoRemitenteId && data.ultimoRemitenteId !== user.uid;
      });
      if (hayNuevos) setHasUnread(true);
    });

    const qPrivados = query(
      collection(db, 'chats_privados'),
      where('participantes', 'array-contains', user.uid),
      limit(40)
    );
    const unsubPrivados = onSnapshot(qPrivados, (snap) => {
      if (!initPrivadosRef.current) {
        initPrivadosRef.current = true;
        return;
      }
      const hayNuevos = snap.docChanges().some((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return false;
        const data = change.doc.data();
        return data?.ultimoRemitenteId && data.ultimoRemitenteId !== user.uid;
      });
      if (hayNuevos) setHasUnread(true);
    });

    return () => {
      unsubCanales();
      unsubPrivados();
    };
  }, [mostrarChat, user?.uid, isChatOpen]);

  useEffect(() => {
    if (isChatOpen) setHasUnread(false);
  }, [isChatOpen]);

  if (!mostrarChat) return null;

  return (
    <>
      <div
        ref={launcherRef}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10,
            pointerEvents: showLauncherMenu ? 'auto' : 'none'
          }}
        >
          {availableShortcuts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowShortcuts((prev) => !prev)}
              title="Atajos"
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                border: showShortcuts ? '1px solid #7dd3fc' : '1px solid #d9e2ec',
                background: showShortcuts ? 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)' : '#ffffff',
                color: '#0369a1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(15,23,42,.12)',
                cursor: 'pointer',
                transform: showLauncherMenu ? 'translateY(0) scale(1)' : 'translateY(14px) scale(.92)',
                opacity: showLauncherMenu ? 1 : 0,
                transition: 'all .2s ease'
              }}
            >
              <Compass size={19} />
            </button>
          )}

          {!isChatOpen && (
            <button
              type="button"
              onClick={() => {
                setHasUnread(false);
                setShowShortcuts(false);
                setShowLauncherMenu(false);
                setIsChatOpen(true);
              }}
              title="Mensajes"
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                border: '1px solid #d9e2ec',
                background: '#ffffff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(15,23,42,.12)',
                cursor: 'pointer',
                position: 'relative',
                transform: showLauncherMenu ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.92)',
                opacity: showLauncherMenu ? 1 : 0,
                transition: 'all .22s ease'
              }}
            >
              <MessageCircle size={19} />
              {hasUnread && (
                <span
                  style={{
                    position: 'absolute',
                    top: 7,
                    right: 7,
                    width: 9,
                    height: 9,
                    borderRadius: '999px',
                    background: '#ef4444',
                    border: '2px solid #ffffff'
                  }}
                />
              )}
            </button>
          )}
        </div>

        {showShortcuts && (
          <div
            style={{
              position: 'absolute',
              right: 58,
              bottom: 62,
              width: 280,
              maxHeight: 480,
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              background: '#ffffff',
              boxShadow: '0 20px 40px rgba(15,23,42,.15), 0 2px 8px rgba(15,23,42,.06)',
              padding: '6px 0',
            }}
          >
            {groupedShortcuts.length === 0 ? (
              <div style={{ padding: '16px 14px', fontSize: 12, color: '#64748b' }}>Sin rutas asignadas.</div>
            ) : (
              groupedShortcuts.map(({ groupName, Icon, isPrimary, items }, gi) => (
                <div key={groupName}>
                  {/* group separator */}
                  <div style={{
                    padding: '10px 16px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#94a3b8',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    ...(gi > 0 ? { borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 12 } : {})
                  }}>
                    <Icon size={12} />
                    {groupName}
                    {isPrimary && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#0369a1',
                        background: '#e0f2fe',
                        borderRadius: 4,
                        padding: '1px 5px',
                        marginLeft: 'auto',
                      }}>
                        Tu rol
                      </span>
                    )}
                  </div>

                  {/* items */}
                  {items.map((shortcut) => {
                    const active = location.pathname === shortcut.path;
                    const ItemIcon = shortcut.icon || Compass;
                    return (
                      <button
                        key={shortcut.id}
                        type="button"
                        onClick={() => {
                          setShowShortcuts(false);
                          setShowLauncherMenu(false);
                          navigate(shortcut.path);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          background: active ? '#f0f9ff' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 16px',
                          borderRadius: 0,
                          transition: 'background .15s',
                          borderLeft: active ? '3px solid #0ea5e9' : '3px solid transparent',
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <ItemIcon size={16} style={{ color: active ? '#0ea5e9' : '#64748b', flexShrink: 0 }} />
                        <span style={{
                          fontSize: 13,
                          fontWeight: active ? 600 : 500,
                          color: active ? '#0c4a6e' : '#334155',
                          flex: 1,
                        }}>
                          {shortcut.label}
                        </span>
                        {active && <ChevronRight size={14} style={{ color: '#0ea5e9', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setShowLauncherMenu((prev) => {
              const next = !prev;
              if (!next) setShowShortcuts(false);
              return next;
            });
          }}
          title="Centro rapido"
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            border: showLauncherMenu ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
            background: showLauncherMenu ? 'linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)' : '#ffffff',
            color: showLauncherMenu ? '#ffffff' : '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 20px rgba(15,23,42,.14)',
            cursor: 'pointer',
            transition: 'all .2s ease'
          }}
        >
          {showLauncherMenu ? <X size={20} /> : <Compass size={21} />}
        </button>
      </div>
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};

function App() {
  const RequireAuth = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/" replace />;
    return children;
  };

  const PermissionRoute = ({ permissionId, fallbackRoles, children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/" replace />;
    if (!hasPermission(user, permissionId, fallbackRoles)) return <Navigate to="/portal" replace />;
    return children;
  };

  return (
    <BrowserRouter>
      <GlobalChatLauncher />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/portal" element={<RequireAuth><PortalAcceso /></RequireAuth>} />

        {/* --- RUTAS ADMINISTRADOR (layout compartido) --- */}
        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route path="dashboard" element={<PermissionRoute permissionId="admin.dashboard" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><DashboardAdmin /></PermissionRoute>} />
          <Route path="inventario" element={<PermissionRoute permissionId="admin.dashboard" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Inventario /></PermissionRoute>} />
          <Route path="usuarios" element={<PermissionRoute permissionId="admin.usuarios" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Usuarios /></PermissionRoute>} />
          <Route path="supervision" element={<PermissionRoute permissionId="admin.monitor" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Supervision /></PermissionRoute>} />
          <Route path="catalogos" element={<PermissionRoute permissionId="admin.catalogos" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><CatalogosGlobales /></PermissionRoute>} />
          <Route path="plantillas" element={<PermissionRoute permissionId="admin.plantillas" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><PlantillasDocumentos /></PermissionRoute>} />
          <Route path="reportes" element={<PermissionRoute permissionId="admin.reportes" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Reportes /></PermissionRoute>} />
          <Route path="encuestas" element={<PermissionRoute permissionId="admin.reportes" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><EncuestasSatisfaccion /></PermissionRoute>} />
          <Route path="monitor" element={<PermissionRoute permissionId="admin.monitor" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><MonitorActividad /></PermissionRoute>} />
          <Route
            path="migracion"
            element={
              <PermissionRoute permissionId="admin.monitor" fallbackRoles={['admin', 'admin_maestro', 'administrador']}>
                <Suspense fallback={null}>
                  <AuditoriaMigracion />
                </Suspense>
              </PermissionRoute>
            }
          />
        </Route>

        {/* --- RUTAS RECURSOS HUMANOS --- */}
        <Route path="/rh/dashboard" element={<PermissionRoute permissionId="rh.dashboard" fallbackRoles={['rh', 'recursos_humanos', 'recursos humanos']}><DashboardRH /></PermissionRoute>} />
        <Route path="/rh/auditoria" element={<PermissionRoute permissionId="rh.auditoria" fallbackRoles={['rh', 'recursos_humanos', 'recursos humanos']}><AuditoriaEmpleados /></PermissionRoute>} />
        <Route path="/rh/inventario-macro" element={<PermissionRoute permissionId="rh.inventario" fallbackRoles={['rh', 'recursos_humanos', 'recursos humanos']}><InventarioMacro /></PermissionRoute>} />
        <Route path="/rh/finanzas" element={<PermissionRoute permissionId="rh.finanzas" fallbackRoles={['rh', 'recursos_humanos', 'recursos humanos']}><FinanzasRH /></PermissionRoute>} />

        {/* --- RUTAS INTENDENCIA --- */}
        <Route path="/intendencia/registro" element={<PermissionRoute permissionId="intendencia.registro" fallbackRoles={['intendencia', 'limpieza']}><RegistroLimpiezaManual /></PermissionRoute>} />
        {/* --- RUTAS DOCTOR --- */}
        <Route path="/doctor/consulta" element={<PermissionRoute permissionId="doctor.agenda" fallbackRoles={['medico', 'doctor']}><Consultorio /></PermissionRoute>} />
        <Route path="/doctor/expediente" element={<PermissionRoute permissionId="doctor.expediente" fallbackRoles={['medico', 'doctor']}><ExpedienteClinico /></PermissionRoute>} />

        {/* --- RUTAS ENFERMERÍA --- */}
        <Route path="/enfermeria/dashboard" element={<PermissionRoute permissionId="enfermeria.dashboard" fallbackRoles={['enfermeria', 'enfermera', 'enfermero']}><AgendaEnfermeria /></PermissionRoute>} /> 
        <Route path="/enfermeria/jefatura" element={<PermissionRoute permissionId="enfermeria.jefatura" fallbackRoles={['jefa_enfermeria', 'jefa']}><DashboardJefaEnfermeria /></PermissionRoute>} /> 
        <Route path="/enfermeria/registros" element={<PermissionRoute permissionId="enfermeria.jefatura" fallbackRoles={['jefa_enfermeria', 'jefa']}><RegistrosEnfermeriaView /></PermissionRoute>} />
        <Route path="/enfermeria/triage" element={<PermissionRoute permissionId="enfermeria.triage" fallbackRoles={['enfermeria', 'enfermera', 'enfermero']}><Triage /></PermissionRoute>} />
        <Route path="/enfermeria/hoja-enfermeria" element={<PermissionRoute permissionId="enfermeria.hoja" fallbackRoles={['enfermeria', 'enfermera', 'enfermero']}><HojaEnfermeria /></PermissionRoute>} />

        {/* --- RUTAS COMPARTIDAS --- */}
        <Route path="/agenda" element={<PermissionRoute permissionId="shared.agenda" fallbackRoles={['admin', 'admin_maestro', 'administrador', 'medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion', 'operativo', 'jefa_enfermeria', 'jefa']}><Agenda /></PermissionRoute>} />
        <Route path="/pacientes" element={<PermissionRoute permissionId="shared.pacientes" fallbackRoles={['admin', 'admin_maestro', 'administrador', 'medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion']}><Pacientes /></PermissionRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;