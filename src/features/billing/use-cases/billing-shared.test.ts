import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordPlatformAction } from "@/features/platform/use-cases/platform-audit";
import { auditBilling, dateOrNull, normalizeKey } from "./billing-shared";

// Utilidades de los casos de uso de billing: claves normalizadas, fechas
// opcionales, mensajes de error con prefijo y auditoría con actor opcional.

vi.mock("@/features/platform/use-cases/platform-audit", () => ({
  recordPlatformAction: vi.fn(async () => []),
}));

const auditMock = vi.mocked(recordPlatformAction);

beforeEach(() => {
  vi.clearAllMocks();
  auditMock.mockReset();
});

describe("auditBilling", () => {
  it("registra la acción de billing sobre el recurso comercial con el actor indicado", async () => {
    await auditBilling("actor-1", "commercial_plan_saved", "plan-1");

    expect(auditMock).toHaveBeenCalledWith({
      actorUserId: "actor-1",
      action: "commercial_plan_saved",
      status: "succeeded",
      targetResourceType: "commercial_plan",
      targetResourceId: "plan-1",
    });
  });

  it("registra actor nulo cuando no hay usuario, tanto si es undefined como null", async () => {
    await auditBilling(undefined, "commercial_plan_archived", "plan-2");
    await auditBilling(null, "commercial_plan_deleted", "plan-3");

    expect(auditMock.mock.calls.map(([input]) => input.actorUserId)).toEqual([null, null]);
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

