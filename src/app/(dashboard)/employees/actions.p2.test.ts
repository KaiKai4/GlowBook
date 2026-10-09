import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireActiveProfile } from "@/lib/auth/session";
import { assertActionRateLimit } from "@/lib/security/rate-limit";
import {
  checkPlanLimit,
  checkPlanModuleAccess,
  isEffectiveSalonModuleEnabled,
} from "@/features/billing/use-cases/commercial-plans";
import {
  changeEmployeeRole,
  createEmployeeInviteForExistingEmployee,
  resetEmployeeAccess,
} from "@/features/employees/use-cases/employee-access";
import { archiveEmployee, reactivateEmployee } from "@/features/employees/use-cases/employee-lifecycle";
import {
  addEmployeeWorkSchedule,
  removeEmployeeWorkSchedule,
} from "@/features/employees/use-cases/employee-schedule";
import {
  addEmployeeScheduleException,
  removeEmployeeScheduleException,
} from "@/features/employees/use-cases/employee-exceptions";
import {
  createEmployeeProfile,
  findArchivedEmployeeByEmail,
  updateEmployeeProfile,
} from "@/features/employees/use-cases/employee-profile";
import { getSalonSchedulingConfig } from "@/features/salon/use-cases/salon-scheduling-config";
import { err, ok } from "@/lib/result";
import { buildProfile, formDataOf, SALON_ID } from "@/test/action-fixtures";
import {
  addScheduleExceptionAction,
  addWorkScheduleAction,
  changeEmployeeRoleAction,
  createEmployeeAction,
  deleteEmployeeAction,
  deleteWorkScheduleAction,
  findArchivedEmployeeByEmailAction,
  generateEmployeeInviteAction,
  reactivateEmployeeAction,
  removeScheduleExceptionAction,
  resetEmployeeAccessAction,
  updateEmployeeAction,
} from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireActiveProfile: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ assertActionRateLimit: vi.fn() }));
vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
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

const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const ROLE_ID = "00000000-0000-4000-8000-0000000000ff";
const SCHEDULE_ID = "00000000-0000-4000-8000-0000000000c1";
const EXCEPTION_ID = "00000000-0000-4000-8000-0000000000c2";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000c3";
const CATEGORY_ID = "00000000-0000-4000-8000-0000000000c4";
const INVALID = { ok: false, error: "Identificador inválido." } as const;
const ROLES_DISABLED = { ok: false, error: "Los roles estan deshabilitados para este salon." } as const;
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });
const INVITE = { token: "tok-123", expiresAt: "2026-10-10T00:00:00.000Z" };

function validCreateForm(extra: Record<string, string> = {}): FormData {
  return formDataOf({ first_name: "Ana", last_name: "Pérez", ...extra });
}

