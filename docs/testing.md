# Pruebas Y Verificador

Este documento define la estrategia de pruebas de GlowBook, qué comprueba cada paso del verificador local y cómo se aplican los trinquetes de deuda. El flujo diario de trabajo está en `docs/development-guide.md`; las reglas que deben cumplirse están en `AGENTS.md`.

La fuente de verdad de los pasos es `scripts/quality/steps.mjs` (`STEPS`). Si este documento y el manifiesto no coinciden, manda el manifiesto.

Decisiones relacionadas: ADR 0008 (pruebas como red de seguridad), ADR 0011 (verificador local igual a CI), ADR 0012 (toolchain de calidad), ADR 0013 (trinquetes de deuda), ADR 0014 (BD de pruebas local), ADR 0015 (excepciones de auditoría), ADR 0019 (arquitectura verificada), ADR 0026 (runner pgTAP propio), ADR 0025 (cuándo inyectar dependencias).

## Definición De Terminado

Un cambio está terminado cuando `npm run verify:full` sale con código 0 en un checkout limpio (sin archivos sin commitear ni artefactos locales previos), con Docker en ejecución. Los cuatro requisitos completos están en `AGENTS.md`, sección 16.

`verify:full` incluye todo lo de `verify:fast`. No hay pasos opcionales ni pasos que se salten en silencio: si un paso no puede correr, el comando falla y dice por qué.

## Idea Central

El mismo manifiesto (`STEPS`) alimenta tres cosas:

1. `verify.mjs`, que ejecuta los pasos en local.
2. Los jobs de `.github/workflows/ci.yml`, que llaman a `npm run verify:job -- <job>`.
3. `scripts/quality/check-ci-parity.mjs`, que falla si un job del manifiesto no está en CI o si CI ejecuta herramientas de calidad sueltas fuera del runner.

Por eso `verify:full` en local es la misma comprobación que CI. Un paso no puede existir solo en CI ni solo en local.

## Requisitos Locales

- Node 24 (versión fijada en `.nvmrc`).
- Docker en ejecución, para la base de datos local de Supabase.
- `npm ci` después de clonar o cambiar de rama.
- Chromium de Playwright para E2E: `npx playwright install chromium`.

No hace falta `.env.local` para verificar. La base local se obtiene del stack de Supabase local, y el verificador no lee secretos de staging ni de producción.

## Tipos De Prueba

| Tipo | Ubicación | Comando |
|---|---|---|
| Unitarias | `src/**/*.test.ts(x)`, excepto `*.rpc.test.ts` y `*.integration.test.ts` | `npm run test` |
| Integración (BD local) | `src/**/*.rpc.test.ts`, `src/**/*.integration.test.ts` | `npm run test:integration` |
| pgTAP | `supabase/tests/*.sql` | `npm run db:test` (runner `scripts/quality/run-pgtap.mjs`, ADR 0026; no usa `supabase test db`) |
| Scripts | `scripts/**/*.test.mjs` con `node:test` | `node --test <archivo>` (el paso `scripts-tests` ejecuta la lista completa) |
| E2E | `e2e/*.spec.ts` (Playwright, con axe para accesibilidad) | `npm run test:e2e` |
| Cobertura | Vitest con v8 | `npm run test:coverage` |

Principios (ADR 0008):

- Las pruebas cruzan la interfaz pública del módulo y describen conducta observable. Evita probar detalles internos.
- Un cambio de dominio, RLS, RPC, permisos o seguridad lleva pruebas de conducta que crucen la interfaz pública.
- Una regla crítica (RLS, permisos, idempotencia, citas, errores públicos) siempre tiene prueba.
- Una corrección de bug incluye una prueba que falla antes del cambio.
- Las pruebas de integración fallan si falta la BD local. No se marcan como saltadas.
- Sin `skip`, `only` ni tests desactivados.

Para ejecutar solo las pruebas de un cambio mientras iteras:

```text
npx vitest run --project unit --maxWorkers=2 <rutas>
```

### Pruebas unitarias

- Cubren funciones puras de `src/features/<dominio>/domain` y use-cases críticos.
- Deben cruzar la interfaz que usa la aplicación, no detalles internos.

### Pruebas de integración

- Los fixtures compartidos viven en `src/test/supabase-integration-fixtures.ts`.
- Reciben el entorno local de `getLocalSupabaseEnv()`; no leen `.env.local`.
- `src/test/supabase-integration-fixtures.ts` bloquea los fixtures si `GLOWBOOK_ENV`, `APP_ENV` o `VERCEL_ENV` es `production`, o si `NEXT_PUBLIC_SUPABASE_URL` coincide con `PRODUCTION_SUPABASE_URL`.

