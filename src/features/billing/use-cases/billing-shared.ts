import "server-only";

import { recordPlatformAction } from "@/features/platform/use-cases/platform-audit";

export type CommercialAuditAction =
  | "commercial_module_saved"
  | "commercial_plan_saved"
  | "commercial_plan_archived"
  | "commercial_plan_deleted"
  | "commercial_plan_module_saved"
  | "commercial_limit_metric_saved"
  | "commercial_plan_limit_saved"
  | "commercial_addon_saved"
  | "commercial_addon_archived"
  | "commercial_addon_deleted"
  | "commercial_plan_assigned"
  | "commercial_plan_override_saved"
  | "commercial_plan_extra_assigned"
  | "commercial_plan_extra_canceled"
  | "commercial_plan_payment_recorded"
  | "commercial_plan_alert_resolved";

export async function auditBilling(
  actorUserId: string | null | undefined,
  action: CommercialAuditAction,
  targetResourceId: string
) {
  await recordPlatformAction({
    actorUserId: actorUserId ?? null,
    action,
    status: "succeeded",
    targetResourceType: "commercial_plan",
    targetResourceId,
  });
}

export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dateOrNull(value?: string | null) {
  return value && value.trim() ? value : null;
}

export function errorMessage(prefix: string, error: unknown) {
  if (error instanceof Error && error.message) return `${prefix} ${error.message}`;
  return prefix;
}
