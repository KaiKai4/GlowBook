import { recordPlatformAudit } from "@/features/platform/data/platform-audit.repo";
import type { AuditEventHandlerTable, AuditEventPayload } from "./audit-events";

// Manejador unico de auditoria: persiste el evento en platform_audit_log.
// Si la escritura falla, el bus lo convierte en un aviso del caso de uso.
async function writeAuditEvent(payload: AuditEventPayload): Promise<void> {
  await recordPlatformAudit({
    actorUserId: payload.actorUserId,
    action: payload.action,
    status: payload.status,
    targetSalonId: payload.targetSalonId,
    targetResourceType: payload.targetResourceType,
    targetResourceId: payload.targetResourceId,
    metadata: payload.metadata,
    errorMessage: payload.errorMessage,
  });
}

export const AUDIT_EVENT_HANDLERS: AuditEventHandlerTable = {
  "platform.salon_invited": writeAuditEvent,
  "platform.salon_invitation_regenerated": writeAuditEvent,
  "platform.salon_status_changed": writeAuditEvent,
  "platform.salon_features_updated": writeAuditEvent,
  "platform.salon_deleted": writeAuditEvent,
  "platform.feedback_status_changed": writeAuditEvent,
  "salon.invitation_accepted": writeAuditEvent,
  "billing.feature_saved": writeAuditEvent,
  "billing.plan_created": writeAuditEvent,
  "billing.entitlement_saved": writeAuditEvent,
  "billing.legacy_plan_assigned": writeAuditEvent,
  "billing.legacy_override_saved": writeAuditEvent,
  "billing.module_saved": writeAuditEvent,
  "billing.plan_saved": writeAuditEvent,
  "billing.plan_archived": writeAuditEvent,
  "billing.plan_deleted": writeAuditEvent,
  "billing.plan_module_saved": writeAuditEvent,
  "billing.limit_metric_saved": writeAuditEvent,
  "billing.plan_limit_saved": writeAuditEvent,
  "billing.plan_assigned": writeAuditEvent,
  "billing.plan_override_saved": writeAuditEvent,
  "billing.addon_saved": writeAuditEvent,
  "billing.addon_archived": writeAuditEvent,
  "billing.addon_deleted": writeAuditEvent,
  "billing.plan_extra_assigned": writeAuditEvent,
  "billing.plan_extra_canceled": writeAuditEvent,
  "billing.payment_registered": writeAuditEvent,
  "billing.plan_alert_resolved": writeAuditEvent,
};
