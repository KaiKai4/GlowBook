import { describe, expect, it } from "vitest";
import { formFlag, formText } from "./form-fields";

describe("formText", () => {
  it("devuelve el texto del valor y el defecto solo si falta", () => {
    expect(formText("Ana")).toBe("Ana");
    expect(formText(null, "0")).toBe("0");
    expect(formText(undefined)).toBe("");
    expect(formText(12, "0")).toBe("12");
  });
});

describe("formFlag", () => {
  it("solo 'on' y 'true' cuentan como marcado", () => {
    expect(formFlag("on")).toBe(true);
    expect(formFlag("true")).toBe(true);
    expect(formFlag("false")).toBe(false);
    expect(formFlag(null)).toBe(false);
  });
});
