"use server";

import { definePublicAction } from "@/app/_composition/define-public-action";
import { acceptInvitation } from "@/features/platform/use-cases/accept-invitation";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { ok, type Result } from "@/infra/result";

type InvitationInput = {
  token: string;
  email: string;
  password: string;
  salon_name: string;
  full_name: string;
};

// Endpoint sin sesion: el limite por IP frena la fuerza bruta de tokens.
const acceptFlow = definePublicAction<InvitationInput, InvitationInput, { signedIn: boolean }>({
  rateLimit: { scope: "accept-invitation" },
  parse: (raw) => ok(raw),
  run: async (input) => {
    const accepted = await acceptInvitation(input);
    if (!accepted.ok) return accepted;

    // Entrada automatica al panel; si falla, el cliente lleva a /login.
    const { error } = await signInWithPassword({ email: input.email, password: input.password });
    return ok({ signedIn: error === null });
  },
});

export async function acceptInvitationAction(input: InvitationInput): Promise<Result<{ signedIn: boolean }>> {
  return acceptFlow(input);
}
