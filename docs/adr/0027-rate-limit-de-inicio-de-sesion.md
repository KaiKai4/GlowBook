# ADR 0027: Rate limit de inicio de sesión

- **Estado**: Aceptada
- **Fecha**: 2026-10-10

## Contexto

El inicio de sesión con correo y contraseña no tenía límite de intentos en la aplicación. Supabase Auth aplica sus propios límites, pero no protege de forma explícita la ruta de la aplicación ni da una señal propia para contar intentos por IP.

Un límite solo por IP bloquea a todo un grupo cuando comparte salida de red (NAT de una oficina o de un salón): un intento fallido de una persona puede cerrar el acceso a sus compañeros. Los tests E2E también salen desde la misma IP y lo habrían agotado.

Un límite solo por correo tiene el problema contrario: cualquiera que conozca un correo podría bloquear la cuenta ajena a propósito.

## Decisión

Inicio de sesión (`src/app/(auth)/login/actions.ts`) usa dos límites de 15 minutos, definidos en `src/infra/security/rate-limit-policies.ts`:

1. **Global por IP**: `SIGN_IN_IP_POLICY`, 100 intentos cada 15 minutos. Es holgado a propósito para no bloquear una red compartida.
2. **Por IP y correo**: `SIGN_IN_ACCOUNT_POLICY`, 10 intentos cada 15 minutos. El correo se normaliza (recorte y minúsculas) y se guarda solo como hash SHA-256 en la clave del contador, combinado con la IP del cliente.

Orden de comprobación, dentro de `definePublicAction` (`src/app/_composition/define-public-action.ts`):

global por IP → validación de entrada (Zod) → límite por IP y correo → único caso de uso de autenticación.

No se añade un límite solo por correo. Así un atacante no puede bloquear la cuenta de otra persona desde otra IP, y el límite por IP y correo sigue frenando la fuerza bruta contra un correo concreto.

Los contadores se guardan en el almacén compartido de Postgres (ADR 0017), accedido solo desde `src/infra/security/rate-limit.ts`.

Supabase Auth mantiene sus propios límites y protecciones. Este ADR no los sustituye: son una segunda capa.

## Consecuencias

- Un atacante desde una IP fija queda limitado a 10 intentos por correo cada 15 minutos, y a 100 intentos por IP en la misma ventana.
- Una red compartida con muchos usuarios legítimos no se bloquea por el límite global; el límite por cuenta solo afecta al correo que falla repetidamente.
- Un usuario que se equivoca 10 veces seguidas con su correo debe esperar hasta 15 minutos. Es una fricción aceptada.
- Se mantienen las pruebas unitarias de la política y de la acción de inicio de sesión (paso `unit`). Las pruebas E2E no alcanzan el límite por IP porque el global es alto.
- Cambiar los valores es un cambio explícito en `rate-limit-policies.ts` y debe reflejarse en esta ADR.
- Si el almacén de límites falla, el comportamiento sigue siendo el de ADR 0017 (fail-open con `captureError`).
