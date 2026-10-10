import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/infra/config/env";
import type { Database } from "@/types/database.types";

// service_role key: bypasses RLS. ONLY used server-side for platform admin operations.
// NEVER expose to the browser or prefix with NEXT_PUBLIC_.
// The "server-only" import makes any accidental client import fail at build time.

// Singleton por modulo: el cliente se crea en la primera llamada y se reutiliza.
// No guarda estado de sesion (persistSession y autoRefreshToken desactivados), asi
// que compartirlo entre peticiones es seguro.
let adminClient: SupabaseClient<Database> | null = null;

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const { url } = getSupabasePublicEnv();
  adminClient = createClient<Database>(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
