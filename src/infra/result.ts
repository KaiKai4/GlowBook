export type Ok<T> = { ok: true; value: T; warnings?: string[] };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

// `warnings` solo aparece si hay avisos: la escritura se confirmo pero un efecto
// posterior (p. ej. la auditoria) fallo.
export function ok<T>(value: T, warnings: string[] = []): Ok<T> {
  return warnings.length > 0 ? { ok: true, value, warnings } : { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
