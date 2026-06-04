import "server-only";

import { findRolesWithPermissions } from "../data/roles.repo";

export interface RoleOptionView {
  id: string;
  name: string;
}

export async function getAssignableRoleOptions(salonId: string): Promise<RoleOptionView[]> {
  const roles = await findRolesWithPermissions(salonId);

  return roles
    .filter((role) => !role.is_system)
    .map((role) => ({ id: role.id, name: role.name }));
}
