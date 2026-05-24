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
