import { describe, expect, it } from "vitest";
import { z } from "@/infra/validation/zod";
import { parseOption } from "./parse-option";

const statusSchema = z.enum(["all", "active", "inactive"]);

describe("parseOption", () => {
  it("devuelve la opción cuando pertenece al esquema", () => {
    expect(parseOption(statusSchema, "active", "all")).toBe("active");
  });

  it("devuelve el fallback cuando el valor no es una opción", () => {
    expect(parseOption(statusSchema, "archived", "all")).toBe("all");
    expect(parseOption(statusSchema, "", "inactive")).toBe("inactive");
  });

  it("devuelve undefined sin fallback cuando el valor no es una opción", () => {
    expect(parseOption(statusSchema, "archived")).toBeUndefined();
    expect(parseOption(statusSchema, "inactive")).toBe("inactive");
  });

  it("acepta un esquema de cadena libre sin restringir el valor", () => {
    expect(parseOption(z.string(), "Yappy")).toBe("Yappy");
  });
});
