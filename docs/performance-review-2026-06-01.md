# Performance Review De Escala

Fecha: 2026-06-01

Estado: revision parcial con dataset de escala. Falta medicion manual de rutas
en Vercel Logs para cerrar lanzamiento amplio.

## Dataset

```text
Batch: scale-20260601-100
Salones: 100
Colaboradores por Salon: 8
Clientes por Salon: 150
Citas por Salon: 120
Fecha de seed: 2026-06-01 UTC
Fecha de cleanup: 2026-06-01 UTC
```

Conteos:

- 100 salones
- 100 owners
- 800 colaboradores
- 500 categorias
- 3000 servicios
- 15000 clientes
- 12000 citas

Cleanup:

- 100 salones eliminados
- 100 auth users eliminados desde perfiles
- 0 auth users extra

## Rutas Criticas

Medicion repetible:

```text
$env:SCALE_MEASURE_CONFIRM='measure-scale-routes'
$env:SCALE_MEASURE_BATCH_ID='scale-YYYYMMDD-100'
npm run scale:measure-routes
```

El comando requiere un batch de escala vivo en staging y bloquea URLs localhost
para evitar confundir pruebas locales con evidencia de Vercel. Tambien compara
el `NEXT_PUBLIC_SUPABASE_URL` embebido en el deployment contra el Supabase
staging local antes de medir.

| Ruta | Resultado | Latencia aproximada | Hallazgos |
|---|---|---:|---|
| `/` | pendiente | pendiente | pendiente |
| `/appointments` | pendiente | pendiente | pendiente |
| `/appointments/new` | pendiente | pendiente | pendiente |
| `/customers` | pendiente | pendiente | pendiente |
| `/employees` | pendiente | pendiente | pendiente |
| `/services` | pendiente | pendiente | pendiente |
| `/reports` | pendiente | pendiente | pendiente |
| `/admin` | pendiente | pendiente | pendiente |
| `/admin/salons` | pendiente | pendiente | pendiente |
| `/admin/audit` | pendiente | pendiente | pendiente |

## Vercel Logs

- [ ] Errores 5xx revisados.
- [ ] Function Invocation duration revisada.
- [ ] Timeouts revisados.
- [ ] Middleware redirects esperados revisados.
- [ ] No hay secretos visibles.

Nota 2026-06-01:

`npm run test:e2e:staging` fue bloqueado como evidencia de staging porque
`E2E_BASE_URL`/`APP_URL` apuntaban a localhost. El guard queda endurecido para
rechazar localhost cuando `GLOWBOOK_ENV=staging`. La medicion Vercel debe
repetirse cuando `E2E_BASE_URL` apunte al deployment real.

Nota 2026-06-01, segundo intento:

`E2E_BASE_URL`/`APP_URL` se apuntaron a `glow-book-chi.vercel.app`, pero el
deployment publico estaba embebiendo el Supabase de production mientras
`.env.local` apuntaba a Supabase staging. El guard ahora bloquea ese mismatch
antes de ejecutar Playwright:

```text
Expected staging host: vifuurgquxkkpqqobigr.supabase.co
Detected deployed host(s): eokiklkgutzrkhbamglf.supabase.co
```

Accion requerida para cerrar esta fase: actualizar variables de entorno en
Vercel para el deployment staging, redeployar y repetir `npm run
staging:verify-env`, `npm run test:e2e:staging` y `npm run
scale:measure-routes`.

## Supabase

- [x] Performance advisors revisados.
- [ ] Logs de queries revisados si el plan los expone.
- [x] RLS warnings revisados via advisors.
- [x] Indices nuevos justificados solo con evidencia.

Resultado Supabase advisors:

```text
npx supabase db advisors --linked --type performance --output json
No issues found
```

## Decision

```text
No crear indices nuevos por ahora. Supabase performance advisors no reporto
issues con dataset de 100 salones. Falta revisar Vercel Logs y tiempos de
rutas antes de afirmar readiness de lanzamiento amplio.
```

Posibles decisiones:

- Sin accion.
- Agregar indice con migracion.
- Cambiar query shape en Adapter.
- Crear read model/RPC.
- Subir plan Supabase/Vercel.
