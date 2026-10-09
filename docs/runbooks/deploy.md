# Runbook: Deploy

## Objetivo

Publicar GlowBook con gates obligatorios y validación en staging antes de tocar
producción. Solo la automatización de `.github/workflows/release.yml` promueve
código a producción. No se despliega a mano desde el ordenador de nadie.

## Flujo automatizado (release.yml)

Disparo:

- `workflow_run` del workflow `GlowBook CI` con `conclusion: success`, en un
  push a `main`.
- `workflow_dispatch` con el input `sha` (SHA completo de `main` ya verificado).

Etapas en orden:

| Etapa | Job | Qué hace | Si falla |
| --- | --- | --- | --- |
| 1 | `gate` (Release gate) | Comprueba secretos requeridos, que el SHA está en `main` y que todos los check-runs del commit están en `success`. Nunca se salta. | Release fallida. Nada se despliega. Alerta `gate`. |
| 2 | `migrations` (Migrations (production)) | Lista pendientes con `production-migration-gate.mjs`. Si hay, las aplica con `apply-migrations.mjs` y vuelve a comprobar que no quedan. Requiere aprobación del environment `production`. | Ninguna migración parcial se da por buena: la comprobación final es estricta. Alerta `migrations`. |
| 3 | `deploy-staged` (Deploy staged) | `vercel pull --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --prod --skip-domain`. Guarda la URL del despliegue. El dominio de producción no cambia. | Alerta `deploy-staged`. |
| 4 | `smoke-staged` (Smoke staged) | Check sintético (`/login`: 200, cabeceras de seguridad, < 3 s) contra la URL staged. Usa la cabecera de bypass si existe `VERCEL_AUTOMATION_BYPASS_SECRET`. | Job `discard-staged`: `vercel remove <url> --yes`. Alerta `smoke-staged`. |
| 5 | `promote` (Promote production) | `vercel promote <url>`. Requiere aprobación del environment `production`. Después, smoke contra el dominio público (`SYNTHETIC_BASE_URL`). | Ver "Fallos por etapa". |

Resumen del reparto de responsabilidades:

- Los controles de calidad (lint, tests, Playwright, Lighthouse, CodeQL, SBOM)
  viven en `ci.yml`. El gate solo comprueba que estén en `success`.
- `release.yml` no ejecuta herramientas de calidad sueltas. `check-ci-parity.mjs`
  lo verifica.

## Scripts de la release

Ubicación: `scripts/release/`. Lógica pura con tests `node:test`.

| Archivo | Función |
| --- | --- |
| `gate-logic.mjs` | Secretos requeridos, SHA válido, evaluación de check-runs (función pura). |
| `gate.mjs` | Entrada del gate: `gh api` de check-runs y `git merge-base` contra `origin/main`. |
| `migrations-logic.mjs` | Guardas de aplicación de migraciones (función pura). |
| `apply-migrations.mjs` | `supabase db push --db-url` (CLI del paquete npm) tras las guardas. |
| `smoke.mjs` | Reutiliza `runCheck` de `scripts/quality/synthetic-check.mjs` y añade la cabecera de bypass. |
| `deployment-url.mjs` | Extrae la URL `*.vercel.app` de la salida de `vercel deploy`. |
| `alert.mjs` | Construye el payload de alerta sin secretos y lo envía a `ALERT_WEBHOOK_URL`. |
| `args.mjs` | Lectura de argumentos `--nombre=valor`. |

Tests: `node --test scripts/release/*.test.mjs`.

## Secretos requeridos

Todos son **secretos del repositorio** (no del environment), porque el gate los
lee antes de que ningún environment esté aprobado. Si falta alguno o está vacío,
el gate falla y lista solo los nombres.

| Secreto | Uso |
| --- | --- |
| `VERCEL_TOKEN` | Token de la CLI de Vercel (pull, build, deploy, promote, remove, rollback). |
| `VERCEL_ORG_ID` | Organización de Vercel del proyecto. |
| `VERCEL_PROJECT_ID` | Proyecto de Vercel de GlowBook. |
| `SUPABASE_ACCESS_TOKEN` | Token de la CLI de Supabase. |
| `PRODUCTION_DB_URL` | URL Postgres de production (pooler). Debe contener el project ref. |
| `PRODUCTION_SUPABASE_URL` | URL de Supabase de production. |
| `PRODUCTION_PROJECT_REF` | Ref del proyecto de production. Es el valor que debe repetir `--confirm`. |
| `SYNTHETIC_BASE_URL` | Dominio público de producción (smoke posterior a promote). |
| `ALERT_WEBHOOK_URL` | Webhook HTTPS que recibe las alertas de release fallida. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Opcional. Si la protección de despliegues de Vercel está activa, permite el smoke del despliegue staged. Si no existe, el smoke se hace sin cabecera. |

