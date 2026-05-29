import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

type DbError = { message: string; status?: number };

export interface EmployeeAccessProfile {
  role_id: string | null;
  is_owner: boolean;
}

export interface EmployeeInvitationInsert {
  employee_id: string;
  salon_id: string;
  email: string;
  role_id: string | null;
  token: string;
  expires_at: string;
}

export interface EmployeeInvitationForJoin {
  id: string;
  employee_id: string;
  salon_id: string;
  email: string;
  role_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  employees: { first_name: string; last_name: string } | null;
  salons: { name: string } | null;
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

export async function deletePendingEmployeeInvitations(
  employeeId: string,
  salonId: string
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .is("accepted_at", null);

  return { error };
}

export async function insertEmployeeInvitation(
  invitation: EmployeeInvitationInsert
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("employee_invitations").insert(invitation);
  return { error };
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

export async function deleteEmployeeInvitations(
  employeeId: string,
  salonId: string
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employee_invitations")
    .delete()
    .eq("employee_id", employeeId)
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

export async function findLatestPendingEmployeeInvitationRole(
  employeeId: string,
  salonId: string
): Promise<{ data: { role_id: string | null } | null; error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("employee_invitations")
    .select("role_id")
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

export async function findEmployeeInvitationForJoin(
  token: string
): Promise<{ data: EmployeeInvitationForJoin | null; error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("employee_invitations")
    .select(`
      id, employee_id, salon_id, email, role_id, expires_at, accepted_at,
      employees(first_name, last_name),
      salons(name)
    `)
    .eq("token", token)
    .maybeSingle();

  return {
    data: data as unknown as EmployeeInvitationForJoin | null,
    error,
  };
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

export async function markEmployeeInvitationAccepted(
  invitationId: string
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employee_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitationId);

  return { error };
}
