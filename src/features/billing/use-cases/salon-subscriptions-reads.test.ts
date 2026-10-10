import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findEffectivePlanRows,
  findOpenSalonAlerts,
  findSalonPayments,
  findSubscriptionRows,
} from "../data/salon-subscriptions.repo";
import type { AssignmentRow, PlanAlert } from "../data/salon-subscriptions.rows";
import { findCommercialAddons } from "../data/commercial-addons.repo";
import { findPlanCatalog } from "../data/commercial-plans.repo";
import type { CommercialAddon } from "../domain/salon-extras";
import type {
  CommercialLimitMetric,
  CommercialPlan,
  SalonPlanAssignmentStatus,
  SalonPlanOverride,
} from "../domain/commercial-plan";
import { legacyProfile, override, plan, rows } from "@/test/billing-plan-fixtures";
import {
  getEffectiveDisabledSalonFeatures,
  isEffectiveSalonModuleEnabled,
  salonModuleScopeFromProfile,
} from "./plan-modules";
import { getSalonSubscriptionDetail } from "./salon-subscription-detail";
import { getSubscriptionsPage } from "./salon-subscriptions-page";
import { SALON_FEATURES } from "@/features/salon-features";

// Lecturas de suscripciones: el panel de plataforma (todas las filas de salones),
// el detalle de un salón y el acceso efectivo a módulos con fallback legacy.

vi.mock("../data/salon-subscriptions.repo", () => ({
  activatePaidPeriod: vi.fn(),
  assignSalonPlan: vi.fn(),
  findAssignmentForPayment: vi.fn(),
  findAssignmentStartsAt: vi.fn(),
  findEffectivePlanRows: vi.fn(),
  findOpenSalonAlerts: vi.fn(),
  findSalonPayments: vi.fn(),
  findSubscriptionRows: vi.fn(),
  hasOpenPlanAlert: vi.fn(),
  recordPlanAlert: vi.fn(),
  recordSalonPlanPayment: vi.fn(),
  resolvePlanAlert: vi.fn(),
  saveSalonPlanOverride: vi.fn(),
  updateSalonPlanOverrideStatus: vi.fn(),
}));
vi.mock("../data/commercial-addons.repo", () => ({
  findCommercialAddonById: vi.fn(),
  findCommercialAddons: vi.fn(),
}));
vi.mock("../data/commercial-plans.repo", () => ({
  findPlanCatalog: vi.fn(),
  findPlanWithChildren: vi.fn(),
}));
vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const findSubscriptionRowsMock = vi.mocked(findSubscriptionRows);
const findEffectivePlanRowsMock = vi.mocked(findEffectivePlanRows);
const findSalonPaymentsMock = vi.mocked(findSalonPayments);
const findOpenSalonAlertsMock = vi.mocked(findOpenSalonAlerts);
const findCommercialAddonsMock = vi.mocked(findCommercialAddons);
const findPlanCatalogMock = vi.mocked(findPlanCatalog);

type SubscriptionRows = Awaited<ReturnType<typeof findSubscriptionRows>>;

const SALON_1 = "salon-1";
const SALON_2 = "salon-2";
const SALON_3 = "salon-3";
const SALON_4 = "salon-4";
const SALON_5 = "salon-5";

// Solo se leen id, name e is_active de cada salón del panel de plataforma.
function platformSalon(id: string, name: string, isActive = true): { id: string; name: string; is_active: boolean } {
  return { id, name, is_active: isActive };
}

const basicPlan: CommercialPlan = plan({ id: "plan-basic", name: "Básico", monthlyPrice: 20, currency: "USD" });
const draftPlan: CommercialPlan = plan({ id: "plan-draft", name: "Borrador", status: "draft", monthlyPrice: 99 });

const addonActive: CommercialAddon = {
  id: "addon-active",
  code: "reportes",
  name: "Reportes",
  description: "",
  kind: "module",
  moduleKey: "reports",
  metricKey: null,
  limitDelta: null,
  currency: "USD",
  monthlyPrice: 10,
  status: "active",
  sortOrder: 1,
};
const addonDraft: CommercialAddon = { ...addonActive, id: "addon-draft", code: "borrador", status: "draft" };

