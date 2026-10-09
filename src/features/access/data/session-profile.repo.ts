import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { ProfileWithRole } from "@/types/app.types";

/** Perfil del usuario con su rol y permisos (sin modulos efectivos del plan). */
export async function findSessionProfile(userId: string): Promise<ProfileWithRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, salon_id, role_id, is_owner, full_name, is_active, salon:salons(disabled_features), role:roles(id, name, role_permissions(permission:permissions(id, key, description)))")
    .eq("id", userId)
    .single();

  if (!data) return null;
  return data as unknown as ProfileWithRole;
}

/** Estado del salon (activo o no) o null si no existe. */
export async function findSalonAccessState(
  salonId: string
): Promise<{ id: string; is_active: boolean } | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salons")
    .select("id, is_active")
    .eq("id", salonId)
    .maybeSingle();
  return data;
}
