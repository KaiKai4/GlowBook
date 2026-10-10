import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import {
  inviteSalon as inviteSalonWithDeps,
  regenerateSalonInvitation as regenerateSalonInvitationWithDeps,
  type InviteSalonDeps,
  type InviteSalonInput,
} from "./invite-salon";
import { firstOf } from "@/test/platform-feedback-notifications-helpers";

// Conducta de invitaciones emitidas por la plataforma: solo el admin emite,
// el plan es obligatorio y todo intento (correcto o fallido) queda auditado
// con el dominio del correo, nunca con la direccion completa.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

// Fakes tipados de las dependencias: ningún test toca Supabase ni auditoría real.
const deps: InviteSalonDeps = {
  createSalonInvitation: vi.fn<InviteSalonDeps["createSalonInvitation"]>(),
  regenerateSalonInvitationToken: vi.fn<InviteSalonDeps["regenerateSalonInvitationToken"]>(),
  publishAuditEvent: vi.fn<InviteSalonDeps["publishAuditEvent"]>(async () => []),
};

const inviteSalon = (input: InviteSalonInput) => inviteSalonWithDeps(input, deps);
const regenerateSalonInvitation = (
  input: Parameters<typeof regenerateSalonInvitationWithDeps>[0]
) => regenerateSalonInvitationWithDeps(input, deps);

const mockedCreate = vi.mocked(deps.createSalonInvitation);
const mockedRegenerate = vi.mocked(deps.regenerateSalonInvitationToken);
const mockedAudit = vi.mocked(deps.publishAuditEvent);
const mockedCaptureError = vi.mocked(captureError);

const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "00000000-0000-4000-8000-00000000000a";
const INVITATION_ID = "00000000-0000-4000-8000-0000000000bb";

let isAdmin = true;

beforeEach(() => {
  vi.resetAllMocks();
  isAdmin = true;
  mockedCreate.mockResolvedValue("token-1");
  mockedRegenerate.mockResolvedValue("token-2");
  mockedAudit.mockResolvedValue([]);
});

describe("inviteSalon authorization and validation", () => {
  it("never validates or creates anything for a non-admin caller", async () => {
    isAdmin = false;

    const result = await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("asks the platform admin check about the current session", async () => {
    await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorIsPlatformAdmin: isAdmin });  });

  it("requires the plan to be a UUID with a domain message", async () => {
    const result = await inviteSalon({ email: "owner@example.com", planId: "plan-libre", actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({
      ok: false,
      error: "Selecciona el plan que tendrá el salón.",
    });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns the first validation message when the email is missing", async () => {
    const result = await inviteSalon({ email: "", planId: PLAN_ID, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
  });

  it("records the invitation with the actor but no target salón yet", async () => {
    await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_invited", {
      actorUserId: ACTOR_ID,
      action: "invite_salon",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      metadata: { emailDomain: "example.com", planId: PLAN_ID },
    });
    expect(firstOf(mockedAudit.mock.calls)[1]).not.toHaveProperty("targetSalonId");
  });

  it("audits with a null actor when the caller did not provide one", async () => {
    const result = await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: true, value: "token-1" });
    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_invited", expect.objectContaining({ actorUserId: null }));
  });

  it("only exposes the domain of the invited email in the audit trail", async () => {
    await inviteSalon({ email: "ana.privada@salon-glow.com", planId: PLAN_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    const auditInput = firstOf(mockedAudit.mock.calls)[1];
    expect(JSON.stringify(auditInput)).not.toContain("ana.privada");
    expect(auditInput.metadata).toEqual({ emailDomain: "salon-glow.com", planId: PLAN_ID });
  });
});

describe("inviteSalon failures", () => {
  it("reports adapter errors with a stable message, logs them and audits the failure", async () => {
    const adapterError = new Error("rpc down");
    mockedCreate.mockRejectedValue(adapterError);

    const result = await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "Error al crear la invitación." });
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "invite_salon",
      metadata: { emailDomain: "example.com" },
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      "platform.salon_invited", expect.objectContaining({ status: "failed", errorMessage: "rpc down" })
    );
  });

  it("audits a generic error text when the adapter rejects with a non-Error value", async () => {
    mockedCreate.mockRejectedValue("oops");

    await inviteSalon({ email: "owner@example.com", planId: PLAN_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    expect(mockedAudit).toHaveBeenCalledWith(
      "platform.salon_invited", expect.objectContaining({ status: "failed", errorMessage: "Error desconocido" })
    );
  });
});

describe("regenerateSalonInvitation", () => {
  it("rejects non-admin callers before touching the invitation", async () => {
    isAdmin = false;

    const result = await regenerateSalonInvitation({ invitationId: INVITATION_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(mockedRegenerate).not.toHaveBeenCalled();
  });

  it("returns the new one-time token and audits the regeneration against the invitation", async () => {
    const result = await regenerateSalonInvitation({ invitationId: INVITATION_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: true, value: "token-2" });
    expect(mockedRegenerate).toHaveBeenCalledWith(INVITATION_ID);
    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_invitation_regenerated", {
      actorUserId: ACTOR_ID,
      action: "regenerate_salon_invitation",
      status: "succeeded",
      targetResourceType: "salon_invitation",
      targetResourceId: INVITATION_ID,
    });
  });

  it("reports a stable error, logs the invitation id and audits the failure", async () => {
    const adapterError = new Error("ya no está pendiente");
    mockedRegenerate.mockRejectedValue(adapterError);

    const result = await regenerateSalonInvitation({ invitationId: INVITATION_ID, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "No se pudo regenerar el enlace." });
    expect(mockedCaptureError).toHaveBeenCalledWith(adapterError, {
      module: "platform",
      action: "regenerate_salon_invitation",
      metadata: { invitationId: INVITATION_ID },
    });
    expect(mockedAudit).toHaveBeenCalledWith("platform.salon_invitation_regenerated", {
      actorUserId: null,
      action: "regenerate_salon_invitation",
      status: "failed",
      targetResourceType: "salon_invitation",
      targetResourceId: INVITATION_ID,
      errorMessage: "ya no está pendiente",
    });
  });

  it("audits a generic error text when the failure is not an Error", async () => {
    mockedRegenerate.mockRejectedValue(42);

    await regenerateSalonInvitation({ invitationId: INVITATION_ID, actorUserId: ACTOR_ID, actorIsPlatformAdmin: isAdmin });

    expect(mockedAudit).toHaveBeenCalledWith(
      "platform.salon_invitation_regenerated", expect.objectContaining({ errorMessage: "Error desconocido" })
    );
  });
});
