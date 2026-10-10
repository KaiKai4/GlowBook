import { describe, expect, it } from "vitest";
import { z, ZodError } from "./zod";
import { firstIssueMessage } from "./first-issue";
import { parseUuid } from "./route-id";

describe("adaptador zod", () => {
  it("expone z y ZodError listos para usar en todo src", () => {
    const schema = z.object({ name: z.string().min(1, "Nombre obligatorio") });

    const parsed = schema.safeParse({ name: "Ana" });

    expect(parsed.success).toBe(true);
    expect(schema.safeParse({ name: "" }).success).toBe(false);
  });

  it("activa el modo sin JIT (sin evaluacion dinamica de codigo)", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("los errores de validación son instancias de ZodError del adaptador", () => {
    const result = z.string().safeParse(42);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ZodError);
  });
});

describe("firstIssueMessage", () => {
  it("devuelve el mensaje del primer issue de un safeParse fallido", () => {
    const result = z
      .object({ email: z.email("Correo inválido"), name: z.string().min(2, "Nombre corto") })
      .safeParse({ email: "x", name: "a" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(firstIssueMessage(result.error)).toBe("Correo inválido");
  });

  it("lanza un error explicito si el ZodError no tiene issues", () => {
    expect(() => firstIssueMessage(new ZodError([]))).toThrow(
      "ZodError sin issues: invariante de validación rota."
    );
  });
});

describe("parseUuid", () => {
  it("acepta un UUID bien formado, incluidos los UUID de seed con version 0", () => {
    expect(parseUuid("00000000-0000-4000-8000-000000000001")).toBe("00000000-0000-4000-8000-000000000001");
    expect(parseUuid("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("devuelve null para cadenas que no son UUID", () => {
    expect(parseUuid("no-es-uuid")).toBeNull();
    expect(parseUuid("")).toBeNull();
    expect(parseUuid("00000000-0000-4000-8000-00000000000")).toBeNull();
    expect(parseUuid("00000000-0000-4000-8000-0000000000001")).toBeNull();
  });

  it("devuelve null para valores que no son cadenas", () => {
    expect(parseUuid(undefined)).toBeNull();
    expect(parseUuid(null)).toBeNull();
    expect(parseUuid(12345)).toBeNull();
    expect(parseUuid({ id: "00000000-0000-4000-8000-000000000001" })).toBeNull();
  });
});
