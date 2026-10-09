// @vitest-environment jsdom
// Mide las lecturas por request: layout y pagina del dashboard comparten el
// shell del salon (plan efectivo) gracias al lector cacheado del composition root.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileWithRole } from "@/types/app.types";
import { getProfile, requireProfile } from "@/app/_composition/request-context";
import { getDashboardShell, getOwnerPlanLimitWarnings } from "@/features/salon/use-cases/get-dashboard-shell";
import { getOnboardingChecklist } from "@/features/dashboard/use-cases/get-onboarding-checklist";
import { getDashboardOverview } from "@/features/dashboard/use-cases/get-dashboard-overview";
import DashboardLayout from "./layout";
import DashboardPage from "./page";

// React cache de una sola request: memoiza por argumento (identidad) dentro de
// cada cache(fn). Sustituye al cache de RSC, que no existe fuera de un render.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: (arg: unknown) => unknown) => {
    const seen = new Map<unknown, unknown>();
    return (arg: unknown) => {
      if (!seen.has(arg)) seen.set(arg, fn(arg));
      return seen.get(arg);
    };
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/app/_composition/request-context", () => ({
  getProfile: vi.fn(),
  isPlatformAdmin: vi.fn(async () => false),
  requireProfile: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/get-dashboard-shell", () => ({
  getDashboardShell: vi.fn(),
  getOwnerPlanLimitWarnings: vi.fn(async () => []),
}));
vi.mock("@/features/dashboard/use-cases/get-onboarding-checklist", () => ({
  getOnboardingChecklist: vi.fn(async () => null),
}));
vi.mock("@/features/dashboard/use-cases/get-dashboard-overview", () => ({
  getDashboardOverview: vi.fn(async () => ({
    metrics: null,
    topServices: [],
    monthlyCompletedAppointments: [],
    pending: [],
  })),
}));
vi.mock("@/components/layout/nav-items", () => ({
  getVisibleNavItems: vi.fn(() => [
    { href: "/", label: "Inicio", icon: () => null },
    { href: "/appointments", label: "Citas", icon: () => null },
  ]),
}));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/layout/feedback-bubble", () => ({ FeedbackBubble: () => null }));
vi.mock("@/components/layout/plan-limit-banner", () => ({ PlanLimitBanner: () => null }));
vi.mock("@/components/layout/payment-standing-banner", () => ({ PaymentStandingBanner: () => null }));
vi.mock("@/components/layout/unsaved-changes", () => ({
  UnsavedChangesProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/ui/toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/brand/glowbook-logo", () => ({ GlowBookBrand: () => null }));
vi.mock("./feedback/actions", () => ({ submitFeedbackAction: vi.fn() }));
vi.mock("./onboarding-checklist-card", () => ({ OnboardingChecklistCard: () => null }));
vi.mock("./monthly-appointments-chart", () => ({ MonthlyAppointmentsChart: () => null }));

const SHELL = {
  salonName: "Salon Test",
  isActive: true,
  theme: "violet",
  bgStyle: "neutral",
  permissions: [],
  disabledFeatures: [],
  paymentStanding: { state: "active" },
};

function ownerProfile(): ProfileWithRole {
  return {
    id: "owner-1",
    salon_id: "salon-1",
    is_owner: true,
    is_active: true,
    salon: { disabled_features: [] },
  } as unknown as ProfileWithRole;
}

describe("lecturas por request del dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDashboardShell).mockResolvedValue(SHELL as never);
  });

  it("layout y pagina de la misma request leen el shell del salon una sola vez", async () => {
    const profile = ownerProfile();
    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(requireProfile).mockResolvedValue(profile);

    await DashboardLayout({ children: null });
    await DashboardPage();

    expect(getDashboardShell).toHaveBeenCalledTimes(1);
    expect(getDashboardShell).toHaveBeenCalledWith(profile);
    expect(getOwnerPlanLimitWarnings).toHaveBeenCalledTimes(1);
    expect(getOnboardingChecklist).toHaveBeenCalledTimes(1);
    expect(getDashboardOverview).toHaveBeenCalledTimes(1);
  });

  it("una request nueva (perfil nuevo) vuelve a leer el shell", async () => {
    const first = ownerProfile();
    vi.mocked(getProfile).mockResolvedValue(first);
    vi.mocked(requireProfile).mockResolvedValue(first);
    await DashboardLayout({ children: null });

    const second = ownerProfile();
    vi.mocked(getProfile).mockResolvedValue(second);
    vi.mocked(requireProfile).mockResolvedValue(second);
    await DashboardLayout({ children: null });

    expect(getDashboardShell).toHaveBeenCalledTimes(2);
  });
});
