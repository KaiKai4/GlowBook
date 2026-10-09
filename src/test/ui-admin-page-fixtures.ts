// Fixtures para tests de páginas server de /admin (salons, subscriptions, plans).
import type { SalonOverview } from "@/features/platform/data/salon-overviews.repo";
import type { PlatformSalonOverviewsViewModel } from "@/features/platform/use-cases/get-platform-salon-overviews";
import type { SubscriptionsPageData } from "@/features/billing/use-cases/salon-subscriptions";
import type { CommercialPlansPageData } from "@/features/billing/use-cases/commercial-plans";
import { makeAddon, makeMetric, makeModule, makePlan, makeRow } from "./ui-admin-fixtures";

export function makeOverview(overrides: Partial<SalonOverview> = {}): SalonOverview {
  return {
    id: "salon-1",
    name: "Salón Luna",
    email: "owner@luna.test",
    contact_email: "hola@luna.test",
    phone: "+507 6000-0000",
    is_active: true,
    created_at: "2026-09-01T15:30:00.000Z",
    disabled_features: [],
    owner_names: ["Ana Pérez"],
    owner_count: 1,
    customer_count: 12,
    collaborator_count: 3,
    appointment_count: 48,
    service_count: 7,
    invitation_count: 1,
    last_appointment_at: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

export function makeOverviewsView(
  salons: SalonOverview[],
  overrides: Partial<PlatformSalonOverviewsViewModel["metrics"]> = {}
): PlatformSalonOverviewsViewModel {
  return {
    salons,
    metrics: {
      totalSalons: salons.length,
      activeSalons: salons.filter((salon) => salon.is_active).length,
      totalAppointments: salons.reduce((total, salon) => total + salon.appointment_count, 0),
      dormantSalons: 0,
      ...overrides,
    },
    dormantSalons: [],
  };
}

export function makeSubscriptionsData(overrides: Partial<SubscriptionsPageData> = {}): SubscriptionsPageData {
  return {
    rows: [makeRow()],
    plans: [makePlan()],
    addons: [makeAddon()],
    metrics: [makeMetric()],
    modules: [{ key: "appointments", name: "Agenda" }],
    totals: { mrr: 30, salonsWithPlan: 1, trialing: 0, openAlerts: 0 },
    ...overrides,
  };
}

export function makeCommercialPlansData(overrides: Partial<CommercialPlansPageData> = {}): CommercialPlansPageData {
  return {
    modules: [makeModule()],
    metrics: [makeMetric()],
    plans: [makePlan({ id: "plan-pro", name: "Pro" }), makePlan({ id: "plan-basico", name: "Básico", status: "draft" })],
    addons: [makeAddon()],
    assignmentsByPlan: { "plan-pro": 2 },
    ...overrides,
  };
}
