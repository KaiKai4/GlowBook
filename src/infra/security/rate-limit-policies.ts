// Politicas de rate limit con nombre para los limites que se repiten en varias
// acciones. Los valores que aparecen una sola vez se quedan en su sitio.
// Sin imports: rate-limit.ts depende de este modulo, no al reves.

export interface RateLimitPolicy {
  /** Maximo de intentos dentro de la ventana. */
  readonly max: number;
  /** Duracion de la ventana en milisegundos. */
  readonly windowMs: number;
}

export const RATE_LIMIT_POLICIES = {
  /** Escrituras de uso normal: 60 por minuto y usuario. */
  write: { max: 60, windowMs: 60_000 },
  /** Operaciones de administracion o envio mas restrictivas: 30 por minuto. */
  restricted: { max: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;
