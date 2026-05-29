import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";
import { normalizeDisabledSalonFeatures } from "@/features/salon/domain/salon-features";
import { findAcceptedInvitationEmailBySalon } from "./invitations.repo";

export async function findAllSalons() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("salons")
    .select("id, name, email, phone, is_active, created_at, disabled_features")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const salons = data ?? [];
  const acceptedInviteEmailBySalon = await findAcceptedInvitationEmailBySalon(
    salons.map((salon) => salon.id)
  );

  return salons.map((salon) => ({
    ...salon,
    disabled_features: normalizeDisabledSalonFeatures(salon.disabled_features),
    contact_email: salon.email || acceptedInviteEmailBySalon.get(salon.id) || "",
  }));
}

export async function setSalonDisabledFeatures(
  salonId: string,
  disabledFeatures: readonly string[]
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const update: Database["public"]["Tables"]["salons"]["Update"] = {
    disabled_features: normalizeDisabledSalonFeatures(disabledFeatures),
  };
  const { error } = await admin.from("salons").update(update).eq("id", salonId);
  if (error) throw error;
}
