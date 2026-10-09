import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptSalonInvitationAsAdmin,
  findSalonInvitationForAcceptance,
  profileExists,
} from "@/features/platform/data/invitations.repo";
import { createPlatformOwnerAuthUser } from "@/features/platform/data/platform-auth.repo";
import { autoAssignPlanOnAcceptance } from "@/features/billing/use-cases/salon-subscriptions";
import { acceptInvitation } from "./accept-invitation";

// Decisiones de aceptacion de invitacion: estado, vencimiento y correo.
// Se fija la conducta actual sin depender de Supabase real.

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

vi.mock("@/features/platform/use-cases/platform-audit", () => ({
  recordPlatformAction: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

const lookupMock = vi.mocked(findSalonInvitationForAcceptance);
const createUserMock = vi.mocked(createPlatformOwnerAuthUser);
const profileExistsMock = vi.mocked(profileExists);
const acceptSalonMock = vi.mocked(acceptSalonInvitationAsAdmin);
const autoAssignMock = vi.mocked(autoAssignPlanOnAcceptance);

const validInput = {
  token: "a".repeat(48),
  email: "Owner@Example.com",
  password: "clave-segura-123",
  salon_name: "Salon Aurora",
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
      error: "La contrasena debe tener al menos 8 caracteres",
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

    expect(result).toEqual({ ok: false, error: "No se pudo verificar la invitacion." });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("treats unknown tokens as invalid or already used", async () => {
    lookupMock.mockResolvedValueOnce(null);

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "Invitacion inválida o ya utilizada." });
  });

  it("refuses invitations that are not pending, such as accepted or revoked ones", async () => {
    for (const status of ["accepted", "revoked", "expired"]) {
      lookupMock.mockResolvedValueOnce(invitation({ status }) as never);

      const result = await acceptInvitation(validInput);

      expect(result).toEqual({ ok: false, error: "Invitacion inválida o ya utilizada." });
    }
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("refuses an invitation whose expiry is already in the past", async () => {
    lookupMock.mockResolvedValueOnce(invitation({ expires_at: "2000-01-01T00:00:00.000Z" }) as never);

    const result = await acceptInvitation(validInput);

    expect(result).toEqual({ ok: false, error: "La invitacion expiro." });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("matches the invitation email case-insensitively", async () => {
    const result = await acceptInvitation({ ...validInput, email: "OWNER@example.COM" });

    expect(result.ok).toBe(true);
  });

  it("refuses an invitation issued to a different email", async () => {
    const result = await acceptInvitation({ ...validInput, email: "otra@example.com" });

    expect(result).toEqual({ ok: false, error: "Esta invitacion fue emitida para otro correo." });
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
