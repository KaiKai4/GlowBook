import { recordAuditLogEntry } from "./data/audit-log.repo";
import type { AuditEventMap, AuditEventName, AuditEventPayload } from "./events";
import type { DomainEventHandlerTable } from "@/infra/events/domain-events";

// Manejador unico de auditoria: persiste el evento en platform_audit_log.
// Normaliza los opcionales a null/{} aqui, para que los casos de uso no
// tengan que hacerlo. Si la escritura falla, el bus lo convierte en un aviso.
async function writeAuditEvent(payload: AuditEventPayload): Promise<void> {
  await recordAuditLogEntry({
    actorUserId: payload.actorUserId ?? null,
    action: payload.action,
    status: payload.status,
    targetSalonId: payload.targetSalonId ?? null,
    targetResourceType: payload.targetResourceType ?? null,
    targetResourceId: payload.targetResourceId ?? null,
    metadata: payload.metadata ?? {},
    errorMessage: payload.errorMessage ?? null,
  });
}

// Mapa tipado evento -> accion de la bitacora. La clave obliga a cubrir cada
// evento de AuditEventMap, y el valor se comprueba contra su accion declarada:
// añadir un evento sin entrada, o con una accion incorrecta, no compila.
const AUDIT_EVENT_ACTIONS = {
  "platform.salon_invited": "invite_salon",
  "platform.salon_invitation_regenerated": "regenerate_salon_invitation",
  "platform.salon_status_changed": "set_salon_status",
  "platform.salon_features_updated": "update_salon_features",
  "platform.salon_deleted": "delete_salon",
  "platform.feedback_status_changed": "set_feedback_status",
  "salon.invitation_accepted": "invitation_accepted",
  "billing.feature_saved": "billing_feature_saved",
  "billing.plan_created": "billing_plan_created",
  "billing.entitlement_saved": "billing_entitlement_saved",
  "billing.legacy_plan_assigned": "billing_plan_assigned",
  "billing.legacy_override_saved": "billing_override_saved",
  "billing.module_saved": "commercial_module_saved",
  "billing.plan_saved": "commercial_plan_saved",
  "billing.plan_archived": "commercial_plan_archived",
  "billing.plan_deleted": "commercial_plan_deleted",
  "billing.plan_module_saved": "commercial_plan_module_saved",
  "billing.limit_metric_saved": "commercial_limit_metric_saved",
  "billing.plan_limit_saved": "commercial_plan_limit_saved",
  "billing.plan_assigned": "commercial_plan_assigned",
  "billing.plan_override_saved": "commercial_plan_override_saved",
  "billing.addon_saved": "commercial_addon_saved",
  "billing.addon_archived": "commercial_addon_archived",
  "billing.addon_deleted": "commercial_addon_deleted",
  "billing.plan_extra_assigned": "commercial_plan_extra_assigned",
  "billing.plan_extra_canceled": "commercial_plan_extra_canceled",
  "billing.payment_registered": "commercial_plan_payment_recorded",
  "billing.plan_alert_resolved": "commercial_plan_alert_resolved",
} satisfies { readonly [K in AuditEventName]: AuditEventMap[K]["action"] };

// Tabla de manejadores derivada del mapa: cada evento usa el mismo manejador generico.
export const AUDIT_EVENT_HANDLERS = Object.fromEntries(
  (Object.keys(AUDIT_EVENT_ACTIONS) as AuditEventName[]).map((name) => [name, writeAuditEvent])
) as DomainEventHandlerTable<AuditEventMap>;
