"use server";

import { definePlatformAction } from "@/app/_composition/define-platform-action";
import { ok } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";
import {
  readFeedbackStatusForm,
  type FeedbackStatusForm,
} from "@/features/platform";
import { setFeedbackReportStatus } from "@/features/platform";

// Form action: toggle a report between 'new' and 'resolved'. Returns void
// (React form actions must), authorization enforced by requirePlatformAdmin.
// Un id invalido no es un error: no se toca el reporte ni se revalida nada.
const setFeedbackStatusFlow = definePlatformAction<FormData, FeedbackStatusForm | null, void>({
  rateLimit: { scope: "admin:setFeedbackStatusAction" },
  parse: (formData) => {
    const form = readFeedbackStatusForm(formData);
    return ok(parseUuid(form.id) ? form : null);
  },
  run: async (form, session) => {
    if (!form) return ok(undefined);
    const result = await setFeedbackReportStatus({ ...form, actorUserId: session.userId });
    return result.ok ? ok(undefined) : result;
  },
  revalidate: (_output, form) => (form ? ["/admin/reports"] : []),
});

export async function setFeedbackStatusAction(formData: FormData): Promise<void> {
  const result = await setFeedbackStatusFlow(formData);
  if (!result.ok) throw new Error(result.error);
}