const metricActive: CommercialLimitMetric = {
  key: "appointments_monthly",
  moduleKey: "appointments",
  name: "Citas",
  description: "",
  unit: "citas",
  counterKey: "appointments_total",
  defaultCountScope: "monthly",
  isActive: true,
  isArchived: false,
  sortOrder: 1,
};
const metricArchived: CommercialLimitMetric = { ...metricActive, key: "old_metric", isArchived: true };

beforeEach(() => {
  vi.clearAllMocks();
  findPlanCatalogMock.mockResolvedValue({
    modules: [
      { key: "appointments", name: "Citas", description: "", navHref: "/", iconName: "", sortOrder: 1, isActive: true, isArchived: false },
      { key: "reports", name: "Reportes", description: "", navHref: "/", iconName: "", sortOrder: 2, isActive: false, isArchived: false },
    ],
    metrics: [metricActive, metricArchived],
    plans: [basicPlan, draftPlan],
  });
  findCommercialAddonsMock.mockResolvedValue([addonActive, addonDraft]);
  findOpenSalonAlertsMock.mockResolvedValue([]);
  findSalonPaymentsMock.mockResolvedValue([]);
});

describe("getSubscriptionsPage", () => {
  const extraForSalon1: SalonPlanOverride = override({
    id: "ov-extra",
    salonId: SALON_1,
    moduleKey: "reports",
    moduleEnabled: null,
    addonId: addonActive.id,
    quantity: 2,
    status: "active",
  });
  const canceledExtra: SalonPlanOverride = override({
    id: "ov-canceled",
    salonId: SALON_1,
    addonId: addonActive.id,
    status: "canceled",
  });
  const giftExtraSalon2: SalonPlanOverride = override({
    id: "ov-gift",
    salonId: SALON_2,
    addonId: addonActive.id,
    isGift: true,
    status: "active",
  });

  function assignmentFor(salonId: string, status: SalonPlanAssignmentStatus, trialEndsAt: string | null = null): AssignmentRow {
    return {
      id: `asg-${salonId}`,
      salon_id: salonId,
      plan_id: basicPlan.id,
      status,
      starts_at: "2026-01-01",
      ends_at: null,
      trial_ends_at: trialEndsAt,
      current_period_start: null,
      current_period_end: null,
      notes: "",
    };
  }

  function alertFor(id: string, salonId: string, status: PlanAlert["status"]): PlanAlert {
    return {
      id,
      salon_id: salonId,
      plan_id: basicPlan.id,
      metric_key: null,
      module_key: null,
      severity: "warning",
      message: "Alerta",
      status,
      created_at: "2026-10-08T10:00:00.000Z",
    };
  }

  function subscriptionRows(): SubscriptionRows {
    return {
      assignments: [
        assignmentFor(SALON_1, "active"),
        assignmentFor(SALON_2, "trialing", "2026-10-23"),
        assignmentFor(SALON_3, "paused"),
        assignmentFor(SALON_4, "past_due"),
      ],
      overrides: [extraForSalon1, canceledExtra, giftExtraSalon2],
      alerts: [
        alertFor("al-1", SALON_1, "open"),
        alertFor("al-2", SALON_1, "open"),
        alertFor("al-3", SALON_1, "resolved"),
        alertFor("al-4", SALON_2, "open"),
      ],
    };
  }

  it("calcula precio del plan, extras y total mensual por salón solo para estados facturables", async () => {
    findSubscriptionRowsMock.mockResolvedValue(subscriptionRows());

    const page = await getSubscriptionsPage([
      platformSalon(SALON_1, "Salón Uno"),
      platformSalon(SALON_2, "Salón Dos"),
      platformSalon(SALON_3, "Salón Tres"),
      platformSalon(SALON_4, "Salón Cuatro"),
      platformSalon(SALON_5, "Salón Cinco"),
    ]);

    const byId = Object.fromEntries(page.rows.map((row) => [row.salonId, row]));
    // Activo: plan 20 + extra de módulo 10 x 2 = 40. Solo este cuenta para el MRR.
    expect(byId[SALON_1]).toEqual(
      expect.objectContaining({
        salonName: "Salón Uno",
        planId: basicPlan.id,
        planName: "Básico",
        planPrice: 20,
        status: "active",
        extrasCount: 1,
        extrasPrice: 20,
        monthlyTotal: 40,
        openAlertCount: 2,
      })
    );
    // Trial: cobra el plan y el extra regalado no suma precio pero sí cuenta.
    expect(byId[SALON_2]).toEqual(
      expect.objectContaining({
        planPrice: 20,
        trialEndsAt: "2026-10-23",
        extrasCount: 1,
        extrasPrice: 0,
        monthlyTotal: 20,
        openAlertCount: 1,
      })
    );
    // Pausado y vencido con plan: el plan aparece, pero no genera cobro.
    expect(byId[SALON_3]).toEqual(expect.objectContaining({ planId: basicPlan.id, planPrice: 0, monthlyTotal: 0 }));
    expect(byId[SALON_4]).toEqual(expect.objectContaining({ status: "past_due", planPrice: 20, monthlyTotal: 20 }));
    // Sin asignación: sin plan y moneda por defecto.
    expect(byId[SALON_5]).toEqual({
      salonId: SALON_5,
      salonName: "Salón Cinco",
      salonIsActive: true,
      planId: null,
      planName: null,
      planPrice: 0,
      currency: "USD",
      status: null,
      trialEndsAt: null,
      extrasCount: 0,
      extrasPrice: 0,
      monthlyTotal: 0,
      openAlertCount: 0,
    });
  });

  it("resume totales: MRR solo de salones activos, con plan, en prueba y alertas abiertas", async () => {
    findSubscriptionRowsMock.mockResolvedValue(subscriptionRows());

    const page = await getSubscriptionsPage([
      platformSalon(SALON_1, "Salón Uno"),
      platformSalon(SALON_2, "Salón Dos"),
      platformSalon(SALON_3, "Salón Tres"),
      platformSalon(SALON_4, "Salón Cuatro"),
      platformSalon(SALON_5, "Salón Cinco"),
    ]);

    expect(page.totals).toEqual({ mrr: 40, salonsWithPlan: 4, trialing: 1, openAlerts: 3 });
  });

  it("solo expone planes, extras, métricas y módulos vigentes del catálogo", async () => {
    findSubscriptionRowsMock.mockResolvedValue(subscriptionRows());

    const page = await getSubscriptionsPage([]);

    expect(page.rows).toEqual([]);
    expect(page.plans.map((item) => item.id)).toEqual([basicPlan.id]);
    expect(page.addons.map((item) => item.id)).toEqual([addonActive.id]);
    expect(page.metrics.map((item) => item.key)).toEqual([metricActive.key]);
    expect(page.modules).toEqual([{ key: "appointments", name: "Citas" }]);
    expect(page.totals).toEqual({ mrr: 0, salonsWithPlan: 0, trialing: 0, openAlerts: 0 });
  });
});

