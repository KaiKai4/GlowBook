/**
 * Causa tipada de un fallo de las RPC de cita. La decide el adaptador de data
 * con el error crudo (antes de traducirlo a mensaje público); los casos de uso
 * deciden por esta causa, nunca por el texto.
 */
export type AppointmentRpcFailureReason = "slot_taken" | "inactive_customer" | "unknown";

/** Texto que emite la RPC cuando el cliente no puede recibir citas nuevas. */
const INACTIVE_CUSTOMER_TEXT = "no esta disponible para nuevas citas";
/** SQLSTATE de exclusion_violation: la constraint de solape de citas por profesional. */
const EXCLUSION_VIOLATION_CODE = "23P01";
const OVERLAP_CONSTRAINT = "no_overlap_per_employee";

function codeAndMessageOf(error: unknown): { code: string; message: string } {
  const isObject = typeof error === "object" && error !== null;
  const code = isObject && "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    error instanceof Error
      ? error.message
      : isObject && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
  return { code, message };
}

export function classifyAppointmentRpcFailure(error: unknown): AppointmentRpcFailureReason {
  const { code, message } = codeAndMessageOf(error);
  if (code === EXCLUSION_VIOLATION_CODE || message.includes(OVERLAP_CONSTRAINT)) return "slot_taken";
  if (message.includes(INACTIVE_CUSTOMER_TEXT)) return "inactive_customer";
  return "unknown";
}
