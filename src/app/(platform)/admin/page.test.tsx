// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getSubscriptionsPage } from "@/features/billing/use-cases/salon-subscriptions";
import { getPlatformAdminHome, type PlatformAdminHomeViewModel } from "@/features/platform/use-cases/get-platform-admin-home";
import { getPlatformSalonOverviews } from "@/features/platform/use-cases/get-platform-salon-overviews";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { getButtonByText } from "@/test/ui-admin-dom";
import { makeRow } from "@/test/ui-admin-fixtures";
import { makeOverviewsView, makeSubscriptionsData } from "@/test/ui-admin-page-fixtures";
import PlatformAdminPage from "./page";

vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/platform/use-cases/get-platform-admin-home", () => ({ getPlatformAdminHome: vi.fn() }));
vi.mock("@/features/platform/use-cases/get-platform-salon-overviews", () => ({ getPlatformSalonOverviews: vi.fn() }));
vi.mock("@/features/billing/use-cases/salon-subscriptions", () => ({ getSubscriptionsPage: vi.fn() }));
vi.mock("./actions", () => ({ regenerateSalonInvitationAction: vi.fn() }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) =>
      React.createElement("a", { href, className }, children),
  };
});

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const FAR_FUTURE_ISO = "2099-01-01";

function home(overrides: Partial<PlatformAdminHomeViewModel> = {}): PlatformAdminHomeViewModel {
  return {
    salons: [],
    pendingInvitations: [],
    metrics: { totalSalons: 3, activeSalons: 2, pendingInvitations: 0 },
    ...overrides,
  };
}

async function render(): Promise<MountedComponent> {
  return mountComponent(await PlatformAdminPage());
}

function cardText(container: HTMLElement, title: string): string {
  const heading = Array.from(container.querySelectorAll("*")).find(
    (el) => el.children.length === 0 && el.textContent === title
  );
  return heading?.closest(".overflow-hidden")?.textContent ?? "";
}

