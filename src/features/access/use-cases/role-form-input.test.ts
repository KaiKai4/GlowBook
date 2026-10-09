import { describe, expect, it } from "vitest";
import { formDataOf } from "@/test/action-fixtures";
import { err, ok } from "@/infra/result";
import { parseCreateRoleForm, parseUpdateRolePermissionsForm } from "./role-form-input";

const ROLE_ID = "00000000-0000-4000-8000-0000000000bb";
const INVALID_PERMISSIONS = err("Permisos invalidos.");

describe("permission_keys del formulario de rol", () => {
  it("sin campo o vacio equivale a ninguna clave", () => {
    expect(parseCreateRoleForm(formDataOf({ name: "Caja" }))).toEqual(ok({ name: "Caja", permission_keys: [] }));
    expect(parseCreateRoleForm(formDataOf({ name: "Caja", permission_keys: "   " }))).toEqual(
      ok({ name: "Caja", permission_keys: [] })
    );
  });

  it("rechaza JSON mal formado, objetos y arreglos con no textos", () => {
    expect(parseCreateRoleForm(formDataOf({ name: "Caja", permission_keys: "{no-json" }))).toEqual(INVALID_PERMISSIONS);
    expect(parseCreateRoleForm(formDataOf({ name: "Caja", permission_keys: '{"clave":1}' }))).toEqual(INVALID_PERMISSIONS);
    expect(parseCreateRoleForm(formDataOf({ name: "Caja", permission_keys: "[1,2]" }))).toEqual(INVALID_PERMISSIONS);
  });
});

describe("parseCreateRoleForm", () => {
  it("valida el nombre con el mensaje del esquema", () => {
    expect(parseCreateRoleForm(formDataOf({ name: "" }))).toEqual(err("El nombre del rol es obligatorio"));
  });

  it("rechaza permisos invalidos antes que el nombre", () => {
    expect(parseCreateRoleForm(formDataOf({ name: "", permission_keys: "{" }))).toEqual(INVALID_PERMISSIONS);
  });

  it("devuelve nombre y claves de permiso", () => {
    expect(
      parseCreateRoleForm(formDataOf({ name: "Caja", permission_keys: '["appointments.view"]' }))
    ).toEqual(ok({ name: "Caja", permission_keys: ["appointments.view"] }));
  });
});

describe("parseUpdateRolePermissionsForm", () => {
  it("rechaza un identificador de rol que no es UUID", () => {
    const result = parseUpdateRolePermissionsForm(formDataOf({ role_id: "no-uuid" }));

    expect(result.ok).toBe(false);
  });

  it("devuelve el rol y sus claves", () => {
    expect(
      parseUpdateRolePermissionsForm(formDataOf({ role_id: ROLE_ID, permission_keys: '["customers.manage"]' }))
    ).toEqual(ok({ role_id: ROLE_ID, permission_keys: ["customers.manage"] }));
  });
});
