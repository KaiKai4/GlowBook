import "server-only";

import type { Result } from "@/infra/result";
import { createRoleWithPermissionsRpc } from "../data/rpc/role-permissions-rpc";
import type { CreateRoleInput } from "../schemas";
import {
  hasOnlyKnownPermissionKeys,
  uniquePermissionKeys,
} from "./permissions";
import { rolePermissionsErrorMessage, sqlStateOf } from "./role-permission-errors";

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return sqlStateOf(error) === "23505" || message.includes("unique") || message.includes("duplicate");
}

// Una sola llamada RPC: el rol y sus permisos se crean en la misma transaccion. El salon sale del
// claim del usuario (la RPC lo toma de public.salon_id()), no de un parametro.
export async function createRoleWithPermissions(
  input: CreateRoleInput
): Promise<Result<string>> {
  const permissionKeys = uniquePermissionKeys(input.permission_keys);
  if (!hasOnlyKnownPermissionKeys(permissionKeys)) {
    return { ok: false, error: "Uno o mas permisos no son validos." };
  }

  try {
    const roleId = await createRoleWithPermissionsRpc(input.name, permissionKeys);
    return { ok: true, value: roleId };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, error: "Ya existe un rol con ese nombre." };
    }

    return { ok: false, error: rolePermissionsErrorMessage(error) ?? "Error al crear el rol." };
  }
}
