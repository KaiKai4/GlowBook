// Punto publico del modulo access. Otros modulos y las rutas importan solo desde aqui.
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
export type { RequestContext } from "./domain/request-context";
export { getAssignableRoleOptions } from "./use-cases/role-options";
