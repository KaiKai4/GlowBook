import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAssignableEmployeeRole, insertEmployeeProfile, linkEmployeeProfile } from "../data/employee-access.repo";
import { findEmployeeInvitationForJoin, markEmployeeInvitationAccepted } from "../data/employee-invitations.repo";
import {
  createEmployeeAuthUser,
  deleteEmployeeAuthUser,
} from "../data/employee-auth.repo";
import { acceptEmployeeInvitation } from "./employee-invitations";

vi.mock("../data/employee-access.repo", () => ({
  findAssignableEmployeeRole: vi.fn(),
  insertEmployeeProfile: vi.fn(),
  linkEmployeeProfile: vi.fn(),
}));

vi.mock("../data/employee-invitations.repo", () => ({
  findEmployeeInvitationForJoin: vi.fn(),
  markEmployeeInvitationAccepted: vi.fn(),
}));

vi.mock("../data/employee-auth.repo", () => ({
  createEmployeeAuthUser: vi.fn(),
  deleteEmployeeAuthUser: vi.fn(),
}));

const mockedFindAssignableEmployeeRole = vi.mocked(findAssignableEmployeeRole);
const mockedFindEmployeeInvitationForJoin = vi.mocked(findEmployeeInvitationForJoin);
const mockedInsertEmployeeProfile = vi.mocked(insertEmployeeProfile);
const mockedLinkEmployeeProfile = vi.mocked(linkEmployeeProfile);
const mockedMarkEmployeeInvitationAccepted = vi.mocked(markEmployeeInvitationAccepted);
const mockedCreateEmployeeAuthUser = vi.mocked(createEmployeeAuthUser);
const mockedDeleteEmployeeAuthUser = vi.mocked(deleteEmployeeAuthUser);

function pendingInvitation() {
  return {
    id: "invitation-1",
    employee_id: "employee-1",
    salon_id: "salon-1",
    email: "staff@example.com",
    role_id: "role-1",
    expires_at: "2099-01-01T00:00:00.000Z",
    accepted_at: null,
    employees: { first_name: "Ana", last_name: "Staff" },
    salons: { name: "Glow Salon" },
  };
}

describe("employee invitations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployeeInvitationForJoin.mockResolvedValue({
      data: pendingInvitation(),
      error: null,
    });
    mockedFindAssignableEmployeeRole.mockResolvedValue({
      data: { id: "role-1" },
      error: null,
    });
    mockedCreateEmployeeAuthUser.mockResolvedValue({
      data: { id: "user-1" } as never,
      error: null,
    });
    mockedInsertEmployeeProfile.mockResolvedValue({ error: null });
    mockedLinkEmployeeProfile.mockResolvedValue({ error: null });
    mockedMarkEmployeeInvitationAccepted.mockResolvedValue({ error: null });
    mockedDeleteEmployeeAuthUser.mockResolvedValue({ data: undefined, error: null });
  });

  it("creates the Auth user, links the collaborator profile and marks the invitation accepted", async () => {
    const result = await acceptEmployeeInvitation({
      token: "token-1",
      password: "password123",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedCreateEmployeeAuthUser).toHaveBeenCalledWith({
      email: "staff@example.com",
      password: "password123",
      emailConfirm: true,
    });
    expect(mockedInsertEmployeeProfile).toHaveBeenCalledWith({
      id: "user-1",
      salon_id: "salon-1",
      full_name: "Ana Staff",
      is_owner: false,
      role_id: "role-1",
    });
    expect(mockedLinkEmployeeProfile).toHaveBeenCalledWith("employee-1", "salon-1", "user-1");
    expect(mockedMarkEmployeeInvitationAccepted).toHaveBeenCalledWith("invitation-1");
  });

  it("rolls back the Auth user when profile creation fails", async () => {
    mockedInsertEmployeeProfile.mockResolvedValue({ error: { message: "profile failed" } });

    const result = await acceptEmployeeInvitation({
      token: "token-1",
      password: "password123",
    });

    expect(result.ok).toBe(false);
    expect(mockedDeleteEmployeeAuthUser).toHaveBeenCalledWith("user-1");
  });

  it("returns a specific message when the Auth account already exists", async () => {
    mockedCreateEmployeeAuthUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" } as never,
    });

    const result = await acceptEmployeeInvitation({
      token: "token-1",
      password: "password123",
    });

    expect(result).toEqual({
      ok: false,
      error: "Este email ya tiene una cuenta registrada. Contacta al administrador.",
    });
    expect(mockedInsertEmployeeProfile).not.toHaveBeenCalled();
  });
});
