import { describe, expect, it } from "vitest";
import { requireInvariant } from "./invariant";

describe("requireInvariant", () => {
  it("devuelve el valor cuando existe, incluidos 0 y cadena vacia", () => {
    expect(requireInvariant(0, "x")).toBe(0);
    expect(requireInvariant("", "x")).toBe("");
    expect(requireInvariant(false, "x")).toBe(false);
  });

  it("lanza un Error tecnico con el mensaje si el valor es null o undefined", () => {
    expect(() => requireInvariant(null, "sin fila")).toThrow(new Error("sin fila"));
    expect(() => requireInvariant(undefined, "sin fila")).toThrow(new Error("sin fila"));
  });
});
