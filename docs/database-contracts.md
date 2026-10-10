# Database Contracts

Fecha: 2026-05-28

This document maps Supabase SQL contracts to TypeScript owners. It exists so the project does not accidentally split one rule across many shallow Modules without knowing which Implementation is authoritative.

## Rule Of Authority

- SQL/RLS/RPC/constraints are authoritative for security, tenant isolation and final data integrity.
- TypeScript domain Modules are authoritative for pure business calculations and user-facing prevalidation.
- TypeScript use-cases orchestrate input validation, domain rules, data Adapters and user-facing errors.
- Server Actions are delivery Adapters. They should not be the authoritative home of business rules.

When TypeScript duplicates a SQL rule, the duplication is for UX or early feedback. SQL remains the final guard.

## Core SQL Contracts

| Contract | SQL source | TypeScript owner | Purpose |
|---|---|---|---|
| `public.salon_id()` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/infra/auth`, all tenant repos | Reads Salon tenant id from auth claims. |
| `public.is_owner()` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/features/access/domain/permission-checks.ts` | Owner shortcut for permission checks. |
| `public.has_permission(perm text)` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/features/access/domain/permission-checks.ts`, `src/features/access` | Dynamic RBAC check in SQL. |
| `public.is_platform_admin()` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/infra/auth/session.ts`, `src/features/platform` | Identifies Platform superadmin accounts. |
| `public.custom_access_token_hook(event jsonb)` | `supabase/migrations/20240101000004_auth_hook.sql` | `src/infra/auth/session.ts` | Adds stable claims used by RLS helpers. |

## RLS Contracts

RLS is enabled for tenant and platform tables in `supabase/migrations/20240101000001_rls_and_functions.sql`, with later migrations refining appointment, employee invitation, feedback and policy-performance behavior.

| Area | SQL source | TypeScript owner | Contract |
|---|---|---|---|
| Salon data isolation | `20240101000001_rls_and_functions.sql` | all `src/features/*/data` repos | Tenant data must be isolated by Salon. Code should still filter by `salon_id` for clarity and performance. |
| Salon feature availability | `20240101000023_salon_disabled_features.sql`, `20240101000024_salon_disabled_features_constraint.sql` | `src/features/salon-features/domain/salon-features.ts`, `src/features/access/domain/permission-checks.ts`, `src/features/platform/data/salons.repo.ts` | Platform stores disabled operational modules in `salons.disabled_features`. SQL rejects unknown feature keys; UI navigation and Server Actions must enforce the same contract. |
| Appointment read/write | `20240101000001_rls_and_functions.sql`, `20240101000008_fix_appt_rls_for_all.sql`, `20240101000009_appointments_view_permission.sql` | `src/features/appointments` | Appointment access follows `appointments.view`, `appointments.view_all` and `appointments.manage`. |
| Employee invitations | `20240101000007_employee_invitations.sql` | `src/features/employees/data/employee-access.repo.ts`, `src/features/employees/use-cases/employee-access.ts`, `src/features/employees/use-cases/employee-invitations.ts` | Only authorized server flows should manage employee invitations. Use-cases orchestrate; the privileged data Adapter owns direct admin reads/writes. |
| Feedback reports | `20240101000012_feedback_reports.sql` | `src/features/feedback`, `src/features/platform` | Salon users can submit feedback; Platform can review it with admin access. |
| Platform invitations | `20240101000001_rls_and_functions.sql`, `20240101000002_rbac_seed_and_platform.sql` | `src/features/platform` | Salon creation is controlled by Platform invitation. |
| RLS policy performance | `20240101000028_optimize_rls_policy_performance.sql` | all SQL-backed feature repos | RLS must avoid per-row `auth.uid()`/permission helper evaluation where a statement-level initplan is enough. Write policies should not use `FOR ALL` when explicit `SELECT` policies exist. |

## Appointment Contracts

