import "server-only";
import type { PlatformAuditAction, PlatformAuditStatus } from "@/features/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

// Lectura de la bitacora de plataforma. La escritura vive en el modulo audit.
export type PlatformAuditRow = Database["public"]["Tables"]["platform_audit_log"]["Row"];

export interface FindPlatformAuditLogInput {
  action?: PlatformAuditAction;
  status?: PlatformAuditStatus;
  limit?: number;
}

export async function findPlatformAuditLog({
  action,
  status,
  limit = 100,
}: FindPlatformAuditLogInput = {}): Promise<PlatformAuditRow[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("platform_audit_log")
    .select(
      "id, actor_user_id, action, status, target_salon_id, target_resource_type, target_resource_id, metadata, error_message, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (action) query = query.eq("action", action);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
