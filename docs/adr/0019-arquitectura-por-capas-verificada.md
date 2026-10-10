# ADR 0019: Arquitectura por capas verificada por herramienta

## Estado

Aceptada. Modificada parcialmente por ADR 0028 (reglas de capas de la fase 2). Supera parcialmente a ADR 0009 (reglas de capas y verificación), a ADR 0010 (mecanismo de control de importadores de `service_role`) y a ADR 0013 (trinquetes de tamaño, tokens y violaciones de grafo). Ver las secciones "Relación con otros ADR" y el índice de `docs/adr/README.md`.

## Contexto

GlowBook es un monolito modular con módulos de negocio en `src/features/<modulo>`, infraestructura compartida en `src/infra` y rutas, acciones y UI en `src/app` y `src/components`.

Hasta esta decisión, la arquitectura se sostenía en tres cosas frágiles:

- Reglas escritas en documentos (ADR 0009) que solo se comprobaban con revisión humana.
- Un archivo de violaciones heredadas (`.dependency-cruiser-known-violations.json`) que congelaba deuda de grafo y se usaba con `--ignore-known`. Cada violación congelada era una excepción silenciosa.
- Trinquetes de tamaño y tokens (baselines versionadas en el directorio de calidad) que permitían archivos grandes y clases crudas mientras no subieran.

Con esa combinación, una dependencia nueva que rompía una capa podía pasar si se añadía a una lista, y el grafo podía tener ciclos sin que ningún control lo viera como error de capa. La deuda estaba congelada, no pagada.

Las violaciones de grafo, los ciclos y las excepciones de `service_role` se han eliminado en el código: `depcruise` sin baseline termina con cero violaciones sobre `src/`.

## Decisión

La arquitectura tiene cuatro capas. Cada regla está expresada por patrón de ruta en `.dependency-cruiser.cjs` y se comprueba en el paso `architecture`. No hay listas de archivos ni excepciones por archivo.

### Capas

| Capa | Ruta | Puede depender de | No puede depender de |
|---|---|---|---|
| Infraestructura transversal | `src/infra/**` (supabase, auth, observability, security, validation, http, errors, result, format, events, effects, idempotency) | `next/headers`, `next/cache`, paquetes npm de servidor | `src/features`, `src/app`, `src/components`, `react`, `react-dom` |
| Módulo: dominio | `src/features/<mod>/domain/**` | Funciones puras y tipos propios | `next`, `react`, `@supabase/*`, `server-only`, `use-cases`, `data`, `src/app`, `src/components`, `src/infra/supabase` |
| Módulo: datos | `src/features/<mod>/data/*.repo.ts` | `src/infra`, su propio dominio, tipos generados | `use-cases`, `src/app`, `src/components`, React. Sin decisiones de negocio |
| Módulo: orquestación | `src/features/<mod>/use-cases/**` | Su dominio, su `data`, `src/infra`, `schemas.ts` | React, `src/components`, `src/app`, `next/navigation`. Recibe el contexto por parámetro |
| Presentación | `src/app/**`, `src/components/**` | Casos de uso (vía índice), `src/infra` (tipos), `src/app/_composition` | Cliente de BD en runtime (solo `import type`) |

Los tests (`*.test.ts(x)`, e2e, `src/test`) quedan fuera de estas reglas.

### Módulos y acceso público

Cada módulo de `src/features/<mod>` tiene `domain/`, `data/`, `use-cases/`, `schemas.ts` e `index.ts`.

- `index.ts` es la única interfaz pública del módulo. Otro módulo solo importa de `src/features/<otro>/index.ts` o de `"@/features/<otro>"`. La regla `cross-module-via-index` lo comprueba.
- Un módulo puede importar sus propios archivos internos sin pasar por `index.ts`.
- Las importaciones de `src/app` y `src/components` apuntan a los índices, no a `data/` ni a `domain/` de otro módulo.

### Composition root

`src/app/_composition/**` es el único sitio de presentación que lee la sesión y construye el `RequestContext`:

- `request-context.ts` memoiza el contexto por petición con `react cache` y lo entrega a rutas y acciones.
- `define-action.ts` implementa el pipeline de toda Server Action: contexto, permiso por clave, rate limit, validación, una única llamada a un caso de uso y revalidación.

Las acciones de presentación son finas: no leen la sesión por su cuenta, no deciden permisos por nombre de rol y no contienen reglas de negocio. Los casos de uso no leen sesión ni estado global; reciben el contexto por parámetro. Así la lógica de negocio sigue siendo testeable sin Next.

### Rupturas de ciclos

El grafo no admite ciclos entre módulos (`no-circular`). Los ciclos existentes se rompieron:

- la lectura de sesión se movió al composition root (`src/app/_composition`), que es el único sitio que construye el `RequestContext` (commit `f51bcdf`);
- las dependencias entre módulos pasaron por el índice público de cada uno (`index.ts`), y los datos que antes se leían por dentro se pasan por parámetro (commit `b8460ec`).

