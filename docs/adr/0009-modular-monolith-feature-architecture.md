# ADR 0009: Modular Monolith Feature Architecture

## Estado

Aceptada.

## Contexto

GlowBook is a multi-tenant SaaS with strongly related domains: Platform, Salon, Profile, Colaborador, Cliente, Servicio, Cita, Plantilla, Recordatorio operativo and Rol.

The product should stay deployable as one application, but the codebase needs better Locality than a route-only Next.js structure. Some routes currently contain queries, aggregations and business decisions directly in `src/app`, which makes those Modules shallow and harder to test.

The existing direction in `CLAUDE.md` is:

```text
app -> use-cases -> domain + data
```

This ADR records that direction as an accepted architecture decision.

## Decision

GlowBook will remain a feature-first modular monolith.

The main source layout is:

```text
src/app
src/features/<domain>
src/components
src/infra
src/types
src/test
supabase/migrations
```

`src/app` is the Interface for Next.js delivery:

- routes
- pages
- layouts
- route handlers
- Server Actions
- route-local UI

`src/app` may authenticate, authorize, parse route/search/form input, call use-cases and render. It should not own domain rules, SQL query shapes, report aggregations, appointment scheduling rules or privileged Supabase operations.

`src/features/<domain>` owns business Modules. A feature may contain:

- `schemas.ts`: input/output validation and DTO parsing.
- `domain/`: pure rules with no I/O.
- `data/`: Supabase/Postgres Adapter for the feature.
- `use-cases/`: main Interface for app callers. Use-cases orchestrate validation, domain rules and data persistence.

`domain/` must not import from:

- `next`
- `react`
- `@supabase/*`
- `@/app/*`
- `@/components/*`

`data/` may import Supabase server Adapters and generated database types. It should keep SQL shape knowledge close to persistence.

`use-cases/` may import `domain`, `data`, `schemas`, `@/infra/result` and narrow infrastructure Adapters. Server Actions should call use-cases instead of repositories when there is meaningful business behavior.

`src/components/ui` is domain-free UI. It must not import `src/app` or `src/features`.

`src/components/layout` may import shared UI, permission types and layout helpers, but must not import route files from `src/app`.

`src/infra` contains cross-cutting infrastructure:

- Supabase Adapters
- auth/session helpers
- permission helpers
- utilities
- validation helpers
- Result helpers

`supabase/migrations` is the source of truth for SQL schema, RLS, constraints, triggers and RPCs.

Empty architecture folders should not be created just for shape. A folder should either contain a real Module or include a README explaining why the Seam is intentionally reserved.

## Consequences

The monolith stays simple to run and deploy.

The app gains Locality: changes to a domain rule should concentrate in a feature Module, not spread through pages.

Tests should cross the same Interface that app code uses. For critical behavior, prefer testing domain Modules or use-cases over route internals.

Some existing code does not yet follow this ADR. Future refactors should move incrementally toward this decision and record any new load-bearing exception in an ADR.

Creating an abstract Interface is not required for every Module. Per the architecture vocabulary, one Adapter is a hypothetical Seam; two Adapters or a real testing/integration pressure make the Seam real.

## Import Rules Summary

- `app -> features`, `app -> components`, `app -> lib` are allowed.
- `features/use-cases -> features/domain` and `features/use-cases -> features/data` are allowed.
- `features/domain -> Supabase`, `features/domain -> Next`, `features/domain -> React` are forbidden.
- `components -> app` is forbidden.
- Direct `service_role` access is governed by ADR 0010.

### Excepcion controlada: `components/layout -> features`

`src/components/layout` puede importar Interfaces estables de `features` solo para construir la navegacion global y el chrome compartido de la aplicacion.

Permitido:

- tipos de permisos y feature flags del Salon;
- Modules puros de dominio que no importen Next, React, Supabase ni Server Actions;
- view-only constants necesarias para decidir visibilidad de navegacion.

No permitido:

- imports a `features/*/data`;
- imports a Server Actions;
- imports a use-case que ejecute lecturas o escrituras;
- imports que obliguen a `components/layout` a conocer query shape, tenant data o Supabase.

Esta excepcion existe porque el layout es infraestructura de UI compartida, no un flujo de negocio. Si empieza a necesitar datos, debe recibirlos desde `src/app` o desde un read Module llamado por `src/app`, no buscarlos directamente.
