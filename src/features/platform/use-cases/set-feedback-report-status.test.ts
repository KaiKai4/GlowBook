import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFeedbackStatus } from "../data/feedback-moderation.repo";
import { setFeedbackReportStatus } from "./set-feedback-report-status";
import { publishAuditEvent } from "@/features/audit";

vi.mock("../data/feedback-moderation.repo", () => ({
  setFeedbackStatus: vi.fn(),
}));

vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const mockedSetFeedbackStatus = vi.mocked(setFeedbackStatus);
const mockedPublishAuditEvent = vi.mocked(publishAuditEvent);
const actorUserId = "00000000-0000-4000-8000-000000000001";

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
      error: "Reporte inválido.",
    });
    expect(mockedSetFeedbackStatus).not.toHaveBeenCalled();
  });

  it("updates the moderation status through the platform adapter", async () => {
    await expect(
      setFeedbackReportStatus({ id: "report-1", status: "resolved", actorUserId })
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(mockedSetFeedbackStatus).toHaveBeenCalledWith("report-1", "resolved");
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.feedback_status_changed", {
      actorUserId,
      action: "set_feedback_status",
      status: "succeeded",
      targetResourceType: "feedback_report",
      targetResourceId: "report-1",
      metadata: { feedbackStatus: "resolved" },
    });
  });

  it("returns a stable business error on adapter failure", async () => {
    mockedSetFeedbackStatus.mockRejectedValue(new Error("database down"));

    await expect(
      setFeedbackReportStatus({ id: "report-1", status: "new", actorUserId })
    ).resolves.toEqual({
      ok: false,
      error: "No se pudo actualizar el estado del reporte.",
    });
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.feedback_status_changed", {
      actorUserId,
      action: "set_feedback_status",
      status: "failed",
      targetResourceType: "feedback_report",
      targetResourceId: "report-1",
      metadata: { feedbackStatus: "new" },
      errorMessage: "database down",
    });
  });
});
