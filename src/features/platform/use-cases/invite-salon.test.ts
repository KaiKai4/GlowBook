import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  inviteSalon as inviteSalonWithDeps,
  type InviteSalonDeps,
  type InviteSalonInput,
} from "./invite-salon";

// Fakes tipados de las dependencias: ningún test toca Supabase ni auditoría real.
const deps: InviteSalonDeps = {
  createSalonInvitation: vi.fn<InviteSalonDeps["createSalonInvitation"]>(),
  regenerateSalonInvitationToken: vi.fn<InviteSalonDeps["regenerateSalonInvitationToken"]>(),
  publishAuditEvent: vi.fn<InviteSalonDeps["publishAuditEvent"]>(async () => []),
};

const inviteSalon = (input: InviteSalonInput) => inviteSalonWithDeps(input, deps);

const mockedCreateSalonInvitation = vi.mocked(deps.createSalonInvitation);
const mockedPublishAuditEvent = vi.mocked(deps.publishAuditEvent);

const actorUserId = "00000000-0000-4000-8000-000000000001";
const planId = "00000000-0000-4000-8000-00000000000a";

let isAdmin = true;

describe("invite salón", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isAdmin = true;
    mockedCreateSalonInvitation.mockResolvedValue("invite-token");
  });

  it("rejects non-platform admins before creating the invitation", async () => {
    isAdmin = false;

    const result = await inviteSalon({ email: "owner@example.com", planId, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
  });

  it("creates the invitation carrying the chosen plan", async () => {
    const result = await inviteSalon({ email: "owner@example.com", planId, actorUserId, actorIsPlatformAdmin: isAdmin });

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
    const result = await inviteSalon({ email: "owner@example.com", planId: "", actorIsPlatformAdmin: isAdmin });

    expect(result.ok).toBe(false);
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
  });

  it("rejects invalid emails without calling the data adapter", async () => {
    const result = await inviteSalon({ email: "not-an-email", planId, actorIsPlatformAdmin: isAdmin });

    expect(result.ok).toBe(false);
    expect(mockedCreateSalonInvitation).not.toHaveBeenCalled();
    expect(mockedPublishAuditEvent).not.toHaveBeenCalled();
  });

  it("records failed invitation attempts after adapter errors", async () => {
    mockedCreateSalonInvitation.mockRejectedValue(new Error("rpc down"));

    const result = await inviteSalon({ email: "owner@example.com", planId, actorUserId, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "Error al crear la invitación." });
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
