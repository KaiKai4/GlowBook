// Politicas de rate limit con nombre para los limites que se repiten en varias
// acciones. Los valores que aparecen una sola vez se quedan en su sitio.
// Sin imports: rate-limit.ts depende de este modulo, no al reves.

export interface RateLimitPolicy {
  /** Máximo de intentos dentro de la ventana. */
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

const SIGN_IN_WINDOW_MS = 15 * 60_000;

/** Inicio de sesion por cuenta e IP (correo normalizado): 10 intentos cada 15 min. */
export const SIGN_IN_ACCOUNT_POLICY = { max: 10, windowMs: SIGN_IN_WINDOW_MS } as const satisfies RateLimitPolicy;

/**
 * Inicio de sesion por IP global: 100 intentos cada 15 min. Holgado a proposito:
 * una oficina con NAT compartida no debe quedar bloqueada entera.
 */
export const SIGN_IN_IP_POLICY = { max: 100, windowMs: SIGN_IN_WINDOW_MS } as const satisfies RateLimitPolicy;
