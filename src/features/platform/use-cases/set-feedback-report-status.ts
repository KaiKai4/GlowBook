import { setFeedbackStatus } from "@/features/platform/data/feedback-moderation.repo";
import type { Result } from "@/lib/result";

export async function setFeedbackReportStatus({
  id,
  status,
}: {
  id: string;
  status: "new" | "resolved";
}): Promise<Result<void>> {
  if (!id.trim()) return { ok: false, error: "Reporte invalido." };

  try {
    await setFeedbackStatus(id, status);
    return { ok: true, value: undefined };
  } catch (error) {
    console.error("[platform:feedback]", error);
    return { ok: false, error: "No se pudo actualizar el estado del reporte." };
  }
}
