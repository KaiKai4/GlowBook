/** true cuando los E2E corren contra Supabase local (GLOWBOOK_TEST_TARGET=local). */
export const isLocalTarget = process.env.GLOWBOOK_TEST_TARGET === "local";

/**
 * Sustituye al test.skip condicional. Fuera de local, una precondición ausente
 * falla igual que en local: staging es un gate de publicación y no puede
 * aprobarse con flujos críticos omitidos.
 */
export function skipUnlessReady(missing: boolean, reason: string): void {
  if (!missing) return;
  if (isLocalTarget) {
    throw new Error(`Precondición E2E ausente en modo local: ${reason}`);
  }
  throw new Error(`Precondición E2E ausente en staging: ${reason}`);
}
