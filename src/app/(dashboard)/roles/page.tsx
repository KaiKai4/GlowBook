import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findRolesWithPermissions, findAllPermissions } from "@/features/access/data/roles.repo";
import { RolesManager } from "./roles-manager";

export default async function RolesPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar roles.</p>
      </div>
    );
  }

  const [roles, allPermissions] = await Promise.all([
    findRolesWithPermissions(profile.salon_id),
    findAllPermissions(),
  ]);

  const roleList = roles.map((r) => ({
    id: r.id,
    name: r.name,
    is_system: r.is_system,
    permissionKeys: r.role_permissions
      .map((rp) => rp.permission?.key)
      .filter((k): k is string => !!k),
  }));

  return <RolesManager roles={roleList} allPermissions={allPermissions} />;
}
