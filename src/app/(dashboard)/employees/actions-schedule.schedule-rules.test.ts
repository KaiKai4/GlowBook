import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess, isEffectiveSalonModuleEnabled } from "@/features/billing";
import { addEmployeeWorkSchedule, removeEmployeeWorkSchedule } from "@/features/employees/use-cases/employee-schedule";
import { addEmployeeScheduleException, removeEmployeeScheduleException } from "@/features/employees/use-cases/employee-exceptions";
import { getSalonSchedulingConfig } from "@/features/salon/use-cases/salon-scheduling-config";
import { err, ok } from "@/infra/result";
import { buildProfile, formDataOf, SALON_ID } from "@/test/action-fixtures";
import { addWorkScheduleAction, deleteWorkScheduleAction, addScheduleExceptionAction, removeScheduleExceptionAction } from "./actions-schedule";

const { requireActiveProfile } = vi.hoisted(() => ({ requireActiveProfile: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", async () => {
  // requireActionContext deriva el contexto minimo del mismo mock de perfil que usa el test.
  const { contextFromProfile } = await import("@/test/action-fixtures");
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
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-role", () => ({
  changeEmployeeRole: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-invitation-issue", () => ({
  createEmployeeInviteForExistingEmployee: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-revocation", () => ({
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

function employeeForm(values: Record<string, string>): FormData {
  return formDataOf({ idempotency_key: IDEMPOTENCY_KEY, ...values });
}
const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const SCHEDULE_ID = "00000000-0000-4000-8000-0000000000c1";
const EXCEPTION_ID = "00000000-0000-4000-8000-0000000000c2";
const INVALID = { ok: false, error: "Identificador inválido." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000f1";

describe("employees actions (horario y excepciones)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(getSalonSchedulingConfig).mockResolvedValue({
      salonConfig: {
        min_booking_notice_minutes: 0,
        min_appointment_duration_minutes: 30,
        allow_off_hours_bookings: false,
        timezone: "America/Panama",
      },
      businessHours: [],
    });
  });

  describe("addWorkScheduleAction", () => {
    it("rechaza un horario con formato de hora inválido", async () => {
      const form = employeeForm({
        employee_id: EMPLOYEE_ID,
        day_of_week: "1",
        start_time: "9am",
        end_time: "18:00",
      });

      expect((await addWorkScheduleAction(null, form)).ok).toBe(false);
      expect(addEmployeeWorkSchedule).not.toHaveBeenCalled();
    });

    it("añade el turno y revalida la ficha del colaborador", async () => {
      vi.mocked(addEmployeeWorkSchedule).mockResolvedValue(ok(undefined));
      const form = employeeForm({
        employee_id: EMPLOYEE_ID,
        day_of_week: "2",
        start_time: "09:00",
        end_time: "18:00",
      });

      expect(await addWorkScheduleAction(null, form)).toEqual(ok(undefined));
      expect(addEmployeeWorkSchedule).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({ employee_id: EMPLOYEE_ID, day_of_week: 2, start_time: "09:00" })
      );
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
    });

    it("no revalida cuando el turno no se puede añadir", async () => {
      vi.mocked(addEmployeeWorkSchedule).mockResolvedValue(err("Solapa con otro turno."));
      const form = employeeForm({
        employee_id: EMPLOYEE_ID,
        day_of_week: "2",
        start_time: "09:00",
        end_time: "18:00",
      });

      expect(await addWorkScheduleAction(null, form)).toEqual({ ok: false, error: "Solapa con otro turno." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("deleteWorkScheduleAction", () => {
    it("rechaza un scheduleId inválido", async () => {
      expect(await deleteWorkScheduleAction("turno", EMPLOYEE_ID)).toEqual(INVALID);
      expect(removeEmployeeWorkSchedule).not.toHaveBeenCalled();
    });

    it("rechaza un employeeId inválido", async () => {
      expect(await deleteWorkScheduleAction(SCHEDULE_ID, "empleado")).toEqual(INVALID);
      expect(removeEmployeeWorkSchedule).not.toHaveBeenCalled();
    });

    it("elimina el turno del salón y revalida la ficha", async () => {
      vi.mocked(removeEmployeeWorkSchedule).mockResolvedValue(ok(undefined));

      expect(await deleteWorkScheduleAction(SCHEDULE_ID, EMPLOYEE_ID)).toEqual(ok(undefined));
      expect(removeEmployeeWorkSchedule).toHaveBeenCalledWith(SALON_ID, SCHEDULE_ID);
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
    });

    it("no revalida cuando la eliminación falla", async () => {
      vi.mocked(removeEmployeeWorkSchedule).mockResolvedValue(err("No encontrado."));

      expect(await deleteWorkScheduleAction(SCHEDULE_ID, EMPLOYEE_ID)).toEqual({ ok: false, error: "No encontrado." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("addScheduleExceptionAction", () => {
    it("rechaza un employeeId inválido sin leer la configuración del salón", async () => {
      expect(await addScheduleExceptionAction("x", "2026-10-20", "Feriado")).toEqual(INVALID);
      expect(getSalonSchedulingConfig).not.toHaveBeenCalled();
      expect(addEmployeeScheduleException).not.toHaveBeenCalled();
    });

    it("registra la excepción con la zona horaria del salón y revalida ficha y agenda", async () => {
      vi.mocked(addEmployeeScheduleException).mockResolvedValue(ok(undefined));

      expect(await addScheduleExceptionAction(EMPLOYEE_ID, "2026-10-20", "Feriado")).toEqual(ok(undefined));
      expect(getSalonSchedulingConfig).toHaveBeenCalledWith(SALON_ID);
      expect(addEmployeeScheduleException).toHaveBeenCalledWith({
        salonId: SALON_ID,
        employeeId: EMPLOYEE_ID,
        exceptionDate: "2026-10-20",
        reason: "Feriado",
        timezone: "America/Panama",
      });
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
      expect(revalidatePath).toHaveBeenCalledWith("/appointments");
    });

    it("no revalida cuando la fecha de la excepción es inválida", async () => {
      vi.mocked(addEmployeeScheduleException).mockResolvedValue(err("Selecciona una fecha válida."));

      expect(await addScheduleExceptionAction(EMPLOYEE_ID, "20/10", "")).toEqual({
        ok: false,
        error: "Selecciona una fecha válida.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("removeScheduleExceptionAction", () => {
    it("rechaza un employeeId o exceptionId inválido", async () => {
      expect(await removeScheduleExceptionAction("x", EXCEPTION_ID)).toEqual(INVALID);
      expect(await removeScheduleExceptionAction(EMPLOYEE_ID, "x")).toEqual(INVALID);
      expect(removeEmployeeScheduleException).not.toHaveBeenCalled();
    });

    it("elimina la excepción del salón y revalida ficha y agenda", async () => {
      vi.mocked(removeEmployeeScheduleException).mockResolvedValue(ok(undefined));

      expect(await removeScheduleExceptionAction(EMPLOYEE_ID, EXCEPTION_ID)).toEqual(ok(undefined));
      expect(removeEmployeeScheduleException).toHaveBeenCalledWith(SALON_ID, EMPLOYEE_ID, EXCEPTION_ID);
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
      expect(revalidatePath).toHaveBeenCalledWith("/appointments");
    });

    it("no revalida cuando la eliminación falla", async () => {
      vi.mocked(removeEmployeeScheduleException).mockResolvedValue(err("No encontrada."));

      expect(await removeScheduleExceptionAction(EMPLOYEE_ID, EXCEPTION_ID)).toEqual({
        ok: false,
        error: "No encontrada.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
