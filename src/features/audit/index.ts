// Punto publico del modulo audit. Otros modulos importan solo desde aqui.
// Los casos de uso emiten su evento tras el commit; la escritura en la
// bitacora (platform_audit_log) la hace el manejador registrado.
export { publishAuditEvent } from "./publish-audit-event";
export { PLATFORM_AUDIT_ACTIONS, type PlatformAuditAction, type PlatformAuditStatus } from "./domain/audit-actions";
