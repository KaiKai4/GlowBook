import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/infra/config/env";
import type { Database } from "@/types/database.types";

// service_role key: bypasses RLS. ONLY used server-side for platform admin operations.
// NEVER expose to the browser or prefix with NEXT_PUBLIC_.
// The "server-only" import makes any accidental client import fail at build time.
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnv();
  return createClient<Database>(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
