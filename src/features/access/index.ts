// Punto publico del modulo access. Otros módulos y las rutas importan solo desde aquí.
// Indice de servidor: incluye casos de uso que consultan la base de datos. Los
// componentes cliente solo deben importar tipos de este indice (import type).
import "server-only";

export {
  PERMISSIONS,
  getDisabledSalonFeatures,
  getPermissions,
  hasPermission,
} from "./domain/permission-checks";
export type { Permission } from "./domain/permission-checks";
export { withDisabledFeatures } from "./domain/with-disabled-features";
export type { ActionContext, RequestContext } from "./domain/request-context";
export { getAssignableRoleOptions } from "./use-cases/role-options";
export { isPlatformAdminUser } from "./data/platform-admins.repo";

export { createRoleWithPermissions } from "./use-cases/create-role";
export { deleteSalonRole } from "./use-cases/delete-role";
export { updateRolePermissions } from "./use-cases/update-role-permissions";
export { parseCreateRoleForm, parseUpdateRolePermissionsForm } from "./use-cases/parse-role-input";
export { getRolesPage } from "./use-cases/get-roles-page";
export { loadSalonAccessState, loadSessionProfile } from "./use-cases/session-access";
