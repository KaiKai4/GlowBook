// Traduce los SQLSTATE de las RPC atomicas de roles a mensajes publicos fijos (ADR 0018): nunca se
// muestra el mensaje original de la base de datos.
const ROLE_RPC_MESSAGES: Readonly<Record<string, string>> = {
  "42501": "No tienes permiso para gestionar roles.",
  "22023": "Uno o más permisos no son válidos.",
  P0002: "Rol no encontrado.",
};

export function sqlStateOf(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

/** Mensaje fijo para un SQLSTATE conocido de las RPC de roles, o null si no hay mensaje propio. */
export function rolePermissionsErrorMessage(error: unknown): string | null {
  return ROLE_RPC_MESSAGES[sqlStateOf(error)] ?? null;
}
