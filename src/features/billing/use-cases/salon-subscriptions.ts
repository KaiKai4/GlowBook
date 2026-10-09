import { toPublicErrorMessage } from "@/infra/errors";
import "server-only";
import { err, ok, type Result } from "@/infra/result";
import { readEffectivePlanOrNull } from "./effective-plan-fallback";
import { getDisabledSalonFeatures } from "@/features/access";
import type { ProfileWithRole } from "@/types/app.types";
import { type SalonFeatureKey, SALON_FEATURES } from "@/features/salon-features";
import { checkLimitAction, type EffectiveSalonPlan } from "../domain/commercial-plan";
import {
  buildEffectiveLimits,
  isPlanAssignmentActive,
  resolveEnabledModules,
} from "../domain/salon-plan-views";
import {
  findEffectivePlanRows,
  hasOpenPlanAlert,
  recordPlanAlert,
  resolvePlanAlert,
} from "../data/salon-subscriptions.repo";
import { commercialPlanAudit } from "./billing-shared";
import { publishAuditEvent } from "@/features/audit";

// Fachada del módulo de suscripciones: mantiene los exports públicos mientras
// la implementación vive repartida por responsabilidad en sus módulos hermanos.
export {
  assignSalonCommercialPlanConfig,
  autoAssignPlanOnAcceptance,
  registerSalonPlanPaymentConfig,
} from "./salon-plan-assignment";
export {
  assignSalonAddonConfig,
  cancelSalonExtraConfig,
  saveSalonManualExtraConfig,
} from "./salon-plan-extras";
export { getSubscriptionsPage, type SubscriptionsPageData } from "./salon-subscriptions-page";
export {
  getSalonSubscriptionDetail,
  type SalonExtraView,
  type SalonSubscriptionDetail,
} from "./salon-subscription-detail";
export type { SalonSubscriptionRow } from "../domain/salon-subscription-rows";

export async function getEffectiveSalonPlan(salonId: string): Promise<EffectiveSalonPlan> {
  const rows = await findEffectivePlanRows(salonId);
  const plan = isPlanAssignmentActive(rows.assignment?.status) ? rows.plan : null;
  const enabled = resolveEnabledModules(plan, rows.overrides);

  const disabledModules = SALON_FEATURES
    .map((feature) => feature.key)
    .filter((key) => !enabled.has(key));

  return {
    salonId,
    plan,
    assignmentStatus: rows.assignment?.status ?? null,
    currentPeriodEnd: rows.assignment?.current_period_end ?? null,
    trialEndsAt: rows.assignment?.trial_ends_at ?? null,
    enabledModules: Array.from(enabled),
    disabledModules,
    limits: buildEffectiveLimits(plan, rows.metrics, rows.overrides, rows.usage, enabled),
    usage: rows.usage,
  };
}

export async function checkPlanLimit(input: {
  salonId: string;
  metricKey: string;
  requestedAmount?: number;
}): Promise<Result<void>> {
  const plan = await getEffectiveSalonPlan(input.salonId);
  const limit = plan.limits.find((item) => item.metric.key === input.metricKey);
  if (!limit) return ok(undefined);

  const check = checkLimitAction({
    metricKey: input.metricKey,
    metricName: limit.metric.name,
    used: limit.used,
    requested: input.requestedAmount ?? 1,
    maxValue: limit.maxValue,
    enforcementMode: limit.enforcementMode,
  });

  if (!check.allowed) {
    await recordPlanAlertOnce({
      salonId: input.salonId,
      planId: plan.plan?.id ?? null,
      metricKey: input.metricKey,
      moduleKey: limit.metric.moduleKey,
      severity: "danger",
      message: check.message,
    });
    return err(check.message);
  }

  if (limit.warningLevel === "near_limit" || limit.warningLevel === "over_limit") {
    await recordPlanAlertOnce({
      salonId: input.salonId,
      planId: plan.plan?.id ?? null,
      metricKey: input.metricKey,
      moduleKey: limit.metric.moduleKey,
      severity: limit.warningLevel === "over_limit" ? "danger" : "warning",
      message: limit.message,
    });
  }

  return ok(undefined);
}

// Una alerta abierta por salon y límite: las acciones repetidas cerca del
// límite no deben inundar el panel de plataforma.
async function recordPlanAlertOnce(values: Parameters<typeof recordPlanAlert>[0]) {
  if (values.metricKey && (await hasOpenPlanAlert(values.salonId, values.metricKey))) return;
  await recordPlanAlert(values);
}

export async function resolveSalonPlanAlertConfig(
  alertId: string,
  salonId: string,
  actorUserId?: string | null
): Promise<Result<void>> {
  try {
    await resolvePlanAlert(alertId);
    const warnings = await publishAuditEvent("billing.plan_alert_resolved", { ...commercialPlanAudit(actorUserId, salonId), action: "commercial_plan_alert_resolved" });
    return ok(undefined, warnings);
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo resolver la alerta."));
  }
}

export async function checkPlanModuleAccess(input: {
  salonId: string;
  moduleKey: SalonFeatureKey;
}): Promise<Result<void>> {
  const plan = await getEffectiveSalonPlan(input.salonId);
  if (!plan.plan) return ok(undefined);
  if (plan.enabledModules.includes(input.moduleKey)) return ok(undefined);

  const label = SALON_FEATURES.find((feature) => feature.key === input.moduleKey)?.label ?? "Modulo";
  return err(`${label} no esta incluido en el plan de este salon.`);
}

export async function getEffectiveDisabledSalonFeatures(
  profile: ProfileWithRole
): Promise<SalonFeatureKey[]> {
  const legacyDisabledFeatures = getDisabledSalonFeatures(profile);
  const effectivePlan = await readEffectivePlanOrNull(profile.salon_id, "disabled-features", getEffectiveSalonPlan);
  if (effectivePlan?.plan) return effectivePlan.disabledModules;
  return legacyDisabledFeatures;
}

export async function isEffectiveSalonModuleEnabled(
  profile: ProfileWithRole,
  moduleKey: SalonFeatureKey
): Promise<boolean> {
  const effectivePlan = await readEffectivePlanOrNull(profile.salon_id, "module-enabled", getEffectiveSalonPlan);
  if (effectivePlan?.plan) return effectivePlan.enabledModules.includes(moduleKey);
  return !getDisabledSalonFeatures(profile).includes(moduleKey);
}
