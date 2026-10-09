import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { captureError } from "@/infra/observability";
import { err, ok, type Result } from "@/infra/result";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";

// Rate limiting de ventana fija compartido por todas las instancias: el
// contador vive en la tabla rate_limit_buckets y se incrementa con la RPC
// consume_rate_limit (ver ADR 0017). Solo el service_role puede ejecutarla, y
// este modulo es la unica puerta de acceso desde la aplicacion.
//
// Politica ante fallo del almacen: fail-open. Si la RPC falla, la operacion se
// permite y el error se registra con captureError. La fuerza bruta de tokens
// de invitacion queda cubierta por la entropia del token, no por este limite.

export interface RateLimitOptions {
  /** Maximo de intentos dentro de la ventana. */
  max: number;
  /** Duración de la ventana en milisegundos. */
  windowMs: number;
}

const DEFAULT_ACTION_LIMIT: RateLimitOptions = { max: 60, windowMs: 60_000 };
const DEFAULT_ANONYMOUS_LIMIT: RateLimitOptions = { max: 10, windowMs: 60_000 };

const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un momento y vuelve a intentarlo.";

// Limites de la RPC: clave de hasta 200 caracteres y ventana de 1 a 86400 s.
const MAX_KEY_LENGTH = 200;
const MAX_WINDOW_SECONDS = 86_400;
const UNSAFE_KEY_CHARS = /[^A-Za-z0-9:._-]/g;

/**
 * Normaliza la clave antes de enviarla: solo caracteres seguros. Si la clave
 * es demasiado larga se sustituye por su hash SHA-256 (sigue siendo unica).
 */
function sanitizeRateLimitKey(raw: string): string {
  const cleaned = raw.replace(UNSAFE_KEY_CHARS, "_");
  if (cleaned.length > 0 && cleaned.length <= MAX_KEY_LENGTH) return cleaned;
  const digest = createHash("sha256").update(raw).digest("hex");
  return `sha256:${digest}`;
}

function windowSecondsFor(windowMs: number): number {
  return Math.min(MAX_WINDOW_SECONDS, Math.max(1, Math.ceil(windowMs / 1000)));
}

async function consumeRateLimit(
  rawKey: string,
  scope: string,
  options: RateLimitOptions
): Promise<Result<void>> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: sanitizeRateLimitKey(rawKey),
      p_max: options.max,
      p_window_seconds: windowSecondsFor(options.windowMs),
    });
    if (error) throw error;

    const decision = Array.isArray(data) ? data[0] : undefined;
    if (!decision) throw new Error("consume_rate_limit no devolvio decision.");
    return decision.allowed ? ok(undefined) : err(RATE_LIMIT_MESSAGE);
  } catch (failure) {
    captureError(failure, { module: "security", action: "rate-limit", metadata: { scope } });
    return ok(undefined);
  }
}

/**
 * Guarda para server actions y route handlers autenticados: limita por usuario
 * y ambito. Debe llamarse con await.
 */
export function assertActionRateLimit(
  userId: string,
  scope: string,
  options: RateLimitOptions = DEFAULT_ACTION_LIMIT
): Promise<Result<void>> {
  return consumeRateLimit(`user:${userId}:${scope}`, scope, options);
}

/**
 * IP del cliente. En Vercel la plataforma fija x-real-ip, por eso se prefiere.
 * Como respaldo se usa el ÚLTIMO valor de x-forwarded-for: es el que añade el
 * proxy más cercano; el primero lo escribe el cliente y es falseable fuera de
 * Vercel. Sin IP, la clave es el bucket compartido "ip:unknown".
 */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = headerList.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwardedFor || "unknown";
}

/**
 * Guarda para endpoints sin sesion (aceptacion de invitaciones, reportes CSP):
 * limita por IP.
 */
export async function assertAnonymousRateLimit(
  scope: string,
  options: RateLimitOptions = DEFAULT_ANONYMOUS_LIMIT
): Promise<Result<void>> {
  const ip = await clientIp();
  return consumeRateLimit(`ip:${ip}:${scope}`, scope, options);
}
