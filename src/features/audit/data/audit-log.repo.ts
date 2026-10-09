import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";
import type { PlatformAuditAction, PlatformAuditStatus } from "../domain/audit-actions";

// Escritura de la bitacora de plataforma (platform_audit_log). Solo la usa el
// manejador de eventos de auditoria; la lectura vive en el modulo platform.
export interface AuditLogEntry {
  actorUserId: string | null;
  action: PlatformAuditAction;
  status: PlatformAuditStatus;
  targetSalonId: string | null;
  targetResourceType: string | null;
  targetResourceId: string | null;
  metadata: Record<string, Json | undefined>;
  errorMessage: string | null;
}

export async function recordAuditLogEntry(entry: AuditLogEntry): Promise<void> {
  const admin = createSupabaseAdminClient();
  const row: Database["public"]["Tables"]["platform_audit_log"]["Insert"] = {
    actor_user_id: entry.actorUserId,
    action: entry.action,
    status: entry.status,
    target_salon_id: entry.targetSalonId,
    target_resource_type: entry.targetResourceType,
    target_resource_id: entry.targetResourceId,
    metadata: JSON.parse(JSON.stringify(entry.metadata)),
    error_message: entry.errorMessage,
  };

  const { error } = await admin.from("platform_audit_log").insert(row);
  if (error) throw error;
}
