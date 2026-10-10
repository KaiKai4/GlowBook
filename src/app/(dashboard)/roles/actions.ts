"use server";

import { RATE_LIMIT_POLICIES } from "@/infra/security/rate-limit-policies";
import { defineAction } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import type { CreateRoleInput, UpdateRolePermissionsInput } from "@/features/access/schemas";
import { createRoleWithPermissions } from "@/features/access/use-cases/create-role";
import { deleteSalonRole } from "@/features/access/use-cases/delete-role";
import {
  parseCreateRoleForm,
  parseUpdateRolePermissionsForm,
} from "@/features/access/use-cases/role-form-input";
import { updateRolePermissions } from "@/features/access/use-cases/update-role-permissions";
import { err, ok, type Result } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";

// Politica comun de las acciones de roles: permiso por clave y limite por usuario.
const ROLE_GUARD = {
  permission: { key: PERMISSIONS.ROLES_MANAGE, deniedMessage: "No tienes permiso para gestionar roles." },
  rateLimit: { scope: "roles", options: RATE_LIMIT_POLICIES.restricted },
};

const createRoleFlow = defineAction<FormData, CreateRoleInput, string>({
  ...ROLE_GUARD,
  parse: parseCreateRoleForm,
  run: (input) => createRoleWithPermissions(input),
  revalidate: () => ["/roles"],
});

const updateRolePermissionsFlow = defineAction<FormData, UpdateRolePermissionsInput, void>({
  ...ROLE_GUARD,
  parse: parseUpdateRolePermissionsForm,
  run: (input) => updateRolePermissions(input),
  revalidate: () => ["/roles"],
});

const deleteRoleFlow = defineAction<string, string, void>({
  ...ROLE_GUARD,
  parse: (roleId) => (parseUuid(roleId) ? ok(roleId) : err("Identificador inválido.")),
  run: (roleId, session) => deleteSalonRole(session.salonId, roleId),
  revalidate: () => ["/roles"],
});

export async function createRoleAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createRoleFlow(formData);
}

export async function updateRolePermissionsAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return updateRolePermissionsFlow(formData);
}

export async function deleteRoleAction(roleId: string): Promise<Result<void>> {
  return deleteRoleFlow(roleId);
}
