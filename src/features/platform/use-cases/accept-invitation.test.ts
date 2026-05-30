import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptSalonInvitationAsAdmin,
  findSalonInvitationForAcceptance,
  profileExists,
} from "../data/invitations.repo";
import {
  createPlatformOwnerAuthUser,
  deletePlatformOwnerAuthUser,
  findPlatformOwnerAuthUserByEmail,
  updatePlatformOwnerAuthUser,
} from "../data/platform-auth.repo";
import { acceptInvitation } from "./accept-invitation";

vi.mock("../data/invitations.repo", () => ({
  acceptSalonInvitationAsAdmin: vi.fn(),
  findSalonInvitationForAcceptance: vi.fn(),
  profileExists: vi.fn(),
}));

vi.mock("../data/platform-auth.repo", () => ({
  createPlatformOwnerAuthUser: vi.fn(),
  deletePlatformOwnerAuthUser: vi.fn(),
  findPlatformOwnerAuthUserByEmail: vi.fn(),
  updatePlatformOwnerAuthUser: vi.fn(),
}));

const mockedAcceptSalonInvitationAsAdmin = vi.mocked(acceptSalonInvitationAsAdmin);
const mockedFindSalonInvitationForAcceptance = vi.mocked(findSalonInvitationForAcceptance);
const mockedProfileExists = vi.mocked(profileExists);
const mockedCreatePlatformOwnerAuthUser = vi.mocked(createPlatformOwnerAuthUser);
const mockedDeletePlatformOwnerAuthUser = vi.mocked(deletePlatformOwnerAuthUser);
const mockedFindPlatformOwnerAuthUserByEmail = vi.mocked(findPlatformOwnerAuthUserByEmail);
const mockedUpdatePlatformOwnerAuthUser = vi.mocked(updatePlatformOwnerAuthUser);

const validInput = {
  token: "token-1",
  email: "owner@example.com",
  password: "password123",
  salon_name: "Glow Salon",
  full_name: "Ana Owner",
};

describe("accept platform invitation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindSalonInvitationForAcceptance.mockResolvedValue({
      email: "owner@example.com",
      status: "pending",
      expires_at: "2099-01-01T00:00:00.000Z",
    });
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
    mockedAcceptSalonInvitationAsAdmin.mockResolvedValue(undefined);
  });

  it("creates the owner Auth user and accepts the Salon invitation", async () => {
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
      salonName: "Glow Salon",
      fullName: "Ana Owner",
    });
  });

  it("rolls back a newly created owner Auth user when Salon creation fails", async () => {
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
