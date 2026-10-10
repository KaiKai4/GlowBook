import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRole } from "../data/roles.repo";
import {
  createRoleWithPermissionsRpc,
  replaceRolePermissionsRpc,
} from "../data/rpc/role-permissions-rpc";
import { createRoleWithPermissions } from "./create-role";
import { deleteSalonRole } from "./delete-role";
import { updateRolePermissions } from "./update-role-permissions";

vi.mock("../data/roles.repo", () => ({
  deleteRole: vi.fn(),
}));

vi.mock("../data/rpc/role-permissions-rpc", () => ({
  createRoleWithPermissionsRpc: vi.fn(),
  replaceRolePermissionsRpc: vi.fn(),
}));

const mockedDeleteRole = vi.mocked(deleteRole);
const mockedCreateRpc = vi.mocked(createRoleWithPermissionsRpc);
const mockedReplaceRpc = vi.mocked(replaceRolePermissionsRpc);

describe("role use-cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("crea el rol con sus permisos en UNA sola llamada RPC, sin claves duplicadas", async () => {
    mockedCreateRpc.mockResolvedValue("role-1");

    const result = await createRoleWithPermissions({
      name: "Estilista",
      permission_keys: ["appointments.view", "appointments.view", "customers.manage"],
    });

    expect(result).toEqual({ ok: true, value: "role-1" });
    expect(mockedCreateRpc).toHaveBeenCalledTimes(1);
    expect(mockedCreateRpc).toHaveBeenCalledWith("Estilista", [
      "appointments.view",
      "customers.manage",
    ]);
  });

  it("rejects unknown permissions before calling the RPC", async () => {
    const result = await updateRolePermissions({
      role_id: "00000000-0000-0000-0000-000000000001",
      permission_keys: ["not.real"],
    });

    expect(result).toEqual({
      ok: false,
      error: "Uno o más permisos no son válidos.",
    });
    expect(mockedReplaceRpc).not.toHaveBeenCalled();
  });

  it("maps duplicate role names to a business message", async () => {
    mockedCreateRpc.mockRejectedValue({ code: "23505", message: "duplicate key" });

    const result = await createRoleWithPermissions({
      name: "Estilista",
      permission_keys: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "Ya existe un rol con ese nombre.",
    });
  });

  it("actualiza los permisos con UNA sola llamada RPC", async () => {
    mockedReplaceRpc.mockResolvedValue(undefined);

    const result = await updateRolePermissions({
      role_id: "00000000-0000-4000-8000-000000000001",
      permission_keys: ["reports.view"],
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedReplaceRpc).toHaveBeenCalledTimes(1);
    expect(mockedReplaceRpc).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", [
      "reports.view",
    ]);
  });

  it("deletes roles through the roles adapter", async () => {
    mockedDeleteRole.mockResolvedValue(undefined);

    await expect(deleteSalonRole("salon-1", "role-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(mockedDeleteRole).toHaveBeenCalledWith("role-1", "salon-1");
  });
});
