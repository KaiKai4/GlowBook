import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSalonInvitation,
  regenerateSalonInvitationToken,
} from "@/features/platform/data/invitations.repo";
import { isPlatformAdmin } from "@/infra/auth/session";
import { captureError } from "@/infra/observability";
import { inviteSalon, regenerateSalonInvitation } from "./invite-salon";
import { recordPlatformAction } from "./platform-audit";
import { firstOf } from "@/test/platform-feedback-notifications-helpers";

// Conducta de invitaciones emitidas por la plataforma: solo el admin emite,
// el plan es obligatorio y todo intento (correcto o fallido) queda auditado
// con el dominio del correo, nunca con la direccion completa.

vi.mock("@/features/platform/data/invitations.repo", () => ({
  createSalonInvitation: vi.fn(),
  regenerateSalonInvitationToken: vi.fn(),
}));

vi.mock("@/infra/auth/session", () => ({
  isPlatformAdmin: vi.fn(),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("./platform-audit", () => ({
  recordPlatformAction: vi.fn(async () => []),
}));

const mockedCreate = vi.mocked(createSalonInvitation);
const mockedRegenerate = vi.mocked(regenerateSalonInvitationToken);
const mockedIsAdmin = vi.mocked(isPlatformAdmin);
const mockedAudit = vi.mocked(recordPlatformAction);
const mockedCaptureError = vi.mocked(captureError);

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-00000000000a";
const INVITATION_ID = "00000000-0000-4000-8000-0000000000bb";

beforeEach(() => {
  vi.resetAllMocks();
  mockedIsAdmin.mockResolvedValue(true);
  mockedCreate.mockResolvedValue("token-1");
  mockedRegenerate.mockResolvedValue("token-2");
  mockedAudit.mockResolvedValue([]);
});

describe("inviteSalon authorization and validation", () => {
  it("never validates or creates anything for a non-admin caller", async () => {
    mockedIsAdmin.mockResolvedValue(false);

    const result = await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("asks the platform admin check about the current session", async () => {
    await inviteSalon({ email: "owner@example.com", planId: PLAN_ID });

    expect(mockedIsAdmin).toHaveBeenCalledTimes(1);
  });

  it("requires the plan to be a UUID with a domain message", async () => {
    const result = await inviteSalon({ email: "owner@example.com", planId: "plan-libre" });

    expect(result).toEqual({
      ok: false,
      error: "Selecciona el plan que tendra el salon.",
    });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns the first validation message when the email is missing", async () => {
    const result = await inviteSalon({ email: "", planId: PLAN_ID });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
  });

  it("records the invitation with the actor but no target salon yet", async () => {
    await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID });

    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "invite_salon",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain: "example.com", planId: PLAN_ID },
    });
    expect(firstOf(mockedAudit.mock.calls)).not.toHaveProperty("targetSalonId");
  });

  it("audits with a null actor when the caller did not provide one", async () => {
    const result = await inviteSalon({ email: "owner@example.com", planId: PLAN_ID });

    expect(result).toEqual({ ok: true, value: "token-1" });
    expect(mockedAudit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: null }));
  });

  it("only exposes the domain of the invited email in the audit trail", async () => {
    await inviteSalon({ email: "ana.privada@salon-glow.com", planId: PLAN_ID, actorUserId: ACTOR_ID });

    const auditInput = firstOf(firstOf(mockedAudit.mock.calls));
    expect(JSON.stringify(auditInput)).not.toContain("ana.privada");
    expect(auditInput.metadata).toEqual({ emailDomain: "salon-glow.com", planId: PLAN_ID });
  });
});

describe("inviteSalon failures", () => {
  it("reports adapter errors with a stable message, logs them and audits the failure", async () => {
    const adapterError = new Error("rpc down");
    mockedCreate.mockRejectedValue(adapterError);

    const result = await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: false, error: "Error al crear la invitacion." });
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "invite_salon",
      metadata: { emailDomain: "example.com" },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "rpc down" })
    );
  });

  it("audits a generic error text when the adapter rejects with a non-Error value", async () => {
    mockedCreate.mockRejectedValue("oops");

    await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID });

    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "Error desconocido" })
    );
  });
});

describe("regenerateSalonInvitation", () => {
  it("rejects non-admin callers before touching the invitation", async () => {
    mockedIsAdmin.mockResolvedValue(false);

    const result = await regenerateSalonInvitation({ invitationId: INVITATION_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedRegenerate).not.toHaveBeenCalled();
  });

  it("returns the new one-time token and audits the regeneration against the invitation", async () => {
    const result = await regenerateSalonInvitation({ invitationId: INVITATION_ID, actorUserId: ACTOR_ID });

    expect(result).toEqual({ ok: true, value: "token-2" });
    expect(mockedRegenerate).toHaveBeenCalledWith(INVITATION_ID);
    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "regenerate_salon_invitation",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      targetResourceId: INVITATION_ID,
    });
  });

  it("reports a stable error, logs the invitation id and audits the failure", async () => {
    const adapterError = new Error("ya no esta pendiente");
    mockedRegenerate.mockRejectedValue(adapterError);

    const result = await regenerateSalonInvitation({ invitationId: INVITATION_ID });

    expect(result).toEqual({ ok: false, error: "No se pudo regenerar el enlace." });
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "regenerate_salon_invitation",
      metadata: { invitationId: INVITATION_ID },
    });
    expect(mockedAudit).toHaveBeenCalledWith({
      actorUserId: null,
      action: "regenerate_salon_invitation",
      status: "failed",
      targetResourceType: "salon_invitation",
      targetResourceId: INVITATION_ID,
      errorMessage: "ya no esta pendiente",
    });
  });

  it("audits a generic error text when the failure is not an Error", async () => {
    mockedRegenerate.mockRejectedValue(42);

    await regenerateSalonInvitation({ invitationId: INVITATION_ID, actorUserId: ACTOR_ID });

    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "Error desconocido" })
    );
  });
});
