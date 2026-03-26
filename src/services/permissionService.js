const normalizeRole = (role = '') => String(role || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const ADMIN_ROLES = new Set(['admin', 'admin_maestro', 'administrador']);

export const hasPermission = (user, permissionId, fallbackRoles = []) => {
  if (!user) return false;
  const role = normalizeRole(user.rol);

  // Hard guard for admin profiles: they should always access admin modules.
  if (ADMIN_ROLES.has(role) && String(permissionId || '').startsWith('admin.')) {
    return true;
  }

  const permissionMap = user.permissions || {};
  const permissionList = Array.isArray(user.permissionList) ? user.permissionList : [];

  const hasExplicitPermissions = permissionList.length > 0 || Object.keys(permissionMap).length > 0;
  if (hasExplicitPermissions) {
    if (permissionList.length > 0) return permissionList.includes(permissionId);
    return !!permissionMap[permissionId];
  }

  return fallbackRoles.map(normalizeRole).includes(role);
};

export const resolveUserHomePath = (user, roleDefaultPath = '/agenda') => {
  if (!user) return '/';
  const role = normalizeRole(user.rol);

  // Mantener home principal por rol para perfiles no admin.
  // Los accesos extra se consumen via navegación/shortcuts sin mover la portada.
  if (!ADMIN_ROLES.has(role)) {
    return roleDefaultPath;
  }

  const routePriority = [
    { permission: 'admin.dashboard', path: '/admin/dashboard', roles: ['admin', 'admin_maestro', 'administrador'] },
    { permission: 'enfermeria.jefatura', path: '/enfermeria/jefatura', roles: ['jefa_enfermeria', 'jefa'] },
    { permission: 'rh.dashboard', path: '/rh/dashboard', roles: ['rh', 'recursos_humanos', 'recursos humanos'] },
    { permission: 'intendencia.registro', path: '/intendencia/registro', roles: ['intendencia', 'limpieza'] },
    { permission: 'enfermeria.dashboard', path: '/enfermeria/dashboard', roles: ['enfermeria', 'enfermera', 'enfermero'] },
    { permission: 'doctor.agenda', path: '/agenda', roles: ['medico', 'doctor'] },
    { permission: 'shared.agenda', path: '/agenda', roles: ['recepcion', 'operativo'] }
  ];

  const found = routePriority.find((entry) => hasPermission(user, entry.permission, entry.roles));
  return found?.path || roleDefaultPath;
};
