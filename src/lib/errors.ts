import { captureError } from "@/lib/observability";
// PublicError vive en @/lib/public-error (modulo puro usable desde el dominio).
import { PublicError } from "@/lib/public-error";

// Mensajes fijos para SQLSTATE conocidos de Postgres/PostgREST. Nunca se
// devuelve el mensaje original de la base de datos para estos codigos.
const SQLSTATE_MESSAGES: Readonly<Record<string, string>> = {
  "23505": "Ya existe un registro con esos datos.",
  "23503": "La operación hace referencia a un registro inexistente.",
  "23P01": "Ese horario se cruza con otra cita.",
  "22P02": "Identificador inválido.",
};

// RAISE EXCEPTION redactados en español dentro de nuestras migraciones. Su
// mensaje es seguro de mostrar, siempre que no parezca SQL o metadatos internos.
const PASSTHROUGH_SQLSTATES: ReadonlySet<string> = new Set(["P0001", "22023", "42501"]);

// Un mensaje que delata la base (tablas, politicas, SQL, restricciones) nunca
// se muestra: se sustituye por el fallback y se registra el error original.
const INTERNAL_DETAIL_PATTERN =
  /\b(select|insert|update|delete|relation|table|column|function|policy|permission denied|violates|constraint|syntax|stack)\b|\b(public|auth)\./i;

const MAX_PUBLIC_MESSAGE_LENGTH = 300;

// Un SQLSTATE son cinco caracteres alfanumericos en mayusculas (clase + codigo).
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

function sqlStateOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const { code } = error as { code: unknown };
  return typeof code === "string" && SQLSTATE_PATTERN.test(code) ? code : null;
}

function rawMessageOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  const { message } = error as { message: unknown };
  return typeof message === "string" && message.length > 0 ? message : null;
}

function isSafeToShow(message: string): boolean {
  return (
    message.length <= MAX_PUBLIC_MESSAGE_LENGTH &&
    !/[\r\n]/.test(message) &&
    !INTERNAL_DETAIL_PATTERN.test(message)
  );
}

/**
 * Convierte cualquier error en un mensaje apto para el usuario.
 * - PublicError: su mensaje.
 * - SQLSTATE mapeado: mensaje fijo en español.
 * - SQLSTATE de RAISE propio y mensaje sin detalles internos: ese mensaje.
 * - Cualquier otro error (red, SQL interno, errores genericos): fallback, y el
 *   error original se registra con captureError.
 */
export function toPublicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof PublicError) return error.message;

  const sqlState = sqlStateOf(error);
  if (sqlState) {
    const mapped = SQLSTATE_MESSAGES[sqlState];
    if (mapped) return mapped;

    const message = rawMessageOf(error);
    if (PASSTHROUGH_SQLSTATES.has(sqlState) && message && isSafeToShow(message)) {
      return message;
    }
  }

  captureError(error, { module: "errors", action: "public-message" });
  return fallback;
}
