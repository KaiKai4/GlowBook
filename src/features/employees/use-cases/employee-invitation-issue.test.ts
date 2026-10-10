import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashInvitationToken } from "@/infra/auth/invitation-tokens";
import { captureError } from "@/infra/observability";
import { findEmployeeById } from "../data/employees.repo";
import { findAssignableEmployeeRole, findEmployeeAccessProfile, unlinkEmployeeProfile } from "../data/employee-access.repo";
import { deleteEmployeeInvitations, deletePendingEmployeeInvitations, insertEmployeeInvitation } from "../data/employee-invitations.repo";
import { deleteEmployeeAuthUser } from "../data/employee-auth.repo";
import { createEmployeeInviteForExistingEmployee, replacePendingEmployeeInvitation, clearEmployeeInvitations } from "./employee-invitation-issue";

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
}));

vi.mock("../data/employee-access.repo", () => ({
  findAssignableEmployeeRole: vi.fn(),
  findEmployeeAccessProfile: vi.fn(),
  unlinkEmployeeProfile: vi.fn(),
  updateEmployeeProfileRole: vi.fn(),
}));

vi.mock("../data/employee-invitations.repo", () => ({
  deleteEmployeeInvitations: vi.fn(),
  deletePendingEmployeeInvitations: vi.fn(),
  insertEmployeeInvitation: vi.fn(),
}));

vi.mock("../data/employee-auth.repo", () => ({
  deleteEmployeeAuthUser: vi.fn(),
}));

function employeeRow(overrides: Partial<{ email: string | null; profile_id: string | null }> = {}) {
  return {
    id: EMPLOYEE_ID,
    email: "ana@salon.test",
    profile_id: null,
    ...overrides,
  };
}
const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const PROFILE_ID = "profile-1";
const NOW = new Date("2026-10-09T12:00:00.000Z");
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const mockedCaptureError = vi.mocked(captureError);
const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedDeleteEmployeeInvitations = vi.mocked(deleteEmployeeInvitations);
const mockedDeletePending = vi.mocked(deletePendingEmployeeInvitations);
const mockedFindAssignableRole = vi.mocked(findAssignableEmployeeRole);
const mockedFindAccessProfile = vi.mocked(findEmployeeAccessProfile);
const mockedInsertInvitation = vi.mocked(insertEmployeeInvitation);
const mockedUnlinkProfile = vi.mocked(unlinkEmployeeProfile);
const mockedDeleteAuthUser = vi.mocked(deleteEmployeeAuthUser);

