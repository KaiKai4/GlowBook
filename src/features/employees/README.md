# Employees Module

Responsabilidad: colaboradores, horarios, asignaciones, acceso al sistema e
invitaciones de colaborador.

Interface principal:

- `use-cases/employee-profile.ts`
- `use-cases/employee-access.ts`
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

- `data/employees.repo.ts` para datos de colaboradores.
- `data/employee-access.repo.ts` para perfiles, roles e invitaciones.
- `data/employee-auth.repo.ts` para Auth Admin de colaboradores.

Tests que protegen el Module:

- `domain/collaborator-assignment.test.ts`
- `use-cases/employee-access.test.ts`
- `use-cases/employee-invitations.test.ts`
- `use-cases/employee-lifecycle.test.ts`
- `use-cases/get-employee-detail.test.ts`
- `use-cases/get-employees-page.test.ts`

No debe vivir aqui:

- operaciones Platform cross-tenant.
- UI global de layout.
- llamadas directas desde use-cases a `@/infra/supabase/auth-admin`.
