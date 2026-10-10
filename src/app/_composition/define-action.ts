import "server-only";
import { revalidatePath } from "next/cache";
import type { ActionContext, Permission } from "@/features/access";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import type { SalonFeatureKey } from "@/features/salon-features";
import { assertActionRateLimit, type RateLimitOptions } from "@/infra/security/rate-limit";
import { err, ok, type Result } from "@/infra/result";
import type { z } from "@/infra/validation/zod";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { parseUuid } from "@/infra/validation/route-id";
import { requireActionContext } from "./request-context";

// Pipeline unico de las server actions de presentacion:
// contexto -> permiso por clave -> rate limit -> validacion -> UNA llamada a un
// caso de uso -> revalidacion. La accion solo orquesta: las reglas viven en los
// casos de uso, y el permiso se pregunta por clave, nunca por nombre de rol.

/** Ruta a revalidar: una ruta de pagina o un layout completo que cubre sus subrutas. */
type RevalidateTarget = string | { path: string; type: "layout" };

/**
 * Pipeline comun a la sesion de salon y a la de plataforma: rate limit,
 * validacion, UNA llamada a un caso de uso y revalidacion.
 */
export interface FlowSpec<TRaw, TInput, TOutput, TSession extends { userId: string }> {
  /** Limite de peticiones por usuario. Sin opciones se aplica el limite por defecto. */
  rateLimit?: { scope: string; options?: RateLimitOptions };
  /** Lee y valida la entrada. Un fallo corta antes del caso de uso. */
  parse: (raw: TRaw) => Result<TInput>;
  /** Unica llamada a un caso de uso. */
  run: (input: TInput, session: TSession) => Promise<Result<TOutput>>;
  /** Rutas o layouts a revalidar cuando el caso de uso responde ok. */
  revalidate?: (output: TOutput, input: TInput) => readonly RevalidateTarget[];
}

export interface GuardedActionSpec<TRaw, TInput, TOutput>
  extends FlowSpec<TRaw, TInput, TOutput, ActionContext> {
  /**
   * Permiso o permisos requeridos por clave (todos obligatorios), con el mensaje
   * que se devuelve si falta alguno.
   */
  permission?: { key: Permission | Permission[]; deniedMessage: string };
  /**
   * Modulo contratado del salón. Si no esta habilitado en el plan (o, sin plan,
   * en las features heredadas) la accion responde con error antes del rate limit.
   */
  module?: SalonFeatureKey;
}

const MODULE_DISABLED_MESSAGE = "Este módulo no está incluido en el plan de este salón.";

/** Indica si el contexto tiene todas las claves de permiso pedidas. */
function hasAllPermissions(context: ActionContext, key: Permission | Permission[]): boolean {
  const keys = Array.isArray(key) ? key : [key];
  return keys.every((permission) => context.permissions.includes(permission));
}

/**
 * Ejecuta el flujo a partir de un contexto ya resuelto: rate limit, validacion,
 * caso de uso y revalidacion. Lo comparten la accion de salon y la de plataforma.
 */
export async function runActionFlow<TRaw, TInput, TOutput, TSession extends { userId: string }>(
  spec: FlowSpec<TRaw, TInput, TOutput, TSession>,
  session: TSession,
  raw: TRaw
): Promise<Result<TOutput>> {
  if (spec.rateLimit) {
    const limited = await assertActionRateLimit(session.userId, spec.rateLimit.scope, spec.rateLimit.options);
    if (!limited.ok) return limited;
  }

  const parsed = spec.parse(raw);
  if (!parsed.ok) return parsed;

  const result = await spec.run(parsed.value, session);
  if (result.ok && spec.revalidate) {
    for (const target of spec.revalidate(result.value, parsed.value)) {
      if (typeof target === "string") revalidatePath(target);
      else revalidatePath(target.path, target.type);
    }
  }
  return result;
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
    const context = await requireActionContext();

    if (spec.permission && !hasAllPermissions(context, spec.permission.key)) {
      return err(spec.permission.deniedMessage);
    }

    if (spec.module) {
      const scope = { salonId: context.salonId, disabledFeatures: context.disabledFeatures };
      if (!(await isEffectiveSalonModuleEnabled(scope, spec.module))) {
        return err(MODULE_DISABLED_MESSAGE);
      }
    }

    return runActionFlow(spec, context, raw);
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

const INVALID_IDENTIFIER_MESSAGE = "Identificador inválido.";

/** Parser de un UUID: devuelve el valor o el error de identificador invalido. */
export function parseUuidField(value: string): Result<string> {
  const id = parseUuid(value);
  return id ? ok(id) : err(INVALID_IDENTIFIER_MESSAGE);
}
