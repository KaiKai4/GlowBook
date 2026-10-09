// Redaccion de datos sensibles antes de emitir observabilidad. Se aplica a
// claves de metadatos, a textos libres (mensajes, stacks) y a valores secretos
// conocidos del entorno. Tambien enmascara emails y telefonos dentro de textos.

type Primitive = string | number | boolean | null | undefined;
export type ObservabilityMetadata = Record<string, Primitive | Primitive[]>;

const SENSITIVE_KEY_PATTERN = /token|secret|password|service_role|authorization|cookie|key/i;
// Pares clave=valor o clave: valor. El valor termina en separador o cierre
// (espacio, coma, punto y coma, comillas, llaves, parentesis o corchetes), así
// que "(token=zzz)" conserva el ")". El corchete de apertura tampoco entra en el
// valor, para no re-redactar un "[redacted]" ya puesto. Si el valor empieza por
// Bearer/Basic se conserva el esquema y se oculta la credencial que sigue; el
// lookahead impide tomar "Bearer" como valor cuando lo que sigue ya está oculto.
const SENSITIVE_TEXT_PATTERN =
  /(token|secret|password|service_role|authorization|cookie|key)(\s*[=:]\s*)((?:bearer\s+|basic\s+)?)(?!(?:bearer|basic)\s)[^\s,;"'})\][]+/gi;
// Cabecera "Bearer <token>" suelta (p. ej. dentro de un mensaje de error).
const BEARER_TOKEN_PATTERN = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
// JWT: tres segmentos base64url, el primero empieza por "eyJ" (cabecera JSON).
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Secuencia de digitos con separadores habituales. Solo se enmascara si tiene
// entre 9 y 15 digitos (longitud de un telefono internacional); fechas como
// 2026-10-09 (8 digitos) se conservan.
const PHONE_CANDIDATE_PATTERN = /\+?\d[\d\s().-]{6,}\d/g;
const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 15;

function knownSensitiveValues(): string[] {
  return Object.entries(process.env)
    .filter(([key, value]) => SENSITIVE_KEY_PATTERN.test(key) && typeof value === "string")
    .map(([, value]) => value)
    .filter((value): value is string => Boolean(value && value.length >= 8));
}

function maskPhones(text: string): string {
  return text.replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
    const digits = candidate.replace(/\D/g, "").length;
    return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS ? "[telefono]" : candidate;
  });
}

function redactText(value: string): string {
  let redacted = value
    .replace(JWT_PATTERN, "[redacted]")
    .replace(BEARER_TOKEN_PATTERN, "$1 [redacted]")
    .replace(SENSITIVE_TEXT_PATTERN, "$1$2$3[redacted]")
    .replace(EMAIL_PATTERN, "[email]");
  redacted = maskPhones(redacted);

  for (const sensitiveValue of knownSensitiveValues()) {
    redacted = redacted.split(sensitiveValue).join("[redacted]");
  }

  return redacted;
}

function sanitizeMetadataValue(value: Primitive | Primitive[]): Primitive | Primitive[] {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? redactText(item) : item));
  }
  return value;
}

export function sanitizeMetadata(metadata: ObservabilityMetadata = {}): ObservabilityMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeMetadataValue(value),
    ])
  );
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactText(error.message),
      stack: error.stack ? redactText(error.stack) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: redactText(String(error)),
  };
}
