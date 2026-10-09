import { describe, expect, it } from "vitest";
import { z, ZodError } from "@/infra/validation/zod";
import { firstIssueMessage } from "./first-issue";

describe("firstIssueMessage", () => {
  it("devuelve el mensaje del primer issue cuando hay varios", () => {
    const schema = z.object({
      name: z.string().min(1, "El nombre es obligatorio"),
      email: z.string().email("Email inválido"),
    });

    const parsed = schema.safeParse({ name: "", email: "no-es-email" });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(firstIssueMessage(parsed.error)).toBe("El nombre es obligatorio");
  });

  it("lanza un error explícito si el ZodError no tiene issues (invariante rota)", () => {
    // Zod nunca produce un ZodError sin issues desde safeParse; el caso solo
    // se construye a mano para comprobar que la invariante se hace explícita.
    expect(() => firstIssueMessage(new ZodError([]))).toThrow(
      "ZodError sin issues: invariante de validación rota."
    );
  });
});
