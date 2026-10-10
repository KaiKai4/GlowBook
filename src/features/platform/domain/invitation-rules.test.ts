import { describe, expect, it } from "vitest";
import {
  DUPLICATE_OWNER_MESSAGE,
  invitationRejection,
  isAlreadyRegisteredError,
  planToAssign,
  translateAcceptError,
  type InvitationForAcceptance,
} from "./invitation-rules";

const NOW = new Date("2026-06-12T12:00:00.000Z");
const VALID: InvitationForAcceptance = {
  email: "Owner@Salon.com",
  status: "pending",
  expires_at: "2026-06-20T00:00:00.000Z",
  plan_id: "plan-pro",
};

describe("invitationRejection", () => {
  it("acepta una invitación pendiente, vigente y para el mismo correo sin importar mayúsculas", () => {
    expect(invitationRejection({ invitation: VALID, email: "owner@salon.com", now: NOW })).toBeNull();
  });

  it("rechaza invitaciones inexistentes o ya usadas", () => {
    expect(invitationRejection({ invitation: null, email: "a@b.co", now: NOW })).toBe("Invitacion inválida o ya utilizada.");
    expect(
      invitationRejection({ invitation: { ...VALID, status: "accepted" }, email: "owner@salon.com", now: NOW })
    ).toBe("Invitacion inválida o ya utilizada.");
  });

  it("rechaza invitaciones caducadas", () => {
    const expired = { ...VALID, expires_at: "2026-06-11T00:00:00.000Z" };
    expect(invitationRejection({ invitation: expired, email: "owner@salon.com", now: NOW })).toBe("La invitacion expiro.");
  });

  it("rechaza un correo distinto al de la invitación", () => {
    expect(invitationRejection({ invitation: VALID, email: "otro@salon.com", now: NOW })).toBe(
      "Esta invitacion fue emitida para otro correo."
    );
  });
});

describe("planToAssign", () => {
  it("devuelve el plan de la invitación o null cuando no tiene", () => {
    expect(planToAssign({ plan_id: "plan-pro" })).toBe("plan-pro");
    expect(planToAssign({ plan_id: null })).toBeNull();
  });
});

describe("isAlreadyRegisteredError", () => {
  it("detecta el mensaje de correo ya registrado sin distinguir mayúsculas", () => {
    expect(isAlreadyRegisteredError("User Already Registered")).toBe(true);
    expect(isAlreadyRegisteredError("otro error")).toBe(false);
    expect(isAlreadyRegisteredError(undefined)).toBe(false);
    expect(isAlreadyRegisteredError(null)).toBe(false);
  });
});

describe("translateAcceptError", () => {
  it("traduce colisiones de perfil a un mensaje accionable", () => {
    expect(translateAcceptError('duplicate key value violates unique constraint "profiles_pkey"')).toBe(
      DUPLICATE_OWNER_MESSAGE
    );
  });

  it("conserva los mensajes de invitación que lanza la RPC", () => {
    expect(translateAcceptError("La invitación ha expirado")).toBe("La invitación ha expirado");
  });

  it("oculta cualquier otro error técnico", () => {
    expect(translateAcceptError("connection reset by peer")).toBe(
      "No se pudo crear el salon. Intentalo de nuevo o solicita una nueva invitacion."
    );
  });
});
