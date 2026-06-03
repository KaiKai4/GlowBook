# Documentacion De Arquitectura

Este indice marca los documentos vigentes. Las auditorias y roadmaps reemplazados se conservan en `docs/archive/architecture-history/` para trazabilidad, pero no deben guiar implementaciones nuevas sin contrastarse contra la auditoria actual.

## Vigente

- Auditoria actual: `docs/architecture-audit-current-state-2026-06-03.md`
- Fases actuales de mejora: `docs/architecture-improvement-phases-2026-06-03.md`
- Evaluacion modular actual: `docs/architecture-modular-monolith-assessment-2026-06-03.md`
- Contratos de base de datos: `docs/database-contracts.md`
- Tests y checks Supabase: `docs/testing.md`
- Politica de entornos: `docs/environments.md`
- Seguridad operativa: `docs/security.md`
- Capacity plan: `docs/capacity-plan.md`
- Checklist de produccion: `docs/production-readiness-checklist.md`
- Checklist de escala: `docs/production-scale-readiness-checklist.md`
- Plan E2E critico: `docs/e2e-critical-flows.md`
- Decision de recordatorios: `docs/reminders-launch-decision.md`
- Revision Auth Session: `docs/auth-session-review-2026-05-30.md`
- Inventario UI route-local: `docs/ui-route-local-inventory-2026-05-30.md`
- Archivo historico de arquitectura: `docs/archive/architecture-history/README.md`

## Runbooks Operativos

- Deploy: `docs/runbooks/deploy.md`
- Rollback: `docs/runbooks/rollback.md`
- Restore de base de datos: `docs/runbooks/database-restore.md`
- Migraciones de base de datos: `docs/runbooks/database-migrations.md`
- Operaciones Platform: `docs/runbooks/platform-operations.md`
- Load smoke 5 salones: `docs/runbooks/load-smoke-5-salons.md`
- Load scale salones: `docs/runbooks/load-scale-salons.md`
- Vercel staging y Supabase: `docs/runbooks/vercel-staging-env.md`
- Incidentes: `docs/runbooks/incidents.md`

## ADRs De Mayor Peso

- `docs/adr/0001-multi-tenant-rls.md`: RLS es la autoridad final de aislamiento.
- `docs/adr/0002-appointment-items-source-of-truth.md`: `appointment_items` es la fuente de verdad de la agenda.
- `docs/adr/0008-tests-as-safety-net.md`: tests y guardrails protegen el dominio.
- `docs/adr/0009-modular-monolith-feature-architecture.md`: estructura del monolito modular.
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`: excepciones `service_role` y Auth Admin.

## Comandos Antes De Merge O Deploy

```text
npm run ci:verify
```

Ese comando reproduce los gates obligatorios de CI:

```text
npm run lint
npm run type-check
npm run test
npm run build
```

E2E contra staging desplegado:

```text
npm run isolation:readiness
npm run staging:verify-env
npm run test:e2e:staging
```

Gate de migraciones:

```text
npm run staging:migrations
npm run release:migrations
```

## Regla Practica

Si un cambio toca RLS, RPCs, `service_role`, citas, colaboradores, plataforma, inventario, vitrina, gastos o reportes, revisar primero los ADRs, `CONTEXT.md`, los runbooks y la auditoria vigente.
