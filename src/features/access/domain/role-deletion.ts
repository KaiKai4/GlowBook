import { PublicError } from "@/infra/public-error";

/** Estado de un rol que decide si puede borrarse. `null` significa que no existe en el salón. */
interface DeletableRoleState {
  is_system: boolean;
}

/**
 * Regla de borrado de roles: el rol debe existir en el salón y no ser de sistema.
 * Función pura: devuelve si la regla se cumple y lanza PublicError con el mensaje público si no.
 */
export function assertRoleDeletable(role: DeletableRoleState | null): void {
  if (!role) throw new PublicError("Rol no encontrado.");
  if (role.is_system) throw new PublicError("Los roles de sistema no se pueden eliminar.");
}
