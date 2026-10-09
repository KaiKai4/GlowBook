import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import { isPlatformAdmin } from "@/infra/auth/session";
import { createSalonInvitation, findSalonInvitationForAcceptance } from "../data/invitations.repo";
import { acceptInvitation } from "./accept-invitation";
import { inviteSalon } from "./invite-salon";
import { recordPlatformAction } from "./platform-audit";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));
vi.mock("@/infra/auth/session", () => ({ isPlatformAdmin: vi.fn() }));
vi.mock("./platform-audit", () => ({ recordPlatformAction: vi.fn(async () => []) }));
vi.mock("../data/invitations.repo", () => ({
  acceptSalonInvitationAsAdmin: vi.fn(),
  createSalonInvitation: vi.fn(),
  findSalonInvitationForAcceptance: vi.fn(),
  profileExists: vi.fn(),
}));
vi.mock("../data/platform-auth.repo", () => ({
  createPlatformOwnerAuthUser: vi.fn(),
  deletePlatformOwnerAuthUser: vi.fn(),
  findPlatformOwnerAuthUserByEmail: vi.fn(),
  updatePlatformOwnerAuthUser: vi.fn(),
}));
vi.mock("@/features/billing/use-cases/salon-subscriptions", () => ({
  autoAssignPlanOnAcceptance: vi.fn(),
}));

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const PLAN = "00000000-0000-4000-8000-0000000000b1";
const VALID_INVITE = { email: "dueno@salon.com", planId: PLAN, actorUserId: ADMIN };
const VALID_ACCEPT = {
  token: "token-en-claro",
  email: "dueno@salon.com",
  password: "Clave-segura-1",
  salon_name: "Salón Centro",
  full_name: "Dueña Ejemplo",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isPlatformAdmin).mockResolvedValue(true);
});

describe("invitar salon: validaciones y errores", () => {
  it("un usuario que no es administrador de plataforma no puede invitar", async () => {
    vi.mocked(isPlatformAdmin).mockResolvedValue(false);

    const result = await inviteSalon(VALID_INVITE);

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(createSalonInvitation).not.toHaveBeenCalled();
  });

  it("un email invalido devuelve el primer mensaje de validacion", async () => {
    const result = await inviteSalon({ ...VALID_INVITE, email: "no-es-email" });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
    expect(createSalonInvitation).not.toHaveBeenCalled();
  });

  it("sin plan valido no se crea la invitacion", async () => {
    const result = await inviteSalon({ ...VALID_INVITE, planId: "plan" });

    expect(result).toEqual({ ok: false, error: "Selecciona el plan que tendra el salon." });
    expect(createSalonInvitation).not.toHaveBeenCalled();
  });

  it("crea la invitacion, audita y devuelve el token en claro", async () => {
    vi.mocked(createSalonInvitation).mockResolvedValue("token-en-claro");

    const result = await inviteSalon(VALID_INVITE);

    expect(result).toEqual({ ok: true, value: "token-en-claro" });
    expect(createSalonInvitation).toHaveBeenCalledWith("dueno@salon.com", PLAN);
    expect(recordPlatformAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite_salon", status: "succeeded", actorUserId: ADMIN })
    );
  });

  it("si la creacion falla registra el error y la auditoria de fallo", async () => {
    const failure = new PublicError("Ya existe una invitación pendiente.");
    vi.mocked(createSalonInvitation).mockRejectedValue(failure);

    const result = await inviteSalon(VALID_INVITE);

    expect(result.ok).toBe(false);
    expect(captureError).toHaveBeenCalledWith(failure, {
      module: "platform",
      action: "invite_salon",
      metadata: { emailDomain: "salon.com" },
    });
    expect(recordPlatformAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite_salon", status: "failed" })
    );
  });
});

describe("aceptar invitacion: validaciones y errores", () => {
  it("un token vacio devuelve 'Token inválido' sin consultar la invitacion", async () => {
    const result = await acceptInvitation({ ...VALID_ACCEPT, token: "" });

    expect(result).toEqual({ ok: false, error: "Token inválido" });
    expect(findSalonInvitationForAcceptance).not.toHaveBeenCalled();
  });

  it("una contraseña corta devuelve su mensaje de validacion", async () => {
    const result = await acceptInvitation({ ...VALID_ACCEPT, password: "corta" });

    expect(result).toEqual({
      ok: false,
      error: "La contrasena debe tener al menos 8 caracteres",
    });
  });

  it("un email invalido devuelve el mensaje del esquema", async () => {
    const result = await acceptInvitation({ ...VALID_ACCEPT, email: "x" });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
  });

  it("si no se puede verificar la invitacion informa del fallo y registra el error", async () => {
    const failure = new Error("timeout");
    vi.mocked(findSalonInvitationForAcceptance).mockRejectedValue(failure);

    const result = await acceptInvitation(VALID_ACCEPT);

    expect(result).toEqual({ ok: false, error: "No se pudo verificar la invitacion." });
    expect(captureError).toHaveBeenCalledWith(failure, {
      module: "platform",
      action: "accept_invitation_lookup",
      metadata: { emailDomain: "salon.com" },
    });
  });
});
