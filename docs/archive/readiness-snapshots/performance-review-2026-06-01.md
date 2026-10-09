# Performance Review De Escala

Fecha: 2026-06-01

Estado: rutas criticas medidas con dataset de 100 salones en staging. Falta
revision manual de Vercel Logs para cerrar lanzamiento amplio.

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

Batch adicional de medicion de rutas:

```text
Batch: scale-20260601-route-100
Salones: 100
Colaboradores por Salon: 8
Clientes por Salon: 150
Citas por Salon: 120
Fecha de seed: 2026-06-01 UTC
Fecha de medicion: 2026-06-01 UTC
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
| `/` | 200 | 351 ms | OK |
| `/appointments` | 200 | 530 ms | OK |
| `/appointments/new` | 200 | 601 ms | OK |
| `/customers` | 200 | 290 ms | OK |
| `/employees` | 200 | 612 ms | OK |
| `/services` | 200 | 814 ms | OK |
| `/reports` | 200 | 386 ms | OK |
| `/admin` | 200 | 363 ms | OK |
| `/admin/salons` | 200 | 874 ms | OK; ruta mas lenta por overview Platform |
| `/admin/audit` | 200 | 339 ms | OK |

Resultado 2026-06-01:

```text
npm run scale:measure-routes
Batch: scale-20260601-route-100
10 rutas medidas
10 respuestas 200
max duration: 874 ms en /admin/salons
```

## Vercel Logs

- [ ] Errores 5xx revisados.
- [ ] Function Invocation duration revisada.
- [ ] Timeouts revisados.
- [ ] Middleware redirects esperados revisados.
- [ ] No hay secretos visibles.

Gate operativo:

```text
npm run performance:readiness
```

Para exigir evidencia de logs antes de lanzamiento amplio:

```text
GLOWBOOK_PERFORMANCE_REQUIRE_VERCEL_LOG_REVIEW=true
GLOWBOOK_PERFORMANCE_LOG_REVIEW_OWNER=<responsable>
GLOWBOOK_PERFORMANCE_LOG_REVIEW_DATE=2026-06-01
GLOWBOOK_PERFORMANCE_LOG_REVIEW_WINDOW=<ventana revisada>
GLOWBOOK_PERFORMANCE_LOG_REVIEW_MAX_5XX=<conteo>
GLOWBOOK_PERFORMANCE_LOG_REVIEW_MAX_FUNCTION_DURATION_MS=<ms>
GLOWBOOK_PERFORMANCE_LOG_REVIEW_SECRETS_VISIBLE=false
```

Nota 2026-06-01:

`npm run test:e2e:staging` fue bloqueado como evidencia de staging porque
`E2E_BASE_URL`/`APP_URL` apuntaban a localhost. El guard queda endurecido para
rechazar localhost cuando `GLOWBOOK_ENV=staging`. La medicion Vercel debe
repetirse cuando `E2E_BASE_URL` apunte al deployment real.

Nota 2026-06-01, segundo intento:

`E2E_BASE_URL`/`APP_URL` se apuntaron inicialmente a `glow-book-chi.vercel.app`,
pero ese deployment publico embebia Supabase de production mientras `.env.local`
apuntaba a Supabase staging. El guard bloqueaba ese mismatch antes de ejecutar
Playwright:

```text
Expected staging host: vifuurgquxkkpqqobigr.supabase.co
Detected deployed host(s): eokiklkgutzrkhbamglf.supabase.co
```

Resolucion: el Preview `glow-book-git-main-kai-book.vercel.app` fue redeployado
con Supabase staging `vifuurgquxkkpqqobigr.supabase.co`. Luego pasaron
`npm run staging:verify-env`, `npm run test:e2e:staging` y
`npm run scale:measure-routes`.

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
issues con dataset de 100 salones y las rutas criticas respondieron 200 con
latencias bajo 1s en la medicion de staging. Falta revisar Vercel Logs antes de
afirmar readiness de lanzamiento amplio.
```

Posibles decisiones:

- Sin accion.
- Agregar indice con migracion.
- Cambiar query shape en Adapter.
- Crear read model/RPC.
- Subir plan Supabase/Vercel.

## App Router Data Access Decision - 2026-06-07

Decision:

- Mantener Server Actions para mutaciones.
- Mover lecturas interactivas de pagina a `searchParams` y Server Components.
- Conservar lecturas pequenas de lookup como Server Actions mientras no sean cuello de botella medido.
- Diferir RPC/read models hasta medir despues de los cambios de bajo riesgo.

Aplicado:

- `/appointments` usa `date` y `view` en URL.
- `/reports` usa `preset` o rango `from`/`to` en URL.
- `/customers` usa `q` y `page` en URL.

Verificacion esperada:

- Cambios de agenda, reportes y clientes ya no deben aparecer como Server Actions `POST` de lectura en `next dev`.
- Mutaciones de negocio siguen usando Server Actions.
- Si dashboard/reportes siguen por encima del presupuesto en staging, evaluar RPC/read model.
