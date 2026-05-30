import "server-only";

import { getDisabledSalonFeatures, getPermissions } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import type { ProfileWithRole } from "@/types/app.types";
import type { SalonFeatureKey } from "../domain/salon-features";
import { findDashboardShellSalon } from "../data/salon.repo";

export interface DashboardShellViewModel {
  salonName: string;
  isActive: boolean;
  theme: string;
  bgStyle: string;
  permissions: Permission[];
  disabledFeatures: SalonFeatureKey[];
}

export async function getDashboardShell(
  profile: ProfileWithRole
): Promise<DashboardShellViewModel | null> {
  const salon = await findDashboardShellSalon(profile.salon_id);
  if (!salon) return null;

  const profileForAccess: ProfileWithRole = {
    ...profile,
    salon: { disabled_features: salon.disabled_features },
  };

  return {
    salonName: salon.name,
    isActive: salon.is_active,
    theme: salon.theme || "violet",
    bgStyle: salon.bg_style || "neutral",
    permissions: getPermissions(profileForAccess),
    disabledFeatures: getDisabledSalonFeatures(profileForAccess),
  };
}
