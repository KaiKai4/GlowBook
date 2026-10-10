import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@supabase/supabase-js";
import { captureError } from "@/infra/observability";
import { findEmployeeById } from "../data/employees.repo";
import { findAssignableEmployeeRole, findEmployeeAccessProfile, unlinkEmployeeProfile } from "../data/employee-access.repo";
import { deleteEmployeeInvitations, deletePendingEmployeeInvitations, insertEmployeeInvitation } from "../data/employee-invitations.repo";
import { deleteEmployeeAuthUser } from "../data/employee-auth.repo";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount, resetEmployeeAccess } from "./employee-revocation";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";

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
const mockedCaptureError = vi.mocked(captureError);
const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedDeleteEmployeeInvitations = vi.mocked(deleteEmployeeInvitations);
const mockedDeletePending = vi.mocked(deletePendingEmployeeInvitations);
const mockedFindAssignableRole = vi.mocked(findAssignableEmployeeRole);
const mockedFindAccessProfile = vi.mocked(findEmployeeAccessProfile);
const mockedInsertInvitation = vi.mocked(insertEmployeeInvitation);
const mockedUnlinkProfile = vi.mocked(unlinkEmployeeProfile);
const mockedDeleteAuthUser = vi.mocked(deleteEmployeeAuthUser);

describe("revocacion y reinicio de acceso", () => {
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

  describe("reinicio de acceso con cuenta vinculada (vía resetEmployeeAccess)", () => {
    beforeEach(() => {
      mockedFindEmployeeById.mockResolvedValue(employeeRow({ profile_id: PROFILE_ID }) as never);
    });

    it("válida, desvincula en BD y después borra la cuenta de Auth", async () => {
      const result = await resetEmployeeAccess({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });

      expect(result.ok).toBe(true);
      expect(mockedFindAccessProfile).toHaveBeenCalledWith(PROFILE_ID, SALON_ID);
      expect(mockedUnlinkProfile).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith(PROFILE_ID);
      expect(mockedUnlinkProfile.mock.invocationCallOrder[0]).toBeLessThan(
        mockedDeleteAuthUser.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("si la desvinculación en BD falla, no borra la cuenta de Auth", async () => {
      mockedUnlinkProfile.mockResolvedValue({ error: { message: "bloqueado" } });

      const result = await resetEmployeeAccess({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo desvincular el colaborador de su cuenta anterior.",
      });
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
    });

    it("si Auth falla tras la BD, devuelve ok con aviso y registra el error", async () => {
      const failure = new AuthError("auth caido");
      mockedDeleteAuthUser.mockResolvedValue({ data: null, error: failure });

      const result = await resetEmployeeAccess({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });

      expect(mockedUnlinkProfile).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(true);
      expect(result).toMatchObject({ warnings: [OLD_ACCOUNT_NOT_DELETED_WARNING] });
      expect(mockedInsertInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ role_id: "role-1" })
      );
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "employees", action: "access" });
    });

    it("nunca desvincula ni borra la cuenta de un owner", async () => {
      mockedFindAccessProfile.mockResolvedValue({ data: { role_id: null, is_owner: true }, error: null });

      const result = await resetEmployeeAccess({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });

      expect(result).toEqual({
        ok: false,
        error: "No se puede modificar el acceso de un owner desde colaboradores.",
      });
      expect(mockedUnlinkProfile).not.toHaveBeenCalled();
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
    });

    it("sin acceso verificable (error al leer el perfil) no desvincula ni borra Auth", async () => {
      mockedFindAccessProfile.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await resetEmployeeAccess({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo verificar el acceso actual del colaborador.",
      });
      expect(mockedUnlinkProfile).not.toHaveBeenCalled();
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
    });
  });

  describe("checkEmployeeAccessRevocable", () => {
    it("devuelve el rol del perfil sin tocar Auth ni la BD", async () => {
      const result = await checkEmployeeAccessRevocable(PROFILE_ID, SALON_ID);

      expect(result).toEqual({ ok: true, value: { roleId: "role-1" } });
      expect(mockedFindAccessProfile).toHaveBeenCalledWith(PROFILE_ID, SALON_ID);
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedUnlinkProfile).not.toHaveBeenCalled();
    });

    it("rechaza la cuenta de un owner sin validar nada más", async () => {
      mockedFindAccessProfile.mockResolvedValue({ data: { role_id: null, is_owner: true }, error: null });

      const result = await checkEmployeeAccessRevocable(PROFILE_ID, SALON_ID);

      expect(result.ok).toBe(false);
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
    });

    it("informa y registra el error si no puede verificar el perfil", async () => {
      mockedFindAccessProfile.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await checkEmployeeAccessRevocable(PROFILE_ID, SALON_ID);

      expect(result).toEqual({
        ok: false,
        error: "No se pudo verificar el acceso actual del colaborador.",
      });
      expect(mockedCaptureError).toHaveBeenCalled();
    });
  });

  describe("deleteEmployeeAuthAccount", () => {
    it("borra la cuenta de Auth del perfil", async () => {
      const result = await deleteEmployeeAuthAccount(PROFILE_ID);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedDeleteAuthUser).toHaveBeenCalledWith(PROFILE_ID);
    });

    it("informa y registra el error con la causa real si Auth falla", async () => {
      const failure = new AuthError("auth caido");
      mockedDeleteAuthUser.mockResolvedValue({ data: null, error: failure });

      const result = await deleteEmployeeAuthAccount(PROFILE_ID);

      expect(result).toEqual({
        ok: false,
        error: "No se pudo revocar la cuenta anterior del colaborador.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "employees", action: "access" });
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

    it("si la desvinculación falla, no borra Auth ni crea invitación nueva", async () => {
      mockedFindEmployeeById.mockResolvedValue(
        employeeRow({ profile_id: PROFILE_ID }) as never
      );
      mockedUnlinkProfile.mockResolvedValue({ error: { message: "bloqueado" } });

      const result = await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });

      expect(result.ok).toBe(false);
      expect(mockedDeleteAuthUser).not.toHaveBeenCalled();
      expect(mockedInsertInvitation).not.toHaveBeenCalled();
    });

    it("desvincula antes de borrar Auth y crea la invitación", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeRow({ profile_id: PROFILE_ID }) as never);

      await resetEmployeeAccess({ employeeId: EMPLOYEE_ID, salonId: SALON_ID, roleId: null });

      expect(mockedUnlinkProfile.mock.invocationCallOrder[0]).toBeLessThan(
        mockedDeleteAuthUser.mock.invocationCallOrder[0] ?? Infinity
      );
      expect(mockedDeleteAuthUser.mock.invocationCallOrder[0]).toBeLessThan(
        mockedInsertInvitation.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("si Auth falla tras desvincular, crea la invitación y devuelve el aviso", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeRow({ profile_id: PROFILE_ID }) as never);
      mockedDeleteAuthUser.mockResolvedValue({ data: null, error: new AuthError("auth caido") });

      const result = await resetEmployeeAccess({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });

      expect(mockedInsertInvitation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({ token: expect.any(String) }),
        warnings: [OLD_ACCOUNT_NOT_DELETED_WARNING],
      });
    });
  });
});