Nunca se imprimen valores. El payload de alerta no incluye tokens, URL de BD
ni la URL del webhook.

## Configuración del repositorio (una vez)

1. **Secretos**: Settings > Secrets and variables > Actions > Repository secrets.
   Crear todos los de la tabla anterior.
2. **Environment `production`**: Settings > Environments > New environment >
   `production`.
   - Required reviewers: al menos una persona distinta de quien hace el push.
     Cada job que usa el environment (`migrations` y `promote`) pide aprobación,
     así que hay dos aprobaciones por release: una antes de tocar la BD y otra
     antes de promover el frontend.
   - Deployment branches: `main` solamente.
   - Prevent self-review: activado si el equipo tiene más de una persona.
3. **Rama `main`**: branch protection que exija el check de CI antes de merge.
   Así `workflow_run` solo se dispara con código revisado.
4. **Vercel**: en el proyecto, activar la protección de despliegues (opcional)
   y generar el bypass secret de automatización si se usa. Copiarlo a
   `VERCEL_AUTOMATION_BYPASS_SECRET`.
5. **Alertas**: crear el webhook (Slack, Teams o similar) y guardar su URL HTTPS
   en `ALERT_WEBHOOK_URL`.

Verificación tras configurar: el `workflow_dispatch` con el SHA de `main` de un
commit con CI verde ejecuta la release completa, incluidas las migraciones y la
promoción, así que solo se lanza cuando se quiera publicar de verdad. Para
ensayar la configuración sin publicar, revisar primero que el job `gate` pasa
(es la única etapa que no toca producción) y cancelar el run en la aprobación de
`migrations`.

## Migraciones: expand/contract

Toda migración que se aplique con este flujo debe ser compatible con el frontend
anterior, que sigue activo mientras se despliega el nuevo:

1. **Expand**: añadir columnas, tablas o índices nuevos, nullable o con default.
   No renombrar ni borrar nada que el frontend actual use.
2. **Desplegar** el frontend que usa lo nuevo.
3. **Contract**: en una release posterior, retirar lo viejo, cuando ningún
   despliegue activo lo use.

Una migración destructiva no pasa el gate de la release en la que se introduce.
Se planifica como contract.

## Staging

El entorno staged es el despliegue `--prod --skip-domain` de la etapa 3. Para
validar manualmente un despliegue, usar la URL que muestra el job
`deploy-staged`, no la de producción.

Verificaciones de entorno (ejecutar en local contra staging, solo con variables
de staging):

```text
npm run staging:verify-env
npm run test:e2e:staging
npm run security:readiness
npm run observability:readiness
```

Si `npm run test:e2e:staging` reporta mismatch de Supabase desplegado, corregir
variables en Vercel y redeployar antes de usar ese despliegue como evidencia.
Seguir `docs/runbooks/vercel-staging-env.md`.

Confirmar que los eventos de `src/infra/observability` aparecen en los logs del
hosting o del log drain. Si se usa webhook, configurar
`GLOWBOOK_OBSERVABILITY_WEBHOOK_URL` y `GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN`.

Evidencia 2026-05-31:

- Vercel Logs mostró requests reales `GET 200` para rutas principales.
- Los redirects `GET 307` observados fueron redirects esperados de middleware/auth.
- El panel de detalle mostró Middleware, Function Invocation y llamadas a Supabase.
- No se observaron secretos en los logs revisados.

## Fallos por etapa

### 1. Gate falla

- Mensaje `faltan secretos requeridos: ...`: crear esos secretos en el repositorio
  y relanzar el workflow (con `workflow_dispatch` y el mismo SHA).
- Mensaje `no es alcanzable desde origin/main`: el SHA no está en `main`. No
  forzar. Publicar solo commits de `main`.
- Mensaje `"<check>" terminó con conclusión failure` o `sigue en estado`: el CI del
  commit no está verde. Arreglar en `main` con un commit nuevo y dejar que CI
  corra. No relanzar la release sobre un commit con CI rojo.
- `paginación incompleta`: el commit tiene más de 100 check-runs. Revisar si hay
  re-runs acumulados.

### 2. Migraciones fallan

- `production-migration-gate` lista pendientes y `apply-migrations` falla: leer el
  error del CLI de Supabase en el log (la URL de BD sale redactada). Revisar que
  la migración es compatible con el frontend anterior.
