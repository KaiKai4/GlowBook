import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";

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

// Lectura con el cliente del usuario. La RLS limita el acceso a la actividad de
// su salon (con permiso salon.manage); el filtro explicito por salon_id es la
// regla de la casa (AGENTS.md §3) y no se confia solo en la RLS.
export async function findSalonActivity(salonId: string, limit = 150): Promise<ActivityLogRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salon_activity_log")
    .select("id, actor_id, actor_email, table_name, action, record_id, record_label, created_at")
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ActivityLogRow[];
}
