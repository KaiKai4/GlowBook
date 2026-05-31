type Primitive = string | number | boolean | null | undefined;

export type ObservabilityMetadata = Record<string, Primitive | Primitive[]>;

export interface ObservabilityContext {
  module: string;
  action: string;
  metadata?: ObservabilityMetadata;
}

const SENSITIVE_KEY_PATTERN = /token|secret|password|service_role|authorization|cookie|key/i;

function sanitizeMetadata(metadata: ObservabilityMetadata = {}): ObservabilityMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : value,
    ])
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

function shouldEmitToConsole(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

export function captureError(error: unknown, context: ObservabilityContext): void {
  const payload = {
    level: "error",
    module: context.module,
    action: context.action,
    metadata: sanitizeMetadata(context.metadata),
    error: serializeError(error),
  };

  if (shouldEmitToConsole()) {
    console.error("[observability:error]", JSON.stringify(payload));
  }
}

export function logEvent(event: string, context: ObservabilityContext): void {
  const payload = {
    level: "info",
    event,
    module: context.module,
    action: context.action,
    metadata: sanitizeMetadata(context.metadata),
  };

  if (shouldEmitToConsole()) {
    console.info("[observability:event]", JSON.stringify(payload));
  }
}
