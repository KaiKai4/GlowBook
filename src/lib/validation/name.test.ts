import { describe, expect, it } from "vitest";
import { personNameField } from "./name";

describe("personNameField", () => {
  const field = personNameField("El nombre es obligatorio.");

  it("accepts letters from any alphabet with apostrophes, hyphens and periods", () => {
    expect(field.safeParse("María José").success).toBe(true);
    expect(field.safeParse("D’Angelo-Ruiz J. ").data).toBe("D’Angelo-Ruiz J.");
    expect(field.safeParse("Zoë").success).toBe(true);
  });

  it("rejects an empty name with the required message", () => {
    const result = field.safeParse("   ");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("El nombre es obligatorio.");
  });

  it("rejects digits and symbols with the label in the message", () => {
    const result = field.safeParse("Ana4");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "El nombre solo puede contener letras (sin números ni símbolos)."
    );
  });

  it("uses a custom label and rejects names longer than 120 characters", () => {
    const named = personNameField("Requerido.", "El apellido");

    expect(named.safeParse("Ana@").error?.issues[0]?.message).toBe(
      "El apellido solo puede contener letras (sin números ni símbolos)."
    );
    expect(field.safeParse("a".repeat(121)).success).toBe(false);
  });
});
