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

export const resolveUserHomePath = () => '/inicio';
