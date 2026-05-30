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
| `public.salon_id()` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/lib/auth`, all tenant repos | Reads Salon tenant id from auth claims. |
| `public.is_owner()` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/lib/auth/permissions.ts` | Owner shortcut for permission checks. |
| `public.has_permission(perm text)` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/lib/auth/permissions.ts`, `src/features/access` | Dynamic RBAC check in SQL. |
| `public.is_platform_admin()` | `supabase/migrations/20240101000001_rls_and_functions.sql` | `src/lib/auth/session.ts`, `src/features/platform` | Identifies Platform superadmin accounts. |
| `public.custom_access_token_hook(event jsonb)` | `supabase/migrations/20240101000004_auth_hook.sql` | `src/lib/auth/session.ts` | Adds stable claims used by RLS helpers. |

## RLS Contracts

RLS is enabled for tenant and platform tables in `supabase/migrations/20240101000001_rls_and_functions.sql`, with later migrations refining appointment, employee invitation and feedback policies.

| Area | SQL source | TypeScript owner | Contract |
|---|---|---|---|
| Salon data isolation | `20240101000001_rls_and_functions.sql` | all `src/features/*/data` repos | Tenant data must be isolated by Salon. Code should still filter by `salon_id` for clarity and performance. |
| Salon feature availability | `20240101000023_salon_disabled_features.sql`, `20240101000024_salon_disabled_features_constraint.sql` | `src/features/salon/domain/salon-features.ts`, `src/lib/auth/permissions.ts`, `src/features/platform/use-cases/update-salon-features.ts` | Platform stores disabled operational modules in `salons.disabled_features`. SQL rejects unknown feature keys; UI navigation and Server Actions must enforce the same contract. |
| Appointment read/write | `20240101000001_rls_and_functions.sql`, `20240101000008_fix_appt_rls_for_all.sql`, `20240101000009_appointments_view_permission.sql` | `src/features/appointments` | Appointment access follows `appointments.view`, `appointments.view_all` and `appointments.manage`. |
| Employee invitations | `20240101000007_employee_invitations.sql` | `src/features/employees/data/employee-access.repo.ts`, `src/features/employees/use-cases/employee-access.ts`, `src/features/employees/use-cases/employee-invitations.ts` | Only authorized server flows should manage employee invitations. Use-cases orchestrate; the privileged data Adapter owns direct admin reads/writes. |
| Feedback reports | `20240101000012_feedback_reports.sql` | `src/features/feedback`, `src/features/platform` | Salon users can submit feedback; Platform can review it with admin access. |
| Platform invitations | `20240101000001_rls_and_functions.sql`, `20240101000002_rbac_seed_and_platform.sql` | `src/features/platform` | Salon creation is controlled by Platform invitation. |

## Appointment Contracts

| Contract | SQL source | TypeScript owner | Authority |
|---|---|---|---|
| `appointment_items` as schedule truth | `20240101000000_initial_schema.sql`, ADR 0002 | `src/features/appointments` | SQL schema + ADR. |
| `no_overlap_per_employee` | `20240101000000_initial_schema.sql` | `src/features/appointments/domain/availability.ts` for UX; SQL final authority | Prevents double booking per collaborator. |
| `recalc_appointment()` trigger | `20240101000001_rls_and_functions.sql` | `src/features/appointments/data/appointments.repo.ts` | Keeps appointment header start/end/total derived from items. |
| `create_appointment(payload jsonb)` | `20240101000003_create_appointment_rpc.sql`, hardened by `20240101000013`, `20240101000015`, `20240101000019` | `src/features/appointments/use-cases/create-appointment.ts` | Atomic appointment creation and final schedule integrity. |
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
| `invite_salon(p_email text)` | `20240101000002_rbac_seed_and_platform.sql` | `src/features/platform/use-cases/invite-salon.ts` | Platform creates Salon invitation. |
| `accept_invitation(...)` | `20240101000002_rbac_seed_and_platform.sql`, updated by `20240101000006`, `20240101000021` | `src/features/platform/use-cases/accept-invitation.ts` | Invited user accepts Salon invitation. |
| `accept_invitation_admin(...)` | `20240101000006_invite_admin_accept.sql`, updated by `20240101000021` | `src/features/platform/use-cases/accept-invitation.ts` | Server-side creation of Salon + Owner after Auth account handling. |
| `create_salon_with_owner(...)` | `20240101000002_rbac_seed_and_platform.sql`, `20240101000006`, `20240101000009` | `src/features/platform` | Atomic Salon + Owner setup. |
| `platform_salon_overviews()` | `20240101000025_platform_salon_overviews.sql`, `20240101000026_platform_salon_overviews_grants.sql` | `src/features/platform/data/salon-overviews.repo.ts` | Platform read model for `/admin/salons`. Keeps Salon overview reads at one RPC instead of N queries per Salon; executable only through `service_role`. |
| `delete_salon_completely(p_salon_id uuid)` | `20240101000016_delete_salon_completely_rpc.sql` | `src/features/platform/data/delete-salon.repo.ts` | Transactional public data deletion for a Salon. Auth cleanup happens after RPC. |

Complete Salon deletion is irreversible and must remain Platform-only.

## Profile And Owner Protection

| Contract | SQL source | TypeScript owner | Purpose |
|---|---|---|---|
| `protect_profile_privileges()` trigger | `20240101000005_profile_privilege_guard.sql` | `src/lib/auth`, `src/features/access`, `src/features/employees` | Prevents unauthorized privilege changes on Profile rows. |
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

## Supabase Test Contract

RPC/RLS tests that need a real Supabase project are documented in `docs/testing.md`.

At minimum, security-sensitive database changes should verify:

- tenant isolation through RLS.
- `create_appointment(payload jsonb)` behavior when appointment payloads are manipulated.
- `appointment_items` overlap protection.
- Platform-only access for cross-tenant reads and destructive operations.
- `database.types.ts` regenerated after schema changes.
