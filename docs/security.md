# Seguridad Operativa

Fecha: 2026-05-30

## Headers Web

`next.config.ts` define headers base para todo el sitio:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` bloqueando camara, microfono, geolocalizacion y browsing topics
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin` (Fase 2)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (Fase 2)
- `poweredByHeader: false`
- Content-Security-Policy con nonce por request, aplicada en `src/proxy.ts` a
  todas las respuestas, incluidas las redirecciones (Fase 2). Incluye
  `report-uri /api/csp-report` y `report-to csp-endpoint`, y la cabecera
  `Reporting-Endpoints` correspondiente.

## Informes CSP (Fase 2)

`POST /api/csp-report` recibe informes de violacion en `application/csp-report`
(report-uri) y `application/reports+json` (Reporting API). Reglas:

- sin sesion y fuera de la redireccion de auth (`src/proxy-auth.ts`);
- cuerpo limitado a 16 KB, leido en streaming (`src/infra/http/bounded-body.ts`);
- limite anonimo de 30 informes por minuto y IP;
- se valida con Zod y se registra solo directiva, origen bloqueado (sin ruta
  ni query) y ruta del documento (sin query ni fragmento);
- responde 204 sin cuerpo, o 4xx con `no-store`.

## Request Id (Fase 2)

`src/proxy.ts` asigna `x-request-id` a cada request: reutiliza el UUID entrante
si es valido o genera uno nuevo. La cabecera va en la request y en todas las
respuestas. `captureError` incluye el `requestId` cuando hay contexto de request
(`src/infra/observability/request-context.ts`).

Redaccion en observabilidad: ademas de claves sensibles y valores secretos del
entorno, se enmascaran emails (`[email]`) y telefonos de 9 a 15 digitos
(`[telefono]`) dentro de textos. Las fechas (8 digitos) se conservan.

Envio al webhook: timeout de 3 s con `AbortSignal`, programado con `after()` de
`next/server` dentro de una request, sin reintentos. Un fallo se registra en
consola de forma minima (solo el tipo de error, nunca la URL ni el cuerpo).

## Errores Publicos (Fase 2)

Los mensajes que ve el usuario se resuelven con `toPublicErrorMessage` o con
`PublicError` (`src/infra/errors.ts`, ADR 0018). Nunca se muestra SQL, nombres de
tabla, restricciones ni trazas: los SQLSTATE conocidos tienen mensajes fijos y
el resto cae en un mensaje generico registrado con `captureError`.

Los features deben migrar: lanzar `PublicError` para reglas de negocio y usar
`toPublicErrorMessage(error, fallback)` en lugar de `error.message`.

## Validacion Zod (Fase 2)

Todo `src` importa Zod solo desde `@/infra/validation/zod`, adaptador con
`jitless: true` (sin evaluacion dinamica de codigo). La regla
`no-restricted-imports` de `eslint.config.mjs` lo exige.

CSP queda como decision posterior porque GlowBook todavia necesita validar
scripts, estilos, fonts, Supabase Auth y assets del hosting real. Antes de
activar CSP en produccion, probarla en staging con modo report-only.

Decision 2026-06-01:

`next.config.ts` soporta CSP en modo report-only con
`GLOWBOOK_CSP_REPORT_ONLY=true`. El header no se activa por defecto para evitar
romper el deployment actual sin observacion previa. Antes de marcar la fase
como cerrada, activar la variable en staging, redeployar y ejecutar:

```text
npm run security:readiness
```

Ese comando valida headers desplegados y revisa que `SUPABASE_SERVICE_ROLE_KEY`
no aparezca en artefactos publicos/estaticos del build local.

Validacion 2026-06-01:

```text
npm run security:readiness
```

Resultado:

- headers base desplegados presentes;
- `Permissions-Policy` restringe camara, microfono y geolocalizacion;
- `SUPABASE_SERVICE_ROLE_KEY` no aparece en artefactos publicos/estaticos;
- CSP report-only queda pendiente de evaluar en staging despues de activar
  `GLOWBOOK_CSP_REPORT_ONLY=true` y redeployar.

## Service Role

`SUPABASE_SERVICE_ROLE_KEY` solo puede usarse en Adapters server-only aprobados
por `docs/adr/0010-server-only-admin-adapter-exceptions.md`.

Reglas:

- nunca usar `service_role` desde browser;
- nunca importarlo en Server Actions directamente;
- nunca usarlo para saltar permisos normales de Salon;
- registrar acciones Platform sensibles en `platform_audit_log`;
- no loguear tokens, cookies, passwords ni service role.

## Flujos Sensibles

