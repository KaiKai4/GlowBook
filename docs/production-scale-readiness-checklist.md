# Checklist De Lanzamiento Amplio

Fecha: 2026-06-01

Estado: gate operativo para crecer mas alla del piloto 5-10 salones.

Este checklist no reemplaza `docs/production-readiness-checklist.md`. Lo
extiende para lanzamiento amplio con 25, 50, 100 o mas salones.

## Etapas

| Etapa | Salones | Decision |
|---|---:|---|
| Piloto controlado | 5-10 | Gate MVP actual suficiente. |
| Crecimiento inicial | 25-50 | Permitido como crecimiento controlado con revision semanal de logs/limits. |
| Lanzamiento amplio | 100+ | Requiere upgrade o decision explicita de capacity, observability avanzada, seguridad y soporte. |

## Umbrales Minimos

| Area | Piloto | Crecimiento inicial | Lanzamiento amplio |
|---|---:|---:|---:|
| Errores 5xx en smoke | 0 criticos | 0 criticos | 0 criticos |
| E2E criticos | 100% | 100% | 100% |
| Multi-tenant isolation | Manual | Automatizado | Automatizado + staging |
| Restore probado | 5 salones | 25-50 salones | 100+ salones |
| Observability | Vercel Logs | Logs + revision manual | Log drain/error tracking + alertas |
| Soporte | Owner definido | Owner + runbook incidentes | Owner + incident response + postmortem |

## Gate Ejecutable

```text
npm run release:scale-readiness
```

Variables de confirmacion requeridas:

```text
SCALE_BASELINE_CONFIRMED=true
SCALE_ISOLATION_CONFIRMED=true
SCALE_DATASET_CONFIRMED=true
SCALE_PERFORMANCE_CONFIRMED=true
SCALE_OBSERVABILITY_CONFIRMED=true
SCALE_CAPACITY_CONFIRMED=true
SCALE_RESTORE_CONFIRMED=true
SCALE_SECURITY_CONFIRMED=true
SCALE_SUPPORT_CONFIRMED=true
SCALE_REMINDERS_DECISION_CONFIRMED=true
```

## Fase 46 - Baseline

- [x] Checklist de lanzamiento amplio existe.
- [x] Gate separado `release:scale-readiness` existe.
- [x] Gate principal ejecuta subgates de staging, observability, capacity, security y support.
- [x] Gate bloquea `APP_URL`/`E2E_BASE_URL` locales para no aceptar evidencia falsa de staging.
- [x] Etapas 5-10, 25-50 y 100+ salones documentadas.
- [x] Decision go/no-go documentada en `docs/release-scale-readiness-2026-06-01.md`.
- [x] Existe `npm run baseline:readiness` para validar el baseline.
- [ ] Go/no-go de lanzamiento amplio firmado con evidencia reciente.

## Fase 47 - Multi-Tenant Isolation

- [x] Existe `npm run isolation:readiness`.
- [x] `npm run isolation:readiness` valida E2E negativo, tests RPC/RLS, contratos y guard staging.
- [x] Existe E2E negativo `e2e/multi-tenant-isolation.spec.ts`.
- [x] E2E negativo paso en `npm run test:e2e` con 16/16 tests.
- [x] `npm run test:e2e:staging` rechaza localhost cuando `GLOWBOOK_ENV=staging`.
- [x] `npm run test:e2e:staging` rechaza deployment Vercel si el Supabase publico embebido no coincide con staging.
- [x] Existe runbook `docs/runbooks/vercel-staging-env.md` para corregir Supabase mismatch en Vercel.
- [x] E2E staging desplegado paso con 16/16 tests contra `glow-book-git-main-kai-book.vercel.app`.
- [x] RLS/RPC criticos revisados con fixtures de dos salones.
- [x] Hallazgos documentados en `docs/database-contracts.md`.

## Fase 48 - Dataset De Escala

- [x] Existe `npm run scale:seed-salons`.
- [x] Existe `npm run scale:cleanup-salons`.
- [x] Existe `npm run dataset:readiness`.
- [x] `npm run dataset:readiness` paso en modo actual.
- [x] Los scripts bloquean production y requieren confirmacion humana.
- [x] Dataset de 25 salones creado y limpiado con batch `scale-20260601-25`.
- [x] Dataset de 50 salones creado y limpiado con batch `scale-20260601-50`.
- [x] Dataset de 100 salones creado y limpiado con batch `scale-20260601-100`.

## Fase 49 - Performance

- [x] Existe plantilla `docs/performance-review-2026-06-01.md`.
- [x] Existe medicion repetible `npm run scale:measure-routes`.
- [x] Existe `npm run performance:readiness`.
- [x] `npm run performance:readiness` paso en modo actual.
- [x] La medicion bloquea si Vercel apunta a otro Supabase distinto de staging.
- [x] El gate puede exigir confirmacion granular de Vercel Logs antes de lanzamiento amplio.
- [x] Rutas criticas medidas con dataset de escala `scale-20260601-route-100`.
- [ ] Vercel Logs revisados.
- [x] Supabase performance advisors revisado con dataset de 100 salones: `No issues found`.
- [ ] Indices creados solo con evidencia, si aplica.

## Fase 50 - Observability

