"use server";

import { acceptInvitation } from "@/features/platform/use-cases/accept-invitation";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";
import type { Result } from "@/infra/result";

export async function acceptInvitationAction(input: {
  token: string;
  email: string;
  password: string;
  salon_name: string;
  full_name: string;
}): Promise<Result<void>> {
  // Endpoint sin sesion: limitar por IP frena la fuerza bruta de tokens.
  const limited = await assertAnonymousRateLimit("accept-invitation");
  if (!limited.ok) return limited;

  return acceptInvitation(input);
}
