import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { PublicError } from "@/infra/public-error";
import {
  acceptInvitation as acceptInvitationWithDeps,
  type AcceptInvitationDeps,
} from "./accept-invitation";
import { inviteSalon as inviteSalonWithDeps, type InviteSalonDeps } from "./invite-salon";

vi.mock("server-only", () => ({}));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

// Fakes tipados de las dependencias: ningún test toca Supabase ni auditoría real.
const inviteDeps: InviteSalonDeps = {
  createSalonInvitation: vi.fn<InviteSalonDeps["createSalonInvitation"]>(),
  regenerateSalonInvitationToken: vi.fn<InviteSalonDeps["regenerateSalonInvitationToken"]>(),
  publishAuditEvent: vi.fn<InviteSalonDeps["publishAuditEvent"]>(async () => []),
};
const acceptDeps: AcceptInvitationDeps = {
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

const inviteSalon = (input: Parameters<typeof inviteSalonWithDeps>[0]) =>
  inviteSalonWithDeps(input, inviteDeps);
const acceptInvitation = (input: Parameters<typeof acceptInvitationWithDeps>[0]) =>
  acceptInvitationWithDeps(input, acceptDeps);

const createSalonInvitation = vi.mocked(inviteDeps.createSalonInvitation);
const findSalonInvitationForAcceptance = vi.mocked(acceptDeps.findInvitation);
const publishAuditEvent = vi.mocked(inviteDeps.publishAuditEvent);

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

let isAdmin = true;

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = true;
});

describe("invitar salón: validaciones y errores", () => {
  it("un usuario que no es administrador de plataforma no puede invitar", async () => {
    isAdmin = false;

    const result = await inviteSalon({ ...VALID_INVITE, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(createSalonInvitation).not.toHaveBeenCalled();
  });

  it("un email inválido devuelve el primer mensaje de validación", async () => {
    const result = await inviteSalon({ ...VALID_INVITE, email: "no-es-email", actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
    expect(createSalonInvitation).not.toHaveBeenCalled();
  });

  it("sin plan válido no se crea la invitación", async () => {
    const result = await inviteSalon({ ...VALID_INVITE, planId: "plan", actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: false, error: "Selecciona el plan que tendrá el salón." });
    expect(createSalonInvitation).not.toHaveBeenCalled();
  });

  it("crea la invitación, audita y devuelve el token en claro", async () => {
    vi.mocked(createSalonInvitation).mockResolvedValue("token-en-claro");

    const result = await inviteSalon({ ...VALID_INVITE, actorIsPlatformAdmin: isAdmin });

    expect(result).toEqual({ ok: true, value: "token-en-claro" });
    expect(createSalonInvitation).toHaveBeenCalledWith("dueno@salon.com", PLAN);
    expect(publishAuditEvent).toHaveBeenCalledWith("platform.salon_invited", expect.objectContaining({ action: "invite_salon", status: "succeeded", actorUserId: ADMIN })
    );
  });

  it("si la creación falla registra el error y la auditoria de fallo", async () => {
    const failure = new PublicError("Ya existe una invitación pendiente.");
    vi.mocked(createSalonInvitation).mockRejectedValue(failure);

    const result = await inviteSalon({ ...VALID_INVITE, actorIsPlatformAdmin: isAdmin });

    expect(result.ok).toBe(false);
    expect(captureError).toHaveBeenCalledWith(failure, {
      module: "platform",
      action: "invite_salon",
      metadata: { emailDomain: "salon.com" },
    });
    expect(publishAuditEvent).toHaveBeenCalledWith("platform.salon_invited", expect.objectContaining({ action: "invite_salon", status: "failed" })
    );
  });
});

describe("aceptar invitación: validaciones y errores", () => {
  it("un token vacio devuelve 'Token inválido' sin consultar la invitación", async () => {
    const result = await acceptInvitation({ ...VALID_ACCEPT, token: "" });

    expect(result).toEqual({ ok: false, error: "Token inválido" });
    expect(findSalonInvitationForAcceptance).not.toHaveBeenCalled();
  });

  it("una contraseña corta devuelve su mensaje de validación", async () => {
    const result = await acceptInvitation({ ...VALID_ACCEPT, password: "corta" });

    expect(result).toEqual({
      ok: false,
      error: "La contraseña debe tener al menos 8 caracteres",
    });
  });

  it("un email inválido devuelve el mensaje del esquema", async () => {
    const result = await acceptInvitation({ ...VALID_ACCEPT, email: "x" });

    expect(result).toEqual({ ok: false, error: "Email inválido" });
  });

  it("si no se puede verificar la invitación informa del fallo y registra el error", async () => {
    const failure = new Error("timeout");
    vi.mocked(findSalonInvitationForAcceptance).mockRejectedValue(failure);

    const result = await acceptInvitation(VALID_ACCEPT);

    expect(result).toEqual({ ok: false, error: "No se pudo verificar la invitación." });
    expect(captureError).toHaveBeenCalledWith(failure, {
      module: "platform",
      action: "accept_invitation_lookup",
      metadata: { emailDomain: "salon.com" },
    });
  });
});
