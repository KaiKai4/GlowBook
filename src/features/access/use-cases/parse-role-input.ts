import {
  CreateRoleSchema,
  UpdateRolePermissionsSchema,
  type CreateRoleInput,
  type UpdateRolePermissionsInput,
} from "@/features/access/schemas";
import { err, ok, type Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";

// Lectura y validacion del FormData de las acciones de roles. Las reglas viven
// aquí (no en la accion): el JSON de permisos y el esquema se validan en orden.

function parsePermissionKeys(formData: FormData): Result<string[]> {
  const raw = formData.get("permission_keys");
  if (typeof raw !== "string" || raw.trim() === "") return ok([]);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return err("Permisos inválidos.");
    }

    return ok(parsed);
  } catch {
    return err("Permisos inválidos.");
  }
}

export function parseCreateRoleForm(formData: FormData): Result<CreateRoleInput> {
  const permissionKeys = parsePermissionKeys(formData);
  if (!permissionKeys.ok) return permissionKeys;

  const parsed = CreateRoleSchema.safeParse({
    name: formData.get("name"),
    permission_keys: permissionKeys.value,
  });
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  return ok(parsed.data);
}

export function parseUpdateRolePermissionsForm(formData: FormData): Result<UpdateRolePermissionsInput> {
  const permissionKeys = parsePermissionKeys(formData);
  if (!permissionKeys.ok) return permissionKeys;

  const parsed = UpdateRolePermissionsSchema.safeParse({
    role_id: formData.get("role_id"),
    permission_keys: permissionKeys.value,
  });
  if (!parsed.success) return err(firstIssueMessage(parsed.error));
  return ok(parsed.data);
}
