import { captureError } from "@/infra/observability";
import "server-only";

import type { Result } from "@/infra/result";
import { replaceRolePermissionsRpc } from "../data/rpc/role-permissions-rpc";
import type { UpdateRolePermissionsInput } from "../schemas";
import {
  hasOnlyKnownPermissionKeys,
  uniquePermissionKeys,
} from "./permissions";
import { rolePermissionsErrorMessage } from "./role-permission-errors";

// Una sola llamada RPC: los permisos anteriores se borran y se insertan los nuevos en la misma
// transaccion, sin dejar el rol a medias. El salon sale del claim (no del parametro).
export async function updateRolePermissions(
  input: UpdateRolePermissionsInput
): Promise<Result<void>> {
  const permissionKeys = uniquePermissionKeys(input.permission_keys);
  if (!hasOnlyKnownPermissionKeys(permissionKeys)) {
    return { ok: false, error: "Uno o más permisos no son válidos." };
  }

  try {
    await replaceRolePermissionsRpc(input.role_id, permissionKeys);
    return { ok: true, value: undefined };
  } catch (error) {
    const message = rolePermissionsErrorMessage(error);
    if (message) return { ok: false, error: message };

    captureError(error, { module: "access", action: "update_role_permissions" });
    return { ok: false, error: "Error al actualizar permisos." };
  }
}
