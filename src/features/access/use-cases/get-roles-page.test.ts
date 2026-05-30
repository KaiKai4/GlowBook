import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAllPermissions, findRolesWithPermissions } from "../data/roles.repo";
import { getRolesPage } from "./get-roles-page";

vi.mock("../data/roles.repo", () => ({
  findAllPermissions: vi.fn(),
  findRolesWithPermissions: vi.fn(),
}));

const mockedFindAllPermissions = vi.mocked(findAllPermissions);
const mockedFindRolesWithPermissions = vi.mocked(findRolesWithPermissions);

describe("get roles page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps role permission rows into permission keys", async () => {
    mockedFindRolesWithPermissions.mockResolvedValue([
      {
        id: "role-1",
        salon_id: "salon-1",
        name: "Recepcion",
        is_system: false,
        role_permissions: [
          { permission: { id: "permission-1", key: "appointments.manage", description: "" } },
          { permission: null },
        ],
      },
    ]);
    mockedFindAllPermissions.mockResolvedValue([
      { id: "permission-1", key: "appointments.manage", description: "Gestionar citas" },
    ] as never);

    await expect(getRolesPage("salon-1")).resolves.toEqual({
      roles: [
        {
          id: "role-1",
          name: "Recepcion",
          is_system: false,
          permissionKeys: ["appointments.manage"],
        },
      ],
      allPermissions: [
        { id: "permission-1", key: "appointments.manage", description: "Gestionar citas" },
      ],
    });
  });
});
