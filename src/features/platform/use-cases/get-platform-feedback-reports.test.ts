import { beforeEach, describe, expect, it, vi } from "vitest";
import { findFeedbackReports } from "../data/feedback-moderation.repo";
import { getPlatformFeedbackReports } from "./get-platform-feedback-reports";

vi.mock("../data/feedback-moderation.repo", () => ({
  findFeedbackReports: vi.fn(),
}));

const mockedFindFeedbackReports = vi.mocked(findFeedbackReports);

describe("get platform feedback reports", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindFeedbackReports.mockResolvedValue([]);
  });

  it("maps feedback reports and hides resolved items by default", async () => {
    mockedFindFeedbackReports.mockResolvedValue([
      {
        id: "report-1",
        category: "bug",
        message: "No abre la agenda",
        status: "new",
        created_at: "2026-05-29T15:30:00.000Z",
        salon: { name: "Glow Studio" },
        reporter: { full_name: "Ana Owner" },
      },
      {
        id: "report-2",
        category: "other",
        message: "Ya esta atendido",
        status: "resolved",
        created_at: "2026-05-28T15:30:00.000Z",
        salon: null,
        reporter: null,
      },
    ]);

    const view = await getPlatformFeedbackReports();

    expect(view.showResolved).toBe(false);
    expect(view.newCount).toBe(1);
    expect(view.visibleReports.map((report) => report.id)).toEqual(["report-1"]);
    expect(view.reports[0]).toMatchObject({
      id: "report-1",
      categoryLabel: "Falla / Error",
      categoryVariant: "danger",
      resolved: false,
      toggleStatus: "resolved",
      salonName: "Glow Studio",
      reporterName: "Ana Owner",
    });
    expect(view.reports[1]).toMatchObject({
      salonName: "Salón eliminado",
      reporterName: "—",
      resolved: true,
      toggleStatus: "new",
    });
  });

  it("shows all reports when requested", async () => {
    mockedFindFeedbackReports.mockResolvedValue([
      {
        id: "report-1",
        category: "question",
        message: "Pregunta",
        status: "new",
        created_at: "2026-05-29T15:30:00.000Z",
        salon: null,
        reporter: null,
      },
      {
        id: "report-2",
        category: "suggestion",
        message: "Sugerencia",
        status: "resolved",
        created_at: "2026-05-28T15:30:00.000Z",
        salon: null,
        reporter: null,
      },
    ]);

    const view = await getPlatformFeedbackReports({ status: "all" });

    expect(view.showResolved).toBe(true);
    expect(view.visibleReports.map((report) => report.id)).toEqual([
      "report-1",
      "report-2",
    ]);
  });
});
