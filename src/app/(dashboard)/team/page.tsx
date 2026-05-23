import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findRolesWithPermissions } from "@/features/access/data/roles.repo";
import { TeamManager } from "./team-manager";

export default async function TeamPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.EMPLOYEES_MANAGE)) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-400">No tienes permiso para gestionar el equipo.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: members }, roles] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, is_owner, role_id")
      .eq("salon_id", profile.salon_id)
      .order("full_name"),
    findRolesWithPermissions(profile.salon_id),
  ]);

  const roleOptions = roles
    .filter((r) => !r.is_system)
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Equipo</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Asigna roles a los miembros que pueden iniciar sesión en el salón.
        </p>
      </div>
      <TeamManager members={members ?? []} roles={roleOptions} />
    </div>
  );
}
