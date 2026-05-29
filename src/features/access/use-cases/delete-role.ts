import "server-only";

import type { Result } from "@/lib/result";
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
      error: error instanceof Error ? error.message : "Error al eliminar el rol.",
    };
  }
}
