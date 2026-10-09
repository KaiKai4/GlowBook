/** Extrae el texto de un error de PostgREST o de Error para decidir el mensaje publico. */
export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return "";
}