| Contract | SQL source | TypeScript owner | Authority |
|---|---|---|---|
| `appointment_items` as schedule truth | `20240101000000_initial_schema.sql`, ADR 0002 | `src/features/appointments` | SQL schema + ADR. |
| `no_overlap_per_employee` | `20240101000000_initial_schema.sql` | `src/features/appointments/domain/availability.ts` for UX; SQL final authority | Prevents double booking per collaborator. |
| `recalc_appointment()` trigger | `20240101000001_rls_and_functions.sql`, vigente desde `20240101000033_item_level_appointment_discounts.sql` | `src/features/appointments/data/appointments.repo.ts` | Keeps appointment header start/end/total derived from items. Ver nota abajo. |
| `create_appointment(payload jsonb)` | `20240101000003_create_appointment_rpc.sql`, hardened by `20240101000013`, `20240101000015`, `20240101000019`, `20240101000065`, `20240101000072` | `src/features/appointments/use-cases/create-appointment.ts` | Atomic appointment creation and final schedule integrity. Desde `20240101000072` acepta `new_customer` en lugar de `customer_id` (exactamente uno). Ver contrato transaccional abajo. |
| `blocks_calendar` behavior | schema + lifecycle updates | `src/features/appointments/domain/lifecycle.ts` | Scheduled/confirmed block calendar; cancelled/no_show/completed do not block new slots. |
| Agenda configuration consumption | `salons` fields, `salon_business_hours` | `src/features/salon` owns configuration; `src/features/appointments/domain/availability.ts` and `src/features/appointments/domain/wizard-availability.ts` consume it | Salon stores schedule policy; appointments applies it when calculating availability. |

TypeScript should prevalidate appointment availability for UX, but SQL must reject invalid or overlapping writes.

## Tenant Integrity Constraints

Migration `20240101000020_enforce_service_assignment_tenant_integrity.sql` adds same-Salon constraints for important relationships.

| Relationship | Constraint family | TypeScript owner |
|---|---|---|
| Service -> Category | `fk_services_category_same_salon` | `src/features/services` |
| Employee service assignment | `fk_employee_services_employee_same_salon`, `fk_employee_services_service_same_salon` | `src/features/employees/domain/collaborator-assignment.ts` |
| Employee category assignment | `fk_employee_categories_employee_same_salon`, `fk_employee_categories_category_same_salon` | `src/features/employees/domain/collaborator-assignment.ts` |
| Work schedule -> Employee | `fk_work_schedules_employee_same_salon` | `src/features/employees/use-cases/employee-schedule.ts` |
| Appointment item -> Service/Employee | `fk_appointment_items_service_same_salon`, `fk_appointment_items_employee_same_salon` | `src/features/appointments` |
| Appointment -> Customer | `fk_appointments_customer_same_salon` | `src/features/appointments`, `src/features/customers` |

These constraints are final data-integrity guards. TypeScript should still validate inputs early so users get clear messages.

## Onboarding And Platform Contracts

| Contract | SQL source | TypeScript owner | Purpose |
|---|---|---|---|
| `invite_salon(p_email text, p_plan_id uuid default null)` | `20240101000002_rbac_seed_and_platform.sql`, reemplazada por `20240101000071_invite_salon_with_plan.sql` | `src/features/platform/use-cases/invite-salon.ts`, `src/features/platform/data/invitations.repo.ts` | Platform creates Salon invitation with its plan in one operation. Ver contrato transaccional abajo. |
| `accept_invitation(...)` | `20240101000002_rbac_seed_and_platform.sql`, updated by `20240101000006`, `20240101000021` | `src/features/platform/use-cases/accept-invitation.ts` | Invited user accepts Salon invitation. |
| `accept_invitation_admin(...)` | `20240101000006_invite_admin_accept.sql`, updated by `20240101000021` | `src/features/platform/use-cases/accept-invitation.ts` | Server-side creation of Salon + Owner after Auth account handling. |
| `create_salon_with_owner(...)` | `20240101000002_rbac_seed_and_platform.sql`, `20240101000006`, `20240101000009` | `src/features/platform` | Atomic Salon + Owner setup. |
| `platform_salon_overviews()` | `20240101000025_platform_salon_overviews.sql`, `20240101000026_platform_salon_overviews_grants.sql` | `src/features/platform/data/salon-overviews.repo.ts` | Platform read model for `/admin/salons`. Keeps Salon overview reads at one RPC instead of N queries per Salon; executable only through `service_role`. |
| `platform_audit_log` | `20240101000027_platform_audit_log.sql` | `src/features/audit/data/audit-log.repo.ts`, `src/features/audit/publish-audit-event.ts`, `src/features/platform/data/platform-audit.repo.ts`, `src/features/platform/use-cases/get-platform-audit-log.ts` | Audit trail for high-impact Platform and billing actions. Written only by the audit event handler (server-only `features/audit` module) after each use case commits; read through the Platform repository; readable by Platform admins through RLS and `/admin/audit`. |
| `delete_salon_completely(p_salon_id uuid)` | `20240101000016_delete_salon_completely_rpc.sql` | `src/features/platform/data/delete-salon.repo.ts` | Transactional public data deletion for a Salon. Auth cleanup happens after RPC. |

