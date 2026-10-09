# Documentacion De GlowBook

Este es el índice único de la documentación vigente. Todo lo que no aparece aquí está en `docs/archive/`, solo para trazabilidad: no guía implementaciones nuevas. Las reglas para personas y agentes están en `AGENTS.md`; `CLAUDE.md` solo lo importa.

La comprobación `docs-links` (`scripts/quality/check-doc-links.mjs`) verifica que los enlaces y las rutas citadas en esta documentación existen.

## Empezar

- Reglas canónicas (capas, multi-tenancy, RBAC, citas, idempotencia, errores, BD, UI, pruebas, definición de terminado): `AGENTS.md`.
- Panorama, stack y comandos: `README.md`.
- Vocabulario de dominio: `CONTEXT.md`. Usa esos nombres al añadir módulos, docs o tests.
- Producto y niveles: `PRODUCT.md`.
- Sistema de diseño (tokens, tipografía, componentes, sombras, mapeo de clases): `DESIGN.md`.
- Seguridad (reporte de vulnerabilidades y controles): `SECURITY.md`.

## Guias

| Documento | Para qué sirve |
|---|---|
| `docs/development-guide.md` | Flujo diario: entorno, BD local, migraciones, estructura de módulos, pruebas, commits y PR. |
| `docs/quality-guide.md` | Verificador: cada paso, trinquetes y controles absolutos, y cómo añadir un control. |
| `docs/code-map/modules.mmd` | Mapa de código por módulo (Mermaid, agrupado por capa). Generado desde el grafo de dependencias; `graph.json` tiene los mismos datos. Regenerar con `node scripts/quality/code-map.mjs`. |
| `docs/testing.md` | Pruebas por tipo, BD local y paridad de CI en detalle. |
| `docs/production-standard.md` | Workflows de CI, release, sintéticos y nightly; observabilidad y operación. |
| `docs/security.md` | Detalle técnico de cabeceras, CSP, errores públicos, observabilidad, rate limit y auditoría. |
| `docs/database-contracts.md` | Contrato de cada tabla, RPC y RLS por módulo. Revísalo antes de cambiar la BD. |
| `docs/environments.md` | Entornos, variables obligatorias, quién puede migrar qué, guardas y rotación de secretos. |
| `docs/e2e-critical-flows.md` | Flujos críticos mínimos que cubre Playwright y su estado. |
| `docs/capacity-plan.md` | Qué revisar en Supabase y Vercel antes de operar con muchos salones (2026-06-01). |
| `docs/production-readiness-checklist.md` | Checklist de preparación para producción. |
| `docs/production-scale-readiness-checklist.md` | Checklist de preparación para escala de salones. |
| `docs/reminders-launch-decision.md` | Decisión de lanzamiento de recordatorios: lectura operativa, sin envío real hasta elegir proveedor. |
| `docs/launch-support.md` | Responsable de soporte para la semana de lanzamiento (2026-05-31). |

## Runbooks Operativos

Procedimientos paso a paso en `docs/runbooks/`:

- Deploy: `docs/runbooks/deploy.md`
- Rollback: `docs/runbooks/rollback.md`
- Restore de base de datos: `docs/runbooks/restore.md`
- Respuesta a incidentes: `docs/runbooks/incident.md`
- Migraciones de base de datos: `docs/runbooks/database-migrations.md`
- Operaciones de plataforma: `docs/runbooks/platform-operations.md`
- Checks sintéticos: `docs/runbooks/synthetic-checks.md`
- Carga de 5 salones: `docs/runbooks/load-smoke-5-salons.md`
- Carga de escala: `docs/runbooks/load-scale-salons.md`
- Staging de Vercel y Supabase: `docs/runbooks/vercel-staging-env.md`

## ADRs

Índice completo con estado en `docs/adr/README.md`. Los más relevantes:

- `docs/adr/0001-multi-tenant-rls.md`: RLS es la autoridad final de aislamiento.
- `docs/adr/0002-appointment-items-source-of-truth.md`: `appointment_items` es la fuente de verdad de la agenda.
- `docs/adr/0003-dynamic-rbac-permissions.md`: autorización por permisos, nunca por nombre de rol.
- `docs/adr/0008-tests-as-safety-net.md`: pruebas y guardrails protegen el dominio.
- `docs/adr/0009-modular-monolith-feature-architecture.md`: estructura del monolito modular.
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`: excepciones de `service_role` y Auth Admin.
- `docs/adr/0011-verificador-local-igual-ci.md` a `docs/adr/0018-errores-publicos-tipados.md`: calidad, BD de pruebas, migraciones, rate limit y errores públicos.
- `docs/adr/0019-arquitectura-por-capas-verificada.md`: capas, reglas por patrón, composition root, índices públicos y controles absolutos sin baseline. Supera parcialmente a 0009, 0010 y 0013.

## Verificacion

Un cambio está terminado cuando `npm run verify:full` sale con código 0 en un checkout limpio, con Docker en ejecución. Para el ciclo diario, `npm run verify:fast`. Detalle en `docs/quality-guide.md` y `docs/testing.md`.

Los comandos de staging y producción (`staging:*`, `release:*`, `*:seed-*`, `*:cleanup-*`) no forman parte de la verificación local. Se usan solo en los runbooks, bajo `docs/environments.md`.

## Archivo Historico

Bajo `docs/archive/` (no se valida ni se mantiene como guía):

- `docs/archive/architecture-history/`: auditorías, fases y revisiones de arquitectura fechadas (2026-05-30 a 2026-06-07). Índice en `docs/archive/architecture-history/README.md`.
- `docs/archive/readiness-snapshots/`: snapshots fechados de revisión de rendimiento y de readiness de lanzamiento y escala (2026-05-31 y 2026-06-01).
- `docs/archive/glowbook-pricing-and-sales-strategy-2026-06-08.md`: estrategia de precios y ventas fechada. Sin ruta vigente.
- `docs/archive/agent-plans/`: planes de agentes ya ejecutados.
- `docs/archive/runbooks-superseded/`: versiones previas de los runbooks de incidentes y restore, fusionadas en `docs/runbooks/incident.md` y `docs/runbooks/restore.md`.

Si un documento archivado sigue siendo necesario, muévelo de vuelta a `docs/` y actualiza este índice.
