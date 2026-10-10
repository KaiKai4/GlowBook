import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { findEmployeeById, updateEmployee } from "../data/employees.repo";
import { clearEmployeeInvitations } from "./employee-invitation-issue";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";
import { archiveEmployee, reactivateEmployee } from "./employee-lifecycle";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";

// Ramas de error de reactivar y archivar colaboradores, y del orden de la
// revocación de acceso: el perfil se desvincula solo si el archivado llega a
// guardarse.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("@/features/employees/data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
  updateEmployee: vi.fn(),
}));

vi.mock("./employee-invitation-issue", () => ({
  clearEmployeeInvitations: vi.fn(),
}));

vi.mock("./employee-revocation", () => ({
  checkEmployeeAccessRevocable: vi.fn(),
  deleteEmployeeAuthAccount: vi.fn(),
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";

const mockedCaptureError = vi.mocked(captureError);
const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedUpdateEmployee = vi.mocked(updateEmployee);
const mockedCheckRevocable = vi.mocked(checkEmployeeAccessRevocable);
const mockedClearInvitations = vi.mocked(clearEmployeeInvitations);
const mockedDeleteAuthAccount = vi.mocked(deleteEmployeeAuthAccount);
const OWNER_MESSAGE = "No se puede modificar el acceso de un owner desde colaboradores.";

describe("employee lifecycle branches", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployeeById.mockResolvedValue({
      id: EMPLOYEE_ID,
      profile_id: "profile-1",
    } as never);
    mockedUpdateEmployee.mockResolvedValue({} as never);
    mockedCheckRevocable.mockResolvedValue({ ok: true, value: { roleId: null } });
    mockedClearInvitations.mockResolvedValue({ ok: true, value: undefined });
    mockedDeleteAuthAccount.mockResolvedValue({ ok: true, value: undefined });
  });

  describe("reactivateEmployee", () => {
    it("no reactiva un colaborador que no existe en el salón", async () => {
      mockedFindEmployeeById.mockResolvedValue(null as never);

      await expect(reactivateEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: false,
        error: "Colaborador no encontrado.",
      });
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
    });

    it("marca el colaborador como activo dentro del salón", async () => {
      await expect(reactivateEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: true,
        value: undefined,
      });

      expect(mockedUpdateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        is_active: true,
      });
    });

    it("devuelve error genérico y registra el fallo al actualizar", async () => {
      const failure = new Error("caido");
      mockedUpdateEmployee.mockRejectedValue(failure);

      await expect(reactivateEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: false,
        error: "No se pudo reactivar el colaborador.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "lifecycle",
      });
    });
  });

  describe("archiveEmployee", () => {
    it("no archiva un colaborador que no existe en el salón", async () => {
      mockedFindEmployeeById.mockResolvedValue(null as never);

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: false,
        error: "Colaborador no encontrado.",
      });
      expect(mockedCheckRevocable).not.toHaveBeenCalled();
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
    });

    it("un owner vinculado no escribe nada ni toca Auth", async () => {
      mockedCheckRevocable.mockResolvedValue({ ok: false, error: OWNER_MESSAGE });

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: false,
        error: OWNER_MESSAGE,
      });
      expect(mockedClearInvitations).not.toHaveBeenCalled();
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
      expect(mockedDeleteAuthAccount).not.toHaveBeenCalled();
    });

    it("si la escritura en BD falla, no borra la cuenta de Auth", async () => {
      const failure = new Error("caido");
      mockedUpdateEmployee.mockRejectedValue(failure);

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: false,
        error: "No se pudo archivar el colaborador.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "lifecycle",
      });
      expect(mockedDeleteAuthAccount).not.toHaveBeenCalled();
    });

    it("si la limpieza de invitaciones falla, no desactiva ni borra la cuenta", async () => {
      mockedClearInvitations.mockResolvedValue({ ok: false, error: "No se pudo limpiar la invitación del colaborador." });

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: false,
        error: "No se pudo limpiar la invitación del colaborador.",
      });
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
      expect(mockedDeleteAuthAccount).not.toHaveBeenCalled();
    });

    it("si Auth falla después de la BD, devuelve ok con aviso", async () => {
      mockedDeleteAuthAccount.mockResolvedValue({ ok: false, error: "No se pudo revocar la cuenta anterior del colaborador." });

      const result = await archiveEmployee(EMPLOYEE_ID, SALON_ID);

      expect(mockedUpdateEmployee).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Colaborador archivado conservando su información para trazabilidad.",
        },
        warnings: [OLD_ACCOUNT_NOT_DELETED_WARNING],
      });
    });

    it("escribe en BD antes de borrar la cuenta de Auth", async () => {
      await archiveEmployee(EMPLOYEE_ID, SALON_ID);

      expect(mockedCheckRevocable.mock.invocationCallOrder[0]).toBeLessThan(
        mockedUpdateEmployee.mock.invocationCallOrder[0] ?? Infinity
      );
      expect(mockedUpdateEmployee.mock.invocationCallOrder[0]).toBeLessThan(
        mockedDeleteAuthAccount.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("camino feliz: desactiva, desvincula y borra la cuenta conservando el historial", async () => {
      const result = await archiveEmployee(EMPLOYEE_ID, SALON_ID);

      expect(result).toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Colaborador archivado conservando su información para trazabilidad.",
        },
      });
      expect(mockedCheckRevocable).toHaveBeenCalledWith("profile-1", SALON_ID);
      expect(mockedClearInvitations).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(mockedUpdateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        is_active: false,
        profile_id: null,
      });
      expect(mockedDeleteAuthAccount).toHaveBeenCalledWith("profile-1");
    });

    it("sin perfil vinculado no consulta ni borra cuentas de Auth", async () => {
      mockedFindEmployeeById.mockResolvedValue({ id: EMPLOYEE_ID, profile_id: null } as never);

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Colaborador archivado conservando su información para trazabilidad.",
        },
      });
      expect(mockedCheckRevocable).not.toHaveBeenCalled();
      expect(mockedDeleteAuthAccount).not.toHaveBeenCalled();
    });
  });
});
