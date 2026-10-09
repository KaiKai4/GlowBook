import { createDomainEventBus } from "@/infra/events/domain-events";
import { registerDomainEventHandlers } from "@/infra/events/register-handlers";
import { AUDIT_EVENT_HANDLERS } from "./audit-event-handlers";
import type { AuditEventMap, AuditEventName } from "./events";

const auditBus = createDomainEventBus<AuditEventMap>();

/**
 * Emite el evento de auditoria de una accion ya confirmada (post-commit).
 * Devuelve avisos si el manejador de auditoria fallo; nunca rechaza.
 * Sin actor no hay evento: la accion la ejecuto el sistema, no un admin.
 */
export async function publishAuditEvent<TName extends AuditEventName>(
  name: TName,
  payload: AuditEventMap[TName]
): Promise<string[]> {
  if (!payload.actorUserId) return [];

  registerDomainEventHandlers(auditBus, AUDIT_EVENT_HANDLERS);

  return auditBus.publish(name, payload, {
    module: "platform",
    action: "record_audit",
    metadata: {
      auditAction: payload.action,
      auditStatus: payload.status,
      targetSalonId: payload.targetSalonId ?? null,
      targetResourceId: payload.targetResourceId ?? null,
    },
  });
}
