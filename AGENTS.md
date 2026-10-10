<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GlowBook: reglas canónicas

Este archivo es la **única fuente de reglas** para personas y agentes. `CLAUDE.md` solo importa este archivo. Cada regla indica el control que la comprueba: si una regla no tiene control, se marca como convención y se revisa en code review.

Documentos relacionados: `CONTEXT.md` (vocabulario de dominio), `DESIGN.md` (UI), `SECURITY.md` (seguridad), `docs/README.md` (índice), `docs/quality-guide.md` (verificador), `docs/development-guide.md` (flujo local), `docs/production-standard.md` (despliegue y operación), `docs/adr/` (decisiones).

## 1. Producto y stack

- Producto: SaaS multi-tenant para salones de belleza (agenda, clientes, empleados, inventario, venta, gastos, reportes, recordatorios).
- Next.js 16.4 (App Router) con React 19.2, TypeScript estricto, Tailwind CSS v4, Zod 4.
- Supabase: Postgres, Auth, RLS y Storage. Vercel para despliegue.
- Node 24 (`.nvmrc`). Pruebas con Vitest 4, Playwright y pgTAP.
- Control: `npm ci` y `npm run type-check` (paso `types`).

## 2. Capas y dependencias

Estructura (ADR 0019):

- `src/infra/`: infraestructura transversal (`supabase/`, `auth/`, `observability/`, `security/`, `validation/`, `http/`, `events/`, `effects/`, `idempotency/`, `format/`, `errors.ts`, `result.ts`). No importa `src/features`, `src/app`, `src/components` ni React.
- `src/features/<modulo>/`: módulo de negocio con `domain/` (funciones puras), `data/*.repo.ts` (adaptadores Supabase finos, con `import "server-only"`, sin decisiones de negocio), `use-cases/` (orquestación que recibe el contexto por parámetro), `schemas.ts` (DTOs Zod) e `index.ts` (interfaz pública: el único punto de entrada para otros módulos).
- `src/app/`: presentación del App Router (rutas, layouts, route handlers, Server Actions). `src/app/_composition/` es el composition root: el único sitio que lee la sesión y construye el `RequestContext` (`request-context.ts`, con `react cache`), y el pipeline de acciones `define-action.ts`.
- `src/components/`: sistema de diseño (`ui/`, `layout/`, `forms/`, `brand/`).
- `supabase/migrations/`: SQL versionado. `supabase/tests/`: pruebas pgTAP.

Server Actions: contexto -> permiso por clave -> rate limit -> validación -> UNA llamada a un caso de uso -> revalidación. Se escriben con `defineAction` (`src/app/_composition/define-action.ts`). No contienen reglas de negocio y nunca comprueban nombres de rol.

Reglas (las comprueba `.dependency-cruiser.cjs` por patrón, sin listas de archivos ni excepciones):

- `src/infra` no importa de `src/features`, `src/app`, `src/components`, React ni React-DOM (`infra-no-upward`; además `src/infra/architecture-boundaries.test.ts`).
- `domain/` no importa `use-cases/`, `data/`, `src/app`, `src/components`, `src/infra/supabase`, Next, React, `@supabase/*` ni `server-only` (`domain-pure`).
- `data/` no importa `use-cases/`, `src/app`, `src/components` ni React (`data-no-upward`).
- Un módulo importa de otro solo a través de su `index.ts` (`cross-module-via-index`).
- `use-cases/` no importa React, componentes, rutas ni `next/navigation` (`use-cases-no-ui`).
- `app/` y `components/` solo importan Supabase como tipo (`presentation-no-runtime-db`); `src/app/_composition` queda fuera de la regla.
- Los clientes `service_role` (`src/infra/supabase/admin.ts`, `auth-admin.ts`) solo se importan desde `src/infra` o `features/*/data` (`admin-client-boundary`, ADR 0010).
- No hay dependencias circulares (`no-circular`). No hay violaciones conocidas: `npx depcruise src --config .dependency-cruiser.cjs` termina en cero, sin baseline.
- Control: paso `architecture` (`scripts/check-architecture.mjs` y `dependency-cruiser`).

