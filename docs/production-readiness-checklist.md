# Checklist De Lanzamiento 5+ Salones

Fecha: 2026-05-30

Estado: checklist operativo. Un item marcado en produccion debe tener evidencia
reciente: comando, captura de CI, Supabase dashboard, PR o runbook ejecutado.

## Evidencia 2026-05-31

Estado de decision: **no lanzar todavia**.

Evidencia local completada:

- `npm run release:readiness` agregado como gate ejecutable; actualmente bloquea
  lanzamiento hasta confirmar staging, restore, smoke, logs, observability y
  soporte. Resultado actual: 10 OK, 10 bloqueados.
- `npx supabase migration list` paso: local/remoto coinciden desde
  `20240101000000` hasta `20240101000027` para el proyecto enlazado
  `eokiklkgutzrkhbamglf`.
- `npm run ci:verify` paso: lint, guardrails, type-check, tests y build.
- `npm run architecture:health` paso: guardrails, tests, E2E local, docs
  vigentes y database types.
- `npm run lint` paso con guardrails arquitectonicos.
- `npm run type-check` paso.
- Busqueda de mojibake comun en `src`, `docs`, `README.md` y `CONTEXT.md` sin matches.
- Hotspots UI route-local revisados sin fugas a Supabase ni data Adapters.
- Decision de recordatorios confirmada como MVP manual/read Module.

Bloqueos externos:

- `npm run test:e2e:staging` no puede correr hasta configurar
  `GLOWBOOK_ENV=staging` y el resto de variables staging.
- `npm run smoke:seed-5-salons` no puede correr hasta configurar
  `GLOWBOOK_ENV=staging`, secrets staging y confirmacion de smoke.
- Restore real requiere backup y destino staging/temporal.
- Revision de Supabase logs/performance depende del smoke real.

## Arquitectura

- [ ] `npm run architecture:check` pasa.
- [ ] `npm run architecture:health` no reporta riesgos nuevos sin decision.
- [ ] `src/app` consume use-cases/read Modules, no Adapters `data`.
- [ ] Nuevos usos de `service_role` estan en ADR 0010.
- [ ] SQL/RLS/RPC siguen documentados en `docs/database-contracts.md`.

## Supabase

- [ ] Proyecto staging separado de production.
- [ ] Migraciones aplicadas en staging.
- [ ] `npm run db:types` ejecutado despues de la ultima migracion.
- [ ] RLS/RPC criticos validados con tests o smoke manual.
- [ ] `platform_audit_log` existe, registra acciones Platform sensibles y se revisa desde `/admin/audit`.
- [ ] Plataforma puede suspender/reactivar Salon desde `/admin/salons` y deja audit log.
- [ ] Backup reciente confirmado antes del primer lanzamiento.
- [ ] Restore probado en staging o entorno temporal.

## CI/CD

- [ ] PR gates: lint, type-check, test y build.
- [ ] `npm run ci:verify` pasa localmente antes de merge.
- [ ] CI de `main` corre E2E/health cuando existen secrets staging.
- [ ] Deploy de staging validado antes de production.

## E2E Y Smoke

- [ ] `npm run test:e2e:staging` pasa contra el deploy staging.
- [ ] Fixtures temporales no apuntan a production.
- [ ] Smoke de 5 salones ejecutado en staging.
- [ ] Batch smoke limpiado con `npm run smoke:cleanup-5-salons` o staging restaurado.
- [ ] Rutas criticas revisadas: dashboard, agenda, crear cita, colaboradores, clientes, reportes y Platform overview.
- [ ] No hay queries lentas criticas en Supabase logs.

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
- [ ] Persona responsable de soporte definida para la semana de lanzamiento.

## Decision De Recordatorios

- [ ] Confirmar si el lanzamiento promete envio real.
- [ ] Si no se promete envio real, mantener `features/reminders` como read Module operativo.
- [ ] Si se promete envio real, implementar Adapter de proveedor, retries y logs antes de salir.
