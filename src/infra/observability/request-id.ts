// Identificador de request (cabecera x-request-id). Es puro para poder usarlo
// desde src/proxy.ts y desde tests sin contexto de Next.

export const REQUEST_ID_HEADER = "x-request-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidRequestId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Reutiliza el id entrante si es un UUID valido; si no, genera uno nuevo. */
export function resolveRequestId(incoming: string | null | undefined): string {
  return isValidRequestId(incoming) ? incoming : crypto.randomUUID();
}
