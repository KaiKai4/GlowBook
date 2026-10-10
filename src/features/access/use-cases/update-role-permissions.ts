import { captureError } from "@/infra/observability";
import "server-only";

import type { Result } from "@/infra/result";
import { setRolePermissions } from "../data/roles.repo";
import type { UpdateRolePermissionsInput } from "../schemas";
import {
  hasOnlyKnownPermissionKeys,
  uniquePermissionKeys,
} from "./permissions";

export async function updateRolePermissions(
  salonId: string,
  input: UpdateRolePermissionsInput
): Promise<Result<void>> {
  const permissionKeys = uniquePermissionKeys(input.permission_keys);
  if (!hasOnlyKnownPermissionKeys(permissionKeys)) {
    return { ok: false, error: "Uno o mas permisos no son validos." };
  }

  try {
    await setRolePermissions(input.role_id, salonId, permissionKeys);
    return { ok: true, value: undefined };
  } catch (error) {
    captureError(error, { module: "access", action: "update_role_permissions" });
    return { ok: false, error: "Error al actualizar permisos." };
  }
}