- [x] `src/lib/observability` soporta consola y webhook/log drain.
- [x] El Adapter redacciona metadata, error message y stack con secretos conocidos.
- [x] Existe `npm run observability:readiness`.
- [x] `npm run observability:readiness` paso en modo actual.
- [x] Test de redaccion `src/lib/observability/index.test.ts` paso con 3/3.
- [x] El gate puede exigir alertas minimas y retencion antes de lanzamiento amplio.
- [ ] Proveedor/log drain elegido para lanzamiento amplio.
- [ ] Alertas minimas configuradas.
- [ ] Redaccion de secretos validada en proveedor.

## Fase 51 - Capacity Plan

- [x] Existe `docs/capacity-plan.md`.
- [x] Existe `npm run capacity:readiness`.
- [x] `npm run capacity:readiness` paso en modo actual.
- [x] Plan actual Vercel observado: Hobby.
- [x] Plan actual Supabase observado: Free.
- [x] Limites de logs/backups revisados en docs oficiales.
- [x] Gate valida que Supabase staging y production sean proyectos distintos.
- [ ] Limites de conexiones/Auth/region confirmados en dashboard.
- [x] Umbral de upgrade definido para 100+ salones reales.

## Fase 52 - Restore Grande

- [x] Runbook de restore tiene seccion para dataset grande.
- [x] Existe `npm run restore:readiness`.
- [x] Restore probado con 5 salones para piloto.
- [x] Restore probado con 100 salones; esta evidencia cubre y supera el umbral 25-50.
- [x] Restore probado con 100 salones usando batch `scale-restore-20260601-100`.
- [x] RTO/RPO registrados como pendiente de negocio; tiempo tecnico de restore validado.

## Fase 53 - Seguridad Operativa

- [x] Decision de rate limiting documentada como control operativo.
- [x] Existe `npm run rate-limit:readiness` para validar rutas publicas y decision.
- [ ] Rate limiting de hosting/Supabase revisado para login/invitaciones.
- [x] CSP report-only implementada y activable con `GLOWBOOK_CSP_REPORT_ONLY=true`.
- [x] Existe `npm run security:readiness` para validar headers y fuga de `service_role` en artefactos publicos.
- [x] `npm run security:readiness` paso: headers base desplegados y `service_role` ausente de artefactos publicos.
- [x] El gate puede exigir CSP/rotacion/log scan antes de lanzamiento amplio.
- [ ] CSP report-only evaluada en deployment staging.
- [ ] Rotacion de secrets practicada o agendada si aplica.

## Fase 54 - Soporte E Incidentes

- [x] Existe `docs/runbooks/incident.md`.
- [x] Owner inicial existe en `docs/launch-support.md`.
- [x] Existe `npm run support:readiness`.
- [x] `npm run support:readiness` paso en modo actual.
- [x] Runbook incluye owner suplente, canales, guardia y postmortem.
- [ ] Canales de soporte reales confirmados.
- [ ] Primera semana de guardia confirmada.

## Fase 55 - Recordatorios

- [x] Decision actual: MVP manual, no envio automatico.
- [x] Existe `npm run reminders:readiness`.
- [x] Gate valida ausencia de codigo de envio automatico mientras la decision sea manual.
- [x] Si se decide envio automatico, crear Module de envio antes de prometerlo.

## Decision Actual

```text
Piloto 5-10 salones: permitido con gate actual.
Crecimiento 25-50 salones: dataset 25/50 y E2E isolation ya pasaron; falta revisar Vercel Logs/rutas con usuarios reales.
Lanzamiento amplio 100+ salones: dataset 100, Supabase advisors y restore grande ya pasaron; pendiente Vercel performance, limites finos de dashboard, soporte/observability avanzada y decision de plan/backups.
```

## Ultima Ejecucion Del Gate

```text
npm run release:scale-readiness
Summary: 42 ok, 0 blocked
Scale release decision: controlled-growth gate passed; broad launch remains a separate upgrade decision.
```

Subgates OK:

- `baseline:readiness`
- `isolation:readiness`
- `observability:readiness`
- `dataset:readiness`
- `performance:readiness`
- `capacity:readiness`
- `restore:readiness`
- `rate-limit:readiness`
- `security:readiness`
- `support:readiness`
- `reminders:readiness`

Bloqueo tecnico actual:

```text
Resuelto: Preview glow-book-git-main-kai-book.vercel.app embebe Supabase
staging vifuurgquxkkpqqobigr.supabase.co.
```

Confirmaciones locales ya validadas con evidencia:

- `SCALE_BASELINE_CONFIRMED=true`
- `SCALE_ISOLATION_CONFIRMED=true`
- `SCALE_DATASET_CONFIRMED=true`
- `SCALE_PERFORMANCE_CONFIRMED=true`
- `SCALE_RESTORE_CONFIRMED=true`
- `SCALE_REMINDERS_DECISION_CONFIRMED=true`

Decision actual:

```text
GLOWBOOK_SCALE_DECISION_APPROVED_STAGE=controlled-growth
```

El gate pasa para crecimiento controlado. Para campana nacional masiva, siguen
pendientes como criterios de upgrade/operacion:

- Observability avanzada: log drain/error tracking y alertas reales.
- Capacity upgrade: limites finos de Supabase/Vercel o upgrade de plan.
- Seguridad operativa: rate limits, CSP report-only y rotacion/estado de
  secrets.
- Soporte externo: canal para salones, owner suplente y guardia de primera
  semana.
