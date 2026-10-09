import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CreateRoleSchema, UpdateRolePermissionsSchema } from "./schemas";

const ROLE_UUID = "00000000-0000-4000-8000-000000000001";

describe("CreateRoleSchema", () => {
  it("acepta un nombre válido y usa lista vacía de permisos por defecto", () => {
    expect(CreateRoleSchema.parse({ name: "Recepcion" })).toEqual({
      name: "Recepcion",
      permission_keys: [],
    });
  });

  it("rechaza un nombre vacío con el mensaje de dominio", () => {
    const result = CreateRoleSchema.safeParse({ name: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("El nombre del rol es obligatorio");
    }
  });

  it("acepta exactamente 100 caracteres y rechaza 101", () => {
    expect(CreateRoleSchema.safeParse({ name: "a".repeat(100) }).success).toBe(true);
    expect(CreateRoleSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("rechaza nombres sin cadena (número, nulo)", () => {
    expect(CreateRoleSchema.safeParse({ name: 12 }).success).toBe(false);
    expect(CreateRoleSchema.safeParse({ name: null }).success).toBe(false);
  });

  it("rechaza permission_keys que no son un arreglo de cadenas", () => {
    expect(
      CreateRoleSchema.safeParse({ name: "Caja", permission_keys: "reports.view" }).success
    ).toBe(false);
    expect(CreateRoleSchema.safeParse({ name: "Caja", permission_keys: [1] }).success).toBe(false);
  });

  it("property: cualquier nombre de 1 a 100 caracteres es válido", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name) => {
        expect(CreateRoleSchema.safeParse({ name }).success).toBe(true);
      })
    );
  });
});

describe("UpdateRolePermissionsSchema", () => {
  it("acepta un role_id uuid con claves de permiso", () => {
    expect(
      UpdateRolePermissionsSchema.parse({
        role_id: ROLE_UUID,
        permission_keys: ["reports.view"],
      })
    ).toEqual({ role_id: ROLE_UUID, permission_keys: ["reports.view"] });
  });

  it("rechaza un role_id que no es uuid", () => {
    expect(
      UpdateRolePermissionsSchema.safeParse({ role_id: "rol-1", permission_keys: [] }).success
    ).toBe(false);
  });

  it("exige permission_keys (no tiene valor por defecto)", () => {
    expect(UpdateRolePermissionsSchema.safeParse({ role_id: ROLE_UUID }).success).toBe(false);
  });
});
