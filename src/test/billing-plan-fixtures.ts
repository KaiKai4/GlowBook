import type { ProfileWithRole } from "@/types/app.types";
import type { findEffectivePlanRowsForPlatform } from "@/features/billing/data/salon-subscriptions.repo";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  SalonPlanAssignmentStatus,
  SalonPlanOverride,
} from "@/features/billing/domain/commercial-plan";

// Fixtures compartidos por los tests de plan efectivo de billing.
// Solo datos: los vi.mock viven en cada archivo de test.

const appointmentsMetric: CommercialLimitMetric = {
  key: "appointments_monthly",
  moduleKey: "appointments",
  name: "Citas",
  description: "Citas del mes",
  unit: "citas",
  counterKey: "appointments_total",
  defaultCountScope: "monthly",
  isActive: true,
  isArchived: false,
  sortOrder: 1,
};

const employeesMetric: CommercialLimitMetric = {
  key: "employees_active",
  moduleKey: "employees",
  name: "Colaboradores",
  description: "Colaboradores activos",
  unit: "personas",
  counterKey: "employees_active",
  defaultCountScope: "current",
  isActive: true,
  isArchived: false,
  sortOrder: 2,
};

const metrics = [appointmentsMetric, employeesMetric];

export function plan(overrides: Partial<CommercialPlan> = {}): CommercialPlan {
  return {
    id: "plan-basic",
    code: "basic",
    name: "Basico",
    description: "",
    currency: "USD",
    monthlyPrice: 20,
    trialDays: 14,
    status: "active",
    isPublic: true,
    sortOrder: 1,
    modules: [
      { moduleKey: "appointments", enabled: true },
      { moduleKey: "employees", enabled: true },
      { moduleKey: "reports", enabled: false },
    ],
    limits: [
      {
        metricKey: "appointments_monthly",
        maxValue: 10,
        enforcementMode: "block",
        warningThreshold: 80,
        countScope: "monthly",
      },
      {
        metricKey: "employees_active",
        maxValue: 2,
        enforcementMode: "warn",
        warningThreshold: 50,
        countScope: "current",
      },
    ],
    ...overrides,
  };
}

export function override(partial: Partial<SalonPlanOverride>): SalonPlanOverride {
  return {
    id: "ov-1",
    salonId: "salon-1",
    salonName: "Salon",
    moduleKey: null,
    metricKey: null,
    moduleEnabled: null,
    maxDelta: null,
    maxOverride: null,
    enforcementMode: null,
    warningThreshold: null,
    reason: "",
    startsAt: null,
    endsAt: null,
    status: "active",
    addonId: null,
    quantity: 1,
    isGift: false,
    priceOverride: null,
    ...partial,
  };
}

function assignment(status: SalonPlanAssignmentStatus | null) {
  if (status === null) return null;
  return {
    id: "asg-1",
    salon_id: "salon-1",
    plan_id: "plan-basic",
    status,
    starts_at: "2026-01-01",
    ends_at: null,
    current_period_start: null,
    current_period_end: "2026-10-31",
    trial_ends_at: null,
    notes: "",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

export function rows(input: {
  status?: SalonPlanAssignmentStatus | null;
  plan?: CommercialPlan | null;
  overrides?: SalonPlanOverride[];
  usage?: Record<string, number>;
}): Awaited<ReturnType<typeof findEffectivePlanRowsForPlatform>> {
  const status = input.status === undefined ? "active" : input.status;
  return {
    metrics,
    assignment: assignment(status),
    plan: input.plan === undefined ? plan() : input.plan,
    overrides: input.overrides ?? [],
    usage: input.usage ?? {},
  };
}

export function legacyProfile(disabledFeatures: string[] | null): ProfileWithRole {
  return {
    id: "user-1",
    salon_id: "salon-1",
    role_id: null,
    is_owner: true,
    full_name: "Owner",
    is_active: true,
    salon: { disabled_features: disabledFeatures },
    role: null,
  };
}

