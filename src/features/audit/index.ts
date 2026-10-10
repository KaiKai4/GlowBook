// Punto publico del modulo audit. Otros modulos importan solo desde aqui.
// Indice de servidor: publishAuditEvent escribe en la bitacora (platform_audit_log)
// dentro de runSideEffect. Los casos de uso emiten su evento tras el commit.
import "server-only";

export { publishAuditEvent } from "./publish-audit-event";
export { PLATFORM_AUDIT_ACTIONS, type PlatformAuditAction, type PlatformAuditStatus } from "./domain/audit-actions";
