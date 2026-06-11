"use server";

import { submitFeedback } from "@/features/feedback/use-cases/submit-feedback";
import { SubmitFeedbackSchema, type SubmitFeedbackInput } from "@/features/feedback/schemas";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import type { Result } from "@/lib/result";

export async function submitFeedbackAction(
  input: SubmitFeedbackInput
): Promise<Result<void>> {
  const profile = await requireActiveProfile();

  // El feedback llega al panel de plataforma: limitar evita spam masivo.
  const limited = assertActionRateLimit(profile.id, "feedback", { max: 5, windowMs: 300_000 });
  if (!limited.ok) return limited;

  const parsed = SubmitFeedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  return submitFeedback(
    { salonId: profile.salon_id, createdBy: profile.id },
    parsed.data
  );
}
