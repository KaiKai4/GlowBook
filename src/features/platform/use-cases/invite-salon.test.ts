import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSalonInvitation } from "@/features/platform/data/invitations.repo";
import { isPlatformAdmin } from "@/lib/auth/session";
import { inviteSalon } from "./invite-salon";
import { publishAuditEvent } from "@/features/audit";

vi.mock("@/features/platform/data/invitations.repo", () => ({
  createSalonInvitation: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  isPlatformAdmin: vi.fn(),
}));

vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const mockedCreateSalonInvitation = vi.mocked(createSalonInvitation);
const mockedIsPlatformAdmin = vi.mocked(isPlatformAdmin);
const mockedPublishAuditEvent = vi.mocked(publishAuditEvent);

const actorUserId = "00000000-0000-4000-8000-000000000001";
const planId = "00000000-0000-4000-8000-00000000000a";

describe("invite salon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedIsPlatformAdmin.mockResolvedValue(true);
    mockedCreateSalonInvitation.mockResolvedValue("invite-token");
  });

  it("rejects non-platform admins before creating the invitation", async () => {
    mockedIsPlatformAdmin.mockResolvedValue(false);

    const result = await inviteSalon({ email: "owner@example.com", planId });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
  });

  it("creates the invitation carrying the chosen plan", async () => {
    const result = await inviteSalon({ email: "owner@example.com", planId, actorUserId });

    expect(result).toEqual({ ok: true, value: "invite-token" });
    expect(mockedCreateSalonInvitation).toHaveBeenCalledWith("owner@example.com", planId);
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.salon_invited", {
      actorUserId,
      action: "invite_salon",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain: "example.com", planId },
    });
  });

  it("rejects invitations without a plan", async () => {
    const result = await inviteSalon({ email: "owner@example.com", planId: "" });

    expect(result.ok).toBe(false);
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
  });

  it("rejects invalid emails without calling the data adapter", async () => {
    const result = await inviteSalon({ email: "not-an-email", planId });

    expect(result.ok).toBe(false);
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
    expect(mockedPublishAuditEvent).not.toHaveBeenCalled();
  });

  it("records failed invitation attempts after adapter errors", async () => {
    mockedCreateSalonInvitation.mockRejectedValue(new Error("rpc down"));

    const result = await inviteSalon({ email: "owner@example.com", planId, actorUserId });

    expect(result).toEqual({ ok: false, error: "Error al crear la invitacion." });
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("platform.salon_invited", {
      actorUserId,
      action: "invite_salon",
      status: "failed",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain: "example.com", planId },
      errorMessage: "rpc down",
    });
  });
});
