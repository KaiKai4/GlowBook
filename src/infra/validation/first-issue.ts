import type { ZodError } from "@/infra/validation/zod";

// Mensaje del primer issue de un ZodError (safeParse fallido).
// Zod garantiza al menos un issue cuando safeParse falla; si esa invariante
// se rompiera, se lanza un error explícito en lugar de devolver undefined.
export function firstIssueMessage(error: ZodError): string {
  const [first] = error.issues;
  if (!first) {
    throw new Error("ZodError sin issues: invariante de validación rota.");
  }
  return first.message;
}
