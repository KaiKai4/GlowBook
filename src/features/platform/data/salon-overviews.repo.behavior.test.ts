import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSalonOverviews } from "./salon-overviews.repo";
import {
  createFakeSupabase,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";
import { firstOf } from "@/test/platform-feedback-notifications-helpers";

// Lectura del read model de salones (RPC platform_salon_overviews): sin filas
// devuelve lista vacia, un fallo de la RPC se propaga y los nombres de
// propietario vacios se descartan.

const clients = vi.hoisted(() => ({ admin: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

beforeEach(() => {
  clients.admin = null;
});

describe("findSalonOverviews", () => {
  it("returns an empty list when the read model returns no rows", async () => {
    clients.admin = createFakeSupabase({ rpc: { platform_salon_overviews: { data: null, error: null } } });

    await expect(findSalonOverviews()).resolves.toEqual([]);
    expect(clients.admin.rpc).toHaveBeenCalledWith("platform_salon_overviews");
  });

  it("propagates RPC failures instead of returning a partial list", async () => {
    const rpcError = { message: "function does not exist" };
    clients.admin = createFakeSupabase({ rpc: { platform_salon_overviews: { data: null, error: rpcError } } });

    await expect(findSalonOverviews()).rejects.toBe(rpcError);
  });

  it("keeps a salón without appointments with a null last appointment and drops empty owner names", async () => {
    clients.admin = createFakeSupabase({
      rpc: {
        platform_salon_overviews: {
          data: [
            {
              id: "salon-9",
              name: "Nuevo",
              email: "",
              contact_email: "",
              phone: "",
              is_active: true,
              created_at: "2026-06-01T10:00:00.000Z",
              disabled_features: [],
              owner_names: ["", "Ana"],
              owner_count: 1,
              customer_count: 0,
              collaborator_count: 0,
              appointment_count: 0,
              service_count: 0,
              last_appointment_at: null,
              invitation_count: 1,
            },
          ],
          error: null,
        },
      },
    });

    const salon = firstOf(await findSalonOverviews());

    expect(salon.last_appointment_at).toBeNull();
    expect(salon.owner_names).toEqual(["Ana"]);
  });
});
