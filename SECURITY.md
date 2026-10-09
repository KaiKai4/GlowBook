# Politica De Seguridad

GlowBook guarda datos de clientes, citas, empleados y operaciones de salones. La seguridad se apoya en el aislamiento de datos en la base de datos (RLS), en permisos dinámicos y en controles automáticos que bloquean cambios inseguros. Este documento resume la política; el detalle técnico está en `docs/security.md`.

## Reportar Una Vulnerabilidad

- No abras un issue público ni un pull request con los detalles de una vulnerabilidad.
- Repórtala de forma privada al responsable del repositorio (Allan Ordoñez) por el canal acordado con el equipo, con los pasos para reproducirla y el impacto que crees que tiene.
- Incluye la versión (SHA de `main`), el entorno afectado (local, staging o producción) y las evidencias mínimas. No incluyas datos reales de salones ni de clientes, ni secretos.
- Recibirás acuse de recibo y se coordinará la corrección antes de cualquier divulgación.

Versiones soportadas: solo la rama `main`, desplegada en producción por la release (`docs/production-standard.md`).

## Qué Protege El Sistema

| Área | Control | Dónde se comprueba |
|---|---|---|
| Aislamiento entre salones | RLS en Postgres como autoridad final (ADR 0001) y `public.salon_id()` desde el claim del JWT. | Pruebas pgTAP `supabase/tests/01_tenant_isolation.sql` (paso `db-tests`) y E2E `e2e/multi-tenant-isolation.spec.ts` (paso `e2e`). |
| Permisos | Permisos globales y roles por salón (ADR 0003). Se comprueba `has_permission`, nunca el nombre del rol. | `supabase/tests/02_permissions_and_hook.sql`, `src/lib/auth/permissions.test.ts`. |
| Plataforma | Área `/admin` protegida por `is_platform_admin()`. Alta de salones solo por invitación (ADR 0005). | Pruebas de integración y E2E `e2e/platform-admin.spec.ts`. |
| Cliente `service_role` | Solo en servidor, tras verificar superadmin, y solo en las listas permitidas de `scripts/check-architecture.mjs` y en `src/lib/security/` (ADR 0010, ADR 0017). Nunca en navegador ni en variables `NEXT_PUBLIC_*`. | Paso `architecture`. |
| Secretos | Ningún secreto en el repositorio. Escaneo sobre archivos rastreados por git. | Paso `secrets` (secretlint), también en `pre-commit`. |
| Dependencias | Producción sin avisos de auditoría y sin excepciones. Desarrollo con excepciones con caducidad (ADR 0015). | Pasos `audit-prod` y `audit-all`, `security/audit-exceptions.json`. |
| Cabeceras web | Cabeceras estáticas (`X-Frame-Options: DENY`, `nosniff`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, entre otras) en `next.config.ts`. | `docs/security.md`, sección "Headers Web". |
| CSP | Content-Security-Policy con nonce por petición en `src/proxy.ts` y `src/lib/security/csp.ts`, con endpoint de informes. | `docs/security.md`, secciones "Informes CSP" y "CSP Y Secrets". |
| Rate limit | Contador compartido en Postgres (`rate_limit_buckets`, RPC `consume_rate_limit`, solo `service_role`) desde `src/lib/security/rate-limit.ts` (ADR 0017). | `docs/security.md`, sección "Rate Limiting". |
| Errores públicos | Solo `PublicError` o mensajes revisados llegan al usuario. Nunca se muestran detalles de Postgres, PostgREST o trazas (ADR 0018). | `src/lib/public-error.ts` y su prueba. |
| Idempotencia | Las escrituras críticas usan `idempotency_key` y no duplican efectos (`supabase/tests/06_idempotency.sql`). | Paso `db-tests`. |
| Validación de entradas | Zod en el borde de cada entrada (Server Action, route handler, use-case). | `schemas.ts` de cada módulo y sus pruebas. |
| Migraciones | Forward-only, sin `RENAME`, `TRUNCATE` ni `DELETE` sin `WHERE` (ADR 0016). | Paso `migrations-lint`. |

## Secretos Y Datos Sensibles

- `.env.local` nunca se versiona. Usa `.env.local.example` como plantilla.
- Las variables con prefijo `NEXT_PUBLIC_` son públicas por diseño. No pongas en ellas ningún secreto.
- Los logs se sanitizan (`src/lib/observability/redaction.ts`). No registres contraseñas, tokens, cabeceras de autorización ni cuerpos completos de formularios.
- Las rotaciones de secretos y su estado se describen en `docs/environments.md`.
- Si un secreto llega a un commit, se considera comprometido: se rota, aunque el commit se borre.

## Flujos Sensibles

Acceso y sesión, invitaciones, alta y baja de salones, cambios de permisos, cobros, ventas y operaciones de `service_role` son flujos sensibles. Cualquier cambio en ellos incluye:

- Pruebas de conducta del caso correcto y de los casos de acceso denegado.
- Revisión de RLS y de permisos en `docs/database-contracts.md`.
- Un ADR si cambia el contrato.

## Respuesta A Incidentes

El procedimiento de respuesta, contención y comunicación está en `docs/runbooks/incident.md`. Una vulnerabilidad confirmada en producción se trata como incidente, con rotación de secretos afectados si procede y, si hay datos expuestos, evaluación de notificación.

## Documentación Relacionada

- `docs/security.md`: detalle técnico de cabeceras, CSP, errores públicos, observabilidad, rate limit y auditoría.
- `docs/environments.md`: entornos, guardas y rotación de secretos.
- `docs/database-contracts.md`: qué tabla o RPC tiene cada autoridad de seguridad.
- `docs/quality-guide.md`: pasos del verificador que protegen la seguridad.
