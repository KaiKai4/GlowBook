# App Router Data Access Strategy - 2026-06-07

## Decision

GlowBook uses a mixed App Router data access strategy:

- Server Components own initial page reads.
- Server Actions own UI-triggered mutations.
- URL `searchParams` own page-level interactive read state.
- Lookup reads may stay as Server Actions when they are small, contextual validations.
- RPC/read models are reserved for measured heavy aggregate reads.

This keeps the modular monolith intact: `app -> features/use-cases -> domain/data -> Supabase`.

## Applied Route Reads

These page-level reads now use URL state and Server Component rendering:

- `/appointments?date=YYYY-MM-DD&view=diaria|semanal|trabajador`
- `/reports?preset=hoy|semana|mes|mes_anterior|30dias|90dias`
- `/reports?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `/customers?q=<query>&page=<number>`

The removed read actions were:

- `getCalendarViewAction`
- `getReportAction`
- `getCustomersPageAction`

## Kept Server Actions

Mutations remain Server Actions across appointments, customers, employees, expenses, inventory, platform admin, reminders, retail, roles, salon settings, services and templates.

Small lookup reads also remain Server Actions for now because they are contextual validations, not page-level navigation state:

- appointment availability for new/edit appointment flows
- customer phone/archive lookup during customer creation and appointment booking
- employee archive lookup during collaborator creation

If these lookup reads become frequent bottlenecks, evaluate a Route Handler or client-side Supabase read with RLS separately.

## Guardrails

- Do not rely on `proxy.ts` alone for security.
- Every Server Action must still validate profile, permission and feature access.
- Server Components must fetch through feature use-cases, not through internal Route Handlers.
- Do not add RPC/read models until route measurements show the simpler changes are insufficient.
