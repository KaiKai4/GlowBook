import { describe, expect, it, vi } from "vitest";
import { PasswordSchema, SignInSchema } from "./password-schemas";

vi.mock("server-only", () => ({}));

describe("PasswordSchema", () => {
  it("acepta una contrasena de al menos 8 caracteres", () => {
    expect(PasswordSchema.safeParse("12345678").success).toBe(true);
  });

  it("rechaza una contrasena corta con el mensaje que muestra el formulario", () => {
    const result = PasswordSchema.safeParse("1234567");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("La contraseña debe tener al menos 8 caracteres.");
  });
});

describe("SignInSchema", () => {
  it("recorta el email y conserva la contrasena y la opcion de recordar", () => {
    expect(
      SignInSchema.parse({ email: "  ana@example.com ", password: "x", remember: false })
    ).toEqual({ email: "ana@example.com", password: "x", remember: false });
  });

  it("exige email y contrasena no vacios", () => {
    expect(SignInSchema.safeParse({ email: "   ", password: "x", remember: true }).success).toBe(false);
    expect(SignInSchema.safeParse({ email: "a@b.com", password: "", remember: true }).success).toBe(false);
  });
});
