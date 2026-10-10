// Prueba de que la sesion actual pertenece a un platform admin (ADR 0028).
// La clase no se exporta como valor: fuera de este archivo solo existe el tipo y
// la unica forma de obtener una instancia es issuePlatformAdminProof. Como el
// campo `brand` es privado, un objeto literal con la misma forma no es asignable.
// Regla de dependency-cruiser 'platform-admin-proof-issuer': solo el composition
// root (src/app/_composition) y src/infra/auth pueden importar la emision.

class PlatformAdminProof {
  private readonly brand = true;
  readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }
}

export type { PlatformAdminProof };

/**
 * Emite la prueba de platform admin para un usuario ya verificado contra
 * platform_admins. Solo debe llamarla requirePlatformAdminProof.
 */
export function issuePlatformAdminProof(userId: string): PlatformAdminProof {
  return new PlatformAdminProof(userId);
}
