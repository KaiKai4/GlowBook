import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeEmployeeRole } from "./employee-role";
import {
  findAssignableEmployeeRole,
  updateEmployeeProfileRole,
} from "../data/employee-access.repo";

vi.mock("../data/employee-access.repo", () => ({
  findAssignableEmployeeRole: vi.fn(),
  updateEmployeeProfileRole: vi.fn(),
}));

const mockedFindAssignableEmployeeRole = vi.mocked(findAssignableEmployeeRole);
const mockedUpdateEmployeeProfileRole = vi.mocked(updateEmployeeProfileRole);

describe("employee role", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindAssignableEmployeeRole.mockResolvedValue({ data: { id: "role-1" }, error: null });
    mockedUpdateEmployeeProfileRole.mockResolvedValue({ error: null });
  });

  it("rejects role assignment when the role does not belong to the salon", async () => {
    mockedFindAssignableEmployeeRole.mockResolvedValue({ data: null, error: null });

    const result = await changeEmployeeRole("salon-1", "profile-1", "foreign-role");

    expect(result.ok).toBe(false);
    expect(mockedUpdateEmployeeProfileRole).not.toHaveBeenCalled();
  });

  it("changes role only after validating that the role belongs to the salon", async () => {
    const result = await changeEmployeeRole("salon-1", "profile-1", "role-1");

    expect(result.ok).toBe(true);
    expect(mockedFindAssignableEmployeeRole).toHaveBeenCalledWith("salon-1", "role-1");
    expect(mockedUpdateEmployeeProfileRole).toHaveBeenCalledWith("profile-1", "salon-1", "role-1");
  });
});
