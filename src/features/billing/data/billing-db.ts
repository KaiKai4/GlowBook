import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";

// service_role: la configuración comercial es cross-tenant y los conteos de uso
// deben funcionar tambien desde el panel de plataforma (sesion sin claim salon_id).
// Todo acceso pasa por use-cases server-only que ya validaron al actor.
// Es el único punto que crea el cliente de billing; el cliente va tipado con Database.
export function billingDb() {
  return createSupabaseAdminClient();
}

export type BillingDb = ReturnType<typeof billingDb>;

/** Lanza el error original de la base si la consulta falla; si no, devuelve las filas (o []). */
export function rowsOrThrow<T>(result: { data: T[] | null; error: PostgrestError | null }): T[] {
  if (result.error) throw result.error;
  return result.data ?? [];
}

/** Lanza el error original de la base si la consulta falla; si no, devuelve el conteo (o 0). */
export function countOrThrow(result: { count: number | null; error: PostgrestError | null }): number {
  if (result.error) throw result.error;
  return result.count ?? 0;
}

/** Lanza el error original de la base si la escritura falla. */
export function throwOnError(result: { error: PostgrestError | null }): void {
  if (result.error) throw result.error;
}
