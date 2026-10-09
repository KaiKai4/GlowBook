import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import type { Database } from "@/types/database.types";
import {
  createEmployee,
  findEmployeeByEmail,
  findEmployeeById,
  updateEmployeeProfileRecord,
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

// Alta y edicion de colaboradores. Se prueba la orquestacion (lectura previa, RPC
// transaccional, efectos posteriores) con los adaptadores mockeados.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

vi.mock("../data/employees.repo", () => ({
  createEmployee: vi.fn(),
  findEmployeeByEmail: vi.fn(),
  findEmployeeById: vi.fn(),
  updateEmployeeProfileRecord: vi.fn(),
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
const KEY = "00000000-0000-4000-8000-0000000000f1";

const mockedCaptureError = vi.mocked(captureError);
const mockedCreateEmployee = vi.mocked(createEmployee);
const mockedFindEmployeeByEmail = vi.mocked(findEmployeeByEmail);
const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedUpdateRecord = vi.mocked(updateEmployeeProfileRecord);
const mockedValidateAssignments = vi.mocked(validateEmployeeAssignments);
const mockedFindLatestInvite = vi.mocked(findLatestPendingEmployeeInvitationRole);
const mockedGenerateInvite = vi.mocked(generateEmployeeInvitation);
const mockedReplaceInvite = vi.mocked(replacePendingEmployeeInvitation);
const mockedRevokeAccess = vi.mocked(revokeEmployeeAuthAccess);

function employeeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: EMPLOYEE_ID,
    salon_id: SALON_ID,
    profile_id: null,
    first_name: "Ana",
    last_name: "Lopez",
    phone: "600111",
    email: "ana@glowbook.test",
    specialty: "Color",
    commission_percentage: 25,
    hire_date: null,
    is_active: true,
    created_at: "2030-01-01T00:00:00Z",
    updated_at: "2030-01-01T00:00:00Z",
    ...overrides,
  };
}

// findEmployeeById devuelve la fila con sus relaciones embebidas (servicios, categorias, horarios).
// Aqui solo interesan los campos de la fila: el resto se omite en el mock.
function employeeDetail(overrides: Partial<EmployeeRow> = {}): never {
  return employeeRow(overrides) as never;
}

const baseCreateInput = {
  first_name: " Dana ",
  last_name: "Nueva",
  phone: "",
  email: "dana@glowbook.test",
  specialty: "",
  commission_percentage: 40,
  hire_date: null,
  service_ids: [] as string[],
  category_ids: [] as string[],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedValidateAssignments.mockResolvedValue(undefined);
  mockedFindEmployeeByEmail.mockResolvedValue(null);
  mockedCreateEmployee.mockResolvedValue({ id: "new-employee" } as never);
  mockedUpdateRecord.mockResolvedValue(undefined);
  mockedFindLatestInvite.mockResolvedValue({ data: null, error: null });
});

describe("findArchivedEmployeeByEmail", () => {
  it("devuelve el colaborador archivado con ese email", async () => {
    mockedFindEmployeeByEmail.mockResolvedValue(employeeRow({ is_active: false, first_name: "Ana", last_name: "Lopez" }));

    await expect(findArchivedEmployeeByEmail(SALON_ID, " ana@glowbook.test ")).resolves.toEqual({
      id: EMPLOYEE_ID,
      name: "Ana Lopez",
      email: "ana@glowbook.test",
    });
  });

  it("no devuelve colaboradores activos ni emails vacios", async () => {
    mockedFindEmployeeByEmail.mockResolvedValue(employeeRow({ is_active: true }));
    await expect(findArchivedEmployeeByEmail(SALON_ID, "ana@glowbook.test")).resolves.toBeNull();
    await expect(findArchivedEmployeeByEmail(SALON_ID, "   ")).resolves.toBeNull();
  });
});

describe("createEmployeeProfile", () => {
  it("da de alta con una sola llamada a la RPC, con datos normalizados y la clave", async () => {
    const result = await createEmployeeProfile(
      SALON_ID,
      { ...baseCreateInput, service_ids: [SERVICE_ID], category_ids: [CATEGORY_ID] },
      null,
      KEY
    );

    expect(result).toEqual({ ok: true, value: { id: "new-employee" } });
    expect(mockedValidateAssignments).toHaveBeenCalledWith(SALON_ID, [SERVICE_ID], [CATEGORY_ID]);
    expect(mockedCreateEmployee).toHaveBeenCalledWith(
      {
        first_name: "Dana",
        last_name: "Nueva",
        phone: "",
        email: "dana@glowbook.test",
        specialty: "",
        commission_percentage: 40,
        hire_date: null,
      },
      [SERVICE_ID],
      [CATEGORY_ID],
      KEY
    );
    expect(mockedGenerateInvite).not.toHaveBeenCalled();
  });

  it("valida las asignaciones antes de la RPC y oculta el detalle interno", async () => {
    mockedValidateAssignments.mockRejectedValue(new Error("categoría ajena"));

    const result = await createEmployeeProfile(SALON_ID, baseCreateInput, null, KEY);

    expect(result).toEqual({ ok: false, error: "Error al crear el colaborador." });
    expect(mockedCreateEmployee).not.toHaveBeenCalled();
    expect(mockedCaptureError).toHaveBeenCalledWith(expect.any(Error), {
      module: "errors",
      action: "public-message",
    });
  });

  it("rechaza un colaborador archivado con ese email sin llamar a la RPC", async () => {
    mockedFindEmployeeByEmail.mockResolvedValue(employeeRow({ is_active: false }));

    const result = await createEmployeeProfile(SALON_ID, baseCreateInput, null, KEY);

    expect(result).toEqual({
      ok: false,
      error: "Ya existe un colaborador con ese email. Restauralo para conservar su historial.",
    });
    expect(mockedCreateEmployee).not.toHaveBeenCalled();
  });

  it("muestra el rechazo de email activo duplicado que devuelve la RPC", async () => {
    mockedCreateEmployee.mockRejectedValue({
      code: "P0001",
      message: "Ya existe un colaborador activo con ese email.",
    });

    const result = await createEmployeeProfile(SALON_ID, baseCreateInput, null, KEY);

    expect(result).toEqual({ ok: false, error: "Ya existe un colaborador activo con ese email." });
  });

  it("emite el enlace de acceso cuando hay email y rol", async () => {
    mockedGenerateInvite.mockResolvedValue({
      ok: true,
      value: { token: "tok", expiresAt: "2030-01-08T00:00:00Z" },
    });

    const result = await createEmployeeProfile(SALON_ID, baseCreateInput, "role-1", KEY);

    expect(result).toEqual({
      ok: true,
      value: {
        id: "new-employee",
        inviteToken: "tok",
        inviteExpiresAt: "2030-01-08T00:00:00Z",
      },
    });
    expect(mockedGenerateInvite).toHaveBeenCalledWith({
      employeeId: "new-employee",
      salonId: SALON_ID,
      email: "dana@glowbook.test",
      roleId: "role-1",
    });
  });

  it("devuelve el alta con aviso si el enlace falla despues de confirmarse la escritura", async () => {
    mockedGenerateInvite.mockResolvedValue({ ok: false, error: "No se pudo generar el nuevo enlace de acceso." });

    const result = await createEmployeeProfile(SALON_ID, baseCreateInput, "role-1", KEY);

    expect(result).toEqual({
      ok: true,
      value: { id: "new-employee", warnings: ["No se pudo generar el nuevo enlace de acceso."] },
    });
  });
});

describe("updateEmployeeProfile", () => {
  it("devuelve not found sin escribir", async () => {
    mockedFindEmployeeById.mockResolvedValue(null);

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { first_name: "X" }, KEY);

    expect(result).toEqual({ ok: false, error: "Colaborador no encontrado." });
    expect(mockedUpdateRecord).not.toHaveBeenCalled();
  });

  it("editar solo el nombre no escribe telefono, email, especialidad ni comision", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail());

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { first_name: "Ana Maria" }, KEY);

    expect(result).toEqual({ ok: true, value: {} });
    expect(mockedUpdateRecord).toHaveBeenCalledWith(EMPLOYEE_ID, {
      fields: { first_name: "Ana Maria" },
      serviceIds: undefined,
      categoryIds: undefined,
      unlinkProfile: false,
      idempotencyKey: KEY,
    });
  });

  it("valida las asignaciones antes de cualquier escritura o revocacion", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail({ profile_id: PROFILE_ID }));
    mockedValidateAssignments.mockRejectedValue(new Error("servicio ajeno"));

    const result = await updateEmployeeProfile(
      EMPLOYEE_ID,
      SALON_ID,
      { email: "nuevo@glowbook.test", service_ids: [SERVICE_ID] },
      KEY
    );

    expect(result).toEqual({ ok: false, error: "Error al actualizar el colaborador." });
    expect(mockedRevokeAccess).not.toHaveBeenCalled();
    expect(mockedUpdateRecord).not.toHaveBeenCalled();
  });

  it("no permite dejar sin email a un colaborador con acceso", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail({ profile_id: PROFILE_ID }));

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "" }, KEY);

    expect(result).toEqual({
      ok: false,
      error: "No puedes dejar sin email a un colaborador que ya tiene acceso al sistema.",
    });
    expect(mockedRevokeAccess).not.toHaveBeenCalled();
    expect(mockedUpdateRecord).not.toHaveBeenCalled();
  });

  it("cambiar el email de un colaborador con acceso revoca la cuenta, desvincula y reinvita con el rol anterior", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail({ profile_id: PROFILE_ID }));
    mockedRevokeAccess.mockResolvedValue({ ok: true, value: { roleId: "role-1" } });
    mockedReplaceInvite.mockResolvedValue({ ok: true, value: { token: "t", expiresAt: "x" } });

    const result = await updateEmployeeProfile(
      EMPLOYEE_ID,
      SALON_ID,
      { email: "nuevo@glowbook.test", service_ids: [SERVICE_ID], category_ids: [CATEGORY_ID] },
      KEY
    );

    expect(result).toEqual({ ok: true, value: {} });
    expect(mockedRevokeAccess).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, PROFILE_ID);
    expect(mockedUpdateRecord).toHaveBeenCalledWith(EMPLOYEE_ID, {
      fields: { email: "nuevo@glowbook.test" },
      serviceIds: [SERVICE_ID],
      categoryIds: [CATEGORY_ID],
      unlinkProfile: true,
      idempotencyKey: KEY,
    });
    expect(mockedReplaceInvite).toHaveBeenCalledWith({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      email: "nuevo@glowbook.test",
      roleId: "role-1",
    });
  });

  it("lee la invitacion pendiente antes de escribir y reutiliza su rol al cambiar el email", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail({ profile_id: null }));
    mockedFindLatestInvite.mockResolvedValue({ data: { role_id: "role-9" }, error: null });
    mockedReplaceInvite.mockResolvedValue({ ok: true, value: { token: "t", expiresAt: "x" } });

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "otro@glowbook.test" }, KEY);

    expect(result).toEqual({ ok: true, value: {} });
    const readOrder = mockedFindLatestInvite.mock.invocationCallOrder[0];
    const writeOrder = mockedUpdateRecord.mock.invocationCallOrder[0];
    expect(readOrder).toBeLessThan(writeOrder ?? 0);
    expect(mockedRevokeAccess).not.toHaveBeenCalled();
    expect(mockedReplaceInvite).toHaveBeenCalledWith({
      employeeId: EMPLOYEE_ID,
      salonId: SALON_ID,
      email: "otro@glowbook.test",
      roleId: "role-9",
    });
  });

  it("si no se puede leer la invitacion pendiente no escribe nada", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail({ profile_id: null }));
    mockedFindLatestInvite.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "otro@glowbook.test" }, KEY);

    expect(result).toEqual({ ok: false, error: "No se pudo verificar la invitacion pendiente." });
    expect(mockedUpdateRecord).not.toHaveBeenCalled();
  });

  it("vaciar el email de un colaborador sin cuenta se escribe sin reinvitar", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail({ profile_id: null }));

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "" }, KEY);

    expect(result).toEqual({ ok: true, value: {} });
    expect(mockedUpdateRecord).toHaveBeenCalledWith(
      EMPLOYEE_ID,
      expect.objectContaining({ fields: { email: "" }, unlinkProfile: false })
    );
    expect(mockedFindLatestInvite).not.toHaveBeenCalled();
    expect(mockedReplaceInvite).not.toHaveBeenCalled();
  });

  it("si el enlace falla despues de confirmarse la escritura devuelve aviso", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail({ profile_id: null }));
    mockedReplaceInvite.mockResolvedValue({ ok: false, error: "No se pudo generar el nuevo enlace de acceso." });

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { email: "otro@glowbook.test" }, KEY);

    expect(result).toEqual({
      ok: true,
      value: { warnings: ["No se pudo generar el nuevo enlace de acceso."] },
    });
  });

  it("un fallo de la RPC devuelve un mensaje publico generico", async () => {
    mockedFindEmployeeById.mockResolvedValue(employeeDetail());
    mockedUpdateRecord.mockRejectedValue(new Error("connection reset"));

    const result = await updateEmployeeProfile(EMPLOYEE_ID, SALON_ID, { first_name: "X" }, KEY);

    expect(result).toEqual({ ok: false, error: "Error al actualizar el colaborador." });
  });
});
