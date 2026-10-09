"use server";

import { acceptInvitation } from "@/features/platform/use-cases/accept-invitation";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { ok, type Result } from "@/infra/result";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";

export async function acceptInvitationAction(input: {
  token: string;
  email: string;
  password: string;
  salon_name: string;
  full_name: string;
}): Promise<Result<{ signedIn: boolean }>> {
  // Endpoint sin sesion: limitar por IP frena la fuerza bruta de tokens.
  const limited = await assertAnonymousRateLimit("accept-invitation");
  if (!limited.ok) return limited;

  const accepted = await acceptInvitation(input);
  if (!accepted.ok) return accepted;

  // Entrada automatica al panel; si falla, el cliente lleva a /login.
  const { error } = await signInWithPassword({ email: input.email, password: input.password });
  return ok({ signedIn: error === null });
}