describe("invitaciones de acceso (emision y limpieza)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mockedFindAssignableRole.mockResolvedValue({ data: { id: "role-1" }, error: null });
    mockedFindAccessProfile.mockResolvedValue({
      data: { role_id: "role-1", is_owner: false },
      error: null,
    });
    mockedDeletePending.mockResolvedValue({ error: null });
    mockedInsertInvitation.mockResolvedValue({ error: null });
    mockedDeleteAuthUser.mockResolvedValue({ data: undefined, error: null });
    mockedUnlinkProfile.mockResolvedValue({ error: null });
    mockedDeleteEmployeeInvitations.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("replacePendingEmployeeInvitation", () => {
    it("guarda solo el hash del token y vence a los 7 días", async () => {
      const result = await replacePendingEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: "role-1",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.expiresAt).toBe(new Date(NOW.getTime() + SEVEN_DAYS_MS).toISOString());
      expect(mockedInsertInvitation).toHaveBeenCalledWith({
        employee_id: EMPLOYEE_ID,
        salon_id: SALON_ID,
        email: "ana@salon.test",
        role_id: "role-1",
        token_hash: hashInvitationToken(result.value.token),
        expires_at: result.value.expiresAt,
      });
      expect(JSON.stringify(mockedInsertInvitation.mock.calls)).not.toContain(result.value.token);
    });

    it("inválida primero las invitaciones pendientes del colaborador en el salón", async () => {
      await replacePendingEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: null,
      });

      expect(mockedDeletePending).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(mockedDeletePending.mock.invocationCallOrder[0]).toBeLessThan(
        mockedInsertInvitation.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("sin rol asignado guarda role_id nulo y no consulta roles", async () => {
      await replacePendingEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: null,
      });

      expect(mockedFindAssignableRole).not.toHaveBeenCalled();
      expect(mockedInsertInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ role_id: null })
      );
    });

    it("rechaza un rol que no es asignable para el salón sin tocar invitaciones", async () => {
      mockedFindAssignableRole.mockResolvedValue({ data: null, error: null });

      const result = await replacePendingEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: "role-ajeno",
      });

      expect(result).toEqual({
        ok: false,
        error: "El rol seleccionado no es válido para este salón.",
      });
      expect(mockedFindAssignableRole).toHaveBeenCalledWith(SALON_ID, "role-ajeno");
      expect(mockedDeletePending).not.toHaveBeenCalled();
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
    });

    it("informa cuando falla la verificación del rol y registra el error", async () => {
      mockedFindAssignableRole.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await replacePendingEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: "role-1",
      });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo verificar el rol del colaborador.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(
        { message: "caido" },
        { module: "employees", action: "access" }
      );
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
    });

    it("no genera enlace nuevo si no pudo invalidar el anterior", async () => {
      mockedDeletePending.mockResolvedValue({ error: { message: "bloqueado" } });

      const result = await replacePendingEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: null,
      });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo invalidar el enlace anterior del colaborador.",
      });
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
      expect(mockedCaptureError).toHaveBeenCalledTimes(1);
    });

    it("informa cuando la inserción del nuevo enlace falla", async () => {
      mockedInsertInvitation.mockResolvedValue({ error: { message: "sin cupo" } });

      const result = await replacePendingEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: null,
      });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo generar el nuevo enlace de acceso.",
      });
    });
  });

  describe("createEmployeeInviteForExistingEmployee", () => {
    it("crea invitación con el email recortado para un colaborador sin acceso", async () => {
      mockedFindEmployeeById.mockResolvedValue(
        employeeRow({ email: "  ana@salon.test  " }) as never
      );

      const result = await createEmployeeInviteForExistingEmployee({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: "",
      });

      expect(result.ok).toBe(true);
      expect(mockedInsertInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ email: "ana@salon.test", role_id: null })
      );
    });

    it("devuelve 'no encontrado' si el colaborador no existe", async () => {
      mockedFindEmployeeById.mockResolvedValue(null as never);

      await expect(
        createEmployeeInviteForExistingEmployee({
          employeeId: EMPLOYEE_ID,
          salonId: SALON_ID,
          roleId: null,
        })
      ).resolves.toEqual({ ok: false, error: "Colaborador no encontrado." });
    });

    it("no permite invitar a un colaborador sin email", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeRow({ email: null }) as never);

      await expect(
        createEmployeeInviteForExistingEmployee({
          employeeId: EMPLOYEE_ID,
          salonId: SALON_ID,
          roleId: null,
        })
      ).resolves.toEqual({
        ok: false,
        error: "Este colaborador no tiene email registrado.",
      });
    });

    it("no invita a un colaborador que ya tiene cuenta vinculada", async () => {
      mockedFindEmployeeById.mockResolvedValue(
        employeeRow({ profile_id: PROFILE_ID }) as never
      );

      await expect(
        createEmployeeInviteForExistingEmployee({
          employeeId: EMPLOYEE_ID,
          salonId: SALON_ID,
          roleId: null,
        })
      ).resolves.toEqual({
        ok: false,
        error: "Este colaborador ya tiene acceso al sistema.",
      });
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
    });
  });

  describe("clearEmployeeInvitations", () => {
    it("limpia las invitaciones del colaborador dentro del salón", async () => {
      const result = await clearEmployeeInvitations(EMPLOYEE_ID, SALON_ID);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedDeleteEmployeeInvitations).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
    });

    it("informa si la limpieza falla", async () => {
      mockedDeleteEmployeeInvitations.mockResolvedValue({ error: { message: "bloqueado" } });

      const result = await clearEmployeeInvitations(EMPLOYEE_ID, SALON_ID);

      expect(result).toEqual({
        ok: false,
        error: "No se pudo limpiar la invitación del colaborador.",
      });
    });
  });
});
