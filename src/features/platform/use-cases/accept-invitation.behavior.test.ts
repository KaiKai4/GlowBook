import { AuthApiError, type User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptSalonInvitationAsAdmin,
  findSalonInvitationForAcceptance,
  profileExists,
} from "@/features/platform/data/invitations.repo";
import {
  createPlatformOwnerAuthUser,
  deletePlatformOwnerAuthUser,
  findPlatformOwnerAuthUserByEmail,
  updatePlatformOwnerAuthUser,
} from "@/features/platform/data/platform-auth.repo";
import { autoAssignPlanOnAcceptance } from "@/features/billing/use-cases/salon-subscriptions";
import { captureError } from "@/infra/observability";
import { acceptInvitation, type AcceptInvitationInput } from "./accept-invitation";
import { publishAuditEvent } from "@/features/audit";

// Conducta de aceptacion de invitacion: cada rama de validacion, de cuenta
// existente y de rollback debe dejar la base consistente. Se afirma el mensaje
// de dominio que ve el invitado, nunca el texto crudo de la base.

vi.mock("@/features/platform/data/invitations.repo", () => ({
  acceptSalonInvitationAsAdmin: vi.fn(),
  findSalonInvitationForAcceptance: vi.fn(),
  profileExists: vi.fn(),
}));

vi.mock("@/features/platform/data/platform-auth.repo", () => ({
  createPlatformOwnerAuthUser: vi.fn(),
  deletePlatformOwnerAuthUser: vi.fn(),
  findPlatformOwnerAuthUserByEmail: vi.fn(),
  updatePlatformOwnerAuthUser: vi.fn(),
}));

vi.mock("@/features/billing/use-cases/salon-subscriptions", () => ({
  autoAssignPlanOnAcceptance: vi.fn(),
}));

vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedFindInvitation = vi.mocked(findSalonInvitationForAcceptance);
const mockedProfileExists = vi.mocked(profileExists);
const mockedAcceptAsAdmin = vi.mocked(acceptSalonInvitationAsAdmin);
const mockedCreateUser = vi.mocked(createPlatformOwnerAuthUser);
const mockedDeleteUser = vi.mocked(deletePlatformOwnerAuthUser);
const mockedFindUserByEmail = vi.mocked(findPlatformOwnerAuthUserByEmail);
const mockedUpdateUser = vi.mocked(updatePlatformOwnerAuthUser);
const mockedAutoAssign = vi.mocked(autoAssignPlanOnAcceptance);
const mockedPublishAuditEvent = vi.mocked(publishAuditEvent);
const mockedCaptureError = vi.mocked(captureError);

const PLAN_ID = "00000000-0000-4000-8000-00000000000a";
const SALON_ID = "00000000-0000-4000-8000-000000000001";
const NEW_USER_ID = "00000000-0000-4000-8000-0000000000aa";
const EXISTING_USER_ID = "00000000-0000-4000-8000-0000000000ab";
const DUPLICATE_MESSAGE =
  "Este correo ya pertenece a una cuenta de otro salon en GlowBook. " +
  "Cada cuenta puede pertenecer a un solo salon: usa un correo distinto para crear el nuevo salon.";
const GENERIC_CREATE_ERROR = "No se pudo crear la cuenta. Intentalo de nuevo en unos momentos.";

const validInput: AcceptInvitationInput = {
  token: "token-1",
  email: "owner@example.com",
  password: "password123",
  salon_name: "Glow Salon",
  full_name: "Ana Owner",
};

function authUser(id: string): User {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    email: validInput.email,
  };
}

function pendingInvitation(overrides: Partial<{ email: string; status: string; expires_at: string; plan_id: string | null }> = {}) {
  return {
    email: "owner@example.com",
    status: "pending",
    expires_at: "2099-01-01T00:00:00.000Z",
    plan_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedFindInvitation.mockResolvedValue(pendingInvitation());
  mockedCreateUser.mockResolvedValue({ data: authUser(NEW_USER_ID), error: null });
  mockedDeleteUser.mockResolvedValue({ data: undefined, error: null });
  mockedAcceptAsAdmin.mockResolvedValue(SALON_ID);
  mockedAutoAssign.mockResolvedValue({ ok: true, value: undefined });
  mockedPublishAuditEvent.mockResolvedValue([]);
});

