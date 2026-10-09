// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  getPlatformAuditLog,
  type PlatformAuditLogEntryViewModel,
  type PlatformAuditLogViewModel,
} from "@/features/platform/use-cases/get-platform-audit-log";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import PlatformAuditPage from "./page";

vi.mock("@/lib/auth/session", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/platform/use-cases/get-platform-audit-log", () => ({
  getPlatformAuditLog: vi.fn(),
}));

const ALL_ACTIONS = [
  { value: "all" as const, label: "Todas las acciones" },
  { value: "invite_salon" as const, label: "Invitar Salon" },
];
const ALL_STATUSES = [
  { value: "all" as const, label: "Todos" },
  { value: "succeeded" as const, label: "Exitosas" },
  { value: "failed" as const, label: "Fallidas" },
];

function entry(overrides: Partial<PlatformAuditLogEntryViewModel> = {}): PlatformAuditLogEntryViewModel {
  return {
    id: "log-1",
    action: "invite_salon",
    actionLabel: "Invitar Salon",
    status: "succeeded",
    statusLabel: "Exitosa",
    actorLabel: "admin@glowbook.test",
    targetLabel: "salon-1",
    metadata: [{ key: "plan", value: "Pro" }],
    errorMessage: null,
    createdAtLabel: "2 oct 2026, 10:00",
    ...overrides,
  };
}

function view(overrides: Partial<PlatformAuditLogViewModel> = {}): PlatformAuditLogViewModel {
  return {
    entries: [entry()],
    action: "all",
    status: "all",
    totalVisible: 1,
    failedCount: 0,
    actions: ALL_ACTIONS,
    statuses: ALL_STATUSES,
    ...overrides,
  };
}

async function render(searchParams: { action?: string; status?: string } = {}): Promise<MountedComponent> {
  return mountComponent(await PlatformAuditPage({ searchParams: Promise.resolve(searchParams) }));
}

function linkWithText(container: HTMLElement, text: string): HTMLAnchorElement {
  const link = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find(
    (anchor) => anchor.textContent === text
  );
  if (!link) throw new Error(`Enlace no encontrado: ${text}`);
  return link;
}

describe("PlatformAuditPage", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("exige rol de plataforma y consulta el log con los filtros de la URL", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view());

    mounted = await render({ action: "invite_salon", status: "failed" });

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getPlatformAuditLog).toHaveBeenCalledWith({ action: "invite_salon", status: "failed" });
  });

  it("muestra el total de eventos en singular cuando hay uno", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view({ totalVisible: 1 }));

    mounted = await render();

    expect(mounted.container.querySelector("h1")?.textContent).toContain("Auditoria de Plataforma");
    expect(mounted.container.textContent).toContain("1 evento");
    expect(mounted.container.textContent).not.toContain("1 eventos");
  });

  it("indica los fallos en plural y los eventos en plural cuando hay varios", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(
      view({ totalVisible: 3, failedCount: 2, entries: [entry(), entry({ id: "log-2" }), entry({ id: "log-3" })] })
    );

    mounted = await render();

    expect(mounted.container.textContent).toContain("2 fallidas");
    expect(mounted.container.textContent).toContain("3 eventos");
  });

  it("indica un solo fallo en singular", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view({ failedCount: 1 }));

    mounted = await render();

    expect(mounted.container.textContent).toContain("1 fallida");
    expect(mounted.container.textContent).not.toContain("1 fallidas");
  });

  it("no muestra el contador de fallos cuando no hay ninguno", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view({ failedCount: 0 }));

    mounted = await render();

    expect(mounted.container.textContent).not.toContain("fallida");
  });

  it("construye los enlaces de filtro conservando el filtro de acción activo", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view({ action: "invite_salon", status: "all" }));

    mounted = await render({ action: "invite_salon" });

    expect(linkWithText(mounted.container, "Fallidas").getAttribute("href")).toBe(
      "/admin/audit?action=invite_salon&status=failed"
    );
    expect(linkWithText(mounted.container, "Todos").getAttribute("href")).toBe("/admin/audit?action=invite_salon");
    expect(linkWithText(mounted.container, "Todas las acciones").getAttribute("href")).toBe("/admin/audit");
    expect(linkWithText(mounted.container, "Invitar Salon").className).toContain("border-accent");
  });

  it("marca el filtro de estado activo y vuelve a /admin/audit al quitar filtros", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view({ action: "all", status: "failed" }));

    mounted = await render({ status: "failed" });

    expect(linkWithText(mounted.container, "Fallidas").className).toContain("bg-fg");
    expect(linkWithText(mounted.container, "Todos").getAttribute("href")).toBe("/admin/audit");
  });

  it("muestra un aviso cuando no hay eventos para los filtros", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view({ entries: [], totalVisible: 0 }));

    mounted = await render({ status: "failed" });

    expect(mounted.container.textContent).toContain("No hay eventos de auditoria para estos filtros.");
    expect(mounted.container.querySelector(".divide-y")).toBeNull();
  });

  it("muestra la acción, el estado, el actor, el objetivo y la metadata de cada evento", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view());

    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Invitar Salon");
    expect(text).toContain("Exitosa");
    expect(text).toContain("admin@glowbook.test");
    expect(text).toContain("salon-1");
    expect(text).toContain("2 oct 2026, 10:00");
    expect(text).toContain("plan:");
    expect(text).toContain("Pro");
    expect(text).not.toContain("Sin metadata.");
  });

  it("muestra el mensaje de error de un evento fallido y 'Sin metadata' cuando no hay datos", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(
      view({
        entries: [
          entry({ status: "failed", statusLabel: "Fallida", errorMessage: "No se pudo completar la acción.", metadata: [] }),
        ],
        failedCount: 1,
      })
    );

    mounted = await render();

    expect(mounted.container.textContent).toContain("No se pudo completar la acción.");
    expect(mounted.container.textContent).toContain("Sin metadata.");
    expect(mounted.container.textContent).toContain("Fallida");
  });

  it("no muestra línea de error en eventos exitosos", async () => {
    vi.mocked(getPlatformAuditLog).mockResolvedValue(view());

    mounted = await render();

    expect(mounted.container.querySelector(".text-danger")).toBeNull();
  });
});
