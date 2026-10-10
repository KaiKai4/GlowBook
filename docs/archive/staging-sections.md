# Archivo: secciones de staging y readiness retiradas

Texto retirado de los documentos vigentes. Staging remoto dejó de ser obligatorio (ADR 0021) y el tooling de staging, pricing y readiness se retiró (ADR 0022). Se conserva solo para trazabilidad: no describe un procedimiento vigente.

## Origen: `docs/environments.md (secciones)`

## Staging Opcional

No es requisito del deploy ni se necesita conservar un proyecto remoto. Si se habilita uno para pruebas manuales, los comandos necesitan sus propias credenciales y autorización.

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

## Origen: `docs/environments.md (líneas)`

| `staging` | Herramientas manuales opcionales; fuera de release y monitoreo. | Proyecto Supabase staging. | Datos de prueba persistentes, nunca clientes reales. |
| `staging` | `npm run staging:migrations` (gate con `--target=staging`). | Miembros del equipo con acceso a secretos de staging. Sin jobs automáticos de staging. | Opcional. |
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

## Origen: `docs/runbooks/restore.md (secciones)`

## Restore De Prueba

Procedimiento base para un restore de prueba (staging o proyecto temporal):

1. Crear proyecto temporal o usar staging aislado.
2. Restaurar backup desde Supabase dashboard o CLI según plan contratado.
3. Configurar variables contra el entorno restaurado.
4. Ejecutar:

```text
npm run db:types
npm run test
npm run test:e2e:staging
```

5. Revisar que:
   - salones cargan;
   - citas conservan `appointment_items`;
   - owners pueden iniciar sesión;
   - Platform overview carga;
   - audit log existe.

## Evidencia De Pruebas De Restore

### Restore De Prueba Ejecutado 2026-05-31 / 2026-06-01 UTC

Fuente: Supabase staging `glowbook-staging`.

Destino: Supabase local levantado con `npx supabase start`.

Nota local: en Windows se usaron puertos `554xx` en `supabase/config.toml`
porque el rango `54321-54620` estaba reservado por el sistema.

Comandos base ejecutados:

```text
npm run smoke:seed-5-salons
npx supabase db dump --linked --data-only --schema auth,public --exclude public.permissions --file C:\tmp\glowbook-staging-data-restore-20260531.sql
docker cp C:\tmp\glowbook-staging-data-restore-20260531.sql supabase_db_glowbook:/tmp/glowbook-staging-data-restore-20260531.sql
docker exec supabase_db_glowbook psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/glowbook-staging-data-restore-20260531.sql
npm run smoke:cleanup-5-salons
npx supabase db reset
```

Batch usado: `smoke-restore-20260531`.

Resultado post-restore local:

- `smoke_salons=5`
- `smoke_customers=500`
- `smoke_employees=30`
- `smoke_appointments=400`
- `smoke_auth_users=5`

Resultado post-cleanup staging:

- `smoke_salons=0`
- `smoke_auth_users=0`

Decision: restore de prueba completado. Para un incidente real, repetir el
procedimiento con backup/hora objetivo aprobada y registrar tiempo total de
recuperación.

### Restore Grande Ejecutado 2026-06-01 UTC

Fuente: Supabase staging.

Destino: Supabase local.

Batch usado: `scale-restore-20260601-100`.

Comandos base:

```text
npm run scale:seed-salons
npx supabase db dump --linked --data-only --schema auth,public --exclude public.permissions --file C:\tmp\glowbook-staging-scale-restore-20260601.sql
npx supabase db reset
docker cp C:\tmp\glowbook-staging-scale-restore-20260601.sql supabase_db_glowbook:/tmp/glowbook-staging-scale-restore-20260601.sql
docker exec supabase_db_glowbook psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/glowbook-staging-scale-restore-20260601.sql
npm run scale:cleanup-salons
npx supabase db reset
npx supabase stop
```

Resultado del seed:

- 100 salones
- 100 owners
- 800 colaboradores
- 500 categorias
- 3000 servicios
- 15000 clientes
- 12000 citas

Resultado post-restore local:

- `scale_salons=100`
- `scale_customers=15000`
- `scale_employees=800`
- `scale_appointments=12000`
- `scale_auth_users=100`

Resultado post-cleanup staging:

- 100 salones eliminados
- 100 auth users eliminados desde perfiles
- 0 auth users extra

Decision: restore grande completado. Antes de un lanzamiento amplio real,
definir RTO/RPO de negocio y repetir si el dataset crece de forma importante.

## Restore Con Dataset Grande

Antes de lanzamiento amplio, repetir el restore con un batch de escala:

```text
$env:SCALE_SEED_CONFIRM='seed-scale-salons'
$env:SCALE_SEED_BATCH_ID='scale-YYYYMMDD-100'
$env:SCALE_SALON_COUNT='100'
npm run scale:seed-salons
```

Luego:

1. Crear dump/backup del entorno staging.
2. Restaurar en Supabase local o proyecto temporal.
3. Validar conteos:
   - salones;
   - owners auth;
   - colaboradores;
   - clientes;
   - citas;
   - appointment items.
4. Medir tiempo de dump y restore.
5. Ejecutar smoke mínimo.
6. Limpiar staging:

```text
$env:SCALE_CLEANUP_CONFIRM='cleanup-scale-salons'
$env:SCALE_SEED_BATCH_ID='scale-YYYYMMDD-100'
npm run scale:cleanup-salons
```

Registrar RTO/RPO:

```text
RTO objetivo:
RTO medido:
RPO objetivo:
Backup usado:
Destino:
Responsable:
```

## Evidencia

Guardar fecha, hora, backup usado, responsable y resultado en el registro de
operación del equipo.

## Registro De Ensayos

| Fecha (UTC) | Tipo | Batch | Responsable | Tiempo total | Resultado / acciones |
|---|---|---|---|---|---|
| 2026-05-31 | Restore de prueba (5 salones) | `smoke-restore-20260531` | No registrado | No registrado | Completado (ver evidencia arriba) |
| 2026-06-01 | Restore grande (100 salones) | `scale-restore-20260601-100` | No registrado | No registrado | Completado (ver evidencia arriba) |

Ensayo contra staging del procedimiento de este runbook: pendiente (ver
"Estado Del Ensayo").

## Gate Operativo

Ejecutar:

```text
npm run restore:readiness
```

El gate valida que el runbook conserve evidencia de:

- restore smoke de 5 salones;
- restore grande de 100 salones;
- conteos post-restore;
- cleanup de staging;
- plantilla RTO/RPO.

Para lanzamiento amplio, exigir RTO/RPO de negocio:

```text
GLOWBOOK_RESTORE_REQUIRE_BUSINESS_RTO_RPO=true
GLOWBOOK_RESTORE_RTO=
GLOWBOOK_RESTORE_RPO=
GLOWBOOK_RESTORE_OWNER=
```
