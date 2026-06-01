# Checklist De Lanzamiento 5+ Salones

Fecha: 2026-05-30

Estado: checklist operativo. Un item marcado en produccion debe tener evidencia
reciente: comando, captura de CI, Supabase dashboard, PR o runbook ejecutado.

## Evidencia 2026-05-31

Estado de decision: **readiness de auditoria cerrado para MVP 5+ salones**.

Evidencia local completada:

- `npm run release:readiness` agregado como gate ejecutable. Resultado actual
  con staging, restore, smoke, performance, soporte y observability confirmados:
  21 OK, 0 bloqueados.
- Supabase staging separado creado y enlazado: `glowbook-staging`
  (`vifuurgquxkkpqqobigr`).
- `npm run db:migrate` paso contra staging: se aplicaron migraciones
  `20240101000000` hasta `20240101000028`.
- `npx supabase migration list` paso contra staging: local/remoto coinciden
  desde `20240101000000` hasta `20240101000028`.
- `npm run db:types` paso contra staging y no produjo cambios reales en
  `src/types/database.types.ts`.
- `npm run ci:verify` paso: lint, guardrails, type-check, 143 tests y build.
- `npm run test:e2e:staging` paso: 13 tests E2E contra app local conectada a
  Supabase staging.
- `npm run smoke:seed-5-salons` paso con batch `smoke-20260531-e2e`: creo 5
  salones, 30 colaboradores, 100 servicios, 500 clientes y 400 citas.
- `npm run smoke:cleanup-5-salons` paso y el batch quedo en cero registros.
- Restore de prueba ejecutado desde staging hacia Supabase local con batch
  `smoke-restore-20260531`: dump data-only de `auth,public`, restore local con
  `ON_ERROR_STOP=1`, validacion de 5 salones, 500 clientes, 30 colaboradores,
  400 citas y 5 usuarios auth. El batch staging quedo en cero registros.
- Observability basica confirmada en Vercel Logs: requests reales `GET 200` en
  rutas principales, redirects `GET 307` esperados, Middleware/Function
  Invocation visibles y sin secretos visibles en los logs revisados.
- Supabase local usa puertos `554xx` en `supabase/config.toml` porque Windows
  tenia reservado el rango `54321-54620`.
- `npx supabase db advisors --linked --type performance --output json` reporto
  warnings RLS despues del smoke; se agrego
  `20240101000028_optimize_rls_policy_performance.sql`.
- El mismo advisor de performance despues de la migracion reporto `No issues
  found`.
- `npm run lint` paso con guardrails arquitectonicos.
- `npm run type-check` paso.
- Busqueda de mojibake comun en `src`, `docs`, `README.md` y `CONTEXT.md` sin matches.
- Hotspots UI route-local revisados sin fugas a Supabase ni data Adapters.
- Decision de recordatorios confirmada como MVP manual/read Module.

Pendientes no bloqueantes:

- Owner de soporte asignado en `docs/launch-support.md`.
- Observability Adapter soporta consola estructurada y webhook/log drain
  opcional; se puede conectar un proveedor/log drain mas adelante si se necesita
  mayor retencion o alertas.

## Arquitectura

- [ ] `npm run architecture:check` pasa.
- [ ] `npm run architecture:health` no reporta riesgos nuevos sin decision.
- [ ] `src/app` consume use-cases/read Modules, no Adapters `data`.
- [ ] Nuevos usos de `service_role` estan en ADR 0010.
- [ ] SQL/RLS/RPC siguen documentados en `docs/database-contracts.md`.

## Supabase

- [x] Proyecto staging separado de production.
- [x] Migraciones aplicadas en staging.
- [x] `npm run db:types` ejecutado despues de la ultima migracion.
- [x] RLS/RPC criticos validados con tests y E2E staging.
- [ ] `platform_audit_log` existe, registra acciones Platform sensibles y se revisa desde `/admin/audit`.
- [ ] Plataforma puede suspender/reactivar Salon desde `/admin/salons` y deja audit log.
- [x] Backup/dump reciente de staging confirmado antes del primer lanzamiento.
- [x] Restore probado en Supabase local temporal.

## CI/CD

- [ ] PR gates: lint, type-check, test y build.
- [ ] `npm run ci:verify` pasa localmente antes de merge.
- [ ] CI de `main` corre E2E/health cuando existen secrets staging.
- [ ] Deploy de staging validado antes de production.

## E2E Y Smoke

- [ ] `npm run test:e2e:staging` pasa contra el deploy staging.
- [ ] Fixtures temporales no apuntan a production.
- [x] Smoke de 5 salones ejecutado en staging.
- [x] Batch smoke limpiado con `npm run smoke:cleanup-5-salons` o staging restaurado.
- [ ] Rutas criticas revisadas: dashboard, agenda, crear cita, colaboradores, clientes, reportes y Platform overview.
- [x] No hay issues de performance en Supabase advisors despues de la migracion RLS.

## Seguridad

- [ ] Headers de `next.config.ts` presentes en staging.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en cliente ni logs.
- [ ] Secrets separados por entorno.
- [ ] `PRODUCTION_SUPABASE_URL` configurado como guard.
- [ ] Plan de rotacion de secrets conocido.
- [ ] Operaciones destructivas requieren confirmacion humana.

## Operacion

- [ ] Runbook de deploy revisado.
- [ ] Runbook de rollback revisado.
- [ ] Runbook de restore revisado.
- [ ] Runbook de Platform operations revisado.
- [x] Persona responsable de soporte definida para la semana de lanzamiento.
- [x] Observability basica revisada en Vercel Logs.

## Decision De Recordatorios

- [ ] Confirmar si el lanzamiento promete envio real.
- [ ] Si no se promete envio real, mantener `features/reminders` como read Module operativo.
- [ ] Si se promete envio real, implementar Adapter de proveedor, retries y logs antes de salir.
