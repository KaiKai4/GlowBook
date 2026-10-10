import { describe, expect, it } from "vitest";
import {
  cleanupSalonOwnerFixture,
  createIntegrationAdminClient,
  createIntegrationUserClient,
  createSalonOwnerFixture,
  getSupabaseIntegrationEnv,
  type SalonOwnerFixture,
} from "@/test/supabase-integration-fixtures";

const integrationEnv = getSupabaseIntegrationEnv();

describe(
  "platform_salon_overviews RPC grants",
  () => {
    it("denies authenticated salón users and allows service role callers", async () => {
      const admin = createIntegrationAdminClient(integrationEnv);
      const user = createIntegrationUserClient(integrationEnv);
      let fixture: SalonOwnerFixture | null = null;

      try {
        fixture = await createSalonOwnerFixture(admin, "RPC Platform");

        const { error: signInError } = await user.auth.signInWithPassword({
          email: fixture.email,
          password: fixture.password,
        });
        expect(signInError).toBeNull();

        const { error: deniedError } = await user.rpc("platform_salon_overviews");
        expect(deniedError?.message).toMatch(/permission denied|not allowed|does not exist/i);

        const { data, error: adminError } = await admin.rpc("platform_salon_overviews");
        expect(adminError).toBeNull();
        expect(Array.isArray(data)).toBe(true);
      } finally {
        await cleanupSalonOwnerFixture(admin, fixture);
      }
    }, 30_000);
  }
);
