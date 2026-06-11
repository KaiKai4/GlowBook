import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/auth/invitation-tokens";

// Sin token: la DB solo guarda el hash. El enlace se muestra una vez al
// crear o regenerar la invitacion.
export interface PendingSalonInvitation {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
  plan_id: string | null;
}

export interface AcceptedSalonInvitation {
  id: string;
  email: string;
  accepted_at: string | null;
  salon_id: string | null;
  plan_id: string | null;
}

export interface SalonInvitationForAcceptance {
  email: string;
  status: string;
  expires_at: string;
  plan_id: string | null;
}

export async function createSalonInvitation(
  email: string,
  planId: string | null
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("invite_salon", {
    p_email: email,
  });

  if (error) throw error;
  const token = data as string;

  if (planId) {
    const admin = createSupabaseAdminClient();
    const { error: planError } = await admin
      .from("salon_invitations")
      .update({ plan_id: planId })
      .eq("token_hash", hashInvitationToken(token));
    if (planError) throw planError;
  }

  return token;
}

/**
 * Emite un token nuevo para una invitacion pendiente (el anterior queda
 * invalidado) y extiende la expiracion. Devuelve el token en claro para
 * mostrar el enlace una unica vez.
 */
export async function regenerateSalonInvitationToken(invitationId: string): Promise<string> {
  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salon_invitations")
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq("id", invitationId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("La invitacion no existe o ya no esta pendiente.");
  return token;
}

export async function findPendingInvitations(): Promise<PendingSalonInvitation[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salon_invitations")
    .select("id, email, status, expires_at, created_at, plan_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function findRecentAcceptedInvitations(limit = 10): Promise<AcceptedSalonInvitation[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salon_invitations")
    .select("id, email, accepted_at, salon_id, plan_id")
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(limit);

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
    .select("email, status, expires_at, plan_id")
    .eq("token_hash", hashInvitationToken(token))
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
}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("accept_invitation_admin", {
    p_token: token,
    p_user_id: userId,
    p_email: email,
    p_salon_name: salonName,
    p_full_name: fullName,
  });

  if (error) throw error;
  return data as string;
}
