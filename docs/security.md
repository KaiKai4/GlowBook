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

## Rate Limiting

Decision actual para MVP:

- usar controles del hosting para rutas publicas si hay abuso;
- usar Supabase Auth protections para login;
- no introducir un Adapter propio hasta tener senales reales de abuso.

Si aparece abuso antes del lanzamiento, crear un Adapter dedicado en
`src/lib/rate-limit` y aplicarlo primero a login, invitaciones y operaciones
Platform destructivas.
