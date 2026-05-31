# Release Readiness 5+ Salones

Fecha: 2026-05-31

Fuente:

- `docs/architecture-audit-2026-05-31.md`
- `docs/architecture-audit-phases-2026-05-31.md`
- `docs/production-readiness-checklist.md`

## Decision

No lanzar a produccion todavia.

El repo esta en buen estado arquitectonico y staging ya existe. E2E staging,
smoke de 5 salones y performance advisors ya pasaron. Tambien quedo asignado
owner inicial de soporte. Faltan dos evidencias operativas antes de lanzar:
restore probado y observability real en hosting/log drain.

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
```

Resultados:

- `npm run lint`: OK, guardrails arquitectonicos pasaron.
- `npm run type-check`: OK.
- `npm run ci:verify`: OK, lint, guardrails, type-check, 143 tests y build
  pasaron.
- `npm run architecture:health`: OK, guardrails, tests, E2E local, docs
  vigentes y database types pasaron.
- `npm run release:readiness`: bloqueado hasta completar staging, restore,
  smoke, revision de logs, observability y owner de soporte.
  Resultado actual con confirmaciones de staging/smoke/performance: 17 checks
  OK, 3 bloqueados; queda en 19 OK, 2 bloqueados si se confirma
  `RELEASE_SUPPORT_OWNER_CONFIRMED=true`. Bloqueos restantes: restore probado
  y observability real.
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
- `npx supabase db dump --linked --schema public --file ...`: bloqueado en esta
  maquina porque Supabase CLI requiere Docker para dump/restore y Docker no
  esta disponible.

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
  opcional por `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL`.
- Fase 45: owner inicial de soporte documentado en `docs/launch-support.md`.
- Guard de tests de integracion Supabase endurecido para no ejecutar pruebas
  reales con placeholders.

## Bloqueantes Externos

1. Ejecutar restore probado en staging o entorno temporal.
2. Confirmar logs/observability en hosting o log drain.
3. Si se requiere deploy remoto de staging, repetir `npm run test:e2e:staging`
   contra esa URL.

## Estado Por Fase

| Fase | Estado |
|---|---|
| 37 - Evidencia operativa de staging | Completada para app local conectada a staging; pendiente opcional si se exige deploy remoto. |
| 38 - Restore probado | Bloqueada por destino externo/Docker no disponible en esta maquina. |
| 39 - Load smoke real 5 salones | Completada y limpiada. |
| 40 - Performance/logs Supabase | Completada via Supabase advisors; RLS optimizada en migracion 28. |
| 41 - Observability provider/log drain | Adapter preparado con consola y webhook opcional; falta validar destino real en deploy. |
| 42 - UI copy/encoding | Completada. |
| 43 - Hotspots UI route-local | Completada. |
| 44 - Decision recordatorios | Completada para MVP manual. |
| 45 - Release readiness gate | Parcial: soporte asignado; decision sigue no lanzar hasta restore y observability real. |

## Siguiente Accion

Cerrar restore y observability; despues volver a ejecutar:

```text
npm run release:readiness
npm run test:e2e:staging
npm run smoke:seed-5-salons
```

Despues de esas ejecuciones, actualizar este documento con evidencia final y
reabrir la decision de lanzamiento.
