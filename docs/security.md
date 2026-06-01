# Seguridad Operativa

Fecha: 2026-05-30

## Headers Web

`next.config.ts` define headers base para todo el sitio:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` bloqueando camara, microfono, geolocalizacion y browsing topics
- `Cross-Origin-Opener-Policy: same-origin`
- `poweredByHeader: false`

CSP queda como decision posterior porque GlowBook todavia necesita validar
scripts, estilos, fonts, Supabase Auth y assets del hosting real. Antes de
activar CSP en produccion, probarla en staging con modo report-only.

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

El Adapter inicial de observability es `src/lib/observability`. Emite eventos y
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
  `src/lib/observability`.
- Si se usa webhook/log drain, el token queda server-only y nunca debe llevar
  prefijo `NEXT_PUBLIC_`.
- Antes de produccion, confirmar acceso a Vercel Logs o al log drain elegido.
- No loguear tokens, cookies, passwords, authorization headers ni
  `SUPABASE_SERVICE_ROLE_KEY`.

## Rate Limiting

Decision actual para MVP:

- usar controles del hosting para rutas publicas si hay abuso;
- usar Supabase Auth protections para login;
- no introducir un Adapter propio hasta tener senales reales de abuso.

Si aparece abuso antes del lanzamiento, crear un Adapter dedicado en
`src/lib/rate-limit` y aplicarlo primero a login, invitaciones y operaciones
Platform destructivas.

Decision para lanzamiento amplio:

- revisar rate limiting del hosting para `login`, `invite`, `join`, feedback y
  operaciones Platform;
- revisar limites de Supabase Auth antes de campanas publicas;
- mantener un Adapter propio en `src/lib/rate-limit` como Seam futura solo si
  los controles del proveedor no alcanzan;
- registrar la decision en `docs/production-scale-readiness-checklist.md`.

## CSP Y Secrets

Antes de lanzamiento amplio:

1. Probar CSP en staging en modo report-only si el hosting/proveedor lo permite.
2. Confirmar que Supabase Auth, estilos, fonts y assets reales no se rompen.
3. Confirmar que `SUPABASE_SERVICE_ROLE_KEY` no aparece en bundle cliente,
   Vercel Logs, log drain ni errores capturados.
4. Rotar secrets si fueron compartidos en screenshots, chats, logs o entornos
   no confiables.
5. Mantener `PRODUCTION_SUPABASE_URL` configurado para bloquear scripts contra
   production.
