# Release Readiness 5+ Salones

Fecha: 2026-05-31

Fuente:

- `docs/architecture-audit-2026-05-31.md`
- `docs/architecture-audit-phases-2026-05-31.md`
- `docs/production-readiness-checklist.md`

## Decision

No lanzar a produccion todavia.

El repo esta en buen estado arquitectonico, pero faltan evidencias externas
bloqueantes para operar con 5 salones o mas.

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
  Resultado actual: 10 checks OK, 10 bloqueados. Bloqueos principales:
  `GLOWBOOK_ENV`, `APP_URL`, `E2E_BASE_URL`, `PRODUCTION_SUPABASE_URL`,
  confirmacion de E2E staging, restore, smoke, revision de logs,
  observability y owner de soporte.
- `npm run test:e2e:staging`: bloqueado por entorno; falta
  `GLOWBOOK_ENV=staging`.
- `npm run smoke:seed-5-salons`: bloqueado por entorno; falta
  `GLOWBOOK_ENV=staging` o permiso local explicito.
- `npx supabase migration list`: OK. Proyecto remoto enlazado
  `eokiklkgutzrkhbamglf`; migraciones local/remoto coinciden desde
  `20240101000000` hasta `20240101000027`.

Cambios locales completados:

- Fase 42: copy/encoding de recordatorios corregido.
- Fase 43: hotspots UI route-local revisados sin extraccion necesaria.
- Fase 44: decision de recordatorios confirmada como flujo manual/read Module.
- Fase 41: estrategia inicial de observability documentada como logs
  estructurados del hosting/log drain.

## Bloqueantes Externos

1. Configurar staging real:
   - `GLOWBOOK_ENV=staging`
   - `E2E_BASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PRODUCTION_SUPABASE_URL`
2. Ejecutar `npm run test:e2e:staging` contra deploy staging.
3. Ejecutar restore probado en staging o entorno temporal.
4. Ejecutar `npm run smoke:seed-5-salons` en staging.
5. Revisar rutas criticas y logs Supabase despues del smoke.
6. Ejecutar `npm run smoke:cleanup-5-salons` o restaurar staging.
7. Confirmar logs/observability en hosting o log drain.

## Estado Por Fase

| Fase | Estado |
|---|---|
| 37 - Evidencia operativa de staging | Bloqueada por entorno externo. |
| 38 - Restore probado | Bloqueada por backup/destino externo. |
| 39 - Load smoke real 5 salones | Bloqueada por entorno externo. |
| 40 - Performance/logs Supabase | Bloqueada hasta completar Fase 39. |
| 41 - Observability provider/log drain | Repo preparado; falta validar logs en deploy real. |
| 42 - UI copy/encoding | Completada. |
| 43 - Hotspots UI route-local | Completada. |
| 44 - Decision recordatorios | Completada para MVP manual. |
| 45 - Release readiness gate | Completada con decision: no lanzar aun. |

## Siguiente Accion

Configurar staging real y volver a ejecutar:

```text
npm run release:readiness
npm run test:e2e:staging
npm run smoke:seed-5-salons
```

Despues de esas ejecuciones, actualizar este documento con evidencia final y
reabrir la decision de lanzamiento.
