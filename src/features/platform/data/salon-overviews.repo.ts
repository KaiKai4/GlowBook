import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeDisabledSalonFeatures } from "@/features/salon/domain/salon-features";
import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";
import type { Database } from "@/types/database.types";

type SalonOverviewRow =
  Database["public"]["Functions"]["platform_salon_overviews"]["Returns"][number];

export interface SalonOverview {
  id: string;
  name: string;
  email: string;
  contact_email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  disabled_features: SalonFeatureKey[];
  owner_names: string[];
  owner_count: number;
  customer_count: number;
  collaborator_count: number;
  appointment_count: number;
  service_count: number;
  invitation_count: number;
}

export function mapSalonOverviewRow(row: SalonOverviewRow): SalonOverview {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    contact_email: row.contact_email,
    phone: row.phone,
    is_active: row.is_active,
    created_at: row.created_at,
    disabled_features: normalizeDisabledSalonFeatures(row.disabled_features),
    owner_names: row.owner_names.filter(Boolean),
    owner_count: row.owner_count,
    customer_count: row.customer_count,
    collaborator_count: row.collaborator_count,
    appointment_count: row.appointment_count,
    service_count: row.service_count,
    invitation_count: row.invitation_count,
  };
}

export async function findSalonOverviews(): Promise<SalonOverview[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("platform_salon_overviews");

  if (error) throw error;
  return (data ?? []).map(mapSalonOverviewRow);
}
