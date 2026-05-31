# Runbook: Load Smoke 5 Salones

## Objetivo

Validar que GlowBook soporta un lanzamiento inicial con 5 salones reales o mas
sin N+1 obvios ni errores de configuracion.

## Dataset

El script `npm run smoke:seed-5-salons` crea en staging:

- 5 salones;
- 1 owner por Salon;
- 6 colaboradores por Salon;
- 4 categorias por Salon;
- 20 servicios por Salon;
- 100 clientes por Salon;
- 80 citas por Salon.

## Comando

Configurar variables de staging y ejecutar:

```text
GLOWBOOK_ENV=staging
SMOKE_SEED_BATCH_ID=smoke-20260530
SMOKE_SEED_CONFIRM=seed-5-salons
npm run smoke:seed-5-salons
```

En PowerShell:

```powershell
$env:GLOWBOOK_ENV="staging"
$env:SMOKE_SEED_BATCH_ID="smoke-20260530"
$env:SMOKE_SEED_CONFIRM="seed-5-salons"
npm run smoke:seed-5-salons
```

Guardar el `SMOKE_SEED_BATCH_ID`; se usa para limpiar los datos despues de la
medicion. El batch debe empezar con `smoke-` y solo puede contener letras,
numeros y guiones.

## Rutas A Medir

- `/dashboard`
- `/appointments`
- crear cita
- `/employees`
- `/customers`
- `/reports`
- `/admin/salons`
- `/admin/audit`

## Umbrales Iniciales

- Rutas principales: render util por debajo de 3 segundos en staging.
- Acciones de crear/actualizar: respuesta por debajo de 2 segundos salvo cold start.
- Sin errores 5xx.
- Sin queries lentas repetidas en Supabase logs.

## Limpieza

El seed crea datos persistentes para inspeccion. Para limpiar el batch:

```powershell
$env:GLOWBOOK_ENV="staging"
$env:SMOKE_SEED_BATCH_ID="smoke-20260530"
$env:SMOKE_CLEANUP_CONFIRM="cleanup-5-salons"
npm run smoke:cleanup-5-salons
```

El cleanup:

- exige `GLOWBOOK_ENV=staging`;
- exige `SMOKE_SEED_BATCH_ID` con prefijo `smoke-`;
- exige `SMOKE_CLEANUP_CONFIRM=cleanup-5-salons`;
- bloquea `PRODUCTION_SUPABASE_URL`;
- borra cada Salon del batch con `delete_salon_completely`;
- limpia cuentas Auth creadas para owners del smoke.

No ejecutar seed ni cleanup contra production.
