import { requireProfile } from "@/infra/auth/session";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { getRolesPage } from "@/features/access/use-cases/get-roles-page";
import { RolesManager } from "./roles-manager";

export default async function RolesPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para gestionar roles.</p>
      </div>
    );
  }

  const { roles, allPermissions } = await getRolesPage(profile.salon_id);

  return <RolesManager roles={roles} allPermissions={allPermissions} />;
}
