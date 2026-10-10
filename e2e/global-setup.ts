import {
  cleanupPlatformAdminFixture,
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createPlatformAdminFixture,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type PlatformAdminFixture,
  type SalonOwnerFixture,
} from "../src/test/supabase-integration-fixtures";
import { isLocalTarget } from "./support/env";
import { LOCAL_FIXTURES_ENV, serializeLocalFixtures } from "./support/local-fixtures";
import {
  cleanupLimitedCollaboratorFixture,
  createLimitedCollaboratorFixture,
} from "./support/limited-collaborator";
import { clearSessionCache } from "./support/session-cache";

// Crea con el service role LOCAL los datos que requieren los specs:
// dos salones (A y B), un owner por salón y un platform admin.
// Solo corre en modo local; las credenciales son generadas por el test.
export default async function globalSetup(): Promise<() => Promise<void>> {
  if (!isLocalTarget) return async () => {};
  // Las sesiones cacheadas pertenecen a la BD de esta ejecución: se descartan al empezar.
  await clearSessionCache();

  const admin = createIntegrationAdminClient(getSupabaseIntegrationEnv());
  const cleanups: Array<() => Promise<void>> = [];

  try {
    const salonOwnerA: SalonOwnerFixture = await createSalonOwnerFixture(admin, "E2E Tenant A");
    cleanups.push(() => cleanupSalonOwnerFixture(admin, salonOwnerA));

    const salonOwnerB: SalonOwnerFixture = await createSalonOwnerFixture(admin, "E2E Tenant B");
    cleanups.push(() => cleanupSalonOwnerFixture(admin, salonOwnerB));

    const salonOwnerMobile: SalonOwnerFixture = await createSalonOwnerFixture(admin, "E2E Tenant Mobile");
    cleanups.push(() => cleanupSalonOwnerFixture(admin, salonOwnerMobile));

    const salonOwnerSignOut: SalonOwnerFixture = await createSalonOwnerFixture(admin, "E2E Cierre de sesión");
    cleanups.push(() => cleanupSalonOwnerFixture(admin, salonOwnerSignOut));

    const accessibilityOwner: SalonOwnerFixture = await createSalonOwnerFixture(admin, "E2E a11y");
    cleanups.push(() => cleanupSalonOwnerFixture(admin, accessibilityOwner));

    const accessibilityCollaborator = await createLimitedCollaboratorFixture(admin, accessibilityOwner.salonId);
    cleanups.push(() => cleanupLimitedCollaboratorFixture(admin, accessibilityCollaborator));

    const platformAdmin: PlatformAdminFixture = await createPlatformAdminFixture(admin);
    cleanups.push(() => cleanupPlatformAdminFixture(admin, platformAdmin));

    process.env[LOCAL_FIXTURES_ENV] = serializeLocalFixtures({
      salonOwnerA,
      salonOwnerB,
      salonOwnerMobile,
      salonOwnerSignOut,
      accessibilityOwner,
      accessibilityCollaborator,
      platformAdmin,
    });
    process.env.E2E_SALON_OWNER_EMAIL = salonOwnerA.email;
    process.env.E2E_SALON_OWNER_PASSWORD = salonOwnerA.password;
    process.env.E2E_PLATFORM_ADMIN_EMAIL = platformAdmin.email;
    process.env.E2E_PLATFORM_ADMIN_PASSWORD = platformAdmin.password;
  } catch (error) {
    // Limpieza parcial: no dejar usuarios ni salones huérfanos si falla a medias.
    for (const cleanup of cleanups.reverse()) {
      await cleanup().catch(() => undefined);
    }
    throw error;
  }

  return async () => {
    for (const cleanup of cleanups.reverse()) {
      await cleanup();
    }
  };
}
