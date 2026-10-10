import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";

// Primitivas de sesion de infraestructura: sin React, sin features y sin
// decisiones de redireccion. El composition root (src/app/_composition) las
// memoiza por peticion y las combina con los casos de uso.

/**
 * Indica si un error de auth es de infraestructura (red, servicio caido o
 * respuesta invalida) y debe lanzarse. Los errores del cliente (4xx: sin sesion,
 * JWT invalido o caducado, usuario inexistente) significan "sin sesión".
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
 * Un fallo de red o de auth distinto de "sin sesión" se lanza.
 */
export async function readSessionUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (isAuthInfrastructureError(error)) throw error;
  return data.user?.id ?? null;
}
