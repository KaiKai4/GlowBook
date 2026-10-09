"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { parseUuid } from "@/infra/validation/route-id";
import { setFeedbackReportStatus } from "@/features/platform/use-cases/set-feedback-report-status";

// Form action: toggle a report between 'new' and 'resolved'. Returns void
// (React form actions must), authorization enforced by requirePlatformAdmin.
export async function setFeedbackStatusAction(formData: FormData): Promise<void> {
  const actorUserId = await requirePlatformAdmin();
  const limited = await assertActionRateLimit(actorUserId, "admin:setFeedbackStatusAction");
  if (!limited.ok) throw new Error(limited.error);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") === "resolved" ? "resolved" : "new";
  if (!parseUuid(id)) return;
  await setFeedbackReportStatus({ id, status, actorUserId });
  revalidatePath("/admin/reports");
}
