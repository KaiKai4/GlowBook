import { setFeedbackStatus } from "@/features/platform/data/feedback-moderation.repo";
import { captureError } from "@/lib/observability";
import { ok, type Result } from "@/lib/result";
import { recordPlatformAction } from "./platform-audit";

export interface SetFeedbackReportStatusInput {
  id: string;
  status: "new" | "resolved";
  actorUserId?: string | null;
}

export async function setFeedbackReportStatus({
  id,
  status,
  actorUserId,
}: SetFeedbackReportStatusInput): Promise<Result<void>> {
  if (!id.trim()) return { ok: false, error: "Reporte inválido." };

  try {
    await setFeedbackStatus(id, status);
    const warnings = await recordPlatformAction({
      actorUserId: actorUserId ?? null,
      action: "set_feedback_status",
      status: "succeeded",
      targetResourceType: "feedback_report",
      targetResourceId: id,
      metadata: { feedbackStatus: status },
    });
    return ok(undefined, warnings);
  } catch (error) {
    captureError(error, {
      module: "platform",
      action: "set_feedback_status",
      metadata: { reportId: id, feedbackStatus: status },
    });
    await recordPlatformAction({
      actorUserId: actorUserId ?? null,
      action: "set_feedback_status",
      status: "failed",
      targetResourceType: "feedback_report",
      targetResourceId: id,
      metadata: { feedbackStatus: status },
      errorMessage: error instanceof Error ? error.message : "Error desconocido",
    });
    return { ok: false, error: "No se pudo actualizar el estado del reporte." };
  }
}
