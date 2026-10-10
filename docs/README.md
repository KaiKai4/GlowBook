# Documentacion De GlowBook

Este es el índice único de la documentación vigente. Todo lo que no aparece aquí está en `docs/archive/`, solo para trazabilidad: no guía implementaciones nuevas. Las reglas para personas y agentes están en `AGENTS.md`; `CLAUDE.md` solo lo importa.

La comprobación `docs-links` (`scripts/quality/check-doc-links.mjs`) verifica que los enlaces y las rutas citadas en esta documentación existen.

## Empezar

- Reglas canónicas (capas, multi-tenancy, RBAC, citas, idempotencia, errores, BD, UI, pruebas, definición de terminado): `AGENTS.md`.
- Panorama, stack y comandos: `README.md`.
- Vocabulario de dominio: `CONTEXT.md`. Usa esos nombres al añadir módulos, docs o tests.
- Producto y niveles: `PRODUCT.md`.
- Sistema de diseño (tokens, tipografía, componentes, sombras, mapeo de clases): `DESIGN.md`.
- Reporte de vulnerabilidades, alcance y plazos: `SECURITY.md`.

## Guías

| Documento | Para qué sirve |
|---|---|
| `docs/development-guide.md` | Flujo diario: entorno, BD local, migraciones, estructura de módulos, convención de nombres, commits y PR. |
| `docs/testing.md` | Estrategia de pruebas por tipo, verificador (`verify:fast` y `verify:full`) con sus pasos, pgTAP, cobertura, trinquetes y cómo añadir un control. |
| `docs/database-contracts.md` | Contrato de cada tabla, RPC y RLS por módulo. Revísalo antes de cambiar la BD. |
| `docs/security.md` | Controles de seguridad vigentes y sus procedimientos: cabeceras, CSP, errores públicos, observabilidad, rate limit y auditoría. |
| `docs/environments.md` | Entornos, variables obligatorias, quién puede migrar qué, guardas y rotación de secretos. |
| `docs/e2e-critical-flows.md` | Flujos críticos mínimos que cubre Playwright y su estado. |
| `docs/code-map/modules.mmd` | Mapa de código por módulo (Mermaid, agrupado por capa). Generado desde el grafo de dependencias; `graph.json` tiene los mismos datos. Regenerar con `node scripts/quality/code-map.mjs`. |
| `docs/capacity-plan.md` | Qué revisar en Supabase y Vercel antes de operar con muchos salones. |
| `docs/reminders-launch-decision.md` | Decisión de lanzamiento de recordatorios: lectura operativa, sin envío real hasta elegir proveedor. |
| `docs/launch-support.md` | Responsable de soporte para la semana de lanzamiento. |

## Runbooks Operativos

Procedimientos paso a paso en `docs/runbooks/`:

- Publicación y operación de producción (workflows, release, sintéticos, índice de operación): `docs/runbooks/deploy.md`
- Rollback: `docs/runbooks/rollback.md`
- Restore de base de datos: `docs/runbooks/restore.md`
- Respuesta a incidentes: `docs/runbooks/incident.md`
- Migraciones de base de datos: `docs/runbooks/database-migrations.md`
- Operaciones de plataforma: `docs/runbooks/platform-operations.md`
- Checks sintéticos: `docs/runbooks/synthetic-checks.md`

## Decisiones (ADR)

Índice completo con estado en `docs/adr/README.md`. Los más relevantes:

- `docs/adr/0001-multi-tenant-rls.md`: RLS es la autoridad final de aislamiento.
- `docs/adr/0002-appointment-items-source-of-truth.md`: `appointment_items` es la fuente de verdad de la agenda.
- `docs/adr/0003-dynamic-rbac-permissions.md`: autorización por permisos, nunca por nombre de rol.
- `docs/adr/0008-tests-as-safety-net.md`: pruebas y guardrails protegen el dominio.
- `docs/adr/0011-verificador-local-igual-ci.md`: el verificador local y CI comparten un único manifiesto de pasos.
- `docs/adr/0013-trinquetes-de-deuda.md`: trinquetes de deuda que solo bajan.
- `docs/adr/0019-arquitectura-por-capas-verificada.md`: capas, reglas por patrón, composition root, índices públicos y controles absolutos sin baseline.
- `docs/adr/0021-deploy-sin-staging-remoto.md`: el despliegue no requiere staging remoto.
- `docs/adr/0022-retiro-tooling-staging-pricing-readiness-stryker.md`: retiro de staging, pricing, readiness y Stryker.
- `docs/adr/0026-runner-pgtap-propio-y-supabase-local-sin-analytics.md`: runner pgTAP propio.
- `docs/adr/0028-inyeccion-en-comandos-con-logica.md`: cuándo inyectar dependencias en pruebas y código (sustituye a 0025).

## Verificacion

Un cambio está terminado cuando `npm run verify:full` sale con código 0 en un checkout limpio, con Docker en ejecución. Para el ciclo diario, `npm run verify:fast`. Detalle en `docs/testing.md`.

Los comandos que apuntan a entornos remotos (`release:*`, `bootstrap:admin`) no forman parte de la verificación local. Se usan solo en los runbooks, bajo `docs/environments.md`.

## Archivo Historico

Bajo `docs/archive/` (no se valida ni se mantiene como guía):

- `docs/archive/architecture-history/`: auditorías, fases y revisiones de arquitectura fechadas (2026-05-30 a 2026-06-07). Índice en `docs/archive/architecture-history/README.md`.
- `docs/archive/readiness-snapshots/`: snapshots fechados de readiness de lanzamiento y escala, y los checklists de preparación que los originaron (2026-05-31 y 2026-06-01).
- `docs/archive/runbooks-superseded/`: runbooks sustituidos (restore y incidentes previos, carga de salones y configuración de staging de Vercel), fusionados o retirados.
- `docs/archive/staging-sections.md`: secciones de staging y readiness retiradas de `environments.md`, `runbooks/restore.md` y `runbooks/database-migrations.md`.
- `docs/archive/glowbook-pricing-and-sales-strategy-2026-06-08.md`: estrategia de precios y ventas fechada. Sin ruta vigente.
- `docs/archive/agent-plans/`: planes de agentes ya ejecutados.

Si un documento archivado sigue siendo necesario, muévelo de vuelta a `docs/` con `git mv` y actualiza este índice.
