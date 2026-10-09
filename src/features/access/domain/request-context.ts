import type { ProfileWithRole } from "@/types/app.types";
import type { Permission } from "./permission-checks";

/**
 * Contexto de una request autenticada. Lo construye solo el composition root
 * (src/app/_composition) y lo reciben los casos de uso por parametro.
 */
export interface RequestContext {
  userId: string;
  salonId: string;
  /** Perfil con los modulos efectivos del plan (disabled_features ya resuelto). */
  profile: ProfileWithRole;
  permissions: Permission[];
  requestId: string;
}