Mapa de código: `docs/code-map/modules.mmd` (diagrama Mermaid, un nodo por módulo, agrupado por capa) y `docs/code-map/graph.json` (el mismo grafo en JSON). Para ver quién depende de quién, consulta el mapa antes de rastrear imports. Se regenera con `node scripts/quality/code-map.mjs`; el paso `code-map` falla si está desactualizado.

## 3. Multi-tenancy y RLS

- RLS de Postgres es la autoridad final de aislamiento entre salones (ADR 0001). Cada tabla de negocio tiene `salon_id` y RLS activado.
- `public.salon_id()` lee el claim `salon_id` del JWT inyectado por el Auth Hook.
- El código también filtra explícitamente por salón. No hay consultas de negocio sin filtro de salón, aunque RLS lo garantice.
- Las lecturas cross-tenant de plataforma usan `service_role` solo en servidor, tras verificar `is_platform_admin()`. Nunca desde el navegador.
- Control: pruebas pgTAP de aislamiento (paso `db-tests`), `multi-tenant-isolation.spec.ts` (paso `e2e`) y la lista de importadores permitidos (paso `architecture`).

## 4. RBAC por permisos

- Los permisos son un catálogo global fijo, en la base de datos y en `src/features/access/domain/permissions.ts` (ADR 0003).
- Los roles son por salón. El owner asigna permisos desde `/roles`.
- La autorización pregunta `public.has_permission('clave')` (BD) o el equivalente de `src/features/access/domain/permission-checks.ts`. Nunca se compara por nombre de rol.
- `is_owner = true` es cortocircuito (super-admin del salón).
- Control: pruebas de permisos en `supabase/tests/02_permissions_and_hook.sql` (paso `db-tests`) y `src/features/access/domain/permission-checks.test.ts` (paso `unit`).

## 5. Onboarding cerrado

- No hay registro público. La plataforma emite invitaciones con la RPC `invite_salon` (ADR 0005).
- El invitado abre `/invite/[token]`, se autentica y `accept_invitation` valida token y email y crea salón y owner de forma atómica.
- Control: `src/features/platform/use-cases/accept-invitation.behavior.test.ts` (paso `unit`) y pruebas de integración de la RPC (paso `integration`).

## 6. Plataforma (super-admin)

- Área `/admin` protegida por `is_platform_admin()`.
- Tablas: `platform_admins`, `salon_invitations`.
- Lectura cross-tenant solo con `service_role` en servidor (ADR 0010).

## 7. Citas

- Una sola representación: `appointments` (cabecera) y `appointment_items` (fuente de verdad, ADR 0002).
- La exclusion constraint `no_overlap_per_employee` garantiza que no hay solapes a nivel de BD.
- El trigger `recalc_appointment` mantiene `start_time`, `end_time` y `total_price` consistentes.
- Ciclo de vida: `scheduled -> confirmed -> completed | cancelled | no_show`. Al cancelar o marcar no-show, los items pasan a `blocks_calendar = false`.
- Control: `supabase/tests/03_create_appointment.sql` (paso `db-tests`).

## 8. Idempotencia

- Las escrituras críticas (crear o actualizar cita, transiciones de cita, ventas de retail, compras y traspasos de inventario, registro de recordatorios) aceptan una `idempotency_key`.
- Contrato: la clave viaja en `payload->>'idempotency_key'` (RPC con `jsonb`) o en el parámetro `p_idempotency_key uuid default null` (RPC con firma explícita). Sin clave, la RPC se comporta como antes.
- La tabla `public.idempotency_keys` tiene RLS sin políticas ni grants de cliente. Solo la tocan `idempotency_begin` e `idempotency_finish`.
- Un reenvío con la misma clave y los mismos datos devuelve el resultado original; la misma clave con otros datos falla con SQLSTATE `22023`.
- El cliente serializa el payload con `toCanonicalPayload` (`src/infra/idempotency/canonical-json.ts`) antes de llamar a la RPC, para que el mismo payload lógico produzca siempre el mismo resultado.
- Control: `supabase/tests/06_idempotency.sql` (paso `db-tests`), `canonical-json.test.ts` (paso `unit`).

