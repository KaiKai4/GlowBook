# Testing Y Verificacion

Este documento define cuando un cambio esta terminado y que comprueba cada paso de la verificacion. El manifiesto de pasos vive en `scripts/quality/steps.mjs`; si este documento y el manifiesto no coinciden, manda el manifiesto.

Decisiones relacionadas: `docs/adr/0008-tests-as-safety-net.md`, `docs/adr/0011-verificador-local-igual-ci.md`, `docs/adr/0013-trinquetes-de-deuda.md`, `docs/adr/0014-bd-de-pruebas-supabase-local.md`, `docs/adr/0015-politica-excepciones-auditoria.md`.

## Definicion De Terminado

Un cambio esta terminado cuando:

```text
npm run verify:full
```

sale con codigo 0 en un checkout limpio (sin archivos sin commitear ni artefactos locales previos), con Docker en ejecucion.

`verify:full` incluye todo lo de `verify:fast`. No hay pasos opcionales ni pasos que se salten en silencio: si un paso no puede correr, el comando falla y dice por que.

## Requisitos Locales

- Node 24 (version fijada en `.nvmrc`).
- Docker en ejecucion, para la base de datos local de Supabase.
- `npm ci` despues de clonar o cambiar de rama.
- Chromium de Playwright para E2E: `npx playwright install chromium`.

No hace falta `.env.local` para verificar. La base local se obtiene del stack de Supabase local, y el verificador no lee secretos de staging ni de produccion.

## Comandos

| Comando | Que ejecuta |
|---|---|
| `npm run verify:fast` | Tier `fast`: pasos estaticos y unit. Es el ciclo diario y el hook de `pre-push`. |
| `npm run verify:full` | Tier `full`: `fast` mas auditoria, BD local, build, E2E y Lighthouse. |
| `npm run verify:job -- <job>` | Todos los pasos de un job de CI (`static`, `unit`, `db`, `browser`, `lighthouse`, `sbom`). |
| `node scripts/quality/verify.mjs --step <id>` | Un paso concreto. Acepta `--step` varias veces y `--keep-going`. |
| `npm run test` | Vitest, proyecto `unit`. |
| `npm run test:integration` | Vitest, proyecto `integration` (requiere BD local). |
| `npm run test:coverage` | Vitest con cobertura v8. Genera `coverage/`. |
| `npm run test:e2e` | Playwright contra la build local. |
| `npm run db:start` | Levanta Supabase local (idempotente). |
| `npm run db:reset` | Reconstruye la BD local desde `supabase/migrations`. |
| `npm run db:migrate` | Aplica migraciones a un proyecto remoto con guardia (`scripts/db-push-guarded.mjs`): exige `GLOWBOOK_RELEASE_AUTOMATION=true` y `--confirm=<project-ref>`. Solo lo usa la automatizacion de release o una persona con el proyecto enlazado. |
| `npm run db:test` | Ejecuta las pruebas pgTAP de `supabase/tests`. |
| `npm run db:types` | Regenera `src/types/database.types.ts` desde la BD local. |
| `npm run lint` | ESLint con cero avisos. |
| `npm run type-check` | TypeScript sin emitir. |

Los artefactos locales de calidad (SBOM, reportes de drift, informes) van a `.quality/`, que esta en `.gitignore`.

## Pasos De `verify:fast`

Todos son `static` salvo `unit` y `scripts-tests`, que corren en el job `unit`.

| Paso | Que comprueba |
|---|---|
| `secrets` | Escaneo de secretos con secretlint sobre archivos de git (rastreados y no ignorados). |
| `design-tokens` | No hay colores ni tipografias literales fuera de los tokens, respetando el trinquete. |
| `dead-code` | Archivos, exports, tipos y dependencias sin uso (knip). |
| `architecture` | Reglas de capas (`scripts/check-architecture.mjs`) y reglas de grafo (dependency-cruiser, con violaciones conocidas congeladas). |
| `module-size` | Ningun modulo supera el limite de lineas, respetando el trinquete y la excepcion de tipos generados. |
| `ci-parity` | Cada paso del manifiesto esta en CI y CI no ejecuta herramientas sueltas. |
| `lint` | ESLint con `--max-warnings 0`. |
| `types` | TypeScript de la aplicacion y de `scripts/tsconfig.json`. |
| `unit` | Vitest, proyecto `unit` (`src/**` sin pruebas RPC ni de integracion). |
| `scripts-tests` | Pruebas `node:test` de todos los `scripts/**/*.test.mjs` (release, ops, lib y verificador). La lista es explicita en `steps.mjs`; `scripts-tests-list.test.mjs` falla si existe un test que no esta en la lista. |

