import "server-only";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import type { Database } from "@/types/database.types";

// Acceso de colaboradores: roles asignables y perfiles vinculados. Las invitaciones
// viven en employee-invitations.repo.ts.

export type DbError = { message: string; status?: number };

export interface EmployeeAccessProfile {
  role_id: string | null;
  is_owner: boolean;
}

export async function findAssignableEmployeeRole(
  salonId: string,
  roleId: string
): Promise<{ data: { id: string } | null; error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("salon_id", salonId)
    .eq("is_system", false)
    .maybeSingle();

  return { data, error };
}

export async function findEmployeeAccessProfile(
  profileId: string,
  salonId: string
): Promise<{ data: EmployeeAccessProfile | null; error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role_id, is_owner")
    .eq("id", profileId)
    .eq("salon_id", salonId)
    .maybeSingle();

  return { data, error };
}

export async function unlinkEmployeeProfile(
  employeeId: string,
  salonId: string
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employees")
    .update({ profile_id: null })
    .eq("id", employeeId)
    .eq("salon_id", salonId);

  return { error };
}

export async function updateEmployeeProfileRole(
  profileId: string,
  salonId: string,
  roleId: string | null
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role_id: roleId })
    .eq("id", profileId)
    .eq("salon_id", salonId);

  return { error };
}

export async function insertEmployeeProfile(
  input: Database["public"]["Tables"]["profiles"]["Insert"]
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").insert(input);
  return { error };
}

export async function linkEmployeeProfile(
  employeeId: string,
  salonId: string,
  profileId: string
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employees")
    .update({ profile_id: profileId })
    .eq("id", employeeId)
    .eq("salon_id", salonId);

  return { error };
}
