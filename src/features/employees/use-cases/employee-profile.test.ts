import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/lib/observability";
import type { Database } from "@/types/database.types";
import {
  createEmployee,
  findEmployeeByEmail,
  findEmployeeById,
  updateEmployee,
  updateEmployeeCategories,
  updateEmployeeServices,
  validateEmployeeAssignments,
} from "../data/employees.repo";
import { findLatestPendingEmployeeInvitationRole } from "../data/employee-access.repo";
import {
  generateEmployeeInvitation,
  replacePendingEmployeeInvitation,
  revokeEmployeeAuthAccess,
} from "./employee-access";
import {
  createEmployeeProfile,
  findArchivedEmployeeByEmail,
  updateEmployeeProfile,
} from "./employee-profile";

// Alta y edición de colaboradores. Verifica que el cambio de email respete el
// acceso al sistema (revocar cuenta, invitar de nuevo) y que las asignaciones
// se validen antes de persistir. Los módulos hijos se mockean: aquí se prueba
// la orquestación y no los adaptadores.

vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employees.repo", () => ({
  createEmployee: vi.fn(),
  findEmployeeByEmail: vi.fn(),
  findEmployeeById: vi.fn(),
  updateEmployee: vi.fn(),
  updateEmployeeCategories: vi.fn(),
  updateEmployeeServices: vi.fn(),
  validateEmployeeAssignments: vi.fn(),
}));

vi.mock("../data/employee-access.repo", () => ({
  findLatestPendingEmployeeInvitationRole: vi.fn(),
}));

vi.mock("./employee-access", () => ({
  generateEmployeeInvitation: vi.fn(),
  replacePendingEmployeeInvitation: vi.fn(),
  revokeEmployeeAuthAccess: vi.fn(),
}));

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

const SALON_ID = "salon-1";
const EMPLOYEE_ID = "employee-1";
const PROFILE_ID = "profile-1";
const CATEGORY_ID = "00000000-0000-4000-8000-0000000000c1";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000e1";

const mockedCaptureError = vi.mocked(captureError);
const mockedCreateEmployee = vi.mocked(createEmployee);
const mockedFindEmployeeByEmail = vi.mocked(findEmployeeByEmail);
const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedUpdateEmployee = vi.mocked(updateEmployee);
const mockedUpdateCategories = vi.mocked(updateEmployeeCategories);
const mockedUpdateServices = vi.mocked(updateEmployeeServices);
const mockedValidateAssignments = vi.mocked(validateEmployeeAssignments);
const mockedFindLatestInvite = vi.mocked(findLatestPendingEmployeeInvitationRole);
const mockedGenerateInvite = vi.mocked(generateEmployeeInvitation);
const mockedReplaceInvite = vi.mocked(replacePendingEmployeeInvitation);
const mockedRevokeAccess = vi.mocked(revokeEmployeeAuthAccess);

function employeeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: EMPLOYEE_ID,
    salon_id: SALON_ID,
    first_name: "Ana",
    last_name: "Lopez",
    email: "ana@salon.test",
    phone: "",
    specialty: "",
    commission_percentage: 0,
    hire_date: null,
    is_active: true,
    profile_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// findEmployeeById devuelve el colaborador con sus relaciones embebidas; el doble
// solo necesita los campos que el use-case lee, por eso se tipa como lookup.
function employeeLookupRow(overrides: Partial<EmployeeRow> = {}) {
  return employeeRow(overrides) as never;
}

const baseInput = {
  first_name: "Ana",
  last_name: "Lopez",
  phone: "",
  email: "",
  specialty: "",
  commission_percentage: 0,
  hire_date: null,
  service_ids: [],
  category_ids: [],
};

