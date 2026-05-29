import "server-only";

import type { Result } from "@/lib/result";
import {
  createRole,
  setRolePermissions,
} from "../data/roles.repo";
import type { CreateRoleInput } from "../schemas";
import {
  hasOnlyKnownPermissionKeys,
  uniquePermissionKeys,
} from "./permissions";

function isUniqueConstraintError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return code === "23505" || message.includes("unique") || message.includes("duplicate");
}

export async function createRoleWithPermissions(
  salonId: string,
  input: CreateRoleInput
): Promise<Result<string>> {
  const permissionKeys = uniquePermissionKeys(input.permission_keys);
  if (!hasOnlyKnownPermissionKeys(permissionKeys)) {
    return { ok: false, error: "Uno o mas permisos no son validos." };
  }

  try {
    const roleId = await createRole(salonId, input.name);
    if (permissionKeys.length > 0) {
      await setRolePermissions(roleId, salonId, permissionKeys);
    }

    return { ok: true, value: roleId };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe un rol con ese nombre." };
    }

    return { ok: false, error: "Error al crear el rol." };
  }
}