Complete Salon deletion is irreversible and must remain Platform-only.

## Profile And Owner Protection

| Contract | SQL source | TypeScript owner | Purpose |
|---|---|---|---|
| `protect_profile_privileges()` trigger | `20240101000005_profile_privilege_guard.sql` | `src/infra/auth`, `src/features/access`, `src/features/employees` | Prevents unauthorized privilege changes on Profile rows. |
| `ensure_salon_has_owner()` trigger | `20240101000005_profile_privilege_guard.sql`, updated by `20240101000014` | `src/features/platform`, `src/features/employees` | Prevents removing the last Owner from a Salon while allowing service_role cleanup. |

## Notification Contracts

| Contract | SQL source | TypeScript owner | Purpose |
|---|---|---|---|
| `notification_templates` table/RLS | `20240101000000_initial_schema.sql`, `20240101000001_rls_and_functions.sql` | `src/features/notifications` | Stores Salon-level Plantilla records. |
| Template events/placeholders | ADR 0007 | `src/features/notifications/domain/templates.ts`, `src/features/notifications/schemas.ts` | Defines supported operational messages and allowed placeholders. |
| Reminder queue | appointments, employees, salons, `notification_templates` | `src/features/reminders/use-cases/get-reminder-queue.ts` | Builds the operational worklist for reminder sending. |
| `appointment_reminder_log` table/RLS | `20240101000000_initial_schema.sql`, `20240101000001_rls_and_functions.sql` | `src/features/reminders` | Stores reminder send/audit records when the flow becomes active. |

## Archive And Reactivation Contracts

| Domain | SQL fields | TypeScript owner | Contract |
|---|---|---|---|
| Cliente | `customers.is_active`, `customers.is_temporary` | `src/features/customers/use-cases` | Salon delete means archive unless the customer is temporary. |
| Colaborador | `employees.is_active`, `employees.profile_id` | `src/features/employees/use-cases` | Archive preserves operational history and revokes access when needed. |

ADR 0004 is the product-level contract. SQL stores the flags; TypeScript owns user-facing lifecycle orchestration.

## Expense Read Models

| Contract | SQL source | TypeScript owner | Purpose |
|---|---|---|---|
| `report_expense_month_totals(p_salon_id uuid, p_from date, p_to date)` | `20240101000068_report_expense_month_totals.sql` | `src/features/expenses/data/rpc/report-expense-month-totals.ts` | Totales del mes y desglose por categoria de gastos, calculados en Postgres sin limite de filas. Agrega gastos manuales de `expenses` y compras de inventario como `products`. Es `security invoker` (aplican RLS y filtro explicito por salon) y solo `authenticated` puede ejecutarla. |

## Transactional RPC Contracts

ADR 0024: lo que debe ser atómico vive en una sola RPC. Una llamada RPC es una transacción; si un paso falla, no queda nada escrito. Todas estas funciones siguen el mismo patrón: `revoke all` a `public`, `anon`, `service_role` y grant de `execute` solo a `authenticated`, con `set search_path = public, pg_temp`.

