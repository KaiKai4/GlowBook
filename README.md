# GlowBook

GlowBook is a multi-tenant SaaS for beauty salons. Each Salon is an isolated tenant with its own customers, collaborators, services, appointments, roles, templates and reports.

This repository is a Next.js modular monolith. The goal is to keep the product simple to deploy while making each domain Module easy to understand, test and change.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS
- Supabase Postgres, Auth and RLS
- Zod
- Vitest

## Product Levels

- Platform: SaaS administration in `/admin`. Platform superadmins can invite, review, suspend or delete Salons.
- Salon: tenant operating area with settings, business hours, catalog, customers, collaborators, appointments, roles, templates and reports.
- Salon team: internal users whose access is controlled by dynamic permissions.

The stable domain vocabulary lives in `CONTEXT.md`. Use those names when adding Modules, docs or tests.

## Architecture

GlowBook uses a feature-first modular monolith:

```text
src/app
  -> Next routes, layouts, pages and Server Actions

src/features/<domain>
  -> schemas.ts
  -> domain/      # pure rules when the domain has them
  -> data/        # Supabase/Postgres Adapter
  -> use-cases/   # main business Interface for app callers

src/components
  -> ui/          # domain-free UI atoms
  -> layout/      # shared layout Modules

src/lib
  -> auth, Supabase Adapters, utils, validation and Result

supabase/migrations
  -> schema, RLS, functions, triggers, constraints and RPCs
```

From the workspace root, `glowbook/supabase/migrations` is the real migration source. A sibling folder such as `../supabase/.temp` is Supabase CLI metadata and should not be treated as application schema.

The dependency direction is:

```text
app -> features/use-cases -> features/domain + features/data -> lib/supabase -> Supabase
```

`features/domain` must not import Next, React, Supabase or `src/app`.

## Import Rules

- `src/app` may import `src/features`, `src/components` and `src/lib`.
- Server Actions should stay thin: require profile/admin, check permission, parse input, call a use-case and revalidate.
- `src/features/<domain>/domain` contains pure rules and types for that domain.
- `src/features/<domain>/data` is the Supabase/Postgres Adapter for that domain.
- `src/features/<domain>/use-cases` is the Interface that app callers should use for business flows.
- `src/components/ui` must not import from `src/app` or `src/features`.
- `src/components/layout` must not import route files from `src/app`.
- `src/lib/supabase/admin.ts` is server-only and bypasses RLS; use it only in the allowed cases documented in ADR 0010.

Do not create empty `domain`, `data` or `use-cases` folders for appearance. A folder should contain a real Module or a short README explaining the planned Seam.

## Key Architecture Decisions

- `docs/adr/0001-multi-tenant-rls.md`: RLS is the primary tenant security guarantee.
- `docs/adr/0002-appointment-items-source-of-truth.md`: `appointment_items` is the schedule source of truth.
- `docs/adr/0003-dynamic-rbac-permissions.md`: authorization uses permissions, not role names.
- `docs/adr/0004-archive-reactivate-customers-collaborators.md`: customers and collaborators are archived/reactivated instead of deleted by Salon users.
- `docs/adr/0005-closed-onboarding-platform-invitations.md`: new Salons are created only by platform invitation.
- `docs/adr/0006-delete-salon-through-transactional-rpc.md`: complete Salon deletion is a protected transactional RPC.
- `docs/adr/0007-notification-templates-operational-messages.md`: operational messages use Salon templates.
- `docs/adr/0008-tests-as-safety-net.md`: critical domain rules need tests.
- `docs/adr/0009-modular-monolith-feature-architecture.md`: feature-first modular monolith rules.
- `docs/adr/0010-server-only-admin-adapter-exceptions.md`: allowed `service_role` usage.

Additional architecture docs:

- `docs/architecture-audit.md`
- `docs/modular-monolith-roadmap.md`
- `docs/database-contracts.md`
- `docs/production-readiness-checklist.md`
- `docs/environments.md`
- `docs/security.md`

## Supabase Contracts

Supabase is both persistence and a security Adapter.

- RLS isolates tenant data by Salon.
- `public.salon_id()` reads the tenant claim.
- `public.has_permission()` checks dynamic RBAC.
- `appointment_items` owns schedule truth.
- `create_appointment` writes appointments atomically.
- `delete_salon_completely` deletes public tenant data transactionally.
- Tenant integrity constraints prevent cross-Salon assignments.

When a rule exists both in TypeScript and SQL, SQL is the final security/data-integrity authority. TypeScript exists for UX, orchestration and early validation.

See `docs/database-contracts.md` before changing RPCs, triggers, constraints or RLS policies.

## Commands

```bash
npm run dev          # Start local Next dev server
npm run build        # Build production bundle
npm run start        # Start production server after build
npm run lint         # Run ESLint and architecture guardrails
npm run architecture:check # Run architecture guardrails only
npm run ci:verify   # Reproduce mandatory CI gates locally
npm run test         # Run Vitest
npm run test:e2e     # Run local Playwright critical flows
npm run test:e2e:staging # Run Playwright against deployed staging
npm run type-check   # Run TypeScript without emitting
npm run db:types     # Regenerate Supabase generated types
npm run db:migrate   # Push Supabase migrations
npm run smoke:seed-5-salons # Seed realistic staging smoke data
npm run smoke:cleanup-5-salons # Cleanup a staging smoke batch
npm run bootstrap:admin -- <email> <password>
```

Before shipping a change, prefer:

```bash
npm run ci:verify
```

That script runs the mandatory CI gates:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

The `main` branch and manual CI runs also execute E2E/architecture health when
Supabase staging secrets are configured.

## Generated Supabase Types

`src/types/database.types.ts` is generated from the linked Supabase project.
Regenerate it after every migration that changes schema, RPCs or enums:

```bash
npm run db:types
```

Then review the diff, run `npm run type-check`, and run the RPC/RLS tests when
security or data integrity changed.

## Environment

Use `.env.local` for local development. The expected public and server variables include:

- `GLOWBOOK_ENV`
- `APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRODUCTION_SUPABASE_URL`

Never expose `SUPABASE_SERVICE_ROLE_KEY` through `NEXT_PUBLIC_*` or browser code.

See `docs/environments.md` before running E2E fixtures or smoke seeds against
shared Supabase projects.

## Bootstrap

GlowBook has closed onboarding. The first Platform superadmin is created manually:

```bash
npm run bootstrap:admin -- owner@example.com "strong-password"
```

After that, the Platform superadmin logs in and invites Salons from `/admin`.

## Adding A Feature

1. Name concepts using `CONTEXT.md`.
2. Put route/page/form code in `src/app`.
3. Put business orchestration in `src/features/<domain>/use-cases`.
4. Put pure rules in `src/features/<domain>/domain` only when they have real Depth.
5. Put Supabase reads/writes in `src/features/<domain>/data`.
6. Add tests at the Module Interface when the rule is critical.
7. If a new decision changes architecture, add or update an ADR.
