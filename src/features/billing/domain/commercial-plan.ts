import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";

export type CommercialPlanStatus = "draft" | "active" | "archived";
export type SalonPlanAssignmentStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";
export type PlanEnforcementMode = "none" | "warn" | "block";
export type PlanLimitCountScope = "current" | "monthly" | "billing_cycle" | "lifetime";
export type PlanWarningLevel = "none" | "near_limit" | "over_limit" | "blocked";

export interface PlatformModule {
  key: SalonFeatureKey;
  name: string;
  description: string;
  navHref: string;
  iconName: string;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
}

export interface CommercialPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  currency: string;
  monthlyPrice: number;
  trialDays: number;
  status: CommercialPlanStatus;
  isPublic: boolean;
  sortOrder: number;
  modules: CommercialPlanModule[];
  limits: CommercialPlanLimit[];
}

export interface CommercialPlanModule {
  moduleKey: SalonFeatureKey;
  enabled: boolean;
}

export interface CommercialLimitMetric {
  key: string;
  moduleKey: SalonFeatureKey;
  name: string;
  description: string;
  unit: string;
  counterKey: UsageCounterKey;
  defaultCountScope: PlanLimitCountScope;
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
}

export interface CommercialPlanLimit {
  metricKey: string;
  maxValue: number | null;
  enforcementMode: PlanEnforcementMode;
  warningThreshold: number;
  countScope: PlanLimitCountScope;
}

export interface SalonPlanAssignment {
  id: string;
  salonId: string;
  salonName: string;
  planId: string;
  planName: string;
  status: SalonPlanAssignmentStatus;
  startsAt: string | null;
  endsAt: string | null;
  trialEndsAt: string | null;
  notes: string;
}

export interface SalonPlanOverride {
  id: string;
  salonId: string;
  salonName: string;
  moduleKey: SalonFeatureKey | null;
  metricKey: string | null;
  moduleEnabled: boolean | null;
  maxDelta: number | null;
  maxOverride: number | null;
  enforcementMode: PlanEnforcementMode | null;
  warningThreshold: number | null;
  reason: string;
  startsAt: string | null;
  endsAt: string | null;
  status: "active" | "paused" | "canceled";
  addonId: string | null;
  quantity: number;
  isGift: boolean;
  priceOverride: number | null;
}

export type UsageCounterKey =
  | "appointments_total"
  | "customers_active"
  | "employees_active"
  | "login_users_total"
  | "services_active"
  | "retail_sales_total"
  | "inventory_products_active"
  | "inventory_movements_total"
  | "expenses_total";

export type SalonPlanUsage = Record<UsageCounterKey, number>;
export type SalonPlanUsageByMetric = Record<string, number>;

export interface EffectivePlanLimit {
  metric: CommercialLimitMetric;
  maxValue: number | null;
  enforcementMode: PlanEnforcementMode;
  warningThreshold: number;
  countScope: PlanLimitCountScope;
  used: number;
  remaining: number | null;
  percentage: number | null;
  warningLevel: PlanWarningLevel;
  message: string;
}

export interface EffectiveSalonPlan {
  salonId: string;
  plan: CommercialPlan | null;
  assignmentStatus: SalonPlanAssignmentStatus | null;
  /** Fin del periodo pagado (YYYY-MM-DD); alimenta el estado de pago. */
  currentPeriodEnd: string | null;
  /** Fin del trial; alimenta el estado de pago durante el trial. */
  trialEndsAt: string | null;
  enabledModules: SalonFeatureKey[];
  disabledModules: SalonFeatureKey[];
  limits: EffectivePlanLimit[];
  usage: SalonPlanUsageByMetric;
}

export interface PlanLimitCheck {
  allowed: boolean;
  mode: PlanEnforcementMode;
  metricKey: string;
  used: number;
  maxValue: number | null;
  remaining: number | null;
  message: string;
}

export function calculateLimitState(input: {
  metric: CommercialLimitMetric;
  maxValue: number | null;
  enforcementMode: PlanEnforcementMode;
  warningThreshold: number;
  countScope: PlanLimitCountScope;
  used: number;
}): EffectivePlanLimit {
  const remaining = input.maxValue === null ? null : Math.max(0, input.maxValue - input.used);
  const percentage =
    input.maxValue === null || input.maxValue === 0
      ? null
      : Math.round((input.used / input.maxValue) * 100);
  // Un límite en 0 sin uso no esta "superado": significa que el plan no
  // incluye ese recurso y simplemente no se ha usado.
  const isOver = input.maxValue !== null && input.used >= input.maxValue && input.used > 0;
  const isNear = percentage !== null && percentage >= input.warningThreshold;
  const warningLevel: PlanWarningLevel = isOver
    ? input.enforcementMode === "block"
      ? "blocked"
      : "over_limit"
    : isNear
      ? "near_limit"
      : "none";

  return {
    metric: input.metric,
    maxValue: input.maxValue,
    enforcementMode: input.enforcementMode,
    warningThreshold: input.warningThreshold,
    countScope: input.countScope,
    used: input.used,
    remaining,
    percentage,
    warningLevel,
    message: limitMessage(input.metric.name, input.used, input.maxValue, warningLevel),
  };
}

// Capacidades (scope "current") solo alertan al owner cuando se supera el
// maximo: estar al tope (1 de 1) es un estado normal y la creacion de mas
// recursos ya se bloquea en el punto de accion. Consumos renovables (citas
// por ciclo) si alertan al acercarse, porque se agotan dentro del periodo.
export function isActionableLimitWarning(limit: EffectivePlanLimit): boolean {
  if (limit.warningLevel === "none" || !limit.message) return false;
  if (limit.countScope !== "current") return true;
  return limit.maxValue !== null && limit.used > limit.maxValue;
}

export function checkLimitAction(input: {
  metricKey: string;
  metricName: string;
  used: number;
  requested: number;
  maxValue: number | null;
  enforcementMode: PlanEnforcementMode;
}): PlanLimitCheck {
  if (input.maxValue === null || input.enforcementMode === "none") {
    return allowed(input, null);
  }

  const nextUsed = input.used + input.requested;
  const remaining = Math.max(0, input.maxValue - input.used);
  const overLimit = nextUsed > input.maxValue;

  if (overLimit && input.enforcementMode === "block") {
    return {
      allowed: false,
      mode: input.enforcementMode,
      metricKey: input.metricKey,
      used: input.used,
      maxValue: input.maxValue,
      remaining,
      message: `${input.metricName} alcanzo el límite del plan (${input.maxValue}).`,
    };
  }

  return allowed(input, remaining);
}

function allowed(
  input: {
    metricKey: string;
    used: number;
    maxValue: number | null;
    enforcementMode: PlanEnforcementMode;
  },
  remaining: number | null
): PlanLimitCheck {
  return {
    allowed: true,
    mode: input.enforcementMode,
    metricKey: input.metricKey,
    used: input.used,
    maxValue: input.maxValue,
    remaining,
    message: "",
  };
}

function limitMessage(
  metricName: string,
  used: number,
  maxValue: number | null,
  warningLevel: PlanWarningLevel
) {
  if (warningLevel === "none") return "";
  if (maxValue === null) return "";
  if (warningLevel === "near_limit") return `${metricName}: vas ${used} de ${maxValue} en tu plan.`;
  if (used > maxValue) return `${metricName}: superaste el límite de tu plan (${used} de ${maxValue}).`;
  return `${metricName}: alcanzaste el límite de tu plan (${used} de ${maxValue}).`;
}
