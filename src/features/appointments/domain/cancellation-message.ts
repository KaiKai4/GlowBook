
/** Lo que el usuario elige para el cliente temporal al cancelar la cita. */
export type TemporaryCustomerChoice = "save" | "discard";

/** Acción sobre el cliente temporal que debe ejecutar el servidor, o null si no aplica. */
export type TemporaryCustomerAction = "promote" | "discard";

/**
 * Decide qué hacer con el cliente temporal tras cancelar. Solo los clientes creados para
 * esta cita son temporales; los permanentes nunca cambian desde la cancelación.
 */
export function temporaryCustomerActionFor(
  isTemporary: boolean,
  choice: TemporaryCustomerChoice
): TemporaryCustomerAction | null {
  if (!isTemporary) return null;
  return choice === "save" ? "promote" : "discard";
}

/** Enlace de WhatsApp con el mensaje codificado. El teléfono se queda solo con dígitos. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
