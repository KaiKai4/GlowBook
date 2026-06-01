# Runbook: Deploy

## Objetivo

Publicar GlowBook con gates obligatorios y validacion en staging antes de tocar
production.

## Antes Del Deploy

1. Confirmar que el PR tiene CI verde.
2. Ejecutar localmente:

```text
npm run ci:verify
```

3. Si hay migraciones:

```text
npm run db:migrate
npm run db:types
```

4. Verificar que `docs/database-contracts.md` y ADRs relevantes estan al dia.

## Staging

1. Deploy a staging.
2. Confirmar variables:
   - `GLOWBOOK_ENV=staging`
   - `NEXT_PUBLIC_SUPABASE_URL` de staging
   - `SUPABASE_SERVICE_ROLE_KEY` de staging
   - `PRODUCTION_SUPABASE_URL` de production
   - `APP_URL` y `E2E_BASE_URL` apuntan al deployment staging, no a localhost
3. Ejecutar:

```text
npm run staging:verify-env
npm run test:e2e:staging
npm run security:readiness
npm run observability:readiness
npm run support:readiness
npm run dataset:readiness
npm run performance:readiness
npm run capacity:readiness
npm run restore:readiness
npm run reminders:readiness
npm run architecture:health
```

4. Si `npm run test:e2e:staging` reporta mismatch de Supabase desplegado,
   corregir variables en Vercel y redeployar antes de usar ese deployment como
   evidencia. Seguir `docs/runbooks/vercel-staging-env.md`.
5. Revisar logs de Supabase y hosting.
6. Confirmar que los eventos de `src/lib/observability` aparecen en logs del
   hosting o log drain. Si se usa webhook, configurar
   `GLOWBOOK_OBSERVABILITY_WEBHOOK_URL` y
   `GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN`.

Evidencia 2026-05-31:

- Vercel Logs mostro requests reales `GET 200` para rutas principales.
- Los redirects `GET 307` observados fueron redirects esperados de
  middleware/auth.
- El panel de detalle mostro Middleware, Function Invocation y llamadas a
  Supabase.
- No se observaron secretos en los logs revisados.

## Production

1. Confirmar backup reciente.
2. Aplicar migraciones aprobadas.
3. Deploy a production.
4. Revisar login, dashboard de Salon y Platform admin.
5. Revisar logs durante 30 minutos.
6. Confirmar que errores y eventos estructurados aparecen en el destino de logs
   definido para observability.
7. Confirmar owner de soporte segun `docs/launch-support.md`.

## Lanzamiento Amplio

Antes de abrir a 25+ salones nuevos o campanas publicas:

```text
npm run ci:verify
npm run test:e2e:staging
npm run release:readiness
npm run release:scale-readiness
```

Ademas:

1. Ejecutar dataset de escala con `npm run scale:seed-salons`.
2. Revisar rutas criticas y completar `docs/performance-review-2026-06-01.md`.
3. Ejecutar cleanup con `npm run scale:cleanup-salons`.
4. Revisar `docs/capacity-plan.md`.
5. Confirmar runbook de incidentes.
6. Confirmar observability/log drain si el volumen de soporte lo exige.

## Criterio De Exito

- No hay errores criticos en hosting.
- Login funciona.
- Una cita puede crearse en Salon de prueba/control.
- Platform overview carga.
- Audit log registra operaciones Platform ejecutadas durante smoke.
