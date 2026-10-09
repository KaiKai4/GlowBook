import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";

// Primitivas de sesion de infraestructura: sin React, sin features y sin
// decisiones de redireccion. El composition root (src/app/_composition) las
// combina con los casos de uso para construir el RequestContext.

/** Id del usuario autenticado en la sesion actual, o null si no hay sesion. */
export async function readSessionUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Indica si el usuario figura en platform_admins (service_role, solo servidor). */
export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return data !== null;
}
