import { z } from "zod";

export const FEEDBACK_CATEGORIES = ["bug", "suggestion", "question", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Falla / Error",
  suggestion: "Sugerencia",
  question: "Pregunta / Ayuda",
  other: "Otro",
};

export const SubmitFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(5, "Cuéntanos un poco más (mínimo 5 caracteres).")
    .max(2000, "El mensaje es demasiado largo."),
});

export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackSchema>;
