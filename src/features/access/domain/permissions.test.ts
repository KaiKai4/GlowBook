import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG } from "./permissions";

// El catálogo es la fuente de verdad del RBAC en código: cada permiso debe
// tener una clave con forma "recurso.accion" y una descripción visible en /roles.

describe("PERMISSION_CATALOG shape", () => {
  it("tiene claves con forma recurso.accion en minúsculas", () => {
    for (const permission of PERMISSION_CATALOG) {
      expect(permission.key).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it("cada permiso tiene una descripción no vacía", () => {
    for (const permission of PERMISSION_CATALOG) {
      expect(permission.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("incluye los permisos que protegen la gestión de roles y colaboradores", () => {
    const keys: string[] = PERMISSION_CATALOG.map((permission) => permission.key);

    expect(keys).toContain("roles.manage");
    expect(keys).toContain("employees.manage");
  });
});
