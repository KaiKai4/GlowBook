import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCommercialAddonDeps } from "@/test/billing-command-fakes";
import { err, ok } from "@/infra/result";
import { removeCommercialAddonConfig, saveCommercialAddonConfig } from "./commercial-addons";
import { issuePlatformAdminProof } from "@/infra/auth/platform-admin-proof";
const ADMIN_PROOF = issuePlatformAdminProof("admin-1");

// Catálogo de extras: el guardado normaliza código y moneda y limpia los campos
// que no aplican al tipo; la eliminación archiva si hay asignaciones y borra si no.
// Las escrituras reciben fakes tipados por parámetro; el vi.mock de data/ solo evita
// cargar el cliente real al importar el módulo.

vi.mock("../data/commercial-addons.repo", () => ({
  archiveCommercialAddon: vi.fn(),
  countAddonAssignments: vi.fn(),
  deleteCommercialAddon: vi.fn(),
  findCommercialAddonById: vi.fn(),
  findCommercialAddons: vi.fn(),
  saveCommercialAddon: vi.fn(),
}));
vi.mock("@/features/audit", () => ({
  publishAuditEvent: vi.fn(async () => []),
}));

const ADDON_ID = "00000000-0000-4000-8000-0000000000d1";
const ACTOR_ID = "00000000-0000-4000-8000-0000000000d2";

let deps: ReturnType<typeof fakeCommercialAddonDeps>;

beforeEach(() => {
  deps = fakeCommercialAddonDeps();
});

describe("saveCommercialAddonConfig", () => {
  it("normaliza el código desde el nombre, pone la moneda en mayúsculas y limpia el tipo módulo", async () => {
    const result = await saveCommercialAddonConfig(ADMIN_PROOF, 
      {
        name: "  Analítica Avanzada  ",
        kind: "module",
        moduleKey: "reports",
        metricKey: "customers_active",
        limitDelta: 40,
        currency: "usd",
        monthlyPrice: "12.5",
      },
      ACTOR_ID,
      deps
    );

    expect(result).toEqual(ok("addon-1"));
    expect(deps.saveCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, {
      id: undefined,
      code: "analitica-avanzada",
      name: "Analítica Avanzada",
      description: "",
      kind: "module",
      moduleKey: "reports",
      metricKey: null,
      limitDelta: null,
      currency: "USD",
      monthlyPrice: 12.5,
      status: "active",
      sortOrder: 0,
    });
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.addon_saved",
      expect.objectContaining({ actorUserId: ACTOR_ID, action: "commercial_addon_saved", targetResourceId: "addon-1" })
    );
  });

  it("usa el código explícito normalizado y, en tipo límite, descarta el módulo", async () => {
    await saveCommercialAddonConfig(ADMIN_PROOF, 
      {
        id: ADDON_ID,
        name: "Clientes extra",
        code: "Clientes Plus!!",
        kind: "limit_boost",
        moduleKey: "reports",
        metricKey: "customers_active",
        limitDelta: "50",
        monthlyPrice: 4,
        status: "draft",
        sortOrder: "3",
      },
      undefined,
      deps
    );

    expect(deps.saveCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, 
      expect.objectContaining({
        id: ADDON_ID,
        code: "clientes-plus",
        moduleKey: null,
        metricKey: "customers_active",
        limitDelta: 50,
        status: "draft",
        sortOrder: 3,
      })
    );
  });

  it("rechaza un extra de límite sin incremento antes de guardar", async () => {
    const result = await saveCommercialAddonConfig(ADMIN_PROOF, 
      {
        name: "Clientes",
        kind: "limit_boost",
        metricKey: "customers_active",
        limitDelta: "",
        monthlyPrice: 4,
      },
      undefined,
      deps
    );

    expect(result.ok).toBe(false);
    expect(deps.saveCommercialAddon).not.toHaveBeenCalled();
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });

  it("devuelve el prefijo propio cuando el repositorio falla, sin auditar", async () => {
    deps.saveCommercialAddon.mockRejectedValueOnce(new Error("constraint"));

    const result = await saveCommercialAddonConfig(ADMIN_PROOF, 
      {
        name: "Reportes",
        kind: "module",
        moduleKey: "reports",
        monthlyPrice: 10,
      },
      undefined,
      deps
    );

    expect(result).toEqual(err(expect.stringContaining("No se pudo guardar el extra.")));
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });

  it("devuelve el prefijo propio sin detalle cuando el fallo no es un Error", async () => {
    deps.saveCommercialAddon.mockRejectedValueOnce("fallo sin detalle");

    const result = await saveCommercialAddonConfig(ADMIN_PROOF, 
      {
        name: "Reportes",
        kind: "module",
        moduleKey: "reports",
        monthlyPrice: 10,
      },
      undefined,
      deps
    );

    expect(result).toEqual(err("No se pudo guardar el extra."));
  });
});

describe("removeCommercialAddonConfig", () => {
  it("archiva el extra con asignaciones existentes y audita el archivado", async () => {
    deps.countAddonAssignments.mockResolvedValueOnce(3);

    const result = await removeCommercialAddonConfig(ADMIN_PROOF, ADDON_ID, ACTOR_ID, deps);

    expect(result).toEqual(ok(undefined));
    expect(deps.archiveCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, ADDON_ID);
    expect(deps.deleteCommercialAddon).not.toHaveBeenCalled();
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.addon_archived",
      expect.objectContaining({ action: "commercial_addon_archived", actorUserId: ACTOR_ID, targetResourceId: ADDON_ID })
    );
  });

  it("borra el extra sin asignaciones y audita el borrado con actor nulo por defecto", async () => {
    const result = await removeCommercialAddonConfig(ADMIN_PROOF, ADDON_ID, undefined, deps);

    expect(result).toEqual(ok(undefined));
    expect(deps.deleteCommercialAddon).toHaveBeenCalledWith(ADMIN_PROOF, ADDON_ID);
    expect(deps.archiveCommercialAddon).not.toHaveBeenCalled();
    expect(deps.publishAuditEvent).toHaveBeenCalledWith("billing.addon_deleted",
      expect.objectContaining({ action: "commercial_addon_deleted", actorUserId: null, targetResourceId: ADDON_ID })
    );
  });

  it("devuelve el prefijo propio cuando el conteo o el borrado fallan", async () => {
    deps.countAddonAssignments.mockRejectedValueOnce(new Error("timeout"));

    expect(await removeCommercialAddonConfig(ADMIN_PROOF, ADDON_ID, undefined, deps)).toEqual(
      err(expect.stringContaining("No se pudo eliminar el extra."))
    );

    deps.countAddonAssignments.mockResolvedValueOnce(0);
    deps.deleteCommercialAddon.mockRejectedValueOnce(new Error("bloqueado"));
    expect(await removeCommercialAddonConfig(ADMIN_PROOF, ADDON_ID, undefined, deps)).toEqual(
      err(expect.stringContaining("No se pudo eliminar el extra."))
    );
    expect(deps.publishAuditEvent).not.toHaveBeenCalled();
  });
});
