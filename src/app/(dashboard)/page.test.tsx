// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getEffectiveDisabledSalonFeatures } from "@/features/billing/use-cases/commercial-plans";
import { getDashboardOverview } from "@/features/dashboard/use-cases/get-dashboard-overview";
import { formatCurrency } from "@/lib/utils/dates";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import DashboardPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/auth/session", () => ({ requireProfile: vi.fn() }));
vi.mock("@/lib/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/permissions")>()),
  getPermissions: vi.fn(() => []),
  hasPermission: vi.fn(() => false),
}));
vi.mock("@/components/layout/nav-items", () => ({ getVisibleNavItems: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  getEffectiveDisabledSalonFeatures: vi.fn(async () => []),
}));
vi.mock("@/features/salon/use-cases/get-dashboard-shell", () => ({
  getOwnerPlanLimitWarnings: vi.fn(async () => []),
  getSalonPaymentStanding: vi.fn(async () => null),
}));
vi.mock("@/features/dashboard/use-cases/get-dashboard-overview", () => ({ getDashboardOverview: vi.fn() }));
vi.mock("@/features/dashboard/use-cases/get-onboarding-checklist", () => ({ getOnboardingChecklist: vi.fn() }));
vi.mock("@/components/layout/plan-limit-banner", () => ({ PlanLimitBanner: () => null }));
vi.mock("@/components/layout/payment-standing-banner", () => ({ PaymentStandingBanner: () => null }));
vi.mock("./onboarding-checklist-card", () => ({ OnboardingChecklistCard: () => null }));
vi.mock("./monthly-appointments-chart", () => ({ MonthlyAppointmentsChart: () => null }));

type Profile = Awaited<ReturnType<typeof requireProfile>>;
type NavItems = ReturnType<typeof getVisibleNavItems>;

function navItem(href: string): NavItems[number] {
  return { href, label: href, icon: () => null } as unknown as NavItems[number];
}

describe("DashboardPage redireccion del unico modulo visible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProfile).mockResolvedValue({
      id: "user-1",
      salon_id: "salon-1",
      is_owner: false,
    } as unknown as Profile);
  });

  it("no redirige a '/' cuando el unico modulo visible es Inicio (evita bucle)", async () => {
    vi.mocked(getVisibleNavItems).mockReturnValue([navItem("/")]);

    await expect(DashboardPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirige al modulo unico cuando su ruta es distinta de '/'", async () => {
    vi.mocked(getVisibleNavItems).mockReturnValue([navItem("/appointments")]);

    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/appointments");
  });
});

describe("DashboardPage indicadores de dinero", () => {
  let mounted: MountedComponent | null = null;

  // Agregados tal como llegan de report_dashboard_metrics.
  const metrics = {
    todayAppointments: 3,
    appointmentRevenue: 35.5,
    retailRevenue: 12,
    manualExpenses: 5,
    inventoryPurchases: 7,
    lowStockProducts: 0,
    totalCustomers: 12,
    completedThisMonth: 2,
    monthRevenue: 47.5,
    monthExpenses: 12,
    estimatedProfit: 35.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProfile).mockResolvedValue({
      id: "owner-1",
      salon_id: "salon-1",
      is_owner: true,
    } as unknown as Profile);
    vi.mocked(getVisibleNavItems).mockReturnValue([navItem("/"), navItem("/appointments")]);
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue([]);
    vi.mocked(getDashboardOverview).mockResolvedValue({
      metrics,
      topServices: [],
      monthlyCompletedAppointments: [],
      pending: [],
    });
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.mocked(hasPermission).mockReturnValue(false);
  });

  async function renderPage(): Promise<HTMLDivElement> {
    mounted = mountComponent(await DashboardPage());
    return mounted.container;
  }

  it("muestra ingresos, gastos y ganancias del mes tal como vienen de la base", async () => {
    const container = await renderPage();

    expect(container.textContent).toContain(formatCurrency(12));
    expect(container.textContent).toContain(formatCurrency(47.5));
    expect(container.textContent).toContain(formatCurrency(35.5));
  });

  it("sin modulo retail el ingreso son las citas y la ganancia descuenta los gastos", async () => {
    vi.mocked(getEffectiveDisabledSalonFeatures).mockResolvedValue(["retail"]);

    const container = await renderPage();

    expect(container.textContent).toContain(formatCurrency(35.5));
    expect(container.textContent).toContain(formatCurrency(23.5));
    expect(container.textContent).not.toContain(formatCurrency(47.5));
  });

  it("muestra la cabecera de bienvenida y las etiquetas de las tarjetas de métricas", async () => {
    const container = await renderPage();

    expect(container.querySelector("h1")?.textContent).toBe("Bienvenido");
    for (const label of ["Ingresos del mes", "Citas hoy", "Clientes registrados", "Productos con bajo stock"]) {
      expect(container.textContent).toContain(label);
    }
  });

  it("marca en tono de peligro la ganancia negativa y el bajo stock, y no la ganancia positiva", async () => {
    vi.mocked(getDashboardOverview).mockResolvedValue({
      metrics: { ...metrics, estimatedProfit: -5, lowStockProducts: 2 },
      topServices: [],
      monthlyCompletedAppointments: [],
      pending: [],
    });

    const container = await renderPage();
    const valueOf = (label: string) =>
      Array.from(container.querySelectorAll("p")).find((node) => node.textContent === label)?.nextElementSibling;

    expect(valueOf("Ganancias del mes")?.className).toContain("text-danger");
    expect(valueOf("Productos con bajo stock")?.className).toContain("text-danger");
    expect(valueOf("Ingresos del mes")?.className).not.toContain("text-danger");
  });
});
