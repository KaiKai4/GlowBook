import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveCommercialAddon } from "../data/commercial-addons.repo";
import { savePlanLimit, savePlanModule } from "../data/commercial-plans.repo";
import { recordPlatformAction } from "@/features/platform/use-cases/platform-audit";
import { err, ok } from "@/infra/result";
import { saveCommercialAddonConfig } from "./commercial-addons";
import { saveCommercialPlanLimitsBatch, saveCommercialPlanModulesBatch } from "./commercial-plans";

// Validación de entrada de los casos de uso de catálogo comercial: cada
// rechazo debe ocurrir antes de tocar la base de datos.

vi.mock("../data/commercial-addons.repo", () => ({
  saveCommercialAddon: vi.fn(),
  archiveCommercialAddon: vi.fn(),
  deleteCommercialAddon: vi.fn(),
  countAddonAssignments: vi.fn(),
  findCommercialAddons: vi.fn(),
  findCommercialAddonById: vi.fn(),
}));
vi.mock("../data/commercial-plans.repo", () => ({
  archiveCommercialPlan: vi.fn(),
  deleteCommercialPlan: vi.fn(),
  findPlanCatalog: vi.fn(),
  saveCommercialPlan: vi.fn(),
  saveLimitMetric: vi.fn(),
  savePlanLimit: vi.fn(),
  savePlanModule: vi.fn(),
}));
vi.mock("../data/salon-subscriptions.repo", () => ({
  findSubscriptionRows: vi.fn(),
}));
vi.mock("@/features/platform/use-cases/platform-audit", () => ({
  recordPlatformAction: vi.fn(async () => []),
}));

const PLAN_ID = "00000000-0000-4000-8000-0000000000a1";

describe("saveCommercialAddonConfig: validación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveCommercialAddon).mockResolvedValue("addon-1");
  });

  it("rechaza un nombre demasiado corto", async () => {
    expect(
      await saveCommercialAddonConfig({ name: "A", kind: "module", moduleKey: "reports", monthlyPrice: 10 })
    ).toEqual(err("Escribe el nombre del extra."));
    expect(saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("rechaza un precio mensual negativo", async () => {
    expect(
      await saveCommercialAddonConfig({ name: "Reportes", kind: "module", moduleKey: "reports", monthlyPrice: -1 })
    ).toEqual(err("El precio no puede ser negativo."));
  });

  it("exige el módulo que activa un extra de tipo módulo", async () => {
    expect(
      await saveCommercialAddonConfig({ name: "Reportes", kind: "module", monthlyPrice: 10 })
    ).toEqual(err("Selecciona el modulo que activa este extra."));
    expect(saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("exige la métrica y el incremento para un extra que sube un límite", async () => {
    expect(
      await saveCommercialAddonConfig({ name: "Clientes", kind: "limit_boost", monthlyPrice: 5, limitDelta: 10 })
    ).toEqual(err("Selecciona el límite que aumenta este extra."));

    expect(
      await saveCommercialAddonConfig({
        name: "Clientes",
        kind: "limit_boost",
        metricKey: "customers.active",
        monthlyPrice: 5,
        limitDelta: "",
      })
    ).toEqual(err("Indica cuanto aumenta el límite."));
    expect(saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("guarda un extra de módulo válido con código derivado del nombre y audita", async () => {
    const result = await saveCommercialAddonConfig(
      { name: "Reportes Pro", kind: "module", moduleKey: "reports", monthlyPrice: 10 },
      "actor-1"
    );

    expect(result).toEqual(ok("addon-1"));
    expect(saveCommercialAddon).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Reportes Pro", code: "reportes-pro", monthlyPrice: 10 })
    );
    expect(recordPlatformAction).toHaveBeenCalled();
  });
});

describe("saveCommercialPlanModulesBatch / saveCommercialPlanLimitsBatch: validación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza módulos sin plan válido y sin lista de módulos", async () => {
    expect(await saveCommercialPlanModulesBatch({ planId: "x", allModuleKeys: ["reports"] })).toEqual(
      err("Selecciona un plan.")
    );
    expect(await saveCommercialPlanModulesBatch({ planId: PLAN_ID, allModuleKeys: [] })).toEqual(
      err("No hay modulos para guardar.")
    );
    expect(savePlanModule).not.toHaveBeenCalled();
  });

  it("guarda cada módulo marcando solo los habilitados", async () => {
    const result = await saveCommercialPlanModulesBatch({
      planId: PLAN_ID,
      enabledModuleKeys: ["appointments"],
      allModuleKeys: ["appointments", "reports"],
    });

    expect(result).toEqual(ok(undefined));
    expect(savePlanModule).toHaveBeenCalledWith({ planId: PLAN_ID, moduleKey: "appointments", enabled: true });
    expect(savePlanModule).toHaveBeenCalledWith({ planId: PLAN_ID, moduleKey: "reports", enabled: false });
  });

  it("rechaza límites sin plan válido y sin límites", async () => {
    expect(
      await saveCommercialPlanLimitsBatch({
        planId: "x",
        limits: [{ metricKey: "customers.active" }],
      })
    ).toEqual(err("Selecciona un plan."));
    expect(await saveCommercialPlanLimitsBatch({ planId: PLAN_ID, limits: [] })).toEqual(
      err("No hay límites para guardar.")
    );
    expect(savePlanLimit).not.toHaveBeenCalled();
  });

  it("guarda cada límite asociado al plan", async () => {
    const result = await saveCommercialPlanLimitsBatch({
      planId: PLAN_ID,
      limits: [{ metricKey: "customers.active", maxValue: 50 }],
    });

    expect(result).toEqual(ok(undefined));
    expect(savePlanLimit).toHaveBeenCalledWith(
      expect.objectContaining({ planId: PLAN_ID, metricKey: "customers.active", maxValue: 50 })
    );
  });
});
