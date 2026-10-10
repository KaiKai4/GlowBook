import { getRequestId } from "./request-context";
import { sanitizeMetadata, serializeError, type ObservabilityMetadata } from "./redaction";
import { scheduleObservabilityWebhook } from "./webhook";

export interface ObservabilityContext {
  module: string;
  action: string;
  metadata?: ObservabilityMetadata;
}

interface ObservabilityPayload {
  level: "error" | "info";
  module: string;
  action: string;
  requestId?: string;
  metadata: ObservabilityMetadata;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function shouldEmitToConsole(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

// Serializa con la misma redaccion que el resto del modulo. Nunca lanza: si el
// valor no se puede convertir a texto, devuelve un marcador fijo.
function safeSerializeError(value: unknown): ReturnType<typeof serializeError> {
  try {
    return serializeError(value);
  } catch {
    return { name: "UnserializableError", message: "[no serializable]" };
  }
}

// Resuelve el request id (asincrono en Next 16) y emite. Nunca rechaza: si la
// emision falla, registra en consola el fallo y el error original (redactado),
// para no perder el error que se queria registrar.
async function emitError(error: unknown, context: ObservabilityContext): Promise<void> {
  try {
    const requestId = await getRequestId();
    const payload: ObservabilityPayload = {
      level: "error",
      module: context.module,
      action: context.action,
      ...(requestId ? { requestId } : {}),
      metadata: sanitizeMetadata(context.metadata),
      error: serializeError(error),
    };

    if (shouldEmitToConsole()) {
      console.error("[observability:error]", JSON.stringify(payload));
    }
    scheduleObservabilityWebhook(payload);
  } catch (emitFailure) {
    if (shouldEmitToConsole()) {
      console.error(
        JSON.stringify({
          event: "observability_emit_failed",
          module: context.module,
          action: context.action,
          emitError: safeSerializeError(emitFailure),
          originalError: safeSerializeError(error),
        })
      );
    }
  }
}

/**
 * Registra un error con request id, redaccion y envio opcional al webhook.
 * No es async para el llamador: la emision termina en segundo plano.
 */
export function captureError(error: unknown, context: ObservabilityContext): void {
  void emitError(error, context);
}
