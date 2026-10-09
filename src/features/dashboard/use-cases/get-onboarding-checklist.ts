import "server-only";

import { findOnboardingCounts } from "../data/onboarding.repo";
import {
  buildOnboardingChecklist,
  type OnboardingChecklist,
} from "../domain/onboarding-checklist";

export type { OnboardingChecklist } from "../domain/onboarding-checklist";

export async function getOnboardingChecklist(salonId: string): Promise<OnboardingChecklist> {
  const counts = await findOnboardingCounts(salonId);
  return buildOnboardingChecklist(counts);
}
