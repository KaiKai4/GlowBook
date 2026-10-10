# Politica De Entornos

Fecha: 2026-10-09

GlowBook opera como monolito modular con local y producción. Staging remoto es opcional (ADR 0021):

| Entorno | Uso | Supabase | Datos |
|---|---|---|---|
| `local` | Desarrollo diario y pruebas manuales locales. | Supabase local en Docker (CLI). | Datos desechables. |
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
- CI obtiene credenciales de su Supabase local. No necesita secretos de staging ni usa producción para fixtures.

## Quien Puede Migrar Que

| Entorno | Donde se aplican migraciones | Quien puede hacerlo | Estado actual |
|---|---|---|---|
| `local` | `npx supabase start` y `supabase db reset` sobre Docker. | Cualquier desarrollador del equipo. | Vigente. |
| `production` | Job `migrations` de `release.yml`, tras CI con Supabase local. | Automatización con aprobación del environment Production. | Requiere los secretos documentados en `docs/runbooks/deploy.md`. |

**Regla vigente:** las migraciones de production se aplican desde
`.github/workflows/release.yml`, después de CI completo con Supabase local y con aprobación.
El workflow existe. Sin sus secretos obligatorios el gate falla antes de tocar
producción. El procedimiento manual queda reservado a contingencias documentadas
en `docs/runbooks/deploy.md`, con aprobación explícita del owner.

Principios aplicables a cualquier entorno:

- Una migracion destructiva exige backup reciente (ver `docs/runbooks/restore.md`).
- Nunca aplicar en producción una migración que no haya pasado las pruebas de BD local de CI.

## Staging Opcional

Staging remoto dejó de ser obligatorio y no forma parte del flujo vigente. Ver [ADR 0021](adr/0021-deploy-sin-staging-remoto.md) y [ADR 0022](adr/0022-retiro-tooling-staging-pricing-readiness-stryker.md). El procedimiento de reinicio de staging y sus guardas quedan archivados en `docs/archive/staging-sections.md`.

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
- `synthetic.yml` (cada hora) ejecuta un check de solo lectura contra
  producción únicamente. Exige SYNTHETIC_BASE_URL y falla si falta. Ver
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
4. Ejecutar el monitor de producción en solo lectura. Nunca ejecutar E2E ni fixtures contra producción.
5. Confirmar que ninguna variable server-only aparece en el bundle cliente.
