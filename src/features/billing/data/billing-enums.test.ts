import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { parseFeatureKey, parsePlanModuleKeys, parseAlertSeverity } from "./billing-enums";

// Los mapeos de catálogo leen valores de la BD: una clave de módulo retirada no
// debe tumbar la página, y una clave desconocida se registra una sola vez.

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const mockedCapture = vi.mocked(captureError);

describe("parsePlanModuleKeys", () => {
  beforeEach(() => {
    mockedCapture.mockClear();
  });

  it("devuelve solo las claves conocidas y no registra nada si todas lo son", () => {
    expect(parsePlanModuleKeys(["expenses", "reports"], "commercial_plan_modules.module_key")).toEqual([
      "expenses",
      "reports",
    ]);
    expect(mockedCapture).not.toHaveBeenCalled();
  });

  it("descarta una clave retirada y la registra con captureError", () => {
    const keys = parsePlanModuleKeys(["expenses", "modulo-retirado-a"], "commercial_plan_modules.module_key");

    expect(keys).toEqual(["expenses"]);
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(mockedCapture).toHaveBeenCalledWith(expect.any(Error), {
      module: "billing",
      action: "parse-plan-module",
    });
  });

  it("registra una clave desconocida solo una vez aunque se repita", () => {
    parsePlanModuleKeys(["modulo-retirado-b"], "commercial_plan_modules.module_key");
    parsePlanModuleKeys(["modulo-retirado-b"], "commercial_plan_modules.module_key");

    expect(mockedCapture).toHaveBeenCalledTimes(1);
  });
});

describe("parseFeatureKey y enumerados", () => {
  it("parseFeatureKey sigue fallando con una clave desconocida", () => {
    expect(() => parseFeatureKey("modulo-inexistente", "platform_modules.key")).toThrow(
      "Valor inesperado en platform_modules.key: modulo-inexistente"
    );
  });

  it("los enumerados vienen del dominio y rechazan valores fuera de la lista", () => {
    expect(parseAlertSeverity("danger")).toBe("danger");
    expect(() => parseAlertSeverity("critico")).toThrow("salon_plan_alerts.severity");
  });
});
