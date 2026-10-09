import "server-only";

import type { Result } from "@/infra/result";
import { createFeedbackReport } from "../data/feedback.repo";
import type { SubmitFeedbackInput } from "../schemas";

export interface SubmitFeedbackContext {
  salonId: string;
  createdBy: string;
}

export async function submitFeedback(
  context: SubmitFeedbackContext,
  input: SubmitFeedbackInput
): Promise<Result<void>> {
  try {
    await createFeedbackReport({
      salonId: context.salonId,
      createdBy: context.createdBy,
      category: input.category,
      message: input.message,
    });

    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "No se pudo enviar el reporte. Intenta de nuevo." };
  }
}
