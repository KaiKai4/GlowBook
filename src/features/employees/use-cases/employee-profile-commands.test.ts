import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/infra/result";
import { createEmployeeFlow, updateEmployeeFlow } from "./employee-profile-commands";
import { admitNewEmployee } from "./employee-admission";
import { createEmployeeProfile, updateEmployeeProfile } from "./employee-profile";
import { formDataOf } from "@/test/action-fixtures";

vi.mock("./employee-profile", () => ({
  createEmployeeProfile: vi.fn(),
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

const validForm = (extra: Record<string, string> = {}) =>
  formDataOf({ idempotency_key: KEY, first_name: "Ana", last_name: "Pérez", ...extra });

describe("createEmployeeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(admitNewEmployee).mockImplementation(async (input) => ok({ roleId: input.rolesEnabled ? input.requestedRoleId : null }));
    vi.mocked(createEmployeeProfile).mockResolvedValue(ok({ id: EMPLOYEE_ID }));
  });

  it("corta antes de validar la clave y el formulario si la admision falla", async () => {
    vi.mocked(admitNewEmployee).mockResolvedValue(err("Límite de colaboradores alcanzado."));

    const result = await createEmployeeFlow(
      { salonId: SALON_ID, rolesEnabled: true, checks },
      formDataOf({ first_name: "" })
    );

    expect(result).toEqual(err("Límite de colaboradores alcanzado."));
    expect(createEmployeeProfile).not.toHaveBeenCalled();
  });

  it("pide la clave de idempotencia antes de leer el formulario", async () => {
    const result = await createEmployeeFlow(
      { salonId: SALON_ID, rolesEnabled: false, checks },
      formDataOf({ first_name: "", last_name: "" })
    );

    expect(result).toEqual(err("Solicitud inválida. Recarga la página e inténtalo de nuevo."));
    expect(createEmployeeProfile).not.toHaveBeenCalled();
  });

  it("devuelve el primer error del formulario sin crear el colaborador", async () => {
    const result = await createEmployeeFlow(
      { salonId: SALON_ID, rolesEnabled: false, checks },
      validForm({ first_name: "" })
    );

    expect(result).toEqual(err("El nombre es obligatorio"));
    expect(createEmployeeProfile).not.toHaveBeenCalled();
  });

  it("crea el colaborador con el rol admitido y la clave validada", async () => {
    const result = await createEmployeeFlow(
      { salonId: SALON_ID, rolesEnabled: true, checks },
      validForm({ role_id: ROLE_ID })
    );

    expect(admitNewEmployee).toHaveBeenCalledWith({ rolesEnabled: true, requestedRoleId: ROLE_ID, checks });
    expect(createEmployeeProfile).toHaveBeenCalledWith(
      SALON_ID,
      expect.objectContaining({ first_name: "Ana", last_name: "Pérez" }),
      ROLE_ID,
      KEY
    );
    expect(result).toEqual(ok({ id: EMPLOYEE_ID }));
  });

  it("no pasa rol cuando el salon no tiene roles habilitados", async () => {
    await createEmployeeFlow({ salonId: SALON_ID, rolesEnabled: false, checks }, validForm({ role_id: ROLE_ID }));

    expect(admitNewEmployee).toHaveBeenCalledWith(expect.objectContaining({ requestedRoleId: ROLE_ID }));
    expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), null, KEY);
  });

  it("devuelve el error del caso de uso de alta", async () => {
    vi.mocked(createEmployeeProfile).mockResolvedValue(err("El email ya existe."));

    expect(await createEmployeeFlow({ salonId: SALON_ID, rolesEnabled: false, checks }, validForm())).toEqual(
      err("El email ya existe.")
    );
  });

  it("admitNewEmployee sigue siendo la fuente del rol efectivo", async () => {
    vi.mocked(admitNewEmployee).mockResolvedValue(ok({ roleId: null }));

    await createEmployeeFlow({ salonId: SALON_ID, rolesEnabled: true, checks }, validForm({ role_id: ROLE_ID }));

    expect(createEmployeeProfile).toHaveBeenCalledWith(SALON_ID, expect.any(Object), null, KEY);
  });
});

describe("updateEmployeeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateEmployeeProfile).mockResolvedValue(ok({}));
  });

  it("valida la clave antes que el formulario", async () => {
    const result = await updateEmployeeFlow(SALON_ID, EMPLOYEE_ID, formDataOf({ first_name: "" }));

    expect(result).toEqual(err("Solicitud inválida. Recarga la página e inténtalo de nuevo."));
    expect(updateEmployeeProfile).not.toHaveBeenCalled();
  });

  it("rechaza un formulario de edicion invalido", async () => {
    const result = await updateEmployeeFlow(SALON_ID, EMPLOYEE_ID, validForm({ email: "no-es-email" }));

    expect(result).toEqual(err("Email inválido"));
    expect(updateEmployeeProfile).not.toHaveBeenCalled();
  });

  it("escribe solo los campos presentes con la clave validada", async () => {
    await updateEmployeeFlow(SALON_ID, EMPLOYEE_ID, formDataOf({ idempotency_key: KEY, phone: "555" }));

    expect(updateEmployeeProfile).toHaveBeenCalledWith(EMPLOYEE_ID, SALON_ID, { phone: "555", service_ids: [], category_ids: [] }, KEY);
  });
});
