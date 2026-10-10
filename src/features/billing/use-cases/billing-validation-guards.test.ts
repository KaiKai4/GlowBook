import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCommercialAddonDeps, fakeCommercialPlanDeps } from "@/test/billing-command-fakes";
import { err, ok } from "@/infra/result";
import { saveCommercialAddonConfig } from "./commercial-addons";
import { saveCommercialPlanLimitsBatch, saveCommercialPlanModulesBatch } from "./commercial-plans";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Validación de entrada de los casos de uso de catálogo comercial: cada
// rechazo debe ocurrir antes de tocar la base de datos. Las escrituras se
// comprueban con fakes tipados inyectados por parámetro.

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
  countPlanAssignments: vi.fn(),
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
vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const PLAN_ID = "00000000-0000-4000-8000-0000000000a1";

describe("saveCommercialAddonConfig: validación", () => {
  let addonDeps: ReturnType<typeof fakeCommercialAddonDeps>;

  beforeEach(() => {
    addonDeps = fakeCommercialAddonDeps();
  });

  it("rechaza un nombre demasiado corto", async () => {
    expect(
      await saveCommercialAddonConfig(ADMIN_PROOF, { name: "A", kind: "module", moduleKey: "reports", monthlyPrice: 10 }, undefined, addonDeps)
    ).toEqual(err("Escribe el nombre del extra."));
    expect(addonDeps.saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("rechaza un precio mensual negativo", async () => {
    expect(
      await saveCommercialAddonConfig(ADMIN_PROOF, { name: "Reportes", kind: "module", moduleKey: "reports", monthlyPrice: -1 }, undefined, addonDeps)
    ).toEqual(err("El precio no puede ser negativo."));
  });

  it("exige el módulo que activa un extra de tipo módulo", async () => {
    expect(
      await saveCommercialAddonConfig(ADMIN_PROOF, { name: "Reportes", kind: "module", monthlyPrice: 10 }, undefined, addonDeps)
    ).toEqual(err("Selecciona el módulo que activa este extra."));
    expect(addonDeps.saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("exige la métrica y el incremento para un extra que sube un límite", async () => {
    expect(
      await saveCommercialAddonConfig(ADMIN_PROOF, { name: "Clientes", kind: "limit_boost", monthlyPrice: 5, limitDelta: 10 }, undefined, addonDeps)
    ).toEqual(err("Selecciona el límite que aumenta este extra."));

    expect(
      await saveCommercialAddonConfig(ADMIN_PROOF, 
        {
          name: "Clientes",
          kind: "limit_boost",
          metricKey: "customers.active",
          monthlyPrice: 5,
          limitDelta: "",
        },
        undefined,
        addonDeps
      )
    ).toEqual(err("Indica cuanto aumenta el límite."));
    expect(addonDeps.saveCommercialAddon).not.toHaveBeenCalled();
  });

  it("guarda un extra de módulo válido con código derivado del nombre y audita", async () => {
    const result = await saveCommercialAddonConfig(ADMIN_PROOF, 
      { name: "Reportes Pro", kind: "module", moduleKey: "reports", monthlyPrice: 10 },
      "actor-1",
      addonDeps
    );

    expect(result).toEqual(ok("addon-1"));
    expect(addonDeps.saveCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ name: "Reportes Pro", code: "reportes-pro", monthlyPrice: 10 })
    );
    expect(addonDeps.publishAuditEvent).toHaveBeenCalled();
  });
});

describe("saveCommercialPlanModulesBatch / saveCommercialPlanLimitsBatch: validación", () => {
  let planDeps: ReturnType<typeof fakeCommercialPlanDeps>;

  beforeEach(() => {
    planDeps = fakeCommercialPlanDeps();
  });

  it("rechaza módulos sin plan válido y sin lista de módulos", async () => {
    expect(await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: "x", allModuleKeys: ["reports"] }, undefined, planDeps)).toEqual(
      err("Selecciona un plan.")
    );
    expect(await saveCommercialPlanModulesBatch(ADMIN_PROOF, { planId: PLAN_ID, allModuleKeys: [] }, undefined, planDeps)).toEqual(
      err("No hay módulos para guardar.")
    );
    expect(planDeps.savePlanModule).not.toHaveBeenCalled();
  });

  it("guarda cada módulo marcando solo los habilitados", async () => {
    const result = await saveCommercialPlanModulesBatch(ADMIN_PROOF, 
      {
        planId: PLAN_ID,
        enabledModuleKeys: ["appointments"],
        allModuleKeys: ["appointments", "reports"],
      },
      undefined,
      planDeps
    );

    expect(result).toEqual(ok(undefined));
    expect(planDeps.savePlanModule).toHaveBeenCalledWith(ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "appointments", enabled: true });
    expect(planDeps.savePlanModule).toHaveBeenCalledWith(ADMIN_PROOF, { planId: PLAN_ID, moduleKey: "reports", enabled: false });
  });

  it("rechaza límites sin plan válido y sin límites", async () => {
    expect(
      await saveCommercialPlanLimitsBatch(ADMIN_PROOF, 
        {
          planId: "x",
          limits: [{ metricKey: "customers.active" }],
        },
        undefined,
        planDeps
      )
    ).toEqual(err("Selecciona un plan."));
    expect(await saveCommercialPlanLimitsBatch(ADMIN_PROOF, { planId: PLAN_ID, limits: [] }, undefined, planDeps)).toEqual(
      err("No hay límites para guardar.")
    );
    expect(planDeps.savePlanLimit).not.toHaveBeenCalled();
  });

  it("guarda cada límite asociado al plan", async () => {
    const result = await saveCommercialPlanLimitsBatch(ADMIN_PROOF, 
      {
        planId: PLAN_ID,
        limits: [{ metricKey: "customers.active", maxValue: 50 }],
      },
      undefined,
      planDeps
    );

    expect(result).toEqual(ok(undefined));
    expect(planDeps.savePlanLimit).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({ planId: PLAN_ID, metricKey: "customers.active", maxValue: 50 })
    );
  });
});
