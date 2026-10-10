import "server-only";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";

/**
 * Indica si el usuario figura en platform_admins. Usa service_role, por eso vive
 * solo en el servidor (ADR 0010). La decision de acceso la toma el composition root.
 */
export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}
