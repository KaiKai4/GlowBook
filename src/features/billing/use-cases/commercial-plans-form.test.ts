import { describe, expect, it } from "vitest";
import {
  readSaveAddonInput,
  readSavePlanInput,
  readSavePlanLimitsInput,
  readSavePlanModulesInput,
} from "./commercial-plans-form";

function fields(entries: Array<[string, string]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("readSavePlanInput", () => {
  it("un id vacio es alta (undefined) y los valores ausentes toman sus defectos", () => {
    expect(readSavePlanInput(fields([["id", ""]]))).toEqual({
      id: undefined,
      name: "",
      code: "",
      description: "",
      monthlyPrice: "0",
      currency: "USD",
      trialDays: "0",
      status: "draft",
      isPublic: false,
      sortOrder: "0",
    });
  });

  it("interpreta la casilla publica como 'on' o 'true' y conserva el id de edicion", () => {
    const on = readSavePlanInput(fields([["id", "p-1"], ["isPublic", "on"]]));
    const truthy = readSavePlanInput(fields([["isPublic", "true"]]));
    const other = readSavePlanInput(fields([["isPublic", "no"]]));

    expect(on).toMatchObject({ id: "p-1", isPublic: true });
    expect(truthy.isPublic).toBe(true);
    expect(other.isPublic).toBe(false);
  });
});

describe("readSavePlanModulesInput", () => {
  it("reune todos los modulos y solo los activados", () => {
    const data = fields([["planId", "plan-1"]]);
    data.append("allModuleKeys", "inventory");
    data.append("allModuleKeys", "retail");
    data.append("enabledModuleKeys", "retail");

    expect(readSavePlanModulesInput(data)).toEqual({
      planId: "plan-1",
      allModuleKeys: ["inventory", "retail"],
      enabledModuleKeys: ["retail"],
    });
  });
});

describe("readSavePlanLimitsInput", () => {
  it("construye un limite por clave de metrica y aplica los defectos por indice", () => {
    const data = fields([["planId", "plan-1"]]);
    data.append("metricKey", "appointments");
    data.append("metricKey", "employees");
    data.append("maxValue", "100");
    data.append("enforcementMode", "block");
    data.append("countScope", "monthly");
    data.append("warningThreshold", "90");

    expect(readSavePlanLimitsInput(data)).toEqual({
      planId: "plan-1",
      limits: [
        {
          metricKey: "appointments",
          maxValue: "100",
          enforcementMode: "block",
          warningThreshold: "90",
          countScope: "monthly",
        },
        {
          metricKey: "employees",
          maxValue: "",
          enforcementMode: "warn",
          warningThreshold: "80",
          countScope: "current",
        },
      ],
    });
  });

  it("sin claves de metrica no genera limites", () => {
    expect(readSavePlanLimitsInput(new FormData()).limits).toEqual([]);
  });
});

describe("readSaveAddonInput", () => {
  it("vacia los campos opcionales a undefined y aplica los defectos del extra", () => {
    const input = readSaveAddonInput(fields([["name", "Turbo"], ["code", "turbo"]]));

    expect(input).toEqual({
      id: undefined,
      name: "Turbo",
      code: "turbo",
      description: "",
      kind: "module",
      moduleKey: undefined,
      metricKey: undefined,
      limitDelta: "",
      currency: "USD",
      monthlyPrice: "0",
      status: "active",
      sortOrder: "0",
    });
  });

  it("conserva el tipo, el modulo y la metrica cuando llegan", () => {
    const input = readSaveAddonInput(
      fields([["kind", "limit_boost"], ["moduleKey", "retail"], ["metricKey", "employees"], ["limitDelta", "10"]])
    );

    expect(input).toMatchObject({
      kind: "limit_boost",
      moduleKey: "retail",
      metricKey: "employees",
      limitDelta: "10",
    });
  });
});
