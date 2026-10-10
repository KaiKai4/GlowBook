import { describe, expect, it } from "vitest";
import { err, ok } from "@/infra/result";
import { formDataOf } from "@/test/action-fixtures";
import { parseCreateEmployeeForm, parseUpdateEmployeeForm } from "./employee-form-input";

const KEY = "00000000-0000-4000-8000-0000000000f1";
const ROLE_ID = "00000000-0000-4000-8000-0000000000ff";
const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000dd";
const INVALID_KEY = "Solicitud inválida. Recarga la página e inténtalo de nuevo.";

const validCreate = (extra: Record<string, string> = {}) =>
  formDataOf({ idempotency_key: KEY, first_name: "Ana", last_name: "Pérez", ...extra });

describe("parseCreateEmployeeForm", () => {
  it("devuelve la clave, el rol pedido y los datos validados del alta", () => {
    const result = parseCreateEmployeeForm(validCreate({ role_id: ROLE_ID, commission_percentage: "15" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.idempotencyKey).toBe(KEY);
    expect(result.value.requestedRoleId).toBe(ROLE_ID);
    expect(result.value.data).toEqual(
      expect.objectContaining({ first_name: "Ana", last_name: "Pérez", commission_percentage: 15 })
    );
  });

  it("sin role_id el rol pedido es null", () => {
    const result = parseCreateEmployeeForm(validCreate());

    expect(result.ok && result.value.requestedRoleId).toBeNull();
  });

  it("pide una clave de idempotencia válida antes de mirar el formulario", () => {
    expect(parseCreateEmployeeForm(formDataOf({ first_name: "", last_name: "" }))).toEqual(err(INVALID_KEY));
    expect(parseCreateEmployeeForm(formDataOf({ idempotency_key: "no-uuid", first_name: "" }))).toEqual(
      err(INVALID_KEY)
    );
  });

  it("devuelve el primer error del esquema de alta", () => {
    expect(parseCreateEmployeeForm(validCreate({ first_name: "" }))).toEqual(err("El nombre es obligatorio"));
    expect(parseCreateEmployeeForm(validCreate({ email: "no-es-email" }))).toEqual(err("Email inválido"));
  });
});

describe("parseUpdateEmployeeForm", () => {
  it("devuelve el colaborador, la clave y solo los campos presentes", () => {
    const result = parseUpdateEmployeeForm({
      employeeId: EMPLOYEE_ID,
      formData: formDataOf({ idempotency_key: KEY, phone: "555" }),
    });

    expect(result).toEqual(
      ok({
        employeeId: EMPLOYEE_ID,
        idempotencyKey: KEY,
        data: { phone: "555", service_ids: [], category_ids: [] },
      })
    );
  });

  it("rechaza un identificador de colaborador mal formado", () => {
    expect(
      parseUpdateEmployeeForm({ employeeId: "no-uuid", formData: formDataOf({ idempotency_key: KEY }) })
    ).toEqual(err("Identificador inválido."));
  });

  it("valida la clave antes que el formulario", () => {
    expect(
      parseUpdateEmployeeForm({ employeeId: EMPLOYEE_ID, formData: formDataOf({ first_name: "" }) })
    ).toEqual(err(INVALID_KEY));
  });

  it("rechaza un formulario de edicion inválido", () => {
    expect(
      parseUpdateEmployeeForm({
        employeeId: EMPLOYEE_ID,
        formData: formDataOf({ idempotency_key: KEY, email: "no-es-email" }),
      })
    ).toEqual(err("Email inválido"));
  });
});
