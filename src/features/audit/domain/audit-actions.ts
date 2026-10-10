// Catálogo cerrado de acciones y estados de la auditoria de plataforma.
// Dominio puro: sin I/O ni dependencias de infraestructura.

export const PLATFORM_AUDIT_ACTIONS = [
  "invite_salon",
  "regenerate_salon_invitation",
  "set_salon_status",
  "update_salon_features",
  "delete_salon",
  "set_feedback_status",
  "billing_feature_saved",
  "billing_plan_created",
  "billing_entitlement_saved",
  "billing_plan_assigned",
  "billing_override_saved",
  "commercial_module_saved",
  "commercial_plan_saved",
  "commercial_plan_archived",
  "commercial_plan_deleted",
  "commercial_plan_module_saved",
  "commercial_limit_metric_saved",
  "commercial_plan_limit_saved",
  "commercial_plan_assigned",
  "commercial_plan_override_saved",
  "commercial_addon_saved",
  "commercial_addon_archived",
  "commercial_addon_deleted",
  "commercial_plan_extra_assigned",
  "commercial_plan_extra_canceled",
  "commercial_plan_payment_recorded",
  "commercial_plan_alert_resolved",
  "invitation_accepted",
] as const;

export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];

export type PlatformAuditStatus = "succeeded" | "failed";
