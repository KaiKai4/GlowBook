import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { changeEmployeeRole } from "@/features/employees/use-cases/employee-role";
import { createEmployeeInviteForExistingEmployee } from "@/features/employees/use-cases/employee-invitation-issue";
import { resetEmployeeAccess } from "@/features/employees/use-cases/employee-revocation";
import { getSalonSchedulingConfig } from "@/features/salon/use-cases/salon-scheduling-config";
import { err, ok } from "@/infra/result";
import { buildProfile, rolesDisabled, SALON_ID } from "@/test/action-fixtures";
import { changeEmployeeRoleAction, resetEmployeeAccessAction, generateEmployeeInviteAction } from "./actions-access";

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
vi.mock("@/features/employees/use-cases/employee-profile", () => ({
  createEmployeeProfile: vi.fn(),
  findArchivedEmployeeByEmail: vi.fn(),
  updateEmployeeProfile: vi.fn(),
}));
vi.mock("@/features/salon/use-cases/salon-scheduling-config", () => ({
  getSalonSchedulingConfig: vi.fn(),
}));

const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const ROLE_ID = "00000000-0000-4000-8000-0000000000ff";
const INVALID = { ok: false, error: "Identificador inválido." } as const;
const ROLES_DISABLED = { ok: false, error: "Los roles estan deshabilitados para este salon." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });
const INVITE = { token: "tok-123", expiresAt: "2026-10-10T00:00:00.000Z" };

describe("employees actions (acceso y roles, p2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveProfile).mockResolvedValue(manager);
    vi.mocked(assertActionRateLimit).mockResolvedValue(ok(undefined));
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

  describe("changeEmployeeRoleAction", () => {
    it("rechaza un profileId que no es UUID", async () => {
      expect(await changeEmployeeRoleAction("perfil", ROLE_ID)).toEqual(INVALID);
      expect(changeEmployeeRole).not.toHaveBeenCalled();
    });

    it("rechaza un roleId que no es UUID y no nulo", async () => {
      expect(await changeEmployeeRoleAction(EMPLOYEE_ID, "rol")).toEqual(INVALID);
      expect(changeEmployeeRole).not.toHaveBeenCalled();
    });

    it("rechaza cambiar rol cuando el módulo de roles está deshabilitado", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(rolesDisabled(manager));

      expect(await changeEmployeeRoleAction(EMPLOYEE_ID, ROLE_ID)).toEqual(ROLES_DISABLED);
      expect(changeEmployeeRole).not.toHaveBeenCalled();
    });

    it("quita el rol cuando se pasa null", async () => {
      vi.mocked(changeEmployeeRole).mockResolvedValue(ok(undefined));

      expect(await changeEmployeeRoleAction(EMPLOYEE_ID, null)).toEqual(ok(undefined));
      expect(changeEmployeeRole).toHaveBeenCalledWith(SALON_ID, EMPLOYEE_ID, null);
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
    });

    it("asigna el rol y no revalida si el caso de uso falla", async () => {
      vi.mocked(changeEmployeeRole).mockResolvedValue(err("El rol no existe."));

      expect(await changeEmployeeRoleAction(EMPLOYEE_ID, ROLE_ID)).toEqual({
        ok: false,
        error: "El rol no existe.",
      });
      expect(changeEmployeeRole).toHaveBeenCalledWith(SALON_ID, EMPLOYEE_ID, ROLE_ID);
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("resetEmployeeAccessAction", () => {
    it("rechaza un employeeId que no es UUID", async () => {
      expect(await resetEmployeeAccessAction("x", ROLE_ID)).toEqual(INVALID);
      expect(resetEmployeeAccess).not.toHaveBeenCalled();
    });

    it("rechaza un roleId inválido", async () => {
      expect(await resetEmployeeAccessAction(EMPLOYEE_ID, "rol")).toEqual(INVALID);
      expect(resetEmployeeAccess).not.toHaveBeenCalled();
    });

    it("rechaza cuando los roles están deshabilitados", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(rolesDisabled(manager));

      expect(await resetEmployeeAccessAction(EMPLOYEE_ID, null)).toEqual(ROLES_DISABLED);
      expect(resetEmployeeAccess).not.toHaveBeenCalled();
    });

    it("devuelve el error de invitación sin revalidar", async () => {
      vi.mocked(resetEmployeeAccess).mockResolvedValue(err("No se pudo generar el enlace."));

      expect(await resetEmployeeAccessAction(EMPLOYEE_ID, ROLE_ID)).toEqual({
        ok: false,
        error: "No se pudo generar el enlace.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("restablece el acceso con el rol indicado y revalida ficha y lista", async () => {
      vi.mocked(resetEmployeeAccess).mockResolvedValue(ok(INVITE));

      expect(await resetEmployeeAccessAction(EMPLOYEE_ID, ROLE_ID)).toEqual(ok(INVITE));
      expect(resetEmployeeAccess).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: ROLE_ID,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
    });

    it("normaliza un rol nulo a null al restablecer acceso", async () => {
      vi.mocked(resetEmployeeAccess).mockResolvedValue(ok(INVITE));

      await resetEmployeeAccessAction(EMPLOYEE_ID, null);

      expect(resetEmployeeAccess).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });
    });
  });

  describe("generateEmployeeInviteAction", () => {
    it("rechaza identificadores inválidos", async () => {
      expect(await generateEmployeeInviteAction("x", ROLE_ID)).toEqual(INVALID);
      expect(await generateEmployeeInviteAction(EMPLOYEE_ID, "rol")).toEqual(INVALID);
      expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
    });

    it("rechaza cuando los roles están deshabilitados", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(rolesDisabled(manager));

      expect(await generateEmployeeInviteAction(EMPLOYEE_ID, ROLE_ID)).toEqual(ROLES_DISABLED);
      expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
    });

    it("bloquea la invitación cuando no hay cupo de usuarios con login", async () => {
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Sin cupo de usuarios con acceso."));

      expect(await generateEmployeeInviteAction(EMPLOYEE_ID, ROLE_ID)).toEqual({
        ok: false,
        error: "Sin cupo de usuarios con acceso.",
      });
      expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "employees.login_users" });
      expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
    });

    it("genera la invitación con rol nulo cuando no se indica rol y revalida la ficha", async () => {
      vi.mocked(createEmployeeInviteForExistingEmployee).mockResolvedValue(ok(INVITE));

      expect(await generateEmployeeInviteAction(EMPLOYEE_ID, null)).toEqual(ok(INVITE));
      expect(createEmployeeInviteForExistingEmployee).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        roleId: null,
      });
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
    });

    it("no revalida cuando la invitación falla", async () => {
      vi.mocked(createEmployeeInviteForExistingEmployee).mockResolvedValue(err("Ya tiene acceso."));

      expect(await generateEmployeeInviteAction(EMPLOYEE_ID, ROLE_ID)).toEqual({
        ok: false,
        error: "Ya tiene acceso.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