- `apply-migrations` bloquea por guardas (`GLOWBOOK_RELEASE_AUTOMATION`,
  `--confirm`, URL que no referencia el proyecto): revisar el secreto
  `PRODUCTION_PROJECT_REF` y `PRODUCTION_DB_URL`. No relajar la guarda.
- Si la migración aplicó parcialmente: la BD no se revierte automáticamente. Corregir
  con una migración nueva hacia delante, o restaurar desde backup según
  `docs/runbooks/database-migrations.md`. No editar a mano el historial de migraciones.
- Tras aplicar, la comprobación final debe pasar. Si no pasa, la release se
  detiene aquí.

### 3. Deploy staged falla

- Revisar el log de `vercel pull`, `build` o `deploy`. Causas típicas: token
  caducado, `VERCEL_PROJECT_ID` o `VERCEL_ORG_ID` incorrectos, o variables de
  entorno de production sin definir en Vercel.
- `deployment-url.mjs` no encontró URL: la CLI cambió de formato o el deploy no
  llegó a completarse. Revisar la salida completa del paso.
- Como el frontend no se ha promovido, producción sigue igual. Solo hay que
  corregir y relanzar.

### 4. Smoke staged falla (discard-staged)

- El job `discard-staged` ejecuta `vercel remove <url> --yes` y el release queda
  en rojo. La alerta sale por `notify-failure` con la etapa `smoke-staged`.
- Causas típicas: `/login` no devuelve 200, falta una cabecera de seguridad, la
  respuesta supera 3 s, o la protección de Vercel bloquea el smoke por falta de
  `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Reproducir localmente con `SYNTHETIC_BASE_URL` apuntando a la URL del log, con la
  cabecera si aplica. Arreglar en `main` y relanzar.

### 5. Promote falla

- `vercel promote` no completó: producción no cambió. Revisar el log y reintentar
  la release (la aprobación se pide de nuevo).
- Alerta con etapa `promote`: la promoción no se hizo. No hay rollback.

### 6. Smoke producción falla tras promover

Ocurre cuando el frontend ya está en producción y el smoke del dominio público
falla. El workflow:

1. Ejecuta `vercel rollback --yes` (solo frontend). La BD **no** se revierte.
2. Envía alerta con etapa `smoke-production` y `rollbackAttempted`.

Después, a mano:

- Confirmar en Vercel que el despliegue anterior está activo como producción.
- Repetir el smoke contra el dominio público.
- Si el rollback falló (`rollbackAttempted: true` y el release sigue en rojo),
  promover manualmente el último despliegue sano con `vercel promote <url>` desde
  una cuenta con permisos sobre el proyecto, y registrar el incidente.
- Si el fallo viene de una migración ya aplicada, valorar un fix hacia delante.
  Un rollback de frontend no deshace cambios de BD.

### 7. Alerta no llega

- El job de alerta falla si el webhook no responde 2xx. La release sigue en rojo
  igualmente. Revisar `ALERT_WEBHOOK_URL` y el log del paso.
- Mientras tanto, avisar al responsable de soporte según `docs/launch-support.md`.

## Antes de deployar a mano (solo contingencia)

Si el flujo automatizado no está disponible, el procedimiento manual de respaldo
es el mismo, en este orden: confirmar backup reciente, aplicar pendientes con
`node scripts/production-migration-gate.mjs --target=production` hasta que pase,
y solo después promover. Esta vía no debe usarse para saltarse el gate de CI.

## Lanzamiento amplio

Antes de abrir a 25+ salones nuevos o campañas públicas:

```text
npm run verify:full
npm run test:e2e:staging
npm run release:readiness
npm run release:scale-readiness
```

Además:

1. Ejecutar dataset de escala con `npm run scale:seed-salons`.
2. Revisar rutas críticas y completar `docs/performance-review-2026-06-01.md`.
3. Ejecutar cleanup con `npm run scale:cleanup-salons`.
4. Revisar `docs/capacity-plan.md`.
5. Confirmar runbook de incidentes.
6. Confirmar observability/log drain si el volumen de soporte lo exige.

## Después del deploy

1. Revisar login, dashboard de Salón y Platform admin.
2. Revisar logs durante 30 minutos.
3. Confirmar que errores y eventos estructurados aparecen en el destino de logs
   definido para observability.
4. Confirmar owner de soporte según `docs/launch-support.md`.

## Criterio de éxito

- El run de `GlowBook Release` está en verde y las etapas `promote` y smoke
  producción terminaron en success.
- No hay errores críticos en hosting.
- Login funciona.
- Una cita puede crearse en Salón de prueba/control.
- Platform overview carga.
- Audit log registra operaciones Platform ejecutadas durante smoke.
