import { recordAuditLogEntry } from "./data/audit-log.repo";
import type { AuditEventPayload } from "./events";

// Escritor unico de auditoria: persiste el evento en platform_audit_log.
// Normaliza los opcionales a null/{} aquí, para que los casos de uso no
// tengan que hacerlo. Si la escritura falla, la rechaza: quien lo llama
// (publishAuditEvent, dentro de runSideEffect) la convierte en un aviso.
export async function recordAuditEvent(payload: AuditEventPayload): Promise<void> {
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
