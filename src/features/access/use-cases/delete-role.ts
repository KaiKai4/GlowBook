import "server-only";

import { toPublicErrorMessage } from "@/infra/errors";
import type { Result } from "@/infra/result";
import { assertRoleDeletable } from "../domain/role-deletion";
import { deleteRole, findRoleForDelete } from "../data/roles.repo";

export async function deleteSalonRole(
  salonId: string,
  roleId: string
): Promise<Result<void>> {
  try {
    const role = await findRoleForDelete(roleId, salonId);
    assertRoleDeletable(role);
    await deleteRole(roleId, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: toPublicErrorMessage(error, "Error al eliminar el rol."),
    };
  }
}
