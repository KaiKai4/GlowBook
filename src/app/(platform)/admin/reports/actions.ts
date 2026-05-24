"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { setFeedbackStatus } from "@/features/platform/data/platform.repo";

// Form action: toggle a report between 'new' and 'resolved'. Returns void
// (React form actions must), authorization enforced by requirePlatformAdmin.
export async function setFeedbackStatusAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") === "resolved" ? "resolved" : "new";
  if (!id) return;
  await setFeedbackStatus(id, status);
  revalidatePath("/admin/reports");
}