## Pasos Adicionales De `verify:full`

| Paso | Job CI | Que comprueba |
|---|---|---|
| `audit-prod` | static | `npm audit --omit=dev`. Produccion sin excepciones. |
| `audit-all` | static | `npm audit` completo, solo con excepciones vigentes (ADR 0015). |
| `sbom` | sbom | SBOM CycloneDX de produccion en `.quality/sbom.json`. |
| `migrations-lint` | db | squawk y las reglas forward-only de `scripts/quality/migration-rules.mjs` (bloqueantes) sobre migraciones posteriores a `20240101000063`, y reporte de squawk por regla del resto. Las reglas de `DROP POLICY` y `DROP CONSTRAINT` exigen un contrato (ver ADR 0016). |
| `db-reset` | db | La BD local se reconstruye desde cero con todas las migraciones. |
| `db-tests` | db | Pruebas pgTAP de RLS, aislamiento por salon, permisos, `create_appointment` y privilegios. |
| `types-drift` | db | El archivo de tipos versionado coincide con los tipos que genera la BD local. No regenera nada. |
| `integration` | db | Vitest, proyecto `integration`: pruebas RPC y de integracion. Fallan si falta la BD local. |
| `coverage` | db | Cobertura global frente al trinquete y cobertura de las lineas cambiadas frente a `main`. |
| `build` | browser, lighthouse | `next build`. |
| `e2e` | browser | Flujos criticos con Playwright, incluido aislamiento entre salones y accesibilidad con axe. |
| `lighthouse` | lighthouse | Lighthouse CI sobre la build local, con umbrales declarados. |

CodeQL corre solo en CI (job `codeql`) y no tiene equivalente local.

## Base De Datos Local

La base de pruebas es Supabase local (ADR 0014). Puertos declarados en `supabase/config.toml`: API `55421`, base de datos `55422`.

```text
npm run db:start
npm run db:reset
npm run db:test
```

Reglas:

- Las pruebas de integracion no leen `.env.local`. Reciben el entorno local de `getLocalSupabaseEnv()`.
- Ningun paso de calidad apunta a staging ni a produccion. Los scripts `staging:*`, `release:*`, `db:types:staging` y los de seed o cleanup de staging estan fuera del verificador.
- Las migraciones son forward-only. Para cambiar el esquema se crea una migracion nueva; no se edita una existente.

Si `db:start` falla, revisar que Docker este en ejecucion. Si el stack estaba arriba con otra configuracion, ejecutar `npx supabase stop` y volver a levantarlo.

### Un stack local por maquina

Supabase local usa siempre el mismo `project_id` (`glowbook`), asi que dos checkouts del repositorio en la misma maquina comparten contenedores. Si un checkout arranca el stack y otro lo usa, el segundo se conecta a un stack que no controla y las pruebas pueden colgarse (un `supabase test db` lo hizo durante horas).

Reglas:

- Hay un stack local por maquina. Para cambiar de checkout, parar el stack desde el checkout que lo arranco y volver a arrancarlo desde el nuevo.
- `ensureLocalSupabase` (`scripts/quality/supabase-env.mjs`) comprueba que el stack que responde lo arranco este checkout: debe existir `supabase/.temp/start-secrets`. Si falta, falla con el mensaje: ejecutar `supabase stop` en el otro checkout y volver a arrancar desde este con `npm run db:start`.
- El verificador limita el tiempo de cada paso (`timeoutMs` en `scripts/quality/steps.mjs`: 2 min en pasos estaticos y 10 min en los que usan base de datos, pruebas, build, e2e, lighthouse y cobertura). Si un paso expira, el runner termina el proceso y sus hijos y lo marca como `timeout`, sin esperar indefinidamente.

## Pruebas De Scripts

Los scripts de `scripts/` tienen pruebas con `node:test` (sin Vitest ni base de datos):

- `scripts/lib/*.test.mjs`: guardia de destino.
- `scripts/quality/*.test.mjs`: verificador y reglas de migraciones.
- `scripts/release/*.test.mjs` y `scripts/ops/*.test.mjs`: gate, migraciones de release, alertas y check sintetico.

El paso `scripts-tests` (job `unit`) ejecuta `node --test` con la lista explicita de esos archivos definida en `scripts/quality/steps.mjs`. Al añadir un test bajo `scripts/`, hay que añadirlo a esa lista: `scripts/quality/scripts-tests-list.test.mjs` falla si existe un test que no esta registrado o si la lista apunta a un archivo que ya no existe.

