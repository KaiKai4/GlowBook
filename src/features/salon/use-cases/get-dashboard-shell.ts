import "server-only";

import { getDisabledSalonFeatures, getPermissions } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import type { ProfileWithRole } from "@/types/app.types";
import type { SalonFeatureKey } from "../domain/salon-features";
import { findDashboardShellSalon } from "../data/salon.repo";
import { getEffectiveSalonPlan } from "@/features/billing/use-cases/commercial-plans";
import { isActionableLimitWarning } from "@/features/billing/domain/commercial-plan";
import {
  evaluatePaymentStanding,
  type PaymentStanding,
} from "@/features/billing/domain/payment-standing";

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
  paymentStanding: PaymentStanding;
}

/** Estado de pago del salon, evaluado al acceder (sin cron). */
export async function getSalonPaymentStanding(salonId: string): Promise<PaymentStanding> {
  const effectivePlan = await getEffectiveSalonPlan(salonId).catch(() => null);
  return evaluatePaymentStanding({
    status: effectivePlan?.assignmentStatus ?? null,
    currentPeriodEnd: effectivePlan?.currentPeriodEnd ?? null,
    trialEndsAt: effectivePlan?.trialEndsAt ?? null,
    todayIso: new Date().toISOString().slice(0, 10),
  });
}

/**
 * Advertencias de limites que ve el owner en el dashboard (solo ahi, no en
 * cada modulo). Capacidades al tope no alertan; ver isActionableLimitWarning.
 */
export async function getOwnerPlanLimitWarnings(salonId: string): Promise<PlanLimitWarning[]> {
  const effectivePlan = await getEffectiveSalonPlan(salonId).catch(() => null);
  return (effectivePlan?.limits ?? [])
    .filter(isActionableLimitWarning)
    .map((limit) => ({
      level: limit.warningLevel === "near_limit" ? ("warning" as const) : ("danger" as const),
      message: limit.message,
    }));
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

  const effectivePlan = await getEffectiveSalonPlan(profile.salon_id).catch(() => null);
  const disabledFeatures = effectivePlan?.plan
    ? effectivePlan.disabledModules
    : getDisabledSalonFeatures(profileWithSalonFeatures);

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
    paymentStanding: await getSalonPaymentStanding(profile.salon_id),
  };
}
