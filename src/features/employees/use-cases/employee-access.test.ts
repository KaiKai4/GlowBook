import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeEmployeeRole,
  replacePendingEmployeeInvitation,
  resetEmployeeAccess,
} from "./employee-access";
import { findEmployeeById } from "../data/employees.repo";
import {
  deletePendingEmployeeInvitations,
  findAssignableEmployeeRole,
  findEmployeeAccessProfile,
  insertEmployeeInvitation,
  unlinkEmployeeProfile,
  updateEmployeeProfileRole,
} from "../data/employee-access.repo";
import { deleteEmployeeAuthUser } from "../data/employee-auth.repo";

vi.mock("../data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
}));

vi.mock("../data/employee-access.repo", () => ({
  deleteEmployeeInvitations: vi.fn(async () => ({ error: null })),
  deletePendingEmployeeInvitations: vi.fn(),
  findAssignableEmployeeRole: vi.fn(),
  findEmployeeAccessProfile: vi.fn(),
  insertEmployeeInvitation: vi.fn(),
  unlinkEmployeeProfile: vi.fn(),
  updateEmployeeProfileRole: vi.fn(),
}));

vi.mock("../data/employee-auth.repo", () => ({
  deleteEmployeeAuthUser: vi.fn(),
}));

const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedFindAssignableEmployeeRole = vi.mocked(findAssignableEmployeeRole);
const mockedDeletePendingEmployeeInvitations = vi.mocked(deletePendingEmployeeInvitations);
const mockedFindEmployeeAccessProfile = vi.mocked(findEmployeeAccessProfile);
const mockedInsertEmployeeInvitation = vi.mocked(insertEmployeeInvitation);
const mockedUnlinkEmployeeProfile = vi.mocked(unlinkEmployeeProfile);
const mockedUpdateEmployeeProfileRole = vi.mocked(updateEmployeeProfileRole);
const mockedDeleteEmployeeAuthUser = vi.mocked(deleteEmployeeAuthUser);

describe("employee access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindAssignableEmployeeRole.mockResolvedValue({ data: { id: "role-1" }, error: null });
    mockedDeletePendingEmployeeInvitations.mockResolvedValue({ error: null });
    mockedFindEmployeeAccessProfile.mockResolvedValue({
      data: { role_id: "role-1", is_owner: false },
      error: null,
    });
    mockedInsertEmployeeInvitation.mockResolvedValue({ error: null });
    mockedUnlinkEmployeeProfile.mockResolvedValue({ error: null });
    mockedUpdateEmployeeProfileRole.mockResolvedValue({ error: null });
    mockedDeleteEmployeeAuthUser.mockResolvedValue({ data: undefined, error: null });
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
    expect(mockedUpdateEmployeeProfileRole).toHaveBeenCalledWith(
      "profile-1",
      "salon-1",
      "role-1"
    );
  });

  it("replaces pending invitations and stores only a validated role id", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00.000Z"));

    const result = await replacePendingEmployeeInvitation({
      employeeId: "employee-1",
      salonId: "salon-1",
      email: "staff@example.com",
      roleId: "role-1",
    });

    expect(result.ok).toBe(true);
    expect(mockedDeletePendingEmployeeInvitations).toHaveBeenCalledWith("employee-1", "salon-1");
    expect(mockedInsertEmployeeInvitation).toHaveBeenCalledWith({
      employee_id: "employee-1",
      salon_id: "salon-1",
      email: "staff@example.com",
      role_id: "role-1",
      token: expect.any(String),
      expires_at: "2026-06-02T12:00:00.000Z",
    });

    vi.useRealTimers();
  });

  it("resets access by deleting the old auth user and creating a fresh invitation", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      id: "employee-1",
      salon_id: "salon-1",
      profile_id: "profile-1",
      email: "staff@example.com",
      first_name: "Ana",
      last_name: "Test",
      is_active: true,
    } as never);

    const result = await resetEmployeeAccess({
      employeeId: "employee-1",
      salonId: "salon-1",
      roleId: null,
    });

    expect(result.ok).toBe(true);
    expect(mockedDeleteEmployeeAuthUser).toHaveBeenCalledWith("profile-1");
    expect(mockedUnlinkEmployeeProfile).toHaveBeenCalledWith("employee-1", "salon-1");
    expect(mockedInsertEmployeeInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: "employee-1",
        salon_id: "salon-1",
        email: "staff@example.com",
        role_id: "role-1",
      })
    );
  });
});
