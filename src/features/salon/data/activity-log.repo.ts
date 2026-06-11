import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string;
  table_name: string;
  action: "insert" | "update" | "delete";
  record_id: string | null;
  record_label: string;
  created_at: string;
}

// Lectura con el cliente del usuario: la RLS garantiza que solo ve la
// actividad de su propio salon y solo con permiso salon.manage.
export async function findSalonActivity(limit = 150): Promise<ActivityLogRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salon_activity_log")
    .select("id, actor_id, actor_email, table_name, action, record_id, record_label, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLogRow[];
}
