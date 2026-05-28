"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  createRole,
  setRolePermissions,
  assignRoleToProfile,
  deleteRole,
} from "@/features/access/data/roles.repo";
import {
  CreateRoleSchema,
  UpdateRolePermissionsSchema,
  AssignRoleSchema,
} from "@/features/access/schemas";
import type { Result } from "@/lib/result";

export async function createRoleAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar roles." };
  }

  const parsed = CreateRoleSchema.safeParse({
    name: formData.get("name"),
    permission_keys: JSON.parse((formData.get("permission_keys") as string) ?? "[]"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const roleId = await createRole(profile.salon_id, parsed.data.name);
    if (parsed.data.permission_keys.length > 0) {
      await setRolePermissions(roleId, profile.salon_id, parsed.data.permission_keys);
    }
    revalidatePath("/roles");
    return { ok: true, value: roleId };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("unique")) return { ok: false, error: "Ya existe un rol con ese nombre." };
    return { ok: false, error: "Error al crear el rol." };
  }
}

export async function updateRolePermissionsAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para gestionar roles." };
  }

  const parsed = UpdateRolePermissionsSchema.safeParse({
    role_id: formData.get("role_id"),
    permission_keys: JSON.parse((formData.get("permission_keys") as string) ?? "[]"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await setRolePermissions(parsed.data.role_id, profile.salon_id, parsed.data.permission_keys);
    revalidatePath("/roles");
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[roles]", err);
    return { ok: false, error: "Error al actualizar permisos." };
  }
}

export async function assignRoleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para asignar roles." };
  }

  const parsed = AssignRoleSchema.safeParse({
    profile_id: formData.get("profile_id"),
    role_id: formData.get("role_id"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await assignRoleToProfile(parsed.data.profile_id, parsed.data.role_id, profile.salon_id);
    revalidatePath("/roles");
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteRoleAction(roleId: string): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, PERMISSIONS.ROLES_MANAGE)) {
    return { ok: false, error: "No tienes permiso para eliminar roles." };
  }

  try {
    await deleteRole(roleId, profile.salon_id);
    revalidatePath("/roles");
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
