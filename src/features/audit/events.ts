import type { Json } from "@/types/database.types";
import type { PlatformAuditAction, PlatformAuditStatus } from "./domain/audit-actions";

// Payload de un evento de auditoria. La accion va fijada por el propio evento
// (ver AuditEventMap): un caso de uso no puede emitir "billing.plan_saved" con
// una accion distinta de "commercial_plan_saved".
export type AuditEventPayload<TAction extends PlatformAuditAction = PlatformAuditAction> = {
  actorUserId?: string | null;
  action: TAction;
  status: PlatformAuditStatus;
  targetSalonId?: string | null;
  targetResourceType?: string | null;
  targetResourceId?: string | null;
  metadata?: Record<string, Json | undefined>;
  errorMessage?: string | null;
};

// Catalogo tipado de eventos. Cada evento corresponde a exactamente una accion
// de la bitacora; añadir un evento obliga a tocar el manejador y su test.
export type AuditEventMap = {
  "platform.salon_invited": AuditEventPayload<"invite_salon">;
  "platform.salon_invitation_regenerated": AuditEventPayload<"regenerate_salon_invitation">;
  "platform.salon_status_changed": AuditEventPayload<"set_salon_status">;
  "platform.salon_features_updated": AuditEventPayload<"update_salon_features">;
  "platform.salon_deleted": AuditEventPayload<"delete_salon">;
  "platform.feedback_status_changed": AuditEventPayload<"set_feedback_status">;
  "salon.invitation_accepted": AuditEventPayload<"invitation_accepted">;
  "billing.feature_saved": AuditEventPayload<"billing_feature_saved">;
  "billing.plan_created": AuditEventPayload<"billing_plan_created">;
  "billing.entitlement_saved": AuditEventPayload<"billing_entitlement_saved">;
  "billing.legacy_plan_assigned": AuditEventPayload<"billing_plan_assigned">;
  "billing.legacy_override_saved": AuditEventPayload<"billing_override_saved">;
  "billing.module_saved": AuditEventPayload<"commercial_module_saved">;
  "billing.plan_saved": AuditEventPayload<"commercial_plan_saved">;
  "billing.plan_archived": AuditEventPayload<"commercial_plan_archived">;
  "billing.plan_deleted": AuditEventPayload<"commercial_plan_deleted">;
  "billing.plan_module_saved": AuditEventPayload<"commercial_plan_module_saved">;
  "billing.limit_metric_saved": AuditEventPayload<"commercial_limit_metric_saved">;
  "billing.plan_limit_saved": AuditEventPayload<"commercial_plan_limit_saved">;
  "billing.plan_assigned": AuditEventPayload<"commercial_plan_assigned">;
  "billing.plan_override_saved": AuditEventPayload<"commercial_plan_override_saved">;
  "billing.addon_saved": AuditEventPayload<"commercial_addon_saved">;
  "billing.addon_archived": AuditEventPayload<"commercial_addon_archived">;
  "billing.addon_deleted": AuditEventPayload<"commercial_addon_deleted">;
  "billing.plan_extra_assigned": AuditEventPayload<"commercial_plan_extra_assigned">;
  "billing.plan_extra_canceled": AuditEventPayload<"commercial_plan_extra_canceled">;
  "billing.payment_registered": AuditEventPayload<"commercial_plan_payment_recorded">;
  "billing.plan_alert_resolved": AuditEventPayload<"commercial_plan_alert_resolved">;
};

export type AuditEventName = keyof AuditEventMap;
