import type { SubmitFeedbackInput } from "@/features/feedback/schemas";
import type { Result } from "@/infra/result";

export type SubmitFeedbackAction = (
  input: SubmitFeedbackInput
) => Promise<Result<void>>;
