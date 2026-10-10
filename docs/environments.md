# Politica De Entornos

Fecha: 2026-10-09

GlowBook opera como monolito modular con tres entornos separados:

| Entorno | Uso | Supabase | Datos |
|---|---|---|---|
| `local` | Desarrollo diario y pruebas manuales locales. | Supabase local en Docker (CLI). | Datos desechables. |
| `staging` | Validacion de migraciones, E2E desplegado, smoke con 5 salones y check sintetico de solo lectura. | Proyecto Supabase staging. | Datos de prueba persistentes, nunca clientes reales. |
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

## Quien Puede Migrar Que

| Entorno | Donde se aplican migraciones | Quien puede hacerlo | Estado actual |
|---|---|---|---|
| `local` | `npx supabase start` y `supabase db reset` sobre Docker. | Cualquier desarrollador del equipo. | Vigente. |
| `staging` | `npm run staging:migrations` (gate con `--target=staging`). | Miembros del equipo con acceso a secretos de staging. El job nightly solo verifica drift en lectura. | Vigente. |
| `production` | Job `migrations` de `release.yml`, tras CI y staging. | Automatización con aprobación del environment Production. | Requiere los secretos documentados en `docs/runbooks/deploy.md`. |

**Regla vigente:** las migraciones de production se aplican desde
`.github/workflows/release.yml`, después de CI y E2E de staging y con aprobación.
El workflow existe. Sin sus secretos obligatorios el gate falla antes de tocar
producción. El procedimiento manual queda reservado a contingencias documentadas
en `docs/runbooks/deploy.md`, con aprobación explícita del owner.

Principios aplicables a cualquier entorno:

- Una migracion destructiva exige backup reciente (ver `docs/runbooks/restore.md`).
- Nunca aplicar en produccion una migracion que no haya pasado en staging.

## Reinicio De Staging

Reiniciar staging (borrar datos y volver a sembrar) es una operacion
destructiva. Solo se ejecuta con **confirmacion explicita**:

```text
--confirm=<project-ref>
```

- `<project-ref>` es el **identificador del proyecto Supabase de staging**, no
  su nombre. El script debe comparar ese valor con el proyecto configurado
  localmente y abortar si no coincide.
- Antes de ejecutar, verificar con `npm run staging:verify-env` que
  `APP_URL` y Supabase apuntan a staging.
- Si la URL de Supabase coincide con `PRODUCTION_SUPABASE_URL`, abortar sin
  excepciones.
- Anunciar el reinicio en el canal del equipo antes de ejecutarlo y registrar
  quien lo ejecuto y cuando.

**Estado real:** hoy no existe un script de reinicio general con `--confirm`.
Los scripts `cleanup-staging-*` usan variables `*_CONFIRM` con valores ligados
al lote (por ejemplo `SMOKE_CLEANUP_CONFIRM=cleanup-5-salons`). Pendiente de
implementar el flag `--confirm=<project-ref>` antes de usar el reinicio general.

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
- `npm run staging:verify-env` ejecuta solo el check de deployment/Supabase
  para confirmar rapido que Vercel ya no apunta al proyecto equivocado.
- `npm run test:e2e:staging` tambien inspecciona la CSP y los chunks publicos del
  deployment y bloquea si el `NEXT_PUBLIC_SUPABASE_URL` desplegado no coincide
  con el Supabase staging configurado localmente.
- `npm run release:readiness` y `npm run release:scale-readiness` bloquean si
  `APP_URL` o `E2E_BASE_URL` apuntan a localhost.
- `npm run smoke:seed-5-salons` exige `GLOWBOOK_ENV=staging`, `SMOKE_SEED_CONFIRM=seed-5-salons` y un batch con prefijo `smoke-`.
- `npm run smoke:cleanup-5-salons` exige `GLOWBOOK_ENV=staging`, `SMOKE_CLEANUP_CONFIRM=cleanup-5-salons` y el mismo `SMOKE_SEED_BATCH_ID`.
- `synthetic.yml` (cada hora) ejecuta un check de solo lectura contra
  produccion y staging. Exige sus secretos y falla si faltan. Ver
  `docs/runbooks/synthetic-checks.md`.

## Rotacion De Secretos

Rotar inmediatamente si:

- un secreto se pega en logs, issues, screenshots o chat;
- un miembro con acceso sale del equipo;
- se sospecha acceso no autorizado;
- se reemplaza el proyecto Supabase de un entorno.

Despues de rotar:

1. Actualizar variables en hosting.
2. Actualizar GitHub Actions secrets (incluido `ALERT_WEBHOOK_URL` si aplica).
3. Ejecutar `npm run verify:full`.
4. Ejecutar E2E contra staging.
5. Confirmar que ninguna variable server-only aparece en el bundle cliente.
