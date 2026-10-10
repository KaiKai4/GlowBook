import {
  calculateLimitState,
  type CommercialLimitMetric,
  type CommercialPlan,
  type CommercialPlanModule,
  type EffectivePlanLimit,
  type PlanEnforcementMode,
  type SalonPlanAssignmentStatus,
  type PlanRuleOverride,
  type SalonPlanOverride,
  type SalonPlanUsageByMetric,
} from "./commercial-plan";
import {
  resolveOverrideMax,
  resolveOverrideMode,
  resolveOverrideThreshold,
  type CommercialAddon,
} from "./salon-extras";

/** Clave de módulo habilitable en un salón (catálogo de permisos fijo). */
export type EnabledModuleKey = CommercialPlanModule["moduleKey"];

/** Estados en los que el plan de la asignación está vigente (se factura y da módulos). */
export function isPlanAssignmentActive(status: SalonPlanAssignmentStatus | null | undefined): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

export function resolveEnabledModules(
  plan: CommercialPlan | null,
  overrides: PlanRuleOverride[]
): Set<EnabledModuleKey> {
  const enabled = new Set<EnabledModuleKey>();
  if (plan) {
    for (const planModule of plan.modules) {
      if (planModule.enabled) enabled.add(planModule.moduleKey);
    }
  }
  for (const override of overrides) {
    if (!override.moduleKey || override.moduleEnabled === null) continue;
    if (override.moduleEnabled) enabled.add(override.moduleKey);
    else enabled.delete(override.moduleKey);
  }
  return enabled;
}

export function buildEffectiveLimits(
  plan: CommercialPlan | null,
  metrics: CommercialLimitMetric[],
  overrides: PlanRuleOverride[],
  usage: SalonPlanUsageByMetric,
  enabledModules: Set<EnabledModuleKey>
): EffectivePlanLimit[] {
  if (!plan) return [];
  const limitByMetric = new Map(plan.limits.map((limit) => [limit.metricKey, limit]));

  // Solo los límites de módulos que el salón realmente tiene: un límite de un
  // modulo apagado no controla nada y solo hace ruido.
  return metrics.filter((metric) => enabledModules.has(metric.moduleKey)).map((metric) => {
    const base = limitByMetric.get(metric.key);
    const metricOverrides = overrides.filter((override) => override.metricKey === metric.key);
    const maxValue = resolveOverrideMax(base?.maxValue ?? null, metricOverrides);
    const enforcementMode = resolveOverrideMode(
      (base?.enforcementMode ?? "warn") as PlanEnforcementMode,
      metricOverrides
    );
    const warningThreshold = resolveOverrideThreshold(base?.warningThreshold ?? 80, metricOverrides);
    const countScope = base?.countScope ?? metric.defaultCountScope;

    return calculateLimitState({
      metric,
      maxValue,
      enforcementMode,
      warningThreshold,
      countScope,
      used: usage[metric.key] ?? 0,
    });
  });
}

export function manualExtraName(
  override: SalonPlanOverride,
  moduleByKey: Map<string, string>,
  metricByKey: Map<string, CommercialLimitMetric>
): string {
  if (override.moduleKey) return moduleByKey.get(override.moduleKey) ?? override.moduleKey;
  if (override.metricKey) return metricByKey.get(override.metricKey)?.name ?? override.metricKey;
  return "Extra personalizado";
}

export function extraDetail(
  override: SalonPlanOverride,
  addon: CommercialAddon | null,
  metricByKey: Map<string, CommercialLimitMetric>
): string {
  if (override.moduleKey && override.moduleEnabled !== null) {
    return override.moduleEnabled ? "Módulo activado" : "Módulo desactivado";
  }
  const metric = override.metricKey ? metricByKey.get(override.metricKey) : null;
  const unit = metric?.unit ?? "";
  const delta = override.maxDelta ?? addon?.limitDelta ?? null;
  if (override.maxOverride !== null) return `Límite fijado en ${override.maxOverride} ${unit}`.trim();
  if (delta !== null) return `+${delta * override.quantity} ${unit}`.trim();
  return "Ajuste de límite";
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