Los scripts de seed, cleanup, bootstrap, scale y pricing pasan por `scripts/lib/target-guard.mjs`. Contra un destino local no exigen confirmacion. Contra un proyecto remoto exigen `--confirm=<project-ref>` igual al ref de la URL, y rechazan `GLOWBOOK_ENV=production` y la `PRODUCTION_SUPABASE_URL`. Ninguno de ellos forma parte del verificador.

La configuracion del environment `production` (secretos, revisores y proteccion de despliegues) la describe `docs/runbooks/deploy.md`. Este documento no la duplica.

## Paridad De CI Y Scripts De Operacion

`check-ci-parity` (paso `ci-parity`) comprueba que cada job del manifiesto esta en CI y que CI no ejecuta herramientas de calidad sueltas (eslint, tsc, vitest, playwright, knip, depcruise, lhci, squawk, secretlint o `next build`). No prohibe los scripts de operacion:

- `synthetic.yml` ejecuta `scripts/quality/synthetic-check.mjs` y `scripts/ops/synthetic-alert-cli.mjs`.
- `release.yml` ejecuta `scripts/release/*.mjs` y `scripts/production-migration-gate.mjs`.

Son comprobaciones de disponibilidad y de despliegue contra produccion o staging, no controles de calidad, y el verificador no los sustituye.

Los CLIs que invocan los workflows figuran en `knip.json` como entradas de produccion (sufijo `!`), para que `knip --production` los trate como codigo de produccion. Las entradas son rutas explicitas, sin comodines.

## Pruebas Unitarias

- Archivos `src/**/*.test.{ts,tsx}` excepto `*.rpc.test.ts` y `*.integration.test.ts`.
- Cubren funciones puras de `src/features/<dominio>/domain` y use-cases criticos (ADR 0008).
- Deben cruzar la interfaz que usa la aplicacion, no detalles internos.

## Pruebas De Integracion

- Archivos `src/**/*.rpc.test.ts` y `src/**/*.integration.test.ts`, proyecto `integration`.
- Si falta el entorno local, el test falla con un mensaje explicito. No se marca como skipped.
- Los fixtures compartidos viven en `src/test/supabase-integration-fixtures.ts`.

## Pruebas E2E

- Playwright, flujos criticos listados en `docs/e2e-critical-flows.md`.
- Incluyen comprobaciones de accesibilidad con `@axe-core/playwright`.
- Corren en `verify:full` y en el job `browser` de CI.

## Umbrales De Cobertura

Los valores se definen en `scripts/quality/check-coverage.mjs`.

| Ambito | Lineas | Funciones | Ramas |
|---|---|---|---|
| Global | 80% | 80% | 70% |
| Rutas criticas | 90% | 90% | 80% |

Rutas criticas: `src/lib/auth/**`, `src/lib/security/**`, `src/features/access/**`, `src/features/platform/**` y `src/proxy*.ts`.

Los umbrales no se bajan para pasar el gate. La linea base de cobertura global (`quality/coverage-baseline.json`) solo puede subir o quedarse; ver ADR 0013.

Reportes de Vitest: `text-summary`, `json-summary`, `json` y `lcov` en `coverage/`.

## Mutacion (Solo Nightly)

Stryker corre en el workflow nocturno `nightly.yml` sobre `src/features/*/domain` y `src/lib/security`. No corre en PR por tiempo. Su configuracion vive en `stryker.config.mjs`.

## Hooks De Git

Husky se instala con `npm install` mediante `prepare` (`core.hooksPath=.husky/_`).

- `pre-commit`: `node scripts/quality/verify.mjs --step secrets --step lint`.
- `pre-push`: `npm run verify:fast`.

Los hooks no sustituyen `verify:full`. Antes de considerar un cambio terminado, correrlo a mano o confiar en el job completo de CI.

## Checklist Para Cambios De Base De Datos

1. Identificar el Module TypeScript dueno en `docs/database-contracts.md`.
2. Revisar el ADR relacionado.
3. Definir si SQL o TypeScript es la autoridad final (SQL lo es para seguridad e integridad).
4. Crear una migracion nueva en `supabase/migrations/`. No editar migraciones existentes.
5. Aplicarla en local con `npm run db:reset`.
6. Anadir o actualizar pruebas pgTAP en `supabase/tests/` si cambia seguridad, RLS, RPC o integridad.
7. Regenerar tipos con `npm run db:types` y revisar el diff.
8. Ejecutar `npm run verify:full` antes de considerar el cambio terminado.

## Tipos Generados

`src/types/database.types.ts` es un artefacto generado. No se edita a mano. Es la unica excepcion permanente de tamano de modulo (`quality/module-size-exceptions.json`).

Regenerar con `npm run db:types` despues de cualquier migracion que cambie tablas, enums, vistas, columnas o RPC. El paso `types-drift` avisa si el archivo versionado se queda atras.
