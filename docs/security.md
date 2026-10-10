# Seguridad Operativa

Última revisión: 2026-10-10

## Mapa De Controles

Resumen de qué protege cada control y dónde se comprueba. La política de reporte de vulnerabilidades está en `SECURITY.md`.

| Área | Control | Dónde se comprueba |
|---|---|---|
| Aislamiento entre salones | RLS en Postgres como autoridad final (ADR 0001) y `public.salon_id()` desde el claim del JWT. | Pruebas pgTAP `supabase/tests/01_tenant_isolation.sql` (paso `db-tests`) y E2E `e2e/multi-tenant-isolation.spec.ts` (paso `e2e`). |
| Permisos | Permisos globales y roles por salón (ADR 0003). Se comprueba `has_permission`, nunca el nombre del rol. | `supabase/tests/02_permissions_and_hook.sql`, `src/features/access/domain/permission-checks.test.ts`. |
| Plataforma | Área `/admin` protegida por `is_platform_admin()`. Alta de salones solo por invitación (ADR 0005). | Pruebas de integración y E2E `e2e/platform-admin.spec.ts`. |
| Cliente `service_role` | Solo en servidor, tras verificar superadmin, y solo desde `src/infra` o `features/*/data` (regla `admin-client-boundary`; ADR 0010). Nunca en navegador ni en variables `NEXT_PUBLIC_*`. Las lecturas y escrituras de billing de plataforma exigen `PlatformAdminProof` como primer parámetro (ADR 0028): solo `requirePlatformAdminProof` (composition root) la emite, y la regla `platform-admin-proof-issuer` impide importarla en runtime fuera de `src/app/_composition` y `src/infra/auth`. | Paso `architecture`, paso `bundle-secrets` y `src/infra/architecture-boundaries.test.ts`. |
| Secretos | Ningún secreto en el repositorio. Escaneo sobre archivos rastreados por git. | Paso `secrets` (secretlint), también en `pre-commit`. |
| Dependencias | Producción sin avisos de auditoría y sin excepciones. Desarrollo con excepciones con caducidad (ADR 0015). | Pasos `audit-prod` y `audit-all`, `security/audit-exceptions.json`. |
| Cabeceras web | Cabeceras estáticas en `next.config.ts` y paso E2E de cabeceras. | `e2e/security-headers.spec.ts`, sección "Headers Web". |
| CSP | Content-Security-Policy con nonce por petición en `src/proxy.ts` y `src/infra/security/csp.ts`, con endpoint de informes. | Sección "Informes CSP" y "CSP Y Secrets". |
| Rate limit | Contador compartido en Postgres (`rate_limit_buckets`, RPC `consume_rate_limit`, solo `service_role`) desde `src/infra/security/rate-limit.ts` (ADR 0017). | `supabase/tests/05_rate_limit.sql`, sección "Rate Limiting". |
| Errores públicos | Solo `PublicError` o mensajes revisados llegan al usuario. Nunca se muestran detalles de Postgres, PostgREST o trazas (ADR 0018). | `src/infra/public-error.ts` y su prueba. |
| Idempotencia | Las escrituras críticas usan `idempotency_key` y no duplican efectos. | `supabase/tests/06_idempotency.sql` (paso `db-tests`). |
| Validación de entradas | Zod en el borde de cada entrada (Server Action, route handler, use-case). | `schemas.ts` de cada módulo y sus pruebas. |
| Migraciones | Forward-only, sin `RENAME`, `TRUNCATE` ni `DELETE` sin `WHERE` (ADR 0016). | Paso `migrations-lint`. |

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

## Rutas /api Sin Sesion

Las llamadas a `/api/*` sin sesion responden `401` con cuerpo JSON y `no-store`. Nunca redirigen a una pagina HTML de login (`src/proxy.ts`, `src/proxy-auth.ts`).

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

Activación de CSP en modo report-only: `next.config.ts` soporta `GLOWBOOK_CSP_REPORT_ONLY=true`. El header no se activa por defecto. Para evaluarla, activa la variable en un despliegue no público, revisa en los informes de `/api/csp-report` que Supabase Auth, estilos, fuentes y assets no se bloquean, y solo entonces decide su paso a modo enforce.

## Service Role

`SUPABASE_SERVICE_ROLE_KEY` solo puede usarse en Adapters server-only aprobados
por `docs/adr/0010-server-only-admin-adapter-exceptions.md`.

Reglas:

- nunca usar `service_role` desde browser;
- nunca importarlo en Server Actions directamente;
- nunca usarlo para saltar permisos normales de Salon;
- registrar acciones Platform sensibles en `platform_audit_log`;
- no loguear tokens, cookies, passwords ni service role.

## Variables De Entorno

Las variables de entorno se validan con Zod en `src/infra/config/env.ts` al usarse, no al importar el modulo, y no tienen valores por defecto. Si falta una variable requerida, el error indica cual falta sin mostrar su valor. Los secretos siguen fuera del repositorio.

## Flujos Sensibles

| Flujo | Mitigacion actual | Pendiente operativo |
|---|---|---|
| Login | Supabase Auth + redirects server-side. | Rate limiting en hosting/Supabase si hay abuso. |
| Invitacion de Salon | `requirePlatformAdmin`, use-case Platform, audit log. | Alertas por volumen anormal. |
| Suspension/reactivacion de Salon | `requirePlatformAdmin`, use-case Platform, audit log. | Confirmacion de soporte antes de suspender en produccion. |
| Borrado de Salon | Confirmacion exacta por ID, RPC transaccional, audit log. | Requiere backup reciente antes de ejecutar en produccion. |
| Feature flags de Salon | Platform-only, normalizacion de claves, constraint SQL. | Revisar con soporte antes de desactivar modulos criticos. |
| Feedback moderation | Platform-only, audit log. | Ninguno para MVP. |
| E2E/fixtures | Guards contra production URL. | Secretos del Supabase local de CI; nunca producción. |

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

Revisión de logs de 2026-05-31:

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

El Adapter redacciona metadata sensible y también secretos conocidos dentro de `error.message`, `error.stack` y valores de metadata con claves no sensibles. La cobertura de esa regla está en `src/infra/observability/index.test.ts`.

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

Politica de inicio de sesion (ADR 0027), en `src/infra/security/rate-limit-policies.ts`:

- limite global por IP: 100 intentos cada 15 minutos (`SIGN_IN_IP_POLICY`), holgado para no bloquear redes con NAT compartido;
- limite por IP y correo normalizado (hash SHA-256 en la clave): 10 intentos cada 15 minutos (`SIGN_IN_ACCOUNT_POLICY`).

Se comprueba primero el global, despues la validacion y despues el limite por correo. No hay limite solo por correo, para que nadie pueda bloquear la cuenta de otra persona.

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
- registrar la decision en el ADR 0017 o en uno nuevo.


## CSP Y Secrets

Antes de ampliar el tráfico público:

1. Probar la CSP en modo report-only (`GLOWBOOK_CSP_REPORT_ONLY=true`) y confirmar que Supabase Auth, estilos, fuentes y assets no se rompen.
2. Confirmar que `SUPABASE_SERVICE_ROLE_KEY` no aparece en el bundle cliente, en los logs de Vercel, en el log drain ni en errores capturados. El paso `bundle-secrets` del verificador comprueba los artefactos públicos.
3. Rotar secretos si fueron compartidos en capturas, chats, logs o entornos no confiables.
4. Mantener `PRODUCTION_SUPABASE_URL` configurado para bloquear scripts contra producción.

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
