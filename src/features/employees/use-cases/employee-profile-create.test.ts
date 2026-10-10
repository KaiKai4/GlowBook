import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import type { Database } from "@/types/database.types";
import type { createEmployee } from "@/features/employees/data/employees-write.repo";
import type { findEmployeeByEmail } from "@/features/employees/data/employees-read.repo";
import type { validateEmployeeAssignments } from "./employee-assignments";
import type { replacePendingEmployeeInvitation } from "./employee-invitation-issue";
import { createEmployeeProfile, type CreateEmployeeProfileDeps } from "./employee-profile-create";
import type { CreateEmployeeInput } from "@/features/employees/schemas";

// Alta de perfil: se prueba la orquestacion (chequeo de archivado, RPC transaccional,
// efecto posterior del enlace de acceso) con fakes tipados inyectados como dependencias.

vi.mock("@/infra/observability", () => ({
  captureError: vi.fn(),
}));

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

const SALON_ID = "salon-1";
const KEY = "00000000-0000-4000-8000-0000000000f1";
const CATEGORY_ID = "00000000-0000-4000-8000-0000000000c1";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000e1";

const fakes = {
  findEmployeeByEmail: vi.fn<typeof findEmployeeByEmail>(),
  validateAssignments: vi.fn<typeof validateEmployeeAssignments>(),
  insertEmployee: vi.fn<typeof createEmployee>(),
  replacePendingInvitation: vi.fn<typeof replacePendingEmployeeInvitation>(),
};

const deps: CreateEmployeeProfileDeps = fakes;

const mockedCaptureError = vi.mocked(captureError);
const mockedCreateEmployee = fakes.insertEmployee;
const mockedFindEmployeeByEmail = fakes.findEmployeeByEmail;
const mockedValidateAssignments = fakes.validateAssignments;
const mockedGenerateInvite = fakes.replacePendingInvitation;

function createProfile(
  salonId: string,
  input: CreateEmployeeInput,
  roleId: string | null,
  idempotencyKey: string
) {
  return createEmployeeProfile(salonId, input, roleId, idempotencyKey, deps);
}

function employeeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: "employee-1",
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

const baseCreateInput: CreateEmployeeInput = {
  first_name: " Dana ",
  last_name: "Nueva",
  phone: "",
  email: "dana@glowbook.test",
  specialty: "",
  commission_percentage: 40,
  hire_date: null,
  service_ids: [],
  category_ids: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedValidateAssignments.mockResolvedValue(undefined);
  mockedFindEmployeeByEmail.mockResolvedValue(null);
  mockedCreateEmployee.mockResolvedValue({ id: "new-employee" });
});

describe("createEmployeeProfile", () => {
  it("da de alta con una sola llamada a la RPC, con datos normalizados y la clave", async () => {
    const result = await createProfile(
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

  it("válida las asignaciones antes de la RPC y oculta el detalle interno", async () => {
    mockedValidateAssignments.mockRejectedValue(new Error("categoría ajena"));

    const result = await createProfile(SALON_ID, baseCreateInput, null, KEY);

    expect(result).toEqual({ ok: false, error: "Error al crear el colaborador." });
    expect(mockedCreateEmployee).not.toHaveBeenCalled();
    expect(mockedCaptureError).toHaveBeenCalledWith(expect.any(Error), {
      module: "errors",
      action: "public-message",
    });
  });

  it("rechaza un colaborador archivado con ese email sin llamar a la RPC", async () => {
    mockedFindEmployeeByEmail.mockResolvedValue(employeeRow({ is_active: false }));

    const result = await createProfile(SALON_ID, baseCreateInput, null, KEY);

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

    const result = await createProfile(SALON_ID, baseCreateInput, null, KEY);

    expect(result).toEqual({ ok: false, error: "Ya existe un colaborador activo con ese email." });
  });

  it("emite el enlace de acceso cuando hay email y rol", async () => {
    mockedGenerateInvite.mockResolvedValue({
      ok: true,
      value: { token: "tok", expiresAt: "2030-01-08T00:00:00Z" },
    });

    const result = await createProfile(SALON_ID, baseCreateInput, "role-1", KEY);

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

  it("devuelve el alta con aviso si el enlace falla después de confirmarse la escritura", async () => {
    mockedGenerateInvite.mockResolvedValue({ ok: false, error: "No se pudo generar el nuevo enlace de acceso." });

    const result = await createProfile(SALON_ID, baseCreateInput, "role-1", KEY);

    expect(result).toEqual({
      ok: true,
      value: { id: "new-employee", warnings: ["No se pudo generar el nuevo enlace de acceso."] },
    });
  });
});
