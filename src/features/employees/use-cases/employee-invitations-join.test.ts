import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { findAssignableEmployeeRole, insertEmployeeProfile, linkEmployeeProfile } from "../data/employee-access.repo";
import { findEmployeeInvitationForJoin, markEmployeeInvitationAccepted, type EmployeeInvitationForJoin } from "../data/employee-invitations.repo";
import {
  createEmployeeAuthUser,
  deleteEmployeeAuthUser,
} from "../data/employee-auth.repo";
import {
  acceptEmployeeInvitation,
  getEmployeeInvitationJoinView,
} from "./employee-invitations";

// Vista previa del enlace de invitación y aceptación. Cubre las ramas que el
// test de invitaciones principal no toca: estados del enlace, roles inválidos,
// errores de Auth y rollback de cada paso fallido.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employee-access.repo", () => ({
  findAssignableEmployeeRole: vi.fn(),
  insertEmployeeProfile: vi.fn(),
  linkEmployeeProfile: vi.fn(),
}));

vi.mock("../data/employee-invitations.repo", () => ({
  findEmployeeInvitationForJoin: vi.fn(),
  markEmployeeInvitationAccepted: vi.fn(),
}));

vi.mock("../data/employee-auth.repo", () => ({
  createEmployeeAuthUser: vi.fn(),
  deleteEmployeeAuthUser: vi.fn(),
}));

const mockedCaptureError = vi.mocked(captureError);
const mockedFindInvitation = vi.mocked(findEmployeeInvitationForJoin);
const mockedFindAssignableRole = vi.mocked(findAssignableEmployeeRole);
const mockedInsertProfile = vi.mocked(insertEmployeeProfile);
const mockedLinkProfile = vi.mocked(linkEmployeeProfile);
const mockedMarkAccepted = vi.mocked(markEmployeeInvitationAccepted);
const mockedCreateAuthUser = vi.mocked(createEmployeeAuthUser);
const mockedDeleteAuthUser = vi.mocked(deleteEmployeeAuthUser);

const TOKEN = "token-de-prueba";
const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

function invitation(overrides: Partial<EmployeeInvitationForJoin> = {}): EmployeeInvitationForJoin {
  return {
    id: "invitation-1",
    employee_id: "employee-1",
    salon_id: "salon-1",
    email: "ana@salon.test",
    role_id: "role-1",
    expires_at: FUTURE,
    accepted_at: null,
    employees: { first_name: "Ana", last_name: "Lopez" },
    salons: { name: "Glow Salon" },
    ...overrides,
  };
}

