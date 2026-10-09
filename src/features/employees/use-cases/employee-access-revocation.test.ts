import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@supabase/supabase-js";
import { hashInvitationToken } from "@/infra/auth/invitation-tokens";
import { captureError } from "@/infra/observability";
import { findEmployeeById } from "../data/employees.repo";
import {
  deleteEmployeeInvitations,
  deletePendingEmployeeInvitations,
  findAssignableEmployeeRole,
  findEmployeeAccessProfile,
  insertEmployeeInvitation,
  unlinkEmployeeProfile,
} from "../data/employee-access.repo";
import { deleteEmployeeAuthUser } from "../data/employee-auth.repo";
import {
  createEmployeeInviteForExistingEmployee,
  generateEmployeeInvitation,
  replacePendingEmployeeInvitation,
  resetEmployeeAccess,
  revokeEmployeeAccessForArchive,
  revokeEmployeeAuthAccess,
} from "./employee-access";

// Ramas de error y de éxito de la revocación de accesos, el reinicio y las
// invitaciones para colaboradores existentes. El salon_id debe viajar a cada
// adaptador para que ningún cambio afecte a colaboradores de otro salón.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
}));

vi.mock("../data/employee-access.repo", () => ({
  deleteEmployeeInvitations: vi.fn(),
  deletePendingEmployeeInvitations: vi.fn(),
  findAssignableEmployeeRole: vi.fn(),
  findEmployeeAccessProfile: vi.fn(),
  insertEmployeeInvitation: vi.fn(),
  unlinkEmployeeProfile: vi.fn(),
  updateEmployeeProfileRole: vi.fn(),
}));

vi.mock("../data/employee-auth.repo", () => ({
  deleteEmployeeAuthUser: vi.fn(),
}));

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

function employeeRow(overrides: Partial<{ email: string | null; profile_id: string | null }> = {}) {
  return {
    id: EMPLOYEE_ID,
    email: "ana@salon.test",
    profile_id: null,
    ...overrides,
  };
}

