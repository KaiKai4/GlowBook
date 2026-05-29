import "server-only";

import type { Result } from "@/lib/result";
import { assignRoleToProfile } from "../data/roles.repo";
import type { AssignRoleInput } from "../schemas";

export async function assignRole(
  salonId: string,
  input: AssignRoleInput
): Promise<Result<void>> {
  try {
    await assignRoleToProfile(input.profile_id, input.role_id, salonId);
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al asignar el rol.",
    };
  }
}