## 9. Errores públicos

- Los mensajes que ve el usuario son explícitos (ADR 0018): `PublicError` lanzado a propósito desde un use-case, o un mensaje fijo revisado.
- Cualquier otro error pasa por `toPublicErrorMessage(error, fallback)` y se registra con `captureError`. Nunca se muestra `error.message` de Postgres, PostgREST, red o trazas.
- Control: `src/infra/errors.test.ts` y `src/infra/public-error.ts` (paso `unit`).

## 10. Seguridad

- Validación de entradas con Zod en `schemas.ts` o en el borde (Server Action, route handler).
- Cabeceras estáticas en `next.config.ts`; CSP con nonce por petición, `same-origin` y request id en `src/proxy.ts` y `src/infra/security/`. Rate limit compartido en Postgres (ADR 0017), solo desde `src/infra/security/rate-limit.ts`.
- Secretos fuera del repo. Nunca se leen ni se imprimen valores de `.env.local` en pruebas, scripts o documentación.
- Detalle y procedimientos en `SECURITY.md` y `docs/security.md`.
- Control: paso `secrets` (secretlint), `audit-prod`, `audit-all` (`security/audit-exceptions.json`), CodeQL en CI.

## 11. Base de datos y migraciones

- Migraciones forward-only con expand/contract (ADR 0016). Una migración aplicada en producción es inmutable: un error se corrige con una migración nueva.
- Prohibido en migraciones: `RENAME COLUMN`, `RENAME TO`, `TRUNCATE`, `DELETE FROM` sin `WHERE`. Las operaciones de contract (`DROP`, `SET NOT NULL`, cambio de tipo) solo en migraciones identificadas con su contrato.
- Los tipos de `src/types/database.types.ts` se generan con `npm run db:types` desde la BD local. No se editan a mano.
- Control: `migrations-lint` (squawk y `scripts/quality/migration-rules.mjs`), `db-reset`, `db-tests`, `types-drift`.
- Contratos de BD por módulo: `docs/database-contracts.md`.

## 12. UI

- Los tokens semánticos de `DESIGN.md` son la fuente de color, tipografía y sombra. No se usan clases de paleta cruda (`bg-red-500`) ni colores literales fuera de los tokens.
- Sin `font-bold` (usar `font-semibold`) ni tamaños fuera de la escala de `DESIGN.md` §4.
- Móvil de 375 px sin scroll horizontal y gutter lateral de 16 px (`DESIGN.md` §3).
- Control: paso `design-tokens` (absoluto, sin baseline), `e2e` con axe para accesibilidad.

## 13. Código TypeScript

- Sin `any`. Sin `@ts-ignore` ni `@ts-expect-error`. Sin `eslint-disable`. Sin `!` ni `as unknown as` nuevos.
- Archivos de producción de hasta 300 líneas (ideal menos de 250). Si crecen, se dividen por responsabilidad.
- Sin código muerto: ningún export ni dependencia sin consumidor.
- La lógica de negocio no va en componentes React ni en Server Actions: solo orquestan y delegan en `use-cases/`.
- Los datos de Supabase usan los tipos generados (`src/types/database.types.ts`), nunca `any`.
- No se hardcodean nombres de roles: se comprueban permisos.
- Control: paso `lint` (`--max-warnings 0`), `types`, `module-size` (300 líneas, absoluto), `dead-code` (knip).

## 14. Pruebas y umbrales

