# Runbook: Vercel Staging Y Supabase

## Objetivo

Corregir un deployment staging de Vercel cuando la app publica embebe el
Supabase equivocado. Los E2E, performance y gates de lanzamiento amplio no
deben correr si staging apunta a production.

## Sintoma Actual

```text
npm run staging:verify-env
```

Puede bloquear con un mensaje de este estilo:

```text
Deployed app Supabase host mismatch for glow-book-chi.vercel.app.
Expected staging host: vifuurgquxkkpqqobigr.supabase.co.
Detected deployed host(s): eokiklkgutzrkhbamglf.supabase.co.
```

Lectura:

- `Expected staging host` es el Supabase que espera `.env.local`.
- `Detected deployed host(s)` es el Supabase embebido en el bundle publico de
  Vercel.
- Si el detectado es production, no usar ese deployment como evidencia.

## Variables A Revisar En Vercel

En el proyecto de Vercel usado como staging, revisar Environment Variables para
el environment del deployment:

```text
GLOWBOOK_ENV=staging
APP_URL=<url deployment staging>
E2E_BASE_URL=<url deployment staging>
NEXT_PUBLIC_SUPABASE_URL=<supabase staging url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase staging anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase staging service role key>
PRODUCTION_SUPABASE_URL=<supabase production url>
```

Reglas:

- No pegar valores completos de keys en issues, commits, screenshots o chats.
- `NEXT_PUBLIC_SUPABASE_URL` debe ser staging.
- `PRODUCTION_SUPABASE_URL` debe ser production y solo funciona como guard.
- `SUPABASE_SERVICE_ROLE_KEY` debe ser staging y server-only.
- No usar prefijo `NEXT_PUBLIC_` para `SUPABASE_SERVICE_ROLE_KEY`.

## Redeploy

Despues de corregir variables:

1. Crear un redeploy limpio en Vercel.
2. Esperar a que el deployment nuevo quede activo.
3. Confirmar que `APP_URL` y `E2E_BASE_URL` locales apuntan a ese deployment.
4. Ejecutar:

```text
npm run staging:verify-env
```

Si pasa, continuar con:

```text
npm run test:e2e:staging
npm run security:readiness
npm run release:scale-readiness
```

## Cierre De Performance

Para cerrar Fase 49 despues de corregir staging:

1. Crear un batch de escala en staging con `npm run scale:seed-salons`.
2. Ejecutar `npm run scale:measure-routes`.
3. Revisar Vercel Logs para 5xx, timeouts, duration y secretos.
4. Actualizar `docs/performance-review-2026-06-01.md`.
5. Limpiar el batch con `npm run scale:cleanup-salons`.

## Criterio De Exito

```text
npm run staging:verify-env
```

Debe imprimir:

```text
[verify-deployed-staging-env] OK
Deployment: <deployment staging>
Supabase: <host staging>
```

Despues de eso, el bloqueo tecnico de Supabase mismatch queda resuelto y los
gates pueden evaluar las fases restantes con evidencia real.
