import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonOverviews } from "./salon-overviews.repo";

// Doble del cliente admin: la prueba ejercita el mapeo a través de la lectura pública.
const adminClient = vi.hoisted(() => ({ rpc: vi.fn<(name: string) => unknown>() }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminClient,
}));

describe("platform salón overview read model", () => {
  beforeEach(() => {
    adminClient.rpc.mockReset();
  });

  it("maps the SQL read model into the platform view model", async () => {
    adminClient.rpc.mockResolvedValue({
      error: null,
      data: [
        {
          id: "salon-1",
          name: "Glow Studio",
          email: "",
          contact_email: "owner@example.com",
          phone: "555",
          is_active: true,
          created_at: "2026-05-29T10:00:00.000Z",
          disabled_features: ["roles", "unknown"],
          owner_names: ["Ana Owner", ""],
          owner_count: 1,
          customer_count: 12,
          collaborator_count: 3,
          appointment_count: 40,
          service_count: 9,
          last_appointment_at: null,
          invitation_count: 2,
        },
      ],
    });

    await expect(findSalonOverviews()).resolves.toEqual([
      {
        id: "salon-1",
        name: "Glow Studio",
        email: "",
        contact_email: "owner@example.com",
        phone: "555",
        is_active: true,
        created_at: "2026-05-29T10:00:00.000Z",
        disabled_features: ["roles"],
        owner_names: ["Ana Owner"],
        owner_count: 1,
        customer_count: 12,
        collaborator_count: 3,
        appointment_count: 40,
        service_count: 9,
        last_appointment_at: null,
        invitation_count: 2,
      },
    ]);
    expect(adminClient.rpc).toHaveBeenCalledWith("platform_salon_overviews");
  });
});
