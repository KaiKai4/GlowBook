// Punto publico del modulo access. Otros modulos y las rutas importan solo desde aqui.
// Modulo puro (sin I/O): seguro para componentes cliente.
export {
  PERMISSIONS,
  getDisabledSalonFeatures,
  getPermissions,
  hasPermission,
} from "./domain/permission-checks";
export type { Permission } from "./domain/permission-checks";
export type { RequestContext } from "./domain/request-context";
