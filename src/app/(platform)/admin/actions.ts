"use server";

import { inviteSalon } from "@/features/platform/use-cases/invite-salon";

// Server Action wrapper: React form actions must return void.
// Error handling is done via revalidation and redirect in the use-case.
export async function inviteSalonAction(formData: FormData): Promise<void> {
  await inviteSalon(formData);
}
