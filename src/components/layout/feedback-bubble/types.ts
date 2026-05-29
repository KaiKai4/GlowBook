import type { SubmitFeedbackInput } from "@/features/feedback/schemas";
import type { Result } from "@/lib/result";

export type SubmitFeedbackAction = (
  input: SubmitFeedbackInput
) => Promise<Result<void>>;
