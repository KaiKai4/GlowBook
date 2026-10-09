"use server";

import { submitFeedback } from "@/features/feedback/use-cases/submit-feedback";
import { SubmitFeedbackSchema, type SubmitFeedbackInput } from "@/features/feedback/schemas";
import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import type { Result } from "@/infra/result";

// El feedback llega al panel de plataforma: limitar evita spam masivo.
const submitFeedbackFlow = defineAction<SubmitFeedbackInput, SubmitFeedbackInput, void>({
  rateLimit: { scope: "feedback", options: { max: 5, windowMs: 300_000 } },
  parse: parseWithSchema(SubmitFeedbackSchema),
  run: (input, session) => submitFeedback({ salonId: session.salonId, createdBy: session.userId }, input),
});

export async function submitFeedbackAction(input: SubmitFeedbackInput): Promise<Result<void>> {
  return submitFeedbackFlow(input);
}