| Flujo | Mitigacion actual | Pendiente operativo |
|---|---|---|
| Login | Supabase Auth + redirects server-side. | Rate limiting en hosting/Supabase si hay abuso. |
| Invitacion de Salon | `requirePlatformAdmin`, use-case Platform, audit log. | Alertas por volumen anormal. |
| Suspension/reactivacion de Salon | `requirePlatformAdmin`, use-case Platform, audit log. | Confirmacion de soporte antes de suspender en produccion. |
| Borrado de Salon | Confirmacion exacta por ID, RPC transaccional, audit log. | Requiere backup reciente antes de ejecutar en produccion. |
| Feature flags de Salon | Platform-only, normalizacion de claves, constraint SQL. | Revisar con soporte antes de desactivar modulos criticos. |
| Feedback moderation | Platform-only, audit log. | Ninguno para MVP. |
| E2E/fixtures | Guards contra production URL. | Secrets de staging configurados en CI. |

## Observability

Decision 2026-05-31:

El Adapter inicial de observability es `src/infra/observability`. Emite eventos y
errores como JSON estructurado a consola, sanitizando claves sensibles. Para el
primer deploy, la estrategia operativa es usar logs del hosting o un log drain
configurado sobre stdout/stderr.

El mismo Adapter puede enviar los mismos payloads sanitizados a un webhook/log
drain configurando:

```text
GLOWBOOK_OBSERVABILITY_WEBHOOK_URL
GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN
```

Validacion 2026-05-31:

- Vercel Logs muestra requests reales `GET 200` en rutas principales.
- Los `GET 307` observados corresponden a redirects esperados de middleware/auth.
- El detalle de Vercel muestra Middleware, Function Invocation y llamadas a
  Supabase.
- En los logs revisados no aparecen `SUPABASE_SERVICE_ROLE_KEY`, tokens,
  cookies completas, passwords ni authorization headers.
- Para mayor retencion o alertas, se puede activar webhook/log drain sin tocar
  Modules de negocio.

Reglas:

- Modules de negocio no deben importar SDKs de proveedores de observability.
- Si se adopta Sentry u otro proveedor, el cambio debe quedar dentro de
  `src/infra/observability`.
- Si se usa webhook/log drain, el token queda server-only y nunca debe llevar
  prefijo `NEXT_PUBLIC_`.
- Antes de produccion, confirmar acceso a Vercel Logs o al log drain elegido.
- No loguear tokens, cookies, passwords, authorization headers ni
  `SUPABASE_SERVICE_ROLE_KEY`.

Validacion 2026-06-01:

```text
npm run observability:readiness
```

El Adapter redacciona metadata sensible y tambien secretos conocidos dentro de
`error.message`, `error.stack` y valores de metadata con claves no sensibles.
El comando paso en modo actual sin webhook obligatorio y
`src/infra/observability/index.test.ts` paso con 3/3 tests.
Para lanzamiento amplio, configurar un proveedor/webhook y activar:

```text
GLOWBOOK_OBSERVABILITY_REQUIRE_WEBHOOK=true
```

Con esa variable, el gate falla si no puede enviar un evento sintetico al
destino configurado.

Para exigir alertas minimas y retencion antes de lanzamiento amplio:

```text
GLOWBOOK_OBSERVABILITY_REQUIRE_ALERTS=true
GLOWBOOK_OBSERVABILITY_ALERT_5XX=<decision>
GLOWBOOK_OBSERVABILITY_ALERT_SUPABASE_ERRORS=<decision>
GLOWBOOK_OBSERVABILITY_ALERT_PLATFORM_ERRORS=<decision>
GLOWBOOK_OBSERVABILITY_ALERT_LATENCY=<decision>
GLOWBOOK_OBSERVABILITY_RETENTION_DAYS=<dias>
```

Estas variables son evidencia operativa; no cambian la Interface del Adapter ni
obligan a importar SDKs externos desde los Modules de negocio.

## Rate Limiting

Implementado en Fase 2 (ADR 0017): contador compartido en Postgres
(`rate_limit_buckets` + RPC `consume_rate_limit`, solo `service_role`), accedido
solo desde `src/infra/security/rate-limit.ts`. Fallo del almacen: fail-open con
`captureError`. La firma es asincrona:

```ts
await assertActionRateLimit(userId, scope, { max, windowMs });
await assertAnonymousRateLimit(scope, { max, windowMs });
```

Llamadores que deben migrar (`src/app/**`, fuera de esta fase): anadir `await`
a cada `assertActionRateLimit(...)` (actions.ts de appointments, customers,
employees, expenses, feedback, inventory, retail, salon, services). Sin `await`,
`result.ok` no existe y TypeScript lo rechaza.

El texto siguiente es la decision original del MVP, conservada como historia:

Decision actual para MVP:

- usar controles del hosting para rutas publicas si hay abuso;
- usar Supabase Auth protections para login;
- no introducir un Adapter propio hasta tener senales reales de abuso.

Si aparece abuso antes del lanzamiento, crear un Adapter dedicado en
`src/infra/security/rate-limit.ts` y aplicarlo primero a login, invitaciones y operaciones
Platform destructivas.

Decision para lanzamiento amplio:

- revisar rate limiting del hosting para `login`, `invite`, `join`, feedback y
  operaciones Platform;