describe("employee access revocation and invitations", () => {
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

    it("invalida primero las invitaciones pendientes del colaborador en el salón", async () => {
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
        error: "El rol seleccionado no es valido para este salon.",
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

  describe("generateEmployeeInvitation", () => {
    it("delega en el reemplazo de invitación con los mismos datos", async () => {
      const result = await generateEmployeeInvitation({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: "role-1",
      });

      expect(result.ok).toBe(true);
      expect(mockedDeletePending).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
    });
  });

  describe("revokeEmployeeAuthAccess", () => {
    it("revoca la cuenta, desvincula el colaborador y devuelve el rol anterior", async () => {
      const result = await revokeEmployeeAuthAccess(EMPLOYEE_ID, SALON_ID, PROFILE_ID);

      expect(result).toEqual({ ok: true, value: { roleId: "role-1" } });
      expect(mockedFindAccessProfile).toHaveBeenCalledWith(PROFILE_ID, SALON_ID);
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith(PROFILE_ID);
      expect(mockedUnlinkProfile).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
    });

    it("devuelve roleId nulo cuando el perfil no tiene rol", async () => {
      mockedFindAccessProfile.mockResolvedValue({
        data: { role_id: null, is_owner: false },
        error: null,
      });

      await expect(revokeEmployeeAuthAccess(EMPLOYEE_ID, SALON_ID, PROFILE_ID)).resolves.toEqual({
        ok: true,
        value: { roleId: null },
      });
    });

    it("devuelve roleId nulo si el perfil ya no existe", async () => {
      mockedFindAccessProfile.mockResolvedValue({ data: null, error: null });

      await expect(revokeEmployeeAuthAccess(EMPLOYEE_ID, SALON_ID, PROFILE_ID)).resolves.toEqual({
        ok: true,
        value: { roleId: null },
      });
    });

    it("nunca revoca la cuenta de un owner", async () => {
      mockedFindAccessProfile.mockResolvedValue({
        data: { role_id: null, is_owner: true },
        error: null,
      });

      const result = await revokeEmployeeAuthAccess(EMPLOYEE_ID, SALON_ID, PROFILE_ID);

      expect(result.ok).toBe(false);
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedUnlinkProfile).not.toHaveBeenCalled();
    });

    it("no sigue si no puede verificar el perfil", async () => {
      mockedFindAccessProfile.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await revokeEmployeeAuthAccess(EMPLOYEE_ID, SALON_ID, PROFILE_ID);

      expect(result).toEqual({
        ok: false,
        error: "No se pudo verificar el acceso actual del colaborador.",
      });
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
    });

    it("informa si no pudo borrar la cuenta y no desvincula", async () => {
      mockedDeleteAuthUser.mockResolvedValue({ data: null, error: new AuthError("auth caido") });

      const result = await revokeEmployeeAuthAccess(EMPLOYEE_ID, SALON_ID, PROFILE_ID);

      expect(result).toEqual({
        ok: false,
        error: "No se pudo revocar la cuenta anterior del colaborador.",
      });
      expect(mockedUnlinkProfile).not.toHaveBeenCalled();
    });

    it("avisa que la cuenta quedó revocada si el desvinculado falla", async () => {
      mockedUnlinkProfile.mockResolvedValue({ error: { message: "bloqueado" } });

      const result = await revokeEmployeeAuthAccess(EMPLOYEE_ID, SALON_ID, PROFILE_ID);

      expect(result).toEqual({
        ok: false,
        error: "La cuenta fue revocada, pero no se pudo desvincular el colaborador.",
      });
      expect(mockedCaptureError).toHaveBeenCalledTimes(1);
    });
  });

  describe("revokeEmployeeAccessForArchive", () => {
    it("sin perfil vinculado solo limpia las invitaciones del colaborador", async () => {
      const result = await revokeEmployeeAccessForArchive({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        profileId: null,
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedFindAccessProfile).not.toHaveBeenCalled();
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedDeleteEmployeeInvitations).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
    });

    it("con perfil vinculado borra la cuenta antes de limpiar invitaciones", async () => {
      const result = await revokeEmployeeAccessForArchive({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        profileId: PROFILE_ID,
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith(PROFILE_ID);
      expect(mockedDeleteAuthUser.mock.invocationCallOrder[0]).toBeLessThan(
        mockedDeleteEmployeeInvitations.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("nunca archiva la cuenta de un owner", async () => {
      mockedFindAccessProfile.mockResolvedValue({
        data: { role_id: null, is_owner: true },
        error: null,
      });

      const result = await revokeEmployeeAccessForArchive({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        profileId: PROFILE_ID,
      });

      expect(result.ok).toBe(false);
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedDeleteEmployeeInvitations).not.toHaveBeenCalled();
    });

    it("informa si no puede verificar el perfil antes de archivar", async () => {
      mockedFindAccessProfile.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await revokeEmployeeAccessForArchive({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        profileId: PROFILE_ID,
      });

      expect(result.ok).toBe(false);
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
    });

    it("informa si la revocación de la cuenta falla", async () => {
      mockedDeleteAuthUser.mockResolvedValue({ data: null, error: new AuthError("auth caido") });

      const result = await revokeEmployeeAccessForArchive({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        profileId: PROFILE_ID,
      });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo revocar el acceso del colaborador.",
      });
      expect(mockedDeleteEmployeeInvitations).not.toHaveBeenCalled();
    });

    it("informa si la limpieza de invitaciones falla", async () => {
      mockedDeleteEmployeeInvitations.mockResolvedValue({ error: { message: "bloqueado" } });

      const result = await revokeEmployeeAccessForArchive({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        profileId: null,
      });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo limpiar la invitación del colaborador.",
      });
    });
  });

  describe("resetEmployeeAccess", () => {
    it("devuelve 'no encontrado' sin tocar accesos cuando el colaborador no existe en el salón", async () => {
      mockedFindEmployeeById.mockResolvedValue(null as never);

      const result = await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });

      expect(result).toEqual({ ok: false, error: "Colaborador no encontrado." });
      expect(mockedFindEmployeeById).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
    });

    it("exige un email registrado, incluso si solo tiene espacios", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeRow({ email: "   " }) as never);

      const result = await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });

      expect(result).toEqual({
        ok: false,
        error: "Este colaborador no tiene email registrado.",
      });
      expect(mockedDeletePending).not.toHaveBeenCalled();
    });

    it("sin cuenta vinculada crea una invitación nueva con el rol pedido", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeRow() as never);

      const result = await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: "role-1",
      });

      expect(result.ok).toBe(true);
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedInsertInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ email: "ana@salon.test", role_id: "role-1" })
      );
    });

    it("con cuenta vinculada revoca primero y hereda el rol anterior si no se pide otro", async () => {
      mockedFindEmployeeById.mockResolvedValue(
        employeeRow({ profile_id: PROFILE_ID }) as never
      );

      const result = await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });

      expect(result.ok).toBe(true);
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith(PROFILE_ID);
      expect(mockedInsertInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ role_id: "role-1" })
      );
    });

    it("con cuenta vinculada usa el rol pedido en lugar del anterior", async () => {
      mockedFindEmployeeById.mockResolvedValue(
        employeeRow({ profile_id: PROFILE_ID }) as never
      );

      mockedFindAssignableRole.mockResolvedValue({ data: { id: "role-2" }, error: null });

      await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: "role-2",
      });

      expect(mockedFindAssignableRole).toHaveBeenCalledWith(SALON_ID, "role-2");
      expect(mockedInsertInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ role_id: "role-2" })
      );
    });

    it("si la revocación previa falla, no crea invitación nueva", async () => {
      mockedFindEmployeeById.mockResolvedValue(
        employeeRow({ profile_id: PROFILE_ID }) as never
      );
      mockedDeleteAuthUser.mockResolvedValue({ data: null, error: new AuthError("auth caido") });

      const result = await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });

      expect(result.ok).toBe(false);
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
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
});
