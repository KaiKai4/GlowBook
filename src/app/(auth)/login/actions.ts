"use server";

import { definePublicAction } from "@/app/_composition/define-public-action";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { SignInSchema, type SignInInput } from "@/infra/auth/password-schemas";
import { err, ok, type Result } from "@/infra/result";
import { SIGN_IN_ACCOUNT_POLICY, SIGN_IN_IP_POLICY } from "@/infra/security/rate-limit-policies";

const SIGN_IN_ERROR = "No pudimos iniciar sesión con esos datos.";

// Dos limites de 15 minutos: por cuenta e IP (10) frena la fuerza bruta contra
// un correo; el global por IP (100) deja margen a una oficina con NAT compartida.
const normalizedEmail = (input: SignInInput): string => input.email.trim().toLowerCase();

const signInFlow = definePublicAction<SignInInput, SignInInput, void>({
  rateLimit: {
    scope: "sign-in",
    options: SIGN_IN_IP_POLICY,
    subject: { options: SIGN_IN_ACCOUNT_POLICY, keyFrom: normalizedEmail },
  },
  parse: (raw) => {
    const parsed = SignInSchema.safeParse(raw);
    return parsed.success ? ok(parsed.data) : err(SIGN_IN_ERROR);
  },
  run: async (input) => {
    const { error } = await signInWithPassword(input);
    return error ? err(SIGN_IN_ERROR) : ok(undefined);
  },
});

// El cliente navega a "/" tras un ok (router.push + refresh), como antes.
export async function signInAction(input: SignInInput): Promise<Result<void>> {
  return signInFlow(input);
}
