import { describe, expect, it } from "vitest";
import { PublicError } from "@/infra/public-error";
import { assertRoleDeletable } from "./role-deletion";

describe("assertRoleDeletable", () => {
  it("permite borrar un rol normal del salón", () => {
    expect(() => assertRoleDeletable({ is_system: false })).not.toThrow();
  });

  it("rechaza un rol de sistema con el mensaje público", () => {
    expect(() => assertRoleDeletable({ is_system: true })).toThrow(
      new PublicError("Los roles de sistema no se pueden eliminar.")
    );
  });

  it("rechaza un rol inexistente en el salón con 'Rol no encontrado.'", () => {
    expect(() => assertRoleDeletable(null)).toThrow(new PublicError("Rol no encontrado."));
  });
});
