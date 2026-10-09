import { beforeEach, describe, expect, it, vi } from "vitest";
import { findFeedbackReports } from "@/features/platform/data/feedback-moderation.repo";
import { getPlatformFeedbackReports } from "./get-platform-feedback-reports";
import { firstOf } from "@/test/platform-feedback-notifications-helpers";

// Bandeja de feedback de la plataforma: por defecto solo se ven los reportes
// nuevos; los resueltos aparecen con status "all". Categorias desconocidas y
// autores o salones borrados no rompen la vista.

vi.mock("@/features/platform/data/feedback-moderation.repo", () => ({
  findFeedbackReports: vi.fn(),
}));

const mockedFind = vi.mocked(findFeedbackReports);

type ReportRow = Awaited<ReturnType<typeof findFeedbackReports>>[number];

function report(overrides: Partial<ReportRow>): ReportRow {
  return {
    id: "r-1",
    category: "bug",
    message: "Mensaje",
    status: "new",
    created_at: "2026-06-01T10:00:00.000Z",
    salon: { name: "Glow" },
    reporter: { full_name: "Ana" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedFind.mockResolvedValue([]);
});

describe("getPlatformFeedbackReports visibility", () => {
  it("shows only new reports by default and counts them", async () => {
    mockedFind.mockResolvedValue([
      report({ id: "nuevo", status: "new" }),
      report({ id: "listo", status: "resolved" }),
    ]);

    const view = await getPlatformFeedbackReports();

    expect(view.visibleReports.map((item) => item.id)).toEqual(["nuevo"]);
    expect(view.newCount).toBe(1);
    expect(view.showResolved).toBe(false);
    expect(view.reports).toHaveLength(2);
  });

  it("shows resolved reports too when status is all", async () => {
    mockedFind.mockResolvedValue([
      report({ id: "nuevo", status: "new" }),
      report({ id: "listo", status: "resolved" }),
    ]);

    const view = await getPlatformFeedbackReports({ status: "all" });

    expect(view.visibleReports.map((item) => item.id)).toEqual(["nuevo", "listo"]);
    expect(view.showResolved).toBe(true);
  });

  it("keeps resolved reports hidden for any other status filter", async () => {
    mockedFind.mockResolvedValue([report({ status: "resolved" })]);

    const view = await getPlatformFeedbackReports({ status: "resolved" });

    expect(view.visibleReports).toEqual([]);
    expect(view.showResolved).toBe(false);
  });

  it("reports no new items when the inbox is empty", async () => {
    const view = await getPlatformFeedbackReports();

    expect(view).toEqual({ reports: [], visibleReports: [], newCount: 0, showResolved: false });
  });
});

describe("getPlatformFeedbackReports report view", () => {
  it("labels each known category with its Spanish name and tone", async () => {
    mockedFind.mockResolvedValue([
      report({ id: "1", category: "bug" }),
      report({ id: "2", category: "suggestion" }),
      report({ id: "3", category: "question" }),
      report({ id: "4", category: "other" }),
    ]);

    const view = await getPlatformFeedbackReports({ status: "all" });

    expect(view.reports.map((item) => [item.categoryLabel, item.categoryVariant])).toEqual([
      ["Falla / Error", "danger"],
      ["Sugerencia", "info"],
      ["Pregunta / Ayuda", "warning"],
      ["Otro", "default"],
    ]);
  });

  it("keeps unknown categories visible with their raw name and a neutral tone", async () => {
    mockedFind.mockResolvedValue([report({ category: "pricing" })]);

    const item = firstOf((await getPlatformFeedbackReports()).visibleReports);

    expect(item.category).toBe("pricing");
    expect(item.categoryLabel).toBe("pricing");
    expect(item.categoryVariant).toBe("default");
  });

  it("CONDUCTA ACTUAL (posible bug): inherited Object keys leak into the category label and tone", async () => {
    // Las busquedas `MAP[category] ?? fallback` usan objetos literales, asi que una clave heredada
    // como "constructor" devuelve una funcion de Object en vez del fallback
    // (src/features/platform/use-cases/get-platform-feedback-reports.ts:9, 38 y 60).
    // La columna category tiene valores cerrados en la base, por eso el riesgo es latente.
    mockedFind.mockResolvedValue([report({ category: "constructor" })]);

    const item = firstOf((await getPlatformFeedbackReports()).visibleReports);

    expect(item.categoryLabel).not.toBe("constructor");
    expect(typeof item.categoryLabel).toBe("function");
    expect(typeof item.categoryVariant).toBe("function");
  });

  it("offers the opposite toggle: resolving a new report and reopening a resolved one", async () => {
    mockedFind.mockResolvedValue([
      report({ id: "nuevo", status: "new" }),
      report({ id: "listo", status: "resolved" }),
    ]);

    const view = await getPlatformFeedbackReports({ status: "all" });
    const byId = new Map(view.reports.map((item) => [item.id, item]));

    expect(byId.get("nuevo")).toMatchObject({ resolved: false, toggleStatus: "resolved" });
    expect(byId.get("listo")).toMatchObject({ resolved: true, toggleStatus: "new" });
  });

  it("names the salon and reporter, falling back when either was removed", async () => {
    mockedFind.mockResolvedValue([
      report({ id: "completo", salon: { name: "Glow" }, reporter: { full_name: "Ana" } }),
      report({ id: "sin-salon", salon: null, reporter: { full_name: "Luis" } }),
      report({ id: "sin-autor", salon: { name: "Studio" }, reporter: null }),
    ]);

    const view = await getPlatformFeedbackReports();
    const byId = new Map(view.reports.map((item) => [item.id, item]));

    expect(byId.get("completo")).toMatchObject({ salonName: "Glow", reporterName: "Ana" });
    expect(byId.get("sin-salon")).toMatchObject({ salonName: "Salón eliminado", reporterName: "Luis" });
    expect(byId.get("sin-autor")).toMatchObject({ salonName: "Studio", reporterName: "—" });
  });

  it("keeps the message and formats the creation time with the year", async () => {
    mockedFind.mockResolvedValue([report({ message: "La agenda no carga en el celular" })]);

    const item = firstOf((await getPlatformFeedbackReports()).visibleReports);

    expect(item.message).toBe("La agenda no carga en el celular");
    expect(item.createdAtLabel).toMatch(/2026/);
  });
});
