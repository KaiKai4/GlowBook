# ADR 0029: Result en casos de uso, throw solo en domain y data

- **Estado**: Aceptada. Complementa [ADR 0018](0018-errores-publicos-tipados.md) (no lo sustituye: sus reglas de mensajes públicos siguen vigentes).
- **Fecha**: 2026-10-10

## Contexto

ADR 0018 fijó qué mensaje ve el usuario: `PublicError` o un mensaje fijo revisado, y nunca `error.message` de Postgres, PostgREST, red o trazas. No fijó dónde se captura la excepción. Como resultado, los casos de uso mezclaban dos estilos: algunos devolvían `Result` y otros lanzaban `throw new` directamente, y el llamador tenía que adivinar qué llegaba. El diagnóstico encontró cuatro casos de uso con `throw new` fuera de los tests.

## Decisión

1. **Los casos de uso (`src/features/*/use-cases/**`, sin contar tests) devuelven siempre `Result`** (`src/infra/result.ts`). No lanzan excepciones hacia el llamador.
2. **`domain/` y `data/` pueden lanzar.** `domain/` lanza `PublicError` cuando una regla de negocio falla; `data/` deja pasar el error técnico del adaptador Supabase. Ninguna de las dos capas conoce el `Result` ni el mensaje que ve el usuario.
3. **El caso de uso convierte la excepción con `toResult(fn, { fallback, context })`** (`src/infra/to-result.ts`):
   - `PublicError`: `err(error.message)`, sin registro.
   - Cualquier otro error: se decide el texto con `toPublicErrorMessage(error, fallback)` (ADR 0018). Si el texto cae en el `fallback`, el error se registra con `captureError` y el `context` del caso de uso.
4. **Desviación respecto a `result.ts`**: `toResult` no va en `src/infra/result.ts` porque ese archivo debe seguir puro (solo los constructores `ok`/`err` y los tipos). `domain-pure` admite importar `infra/result`, y si `result.ts` importara observabilidad o errores, el dominio arrastraría dependencias de infraestructura. Por eso `toResult` vive en un archivo propio, `src/infra/to-result.ts`.
5. **Invariantes internas: `requireInvariant(value, message)`** (`src/infra/invariant.ts`). Es la única forma aceptada de comprobar un dato que el propio caso de uso garantiza (por ejemplo, una semana con 7 días). Lanza un `Error` técnico con un `throw` dentro del helper, así que ESLint `ThrowStatement` no lo ve en el caso de uso. Ese `Error` nunca llega al usuario: se envuelve siempre en `toResult` del mismo caso de uso, que lo convierte en `err(fallback)` y lo registra. Un caso de uso no debe usar `requireInvariant` fuera de un `toResult`.
6. **Control**: regla ESLint `no-restricted-syntax` que prohíbe `ThrowStatement` en `src/features/*/use-cases/**` salvo en `*.test.ts` (`eslint.config.mjs`). `src/infra/to-result.ts` e `invariant.ts` están fuera de esa carpeta y no necesitan excepción. Las pruebas de `to-result.test.ts` e `invariant.test.ts` (paso `unit`) y las pruebas de conducta de los casos de uso que cruzan `toResult` (`get-calendar-view.failure.test.ts`, `get-operational-report.failure.test.ts`, `prepare-appointment-items.invariant.test.ts`).

## Consecuencias

- Los llamadores de un caso de uso comprueban `result.ok` en lugar de usar `try/catch`. Las Server Actions ya siguen este patrón (`defineAction`).
- Un error técnico registra dos entradas en observabilidad: la de `toPublicErrorMessage` (módulo `errors`) y la del caso de uso (con su módulo y acción). Es un coste aceptado para no perder el contexto del caso de uso.
- Un `throw` nuevo en un caso de uso lo rechaza ESLint. Si una regla de negocio necesita abortar, se lanza `PublicError` desde `domain/` y `toResult` lo convierte.
- **Cambio de conducta, validación de categoría**: `validateServiceCategory` devuelve `Result`. Un fallo técnico de la consulta de categoría ya no muestra el mensaje genérico de creación ("Error al crear el servicio."), sino `No se pudo validar la categoría del servicio.`, y se registra con el contexto `services / validate-service-category`. Es intencionado: el mensaje indica el paso que falló y es el mismo para crear y actualizar. El `try/catch` de `createCatalogService` y `updateCatalogService` sigue cubriendo la escritura posterior.
- **Presentación de carga fallida en `src/app`**: las páginas de citas y reportes no pintan el mensaje en línea. Si `getCalendarView` o `getOperationalReport` devuelven `err`, la página lanza `Error` con el mensaje público y lo recoge el error boundary de la ruta, como antes de este ADR. La prueba `appointments/page.test.tsx` cubre la rama de error.
