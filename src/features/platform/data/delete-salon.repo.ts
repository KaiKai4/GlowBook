import "server-only";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { deleteAuthUser } from "@/infra/supabase/auth-admin";

export async function deleteSalonCompletely(salonId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: salon, error: salonError } = await admin
    .from("salons")
    .select("id")
    .eq("id", salonId)
    .maybeSingle();
  if (salonError) throw salonError;
  if (!salon) throw new Error("Salón no encontrado.");

  const { data: deletedUsers, error } = await admin.rpc("delete_salon_completely", {
    p_salon_id: salonId,
  });
  if (error) throw error;

  const authCleanupErrors: string[] = [];
  for (const profile of deletedUsers ?? []) {
    const { error: authError } = await deleteAuthUser(profile.user_id);
    if (authError && authError.status !== 404) {
      authCleanupErrors.push(`${profile.user_id}: ${authError.message}`);
    }
  }

  if (authCleanupErrors.length > 0) {
    throw new Error(
      `Los datos del salón fueron eliminados, pero no se pudieron borrar ${authCleanupErrors.length} cuenta(s) Auth: ${authCleanupErrors.join("; ")}`
    );
  }
}
