# Politica De Entornos

Fecha: 2026-05-30

GlowBook opera como monolito modular con tres entornos separados:

| Entorno | Uso | Supabase | Datos |
|---|---|---|---|
| `local` | Desarrollo diario y pruebas manuales locales. | Proyecto local o sandbox personal. | Datos desechables. |
| `staging` | Validacion de migraciones, E2E desplegado y smoke con 5 salones. | Proyecto Supabase staging. | Datos de prueba persistentes, nunca clientes reales. |
| `production` | Salones reales. | Proyecto Supabase production. | Datos reales protegidos. |

## Variables Obligatorias

Cada entorno debe definir:

```text
GLOWBOOK_ENV=local|staging|production
APP_URL=https://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PRODUCTION_SUPABASE_URL=https://...
```

Reglas:

- `SUPABASE_SERVICE_ROLE_KEY` es server-only. Nunca debe tener prefijo `NEXT_PUBLIC_`.
- `PRODUCTION_SUPABASE_URL` existe para que tests y scripts se nieguen a correr contra produccion.
- Los secretos de GitHub Actions deben usar valores de staging para E2E, no de produccion.
- Las credenciales E2E manuales deben pertenecer a staging.
- En `staging`, `APP_URL` y `E2E_BASE_URL` deben apuntar al deployment real;
  los gates rechazan `localhost` y `127.0.0.1`.

## Supabase Local

`supabase/config.toml` usa puertos `554xx` para desarrollo local:

```text
API: 55421
DB: 55422
Studio: 55423
Mailpit/Inbucket: 55424
Analytics: 55427
Pooler: 55429
Shadow DB: 55420
```

Razon: en esta maquina Windows tenia reservado el rango `54321-54620`, que es
el rango por defecto de Supabase CLI. Mantener los puertos `554xx` evita que
`npx supabase start` falle al exponer la base local.

## Guards Implementados

- `src/test/supabase-integration-fixtures.ts` bloquea fixtures si `GLOWBOOK_ENV`, `APP_ENV` o `VERCEL_ENV` es `production`.
- El mismo fixture bloquea si `NEXT_PUBLIC_SUPABASE_URL` coincide con `PRODUCTION_SUPABASE_URL`.
- `npm run test:e2e:staging` exige `GLOWBOOK_ENV=staging`, `E2E_BASE_URL` desplegado y Supabase staging.
- `npm run release:readiness` y `npm run release:scale-readiness` bloquean si
  `APP_URL` o `E2E_BASE_URL` apuntan a localhost.
- `npm run smoke:seed-5-salons` exige `GLOWBOOK_ENV=staging`, `SMOKE_SEED_CONFIRM=seed-5-salons` y un batch con prefijo `smoke-`.
- `npm run smoke:cleanup-5-salons` exige `GLOWBOOK_ENV=staging`, `SMOKE_CLEANUP_CONFIRM=cleanup-5-salons` y el mismo `SMOKE_SEED_BATCH_ID`.

## Rotacion De Secretos

Rotar inmediatamente si:

- un secreto se pega en logs, issues, screenshots o chat;
- un miembro con acceso sale del equipo;
- se sospecha acceso no autorizado;
- se reemplaza el proyecto Supabase de un entorno.

Despues de rotar:

1. Actualizar variables en hosting.
2. Actualizar GitHub Actions secrets.
3. Ejecutar `npm run ci:verify`.
4. Ejecutar E2E contra staging.
5. Confirmar que ninguna variable server-only aparece en el bundle cliente.
