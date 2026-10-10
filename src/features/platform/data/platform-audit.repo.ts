import "server-only";
import type { PlatformAuditAction, PlatformAuditStatus } from "@/features/audit";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import type { Database } from "@/types/database.types";

const DEFAULT_AUDIT_PAGE_SIZE = 100;
/** Tope duro de filas por consulta de auditoría. */
const MAX_AUDIT_PAGE_SIZE = 200;

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
  limit = DEFAULT_AUDIT_PAGE_SIZE,
}: FindPlatformAuditLogInput = {}): Promise<PlatformAuditRow[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("platform_audit_log")
    .select(
      "id, actor_user_id, action, status, target_salon_id, target_resource_type, target_resource_id, metadata, error_message, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), MAX_AUDIT_PAGE_SIZE));

  if (action) query = query.eq("action", action);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
