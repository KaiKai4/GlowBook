# Documentacion De Arquitectura

Este indice marca los documentos vigentes. Las auditorias y roadmaps
reemplazados se retiran cuando dejan de reflejar el estado real del proyecto;
el historial git conserva ese contexto si hace falta consultarlo.

## Vigente

- Auditoria vigente: `docs/architecture-audit-2026-06-01.md`
- Auditoria base anterior: `docs/architecture-audit-2026-05-31.md`
- Auditoria historica: `docs/architecture-audit-2026-05-30.md`
- Fases de escalamiento vigentes: `docs/architecture-scale-phases-2026-06-01.md`
- Fases readiness 5+ salones cerradas: `docs/architecture-audit-phases-2026-05-31.md`
- Fases base anteriores: `docs/architecture-audit-phases-2026-05-30.md`
- Checklist lanzamiento amplio: `docs/production-scale-readiness-checklist.md`
- Capacity plan: `docs/capacity-plan.md`
- Performance review de escala: `docs/performance-review-2026-06-01.md`
- Contratos de base de datos: `docs/database-contracts.md`
- Tests y checks Supabase: `docs/testing.md`
- Politica de entornos: `docs/environments.md`
- Seguridad operativa: `docs/security.md`
- Checklist de lanzamiento 5+ salones: `docs/production-readiness-checklist.md`
- Decision readiness 5+ salones: `docs/release-readiness-2026-05-31.md`
- Inventario UI route-local: `docs/ui-route-local-inventory-2026-05-30.md`
- Revision Auth Session: `docs/auth-session-review-2026-05-30.md`
- Plan E2E critico: `docs/e2e-critical-flows.md`
- Decision recordatorios lanzamiento: `docs/reminders-launch-decision.md`
- Verificacion fases 17-25: `docs/architecture-phases-17-25-verification-2026-05-30.md`
- Auditoria de arquitectura y produccion: `docs/architecture-production-readiness-audit-2026-05-30.md`
- Fases de produccion 5+ salones: `docs/architecture-production-readiness-phases-2026-05-30.md`

## Runbooks Operativos

- Deploy: `docs/runbooks/deploy.md`
- Rollback: `docs/runbooks/rollback.md`
- Restore de base de datos: `docs/runbooks/database-restore.md`
- Migraciones de base de datos: `docs/runbooks/database-migrations.md`
- Operaciones Platform: `docs/runbooks/platform-operations.md`
- Load smoke 5 salones: `docs/runbooks/load-smoke-5-salons.md`
- Load scale salones: `docs/runbooks/load-scale-salons.md`
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

La rama `main` y ejecuciones manuales de CI corren tambien E2E y
`architecture:health` cuando los secretos Supabase de staging estan
configurados.

E2E contra staging desplegado:

```text
npm run staging:verify-env
npm run test:e2e:staging
```

Reporte opcional de salud arquitectonica:

```text
npm run architecture:health
```

Gate de lanzamiento 5+ salones:

```text
npm run release:readiness
```

Gate de lanzamiento amplio:

```text
npm run release:scale-readiness
```

Seguridad de deployment:

```text
npm run security:readiness
```

Observability/log drain:

```text
npm run observability:readiness
```

Soporte e incidentes:

```text
npm run support:readiness
```

Capacidad Supabase/Vercel:

```text
npm run capacity:readiness
```

Restore y RTO/RPO:

```text
npm run restore:readiness
```

Recordatorios:

```text
npm run reminders:readiness
```

Medicion de rutas con dataset de escala en staging:

```text
npm run scale:measure-routes
```

## Regla Practica

Si un cambio toca RLS, RPCs, `service_role`, citas, colaboradores, plataforma o
reportes, revisar primero los ADRs y el README del Module correspondiente.
