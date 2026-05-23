"use server";

import { acceptInvitation } from "@/features/platform/use-cases/accept-invitation";
import type { Result } from "@/lib/result";

export async function acceptInvitationAction(input: {
  token: string;
  email: string;
  password: string;
  salon_name: string;
  full_name: string;
}): Promise<Result<void>> {
  return acceptInvitation(input);
}
