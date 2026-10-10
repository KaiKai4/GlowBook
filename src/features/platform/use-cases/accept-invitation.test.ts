import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvitation as acceptInvitationWithDeps,
  type AcceptInvitationDeps,
} from "./accept-invitation";

// Fakes tipados de las dependencias: ningún test toca Supabase ni Auth.
const deps: AcceptInvitationDeps = {
  findInvitation: vi.fn<AcceptInvitationDeps["findInvitation"]>(),
  profileExists: vi.fn<AcceptInvitationDeps["profileExists"]>(),
  acceptSalonAsAdmin: vi.fn<AcceptInvitationDeps["acceptSalonAsAdmin"]>(),
  createOwnerAuthUser: vi.fn<AcceptInvitationDeps["createOwnerAuthUser"]>(),
  deleteOwnerAuthUser: vi.fn<AcceptInvitationDeps["deleteOwnerAuthUser"]>(),
  findOwnerAuthUserByEmail: vi.fn<AcceptInvitationDeps["findOwnerAuthUserByEmail"]>(),
  updateOwnerAuthUser: vi.fn<AcceptInvitationDeps["updateOwnerAuthUser"]>(),
  autoAssignPlan: vi.fn<AcceptInvitationDeps["autoAssignPlan"]>(),
  publishAuditEvent: vi.fn<AcceptInvitationDeps["publishAuditEvent"]>(async () => []),
};

const acceptInvitation = (input: Parameters<typeof acceptInvitationWithDeps>[0]) =>
  acceptInvitationWithDeps(input, deps);

const mockedAcceptSalonInvitationAsAdmin = vi.mocked(deps.acceptSalonAsAdmin);
const mockedFindSalonInvitationForAcceptance = vi.mocked(deps.findInvitation);
const mockedProfileExists = vi.mocked(deps.profileExists);
const mockedCreatePlatformOwnerAuthUser = vi.mocked(deps.createOwnerAuthUser);
const mockedDeletePlatformOwnerAuthUser = vi.mocked(deps.deleteOwnerAuthUser);
const mockedFindPlatformOwnerAuthUserByEmail = vi.mocked(deps.findOwnerAuthUserByEmail);
const mockedUpdatePlatformOwnerAuthUser = vi.mocked(deps.updateOwnerAuthUser);
const mockedAutoAssignPlanOnAcceptance = vi.mocked(deps.autoAssignPlan);
const mockedPublishAuditEvent = vi.mocked(deps.publishAuditEvent);

const validInput = {
  token: "token-1",
  email: "owner@example.com",
  password: "password123",
  salon_name: "Glow Salón",
  full_name: "Ana Owner",
};

describe("accept platform invitation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindSalonInvitationForAcceptance.mockResolvedValue({
      email: "owner@example.com",
      status: "pending",
      expires_at: "2099-01-01T00:00:00.000Z",
      plan_id: null,
    });
    mockedAutoAssignPlanOnAcceptance.mockResolvedValue({ ok: true, value: undefined });
    mockedPublishAuditEvent.mockResolvedValue([]);
    mockedCreatePlatformOwnerAuthUser.mockResolvedValue({
      data: { id: "user-1" } as never,
      error: null,
    });
    mockedFindPlatformOwnerAuthUserByEmail.mockResolvedValue({
      data: { id: "user-1" } as never,
      error: null,
    });
    mockedUpdatePlatformOwnerAuthUser.mockResolvedValue({
      data: { id: "user-1" } as never,
      error: null,
    });
    mockedDeletePlatformOwnerAuthUser.mockResolvedValue({ data: undefined, error: null });
    mockedProfileExists.mockResolvedValue(false);
    mockedAcceptSalonInvitationAsAdmin.mockResolvedValue("salon-1");
  });

  it("creates the owner Auth user and accepts the Salón invitation", async () => {
    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedCreatePlatformOwnerAuthUser).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "password123",
      emailConfirm: true,
    });
    expect(mockedAcceptSalonInvitationAsAdmin).toHaveBeenCalledWith({
      token: "token-1",
      userId: "user-1",
      email: "owner@example.com",
      salonName: "Glow Salón",
      fullName: "Ana Owner",
    });
  });

  it("auto-assigns the invitation plan to the new salón", async () => {
    mockedFindSalonInvitationForAcceptance.mockResolvedValue({
      email: "owner@example.com",
      status: "pending",
      expires_at: "2099-01-01T00:00:00.000Z",
      plan_id: "plan-1",
    });

    const result = await acceptInvitation(validInput);

    expect(result.ok).toBe(true);
    expect(mockedAutoAssignPlanOnAcceptance).toHaveBeenCalledWith({
      salonId: "salon-1",
      planId: "plan-1",
      acceptedByUserId: "user-1",
    });
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("salon.invitation_accepted", 
      expect.objectContaining({ action: "invitation_accepted", targetSalonId: "salon-1" })
    );
  });

  it("does not assign a plan when the invitation has none", async () => {
    const result = await acceptInvitation(validInput);

    expect(result.ok).toBe(true);
    expect(mockedAutoAssignPlanOnAcceptance).not.toHaveBeenCalled();
  });

  it("rolls back a newly created owner Auth user when Salón creation fails", async () => {
    mockedAcceptSalonInvitationAsAdmin.mockRejectedValue(new Error("RPC failed"));

    const result = await acceptInvitation(validInput);

    expect(result.ok).toBe(false);
    expect(mockedDeletePlatformOwnerAuthUser).toHaveBeenCalledWith("user-1");
  });

  it("reuses an existing Auth user only when it does not already have a profile", async () => {
    mockedCreatePlatformOwnerAuthUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" } as never,
    });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedFindPlatformOwnerAuthUserByEmail).toHaveBeenCalledWith("owner@example.com");
    expect(mockedProfileExists).toHaveBeenCalledWith("user-1");
    expect(mockedUpdatePlatformOwnerAuthUser).toHaveBeenCalledWith("user-1", {
      password: "password123",
      emailConfirm: true,
    });
    expect(mockedDeletePlatformOwnerAuthUser).not.toHaveBeenCalled();
  });
});
