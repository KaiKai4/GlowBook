// Fixtures tipados para tests de componentes de /admin. Cada builder devuelve
// un objeto completo del tipo de dominio; los overrides permiten variar solo
// lo que interesa a cada caso.
import type {
  CommercialLimitMetric,
  CommercialPlan,
  EffectivePlanLimit,
  PlatformModule,
} from "@/features/billing/domain/commercial-plan";
import type { CommercialAddon } from "@/features/billing/domain/salon-extras";
import type {
  SalonExtraView,
  SalonSubscriptionDetail,
  SalonSubscriptionRow,
} from "@/features/billing/use-cases/salon-subscriptions";
import type { SalonFeatureKey } from "@/features/salon/domain/salon-features";

export function makePlan(overrides: Partial<CommercialPlan> = {}): CommercialPlan {
  return {
    id: "plan-pro",
    code: "pro",
    name: "Pro",
    description: "Plan profesional",
    currency: "USD",
    monthlyPrice: 30,
    trialDays: 14,
    status: "active",
    isPublic: true,
    sortOrder: 1,
    modules: [],
    limits: [],
    ...overrides,
  };
}

export function makeMetric(overrides: Partial<CommercialLimitMetric> = {}): CommercialLimitMetric {
  return {
    key: "appointments_monthly",
    moduleKey: "appointments" satisfies SalonFeatureKey,
    name: "Citas",
    description: "Citas creadas por mes",
    unit: "citas",
    counterKey: "appointments_total",
    defaultCountScope: "monthly",
    isActive: true,
    isArchived: false,
    sortOrder: 1,
    ...overrides,
  };
}

export function makeLimit(overrides: Partial<EffectivePlanLimit> = {}): EffectivePlanLimit {
  return {
    metric: makeMetric(),
    maxValue: 100,
    enforcementMode: "block",
    warningThreshold: 80,
    countScope: "monthly",
    used: 40,
    remaining: 60,
    percentage: 40,
    warningLevel: "none",
    message: "",
    ...overrides,
  };
}

export function makeAddon(overrides: Partial<CommercialAddon> = {}): CommercialAddon {
  return {
    id: "addon-extra-citas",
    code: "extra_citas",
    name: "Citas extra",
    description: "Amplía el límite mensual de citas",
    kind: "limit_boost",
    moduleKey: null,
    metricKey: "appointments_monthly",
    limitDelta: 100,
    currency: "USD",
    monthlyPrice: 5,
    status: "active",
    sortOrder: 1,
    ...overrides,
  };
}

export function makeExtra(overrides: Partial<SalonExtraView> = {}): SalonExtraView {
  return {
    id: "extra-1",
    name: "Citas extra",
    detail: "+100 citas por mes",
    quantity: 1,
    isGift: false,
    monthlyPrice: 5,
    endsAt: null,
    reason: "Campaña de temporada",
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<SalonSubscriptionDetail> = {}): SalonSubscriptionDetail {
  return {
    salonId: "salon-1",
    assignment: {
      planId: "plan-pro",
      status: "active",
      startsAt: "2026-09-01",
      endsAt: null,
      trialEndsAt: null,
      currentPeriodStart: "2026-10-01",
      currentPeriodEnd: "2026-10-31",
      notes: "",
    },
    plan: makePlan(),
    enabledModules: ["appointments"],
    limits: [makeLimit()],
    extras: [],
    payments: [],
    openAlerts: [],
    planPrice: 30,
    extrasPrice: 0,
    monthlyTotal: 30,
    ...overrides,
  };
}

export function makeRow(overrides: Partial<SalonSubscriptionRow> = {}): SalonSubscriptionRow {
  return {
    salonId: "salon-1",
    salonName: "Salón Luna",
    salonIsActive: true,
    planId: "plan-pro",
    planName: "Pro",
    planPrice: 30,
    currency: "USD",
    status: "active",
    trialEndsAt: null,
    extrasCount: 0,
    extrasPrice: 0,
    monthlyTotal: 30,
    openAlertCount: 0,
    ...overrides,
  };
}

export const CATALOG_MODULES: Array<{ key: SalonFeatureKey; name: string }> = [
  { key: "appointments", name: "Agenda" },
  { key: "expenses", name: "Gastos" },
  { key: "reports", name: "Reportes" },
];

export function makeModule(overrides: Partial<PlatformModule> = {}): PlatformModule {
  return {
    key: "appointments",
    name: "Agenda",
    description: "Citas y calendario",
    navHref: "/agenda",
    iconName: "calendar",
    sortOrder: 1,
    isActive: true,
    isArchived: false,
    ...overrides,
  };
}
