import { test } from "@playwright/test";

/** true cuando los E2E corren contra Supabase local (GLOWBOOK_TEST_TARGET=local). */
export const isLocalTarget = process.env.GLOWBOOK_TEST_TARGET === "local";

/**
 * Sustituye al test.skip condicional. Fuera de local, una precondición ausente
 * se salta (comportamiento de staging). En local es un fallo explícito: ningún
 * test se salta en silencio contra el stack local.
 */
export function skipUnlessReady(missing: boolean, reason: string): void {
  if (!missing) return;
  if (isLocalTarget) {
    throw new Error(`Precondición E2E ausente en modo local: ${reason}`);
  }
  test.skip(true, reason);
}
