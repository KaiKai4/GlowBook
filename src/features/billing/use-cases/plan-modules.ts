import "server-only";
import { getDisabledSalonFeatures } from "@/features/access";
import { type SalonFeatureKey, SALON_FEATURES } from "@/features/salon-features";
import { ok, err, type Result } from "@/infra/result";
import { findEffectivePlanRows } from "../data/salon-subscriptions.repo";
import type { EffectiveSalonPlan } from "../domain/commercial-plan";
import type { PlanModuleKey } from "../domain/plan-keys";
import {
  buildEffectiveLimits,
  isPlanAssignmentActive,
  resolveEnabledModules,
} from "../domain/salon-plan-views";
import { readEffectivePlanOrNull } from "./effective-plan-fallback";
import type { ProfileWithRole } from "@/types/app.types";

/** Lo mínimo que necesita la visibilidad de módulos: el salón y sus features heredadas. */
export interface SalonModuleScope {
  salonId: string;
  disabledFeatures: SalonFeatureKey[];
}

/** Plan efectivo del salón: plan activo, módulos habilitados, límites y uso. */
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

export async function checkPlanModuleAccess(input: {
  salonId: string;
  moduleKey: PlanModuleKey;
}): Promise<Result<void>> {
  const plan = await getEffectiveSalonPlan(input.salonId);
  if (!plan.plan) return ok(undefined);
  if (plan.enabledModules.includes(input.moduleKey)) return ok(undefined);

  const label = SALON_FEATURES.find((feature) => feature.key === input.moduleKey)?.label ?? "Módulo";
  return err(`${label} no está incluido en el plan de este salón.`);
}

/** Features deshabilitadas: las del plan si hay plan activo; si no, las heredadas del salón. */
export async function getEffectiveDisabledSalonFeatures(
  scope: SalonModuleScope
): Promise<SalonFeatureKey[]> {
  const effectivePlan = await readEffectivePlanOrNull(scope.salonId, "disabled-features", getEffectiveSalonPlan);
  if (effectivePlan?.plan) return effectivePlan.disabledModules;
  return scope.disabledFeatures;
}

/** Indica si un módulo está habilitado para el salón (plan activo o, en su defecto, features heredadas). */
export async function isEffectiveSalonModuleEnabled(
  scope: SalonModuleScope,
  moduleKey: SalonFeatureKey
): Promise<boolean> {
  const effectivePlan = await readEffectivePlanOrNull(scope.salonId, "module-enabled", getEffectiveSalonPlan);
  if (effectivePlan?.plan) return effectivePlan.enabledModules.includes(moduleKey);
  return !scope.disabledFeatures.includes(moduleKey);
}

/** Helper de los llamadores que parten de un perfil: arma el ámbito con las features heredadas. */
export function salonModuleScopeFromProfile(profile: ProfileWithRole): SalonModuleScope {
  return { salonId: profile.salon_id, disabledFeatures: getDisabledSalonFeatures(profile) };
}