describe("accept invitation input validation", () => {
  it("rejects passwords shorter than 8 characters before any lookup", async () => {
    const result = await acceptInvitation({ ...validInput, password: "1234567" });

    expect(result).toEqual({
      ok: false,
      error: "La contrasena debe tener al menos 8 caracteres",
    });
    expect(mockedFindInvitation).not.toHaveBeenCalled();
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("rejects a blank salon name", async () => {
    const result = await acceptInvitation({ ...validInput, salon_name: "" });

    expect(result).toEqual({ ok: false, error: "El nombre del salon es obligatorio" });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("rejects a salon name longer than 120 characters", async () => {
    const result = await acceptInvitation({ ...validInput, salon_name: "x".repeat(121) });

    expect(result.ok).toBe(false);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const result = await acceptInvitation({ ...validInput, email: "no-es-correo" });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
    expect(mockedFindInvitation).not.toHaveBeenCalled();
  });
});

describe("accept invitation token state", () => {
  it("reports a lookup failure without creating any account", async () => {
    const lookupError = new Error("connection reset");
    mockedFindInvitation.mockRejectedValue(lookupError);

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "No se pudo verificar la invitacion." });
    expect(mockedCaptureError).toHaveBeenCalledWith(lookupError, {
      module: "platform",
      action: "accept_invitation_lookup",
      metadata: { emailDomain: "example.com" },
    });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("rejects unknown tokens and invitations that were already used", async () => {
    mockedFindInvitation.mockResolvedValue(null);
    expect(await acceptInvitation(validInput)).toEqual({
      ok: false,
      error: "Invitacion inválida o ya utilizada.",
    });

    mockedFindInvitation.mockResolvedValue(pendingInvitation({ status: "accepted" }));
    expect(await acceptInvitation(validInput)).toEqual({
      ok: false,
      error: "Invitacion inválida o ya utilizada.",
    });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("rejects expired invitations", async () => {
    mockedFindInvitation.mockResolvedValue(pendingInvitation({ expires_at: "2000-01-01T00:00:00.000Z" }));

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "La invitacion expiro." });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("matches the invited email regardless of letter case", async () => {
    const result = await acceptInvitation({ ...validInput, email: "OWNER@Example.com" });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("rejects an invitation accepted with a different email", async () => {
    const result = await acceptInvitation({ ...validInput, email: "otra@example.com" });

    expect(result).toEqual({
      ok: false,
      error: "Esta invitacion fue emitida para otro correo.",
    });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });
});

describe("accept invitation new owner account", () => {
  it("creates the owner with a confirmed email and the given password", async () => {
    await acceptInvitation(validInput);

    expect(mockedCreateUser).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "password123",
      emailConfirm: true,
    });
  });

  it("returns a generic error when account creation fails for a reason other than an existing account", async () => {
    mockedCreateUser.mockResolvedValue({
      data: null,
      error: new AuthApiError("Database unavailable", 500, "unexpected_failure"),
    });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: GENERIC_CREATE_ERROR });
    expect(mockedAcceptAsAdmin).not.toHaveBeenCalled();
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
  });

  it("treats an empty creation response without error as a failed creation", async () => {
    mockedCreateUser.mockResolvedValue({ data: null, error: null });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: GENERIC_CREATE_ERROR });
    expect(mockedAcceptAsAdmin).not.toHaveBeenCalled();
  });

  it("records the invitation as accepted with the new owner, salon and plan context", async () => {
    mockedFindInvitation.mockResolvedValue(pendingInvitation({ plan_id: PLAN_ID }));

    await acceptInvitation(validInput);

    expect(mockedAcceptAsAdmin).toHaveBeenCalledWith({
      token: "token-1",
      userId: NEW_USER_ID,
      email: "owner@example.com",
      salonName: "Glow Salon",
      fullName: "Ana Owner",
    });
    expect(mockedPublishAuditEvent).toHaveBeenCalledWith("salon.invitation_accepted", {
      actorUserId: NEW_USER_ID,
      action: "invitation_accepted",
      status: "succeeded",
      targetSalonId: SALON_ID,
      targetResourceType: "salon_invitation",
      metadata: { emailDomain: "example.com", planId: PLAN_ID },
    });
  });

  it("records a null plan in the audit metadata when the invitation carries none", async () => {
    await acceptInvitation(validInput);

    expect(mockedPublishAuditEvent).toHaveBeenCalledWith(
      "salon.invitation_accepted",
      expect.objectContaining({ metadata: { emailDomain: "example.com", planId: null } })
    );
    expect(mockedAutoAssign).not.toHaveBeenCalled();
  });
});

describe("accept invitation rollback of a new owner", () => {
  it("deletes the freshly created owner when the salon cannot be created", async () => {
    mockedAcceptAsAdmin.mockRejectedValue(new Error("salon insert failed"));

    await acceptInvitation(validInput);

    expect(mockedDeleteUser).toHaveBeenCalledWith(NEW_USER_ID);
  });

  it("ignores a 404 when the rollback target is already gone", async () => {
    mockedAcceptAsAdmin.mockRejectedValue(new Error("salon insert failed"));
    mockedDeleteUser.mockResolvedValue({
      data: null,
      error: new AuthApiError("User not found", 404, "user_not_found"),
    });

    const result = await acceptInvitation(validInput);

    expect(result.ok).toBe(false);
    expect(mockedCaptureError).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "accept_invitation_rollback" }));
  });

  it("reports a rollback failure but still returns the original business error", async () => {
    const acceptError = new Error("salon insert failed");
    const rollbackError = new AuthApiError("locked", 423, "locked");
    mockedAcceptAsAdmin.mockRejectedValue(acceptError);
    mockedDeleteUser.mockResolvedValue({ data: null, error: rollbackError });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({
      ok: false,
      error: "No se pudo crear el salon. Intentalo de nuevo o solicita una nueva invitacion.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(rollbackError, {
      module: "platform",
      action: "accept_invitation_rollback",
      metadata: { userId: NEW_USER_ID },
    });
  });

  it("maps duplicate-key database failures to the account-already-used message", async () => {
    mockedAcceptAsAdmin.mockRejectedValue(new Error("duplicate key value violates unique constraint profiles_pkey"));

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: DUPLICATE_MESSAGE });
    expect(mockedDeleteUser).toHaveBeenCalledWith(NEW_USER_ID);
  });

  it("passes through invitation-specific RPC messages so the invitee sees why it failed", async () => {
    mockedAcceptAsAdmin.mockRejectedValue(new Error("La invitacion expiro al momento de crear el salon."));

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({
      ok: false,
      error: "La invitacion expiro al momento de crear el salon.",
    });
  });

  it("hides unrecognised database messages behind a generic retry message", async () => {
    mockedAcceptAsAdmin.mockRejectedValue(new Error("relation salons does not exist"));

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({
      ok: false,
      error: "No se pudo crear el salon. Intentalo de nuevo o solicita una nueva invitacion.",
    });
  });

  it("falls back to a generic message when the RPC failure is not an Error instance", async () => {
    mockedAcceptAsAdmin.mockRejectedValue("plain failure");

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({
      ok: false,
      error: "No se pudo crear el salon. Intentalo de nuevo o solicita una nueva invitacion.",
    });
  });
});

