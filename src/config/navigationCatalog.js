import { hasPermission } from '../services/permissionService';

/**
 * Catálogo central de navegación del ERP.
 * Cada ítem se muestra solo si el usuario tiene el permiso correspondiente.
 */
export const NAV_CATALOG = [
  { id: 'inicio', label: 'Inicio', path: '/inicio', group: 'Principal', always: true, icon: 'Home' },

  { id: 'shared.agenda', label: 'Agenda', path: '/agenda', group: 'General', permission: ['shared.agenda', 'doctor.agenda'], fallbackRoles: ['medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion', 'operativo', 'jefa_enfermeria', 'jefa'], icon: 'CalendarDays' },
  { id: 'shared.pacientes', label: 'Pacientes', path: '/pacientes', group: 'General', permission: 'shared.pacientes', fallbackRoles: ['admin', 'admin_maestro', 'administrador', 'medico', 'doctor', 'enfermeria', 'enfermera', 'enfermero', 'recepcion'], icon: 'Users' },

  { id: 'doctor.capacitacion', label: 'Capacitación', path: '/doctor/capacitacion', group: 'Médico', permission: 'doctor.agenda', fallbackRoles: ['medico', 'doctor'], icon: 'BookOpen' },

  { id: 'enfermeria.dashboard', label: 'Agenda enfermería', path: '/enfermeria/dashboard', group: 'Enfermería', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: 'LayoutDashboard' },
  { id: 'enfermeria.triage', label: 'Triage', path: '/enfermeria/triage', group: 'Enfermería', permission: 'enfermeria.triage', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: 'Syringe' },
  { id: 'enfermeria.hoja', label: 'Hoja de enfermería', path: '/enfermeria/hoja-enfermeria', group: 'Enfermería', permission: 'enfermeria.hoja', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero'], icon: 'Clipboard' },
  { id: 'enfermeria.jefatura', label: 'Jefatura', path: '/enfermeria/jefatura', group: 'Enfermería', permission: 'enfermeria.jefatura', fallbackRoles: ['jefa_enfermeria', 'jefa'], icon: 'Crown' },
  { id: 'enfermeria.registros', label: 'Registros', path: '/enfermeria/registros', group: 'Enfermería', permission: 'enfermeria.jefatura', fallbackRoles: ['jefa_enfermeria', 'jefa'], icon: 'ClipboardList' },
  { id: 'enfermeria.carro', label: 'Carro rojo', path: '/enfermeria/carro-rojo', group: 'Enfermería', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa'], icon: 'HeartPulse' },
  { id: 'enfermeria.caducidades', label: 'Caducidades', path: '/enfermeria/caducidades', group: 'Enfermería', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa'], icon: 'Package' },
  { id: 'enfermeria.capacitacion', label: 'Capacitación', path: '/enfermeria/capacitacion', group: 'Enfermería', permission: 'enfermeria.dashboard', fallbackRoles: ['enfermeria', 'enfermera', 'enfermero', 'jefa_enfermeria', 'jefa'], icon: 'BookOpen' },
  // Expediente enfermería NO se lista en el menú: se abre solo desde la agenda con paciente.

  { id: 'admin.dashboard', label: 'Dashboard', path: '/admin/dashboard', group: 'Administración', permission: 'admin.dashboard', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'LayoutDashboard' },
  { id: 'admin.usuarios', label: 'Personal', path: '/admin/usuarios', group: 'Administración', permission: 'admin.usuarios', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'UserCog' },
  { id: 'admin.agenda', label: 'Agenda admin', path: '/admin/agenda', group: 'Administración', permission: 'admin.dashboard', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'CalendarDays' },
  { id: 'admin.inventario', label: 'Inventario', path: '/admin/inventario', group: 'Administración', permission: 'admin.dashboard', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'Package' },
  { id: 'admin.catalogos', label: 'Catálogos', path: '/admin/catalogos', group: 'Administración', permission: 'admin.catalogos', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'Tag' },
  { id: 'admin.plantillas', label: 'Plantillas', path: '/admin/plantillas', group: 'Administración', permission: 'admin.plantillas', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'FileText' },
  { id: 'admin.reportes', label: 'Reportes', path: '/admin/reportes', group: 'Administración', permission: 'admin.reportes', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'BarChart3' },
  { id: 'admin.encuestas', label: 'Encuestas', path: '/admin/encuestas', group: 'Administración', permission: 'admin.reportes', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'MessageCircle' },
  { id: 'admin.monitor', label: 'Monitor', path: '/admin/monitor', group: 'Administración', permission: 'admin.monitor', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'Activity' },
  { id: 'admin.supervision', label: 'Supervisión', path: '/admin/supervision', group: 'Administración', permission: 'admin.monitor', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'Eye' },
  { id: 'admin.depuracion', label: 'Depuración', path: '/admin/depuracion', group: 'Administración', permission: 'admin.monitor', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'FlaskConical' },
  { id: 'admin.ssa', label: 'SSA', path: '/admin/ssa', group: 'Administración', permission: 'admin.dashboard', fallbackRoles: ['admin', 'admin_maestro', 'administrador'], icon: 'ShieldCheck' },

  { id: 'rh.dashboard', label: 'Dashboard RH', path: '/rh/dashboard', group: 'Recursos Humanos', permission: 'rh.dashboard', fallbackRoles: ['rh', 'recursos_humanos', 'recursos humanos'], icon: 'LayoutDashboard' },

  { id: 'intendencia.registro', label: 'Bitácora limpieza', path: '/intendencia/registro', group: 'Intendencia', permission: 'intendencia.registro', fallbackRoles: ['intendencia', 'limpieza'], icon: 'SprayCan' },
];

const GROUP_ORDER = ['Principal', 'General', 'Médico', 'Enfermería', 'Administración', 'Recursos Humanos', 'Intendencia'];

/** Grupo prioritario en el panel según el rol del usuario. */
const ROLE_PRIMARY_GROUP = {
  admin: 'Administración',
  admin_maestro: 'Administración',
  administrador: 'Administración',
  medico: 'General',
  doctor: 'General',
  enfermeria: 'Enfermería',
  enfermera: 'Enfermería',
  enfermero: 'Enfermería',
  jefa_enfermeria: 'Enfermería',
  jefa: 'Enfermería',
  rh: 'Recursos Humanos',
  recursos_humanos: 'Recursos Humanos',
  'recursos humanos': 'Recursos Humanos',
  intendencia: 'Intendencia',
  limpieza: 'Intendencia',
  recepcion: 'General',
  operativo: 'General',
};

export const canAccessNavItem = (user, item) => {
  if (!user) return false;
  if (item.always) return true;
  const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];
  return permissions.some((perm) => hasPermission(user, perm, item.fallbackRoles || []));
};

export const getNavItemsForUser = (user) =>
  NAV_CATALOG.filter((item) => canAccessNavItem(user, item));

/** Orden de grupos: Inicio → sección del rol → resto. */
export const getGroupOrderForUser = (user) => {
  const rol = String(user?.rol || '').toLowerCase().trim();
  const primary = ROLE_PRIMARY_GROUP[rol] || null;
  const ordered = ['Principal'];
  if (primary) ordered.push(primary);
  GROUP_ORDER.forEach((g) => {
    if (!ordered.includes(g)) ordered.push(g);
  });
  return ordered;
};

export const getGroupedNavForUser = (user) => {
  const items = getNavItemsForUser(user);
  const groups = {};
  items.forEach((item) => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });
  return getGroupOrderForUser(user)
    .filter((g) => groups[g]?.length)
    .map((g) => ({ group: g, items: groups[g] }));
};

export const getQuickAccessItems = (user, { excludeInicio = true, limit = 8 } = {}) => {
  const grouped = getGroupedNavForUser(user);
  let items = grouped.flatMap((g) => g.items);
  if (excludeInicio) items = items.filter((i) => i.id !== 'inicio');
  return items.slice(0, limit);
};
