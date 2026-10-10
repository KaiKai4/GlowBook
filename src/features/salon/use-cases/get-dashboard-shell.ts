import "server-only";

import {
  getDisabledSalonFeatures,
  getPermissions,
  withDisabledFeatures,
  type Permission,
} from "@/features/access";
import type { ProfileWithRole } from "@/types/app.types";
import type { SalonFeatureKey } from "@/features/salon-features";
import { findDashboardShellSalon } from "../data/salon-settings.repo";
import {
  evaluatePaymentStanding,
  getEffectiveSalonPlan,
  isActionableLimitWarning,
  planLimitMessage,
  readEffectivePlanOrNull,
  type PaymentStanding,
} from "@/features/billing";

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
  /** Aviso de gracia ya calculado para el banner del dashboard (null fuera de gracia). */
  paymentGrace: { overdueSince: string; graceDaysLeft: number } | null;
}

/** Aviso de pago solo durante la gracia: el banner no decide estados. */
function toPaymentGrace(standing: PaymentStanding): DashboardShellViewModel["paymentGrace"] {
  if (standing.state !== "grace" || standing.overdueSince === null) return null;
  return { overdueSince: standing.overdueSince, graceDaysLeft: standing.graceDaysLeft };
}

/** Estado de pago del salón, evaluado al acceder (sin cron). */
async function getSalonPaymentStanding(salonId: string): Promise<PaymentStanding> {
  const effectivePlan = await readEffectivePlanOrNull(salonId, "dashboard-shell", getEffectiveSalonPlan);
  return evaluatePaymentStanding({
    status: effectivePlan?.assignmentStatus ?? null,
    currentPeriodEnd: effectivePlan?.currentPeriodEnd ?? null,
    trialEndsAt: effectivePlan?.trialEndsAt ?? null,
    todayIso: new Date().toISOString().slice(0, 10),
  });
}

/**
 * Advertencias de límites que ve el owner en el dashboard (solo ahi, no en
 * cada modulo). Capacidades al tope no alertan; ver isActionableLimitWarning.
 */
export async function getOwnerPlanLimitWarnings(salonId: string): Promise<PlanLimitWarning[]> {
  const effectivePlan = await readEffectivePlanOrNull(salonId, "dashboard-shell", getEffectiveSalonPlan);
  return (effectivePlan?.limits ?? [])
    .filter(isActionableLimitWarning)
    .map((limit) => ({
      level: limit.warningLevel === "near_limit" ? ("warning" as const) : ("danger" as const),
      message: planLimitMessage(limit.messageCode, {
        metricName: limit.metric.name,
        used: limit.used,
        maxValue: limit.maxValue,
      }),
    }));
}

export async function getDashboardShell(
  profile: ProfileWithRole
): Promise<DashboardShellViewModel | null> {
  const salon = await findDashboardShellSalon(profile.salon_id);
  if (!salon) return null;

  const profileWithSalonFeatures = withDisabledFeatures(profile, salon.disabled_features);

  const effectivePlan = await readEffectivePlanOrNull(profile.salon_id, "dashboard-shell", getEffectiveSalonPlan);
  const disabledFeatures = effectivePlan?.plan
    ? effectivePlan.disabledModules
    : getDisabledSalonFeatures(profileWithSalonFeatures);

  const profileForAccess = withDisabledFeatures(profile, disabledFeatures);

  const paymentStanding = await getSalonPaymentStanding(profile.salon_id);
  return {
    salonName: salon.name,
    isActive: salon.is_active,
    theme: salon.theme || "violet",
    bgStyle: salon.bg_style || "neutral",
    permissions: getPermissions(profileForAccess),
    disabledFeatures,
    paymentStanding,
    paymentGrace: toPaymentGrace(paymentStanding),
  };
}
