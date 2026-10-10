import { captureError, type ObservabilityContext } from "@/infra/observability";
import { toPublicErrorMessage } from "@/infra/errors";
import { PublicError } from "@/infra/public-error";
import { err, ok, type Result } from "@/infra/result";

export interface ToResultOptions {
  /** Mensaje fijo que ve el usuario cuando el error no es apto para mostrar (ADR 0018). */
  fallback: string;
  /** Contexto con el que se registra un error técnico (módulo y acción del caso de uso). */
  context: ObservabilityContext;
}

// Convierte la excepción de un paso del caso de uso en un Result (ADR 0029).
// PublicError: su mensaje, sin registro. Cualquier otro error: toPublicErrorMessage
// decide el texto y, si cae en el fallback, el error se registra con el contexto
// del caso de uso.
export async function toResult<T>(
  fn: () => Promise<T>,
  options: ToResultOptions
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof PublicError) return err(error.message);
    const message = toPublicErrorMessage(error, options.fallback);
    if (message === options.fallback) captureError(error, options.context);
    return err(message);
  }
}
