import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";

/**
 * Descarta un cliente temporal y sus citas canceladas o no presentadas en una sola transacción.
 * Los errores llegan tal cual del cliente de Supabase: el caso de uso traduce el código SQLSTATE
 * a un mensaje público fijo.
 */
export async function discardTemporaryCustomerRpc(customerId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("discard_temporary_customer", { p_customer_id: customerId });
  if (error) throw error;
}
