import "server-only";

import { createSupabaseServerClient } from "@/infra/supabase/server";
import { parseRpcResponse } from "@/infra/supabase/rpc-response";
import { z } from "@/infra/validation/zod";

// Adaptadores finos de las RPC atomicas de roles (ver migracion 20240101000070). Cada operacion es
// una sola llamada: la transaccion vive en la base y los errores (42501, 22023, P0002) se propagan
// tal cual para que el caso de uso los traduzca a mensajes publicos.

const RoleIdSchema = z.string().uuid();

/** Crea el rol y le asigna sus permisos en una sola transaccion. Devuelve el id del rol. */
export async function createRoleWithPermissionsRpc(
  name: string,
  permissionKeys: string[]
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const response = await supabase.rpc("create_role_with_permissions", {
    p_name: name,
    p_permission_keys: permissionKeys,
  });
  return parseRpcResponse("create_role_with_permissions", response, RoleIdSchema);
}

/** Sustituye el conjunto de permisos del rol en una sola transaccion. Lista vacia = sin permisos. */
export async function replaceRolePermissionsRpc(
  roleId: string,
  permissionKeys: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const response = await supabase.rpc("replace_role_permissions", {
    p_role_id: roleId,
    p_permission_keys: permissionKeys,
  });
  parseRpcResponse("replace_role_permissions", response, z.null());
}