describe("employees actions", () => {
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

  describe("createEmployeeAction", () => {
    it("rechaza sin permiso y no toca el plan ni crea el colaborador", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await createEmployeeAction(null, validCreateForm())).toEqual({
        ok: false,
        error: "No tienes permiso para gestionar colaboradores.",
      });
      expect(checkPlanModuleAccess).not.toHaveBeenCalled();
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("devuelve el bloqueo del módulo de colaboradores del plan", async () => {
      vi.mocked(checkPlanModuleAccess).mockResolvedValue(err("Tu plan no incluye colaboradores."));

      expect(await createEmployeeAction(null, validCreateForm())).toEqual({
        ok: false,
        error: "Tu plan no incluye colaboradores.",
      });
      expect(checkPlanModuleAccess).toHaveBeenCalledWith({ salonId: SALON_ID, moduleKey: "employees" });
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("devuelve el bloqueo del límite de colaboradores activos", async () => {
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de colaboradores alcanzado."));

      expect(await createEmployeeAction(null, validCreateForm())).toEqual({
        ok: false,
        error: "Límite de colaboradores alcanzado.",
      });
      expect(checkPlanLimit).toHaveBeenCalledWith({ salonId: SALON_ID, metricKey: "employees.active" });
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("exige cupo de usuarios con login cuando el colaborador recibe un rol", async () => {
      vi.mocked(checkPlanLimit)
        .mockResolvedValueOnce(ok(undefined))
        .mockResolvedValueOnce(err("Sin cupo de usuarios con acceso."));

      expect(await createEmployeeAction(null, validCreateForm({ role_id: ROLE_ID }))).toEqual({
        ok: false,
        error: "Sin cupo de usuarios con acceso.",
      });
      expect(checkPlanLimit).toHaveBeenLastCalledWith({
        salonId: SALON_ID,
        metricKey: "employees.login_users",
      });
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("ignora el rol cuando el módulo de roles está deshabilitado y no consume cupo de login", async () => {
      vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));

      await createEmployeeAction(null, validCreateForm({ role_id: ROLE_ID }));

      expect(checkPlanLimit).toHaveBeenCalledTimes(1);
      expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), null);
    });

    it("trata un role_id en blanco como ausencia de rol", async () => {
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));

      await createEmployeeAction(null, validCreateForm({ role_id: "   " }));

      expect(checkPlanLimit).toHaveBeenCalledTimes(1);
      expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), null);
    });

    it("rechaza datos inválidos con el primer mensaje de validación", async () => {
      expect(await createEmployeeAction(null, formDataOf({ first_name: "", last_name: "Pérez" }))).toEqual({
        ok: false,
        error: "El nombre es obligatorio",
      });
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("crea el colaborador con servicios y categorías, y revalida la lista", async () => {
      const created = ok({ id: EMPLOYEE_ID, inviteToken: "tok", inviteExpiresAt: "2026-10-10" });
      vi.mocked(createEmployeeProfile).mockResolvedValue(created);
      const form = validCreateForm({ commission_percentage: "35", email: "ana@example.com" });
      form.append("service_ids", SERVICE_ID);
      form.append("category_ids", CATEGORY_ID);

      expect(await createEmployeeAction(null, form)).toEqual(created);

      expect(createEmployeeProfile).toHaveBeenCalledWith(
        SALON_ID,
        expect.objectContaining({
          first_name: "Ana",
          last_name: "Pérez",
          email: "ana@example.com",
          commission_percentage: 35,
          service_ids: [SERVICE_ID],
          category_ids: [CATEGORY_ID],
        }),
        null
      );
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
    });

    it("pasa el rol validado y consume el cupo de login antes de crear", async () => {
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));

      await createEmployeeAction(null, validCreateForm({ role_id: ROLE_ID }));

      expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), ROLE_ID);
    });

    it("no revalida cuando la creación falla", async () => {
      vi.mocked(createEmployeeProfile).mockResolvedValue(err("El email ya existe."));

      expect(await createEmployeeAction(null, validCreateForm())).toEqual({
        ok: false,
        error: "El email ya existe.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("findArchivedEmployeeByEmailAction", () => {
    it("devuelve null sin consultar cuando la guardia rechaza", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await findArchivedEmployeeByEmailAction("ana@example.com")).toBeNull();
      expect(findArchivedEmployeeByEmail).not.toHaveBeenCalled();
    });

    it("devuelve null cuando el límite de peticiones bloquea la consulta", async () => {
      vi.mocked(assertActionRateLimit).mockResolvedValue(RATE_LIMITED);

      expect(await findArchivedEmployeeByEmailAction("ana@example.com")).toBeNull();
      expect(findArchivedEmployeeByEmail).not.toHaveBeenCalled();
    });

    it("busca el archivado por email dentro del salón", async () => {
      const match = { id: EMPLOYEE_ID, name: "Ana Pérez", email: "ana@example.com" };
      vi.mocked(findArchivedEmployeeByEmail).mockResolvedValue(match);

      expect(await findArchivedEmployeeByEmailAction("ana@example.com")).toEqual(match);
      expect(findArchivedEmployeeByEmail).toHaveBeenCalledWith(SALON_ID, "ana@example.com");
    });
  });

  describe("reactivateEmployeeAction", () => {
    it("rechaza sin permiso de colaboradores", async () => {
      vi.mocked(requireActiveProfile).mockResolvedValue(buildProfile());

      expect(await reactivateEmployeeAction(EMPLOYEE_ID)).toEqual({
        ok: false,
        error: "No tienes permiso para gestionar colaboradores.",
      });
      expect(reactivateEmployee).not.toHaveBeenCalled();
    });

    it("rechaza un identificador que no es UUID", async () => {
      expect(await reactivateEmployeeAction("empleado")).toEqual(INVALID);
      expect(reactivateEmployee).not.toHaveBeenCalled();
    });

    it("bloquea la reactivación cuando el plan no admite más colaboradores activos", async () => {
      vi.mocked(checkPlanLimit).mockResolvedValue(err("Límite de colaboradores alcanzado."));

      expect(await reactivateEmployeeAction(EMPLOYEE_ID)).toEqual({
        ok: false,
        error: "Límite de colaboradores alcanzado.",
      });
      expect(reactivateEmployee).not.toHaveBeenCalled();
    });

    it("reactiva y revalida lista, ficha y agenda de citas", async () => {
      vi.mocked(reactivateEmployee).mockResolvedValue(ok(undefined));

      expect(await reactivateEmployeeAction(EMPLOYEE_ID)).toEqual(ok(undefined));

      expect(reactivateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
      expect(revalidatePath).toHaveBeenCalledWith("/appointments/new");
    });

    it("no revalida cuando la reactivación falla", async () => {
      vi.mocked(reactivateEmployee).mockResolvedValue(err("No encontrado."));

      expect(await reactivateEmployeeAction(EMPLOYEE_ID)).toEqual({ ok: false, error: "No encontrado." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateEmployeeAction", () => {
    it("rechaza un identificador que no es UUID", async () => {
      expect(await updateEmployeeAction("x", null, validCreateForm())).toEqual(INVALID);
      expect(updateEmployeeProfile).not.toHaveBeenCalled();
    });

    it("rechaza datos inválidos sin persistir", async () => {
      expect(await updateEmployeeAction(EMPLOYEE_ID, null, formDataOf({ email: "no-es-email" }))).toEqual({
        ok: false,
        error: "Email inválido",
      });
      expect(updateEmployeeProfile).not.toHaveBeenCalled();
    });

    it("actualiza solo los campos enviados y convierte la comisión a número", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(ok(undefined));

      expect(
        await updateEmployeeAction(EMPLOYEE_ID, null, formDataOf({ first_name: "Lucía", commission_percentage: "12" }))
      ).toEqual(ok(undefined));

      expect(updateEmployeeProfile).toHaveBeenCalledWith(
        EMPLOYEE_ID,
        SALON_ID,
        expect.objectContaining({ first_name: "Lucía", commission_percentage: 12 })
      );
      const patch = vi.mocked(updateEmployeeProfile).mock.calls[0]?.[2];
      expect(patch?.last_name).toBeUndefined();
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
    });

    it("CONDUCTA ACTUAL (posible bug): sin comisión en el formulario el parche la fija en 0 y vacía teléfono, email y especialidad", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(ok(undefined));

      await updateEmployeeAction(EMPLOYEE_ID, null, formDataOf({ first_name: "Lucía" }));

      const patch = vi.mocked(updateEmployeeProfile).mock.calls[0]?.[2];
      expect(patch?.commission_percentage).toBe(0);
      expect(patch?.phone).toBe("");
      expect(patch?.email).toBe("");
      expect(patch?.specialty).toBe("");
    });

    it("no revalida cuando la actualización falla", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(err("Conflicto de email."));

      expect(await updateEmployeeAction(EMPLOYEE_ID, null, formDataOf({ first_name: "Lucía" }))).toEqual({
        ok: false,
        error: "Conflicto de email.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
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
      vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

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
      vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

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

  describe("addWorkScheduleAction", () => {
    it("rechaza un horario con formato de hora inválido", async () => {
      const form = formDataOf({
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
      const form = formDataOf({
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
      const form = formDataOf({
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

  describe("generateEmployeeInviteAction", () => {
    it("rechaza identificadores inválidos", async () => {
      expect(await generateEmployeeInviteAction("x", ROLE_ID)).toEqual(INVALID);
      expect(await generateEmployeeInviteAction(EMPLOYEE_ID, "rol")).toEqual(INVALID);
      expect(createEmployeeInviteForExistingEmployee).not.toHaveBeenCalled();
    });

    it("rechaza cuando los roles están deshabilitados", async () => {
      vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);

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

  describe("deleteEmployeeAction", () => {
    it("rechaza un identificador inválido", async () => {
      expect(await deleteEmployeeAction("x")).toEqual(INVALID);
      expect(archiveEmployee).not.toHaveBeenCalled();
    });

    it("archiva al colaborador y revalida lista, ficha y agenda", async () => {
      const outcome = ok({ outcome: "archived" as const, message: "Colaborador archivado." });
      vi.mocked(archiveEmployee).mockResolvedValue(outcome);

      expect(await deleteEmployeeAction(EMPLOYEE_ID)).toEqual(outcome);
      expect(archiveEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
      expect(revalidatePath).toHaveBeenCalledWith("/appointments/new");
    });

    it("no revalida cuando el archivado falla", async () => {
      vi.mocked(archiveEmployee).mockResolvedValue(err("Tiene citas futuras."));

      expect(await deleteEmployeeAction(EMPLOYEE_ID)).toEqual({ ok: false, error: "Tiene citas futuras." });
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
