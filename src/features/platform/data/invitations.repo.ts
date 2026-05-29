import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PendingSalonInvitation {
  id: string;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface SalonInvitationForAcceptance {
  email: string;
  status: string;
  expires_at: string;
}

export async function createSalonInvitation(email: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("invite_salon", {
    p_email: email,
  });

  if (error) throw error;
  return data as string;
}

export async function findPendingInvitations(): Promise<PendingSalonInvitation[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salon_invitations")
    .select("id, email, token, status, expires_at, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function findAcceptedInvitationEmailBySalon(
  salonIds: string[]
): Promise<Map<string, string>> {
  if (salonIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salon_invitations")
    .select("salon_id, email, accepted_at")
    .in("salon_id", salonIds)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });

  if (error) throw error;

  const emailsBySalon = new Map<string, string>();
  for (const invitation of data ?? []) {
    if (invitation.salon_id && invitation.email && !emailsBySalon.has(invitation.salon_id)) {
      emailsBySalon.set(invitation.salon_id, invitation.email);
    }
  }

  return emailsBySalon;
}

export async function findSalonInvitationForAcceptance(
  token: string
): Promise<SalonInvitationForAcceptance | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salon_invitations")
    .select("email, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function profileExists(profileId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function acceptSalonInvitationAsAdmin({
  token,
  userId,
  email,
  salonName,
  fullName,
}: {
  token: string;
  userId: string;
  email: string;
  salonName: string;
  fullName: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("accept_invitation_admin", {
    p_token: token,
    p_user_id: userId,
    p_email: email,
    p_salon_name: salonName,
    p_full_name: fullName,
  });

  if (error) throw error;
}
