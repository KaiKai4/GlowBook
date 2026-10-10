"use server";

import { definePublicAction } from "@/app/_composition/define-public-action";
import { signInWithPassword } from "@/infra/auth/password-auth";
import { SignInSchema, type SignInInput } from "@/infra/auth/password-schemas";
import { err, ok, type Result } from "@/infra/result";

const SIGN_IN_ERROR = "No pudimos iniciar sesión con esos datos.";

// Ventana de 15 minutos por IP: frena la fuerza bruta de contraseñas sin bloquear
// a un salón que entra desde la misma red.
const SIGN_IN_LIMIT = { max: 20, windowMs: 15 * 60_000 };

const signInFlow = definePublicAction<SignInInput, SignInInput, void>({
  rateLimit: { scope: "sign-in", options: SIGN_IN_LIMIT },
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
