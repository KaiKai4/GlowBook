# ADR 0010: Server-Only Admin Adapter Exceptions

## Estado

Aceptada, con partes superadas por ADR 0019 (mecanismo de cumplimiento: la frontera `service_role` se hace cumplir por patrón con la regla `admin-client-boundary`; la lista de archivos autorizados es documentación revisada en code review) y con la parte de billing acotada por ADR 0025 (las lecturas del propio salón ya no usan `service_role`).

## Contexto

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is necessary for a small set of server-only operations, but it is also the most sensitive Adapter in the system.

ADR 0001 says cross-tenant Platform operations may use `service_role` after verifying Platform superadmin access. The codebase also needs privileged server operations for onboarding, Supabase Auth account management and bootstrap.

This ADR defines the allowed exceptions so future Modules do not introduce ad hoc `service_role` usage.

## Decision

`service_role` may only be used from server-only code.

The only general-purpose factory is:

```text
src/infra/supabase/admin.ts
```

That Module must import `server-only` and must never be imported by client Modules.

Supabase Auth Admin operations have a narrower Adapter:

```text
src/infra/supabase/auth-admin.ts
```

Use-cases and route files must not call `admin.auth.admin.*` directly. They also must not import `src/infra/supabase/auth-admin.ts` directly. Feature data Adapters wrap that technical Adapter so privileged Auth operations stay behind an auditable Seam.

The currently authorized Auth Admin feature Adapters are:

- `src/features/employees/data/employee-auth.repo.ts` for collaborator Auth account creation and revocation.
- `src/features/platform/data/platform-auth.repo.ts` for invited Owner Auth account creation, reuse and update.
- `src/features/platform/data/delete-salon.repo.ts` for Auth cleanup during complete Salon deletion.

The currently authorized service-role data Adapters are:

- `src/features/platform/data/salons.repo.ts` for Platform Salon administration reads/writes.
- `src/features/platform/data/salon-overviews.repo.ts` for the Platform Salon overview read model.
- `src/features/platform/data/invitations.repo.ts` for Platform invitation reads and protected invitation acceptance RPCs.
- `src/features/platform/data/platform-audit.repo.ts` for audit logging of high-impact Platform actions.
- `src/features/platform/data/delete-salon.repo.ts` for protected Salon deletion RPC workflows.
- `src/features/platform/data/feedback-moderation.repo.ts` for Platform feedback moderation.
- `src/features/billing/data/billing-db.ts` (`billingDb()`) for Platform billing administration: commercial plan/addon configuration, Salon subscription administration, Platform payments and notes, and cross-tenant reads for `/admin`. Platform writes filter by `salon_id` and must affect exactly one row (ADR 0025). Salon-own billing reads and writes do **not** use this client: they use `billingSalonDb()` (the user's session with RLS), and `count_salon_usage` and `record_plan_alert` are security definer RPCs bounded to the session claim (ADR 0025).
- `src/features/employees/data/employee-access.repo.ts` for collaborator invitations, profile linkage and collaborator-access cleanup.
- `src/features/employees/data/employee-auth.repo.ts` for collaborator Auth account creation and revocation.
- `src/features/platform/data/platform-auth.repo.ts` for invited Owner Auth account creation, reuse and update.
- `src/infra/auth/session.ts` for Platform admin detection.

Authorized by layer (not by file):

- `src/infra/security/` for the shared rate limit (ADR 0017). Its modules call only the `consume_rate_limit` RPC with the admin client. Modules in this directory must not import `src/features/**`, `src/app/**` or React (enforced by dependency-cruiser). The exception is declared in `scripts/check-architecture.mjs` as a directory, so a new module in the layer does not need an ADR update, but a new kind of privileged call does.

Allowed use cases:

1. Platform administration after `requirePlatformAdmin()` or equivalent verification:
   - cross-tenant reads for `/admin`
   - Salon activation/suspension
   - Platform feedback moderation
   - Platform audit logging
   - protected Salon deletion workflow
2. Closed onboarding:
   - create or reuse the invited Owner Auth account
   - call invitation acceptance RPCs that create Salon + Owner profile
   - validate invitation state where RLS would block the operation
3. Colaborador access management:
   - create, revoke or replace employee invitations
   - delete Auth users when collaborator access is revoked
   - unlink collaborator Profile access when required by lifecycle rules
4. Platform admin detection:
   - read `platform_admins` server-side to decide whether a logged-in user is a Platform superadmin
5. Bootstrap script:
   - create the first Platform superadmin from `scripts/bootstrap-platform-admin.mjs`
6. Tests:
   - integration tests that explicitly validate RLS, RPCs or privileged flows

All normal Salon tenant business operations should use the server Supabase Adapter with the logged-in user's session and RLS:

```text
src/infra/supabase/server.ts
```

Browser code must only use the browser anon Adapter:

```text
src/infra/supabase/client.ts
```

New `service_role` use outside the allowed list requires updating this ADR or adding a new ADR.

## Consequences

The system keeps RLS as the default data safety model.

Privileged operations become auditable because there is a short list of allowed reasons.

Legacy use-cases previously imported privileged Supabase Adapters directly. After Phase 17, Auth Admin operations are isolated in feature data Adapters, which call `src/infra/supabase/auth-admin.ts` internally. Future Auth Admin use outside the authorized feature data Adapters requires updating this ADR.

If a Module uses `service_role`, it must return explicit errors and must not hide partial failure. This matters for destructive operations such as complete Salon deletion and Auth cleanup.

## Non-Negotiable Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` as `NEXT_PUBLIC_*`.
- Never import `src/infra/supabase/admin.ts` from a `"use client"` file.
- Never use `service_role` to bypass ordinary tenant permissions for convenience.
- Never make browser code responsible for privileged decisions.
- Prefer SQL/RPC transactions for irreversible public data changes.
