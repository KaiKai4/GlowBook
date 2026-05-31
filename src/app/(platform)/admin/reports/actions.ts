"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { setFeedbackReportStatus } from "@/features/platform/use-cases/set-feedback-report-status";

// Form action: toggle a report between 'new' and 'resolved'. Returns void
// (React form actions must), authorization enforced by requirePlatformAdmin.
export async function setFeedbackStatusAction(formData: FormData): Promise<void> {
  const actorUserId = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") === "resolved" ? "resolved" : "new";
  if (!id) return;
  await setFeedbackReportStatus({ id, status, actorUserId });
  revalidatePath("/admin/reports");
}
