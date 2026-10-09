import "server-only";

import { toPublicErrorMessage } from "@/infra/errors";
import type { Result } from "@/infra/result";
import { deleteRole } from "../data/roles.repo";

export async function deleteSalonRole(
  salonId: string,
  roleId: string
): Promise<Result<void>> {
  try {
    await deleteRole(roleId, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: toPublicErrorMessage(error, "Error al eliminar el rol."),
    };
  }
}
