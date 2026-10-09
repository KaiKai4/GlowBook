"use server";

import { acceptEmployeeInvitation } from "@/features/employees/use-cases/employee-invitations";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { ok, type Result } from "@/infra/result";
import { assertAnonymousRateLimit } from "@/infra/security/rate-limit";

export async function acceptEmployeeInvitationAction(
  token: string,
  password: string,
  email: string
): Promise<Result<{ signedIn: boolean }>> {
  // Endpoint sin sesion: limitar por IP frena la fuerza bruta de tokens.
  const limited = await assertAnonymousRateLimit("join-invitation");
  if (!limited.ok) return limited;

  const accepted = await acceptEmployeeInvitation({ token, password });
  if (!accepted.ok) return accepted;

  // Entrada automatica al panel; si falla, el formulario lleva a /login?joined=1.
  const { error } = await signInWithPassword({ email, password });
  return ok({ signedIn: error === null });
}
