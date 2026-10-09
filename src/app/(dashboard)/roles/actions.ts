"use server";

import { revalidatePath } from "next/cache";
import { createRoleWithPermissions } from "@/features/access/use-cases/create-role";
import { deleteSalonRole } from "@/features/access/use-cases/delete-role";
import { updateRolePermissions } from "@/features/access/use-cases/update-role-permissions";
import {
  CreateRoleSchema,
  UpdateRolePermissionsSchema,
} from "@/features/access/schemas";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { parseUuid } from "@/infra/validation/route-id";
import type { Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar roles." };
  }

  const limited = await assertActionRateLimit(profile.id, "roles", { max: 30, windowMs: 60_000 });
  if (!limited.ok) return limited;

  return { ok: true, value: { salonId: profile.salon_id } };
}

function parsePermissionKeys(formData: FormData): Result<string[]> {
  const raw = formData.get("permission_keys");
  if (typeof raw !== "string" || raw.trim() === "") return { ok: true, value: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return { ok: false, error: "Permisos invalidos." };
    }

    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: "Permisos invalidos." };
  }
}

export async function createRoleAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const permissionKeys = parsePermissionKeys(formData);
  if (!permissionKeys.ok) return permissionKeys;

  const parsed = CreateRoleSchema.safeParse({
    name: formData.get("name"),
    permission_keys: permissionKeys.value,
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await createRoleWithPermissions(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/roles");
  return result;
}

export async function updateRolePermissionsAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const permissionKeys = parsePermissionKeys(formData);
  if (!permissionKeys.ok) return permissionKeys;

  const parsed = UpdateRolePermissionsSchema.safeParse({
    role_id: formData.get("role_id"),
    permission_keys: permissionKeys.value,
  });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await updateRolePermissions(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/roles");
  return result;
}

export async function deleteRoleAction(roleId: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;
  if (!parseUuid(roleId)) return { ok: false, error: "Identificador inválido." };

  const result = await deleteSalonRole(guarded.value.salonId, roleId);
  if (result.ok) revalidatePath("/roles");
  return result;
}
