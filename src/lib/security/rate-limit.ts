import { headers } from "next/headers";
import { err, ok, type Result } from "@/lib/result";

// Rate limiting de ventana fija en memoria. En Vercel cada instancia tiene su
// propio mapa, asi que el limite efectivo es por instancia: suficiente contra
// rafagas y fuerza bruta (que golpean la misma instancia caliente), sin
// infraestructura extra. Si el SaaS crece, cambiar el almacen por Redis/KV
// manteniendo esta misma interfaz.

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Maximo de intentos dentro de la ventana. */
  max: number;
  /** Duracion de la ventana en milisegundos. */
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function pruneExpired(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now()
): RateLimitDecision {
  pruneExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count <= options.max) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Solo para tests: limpia el estado compartido entre casos. */
export function resetRateLimitStore(): void {
  buckets.clear();
}

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

/**
 * Guarda para server actions autenticadas: limita por usuario y ambito.
 * Devuelve Result para encajar en el patron de guardas existente.
 */
export function assertActionRateLimit(
  userId: string,
  scope: string,
  options: RateLimitOptions = { max: 60, windowMs: 60_000 }
): Result<void> {
  const decision = checkRateLimit(`user:${userId}:${scope}`, options);
  if (decision.allowed) return ok(undefined);
  return err(RATE_LIMIT_MESSAGE);
}

/**
 * Guarda para endpoints sin sesion (aceptacion de invitaciones): limita por IP
 * contra fuerza bruta de tokens.
 */
export async function assertAnonymousRateLimit(
  scope: string,
  options: RateLimitOptions = { max: 10, windowMs: 60_000 }
): Promise<Result<void>> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

  const decision = checkRateLimit(`ip:${ip}:${scope}`, options);
  if (decision.allowed) return ok(undefined);
  return err(RATE_LIMIT_MESSAGE);
}