- Pruebas proporcionales al riesgo (ADR 0008). Un cambio de dominio, RLS, RPC, permisos o seguridad lleva pruebas de conducta que crucen la interfaz pública.
- Umbrales de cobertura: global 80% líneas y funciones, 70% ramas. Rutas críticas (`src/infra/auth`, `src/infra/security`, `src/features/access`, `src/features/platform`, `src/proxy*.ts`): 90% líneas y funciones, 80% ramas. El código cambiado debe cumplir los mismos umbrales (paso `coverage`).
- Los umbrales no se bajan. El trinquete de cobertura (`quality/coverage-baseline.json`) solo puede subir o quedarse igual (ADR 0013). Tokens de diseño, tamaño de módulos y grafo son controles absolutos sin baseline (ADR 0019).
- Sin `skip`, `only` ni tests desactivados. Las pruebas de integración fallan si falta la BD local; no se marcan como saltadas.
- Pruebas de scripts con `node:test`, registradas en la lista explícita del paso `scripts-tests` (`scripts/quality/steps.mjs`).

## 15. Comandos

```bash
npm ci                    # instalar dependencias (respeta package-lock.json)
npm run dev               # servidor de desarrollo
npm run verify:fast       # ciclo diario (tier fast)
npm run verify:full       # definición de terminado (tier full)
npm run test              # Vitest, proyecto unit
npm run test:integration  # Vitest, proyecto integration (requiere BD local)
npm run type-check        # TypeScript sin emitir
npm run lint              # ESLint con cero avisos
npm run db:start          # Supabase local
npm run db:reset          # reconstruye la BD local desde las migraciones
npm run db:test           # pgTAP
npm run db:types          # regenera tipos desde la BD local
```

Los comandos `release:migrations`, `staging:migrations` y `bootstrap:admin` apuntan a entornos remotos. No forman parte de la verificación local y no se ejecutan desde pruebas ni agentes sin instrucción explícita de la persona responsable (`docs/environments.md`).

## 16. Definición de terminado

Un cambio está terminado cuando se cumplen **las cuatro** condiciones:

1. `npm run verify:full` sale con código 0 en un checkout limpio, con Docker en ejecución (control: el propio verificador, que es el mismo que CI).
2. Hay pruebas de la conducta nueva y de la regresión que se corrige. Un bug corregido sin prueba que falle antes del cambio no está terminado.
3. Si el cambio toma una decisión que no es obvia (contrato de BD, capa, dependencia, herramienta, excepción de seguridad o auditoría), hay un ADR nuevo en `docs/adr/` y está en el índice.
4. La documentación afectada se actualiza en el mismo cambio. El paso `docs-links` comprueba que los enlaces y rutas citadas existen.

Un cambio no se da por terminado con `verify:fast` solo, ni con CI en rojo, ni con un paso omitido.

## 17. Ramas, commits y revisión

- Commits en español con formato `tipo(ámbito): mensaje` (por ejemplo `fix(citas): ...`).
- Los hooks de Husky no se saltan (`--no-verify` prohibido): `pre-commit` ejecuta `secrets` y `lint`; `pre-push` ejecuta `verify:fast`.
- La plantilla de PR (`.github/pull_request_template.md`) pide evidencia de `verify:full`.
- Control: `ci-parity` (CI y manifiesto de pasos coinciden) y `check-ci-parity.mjs`.

## 18. Desarrollo y publicación

- Desarrollo y pruebas contra Supabase local; rama desde main, commit, PR y los siete controles obligatorios antes de integrar. Staging remoto es opcional y Nightly no forma parte del flujo vigente (ADR 0021).
- Solo GlowBook Release publica: éxito de CI por push a main → aprobación Production para migraciones → deploy candidato sin dominio → smoke → segunda aprobación Production para promoción → smoke público. No desplegar directamente para omitir estos controles.
- Vercel tiene desactivado el deploy automático por Git con `git.deploymentEnabled=false`. Un push a una rama no publica.
- Las aprobaciones de producción requieren instrucción explícita de la persona responsable; la autorización existente en la sesión sigue siendo válida dentro de su alcance.
- Procedimiento: `docs/development-guide.md` y `docs/runbooks/deploy.md`. Controles: protección de main, environment Production, `.github/workflows/release.yml`, gate de release y `vercel.json`.