| Contract | SQL source | Seguridad | Grants | Errores (SQLSTATE) | TypeScript owner | Prueba pgTAP |
|---|---|---|---|---|---|---|
| `create_role_with_permissions(p_name text, p_permission_keys text[]) returns uuid` | `20240101000070_role_permission_rpcs.sql` | `security invoker`: aplican RLS de `roles` y `role_permissions` | `authenticated` | `42501` sin `roles.manage`; `22023` si alguna clave no existe en `public.permissions` (no escribe nada) | `src/features/access/data/rpc/role-permissions-rpc.ts` | `11_role_permission_rpcs.sql` |
| `replace_role_permissions(p_role_id uuid, p_permission_keys text[]) returns void` | `20240101000070_role_permission_rpcs.sql` | `security invoker`; bloquea la fila del rol con `for update` | `authenticated` | `42501` sin `roles.manage`; `P0002` si el rol no existe o no es del salón del claim; `22023` por claves inválidas. Lista vacía = sin permisos | `src/features/access/data/rpc/role-permissions-rpc.ts` | `11_role_permission_rpcs.sql` |
| `invite_salon(p_email text, p_plan_id uuid default null) returns text` | `20240101000071_invite_salon_with_plan.sql` | `security definer`, con `is_platform_admin()` dentro; guarda solo el hash del token | `authenticated` (la comprobación de plataforma va dentro) | error sin código si no es admin de plataforma; `22023` si el plan no existe o está archivado | `src/features/platform/use-cases/invite-salon.ts` | `12_invitations.sql` |
| `create_appointment(payload jsonb) returns uuid` con `new_customer` | `20240101000072_create_appointment_new_customer.sql` | `security definer`, con `has_permission(appointments.manage)` y, si hay `new_customer`, `has_permission(customers.manage)` | `authenticated` | `22023` si se envían `customer_id` y `new_customer` a la vez o ninguno, o si el nombre/apellido están vacíos o superan 100 caracteres; `P0001` si el teléfono pertenece a un cliente archivado | `src/features/appointments/data/rpc/create-appointment.ts`, `src/features/appointments/use-cases/create-appointment.ts` | `13_create_appointment_new_customer.sql` |
| `resolve_new_customer(p_salon uuid, p_data jsonb) returns uuid` (helper interno) | `20240101000072_create_appointment_new_customer.sql` | `security definer`, sin acceso directo | Ninguno: `revoke all` a todos los roles | Igual que arriba (`22023`, `P0001`) | Solo lo llama `create_appointment` | `13_create_appointment_new_customer.sql` |

Notas de cada contrato:

- Los errores se traducen a mensajes públicos en la capa de aplicación (ADR 0018). Nunca se muestra el mensaje crudo de Postgres.
- `create_appointment` conserva el tipo de retorno `uuid` (id de la cita). El id del cliente nuevo no se devuelve; se consulta desde la cita.
- La clave de idempotencia de `create_appointment` cubre el payload completo, incluido `new_customer`: un reenvío devuelve la misma cita y no crea un segundo cliente.
- `resolve_new_customer` reutiliza un cliente temporal con el mismo teléfono, o un cliente activo con ese teléfono, y crea un temporal inactivo en otro caso.
- Auth no forma parte de estas transacciones. En colaboradores se escribe primero en BD y después se modifica la cuenta de Auth; si Auth falla, la operación devuelve un aviso (ADR 0024).

## Billing Tenant Contracts

ADR 0025: las lecturas de billing del propio salón pasan por RLS con el cliente del usuario (`billingSalonDb()`). El panel de plataforma sigue con `service_role` (`billingDb()`). Migración `20240101000073_billing_tenant_rls.sql`, forward-only: solo cambia políticas, grants y funciones, no datos.

### Políticas (RLS)

