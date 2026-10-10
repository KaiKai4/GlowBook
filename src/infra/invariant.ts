// Comprueba un invariante interno: un dato que el propio caso de uso garantiza.
// Lanza un Error tecnico que nunca llega al usuario: el caso de uso lo convierte
// en Result con toResult (src/infra/to-result.ts, ADR 0029).
export function requireInvariant<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}