### Pruebas E2E

- Playwright, flujos críticos listados en `docs/e2e-critical-flows.md`.
- Incluyen aislamiento entre salones y accesibilidad con `@axe-core/playwright`.
- Corren en `verify:full` y en el job `browser` de CI.

### Pruebas de scripts

- `scripts/lib/*.test.mjs`: guardia de destino.
- `scripts/quality/*.test.mjs`: verificador y reglas de migraciones.
- `scripts/release/*.test.mjs` y `scripts/ops/*.test.mjs`: gate, migraciones de release, alertas y check sintético.
- El paso `scripts-tests` ejecuta `node --test` con la lista explícita de `steps.mjs`. Al añadir un test bajo `scripts/`, hay que registrarlo: `scripts/quality/scripts-tests-list.test.mjs` falla si un test no está en la lista o si la lista apunta a un archivo que ya no existe.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run verify:fast` | Tier `fast`: pasos estáticos y unitarios. Es el ciclo diario y el hook `pre-push`. |
| `npm run verify:full` | Tier `full`: todo lo de `fast` más auditoría, SBOM, BD local, cobertura, build, E2E y Lighthouse. Es la definición de terminado. |
| `npm run verify:job -- <job>` | Ejecuta los pasos de un job de CI: `static`, `unit`, `db`, `browser`, `lighthouse` o `sbom`. |
| `node scripts/quality/verify.mjs --step <id> [--step <id>]` | Ejecuta pasos concretos, en el orden del manifiesto. |
| `node scripts/quality/verify.mjs --tier fast --keep-going` | No se detiene en el primer fallo; informa de todos. |
| `npm run db:start` / `db:reset` / `db:test` / `db:types` | BD local: levantar, reconstruir desde migraciones, pgTAP y regenerar tipos. |
| `npm run lint` / `npm run type-check` | ESLint con cero avisos y TypeScript sin emitir. |

Cada paso tiene un límite de tiempo (`timeoutMs`). Si expira, el runner termina el árbol de procesos y marca el paso como `timeout`. Los pasos estáticos tienen 2 minutos; los que usan base de datos, pruebas, build, E2E, Lighthouse o cobertura, 10 minutos.

Los artefactos locales de calidad (SBOM, reportes de drift, informes) van a `.quality/`, que está en `.gitignore`.

## Pasos Del Verificador

### Tier `fast`

Todos son del job `static`, salvo `unit` y `scripts-tests`, que corren en el job `unit`.

| Id | Job | Qué comprueba |
|---|---|---|
| `secrets` | static | secretlint sobre los archivos rastreados por git. Corre también en `pre-commit`. |
| `design-tokens` | static | Control absoluto de tokens de diseño: clases de paleta cruda, hex, tamaños y pesos fuera de escala. Sin baseline: cualquier caso falla. |
| `dead-code` | static | `knip` (incluye tests) y `knip --production` (solo código de producción). |
| `architecture` | static | `scripts/check-architecture.mjs` y `dependency-cruiser` sobre `src/`, sin baseline ni `--ignore-known`. Cero violaciones (ADR 0019). Las invariantes de capas también se afirman en `src/infra/architecture-boundaries.test.ts`. |
| `module-size` | static | Ningún archivo de `src/` ni `scripts/` supera 300 líneas, salvo la excepción permanente de tipos generados. Sin baseline. |
| `code-map` | static | `docs/code-map/` está al día con el grafo de dependencias (`code-map.mjs --check`). Regenerar con `node scripts/quality/code-map.mjs`. |
| `docs-links` | static | Enlaces Markdown relativos y rutas en backticks de la documentación vigente existen (`scripts/quality/check-doc-links.mjs`). |
| `ci-parity` | static | Cada paso del manifiesto está en CI y CI no ejecuta herramientas de calidad sueltas. |
| `lint` | static | ESLint con `--max-warnings 0`. |
| `types` | static | `tsc --noEmit` de la aplicación y de `scripts/tsconfig.json`. |
| `unit` | unit | Vitest, proyecto `unit`. |
| `scripts-tests` | unit | `node --test` sobre la lista explícita de `scripts/**/*.test.mjs`. |

### Tier `full` (pasos adicionales)

| Id | Job | Qué comprueba |
|---|---|---|
| `audit-prod` | static | `check-audit.mjs --prod`: cero avisos en dependencias de producción, sin excepciones. |
| `audit-all` | static | `check-audit.mjs --all`: avisos de desarrollo solo si tienen excepción vigente (`security/audit-exceptions.json`, ADR 0015). |
| `sbom` | sbom | SBOM CycloneDX de producción en `.quality/sbom.json` (artefacto local, ignorado por git). |
| `migrations-lint` | db | squawk y reglas forward-only de `scripts/quality/migration-rules.mjs` (bloqueantes) sobre las migraciones posteriores al corte `20240101000063`. Las reglas de `DROP POLICY` y `DROP CONSTRAINT` exigen un contrato (ADR 0016). |
| `db-reset` | db | Reconstruye la BD local desde cero con todas las migraciones (requiere Docker). |
| `db-tests` | db | Pruebas pgTAP de `supabase/tests` con `scripts/quality/run-pgtap.mjs` (ADR 0026). Cubren RLS, aislamiento por salón, permisos, `create_appointment`, idempotencia y privilegios. |
| `types-drift` | db | `src/types/database.types.ts` coincide con los tipos que genera la BD local. No regenera nada. |
| `integration` | db | Vitest, proyecto `integration`. Falla si falta la BD local; no se salta. |
| `coverage` | db | Cobertura global frente al trinquete y cobertura de las líneas cambiadas frente a `main`. |
| `build` | browser, lighthouse | `next build`. |
| `bundle-secrets` | browser | La clave `service_role` no aparece en los artefactos públicos (`.next/static` y `public`), con `scripts/quality/check-bundle-secrets.mjs`. Sustituye al antiguo readiness de seguridad (ADR 0022). |
| `e2e` | browser | Playwright: flujos críticos y accesibilidad con axe. |
| `lighthouse` | lighthouse | Lighthouse CI sobre la build local, con umbrales declarados. |

CodeQL corre solo en CI (job `codeql`) y no tiene equivalente local.

## Trinquetes Y Controles Absolutos

Un trinquete es un contador que solo puede bajar o quedarse igual. Sirve para no añadir deuda mientras se paga la existente (ADR 0013). Ninguno se sube para pasar un gate.

| Trinquete | Script | Baseline versionada | Estado |
|---|---|---|---|
| Cobertura | `scripts/quality/check-coverage.mjs` | `quality/coverage-baseline.json` | Líneas 91.61%, funciones 90.18%, ramas 86.7%. |
| Auditoría | `scripts/quality/check-audit.mjs` | `security/audit-exceptions.json` | Excepciones con caducidad, solo para desarrollo (ADR 0015). |

Controles absolutos (sin baseline, ADR 0019). Fallan con cualquier caso:

| Control | Script o herramienta | Regla |
|---|---|---|
| Tokens de diseño | `scripts/quality/check-design-tokens.mjs` | Cero clases de paleta cruda, hex, tamaños o pesos fuera de escala en `src/`. |
| Tamaño de módulos | `scripts/quality/check-module-size.mjs` | Ningún archivo de `src/` o `scripts/` supera 300 líneas. Única excepción permanente: `src/types/database.types.ts` (generado), en `quality/module-size-exceptions.json`. |
| Violaciones de grafo | `dependency-cruiser` (paso `architecture`) | Cero violaciones sobre `src/`. Sin `--ignore-known`. |
| Mapa de código | `scripts/quality/code-map.mjs --check` | `docs/code-map/` coincide con el grafo regenerado. |

Umbrales de cobertura (definidos en `scripts/quality/check-coverage.mjs`):

| Ámbito | Líneas | Funciones | Ramas |
|---|---|---|---|
| Global | 80% | 80% | 70% |
| Rutas críticas | 90% | 90% | 80% |

Rutas críticas: `src/infra/auth/**`, `src/infra/security/**`, `src/features/access/**`, `src/features/platform/**` y `src/proxy*.ts`. El código cambiado debe cumplir los mismos umbrales. Los umbrales no se bajan para pasar el gate.

Reglas de uso:

- `--update` (cobertura) escribe la baseline, pero nunca la sube: el script se niega si alguna cifra sube.
- Los controles absolutos no tienen opción para crear ni regenerar una baseline. Si fallan, se corrige el código.
- Un archivo nuevo debe tener cero en todas las categorías de tokens y no puede superar 300 líneas.
- Reportes de Vitest: `text-summary`, `json-summary`, `json` y `lcov` en `coverage/`.

## Cómo Añadir Un Control

1. Escribe el comprobador como script en `scripts/quality/` (o usa una herramienta existente).
2. Escribe pruebas de conducta del comprobador con `node:test` o Vitest, y registra el test en la lista del paso `scripts-tests` si es `node:test`.
3. Añade la entrada en `STEPS` (`scripts/quality/steps.mjs`) con `id`, `tier`, `jobs`, `description`, `cmd`, `timeoutMs` y `needsDb` si requiere BD.
4. Añádelo al job de CI correspondiente con `npm run verify:job -- <job>`. No añadas herramientas sueltas en CI: `ci-parity` lo rechaza.
5. Ejecuta `node scripts/quality/verify.mjs --step <id>` y `node scripts/quality/check-ci-parity.mjs`.
6. Documenta el paso en la tabla de este documento y, si la decisión no es obvia, crea un ADR.
7. Un control nuevo es absoluto por defecto. Si necesita una baseline, justifícala en un ADR y añade su trinquete con un script de actualización que solo baje.

## Excepciones Y Lo Que No Se Hace

- No se usan `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `skip` ni `only` para pasar un paso. Los hallazgos se corrigen. Las únicas baselines que quedan son las de cobertura y auditoría.
- No se añaden listas de exclusión a un comprobador para esconder un hallazgo nuevo.
- Los scripts de operación (seed, cleanup, bootstrap, release, sintéticos) no forman parte del verificador. Viven en `docs/runbooks/`.
- Stryker fue retirado por [ADR 0022](adr/0022-retiro-tooling-staging-pricing-readiness-stryker.md). La cobertura con trinquete y las pruebas de conducta son el control vigente.

## Base De Datos Local

La base de pruebas es Supabase local (ADR 0014). Puertos declarados en `supabase/config.toml`: API `55421`, base de datos `55422`.

```text
npm run db:start
npm run db:reset
npm run db:test
```

Reglas:

- Ningún paso de calidad apunta a staging ni a producción. Los scripts `staging:*`, `release:*` y los de seed o cleanup remotos están fuera del verificador.
- Las migraciones son forward-only. Para cambiar el esquema se crea una migración nueva; no se edita una existente.
- Si `db:start` falla, revisa que Docker esté en ejecución. Si el stack estaba arriba con otra configuración, ejecuta `npx supabase stop` y vuelve a levantarlo.

### Un stack local por máquina

Supabase local usa siempre el mismo `project_id` (`glowbook`), así que dos checkouts del repositorio en la misma máquina comparten contenedores. Si un checkout arranca el stack y otro lo usa, el segundo se conecta a un stack que no controla y las pruebas pueden colgarse.

- Hay un stack local por máquina. Para cambiar de checkout, para el stack desde el checkout que lo arrancó y vuelve a arrancarlo desde el nuevo.
- `ensureLocalSupabase` (`scripts/quality/supabase-env.mjs`) comprueba que la etiqueta Docker `com.supabase.cli.workdir` del contenedor de la BD coincide con este checkout. Rechaza otras rutas o etiquetas ausentes.

### Tipos generados

`src/types/database.types.ts` es un artefacto generado y no se edita a mano. Es la única excepción permanente de tamaño de módulo. Vuelve a generarlo con `npm run db:types` tras cualquier migración que cambie tablas, enums, vistas, columnas o RPC. El paso `types-drift` avisa si el archivo versionado se queda atrás.

## Esperas Asíncronas En Pruebas De UI

Las transiciones que incluyen WebCrypto o Server Actions se esperan por su resultado observable (botón habilitado de nuevo, diálogo reemplazado o callback final), con `vi.waitFor` y `act`. Un número fijo de tareas o microtareas no garantiza que la operación termine y puede dejar trabajo pendiente que contamine el siguiente test. La cancelación de citas incluye una acción demorada para cubrir este comportamiento.

## Hooks De Git

Husky se instala con `npm install` mediante `prepare` (`core.hooksPath=.husky/_`).

- `pre-commit`: `node scripts/quality/verify.mjs --step secrets --step lint`.
- `pre-push`: `npm run verify:fast`.

Los hooks no sustituyen `verify:full`. Nunca se saltan con `--no-verify`.

## Paridad De CI Y Scripts De Operación

`check-ci-parity` (paso `ci-parity`) comprueba que cada job del manifiesto está en CI y que CI no ejecuta herramientas de calidad sueltas (eslint, tsc, vitest, playwright, knip, depcruise, lhci, squawk, secretlint o `next build`). No prohibe los scripts de operación:

- `synthetic.yml` ejecuta `scripts/quality/synthetic-check.mjs` y `scripts/ops/synthetic-alert-cli.mjs`.
- `release.yml` ejecuta `scripts/release/*.mjs` y `scripts/production-migration-gate.mjs`.

Son comprobaciones de despliegue y disponibilidad contra producción, no controles de calidad. El procedimiento de release está en `docs/runbooks/deploy.md`.