describe("PlatformAdminPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(getPlatformAdminHome).mockResolvedValue(home());
    vi.mocked(getPlatformSalonOverviews).mockResolvedValue(makeOverviewsView([]));
    vi.mocked(getSubscriptionsPage).mockResolvedValue(makeSubscriptionsData({ rows: [], totals: { mrr: 0, salonsWithPlan: 0, trialing: 0, openAlerts: 0 } }));
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("exige rol de plataforma y consulta el inicio, los salones y las suscripciones", async () => {
    mounted = await render();

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getPlatformAdminHome).toHaveBeenCalledTimes(1);
    expect(getPlatformSalonOverviews).toHaveBeenCalledTimes(1);
    expect(getSubscriptionsPage).toHaveBeenCalledWith([]);
  });

  it("muestra el MRR, los salones activos sobre el total, los trials y las alertas abiertas", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({ rows: [], totals: { mrr: 62.5, salonsWithPlan: 2, trialing: 1, openAlerts: 0 } })
    );

    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("MRR estimado");
    expect(text).toContain("$62.50");
    expect(text).toContain("2 de 3");
    expect(text).toContain("En trial");
    expect(text).toContain("Alertas abiertas");
  });

  it("resalta las alertas abiertas solo cuando hay alguna", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({ rows: [], totals: { mrr: 0, salonsWithPlan: 0, trialing: 0, openAlerts: 2 } })
    );

    mounted = await render();

    expect(mounted.container.querySelector("p.text-warning-fg")?.textContent).toBe("2");
  });

  it("no resalta las alertas cuando no hay ninguna abierta", async () => {
    mounted = await render();

    expect(mounted.container.querySelector("p.text-warning-fg")).toBeNull();
  });

  it("muestra la todo en orden cuando no hay nada que atender", async () => {
    mounted = await render();

    expect(mounted.container.textContent).toContain("Todo en orden: sin alertas, morosos, trials por vencer ni salones dormidos.");
  });

  it("explica cada motivo de atención: límites, morosos, trial por vencer, sin plan y dormidos", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({
        rows: [
          makeRow({ salonId: "s-limit", salonName: "Límites", openAlertCount: 2 }),
          makeRow({ salonId: "s-past", salonName: "Moroso", status: "past_due" }),
          makeRow({ salonId: "s-trial", salonName: "Trial", status: "trialing", trialEndsAt: TODAY_ISO }),
          makeRow({ salonId: "s-noplan", salonName: "Sin plan", planId: null, planName: null, status: null, salonIsActive: true }),
        ],
      })
    );
    vi.mocked(getPlatformSalonOverviews).mockResolvedValue(
      makeOverviewsView([], {}),
    );

    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("2 alertas de límite abiertas.");
    expect(text).toContain("Pago vencido: registra el pago o pausa la suscripcion.");
    expect(text).toContain("Trial por vencer");
    expect(text).toContain("Salon activo sin plan: ve todo sin límites.");
  });

  it("usa singular para una sola alerta de límite", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({ rows: [makeRow({ salonId: "s-1", openAlertCount: 1 })] })
    );

    mounted = await render();

    expect(mounted.container.textContent).toContain("1 alerta de límite abierta.");
  });

  it("no marca como trial por vencer los trials cuya fecha queda lejos", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({ rows: [makeRow({ salonId: "s-1", status: "trialing", trialEndsAt: FAR_FUTURE_ISO })] })
    );

    mounted = await render();

    expect(mounted.container.textContent).not.toContain("Trial por vencer");
    expect(mounted.container.textContent).toContain("Todo en orden");
  });

  it("no marca sin plan a los salones inactivos y no incluye salones con plan en la lista de atención", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({
        rows: [makeRow({ salonId: "s-off", salonIsActive: false, planId: null, planName: null, status: null })],
      })
    );

    mounted = await render();

    expect(mounted.container.textContent).not.toContain("Salon activo sin plan");
  });

  it("incluye los salones dormidos en la lista de atención con contacto recomendado", async () => {
    vi.mocked(getPlatformSalonOverviews).mockResolvedValue({
      ...makeOverviewsView([]),
      dormantSalons: [{ id: "s-dormido", name: "Salón Quieto" }],
    });

    mounted = await render();

    expect(mounted.container.textContent).toContain("Salón Quieto");
    expect(mounted.container.textContent).toContain("Sin citas en los últimos 30 días: contacto recomendado.");
    expect(mounted.container.querySelector('a[href="/admin/subscriptions?salon=s-dormido"]')).not.toBeNull();
  });

  it("enlaza cada motivo de atención con la ficha de suscripción del salón", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({ rows: [makeRow({ salonId: "s-past", status: "past_due" })] })
    );

    mounted = await render();

    const link = mounted.container.querySelector<HTMLAnchorElement>('a[href="/admin/subscriptions?salon=s-past"]');
    expect(link?.textContent).toContain("Moroso");
  });

  it("lista las invitaciones pendientes con su enlace de regeneración y como máximo cinco", async () => {
    const invitations = Array.from({ length: 6 }, (_, index) => ({
      id: `inv-${index}`,
      email: `owner${index}@salon.test`,
      status: "pending",
      expires_at: "2026-12-01T00:00:00.000Z",
      created_at: "2026-10-01T00:00:00.000Z",
      plan_id: null,
    }));
    vi.mocked(getPlatformAdminHome).mockResolvedValue(home({ pendingInvitations: invitations }));

    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("owner0@salon.test");
    expect(text).toContain("owner4@salon.test");
    expect(text).not.toContain("owner5@salon.test");
    expect(text.match(/Pendiente/g)).toHaveLength(5);
    expect(getButtonByText(mounted.container, "Regenerar enlace")).toBeTruthy();
  });

  it("indica cuando no hay invitaciones pendientes", async () => {
    mounted = await render();

    expect(mounted.container.textContent).toContain("No hay invitaciones pendientes.");
  });

  it("muestra hasta ocho suscripciones con su plan, precio y estado", async () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      makeRow({ salonId: `s-${index}`, salonName: `Salón ${index}` })
    );
    vi.mocked(getSubscriptionsPage).mockResolvedValue(makeSubscriptionsData({ rows }));

    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Salón 7");
    expect(text).not.toContain("Salón 8");
    expect(text).toContain("Pro · USD 30.00/mes");
    expect(text).toContain("Activo");
  });

  it("muestra la etiqueta de estado de cada suscripción y 'Sin plan asignado' sin plan", async () => {
    vi.mocked(getSubscriptionsPage).mockResolvedValue(
      makeSubscriptionsData({
        rows: [
          makeRow({ salonId: "a", salonName: "A", status: "trialing", trialEndsAt: FAR_FUTURE_ISO }),
          makeRow({ salonId: "b", salonName: "B", status: "paused" }),
          makeRow({ salonId: "c", salonName: "C", status: "canceled" }),
          makeRow({ salonId: "d", salonName: "D", planName: null, planId: null, status: null }),
        ],
      })
    );

    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Trial");
    expect(text).toContain("Pausado");
    expect(text).toContain("Cancelado");
    expect(text).toContain("Sin plan");
    expect(text).toContain("Sin plan asignado");
  });

  it("ofrece accesos a invitar salones, planes, auditoría y reportes", async () => {
    mounted = await render();

    const hrefs = Array.from(mounted.container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/admin/invitations");
    expect(hrefs).toContain("/admin/plans");
    expect(hrefs).toContain("/admin/audit");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/admin/subscriptions");
    expect(mounted.container.textContent).toContain("Invitar salon");
  });

  it("separa las tarjetas de atención y de invitaciones con sus títulos", async () => {
    mounted = await render();

    expect(cardText(mounted.container, "Requieren atención")).toContain("Todo en orden");
    expect(cardText(mounted.container, "Invitaciones pendientes")).toContain("No hay invitaciones pendientes.");
  });
});
