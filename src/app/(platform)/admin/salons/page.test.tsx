// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getSalonSubscriptionDetail, getSubscriptionsPage } from "@/features/billing/use-cases/salon-subscriptions";
import { getPlatformSalonOverviews } from "@/features/platform/use-cases/get-platform-salon-overviews";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { makeDetail, makeRow } from "@/test/ui-admin-fixtures";
import { makeOverview, makeOverviewsView, makeSubscriptionsData } from "@/test/ui-admin-page-fixtures";
import PlatformSalonsPage from "./page";

vi.mock("@/lib/auth/session", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/platform/use-cases/get-platform-salon-overviews", () => ({
  getPlatformSalonOverviews: vi.fn(),
}));
vi.mock("@/features/billing/use-cases/salon-subscriptions", () => ({
  getSubscriptionsPage: vi.fn(),
  getSalonSubscriptionDetail: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) =>
      React.createElement("a", { href, className }, children),
  };
});
vi.mock("./actions", () => ({ deleteSalonAction: vi.fn(), updateSalonStatusAction: vi.fn() }));
vi.mock("../subscriptions/actions", () => ({
  resolveAlertAction: vi.fn(),
  assignPlanAction: vi.fn(),
  registerPaymentAction: vi.fn(),
  giveAddonAction: vi.fn(),
  giveManualExtraAction: vi.fn(),
  cancelExtraAction: vi.fn(),
}));

const LUNA = makeOverview({ id: "salon-1", name: "Salón Luna" });
const NORTE = makeOverview({ id: "salon-2", name: "Barbería Norte", is_active: false, appointment_count: 12, created_at: "2026-08-15T09:00:00.000Z" });

async function render(searchParams?: { salon?: string }): Promise<MountedComponent> {
  return mountComponent(await PlatformSalonsPage({ searchParams: searchParams ? Promise.resolve(searchParams) : undefined }));
}

describe("PlatformSalonsPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(getPlatformSalonOverviews).mockResolvedValue(makeOverviewsView([LUNA, NORTE]));
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({
        rows: [makeRow({ salonId: "salon-1", salonName: "Salón Luna" }), makeRow({ salonId: "salon-2", salonName: "Barbería Norte", planName: null, planId: null, status: null, salonIsActive: false })],
        totals: { mrr: 30, salonsWithPlan: 1, trialing: 0, openAlerts: 3 },
      })
    );
    vi.mocked(getSalonSubscriptionDetail).mockImplementation(async (salonId: string) =>
      makeDetail({ salonId })
    );
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.mocked(getSalonSubscriptionDetail).mockReset();
  });

  it("exige rol de plataforma antes de cargar los salones", async () => {
    mounted = await render();

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getPlatformSalonOverviews).toHaveBeenCalled();
  });

  it("muestra las métricas globales de salones, citas y alertas abiertas", async () => {
    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Salones");
    expect(text).toContain("Activos");
    expect(text).toContain("Citas totales");
    expect(text).toContain("60");
    expect(text).toContain("Alertas");
    expect(text).toContain("3");
  });

  it("lista los salones registrados y cuenta los activos", async () => {
    mounted = await render();

    expect(mounted.container.textContent).toContain("2 registrados");
    expect(mounted.container.textContent).toContain("1 activos");
  });

  it("muestra por defecto el primer salón y carga su detalle", async () => {
    mounted = await render();

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Salón Luna");
    expect(getSalonSubscriptionDetail).toHaveBeenCalledWith("salon-1");
    expect(getSalonSubscriptionDetail).toHaveBeenCalledTimes(1);
  });

  it("muestra el salón indicado en la URL y carga solo su detalle", async () => {
    mounted = await render({ salon: "salon-2" });

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Barbería Norte");
    expect(getSalonSubscriptionDetail).toHaveBeenCalledWith("salon-2");
    expect(getSalonSubscriptionDetail).toHaveBeenCalledTimes(1);
  });

  it("vuelve al primer salón cuando el ID de la URL no existe", async () => {
    mounted = await render({ salon: "salon-inexistente" });

    expect(mounted.container.querySelector("h2")?.textContent).toBe("Salón Luna");
    expect(getSalonSubscriptionDetail).toHaveBeenCalledWith("salon-1");
  });

  it("formatea la fecha de registro del salón seleccionado", async () => {
    mounted = await render({ salon: "salon-2" });

    const registered = Array.from(mounted.container.querySelectorAll("dt")).find(
      (dt) => dt.textContent === "Registrado"
    );
    expect(registered?.nextElementSibling?.textContent).toContain("2026");
  });

  it("indica que no hay salones y no pide ningún detalle cuando la lista está vacía", async () => {
    vi.mocked(getPlatformSalonOverviews).mockResolvedValue(makeOverviewsView([]));
    vi.mocked(getSubscriptionsPage).mockResolvedValue(makeSubscriptionsData({ rows: [] }));

    mounted = await render();

    expect(mounted.container.textContent).toContain("No hay salones registrados. Invita un salon desde Invitaciones para empezar.");
    expect(getSalonSubscriptionDetail).not.toHaveBeenCalled();
    expect(mounted.container.textContent).toContain("0 registrados");
  });
});
