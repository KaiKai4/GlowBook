# ADR 0017: Rate limit compartido en Postgres

## Estado

Aceptada.

## Contexto

El rate limit anterior (`src/infra/security/rate-limit.ts`) guardaba los contadores en un `Map` de memoria. En Vercel cada instancia serverless tiene su propio mapa, así que el límite real era "por instancia": un atacante que golpeara varias instancias (o una instancia fría) superaba el límite sin esfuerzo. Además el límite de fuerza bruta sobre `/invite/[token]` y `/join/[token]` dependía de qué instancia recibiera la petición.

Las alternativas evaluadas fueron:

- **Mantener el `Map` en memoria**: cero infraestructura, pero el límite no es real en serverless. Descartada.
- **Upstash Redis (u otro KV externo)**: límite real y compartido, pero añade un proveedor, una credencial nueva, una dependencia de latencia en cada acción y un nuevo punto de fallo fuera de la base de datos que ya usamos. Como el SaaS ya depende de Supabase para toda la persistencia, un proveedor adicional no compensa el coste en esta fase.
- **Contador en Postgres con una RPC atómica**: reutiliza la base existente, el contador se incrementa en una sola sentencia (`insert ... on conflict do update`) sin condiciones de carrera y es auditable en SQL. Coste: una llamada a la base por acción limitada.

## Decisión

El contador vive en la tabla `public.rate_limit_buckets` (RLS activada, sin políticas: nadie la lee ni escribe fuera de la RPC). La RPC `public.consume_rate_limit(p_key, p_max, p_window_seconds)` es `security definer`, valida sus argumentos (clave de 1 a 200 caracteres, máximo positivo, ventana de 1 a 86 400 s), limpia como mucho 100 filas expiradas por llamada y devuelve `allowed` y `retry_after_seconds`. Solo `service_role` puede ejecutarla (migración `20240101000064_security_hardening.sql`).

La aplicación la invoca únicamente desde `src/infra/security/rate-limit.ts` mediante el cliente admin (`src/infra/supabase/admin.ts`). La excepción a ADR 0010 se declara por capa: la regla `admin-client-boundary` de `.dependency-cruiser.cjs` permite importar los clientes admin desde `src/infra/`, no archivos concretos (ADR 0019).

API pública (asíncrona, debe llamarse con `await`):

```ts
assertActionRateLimit(userId: string, scope: string, options?: RateLimitOptions): Promise<Result<void>>
assertAnonymousRateLimit(scope: string, options?: RateLimitOptions): Promise<Result<void>>
```

Reglas:

- **Clave**: `user:<id>:<scope>` para acciones autenticadas e `ip:<ip>:<scope>` para anónimas. Se normaliza a `[A-Za-z0-9:._-]`; si la clave supera 200 caracteres se sustituye por `sha256:<hash>`.
- **IP**: en Vercel la plataforma reescribe `x-forwarded-for`, así que se prefiere `x-real-ip` y, después, el primer valor de `x-forwarded-for`. Sin ninguna de las dos cabeceras la clave es `ip:unknown`: todos los clientes sin IP comparten ese bucket (documentado como límite conocido).
- **Fallo del almacén: fail-open.** Si la RPC falla o devuelve una decisión vacía, la operación se permite y el error original se registra con `captureError`. Se elige porque un fallo de la base no debe bloquear la operación del salón. La fuerza bruta sobre tokens de invitación queda cubierta por la entropía del token (ver `invitation-tokens.ts`), no por este límite; el límite anónimo es una defensa de segunda línea.
- **Ventana**: `windowMs` se convierte a segundos redondeando hacia arriba y se acota a [1, 86 400].

## Consecuencias

- El límite es real y compartido entre instancias; el coste es una llamada a Postgres por acción limitada. Vigilar la latencia en producción.
- `rate_limit_buckets` crece con claves únicas (por IP y por usuario). La RPC purga como mucho 100 filas expiradas por llamada; con poco tráfico la tabla puede acumular filas hasta que llegue tráfico suficiente. Si crece más de lo previsto, añadir un job de purga periódica.
- La decisión fail-open implica que una caída de la base elimina el límite mientras dure. Queda registrada en observabilidad (`module: security`, `action: rate-limit`).
- Los llamadores existentes deben añadir `await` (ver lista en `docs/security.md`). Sin él, `result.ok` es `undefined` y TypeScript lo rechaza en compilación.
- `count` es `bigint`: squawk exige `bigint` en tablas nuevas (`prefer-bigint-over-int`).
- Si la IP no llega (cabecera ausente), la clave es `ip:unknown`. Todas esas peticiones comparten un bucket, así que el límite propio para esa clave es un máximo ×10 del límite pedido, para no dejar sin límite a los clientes sin IP ni bloquear a todos a la vez. Cada caso emite un aviso estructurado `rate_limit_unknown_ip` (`console.warn` en JSON) para detectar si la cabecera de IP falla en producción.
