import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignRoleToProfile,
  createRole,
  deleteRole,
  setRolePermissions,
} from "../data/roles.repo";
import { assignRole } from "./assign-role";
import { createRoleWithPermissions } from "./create-role";
import { deleteSalonRole } from "./delete-role";
import { updateRolePermissions } from "./update-role-permissions";

vi.mock("../data/roles.repo", () => ({
  assignRoleToProfile: vi.fn(),
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  setRolePermissions: vi.fn(),
}));

const mockedAssignRoleToProfile = vi.mocked(assignRoleToProfile);
const mockedCreateRole = vi.mocked(createRole);
const mockedDeleteRole = vi.mocked(deleteRole);
const mockedSetRolePermissions = vi.mocked(setRolePermissions);

describe("role use-cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a role and deduplicates valid permission keys before storing them", async () => {
    mockedCreateRole.mockResolvedValue("role-1");
    mockedSetRolePermissions.mockResolvedValue(undefined);

    const result = await createRoleWithPermissions("salon-1", {
      name: "Estilista",
      permission_keys: ["appointments.view", "appointments.view", "customers.manage"],
    });

    expect(result).toEqual({ ok: true, value: "role-1" });
    expect(mockedCreateRole).toHaveBeenCalledWith("salon-1", "Estilista");
    expect(mockedSetRolePermissions).toHaveBeenCalledWith("role-1", "salon-1", [
      "appointments.view",
      "customers.manage",
    ]);
  });

  it("rejects unknown permissions before touching Supabase", async () => {
    const result = await updateRolePermissions("salon-1", {
      role_id: "00000000-0000-0000-0000-000000000001",
      permission_keys: ["not.real"],
    });

    expect(result).toEqual({
      ok: false,
      error: "Uno o mas permisos no son validos.",
    });
    expect(mockedSetRolePermissions).not.toHaveBeenCalled();
  });

  it("maps duplicate role names to a business message", async () => {
    mockedCreateRole.mockRejectedValue({ code: "23505", message: "duplicate key" });

    const result = await createRoleWithPermissions("salon-1", {
      name: "Estilista",
      permission_keys: [],
    });

    expect(result).toEqual({
      ok: false,
      error: "Ya existe un rol con ese nombre.",
    });
  });

  it("assigns and deletes roles through the roles adapter", async () => {
    mockedAssignRoleToProfile.mockResolvedValue(undefined);
    mockedDeleteRole.mockResolvedValue(undefined);

    await expect(
      assignRole("salon-1", {
        profile_id: "00000000-0000-0000-0000-000000000002",
        role_id: "00000000-0000-0000-0000-000000000001",
      })
    ).resolves.toEqual({ ok: true, value: undefined });
    await expect(deleteSalonRole("salon-1", "role-1")).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    expect(mockedAssignRoleToProfile).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000001",
      "salon-1"
    );
    expect(mockedDeleteRole).toHaveBeenCalledWith("role-1", "salon-1");
  });
});
