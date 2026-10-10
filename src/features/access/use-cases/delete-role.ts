import "server-only";

import { toPublicErrorMessage } from "@/infra/errors";
import type { Result } from "@/infra/result";
import { assertRoleDeletable } from "../domain/role-deletion";
import { deleteRole, findRoleForDelete } from "../data/roles.repo";

/** Dependencias del caso de uso. Producción usa las funciones reales; los tests inyectan fakes. */
export interface DeleteSalonRoleDeps {
  findRoleForDelete: (roleId: string, salonId: string) => Promise<{ is_system: boolean } | null>;
  deleteRole: (roleId: string, salonId: string) => Promise<void>;
}

const defaultDeleteSalonRoleDeps: DeleteSalonRoleDeps = {
  findRoleForDelete,
  deleteRole,
};

export async function deleteSalonRole(
  salonId: string,
  roleId: string,
  deps: DeleteSalonRoleDeps = defaultDeleteSalonRoleDeps
): Promise<Result<void>> {
  try {
    const role = await deps.findRoleForDelete(roleId, salonId);
    assertRoleDeletable(role);
    await deps.deleteRole(roleId, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: toPublicErrorMessage(error, "Error al eliminar el rol."),
    };
  }
}
