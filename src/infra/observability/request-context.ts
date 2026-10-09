import { headers } from "next/headers";
import { isValidRequestId, REQUEST_ID_HEADER } from "./request-id";

// Lee el request id de la request actual. Fuera de una request (scripts,
// tests, tareas en segundo plano) no hay cabeceras: devuelve undefined.
// Las señales internas de Next (digest, p. ej. uso dinamico durante el
// prerender) se relanzan hacia el llamador. captureError las recoge en su
// emision en segundo plano y no incluye el requestId en ese caso.
export async function getRequestId(): Promise<string | undefined> {
  try {
    const value = (await headers()).get(REQUEST_ID_HEADER);
    return isValidRequestId(value) ? value : undefined;
  } catch (error) {
    if (isNextControlFlowSignal(error)) throw error;
    return undefined;
  }
}

function isNextControlFlowSignal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string"
  );
}
