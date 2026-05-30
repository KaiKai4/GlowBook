import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFeedbackStatus } from "../data/feedback-moderation.repo";
import { setFeedbackReportStatus } from "./set-feedback-report-status";

vi.mock("../data/feedback-moderation.repo", () => ({
  setFeedbackStatus: vi.fn(),
}));

const mockedSetFeedbackStatus = vi.mocked(setFeedbackStatus);

describe("set feedback report status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSetFeedbackStatus.mockResolvedValue(undefined);
  });

  it("rejects blank ids without touching the moderation adapter", async () => {
    await expect(
      setFeedbackReportStatus({ id: "   ", status: "resolved" })
    ).resolves.toEqual({
      ok: false,
      error: "Reporte invalido.",
    });
    expect(mockedSetFeedbackStatus).not.toHaveBeenCalled();
  });

  it("updates the moderation status through the platform adapter", async () => {
    await expect(
      setFeedbackReportStatus({ id: "report-1", status: "resolved" })
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(mockedSetFeedbackStatus).toHaveBeenCalledWith("report-1", "resolved");
  });

  it("returns a stable business error on adapter failure", async () => {
    mockedSetFeedbackStatus.mockRejectedValue(new Error("database down"));

    await expect(
      setFeedbackReportStatus({ id: "report-1", status: "new" })
    ).resolves.toEqual({
      ok: false,
      error: "No se pudo actualizar el estado del reporte.",
    });
  });
});
