# ADR 0031: Poda moderada de proceso y documentación

- **Estado**: Aceptada. Modifica el manifiesto de pasos descrito en [ADR 0011](0011-verificador-local-igual-ci.md) (pasos `docs-links`, `ci-parity` y `code-map`) y la forma de comprobar el mapa de código de [ADR 0019](0019-arquitectura-por-capas-verificada.md).
- **Fecha**: 2026-10-10

## Contexto

El flujo de calidad creció por fases (ADR 0011 a 0028). El resultado tiene tres problemas:

1. **Pasos de bajo valor que bloquean.** `docs-links`, `ci-parity` y `code-map --check` son comprobaciones de consistencia del propio repositorio. Protegen documentación y CI, no código, BD ni seguridad, pero cada una añade un paso más al `verify:fast` y un fallo más que resolver antes de integrar.
3. **Documentación con fuentes duplicadas.** `AGENTS.md` se llamaba "única fuente de reglas" y repetía la lista de comandos. `README.md`, `docs/README.md` y `docs/testing.md` repetían la misma lista de comandos y el mismo índice de decisiones. `docs/README.md` mezclaba el índice vigente con la lista del archivo histórico. `DESIGN.md` tenía una migración de tokens abierta sin fecha.

Los scripts de `scripts/quality/` acumularon además comprobadores sin referencia desde ningún paso, workflow o `package.json`.

## Decisión

Se poda lo que no protege código, BD ni seguridad, y se deja una sola fuente para cada cosa.

### 1. Pasos del verificador

Se conservan sin cambios los pasos que protegen código, BD y seguridad: `secrets`, `design-tokens`, `dead-code`, `architecture`, `module-size`, `lint`, `types`, `unit`, `scripts-tests`, `audit-prod`, `audit-all`, `sbom`, `migrations-lint`, `db-reset`, `db-tests`, `types-drift`, `integration`, `coverage`, `build`, `bundle-secrets`, `e2e` y `lighthouse`.

Cambios:

- **`docs-links` y `ci-parity` se fusionan en un único paso `meta`** (tier `fast`, job `static`). Ejecuta en secuencia `scripts/quality/check-doc-links.mjs` y `scripts/quality/check-ci-parity.mjs` con `run-sequence.mjs`. Ninguna de las dos comprobaciones cambia de alcance: `meta` sigue exigiendo que los enlaces y rutas citadas existan y que CI y el manifiesto coincidan. La lista de pruebas del paso `scripts-tests` se actualiza para reflejar los scripts que quedan.
- **`code-map` deja de ser un paso que falla.** El mapa de código (`docs/code-map/`) se regenera con `node scripts/quality/code-map.mjs` en el hook `pre-commit` de Husky, que añade `docs/code-map` al commit (`git add docs/code-map`). Así un cambio de dependencias llega con el mapa al día sin que nadie acuerde ejecutar el comando. El modo `--check` deja de ejecutarse en el verificador y el mapa no es un control de CI.
- Los hooks no cambian su papel: `pre-commit` ejecuta `secrets` y `lint` además de regenerar el mapa; `pre-push` ejecuta `verify:fast`. Ninguno se salta con `--no-verify`.

Efecto: el manifiesto pasa de 25 a 23 pasos. `code-map` sale del manifiesto, y `docs-links` y `ci-parity` dan lugar a un único `meta`. Los dos controles de documentación y CI siguen con el mismo criterio dentro de `meta`.

### 2. Scripts sin referencias

Se retiran de `scripts/quality/` los comprobadores que no usa ningún paso del manifiesto, ningún workflow de `.github/workflows/` ni ningún script de `package.json`. La comprobación previa a borrar es una búsqueda de referencias por nombre (grep) en el manifiesto, `.github/workflows/`, `package.json`, `knip.json`, `.husky/` y otros scripts. No es un análisis de uso real: `knip` cubre el código de `src/` y no sustituye esta búsqueda para scripts. Un script que sí tiene consumidor (por ejemplo `code-map.mjs`, usado por `pre-commit`) se conserva. Los scripts de operación de `scripts/release/` y `scripts/ops/` no entran en esta poda.

Resultado de la revisión por referencias (2026-10-10): cada archivo de `scripts/quality/` aparece referenciado por nombre en al menos un paso del manifiesto, workflow, `package.json`, `knip.json`, `lighthouserc.auth.json`, `.husky/pre-commit` o import de otro script. No se retira ninguno. Esa búsqueda no prueba que el consumidor se ejecute en la práctica; la revisión se repetirá cuando un script pierda su última referencia.

### 3. Una sola guía de desarrollo y un índice canónico

- `docs/development-guide.md` es la **única guía de setup y de flujo diario**: requisitos, base de datos local, comandos, hooks y entrega.
- `AGENTS.md` pasa a ser el **índice canónico de reglas**: enumera las reglas y enlaza a `DESIGN.md` (UI), `SECURITY.md` y `docs/security.md` (seguridad) y `docs/testing.md` (pruebas y verificador). Deja de llamarse "única fuente". La sección 15 queda como lista corta de comandos y enlace a la guía.
- `README.md`, `docs/README.md` y `docs/testing.md` enlazan a la guía en vez de repetir comandos.
- `docs/README.md` indexa solo la documentación vigente. `docs/archive/` no aparece en el índice. Se mantiene en su ruta actual porque `check-doc-links` ya la excluye del alcance y mover la carpeta rompería enlaces históricos citados por fecha.
- `DESIGN.md`: la migración de clases de paleta cruda a tokens queda cerrada. El paso `design-tokens` no admite casos (ningún caso, sin baseline), así que la migración está completa desde 2026-10-10.

## Consecuencias

- Menos pasos que fallan por consistencia documental y menos mantenimiento de scripts sin uso.
- El mapa de código se regenera solo, sin que nadie tenga que acordarse de ejecutarlo para pasar un control. Un cambio de dependencias que no regenere el mapa puede llegar al repositorio si el hook se salta; por eso el mapa se revisa en code review, como el resto de documentación generada.
- Una sola guía de comandos: cambiar un comando obliga a tocar `docs/development-guide.md` y no cuatro documentos.
- Los controles de seguridad, BD, código y tokens de diseño no cambian de criterio ni de baseline. Los trinquetes (ADR 0013) siguen igual.
- Se pierde la comprobación automática de que el mapa está al día en CI. Se considera aceptable porque el mapa es documentación derivada y el hook la regenera.
- **Incidencia conocida del mapa (2026-10-10).** En el checkout `gb-wt/f9`, `node_modules` es un enlace a la instalación de `GlowBook`, y dependency-cruiser no lista como dependencias los imports de paquetes npm (`next`, `react`, `@supabase/*`, `server-only`). Al regenerar, el mapa perdió los nodos `npm/*` y sus aristas (unas 270 líneas de `graph.json` y 56 de `modules.mmd` respecto a HEAD). El código de `code-map.mjs` y `.dependency-cruiser.cjs` no cambió en este cambio. Antes de integrar, regenerar el mapa en un checkout con `node_modules` real (`npm ci`) y confirmar que vuelven los nodos `npm/*`; `code-map` en pre-commit lo hace en cada commit.
