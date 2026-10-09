import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFeedbackStatus } from "@/features/platform/data/feedback-moderation.repo";
import { captureError } from "@/lib/observability";
import { setFeedbackReportStatus } from "./set-feedback-report-status";
import { recordPlatformAction } from "./platform-audit";

// Moderacion de reportes: resolver o reabrir un reporte deja rastro de quien
// lo hizo; un id vacio no llega a la base y un fallo devuelve un mensaje
// estable sin detalle tecnico.

vi.mock("@/features/platform/data/feedback-moderation.repo", () => ({
  setFeedbackStatus: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("./platform-audit", () => ({
  recordPlatformAction: vi.fn(),
}));

const mockedSetStatus = vi.mocked(setFeedbackStatus);
const mockedAudit = vi.mocked(recordPlatformAction);
const mockedCaptureError = vi.mocked(captureError);

const REPORT_ID = "00000000-0000-4000-8000-0000000000cc";
const ACTOR_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  mockedSetStatus.mockResolvedValue(undefined);
  mockedAudit.mockResolvedValue(undefined);
});

describe("setFeedbackReportStatus", () => {
  it("rejects blank report ids without touching the adapter", async () => {
    const result = await setFeedbackReportStatus({ id: "  ", status: "resolved", actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: false, error: "Reporte inválido." });
    expect(mockedSetStatus).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("resolves a report and audits it against the report id", async () => {
    const result = await setFeedbackReportStatus({ id: REPORT_ID, status: "resolved", actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedSetStatus).toHaveBeenCalledWith(REPORT_ID, "resolved");
    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "set_feedback_status",
      status: "succeeded",
      targetResourceType: "feedback_report",
      targetResourceId: REPORT_ID,
      metadata: { feedbackStatus: "resolved" },
    });
  });

  it("reopens a resolved report as new and audits the reopening with a null actor when none is given", async () => {
    await setFeedbackReportStatus({ id: REPORT_ID, status: "new" });

    expect(mockedSetStatus).toHaveBeenCalledWith(REPORT_ID, "new");
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: null, metadata: { feedbackStatus: "new" } })
    );
  });

  it("returns a stable error on adapter failure, logs it and audits the failed attempt", async () => {
    const adapterError = new Error("denied");
    mockedSetStatus.mockRejectedValue(adapterError);

    const result = await setFeedbackReportStatus({ id: REPORT_ID, status: "resolved", actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: false, error: "No se pudo actualizar el estado del reporte." });
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "set_feedback_status",
      metadata: { reportId: REPORT_ID, feedbackStatus: "resolved" },
    });
    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "set_feedback_status",
      status: "failed",
      targetResourceType: "feedback_report",
      targetResourceId: REPORT_ID,
      metadata: { feedbackStatus: "resolved" },
      errorMessage: "denied",
    });
  });

  it("audits a generic error text when the adapter rejects with a non-Error value", async () => {
    mockedSetStatus.mockRejectedValue("boom");

    await setFeedbackReportStatus({ id: REPORT_ID, status: "new" });

    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "Error desconocido" })
    );
  });
});