describe("getSalonSubscriptionDetail", () => {
  it("arma extras con nombre, detalle y precio; reemplaza límites con sobreescrituras", async () => {
    const moduleOverride = override({
      id: "ov-module",
      moduleKey: "reports",
      moduleEnabled: true,
      addonId: null,
    });
    const addonBoost = override({
      id: "ov-addon",
      moduleKey: null,
      metricKey: "appointments_monthly",
      maxDelta: 100,
      addonId: addonActive.id,
      quantity: 2,
      isGift: false,
    });
    const fixedLimit = override({
      id: "ov-fixed",
      moduleKey: null,
      metricKey: "employees_active",
      maxOverride: 50,
      addonId: null,
      isGift: true,
    });
    const genericExtra = override({
      id: "ov-generic",
      moduleKey: null,
      metricKey: null,
      maxDelta: null,
      addonId: null,
      isGift: false,
    });
    findEffectivePlanRowsMock.mockResolvedValue(
      rows({
        status: "active",
        plan: basicPlan,
        overrides: [moduleOverride, addonBoost, fixedLimit, genericExtra],
        usage: { appointments_monthly: 50, employees_active: 2 },
      })
    );
    findCommercialAddonsMock.mockResolvedValue([addonActive]);
    findSalonPaymentsMock.mockResolvedValue([
      {
        id: "pay-1",
        salon_id: SALON_1,
        plan_id: basicPlan.id,
        amount: "20.00",
        currency: "USD",
        paid_at: "2026-10-01",
        period_start: "2026-10-01",
        period_end: "2026-11-01",
        notes: "Transferencia",
      },
    ]);
    findOpenSalonAlertsMock.mockResolvedValue([
      {
        id: "al-1",
        salon_id: SALON_1,
        plan_id: basicPlan.id,
        metric_key: null,
        module_key: null,
        severity: "warning",
        message: "Cerca del límite",
        status: "open",
        created_at: "2026-10-08T10:00:00.000Z",
      },
    ]);

    const detail = await getSalonSubscriptionDetail(SALON_1);

    expect(detail.extras).toEqual([
      expect.objectContaining({ id: "ov-module", name: "Reportes", detail: "Módulo activado", monthlyPrice: 0 }),
      // Extra de catálogo: precio 10 x 2 y detalle +200 citas (delta x cantidad).
      expect.objectContaining({
        id: "ov-addon",
        name: "Reportes",
        detail: "+200 citas",
        quantity: 2,
        monthlyPrice: 20,
      }),
      // Regalo: no cobra aunque fije el límite.
      expect.objectContaining({
        id: "ov-fixed",
        name: "Colaboradores",
        detail: "Límite fijado en 50 personas",
        isGift: true,
        monthlyPrice: 0,
      }),
      expect.objectContaining({
        id: "ov-generic",
        name: "Extra personalizado",
        detail: "Ajuste de límite",
        monthlyPrice: 0,
      }),
    ]);
    expect(detail.extrasPrice).toBe(20);
    expect(detail.planPrice).toBe(20);
    expect(detail.monthlyTotal).toBe(40);
    expect(detail.payments).toEqual([
      {
        id: "pay-1",
        amount: 20,
        currency: "USD",
        paidAt: "2026-10-01",
        periodStart: "2026-10-01",
        periodEnd: "2026-11-01",
        notes: "Transferencia",
      },
    ]);
    expect(detail.openAlerts).toEqual([
      { id: "al-1", severity: "warning", message: "Cerca del límite", createdAt: "2026-10-08T10:00:00.000Z" },
    ]);
  });

  it("calcula límites efectivos: sobreescritura de delta sobre el máximo del plan y porcentaje de uso", async () => {
    const boost = override({
      id: "ov-boost",
      metricKey: "appointments_monthly",
      maxDelta: 100,
      quantity: 2,
      addonId: null,
    });
    findEffectivePlanRowsMock.mockResolvedValue(
      rows({ status: "active", plan: basicPlan, overrides: [boost], usage: { appointments_monthly: 50 } })
    );

    const detail = await getSalonSubscriptionDetail(SALON_1);

    // Plan: 10 citas + delta 100 x 2 = 210 máximo. Usado 50 => 24 %, restante 160.
    expect(detail.limits.find((limit) => limit.metric.key === "appointments_monthly")).toEqual(
      expect.objectContaining({
        maxValue: 210,
        used: 50,
        remaining: 160,
        percentage: 24,
        enforcementMode: "block",
        warningLevel: "none",
      })
    );
  });

  it("oculta límites de módulos apagados y expone módulos activados por sobreescritura", async () => {
    const enableReports = override({ moduleKey: "reports", moduleEnabled: true, addonId: null });
    const disableEmployees = override({ moduleKey: "employees", moduleEnabled: false, addonId: null });
    findEffectivePlanRowsMock.mockResolvedValue(
      rows({ status: "active", plan: basicPlan, overrides: [enableReports, disableEmployees] })
    );

    const detail = await getSalonSubscriptionDetail(SALON_1);

    expect(detail.enabledModules).toEqual(["appointments", "reports"]);
    expect(detail.limits.map((limit) => limit.metric.key)).toEqual(["appointments_monthly"]);
    // Módulo que no está en el catálogo se muestra con su clave y el estado de apagado.
    const disabled = override({ moduleKey: "customers", moduleEnabled: false, addonId: null });
    findEffectivePlanRowsMock.mockResolvedValueOnce(rows({ status: "active", plan: basicPlan, overrides: [disabled] }));
    const withUnknownModule = await getSalonSubscriptionDetail(SALON_1);
    expect(withUnknownModule.extras[0]).toEqual(
      expect.objectContaining({ name: "customers", detail: "Módulo desactivado" })
    );
  });

  it("no cobra el plan cuando el salón no tiene asignación ni plan", async () => {
    findEffectivePlanRowsMock.mockResolvedValue(rows({ status: null, plan: null, overrides: [] }));

    const detail = await getSalonSubscriptionDetail(SALON_1);

    expect(detail.assignment).toBeNull();
    expect(detail.plan).toBeNull();
    expect(detail.limits).toEqual([]);
    expect(detail.enabledModules).toEqual([]);
    expect(detail.planPrice).toBe(0);
    expect(detail.monthlyTotal).toBe(0);
  });

  it("el detalle con asignación pausada es coherente con el plan efectivo: sin módulos, límites ni precio de plan", async () => {
    // getEffectiveSalonPlan descarta el plan en estado pausado; el detalle debe hacer lo mismo.
    findEffectivePlanRowsMock.mockResolvedValue(rows({ status: "paused", plan: basicPlan, overrides: [] }));

    const detail = await getSalonSubscriptionDetail(SALON_1);

    expect(detail.planPrice).toBe(0);
    expect(detail.plan).toBeNull();
    expect(detail.enabledModules).toEqual([]);
    expect(detail.limits).toEqual([]);
  });
});

