import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSalonInvitation } from "@/features/platform/data/invitations.repo";
import { isPlatformAdmin } from "@/lib/auth/session";
import { inviteSalon } from "./invite-salon";
import { recordPlatformAction } from "./platform-audit";

vi.mock("@/features/platform/data/invitations.repo", () => ({
  createSalonInvitation: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  isPlatformAdmin: vi.fn(),
}));

vi.mock("./platform-audit", () => ({
  recordPlatformAction: vi.fn(),
}));

const mockedCreateSalonInvitation = vi.mocked(createSalonInvitation);
const mockedIsPlatformAdmin = vi.mocked(isPlatformAdmin);
const mockedRecordPlatformAction = vi.mocked(recordPlatformAction);

const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("invite salon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIsPlatformAdmin.mockResolvedValue(true);
    mockedCreateSalonInvitation.mockResolvedValue("invite-token");
  });

  it("rejects non-platform admins before creating the invitation", async () => {
    mockedIsPlatformAdmin.mockResolvedValue(false);

    const result = await inviteSalon({ email: "owner@example.com" });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
  });

  it("uses typed input and creates the platform invitation", async () => {
    const result = await inviteSalon({ email: "owner@example.com", actorUserId });

    expect(result).toEqual({ ok: true, value: "invite-token" });
    expect(mockedCreateSalonInvitation).toHaveBeenCalledWith("owner@example.com");
    expect(mockedRecordPlatformAction).toHaveBeenCalledWith({
      actorUserId,
      action: "invite_salon",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain: "example.com" },
    });
  });

  it("rejects invalid emails without calling the data adapter", async () => {
    const result = await inviteSalon({ email: "not-an-email" });

    expect(result.ok).toBe(false);
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
    expect(mockedRecordPlatformAction).not.toHaveBeenCalled();
  });

  it("records failed invitation attempts after adapter errors", async () => {
    mockedCreateSalonInvitation.mockRejectedValue(new Error("rpc down"));

    const result = await inviteSalon({ email: "owner@example.com", actorUserId });

    expect(result).toEqual({ ok: false, error: "Error al crear la invitacion." });
    expect(mockedRecordPlatformAction).toHaveBeenCalledWith({
      actorUserId,
      action: "invite_salon",
      status: "failed",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain: "example.com" },
      errorMessage: "rpc down",
    });
  });
});
