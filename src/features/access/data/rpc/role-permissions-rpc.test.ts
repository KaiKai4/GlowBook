import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoleWithPermissionsRpc, replaceRolePermissionsRpc } from "./role-permissions-rpc";

// Adaptadores finos de las RPC de roles: una sola llamada por operacion y la respuesta validada.

vi.mock("server-only", () => ({}));

const rpc = vi.fn();

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

const ROLE_ID = "00000000-0000-4000-8000-0000000000a1";

beforeEach(() => {
  rpc.mockReset();
});

describe("createRoleWithPermissionsRpc", () => {
  it("llama una sola vez a create_role_with_permissions con nombre y claves", async () => {
    rpc.mockResolvedValue({ data: ROLE_ID, error: null });

    await expect(createRoleWithPermissionsRpc("Caja", ["reports.view"])).resolves.toBe(ROLE_ID);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("create_role_with_permissions", {
      p_name: "Caja",
      p_permission_keys: ["reports.view"],
    });
  });

  it("propaga el error de PostgREST tal cual", async () => {
    const error = { code: "42501", message: "sin permiso" };
    rpc.mockResolvedValue({ data: null, error });

    await expect(createRoleWithPermissionsRpc("Caja", [])).rejects.toBe(error);
  });

  it("rechaza una respuesta que no es un uuid", async () => {
    rpc.mockResolvedValue({ data: "no-es-uuid", error: null });

    await expect(createRoleWithPermissionsRpc("Caja", [])).rejects.toThrow(
      "Respuesta inesperada de la RPC create_role_with_permissions."
    );
  });
});

describe("replaceRolePermissionsRpc", () => {
  it("llama una sola vez a replace_role_permissions con id del rol y claves", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(replaceRolePermissionsRpc(ROLE_ID, [])).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("replace_role_permissions", {
      p_role_id: ROLE_ID,
      p_permission_keys: [],
    });
  });

  it("propaga el error de PostgREST tal cual", async () => {
    const error = { code: "P0002", message: "Rol no encontrado." };
    rpc.mockResolvedValue({ data: null, error });

    await expect(replaceRolePermissionsRpc(ROLE_ID, ["reports.view"])).rejects.toBe(error);
  });
});
