import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess, isEffectiveSalonModuleEnabled } from "@/features/billing";
import { changeEmployeeRole, resetEmployeeAccess } from "@/features/employees/use-cases/employee-access";
import { archiveEmployee } from "@/features/employees/use-cases/employee-lifecycle";
import { addEmployeeWorkSchedule } from "@/features/employees/use-cases/employee-schedule";
import {
  createEmployeeProfile,
  updateEmployeeProfile,
} from "@/features/employees/use-cases/employee-profile";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import {
  addWorkScheduleAction,
  changeEmployeeRoleAction,
  createEmployeeAction,
  deleteEmployeeAction,
  resetEmployeeAccessAction,
  updateEmployeeAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-access", () => ({
  changeEmployeeRole: vi.fn(),
  createEmployeeInviteForExistingEmployee: vi.fn(),
  resetEmployeeAccess: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-lifecycle", () => ({
  archiveEmployee: vi.fn(),
  reactivateEmployee: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-schedule", () => ({
  addEmployeeWorkSchedule: vi.fn(),
  removeEmployeeWorkSchedule: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-exceptions", () => ({
  addEmployeeScheduleException: vi.fn(),
  removeEmployeeScheduleException: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-profile", () => ({
  createEmployeeProfile: vi.fn(),
  findArchivedEmployeeByEmail: vi.fn(),
  updateEmployeeProfile: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-scheduling-config", () => ({
  getSalonSchedulingConfig: vi.fn(),
}));

const employeesManager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });
const permissionError = "No tienes permiso para gestionar colaboradores.";
const rolesDisabledError = "Los roles estan deshabilitados para este salon.";
const validEmployee = { first_name: "Marta", last_name: "Ruiz", phone: "61234567" };
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000f1";

// Las escrituras criticas de colaboradores exigen idempotency_key en el FormData.
function employeeForm(values: Record<string, string>): FormData {
  return formDataOf({ idempotency_key: IDEMPOTENCY_KEY, ...values });
}

describe("employees actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(employeesManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
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
      vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
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

  describe("roles de acceso", () => {
    it("cambiar rol y resetear acceso se bloquean si los roles están deshabilitados", async () => {
      vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

      expect(await changeEmployeeRoleAction(RECORD_ID, RECORD_ID)).toEqual({
        ok: false,
        error: rolesDisabledError,
      });
      expect(await resetEmployeeAccessAction(RECORD_ID, RECORD_ID)).toEqual({
        ok: false,
        error: rolesDisabledError,
      });
      expect(changeEmployeeRole).not.toHaveBeenCalled();
      expect(resetEmployeeAccess).not.toHaveBeenCalled();
    });

    it("cambia el rol del colaborador y revalida solo si tiene éxito", async () => {
      vi.mocked(changeEmployeeRole).mockResolvedValue(ok(undefined));

      expect(await changeEmployeeRoleAction(RECORD_ID, null)).toEqual({ ok: true, value: undefined });
      expect(changeEmployeeRole).toHaveBeenCalledWith(SALON_ID, RECORD_ID, null);
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
    });

    it("el reseteo de acceso devuelve el enlace y revalida el listado y la ficha", async () => {
      const invite = { ok: true as const, value: { token: "t-1", expiresAt: "2026-10-10T00:00:00.000Z" } };
      vi.mocked(resetEmployeeAccess).mockResolvedValue(invite);

      expect(await resetEmployeeAccessAction(RECORD_ID, RECORD_ID)).toEqual(invite);
      expect(resetEmployeeAccess).toHaveBeenCalledWith({
        employeeId: RECORD_ID,
        salonId: SALON_ID,
        roleId: RECORD_ID,
      });
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${RECORD_ID}`);
    });

    it("el reseteo fallido no revalida", async () => {
      vi.mocked(resetEmployeeAccess).mockResolvedValue(err("El colaborador no tiene email."));

      expect(await resetEmployeeAccessAction(RECORD_ID, null)).toEqual({
        ok: false,
        error: "El colaborador no tiene email.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("horario de trabajo", () => {
    it("no persiste un horario con formato de hora inválido", async () => {
      const result = await addWorkScheduleAction(
        null,
        employeeForm({
          employee_id: RECORD_ID,
          day_of_week: "1",
          start_time: "9am",
          end_time: "18:00",
        })
      );

      expect(result.ok).toBe(false);
      expect(addEmployeeWorkSchedule).not.toHaveBeenCalled();
    });

    it("añade el horario válido y revalida la ficha del colaborador", async () => {
      vi.mocked(addEmployeeWorkSchedule).mockResolvedValue(ok(undefined));

      const result = await addWorkScheduleAction(
        null,
        employeeForm({
          employee_id: RECORD_ID,
          day_of_week: "1",
          start_time: "09:00",
          end_time: "18:00",
        })
      );

      expect(result).toEqual({ ok: true, value: undefined });
      expect(addEmployeeWorkSchedule).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ employee_id: RECORD_ID, day_of_week: 1, start_time: "09:00" })
      );
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${RECORD_ID}`);
    });
  });
});
