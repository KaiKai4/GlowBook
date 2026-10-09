"use server";

import { signInWithPassword } from "@/infra/auth/password-auth";
import { SignInSchema, type SignInInput } from "@/infra/auth/password-schemas";
import { err, ok, type Result } from "@/infra/result";

const SIGN_IN_ERROR = "No pudimos iniciar sesión con esos datos.";

// El cliente navega a "/" tras un ok (router.push + refresh), como antes.
export async function signInAction(input: SignInInput): Promise<Result<void>> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) return err(SIGN_IN_ERROR);

  const { error } = await signInWithPassword(parsed.data);
  if (error) return err(SIGN_IN_ERROR);

  return ok(undefined);
}
