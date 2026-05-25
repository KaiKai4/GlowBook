import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

// All platform reads use service_role to bypass tenant RLS.
// Only called server-side after verifying is_platform_admin().

export async function findAllSalons() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salons")
    .select("id, name, email, phone, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface SalonOverview {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  owner_names: string[];
  owner_count: number;
  customer_count: number;
  collaborator_count: number;
  appointment_count: number;
  service_count: number;
  invitation_count: number;
}

export async function findSalonOverviews(): Promise<SalonOverview[]> {
  const admin = createSupabaseAdminClient();
  const { data: salons, error } = await admin
    .from("salons")
    .select("id, name, email, phone, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return Promise.all((salons ?? []).map(async (salon) => {
    const [
      owners,
      customers,
      collaborators,
      appointments,
      services,
      invitations,
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name", { count: "exact" })
        .eq("salon_id", salon.id)
        .eq("is_owner", true),
      admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id),
      admin
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id),
      admin
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id),
      admin
        .from("salon_invitations")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id),
    ]);

    return {
      id: salon.id,
      name: salon.name,
      email: salon.email,
      phone: salon.phone,
      is_active: salon.is_active,
      created_at: salon.created_at,
      owner_names: (owners.data ?? []).map((owner) => owner.full_name).filter(Boolean),
      owner_count: owners.count ?? 0,
      customer_count: customers.count ?? 0,
      collaborator_count: collaborators.count ?? 0,
      appointment_count: appointments.count ?? 0,
      service_count: services.count ?? 0,
      invitation_count: invitations.count ?? 0,
    };
  }));
}

export async function findSalonOwners() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, salon_id, is_active, created_at")
    .eq("is_owner", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function findPendingInvitations() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salon_invitations")
    .select("id, email, token, status, expires_at, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setSalonActive(salonId: string, isActive: boolean): Promise<void> {
  const admin = createSupabaseAdminClient();
  const update: Database["public"]["Tables"]["salons"]["Update"] = { is_active: isActive };
  const { error } = await admin.from("salons").update(update).eq("id", salonId);
  if (error) throw error;
}

export async function deleteSalonCompletely(salonId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: salon, error: salonError } = await admin
    .from("salons")
    .select("id")
    .eq("id", salonId)
    .maybeSingle();
  if (salonError) throw salonError;
  if (!salon) throw new Error("Salón no encontrado.");

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("salon_id", salonId);
  if (profilesError) throw profilesError;

  // Delete in dependency order. Several tenant FKs are restrict by design, so
  // deleting the salon row first would fail or leave operational data behind.
  const deleteResult = await Promise.all([
    admin.from("appointment_reminder_log").delete().eq("salon_id", salonId),
    admin.from("employee_invitations").delete().eq("salon_id", salonId),
    admin.from("employee_services").delete().eq("salon_id", salonId),
    admin.from("employee_categories").delete().eq("salon_id", salonId),
    admin.from("work_schedules").delete().eq("salon_id", salonId),
    admin.from("notification_templates").delete().eq("salon_id", salonId),
    admin.from("salon_business_hours").delete().eq("salon_id", salonId),
    admin.from("feedback_reports").delete().eq("salon_id", salonId),
    admin.from("role_permissions").delete().eq("salon_id", salonId),
    admin.from("salon_invitations").delete().eq("salon_id", salonId),
  ]);
  const firstDeleteError = deleteResult.find((result) => result.error)?.error;
  if (firstDeleteError) throw firstDeleteError;

  let result = await admin.from("appointment_items").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("appointments").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("employees").update({ profile_id: null }).eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("employees").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("services").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("service_categories").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("customers").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("profiles").update({ role_id: null }).eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("profiles").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;
  result = await admin.from("roles").delete().eq("salon_id", salonId);
  if (result.error) throw result.error;

  const { error } = await admin.from("salons").delete().eq("id", salonId);
  if (error) throw error;

  for (const profile of profiles ?? []) {
    const { error: authError } = await admin.auth.admin.deleteUser(profile.id);
    if (authError && authError.status !== 404) throw authError;
  }
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const update: Database["public"]["Tables"]["salon_invitations"]["Update"] = { status: "revoked" };
  const { error } = await admin.from("salon_invitations").update(update).eq("id", invitationId);
  if (error) throw error;
}

export interface FeedbackReportRow {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  salon: { name: string } | null;
  reporter: { full_name: string } | null;
}

export async function findFeedbackReports(): Promise<FeedbackReportRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("feedback_reports")
    .select("id, category, message, status, created_at, salon:salons(name), reporter:profiles(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FeedbackReportRow[];
}

export async function setFeedbackStatus(id: string, status: "new" | "resolved"): Promise<void> {
  const admin = createSupabaseAdminClient();
  const update: Database["public"]["Tables"]["feedback_reports"]["Update"] = { status };
  const { error } = await admin.from("feedback_reports").update(update).eq("id", id);
  if (error) throw error;
}