describe("accept invitation with an existing account", () => {
  beforeEach(() => {
    mockedCreateUser.mockResolvedValue({
      data: null,
      error: new AuthApiError("User already registered", 422, "user_exists"),
    });
    mockedFindUserByEmail.mockResolvedValue({ data: authUser(EXISTING_USER_ID), error: null });
    mockedProfileExists.mockResolvedValue(false);
    mockedUpdateUser.mockResolvedValue({ data: authUser(EXISTING_USER_ID), error: null });
  });

  it("looks the existing account up by email when creation reports it already exists", async () => {
    await acceptInvitation(validInput);

    expect(mockedFindUserByEmail).toHaveBeenCalledWith("owner@example.com");
  });

  it("reports a lookup failure for the existing account", async () => {
    mockedFindUserByEmail.mockResolvedValue({
      data: null,
      error: new AuthApiError("denied", 403, "forbidden"),
    });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: GENERIC_CREATE_ERROR });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("reports a failure when checking whether the existing account already has a salon", async () => {
    const profileError = new Error("profiles unavailable");
    mockedProfileExists.mockRejectedValue(profileError);

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "No se pudo verificar la cuenta existente." });
    expect(mockedCaptureError).toHaveBeenCalledWith(profileError, {
      module: "platform",
      action: "accept_invitation_existing_profile",
      metadata: { emailDomain: "example.com" },
    });
    expect(mockedAcceptAsAdmin).not.toHaveBeenCalled();
  });

  it("refuses an account that already owns a salon", async () => {
    mockedProfileExists.mockResolvedValue(true);

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: DUPLICATE_MESSAGE });
    expect(mockedUpdateUser).not.toHaveBeenCalled();
    expect(mockedAcceptAsAdmin).not.toHaveBeenCalled();
  });

  it("sets the new password on the orphan account and accepts the invitation with it", async () => {
    const result = await acceptInvitation(validInput);

    expect(mockedUpdateUser).toHaveBeenCalledWith(EXISTING_USER_ID, {
      password: "password123",
      emailConfirm: true,
    });
    expect(mockedAcceptAsAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ userId: EXISTING_USER_ID })
    );
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("reports a password update failure without accepting the invitation", async () => {
    mockedUpdateUser.mockResolvedValue({
      data: null,
      error: new AuthApiError("weak", 422, "weak_password"),
    });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({
      ok: false,
      error: "No se pudo actualizar la cuenta. Intentalo de nuevo en unos momentos.",
    });
    expect(mockedAcceptAsAdmin).not.toHaveBeenCalled();
  });

  it("never deletes a pre-existing account when accepting fails", async () => {
    mockedAcceptAsAdmin.mockRejectedValue(new Error("salon insert failed"));

    await acceptInvitation(validInput);

    expect(mockedDeleteUser).not.toHaveBeenCalled();
  });

  it("matches the already-exists signal case-insensitively", async () => {
    mockedCreateUser.mockResolvedValue({
      data: null,
      error: new AuthApiError("User ALREADY exists", 422, "user_exists"),
    });

    await acceptInvitation(validInput);

    expect(mockedFindUserByEmail).toHaveBeenCalled();
  });

  it("treats a missing creation result without error message as a generic failure", async () => {
    mockedCreateUser.mockResolvedValue({ data: null, error: null });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: GENERIC_CREATE_ERROR });
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
  });
});

describe("accept invitation plan assignment", () => {
  it("assigns the invitation plan to the new salon as the accepting user", async () => {
    mockedFindInvitation.mockResolvedValue(pendingInvitation({ plan_id: PLAN_ID }));

    await acceptInvitation(validInput);

    expect(mockedAutoAssign).toHaveBeenCalledWith({
      salonId: SALON_ID,
      planId: PLAN_ID,
      acceptedByUserId: NEW_USER_ID,
    });
  });

  it("keeps the onboarding successful when the plan assignment fails, and reports it", async () => {
    mockedFindInvitation.mockResolvedValue(pendingInvitation({ plan_id: PLAN_ID }));
    mockedAutoAssign.mockResolvedValue({ ok: false, error: "Plan inactivo." });

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedDeleteUser).not.toHaveBeenCalled();
    expect(mockedCaptureError).toHaveBeenCalledWith(new Error("Plan inactivo."), {
      module: "platform",
      action: "accept_invitation_assign_plan",
      metadata: { salonId: SALON_ID, planId: PLAN_ID },
    });
  });
});
