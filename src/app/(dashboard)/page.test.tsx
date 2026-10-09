// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { getVisibleNavItems } from "@/components/layout/nav-items";
import { requireProfile } from "@/lib/auth/session";
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
