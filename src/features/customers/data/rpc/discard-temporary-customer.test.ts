import { beforeEach, describe, expect, it, vi } from "vitest";
import { discardTemporaryCustomerRpc } from "./discard-temporary-customer";

// Adaptador fino de la RPC discard_temporary_customer: una llamada y el error sin tocar.

vi.mock("server-only", () => ({}));

const rpc = vi.fn();

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

beforeEach(() => {
  rpc.mockReset();
});

describe("discardTemporaryCustomerRpc", () => {
  it("llama una sola vez a discard_temporary_customer con el id del cliente", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(discardTemporaryCustomerRpc("cust-1")).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("discard_temporary_customer", { p_customer_id: "cust-1" });
  });

  it("propaga el error de PostgREST tal cual para que el caso de uso lo traduzca", async () => {
    const error = { code: "22023", message: "tiene citas activas" };
    rpc.mockResolvedValue({ data: null, error });

    await expect(discardTemporaryCustomerRpc("cust-1")).rejects.toBe(error);
  });
});
