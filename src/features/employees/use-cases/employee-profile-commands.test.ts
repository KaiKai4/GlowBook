import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/infra/result";
import { createEmployee, updateEmployee } from "./employee-profile-commands";
import { admitNewEmployee } from "./employee-admission";
import { createEmployeeProfile } from "./employee-profile-create";
import { updateEmployeeProfile } from "./employee-profile-update";

vi.mock("./employee-profile-create", () => ({
  createEmployeeProfile: vi.fn(),
}));
vi.mock("./employee-profile-update", () => ({
  updateEmployeeProfile: vi.fn(),
}));
vi.mock("./employee-admission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./employee-admission")>()),
  admitNewEmployee: vi.fn(),
}));

const SALON_ID = "00000000-0000-4000-8000-000000000001";
const KEY = "00000000-0000-4000-8000-0000000000f1";
const ROLE_ID = "00000000-0000-4000-8000-0000000000ff";
const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const checks = {
  checkModuleAccess: vi.fn(async () => ok(undefined)),
  checkActiveLimit: vi.fn(async () => ok(undefined)),
  checkLoginLimit: vi.fn(async () => ok(undefined)),
};

const data = {
  first_name: "Ana",
  last_name: "Pérez",
  phone: "",
  email: "",
  specialty: "",
  commission_percentage: 0,
  service_ids: [],
  category_ids: [],
};

const createInput = (extra: { rolesEnabled?: boolean; requestedRoleId?: string | null } = {}) => ({
  salonId: SALON_ID,
  rolesEnabled: extra.rolesEnabled ?? true,
  checks,
  requestedRoleId: extra.requestedRoleId ?? null,
  idempotencyKey: KEY,
  data,
});

describe("createEmployee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(admitNewEmployee).mockImplementation(async (input) => ok({ roleId: input.rolesEnabled ? input.requestedRoleId : null }));
    vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));
  });

  it("corta sin crear el colaborador si la admision falla", async () => {
    vi.mocked(admitNewEmployee).mockResolvedValue(err("Límite de colaboradores alcanzado."));

    const result = await createEmployee(createInput());

    expect(result).toEqual(err("Límite de colaboradores alcanzado."));
    expect(createEmployeeProfile).not.toHaveBeenCalled();
  });

  it("crea el colaborador con el rol admitido y la clave recibida", async () => {
    const result = await createEmployee(createInput({ requestedRoleId: ROLE_ID }));

    expect(admitNewEmployee).toHaveBeenCalledWith({ rolesEnabled: true, requestedRoleId: ROLE_ID, checks });
    expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, data, ROLE_ID, KEY);
    expect(result).toEqual(ok({ id: EMPLOYEE_ID }));
  });

  it("no pasa rol cuando el salón no tiene roles habilitados", async () => {
    await createEmployee(createInput({ rolesEnabled: false, requestedRoleId: ROLE_ID }));

    expect(admitNewEmployee).toHaveBeenCalledWith(expect.objectContaining({ requestedRoleId: ROLE_ID }));
    expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, data, null, KEY);
  });

  it("devuelve el error del caso de uso de alta", async () => {
    vi.mocked(createEmployeeProfile).mockResolvedValue(err("El email ya existe."));

    expect(await createEmployee(createInput())).toEqual(err("El email ya existe."));
  });

  it("admitNewEmployee sigue siendo la fuente del rol efectivo", async () => {
    vi.mocked(admitNewEmployee).mockResolvedValue(ok({ roleId: null }));

    await createEmployee(createInput({ requestedRoleId: ROLE_ID }));

    expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, data, null, KEY);
  });
});

describe("updateEmployee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateEmployeeProfile).mockResolvedValue(ok({}));
  });

  it("escribe los datos recibidos con la clave y el salón", async () => {
    const patch = { phone: "555" };

    const result = await updateEmployee(SALON_ID, EMPLOYEE_ID, patch, KEY);

    expect(updateEmployeeProfile).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, patch, KEY);
    expect(result).toEqual(ok({}));
  });

  it("devuelve el error del caso de uso de edicion", async () => {
    vi.mocked(updateEmployeeProfile).mockResolvedValue(err("No encontrado."));

    expect(await updateEmployee(SALON_ID, EMPLOYEE_ID, {}, KEY)).toEqual(err("No encontrado."));
  });
});
