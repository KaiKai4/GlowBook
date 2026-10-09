// Utilidades para comprobar el envío con intención idempotente en tests de formularios (jsdom).
import { flushAsync } from "@/test/ui-shared-dom";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La clave se calcula con SHA-256 asíncrono antes de llamar a la acción: hay que dejar correr varias tareas. */
export async function settleSubmission(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await flushAsync();
}

/** Valor de "idempotency_key" del FormData recibido por la acción (cadena vacía si no existe). */
export function idempotencyKeyOf(formData: FormData | undefined): string {
  return String(formData?.get("idempotency_key") ?? "");
}
