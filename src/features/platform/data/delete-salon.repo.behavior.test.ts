import { AuthApiError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSalonCompletely } from "./delete-salon.repo";
import { deleteAuthUser } from "@/infra/supabase/auth-admin";
import {
  argsOf,
  createFakeSupabase,
  queryFor,
  type FakeSupabase,
} from "@/test/platform-feedback-notifications-supabase";

// Borrado destructivo de un salon: primero se confirma que existe, luego la
// RPC borra sus datos y devuelve los usuarios afectados, y por ultimo se
// limpian sus cuentas Auth. Un 404 en Auth cuenta como ya borrado.

const clients = vi.hoisted(() => ({ admin: null as FakeSupabase | null }));

vi.mock("server-only", () => ({}));

vi.mock("@/infra/supabase/admin", () => ({
  createSupabaseAdminClient: () => clients.admin,
}));

vi.mock("@/infra/supabase/auth-admin", () => ({
  deleteAuthUser: vi.fn(),
}));

const mockedDeleteAuthUser = vi.mocked(deleteAuthUser);

const SALON_ID = "00000000-0000-4000-8000-000000000001";

function adminWithSalon(
  salon: { data: unknown; error: unknown },
  rpcResult: { data: unknown; error: unknown } = { data: [], error: null }
): FakeSupabase {
  const admin = createFakeSupabase({
    tables: { salons: salon },
    rpc: { delete_salon_completely: rpcResult },
  });
  clients.admin = admin;
  return admin;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedDeleteAuthUser.mockResolvedValue({ data: undefined, error: null });
  clients.admin = null;
});

describe("deleteSalonCompletely", () => {
  it("refuses to run the destructive RPC when the salon does not exist", async () => {
    const admin = adminWithSalon({ data: null, error: null });

    await expect(deleteSalonCompletely(SALON_ID)).rejects.toThrow("Salon no encontrado.");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
  });

  it("looks the salon up by its id before deleting", async () => {
    const admin = adminWithSalon({ data: { id: SALON_ID }, error: null });

    await deleteSalonCompletely(SALON_ID);

    const query = queryFor(admin, "salons");
    expect(argsOf(query, "select")).toEqual([["id"]]);
    expect(argsOf(query, "eq")).toEqual([["id", SALON_ID]]);
    expect(admin.rpc).toHaveBeenCalledWith("delete_salon_completely", { p_salon_id: SALON_ID });
  });

  it("propagates lookup errors without calling the RPC", async () => {
    const lookupError = { message: "denied" };
    const admin = adminWithSalon({ data: null, error: lookupError });

    await expect(deleteSalonCompletely(SALON_ID)).rejects.toBe(lookupError);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("propagates RPC errors and skips Auth cleanup", async () => {
    const rpcError = { message: "rpc failed" };
    adminWithSalon({ data: { id: SALON_ID }, error: null }, { data: null, error: rpcError });

    await expect(deleteSalonCompletely(SALON_ID)).rejects.toBe(rpcError);
    expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
  });

  it("removes the Auth account of every user the RPC reports as deleted", async () => {
    adminWithSalon(
      { data: { id: SALON_ID }, error: null },
      { data: [{ user_id: "user-1" }, { user_id: "user-2" }], error: null }
    );

    await deleteSalonCompletely(SALON_ID);

    expect(mockedDeleteAuthUser).toHaveBeenCalledTimes(2);
    expect(mockedDeleteAuthUser).toHaveBeenNthCalledWith(1, "user-1");
    expect(mockedDeleteAuthUser).toHaveBeenNthCalledWith(2, "user-2");
  });

  it("treats an Auth account that is already gone (404) as cleaned up", async () => {
    adminWithSalon(
      { data: { id: SALON_ID }, error: null },
      { data: [{ user_id: "user-1" }], error: null }
    );
    mockedDeleteAuthUser.mockResolvedValue({
      data: null,
      error: new AuthApiError("User not found", 404, "user_not_found"),
    });

    await expect(deleteSalonCompletely(SALON_ID)).resolves.toBeUndefined();
  });

  it("reports how many Auth accounts could not be removed and keeps every failure detail", async () => {
    adminWithSalon(
      { data: { id: SALON_ID }, error: null },
      { data: [{ user_id: "user-1" }, { user_id: "user-2" }, { user_id: "user-3" }], error: null }
    );
    mockedDeleteAuthUser
      .mockResolvedValueOnce({ data: null, error: new AuthApiError("boom", 500, "unexpected") })
      .mockResolvedValueOnce({ data: undefined, error: null })
      .mockResolvedValueOnce({ data: null, error: new AuthApiError("locked", 423, "locked") });

    await expect(deleteSalonCompletely(SALON_ID)).rejects.toThrow(
      "Los datos del salon fueron eliminados, pero no se pudieron borrar 2 cuenta(s) Auth: user-1: boom; user-3: locked"
    );
  });

  it("succeeds without touching Auth when the RPC reports no affected users", async () => {
    adminWithSalon({ data: { id: SALON_ID }, error: null }, { data: null, error: null });

    await expect(deleteSalonCompletely(SALON_ID)).resolves.toBeUndefined();
    expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
  });
});
