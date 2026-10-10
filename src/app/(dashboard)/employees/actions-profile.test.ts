import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { changeEmployeeRole } from "@/features/employees/use-cases/employee-role";
import { archiveEmployee } from "@/features/employees/use-cases/employee-lifecycle";
import { createEmployeeProfile } from "@/features/employees/use-cases/employee-profile-create";
import { updateEmployeeProfile } from "@/features/employees/use-cases/employee-profile-update";
import { err, ok } from "@/infra/result";
import { buildProfile, rolesDisabled, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import { changeEmployeeRoleAction } from "./actions-access";
import {
  createEmployeeAction,
  deleteEmployeeAction,
  updateEmployeeAction,
} from "./actions-profile";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
  const requireActiveProfile = vi.fn();
  return {
    requireActiveProfile,
    requireActionContext: vi.fn(async () => contextFromProfile(await requireActiveProfile())),
  };
});
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-role", () => ({
  changeEmployeeRole: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-lifecycle", () => ({
  archiveEmployee: vi.fn(),
  reactivateEmployee: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-profile-create", () => ({
  createEmployeeProfile: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-profile-update", () => ({
  updateEmployeeProfile: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-profile-steps", () => ({
  findArchivedEmployeeByEmail: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-scheduling-config", () => ({
  getSalonSchedulingConfig: vi.fn(),
}));

const employeesManager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });
const permissionError = "No tienes permiso para gestionar colaboradores.";
const validEmployee = { first_name: "Marta", last_name: "Ruiz", phone: "61234567" };
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000f1";

// Las escrituras criticas de colaboradores exigen idempotency_key en el FormData.
function employeeForm(values: Record<string, string>): FormData {
  return formDataOf({ idempotency_key: IDEMPOTENCY_KEY, ...values });
}

describe("employees actions (ficha del colaborador)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(employeesManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
  });

  describe("guard compartido", () => {
    it("rechaza sin permiso de colaboradores en todas las mutaciones", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await deleteEmployeeAction(RECORD_ID)).toEqual({ ok: false, error: permissionError });
      expect(await changeEmployeeRoleAction(RECORD_ID, null)).toEqual({ ok: false, error: permissionError });
      expect(archiveEmployee).not.toHaveBeenCalled();
      expect(changeEmployeeRole).not.toHaveBeenCalled();
    });

    it("rechaza cuando el límite de peticiones está agotado", async () => {
      vi.mocked(assertActionRateLimit).mockResolvedValue(err("Demasiados intentos."));

      expect(await deleteEmployeeAction(RECORD_ID)).toEqual({ ok: false, error: "Demasiados intentos." });
      expect(archiveEmployee).not.toHaveBeenCalled();
    });
  });

  describe("createEmployeeAction", () => {
    it("propaga el rechazo del módulo de colaboradores y del límite de activos", async () => {
      vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Módulo no incluido en tu plan."));
      expect(await createEmployeeAction(null, employeeForm(validEmployee))).toEqual({
        ok: false,
        error: "Módulo no incluido en tu plan.",
      });

      vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de colaboradores alcanzado."));
      expect(await createEmployeeAction(null, employeeForm(validEmployee))).toEqual({
        ok: false,
        error: "Límite de colaboradores alcanzado.",
      });
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("exige cupo de usuarios con acceso cuando se asigna rol y rechaza si no hay cupo", async () => {
      vi.mocked(checkPlanLimit)
        .mockResolvedValueOnce(ok(undefined))
        .mockResolvedValueOnce(err("Límite de usuarios con acceso alcanzado."));

      const result = await createEmployeeAction(
        null,
        employeeForm({ ...validEmployee, role_id: RECORD_ID })
      );

      expect(result).toEqual({ ok: false, error: "Límite de usuarios con acceso alcanzado." });
      expect(checkPlanLimit).toHaveBeenLastCalledWith({
        salonId: SALON_ID,
        metricKey: "employees.login_users",
      });
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("devuelve el primer issue de Zod cuando falta el nombre", async () => {
      expect(await createEmployeeAction(null, employeeForm({ ...validEmployee, first_name: "" }))).toEqual({
        ok: false,
        error: "El nombre es obligatorio",
      });
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("crea el colaborador con el rol cuando los roles están habilitados y revalida", async () => {
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: "emp-1" }));

      await createEmployeeAction(null, employeeForm({ ...validEmployee, role_id: RECORD_ID }));

      expect(createEmployeeProfile).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ first_name: "Marta", last_name: "Ruiz" }),
        RECORD_ID,
        IDEMPOTENCY_KEY
      );
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
    });

    it("ignora el rol cuando el módulo de roles está deshabilitado", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(rolesDisabled(employeesManager));
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: "emp-2" }));

      await createEmployeeAction(null, employeeForm({ ...validEmployee, role_id: RECORD_ID }));

      expect(checkPlanLimit).not.toHaveBeenCalledWith(
        expect.objectContaining({ metricKey: "employees.login_users" })
      );
      expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), null, expect.any(String));
    });
  });

  describe("updateEmployeeAction", () => {
    it("devuelve el primer issue de Zod cuando el nombre queda vacío", async () => {
      expect(await updateEmployeeAction(RECORD_ID, null, employeeForm({ first_name: "" }))).toEqual({
        ok: false,
        error: "El nombre es obligatorio",
      });
      expect(updateEmployeeProfile).not.toHaveBeenCalled();
    });

    it("actualiza el perfil y revalida el listado y la ficha", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(ok({}));

      expect(await updateEmployeeAction(RECORD_ID, null, employeeForm({ specialty: "Color" }))).toEqual({
        ok: true,
        value: {},
      });
      expect(updateEmployeeProfile).toHaveBeenCalledWith(
        RECORD_ID,
        SALON_ID,
        expect.objectContaining({ specialty: "Color" }),
        IDEMPOTENCY_KEY
      );
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${RECORD_ID}`);
    });
  });
});
