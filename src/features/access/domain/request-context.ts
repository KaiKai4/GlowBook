import type { ProfileWithRole } from "@/types/app.types";
import type { Permission } from "./permission-checks";

/**
 * Contexto minimo que reciben los casos de uso de una accion de salon: solo lo
 * que necesitan para decidir (quien, en que salon, con que permisos y la traza).
 * Lo construye el composition root (src/app/_composition).
 */
export interface ActionContext {
  userId: string;
  salonId: string;
  permissions: Permission[];
  requestId: string;
  /** Si el plan del salon incluye el modulo de roles (calculado una vez por request). */
  rolesEnabled: boolean;
}

/**
 * Contexto completo de una request autenticada. Solo lo usa el composition root
 * para resolver permisos y pagina; los casos de uso reciben ActionContext.
 */
export interface RequestContext extends ActionContext {
  /** Perfil con los modulos efectivos del plan (disabled_features ya resuelto). */
  profile: ProfileWithRole;
}