- revisar limites de Supabase Auth antes de campanas publicas;
- mantener un Adapter propio en `src/infra/security/rate-limit.ts` como Seam futura solo si
  los controles del proveedor no alcanzan;
- registrar la decision en `docs/production-scale-readiness-checklist.md`.

Gate:

```text
npm run rate-limit:readiness
```

El gate valida que las rutas publicas y operaciones sensibles esten
documentadas. Para exigir confirmacion real de proveedor antes de lanzamiento
amplio, activar:

```text
GLOWBOOK_RATE_LIMIT_REQUIRE_PROVIDER_CONFIRMATION=true
GLOWBOOK_RATE_LIMIT_PROVIDER=<vercel|supabase|waf|custom>
GLOWBOOK_RATE_LIMIT_LOGIN=<decision>
GLOWBOOK_RATE_LIMIT_INVITATIONS=<decision>
GLOWBOOK_RATE_LIMIT_FEEDBACK=<decision>
GLOWBOOK_RATE_LIMIT_PLATFORM=<decision>
```

## CSP Y Secrets

Antes de lanzamiento amplio:

1. Probar CSP en staging con `GLOWBOOK_CSP_REPORT_ONLY=true`.
2. Confirmar que Supabase Auth, estilos, fonts y assets reales no se rompen.
3. Confirmar que `SUPABASE_SERVICE_ROLE_KEY` no aparece en bundle cliente,
   Vercel Logs, log drain ni errores capturados.
4. Rotar secrets si fueron compartidos en screenshots, chats, logs o entornos
   no confiables.
5. Mantener `PRODUCTION_SUPABASE_URL` configurado para bloquear scripts contra
   production.

Gate operativo:

```text
npm run security:readiness
```

Para exigir confirmacion de CSP/rotacion/log scan antes de lanzamiento amplio:

```text
GLOWBOOK_SECURITY_REQUIRE_OPERATION_CONFIRMATION=true
GLOWBOOK_SECURITY_OWNER=<responsable>
GLOWBOOK_SECURITY_CSP_REPORT_REVIEWED=<decision>
GLOWBOOK_SECURITY_SECRET_ROTATION_STATUS=<rotated|scheduled|not-needed>
GLOWBOOK_SECURITY_LOG_SECRET_SCAN=no-secrets-found
```

`GLOWBOOK_SECURITY_LOG_SECRET_SCAN` debe quedar en `no-secrets-found` solo
despues de revisar Vercel Logs o el log drain elegido.

Decision conservadora 2026-06-01:

- Para piloto y crecimiento controlado, se acepta la seguridad base validada por
  `npm run security:readiness`: headers desplegados y ausencia de
  `SUPABASE_SERVICE_ROLE_KEY` en artefactos publicos.
- Antes de campanas publicas masivas, se debe activar o confirmar rate limits,
  probar CSP report-only y revisar/rotar secrets si fueron compartidos o
  expuestos.

## Auditoria De Dependencias Y Secretos

Decision de la fase 1 del plan de calidad. Politica completa en
`docs/adr/0015-politica-excepciones-auditoria.md`.

Controles que corren en `npm run verify:full` (y en CI, job `static`):

| Paso | Que comprueba |
|---|---|
| `secrets` | secretlint sobre archivos de git rastreados y no ignorados. Corre tambien en el hook `pre-commit`. |
| `audit-prod` | `npm audit --omit=dev`. Cualquier aviso falla el gate. Produccion no admite excepciones. |
| `audit-all` | `npm audit` completo. Solo acepta avisos cubiertos por una excepcion vigente. |
| `sbom` | SBOM CycloneDX de produccion en `.quality/sbom.json` (job `sbom` de CI). |

Excepciones de auditoria:

- Viven en `security/audit-exceptions.json`, un array de objetos con los campos
  `advisory`, `package`, `owner`, `reason`, `mitigation`, `created` y `expires`.
  Todos son obligatorios y no pueden estar vacios.
- Solo se admiten para paquetes que no estan en el arbol de produccion.
- Duracion maxima de 30 dias. Una excepcion expirada o que ya no corresponde a
  ningun aviso falla el gate.
- Una excepcion no se amplia: si el aviso sigue abierto al expirar, se resuelve
  la causa o se abre un registro nuevo con su propia justificacion.

Secretos:

- `SUPABASE_SERVICE_ROLE_KEY`, tokens y claves de terceros no se escriben en el
  repositorio. secretlint (preset recommend) revisa patrones conocidos antes de
  commit y en CI; no sustituye la revision humana ni la rotacion de claves
  expuestas.
- Las pruebas de integracion usan Supabase local y no leen `.env.local`
  (`docs/adr/0014-bd-de-pruebas-supabase-local.md`).
- Si secretlint reporta un falso positivo, se corrige el origen (por ejemplo,
  mover el valor a una variable de entorno de prueba generada). No se anade una
  exclusion a la configuracion de secretlint sin revision.
