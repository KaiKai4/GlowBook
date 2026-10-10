import { runSideEffect } from "@/infra/effects/run-side-effect";
import { recordAuditEvent } from "./audit-event-writer";
import type { AuditEventMap, AuditEventName } from "./events";

/**
 * Emite el evento de auditoria de una accion ya confirmada (post-commit). La
 * escritura se ejecuta en el mismo proceso, dentro de runSideEffect: si falla se
 * registra con contexto y se devuelve un aviso; nunca rechaza.
 * Sin actor no hay evento: la accion la ejecuto el sistema, no un admin.
 */
export async function publishAuditEvent<TName extends AuditEventName>(
  name: TName,
  payload: AuditEventMap[TName]
): Promise<string[]> {
  if (!payload.actorUserId) return [];

  const outcome = await runSideEffect(name, () => recordAuditEvent(payload), {
    module: "platform",
    action: "record_audit",
    metadata: {
      auditAction: payload.action,
      auditStatus: payload.status,
      targetSalonId: payload.targetSalonId ?? null,
      targetResourceId: payload.targetResourceId ?? null,
    },
  });
  return outcome.ok ? [] : [outcome.warning];
}
