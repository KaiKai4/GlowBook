> **Superado:** este runbook fue fusionado en [`docs/runbooks/restore.md`](../../runbooks/restore.md). Se conserva solo como referencia histórica.

# Runbook: Database Restore

## Objetivo

Probar y ejecutar restore de Supabase sin improvisar durante un incidente.

## Politica

- Production debe tener backups habilitados en Supabase.
- Todo restore debe probarse primero en staging o proyecto temporal cuando sea posible.
- Antes de una migracion destructiva debe existir backup reciente.

## Restore De Prueba

1. Crear proyecto temporal o usar staging aislado.
2. Restaurar backup desde Supabase dashboard o CLI segun plan contratado.
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
   - owners pueden iniciar sesion;
   - Platform overview carga;
   - audit log existe.

## Restore De Prueba Ejecutado 2026-05-31 / 2026-06-01 UTC

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
recuperacion.

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
5. Ejecutar smoke minimo.
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

## Restore Grande Ejecutado 2026-06-01 UTC

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

## Restore De Production

1. Declarar incidente.
2. Pausar deploys y operaciones destructivas.
3. Identificar hora objetivo del restore.
4. Confirmar impacto con negocio/soporte.
5. Ejecutar restore segun Supabase.
6. Rotar secretos si el incidente fue de seguridad.
7. Ejecutar smoke minimo:
   - login;
   - dashboard;
   - agenda;
   - crear cita;
   - Platform admin.

## Evidencia

Guardar fecha, hora, backup usado, responsable y resultado en el registro de
operacion del equipo.

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
