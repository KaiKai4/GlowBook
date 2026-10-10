import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAllSalons, findSalonNamesByIds, setSalonActiveStatus } from "./salons.repo";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";
import { firstOf } from "@/test/platform-feedback-notifications-helpers";

// Lectura cross-tenant de salones desde la plataforma (cliente admin). El
// contacto visible cae al correo de la invitación aceptada cuando el salón
// no tiene correo propio, y las funciones desactivadas se normalizan.

const clients = vi.hoisted(() => ({ admin: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

const SALON_A = "00000000-0000-4000-8000-00000000000a";
const SALON_B = "00000000-0000-4000-8000-00000000000b";

const salonRow = {
  id: SALON_A,
  name: "Glow",
  email: "",
  phone: "555",
  is_active: true,
  created_at: "2026-05-01T10:00:00.000Z",
  disabled_features: ["roles", "no-existe"],
};

beforeEach(() => {
  clients.admin = null;
});

describe("findAllSalons", () => {
  it("lists every salón newest first with the platform columns", async () => {
    const admin = createFakeSupabase({ tables: { salons: { data: [salonRow], error: null } } });
    clients.admin = admin;

    await findAllSalons();

    const query = queryFor(admin, "salons");
    expect(argsOf(query, "select")).toEqual([
      ["id, name, email, phone, is_active, created_at, disabled_features"],
    ]);
    expect(argsOf(query, "order")).toEqual([["created_at", { ascending: false }]]);
  });

  it("falls back to the accepted invitation email when the salón has no own email", async () => {
    clients.admin = createFakeSupabase({
      tables: {
        salons: { data: [salonRow], error: null },
        salon_invitations: {
          data: [{ salon_id: SALON_A, email: "owner@example.com", accepted_at: "2026-05-02" }],
          error: null,
        },
      },
    });

    const salon = firstOf(await findAllSalons());

    expect(salon.contact_email).toBe("owner@example.com");
  });

  it("prefers the salón's own email over the invitation email", async () => {
    clients.admin = createFakeSupabase({
      tables: {
        salons: { data: [{ ...salonRow, email: "salon@example.com" }], error: null },
        salon_invitations: {
          data: [{ salon_id: SALON_A, email: "owner@example.com", accepted_at: "2026-05-02" }],
          error: null,
        },
      },
    });

    const salon = firstOf(await findAllSalons());

    expect(salon.contact_email).toBe("salon@example.com");
  });

  it("leaves the contact email empty when neither source has one", async () => {
    clients.admin = createFakeSupabase({
      tables: { salons: { data: [salonRow], error: null } },
    });

    const salon = firstOf(await findAllSalons());

    expect(salon.contact_email).toBe("");
  });

  it("normalises disabled features, dropping unknown keys", async () => {
    clients.admin = createFakeSupabase({
      tables: { salons: { data: [salonRow], error: null } },
    });

    const salon = firstOf(await findAllSalons());

    expect(salon.disabled_features).toEqual(["roles"]);
  });

  it("skips the invitation lookup when there are no salons", async () => {
    const admin = createFakeSupabase({ tables: { salons: { data: [], error: null } } });
    clients.admin = admin;

    await expect(findAllSalons()).resolves.toEqual([]);
    expect(admin.queries.map((entry) => entry.table)).toEqual(["salons"]);
  });

  it("throws salón read errors", async () => {
    const readError = { message: "denied" };
    clients.admin = createFakeSupabase({ tables: { salons: { data: null, error: readError } } });

    await expect(findAllSalons()).rejects.toBe(readError);
  });
});

describe("findSalonNamesByIds", () => {
  it("returns an empty map without querying when no ids are given", async () => {
    const admin = createFakeSupabase();
    clients.admin = admin;

    const names = await findSalonNamesByIds([]);

    expect(names.size).toBe(0);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("maps the requested ids to their names", async () => {
    const admin = createFakeSupabase({
      tables: {
        salons: {
          data: [
            { id: SALON_A, name: "Glow" },
            { id: SALON_B, name: "Studio" },
          ],
          error: null,
        },
      },
    });
    clients.admin = admin;

    const names = await findSalonNamesByIds([SALON_A, SALON_B]);

    expect(names).toEqual(
      new Map([
        [SALON_A, "Glow"],
        [SALON_B, "Studio"],
      ])
    );
    expect(argsOf(queryFor(admin, "salons"), "in")).toEqual([["id", [SALON_A, SALON_B]]]);
  });

  it("returns an empty map on null data and throws on errors", async () => {
    clients.admin = createFakeSupabase({ tables: { salons: { data: null, error: null } } });
    await expect(findSalonNamesByIds([SALON_A])).resolves.toEqual(new Map());

    const readError = { message: "denied" };
    clients.admin = createFakeSupabase({ tables: { salons: { data: null, error: readError } } });
    await expect(findSalonNamesByIds([SALON_A])).rejects.toBe(readError);
  });
});

describe("setSalonActiveStatus", () => {
  it("updates only the is_active flag of the target salón", async () => {
    const admin = createFakeSupabase({
      tables: { salons: { data: { id: SALON_A }, error: null } },
    });
    clients.admin = admin;

    await setSalonActiveStatus(SALON_A, false);

    const query = queryFor(admin, "salons");
    expect(argsOf(query, "update")).toEqual([[{ is_active: false }]]);
    expect(argsOf(query, "eq")).toEqual([["id", SALON_A]]);
    expect(argsOf(query, "select")).toEqual([["id"]]);
  });

  it("fails when no salón matches, so a missing salón is never reported as updated", async () => {
    clients.admin = createFakeSupabase({
      tables: { salons: { data: null, error: null } },
    });

    await expect(setSalonActiveStatus(SALON_A, true)).rejects.toThrow("Salón no encontrado.");
  });

  it("throws update errors", async () => {
    const updateError = { message: "denied" };
    clients.admin = createFakeSupabase({
      tables: { salons: { data: null, error: updateError } },
    });

    await expect(setSalonActiveStatus(SALON_A, true)).rejects.toBe(updateError);
  });
});
