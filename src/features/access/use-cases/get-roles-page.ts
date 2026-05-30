import "server-only";

import { findAllPermissions, findRolesWithPermissions } from "../data/roles.repo";

export interface RoleListItem {
  id: string;
  name: string;
  is_system: boolean;
  permissionKeys: string[];
}

export interface RolesPageViewModel {
  roles: RoleListItem[];
  allPermissions: Awaited<ReturnType<typeof findAllPermissions>>;
}

export async function getRolesPage(salonId: string): Promise<RolesPageViewModel> {
  const [roles, allPermissions] = await Promise.all([
    findRolesWithPermissions(salonId),
    findAllPermissions(),
  ]);

  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      is_system: role.is_system,
      permissionKeys: role.role_permissions
        .map((rolePermission) => rolePermission.permission?.key)
        .filter((key): key is string => Boolean(key)),
    })),
    allPermissions,
  };
}