describe("acceso efectivo a módulos con fallback legacy", () => {
  const legacy = legacyProfile(["reports", "not-a-feature"]);

  it("getEffectiveDisabledSalonFeatures usa los módulos desactivados del plan cuando existe", async () => {
    findEffectivePlanRowsMock.mockResolvedValue(rows({ status: "active", plan: basicPlan }));

    const disabled = await getEffectiveDisabledSalonFeatures(salonModuleScopeFromProfile(legacy));

    expect(disabled).toContain("reports");
    expect(disabled).not.toContain("appointments");
    expect(disabled).toEqual(
      SALON_FEATURES.map((feature) => feature.key).filter((key) => key !== "appointments" && key !== "employees")
    );
  });

  it("getEffectiveDisabledSalonFeatures cae a las banderas legacy sin plan o si la lectura falla", async () => {
    findEffectivePlanRowsMock.mockResolvedValueOnce(rows({ status: null, plan: null }));
    expect(await getEffectiveDisabledSalonFeatures(salonModuleScopeFromProfile(legacy))).toEqual(["reports"]);

    findEffectivePlanRowsMock.mockRejectedValueOnce(new Error("base caída"));
    expect(await getEffectiveDisabledSalonFeatures(salonModuleScopeFromProfile(legacy))).toEqual(["reports"]);
  });

  it("isEffectiveSalonModuleEnabled consulta el plan efectivo cuando existe", async () => {
    findEffectivePlanRowsMock.mockResolvedValue(rows({ status: "active", plan: basicPlan }));

    expect(await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(legacy), "appointments")).toBe(true);
    expect(await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(legacy), "reports")).toBe(false);
  });

  it("isEffectiveSalonModuleEnabled usa las banderas legacy sin plan o si la lectura falla", async () => {
    findEffectivePlanRowsMock.mockResolvedValueOnce(rows({ status: null, plan: null }));
    expect(await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(legacy), "reports")).toBe(false);
    findEffectivePlanRowsMock.mockResolvedValueOnce(rows({ status: null, plan: null }));
    expect(await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(legacy), "customers")).toBe(true);

    findEffectivePlanRowsMock.mockRejectedValueOnce(new Error("base caída"));
    expect(await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(legacy), "customers")).toBe(true);
    findEffectivePlanRowsMock.mockRejectedValueOnce(new Error("base caída"));
    expect(await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(legacy), "reports")).toBe(false);
  });
});