| Tabla | Política o regla | Quién lee | TypeScript owner |
|---|---|---|---|
| `commercial_plans` | `commercial_plans_select`: plataforma, o `status = 'active'`, o el plan asignado al salón de `public.salon_id()` (aunque esté archivado). Los borradores solo los ve plataforma | `authenticated` | `src/features/billing/data/commercial-plans.repo.ts`, `salon-subscriptions-reads.repo.ts` |
| `commercial_plan_modules`, `commercial_plan_limits` | Solo si el plan padre es visible para el usuario (la RLS del padre aplica) | `authenticated` (ya no `anon`) | `commercial-plans.repo.ts` |
| `salon_plan_payments` | `salon_plan_payments_select`: solo `is_platform_admin()` | Plataforma | `salon-subscriptions-reads.repo.ts` (`findSalonPayments`, `service_role`) |
| `commercial_addons`, `commercial_limit_metrics`, `platform_modules` | Solo `authenticated`. Archivados o inactivos visibles solo para plataforma | `authenticated` | `commercial-addons.repo.ts` |
| `salon_plan_overrides`, `salon_plan_alerts`, `salon_plan_assignments` | Política por `salon_id` sin cambios; el `select` de tabla queda revocado y se concede por columnas (siguiente tabla) | Salón (columnas concedidas) | `salon-subscriptions-reads.repo.ts` (`findEffectivePlanRowsForSalon`, `findOpenSalonAlerts`) |

### Columnas concedidas al salón

Revocado `select` de tabla a `anon` y `authenticated` en estas tablas; se concede `select (columnas)` a `authenticated`. Lo que no aparece en la lista es interno y solo lo lee plataforma con `service_role`.

| Tabla | Columnas concedidas | Columnas internas (no concedidas) |
|---|---|---|
| `salon_plan_overrides` | `id, salon_id, module_key, metric_key, module_enabled, max_delta, max_override, enforcement_mode, warning_threshold, starts_at, ends_at, status, addon_id, quantity` | `reason`, `price_override`, `is_gift` |
| `salon_plan_alerts` | `id, salon_id, plan_id, metric_key, module_key, severity, message, status, created_at` | Ninguna relevante hoy; cualquier columna nueva queda fuera por defecto |
| `salon_plan_assignments` | `id, salon_id, plan_id, status, starts_at, ends_at, trial_ends_at, current_period_start, current_period_end, created_at, updated_at` | `notes` |

### Funciones

| Contract | SQL source | Seguridad | Grants | Errores | TypeScript owner | Prueba pgTAP |
|---|---|---|---|---|---|---|
| `count_salon_usage(p_salon_id uuid, p_counters jsonb) returns jsonb` | `20240101000073_billing_tenant_rls.sql` | `security definer`, `set search_path = public, pg_temp`. Guarda: si `auth.role()` no es `service_role`, exige `p_salon_id = public.salon_id()` o `is_platform_admin()` | `revoke` a `public` y `anon`; `execute` a `authenticated` y `service_role` | `42501` si el salón no es el de la sesión ni es plataforma. Contador desconocido cuenta 0 | `src/features/billing/data/salon-subscriptions-usage.repo.ts` | `supabase/tests/19_billing_tenant_rls.sql`; integración `src/features/billing/data/salon-subscriptions-tenant.rpc.test.ts` |
| `record_plan_alert(p_plan_id uuid, p_metric_key text, p_module_key text, p_severity text, p_message text) returns uuid` | `20240101000073_billing_tenant_rls.sql` | `security definer`, `set search_path = public, pg_temp`. No recibe `salon_id`: usa `public.salon_id()` de la sesión | `revoke` a `public` y `anon`; `execute` a `authenticated` | `42501` si la sesión no tiene salón | `src/features/billing/data/salon-subscriptions-writes.repo.ts` (`recordPlanAlert`) | `supabase/tests/19_billing_tenant_rls.sql`; integración `src/features/billing/data/salon-subscriptions-tenant.rpc.test.ts` |

Notas:

- `count_salon_usage` es `security definer` para que el conteo no dependa de la RLS del llamante: un miembro sin permiso de lectura no vería menos filas y no podría saltarse un límite del plan. La guarda interna es la autoridad.
- Las escrituras de plataforma sobre una fila de salón (`salon-subscriptions-writes.repo.ts`) filtran por `salon_id` y usan `expectOneUpdatedRow`: cero o varias filas son error.
- Los mensajes de error se traducen en la capa de aplicación (ADR 0018).

