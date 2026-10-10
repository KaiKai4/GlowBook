# Access Module

Responsabilidad: permisos y roles por salón, contexto de petición (`RequestContext`) y lectura del estado de acceso de la sesión.

Interface principal (`index.ts`, con `server-only`):

- `hasPermission`, `getPermissions`, `getDisabledSalonFeatures`, `PERMISSIONS`: comprobaciones puras sobre permisos.
- `withDisabledFeatures`, tipos `RequestContext` y `ActionContext`.
- `createRoleWithPermissions`, `updateRolePermissions`, `deleteSalonRole`, `getRolesPage`, `getAssignableRoleOptions`.
- `loadSalonAccessState`, `loadSessionProfile`, `isPlatformAdminUser`.

Casos de uso: `use-cases/create-role.ts`, `use-cases/update-role-permissions.ts`, `use-cases/delete-role.ts`, `use-cases/session-access.ts`, `use-cases/get-roles-page.ts`.

Dominio (`domain/`): `permissions.ts` (catálogo fijo) y `permission-checks.ts` (equivalente TypeScript de `public.has_permission`). Nunca se compara por nombre de rol.

Tablas y RPC que usa:

- Tablas: `roles`, `permissions`, `profiles`, `salons`, `platform_admins`.
- RPC: `create_role_with_permissions`, `replace_role_permissions`.

Reglas importantes:

- Los roles son por salón; el owner (`is_owner = true`) hace cortocircuito.
- Cada acción se autoriza por clave de permiso (`roles.manage`, `reports.view`, etc.), no por rol.
- Las funciones de rol se ejecutan con la sesión del usuario; RLS sigue siendo la autoridad final.

Tests: `domain/permission-checks.test.ts`, `domain/with-disabled-features.test.ts`, `use-cases/roles.test.ts`, `use-cases/session-access.test.ts`, `data/rpc/role-permissions-rpc.test.ts`.
