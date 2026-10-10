# Runbook: Deploy Y Operación De Producción

## Objetivo

Publicar únicamente mediante `.github/workflows/release.yml`, tras CI completo, pruebas con Supabase local y aprobaciones de producción. Este documento es el procedimiento de publicación y, además, el índice de operación de producción. Decisión de fondo: ADR 0021 (deploy sin staging remoto obligatorio).

Producción solo recibe código que ya pasó `verify:full` en CI. La release no vuelve a pasar los controles de calidad: verifica que el CI del SHA esté en éxito y despliega. Ningún cambio se aplica a mano en producción: todo entra por migraciones versionadas y por el workflow de release.

## Workflows

| Workflow | Disparo | Qué hace |
|---|---|---|
| `ci.yml` (GlowBook CI) | Push y pull request | Jobs `static`, `unit`, `db`, `browser`, `lighthouse`, `sbom` y `codeql`. Cada job llama a `npm run verify:job -- <job>`. |
| `release.yml` (GlowBook Release) | `workflow_run` de CI en éxito sobre `main`, o manual con un SHA de `main` | Etapas en orden: gate, migraciones (con aprobación), despliegue candidato, smoke, promoción (con aprobación), smoke público y rollback del frontend si falla tras promover. |
| `synthetic.yml` (GlowBook Synthetic) | Cada hora, en el minuto 23, y manual | Check sintético de disponibilidad en solo lectura contra producción. Si falla, envía alerta y abre un issue con la etiqueta `synthetic-failure`. |

Los secretos y el environment `production` (revisores y protección de despliegues) se configuran según la sección "Configuración de una sola vez".

## Configuración De Una Sola Vez

1. En GitHub, proteger main con PR y los siete checks de GlowBook CI.
2. En el environment Production, exigir revisión y permitir únicamente main.
3. En Vercel, confirmar el proyecto glow-book del equipo kai-book y su rama main.
4. Mantener `git.deploymentEnabled=false` en `vercel.json`. Las publicaciones Git automáticas quedan desactivadas; la release usa el CLI para publicar. Desactivar la asignación automática de dominios durante la configuración inicial.
5. Guardar los secretos de la tabla siguiente directamente en GitHub. Nunca copiarlos a logs, chat, commits, comentarios o artefactos de pruebas.
6. Configurar Production en Vercel con Supabase producción. Preview y staging son opcionales; no compartir credenciales administrativas de producción con ellos.

## Secretos Del Repositorio

El gate comprueba presencia antes de que se apruebe cualquier environment. Los IDs y URLs también se guardan como secretos por compatibilidad con el workflow.

| Secreto | Uso |
|---|---|
| VERCEL_TOKEN | Token dedicado para el equipo/proyecto, no la sesión OAuth personal. |
| VERCEL_ORG_ID | Equipo Vercel de GlowBook. |
| VERCEL_PROJECT_ID | Proyecto Vercel de GlowBook. |
| PRODUCTION_DB_URL | Conexión Postgres de producción; preferir pooler Session. |
| PRODUCTION_PROJECT_REF | Ref de producción, confirmado antes de aplicar migraciones. |
| PRODUCTION_SUPABASE_URL | URL pública de producción y guarda contra escrituras de tests. |
| SYNTHETIC_BASE_URL | Dominio público de producción. |
| VERCEL_AUTOMATION_BYPASS_SECRET | Opcional; necesario si la protección bloquea las URLs de prueba. |
| ALERT_WEBHOOK_URL | Opcional. Sin webhook se usan los avisos de GitHub Actions. |

Las conexiones directas con db-url no requieren SUPABASE_ACCESS_TOKEN. No reutilizar un token personal del agente como credencial de CI ni cambiar la contraseña de una base existente para completar esta tabla.

## Etapas De La Release

| Job | Control |
|---|---|
| gate | Secretos presentes, SHA de main y los siete jobs de CI en success. Rechaza checks parciales. |
| migrations | Aprobación Production, aplicación forward-only con `scripts/release/apply-migrations.mjs` y comprobación estricta de pendientes (`scripts/production-migration-gate.mjs --target=production`). |
| deploy-staged | Build remoto con variables Production; despliegue sin asignar dominio. |
| smoke-staged | GET /login, estado 200, cabeceras de seguridad y respuesta menor a 3 segundos. |
| discard-staged | Si falla el smoke, elimina el despliegue de producción sin dominio. |
| promote | Segunda aprobación Production, promoción del mismo build y smoke del dominio público. |
| rollback y alerta | Si el smoke falla tras promover, vuelve al despliegue anterior del frontend y avisa. |
| notify-failure | Registra el fallo en Actions y envía webhook si se configuró. Avisa si falla cualquier etapa anterior a `promote`. |

Los builds de release se ejecutan en Vercel para que sus secretos sensibles permanezcan allí. CI ya verificó las mismas fuentes y su lockfile con build, E2E y los demás controles. La promoción no reconstruye el artefacto probado. Los tokens se entregan únicamente a pasos que los necesitan; checkout no conserva credenciales. No se publican secretos ni estados de sesión.

## Aprobar Las Dos Etapas En GitHub

