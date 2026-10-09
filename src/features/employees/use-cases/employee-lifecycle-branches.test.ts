import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { findEmployeeById, updateEmployee } from "../data/employees.repo";
import { revokeEmployeeAccessForArchive } from "./employee-access";
import { archiveEmployee, reactivateEmployee } from "./employee-lifecycle";

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

vi.mock("./employee-access", () => ({
  revokeEmployeeAccessForArchive: vi.fn(),
}));

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";

const mockedCaptureError = vi.mocked(captureError);
const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedUpdateEmployee = vi.mocked(updateEmployee);
const mockedRevokeForArchive = vi.mocked(revokeEmployeeAccessForArchive);

describe("employee lifecycle branches", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployeeById.mockResolvedValue({
      id: EMPLOYEE_ID,
      profile_id: "profile-1",
    } as never);
    mockedUpdateEmployee.mockResolvedValue({} as never);
    mockedRevokeForArchive.mockResolvedValue({ ok: true, value: undefined });
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
      expect(mockedRevokeForArchive).not.toHaveBeenCalled();
    });

    it("revoca el acceso con el perfil vinculado antes de desactivar", async () => {
      await archiveEmployee(EMPLOYEE_ID, SALON_ID);

      expect(mockedRevokeForArchive).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        profileId: "profile-1",
      });
      expect(mockedRevokeForArchive.mock.invocationCallOrder[0]).toBeLessThan(
        mockedUpdateEmployee.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("pasa un perfil nulo cuando el colaborador nunca tuvo acceso", async () => {
      mockedFindEmployeeById.mockResolvedValue({ id: EMPLOYEE_ID, profile_id: null } as never);

      await archiveEmployee(EMPLOYEE_ID, SALON_ID);

      expect(mockedRevokeForArchive).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: null })
      );
    });

    it("no desactiva ni desvincula si la revocación falla, y devuelve su error", async () => {
      mockedRevokeForArchive.mockResolvedValue({ ok: false, error: "No se pudo revocar." });

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID)).resolves.toEqual({
        ok: false,
        error: "No se pudo revocar.",
      });
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
    });

    it("desactiva y desvincula el perfil conservando el historial", async () => {
      const result = await archiveEmployee(EMPLOYEE_ID, SALON_ID);

      expect(result).toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Colaborador archivado conservando su información para trazabilidad.",
        },
      });
      expect(mockedUpdateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        is_active: false,
        profile_id: null,
      });
    });

    it("devuelve error genérico y registra el fallo al desactivar", async () => {
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
    });
  });
});
