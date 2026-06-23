import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Activity, UserPlus, Package, Tags, FileText, BarChart3,
  ClipboardCheck, LogOut, Menu, ChevronLeft, Building2, Bot, Send, Loader2, X, User, MessageCircle, FlaskConical,
  ShieldCheck
} from 'lucide-react';
import { CalendarBlank } from '@phosphor-icons/react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import useIsMobile from '../hooks/useIsMobile';

/* ─── DESIGN SYSTEM ───────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

  :root {
    --slate-50:  #fafafa; --slate-100: #f5f5f4;
    --slate-200: #e5e7eb; --slate-300: #d1d5db;
    --slate-400: #9ca3af; --slate-500: #6b7280;
    --slate-600: #4b5563; --slate-700: #374151;
    --slate-800: #1f2937; --slate-900: #111;
    --surface: #ffffff; --bg: #f8f9fa;
    --radius: 8px;
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: none;
  }

  /* ── SHELL ── */
  .admin-shell {
    font-family: 'Sora', 'DM Sans', system-ui, sans-serif;
    background: var(--bg);
    color: var(--slate-900);
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* ── SIDEBAR ── */
  .admin-sidebar {
    width: 240px; flex-shrink: 0;
    background: #fff;
    border-right: 1px solid var(--slate-200);
    display: flex; flex-direction: column;
    overflow: hidden;
    transition: width .22s cubic-bezier(.4,0,.2,1);
  }
  .admin-sidebar.collapsed { width: 56px; }

  .sidebar-brand {
    height: 56px; padding: 0 14px;
    border-bottom: 1px solid var(--slate-200);
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .brand-logo {
    width: 30px; height: 30px; border-radius: 6px;
    background: #f3f4f6;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-700); flex-shrink: 0;
  }
  .brand-name {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700;
    color: var(--slate-900); white-space: nowrap; line-height: 1.2;
  }
  .brand-sub {
    font-size: 9px; font-weight: 600; color: var(--slate-400);
    text-transform: uppercase; letter-spacing: .06em; white-space: nowrap;
  }

  .sidebar-nav { flex: 1; overflow-y: auto; padding: 8px; }
  .sidebar-nav::-webkit-scrollbar { width: 4px; }
  .sidebar-nav::-webkit-scrollbar-thumb { background: var(--slate-200); border-radius: 99px; }

  .nav-section-label {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: var(--slate-400);
    padding: 8px 10px 4px; white-space: nowrap; overflow: hidden;
  }

  .nav-lnk {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 6px;
    font-size: 12px; font-weight: 600; color: var(--slate-600);
    text-decoration: none;
    transition: background .12s, color .12s;
    white-space: nowrap; margin-bottom: 1px;
  }
  .nav-lnk:hover { background: var(--slate-100); color: var(--slate-900); }
  .nav-lnk.active { background: #f3f4f6; color: var(--slate-900); font-weight: 700; }
  .nav-lnk .ni { width: 18px; height: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--slate-400); transition: color .12s; }
  .nav-lnk:hover .ni { color: var(--slate-600); }
  .nav-lnk.active .ni { color: var(--slate-700); }
  .nav-lnk .nl { overflow: hidden; text-overflow: ellipsis; }

  .nav-divider { height: 1px; background: var(--slate-200); margin: 6px 8px; }

  .sidebar-footer { padding: 6px 8px 10px; border-top: 1px solid var(--slate-200); }

  .logout-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 6px; width: 100%;
    font-size: 12px; font-weight: 600; color: var(--slate-600);
    background: transparent; border: none; cursor: pointer;
    transition: background .12s;
    white-space: nowrap;
  }
  .logout-btn:hover { background: var(--slate-100); color: var(--slate-900); }
  .logout-btn .ni { width: 18px; height: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }

  /* ── TOPBAR ── */
  .admin-topbar {
    height: 56px; background: #fff;
    border-bottom: 1px solid var(--slate-200);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; flex-shrink: 0;
    gap: 14px;
  }

  .topbar-left,
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .topbar-center {
    flex: 1;
    min-width: 220px;
    max-width: 860px;
    position: relative;
  }

  .assistant-bar {
    height: 36px;
    border-radius: 6px;
    border: 1px solid var(--slate-200);
    background: #fff;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
  }

  .assistant-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--slate-400);
    animation: pulse-soft 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  .assistant-icon {
    color: var(--slate-500);
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }

  .assistant-input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--slate-700);
    font-size: 12px;
    font-weight: 500;
  }

  .assistant-send {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 0;
    background: var(--slate-900);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity .12s;
    flex-shrink: 0;
  }
  .assistant-send:hover { opacity: .85; }
  .assistant-send:disabled { opacity: .4; cursor: not-allowed; }

  .assistant-toggle {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid var(--slate-200);
    background: #fff;
    color: var(--slate-400);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all .12s;
    flex-shrink: 0;
  }
  .assistant-toggle:hover {
    color: var(--slate-700);
    border-color: var(--slate-300);
    background: var(--slate-100);
  }

  .assistant-result {
    position: absolute;
    top: 42px;
    left: 0;
    right: 0;
    border-radius: 8px;
    background: #fff;
    border: 1px solid var(--slate-200);
    padding: 10px 14px 12px;
    animation: slide-down .15s ease-out;
    z-index: 20;
  }

  .assistant-result-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--slate-200);
  }

  .assistant-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--slate-600);
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .assistant-kpi-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .assistant-kpi {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--slate-200);
    border-radius: 99px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--slate-600);
    background: #fff;
  }

  .assistant-result-text {
    font-size: 12px;
    color: var(--slate-700);
    line-height: 1.42;
    white-space: pre-line;
  }

  .assistant-result-actions {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .assistant-action-btn {
    border: 1px solid var(--slate-200);
    background: #fff;
    color: var(--slate-700);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .assistant-action-btn:hover { background: var(--slate-100); }
  .assistant-action-btn:disabled { opacity: .5; cursor: not-allowed; }

  .assistant-close {
    border: 0;
    background: transparent;
    color: var(--slate-400);
    font-size: 11px;
    cursor: pointer;
    font-weight: 600;
    padding: 0;
    line-height: 1;
  }
  .assistant-close:hover { color: var(--slate-600); }

  @keyframes pulse-soft {
    0%, 100% { transform: scale(1); opacity: .8; }
    50% { transform: scale(1.45); opacity: .3; }
  }

  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .icon-btn {
    width: 34px; height: 34px; border-radius: 6px;
    border: 1px solid var(--slate-200); background: #fff;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-500); cursor: pointer; transition: all .12s;
  }
  .icon-btn:hover { color: var(--slate-900); border-color: var(--slate-300); background: var(--slate-100); }

  .user-chip {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 10px 4px 5px; border-radius: 6px;
    border: 1px solid var(--slate-200); background: #fff;
  }
  .user-avatar {
    width: 28px; height: 28px; border-radius: 6px;
    background: #f3f4f6;
    display: flex; align-items: center; justify-content: center;
    color: var(--slate-700); font-family: 'Sora', sans-serif;
    font-weight: 700; font-size: 11px;
  }
  .user-name {
    font-family: 'Sora', sans-serif; font-size: 12px;
    font-weight: 700; color: var(--slate-900); white-space: nowrap; line-height: 1.2;
  }
  .user-branch {
    font-size: 10px; color: var(--slate-400); white-space: nowrap; font-weight: 500;
    display: flex; align-items: center; gap: 3px;
  }

  /* ── MAIN ── */
  .admin-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  .admin-content {
    flex: 1; overflow-y: auto; background: var(--bg);
  }
  .admin-content::-webkit-scrollbar { width: 6px; }
  .admin-content::-webkit-scrollbar-track { background: transparent; }
  .admin-content::-webkit-scrollbar-thumb { background: var(--slate-300); border-radius: 99px; }
  .admin-content::-webkit-scrollbar-thumb:hover { background: var(--slate-400); }

  @media (max-width: 980px) {
    .topbar-center { max-width: none; min-width: 140px; }
    .assistant-input { font-size: 12px; }
  }

  @media (max-width: 720px) {
    .topbar-center { display: none; }
  }

  /* ── MOBILE SIDEBAR ── */
  @media (max-width: 767px) {
    .admin-sidebar {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: 260px;
      z-index: 1000;
      transform: translateX(-100%);
      transition: transform .25s cubic-bezier(.4,0,.2,1);
      box-shadow: 0 0 0 9999px rgba(0,0,0,0);
      pointer-events: none;
    }
    .admin-sidebar.mobile-open {
      transform: translateX(0);
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.35);
      pointer-events: auto;
    }
    .admin-sidebar.collapsed { width: 260px; }
    .sidebar-brand, .sidebar-nav, .sidebar-footer {
      pointer-events: auto;
    }
    .mobile-hamburger {
      display: inline-flex !important;
    }
    .topbar-left .icon-btn.hide-mobile { display: none; }
  }

  @media (min-width: 768px) {
    .mobile-hamburger { display: none !important; }
  }
`;

const extractJsonObject = (text = '') => {
  const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

const toDateInput = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateSafe = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value) => String(value || '').toLowerCase().trim();
const formatMoney = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));

const detectIntent = (rawText = '') => {
  const text = normalizeText(rawText);
  if (text.includes('plantilla') || text.includes('documento')) return 'templates';
  if (text.includes('inventario') || text.includes('stock') || text.includes('medic')) return 'inventory';
  if (text.includes('usuario') || text.includes('personal') || text.includes('equipo') || text.includes('online')) return 'staff';
  if (text.includes('reporte') || text.includes('ingreso') || text.includes('citas') || text.includes('finanza')) return 'reporting';
  if (text.includes('audita') || text.includes('auditoria') || text.includes('riesgo') || text.includes('informe') || text.includes('estado general')) return 'audit';
  return 'general';
};

const isOnline = (u = {}) => {
  if (u.isOnline === true) return true;
  const lastSeen = parseDateSafe(u.lastSeen);
  if (!lastSeen) return false;
  return (Date.now() - lastSeen.getTime()) / 60000 <= 10;
};

/* ─── NAVEGACIÓN ────────────────────────────────────────────────────── */
const NAV = [
  { label: 'Dashboard',   icon: Activity,       to: '/admin/dashboard' },
  { label: 'Personal',    icon: UserPlus,        to: '/admin/usuarios' },
  { label: 'Pacientes',   icon: User,            to: '/admin/pacientes' },
  { label: 'Auditoría',   icon: FlaskConical,    to: '/admin/depuracion' },
  { label: 'Inventario',  icon: Package,         to: '/admin/inventario' },
  { label: 'Catálogos',   icon: Tags,            to: '/admin/catalogos' },
  { label: 'Plantillas',  icon: FileText,        to: '/admin/plantillas' },
  { label: 'Reportes',    icon: BarChart3,       to: '/admin/reportes' },
  { label: 'Encuestas',   icon: MessageCircle,   to: '/admin/encuestas' },
  { label: 'Monitor',     icon: Activity,        to: '/admin/monitor' },
  { label: 'Supervisión', icon: ClipboardCheck,  to: '/admin/supervision' },
  { label: 'SSA',         icon: ShieldCheck,     to: '/admin/ssa' },
];

/* ─── COMPONENTE ─────────────────────────────────────────────────────── */
const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const assistantContainerRef = useRef(null);
  const adminName = user?.nombre || 'Administrador';
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_sidebar_collapsed');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarLeaveTimer = useRef(null);
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('admin_sidebar_collapsed', String(collapsed));
    } catch {}
  }, [collapsed]);

  const handleSidebarMouseEnter = () => {
    if (sidebarLeaveTimer.current) {
      clearTimeout(sidebarLeaveTimer.current);
      sidebarLeaveTimer.current = null;
    }
    setSidebarHovered(true);
  };

  const handleSidebarMouseLeave = () => {
    sidebarLeaveTimer.current = setTimeout(() => {
      setSidebarHovered(false);
    }, 180);
  }; // small delay so the sidebar doesn't flicker when moving across nav items

  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantReply, setAssistantReply] = useState({
    text: `${adminName}, asistente operativo activo. Puedo auditar, revisar riesgos, proponer decisiones y ejecutar accesos en cualquier modulo.`,
    actions: [
      { label: 'Auditar hoy', actionId: 'go_dashboard' },
      { label: 'Ir a supervision', actionId: 'go_supervision' }
    ]
  });

  const [users, setUsers] = useState([]);
  const [citasHoy, setCitasHoy] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [bitacorasHoy, setBitacorasHoy] = useState([]);
  const [templates, setTemplates] = useState([]);

  const hoy = toDateInput(new Date());

  useEffect(() => {
    let isMounted = true;

    const loadOperationalData = async () => {
      try {
        const qCitas = query(collection(db, 'citas'), where('fecha', '==', hoy));
        const qTemplates = query(collection(db, 'catalogo_plantillas_documentos'), orderBy('orden', 'asc'));

        const [usersSnap, citasSnap, inventarioSnap, bitacorasSnap, templatesSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(qCitas),
          getDocs(collection(db, 'inventario')),
          getDocs(collection(db, 'bitacorasLimpieza')),
          getDocs(qTemplates)
        ]);

        if (!isMounted) return;
        setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCitasHoy(citasSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setInventario(inventarioSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const list = bitacorasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBitacorasHoy(list.filter((b) => {
          const d = parseDateSafe(b.fecha);
          return d ? toDateInput(d) === hoy : false;
        }));

        setTemplates(templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error cargando contexto operativo admin:', error);
      }
    };

    loadOperationalData();
    const intervalId = setInterval(loadOperationalData, 300000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [hoy]);

  const operationalContext = useMemo(() => {
    const realizadas = citasHoy.filter((c) => ['completada', 'finalizada', 'atendida'].includes(normalizeText(c.estado))).length;
    const pendientes = Math.max(citasHoy.length - realizadas, 0);
    const ingresos = citasHoy.reduce((acc, c) => acc + Number(c.motivoPrecioSnapshot ?? c.motivoPrecio ?? 0), 0);
    const personalOnline = users.filter((u) => isOnline(u)).length;
    const stockCritico = inventario.filter((item) => {
      const stock = Number(item.stock || 0);
      const min = Number(item.stockMinimo || item.minimo || 10);
      return stock <= min;
    }).length;
    const limpiezasSinEvidencia = bitacorasHoy.filter((b) => !b.fotoUrl).length;
    const tasaCierre = citasHoy.length > 0 ? Math.round((realizadas * 100) / citasHoy.length) : 0;

    return {
      fecha: hoy,
      vista: location.pathname,
      totalUsuarios: users.length,
      personalOnline,
      citasHoy: citasHoy.length,
      realizadas,
      pendientes,
      tasaCierre,
      ingresosHoy: ingresos,
      stockCritico,
      bitacorasHoy: bitacorasHoy.length,
      limpiezasSinEvidencia
    };
  }, [bitacorasHoy, citasHoy, hoy, inventario, location.pathname, users]);

  const templatesContext = useMemo(() => {
    const total = templates.length;
    const activas = templates.filter((t) => t.activo !== false).length;
    const publicadas = templates.filter((t) => t.publicado === true).length;
    const borrador = Math.max(total - publicadas, 0);
    const recientes = templates.slice(0, 8).map((t) => t.nombre).filter(Boolean).slice(0, 5);

    return { total, activas, publicadas, borrador, recientes };
  }, [templates]);

  const askGeminiCallable = useMemo(() => httpsCallable(functions, 'askGemini'), []);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!assistantContainerRef.current) return;
      if (!assistantContainerRef.current.contains(event.target)) {
        setAssistantOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === 'Escape') setAssistantOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const withAdminName = (message) => {
    const trimmed = String(message || '').trim();
    if (!trimmed) return `${adminName}, no hay contenido disponible en este momento.`;
    const lowered = normalizeText(trimmed);
    const loweredName = normalizeText(adminName);
    if (lowered.includes(loweredName)) return trimmed;
    return `${adminName}, ${trimmed}`;
  };

  const cleanAssistantText = (message) => {
    return String(message || '')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const compactSummaryByIntent = (intent) => {
    if (intent === 'templates') {
      return `Resumen: ${templatesContext.total} plantillas totales, ${templatesContext.publicadas} publicadas y ${templatesContext.borrador} en borrador.`;
    }

    if (intent === 'inventory') {
      return `Resumen: ${operationalContext.stockCritico} insumos en stock critico y ${operationalContext.citasHoy} citas activas hoy.`;
    }

    if (intent === 'staff') {
      return `Resumen: ${operationalContext.personalOnline}/${operationalContext.totalUsuarios} integrantes en linea.`;
    }

    if (intent === 'reporting' || intent === 'audit') {
      const risks = [];
      if (operationalContext.stockCritico > 0) risks.push(`${operationalContext.stockCritico} stock critico`);
      if (operationalContext.limpiezasSinEvidencia > 0) risks.push(`${operationalContext.limpiezasSinEvidencia} sin evidencia`);
      const riskText = risks.length > 0 ? risks.join(', ') : 'sin riesgo critico inmediato';
      return `Resumen: ${operationalContext.citasHoy} citas, cierre ${operationalContext.tasaCierre}%, ingreso ${formatMoney(operationalContext.ingresosHoy)}, ${riskText}.`;
    }

    return '';
  };

  const normalizeAssistantOutput = (message, intent) => {
    const cleaned = cleanAssistantText(message);
    const base = withAdminName(cleaned);
    const words = base.split(/\s+/).filter(Boolean).length;
    const shouldAppendSummary = ['templates', 'inventory', 'staff', 'reporting', 'audit'].includes(intent);
    const summary = compactSummaryByIntent(intent);
    const withSummary = shouldAppendSummary && summary && !/(^|\n)resumen\s*:/i.test(base)
      ? `${base}\n${summary}`
      : base;

    if (words >= 22) return withSummary;

    if (shouldAppendSummary) {
      return `${withSummary}\nSiguiente paso sugerido: confirma la accion principal y la ejecuto contigo ahora.`;
    }

    return `${withSummary}\nSiguiente paso sugerido: dime el modulo exacto y te respondo solo sobre ese tema.`;
  };

  const runAssistantAction = (actionId) => {
    if (actionId === 'go_supervision') navigate('/admin/supervision');
    if (actionId === 'go_monitor') navigate('/admin/monitor');
    if (actionId === 'go_inventory') navigate('/admin/inventario');
    if (actionId === 'go_reports') navigate('/admin/reportes');
    if (actionId === 'go_users') navigate('/admin/usuarios');
    if (actionId === 'go_catalogs') navigate('/admin/catalogos');
    if (actionId === 'go_templates') navigate('/admin/plantillas');
    if (actionId === 'go_dashboard') navigate('/admin/dashboard');
    if (actionId === 'go_agenda') navigate('/admin/agenda');
  };

  const localAssistantDecision = (rawText) => {
    const text = normalizeText(rawText);

    const routeMap = [
      { key: 'dashboard', actionId: 'go_dashboard', label: 'Ir a Dashboard' },
      { key: 'supervision', actionId: 'go_supervision', label: 'Ir a Supervision' },
      { key: 'monitor', actionId: 'go_monitor', label: 'Ir a Monitor' },
      { key: 'inventario', actionId: 'go_inventory', label: 'Ir a Inventario' },
      { key: 'plantilla', actionId: 'go_templates', label: 'Ir a Plantillas' },
      { key: 'reporte', actionId: 'go_reports', label: 'Ver Reportes' },
      { key: 'usuario', actionId: 'go_users', label: 'Abrir Usuarios' },
      { key: 'catalog', actionId: 'go_catalogs', label: 'Abrir Catalogos' },
      { key: 'agenda', actionId: 'go_agenda', label: 'Abrir Agenda' }
    ];

    for (const route of routeMap) {
      if ((text.includes('abr') || text.includes('ir') || text.includes('ver')) && text.includes(route.key)) {
        return {
          text: `${adminName}, accion preparada. Te llevo directo a ${route.label.replace('Ir a ', '').replace('Ver ', '')}. Esta decision mantiene continuidad operativa y evita perder tiempo de ejecucion.`,
          actions: [{ label: route.label, actionId: route.actionId }]
        };
      }
    }

    if (text.includes('audita') || text.includes('auditoria') || text.includes('informe') || text.includes('riesgo')) {
      const ctx = operationalContext;
      const riskFlags = [];
      if (ctx.stockCritico > 0) riskFlags.push(`${ctx.stockCritico} insumos en stock critico`);
      if (ctx.limpiezasSinEvidencia > 0) riskFlags.push(`${ctx.limpiezasSinEvidencia} bitacoras sin evidencia`);
      if (ctx.tasaCierre < 60 && ctx.citasHoy >= 6) riskFlags.push(`tasa de cierre baja (${ctx.tasaCierre}%)`);

      return {
        text: `${adminName}, auditoria del ${ctx.fecha}.\n1. Operacion: ${ctx.citasHoy} citas (${ctx.realizadas} realizadas), cierre ${ctx.tasaCierre}%.\n2. Personal: ${ctx.personalOnline}/${ctx.totalUsuarios} integrantes en linea.\n3. Finanzas: ingreso estimado ${formatMoney(ctx.ingresosHoy)}.\n4. Riesgos: ${riskFlags.length > 0 ? riskFlags.join(', ') : 'sin riesgos criticos detectados por ahora'}.\nResumen: prioriza supervision e inventario antes del cierre de jornada.`,
        actions: [
          { label: 'Ver supervision', actionId: 'go_supervision' },
          { label: 'Ver monitor', actionId: 'go_monitor' },
          { label: 'Ver reportes', actionId: 'go_reports' }
        ]
      };
    }

    if (text.includes('plantilla') || text.includes('documento')) {
      const recentNames = templatesContext.recientes.length > 0 ? templatesContext.recientes.join(', ') : 'sin nombres disponibles';
      return {
        text: `${adminName}, tus plantillas registradas son ${templatesContext.total}: ${templatesContext.publicadas} publicadas y ${templatesContext.borrador} en borrador. Recientes: ${recentNames}.\nResumen: la cobertura documental esta ${templatesContext.publicadas > 0 ? 'activa' : 'pendiente de publicacion'}.`,
        actions: [
          { label: 'Ir a Plantillas', actionId: 'go_templates' },
          { label: 'Ver Reportes', actionId: 'go_reports' }
        ]
      };
    }

    return null;
  };

  const buildAssistantPrompt = (rawPrompt, intent) => {
    const ctx = operationalContext;
    const contextByIntent = (() => {
      if (intent === 'templates') {
        return {
          enfoque: 'plantillas_documentos',
          plantillas: templatesContext,
          vistaActual: ctx.vista
        };
      }

      if (intent === 'inventory') {
        return {
          enfoque: 'inventario',
          inventario: {
            stockCritico: ctx.stockCritico,
            citasHoy: ctx.citasHoy,
            tasaCierre: ctx.tasaCierre
          }
        };
      }

      if (intent === 'staff') {
        return {
          enfoque: 'personal',
          personal: {
            totalUsuarios: ctx.totalUsuarios,
            personalOnline: ctx.personalOnline
          }
        };
      }

      return {
        enfoque: intent,
        operacion: ctx
      };
    })();

    return `
Eres un asistente ejecutivo integral para direccion de un centro medico.
Tu rol operativo SI incluye: auditar, revisar, priorizar riesgos, proponer acciones concretas, orientar generacion de reportes y ejecutar navegacion entre modulos.
Responde en espanol profesional, concreto, sin frases genericas.
Debes dirigirte al usuario por su nombre en la primera frase de la respuesta.
Si piden auditoria o informe, responde con estructura: Diagnostico, Impacto, Plan inmediato (3 acciones).
No uses Markdown: prohibido asteriscos dobles, asterisco de lista, guiones tipo lista y backticks.
Escribe en lenguaje natural con puntos numerados 1. 2. 3. y termina siempre con Resumen: en una sola linea.
Evita rutas tecnicas (por ejemplo /admin/... ).
Responde SOLAMENTE sobre la pregunta del usuario. No incluyas estado global del centro si no fue solicitado.

Contexto:
- Usuario: ${adminName}
- Vista actual: ${ctx.vista}
- Fecha: ${ctx.fecha}
- Intencion detectada: ${intent}

CONTEXTO RELEVANTE (real):
${JSON.stringify(contextByIntent)}

Solicitud:
${rawPrompt}

Devuelve SOLO JSON:
{
  "message": "entre 5 y 8 lineas, accionable, natural y especifico con datos",
  "actions": [
    {"label":"texto","actionId":"go_supervision|go_monitor|go_inventory|go_reports|go_users|go_catalogs|go_templates|go_dashboard|go_agenda|none"}
  ]
}
`;
  };

  const sendAssistantPrompt = async () => {
    const text = assistantInput.trim();
    if (!text || assistantLoading) return;
    const intent = detectIntent(text);

    const localReply = localAssistantDecision(text);
    if (localReply) {
      setAssistantReply(localReply);
      setAssistantInput('');
      setAssistantOpen(true);
      return;
    }

    setAssistantLoading(true);
    setAssistantOpen(true);

    try {
      const resp = await askGeminiCallable({ prompt: buildAssistantPrompt(text, intent) });
      const parsed = extractJsonObject(resp?.data?.result || '');

      if (!parsed?.message) {
        setAssistantReply({
          text: `${adminName}, no pude estructurar una respuesta completa en este intento.\nDiagnostico rapido: ${operationalContext.citasHoy} citas hoy, cierre ${operationalContext.tasaCierre}%, stock critico ${operationalContext.stockCritico}.\nPlan inmediato: validar supervision, asegurar inventario critico y confirmar estatus en reportes.`,
          actions: [
            { label: 'Ir a Dashboard', actionId: 'go_dashboard' },
            { label: 'Ir a Supervision', actionId: 'go_supervision' },
            { label: 'Ver Reportes', actionId: 'go_reports' }
          ]
        });
        setAssistantLoading(false);
        return;
      }

      const actions = Array.isArray(parsed.actions)
        ? parsed.actions
            .slice(0, 3)
            .map((a) => ({ label: a?.label || 'Abrir', actionId: a?.actionId || 'none' }))
            .filter((a) => ['go_supervision', 'go_monitor', 'go_inventory', 'go_reports', 'go_users', 'go_catalogs', 'go_templates', 'go_dashboard', 'go_agenda', 'none'].includes(a.actionId))
        : [];

      setAssistantReply({
        text: normalizeAssistantOutput(parsed.message, intent),
        actions: actions.length > 0 ? actions : [{ label: 'Sin accion sugerida', actionId: 'none' }]
      });
      setAssistantInput('');
    } catch (error) {
      console.error('Error asistente global admin:', error);
      setAssistantReply({
        text: `${adminName}, hubo una incidencia temporal al consultar el asistente.\nAun asi, puedo mantener continuidad operativa con accesos directos a los modulos criticos mientras recuperamos el servicio.`,
        actions: [
          { label: 'Ir a Supervision', actionId: 'go_supervision' },
          { label: 'Ir a Inventario', actionId: 'go_inventory' }
        ]
      });
    }

    setAssistantLoading(false);
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/'); } catch {}
  };

  const initials = user?.nombre
    ? user.nombre.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A';

  return (
    <>
      <style>{STYLES}</style>
      <div className="admin-shell">

        {/* ── SIDEBAR ──────────────────────────────── */}
        <aside
          className={`admin-sidebar${(collapsed && !sidebarHovered && !isMobile) ? ' collapsed' : ''}${isMobile && mobileSidebarOpen ? ' mobile-open' : ''}`}
          onMouseEnter={isMobile ? undefined : handleSidebarMouseEnter}
          onMouseLeave={isMobile ? undefined : handleSidebarMouseLeave}
        >

          <div className="sidebar-brand">
            <div className="brand-logo"><Activity size={15} /></div>
            {(isMobile || !collapsed || sidebarHovered) && (
              <div>
                <div className="brand-name">SRS Médico</div>
                <div className="brand-sub">Panel Admin</div>
              </div>
            )}
          </div>

          <nav className="sidebar-nav">
            {(isMobile || !collapsed || sidebarHovered) && <div className="nav-section-label">Módulos</div>}
            {NAV.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-lnk${isActive ? ' active' : ''}`}
                title={collapsed && !sidebarHovered && !isMobile ? label : undefined}
                onClick={() => { if (isMobile) setMobileSidebarOpen(false); }}
              >
                <span className="ni"><Icon size={15} /></span>
                {(isMobile || !collapsed || sidebarHovered) && <span className="nl">{label}</span>}
              </NavLink>
            ))}

            <div className="nav-divider" />
            {(isMobile || !collapsed || sidebarHovered) && <div className="nav-section-label">Accesos</div>}
            <NavLink to="/admin/agenda" className={({ isActive }) => `nav-lnk${isActive ? ' active' : ''}`} title={collapsed && !sidebarHovered && !isMobile ? 'Agenda' : undefined}>
              <span className="ni"><CalendarBlank size={15} /></span>
              {(isMobile || !collapsed || sidebarHovered) && <span className="nl">Agenda</span>}
            </NavLink>
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout} title={collapsed && !sidebarHovered && !isMobile ? 'Cerrar sesión' : undefined}>
              <span className="ni"><LogOut size={15} /></span>
              {(isMobile || !collapsed || sidebarHovered) && <span>Cerrar Sesión</span>}
            </button>
          </div>
        </aside>

        {/* ── MAIN ─────────────────────────────────── */}
        <div className="admin-main">

          <header className="admin-topbar">
            <div className="topbar-left">
              <button className="icon-btn hide-mobile" onClick={() => setCollapsed(c => !c)}>
                {collapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
              </button>
              <button className="icon-btn mobile-hamburger" onClick={() => setMobileSidebarOpen(o => !o)} style={{ display: 'none' }}>
                <Menu size={15} />
              </button>
            </div>

            <div className="topbar-center" ref={assistantContainerRef}>
              <form
                className="assistant-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendAssistantPrompt();
                }}
              >
                <span className="assistant-dot" />
                <Bot className="assistant-icon" />
                <input
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  onFocus={() => setAssistantOpen(true)}
                  placeholder="Audita, revisa, toma decisiones y ejecuta acciones desde cualquier modulo"
                  className="assistant-input"
                />
                <button type="button" className="assistant-toggle" onClick={() => setAssistantOpen((s) => !s)}>
                  {assistantOpen ? <X size={13} /> : <Bot size={13} />}
                </button>
                <button type="submit" className="assistant-send" disabled={assistantLoading}>
                  {assistantLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>

              {assistantOpen && (assistantReply.text || assistantLoading) && (
                <div className="assistant-result">
                  <div className="assistant-result-head">
                    <div className="assistant-title"><Bot size={12} /> Asistente Ejecutivo</div>
                    <button className="assistant-close" type="button" onClick={() => setAssistantOpen(false)}>Cerrar</button>
                  </div>

                  <div className="assistant-kpi-row">
                    <span className="assistant-kpi">Citas: {operationalContext.citasHoy}</span>
                    <span className="assistant-kpi">Cierre: {operationalContext.tasaCierre}%</span>
                    <span className="assistant-kpi">Stock critico: {operationalContext.stockCritico}</span>
                  </div>

                  <div className="assistant-result-text">{assistantLoading ? `${adminName}, analizando solicitud con contexto operativo...` : assistantReply.text}</div>
                  {!assistantLoading && Array.isArray(assistantReply.actions) && assistantReply.actions.length > 0 && (
                    <div className="assistant-result-actions">
                      {assistantReply.actions.map((a, idx) => (
                        <button
                          key={`global-assistant-action-${idx}`}
                          className="assistant-action-btn"
                          onClick={() => runAssistantAction(a.actionId)}
                          disabled={a.actionId === 'none'}
                          type="button"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="topbar-right">
              <div className="user-chip">
                <div className="user-avatar">{initials}</div>
                <div>
                  <div className="user-name">{user?.nombre || 'Administrador'}</div>
                  <div className="user-branch">
                    <Building2 size={10} />
                    {user?.sucursal || 'Dirección General'}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="admin-content">
            <Outlet />
          </div>
        </div>

      </div>
    </>
  );
};

export default AdminLayout;
