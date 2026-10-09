import { describe, expect, it } from "vitest";
import { compactNumber, niceMaximum, smoothPath } from "./chart-format";

describe("compactNumber", () => {
  it("muestra los valores pequeños sin abreviar", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(999)).toBe("999");
  });

  it("abrevia los miles con un decimal como máximo", () => {
    expect(compactNumber(1500)).toMatch(/^1[.,]5/);
    expect(compactNumber(12_000)).toMatch(/^12/);
  });
});

describe("niceMaximum", () => {
  it("redondea hacia arriba al múltiplo de la potencia de 10 del orden de magnitud", () => {
    expect(niceMaximum(1234)).toBe(2000);
    expect(niceMaximum(950)).toBe(1000);
    expect(niceMaximum(7)).toBe(7);
  });

  it("trata valores menores que 1 como orden de magnitud 1", () => {
    expect(niceMaximum(0.5)).toBe(1);
  });
});

describe("smoothPath", () => {
  it("devuelve cadena vacía sin puntos y solo el movimiento inicial con un punto", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 3, y: 4 }])).toBe("M 3 4");
  });

  it("traza una curva cúbica entre dos puntos con control al 40% del ancho", () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ])
    ).toBe("M 0 0 C 4 0, 6 5, 10 5");
  });

  it("falla explícitamente si falta un punto previo en una lista dispersa", () => {
    // reduce omite los huecos: el índice 2 llega sin el índice 1 disponible.
    const sparse: Array<{ x: number; y: number }> = new Array(3);
    sparse[0] = { x: 0, y: 0 };
    sparse[2] = { x: 5, y: 5 };

    expect(() => smoothPath(sparse)).toThrow("Invariante de gráfico: punto previo ausente.");
  });
});
