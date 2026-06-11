import "server-only";

import { getDisabledSalonFeatures, getPermissions } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import type { ProfileWithRole } from "@/types/app.types";
import type { SalonFeatureKey } from "../domain/salon-features";
import { findDashboardShellSalon } from "../data/salon.repo";
import { getEffectiveSalonPlan } from "@/features/billing/use-cases/commercial-plans";

export interface PlanLimitWarning {
  level: "warning" | "danger";
  message: string;
}

export interface DashboardShellViewModel {
  salonName: string;
  isActive: boolean;
  theme: string;
  bgStyle: string;
  permissions: Permission[];
  disabledFeatures: SalonFeatureKey[];
  planWarnings: PlanLimitWarning[];
}

export async function getDashboardShell(
  profile: ProfileWithRole
): Promise<DashboardShellViewModel | null> {
  const salon = await findDashboardShellSalon(profile.salon_id);
  if (!salon) return null;

  const profileWithSalonFeatures: ProfileWithRole = {
    ...profile,
    salon: { disabled_features: salon.disabled_features },
  };

  // Una sola consulta del plan efectivo alimenta tanto los modulos visibles
  // como las advertencias de limites que ve el owner.
  const effectivePlan = await getEffectiveSalonPlan(profile.salon_id).catch(() => null);
  const disabledFeatures = effectivePlan?.plan
    ? effectivePlan.disabledModules
    : getDisabledSalonFeatures(profileWithSalonFeatures);

  const planWarnings: PlanLimitWarning[] = (effectivePlan?.limits ?? [])
    .filter((limit) => limit.warningLevel !== "none" && limit.message)
    .map((limit) => ({
      level: limit.warningLevel === "near_limit" ? "warning" : "danger",
      message: limit.message,
    }));

  const profileForAccess: ProfileWithRole = {
    ...profile,
    salon: { disabled_features: disabledFeatures },
  };

  return {
    salonName: salon.name,
    isActive: salon.is_active,
    theme: salon.theme || "violet",
    bgStyle: salon.bg_style || "neutral",
    permissions: getPermissions(profileForAccess),
    disabledFeatures,
    planWarnings,
  };
}
