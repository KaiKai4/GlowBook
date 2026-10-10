# Notifications Module

Responsabilidad: plantillas de mensajes del salón (por ejemplo, recordatorios de cita) y su render puro.

Interface principal (`index.ts`, con `server-only`):

- `getActiveMessageTemplate` (`use-cases/active-message-template.ts`): plantilla activa para un tipo de mensaje.
- `getTemplateSettings` (`use-cases/get-template-settings.ts`): configuración para la pantalla de ajustes.
- `updateMessageTemplate` (`use-cases/update-message-template.ts`): guarda una plantilla.
- `parseNotificationTemplateInput` (`use-cases/template-input.ts`): validación de entrada.

Dominio puro: `domain/templates.ts` (render de plantillas con variables).

Tablas que usa:

- `notification_templates` (`data/notification-templates.repo.ts`).

Reglas importantes:

- El render genérico de plantillas vive aquí; las reglas de la cola de recordatorios viven en `src/features/reminders`.
- Este módulo no envía mensajes. El envío real aún no existe.
- Los permisos de escritura de plantillas se comprueban en la acción de `src/app`, no en este módulo.

Tests: `schemas.test.ts`, `domain/templates.test.ts`, `use-cases/*.test.ts`, `data/notification-templates.repo.test.ts`.
