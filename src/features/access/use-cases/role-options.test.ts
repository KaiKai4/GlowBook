import { describe, expect, it, vi } from "vitest";
import { findRolesWithPermissions } from "../data/roles.repo";
import { getAssignableRoleOptions } from "./role-options";

vi.mock("../data/roles.repo", () => ({
  findRolesWithPermissions: vi.fn(),
}));

const mockedFindRolesWithPermissions = vi.mocked(findRolesWithPermissions);

describe("role options", () => {
  it("exposes only assignable roles", async () => {
    mockedFindRolesWithPermissions.mockResolvedValue([
      {
        id: "role-1",
        salon_id: "salon-1",
        name: "Recepcion",
        is_system: false,
        role_permissions: [],
      },
      {
        id: "role-system",
        salon_id: "salon-1",
        name: "Owner",
        is_system: true,
        role_permissions: [],
      },
    ]);

    await expect(getAssignableRoleOptions("salon-1")).resolves.toEqual([
      { id: "role-1", name: "Recepcion" },
    ]);
  });
});
