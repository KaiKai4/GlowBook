# Runbook: Load Scale Salons

## Objetivo

Crear y limpiar datasets grandes de staging para medir GlowBook con 25, 50,
100 o 250 salones sin tocar production.

## Politica

- Nunca ejecutar contra production.
- Usar siempre `GLOWBOOK_ENV=staging`.
- Confirmar que `NEXT_PUBLIC_SUPABASE_URL` no coincide con
  `PRODUCTION_SUPABASE_URL`.
- Usar batch id con prefijo `scale-`.
- Ejecutar cleanup al terminar.

## Seed

Comando base:

```text
$env:SCALE_SEED_CONFIRM='seed-scale-salons'
$env:SCALE_SEED_BATCH_ID='scale-YYYYMMDD-50'
$env:SCALE_SALON_COUNT='50'
npm run scale:seed-salons
```

Variables opcionales:

```text
SCALE_EMPLOYEES_PER_SALON=8
SCALE_CATEGORIES_PER_SALON=5
SCALE_SERVICES_PER_CATEGORY=6
SCALE_CUSTOMERS_PER_SALON=150
SCALE_APPOINTMENTS_PER_SALON=120
```

Valores recomendados:

| Escenario | Salones | Uso |
|---|---:|---|
| Crecimiento inicial | 25 | Validar flujo antes de 50. |
| Escala media | 50 | Revisar dashboard, agenda, reportes y Platform. |
| Lanzamiento amplio | 100 | Gate minimo antes de publicidad amplia. |
| Stress opcional | 250 | Solo si Supabase/Vercel plan lo permite. |

## Cleanup

```text
$env:SCALE_CLEANUP_CONFIRM='cleanup-scale-salons'
$env:SCALE_SEED_BATCH_ID='scale-YYYYMMDD-50'
npm run scale:cleanup-salons
```

## Validacion Despues Del Seed

Revisar rutas:

- `/`
- `/appointments`
- `/appointments/new`
- `/customers`
- `/employees`
- `/services`
- `/reports`
- `/admin`
- `/admin/salons`
- `/admin/audit`

Revisar logs:

- Vercel Function Invocation duration.
- Errores 5xx.
- Timeouts.
- Supabase advisors.
- Queries lentas si el dashboard del proveedor las expone.

## Evidencia A Guardar

- Fecha.
- Batch id.
- Conteos creados.
- Conteos limpiados.
- Rutas revisadas.
- Latencias aproximadas.
- Warnings Supabase/Vercel.
- Decisiones de indices o no-accion.

