import { describe, expect, it } from "vitest";
import { emailSchema, optionalEmailSchema } from "./email";

describe("emailSchema", () => {
  it("acepta un email válido", () => {
    expect(emailSchema.parse("ana@glowbook.test")).toBe("ana@glowbook.test");
  });

  it("rechaza un email sin formato con el mensaje común", () => {
    const result = emailSchema.safeParse("no-es-email");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Email inválido");
  });

  it("rechaza un email de más de 255 caracteres", () => {
    const longEmail = `${"a".repeat(250)}@glowbook.test`;
    expect(emailSchema.safeParse(longEmail).success).toBe(false);
  });

  it("no acepta la cadena vacía ni null", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
    expect(emailSchema.safeParse(null).success).toBe(false);
  });
});

describe("optionalEmailSchema", () => {
  it("acepta la cadena vacía (campo sin email)", () => {
    expect(optionalEmailSchema.parse("")).toBe("");
  });

  it("acepta un email válido", () => {
    expect(optionalEmailSchema.parse("ana@glowbook.test")).toBe("ana@glowbook.test");
  });

  it("rechaza un valor con formato inválido con el mensaje común", () => {
    const result = optionalEmailSchema.safeParse("x");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Email inválido");
  });
});
