# Guia De Calidad

Esta guia describe el verificador local (`scripts/quality/verify.mjs`), cada paso que ejecuta, el estado de los trinquetes y cómo añadir un control nuevo. La fuente de verdad de los pasos es `scripts/quality/steps.mjs`: si esta guía y el manifiesto no coinciden, manda el manifiesto.

Decisiones relacionadas: ADR 0011 (verificador local igual a CI), ADR 0012 (toolchain de calidad), ADR 0013 (trinquetes de deuda), ADR 0014 (BD de pruebas), ADR 0015 (excepciones de auditoría).

## Idea Central

El mismo manifiesto (`STEPS` en `scripts/quality/steps.mjs`) alimenta tres cosas:

1. `verify.mjs`, que ejecuta los pasos en local.
2. Los jobs de `.github/workflows/ci.yml`, que llaman a `npm run verify:job -- <job>`.
3. `scripts/quality/check-ci-parity.mjs`, que falla si un job del manifiesto no está en CI o si CI ejecuta herramientas de calidad sueltas fuera del runner.

Por eso `verify:full` en local es la misma comprobación que CI. Un paso no puede existir solo en CI ni solo en local.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run verify:fast` | Tier `fast`: pasos estáticos y de pruebas unitarias. Es el ciclo diario y el hook `pre-push`. |
| `npm run verify:full` | Tier `full`: todo lo de `fast` más auditoría, SBOM, BD local, cobertura, build, E2E y Lighthouse. Es la definición de terminado (ver `AGENTS.md`). |
| `npm run verify:job -- <job>` | Ejecuta los pasos de un job de CI: `static`, `unit`, `db`, `browser`, `lighthouse` o `sbom`. |
| `node scripts/quality/verify.mjs --step <id> [--step <id>]` | Ejecuta pasos concretos, en el orden del manifiesto. |
| `node scripts/quality/verify.mjs --tier fast --keep-going` | No se detiene en el primer fallo; informa de todos. |

Cada paso tiene un límite de tiempo (`timeoutMs`). Si expira, el runner termina el árbol de procesos y marca el paso como `timeout`. No hay pasos que se salten en silencio: si un paso no puede correr, el comando falla y dice por qué.

## Pasos

### Tier `fast` (job `static`, salvo `unit` y `scripts-tests`)

| Id | Job | Qué comprueba |
|---|---|---|
| `secrets` | static | secretlint sobre los archivos rastreados por git. Corre también en `pre-commit`. |
| `design-tokens` | static | Trinquete de tokens de diseño (clases de paleta cruda, hex, tamaños y pesos fuera de escala). Ver "Trinquetes". |
| `dead-code` | static | `knip` (incluye tests) y `knip --production` (solo código de producción). |
| `architecture` | static | `scripts/check-architecture.mjs` y `dependency-cruiser` con violaciones conocidas congeladas. |
| `module-size` | static | Ningún archivo de `src/` ni `scripts/` supera 300 líneas, salvo la baseline y la excepción de tipos generados. |
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
| `audit-all` | static | `check-audit.mjs --all`: avisos de desarrollo solo si tienen excepción vigente (`security/audit-exceptions.json`). |
| `sbom` | sbom | SBOM CycloneDX de producción en `.quality/sbom.json` (artefacto local, ignorado por git). |
| `migrations-lint` | db | squawk y reglas forward-only de `scripts/quality/migration-rules.mjs`. |
| `db-reset` | db | Reconstruye la BD local desde todas las migraciones (requiere Docker). |
| `db-tests` | db | Pruebas pgTAP de `supabase/tests` (`supabase test db`). |
| `types-drift` | db | `src/types/database.types.ts` coincide con los tipos que genera la BD local. No regenera nada. |
| `integration` | db | Vitest, proyecto `integration`. Falla si falta la BD local; no se salta. |
| `coverage` | db | Cobertura global frente al trinquete y de las líneas cambiadas frente a `main`. |
| `build` | browser, lighthouse | `next build`. |
| `e2e` | browser | Playwright: flujos críticos y accesibilidad con axe. |
| `lighthouse` | lighthouse | Lighthouse CI sobre la build local. |

CodeQL corre solo en CI (job `codeql`) y no tiene equivalente local.

## Trinquetes Y Su Estado

Un trinquete es un contador que solo puede bajar o quedarse igual. Sirve para no añadir deuda mientras se paga la existente (ADR 0013). Ninguno se sube para pasar un gate.

| Trinquete | Script | Baseline versionada | Estado (en la baseline) |
|---|---|---|---|
| Tokens de diseño | `scripts/quality/check-design-tokens.mjs` | `quality/baselines/design-tokens.json` | 41 archivos con deuda: 187 clases de paleta cruda, 56 hex, 13 tamaños fuera de escala y 11 pesos fuera de escala. Meta: cero. |
| Tamaño de módulos | `scripts/quality/check-module-size.mjs` | `quality/baselines/module-size.json` y `quality/module-size-exceptions.json` | 17 archivos por encima de 300 líneas en la baseline. Excepción permanente: `src/types/database.types.ts` (generado). Archivos nuevos: máximo 300. |
| Cobertura | `scripts/quality/check-coverage.mjs` | `quality/coverage-baseline.json` | Líneas 91.61%, funciones 90.18%, ramas 86.7%. Los umbrales están en el script (ver abajo). |
| Violaciones de grafo | `dependency-cruiser` | `.dependency-cruiser-known-violations.json` | 67 violaciones conocidas congeladas. Ninguna nueva. |
| Auditoría | `scripts/quality/check-audit.mjs` | `security/audit-exceptions.json` | Excepciones con caducidad, solo para desarrollo (ADR 0015). |

Reglas de uso:

- `--update-baseline` (tokens y tamaño) y `--update` (cobertura) escriben una baseline, pero nunca la suben: el script se niega si alguna cifra sube.
- Para regenerar sin tocar los archivos versionados, los pasos usan `--baseline-dir <dir>` (por ejemplo, una carpeta temporal). Así se puede comprobar el estado sin commitear cambios de baseline.
- Un archivo nuevo debe tener cero en todas las categorías de tokens y no puede superar 300 líneas.
- Los umbrales de cobertura son: global 80% líneas y funciones, 70% ramas. Rutas críticas (`src/lib/auth`, `src/lib/security`, `src/features/access`, `src/features/platform`, `src/proxy*.ts`): 90% líneas y funciones, 80% ramas. Los umbrales no se bajan.

## Cómo Añadir Un Control

1. Escribe el comprobador como script en `scripts/quality/` (o como herramienta ya existente).
2. Escribe pruebas de conducta del comprobador con `node:test` o Vitest, y registra el test en la lista del paso `scripts-tests` si es `node:test`. `scripts-tests-list.test.mjs` falla si olvidas el registro.
3. Añade la entrada en `STEPS` (`scripts/quality/steps.mjs`) con `id`, `tier`, `jobs`, `description`, `cmd`, `timeoutMs` y `needsDb` si requiere BD.
4. Añádelo al job de CI correspondiente con `npm run verify:job -- <job>`. No añadas herramientas sueltas en CI: `ci-parity` lo rechaza.
5. Ejecuta `node scripts/quality/verify.mjs --step <id>` y `node scripts/quality/check-ci-parity.mjs`.
6. Documenta el paso en la tabla de esta guía y, si la decisión no es obvia, crea un ADR.
7. Si el control introduce una baseline, añade su trinquete y su script de actualización que solo baje.

## Excepciones Y Lo Que No Se Hace

- No se usan `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `skip` ni `only` para pasar un paso. Los hallazgos se corrigen o, si son deuda existente, se congelan en su baseline.
- No se añaden listas de exclusión a un comprobador para esconder un hallazgo nuevo.
- Los scripts de operación (seed, cleanup, bootstrap, medición, release, sintéticos) no forman parte del verificador. Viven en `docs/production-standard.md` y en los runbooks.

## Hooks De Git

- `pre-commit`: `node scripts/quality/verify.mjs --step secrets --step lint`.
- `pre-push`: `npm run verify:fast`.

Los hooks no sustituyen `verify:full`. Antes de considerar un cambio terminado, ejecutarlo en un checkout limpio con Docker en marcha.
