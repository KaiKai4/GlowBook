import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database.types";

export type PlatformAuditAction =
  | "invite_salon"
  | "regenerate_salon_invitation"
  | "set_salon_status"
  | "update_salon_features"
  | "delete_salon"
  | "set_feedback_status"
  | "billing_feature_saved"
  | "billing_plan_created"
  | "billing_entitlement_saved"
  | "billing_plan_assigned"
  | "billing_override_saved"
  | "commercial_module_saved"
  | "commercial_plan_saved"
  | "commercial_plan_archived"
  | "commercial_plan_deleted"
  | "commercial_plan_module_saved"
  | "commercial_limit_metric_saved"
  | "commercial_plan_limit_saved"
  | "commercial_plan_assigned"
  | "commercial_plan_override_saved"
  | "commercial_addon_saved"
  | "commercial_addon_archived"
  | "commercial_addon_deleted"
  | "commercial_plan_extra_assigned"
  | "commercial_plan_extra_canceled"
  | "commercial_plan_payment_recorded"
  | "commercial_plan_alert_resolved"
  | "invitation_accepted";

export type PlatformAuditStatus = "succeeded" | "failed";
export type PlatformAuditRow = Database["public"]["Tables"]["platform_audit_log"]["Row"];

export interface RecordPlatformAuditInput {
  actorUserId: string | null;
  action: PlatformAuditAction;
  status: PlatformAuditStatus;
  targetSalonId?: string | null;
  targetResourceType?: string | null;
  targetResourceId?: string | null;
  metadata?: Record<string, Json | undefined>;
  errorMessage?: string | null;
}

export async function recordPlatformAudit(input: RecordPlatformAuditInput): Promise<void> {
  const admin = createSupabaseAdminClient();
  const row: Database["public"]["Tables"]["platform_audit_log"]["Insert"] = {
    actor_user_id: input.actorUserId,
    action: input.action,
    status: input.status,
    target_salon_id: input.targetSalonId ?? null,
    target_resource_type: input.targetResourceType ?? null,
    target_resource_id: input.targetResourceId ?? null,
    metadata: JSON.parse(JSON.stringify(input.metadata ?? {})),
    error_message: input.errorMessage ?? null,
  };

  const { error } = await admin.from("platform_audit_log").insert(row);
  if (error) throw error;
}

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
