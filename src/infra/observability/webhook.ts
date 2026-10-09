import { after } from "next/server";

// Envio al webhook de observabilidad. Sin reintentos (un fallo se registra en
// consola y se descarta: la observabilidad no debe bloquear la operacion) y con
// timeout corto para no retener la request.

const WEBHOOK_TIMEOUT_MS = 3000;

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

function warnStructured(event: string, detail: Record<string, string | number>): void {
  if (shouldEmitToConsole()) {
    console.warn(JSON.stringify({ event: `observability_${event}`, ...detail }));
  }
}

// Nunca rechaza: cualquier fallo queda registrado en consola de forma minima
// (solo el tipo de error, nunca la URL ni el cuerpo).
async function postObservabilityPayload(url: string, payload: unknown): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: webhookHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!response.ok) warnStructured("webhook_rejected", { status: response.status });
  } catch (error) {
    warnStructured("webhook_failed", { reason: error instanceof Error ? error.name : "unknown" });
  }
}

/**
 * Programa el envio. Dentro de una request usa after() para que no retrase la
 * respuesta; fuera de ella (scripts, tests) se envia directamente.
 */
export function scheduleObservabilityWebhook(payload: unknown): void {
  const url = process.env.GLOWBOOK_OBSERVABILITY_WEBHOOK_URL;
  if (!url || !shouldEmitToWebhook()) return;

  const send = () => postObservabilityPayload(url, payload);
  try {
    after(send);
  } catch {
    // after() lanza fuera de un contexto de request: envio inmediato.
    void send();
  }
}
