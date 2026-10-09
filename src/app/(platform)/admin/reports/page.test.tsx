// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import {
  getPlatformFeedbackReports,
  type PlatformFeedbackReportsViewModel,
} from "@/features/platform/use-cases/get-platform-feedback-reports";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import AdminReportsPage from "./page";

vi.mock("@/app/_composition/request-context", () => ({ requirePlatformAdmin: vi.fn(async () => "admin-1") }));
vi.mock("@/features/platform/use-cases/get-platform-feedback-reports", () => ({
  getPlatformFeedbackReports: vi.fn(),
}));
vi.mock("./actions", () => ({ setFeedbackStatusAction: vi.fn() }));

const NEW_REPORT = {
  id: "rep-1",
  category: "bug",
  categoryLabel: "Error",
  categoryVariant: "danger" as const,
  message: "La agenda no carga en iPad",
  status: "new",
  resolved: false,
  toggleStatus: "resolved" as const,
  salonName: "Salón Luna",
  reporterName: "Ana Pérez",
  createdAtLabel: "3 oct 2026",
};

const RESOLVED_REPORT = {
  ...NEW_REPORT,
  id: "rep-2",
  category: "suggestion",
  categoryLabel: "Sugerencia",
  categoryVariant: "info" as const,
  message: "Agregar exportar a PDF",
  status: "resolved",
  resolved: true,
  toggleStatus: "new" as const,
  salonName: "Barbería Norte",
  reporterName: "Luis Soto",
};

function view(overrides: Partial<PlatformFeedbackReportsViewModel> = {}): PlatformFeedbackReportsViewModel {
  return {
    reports: [NEW_REPORT],
    visibleReports: [NEW_REPORT],
    newCount: 1,
    showResolved: false,
    ...overrides,
  };
}

async function render(searchParams: { status?: string } = {}): Promise<MountedComponent> {
  return mountComponent(await AdminReportsPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("AdminReportsPage", () => {
  let mounted: MountedComponent | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("exige rol de plataforma y filtra por el estado de la URL", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(view());

    mounted = await render({ status: "all" });

    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getPlatformFeedbackReports).toHaveBeenCalledWith({ status: "all" });
  });

  it("indica cuántos reportes siguen sin revisar", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(view({ newCount: 4 }));

    mounted = await render();

    expect(mounted.container.textContent).toContain("Reportes");
    expect(mounted.container.textContent).toContain("4 sin revisar");
  });

  it("no muestra el contador de pendientes cuando no hay reportes nuevos", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(view({ newCount: 0, visibleReports: [], reports: [] }));

    mounted = await render();

    expect(mounted.container.querySelector("span.text-accent")).toBeNull();
  });

  it("alterna entre ver los pendientes y todos los reportes con enlaces de filtro", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(view());

    mounted = await render();

    const links = Array.from(mounted.container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.find((link) => link.textContent === "Sin revisar")?.getAttribute("href")).toBe("/admin/reports");
    expect(links.find((link) => link.textContent === "Todas")?.getAttribute("href")).toBe("/admin/reports?status=all");
  });

  it("resalta la pestaña 'Todas' cuando se muestran los resueltos", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(
      view({ showResolved: true, visibleReports: [NEW_REPORT, RESOLVED_REPORT], reports: [NEW_REPORT, RESOLVED_REPORT] })
    );

    mounted = await render({ status: "all" });

    const links = Array.from(mounted.container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.find((link) => link.textContent === "Todas")?.className).toContain("bg-surface");
    expect(links.find((link) => link.textContent === "Sin revisar")?.className).toContain("text-fg-subtle");
  });

  it("muestra el mensaje de bandeja vacía según el filtro activo", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(view({ visibleReports: [], reports: [], newCount: 0 }));
    mounted = await render();
    expect(mounted.container.textContent).toContain("No hay reportes sin revisar.");
    mounted.unmount();

    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(
      view({ visibleReports: [], reports: [], newCount: 0, showResolved: true })
    );
    mounted = await render({ status: "all" });
    expect(mounted.container.textContent).toContain("No hay reportes todavía.");
  });

  it("muestra categoría, salón, autor, fecha y mensaje de cada reporte", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(view());

    mounted = await render();

    const text = mounted.container.textContent ?? "";
    expect(text).toContain("Error");
    expect(text).toContain("Salón Luna");
    expect(text).toContain("Ana Pérez");
    expect(text).toContain("3 oct 2026");
    expect(text).toContain("La agenda no carga en iPad");
  });

  it("ofrece marcar como resuelto los reportes abiertos, enviando el nuevo estado", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(view());

    mounted = await render();

    const form = mounted.container.querySelector("form")!;
    expect(form.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe("rep-1");
    expect(form.querySelector<HTMLInputElement>('input[name="status"]')?.value).toBe("resolved");
    expect(form.textContent).toContain("Marcar resuelto");
  });

  it("ofrece reabrir los reportes resueltos y los muestra con menor énfasis", async () => {
    vi.mocked(getPlatformFeedbackReports).mockResolvedValue(
      view({ showResolved: true, visibleReports: [RESOLVED_REPORT], reports: [RESOLVED_REPORT], newCount: 0 })
    );

    mounted = await render({ status: "all" });

    const form = mounted.container.querySelector("form")!;
    expect(form.querySelector<HTMLInputElement>('input[name="status"]')?.value).toBe("new");
    expect(form.textContent).toContain("Reabrir");
    expect(mounted.container.querySelector(".opacity-75")).not.toBeNull();
  });
});
