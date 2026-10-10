# Audit Module

Responsabilidad: escritura de la bitácora de acciones de plataforma (`platform_audit_log`) tras cada acción de alto impacto.

Interface principal (`index.ts`, con `server-only`):

- `publishAuditEvent` (`publish-audit-event.ts`): publica un evento de auditoría.
- `PLATFORM_AUDIT_ACTIONS`, `PlatformAuditAction`, `PlatformAuditStatus` (`domain/audit-actions.ts`).

Piezas internas:

- `events.ts`: forma del evento que emiten los casos de uso.
- `audit-event-writer.ts`: escritura del evento; se ejecuta dentro de `runSideEffect`.
- `data/audit-log.repo.ts`: adaptador de inserción en `platform_audit_log`.

Tablas que usa:

- `platform_audit_log`.

Reglas importantes:

- Los casos de uso emiten su evento después del commit, nunca antes.
- La lectura de la bitácora vive en `src/features/platform` (`data/platform-audit.repo.ts`); este módulo solo escribe.
- La escritura usa `service_role` solo desde `data/` (ADR 0010).

Tests: `publish-audit-event.test.ts`, `audit-event-writer.test.ts`, `data/audit-log.repo.test.ts`.
