# Feedback Module

Responsabilidad: envío de comentarios y reportes del salón hacia la plataforma (sugerencias, incidencias).

Interface principal (`index.ts`, con `server-only`):

- `submitFeedback` (`use-cases/submit-feedback.ts`): registra un reporte.
- `FEEDBACK_CATEGORY_LABELS` y tipo `FeedbackCategory` (`schemas.ts`): catálogo de categorías.

Piezas internas:

- `schemas.ts`: validación Zod de la entrada.
- `data/feedback.repo.ts`: adaptador de inserción en `feedback_reports`.

Tablas que usa:

- `feedback_reports`.

Reglas importantes:

- El salón solo escribe sus propios reportes; la moderación y el cambio de estado viven en `src/features/platform` (`data/feedback-moderation.repo.ts`).
- El texto que ve el usuario sigue las reglas de errores públicos (`PublicError`).

Tests: `schemas.test.ts`, `use-cases/submit-feedback.test.ts`, `data/feedback.repo.test.ts`.