### Mapa de código

`scripts/quality/code-map.mjs` genera `docs/code-map/modules.mmd` (diagrama Mermaid, un nodo por módulo, agrupado por capa) y `docs/code-map/graph.json` (el mismo grafo reducido a módulos) a partir de `dependency-cruiser`.

El paso `code-map` (`--check`) falla si los archivos versionados no coinciden con lo regenerado. Para consultar el mapa, leer `docs/code-map/modules.mmd` o `graph.json`; para regenerarlo, ejecutar `node scripts/quality/code-map.mjs`.

### Controles absolutos

No hay baseline para tokens de diseño, tamaño de módulos ni violaciones de grafo:

- `dependency-cruiser` sobre `src/` no admite `--ignore-known`. El paso `architecture` falla con cualquier violación.
- `check-module-size.mjs` falla con cualquier archivo de producción de `src/` o `scripts/` por encima de 300 líneas. La única excepción permanente es `src/types/database.types.ts` (generado por Supabase), declarada en `quality/module-size-exceptions.json`.
- `check-design-tokens.mjs` falla con cualquier clase de paleta cruda, color literal, tamaño o peso fuera de escala en `src/`.
- `src/infra/architecture-boundaries.test.ts` afirma las invariantes de capas con la API de dependency-cruiser (`infra` no sube a `features`, `app`, `components`, React ni React-DOM; el dominio no depende de Next, React ni Supabase). Se ejecuta en el proyecto `unit` de Vitest.

Si una comprobación falla, se corrige el código: se divide el archivo, se usa el token semántico o se mueve la dependencia por el índice público. Congelar el hallazgo no es una opción.

### Por qué no hay lista de excepciones

Una lista de violaciones conocidas es una excepción sin dueño y sin fecha: no distingue deuda que se va a pagar de deuda que se va a quedar. Con cualquier lista, una dependencia nueva puede esconderse añadiéndola a ella, y la regla deja de proteger.

Las excepciones que sí son legítimas se tratan como decisiones:

- Un tipo generado (`src/types/database.types.ts`) no lo edita nadie. Su excepción es permanente, justificada y revisable en `quality/module-size-exceptions.json`.
- Un cliente privilegiado (`service_role`) se permite solo desde las capas declaradas en ADR 0010. La regla `admin-client-boundary` expresa esa frontera por patrón (`src/infra` o `features/*/data`), no con una lista de archivos.
- Una excepción nueva de capa exige un ADR nuevo que la justifique y, si hace falta, cambia la regla por patrón. Nunca se añade una ruta a una lista para que pase el control.

## Consecuencias

Beneficios:

- Una violación de capa, un ciclo o un archivo grande falla el verificador local y CI sin excepciones previas.
- La frontera `service_role` y los límites de presentación se leen en `.dependency-cruiser.cjs`, no en una lista de archivos que hay que mantener.
- El mapa de código se mantiene sincronizado con el grafo real: cualquier cambio de dependencias obliga a regenerarlo.
- La lógica de negocio sigue siendo testeable sin Next ni Supabase, porque los casos de uso reciben el contexto por parámetro.

Costes y cuidados:

- Cualquier refactor que mueva un archivo entre módulos debe usar `git mv` y actualizar los imports por el índice público. Para reescrituras masivas se usan codemods en `.quality/codemods/`, verificados con `tsc`.
- Un archivo nuevo que supere 300 líneas falla el control de tamaño desde el primer commit. Hay que dividirlo por responsabilidad; no hay trinquete que lo absorba.
- Si el grafo cambia (un módulo nuevo, un import nuevo), `docs/code-map/` debe regenerarse en el mismo cambio. El paso `code-map` lo exige.
- El control de capas no sustituye a la revisión de diseño: una dependencia permitida por el patrón puede seguir siendo mala. La regla garantiza solo las fronteras que expresa.

## Relación con otros ADR

- **ADR 0009** (modular monolith): su estructura de carpetas y su vocabulario siguen vigentes. Se supera la parte de reglas de capa y de verificación: las reglas ahora se comprueban con `dependency-cruiser` por patrón, y los índices públicos y la composition root son obligatorios.
- **ADR 0010** (excepciones `service_role`): la frontera se hace cumplir por patrón con la regla `admin-client-boundary`: solo `src/infra` y `src/features/*/data` pueden importar los clientes admin. La lista de archivos autorizados de ADR 0010 deja de estar en una herramienta. Es documentación y se revisa en code review; cualquier archivo nuevo de `features/*/data` que use `service_role` debe justificarse en ADR 0010. `scripts/check-architecture.mjs` sigue vigente para sus reglas propias (módulos vacíos, presentación sin datos de `data/`).
- **ADR 0013** (trinquetes): se retiran los trinquetes de tokens de diseño, de tamaño de módulos y de violaciones de grafo, con `--ignore-known` incluido. El trinquete de cobertura (`quality/coverage-baseline.json`) sigue vigente.
