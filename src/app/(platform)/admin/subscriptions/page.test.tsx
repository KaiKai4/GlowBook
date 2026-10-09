// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getSalonSubscriptionDetail, getSubscriptionsPage } from "@/features/billing/use-cases/salon-subscriptions";
import { getPlatformSalonOverviews } from "@/features/platform/use-cases/get-platform-salon-overviews";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { makeDetail, makeRow } from "@/test/ui-admin-fixtures";
import { makeOverviewsView, makeSubscriptionsData } from "@/test/ui-admin-page-fixtures";
import PlatformSubscriptionsPage from "./page";

vi.mock("@/lib/auth/session", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/platform/use-cases/get-platform-salon-overviews", () => ({
  getPlatformSalonOverviews: vi.fn(),
}));
vi.mock("@/features/billing/use-cases/salon-subscriptions", () => ({
  getSubscriptionsPage: vi.fn(),
  getSalonSubscriptionDetail: vi.fn(),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) =>
      React.createElement("a", { href, className }, children),
  };
});
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock("./actions", () => ({
  resolveAlertAction: vi.fn(),
  assignPlanAction: vi.fn(),
  registerPaymentAction: vi.fn(),
  giveAddonAction: vi.fn(),
  giveManualExtraAction: vi.fn(),
  cancelExtraAction: vi.fn(),
}));

const ROWS = [
  makeRow({ salonId: "salon-1", salonName: "Salón Luna", monthlyTotal: 30 }),
  makeRow({ salonId: "salon-2", salonName: "Barbería Norte", planName: null, planId: null, status: null, monthlyTotal: 0 }),
];

async function render(searchParams?: { salon?: string }): Promise<MountedComponent> {
  return mountComponent(await PlatformSubscriptionsPage({ searchParams: searchParams ? Promise.resolve(searchParams) : undefined }));
}

describe("PlatformSubscriptionsPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(getPlatformSalonOverviews).mockResolvedValue(makeOverviewsView([]));
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({
        rows: ROWS,
        totals: { mrr: 30, salonsWithPlan: 1, trialing: 2, openAlerts: 0 },
      })
    );
    vi.mocked(getSalonSubscriptionDetail).mockImplementation(async (salonId: string) => makeDetail({ salonId }));
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.mocked(getSalonSubscriptionDetail).mockReset();
  });

  it("exige rol de plataforma y arma los datos con los salones de la plataforma", async () => {
    mounted = await render();

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getSubscriptionsPage).toHaveBeenCalledWith([]);
  });

  it("muestra el MRR estimado, los salones con plan y los trials", async () => {
    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("MRR estimado");
    expect(text).toContain("$30.00");
    expect(text).toContain("Con plan");
    expect(text).toContain("En trial");
    expect(text).toContain("2");
    expect(text).toContain("2 registrados");
    expect(text).toContain("1 con plan");
  });

  it("selecciona el primer salón por defecto y carga su detalle", async () => {
    mounted = await render();

    expect(getSalonSubscriptionDetail).toHaveBeenCalledWith("salon-1");
    expect(mounted.container.querySelector("h2")?.textContent).toBe("Salón Luna");
  });

  it("selecciona el salón de la URL cuando existe en la lista", async () => {
    mounted = await render({ salon: "salon-2" });

    expect(getSalonSubscriptionDetail).toHaveBeenCalledWith("salon-2");
    expect(mounted.container.querySelector("h2")?.textContent).toBe("Barbería Norte");
  });

  it("ignora un salón de la URL que no está en la lista y usa el primero", async () => {
    mounted = await render({ salon: "salon-fantasma" });

    expect(getSalonSubscriptionDetail).toHaveBeenCalledWith("salon-1");
  });

  it("indica que no hay salones cuando la lista de suscripciones está vacía", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(makeSubscriptionsData({ rows: [] }));

    mounted = await render();

    expect(mounted.container.textContent).toContain("No hay salones registrados todavia. Invita un salon desde Invitaciones para asignarle un plan.");
    expect(getSalonSubscriptionDetail).not.toHaveBeenCalled();
  });

  it("resalta las alertas abiertas cuando hay alguna", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({ rows: ROWS, totals: { mrr: 0, salonsWithPlan: 0, trialing: 0, openAlerts: 4 } })
    );

    mounted = await render();

    expect(mounted.container.textContent).toContain("Alertas");
    expect(mounted.container.textContent).toContain("4");
    expect(mounted.container.querySelector("span.text-warning")).not.toBeNull();
  });
});
