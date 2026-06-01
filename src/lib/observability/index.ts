type Primitive = string | number | boolean | null | undefined;

export type ObservabilityMetadata = Record<string, Primitive | Primitive[]>;

export interface ObservabilityContext {
  module: string;
  action: string;
  metadata?: ObservabilityMetadata;
}

interface ObservabilityPayload {
  level: "error" | "info";
  module: string;
  action: string;
  metadata: ObservabilityMetadata;
  event?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const SENSITIVE_KEY_PATTERN = /token|secret|password|service_role|authorization|cookie|key/i;
const SENSITIVE_TEXT_PATTERN =
  /(token|secret|password|service_role|authorization|cookie|key)(\s*[=:]\s*)[^\s,"'}]+/gi;

function knownSensitiveValues(): string[] {
  return Object.entries(process.env)
    .filter(([key, value]) => SENSITIVE_KEY_PATTERN.test(key) && typeof value === "string")
    .map(([, value]) => value)
    .filter((value): value is string => Boolean(value && value.length >= 8));
}

function redactText(value: string): string {
  let redacted = value.replace(SENSITIVE_TEXT_PATTERN, "$1$2[redacted]");

  for (const sensitiveValue of knownSensitiveValues()) {
    redacted = redacted.split(sensitiveValue).join("[redacted]");
  }

  return redacted;
}

function sanitizeMetadataValue(value: Primitive | Primitive[]): Primitive | Primitive[] {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? redactText(item) : item));
  }
  return value;
}

function sanitizeMetadata(metadata: ObservabilityMetadata = {}): ObservabilityMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeMetadataValue(value),
    ])
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactText(error.message),
      stack: error.stack ? redactText(error.stack) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: redactText(String(error)),
  };
}

function shouldEmitToConsole(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

function shouldEmitToWebhook(): boolean {
  if (!process.env.GLOWBOOK_OBSERVABILITY_WEBHOOK_URL) return false;
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") return true;
  return process.env.GLOWBOOK_OBSERVABILITY_ENABLE_IN_TESTS === "true";
}

function webhookHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (process.env.GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN) {
    headers.authorization = `Bearer ${process.env.GLOWBOOK_OBSERVABILITY_WEBHOOK_TOKEN}`;
  }

  return headers;
}

function emitToWebhook(payload: ObservabilityPayload): void {
  const url = process.env.GLOWBOOK_OBSERVABILITY_WEBHOOK_URL;
  if (!url || !shouldEmitToWebhook()) return;

  void fetch(url, {
    method: "POST",
    headers: webhookHeaders(),
    body: JSON.stringify(payload),
  }).catch((error: unknown) => {
    if (shouldEmitToConsole()) {
      console.warn("[observability:webhook_failed]", error);
    }
  });
}

export function captureError(error: unknown, context: ObservabilityContext): void {
  const payload: ObservabilityPayload = {
    level: "error",
    module: context.module,
    action: context.action,
    metadata: sanitizeMetadata(context.metadata),
    error: serializeError(error),
  };

  if (shouldEmitToConsole()) {
    console.error("[observability:error]", JSON.stringify(payload));
  }

  emitToWebhook(payload);
}

export function logEvent(event: string, context: ObservabilityContext): void {
  const payload: ObservabilityPayload = {
    level: "info",
    event,
    module: context.module,
    action: context.action,
    metadata: sanitizeMetadata(context.metadata),
  };

  if (shouldEmitToConsole()) {
    console.info("[observability:event]", JSON.stringify(payload));
  }

  emitToWebhook(payload);
}
