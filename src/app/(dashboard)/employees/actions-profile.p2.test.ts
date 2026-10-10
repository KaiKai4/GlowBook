import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/features/access";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import { archiveEmployee, reactivateEmployee } from "@/features/employees/use-cases/employee-lifecycle";
import { createEmployeeProfile, findArchivedEmployeeByEmail, updateEmployeeProfile } from "@/features/employees/use-cases/employee-profile";
import { getSalonSchedulingConfig } from "@/features/salon/use-cases/salon-scheduling-config";
import { err, ok } from "@/infra/result";
import { buildProfile, rolesDisabled, formDataOf, SALON_ID } from "@/test/action-fixtures";
import { createEmployeeAction, findArchivedEmployeeByEmailAction, reactivateEmployeeAction, updateEmployeeAction, deleteEmployeeAction } from "./actions-profile";

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

function employeeForm(values: Record<string, string>): FormData {
  return formDataOf({ idempotency_key: IDEMPOTENCY_KEY, ...values });
}
function validCreateForm(extra: Record<string, string> = {}): FormData {
  return employeeForm({ first_name: "Ana", last_name: "Pérez", ...extra });
}
const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const ROLE_ID = "00000000-0000-4000-8000-0000000000ff";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000c3";
const CATEGORY_ID = "00000000-0000-4000-8000-0000000000c4";
const INVALID = { ok: false, error: "Identificador inválido." } as const;
const RATE_LIMITED = { ok: false, error: "Demasiados intentos. Espera un momento y vuelve a intentarlo." } as const;
const manager = buildProfile({ permissions: [PERMISSIONS.EMPLOYEES_MANAGE] });
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-0000000000f1";

describe("employees actions (ficha y alta, p2)", () => {
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
      vi.mocked(requireActiveProfile).mockResolvedValue(rolesDisabled(manager));
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));

      await createEmployeeAction(null, validCreateForm({ role_id: ROLE_ID }));

      expect(checkPlanLimit).toHaveBeenCalledTimes(1);
      expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), null, expect.any(String));
    });

    it("trata un role_id en blanco como ausencia de rol", async () => {
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));

      await createEmployeeAction(null, validCreateForm({ role_id: "   " }));

      expect(checkPlanLimit).toHaveBeenCalledTimes(1);
      expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), null, expect.any(String));
    });

    it("rechaza datos inválidos con el primer mensaje de validación", async () => {
      expect(await createEmployeeAction(null, employeeForm({ first_name: "", last_name: "Pérez" }))).toEqual({
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
        null,
        IDEMPOTENCY_KEY
      );
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
    });

    it("pasa el rol validado y consume el cupo de login antes de crear", async () => {
      vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));

      await createEmployeeAction(null, validCreateForm({ role_id: ROLE_ID }));

      expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), ROLE_ID, expect.any(String));
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

  describe("idempotencia de las escrituras de colaboradores", () => {
    const MISSING_KEY = { ok: false, error: "Solicitud inválida. Recarga la página e inténtalo de nuevo." } as const;

    it("createEmployeeAction rechaza el FormData sin idempotency_key antes de escribir", async () => {
      const form = formDataOf({ first_name: "Ana", last_name: "Pérez" });

      expect(await createEmployeeAction(null, form)).toEqual(MISSING_KEY);
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("createEmployeeAction rechaza una idempotency_key que no es uuid", async () => {
      const form = formDataOf({ first_name: "Ana", last_name: "Pérez", idempotency_key: "no-uuid" });

      expect(await createEmployeeAction(null, form)).toEqual(MISSING_KEY);
      expect(createEmployeeProfile).not.toHaveBeenCalled();
    });

    it("updateEmployeeAction rechaza el FormData sin idempotency_key antes de escribir", async () => {
      expect(await updateEmployeeAction(EMPLOYEE_ID, null, formDataOf({ first_name: "Lucía" }))).toEqual(
        MISSING_KEY
      );
      expect(updateEmployeeProfile).not.toHaveBeenCalled();
    });

    it("pasa la clave de idempotencia al caso de uso de edicion", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(ok({}));

      await updateEmployeeAction(EMPLOYEE_ID, null, employeeForm({ first_name: "Lucía" }));

      expect(updateEmployeeProfile).toHaveBeenCalledWith(
        EMPLOYEE_ID,
        SALON_ID,
        expect.any(Object),
        IDEMPOTENCY_KEY
      );
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
      expect(await updateEmployeeAction(EMPLOYEE_ID, null, employeeForm({ email: "no-es-email" }))).toEqual({
        ok: false,
        error: "Email inválido",
      });
      expect(updateEmployeeProfile).not.toHaveBeenCalled();
    });

    it("actualiza solo los campos enviados y convierte la comisión a número", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(ok({}));

      expect(
        await updateEmployeeAction(EMPLOYEE_ID, null, employeeForm({ first_name: "Lucía", commission_percentage: "12" }))
      ).toEqual(ok({}));

      expect(updateEmployeeProfile).toHaveBeenCalledWith(
        EMPLOYEE_ID,
        SALON_ID,
        expect.objectContaining({ first_name: "Lucía", commission_percentage: 12 }),
        IDEMPOTENCY_KEY
      );
      const patch = vi.mocked(updateEmployeeProfile).mock.calls[0]?.[2];
      expect(patch?.last_name).toBeUndefined();
      expect(revalidatePath).toHaveBeenCalledWith("/employees");
      expect(revalidatePath).toHaveBeenCalledWith(`/employees/${EMPLOYEE_ID}`);
    });

    it("sin comisión, teléfono, email ni especialidad en el formulario el parche no los toca", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(ok({}));

      await updateEmployeeAction(EMPLOYEE_ID, null, employeeForm({ first_name: "Lucía" }));

      const patch = vi.mocked(updateEmployeeProfile).mock.calls[0]?.[2];
      expect(patch?.commission_percentage).toBeUndefined();
      expect(patch?.phone).toBeUndefined();
      expect(patch?.email).toBeUndefined();
      expect(patch?.specialty).toBeUndefined();
    });

    it("un campo enviado vacío sí se guarda como vacío (borrado explícito)", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(ok({}));

      await updateEmployeeAction(EMPLOYEE_ID, null, employeeForm({ phone: "", specialty: "" }));

      const patch = vi.mocked(updateEmployeeProfile).mock.calls[0]?.[2];
      expect(patch?.phone).toBe("");
      expect(patch?.specialty).toBe("");
    });

    it("no revalida cuando la actualización falla", async () => {
      vi.mocked(updateEmployeeProfile).mockResolvedValue(err("Conflicto de email."));

      expect(await updateEmployeeAction(EMPLOYEE_ID, null, employeeForm({ first_name: "Lucía" }))).toEqual({
        ok: false,
        error: "Conflicto de email.",
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
});
