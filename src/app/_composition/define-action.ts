import "server-only";
import { revalidatePath } from "next/cache";
import { hasPermission, type Permission } from "@/features/access";
import { assertActionRateLimit, type RateLimitOptions } from "@/infra/security/rate-limit";
import { err, type Result } from "@/infra/result";
import type { z } from "@/infra/validation/zod";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import type { ProfileWithRole } from "@/types/app.types";
import { requireActiveProfile } from "./request-context";

// Pipeline unico de las server actions de presentacion:
// contexto -> permiso por clave -> rate limit -> validacion -> UNA llamada a un
// caso de uso -> revalidacion. La accion solo orquesta: las reglas viven en los
// casos de uso, y el permiso se pregunta por clave, nunca por nombre de rol.

interface ActionSession {
  userId: string;
  salonId: string;
  profile: ProfileWithRole;
}

export interface GuardedActionSpec<TRaw, TInput, TOutput> {
  /** Permiso requerido por clave, con el mensaje que se devuelve si falta. */
  permission?: { key: Permission; deniedMessage: string };
  /** Limite de peticiones por usuario. */
  rateLimit?: { scope: string; options: RateLimitOptions };
  /** Lee y valida la entrada. Un fallo corta antes del caso de uso. */
  parse: (raw: TRaw) => Result<TInput>;
  /** Unica llamada a un caso de uso. */
  run: (input: TInput, session: ActionSession) => Promise<Result<TOutput>>;
  /** Rutas a revalidar cuando el caso de uso responde ok. */
  revalidate?: (output: TOutput, input: TInput) => readonly string[];
}

async function loadSession(): Promise<ActionSession> {
  const profile = await requireActiveProfile();
  return { userId: profile.id, salonId: profile.salon_id, profile };
}

/**
 * Crea la funcion de una accion a partir de su especificacion. El resultado es
 * una funcion async normal: la exportacion "use server" la envuelve una accion
 * de una linea en el fichero de la ruta.
 */
export function defineAction<TRaw, TInput, TOutput>(
  spec: GuardedActionSpec<TRaw, TInput, TOutput>
): (raw: TRaw) => Promise<Result<TOutput>> {
  return async (raw: TRaw): Promise<Result<TOutput>> => {
    const session = await loadSession();

    if (spec.permission && !hasPermission(session.profile, spec.permission.key)) {
      return err(spec.permission.deniedMessage);
    }

    if (spec.rateLimit) {
      const limited = await assertActionRateLimit(session.userId, spec.rateLimit.scope, spec.rateLimit.options);
      if (!limited.ok) return limited;
    }

    const parsed = spec.parse(raw);
    if (!parsed.ok) return parsed;

    const result = await spec.run(parsed.value, session);
    if (result.ok && spec.revalidate) {
      for (const path of spec.revalidate(result.value, parsed.value)) {
        revalidatePath(path);
      }
    }
    return result;
  };
}

/** Parser que valida con un schema zod y devuelve el primer mensaje de error. */
export function parseWithSchema<T>(schema: z.ZodType<T>): (raw: unknown) => Result<T> {
  return (raw: unknown): Result<T> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return err(firstIssueMessage(parsed.error));
    return { ok: true, value: parsed.data };
  };
}
