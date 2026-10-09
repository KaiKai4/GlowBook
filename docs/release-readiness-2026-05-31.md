# Release Readiness 5+ Salones

Fecha: 2026-05-31

Fuente:

- `docs/archive/architecture-history/architecture-audit-2026-05-31.md`
- `docs/archive/architecture-history/architecture-audit-phases-2026-05-31.md`
- `docs/production-readiness-checklist.md`

## Decision

Readiness de auditoria cerrado para MVP 5+ salones.

El repo esta en buen estado arquitectonico y staging ya existe. E2E staging,
smoke de 5 salones, restore de prueba, performance advisors y observability
basica en Vercel Logs ya pasaron. Tambien quedo asignado owner inicial de
soporte.

## Evidencia Local Ejecutada

Comandos ejecutados:

```text
npm run release:readiness
npm run ci:verify
npm run architecture:health
npm run lint
npm run type-check
npm run test:e2e:staging
npm run smoke:seed-5-salons
npx supabase migration list
npx supabase start
npx supabase db dump --linked --data-only --schema auth,public --exclude public.permissions
```

Resultados:

- `npm run lint`: OK, guardrails arquitectonicos pasaron.
- `npm run type-check`: OK.
- `npm run ci:verify`: OK, lint, guardrails, type-check, 143 tests y build
  pasaron.
- `npm run architecture:health`: OK, guardrails, tests, E2E local, docs
  vigentes y database types pasaron.
- `npm run release:readiness`: OK con confirmaciones de staging, restore,
  smoke, performance, soporte y observability. Resultado: 21 checks OK, 0
  bloqueados.
- `npm run test:e2e:staging`: OK, 13 tests pasaron contra app local conectada
  a Supabase staging.
- `npm run smoke:seed-5-salons`: OK con batch `smoke-20260531-e2e`; creo 5
  salones, 30 colaboradores, 100 servicios, 500 clientes y 400 citas.
- `npm run smoke:cleanup-5-salons`: OK; el batch quedo en cero registros.
- `npm run db:migrate`: OK contra Supabase staging `glowbook-staging`
  (`vifuurgquxkkpqqobigr`), incluyendo
  `20240101000028_optimize_rls_policy_performance.sql`.
- `npm run db:types`: OK contra Supabase staging.
- `npx supabase migration list`: OK. Proyecto remoto staging enlazado;
  migraciones local/remoto coinciden desde
  `20240101000000` hasta `20240101000028`.
- `npm run ci:verify`: OK despues de endurecer el guard de tests de
  integracion para ignorar placeholders.
- `npx supabase db advisors --linked --type performance --output json`: OK
  despues de la migracion RLS; resultado `No issues found`.
- `npx supabase start`: OK despues de mover puertos locales a `554xx` por rango
  reservado de Windows.
- `npx supabase db dump --linked --data-only --schema auth,public --exclude
  public.permissions --file ...`: OK contra staging.
- Restore local con `psql -v ON_ERROR_STOP=1`: OK. Validacion post-restore:
  5 salones, 500 clientes, 30 colaboradores, 400 citas y 5 usuarios auth.
- `npm run smoke:cleanup-5-salons`: OK para batch `smoke-restore-20260531`;
  staging quedo con 0 salones y 0 auth users de ese batch.
- Vercel Logs: OK. Se observaron requests reales `GET 200` en rutas
  principales, redirects `GET 307` esperados, Middleware/Function Invocation y
  llamadas a Supabase sin secretos visibles en los logs revisados.

Cambios locales completados:

- Fase 37: proyecto Supabase staging creado, enlazado y migrado. E2E staging
  pasa con app local apuntando a staging. Pendiente solo si se exige deploy
  remoto de staging.
- Fase 39: smoke 5 salones ejecutado y limpiado.
- Fase 40: advisors de performance revisados, migracion RLS aplicada y warnings
  resueltos.
- Fase 42: copy/encoding de recordatorios corregido.
- Fase 43: hotspots UI route-local revisados sin extraccion necesaria.
- Fase 44: decision de recordatorios confirmada como flujo manual/read Module.
- Fase 41: estrategia inicial de observability documentada como logs
  estructurados del hosting/log drain. Adapter extendido con webhook/log drain
  opcional por `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL`. Validacion basica en
  Vercel Logs completada.
- Fase 45: owner inicial de soporte documentado en `docs/launch-support.md`;
  gate actual 21 OK / 0 bloqueados.
- Guard de tests de integracion Supabase endurecido para no ejecutar pruebas
  reales con placeholders.

## Pendientes No Bloqueantes

1. Si se requiere deploy remoto de staging, repetir `npm run test:e2e:staging`
   contra esa URL.
2. Si se necesita mayor retencion o alertas, conectar
   `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL` a un log drain/proveedor.

## Estado Por Fase

| Fase | Estado |
|---|---|
| 37 - Evidencia operativa de staging | Completada para app local conectada a staging; pendiente opcional si se exige deploy remoto. |
| 38 - Restore probado | Completada con dump data-only staging y restore en Supabase local. |
| 39 - Load smoke real 5 salones | Completada y limpiada. |
| 40 - Performance/logs Supabase | Completada via Supabase advisors; RLS optimizada en migracion 28. |
| 41 - Observability provider/log drain | Completada con Vercel Logs para MVP; webhook/log drain queda opcional para mayor retencion/alertas. |
| 42 - UI copy/encoding | Completada. |
| 43 - Hotspots UI route-local | Completada. |
| 44 - Decision recordatorios | Completada para MVP manual. |
| 45 - Release readiness gate | Completada: soporte asignado, restore probado y observability basica validada. |

## Siguiente Accion

Antes de cada lanzamiento, volver a ejecutar:

```text
npm run release:readiness
npm run test:e2e:staging
npm run smoke:seed-5-salons
```

Despues de esas ejecuciones, actualizar este documento si cambia la evidencia
operativa.
