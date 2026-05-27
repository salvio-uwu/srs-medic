import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Compass, HeartPulse, MessageCircle, Shield, Stethoscope, Users, X,
  LayoutDashboard, Package, UserCog, Eye, Tag, FileText, BarChart3, ClipboardList, Activity,
  CalendarDays, Syringe, Clipboard, Crown, DollarSign, SprayCan, ChevronRight, BookOpen,
  AlertTriangle
} from 'lucide-react';
import { db } from './config/firebase';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import Login from './pages/auth/Login';
import ChatPanel from './components/ChatPanel';
import ChatNotificationToast from './components/ChatNotificationToast';
import { PanicLauncherButton, PanicAlertOverlay, usePanicSystem } from './components/PanicButton';
import { useAuth } from './context/AuthContext';
import { hasPermission } from './services/permissionService';
import { useAppVersion } from './hooks/useAppVersion';
import { buildLastMessageSignature, isNewSignature } from './shared/chatSignatureCache';

// Layout Admin
import AdminLayout from './shared/AdminLayout';

// Módulos Administrativos
import AgendaAdmin from './pages/admin/AgendaAdmin';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import Inventario from './pages/admin/Inventario';
import Usuarios from './pages/admin/Usuarios';
import Supervision from './pages/admin/Supervision';
import Reportes from './pages/admin/Reportes'; 
import EncuestasSatisfaccion from './pages/admin/EncuestasSatisfaccion';
import MonitorActividad from './pages/admin/MonitorActividad';
import CatalogosGlobales from './pages/admin/CatalogosGlobales';
import PlantillasDocumentos from './pages/admin/PlantillasDocumentos';
import PerfilUsuario from './pages/admin/PerfilUsuario';
import DepuracionConsultas from './pages/admin/DepuracionConsultas';
const AuditoriaMigracion = lazy(() => import('./pages/admin/AuditoriaMigracion'));

// Módulos Doctor
import Consultorio from './pages/doctor/Consultorio'; 
import ExpedienteClinico from './pages/doctor/ExpedienteClinico'; 
import Pacientes from './pages/doctor/Pacientes';
import CapacitacionMedicos from './pages/doctor/CapacitacionMedicos';

// Módulos Intendencia
import RegistroLimpiezaManual from './pages/intendencia/RegistroLimpiezaManual';
// Módulos Enfermería
import AgendaEnfermeria from './pages/enfermeria/AgendaEnfermeria'; 
import Triage from './pages/enfermeria/Triage';
import AntecedentesRapidos from './pages/enfermeria/AntecedentesRapidos';
import HojaEnfermeria from './pages/enfermeria/HojaEnfermeria'; 
import DashboardJefaEnfermeria from './pages/enfermeria/DashboardJefaEnfermeria';
import RegistrosEnfermeriaView from './pages/enfermeria/RegistrosEnfermeriaView';
import CapacitacionEnfermeria from './pages/enfermeria/CapacitacionEnfermeria';
import BitacoraCarroRojo from './pages/enfermeria/BitacoraCarroRojo';
import CaducidadesEnfermeria from './pages/enfermeria/CaducidadesEnfermeria';
import OrdenServicioEnfermeria from './pages/enfermeria/OrdenServicioEnfermeria';

// Módulos Recursos Humanos
import DashboardRH from './pages/rh/DashboardRH';
import AuditoriaEmpleados from './pages/rh/AuditoriaEmpleados';
import InventarioMacro from './pages/rh/InventarioMacro';
import FinanzasRH from './pages/rh/FinanzasRH';

// Módulos Compartidos
import Agenda from './shared/Agenda';