1. Abrir el repositorio → Actions → GlowBook Release → ejecución del SHA integrado en main.
2. Cuando aparezca Review deployments, seleccionar Production y pulsar Approve and deploy.
3. La primera aprobación desbloquea Migrations (production). Puede aplicar SQL pendiente antes de desplegar; el frontend anterior sigue activo.
4. Esperar a que Deploy candidate y Smoke candidate estén en verde. Candidate es un despliegue con configuración y base de producción, sin el dominio público; no es un proyecto Supabase staging.
5. Repetir Review deployments → Production → Approve and deploy para desbloquear Promote production. Esta aprobación asigna el dominio público al mismo build probado; no lo reconstruye.
6. Confirmar que Promote production y la ejecución completa terminan en success. Ese job incluye la prueba del dominio público.

Un push a una rama no publica la aplicación. Integrar el PR dispara CI sobre main; solo su éxito activa la release. No aprobar una ejecución con SHA inesperado ni saltarse un fallo. Si se rechaza una aprobación, la publicación se detiene. Corregir la causa y reintentar desde Actions; una nueva ejecución puede pedir las aprobaciones otra vez.

Las aprobaciones son controles operativos de GitHub, no un paso de commit. Solo las realiza la persona responsable, o un agente expresamente autorizado para ello. No se presume autorización de producción por pedir cambios de código.

## Validación De Datos

CI aplica las migraciones al stack Supabase local y ejecuta pgTAP, integración y E2E. No se necesitan secretos de staging ni claves de fixtures remotos. La etapa de candidato usa la base de producción: solo se prueba su disponibilidad en lectura antes de asignar el dominio público. Nunca ejecutar seeds, limpieza ni E2E con fixtures contra producción.

## Fallos Y Recuperación

- Gate: completar los secretos o corregir CI; nunca continuar con checks rojos.
- Migraciones: la comprobación final debe pasar. Una aplicación parcial se corrige con una migración nueva; no se edita el historial aplicado.
- Deploy: el dominio público sigue sirviendo su despliegue anterior.
- Smoke staged: se elimina solo el despliegue fallido sin dominio.
- Promote: si ya promovió y falla el smoke público, rollback solo del frontend. La BD no se revierte. Confirma el despliegue sano y revisa la compatibilidad (ver `docs/runbooks/rollback.md`).
- Webhook configurado: una respuesta fallida deja también el envío en rojo. Sin webhook, el workflow fallido conserva las notificaciones de GitHub.

El rollback puede desactivar la autoasignación de dominio; la publicación siguiente vuelve a pasar por promote. La prohibición de desplegar main por Git permanece versionada.

## Migraciones Expand/Contract

Mientras se prepara la nueva versión, el frontend anterior sigue activo. Las migraciones deben ser compatibles con él. Primero expandir, luego desplegar y, en una release posterior, retirar lo viejo. Ver `docs/runbooks/database-migrations.md` y `docs/runbooks/restore.md`. Las migraciones son forward-only (ADR 0016): un error se corrige con una migración nueva, no editando la existente.

## Sintéticos

- Comprobación horaria de disponibilidad, en solo lectura (`scripts/quality/synthetic-check.mjs`).
- Alertas: `scripts/ops/synthetic-alert-cli.mjs` envía el aviso sin secretos.
- Procedimiento de respuesta, falsos positivos y cambio de umbrales: `docs/runbooks/synthetic-checks.md`.
- Los tests `scripts/ops/synthetic-check.test.mjs` y `scripts/ops/synthetic-alert.test.mjs` corren en el paso `scripts-tests`, sin red externa.

## Observabilidad Y Seguridad En Producción

- La observabilidad es el adaptador `src/infra/observability`: emite eventos y errores como JSON estructurado, sanitizando claves sensibles y con el request id. En el primer despliegue, los logs salen por el hosting o por un log drain.
- Opcionalmente, `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL` (y su token) envía los payloads sanitizados a un webhook. Detalle en `docs/security.md`, sección "Observability".
- Rate limit compartido en Postgres (`consume_rate_limit`, solo `service_role`), desde `src/infra/security/rate-limit.ts` (ADR 0017). Si el almacén falla, la política es fail-open con `captureError` (inicio de sesión: fail-closed, ADR 0030).
- Cabeceras estáticas, CSP con nonce y auditoría de dependencias: `docs/security.md`.

## Operación: Índice De Runbooks

| Necesidad | Documento |
|---|---|
| Publicar | Este documento |
| Volver atrás | `docs/runbooks/rollback.md` |
| Restaurar la base de datos | `docs/runbooks/restore.md` |
| Responder a un incidente | `docs/runbooks/incident.md` |
| Migraciones | `docs/runbooks/database-migrations.md` |
| Operaciones de plataforma | `docs/runbooks/platform-operations.md` |
| Checks sintéticos | `docs/runbooks/synthetic-checks.md` |
| Entornos, guardas y rotación de secretos | `docs/environments.md` |
| Plan de capacidad | `docs/capacity-plan.md` |

Los scripts de operación que apuntan a entornos remotos se ejecutan solo desde los runbooks, bajo la política de `docs/environments.md`, nunca desde el verificador ni desde pruebas.

## Criterio De Éxito

Una release está lista cuando:

- El workflow está en verde, `migrations` y `promote` terminan en success y el smoke público pasa.
- Las migraciones pendientes están aplicadas en producción y no quedan pendientes tras la etapa `migrations`.
- No hay alertas abiertas de sintéticos (`synthetic-failure`) del último ciclo.
- Se han revisado login, agenda, plataforma y logs después del despliegue.
- Los runbooks vigentes cubren lo que cambia (despliegue, migración o restauración).

La vía manual de despliegue requiere autorización explícita de la persona responsable, CI verde y backup reciente. No se usa para saltarse las aprobaciones.
