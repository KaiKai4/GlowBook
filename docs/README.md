# Documentacion De GlowBook

Este indice marca los documentos vigentes. Lo histórico (auditorías y fases fechadas, revisiones, planes de agentes y runbooks reemplazados) está en `docs/archive/`, solo para trazabilidad: no debe guiar implementaciones nuevas sin contrastarse contra el estado vigente descrito aquí.

## Documentos De Raiz

- Vocabulario de dominio: `CONTEXT.md`. Usar esos nombres al añadir módulos, docs o tests.
- Producto y niveles: `PRODUCT.md`.
- Sistema de diseño: `DESIGN.md`.

## Guias Vigentes

- Contratos de base de datos: `docs/database-contracts.md`
- Tests y verificacion (definicion de terminado, pasos, BD local): `docs/testing.md`
- Politica de entornos: `docs/environments.md`
- Seguridad operativa: `docs/security.md`
- Capacity plan: `docs/capacity-plan.md`
- Checklist de produccion: `docs/production-readiness-checklist.md`
- Checklist de escala: `docs/production-scale-readiness-checklist.md`
- Plan E2E critico: `docs/e2e-critical-flows.md`
- Decision de recordatorios: `docs/reminders-launch-decision.md`
- Soporte de lanzamiento: `docs/launch-support.md`
- Estrategia de precios y ventas: `docs/glowbook-pricing-and-sales-strategy-2026-06-08.md`
- Revision de rendimiento: `docs/performance-review-2026-06-01.md`

Snapshots de readiness (referenciados por scripts de readiness; pendientes de archivo cuando se actualicen sus rutas):

- `docs/release-readiness-2026-05-31.md`
- `docs/release-scale-readiness-2026-06-01.md`

## Runbooks Operativos

- Deploy: `docs/runbooks/deploy.md`
- Rollback: `docs/runbooks/rollback.md`
- Restore de base de datos (fusionado, vigente): `docs/runbooks/restore.md`
- Respuesta a incidentes (fusionado, vigente): `docs/runbooks/incident.md`
- Migraciones de base de datos: `docs/runbooks/database-migrations.md`
- Operaciones Platform: `docs/runbooks/platform-operations.md`
- Checks sinteticos: `docs/runbooks/synthetic-checks.md`
- Load smoke 5 salones: `docs/runbooks/load-smoke-5-salons.md`
- Load scale salones: `docs/runbooks/load-scale-salons.md`
- Vercel staging y Supabase: `docs/runbooks/vercel-staging-env.md`

## ADRs De Mayor Peso

- `docs/adr/0001-multi-tenant-rls.md`: RLS es la autoridad final de aislamiento.
- `docs/adr/0002-appointment-items-source-of-truth.md`: `appointment_items` es la fuente de verdad de la agenda.
- `docs/adr/0008-tests-as-safety-net.md`: tests y guardrails protegen el dominio.
- `docs/adr/0009-modular-monolith-feature-architecture.md`: estructura del monolito modular.
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`: excepciones `service_role` y Auth Admin.

## ADRs De Calidad

- `docs/adr/0011-verificador-local-igual-ci.md`: `verify:fast`, `verify:full`, manifiesto de pasos y paridad con CI.
- `docs/adr/0012-toolchain-de-calidad.md`: razon y alternativa descartada por cada herramienta de calidad.
- `docs/adr/0013-trinquetes-de-deuda.md`: trinquetes que solo bajan, meta cero y umbrales de cobertura.
- `docs/adr/0014-bd-de-pruebas-supabase-local.md`: BD de pruebas en Supabase local, pgTAP y migraciones forward-only.
- `docs/adr/0015-politica-excepciones-auditoria.md`: excepciones de `npm audit` (desarrollo con caducidad, produccion sin excepciones).

Índice completo de ADRs: `docs/adr/README.md`.

## Verificacion Antes De Merge O Deploy

Un cambio esta terminado cuando pasa en un checkout limpio, con Docker en ejecucion:

```text
npm run verify:full
```

Para el ciclo diario:

```text
npm run verify:fast
```

Detalle de cada paso y de la BD local en `docs/testing.md`.

Los comandos de staging (`npm run staging:verify-env`, `npm run test:e2e:staging`, `npm run staging:migrations`, `npm run release:migrations`) no forman parte de la verificacion local. Se usan solo en los runbooks de release, con las variables de entorno de staging o produccion configuradas y bajo la politica de `docs/environments.md`.

## Regla Practica

Si un cambio toca RLS, RPCs, `service_role`, citas, colaboradores, plataforma, inventario, vitrina, gastos o reportes, revisar primero los ADRs, `CONTEXT.md` y los runbooks vigentes.

## Archivo Historico

Bajo `docs/archive/` (no se valida ni se mantiene como guía):

- `docs/archive/architecture-history/README.md`: auditorías, fases y revisiones de arquitectura fechadas (2026-05-30 a 2026-06-07).
- `docs/archive/agent-plans/`: planes de agentes ya ejecutados.
- `docs/archive/runbooks-superseded/`: versiones previas de los runbooks de incidentes y restore, fusionadas en `incident.md` y `restore.md`.
