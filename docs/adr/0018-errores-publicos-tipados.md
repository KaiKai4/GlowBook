# ADR 0018: Errores públicos tipados

## Estado

Aceptada.

## Contexto

Los use-cases y las server actions devolvían mensajes de error construidos a partir de `error.message`. Eso exponía al usuario texto interno: mensajes de Postgres/PostgREST (nombres de tablas, restricciones, SQL), mensajes de red y trazas. Además, la función `getErrorMessage` aceptaba cualquier valor, así que no había forma de distinguir un mensaje pensado para el usuario de un fallo interno.

## Decisión

Los mensajes que puede ver el usuario son de dos tipos explícitos:

1. **`PublicError`** (`src/infra/errors.ts`): error lanzado a propósito desde un use-case cuando una regla de negocio falla. Su mensaje es apto para el usuario y puede llevar un `code` opcional para la lógica del llamador.
2. **Mensajes fijos o revisados**: cualquier otro error pasa por `toPublicErrorMessage(error, fallback)`, que decide así:
   - `PublicError`: su mensaje.
   - SQLSTATE mapeado (`23505`, `23503`, `23P01`, `22P02`): un mensaje fijo en español.
   - SQLSTATE `P0001`, `22023` y `42501` (RAISE propios de nuestras migraciones): su mensaje, solo si tiene 300 caracteres o menos, una línea, y no contiene detalles internos (palabras como `policy`, `table`, `violates`, `select`, o `public.`/`auth.`). Así un error de RLS (`42501`) con el nombre de la tabla nunca llega al usuario.
   - Cualquier otro error: el `fallback` y el error original registrado con `captureError`.

Toda ruta de error de SQL interno, de red o genérico termina en el `fallback`. Nunca se devuelve SQL, nombres de tabla, de restricción ni trazas.

`getErrorMessage` se conserva solo mientras tenga consumidores (`inventory-movements.ts` y `retail-sales.ts` en la fase actual). Cuando esos módulos migren a `toPublicErrorMessage`, debe eliminarse.

## Consecuencias

- Un fallo nuevo de base de datos que no esté en la lista muestra el `fallback` genérico. Es intencionado: el usuario no debe ver detalles internos, y el error queda registrado para diagnóstico.
- Los errores de dominio que hoy se devuelven como strings deben lanzarse como `PublicError` en los use-cases (migración en `src/features/**`, fuera de este ADR).
- La lista de patrones internos es conservadora: un mensaje de dominio que contenga una palabra técnica en inglés se sustituye por el `fallback`. Es preferible a filtrar un detalle interno.
- Los tests de `src/infra/errors.test.ts` son la tabla de casos que demuestra que no sale SQL, nombres de tabla ni trazas.
