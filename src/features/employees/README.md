# Employees Module

Responsabilidad: colaboradores, horarios, asignaciones, acceso al sistema e
invitaciones de colaborador.

Interface principal:

- `use-cases/employee-profile-create.ts` y `use-cases/employee-profile-update.ts` (alta y edicion de perfil; pasos reutilizables en `use-cases/employee-profile-steps.ts`)
- `use-cases/employee-role.ts` (cambio de rol)
- `use-cases/employee-invitation-issue.ts` (emision y limpieza de invitaciones de acceso)
- `use-cases/employee-revocation.ts` (revocacion y reinicio de acceso)
- `use-cases/employee-invitations.ts`
- `use-cases/employee-lifecycle.ts`
- `use-cases/employee-schedule.ts`
- `use-cases/get-employees-page.ts`
- `use-cases/get-employee-detail.ts`

Autoridad final:

- SQL mantiene integridad por `salon_id`.
- `domain/collaborator-assignment.ts` valida reglas puras de asignacion.
- use-cases orquestan lifecycle, roles e invitaciones.

Adapters externos:

- `data/employees-read.repo.ts` (lecturas), `data/employees-write.repo.ts` (RPC y actualizacion) y `data/work-schedules.repo.ts` (horarios) para datos de colaboradores; la cadena select compartida vive en `data/employees-select.ts`.
- `data/employee-access.repo.ts` para perfiles y roles.
- `data/employee-invitations.repo.ts` para todas las consultas de invitaciones.
- `data/employee-auth.repo.ts` para Auth Admin de colaboradores.

Tests que protegen el Module:

- `domain/collaborator-assignment.test.ts`
- `use-cases/employee-role.test.ts`
- `use-cases/employee-invitation-issue.test.ts`
- `use-cases/employee-revocation.test.ts`
- `use-cases/employee-invitations.test.ts`
- `use-cases/employee-lifecycle.test.ts`
- `use-cases/get-employee-detail.test.ts`
- `use-cases/get-employees-page.test.ts`

No debe vivir aqui:

- operaciones Platform cross-tenant.
- UI global de layout.
- llamadas directas desde use-cases a `@/infra/supabase/auth-admin`.
