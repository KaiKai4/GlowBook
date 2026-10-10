import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";

// Primitivas de sesion de infraestructura: sin React, sin features y sin
// decisiones de redireccion. El composition root (src/app/_composition) las
// combina con los casos de uso para construir el RequestContext.

/**
 * Indica si un error de auth es de infraestructura (red, servicio caido o
 * respuesta invalida) y debe lanzarse. Los errores del cliente (4xx: sin sesion,
 * JWT invalido o caducado, usuario inexistente) significan "sin sesion".
 */
export function isAuthInfrastructureError(
  error: { name?: string; status?: number } | null
): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  if (error.status === undefined || error.status === 0) return true;
  return error.status >= 500;
}

/**
 * Id del usuario autenticado en la sesion actual, o null si no hay sesion.
 * Un fallo de red o de auth distinto de "sin sesion" se lanza.
 */
export async function readSessionUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (isAuthInfrastructureError(error)) throw error;
  return data.user?.id ?? null;
}

/** Indica si el usuario figura en platform_admins (service_role, solo servidor). */
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
