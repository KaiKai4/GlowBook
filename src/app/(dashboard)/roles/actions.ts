"use server";

import { revalidatePath } from "next/cache";
import { assignRole } from "@/features/access/use-cases/assign-role";
import { createRoleWithPermissions } from "@/features/access/use-cases/create-role";
import { deleteSalonRole } from "@/features/access/use-cases/delete-role";
import { updateRolePermissions } from "@/features/access/use-cases/update-role-permissions";
import {
  AssignRoleSchema,
  CreateRoleSchema,
  UpdateRolePermissionsSchema,
} from "@/features/access/schemas";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import type { Result } from "@/lib/result";

async function guard(): Promise<Result<{ salonId: string }>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar roles." };
  }

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
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

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
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await updateRolePermissions(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/roles");
  return result;
}

export async function assignRoleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const parsed = AssignRoleSchema.safeParse({
    profile_id: formData.get("profile_id"),
    role_id: formData.get("role_id"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await assignRole(guarded.value.salonId, parsed.data);
  if (result.ok) revalidatePath("/roles");
  return result;
}

export async function deleteRoleAction(roleId: string): Promise<Result<void>> {
  const guarded = await guard();
  if (!guarded.ok) return guarded;

  const result = await deleteSalonRole(guarded.value.salonId, roleId);
  if (result.ok) revalidatePath("/roles");
  return result;
}