const normalizeRole = (role = '') => String(role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const GlobalChatLauncher = ({ triggerPanic, hasActiveAlert }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [directMessageUser, setDirectMessageUser] = useState(null);
    const [showLauncherMenu, setShowLauncherMenu] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const initCanalesRef = useRef(false);
    const initPrivadosRef = useRef(false);
    const launcherRef = useRef(null);
    const audioCtxRef = useRef(null);
    const usersMapRef = useRef({});
    const toastRef = useRef(null);

    // Desbloquear AudioContext al primer gesto del usuario
    useEffect(() => {
      const unlock = () => {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        // Una vez desbloqueado, eliminar listeners
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('click', unlock);
      window.addEventListener('touchstart', unlock);
      window.addEventListener('keydown', unlock);
      return () => {
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
    }, []);

    // Detener sonido al cerrar pestaña o navegar fuera
    useEffect(() => {
      const handleBeforeUnload = () => {
        if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
          audioCtxRef.current.suspend();
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, []);

  // Sonido de notificación suave (ding) usando Web Audio API
  const playNotificationSound = useRef(async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;

      // Tono 1 – nota aguda suave
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Tono 2 – armónico complementario
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.1);
      gain2.gain.setValueAtTime(0.13, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);
    } catch (_) { /* silent fail */ }
  }).current;

  // ── Draggable position ──
  const STORAGE_KEY = 'launcher_corner';
  const [corner, setCorner] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'bottom-right'; } catch { return 'bottom-right'; }
  });
  const [dragPos, setDragPos] = useState(null); // {x, y} while dragging
  const dragRef = useRef({ active: false, startX: 0, startY: 0, moved: false });

  const cornerStyle = dragPos
    ? { left: dragPos.x - 26, top: dragPos.y - 26, alignItems: 'flex-end' }
    : ({
        'bottom-right': { right: 16, bottom: 16, alignItems: 'flex-end' },
        'bottom-left':  { left: 16, bottom: 16, alignItems: 'flex-start' },
        'top-right':    { right: 16, top: 16, alignItems: 'flex-end' },
        'top-left':     { left: 16, top: 16, alignItems: 'flex-start' },
      }[corner] || { right: 16, bottom: 16, alignItems: 'flex-end' });

  const shortcutsPosition = (() => {
    const isRight = corner.includes('right');
    const isBottom = corner.includes('bottom');
    const pos = {};
    if (isRight) pos.right = 58; else pos.left = 58;
    if (isBottom) pos.bottom = 62; else pos.top = 62;
    return pos;
  })();

  const handleBtnPointerDown = (e) => {
    const t = e.touches ? e.touches[0] : e;
    dragRef.current = { active: true, startX: t.clientX, startY: t.clientY, moved: false };
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const t = e.touches ? e.touches[0] : e;
      const dx = Math.abs(t.clientX - dragRef.current.startX);
      const dy = Math.abs(t.clientY - dragRef.current.startY);
      if (dx > 6 || dy > 6) {
        dragRef.current.moved = true;
        setDragPos({ x: t.clientX, y: t.clientY });
        // close menus during drag
        setShowLauncherMenu(false);
        setShowShortcuts(false);
      }
    };
    const onEnd = (e) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      if (!dragRef.current.moved) { setDragPos(null); return; }
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isRight = t.clientX > vw / 2;
      const isBottom = t.clientY > vh / 2;
      const newCorner = `${isBottom ? 'bottom' : 'top'}-${isRight ? 'right' : 'left'}`;
      setDragPos(null);
      setCorner(newCorner);
      try { localStorage.setItem(STORAGE_KEY, newCorner); } catch {}
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const rutasSinChat = ['/', '/login', '/portal'];
  const mostrarChat = Boolean(user?.uid) && !rutasSinChat.includes(location.pathname);

  useEffect(() => {
    if (!mostrarChat || !user?.uid) return;
    const cachedRaw = sessionStorage.getItem('chat_users_cache_v1');
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.savedAt < 10 * 60 * 1000 && Array.isArray(cached.users)) {
          const map = {};
          cached.users.forEach((u) => { if (u.id !== user.uid) map[u.id] = u; });
          usersMapRef.current = map;
          return;
        }
      } catch { /* cache corrupto */ }
    }
    getDocs(collection(db, 'users')).then((snap) => {
      const usersList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sessionStorage.setItem('chat_users_cache_v1', JSON.stringify({ savedAt: Date.now(), users: usersList }));
      const map = {};
      usersList.forEach((u) => { if (u.id !== user.uid) map[u.id] = u; });
      usersMapRef.current = map;
    }).catch(() => {});
  }, [mostrarChat, user?.uid]);

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
    { id: 'admin.agenda', label: 'Agenda', path: '/admin/agenda', group: 'Administracion', permission: 'admin.dashboard', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: CalendarDays },
    { id: 'rh.dashboard', label: 'Dashboard', path: '/rh/dashboard', group: 'Recursos Humanos', permission: 'rh.dashboard', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: LayoutDashboard },
    { id: 'rh.auditoria', label: 'Auditoría', path: '/rh/auditoria', group: 'Recursos Humanos', permission: 'rh.auditoria', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: Clipboard },
    { id: 'rh.inventario', label: 'Inventario Macro', path: '/rh/inventario-macro', group: 'Recursos Humanos', permission: 'rh.inventario', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: Package },
    { id: 'rh.finanzas', label: 'Finanzas', path: '/rh/finanzas', group: 'Recursos Humanos', permission: 'rh.finanzas', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: DollarSign },
    { id: 'intendencia.registro', label: 'Registro', path: '/intendencia/registro', group: 'Intendencia', permission: 'intendencia.registro', fallbackRoles: ['intendencia', 'limpieza'], icon: SprayCan },
    { id: 'doctor.consulta', label: 'Consulta', path: '/doctor/consulta', group: 'Doctor', permission: 'doctor.agenda', fallbackRoles: ['medico', 'doctor'], icon: Stethoscope },
    { id: 'doctor.capacitacion', label: 'Capacitación', path: '/doctor/capacitacion', group: 'Doctor', permission: 'doctor.agenda', fallbackRoles: ['medico', 'doctor'], icon: BookOpen },
    { id: 'enfermeria.dashboard', label: 'Dashboard', path: '/enfermeria/dashboard', group: 'Enfermeria', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: LayoutDashboard },
    { id: 'enfermeria.triage', label: 'Triage', path: '/enfermeria/triage', group: 'Enfermeria', permission: 'enfermeria.triage', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: Syringe },
    { id: 'enfermeria.hoja', label: 'Hoja de enfermería', path: '/enfermeria/hoja-enfermeria', group: 'Enfermeria', permission: 'enfermeria.hoja', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: FileText },
    { id: 'enfermeria.jefatura', label: 'Jefatura', path: '/enfermeria/jefatura', group: 'Enfermeria', permission: 'enfermeria.jefatura', fallbackRoles: ['jefa_enfermeria', 'jefa'], icon: Crown },
    { id: 'enfermeria.capacitacion', label: 'Capacitación', path: '/enfermeria/capacitacion', group: 'Enfermeria', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa'], icon: BookOpen },
    { id: 'enfermeria.caducidades', label: 'Caducidades', path: '/enfermeria/caducidades', group: 'Enfermeria', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa'], icon: Package },
    { id: 'shared.agenda', label: 'Agenda', path: '/agenda', group: 'General', permission: 'shared.agenda', fallbackRoles: ['medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion', 'operativo', 'jefa_enfermeria', 'jefa'], icon: CalendarDays },
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
    const openHandler = (e) => {
      setIsChatOpen(true);
      if (e.detail?.directMessageUser) {
        setDirectMessageUser(e.detail.directMessageUser);
      }
    };
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
      const nuevos = snap.docChanges().filter((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return false;
        const data = change.doc.data();
        if (!data?.ultimoRemitenteId || data.ultimoRemitenteId === user.uid) return false;
        if (!data?.ultimoMensajeAt) return false;
        return isNewSignature(buildLastMessageSignature(change.doc.id, data));
      });
      if (nuevos.length > 0) {
        setUnreadCount((prev) => prev + nuevos.length);
        playNotificationSound();
        nuevos.forEach((change) => {
          const data = change.doc.data();
          const uid = data.ultimoRemitenteId;
          const cachedUser = uid ? usersMapRef.current[uid] : null;
          window.dispatchEvent(new CustomEvent('show-chat-notification', {
            detail: {
              nombre: cachedUser?.nombre || data.ultimoRemitenteNombre || 'Usuario',
              texto: data.ultimoTexto || 'Nuevo mensaje',
              rol: cachedUser?.rol || data.ultimoRemitenteRol || '',
            }
          }));
        });
      }
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
      const nuevos = snap.docChanges().filter((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return false;
        const data = change.doc.data();
        if (!data?.ultimoRemitenteId || data.ultimoRemitenteId === user.uid) return false;
        if (!data?.ultimoMensajeAt) return false;
        return isNewSignature(buildLastMessageSignature(change.doc.id, data));
      });
      if (nuevos.length > 0) {
        setUnreadCount((prev) => prev + nuevos.length);
        playNotificationSound();
        nuevos.forEach((change) => {
          const data = change.doc.data();
          const uid = data.ultimoRemitenteId;
          const cachedUser = uid ? usersMapRef.current[uid] : null;
          window.dispatchEvent(new CustomEvent('show-chat-notification', {
            detail: {
              nombre: cachedUser?.nombre || data.ultimoRemitenteNombre || 'Usuario',
              texto: data.ultimoTexto || 'Nuevo mensaje',
              rol: cachedUser?.rol || data.ultimoRemitenteRol || '',
            }
          }));
        });
      }
    });

    return () => {
      unsubCanales();
      unsubPrivados();
    };
  }, [mostrarChat, user?.uid, isChatOpen]);

  useEffect(() => {
    if (isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  if (!mostrarChat) return null;

  return (
    <>
      <ChatNotificationToast isChatOpen={isChatOpen} />
      <div
        ref={launcherRef}
        style={{
          position: 'fixed',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          ...cornerStyle,
          gap: 10,
          transition: dragPos ? 'none' : 'all .3s cubic-bezier(.4,0,.2,1)',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: corner.includes('right') ? 'flex-end' : 'flex-start',
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

          {triggerPanic && (
            <PanicLauncherButton
              showLauncherMenu={showLauncherMenu}
              onActivate={triggerPanic}
              hasActiveAlert={hasActiveAlert}
            />
          )}

          {!isChatOpen && (
            <button
              type="button"
              onClick={() => {
                setUnreadCount(0);
                setShowShortcuts(false);
                setShowLauncherMenu(false);
                setIsChatOpen(true);
              }}
              title="Mensajes"
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                border: unreadCount > 0 ? '1px solid #c4b5fd' : '1px solid #d9e2ec',
                background: unreadCount > 0 ? 'linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%)' : '#ffffff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: unreadCount > 0 ? '0 8px 20px rgba(124,58,237,.18)' : '0 8px 16px rgba(15,23,42,.12)',
                cursor: 'pointer',
                position: 'relative',
                transform: showLauncherMenu ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.92)',
                opacity: showLauncherMenu ? 1 : 0,
                transition: 'all .22s ease',
                animation: unreadCount > 0 ? 'pulse-msg 2s infinite' : 'none'
              }}
            >
              <MessageCircle size={19} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    borderRadius: '999px',
                    background: '#ef4444',
                    border: '2px solid #ffffff',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    lineHeight: 1
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>

        {showShortcuts && (
          <div
            style={{
              position: 'absolute',
              ...shortcutsPosition,
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
           onMouseDown={handleBtnPointerDown}
           onTouchStart={handleBtnPointerDown}
           onClick={() => {
             if (dragRef.current.moved) { dragRef.current.moved = false; return; }
             setShowLauncherMenu((prev) => {
               const next = !prev;
               if (!next) setShowShortcuts(false);
               return next;
             });
           }}
           title="Centro rapido · Arrastra para mover"
           style={{
             width: 52,
             height: 52,
             borderRadius: 14,
             border: showLauncherMenu ? '1px solid #7dd3fc' : hasActiveAlert ? '1px solid #dc2626' : '1px solid #e2e8f0',
             background: showLauncherMenu ? 'linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)' : hasActiveAlert ? 'linear-gradient(180deg, #fff1f2 0%, #fee2e2 100%)' : '#ffffff',
             color: showLauncherMenu ? '#ffffff' : hasActiveAlert ? '#dc2626' : '#0f172a',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             boxShadow: dragPos ? '0 14px 32px rgba(15,23,42,.25)' : hasActiveAlert ? '0 10px 20px rgba(220,38,38,.16)' : '0 10px 20px rgba(15,23,42,.14)',
             cursor: dragPos ? 'grabbing' : 'grab',
             transition: dragPos ? 'none' : 'all .2s ease',
             touchAction: 'none',
             transform: dragPos ? 'scale(1.1)' : 'scale(1)',
             opacity: dragPos ? 0.85 : 1,
           }}
         >
           {showLauncherMenu ? <X size={20} /> : <Compass size={21} />}
           {!showLauncherMenu && unreadCount > 0 && (
             <span
               style={{
                 position: 'absolute',
                 top: -5,
                 right: -5,
                 minWidth: 20,
                 height: 20,
                 borderRadius: '999px',
                 background: '#ef4444',
                 border: '2px solid #ffffff',
                 color: '#ffffff',
                 fontSize: 11,
                 fontWeight: 700,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 padding: '0 5px',
                 lineHeight: 1,
                 animation: 'bounce-badge .4s ease'
               }}
             >
               {unreadCount > 99 ? '99+' : unreadCount}
             </span>
           )}
           {!showLauncherMenu && hasActiveAlert && (
             <span
               style={{
                 position: 'absolute',
                 top: -5,
                 right: -5,
                 minWidth: 20,
                 height: 20,
                 borderRadius: '999px',
                 background: '#dc2626',
                 border: '2px solid #ffffff',
                 color: '#ffffff',
                 fontSize: 11,
                 fontWeight: 700,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 padding: '0 5px',
                 lineHeight: 1,
                 animation: 'bounce-badge .4s ease'
               }}
             >
               ⚠️
             </span>
           )}
         </button>
      </div>
      <ChatPanel isOpen={isChatOpen} onClose={() => { setIsChatOpen(false); setDirectMessageUser(null); }} directMessageUser={directMessageUser} />
    </>
  );
};

// Route guards defined at module level so their component identity is stable across
// App re-renders (e.g. heartbeat-triggered Firestore → onSnapshot → setUser every ~2 min).
// Defining them inside App() creates a new function type on every render, which causes
// React to unmount/remount children (including ExpedienteClinico), resetting all state.
const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/portal" replace />;
  return children;
};

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PermissionRoute = ({ permissionId, fallbackRoles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(user, permissionId, fallbackRoles)) return <Navigate to="/portal" replace />;
  return children;
};

const UpdateBanner = () => {
  const { updateAvailable, resetUpdateStatus } = useAppVersion();
  if (!updateAvailable) return null;
  
  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }
    
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    window.location.replace(window.location.origin + window.location.pathname);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white text-sm font-semibold flex items-center justify-between px-4 py-2 shadow-lg">
      <span>Hay una actualización disponible.</span>
      <button
        onClick={handleUpdate}
        className="ml-4 bg-white text-blue-700 text-xs font-bold px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
      >
        Actualizar ahora
      </button>
    </div>
  );
};

function App() {
  const { user } = useAuth();
  const { activeAlert, triggerPanic, dismissAlert, hasActiveAlert } = usePanicSystem();

  return (
    <BrowserRouter>
      <UpdateBanner />
      <GlobalChatLauncher triggerPanic={triggerPanic} hasActiveAlert={hasActiveAlert} />
      <PanicAlertOverlay alert={activeAlert} onDismiss={dismissAlert} currentUserId={user?.uid} />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/portal" element={<Navigate to="/" replace />} />

        {/* --- RUTAS ADMINISTRADOR (layout compartido) --- */}
        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route path="dashboard" element={<PermissionRoute permissionId="admin.dashboard" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><DashboardAdmin /></PermissionRoute>} />
          <Route path="inventario" element={<PermissionRoute permissionId="admin.dashboard" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Inventario /></PermissionRoute>} />
          <Route path="usuarios" element={<PermissionRoute permissionId="admin.usuarios" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Usuarios /></PermissionRoute>} />
          <Route path="usuarios/:userId" element={<PermissionRoute permissionId="admin.usuarios" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><PerfilUsuario /></PermissionRoute>} />
          <Route path="supervision" element={<PermissionRoute permissionId="admin.monitor" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Supervision /></PermissionRoute>} />
          <Route path="catalogos" element={<PermissionRoute permissionId="admin.catalogos" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><CatalogosGlobales /></PermissionRoute>} />
          <Route path="plantillas" element={<PermissionRoute permissionId="admin.plantillas" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><PlantillasDocumentos /></PermissionRoute>} />
          <Route path="reportes" element={<PermissionRoute permissionId="admin.reportes" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><Reportes /></PermissionRoute>} />
          <Route path="encuestas" element={<PermissionRoute permissionId="admin.reportes" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><EncuestasSatisfaccion /></PermissionRoute>} />
          <Route path="monitor" element={<PermissionRoute permissionId="admin.monitor" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><MonitorActividad /></PermissionRoute>} />
          <Route path="depuracion" element={<PermissionRoute permissionId="admin.monitor" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><DepuracionConsultas /></PermissionRoute>} />
          <Route path="agenda" element={<PermissionRoute permissionId="admin.dashboard" fallbackRoles={['admin', 'admin_maestro', 'administrador']}><AgendaAdmin /></PermissionRoute>} />
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
        <Route path="/doctor/capacitacion" element={<PermissionRoute permissionId="doctor.agenda" fallbackRoles={['medico', 'doctor']}><CapacitacionMedicos /></PermissionRoute>} />

        {/* --- RUTAS ENFERMERÍA --- */}
        <Route path="/enfermeria/dashboard" element={<PermissionRoute permissionId="enfermeria.dashboard" fallbackRoles={['enfermeria', 'enfermera', 'enfermero']}><AgendaEnfermeria /></PermissionRoute>} /> 
        <Route path="/enfermeria/jefatura" element={<PermissionRoute permissionId="enfermeria.jefatura" fallbackRoles={['jefa_enfermeria', 'jefa']}><DashboardJefaEnfermeria /></PermissionRoute>} /> 
        <Route path="/enfermeria/registros" element={<PermissionRoute permissionId="enfermeria.jefatura" fallbackRoles={['jefa_enfermeria', 'jefa']}><RegistrosEnfermeriaView /></PermissionRoute>} />
        <Route path="/enfermeria/carro-rojo" element={<PermissionRoute permissionId="enfermeria.dashboard" fallbackRoles={['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa']}><BitacoraCarroRojo /></PermissionRoute>} />
        <Route path="/enfermeria/triage" element={<PermissionRoute permissionId="enfermeria.triage" fallbackRoles={['enfermeria', 'enfermera', 'enfermero']}><Triage /></PermissionRoute>} />
        <Route path="/enfermeria/antecedentes" element={<PermissionRoute permissionId="enfermeria.triage" fallbackRoles={['enfermeria', 'enfermera', 'enfermero']}><AntecedentesRapidos /></PermissionRoute>} />
        <Route path="/enfermeria/hoja-enfermeria" element={<PermissionRoute permissionId="enfermeria.hoja" fallbackRoles={['enfermeria', 'enfermera', 'enfermero']}><HojaEnfermeria /></PermissionRoute>} />
        <Route path="/enfermeria/capacitacion" element={<PermissionRoute permissionId="enfermeria.dashboard" fallbackRoles={['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa']}><CapacitacionEnfermeria /></PermissionRoute>} />
        <Route path="/enfermeria/caducidades" element={<PermissionRoute permissionId="enfermeria.dashboard" fallbackRoles={['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa']}><CaducidadesEnfermeria /></PermissionRoute>} />
        <Route path="/enfermeria/expediente" element={<PermissionRoute permissionId="enfermeria.dashboard" fallbackRoles={['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa']}><ExpedienteClinico /></PermissionRoute>} />
        <Route path="/enfermeria/orden-servicio" element={<PermissionRoute permissionId="enfermeria.dashboard" fallbackRoles={['admin', 'admin_maestro', 'administrador', 'enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa', 'recepcion', 'operativo']}><OrdenServicioEnfermeria /></PermissionRoute>} />

        {/* --- RUTAS COMPARTIDAS --- */}
        <Route path="/agenda" element={<PermissionRoute permissionId="shared.agenda" fallbackRoles={['medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion', 'operativo', 'jefa_enfermeria', 'jefa']}><Agenda /></PermissionRoute>} />
        <Route path="/pacientes" element={<PermissionRoute permissionId="shared.pacientes" fallbackRoles={['admin', 'admin_maestro', 'administrador', 'medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion']}><Pacientes /></PermissionRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;