import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { clearEmployeeInvitations } from "./employee-invitation-issue";
import { checkEmployeeAccessRevocable, deleteEmployeeAuthAccount } from "./employee-revocation";
import {
  archiveEmployee,
  reactivateEmployee,
  type EmployeeLifecycleDeps,
} from "./employee-lifecycle";
import { OLD_ACCOUNT_NOT_DELETED_WARNING } from "./employee-access-warnings";

// Ramas de error de reactivar y archivar colaboradores, y del orden de la
// revocación de acceso: el perfil se desvincula solo si el archivado llega a
// guardarse.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

const mockedCaptureError = vi.mocked(captureError);
const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const OWNER_MESSAGE = "No se puede modificar el acceso de un owner desde colaboradores.";

function fakeLifecycleDeps() {
  return {
    findEmployee: vi.fn<EmployeeLifecycleDeps["findEmployee"]>(),
    updateEmployee: vi.fn<EmployeeLifecycleDeps["updateEmployee"]>(),
    clearInvitations: vi.fn<typeof clearEmployeeInvitations>(),
    checkAccessRevocable: vi.fn<typeof checkEmployeeAccessRevocable>(),
    deleteAuthAccount: vi.fn<typeof deleteEmployeeAuthAccount>(),
  } satisfies Record<keyof EmployeeLifecycleDeps, unknown>;
}

describe("employee lifecycle branches", () => {
  let deps: ReturnType<typeof fakeLifecycleDeps>;

  beforeEach(() => {
    vi.resetAllMocks();
    deps = fakeLifecycleDeps();
    deps.findEmployee.mockResolvedValue({ profile_id: "profile-1" });
    deps.updateEmployee.mockResolvedValue({});
    deps.checkAccessRevocable.mockResolvedValue({ ok: true, value: { roleId: null } });
    deps.clearInvitations.mockResolvedValue({ ok: true, value: undefined });
    deps.deleteAuthAccount.mockResolvedValue({ ok: true, value: undefined });
  });

  describe("reactivateEmployee", () => {
    it("no reactiva un colaborador que no existe en el salón", async () => {
      deps.findEmployee.mockResolvedValue(null);

      await expect(reactivateEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
        ok: false,
        error: "Colaborador no encontrado.",
      });
      expect(deps.updateEmployee).not.toHaveBeenCalled();
    });

    it("marca el colaborador como activo dentro del salón", async () => {
      await expect(reactivateEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
        ok: true,
        value: undefined,
      });

      expect(deps.updateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        is_active: true,
      });
    });

    it("devuelve error genérico y registra el fallo al actualizar", async () => {
      const failure = new Error("caido");
      deps.updateEmployee.mockRejectedValue(failure);

      await expect(reactivateEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
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
      deps.findEmployee.mockResolvedValue(null);

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
        ok: false,
        error: "Colaborador no encontrado.",
      });
      expect(deps.checkAccessRevocable).not.toHaveBeenCalled();
      expect(deps.updateEmployee).not.toHaveBeenCalled();
    });

    it("un owner vinculado no escribe nada ni toca Auth", async () => {
      deps.checkAccessRevocable.mockResolvedValue({ ok: false, error: OWNER_MESSAGE });

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
        ok: false,
        error: OWNER_MESSAGE,
      });
      expect(deps.clearInvitations).not.toHaveBeenCalled();
      expect(deps.updateEmployee).not.toHaveBeenCalled();
      expect(deps.deleteAuthAccount).not.toHaveBeenCalled();
    });

    it("si la escritura en BD falla, no borra la cuenta de Auth", async () => {
      const failure = new Error("caido");
      deps.updateEmployee.mockRejectedValue(failure);

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
        ok: false,
        error: "No se pudo archivar el colaborador.",
      });
      expect(mockedCaptureError).toHaveBeenCalledWith(failure, {
        module: "employees",
        action: "lifecycle",
      });
      expect(deps.deleteAuthAccount).not.toHaveBeenCalled();
    });

    it("si la limpieza de invitaciones falla, no desactiva ni borra la cuenta", async () => {
      deps.clearInvitations.mockResolvedValue({ ok: false, error: "No se pudo limpiar la invitación del colaborador." });

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
        ok: false,
        error: "No se pudo limpiar la invitación del colaborador.",
      });
      expect(deps.updateEmployee).not.toHaveBeenCalled();
      expect(deps.deleteAuthAccount).not.toHaveBeenCalled();
    });

    it("si Auth falla después de la BD, devuelve ok con aviso", async () => {
      deps.deleteAuthAccount.mockResolvedValue({ ok: false, error: "No se pudo revocar la cuenta anterior del colaborador." });

      const result = await archiveEmployee(EMPLOYEE_ID, SALON_ID, deps);

      expect(deps.updateEmployee).toHaveBeenCalledTimes(1);
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
      await archiveEmployee(EMPLOYEE_ID, SALON_ID, deps);

      expect(deps.checkAccessRevocable.mock.invocationCallOrder[0]).toBeLessThan(
        deps.updateEmployee.mock.invocationCallOrder[0] ?? Infinity
      );
      expect(deps.updateEmployee.mock.invocationCallOrder[0]).toBeLessThan(
        deps.deleteAuthAccount.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("camino feliz: desactiva, desvincula y borra la cuenta conservando el historial", async () => {
      const result = await archiveEmployee(EMPLOYEE_ID, SALON_ID, deps);

      expect(result).toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Colaborador archivado conservando su información para trazabilidad.",
        },
      });
      expect(deps.checkAccessRevocable).toHaveBeenCalledWith("profile-1", SALON_ID);
      expect(deps.clearInvitations).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(deps.updateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        is_active: false,
        profile_id: null,
      });
      expect(deps.deleteAuthAccount).toHaveBeenCalledWith("profile-1");
    });

    it("sin perfil vinculado no consulta ni borra cuentas de Auth", async () => {
      deps.findEmployee.mockResolvedValue({ profile_id: null });

      await expect(archiveEmployee(EMPLOYEE_ID, SALON_ID, deps)).resolves.toEqual({
        ok: true,
        value: {
          outcome: "archived",
          message: "Colaborador archivado conservando su información para trazabilidad.",
        },
      });
      expect(deps.checkAccessRevocable).not.toHaveBeenCalled();
      expect(deps.deleteAuthAccount).not.toHaveBeenCalled();
    });
  });
});
