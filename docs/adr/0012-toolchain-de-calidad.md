# ADR 0012: Toolchain De Calidad

## Estado

Aceptada.

## Contexto

La fase 1 del plan de calidad agrego herramientas de verificacion que el proyecto no tenia. Sin una razon escrita para cada una, el toolchain crece sin control, cada dependencia nueva aumenta la superficie de ataque y de mantenimiento, y futuras auditorias no sabran si una herramienta sigue siendo necesaria.

Restricciones que guian la eleccion:

- El desarrollo ocurre en Windows y CI corre en Ubuntu. Una herramienta debe funcionar igual en ambos con `npm ci`.
- El proyecto ya usa Vitest, ESLint, TypeScript y Playwright. No se reemplazan.
- Las dependencias de produccion no cambian por herramientas de calidad. Todas las nuevas son `devDependencies`.

## Decision

Cada herramienta nueva tiene una razon concreta y una alternativa descartada.

| Herramienta | Uso en el repo | Razon | Alternativa descartada |
|---|---|---|---|
| `knip` | Paso `dead-code` (fast) | Detecta archivos, exports, tipos y dependencias sin uso en un solo analisis que entiende TypeScript y las entradas de Next. | `ts-prune`: solo exports, sin dependencias ni binarios. |
| `dependency-cruiser` | Paso `architecture` (fast), reglas en `.dependency-cruiser.cjs` | Verifica reglas de grafo entre capas y modulos (ciclos, dominio aislado) que ESLint no expresa de forma limpia. | `eslint-plugin-import` `no-cycle`: no cubre reglas por capa ni informe de violaciones conocidas. |
| `@vitest/coverage-v8` | Paso `coverage` (db) | Es el proveedor nativo de Vitest. No instrumenta con Babel y no exige transformar el codigo. | `@vitest/coverage-istanbul`: mas lento y requiere instrumentacion adicional. |
| `secretlint` + `@secretlint/secretlint-rule-preset-recommend` | Paso `secrets` (fast) y hook `pre-commit` | Se instala con npm, asi que local y CI usan la misma version en Windows y Ubuntu. Escanea solo archivos de git. | `gitleaks`: binario Go fuera de npm. Requiere instalarlo aparte en cada maquina y en CI, y su paridad en Windows depende del binario. |
| `squawk-cli` | Paso `migrations-lint` (db) | Lint especifico de SQL de Postgres: detecta operaciones que bloquean tablas en produccion. Su configuracion es `.squawk.toml`. | Revisar migraciones a mano: no escala y no es repetible. |
| `husky` | Hooks `pre-commit` y `pre-push` | Integra los hooks con `npm install` mediante `prepare`, sin archivos fuera del repo. | `lefthook`: binario adicional. Husky usa el mismo `npm ci` que el resto. |
| `@lhci/cli` | Paso `lighthouse` (lighthouse) | Automatiza Lighthouse sobre la build local con umbrales declarados. | Ejecutar Lighthouse a mano: sin umbrales ni historial. |
| `fast-check` | Pruebas de propiedades de funciones puras de dominio | Genera casos para reglas de disponibilidad y solapamiento que los ejemplos fijos no cubren. | Solo ejemplos fijos: dejan pasar casos de borde no pensados. |
| `@axe-core/playwright` | Helper de accesibilidad en E2E | Motor de accesibilidad de referencia, integrado con Playwright. | Revisiones manuales: no se repiten en cada cambio. |
| `supabase` (CLI) | `db:start`, `db:reset`, `db:test`, tipos y pgTAP | Es la unica forma oficial de levantar el stack local de Supabase y ejecutar `supabase test db`. | Postgres en Docker sin el CLI: no reproduce Auth, roles ni el hook de JWT. |
| `@stryker-mutator/core` + `vitest-runner` | Workflow nocturno `mutation` (solo CI) | Mide si los tests detectan cambios de comportamiento en `src/features/*/domain` y `src/lib/security`. Es lento, por eso no corre en PR. | Cobertura como unico indicador: una linea puede estar cubierta sin que su aserción la verifique. |

Dependencias ya existentes que no se reemplazan: Vitest, ESLint, TypeScript, Playwright y `pg`.

Regla de alta de herramientas: una herramienta nueva necesita una razon escrita en este ADR o en uno nuevo, una alternativa descartada y su paso en el manifiesto `scripts/quality/steps.mjs`. Una herramienta sin paso no entra.

## Consecuencias

Cada dependencia de calidad tiene un dueno funcional y se puede retirar si su paso desaparece.

Herramientas que solo corren en nightly o en CI (Stryker, dependency drift, schema drift, sintetico) no ralentizan el ciclo diario del desarrollador.

Herramientas que requieren binarios externos (Docker para la BD local) quedan documentadas como requisito en `docs/testing.md`.

Actualizar cualquiera de estas herramientas puede cambiar reglas o salidas. La actualizacion se hace como cambio normal, con `verify:full` verde.
