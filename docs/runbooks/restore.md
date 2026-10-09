# Runbook: Restore De Base De Datos

Runbook vigente de restore. Fusiona el antiguo `database-restore.md` (política,
pruebas de restore ejecutadas, restore con dataset grande y gate operativo),
que queda archivado en `docs/archive/runbooks-superseded/database-restore.md`.

## Objetivo

Recuperar la base de datos de producción de Supabase tras pérdida o corrupción
de datos, con un procedimiento ensayado y no improvisado. Este runbook es el
procedimiento operativo; el detalle histórico de las pruebas de restore
(2026-05-31 y 2026-06-01) está en la sección "Evidencia De Pruebas De Restore".

## Política

- Production debe tener backups habilitados en Supabase.
- Todo restore debe probarse primero en staging o proyecto temporal cuando sea posible.
- Antes de una migración destructiva debe existir backup reciente.

## Principios

- Antes de restaurar **producción**, congelar deploys y avisar al responsable
  de comunicación (ver `incident.md`).
- Restaurar primero en un **proyecto de restauración separado**, nunca encima
  de producción.
- No cambiar el tráfico hasta que la verificación pase.
- Cada paso deja evidencia: hora UTC, comando, resultado.

## Requisitos Previos

- Backups de Supabase habilitados en producción. Verificar en el dashboard de
  Supabase (Database > Backups) que existe backup diario y, si el plan lo
  incluye, PITR (Point-in-Time Recovery) habilitado.
- Acceso de owner al proyecto Supabase de producción y de staging.
- Acceso a Vercel para cambiar variables de entorno y redeploy.
- Confirmar en la documentación de Supabase del plan contratado cómo se
  restaura (a proyecto nuevo, desde dashboard o CLI). Las opciones dependen del
  plan; no asumir una.

## Paso 1: Declarar Y Congelar

1. Abrir incidente con severidad (SEV1 si hay pérdida de datos).
2. Pausar deploys en Vercel y bloquear `release.yml` cuando exista.
3. Registrar: hora de la pérdida (UTC), última hora conocida buena, alcance
   estimado (tablas y salones afectados).

## Paso 2: Elegir Punto De Restauración

- Preferir el backup o punto PITR **inmediatamente anterior** a la pérdida.
- Si la causa es una migración, el punto debe ser anterior a la migración
  (ver `docs/runbooks/database-migrations.md`).
- Anotar el punto elegido en el incidente antes de restaurar.

## Paso 3: Restaurar En Un Proyecto De Restauración

1. Crear o designar un proyecto Supabase de restauración (no producción ni
   staging compartido).
2. Restaurar el backup o PITR en ese proyecto según la opción del plan.
3. Esperar a que el proyecto esté sano en el dashboard y sin alertas de
   advisors críticos.
4. Registrar el `project ref` de restauración en el incidente.

## Paso 4: Verificar

Verificación en tres capas. Todas deben pasar antes del corte.

1. **Base de datos (pgTAP)**: ejecutar la suite pgTAP del repositorio
   (`supabase/tests`) contra el proyecto restaurado. Confirmar que la suite
   no reporta fallos de RLS, constraints ni de no-overlap de citas.
2. **Integridad de datos**: comprobar, con consultas de solo lectura, que:
   - las citas conservan sus `appointment_items`;
   - `platform_audit_log` existe y tiene filas del periodo esperado;
   - `salon_invitations` y `platform_admins` no están vacíos si deberían tener datos.
3. **Smoke de aplicación** (sin escribir datos reales):
   - login de un owner de prueba del salón restaurado;
   - carga del dashboard de un salón y de la agenda;
   - carga de `/admin` (Platform overview) con cuenta de plataforma;
   - crear una cita de prueba solo si el entorno restaurado es de prueba.

Si la verificación falla, **no cortar tráfico**. Documentar el fallo y decidir
si se restaura otro punto.

## Paso 5: Corte De Tráfico

`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se incrustan en el
bundle en build. El corte requiere **redeploy**, no solo cambiar la variable.

1. En Vercel (production), cambiar `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y
   `PRODUCTION_SUPABASE_URL` al proyecto restaurado.
2. Redeploy de producción y verificar con el check sintético (`synthetic.yml`,
   `workflow_dispatch` sobre `production`).
3. Confirmar que el bundle público no contiene `SUPABASE_SERVICE_ROLE_KEY`.
4. Comunicar el corte a los salones afectados.
5. Mantener el proyecto dañado sin borrar hasta cerrar el postmortem.

## Paso 6: Post-Corte

- Vigilar errores 5xx, latencia y advisors durante al menos una hora.
- Revisar que las escrituras de las horas posteriores al punto de restauración
  se comunican a los salones (pérdida de datos entre el punto y el corte).
- Rotar secretos si hay sospecha de compromiso (ver `docs/environments.md`).

## Paso 7: Postmortem

Dentro de 5 días hábiles, con esta estructura:

- Resumen y severidad.
- Línea de tiempo en UTC: detección, decisiones, corte, verificación.
- Causa raíz y factores contribuyentes.
- Datos perdidos o recuperados (tablas, rango horario, número de salones).
- Qué funcionó y qué no.
- Acciones con dueño y fecha.

## Ensayo Trimestral

Un restore que no se ensaya no sirve en un incidente. Cada trimestre:

1. Elegir un backup reciente de **staging**.
2. Restaurar en un proyecto de restauración temporal.
3. Ejecutar el Paso 4 completo y medir el tiempo total (RTO real).
4. Registrar fecha, persona, tiempo, fallos y acciones en la sección
   "Registro De Ensayos" de este mismo runbook.
5. Eliminar el proyecto temporal al terminar, con confirmación explícita del
   owner.

Objetivos a vigilar: RTO medido frente al objetivo acordado y RPO real (cuántos
minutos de datos se perderían en el punto elegido).

## Estado Del Ensayo

**PENDIENTE**: el ensayo real del procedimiento de este runbook contra staging
todavía no se ha ejecutado. Debe hacerlo una persona con acceso de owner a
Supabase staging, en una ventana acordada. Hasta entonces, este runbook está
validado solo en documentación y no debe considerarse probado.

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
