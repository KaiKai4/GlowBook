"use server";

import { requireProfile } from "@/lib/auth/session";
import { createFeedbackReport } from "@/features/feedback/data/feedback.repo";
import { SubmitFeedbackSchema } from "@/features/feedback/schemas";
import type { Result } from "@/lib/result";

export async function submitFeedbackAction(
  category: string,
  message: string
): Promise<Result<void>> {
  const profile = await requireProfile();

  const parsed = SubmitFeedbackSchema.safeParse({ category, message });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await createFeedbackReport({
      salonId: profile.salon_id,
      createdBy: profile.id,
      category: parsed.data.category,
      message: parsed.data.message,
    });
    return { ok: true, value: undefined };
  } catch (err) {
    console.error("[feedback]", err);
    return { ok: false, error: "No se pudo enviar el reporte. Intenta de nuevo." };
  }
}
