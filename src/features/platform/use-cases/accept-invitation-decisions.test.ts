import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvitation as acceptInvitationWithDeps,
  type AcceptInvitationDeps,
} from "./accept-invitation";

// Decisiones de aceptacion de invitación: estado, vencimiento y correo.
// Se fija la conducta actual sin depender de Supabase real.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

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

const lookupMock = vi.mocked(deps.findInvitation);
const createUserMock = vi.mocked(deps.createOwnerAuthUser);
const profileExistsMock = vi.mocked(deps.profileExists);
const acceptSalonMock = vi.mocked(deps.acceptSalonAsAdmin);
const autoAssignMock = vi.mocked(deps.autoAssignPlan);

const validInput = {
  token: "a".repeat(48),
  email: "Owner@Example.com",
  password: "clave-segura-123",
  salon_name: "Salón Aurora",
  full_name: "Ana Perez",
};

function invitation(overrides: Partial<{ email: string; status: string; expires_at: string }> = {}) {
  return {
    email: "owner@example.com",
    status: "pending",
    expires_at: "2099-01-01T00:00:00.000Z",
    plan_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lookupMock.mockResolvedValue(invitation() as never);
  createUserMock.mockResolvedValue({ data: { id: "user-1" } as never, error: null } as never);
  profileExistsMock.mockResolvedValue(false);
  acceptSalonMock.mockResolvedValue("salon-1" as never);
  autoAssignMock.mockResolvedValue({ ok: true, value: undefined });
});

describe("acceptInvitation validation (before any lookup)", () => {
  it("rejects an empty token without querying the invitation", async () => {
    const result = await acceptInvitation({ ...validInput, token: "" });

    expect(result).toEqual({ ok: false, error: "Token inválido" });
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects malformed emails", async () => {
    const result = await acceptInvitation({ ...validInput, email: "no-es-correo" });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("requires passwords of at least eight characters", async () => {
    const result = await acceptInvitation({ ...validInput, password: "1234567" });

    expect(result).toEqual({
      ok: false,
      error: "La contraseña debe tener al menos 8 caracteres",
    });
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("accepts a password of exactly eight characters", async () => {
    const result = await acceptInvitation({ ...validInput, password: "12345678" });

    expect(result.ok).toBe(true);
  });
});

describe("acceptInvitation invitation state decisions", () => {
  it("reports lookup failures without revealing details and captures the error", async () => {
    lookupMock.mockRejectedValueOnce(new Error("timeout"));

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "No se pudo verificar la invitación." });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("treats unknown tokens as invalid or already used", async () => {
    lookupMock.mockResolvedValueOnce(null);

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "Invitación inválida o ya utilizada." });
  });

  it("refuses invitations that are not pending, such as accepted or revoked ones", async () => {
    for (const status of ["accepted", "revoked", "expired"]) {
      lookupMock.mockResolvedValueOnce(invitation({ status }) as never);

      const result = await acceptInvitation(validInput);

      expect(result).toEqual({ ok: false, error: "Invitación inválida o ya utilizada." });
    }
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("refuses an invitation whose expiry is already in the past", async () => {
    lookupMock.mockResolvedValueOnce(invitation({ expires_at: "2000-01-01T00:00:00.000Z" }) as never);

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "La invitación expiro." });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("matches the invitation email case-insensitively", async () => {
    const result = await acceptInvitation({ ...validInput, email: "OWNER@example.COM" });

    expect(result.ok).toBe(true);
  });

  it("refuses an invitation issued to a different email", async () => {
    const result = await acceptInvitation({ ...validInput, email: "otra@example.com" });

    expect(result).toEqual({ ok: false, error: "Esta invitación fue emitida para otro correo." });
    expect(createUserMock).not.toHaveBeenCalled();
    expect(acceptSalonMock).not.toHaveBeenCalled();
  });

  it("checks the invitation email before deciding the account path", async () => {
    lookupMock.mockResolvedValueOnce(invitation({ email: "dueno@example.com" }) as never);

    const result = await acceptInvitation(validInput);

    expect(result.ok).toBe(false);
    expect(profileExistsMock).not.toHaveBeenCalled();
  });
});
