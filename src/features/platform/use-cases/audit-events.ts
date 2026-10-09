import type { PlatformAuditAction, PlatformAuditStatus } from "@/features/platform/data/platform-audit.repo";
import { createDomainEventBus, type DomainEventHandlerTable } from "@/infra/events/domain-events";
import type { Json } from "@/types/database.types";

// Eventos de auditoria. Los casos de uso NO escriben la auditoria: emiten un
// evento tras el commit y el manejador registrado la persiste.
export type AuditEventName =
  | "platform.salon_invited"
  | "platform.salon_invitation_regenerated"
  | "platform.salon_status_changed"
  | "platform.salon_features_updated"
  | "platform.salon_deleted"
  | "platform.feedback_status_changed"
  | "salon.invitation_accepted"
  | "billing.feature_saved"
  | "billing.plan_created"
  | "billing.entitlement_saved"
  | "billing.legacy_plan_assigned"
  | "billing.legacy_override_saved"
  | "billing.module_saved"
  | "billing.plan_saved"
  | "billing.plan_archived"
  | "billing.plan_deleted"
  | "billing.plan_module_saved"
  | "billing.limit_metric_saved"
  | "billing.plan_limit_saved"
  | "billing.plan_assigned"
  | "billing.plan_override_saved"
  | "billing.addon_saved"
  | "billing.addon_archived"
  | "billing.addon_deleted"
  | "billing.plan_extra_assigned"
  | "billing.plan_extra_canceled"
  | "billing.payment_registered"
  | "billing.plan_alert_resolved";

export interface AuditEventPayload {
  actorUserId: string;
  action: PlatformAuditAction;
  status: PlatformAuditStatus;
  targetSalonId: string | null;
  targetResourceType: string | null;
  targetResourceId: string | null;
  metadata: Record<string, Json | undefined>;
  errorMessage: string | null;
}

export type AuditEventMap = { readonly [K in AuditEventName]: AuditEventPayload };

// Cada accion de auditoria tiene exactamente un evento. Tipado completo: si se
// añade una accion nueva, el compilador exige su evento.
export const AUDIT_EVENT_BY_ACTION: Record<PlatformAuditAction, AuditEventName> = {
  invite_salon: "platform.salon_invited",
  regenerate_salon_invitation: "platform.salon_invitation_regenerated",
  set_salon_status: "platform.salon_status_changed",
  update_salon_features: "platform.salon_features_updated",
  delete_salon: "platform.salon_deleted",
  set_feedback_status: "platform.feedback_status_changed",
  invitation_accepted: "salon.invitation_accepted",
  billing_feature_saved: "billing.feature_saved",
  billing_plan_created: "billing.plan_created",
  billing_entitlement_saved: "billing.entitlement_saved",
  billing_plan_assigned: "billing.legacy_plan_assigned",
  billing_override_saved: "billing.legacy_override_saved",
  commercial_module_saved: "billing.module_saved",
  commercial_plan_saved: "billing.plan_saved",
  commercial_plan_archived: "billing.plan_archived",
  commercial_plan_deleted: "billing.plan_deleted",
  commercial_plan_module_saved: "billing.plan_module_saved",
  commercial_limit_metric_saved: "billing.limit_metric_saved",
  commercial_plan_limit_saved: "billing.plan_limit_saved",
  commercial_plan_assigned: "billing.plan_assigned",
  commercial_plan_override_saved: "billing.plan_override_saved",
  commercial_addon_saved: "billing.addon_saved",
  commercial_addon_archived: "billing.addon_archived",
  commercial_addon_deleted: "billing.addon_deleted",
  commercial_plan_extra_assigned: "billing.plan_extra_assigned",
  commercial_plan_extra_canceled: "billing.plan_extra_canceled",
  commercial_plan_payment_recorded: "billing.payment_registered",
  commercial_plan_alert_resolved: "billing.plan_alert_resolved",
};

export const auditBus = createDomainEventBus<AuditEventMap>();

export type AuditEventHandlerTable = DomainEventHandlerTable<AuditEventMap>;
