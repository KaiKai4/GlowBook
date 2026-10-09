import { randomUUID } from "node:crypto";
import type { TestSupabaseClient } from "../../src/test/supabase-integration-fixtures";

// Colaborador con un rol de permisos limitados (solo appointments.manage) en un salón existente.
export interface LimitedCollaboratorFixture {
  email: string;
  password: string;
  userId: string;
  roleId: string;
}

export async function createLimitedCollaboratorFixture(
  admin: TestSupabaseClient,
  salonId: string
): Promise<LimitedCollaboratorFixture> {
  const stamp = Date.now();
  const email = `glowbook.limited.${stamp}.${randomUUID()}@example.com`;
  const password = "GlowBookTest123!";

  const { data: permission, error: permissionError } = await admin
    .from("permissions")
    .select("id")
    .eq("key", "appointments.manage")
    .single();
  if (permissionError) throw permissionError;

  const { data: role, error: roleError } = await admin
    .from("roles")
    .insert({ salon_id: salonId, name: `E2E Colaborador limitado ${stamp}` })
    .select("id")
    .single();
  if (roleError) throw roleError;

  const { error: rolePermissionError } = await admin.from("role_permissions").insert({
    role_id: role.id,
    permission_id: permission.id,
    salon_id: salonId,
  });
  if (rolePermissionError) {
    await admin.from("roles").delete().eq("id", role.id);
    throw rolePermissionError;
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    await admin.from("roles").delete().eq("id", role.id);
    throw authError ?? new Error("Auth user not created");
  }

  const userId = authData.user.id;
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    salon_id: salonId,
    role_id: role.id,
    is_owner: false,
    full_name: "E2E Colaborador limitado",
    is_active: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("roles").delete().eq("id", role.id);
    throw profileError;
  }

  return { email, password, userId, roleId: role.id };
}

export async function cleanupLimitedCollaboratorFixture(
  admin: TestSupabaseClient,
  fixture: LimitedCollaboratorFixture
): Promise<void> {
  await admin.auth.admin.deleteUser(fixture.userId);
  await admin.from("roles").delete().eq("id", fixture.roleId);
}
