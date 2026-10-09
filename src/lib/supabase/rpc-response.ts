import { z } from "@/lib/validation/zod";

/**
 * Interpreta la respuesta de una RPC de Supabase. Un error de PostgREST se
 * relanza tal cual (toPublicErrorMessage lo traduce a mensaje publico) y un
 * dato que no cumple el esquema lanza un error interno: nunca se coacciona con
 * String()/Number() ni se acepta un tipo sin validar.
 */
export function parseRpcResponse<T>(
  procedure: string,
  response: { data: unknown; error: unknown },
  schema: z.ZodType<T>
): T {
  if (response.error) throw response.error;

  const parsed = schema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error(`Respuesta inesperada de la RPC ${procedure}.`);
  }
  return parsed.data;
}