describe("employee invitation join", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindInvitation.mockResolvedValue({ data: invitation(), error: null });
    mockedFindAssignableRole.mockResolvedValue({ data: { id: "role-1" }, error: null });
    mockedCreateAuthUser.mockResolvedValue({ data: { id: "user-1" } as never, error: null });
    mockedInsertProfile.mockResolvedValue({ error: null });
    mockedLinkProfile.mockResolvedValue({ error: null });
    mockedMarkAccepted.mockResolvedValue({ error: null });
    mockedDeleteAuthUser.mockResolvedValue({ data: undefined, error: null });
  });

  describe("getEmployeeInvitationJoinView", () => {
    it("busca la invitación por el token recibido en el enlace", async () => {
      await getEmployeeInvitationJoinView(TOKEN);

      expect(mockedFindInvitation).toHaveBeenCalledWith(TOKEN);
    });

    it("muestra los datos de una invitación pendiente vigente", async () => {
      await expect(getEmployeeInvitationJoinView(TOKEN)).resolves.toEqual({
        status: "pending",
        token: TOKEN,
        email: "ana@salon.test",
        employeeName: "Ana Lopez",
        salonName: "Glow Salon",
      });
    });

    it("responde no encontrada y registra el error si la consulta falla", async () => {
      mockedFindInvitation.mockResolvedValue({ data: null, error: { message: "caido" } });

      await expect(getEmployeeInvitationJoinView(TOKEN)).resolves.toEqual({
        status: "not_found",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(
        { message: "caido" },
        { module: "employees", action: "join" }
      );
    });

    it("responde no encontrada si no existe ninguna invitación con ese token", async () => {
      mockedFindInvitation.mockResolvedValue({ data: null, error: null });

      await expect(getEmployeeInvitationJoinView(TOKEN)).resolves.toEqual({
        status: "not_found",
      });
    });

    it("responde aceptada cuando el enlace ya fue usado, aunque esté vencido", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ accepted_at: "2026-02-01T00:00:00.000Z", expires_at: PAST }),
        error: null,
      });

      await expect(getEmployeeInvitationJoinView(TOKEN)).resolves.toEqual({ status: "accepted" });
    });

    it("responde vencida cuando la fecha de expiración ya pasó", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ expires_at: PAST }),
        error: null,
      });

      await expect(getEmployeeInvitationJoinView(TOKEN)).resolves.toEqual({ status: "expired" });
    });

    it("usa valores por defecto para el nombre y el salón cuando faltan relaciones", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ employees: null, salons: null }),
        error: null,
      });

      await expect(getEmployeeInvitationJoinView(TOKEN)).resolves.toEqual({
        status: "pending",
        token: TOKEN,
        email: "ana@salon.test",
        employeeName: "Colaborador",
        salonName: "tu salon",
      });
    });

    it("usa 'Colaborador' cuando el nombre queda vacío tras recortar", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ employees: { first_name: " ", last_name: " " } }),
        error: null,
      });

      await expect(getEmployeeInvitationJoinView(TOKEN)).resolves.toMatchObject({
        status: "pending",
        employeeName: "Colaborador",
      });
    });
  });

  describe("acceptEmployeeInvitation validations", () => {
    it("rechaza contraseñas de menos de 8 caracteres sin consultar la invitación", async () => {
      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "1234567" });

      expect(result).toEqual({
        ok: false,
        error: "La contrasena debe tener al menos 8 caracteres.",
      });
      expect(mockedFindInvitation).not.toHaveBeenCalled();
      expect(mockedCreateAuthUser).not.toHaveBeenCalled();
    });

    it("acepta exactamente 8 caracteres como contraseña válida", async () => {
      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "12345678" });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedCreateAuthUser).toHaveBeenCalledWith({
        email: "ana@salon.test",
        password: "12345678",
        emailConfirm: true,
      });
    });

    it("informa cuando no puede verificar la invitación", async () => {
      mockedFindInvitation.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({ ok: false, error: "No se pudo verificar la invitacion." });
      expect(mockedCaptureError).toHaveBeenCalledTimes(1);
      expect(mockedCreateAuthUser).not.toHaveBeenCalled();
    });

    it("rechaza un enlace inexistente", async () => {
      mockedFindInvitation.mockResolvedValue({ data: null, error: null });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({ ok: false, error: "El enlace no es valido." });
    });

    it("rechaza un enlace ya utilizado", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ accepted_at: "2026-02-01T00:00:00.000Z" }),
        error: null,
      });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({ ok: false, error: "Este enlace ya fue utilizado." });
      expect(mockedCreateAuthUser).not.toHaveBeenCalled();
    });

    it("rechaza un enlace vencido", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ expires_at: PAST }),
        error: null,
      });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "Este enlace ha expirado. Solicita uno nuevo al administrador.",
      });
    });

    it("rechaza una invitación cuyo colaborador ya no existe", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ employees: null }),
        error: null,
      });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({ ok: false, error: "Colaborador no encontrado." });
    });

    it("informa cuando no puede verificar el rol de la invitación", async () => {
      mockedFindAssignableRole.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo verificar el rol de la invitacion.",
      });
      expect(mockedCreateAuthUser).not.toHaveBeenCalled();
    });

    it("rechaza un rol que dejó de ser asignable", async () => {
      mockedFindAssignableRole.mockResolvedValue({ data: null, error: null });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "Este enlace tiene un rol inválido. Solicita un enlace nuevo.",
      });
      expect(mockedCreateAuthUser).not.toHaveBeenCalled();
    });

    it("sin rol en la invitación crea el perfil con role_id nulo y no valida roles", async () => {
      mockedFindInvitation.mockResolvedValue({
        data: invitation({ role_id: null }),
        error: null,
      });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedFindAssignableRole).not.toHaveBeenCalled();
      expect(mockedInsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({ role_id: null, is_owner: false })
      );
    });
  });

  describe("acceptEmployeeInvitation Auth and rollback", () => {
    it("traduce el email ya registrado a un mensaje de contacto con el administrador", async () => {
      mockedCreateAuthUser.mockResolvedValue({
        data: null,
        error: { message: "User already registered", name: "AuthError", status: 422 } as never,
      });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "Este email ya tiene una cuenta registrada. Contacta al administrador.",
      });
      expect(mockedInsertProfile).not.toHaveBeenCalled();
    });

    it("reconoce también el mensaje 'already exists' de Auth", async () => {
      mockedCreateAuthUser.mockResolvedValue({
        data: null,
        error: { message: "user already exists", name: "AuthError", status: 422 } as never,
      });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toMatchObject({
        ok: false,
        error: "Este email ya tiene una cuenta registrada. Contacta al administrador.",
      });
    });

    it("cualquier otro fallo de Auth o ausencia de usuario devuelve error genérico", async () => {
      mockedCreateAuthUser.mockResolvedValue({ data: null, error: null });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "Error al crear la cuenta. Intenta de nuevo.",
      });
    });

    it("si falla el perfil revierte la cuenta creada", async () => {
      mockedInsertProfile.mockResolvedValue({ error: { message: "caido" } });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "Error al configurar el perfil. Intenta de nuevo.",
      });
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith("user-1");
      expect(mockedLinkProfile).not.toHaveBeenCalled();
    });

    it("si la vinculación falla revierte la cuenta creada", async () => {
      mockedLinkProfile.mockResolvedValue({ error: { message: "caido" } });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "Error al vincular el colaborador. Intenta de nuevo.",
      });
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith("user-1");
      expect(mockedMarkAccepted).not.toHaveBeenCalled();
    });

    it("si no se puede marcar aceptada revierte la cuenta y registra el error", async () => {
      mockedMarkAccepted.mockResolvedValue({ error: { message: "caido" } });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result).toEqual({
        ok: false,
        error: "Error al confirmar la invitacion. Solicita un enlace nuevo.",
      });
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith("user-1");
      expect(mockedCaptureError).toHaveBeenCalledWith(
        { message: "caido" },
        { module: "employees", action: "join" }
      );
    });

    it("ignora un 404 al revertir porque la cuenta ya no existe", async () => {
      mockedInsertProfile.mockResolvedValue({ error: { message: "caido" } });
      mockedDeleteAuthUser.mockResolvedValue({
        data: null,
        error: { message: "not found", status: 404 } as never,
      });

      const result = await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(result.ok).toBe(false);
      expect(mockedCaptureError).not.toHaveBeenCalled();
    });

    it("registra el fallo cuando la reversión de la cuenta también falla", async () => {
      mockedInsertProfile.mockResolvedValue({ error: { message: "caido" } });
      mockedDeleteAuthUser.mockResolvedValue({
        data: null,
        error: { message: "auth caido", status: 500 } as never,
      });

      await acceptEmployeeInvitation({ token: TOKEN, password: "clave-segura-1" });

      expect(mockedCaptureError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "auth caido" }),
        { module: "employees", action: "join-rollback", metadata: { context: "profile" } }
      );
    });
  });
});