## Maintenance Notes

- `recalc_appointment()`: el total de la cabecera (`total_price`) suma el `price` de **todos** los `appointment_items` de la cita, sin filtrar por estado. Los items cancelados o marcados como no-show siguen en la tabla (con `blocks_calendar = false`) y siguen sumando al total de la cabecera. Cambiar esto exige una migración nueva y revisar el contrato de citas.
- Limpieza de `idempotency_keys` (migración `20240101000065`): cada llamada a `idempotency_begin` borra como mucho 100 claves con más de 7 días. Es una limpieza oportunista y acotada.
- Limpieza de `rate_limit_buckets` (migración `20240101000064`): cada llamada a la función de rate limit borra como mucho 100 cubos expirados.
- Con esta limpieza oportunista basta mientras no se mida crecimiento de estas tablas. Si se mide, se añadiría `pg_cron` para una purga periódica; está fuera de alcance de este documento.

## Allowed Duplication

Allowed duplication exists when TypeScript improves UX and SQL remains final authority:

- appointment availability prechecks in TypeScript + no-overlap/assignment checks in SQL.
- collaborator assignment checks in TypeScript + same-Salon assignment constraints in SQL.
- tenant ownership checks in repos + RLS policies.
- permission checks in Server Actions/use-cases + SQL policies.
- form validation in Zod + database constraints.

If a rule is duplicated, comments or docs should make the final authority obvious.

## Change Checklist

Before changing migrations, RPCs, triggers or RLS:

1. Identify the TypeScript owner Module.
2. Check related ADRs.
3. Decide whether SQL or TypeScript is authoritative.
4. Update generated database types if schema changed.
5. Add or update tests for the TypeScript Interface.
6. Add integration/manual checks for RLS or RPC behavior when security is affected.

## Generated Types Contract

`src/types/database.types.ts` is generated from the linked Supabase project with:

```text
npm run db:types
```

It is part of the SQL-to-TypeScript contract and should not be edited manually.
After any schema, enum, view or RPC change:

1. Confirm local and remote migration versions with `npx supabase migration list`.
2. Regenerate `src/types/database.types.ts`.
3. Review the diff.
4. Run `npm run type-check`.
5. Run affected unit/RPC/RLS tests.

Phase 26 regenerated the file against the linked project after confirming local
and remote migrations match through `20240101000026`. Phase 31 added
`20240101000027_platform_audit_log.sql`. Phase 40 added
`20240101000028_optimize_rls_policy_performance.sql`; it changes policies only,
so generated table types should not materially change, but `npm run db:types`
must still be executed after applying it to keep the workflow consistent.

## Supabase Test Contract

RPC/RLS tests that need a real Supabase project are documented in `docs/testing.md`.

At minimum, security-sensitive database changes should verify:

- tenant isolation through RLS.
- `create_appointment(payload jsonb)` behavior when appointment payloads are manipulated.
- `appointment_items` overlap protection.
- Platform-only access for cross-tenant reads and destructive operations.
- `database.types.ts` regenerated after schema changes.

## Scale Readiness Evidence 2026-06-01

For Fase 47 of `docs/archive/architecture-history/architecture-scale-phases-2026-06-01.md`, the critical
RPC/RLS checks were re-run with Supabase fixtures:

```text
npm run test -- src/features/appointments/use-cases/create-appointment.rpc.test.ts src/features/platform/data/salon-overviews.rpc.test.ts
```

Result:

```text
2 test files passed
5 tests passed
```

Coverage:

- `create_appointment(payload jsonb)` rejects manipulated cross-tenant
  customer/service payloads.
- Appointment overlap protection remains enforced by the SQL contract.
- `platform_salon_overviews()` stays Platform-only and is denied to normal
  tenant users.

The deployed staging E2E pass is still a separate launch-wide gate because it
validates routing, cookies, Vercel middleware and the deployed runtime, not only
the database contract.
