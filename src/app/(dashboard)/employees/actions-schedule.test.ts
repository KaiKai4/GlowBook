import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess, isEffectiveSalonModuleEnabled } from "@/features/billing";
import { addEmployeeWorkSchedule } from "@/features/employees/use-cases/employee-schedule";
import { ok } from "@/infra/result";
import { buildProfile, formDataOf, RECORD_ID, SALON_ID } from "@/test/action-fixtures";
import { addWorkScheduleAction } from "./actions-schedule";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_composition/request-context", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/infra/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  checkPlanLimit: vi.fn(),
  checkPlanModuleAccess: vi.fn(),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-schedule", () => ({
  addEmployeeWorkSchedule: vi.fn(),
  removeEmployeeWorkSchedule: vi.fn(),
}));
vi.mock("@/features/employees/use-cases/employee-exceptions", () => ({
  addEmployeeScheduleException: vi.fn(),
  removeEmployeeScheduleException: vi.fn(),
}));

const employeesManager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });

function employeeForm(values: Record<string, string>): FormData {
  return formDataOf({ idempotency_key: "00000000-0000-4000-8000-0000000000f1", ...values });
}

describe("employees actions (horario de trabajo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(employeesManager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanModuleAccess).mockResolvedValue(ok(undefined));
    vi.mocked(checkPlanLimit).mockResolvedValue(ok(undefined));
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
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