describe("employee profile use-cases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedValidateAssignments.mockResolvedValue(undefined);
    mockedCreateEmployee.mockResolvedValue(employeeRow({ id: "new-employee" }));
    mockedUpdateEmployee.mockResolvedValue(employeeRow());
    mockedUpdateServices.mockResolvedValue(undefined);
    mockedUpdateCategories.mockResolvedValue(undefined);
    mockedFindEmployeeByEmail.mockResolvedValue(null);
    mockedFindLatestInvite.mockResolvedValue({ data: null, error: null });
  });

  describe("findArchivedEmployeeByEmail", () => {
    it("no consulta nada si el email llega vacío o solo con espacios", async () => {
      await expect(findArchivedEmployeeByEmail(SALON_ID, "   ")).resolves.toBeNull();

      expect(mockedFindEmployeeByEmail).not.toHaveBeenCalled();
    });

    it("busca el email recortado dentro del salón", async () => {
      mockedFindEmployeeByEmail.mockResolvedValue(null);

      await findArchivedEmployeeByEmail(SALON_ID, "  ana@salon.test ");

      expect(mockedFindEmployeeByEmail).toHaveBeenCalledWith("ana@salon.test", SALON_ID);
    });

    it("no devuelve coincidencias activas, solo archivadas", async () => {
      mockedFindEmployeeByEmail.mockResolvedValue(employeeRow({ is_active: true }));

      await expect(findArchivedEmployeeByEmail(SALON_ID, "ana@salon.test")).resolves.toBeNull();
    });

    it("devuelve nombre y email de un colaborador archivado para ofrecer restaurarlo", async () => {
      mockedFindEmployeeByEmail.mockResolvedValue(
        employeeRow({ is_active: false, first_name: "Ana", last_name: "Lopez" })
      );

      await expect(findArchivedEmployeeByEmail(SALON_ID, "ana@salon.test")).resolves.toEqual({
        id: EMPLOYEE_ID,
        name: "Ana Lopez",
        email: "ana@salon.test",
      });
    });
  });

  describe("createEmployeeProfile", () => {
    it("crea el colaborador con sus asignaciones validadas y sin invitar si no hay email", async () => {
      const input = {
        ...baseInput,
        service_ids: [SERVICE_ID],
        category_ids: [CATEGORY_ID],
      };

      const result = await createEmployeeProfile(SALON_ID, input, "role-1");

      expect(result).toEqual({ ok: true, value: { id: "new-employee" } });
      expect(mockedValidateAssignments).toHaveBeenCalledWith(
        SALON_ID,
        [SERVICE_ID],
        [CATEGORY_ID]
      );
      expect(mockedCreateEmployee).toHaveBeenCalledWith(
        SALON_ID,
        expect.not.objectContaining({ service_ids: expect.anything() }),
        [SERVICE_ID],
        [CATEGORY_ID]
      );
      expect(mockedGenerateInvite).not.toHaveBeenCalled();
    });

    it("valida las asignaciones antes de crear el colaborador", async () => {
      mockedValidateAssignments.mockRejectedValue(new Error("categoría ajena"));

      const result = await createEmployeeProfile(SALON_ID, baseInput, null);

      expect(result).toEqual({ ok: false, error: "Error al crear el colaborador." });
      expect(mockedCreateEmployee).not.toHaveBeenCalled();
      expect(mockedCaptureError).toHaveBeenCalledWith(expect.any(Error), {
        module: "employees",
        action: "profile",
      });
    });

    it("rechaza el alta si ya existe un colaborador archivado con ese email", async () => {
      mockedFindEmployeeByEmail.mockResolvedValue(employeeRow({ is_active: false }));

      const result = await createEmployeeProfile(
        SALON_ID,
        { ...baseInput, email: "ana@salon.test" },
        "role-1"
      );

      expect(result).toEqual({
        ok: false,
        error: "Ya existe un colaborador con ese email. Restauralo para conservar su historial.",
      });
      expect(mockedCreateEmployee).not.toHaveBeenCalled();
    });

    it("con email y rol genera la invitación con el email recortado", async () => {
      mockedGenerateInvite.mockResolvedValue({
        ok: true,
        value: { token: "tok", expiresAt: "2026-10-16T00:00:00.000Z" },
      });

      const result = await createEmployeeProfile(
        SALON_ID,
        { ...baseInput, email: " ana@salon.test " },
        "role-1"
      );

      expect(mockedGenerateInvite).toHaveBeenCalledWith({
        employeeId: "new-employee",
        salonId: SALON_ID,
        email: "ana@salon.test",
        roleId: "role-1",
      });
      expect(result).toEqual({
        ok: true,
        value: {
          id: "new-employee",
          inviteToken: "tok",
          inviteExpiresAt: "2026-10-16T00:00:00.000Z",
        },
      });
    });

    it("con email pero sin rol no genera invitación", async () => {
      const result = await createEmployeeProfile(
        SALON_ID,
        { ...baseInput, email: "ana@salon.test" },
        null
      );

      expect(result).toEqual({ ok: true, value: { id: "new-employee" } });
      expect(mockedGenerateInvite).not.toHaveBeenCalled();
    });

    it("si la invitación falla, el colaborador queda creado sin enlace", async () => {
      mockedGenerateInvite.mockResolvedValue({
        ok: false,
        error: "No se pudo generar el nuevo enlace de acceso.",
      });

      const result = await createEmployeeProfile(
        SALON_ID,
        { ...baseInput, email: "ana@salon.test" },
        "role-1"
      );

      expect(result).toEqual({ ok: true, value: { id: "new-employee" } });
    });

    // CONDUCTA ACTUAL (posible bug): employee-profile.ts (createEmployeeProfile) solo
    // revisa duplicados archivados; un email que ya pertenece a un colaborador activo
    // se acepta y se intenta crear de nuevo. Si la BD no tiene unicidad por salón, se
    // duplica el colaborador.
    it("CONDUCTA ACTUAL (posible bug): no rechaza un email de colaborador activo ya existente", async () => {
      mockedFindEmployeeByEmail.mockResolvedValue(employeeRow({ is_active: true }));

      const result = await createEmployeeProfile(
        SALON_ID,
        { ...baseInput, email: "ana@salon.test" },
        null
      );

      expect(result).toEqual({ ok: true, value: { id: "new-employee" } });
      expect(mockedCreateEmployee).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateEmployeeProfile", () => {
    it("devuelve 'no encontrado' sin persistir cambios", async () => {
      mockedFindEmployeeById.mockResolvedValue(null);

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { first_name: "Eva" });

      expect(result).toEqual({ ok: false, error: "Colaborador no encontrado." });
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
    });

    it("actualiza campos y asignaciones sin tocar acceso si el email no cambia", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: PROFILE_ID }));

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, {
        first_name: "Eva",
        service_ids: [SERVICE_ID],
        category_ids: [CATEGORY_ID],
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedRevokeAccess).not.toHaveBeenCalled();
      expect(mockedReplaceInvite).not.toHaveBeenCalled();
      expect(mockedUpdateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        first_name: "Eva",
      });
      expect(mockedUpdateServices).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, [SERVICE_ID]);
      expect(mockedUpdateCategories).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, [CATEGORY_ID]);
      expect(mockedValidateAssignments).toHaveBeenCalledWith(
        SALON_ID,
        [SERVICE_ID],
        [CATEGORY_ID]
      );
    });

    it("compara emails sin distinguir mayúsculas ni espacios y no revoca si son equivalentes", async () => {
      mockedFindEmployeeById.mockResolvedValue(
        employeeLookupRow({ email: "ana@salon.test", profile_id: PROFILE_ID })
      );

      await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "  ANA@Salon.test " });

      expect(mockedRevokeAccess).not.toHaveBeenCalled();
    });

    it("sin cambios de email limpia asignaciones con listas vacías por defecto", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow());

      await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { first_name: "Eva" });

      expect(mockedValidateAssignments).toHaveBeenCalledWith(SALON_ID, [], []);
      expect(mockedUpdateServices).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, []);
      expect(mockedUpdateCategories).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, []);
    });

    it("no permite dejar sin email a un colaborador que ya tiene acceso", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: PROFILE_ID }));

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "  " });

      expect(result).toEqual({
        ok: false,
        error: "No puedes dejar sin email a un colaborador que ya tiene acceso al sistema.",
      });
      expect(mockedRevokeAccess).not.toHaveBeenCalled();
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
    });

    it("cambiar el email de un colaborador con acceso revoca la cuenta y reinvita con el mismo rol", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: PROFILE_ID }));
      mockedRevokeAccess.mockResolvedValue({ ok: true, value: { roleId: "role-1" } });
      mockedReplaceInvite.mockResolvedValue({
        ok: true,
        value: { token: "tok", expiresAt: "2026-10-16T00:00:00.000Z" },
      });

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedRevokeAccess).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, PROFILE_ID);
      expect(mockedUpdateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
        profile_id: null,
      });
      expect(mockedReplaceInvite).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "nueva@salon.test",
        roleId: "role-1",
      });
      expect(mockedRevokeAccess.mock.invocationCallOrder[0]).toBeLessThan(
        mockedUpdateEmployee.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it("si la revocación de la cuenta falla, no actualiza nada", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: PROFILE_ID }));
      mockedRevokeAccess.mockResolvedValue({ ok: false, error: "No se pudo revocar." });

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
      });

      expect(result).toEqual({ ok: false, error: "No se pudo revocar." });
      expect(mockedUpdateEmployee).not.toHaveBeenCalled();
      expect(mockedReplaceInvite).not.toHaveBeenCalled();
    });

    it("si la nueva invitación falla tras revocar, devuelve su error", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: PROFILE_ID }));
      mockedRevokeAccess.mockResolvedValue({ ok: true, value: { roleId: null } });
      mockedReplaceInvite.mockResolvedValue({
        ok: false,
        error: "No se pudo generar el nuevo enlace de acceso.",
      });

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
      });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo generar el nuevo enlace de acceso.",
      });
    });

    it("para un colaborador sin cuenta con email nuevo reutiliza el rol de la invitación pendiente", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: null }));
      mockedFindLatestInvite.mockResolvedValue({ data: { role_id: "role-2" }, error: null });
      mockedReplaceInvite.mockResolvedValue({
        ok: true,
        value: { token: "tok", expiresAt: "2026-10-16T00:00:00.000Z" },
      });

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedFindLatestInvite).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID);
      expect(mockedRevokeAccess).not.toHaveBeenCalled();
      expect(mockedReplaceInvite).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        salonId: SALON_ID,
        email: "nueva@salon.test",
        roleId: "role-2",
      });
    });

    it("sin invitación pendiente previa reinvita sin rol", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: null }));
      mockedReplaceInvite.mockResolvedValue({
        ok: true,
        value: { token: "tok", expiresAt: "2026-10-16T00:00:00.000Z" },
      });

      await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "nueva@salon.test" });

      expect(mockedReplaceInvite).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: null })
      );
    });

    it("si no puede leer la invitación pendiente informa el fallo", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: null }));
      mockedFindLatestInvite.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
      });

      expect(result).toEqual({
        ok: false,
        error: "No se pudo verificar la invitacion pendiente.",
      });
      expect(mockedReplaceInvite).not.toHaveBeenCalled();
      expect(mockedCaptureError).toHaveBeenCalledWith(
        { message: "caido" },
        { module: "employees", action: "profile" }
      );
    });

    it("vaciar el email de un colaborador sin cuenta no genera invitación", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: null }));

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "" });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(mockedReplaceInvite).not.toHaveBeenCalled();
    });

    // CONDUCTA ACTUAL (posible bug): employee-profile.ts (updateEmployeeProfile, rama
    // sin cuenta) no elimina la invitación pendiente al vaciar el email; el enlace
    // anterior sigue vigente para la dirección antigua.
    it("CONDUCTA ACTUAL (posible bug): vaciar el email no invalida la invitación pendiente anterior", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: null }));

      await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "" });

      expect(mockedReplaceInvite).not.toHaveBeenCalled();
      expect(mockedGenerateInvite).not.toHaveBeenCalled();
    });

    // CONDUCTA ACTUAL (posible bug): employee-profile.ts (updateEmployeeProfile) ya
    // persistió datos y asignaciones cuando la lectura de la invitación pendiente falla;
    // devuelve error pero el cambio queda aplicado (escritura parcial).
    it("CONDUCTA ACTUAL (posible bug): persiste cambios antes de fallar al leer la invitación", async () => {
      mockedFindEmployeeById.mockResolvedValue(employeeLookupRow({ profile_id: null }));
      mockedFindLatestInvite.mockResolvedValue({ data: null, error: { message: "caido" } });

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
        first_name: "Eva",
      });

      expect(result.ok).toBe(false);
      expect(mockedUpdateEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, {
        email: "nueva@salon.test",
        first_name: "Eva",
      });
    });

    it("captura cualquier excepción del repositorio y devuelve error genérico", async () => {
      mockedFindEmployeeById.mockRejectedValue(new Error("red"));

      const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { first_name: "Eva" });

      expect(result).toEqual({ ok: false, error: "Error al actualizar el colaborador." });
      expect(mockedCaptureError).toHaveBeenCalledTimes(1);
    });
  });
});
