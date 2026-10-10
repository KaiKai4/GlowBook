import "server-only";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { hashInvitationToken } from "@/infra/auth/invitation-tokens";
import type { DbError } from "@/features/employees/data/employee-access.repo";

// Unico sitio con consultas sobre employee_invitations (alta, limpieza, lectura y aceptacion).

export interface EmployeeInvitationInsert {
  employee_id: string;
  salon_id: string;
  email: string;
  role_id: string | null;
  token_hash: string;
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

// El token en claro no existe en la DB (solo su hash), asi que una invitacion
// pendiente solo expone metadatos: el enlace se muestra una unica vez al
// generarse y despues solo puede regenerarse.
export interface EmployeeInvitationRow {
  id: string;
  email: string;
  role_id: string | null;
  expires_at: string;
  accepted_at: string | null;
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
  // La DB solo conoce el hash; el token en claro viaja en la URL del enlace.
  const { data, error } = await admin
    .from("employee_invitations")
    .select(`
      id, employee_id, salon_id, email, role_id, expires_at, accepted_at,
      employees(first_name, last_name),
      salons(name)
    `)
    .eq("token_hash", hashInvitationToken(token))
    .maybeSingle();

  return {
    data: data as unknown as EmployeeInvitationForJoin | null,
    error,
  };
}

export async function markEmployeeInvitationAccepted(
  invitationId: string,
  salonId: string
): Promise<{ error: DbError | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employee_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("salon_id", salonId);

  return { error };
}

export async function findLatestEmployeeInvitation(
  employeeId: string,
  salonId: string
): Promise<EmployeeInvitationRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employee_invitations")
    .select("id, email, role_id, expires_at, accepted_at")
    .eq("employee_id", employeeId)
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as EmployeeInvitationRow | null;
}
