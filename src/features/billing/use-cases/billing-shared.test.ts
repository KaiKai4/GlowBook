import { describe, expect, it } from "vitest";
import { commercialPlanAudit, dateOrNull, normalizeKey } from "./billing-shared";

// Utilidades de los casos de uso de billing: payload comun de auditoria de
// planes, claves normalizadas y fechas opcionales. El evento concreto de cada
// caso de uso se prueba en sus propios tests.

describe("commercialPlanAudit", () => {
  it("arma el payload del recurso comercial con el actor indicado", () => {
    expect(commercialPlanAudit("actor-1", "plan-1")).toEqual({
      actorUserId: "actor-1",
      status: "succeeded",
      targetResourceType: "commercial_plan",
      targetResourceId: "plan-1",
    });
  });

  it("usa actor nulo cuando no hay usuario, tanto si es undefined como null", () => {
    expect(commercialPlanAudit(undefined, "plan-2").actorUserId).toBeNull();
    expect(commercialPlanAudit(null, "plan-3").actorUserId).toBeNull();
  });
});

describe("normalizeKey", () => {
  it("convierte el texto en una clave en minúsculas separada por guiones", () => {
    expect(normalizeKey("  Plan Pro 2026!  ")).toBe("plan-pro-2026");
  });

  it("quita tildes y diacríticos antes de generar la clave", () => {
    expect(normalizeKey("Analítica Ñandú")).toBe("analitica-nandu");
  });

  it("elimina guiones sobrantes al inicio y al final", () => {
    expect(normalizeKey("---Básico---")).toBe("basico");
  });

  it("devuelve cadena vacía cuando no queda ningún carácter alfanumérico", () => {
    expect(normalizeKey(" !!! ")).toBe("");
  });
});

describe("dateOrNull", () => {
  it("conserva una fecha con contenido tal cual", () => {
    expect(dateOrNull("2026-10-09")).toBe("2026-10-09");
  });

  it("devuelve null para ausencia, cadena vacía o solo espacios", () => {
    expect(dateOrNull(undefined)).toBeNull();
    expect(dateOrNull(null)).toBeNull();
    expect(dateOrNull("")).toBeNull();
    expect(dateOrNull("   ")).toBeNull();
  });
});
