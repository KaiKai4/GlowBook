"use server";

import { definePublicAction } from "@/app/_composition/define-public-action";
import { acceptEmployeeInvitation } from "@/features/employees";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { ok, type Result } from "@/infra/result";

type JoinInput = { token: string; password: string; email: string };

// Endpoint sin sesion: el limite por IP frena la fuerza bruta de tokens.
const joinFlow = definePublicAction<JoinInput, JoinInput, { signedIn: boolean }>({
  rateLimit: { scope: "join-invitation" },
  parse: (raw) => ok(raw),
  run: async ({ token, password, email }) => {
    const accepted = await acceptEmployeeInvitation({ token, password });
    if (!accepted.ok) return accepted;

    // Entrada automatica al panel; si falla, el formulario lleva a /login?joined=1.
    const { error } = await signInWithPassword({ email, password });
    return ok({ signedIn: error === null });
  },
});

export async function acceptEmployeeInvitationAction(
  token: string,
  password: string,
  email: string
): Promise<Result<{ signedIn: boolean }>> {
  return joinFlow({ token, password, email });
}
