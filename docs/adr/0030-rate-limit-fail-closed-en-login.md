# ADR 0030: Rate limit fail-closed en el inicio de sesión

- **Estado**: Aceptada
- **Fecha**: 2026-10-10

## Contexto

El rate limit compartido (ADR 0017) es fail-open: si la RPC `consume_rate_limit` falla o devuelve una decisión vacía, la operación se permite y el error se registra con `captureError`. Esa elección protege la operación del salón ante una caída de la base, pero deja sin freno la fuerza bruta contra el inicio de sesión (ADR 0027) mientras dure la caída. Un atacante que pudiera provocar o aprovechar un fallo del almacén tendría intentos ilimitados de contraseña.

## Decisión

1. `RateLimitOptions` admite `failMode: "open" | "closed"`. Por defecto es `"open"`, así que el comportamiento de todas las demás acciones no cambia.
2. Con `"closed"`, si el almacén falla se devuelve un error fijo ("No podemos comprobar tus intentos ahora...") y la operación se rechaza. El mensaje de la base nunca llega al usuario (ADR 0018).
3. Las dos políticas de inicio de sesion de ADR 0027 (`SIGN_IN_IP_POLICY` y `SIGN_IN_ACCOUNT_POLICY` en `src/infra/security/rate-limit-policies.ts`) usan `failMode: "closed"`.
4. Todo fallo del almacén se registra con `captureError` y los metadatos `failMode` y `severity: "high"`, para que sea observable y pueda alertar.

El resto de límites (acciones de uso normal, invitaciones, recuperación de contraseña, reportes CSP) siguen fail-open.

## Consecuencias

- Si la base cae, el inicio de sesión queda bloqueado mientras dure la caída. Es la contrapartida aceptada: sin el contador no se puede garantizar el freno de fuerza bruta.
- Supabase Auth sigue aplicando sus propios límites durante la caída de la base de la aplicación, aunque el límite de la aplicación no esté disponible.
- Las pruebas cubren ambos modos en `src/infra/security/rate-limit.fail-mode.test.ts`, y la política de inicio de sesión queda fijada en `rate-limit-policies.test.ts`.
- Esta ADR matiza ADR 0017 y ADR 0027 solo para el inicio de sesión. No cambia el resto de decisiones de ADR 0017.
