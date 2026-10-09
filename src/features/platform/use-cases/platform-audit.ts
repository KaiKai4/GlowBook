import type { RecordPlatformAuditInput } from "@/features/platform/data/platform-audit.repo";
import { registerDomainEventHandlers } from "@/infra/events/register-handlers";
import { AUDIT_EVENT_HANDLERS } from "./audit-event-handlers";
import { AUDIT_EVENT_BY_ACTION, auditBus } from "./audit-events";

/**
 * Emite el evento de auditoria de una accion ya confirmada (post-commit).
 * Devuelve avisos si el manejador de auditoria fallo; nunca rechaza.
 * Sin actor no hay evento: la accion la ejecuto el sistema, no un admin.
 */
export async function recordPlatformAction(input: RecordPlatformAuditInput): Promise<string[]> {
  if (!input.actorUserId) return [];

  registerDomainEventHandlers(auditBus, AUDIT_EVENT_HANDLERS);

  return auditBus.publish(
    AUDIT_EVENT_BY_ACTION[input.action],
    {
      actorUserId: input.actorUserId,
      action: input.action,
      status: input.status,
      targetSalonId: input.targetSalonId ?? null,
      targetResourceType: input.targetResourceType ?? null,
      targetResourceId: input.targetResourceId ?? null,
      metadata: input.metadata ?? {},
      errorMessage: input.errorMessage ?? null,
    },
    {
      module: "platform",
      action: "record_audit",
      metadata: {
        auditAction: input.action,
        auditStatus: input.status,
        targetSalonId: input.targetSalonId ?? null,
        targetResourceId: input.targetResourceId ?? null,
      },
    }
  );
}
